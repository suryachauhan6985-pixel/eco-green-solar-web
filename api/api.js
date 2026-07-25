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

// ---------------------------------------------------------------------------
// Attachments (real proof files) — shared by Purchase / Sales / Stock Assign
// (upload) and Party Ledger (view). Files are sent to POST /api/attachments
// as base64 inside normal JSON (see server.js) since the API has no
// persistent disk to write to on every host — this keeps the real file
// bytes safely in the same MariaDB database everything else already lives
// in, keyed by (refType, refNo) so every serial number under one
// voucher/invoice shares the same attachment set instead of duplicating it.
// ---------------------------------------------------------------------------

// Converts File objects (from an <input type="file" multiple>) into the
// { name, mimeType, size, data } shape POST /api/attachments expects.
// `data` is base64 WITHOUT the "data:...;base64," prefix FileReader adds.
window.readFilesAsBase64 = function readFilesAsBase64(files) {
  const list = Array.from(files || []);
  return Promise.all(list.map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const data = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
      resolve({ name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, data });
    };
    reader.onerror = () => reject(reader.error || new Error(`Could not read file: ${file.name}`));
    reader.readAsDataURL(file);
  })));
};

// Best-effort upload: called right after a voucher (Purchase invoice / Sale
// order / Stock Assign) is saved and its ref no. (invoice/order/reference)
// is known. Never throws — a failed proof upload should never make the
// caller think the whole save failed, since the voucher itself is already
// safely saved by this point; callers can inspect the resolved
// { ok, error } to optionally warn the person.
window.uploadAttachments = async function uploadAttachments(refType, refNo, files) {
  if (!files || !files.length) return { ok: true, skipped: true };
  try {
    const encoded = await window.readFilesAsBase64(files);
    await window.Api.post('/attachments', {
      refType, refNo, uploadedBy: window.currentUsername || null, files: encoded,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'Could not upload the attached proof file(s).' };
  }
};