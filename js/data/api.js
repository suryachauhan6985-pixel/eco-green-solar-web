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

// High-Speed Client In-Memory API Cache with Stale-While-Revalidate & In-Flight Request Deduplication
const clientApiCache = new Map();
const inFlightRequests = new Map();
const searchControllers = new Map();
const DEFAULT_CLIENT_TTL_MS = 120000; // 2 minutes default

function getCacheTtlForPath(path) {
  if (path.startsWith('/dashboard/summary')) return 15000;
  if (path.startsWith('/masters/') || path.startsWith('/purchase/brands') || path.startsWith('/purchase/wattages') || path.startsWith('/purchase/models')) return 180000;
  if (path.startsWith('/ledgers')) return 120000;
  if (path.startsWith('/auth/app-settings')) return 300000;
  return DEFAULT_CLIENT_TTL_MS;
}

function getCachedApiResponse(path) {
  const item = clientApiCache.get(path);
  if (!item) return null;
  const isExpired = Date.now() > item.expiry;
  return {
    data: item.data,
    isStale: isExpired
  };
}

function setCachedApiResponse(path, data, customTtl) {
  const ttl = customTtl || getCacheTtlForPath(path);
  clientApiCache.set(path, {
    data,
    expiry: Date.now() + ttl
  });
}

function clearClientApiCache() {
  clientApiCache.clear();
}
window.clearClientApiCache = clearClientApiCache;

function getApiHeaders(customHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...customHeaders };
  const tenantSlug = localStorage.getItem('egs_tenant_slug') || 'default';
  headers['x-tenant-slug'] = tenantSlug;
  const token = localStorage.getItem('egs_auth_token') || sessionStorage.getItem('egs_auth_token');
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

window.Api = {
  async get(path, opts = {}) {
    // Endpoints eligible for instant in-memory read (Masters, lookups, settings, dashboard)
    const isCacheEligible = (
      path.startsWith('/masters/') ||
      path.startsWith('/purchase/brands') ||
      path.startsWith('/purchase/wattages') ||
      path.startsWith('/purchase/models') ||
      path.startsWith('/ledgers') ||
      path.startsWith('/auth/app-settings') ||
      path.startsWith('/dashboard/summary')
    );
    const bypassCache = opts.bypassCache || opts.fresh;

    if (isCacheEligible && !bypassCache) {
      const cached = getCachedApiResponse(path);
      if (cached && !cached.isStale) {
        // Instant response (0ms)
        return JSON.parse(JSON.stringify(cached.data));
      }
      if (cached && cached.isStale) {
        // Stale-While-Revalidate: Return cached immediately, revalidate silently in background
        if (!inFlightRequests.has(path)) {
          const revalPromise = fetch(`${window.API_BASE}${path}`, { method: 'GET', headers: getApiHeaders(), egsSilent: true })
            .then(res => parseApiResponse(res, path))
            .then(fresh => {
              setCachedApiResponse(path, fresh);
              window.dispatchEvent(new CustomEvent('egs:cache-revalidated', { detail: { path, data: fresh } }));
              return fresh;
            })
            .catch(() => {})
            .finally(() => inFlightRequests.delete(path));
          inFlightRequests.set(path, revalPromise);
        }
        return JSON.parse(JSON.stringify(cached.data));
      }
    }

    // In-Flight Request Deduplication: if identical GET request is currently fetching, reuse existing promise
    if (!bypassCache && inFlightRequests.has(path)) {
      const pending = await inFlightRequests.get(path);
      return JSON.parse(JSON.stringify(pending));
    }

    const init = { method: 'GET', headers: getApiHeaders(opts.headers) };
    if (opts.silent) init.egsSilent = true;
    if (opts.signal) init.signal = opts.signal;

    const requestPromise = (async () => {
      try {
        const res = await fetch(`${window.API_BASE}${path}`, init);
        const data = await parseApiResponse(res, path);
        if (isCacheEligible) {
          setCachedApiResponse(path, data);
        }
        return data;
      } finally {
        inFlightRequests.delete(path);
      }
    })();

    inFlightRequests.set(path, requestPromise);
    return requestPromise;
  },

  // Proactive background prefetching for navigation links & upcoming pages
  prefetch(path) {
    if (!clientApiCache.has(path) && !inFlightRequests.has(path)) {
      this.get(path, { silent: true }).catch(() => {});
    }
  },

  // Auto-cancelling debounced search API helper
  async search(domainKey, path) {
    if (searchControllers.has(domainKey)) {
      searchControllers.get(domainKey).abort();
    }
    const controller = new AbortController();
    searchControllers.set(domainKey, controller);
    try {
      return await this.get(path, { signal: controller.signal, bypassCache: true });
    } finally {
      if (searchControllers.get(domainKey) === controller) {
        searchControllers.delete(domainKey);
      }
    }
  },

  async post(path, body, opts = {}) {
    clearClientApiCache();
    const headers = getApiHeaders(opts.headers);
    const res = await fetch(`${window.API_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {}),
    });
    return parseApiResponse(res, path);
  },

  async put(path, body, opts = {}) {
    clearClientApiCache();
    const headers = getApiHeaders(opts.headers);
    const res = await fetch(`${window.API_BASE}${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body || {}),
    });
    return parseApiResponse(res, path);
  },

  async delete(path, body, opts = {}) {
    clearClientApiCache();
    const headers = getApiHeaders(opts.headers);
    const res = await fetch(`${window.API_BASE}${path}`, {
      method: 'DELETE',
      headers,
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