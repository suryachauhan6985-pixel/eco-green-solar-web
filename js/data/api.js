// js/data/api.js
// -----------------------------------------------------------------------------
// NEW FILE — thin helper the web app's pages use to call the backend API
// (server.js), which itself talks to the same MariaDB database the desktop
// .py app uses. Loaded before dashboard.js / masters.js in index.html.
// -----------------------------------------------------------------------------

// CHANGE THIS if the API server runs somewhere other than 192.168.0.123:5000
// (e.g. if you host the web app + API on a different machine than MariaDB).
window.API_BASE = window.API_BASE || (window.location.origin + '/api');

window.Api = {
  async get(path) {
    const res = await fetch(`${window.API_BASE}${path}`, { method: 'GET' });
    if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
    return res.json();
  },
};