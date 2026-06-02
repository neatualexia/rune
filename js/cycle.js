// ─────────────────────────────────────────────
// cycle.js
// Pure cycle logic and date helpers.
// No DOM access here — only calculations.
// This is the right place to improve predictions
// or change how phases are defined.
// ─────────────────────────────────────────────


// ── Date helpers ──────────────────────────────

// Convert a Date object → 'YYYY-MM-DD' string
function toKey(d) {
  return d.getFullYear() + '-'
    + String(d.getMonth() + 1).padStart(2, '0') + '-'
    + String(d.getDate()).padStart(2, '0');
}

// Parse a 'YYYY-MM-DD' string → Date object
function fromKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Today as a 'YYYY-MM-DD' string
function today() {
  return toKey(new Date());
}


// ── Cycle state ───────────────────────────────

function getLastPeriodStart() {
  if (!data.cycles.length) return null;
  return data.cycles[data.cycles.length - 1].start;
}

// A period is "active" if the most recent cycle has no end date yet
function isOnPeriod() {
  const last = data.cycles[data.cycles.length - 1];
  if (!last) return false;
  return !last.end;
}

// How many days since the last period started (1-indexed)
function getCycleDay() {
  const start = getLastPeriodStart();
  if (!start) return null;
  const diff = new Date() - fromKey(start);
  return Math.floor(diff / 86400000) + 1;
}

// Average cycle length calculated from logged cycles.
// Falls back to the default setting until there are at least 2 cycles.
function getAvgCycleLength() {
  if (data.cycles.length < 2) return data.settings.cycleLength;
  const diffs = [];
  for (let i = 1; i < data.cycles.length; i++) {
    const a = fromKey(data.cycles[i - 1].start);
    const b = fromKey(data.cycles[i].start);
    diffs.push(Math.round((b - a) / 86400000));
  }
  return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
}

// Average period length from completed cycles.
// Falls back to the default setting until there is at least 1 completed cycle.
function getAvgPeriodLength() {
  const completed = data.cycles.filter(c => c.end);
  if (!completed.length) return data.settings.periodLength;
  const lens = completed.map(c =>
    Math.round((fromKey(c.end) - fromKey(c.start)) / 86400000) + 1
  );
  return Math.round(lens.reduce((a, b) => a + b, 0) / lens.length);
}


// ── Phase names ───────────────────────────────

// Returns a display name for the current cycle phase.
// Adjust the boundaries here if you want different phase definitions.
function getPhaseName(cycleDay, cycleLength) {
  if (!cycleDay) return 'No data yet';
  const periodLen = data.settings.periodLength;
  const ovDay = Math.round(cycleLength / 2);
  if (cycleDay <= periodLen)                          return 'Menstrual';
  if (cycleDay <= 7)                                  return 'Follicular';
  if (cycleDay >= ovDay - 1 && cycleDay <= ovDay + 1) return 'Ovulation';
  if (cycleDay > ovDay + 1 && cycleDay <= cycleLength - 3) return 'Luteal';
  return 'Late luteal';
}


// ── Calendar day sets ─────────────────────────

// Returns a Set of 'YYYY-MM-DD' strings for every day a period was active
function getPeriodDays() {
  const days = new Set();
  data.cycles.forEach(c => {
    const start = fromKey(c.start);
    const len = c.end
      ? Math.round((fromKey(c.end) - start) / 86400000) + 1
      : data.settings.periodLength;
    for (let i = 0; i < len; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.add(toKey(d));
    }
  });
  return days;
}

// Returns Sets for predicted future period days, fertile window, and ovulation days.
// Projects forward 3 cycles from the last known period start.
function getSpecialDays() {
  const cycleLength = getAvgCycleLength();
  const periodLength = getAvgPeriodLength();
  const lastStart = getLastPeriodStart();

  if (!lastStart) {
    return { fertile: new Set(), ovulation: new Set(), predicted: new Set() };
  }

  const base = fromKey(lastStart);
  const fertile = new Set();
  const ovulation = new Set();
  const predicted = new Set();

  for (let cycle = 0; cycle < 3; cycle++) {
    // Start date of this projected cycle
    const cycleStart = new Date(base);
    cycleStart.setDate(cycleStart.getDate() + cycleLength * cycle);

    // Ovulation is roughly mid-cycle (14 days before next period)
    const ovDay = new Date(cycleStart);
    ovDay.setDate(ovDay.getDate() + Math.round(cycleLength / 2) - 1);
    ovulation.add(toKey(ovDay));

    // Fertile window: 3 days before ovulation to 1 day after
    for (let offset = -3; offset <= 1; offset++) {
      const d = new Date(ovDay);
      d.setDate(d.getDate() + offset);
      fertile.add(toKey(d));
    }

    // Mark future cycles as predicted (skip cycle 0, which is the current/past one)
    if (cycle > 0) {
      for (let p = 0; p < periodLength; p++) {
        const d = new Date(cycleStart);
        d.setDate(d.getDate() + p);
        predicted.add(toKey(d));
      }
    }
  }

  return { fertile, ovulation, predicted };
}
