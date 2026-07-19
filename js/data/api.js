// js/data/api.js
// -----------------------------------------------------------------------------
// NEW FILE — thin helper the web app's pages use to call the backend API
// (server.js), which itself talks to the same MariaDB database the desktop
// .py app uses. Loaded before dashboard.js / masters.js in index.html.
// -----------------------------------------------------------------------------

// CHANGE THIS if the API server runs somewhere other than 192.168.0.123:5000
// (e.g. if you host the web app + API on a different machine than MariaDB).
window.API_BASE = window.API_BASE || (window.location.origin + '/api');

// Shared helper: reads the JSON body of a response, works whether the
// server sent { error: '...' } (our route() error shape) or a clean 2xx
// JSON payload. Thrown errors carry the server's message when available so
// pages can show the exact same validation text the desktop app shows.
async function parseApiResponse(res, path) {
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty/non-JSON body */ }
  if (!res.ok) {
    const message = (data && (data.error || data.detail)) || `API ${path} failed: ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

window.Api = {
  async get(path) {
    const res = await fetch(`${window.API_BASE}${path}`, { method: 'GET' });
    return parseApiResponse(res, path);
  },
  async post(path, body) {
    const res = await fetch(`${window.API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return parseApiResponse(res, path);
  },
  async put(path, body) {
    const res = await fetch(`${window.API_BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return parseApiResponse(res, path);
  },
  async delete(path, body) {
    const res = await fetch(`${window.API_BASE}${path}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return parseApiResponse(res, path);
  },
};