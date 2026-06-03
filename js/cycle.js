// ─────────────────────────────────────────────
// cycle.js
// Pure cycle logic and date helpers.
// No DOM access here — only calculations.
//
// Source of truth: data.logs
// A "period day" is any day with flow !== 'none'.
// A "cycle" is a group of period days separated
// from the next group by at least 2 gap days.
// ─────────────────────────────────────────────

// ── Date helpers ──────────────────────────────

// Convert a Date object → 'YYYY-MM-DD' string
function toKey(d) {
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

// Parse a 'YYYY-MM-DD' string → Date object
function fromKey(k) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Today as a 'YYYY-MM-DD' string
function today() {
  return toKey(new Date());
}

// Add `n` days to a date key and return a new key
function addDays(key, n) {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

// Difference in days between two date keys (b - a)
function daysBetween(a, b) {
  return Math.round((fromKey(b) - fromKey(a)) / 86400000);
}

// ── Core derived data ─────────────────────────

// Returns a sorted array of all date keys where flow was logged
function getFlowDays() {
  return Object.keys(data.logs)
    .filter((k) => data.logs[k].flow && data.logs[k].flow !== "none")
    .sort();
}

// Groups flow days into cycles. A new cycle begins when there is
// a gap of 2 or more days with no flow after the previous period.
// Returns an array of cycle objects, sorted oldest first:
// [{ start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', periodDays: [...] }]
function getCycles() {
  const flowDays = getFlowDays();
  if (!flowDays.length) return [];

  const cycles = [];
  let currentPeriod = [flowDays[0]];

  for (let i = 1; i < flowDays.length; i++) {
    const gap = daysBetween(flowDays[i - 1], flowDays[i]);
    if (gap <= 2) {
      // Gap of 1 day (consecutive) or 2 days (one missed day) — same period
      currentPeriod.push(flowDays[i]);
    } else {
      // Gap of 3+ days — this is a new cycle
      cycles.push({
        start: currentPeriod[0],
        end: currentPeriod[currentPeriod.length - 1],
        periodDays: currentPeriod,
      });
      currentPeriod = [flowDays[i]];
    }
  }

  // Push the last period
  cycles.push({
    start: currentPeriod[0],
    end: currentPeriod[currentPeriod.length - 1],
    periodDays: currentPeriod,
  });

  return cycles;
}

// ── Cycle state ───────────────────────────────

// Returns the most recent cycle, or null
function getLastCycle() {
  const cycles = getCycles();
  return cycles.length ? cycles[cycles.length - 1] : null;
}

// True if the most recent flow day was within the last 2 days
function isOnPeriod() {
  const last = getLastCycle();
  if (!last) return false;
  return daysBetween(last.end, today()) <= 2;
}

// How many days since the last period started (1-indexed from last cycle start)
function getCycleDay() {
  const last = getLastCycle();
  if (!last) return null;
  return daysBetween(last.start, today()) + 1;
}

// Average cycle length (start-to-start gap) across all logged cycles.
// Falls back to settings default until there are at least 2 cycles.
function getAvgCycleLength() {
  const cycles = getCycles();
  if (cycles.length < 2) return data.settings.cycleLength;
  const diffs = [];
  for (let i = 1; i < cycles.length; i++) {
    diffs.push(daysBetween(cycles[i - 1].start, cycles[i].start));
  }
  return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
}

// Average number of flow days per period.
// Falls back to settings default until there is at least 1 cycle.
function getAvgPeriodLength() {
  const cycles = getCycles();
  if (!cycles.length) return data.settings.periodLength;
  const lens = cycles.map((c) => c.periodDays.length);
  return Math.round(lens.reduce((a, b) => a + b, 0) / lens.length);
}

// ── Phase name ────────────────────────────────

function getPhaseName(cycleDay, cycleLength) {
  if (!cycleDay) return "No data yet";
  const periodLen = getAvgPeriodLength();
  const ovDay = Math.round(cycleLength / 2);
  if (cycleDay <= periodLen) return "Menstrual";
  if (cycleDay <= 7) return "Follicular";
  if (cycleDay >= ovDay - 1 && cycleDay <= ovDay + 1) return "Ovulation";
  if (cycleDay > ovDay + 1 && cycleDay <= cycleLength - 3) return "Luteal";
  return "Late luteal";
}

// ── Calendar day sets ─────────────────────────

// Period days = all flow-logged days
function getPeriodDays() {
  return new Set(getFlowDays());
}

// Predicted future period days, fertile window, ovulation —
// projected forward from the last known cycle start.
function getSpecialDays() {
  const cycleLength = getAvgCycleLength();
  const periodLength = getAvgPeriodLength();
  const lastCycle = getLastCycle();

  if (!lastCycle) {
    return { fertile: new Set(), ovulation: new Set(), predicted: new Set() };
  }

  const base = fromKey(lastCycle.start);
  const fertile = new Set();
  const ovulation = new Set();
  const predicted = new Set();

  // Project 12 cycles forward
  for (let cycle = 0; cycle < 13; cycle++) {
    const cycleStart = new Date(base);
    cycleStart.setDate(cycleStart.getDate() + cycleLength * cycle);

    const ovDay = new Date(cycleStart);
    ovDay.setDate(ovDay.getDate() + Math.round(cycleLength / 2) - 1);
    ovulation.add(toKey(ovDay));

    for (let offset = -3; offset <= 1; offset++) {
      const d = new Date(ovDay);
      d.setDate(d.getDate() + offset);
      fertile.add(toKey(d));
    }

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
