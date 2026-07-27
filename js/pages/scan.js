// js/pages/scan.js
// ============================================================================
// "Scanner" tab — standalone prototype (see js/scanner-engine.js for the
// reusable camera/USB-HID/beep engine this page is built on top of).
//
// Purpose: prove out camera + USB barcode/QR scanning end-to-end — continuous
// scan, duplicate detection, stats, search/delete/export, and persistence —
// BEFORE wiring the same ScannerEngine into Inventory, BOM, Dispatch,
// Purchase, Sales, Warranty, Installation, Returns, etc. Nothing here talks
// to those modules yet; scanned values only live in this page's own table +
// browser localStorage (no server/database involved, per the prompt).
// ============================================================================
window.PAGES = window.PAGES || {};

window.PAGES.scan = {
  name: 'Scanner',
  icon: 'fa-barcode',
  sub: 'Continuous barcode & QR scanning prototype — camera + USB scanner support',
  html: `
    <div class="page-head"><i class="fa-solid fa-barcode" style="color:var(--gold);"></i><h2>Scanner</h2>
      <button type="button" class="info-btn" data-info="Standalone scanning prototype. Reads QR codes and Code128/Code39/EAN-13/UPC barcodes via camera, or from a USB barcode-gun (keyboard wedge). Nothing here is wired into Inventory/BOM/Purchase/Sales yet — this only proves the scan engine works before that integration."><i class="fa-solid fa-circle-info"></i></button>
      <div class="hint">Prototype only — not yet connected to Inventory, BOM, Dispatch, Purchase, Sales, Warranty, Installation or Returns.</div>
    </div>

    <!-- ================= LIVE STATS ================= -->
    <div class="stat-grid">
      <div class="stat-card assigned">
        <div class="top"><span class="label">Total Scans</span><i class="fa-solid fa-layer-group"></i></div>
        <div class="value" id="scanStatTotal">0</div>
      </div>
      <div class="stat-card available">
        <div class="top"><span class="label">Unique Scans</span><i class="fa-solid fa-circle-check"></i></div>
        <div class="value" id="scanStatUnique">0</div>
      </div>
      <div class="stat-card damaged">
        <div class="top"><span class="label">Duplicate Scans</span><i class="fa-solid fa-copy"></i></div>
        <div class="value" id="scanStatDuplicate">0</div>
      </div>
      <div class="stat-card sold">
        <div class="top"><span class="label">Invalid Scans</span><i class="fa-solid fa-triangle-exclamation"></i></div>
        <div class="value" id="scanStatInvalid">0</div>
      </div>
    </div>

    <!-- ================= NEW FILE (named scan session) ================= -->
    <div class="panel" id="scanFilePanel">
      <h3><i class="fa-solid fa-folder-plus"></i> New File</h3>
      <p class="note" style="margin-top:-6px;"><i class="fa-solid fa-circle-info"></i> Optional: name a file and pick its format BEFORE scanning. Once started, you'll be asked after every scan whether to scan the next item or save this file. Without this, scanning below still works directly (quick scan, no popups).</p>

      <div id="scanFileSetup" class="form-grid cols-2">
        <div class="field"><label>File Name</label><input type="text" id="scanFileName" placeholder="e.g. purchase-batch-1" autocomplete="off"></div>
        <div class="field">
          <label>Save Format</label>
          <select id="scanFileFormat">
            <option value="csv">CSV (.csv)</option>
            <option value="xlsx">Excel (.xlsx)</option>
          </select>
        </div>
        <div class="field span-full">
          <button class="btn btn-gold" type="button" id="scanBtnStartFile"><i class="fa-solid fa-play"></i> Start New File &amp; Begin Scanning</button>
        </div>
      </div>

      <div id="scanFileActive" class="scan-file-active" style="display:none;">
        <div class="scan-file-active-info">
          <i class="fa-solid fa-file-circle-check"></i>
          <span>Active File: <strong id="scanFileActiveName"></strong> &nbsp;•&nbsp; <span id="scanFileActiveCount">0</span> item(s) scanned</span>
        </div>
        <div class="actions-row" style="margin-top:10px;">
          <button class="btn btn-green" type="button" id="scanBtnFinishSave"><i class="fa-solid fa-floppy-disk"></i> Finish &amp; Save Now</button>
          <button class="btn btn-ghost" type="button" id="scanBtnCancelFile"><i class="fa-solid fa-xmark"></i> Cancel File (discard)</button>
        </div>
      </div>
    </div>

    <!-- ================= CAMERA ================= -->
    <div class="panel">
      <h3><i class="fa-solid fa-video"></i> Camera</h3>
      <p class="note" style="margin-top:-6px;"><i class="fa-solid fa-circle-info"></i> Tap Scan to open the camera. The scan area auto-detects the code shape — square for QR, wide for barcodes. Tap the &times; inside to stop.</p>
      <div class="actions-row" style="margin-top:0;">
        <button class="btn btn-green" type="button" id="scanBtnOpen"><i class="fa-solid fa-camera"></i> Scan</button>
      </div>
      <div class="actions-row" style="margin-top:8px;">
        <span class="note" id="scanStatus" style="align-self:center; margin:0;"><i class="fa-solid fa-circle-info"></i> Camera is off.</span>
      </div>
    </div>

    <!-- ================= CAMERA SCANNER OVERLAY ================= -->
    <div class="scanner-overlay" id="scannerOverlay">
      <div class="scanner-overlay-box">
        <div class="scanner-overlay-head">
          <span><i class="fa-solid fa-camera"></i> Scan Barcode / QR</span>
          <button type="button" class="scanner-close-btn" id="scanBtnClose" aria-label="Close scanner"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div id="scanPermissionMsg" class="scan-permission-msg" style="display:none;">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span id="scanPermissionMsgText">Camera permission was denied. Please allow camera access for this site in your browser settings and try again.</span>
        </div>

        <div id="scanReaderWrap" class="scan-reader-wrap">
          <div id="scanReaderBox"></div>
        </div>

        <div id="scanFeedbackBanner" class="scan-feedback-banner" style="display:none;"></div>

        <div class="actions-row scanner-overlay-actions">
          <button class="btn btn-ghost" type="button" id="scanBtnSwitch" disabled><i class="fa-solid fa-camera-rotate"></i> Switch Camera</button>
          <button class="btn btn-ghost" type="button" id="scanBtnFlash" disabled><i class="fa-solid fa-bolt"></i> Flash</button>
        </div>
      </div>
    </div>

    <!-- ================= USB HID SCANNER ================= -->
    <div class="panel">
      <h3><i class="fa-solid fa-keyboard"></i> USB Barcode Scanner</h3>
      <p class="note" style="margin-top:-6px;"><i class="fa-solid fa-circle-info"></i> Plug in a USB/HID barcode gun and click into the box below (it stays focused automatically) — no other setup needed. It scans into the exact same history table as the camera.</p>
      <div class="form-grid cols-2">
        <div class="field span-full">
          <label>USB Scanner Input (keep focused)</label>
          <input type="text" id="scanUsbInput" placeholder="Click here, then scan with your USB barcode gun..." autocomplete="off">
        </div>
      </div>
    </div>

    <!-- ================= SCAN HISTORY ================= -->
    <div class="panel">
      <h3><i class="fa-solid fa-list"></i> Scan History <span style="font-weight:400;color:var(--txt-muted);font-size:11.5px;">(this session, saved in this browser)</span></h3>
      <div class="toolbar">
        <div class="grow"><input type="text" id="scanSearchInput" placeholder="Search scanned data..."></div>
        <button class="btn btn-ghost" type="button" id="scanBtnDeleteLast"><i class="fa-solid fa-rotate-left"></i> Delete Last</button>
        <button class="btn btn-ghost" type="button" id="scanBtnDeleteSelected"><i class="fa-solid fa-trash"></i> Delete Selected</button>
        <button class="btn btn-red" type="button" id="scanBtnClearAll"><i class="fa-solid fa-broom"></i> Clear All</button>
        <button class="btn btn-blue" type="button" id="scanBtnExportCsv"><i class="fa-solid fa-file-csv"></i> Export CSV</button>
        <button class="btn btn-gold" type="button" id="scanBtnExportXlsx"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
      </div>
      <div class="table-wrap" id="scanTableWrap"><table>
        <thead><tr>
          <th style="width:34px;"><input type="checkbox" id="scanSelectAll"></th>
          <th>Sr No</th><th>Barcode/QR Data</th><th>Type</th><th>Scan Time</th><th>Status</th>
        </tr></thead>
        <tbody id="scanHistoryBody">
          <tr><td colspan="6" style="text-align:center; color:var(--txt-muted); font-style:italic;">No scans yet.</td></tr>
        </tbody>
      </table></div>
    </div>
  `,

  init() {
    const $ = (id) => document.getElementById(id);

    // ---------- DOM refs ----------
    const btnOpen = $('scanBtnOpen');
    const btnClose = $('scanBtnClose');
    const overlay = $('scannerOverlay');
    const btnSwitch = $('scanBtnSwitch');
    const btnFlash = $('scanBtnFlash');
    const statusEl = $('scanStatus');
    const permMsg = $('scanPermissionMsg');
    const permMsgText = $('scanPermissionMsgText');
    const readerWrap = $('scanReaderWrap');
    const readerBox = $('scanReaderBox');
    const feedbackBanner = $('scanFeedbackBanner');
    if (!btnOpen || !btnClose || !overlay || !readerBox) {
      console.error('Scanner: one or more required elements are missing from the page HTML', {
        btnOpen, btnClose, overlay, readerBox,
      });
    }
    const usbInput = $('scanUsbInput');
    const historyBody = $('scanHistoryBody');
    const tableWrap = $('scanTableWrap');
    const searchInput = $('scanSearchInput');
    const selectAllCb = $('scanSelectAll');
    const btnDeleteLast = $('scanBtnDeleteLast');
    const btnDeleteSelected = $('scanBtnDeleteSelected');
    const btnClearAll = $('scanBtnClearAll');
    const btnExportCsv = $('scanBtnExportCsv');
    const btnExportXlsx = $('scanBtnExportXlsx');
    const statTotal = $('scanStatTotal');
    const statUnique = $('scanStatUnique');
    const statDuplicate = $('scanStatDuplicate');
    const statInvalid = $('scanStatInvalid');

    // New File (named scan session) refs
    const scanFileSetup = $('scanFileSetup');
    const scanFileActive = $('scanFileActive');
    const scanFileNameInput = $('scanFileName');
    const scanFileFormatSelect = $('scanFileFormat');
    const btnStartFile = $('scanBtnStartFile');
    const btnFinishSave = $('scanBtnFinishSave');
    const btnCancelFile = $('scanBtnCancelFile');
    const scanFileActiveName = $('scanFileActiveName');
    const scanFileActiveCount = $('scanFileActiveCount');

    // ---------- Persistence (localStorage — no server/DB for this prototype) ----------
    const STORAGE_KEY = 'egs_scanner_history_v1';

    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.entries)) {
            return {
              entries: parsed.entries,
              totalScans: parsed.totalScans || parsed.entries.length,
              duplicateScans: parsed.duplicateScans || 0,
              invalidScans: parsed.invalidScans || 0,
              nextId: parsed.nextId || (parsed.entries.length + 1),
            };
          }
        }
      } catch (e) { /* corrupt/unavailable storage — start fresh */ }
      return { entries: [], totalScans: 0, duplicateScans: 0, invalidScans: 0, nextId: 1 };
    }

    const state = loadState();
    const valueSet = new Set(state.entries.map((e) => e.value));

    function persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) { /* storage full/unavailable — history just won't survive a refresh */ }
    }

    // ---------- Helpers ----------
    function escHtml(s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function sanitizeFileName(name) {
      const base = String(name || '').trim().replace(/\.(csv|xlsx)$/i, '');
      const cleaned = base.replace(/[\\/:*?"<>|]+/g, '-').trim();
      return cleaned || 'scan-file';
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function csvEscape(v) {
      const s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }

    // Shared by the main toolbar's Export CSV/Excel buttons AND the New
    // File flow's "Save" (popup or Finish & Save Now) — same output shape,
    // just a different slice of entries + a custom filename either way.
    function exportEntries(entriesToExport, format, baseName) {
      if (!entriesToExport.length) { window.showToast && window.showToast('Nothing to export yet.'); return false; }
      const safeName = sanitizeFileName(baseName);
      if (format === 'xlsx') {
        if (typeof XLSX === 'undefined') {
          window.showToast && window.showToast('Excel export library failed to load. Check your internet connection.');
          return false;
        }
        const rows = entriesToExport.map((e, i) => ({
          'Sr No': i + 1,
          'Barcode/QR Data': e.value,
          'Type': e.type,
          'Scan Time': e.time,
          'Status': e.status,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Scan History');
        XLSX.writeFile(wb, `${safeName}.xlsx`);
      } else {
        const rows = [['Sr No', 'Barcode/QR Data', 'Type', 'Scan Time', 'Status']];
        entriesToExport.forEach((e, i) => rows.push([i + 1, e.value, e.type, e.time, e.status]));
        const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${safeName}.csv`);
      }
      return true;
    }

    // ---------- New File (named scan session) ----------
    // Entirely optional layer on top of normal scanning: if no file is
    // active, scans behave exactly as before (direct/quick — no popups).
    // Once a file is started, every NEW valid scan also gets pushed into
    // activeFile.entries and, right after, the person is asked (via the
    // same confirmDialog used everywhere else in this app) whether to scan
    // the next item or save & finish this file now.
    let activeFile = null; // { name, format, entries: [] }
    let awaitingFileDecision = false; // pauses new scans while the popup is open

    function updateFileUi() {
      if (activeFile) {
        scanFileSetup.style.display = 'none';
        scanFileActive.style.display = '';
        scanFileActiveName.textContent = `${activeFile.name}.${activeFile.format}`;
        scanFileActiveCount.textContent = activeFile.entries.length;
      } else {
        scanFileSetup.style.display = '';
        scanFileActive.style.display = 'none';
      }
    }

    btnStartFile.addEventListener('click', () => {
      const name = sanitizeFileName(scanFileNameInput.value);
      activeFile = { name, format: scanFileFormatSelect.value, entries: [] };
      updateFileUi();
      window.showToast && window.showToast(`New file "${name}.${activeFile.format}" started — scan away!`);
      if (!engine.isRunning) openScanner();
      usbInput.focus();
    });

    btnCancelFile.addEventListener('click', async () => {
      const ok = await window.confirmDialog('Cancel File', `Discard "${activeFile.name}.${activeFile.format}" without saving? The ${activeFile.entries.length} scan(s) already made will stay in the main Scan History table below — only the file itself is cancelled.`, { kind: 'warning', okLabel: 'Discard File', cancelLabel: 'Keep Scanning' });
      if (!ok) return;
      activeFile = null;
      awaitingFileDecision = false;
      updateFileUi();
    });

    btnFinishSave.addEventListener('click', () => finishAndSaveFile());

    function finishAndSaveFile() {
      if (!activeFile) return;
      const saved = exportEntries(activeFile.entries, activeFile.format, activeFile.name);
      if (saved) window.showToast && window.showToast(`Saved "${activeFile.name}.${activeFile.format}"`);
      activeFile = null;
      awaitingFileDecision = false;
      updateFileUi();
    }

    // Shown after every new valid scan WHILE a file is active — the actual
    // "scan next vs save file" popup the person asked for.
    async function askContinueOrSave(entry) {
      awaitingFileDecision = true;
      const ok = await window.confirmDialog(
        'Scan Added',
        `"${entry.value}" (${entry.type}) added — ${activeFile.entries.length} item(s) in "${activeFile.name}.${activeFile.format}" so far. Scan the next item, or save this file now?`,
        { kind: 'question', okLabel: 'Save File Now', cancelLabel: 'Scan Next' }
      );
      if (ok) {
        finishAndSaveFile();
      } else {
        awaitingFileDecision = false;
        usbInput.focus();
      }
    }

    function showBanner(kind, text) {
      const colorVar = kind === 'duplicate' ? 'var(--gold)' : kind === 'error' ? 'var(--red)' : 'var(--green)';
      const icon = kind === 'duplicate' ? 'fa-copy' : kind === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-check';
      feedbackBanner.style.borderColor = colorVar;
      feedbackBanner.style.color = colorVar;
      feedbackBanner.innerHTML = `<i class="fa-solid ${icon}"></i> ${escHtml(text)}`;
      feedbackBanner.style.display = 'flex';
      clearTimeout(showBanner._t);
      showBanner._t = setTimeout(() => { feedbackBanner.style.display = 'none'; }, 3000);
    }

    // ---------- Stats + table rendering ----------
    function renderStats() {
      statTotal.textContent = state.totalScans;
      statUnique.textContent = state.entries.length;
      statDuplicate.textContent = state.duplicateScans;
      statInvalid.textContent = state.invalidScans;
    }

    function rowHtml(entry, sr) {
      return `
        <tr data-id="${entry.id}">
          <td><input type="checkbox" class="scanRowCb" data-id="${entry.id}"></td>
          <td>${sr}</td>
          <td style="word-break:break-all;">${escHtml(entry.value)}</td>
          <td>${escHtml(entry.type || 'Unknown')}</td>
          <td style="white-space:nowrap;">${escHtml(entry.time)}</td>
          <td><span class="pill available">${escHtml(entry.status || 'Valid')}</span></td>
        </tr>`;
    }

    function renderTable() {
      if (!state.entries.length) {
        historyBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--txt-muted); font-style:italic;">No scans yet.</td></tr>';
        selectAllCb.checked = false;
        return;
      }
      historyBody.innerHTML = state.entries.map((e, i) => rowHtml(e, i + 1)).join('');
      selectAllCb.checked = false;
      // Keep the newest row in view (scanning is a live/continuous action).
      tableWrap.scrollTop = tableWrap.scrollHeight;
      applySearchFilter();
    }

    function applySearchFilter() {
      const q = (searchInput.value || '').trim().toLowerCase();
      historyBody.querySelectorAll('tr').forEach((row) => {
        if (!row.dataset.id) return; // "No scans yet" placeholder row
        row.style.display = !q || row.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    }

    // ---------- Core: single entry point for BOTH camera and USB scans ----------
    // This is deliberately the ONLY place that touches state.entries, so the
    // exact same duplicate/invalid/stats rules apply no matter which input
    // path (camera or USB-HID) produced the value — and it's the one
    // function a future Inventory/BOM/etc. integration would call into.
    function handleScannedValue(rawValue, formatName, source) {
      // While the "scan next vs save file" popup is open, ignore anything
      // else coming in from the camera or USB gun until the person answers.
      if (awaitingFileDecision) return;

      const value = String(rawValue == null ? '' : rawValue).trim();

      if (!value) {
        state.totalScans += 1;
        state.invalidScans += 1;
        persist();
        renderStats();
        ScannerEngine.beep('error');
        showBanner('error', 'Unable to decode barcode. Please scan again.');
        return;
      }

      state.totalScans += 1;

      if (valueSet.has(value)) {
        state.duplicateScans += 1;
        persist();
        renderStats();
        ScannerEngine.beep('duplicate');
        showBanner('duplicate', `Duplicate scan: "${value}" was already scanned. Not added again.`);
        return; // req #7 — duplicates are NOT added to the table
      }

      const entry = {
        id: state.nextId++,
        value,
        type: formatName || 'Unknown',
        time: new Date().toLocaleString(),
        status: 'Valid',
        source: source || 'camera',
      };
      state.entries.push(entry);
      valueSet.add(value);
      persist();
      renderStats();
      renderTable();
      ScannerEngine.beep('success');

      if (activeFile) {
        activeFile.entries.push(entry);
        updateFileUi();
        askContinueOrSave(entry); // fire-and-forget: pauses further scans itself via awaitingFileDecision
      }
    }

    // ---------- Camera engine ----------
    if (!ScannerEngine.isLibraryLoaded()) {
      statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--red);"></i> Scanner library failed to load. Check your internet connection and reload the page.';
      btnOpen.disabled = true;
    }

    const engine = new ScannerEngine({
      onDecode: (text, formatName) => handleScannedValue(text, formatName, 'camera'),
    });

    function setCameraButtonsUi() {
      btnSwitch.disabled = !engine.isRunning;
      btnFlash.disabled = !engine.isRunning;
    }

    // ---------- Scanner overlay (Scan button opens it, × inside closes it) ----------
    function showOverlay() {
      overlay.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    function hideOverlay() {
      overlay.classList.remove('show');
      document.body.style.overflow = '';
    }

    let watchdogTimer = null;

    async function startCamera() {
      permMsg.style.display = 'none';
      statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Requesting camera access...';

      // Camera access needs a secure context (https:// or localhost) and
      // navigator.mediaDevices — if either is missing, html5-qrcode may
      // throw in a way that isn't a normal getUserMedia rejection, so we
      // check for it ourselves and always show a clear message either way.
      if (!window.isSecureContext) {
        permMsgText.textContent = 'Camera needs a secure connection (https://). This page is not loaded over https, so the browser is blocking camera access.';
        permMsg.style.display = '';
        statusEl.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color:var(--red);"></i> Camera is off.';
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        permMsgText.textContent = 'This browser does not support camera access (navigator.mediaDevices is unavailable).';
        permMsg.style.display = '';
        statusEl.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color:var(--red);"></i> Camera is off.';
        return;
      }

      try {
        await engine.start('scanReaderBox', { facingMode: engine.currentFacingMode });
        setCameraButtonsUi();
        statusEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--green);"></i> Scanning continuously — point the camera at a QR code or barcode.';
        watchdogTimer = setInterval(() => {
          if (!document.body.contains(readerBox)) stopCamera();
        }, 2000);
      } catch (err) {
        console.error('Scanner: camera start failed', err);
        setCameraButtonsUi();
        const msg = String((err && (err.message || err)) || '').toLowerCase();
        if (msg.indexOf('permission') !== -1 || msg.indexOf('notallowed') !== -1 || msg.indexOf('denied') !== -1) {
          permMsgText.textContent = 'Camera permission was denied. Please allow camera access for this site in your browser settings (click the lock/camera icon in the address bar) and try again.';
        } else if (msg.indexOf('notfound') !== -1 || msg.indexOf('no camera') !== -1) {
          permMsgText.textContent = 'No camera was found on this device.';
        } else if (msg.indexOf('notreadable') !== -1 || msg.indexOf('trackstart') !== -1) {
          permMsgText.textContent = 'The camera is already in use by another app/tab. Close it there and try again.';
        } else {
          permMsgText.textContent = `Could not start the camera (${(err && err.message) || err || 'unknown error'}). Check camera permissions and try again.`;
        }
        permMsg.style.display = '';
        statusEl.innerHTML = '<i class="fa-solid fa-circle-xmark" style="color:var(--red);"></i> Camera is off.';
      }
    }

    async function stopCamera() {
      if (watchdogTimer) { clearInterval(watchdogTimer); watchdogTimer = null; }
      await engine.stop();
      setCameraButtonsUi();
      btnFlash.innerHTML = '<i class="fa-solid fa-bolt"></i> Flash';
      hideOverlay();
      statusEl.innerHTML = '<i class="fa-solid fa-circle-info"></i> Camera is off.';
    }

    // Opens the overlay, THEN requests the camera — both happen
    // synchronously (no requestAnimationFrame delay) so the getUserMedia
    // call stays tied to this click's user-gesture in stricter browsers.
    // Wrapped in try/catch so a missing element or unexpected error is
    // never silent — it always shows up as a toast + console error.
    function openScanner() {
      try {
        showOverlay();
        startCamera();
      } catch (err) {
        console.error('Scanner: could not open scanner overlay', err);
        window.showToast && window.showToast('Could not open the scanner. Check the browser console (F12) for details.');
      }
    }

    btnOpen.addEventListener('click', openScanner);
    btnClose.addEventListener('click', stopCamera);


    btnSwitch.addEventListener('click', async () => {
      btnSwitch.disabled = true;
      try {
        await engine.switchCamera();
        statusEl.innerHTML = `<i class="fa-solid fa-circle-check" style="color:var(--green);"></i> Switched to ${engine.currentFacingMode === 'user' ? 'front' : 'rear'} camera.`;
      } catch (e) {
        window.showToast && window.showToast('Could not switch camera on this device.');
      }
      setCameraButtonsUi();
    });

    btnFlash.addEventListener('click', async () => {
      const result = await engine.toggleFlash();
      if (!result.supported) {
        window.showToast && window.showToast('Flash/torch is not supported on this device or browser.');
        return;
      }
      btnFlash.innerHTML = result.on
        ? '<i class="fa-solid fa-bolt"></i> Flash On'
        : '<i class="fa-solid fa-bolt"></i> Flash';
    });

    // ---------- USB HID scanner ----------
    // Auto-focus the moment the tab opens, and re-focus on any click inside
    // this page that isn't itself another text field/button — so a plugged
    // in USB scanner "just works" without extra clicks, per req #16.
    usbInput.focus();
    const detachUsb = ScannerEngine.attachUsbHid(usbInput, (value) => handleScannedValue(value, 'USB-HID', 'usb'));
    function refocusUsbInput(e) {
      if (!document.body.contains(usbInput)) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'SELECT' || e.target.closest('button')) return;
      usbInput.focus();
    }
    document.getElementById('content').addEventListener('click', refocusUsbInput);

    // ---------- Table toolbar ----------
    searchInput.addEventListener('input', applySearchFilter);

    selectAllCb.addEventListener('change', () => {
      historyBody.querySelectorAll('.scanRowCb').forEach((cb) => {
        if (cb.closest('tr').style.display !== 'none') cb.checked = selectAllCb.checked;
      });
    });

    btnDeleteLast.addEventListener('click', () => {
      if (!state.entries.length) return;
      const removed = state.entries.pop();
      valueSet.delete(removed.value);
      persist();
      renderStats();
      renderTable();
      window.showToast && window.showToast('Last scan deleted.');
    });

    btnDeleteSelected.addEventListener('click', async () => {
      const ids = Array.from(historyBody.querySelectorAll('.scanRowCb:checked')).map((cb) => Number(cb.dataset.id));
      if (!ids.length) { window.showToast && window.showToast('No rows selected.'); return; }
      const ok = await window.confirmDialog('Delete Selected', `Delete ${ids.length} selected scan(s)? This cannot be undone.`, { kind: 'danger', okLabel: 'Delete' });
      if (!ok) return;
      const idSet = new Set(ids);
      state.entries = state.entries.filter((e) => {
        if (idSet.has(e.id)) { valueSet.delete(e.value); return false; }
        return true;
      });
      persist();
      renderStats();
      renderTable();
    });

    btnClearAll.addEventListener('click', async () => {
      if (!state.entries.length) { window.showToast && window.showToast('History is already empty.'); return; }
      const ok = await window.confirmDialog('Clear All Scans', 'This will permanently delete the entire scan history from this browser. Continue?', { kind: 'danger', okLabel: 'Clear All' });
      if (!ok) return;
      state.entries = [];
      state.totalScans = 0;
      state.duplicateScans = 0;
      state.invalidScans = 0;
      state.nextId = 1;
      valueSet.clear();
      persist();
      renderStats();
      renderTable();
    });

    // ---------- Export (main toolbar — always exports the FULL history) ----------
    btnExportCsv.addEventListener('click', () => {
      exportEntries(state.entries, 'csv', `scan-history-${Date.now()}`);
    });

    btnExportXlsx.addEventListener('click', () => {
      exportEntries(state.entries, 'xlsx', `scan-history-${Date.now()}`);
    });

    // ---------- Teardown when navigating away ----------
    // app.js has no page-teardown hook, so — same pattern as the watchdog
    // above — poll for this page's own root element leaving the DOM and
    // release the camera + USB listener at that point.
    const teardownWatch = setInterval(() => {
      if (!document.body.contains(usbInput)) {
        clearInterval(teardownWatch);
        detachUsb();
        if (engine.isRunning) engine.stop();
        if (watchdogTimer) clearInterval(watchdogTimer);
      }
    }, 1500);

    // ---------- Initial paint ----------
    renderStats();
    renderTable();
    updateFileUi();
  },
};
