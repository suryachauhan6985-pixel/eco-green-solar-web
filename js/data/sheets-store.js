// js/data/sheets-store.js
// ---------------------------------------------------------------------------
// Persistence for the "SCAN To Sheet" feature (js/pages/scansheet.js).
// UPDATED: sheets, their dynamic columns, and every scanned/typed row are now
// saved to the shared MariaDB database via js/data/api.js (routes registered
// in api/routes/scansheet.js), scoped to the logged-in user. This replaces
// the old localStorage-only version, whose data was stuck to one browser and
// disappeared on logout/login or on a different device.
//
// scansheet.js's render functions call getSheets()/getEntries() a lot and
// expect a plain synchronous array back, so this module keeps a small
// in-memory cache (kept in sync with the DB) for instant reads, while every
// write (create/update/delete) is pushed to the server in the background.
// Call window.SheetsStore.hydrate() once when the page opens to pull the
// latest data down from the database before the first render.
// ---------------------------------------------------------------------------
window.SheetsStore = (function () {
  const LOCAL_CACHE_KEY = 'egs_scan_sheets_cache_v2'; // offline fallback only — DB is the source of truth

  let sheets = [];          // [{id, name, columns, createdAt}]
  let entriesBySheet = {};  // { sheetId: [{id, sno, values, createdAt}] }
  let ready = false;

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ---- local cache: lets the last-known data show instantly on page load,
  // before the network round-trip to the server finishes ----
  function persistLocalCache() {
    try { localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({ sheets, entriesBySheet })); } catch (e) { /* ignore */ }
  }
  function loadLocalCache() {
    try {
      const raw = localStorage.getItem(LOCAL_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        sheets = parsed.sheets || [];
        entriesBySheet = parsed.entriesBySheet || {};
      }
    } catch (e) { /* ignore */ }
  }

  function warnSaveFailed(action, err) {
    console.warn('SheetsStore: ' + action + ' failed to save to the server', err);
    if (window.showToast) window.showToast('Could not save "' + action + '" — check your connection and try again.', 3500);
  }

  // ---- pull the latest sheets + rows down from the database ----
  async function hydrate() {
    loadLocalCache(); // show last-known data immediately while the network call is in flight
    try {
      const remoteSheets = await window.Api.get('/scansheet/sheets');
      const nextSheets = remoteSheets || [];
      const entryLists = await Promise.all(
        nextSheets.map((s) => window.Api.get('/scansheet/sheets/' + s.id + '/entries').catch(() => []))
      );
      const nextEntries = {};
      nextSheets.forEach((s, i) => { nextEntries[s.id] = entryLists[i] || []; });
      sheets = nextSheets;
      entriesBySheet = nextEntries;
      ready = true;
      persistLocalCache();
    } catch (e) {
      console.warn('SheetsStore: could not load sheets from the server, showing last-known data', e);
      if (window.showToast) window.showToast('Could not reach the server — showing last-saved sheets.', 3500);
      ready = true;
    }
    return { sheets, entriesBySheet };
  }

  // ---------------- Sheets ----------------
  function getSheets() {
    return sheets;
  }
  function getSheet(id) {
    return sheets.find((s) => s.id === id) || null;
  }
  function createSheet({ name, columns }) {
    const sheet = {
      id: uid('sheet'),
      name: (name || 'Untitled Sheet').trim() || 'Untitled Sheet',
      columns: (columns || []).map((c) => ({
        id: c.id || uid('col'),
        name: (c.name || 'Column').trim() || 'Column',
        type: c.type || 'text', // text | barcode | number | date | image
      })),
      createdAt: new Date().toISOString(),
    };
    sheets.unshift(sheet);
    entriesBySheet[sheet.id] = [];
    persistLocalCache();
    window.Api.post('/scansheet/sheets', { id: sheet.id, name: sheet.name, columns: sheet.columns })
      .catch((e) => warnSaveFailed('creating sheet "' + sheet.name + '"', e));
    return sheet;
  }
  function updateSheet(id, patch) {
    const idx = sheets.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    sheets[idx] = Object.assign({}, sheets[idx], patch, { id: sheets[idx].id, createdAt: sheets[idx].createdAt });
    persistLocalCache();
    window.Api.put('/scansheet/sheets/' + id, { name: sheets[idx].name, columns: sheets[idx].columns })
      .catch((e) => warnSaveFailed('updating sheet "' + sheets[idx].name + '"', e));
    return sheets[idx];
  }
  function deleteSheet(id) {
    sheets = sheets.filter((s) => s.id !== id);
    delete entriesBySheet[id];
    persistLocalCache();
    window.Api.delete('/scansheet/sheets/' + id)
      .catch((e) => warnSaveFailed('deleting sheet', e));
  }

  // ---------------- Entries (rows) ----------------
  function getEntries(sheetId) {
    return entriesBySheet[sheetId] || [];
  }
  function addEntry(sheetId, values) {
    const list = getEntries(sheetId);
    const entry = { id: uid('row'), sno: list.length + 1, values: values || {}, createdAt: new Date().toISOString() };
    list.push(entry);
    entriesBySheet[sheetId] = list;
    persistLocalCache();
    window.Api.post('/scansheet/sheets/' + sheetId + '/entries', { entryId: entry.id, sno: entry.sno, values: entry.values })
      .catch((e) => warnSaveFailed('saving row', e));
    return entry;
  }
  function deleteEntry(sheetId, entryId) {
    const list = getEntries(sheetId).filter((e) => e.id !== entryId);
    list.forEach((e, i) => { e.sno = i + 1; });
    entriesBySheet[sheetId] = list;
    persistLocalCache();
    window.Api.delete('/scansheet/sheets/' + sheetId + '/entries/' + entryId)
      .then(() => {
        if (list.length) {
          return window.Api.put('/scansheet/sheets/' + sheetId + '/entries/renumber', {
            order: list.map((e) => ({ id: e.id, sno: e.sno })),
          });
        }
      })
      .catch((e) => warnSaveFailed('deleting row', e));
    return list;
  }
  function clearEntries(sheetId) {
    entriesBySheet[sheetId] = [];
    persistLocalCache();
    window.Api.delete('/scansheet/sheets/' + sheetId + '/entries')
      .catch((e) => warnSaveFailed('clearing rows', e));
  }

  return {
    uid,
    hydrate,
    isReady: () => ready,
    getSheets, getSheet, createSheet, updateSheet, deleteSheet,
    getEntries, addEntry, deleteEntry, clearEntries,
  };
})();
