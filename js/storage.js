// ─────────────────────────────────────────────
// storage.js
// Responsible for reading and writing app data
// to localStorage. Nothing else lives here.
//
// Data shape:
// {
//   cycles: [{ start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' | null }],
//   logs:   { 'YYYY-MM-DD': { flow, mood, symptoms, note } },
//   settings: { cycleLength: 28, periodLength: 5 }
// }
// ─────────────────────────────────────────────

const STORAGE_KEY = 'luna_v1';

function defaultData() {
  return {
    cycles: [],
    logs: {},
    settings: {
      cycleLength: 28,  // fallback used before enough cycles are logged
      periodLength: 5   // fallback used before enough periods are logged
    }
  };
}

function loadData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultData();
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

// Expose a single global `data` object that the rest of the app reads and mutates.
// After mutating it, call saveData(data) to persist the change.
let data = loadData();
