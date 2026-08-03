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
  async get(path, opts) {
    // opts.silent = true → skip the global full-screen loader overlay for
    // this call (see js/app.js's fetch wrapper). Use this for background
    // polling (e.g. live session refresh) so it doesn't flash the loader
    // every few seconds; leave it off for normal user-initiated loads.
    const init = { method: 'GET' };
    if (opts && opts.silent) init.egsSilent = true;
    const res = await fetch(`${window.API_BASE}${path}`, init);
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

// -----------------------------------------------------------------------------
// ATTACHMENT VALIDATION — allowed file types and max size.
// Kept in sync with the SAME whitelist enforced server-side in
// api/server.js (POST /api/attachments) — this copy is just for fast,
// friendly client-side feedback before spending time reading/uploading a
// file that the server would reject anyway. The server-side check is the
// real security boundary; never trust this one alone.
// -----------------------------------------------------------------------------
const ALLOWED_ATTACHMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx'];
const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per file

function getFileExtension(fileName) {
  const name = String(fileName || '');
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

function validateAttachmentFile(file) {
  const ext = getFileExtension(file.name);
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
    return `"${file.name}" is not an allowed file type. Allowed: images (jpg/png/webp), PDF, Word (doc/docx), Excel (xls/xlsx).`;
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return `"${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max allowed size is 5 MB.`;
  }
  return null;
}

// -----------------------------------------------------------------------------
// window.uploadAttachments(refType, refNo, fileList) — used by
// partyledger.js, sales.js and purchase.js to push proof files to
// POST /api/attachments. The backend expects base64 (no data: prefix) in
// body.files[].data, so this reads every File via FileReader before posting.
// Returns { ok: true, files } on success or { ok: false, error } on failure
// so callers can show a non-fatal warning instead of throwing.
// -----------------------------------------------------------------------------
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const base64 = String(result).split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error(`Could not read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

window.uploadAttachments = async function uploadAttachments(refType, refNo, fileList) {
  try {
    const files = Array.from(fileList || []);
    if (!files.length) return { ok: false, error: 'No files selected.' };

    // Reject the whole batch up front if ANY file fails validation — avoids
    // partial uploads where some files silently made it in and others didn't.
    for (const file of files) {
      const validationError = validateAttachmentFile(file);
      if (validationError) return { ok: false, error: validationError };
    }

    const encoded = await Promise.all(files.map(async (file) => ({
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      data: await readFileAsBase64(file),
    })));

    const data = await window.Api.post('/attachments', {
      refType,
      refNo,
      files: encoded,
    });
    return { ok: true, files: (data && data.files) || [] };
  } catch (err) {
    return { ok: false, error: (err && err.message) || 'Upload failed.' };
  }
};
