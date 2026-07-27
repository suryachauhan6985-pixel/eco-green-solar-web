// js/data/sheets-store.js
// ---------------------------------------------------------------------------
// Local persistence for the "SCAN To Sheet" feature (js/pages/scansheet.js).
// Everything (sheets, their dynamic columns, and every scanned/typed row) is
// kept in the browser's localStorage — this is the "SQLite/Hive/AsyncStorage"
// local state layer called for in the spec, adapted to a plain web stack.
// Every other page in this app talks to the shared MariaDB backend via
// js/data/api.js; this module deliberately does NOT — sheets are a personal,
// offline-first scratchpad (barcode inventory capture) that doesn't need a
// server round-trip to be useful.
// ---------------------------------------------------------------------------
window.SheetsStore = (function () {
  const SHEETS_KEY = 'egs_scan_sheets_v1';
  const ENTRIES_PREFIX = 'egs_scan_entries_v1_';

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('SheetsStore: failed to read', key, e);
      return fallback;
    }
  }
  function writeJSON(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      console.warn('SheetsStore: failed to write', key, e);
      return false;
    }
  }

  // ---------------- Sheets ----------------
  function getSheets() {
    return readJSON(SHEETS_KEY, []);
  }
  function saveSheets(list) {
    writeJSON(SHEETS_KEY, list);
  }
  function getSheet(id) {
    return getSheets().find((s) => s.id === id) || null;
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
    const list = getSheets();
    list.unshift(sheet);
    saveSheets(list);
    return sheet;
  }
  function updateSheet(id, patch) {
    const list = getSheets();
    const idx = list.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    list[idx] = Object.assign({}, list[idx], patch, { id: list[idx].id, createdAt: list[idx].createdAt });
    saveSheets(list);
    return list[idx];
  }
  function deleteSheet(id) {
    saveSheets(getSheets().filter((s) => s.id !== id));
    try { localStorage.removeItem(ENTRIES_PREFIX + id); } catch (e) { /* ignore */ }
  }

  // ---------------- Entries (rows) ----------------
  function getEntries(sheetId) {
    return readJSON(ENTRIES_PREFIX + sheetId, []);
  }
  function saveEntries(sheetId, list) {
    writeJSON(ENTRIES_PREFIX + sheetId, list);
  }
  function addEntry(sheetId, values) {
    const list = getEntries(sheetId);
    const entry = { id: uid('row'), sno: list.length + 1, values: values || {}, createdAt: new Date().toISOString() };
    list.push(entry);
    saveEntries(sheetId, list);
    return entry;
  }
  function deleteEntry(sheetId, entryId) {
    const list = getEntries(sheetId).filter((e) => e.id !== entryId);
    list.forEach((e, i) => { e.sno = i + 1; });
    saveEntries(sheetId, list);
    return list;
  }
  function clearEntries(sheetId) {
    saveEntries(sheetId, []);
  }

  return {
    uid,
    getSheets, saveSheets, getSheet, createSheet, updateSheet, deleteSheet,
    getEntries, saveEntries, addEntry, deleteEntry, clearEntries,
  };
})();
