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
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
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

  document.getElementById('cycle-day').textContent  = cycleDay || '—';
  document.getElementById('phase-name').textContent = phase;
  document.getElementById('home-date').textContent =
    new Date().toLocaleDateString('en', { month: 'long', day: 'numeric' });

  const cycles = getCycles();
  document.getElementById('stat-length').textContent =
    cycles.length >= 2 ? getAvgCycleLength() + 'd' : '—';
  document.getElementById('stat-period').textContent =
    cycles.length ? getAvgPeriodLength() + 'd' : '—';

  const daysToNext = cycleDay ? cycleLength - cycleDay : null;
  document.getElementById('stat-next').textContent =
    (daysToNext !== null && daysToNext >= 0) ? daysToNext + 'd' : '—';

  const progress      = cycleDay ? Math.min(cycleDay / cycleLength, 1) : 0;
  const circumference = 2 * Math.PI * 68;
  document.getElementById('ring-progress').style.strokeDashoffset =
    circumference * (1 - progress);

  const todayLog = data.logs[today()] || {};
  const area     = document.getElementById('home-log-area');
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
      if (key > todayKey) return;
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

  data.logs[logDate] = { flow, mood, symptoms, note, date: logDate };
  saveData(data);
  showToast('Saved ✓');
  updateHome();
}


// ── Cycle history page ────────────────────────

function goHistory() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-history').classList.add('active');
  renderHistory();
}

function renderHistory() {
  const el     = document.getElementById('history-content');
  const cycles = getCycles();

  if (!cycles.length) {
    el.innerHTML = `
      <div class="history-empty">
        <div style="font-size:40px">🌙</div>
        <p>No cycles logged yet.<br>Log flow on any day to start tracking.</p>
      </div>`;
    return;
  }

  const total = cycles.length;
  el.innerHTML = `
    <div class="history-summary">
      <div class="stat-card"><div class="val">${total}</div><div class="lbl">Cycles</div></div>
      <div class="stat-card"><div class="val">${getAvgCycleLength()}d</div><div class="lbl">Avg cycle</div></div>
      <div class="stat-card"><div class="val">${getAvgPeriodLength()}d</div><div class="lbl">Avg period</div></div>
    </div>
    <div class="section-label">All cycles</div>
    <div id="cycle-rows"></div>`;

  const rowsEl = document.getElementById('cycle-rows');
  const sorted = [...cycles].reverse();

  sorted.forEach((cycle, i) => {
    const startDate  = fromKey(cycle.start);
    const isOngoing  = i === 0 && isOnPeriod();
    const periodLen  = cycle.periodDays.length;

    // Cycle length = gap to next cycle start
    const nextCycle    = sorted[i + 1]; // sorted is reversed, so "next" is actually older
    const prevCycle    = cycles[cycles.indexOf(cycle) + 1]; // next in chronological order
    const cycleLenDays = prevCycle
      ? daysBetween(cycle.start, prevCycle.start)
      : null;

    const totalDots    = cycleLenDays || periodLen;
    const ovDay        = Math.round(totalDots / 2) - 1;
    const fertileStart = ovDay - 3;
    const fertileEnd   = ovDay + 1;

    const dots = Array.from({ length: totalDots }, (_, idx) => {
      let cls = 'cycle-dot';
      if (idx < periodLen)                                    cls += ' cycle-dot-period';
      else if (idx === ovDay)                                 cls += ' cycle-dot-ovulation';
      else if (idx >= fertileStart && idx <= fertileEnd)      cls += ' cycle-dot-fertile';
      else                                                    cls += ' cycle-dot-empty';
      return `<span class="${cls}"></span>`;
    }).join('');

    const startYear    = startDate.getFullYear();
    const endDate      = fromKey(cycle.end);
    const endYear      = endDate.getFullYear();

    const startFmt = startDate.toLocaleDateString('en', {
      month: 'short', day: 'numeric',
      ...(startYear !== endYear ? { year: 'numeric' } : {})
    });
    const endFmt = isOngoing
      ? 'ongoing'
      : endDate.toLocaleDateString('en', {
          month: 'short', day: 'numeric',
          ...(startYear !== endYear ? { year: 'numeric' } : {})
        });

    const topLine  = cycleLenDays
      ? `<div class="cycle-row-days">${cycleLenDays} days</div>`
      : `<div class="cycle-row-days">Current cycle</div>`;
    const dateLine = `<div class="cycle-row-dates">${startFmt} – ${endFmt}</div>`;

    const row = document.createElement('div');
    row.className = 'cycle-row' + (isOngoing ? ' cycle-ongoing' : '');
    row.innerHTML = `
      <div class="cycle-row-body">
        ${topLine}
        ${dateLine}
        <div class="cycle-dots">${dots}</div>
      </div>
      <svg class="cycle-row-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"/></svg>`;

    row.onclick = () => {
      logDate = cycle.start;
      document.getElementById('log-date-label').textContent =
        startDate.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
      goPage('log', document.getElementById('nav-log'));
    };

    rowsEl.appendChild(row);
  });
}


// ── Insights page ─────────────────────────────

function renderInsights() {
  const el     = document.getElementById('insights-content');
  const cycles = getCycles();
  const logs   = Object.values(data.logs);

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
      title: `${cycles.length} cycle${cycles.length !== 1 ? 's' : ''} tracked`,
      body: cycles
        ? `Average length: ${getAvgCycleLength()} days. Period duration: ${getAvgPeriodLength()} days.`
        : 'Log your first period to start tracking.',
      onclick: 'goHistory()',
      tappable: true
    },
    {
      icon: '📊', bg: '#E8F4EC',
      title: 'Common symptoms',
      body: topSymptoms.length
        ? `Your most frequent: ${topSymptoms.join(', ')}.`
        : 'Log symptoms to see patterns here.'
    },
  ];

  el.innerHTML = cards.map(card => `
    <div class="insight-card${card.tappable ? ' insight-card-tappable' : ''}"
         ${card.onclick ? `onclick="${card.onclick}"` : ''}>
      <div class="insight-icon" style="background:${card.bg}">${card.icon}</div>
      <div class="insight-body">
        <h3>${card.title}</h3>
        <p>${card.body}</p>
      </div>
      ${card.tappable ? `<svg style="width:16px;height:16px;stroke:var(--text-soft);stroke-width:2;flex-shrink:0" viewBox="0 0 24 24" fill="none"><polyline points="9 18 15 12 9 6" stroke="currentColor"/></svg>` : ''}
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
