// ─────────────────────────────────────────────
// storage.js
// Responsible for reading and writing app data
// to localStorage. Nothing else lives here.
//
// Data shape:
// {
//   logs:     { 'YYYY-MM-DD': { flow, mood, symptoms, note } },
//   settings: { cycleLength: 28, periodLength: 5 }
// }
//
// NOTE: cycles are no longer stored explicitly.
// They are derived from flow logs in cycle.js.
// ─────────────────────────────────────────────

const STORAGE_KEY = 'luna_v1';

function defaultData() {
  return {
    logs: {},
    settings: {
      cycleLength: 28,  // fallback before enough cycles are logged
      periodLength: 5   // fallback before enough periods are logged
    }
  };
}

function loadData() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultData();
    // Migration: if old data has a `cycles` array, drop it — cycles are now derived
    if (stored.cycles) delete stored.cycles;
    return stored;
  } catch (e) {
    console.error('Luna: failed to load data from localStorage', e);
    return defaultData();
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Luna: failed to save data to localStorage', e);
  }
}

var data = loadData();
