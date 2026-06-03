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
      body: cycles.length
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

  // Render cycle length chart below the cards
  el.innerHTML += renderCycleLengthChart(cycles);
}

function renderCycleLengthChart(cycles) {
  // Need at least 2 cycles to calculate cycle lengths
  if (cycles.length < 2) {
    return `
      <div class="chart-card">
        <div class="chart-title">Cycle length</div>
        <div class="chart-empty">Log at least 2 cycles to see your trend.</div>
      </div>`;
  }

  // Calculate cycle lengths (start-to-start gaps)
  const points = [];
  for (let i = 1; i < cycles.length; i++) {
    points.push({
      label: cycles[i - 1].start,
      days:  daysBetween(cycles[i - 1].start, cycles[i].start)
    });
  }

  const avg    = Math.round(points.reduce((s, p) => s + p.days, 0) / points.length);
  const stdDev = Math.round(Math.sqrt(
    points.reduce((s, p) => s + Math.pow(p.days - avg, 2), 0) / points.length
  ));

  // "Normal" band is avg ± 7 days (clinical definition of normal variation)
  const bandLow  = avg - 7;
  const bandHigh = avg + 7;

  // SVG dimensions
  const W = 320, H = 160;
  const padL = 28, padR = 16, padT = 24, padB = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  // Y axis: range is min/max of data with some breathing room
  const minVal = Math.max(0,  Math.min(...points.map(p => p.days)) - 5);
  const maxVal = Math.max(35, Math.max(...points.map(p => p.days)) + 5);
  const yRange = maxVal - minVal;

  // Convert a day value → SVG y coordinate
  const toY = v => padT + chartH - ((v - minVal) / yRange) * chartH;

  // Convert a point index → SVG x coordinate
  const toX = i => padL + (i / (points.length - 1)) * chartW;

  // Build smooth polyline path using cubic bezier curves
  const linePoints = points.map((p, i) => ({ x: toX(i), y: toY(p.days) }));
  let pathD = `M ${linePoints[0].x} ${linePoints[0].y}`;
  for (let i = 1; i < linePoints.length; i++) {
    const prev = linePoints[i - 1];
    const curr = linePoints[i];
    const cpX  = (prev.x + curr.x) / 2;
    pathD += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  // Normal band rect
  const bandY1 = toY(bandHigh);
  const bandY2 = toY(bandLow);

  // Y axis gridlines at avg, bandLow, bandHigh
  const gridLines = [bandLow, avg, bandHigh].map(v => ({
    y: toY(v), label: v, isAvg: v === avg
  }));

  // Dots — flag abnormal ones (outside band)
  const dots = points.map((p, i) => {
    const abnormal = p.days < bandLow || p.days > bandHigh;
    return { x: toX(i), y: toY(p.days), days: p.days, abnormal };
  });

  // Format month label from a date key
  const monthLabel = key =>
    fromKey(key).toLocaleDateString('en', { month: 'short' });

  // Only show a label every few points to avoid crowding
  const labelStep = Math.ceil(points.length / 5);

  const svgContent = `
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
         style="width:100%;height:auto;display:block;overflow:visible">

      <!-- Normal band -->
      <rect x="${padL}" y="${bandY1}"
            width="${chartW}" height="${bandY2 - bandY1}"
            fill="#F0EAE4" rx="2"/>

      <!-- Gridlines -->
      ${gridLines.map(g => `
        <line x1="${padL}" y1="${g.y}" x2="${padL + chartW}" y2="${g.y}"
              stroke="${g.isAvg ? '#C4687A' : '#D8C8C0'}"
              stroke-width="${g.isAvg ? 1 : 0.5}"
              stroke-dasharray="${g.isAvg ? '3,3' : '2,2'}"/>
        <text x="${padL - 4}" y="${g.y + 4}"
              font-size="8" fill="#A08070" text-anchor="end">${g.label}</text>
      `).join('')}

      <!-- Smooth line -->
      <path d="${pathD}" fill="none" stroke="#D8A0A8" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"/>

      <!-- Dots -->
      ${dots.map((d, i) => `
        ${d.abnormal ? `
          <circle cx="${d.x}" cy="${d.y}" r="10"
                  fill="#F2D6DB" opacity="0.5"/>
        ` : ''}
        <circle cx="${d.x}" cy="${d.y}" r="${d.abnormal ? 5 : 3.5}"
                fill="${d.abnormal ? '#C4687A' : '#8B3D4E'}"
                stroke="white" stroke-width="1.5"/>
        ${d.abnormal ? `
          <text x="${d.x}" y="${d.y - 14}"
                font-size="8" fill="#8B3D4E" text-anchor="middle"
                font-weight="600" letter-spacing="0.5">IRREGULAR</text>
        ` : ''}
      `).join('')}

      <!-- X axis month labels -->
      ${points.map((p, i) => i % labelStep === 0 ? `
        <text x="${toX(i)}" y="${H - 4}"
              font-size="8" fill="#A08070" text-anchor="middle">
          ${monthLabel(p.label)}
        </text>
      ` : '').join('')}
    </svg>`;

  // Stats below the chart
  const statsRow = `
    <div class="chart-stats">
      <div class="chart-stat">
        <span class="chart-stat-val">${avg}d</span>
        <span class="chart-stat-lbl">Average</span>
      </div>
      <div class="chart-stat">
        <span class="chart-stat-val">${Math.min(...points.map(p => p.days))}d</span>
        <span class="chart-stat-lbl">Shortest</span>
      </div>
      <div class="chart-stat">
        <span class="chart-stat-val">${Math.max(...points.map(p => p.days))}d</span>
        <span class="chart-stat-lbl">Longest</span>
      </div>
      <div class="chart-stat">
        <span class="chart-stat-val">±${stdDev}d</span>
        <span class="chart-stat-lbl">Variation</span>
      </div>
    </div>`;

  return `
    <div class="chart-card">
      <div class="chart-title">Cycle length</div>
      <div class="chart-subtitle">Shaded band = typical range (±7 days from your average)</div>
      ${svgContent}
      ${statsRow}
    </div>`;
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
        if (!imported.logs || !imported.settings) {
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
