// ─────────────────────────────────────────────
// app.js
// Entry point. Runs once when the page loads.
// Initialises the UI; nothing else lives here.
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  buildSymptomChips(); // build chip list from SYMPTOMS array (ui.js)
  updateHome();        // render home page stats and ring
});
