// js/pages/scansheet.js
// ---------------------------------------------------------------------------
// "SCAN To Sheet" — Barcode & QR Code Scanner to Spreadsheet/Table.
// Screens implemented here (matching the requested flow 1:1):
//   1. Sheets main view (empty state + tab nav: Sheets / Enterprise / Files)
//   2. Create Sheet modal (Manual / Import CSV-XLSX / From Template)
//   3. Manual sheet creation (name + dynamic columns)
//   4. Sheets list view (cards with Edit / View / More)
//   5. Data entry screen (form + live table preview + bottom nav)
//   6 & 7. Camera scanner (permission handling + custom viewfinder overlay)
//
// State (sheets, columns, entries) is persisted via window.SheetsStore
// (js/data/sheets-store.js), which wraps localStorage — this app's stand-in
// for SQLite/Hive/AsyncStorage on a plain web stack.
//
// Barcode/QR decoding uses the html5-qrcode library (loaded via CDN in
// index.html), which supports QR codes and the common 1D barcode symbologies
// through the device camera with no native app required.
// ---------------------------------------------------------------------------
window.PAGES = window.PAGES || {};

(function () {
  const ST = {
    tab: 'sheets',          // sheets | enterprise | files
    view: 'list',           // list | manual-create | data-entry
    editingSheetId: null,   // set when Screen 3 is editing an existing sheet
    draftName: '',
    draftColumns: [],       // [{id, name, type}] while on Screen 3
    activeSheetId: null,    // sheet open on Screen 5
    lastBarcodeFieldId: null,
  };

  const COL_TYPES = [
    { value: 'text', label: 'Text', icon: 'fa-font' },
    { value: 'barcode', label: 'Barcode/QR', icon: 'fa-barcode' },
    { value: 'number', label: 'Number', icon: 'fa-hashtag' },
    { value: 'date', label: 'Date', icon: 'fa-calendar-days' },
    { value: 'image', label: 'Image', icon: 'fa-image' },
  ];

  // ---------------- helpers ----------------
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
  function fmtTimestamp(iso) {
    const d = iso ? new Date(iso) : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function root() { return document.getElementById('scanSheetRoot'); }

  // ---------------- render dispatch ----------------
  function render() {
    const r = root();
    if (!r) return;
    if (ST.view === 'manual-create') r.innerHTML = renderManualCreate();
    else if (ST.view === 'data-entry') r.innerHTML = renderDataEntry();
    else r.innerHTML = renderList();
    wire();
  }

  // =========================================================================
  // SCREEN 1 (empty state) + SCREEN 4 (sheets list) — same "Sheets" tab view
  // =========================================================================
  function renderList() {
    const sheets = window.SheetsStore.getSheets();

    const tabsHtml = `
      <div class="ss-tabs">
        <button type="button" class="ss-tab ${ST.tab === 'sheets' ? 'active' : ''}" data-tab="sheets">Sheets</button>
        <button type="button" class="ss-tab ${ST.tab === 'enterprise' ? 'active' : ''}" data-tab="enterprise">Enterprise</button>
        <button type="button" class="ss-tab ${ST.tab === 'files' ? 'active' : ''}" data-tab="files">Files</button>
      </div>`;

    let body;
    if (ST.tab !== 'sheets') {
      body = `
        <div class="ss-empty">
          <div class="ss-empty-icon"><i class="fa-solid ${ST.tab === 'enterprise' ? 'fa-building' : 'fa-folder-open'}"></i></div>
          <h3>${ST.tab === 'enterprise' ? 'Enterprise' : 'Files'}</h3>
          <p>This section is coming soon.</p>
        </div>`;
    } else if (!sheets.length) {
      body = `
        <div class="ss-empty">
          <div class="ss-empty-icon"><i class="fa-solid fa-qrcode"></i></div>
          <h3>Welcome to ECO GREEN SOLAR!</h3>
          <p>Create your first inventory sheet by tapping the + button below</p>
          <button type="button" class="btn btn-green ss-create-btn" id="ssCreateBtn"><i class="fa-solid fa-plus"></i> Create New Sheet</button>
        </div>`;
    } else {
      body = `
        <div class="ss-list-head">
          <div class="ss-total">Total ${sheets.length} Sheet${sheets.length === 1 ? '' : 's'}</div>
          <button type="button" class="btn btn-green ss-create-btn" id="ssCreateBtn"><i class="fa-solid fa-plus"></i> Create New Sheet</button>
        </div>
        <div class="ss-sheet-grid">${sheets.map(sheetCardHtml).join('')}</div>`;
    }

    return `
      ${tabsHtml}
      <div class="ss-body">${body}</div>
      <button type="button" class="ss-fab" id="ssFab" title="Create new sheet"><i class="fa-solid fa-plus"></i></button>
      <button type="button" class="ss-gopro" id="ssGoPro"><i class="fa-solid fa-crown"></i> Go Pro+</button>
    `;
  }

  function sheetCardHtml(sheet) {
    const rows = window.SheetsStore.getEntries(sheet.id).length;
    return `
      <div class="ss-sheet-card" data-id="${sheet.id}">
        <div class="ss-sheet-card-main">
          <div class="ss-sheet-icon"><i class="fa-solid fa-table-list"></i></div>
          <div class="ss-sheet-info">
            <div class="ss-sheet-name">${escapeHtml(sheet.name)}</div>
            <div class="ss-sheet-meta">${fmtTimestamp(sheet.createdAt)} &middot; ${sheet.columns.length} column${sheet.columns.length === 1 ? '' : 's'} &middot; ${rows} row${rows === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div class="ss-sheet-actions">
          <button type="button" class="ss-icon-btn ss-edit-sheet" data-id="${sheet.id}" title="Edit columns"><i class="fa-solid fa-pen"></i></button>
          <button type="button" class="ss-icon-btn ss-view-sheet" data-id="${sheet.id}" title="Open sheet"><i class="fa-solid fa-eye"></i></button>
          <button type="button" class="ss-icon-btn ss-menu-sheet" data-id="${sheet.id}" title="More"><i class="fa-solid fa-ellipsis-vertical"></i></button>
        </div>
      </div>`;
  }

  // =========================================================================
  // SCREEN 2 — Create Sheet modal
  // =========================================================================
  function openCreateModal() {
    window.openModal('Create New Sheet', `
      <div class="ss-modal-options">
        <button type="button" class="ss-modal-opt primary" id="ssOptManual">
          <i class="fa-solid fa-pen-to-square"></i>
          <div><strong>Create New Sheet Manually</strong><small>Define your own columns</small></div>
        </button>
        <button type="button" class="ss-modal-opt" id="ssOptImport">
          <i class="fa-solid fa-file-import"></i>
          <div><strong>Import CSV/XLSX</strong><small>Bring in an existing spreadsheet</small></div>
        </button>
        <button type="button" class="ss-modal-opt" id="ssOptTemplate">
          <i class="fa-solid fa-layer-group"></i>
          <div><strong>Create from Templates</strong><small>Start from a ready-made layout</small></div>
        </button>
        <input type="file" id="ssImportFile" accept=".csv,.xlsx,.xls" style="display:none">
      </div>
    `);
    document.getElementById('ssOptManual').onclick = () => { window.closeModal(); startManualCreate(); };
    document.getElementById('ssOptImport').onclick = () => { document.getElementById('ssImportFile').click(); };
    document.getElementById('ssOptTemplate').onclick = () => { window.closeModal(); openTemplateModal(); };
    document.getElementById('ssImportFile').onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      window.closeModal();
      if (file) handleImportFile(file);
    };
  }

  function openTemplateModal() {
    const templates = [
      { name: 'Inventory Scan Sheet', columns: [{ name: 'Item Name', type: 'text' }, { name: 'Barcode/QR', type: 'barcode' }, { name: 'Quantity', type: 'number' }, { name: 'Date', type: 'date' }] },
      { name: 'Asset Tracking', columns: [{ name: 'Asset Name', type: 'text' }, { name: 'Asset Tag (Barcode)', type: 'barcode' }, { name: 'Location', type: 'text' }, { name: 'Status', type: 'text' }] },
      { name: 'Stock Receiving', columns: [{ name: 'Product', type: 'text' }, { name: 'Barcode/QR', type: 'barcode' }, { name: 'Qty Received', type: 'number' }, { name: 'Received On', type: 'date' }, { name: 'Photo', type: 'image' }] },
    ];
    window.openModal('Create from Templates', `
      <div class="ss-modal-options">
        ${templates.map((t, i) => `
          <button type="button" class="ss-modal-opt" data-t="${i}">
            <i class="fa-solid fa-layer-group"></i>
            <div><strong>${escapeHtml(t.name)}</strong><small>${t.columns.map((c) => escapeHtml(c.name)).join(', ')}</small></div>
          </button>`).join('')}
      </div>
    `);
    document.querySelectorAll('.ss-modal-opt[data-t]').forEach((btn) => {
      btn.onclick = () => {
        const t = templates[+btn.dataset.t];
        window.closeModal();
        startManualCreate({ name: t.name, columns: t.columns });
      };
    });
  }

  // ---------------- CSV / XLSX import ----------------
  function handleImportFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = () => importFromRows(parseCsv(String(reader.result)), file.name);
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      if (!window.XLSX) { window.showToast('Spreadsheet import library failed to load'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const wb = window.XLSX.read(reader.result, { type: 'binary' });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          const csv = window.XLSX.utils.sheet_to_csv(firstSheet);
          importFromRows(parseCsv(csv), file.name);
        } catch (e) {
          console.warn('XLSX import failed', e);
          window.showToast('Could not read that spreadsheet file');
        }
      };
      reader.readAsBinaryString(file);
    } else {
      window.showToast('Please choose a .csv, .xlsx, or .xls file');
    }
  }

  function parseCsv(text) {
    const rows = [];
    text.split(/\r\n|\n|\r/).forEach((line) => {
      if (line === '') return;
      const cells = [];
      let cur = '', inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
          if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
          else if (ch === '"') inQuotes = false;
          else cur += ch;
        } else if (ch === '"') inQuotes = true;
        else if (ch === ',') { cells.push(cur); cur = ''; }
        else cur += ch;
      }
      cells.push(cur);
      rows.push(cells);
    });
    return rows;
  }

  function importFromRows(rows, fileName) {
    if (!rows.length) { window.showToast('That file looks empty'); return; }
    const headers = rows[0].map((h) => (h || '').trim() || 'Column');
    const columns = headers.map((h) => ({
      name: h,
      type: /barcode|qr/i.test(h) ? 'barcode' : /date/i.test(h) ? 'date' : /qty|quantity|number|amount|count/i.test(h) ? 'number' : 'text',
    }));
    const sheet = window.SheetsStore.createSheet({
      name: (fileName || 'Imported Sheet').replace(/\.(csv|xlsx|xls)$/i, ''),
      columns,
    });
    let imported = 0;
    rows.slice(1).forEach((row) => {
      if (!row.length || row.every((c) => !c)) return;
      const values = {};
      sheet.columns.forEach((col, i) => { values[col.id] = row[i] != null ? row[i] : ''; });
      window.SheetsStore.addEntry(sheet.id, values);
      imported++;
    });
    window.showToast(`Imported ${imported} row(s)`);
    openSheetDataEntry(sheet.id);
  }

  // =========================================================================
  // SCREEN 3 — Manual sheet creation (also reused for "Edit columns")
  // =========================================================================
  function startManualCreate(prefill) {
    ST.editingSheetId = null;
    ST.draftName = prefill && prefill.name ? prefill.name : '';
    ST.draftColumns = prefill && prefill.columns
      ? prefill.columns.map((c) => ({ id: window.SheetsStore.uid('col'), name: c.name, type: c.type || 'text' }))
      : [{ id: window.SheetsStore.uid('col'), name: '', type: 'text' }];
    ST.view = 'manual-create';
    render();
  }

  function startEditSheet(sheetId) {
    const sheet = window.SheetsStore.getSheet(sheetId);
    if (!sheet) return;
    ST.editingSheetId = sheet.id;
    ST.draftName = sheet.name;
    ST.draftColumns = sheet.columns.map((c) => Object.assign({}, c));
    ST.view = 'manual-create';
    render();
  }

  function renderManualCreate() {
    return `
      <div class="ss-appbar">
        <button type="button" class="ss-icon-btn" id="ssBackFromCreate"><i class="fa-solid fa-arrow-left"></i></button>
        <div class="ss-appbar-title">${ST.editingSheetId ? 'Edit Sheet' : 'Create New Sheet'}</div>
        <button type="button" class="ss-icon-btn ss-save-check" id="ssSaveSheetTop" title="Save"><i class="fa-solid fa-check"></i></button>
      </div>
      <div class="ss-body">
        <div class="panel">
          <h3><i class="fa-solid fa-circle-info"></i> Sheet Information</h3>
          <div class="field">
            <label>Sheet Name</label>
            <input type="text" id="ssSheetName" placeholder="Enter a name for your sheet" value="${escapeHtml(ST.draftName)}">
          </div>
        </div>
        <div class="panel">
          <h3><i class="fa-solid fa-table-columns"></i> Sheet Columns <span class="ss-col-count">(${ST.draftColumns.length})</span></h3>
          <div id="ssColList">${ST.draftColumns.map(colRowHtml).join('')}</div>
          <button type="button" class="ss-add-col" id="ssAddCol"><i class="fa-solid fa-plus"></i> Add Column</button>
        </div>
      </div>
      <div class="ss-bottom-bar">
        <button type="button" class="btn btn-green ss-wide-btn" id="ssCreateSheetBtn"><i class="fa-solid fa-check"></i> ${ST.editingSheetId ? 'Save Sheet' : 'Create Sheet'}</button>
      </div>
    `;
  }

  function colRowHtml(col) {
    return `
      <div class="ss-col-row" data-id="${col.id}">
        <span class="ss-col-handle"><i class="fa-solid fa-grip-vertical"></i></span>
        <input type="text" class="ss-col-name" placeholder="Column Name" value="${escapeHtml(col.name)}">
        <select class="ss-col-type">
          ${COL_TYPES.map((t) => `<option value="${t.value}" ${t.value === col.type ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
        <button type="button" class="ss-icon-btn ss-col-del" title="Delete column"><i class="fa-solid fa-trash"></i></button>
      </div>`;
  }

  function syncDraftFromDom() {
    const nameEl = document.getElementById('ssSheetName');
    if (nameEl) ST.draftName = nameEl.value;
    document.querySelectorAll('#ssColList .ss-col-row').forEach((row) => {
      const col = ST.draftColumns.find((c) => c.id === row.dataset.id);
      if (!col) return;
      col.name = row.querySelector('.ss-col-name').value;
      col.type = row.querySelector('.ss-col-type').value;
    });
  }

  function addDraftColumn() {
    syncDraftFromDom();
    ST.draftColumns.push({ id: window.SheetsStore.uid('col'), name: '', type: 'text' });
    render();
    const rows = document.querySelectorAll('#ssColList .ss-col-row');
    const last = rows[rows.length - 1];
    if (last) last.querySelector('.ss-col-name').focus();
  }

  function deleteDraftColumn(id) {
    syncDraftFromDom();
    if (ST.draftColumns.length <= 1) { window.showToast('A sheet needs at least one column'); return; }
    ST.draftColumns = ST.draftColumns.filter((c) => c.id !== id);
    render();
  }

  function saveDraftSheet() {
    syncDraftFromDom();
    const name = (ST.draftName || '').trim();
    if (!name) { window.showToast('Please enter a sheet name'); const el = document.getElementById('ssSheetName'); if (el) el.focus(); return; }
    const cleanCols = ST.draftColumns.map((c, i) => ({ id: c.id, name: (c.name || '').trim() || `Column ${i + 1}`, type: c.type || 'text' }));
    if (ST.editingSheetId) {
      window.SheetsStore.updateSheet(ST.editingSheetId, { name, columns: cleanCols });
      window.showToast('Sheet updated');
    } else {
      window.SheetsStore.createSheet({ name, columns: cleanCols });
      window.showToast('Sheet created');
    }
    ST.editingSheetId = null;
    ST.view = 'list';
    render();
  }

  function backToList() { ST.view = 'list'; ST.editingSheetId = null; render(); }

  // =========================================================================
  // SCREEN 5 — Data entry
  // =========================================================================
  function openSheetDataEntry(sheetId) {
    ST.activeSheetId = sheetId;
    ST.lastBarcodeFieldId = null;
    ST.view = 'data-entry';
    render();
  }

  function renderDataEntry() {
    const sheet = window.SheetsStore.getSheet(ST.activeSheetId);
    if (!sheet) { ST.view = 'list'; return renderList(); }
    const entries = window.SheetsStore.getEntries(sheet.id);
    // Prefer a dedicated "Barcode/QR" column, but fall back to the first
    // scannable (text) column so the scan button always has somewhere to put
    // the result, even on sheets like "SERIAL NO." that were created as Text.
    const firstBarcodeCol = sheet.columns.find((c) => c.type === 'barcode') || sheet.columns.find(isScannableCol);
    if (!ST.lastBarcodeFieldId && firstBarcodeCol) ST.lastBarcodeFieldId = 'ssField_' + firstBarcodeCol.id;

    return `
      <div class="ss-appbar">
        <button type="button" class="ss-icon-btn" id="ssBackFromEntry"><i class="fa-solid fa-arrow-left"></i></button>
        <div class="ss-appbar-title ss-truncate" title="${escapeHtml(sheet.name)}">Enter Data to Sheet ${escapeHtml(sheet.name)}</div>
        <button type="button" class="ss-icon-btn" id="ssTogglePreview" title="Toggle preview"><i class="fa-solid fa-eye"></i></button>
        <button type="button" class="ss-icon-btn ss-bt-btn" id="ssBtScanner" title="Connect Bluetooth Scanner"><i class="fa-solid fa-bluetooth-b"></i></button>
        <button type="button" class="ss-icon-btn" id="ssEntryMenu" title="More"><i class="fa-solid fa-ellipsis-vertical"></i></button>
      </div>
      <div class="ss-body">
        <div class="panel" id="ssEntryForm">
          <h3><i class="fa-solid fa-pen"></i> New Entry</h3>
          <div class="ss-entry-grid">${sheet.columns.map(fieldHtml).join('')}</div>
        </div>
        <div class="panel" id="ssPreviewPanel">
          <h3><i class="fa-solid fa-table"></i> Data Preview <span class="ss-col-count">(${entries.length} row${entries.length === 1 ? '' : 's'})</span></h3>
          <div class="table-wrap ss-preview-table">
            <table>
              <thead><tr><th>S. No.</th>${sheet.columns.map((c) => `<th>${escapeHtml(c.name)}</th>`).join('')}<th>Actions</th></tr></thead>
              <tbody id="ssEntryTbody">
                ${entries.length ? entries.map((en) => entryRowHtml(en, sheet)).join('') : `<tr><td colspan="${sheet.columns.length + 2}" style="text-align:center;color:var(--txt-muted);">No rows yet — scan or type to add data</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="ss-bottom-nav">
        <button type="button" class="ss-bottom-nav-btn" id="ssTypeMode" title="Type mode"><i class="fa-solid fa-keyboard"></i><span>Type</span></button>
        <button type="button" class="ss-bottom-nav-scan" id="ssScanMode" title="Scan barcode / QR"><i class="fa-solid fa-barcode"></i></button>
        <button type="button" class="ss-bottom-nav-btn ss-save-entry" id="ssSaveEntry" title="Save entry"><i class="fa-solid fa-floppy-disk"></i><span>Save</span></button>
      </div>
    `;
  }

  // Fields eligible to receive a scanned value: explicit "Barcode/QR" columns,
  // plus plain "Text" columns — in practice most sheets (e.g. a "SERIAL NO."
  // column) are created as Text rather than the dedicated Barcode/QR type, and
  // the scanner should still work for them instead of refusing to open.
  function isScannableCol(col) { return col.type === 'barcode' || col.type === 'text'; }

  function fieldHtml(col) {
    const fid = 'ssField_' + col.id;
    const label = `<label>${escapeHtml(col.name)}:</label>`;
    if (col.type === 'barcode') {
      return `
        <div class="field span-2">
          ${label}
          <div class="ss-scan-input-wrap">
            <input type="text" id="${fid}" data-col="${col.id}" data-type="barcode" placeholder="Type or scan ${escapeHtml(col.name)}" autocomplete="off">
            <button type="button" class="ss-scan-icon-btn" data-target="${fid}" title="Scan barcode / QR"><i class="fa-solid fa-barcode"></i></button>
          </div>
        </div>`;
    }
    if (col.type === 'number') return `<div class="field">${label}<input type="number" id="${fid}" data-col="${col.id}" data-type="number" placeholder="0"></div>`;
    if (col.type === 'date') return `<div class="field">${label}<input type="date" id="${fid}" data-col="${col.id}" data-type="date"></div>`;
    if (col.type === 'image') return `<div class="field">${label}<input type="file" accept="image/*" capture="environment" id="${fid}" data-col="${col.id}" data-type="image"><div class="ss-thumb-wrap" id="${fid}_thumb"></div></div>`;
    // Plain "Text" columns also get a scan icon so scanning works even when
    // the user didn't set the column type to "Barcode/QR" (e.g. "SERIAL NO.").
    return `
      <div class="field span-2">
        ${label}
        <div class="ss-scan-input-wrap">
          <input type="text" id="${fid}" data-col="${col.id}" data-type="text" placeholder="Enter or scan ${escapeHtml(col.name)}" autocomplete="off">
          <button type="button" class="ss-scan-icon-btn" data-target="${fid}" title="Scan barcode / QR"><i class="fa-solid fa-barcode"></i></button>
        </div>
      </div>`;
  }

  function entryRowHtml(entry, sheet) {
    return `<tr data-id="${entry.id}">
      <td>${entry.sno}</td>
      ${sheet.columns.map((c) => {
        const v = entry.values[c.id];
        if (c.type === 'image' && v) return `<td><img src="${v}" class="ss-row-thumb" alt=""></td>`;
        return `<td>${escapeHtml(v || '')}</td>`;
      }).join('')}
      <td><button type="button" class="ss-icon-btn ss-del-row" data-id="${entry.id}" title="Delete row"><i class="fa-solid fa-trash"></i></button></td>
    </tr>`;
  }

  function handleImageFieldChange(inputEl) {
    const file = inputEl.files && inputEl.files[0];
    const thumbWrap = document.getElementById(inputEl.id + '_thumb');
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      inputEl.dataset.imageData = String(reader.result);
      if (thumbWrap) thumbWrap.innerHTML = `<img src="${reader.result}" class="ss-thumb">`;
    };
    reader.readAsDataURL(file);
  }

  function saveCurrentEntry() {
    const sheet = window.SheetsStore.getSheet(ST.activeSheetId);
    if (!sheet) return;
    const values = {};
    let hasAny = false;
    sheet.columns.forEach((col) => {
      const el = document.getElementById('ssField_' + col.id);
      if (!el) return;
      if (col.type === 'image') {
        const v = el.dataset.imageData || '';
        if (v) hasAny = true;
        values[col.id] = v;
      } else {
        const v = (el.value || '').trim();
        if (v) hasAny = true;
        values[col.id] = v;
      }
    });
    if (!hasAny) { window.showToast('Enter some data before saving'); return; }
    window.SheetsStore.addEntry(sheet.id, values);
    window.showToast('Row saved');
    render();
    const firstCol = sheet.columns[0];
    if (firstCol) { const f = document.getElementById('ssField_' + firstCol.id); if (f) f.focus(); }
  }

  function deleteEntryRow(entryId) {
    window.confirmDanger('Delete Row', 'Remove this entry from the sheet?').then((ok) => {
      if (!ok) return;
      window.SheetsStore.deleteEntry(ST.activeSheetId, entryId);
      render();
    });
  }

  function exportSheetCsv(sheetId) {
    const sheet = window.SheetsStore.getSheet(sheetId);
    if (!sheet) return;
    const entries = window.SheetsStore.getEntries(sheetId);
    const csvEscape = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lines = [['S.No', ...sheet.columns.map((c) => c.name)].map(csvEscape).join(',')];
    entries.forEach((en) => {
      const row = [en.sno, ...sheet.columns.map((c) => (c.type === 'image' ? '' : (en.values[c.id] || '')))];
      lines.push(row.map(csvEscape).join(','));
    });
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sheet.name.replace(/[^a-z0-9]+/gi, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    window.showToast('CSV exported');
  }

  // ---------------- small dropdown menus (sheet card "..." + entry screen "...") ----------------
  function dropdownOutsideHandler(e) {
    if (window._ssDropdown && !window._ssDropdown.contains(e.target)) closeAnyDropdown();
  }
  function closeAnyDropdown() {
    if (window._ssDropdown) { window._ssDropdown.remove(); window._ssDropdown = null; }
    document.removeEventListener('click', dropdownOutsideHandler);
  }
  function placeDropdown(menu, anchorBtn) {
    document.body.appendChild(menu);
    const rect = anchorBtn.getBoundingClientRect();
    menu.style.top = (rect.bottom + 6) + 'px';
    menu.style.right = (window.innerWidth - rect.right) + 'px';
    window._ssDropdown = menu;
    setTimeout(() => document.addEventListener('click', dropdownOutsideHandler), 0);
  }

  function openSheetCardMenu(sheetId, anchorBtn) {
    closeAnyDropdown();
    const sheet = window.SheetsStore.getSheet(sheetId);
    if (!sheet) return;
    const menu = document.createElement('div');
    menu.className = 'ss-dropdown';
    menu.innerHTML = `
      <button type="button" class="ss-dropdown-item" id="ssCardExport"><i class="fa-solid fa-file-csv"></i> Export CSV</button>
      <button type="button" class="ss-dropdown-item danger" id="ssCardDelete"><i class="fa-solid fa-trash"></i> Delete Sheet</button>`;
    placeDropdown(menu, anchorBtn);
    menu.querySelector('#ssCardExport').onclick = () => { closeAnyDropdown(); exportSheetCsv(sheetId); };
    menu.querySelector('#ssCardDelete').onclick = () => {
      closeAnyDropdown();
      window.confirmDanger('Delete Sheet', `Delete "${sheet.name}" and all its data? This cannot be undone.`).then((ok) => {
        if (!ok) return;
        window.SheetsStore.deleteSheet(sheetId);
        window.showToast('Sheet deleted');
        render();
      });
    };
  }

  function openEntryMenu(anchorBtn) {
    closeAnyDropdown();
    const sheet = window.SheetsStore.getSheet(ST.activeSheetId);
    if (!sheet) return;
    const menu = document.createElement('div');
    menu.className = 'ss-dropdown';
    menu.innerHTML = `
      <button type="button" class="ss-dropdown-item" id="ssExportCsv"><i class="fa-solid fa-file-csv"></i> Export CSV</button>
      <button type="button" class="ss-dropdown-item" id="ssClearEntries"><i class="fa-solid fa-broom"></i> Clear All Entries</button>
      <button type="button" class="ss-dropdown-item danger" id="ssDeleteSheetFromEntry"><i class="fa-solid fa-trash"></i> Delete Sheet</button>`;
    placeDropdown(menu, anchorBtn);
    menu.querySelector('#ssExportCsv').onclick = () => { closeAnyDropdown(); exportSheetCsv(sheet.id); };
    menu.querySelector('#ssClearEntries').onclick = () => {
      closeAnyDropdown();
      window.confirmDanger('Clear All Entries', 'This will remove every row from this sheet. Continue?').then((ok) => {
        if (!ok) return;
        window.SheetsStore.clearEntries(sheet.id);
        window.showToast('All entries cleared');
        render();
      });
    };
    menu.querySelector('#ssDeleteSheetFromEntry').onclick = () => {
      closeAnyDropdown();
      window.confirmDanger('Delete Sheet', `Delete "${sheet.name}" and all its data? This cannot be undone.`).then((ok) => {
        if (!ok) return;
        window.SheetsStore.deleteSheet(sheet.id);
        window.showToast('Sheet deleted');
        ST.view = 'list';
        render();
      });
    };
  }

  // =========================================================================
  // SCREENS 6 & 7 — Camera permission + Barcode/QR scanner overlay
  // =========================================================================
  const scannerState = {
    html5QrCode: null,
    cameras: [],
    cameraIndex: 0,
    torchOn: false,
    handledOnce: false,
    targetFieldId: null,
    overlayEl: null,
    pendingText: null,    // value that was just decoded, awaiting Save/Retry
    pendingColId: null,   // column it would be saved into
    pendingIsDup: false,
  };

  // Checks whether `value` already exists (case-insensitive, trimmed) in
  // this sheet's existing rows for the given column — used to block saving
  // a duplicate serial no./barcode until the old row is deleted first.
  function isDuplicateScanValue(sheet, colId, value) {
    if (!sheet || !colId) return false;
    const norm = String(value == null ? '' : value).trim().toLowerCase();
    if (!norm) return false;
    const entries = window.SheetsStore.getEntries(sheet.id);
    return entries.some((en) => String(en.values[colId] || '').trim().toLowerCase() === norm);
  }

  // ---------------- Bluetooth / external-scanner mode ----------------
  // A website has no way to ask the OS "is a Bluetooth scanner connected?"
  // — that pairing happens entirely at the OS level and browsers can't see
  // it. So this button is a simple, explicit switch instead of a real
  // connection: the person turns it ON when their scanner is paired, and
  // OFF when it isn't. Turning it ON does two things:
  //   1. Disables the camera scan buttons (so the camera can never get
  //      stuck "Requesting permission" while a hardware scanner is in use).
  //   2. Starts listening for Enter on any scannable field — most
  //      Bluetooth/USB barcode scanners act like a keyboard: they type the
  //      code, then send Enter. Every Enter while this mode is ON is
  //      treated as "a scan just happened", regardless of typing speed.
  const btState = {
    active: false,
    enterHandler: null,
  };

  function isBtActive() { return btState.active; }

  // Prevents the mobile on-screen keyboard from popping up on these fields
  // while Bluetooth scanner mode is ON — inputmode="none" tells the phone
  // "don't show your own keyboard here" while still letting a real
  // hardware/Bluetooth keyboard-wedge scanner type into the field normally.
  function applyBtInputMode() {
    const active = isBtActive();
    document.querySelectorAll('input[data-type="barcode"], input[data-type="text"]').forEach((el) => {
      if (active) el.setAttribute('inputmode', 'none');
      else el.removeAttribute('inputmode');
    });
  }

  // Keeps every Bluetooth icon on screen in sync, and disables the
  // camera-scan entry points (bottom-nav scan button + per-field scan
  // icons) while scanner mode is ON.
  function syncBtButtons() {
    const active = isBtActive();
    document.querySelectorAll('.ss-bt-btn').forEach((btn) => {
      btn.classList.toggle('active', active);
      btn.title = active
        ? 'Bluetooth scanner mode ON \u2014 tap to turn off'
        : 'Turn ON if a Bluetooth/USB scanner is connected (disables camera)';
    });
    document.querySelectorAll('.ss-bottom-nav-scan, .ss-scan-icon-btn').forEach((btn) => {
      btn.classList.toggle('ss-disabled', active);
      btn.disabled = active;
      btn.title = active
        ? 'Camera disabled while Bluetooth scanner mode is ON'
        : 'Scan barcode / QR';
    });
    applyBtInputMode();
  }

  // ---------------------------------------------------------------------
  // Shared "a code was scanned" pipeline — used by BOTH the camera decoder
  // (onScanSuccess) and the Bluetooth/keyboard-wedge scanner (Enter-key),
  // so a code coming from either source fills the field and saves the row
  // in exactly the same way.
  // ---------------------------------------------------------------------
  function processScanValue(text, fieldId) {
    const targetId = fieldId || scannerState.targetFieldId || resolveScanTargetId();
    fillTargetField(text, targetId);
    const sheet = window.SheetsStore.getSheet(ST.activeSheetId);
    const dataCols = sheet ? sheet.columns.filter((c) => c.type !== 'image') : [];
    if (sheet && dataCols.length <= 1) {
      // Single-field sheets (e.g. just "SERIAL NO.") — each scan IS a row,
      // so save it immediately and let the next scan follow right after,
      // the same continuous scan-to-sheet flow for camera or Bluetooth.
      saveCurrentEntry();
      return true;
    }
    return false;
  }

  // Focuses a scannable field and re-asserts that focus one tick later —
  // needed because saveCurrentEntry() re-renders the whole form, which can
  // momentarily replace/steal focus from the field on some mobile browsers.
  function focusScannableField(id) {
    if (!id) return;
    const f = document.getElementById(id);
    if (f) f.focus();
    setTimeout(() => {
      const f2 = document.getElementById(id);
      if (f2) f2.focus();
    }, 30);
  }

  function toggleBluetoothScanner() {
    if (btState.active) disableScannerMode(); else enableScannerMode();
  }

  function enableScannerMode() {
    if (btState.active) return;
    btState.active = true;
    btState.enterHandler = (e) => {
      if (ST.view !== 'data-entry') return;
      const el = e.target;
      if (!el || !el.matches || !el.matches('input[data-type="barcode"], input[data-type="text"]')) return;
      if (e.key !== 'Enter') return;
      const code = (el.value || '').trim();
      if (!code) return;
      e.preventDefault();
      el.value = '';
      beep();
      if (navigator.vibrate) { try { navigator.vibrate(180); } catch (err) { /* not supported */ } }
      showBluetoothScanOverlay(code, el.id);
    };
    document.addEventListener('keydown', btState.enterHandler, true);
    if (scannerState.overlayEl) closeScanner();
    syncBtButtons();
    const targetId = resolveScanTargetId();
    if (targetId) { ST.lastBarcodeFieldId = targetId; focusScannableField(targetId); }
    window.showToast('Bluetooth scanner mode ON \u2014 camera disabled, keyboard chhupa hua hai. Seedha scan karein.');
  }

  function disableScannerMode() {
    if (btState.enterHandler) document.removeEventListener('keydown', btState.enterHandler, true);
    btState.enterHandler = null;
    btState.active = false;
    syncBtButtons();
    window.showToast('Bluetooth scanner mode OFF \u2014 camera enabled again.');
  }

  // Shows the exact same "scanned value + Save/Retry + duplicate check"
  // interface the camera uses, but without ever touching the camera —
  // used for every scan while Bluetooth scanner mode is ON. Refocuses the
  // target field on every close (Retry / Save / back) so the cursor is
  // always sitting in the box, ready for the next scan.
  function showBluetoothScanOverlay(text, fieldId) {
    if (scannerState.overlayEl) closeScanner();
    const targetId = fieldId || resolveScanTargetId();
    const field = targetId ? document.getElementById(targetId) : null;
    const colId = field ? field.dataset.col : null;
    const sheet = window.SheetsStore.getSheet(ST.activeSheetId);
    const dup = isDuplicateScanValue(sheet, colId, text);

    const overlay = document.createElement('div');
    overlay.className = 'ss-scanner-overlay';
    overlay.innerHTML = `
      <div class="ss-scanner-topbar">
        <button type="button" class="ss-icon-btn light" id="ssBtScanClose" title="Close"><i class="fa-solid fa-arrow-left"></i></button>
        <div class="ss-scanner-title"><i class="fa-solid fa-bluetooth-b"></i>&nbsp;Bluetooth Scan</div>
        <div class="ss-scanner-topbtns"></div>
      </div>
      <div class="ss-scanner-camwrap" style="display:flex;align-items:center;justify-content:center;">
        <div class="ss-scanner-result" style="display:flex;">
          <div class="ss-scanner-result-card${dup ? ' dup' : ''}" id="ssBtScanResultCard">
            <div class="ss-scanner-result-label">Scanned value</div>
            <div class="ss-scanner-result-value">${escapeHtml(text)}</div>
            <div class="ss-scanner-result-msg">${dup ? 'This serial no. already exists in the record. Delete the old row first, or Retry with a different code.' : 'Scanned successfully.'}</div>
          </div>
          <div class="ss-scanner-result-actions">
            <button type="button" class="btn btn-ghost" id="ssBtScanRetry"><i class="fa-solid fa-rotate-left"></i> Retry</button>
            <button type="button" class="btn btn-green" id="ssBtScanSave" style="${dup ? 'display:none;' : ''}"><i class="fa-solid fa-check"></i> Save</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const closeOverlay = () => { overlay.remove(); document.body.style.overflow = ''; };
    overlay.querySelector('#ssBtScanClose').onclick = () => { closeOverlay(); focusScannableField(targetId); };
    overlay.querySelector('#ssBtScanRetry').onclick = () => { closeOverlay(); focusScannableField(targetId); window.showToast('Retry \u2014 phir se scan karein'); };
    overlay.querySelector('#ssBtScanSave').onclick = () => {
      if (dup) return;
      closeOverlay(); // remove overlay first so it can't be left covering the form
      const saved = processScanValue(text, targetId); // may re-render the form (single-column autosave)
      focusScannableField(targetId); // re-assert focus after any re-render
      window.showToast(saved ? 'Row saved (Bluetooth scan)' : 'Scanned via Bluetooth \u2014 fill remaining fields and tap Save');
    };
  }

  // Works out which input field a scan result should land in, with sensible
  // fallbacks so the camera still opens even if no field is currently
  // focused/remembered: last-used field -> first Barcode/QR column -> first
  // Text column (in DOM/column order) on the currently open sheet.
  function resolveScanTargetId() {
    if (ST.lastBarcodeFieldId && document.getElementById(ST.lastBarcodeFieldId)) {
      return ST.lastBarcodeFieldId;
    }
    const sheet = window.SheetsStore.getSheet(ST.activeSheetId);
    if (!sheet) return null;
    const col = sheet.columns.find((c) => c.type === 'barcode') || sheet.columns.find(isScannableCol);
    return col ? 'ssField_' + col.id : null;
  }

  function openScanner(targetFieldId) {
    if (isBtActive()) {
      window.showToast('Bluetooth scanner mode ON hai \u2014 camera disabled hai. Seedha field mein scan karein, ya camera use karne ke liye pehle Bluetooth scanner mode OFF karein.');
      return;
    }
    if (!targetFieldId) targetFieldId = resolveScanTargetId();
    if (!targetFieldId) { window.showToast('Add a Text or Barcode/QR column to this sheet first'); return; }
    scannerState.targetFieldId = targetFieldId;
    scannerState.handledOnce = false;
    scannerState.torchOn = false;

    const overlay = document.createElement('div');
    overlay.className = 'ss-scanner-overlay';
    overlay.innerHTML = `
      <div class="ss-scanner-topbar">
        <button type="button" class="ss-icon-btn light" id="ssScanBack" title="Back"><i class="fa-solid fa-arrow-left"></i></button>
        <div class="ss-scanner-title">Scan Barcode</div>
        <div class="ss-scanner-topbtns">
          <button type="button" class="ss-icon-btn light" id="ssScanTorch" title="Flashlight"><i class="fa-solid fa-bolt"></i></button>
          <button type="button" class="ss-icon-btn light" id="ssScanFlip" title="Flip camera"><i class="fa-solid fa-camera-rotate"></i></button>
          <button type="button" class="ss-icon-btn light ss-bt-btn" id="ssScanBt" title="Connect Bluetooth Scanner"><i class="fa-solid fa-bluetooth-b"></i></button>
        </div>
      </div>
      <div class="ss-scanner-camwrap">
        <div id="ssScanRegion" class="ss-scanner-camfeed"></div>
        <div class="ss-scanner-target" id="ssScanTargetBox"></div>
        <div class="ss-scanner-instruction" id="ssScanStatus">Requesting camera permission&hellip;</div>
        <div class="ss-scanner-result" id="ssScanResult" style="display:none;">
          <div class="ss-scanner-result-card" id="ssScanResultCard">
            <div class="ss-scanner-result-label" id="ssScanResultLabel">Scanned value</div>
            <div class="ss-scanner-result-value" id="ssScanResultValue"></div>
            <div class="ss-scanner-result-msg" id="ssScanResultMsg"></div>
          </div>
          <div class="ss-scanner-result-actions">
            <button type="button" class="btn btn-ghost" id="ssScanRetry"><i class="fa-solid fa-rotate-left"></i> Retry</button>
            <button type="button" class="btn btn-green" id="ssScanSave"><i class="fa-solid fa-check"></i> Save</button>
          </div>
        </div>
      </div>
      <div class="ss-scanner-bottom" id="ssScannerBottom">
        <button type="button" class="btn btn-red ss-scanner-cancel" id="ssScanCancel"><i class="fa-solid fa-xmark"></i> Cancel</button>
      </div>
    `;
    document.body.appendChild(overlay);
    scannerState.overlayEl = overlay;
    document.body.style.overflow = 'hidden';

    overlay.querySelector('#ssScanBack').onclick = closeScanner;
    overlay.querySelector('#ssScanCancel').onclick = closeScanner;
    overlay.querySelector('#ssScanTorch').onclick = toggleTorch;
    overlay.querySelector('#ssScanFlip').onclick = flipCamera;
    overlay.querySelector('#ssScanBt').onclick = toggleBluetoothScanner;
    overlay.querySelector('#ssScanRetry').onclick = retryScan;
    overlay.querySelector('#ssScanSave').onclick = confirmScanSave;
    syncBtButtons();

    startCamera();
  }

  function setScanStatus(msg) {
    const el = document.getElementById('ssScanStatus');
    if (el) el.textContent = msg;
  }

  function startCamera() {
    if (!window.Html5Qrcode) {
      setScanStatus('Scanner library failed to load. Check your connection and try again.');
      return;
    }
    // getCameras() itself triggers the browser's camera permission prompt
    // when it hasn't been granted yet — this is Screen 7 (permission check).
    window.Html5Qrcode.getCameras().then((cameras) => {
      if (!cameras || !cameras.length) { setScanStatus('No camera found on this device.'); return; }
      scannerState.cameras = cameras;
      const backIdx = cameras.findIndex((c) => /back|rear|environment/i.test(c.label || ''));
      scannerState.cameraIndex = backIdx !== -1 ? backIdx : 0;
      launchCamera();
    }).catch((err) => {
      console.warn('Camera permission error', err);
      setScanStatus('Camera permission denied. Please allow camera access in your browser settings, then tap Cancel and try again.');
    });
  }

  function launchCamera() {
    const camera = scannerState.cameras[scannerState.cameraIndex];
    if (!camera) return;
    scannerState.handledOnce = false;
    setScanStatus('Place QR & barcode in the box');

    // No `qrbox` here on purpose: passing one makes the html5-qrcode
    // library inject its OWN shaded-region/border overlay on top of the
    // video feed, which clashed with our custom `.ss-scanner-target` box
    // and produced the broken double-frame look. Omitting it means the
    // library scans the full video frame (still fast/reliable) and draws
    // no overlay of its own — our custom gold box below is purely visual.
    const config = { fps: 10 };
    if (window.Html5QrcodeSupportedFormats) {
      config.formatsToSupport = [
        window.Html5QrcodeSupportedFormats.QR_CODE,
        window.Html5QrcodeSupportedFormats.EAN_13,
        window.Html5QrcodeSupportedFormats.EAN_8,
        window.Html5QrcodeSupportedFormats.CODE_128,
        window.Html5QrcodeSupportedFormats.CODE_39,
        window.Html5QrcodeSupportedFormats.UPC_A,
        window.Html5QrcodeSupportedFormats.UPC_E,
        window.Html5QrcodeSupportedFormats.ITF,
      ];
    }

    scannerState.html5QrCode = new window.Html5Qrcode('ssScanRegion', { verbose: false });
    scannerState.html5QrCode.start(
      camera.id,
      config,
      onScanSuccess,
      () => { /* per-frame "no code found yet" — expected, ignore */ }
    ).catch((err) => {
      console.warn('Camera start error', err);
      setScanStatus('Could not start the camera. Tap Cancel and try again.');
    });
  }

  function onScanSuccess(decodedText) {
    // `handledOnce` stays true from here until the user taps Save or Retry
    // — this is what stops the old "keeps scanning the same code over and
    // over" behaviour. Decoding only resumes after an explicit choice.
    if (scannerState.handledOnce) return;
    scannerState.handledOnce = true;
    beep();
    if (navigator.vibrate) { try { navigator.vibrate(180); } catch (e) { /* not supported */ } }
    showScanResult(decodedText);
  }

  // Shows the decoded value on the scan screen itself, with a duplicate
  // check against whichever column it would be saved into. Scanning stays
  // paused (see handledOnce above) until Save or Retry is tapped.
  function showScanResult(text) {
    const targetId = scannerState.targetFieldId || resolveScanTargetId();
    const field = targetId ? document.getElementById(targetId) : null;
    const colId = field ? field.dataset.col : null;
    const sheet = window.SheetsStore.getSheet(ST.activeSheetId);
    const dup = isDuplicateScanValue(sheet, colId, text);

    scannerState.pendingText = text;
    scannerState.pendingColId = colId;
    scannerState.pendingIsDup = dup;

    const panel = document.getElementById('ssScanResult');
    const card = document.getElementById('ssScanResultCard');
    const valueEl = document.getElementById('ssScanResultValue');
    const msgEl = document.getElementById('ssScanResultMsg');
    const saveBtn = document.getElementById('ssScanSave');
    const targetBox = document.getElementById('ssScanTargetBox');
    if (!panel || !valueEl) return;

    valueEl.textContent = text;
    if (card) card.classList.toggle('dup', dup);
    if (msgEl) msgEl.textContent = dup
      ? 'This serial no. already exists in the record. Delete the old row first, or Retry with a different code.'
      : 'Scanned successfully.';
    if (saveBtn) saveBtn.style.display = dup ? 'none' : '';

    panel.style.display = 'flex';
    setScanStatus('');
    if (targetBox) targetBox.style.visibility = 'hidden';
  }

  function hideScanResult() {
    const panel = document.getElementById('ssScanResult');
    const targetBox = document.getElementById('ssScanTargetBox');
    if (panel) panel.style.display = 'none';
    if (targetBox) targetBox.style.visibility = '';
    scannerState.pendingText = null;
    scannerState.pendingColId = null;
    scannerState.pendingIsDup = false;
  }

  // "Retry" — discard the paused result and resume live scanning.
  function retryScan() {
    hideScanResult();
    scannerState.handledOnce = false;
    setScanStatus('Place QR & barcode in the box');
  }

  // "Save" — only reachable when the value isn't a duplicate (the button is
  // hidden otherwise). Fills the target field and, for single-field sheets,
  // saves the row immediately; then resumes scanning for the next code.
  function confirmScanSave() {
    if (scannerState.pendingIsDup) return; // guard — should already be hidden
    const text = scannerState.pendingText;
    if (text == null) return;
    const saved = processScanValue(text);
    hideScanResult();
    if (saved) {
      setScanStatus('Saved \u2713 \u2014 scan the next one');
      scannerState.handledOnce = false;
    } else {
      // Multi-column sheet — field is filled, remaining columns still need
      // to be entered by hand, so hand control back to the data-entry form.
      closeScanner();
    }
  }

  function fillTargetField(text, fieldId) {
    const id = fieldId || scannerState.targetFieldId;
    const field = document.getElementById(id);
    if (field) {
      field.value = text;
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.focus();
    } else {
      window.showToast('Scanned: ' + text);
    }
  }

  function toggleTorch() {
    if (!scannerState.html5QrCode) return;
    scannerState.torchOn = !scannerState.torchOn;
    scannerState.html5QrCode.applyVideoConstraints({ advanced: [{ torch: scannerState.torchOn }] })
      .then(() => {
        const btn = document.getElementById('ssScanTorch');
        if (btn) btn.classList.toggle('active', scannerState.torchOn);
      })
      .catch(() => { window.showToast('Flashlight not supported on this device'); scannerState.torchOn = false; });
  }

  function flipCamera() {
    if (!scannerState.cameras.length || scannerState.cameras.length < 2) { window.showToast('Only one camera available'); return; }
    scannerState.cameraIndex = (scannerState.cameraIndex + 1) % scannerState.cameras.length;
    const qr = scannerState.html5QrCode;
    if (qr) qr.stop().then(launchCamera).catch(launchCamera);
    else launchCamera();
  }

  function closeScanner() {
    const qr = scannerState.html5QrCode;
    scannerState.pendingText = null;
    scannerState.pendingColId = null;
    scannerState.pendingIsDup = false;
    const finish = () => {
      if (scannerState.overlayEl) { scannerState.overlayEl.remove(); scannerState.overlayEl = null; }
      document.body.style.overflow = '';
      scannerState.html5QrCode = null;
    };
    if (qr) qr.stop().then(finish).catch(finish);
    else finish();
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1050;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
      osc.onended = () => ctx.close();
    } catch (e) { /* Web Audio not available — silently skip the beep */ }
  }

  // =========================================================================
  // Wiring
  // =========================================================================
  function wire() {
    if (ST.view === 'manual-create') wireManualCreate();
    else if (ST.view === 'data-entry') wireDataEntry();
    else wireList();
  }

  function wireList() {
    document.querySelectorAll('.ss-tab').forEach((btn) => { btn.onclick = () => { ST.tab = btn.dataset.tab; render(); }; });
    const createBtn = document.getElementById('ssCreateBtn');
    if (createBtn) createBtn.onclick = openCreateModal;
    const fab = document.getElementById('ssFab');
    if (fab) fab.onclick = openCreateModal;
    const goPro = document.getElementById('ssGoPro');
    if (goPro) goPro.onclick = () => window.showToast('Go Pro+ — coming soon!');

    document.querySelectorAll('.ss-edit-sheet').forEach((btn) => { btn.onclick = (e) => { e.stopPropagation(); startEditSheet(btn.dataset.id); }; });
    document.querySelectorAll('.ss-view-sheet').forEach((btn) => { btn.onclick = (e) => { e.stopPropagation(); openSheetDataEntry(btn.dataset.id); }; });
    document.querySelectorAll('.ss-menu-sheet').forEach((btn) => { btn.onclick = (e) => { e.stopPropagation(); openSheetCardMenu(btn.dataset.id, btn); }; });
    document.querySelectorAll('.ss-sheet-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.ss-sheet-actions')) return;
        openSheetDataEntry(card.dataset.id);
      });
    });
  }

  function wireManualCreate() {
    document.getElementById('ssBackFromCreate').onclick = backToList;
    document.getElementById('ssSaveSheetTop').onclick = saveDraftSheet;
    document.getElementById('ssCreateSheetBtn').onclick = saveDraftSheet;
    document.getElementById('ssAddCol').onclick = addDraftColumn;
    document.querySelectorAll('.ss-col-del').forEach((btn) => {
      btn.onclick = () => deleteDraftColumn(btn.closest('.ss-col-row').dataset.id);
    });
  }

  function wireDataEntry() {
    document.getElementById('ssBackFromEntry').onclick = () => { ST.view = 'list'; render(); };
    document.getElementById('ssTogglePreview').onclick = () => {
      const p = document.getElementById('ssPreviewPanel');
      if (p) p.classList.toggle('ss-collapsed');
    };
    document.getElementById('ssEntryMenu').onclick = (e) => { e.stopPropagation(); openEntryMenu(document.getElementById('ssEntryMenu')); };
    document.getElementById('ssBtScanner').onclick = toggleBluetoothScanner;
    syncBtButtons();
    if (btState.active) focusScannableField(resolveScanTargetId());
    document.getElementById('ssSaveEntry').onclick = saveCurrentEntry;
    document.getElementById('ssTypeMode').onclick = () => {
      const sheet = window.SheetsStore.getSheet(ST.activeSheetId);
      const firstCol = sheet && sheet.columns.find((c) => c.type !== 'image');
      if (firstCol) { const f = document.getElementById('ssField_' + firstCol.id); if (f) f.focus(); }
    };
    document.getElementById('ssScanMode').onclick = () => openScanner(resolveScanTargetId());

    document.querySelectorAll('.ss-scan-icon-btn').forEach((btn) => {
      btn.onclick = () => { ST.lastBarcodeFieldId = btn.dataset.target; openScanner(btn.dataset.target); };
    });
    // Track focus on any scannable field (Barcode/QR *or* Text) so the
    // central scan button targets whichever field the user was last in.
    document.querySelectorAll('input[data-type="barcode"], input[data-type="text"]').forEach((input) => {
      input.addEventListener('focus', () => { ST.lastBarcodeFieldId = input.id; });
    });
    document.querySelectorAll('input[data-type="image"]').forEach((input) => {
      input.addEventListener('change', () => handleImageFieldChange(input));
    });
    document.querySelectorAll('.ss-del-row').forEach((btn) => { btn.onclick = () => deleteEntryRow(btn.dataset.id); });
  }

  // =========================================================================
  // Page registration
  // =========================================================================
  window.PAGES.scansheet = {
    name: 'Sheets',
    icon: 'fa-qrcode',
    sub: 'Scan barcodes & QR codes straight into a sheet',
    html: `<div id="scanSheetRoot" class="ss-wrap"></div>`,
    init() {
      ST.view = 'list';
      ST.tab = 'sheets';
      ST.activeSheetId = null;
      ST.editingSheetId = null;
      render();
    },
  };
})();
