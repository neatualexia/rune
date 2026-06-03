// ─────────────────────────────────────────────
// ui.js
// All DOM rendering and event handlers.
// Each page has its own clearly labelled section.
// Reads from `data` (storage.js) and cycle
// functions (cycle.js), but never calculates
// anything itself.
// ─────────────────────────────────────────────

// Symptoms shown on the log page.
// Add, remove, or reorder items here to customise.
const SYMPTOMS = [
  'Cramps', 'Headache', 'Bloating', 'Fatigue',
  'Backache', 'Nausea', 'Breast tenderness',
  'Spotting', 'Insomnia', 'Acne'
];


// ── Navigation ────────────────────────────────

function goPage(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  btn.classList.add('active');

  // Render the page we just switched to
  if (name === 'calendar') renderCalendar();
  if (name === 'log')      loadLogForm(logDate);
  if (name === 'insights') renderInsights();
}


// ── Home page ─────────────────────────────────

function updateHome() {
  const cycleLength = getAvgCycleLength();
  const cycleDay    = getCycleDay();
  const phase       = getPhaseName(cycleDay, cycleLength);

  // Cycle day + phase name in the ring
  document.getElementById('cycle-day').textContent  = cycleDay || '—';
  document.getElementById('phase-name').textContent = phase;

  // Stats row
  document.getElementById('stat-length').textContent =
    data.cycles.length >= 2 ? getAvgCycleLength() + 'd' : '—';

  document.getElementById('stat-period').textContent =
    data.cycles.filter(c => c.end).length ? getAvgPeriodLength() + 'd' : '—';

  const daysToNext = cycleDay ? cycleLength - cycleDay : null;
  document.getElementById('stat-next').textContent =
    (daysToNext !== null && daysToNext >= 0) ? daysToNext + 'd' : '—';

  // Animate the SVG ring to show cycle progress
  const progress = cycleDay ? Math.min(cycleDay / cycleLength, 1) : 0;
  const circumference = 2 * Math.PI * 68; // matches r="68" in the SVG
  document.getElementById('ring-progress').style.strokeDashoffset =
    circumference * (1 - progress);

  // Period toggle button
  const btn = document.getElementById('period-toggle');
  btn.textContent = isOnPeriod() ? 'End period' : 'Start period';
  btn.className   = 'action-btn' + (isOnPeriod() ? ' active-period' : '');

  // Today's log summary
  const todayLog = data.logs[today()] || {};
  const area = document.getElementById('home-log-area');
  if (todayLog.flow && todayLog.flow !== 'none') {
    area.innerHTML = `
      <p style="font-size:13px;color:var(--text-mid);margin-bottom:8px">
        Flow: <strong>${todayLog.flow}</strong>
        ${todayLog.mood ? ' · Mood: ' + todayLog.mood : ''}
      </p>`;
  } else {
    area.innerHTML =
      '<p style="font-size:13px;color:var(--text-soft);margin-bottom:8px">Nothing logged today yet.</p>';
  }
}

function togglePeriod() {
  if (isOnPeriod()) {
    // Close the current period
    data.cycles[data.cycles.length - 1].end = today();
  } else {
    // Start a new period
    data.cycles.push({ start: today(), end: null });
  }
  saveData(data);
  updateHome();
  renderInsights();
}

// Shortcut from the home page "Log today" button
function gotoLog() {
  logDate = today();
  document.getElementById('log-date-label').textContent = 'Today';
  goPage('log', document.getElementById('nav-log'));
}


// ── Calendar page ─────────────────────────────

let calMonth = new Date().getMonth();
let calYear  = new Date().getFullYear();

function changeMonth(delta) {
  calMonth += delta;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCalendar();
}

function renderCalendar() {
  const periodDays = getPeriodDays();
  const { fertile, ovulation, predicted } = getSpecialDays();

  document.getElementById('cal-title').textContent =
    new Date(calYear, calMonth, 1).toLocaleDateString('en', { month: 'long', year: 'numeric' });

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';

  // Day-of-week headers
  ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(label => {
    const el = document.createElement('div');
    el.className = 'cal-day-header';
    el.textContent = label;
    grid.appendChild(el);
  });

  // Empty cells before the 1st of the month
  const firstDow    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayKey    = today();

  for (let i = 0; i < firstDow; i++) {
    const d = new Date(calYear, calMonth, 1 - firstDow + i);
    const el = document.createElement('div');
    el.className = 'cal-day other-month';
    el.textContent = d.getDate();
    grid.appendChild(el);
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(calYear, calMonth, d);
    const key  = toKey(date);
    const el   = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;

    if (key === todayKey) el.classList.add('today');

    // Colour priority: period > predicted > ovulation > fertile
    if (periodDays.has(key))     el.classList.add('period');
    else if (predicted.has(key)) el.classList.add('period', 'predicted');
    else if (ovulation.has(key)) el.classList.add('ovulation');
    else if (fertile.has(key))   el.classList.add('fertile');

    // Tap a calendar day to open the log for that date
    el.onclick = () => {
      logDate = key;
      document.getElementById('log-date-label').textContent = key === todayKey
        ? 'Today'
        : date.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
      goPage('log', document.getElementById('nav-log'));
    };

    grid.appendChild(el);
  }
}


// ── Log page ──────────────────────────────────

// The date currently open in the log form.
// Defaults to today; calendar taps override it.
let logDate = today();

// Build symptom chips from the SYMPTOMS array
function buildSymptomChips() {
  const container = document.getElementById('symptom-chips');
  SYMPTOMS.forEach(name => {
    const chip = document.createElement('div');
    chip.className    = 'chip';
    chip.textContent  = name;
    chip.dataset.sym  = name;
    chip.onclick = () => chip.classList.toggle('selected');
    container.appendChild(chip);
  });
}

// Populate the form with saved data for `key`, or clear it
function loadLogForm(key) {
  const log = data.logs[key] || {};
  document.querySelectorAll('.flow-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.flow === (log.flow || 'none')));
  document.querySelectorAll('.mood-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.mood === log.mood));
  document.querySelectorAll('.chip').forEach(c =>
    c.classList.toggle('selected', (log.symptoms || []).includes(c.dataset.sym)));
  document.getElementById('log-note').value = log.note || '';
}

function selectFlow(el) {
  document.querySelectorAll('.flow-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

function selectMood(el) {
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

function saveLog() {
  const flow     = document.querySelector('.flow-btn.selected')?.dataset.flow || 'none';
  const mood     = document.querySelector('.mood-btn.selected')?.dataset.mood || '';
  const symptoms = [...document.querySelectorAll('.chip.selected')].map(c => c.dataset.sym);
  const note     = document.getElementById('log-note').value;

  // Auto-start a period if medium/heavy flow is logged and no period is active
  if (['medium', 'heavy'].includes(flow) && !isOnPeriod()) {
    data.cycles.push({ start: logDate, end: null });
  }

  data.logs[logDate] = { flow, mood, symptoms, note, date: logDate };
  saveData(data);
  showToast('Saved ✓');
  updateHome();
}


// ── Insights page ─────────────────────────────

function renderInsights() {
  const el       = document.getElementById('insights-content');
  const cycles   = data.cycles.length;
  const logs     = Object.values(data.logs);

  // Count how often each symptom appears across all logs
  const symptomCount = {};
  logs.forEach(log =>
    (log.symptoms || []).forEach(s =>
      symptomCount[s] = (symptomCount[s] || 0) + 1));
  const topSymptoms = Object.entries(symptomCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const cards = [
    {
      icon: '🌙', bg: '#F2D6DB',
      title: `${cycles} cycle${cycles !== 1 ? 's' : ''} tracked`,
      body: cycles
        ? `Average length: ${getAvgCycleLength()} days. Period duration: ${getAvgPeriodLength()} days.`
        : 'Log your first period to start tracking.'
    },
    {
      icon: '📊', bg: '#E8F4EC',
      title: 'Common symptoms',
      body: topSymptoms.length
        ? `Your most frequent: ${topSymptoms.join(', ')}.`
        : 'Log symptoms to see patterns here.'
    },
    {
      icon: '🔒', bg: '#EDE0D9',
      title: 'Your data is private',
      body: 'All data is stored only on this device. Nothing is sent anywhere.'
    },
    {
      icon: '📱', bg: '#E8ECF4',
      title: 'Add to home screen',
      body: 'In Safari, tap Share → "Add to Home Screen" for a native app experience on iPhone.'
    },
  ];

  el.innerHTML = cards.map(card => `
    <div class="insight-card">
      <div class="insight-icon" style="background:${card.bg}">${card.icon}</div>
      <div class="insight-body">
        <h3>${card.title}</h3>
        <p>${card.body}</p>
      </div>
    </div>`).join('');
}


// ── Export / Import ───────────────────────────

function exportData() {
  // Build the export object — includes a timestamp so you know when it was made
  const exportObj = {
    exportedAt: new Date().toISOString(),
    ...data
  };

  // Turn it into a JSON string and wrap it in a downloadable blob
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);

  // Create a temporary link, click it to trigger the download, then clean up
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `luna-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('Exported ✓');
}

function importData() {
  // Warn the user before overwriting anything
  const confirmed = confirm(
    'This will replace ALL your current data with the backup file.\n\n' +
    'Any logs since your last export will be lost.\n\n' +
    'Are you sure?'
  );
  if (!confirmed) return;

  // Open a file picker filtered to JSON files
  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = '.json';

  input.onchange = (e) => {
    const file   = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);

        // Basic validation — make sure it looks like a Luna backup
        if (!imported.cycles || !imported.logs || !imported.settings) {
          alert('This doesn\'t look like a Luna backup file.');
          return;
        }

        // Strip the exportedAt timestamp before saving (it's not part of app data)
        const { exportedAt, ...appData } = imported;
        data = appData;
        saveData(data);

        // Re-render everything with the restored data
        updateHome();
        renderInsights();
        showToast('Imported ✓');
      } catch (err) {
        alert('Could not read the file. Make sure it\'s a valid Luna backup.');
      }
    };
    reader.readAsText(file);
  };

  input.click();
}


// ── Toast notification ────────────────────────

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}
