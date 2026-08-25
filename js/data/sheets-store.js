// js/data/sheets-store.js
// ---------------------------------------------------------------------------
// Persistence for the "SCAN To Sheet" feature (js/pages/scansheet.js).
// ENHANCED: Full Offline-First Synchronization Engine with persistent queue,
// zero-latency instant local scanning, and automatic background sync upon
// reconnection with duplicate prevention.
// ---------------------------------------------------------------------------
window.SheetsStore = (function () {
  const LOCAL_CACHE_KEY = 'egs_scan_sheets_cache_v2';
  const QUEUE_KEY = 'egs_scansheet_offline_sync_queue_v2';

  let sheets = [];          // [{id, name, columns, createdAt}]
  let entriesBySheet = {};  // { sheetId: [{id, sno, values, createdAt}] }
  let syncQueue = [];       // [{id, action, sheetId, payload, timestamp}]
  let isSyncing = false;
  let ready = false;

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // ---- Load / Persist Local Cache ----
  function persistLocalCache() {
    try { localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify({ sheets, entriesBySheet })); } catch (e) {}
  }
  function loadLocalCache() {
    try {
      const raw = localStorage.getItem(LOCAL_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        sheets = parsed.sheets || [];
        entriesBySheet = parsed.entriesBySheet || {};
      }
    } catch (e) {}
  }

  // ---- Load / Persist Offline Sync Queue ----
  function persistSyncQueue() {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(syncQueue)); } catch (e) {}
    notifySyncStatus();
  }
  function loadSyncQueue() {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      if (raw) {
        syncQueue = JSON.parse(raw) || [];
      }
    } catch (e) { syncQueue = []; }
  }

  function getQueueStatus() {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    return {
      isOnline,
      pendingCount: syncQueue.length,
      isSyncing,
    };
  }

  function notifySyncStatus() {
    const status = getQueueStatus();
    try {
      window.dispatchEvent(new CustomEvent('egs:sync-status-changed', { detail: status }));
    } catch (e) {}
    return status;
  }

  function enqueueAction(action, sheetId, payload) {
    const item = {
      id: uid('act'),
      action,
      sheetId,
      payload,
      timestamp: Date.now(),
      retryCount: 0
    };
    syncQueue.push(item);
    persistSyncQueue();
    // Try background sync immediately
    flushSyncQueue().catch(() => {});
    return item;
  }

  // ---- Execute Single Action Against Server ----
  async function executeAction(item) {
    if (!window.Api) throw new Error('Api not initialized');
    const { action, sheetId, payload } = item;

    if (action === 'create_sheet') {
      return await window.Api.post('/scansheet/sheets', payload);
    }
    if (action === 'update_sheet') {
      return await window.Api.put('/scansheet/sheets/' + sheetId, payload);
    }
    if (action === 'delete_sheet') {
      return await window.Api.delete('/scansheet/sheets/' + sheetId);
    }
    if (action === 'add_entry') {
      return await window.Api.post('/scansheet/sheets/' + sheetId + '/entries', payload);
    }
    if (action === 'delete_entry') {
      return await window.Api.delete('/scansheet/sheets/' + sheetId + '/entries/' + payload.entryId);
    }
    if (action === 'clear_entries') {
      return await window.Api.delete('/scansheet/sheets/' + sheetId + '/entries');
    }
    if (action === 'renumber_entries') {
      return await window.Api.put('/scansheet/sheets/' + sheetId + '/entries/renumber', payload);
    }
  }

  // ---- Flush Queue Sequentially ----
  async function flushSyncQueue() {
    if (isSyncing || !syncQueue.length) return;
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isOnline) {
      notifySyncStatus();
      return;
    }

    isSyncing = true;
    notifySyncStatus();

    try {
      while (syncQueue.length > 0) {
        const item = syncQueue[0];
        try {
          await executeAction(item);
          syncQueue.shift(); // remove completed action
          persistSyncQueue();
        } catch (err) {
          console.warn('[Offline Sync Queue] Action failed, retaining for retry:', item.action, err.message);
          item.retryCount = (item.retryCount || 0) + 1;
          break; // Stop on first network error to preserve chronological integrity
        }
      }
    } finally {
      isSyncing = false;
      notifySyncStatus();
    }
  }

  // Auto-sync on network reconnect
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      console.log('[Offline Sync Engine] Network restored. Flushing pending queue...');
      flushSyncQueue();
    });
    window.addEventListener('offline', () => {
      notifySyncStatus();
    });
    // Heartbeat sync every 25s if pending items exist
    setInterval(() => {
      if (syncQueue.length > 0 && !isSyncing && (navigator ? navigator.onLine : true)) {
        flushSyncQueue();
      }
    }, 25000);
  }

  // ---- Pull latest sheets + rows down from the database ----
  async function hydrate() {
    loadLocalCache();
    loadSyncQueue();
    notifySyncStatus();

    try {
      const remoteSheets = await window.Api.get('/scansheet/sheets');
      const nextSheets = remoteSheets || [];
      const entryLists = await Promise.all(
        nextSheets.map((s) => window.Api.get('/scansheet/sheets/' + s.id + '/entries').catch(() => []))
      );
      const nextEntries = {};
      nextSheets.forEach((s, i) => { nextEntries[s.id] = entryLists[i] || []; });
      
      // If we had offline additions that haven't synced yet, preserve local entries
      if (syncQueue.length > 0) {
        syncQueue.forEach((q) => {
          if (q.action === 'add_entry' && nextEntries[q.sheetId]) {
            const exists = nextEntries[q.sheetId].some((e) => e.id === q.payload.entryId);
            if (!exists) {
              nextEntries[q.sheetId].push({
                id: q.payload.entryId,
                sno: q.payload.sno,
                values: q.payload.values,
                createdAt: new Date().toISOString()
              });
            }
          }
        });
      }

      sheets = nextSheets;
      entriesBySheet = nextEntries;
      ready = true;
      persistLocalCache();

      // Flush queue if anything pending
      flushSyncQueue().catch(() => {});
    } catch (e) {
      console.warn('SheetsStore: offline mode or server unreachable, showing local cached sheets', e);
      ready = true;
      notifySyncStatus();
    }
    return { sheets, entriesBySheet };
  }

  // ---------------- Sheets API ----------------
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
        type: c.type || 'text',
      })),
      createdAt: new Date().toISOString(),
    };
    sheets.unshift(sheet);
    entriesBySheet[sheet.id] = [];
    persistLocalCache();
    enqueueAction('create_sheet', sheet.id, { id: sheet.id, name: sheet.name, columns: sheet.columns });
    return sheet;
  }
  function updateSheet(id, patch) {
    const idx = sheets.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    sheets[idx] = Object.assign({}, sheets[idx], patch, { id: sheets[idx].id, createdAt: sheets[idx].createdAt });
    persistLocalCache();
    enqueueAction('update_sheet', id, { name: sheets[idx].name, columns: sheets[idx].columns });
    return sheets[idx];
  }
  function deleteSheet(id) {
    sheets = sheets.filter((s) => s.id !== id);
    delete entriesBySheet[id];
    persistLocalCache();
    enqueueAction('delete_sheet', id, {});
  }

  // ---------------- Entries (rows) API ----------------
  function getEntries(sheetId) {
    return entriesBySheet[sheetId] || [];
  }
  function addEntry(sheetId, values) {
    const list = getEntries(sheetId);
    const entry = { id: uid('row'), sno: list.length + 1, values: values || {}, createdAt: new Date().toISOString() };
    list.push(entry);
    entriesBySheet[sheetId] = list;
    persistLocalCache();
    enqueueAction('add_entry', sheetId, { entryId: entry.id, sno: entry.sno, values: entry.values });
    return entry;
  }
  function deleteEntry(sheetId, entryId) {
    const list = getEntries(sheetId).filter((e) => e.id !== entryId);
    list.forEach((e, i) => { e.sno = i + 1; });
    entriesBySheet[sheetId] = list;
    persistLocalCache();
    enqueueAction('delete_entry', sheetId, { entryId });
    if (list.length) {
      enqueueAction('renumber_entries', sheetId, { order: list.map((e) => ({ id: e.id, sno: e.sno })) });
    }
    return list;
  }
  function clearEntries(sheetId) {
    entriesBySheet[sheetId] = [];
    persistLocalCache();
    enqueueAction('clear_entries', sheetId, {});
  }

  return {
    uid,
    hydrate,
    isReady: () => ready,
    getSheets, getSheet, createSheet, updateSheet, deleteSheet,
    getEntries, addEntry, deleteEntry, clearEntries,
    getQueueStatus: () => getQueueStatus(),
    syncNow: () => flushSyncQueue(),
  };
})();
