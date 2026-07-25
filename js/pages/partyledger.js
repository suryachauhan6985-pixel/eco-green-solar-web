// js/pages/partyledger.js
// Mirrors the desktop app's ui/party_ledger.py page exactly, backed by the
// real MariaDB `ledgers` + `stock_ledger` tables (same DB the desktop app
// uses) instead of the earlier hardcoded preview data:
//   - Left panel: "Party Ledger Control" (Create Ledger / Refresh / Import / Template)
//   - Right panel: search + type filter toolbar, party directory list
//     (registered ledgers + unregistered legacy names merged, same as
//     reload_party_list()), selected-party action row (Edit Ledger / Open
//     Statement / Delete Ledger), inline Inward/Outward/Net-Balance summary
//   - "Ledger Account Statement" modal: profile card + summary cards +
//     Month -> Date -> Voucher -> Serial No. drill-down table (exactly like
//     PartyStatementDialog in the desktop app)
//   - "Create / Edit Ledger" modal: same fields as LedgerFormDialog
//
// Only SuperAdmin can create/edit/delete ledgers or import from Excel —
// same role gate as the desktop app (current_role == "SuperAdmin").
window.PAGES = window.PAGES || {};

window.PAGES.partyledger = {
  name: 'Party Ledger',
  icon: 'fa-address-book',
  sub: 'Party master, transaction statement & register-driven edit access',
  html: `
    <div class="page-head"><i class="fa-solid fa-address-book" style="color:var(--purple);"></i><h2>Party Ledger</h2></div>

    <div class="pl-grid">
      <!-- LEFT: Party Ledger Control -->
      <div class="pl-left">
        <h3><i class="fa-solid fa-address-book"></i> Party Ledger Control</h3>
        <div class="pl-sub">Party master, transaction statement, and register-driven edit access</div>

        <button class="btn btn-green" id="btnCreateLedger"><i class="fa-solid fa-plus"></i>&nbsp; Create New Ledger</button>
        <button class="btn btn-ghost" id="btnRefreshParties"><i class="fa-solid fa-sync"></i> Refresh List</button>
        <button class="btn btn-ghost" id="btnImportLedgers" style="background:#1F7A4D;"><i class="fa-solid fa-file-import"></i> Import Ledgers from Excel</button>
        <button class="btn btn-ghost" id="btnDownloadTemplate" style="background:#4B6584;"><i class="fa-solid fa-download"></i> Download Excel Template</button>
        <input type="file" id="plImportFile" accept=".csv,.xlsx,.xls" style="display:none;">
      </div>

      <!-- RIGHT: Ledgers Directory -->
      <div class="pl-right">
        <h3>Registered &amp; Transaction Ledgers Directory
          <span style="color:var(--txt-muted); font-weight:600; font-size:11px;">(tap to select &middot; double-tap or "Open Statement" to view)</span>
        </h3>

        <div class="pl-toolbar">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input id="plSearch" placeholder="Search Supplier/Customer name...">
          <label style="color:var(--txt-label); font-size:12px; font-weight:700; white-space:nowrap;">Type:</label>
          <select id="plTypeFilter">
            <option>All Parties</option>
            <option>Suppliers Only</option>
            <option>Customers Only</option>
          </select>
        </div>

        <ul class="party-list" id="partyList"></ul>

        <div class="pl-header-row">
          <div class="p-title" id="plHeaderTitle">Select a Party from the list to view details</div>
          <button class="btn btn-blue" id="btnEditLedger" style="display:none; padding:7px 12px; font-size:12px;"><i class="fa-solid fa-pen"></i> Edit Ledger</button>
          <button class="btn btn-gold" id="btnRegisterLedger" style="display:none; padding:7px 12px; font-size:12px;"><i class="fa-solid fa-user-plus"></i> Register Ledger</button>
          <button class="btn btn-green" id="btnOpenStatement" style="display:none; padding:7px 12px; font-size:12px;"><i class="fa-solid fa-up-right-from-square"></i> Open Statement</button>
          <button class="btn btn-red" id="btnDeleteLedger" style="display:none; padding:7px 12px; font-size:12px;"><i class="fa-solid fa-trash"></i> Delete Ledger</button>
        </div>

        <div class="mini-stat-grid" id="plSummaryGrid" style="display:none;">
          <div class="mini-stat in"><div class="m-label">Inward</div><div class="m-val" id="plSumIn">0</div></div>
          <div class="mini-stat out"><div class="m-label">Outward</div><div class="m-val" id="plSumOut">0</div></div>
          <div class="mini-stat bal"><div class="m-label">Net Balance</div><div class="m-val" id="plSumBal">0</div></div>
        </div>

        <div class="pl-empty-hint" id="plEmptyHint">No party selected yet — click any party above to see its inward/outward summary.</div>
      </div>
    </div>

    <!-- Create / Edit Ledger Modal -->
    <div class="modal-overlay modal-fullscreen" id="ledgerFormOverlay">
      <div class="modal-box modal-md" onclick="event.stopPropagation()">
        <div class="modal-head">
          <h3 id="ledgerFormTitle"><i class="fa-solid fa-address-book"></i>&nbsp; Create New Ledger</h3>
          <button class="modal-close" id="closeLedgerForm"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body">
          <div class="form-grid" style="grid-template-columns:1fr;">
            <div class="field">
              <label>Create Ledger For</label>
              <select id="lfMode"><option>Customer</option><option>Supplier</option></select>
            </div>
            <div class="field">
              <label>Ledger Name <span class="req">*</span></label>
              <input id="lfName" placeholder="Full ledger / party name">
            </div>
            <div class="field">
              <label id="lfShortLabel">Short Name:</label>
              <input id="lfShort" placeholder="Short keyword e.g. RAJ, ABC" style="color:var(--gold); font-weight:700;">
            </div>
            <div class="field">
              <label>Mobile No.</label>
              <input id="lfMobile" placeholder="Enter 10-digit mobile number">
            </div>
            <div class="field">
              <label>Address</label>
              <input id="lfAddress" placeholder="Enter address / city">
            </div>
            <div class="field" id="lfGstinField">
              <label>GSTIN</label>
              <input id="lfGstin" placeholder="Enter GSTIN (if applicable)">
            </div>
          </div>
          <div class="actions-row">
            <button class="btn btn-ghost" id="lfCancel">Cancel</button>
            <button class="btn btn-green" id="lfSave"><i class="fa-solid fa-check"></i> Save Ledger</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Ledger Account Statement Modal (drill-down) -->
    <div class="modal-overlay modal-fullscreen" id="statementOverlay">
      <div class="modal-box modal-lg" onclick="event.stopPropagation()">
        <div class="modal-head">
          <h3 id="stmtTitle"><i class="fa-solid fa-file-invoice-dollar"></i> Ledger Account Statement</h3>
          <button class="modal-close" id="closeStatement"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body">
          <div class="stmt-head">
            <div class="stmt-actions">
              <button class="btn btn-green" id="btnExportStatement" style="padding:7px 12px; font-size:12px;"><i class="fa-solid fa-file-excel"></i> Export Statement</button>
            </div>
          </div>

          <div id="stmtProfile"></div>

          <div class="mini-stat-grid">
            <div class="mini-stat in"><div class="m-label">Total Inward Entries</div><div class="m-val" id="stmtIn">0</div></div>
            <div class="mini-stat out"><div class="m-label">Total Outward Entries</div><div class="m-val" id="stmtOut">0</div></div>
            <div class="mini-stat bal"><div class="m-label">Closing Balance (Net Stock)</div><div class="m-val" id="stmtBal">0</div></div>
          </div>

          <div class="stmt-nav">
            <button class="btn btn-ghost" id="stmtBack" style="display:none; padding:6px 12px; font-size:12px;"><i class="fa-solid fa-arrow-left"></i> Back</button>
            <div class="breadcrumb" id="stmtBreadcrumb">📅 All Months</div>
            <div class="hint" id="stmtHint">Click a row to open ▸</div>
          </div>

          <!-- Voucher Attachments — one shared panel per voucher (Ref/Invoice
               No), instead of repeating the same "Open" button on every
               serial-number row below. Only shown once a specific voucher is
               drilled into (see updateAttachmentsPanel()). -->
          <div class="stmt-attachments" id="stmtAttachments" style="display:none;">
            <div class="stmt-attachments-head">
              <span><i class="fa-solid fa-paperclip"></i> Attachments for this voucher</span>
              <label class="btn btn-ghost stmt-attach-add" id="stmtAttachAddBtn" style="padding:4px 10px; font-size:11px;">
                <i class="fa-solid fa-plus"></i> Add
                <input type="file" id="stmtAttachAddInput" multiple style="display:none;" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx">
              </label>
            </div>
            <div class="stmt-attachments-list" id="stmtAttachmentsList"></div>
          </div>

          <div class="table-wrap">
            <table id="stmtTable">
              <thead id="stmtThead"></thead>
              <tbody id="stmtTbody"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,

  init() {
    const API_BASE = window.API_BASE || 'http://192.168.0.123:5000/api';
    const currentRole = window.currentUserRole || 'SuperAdmin';
    const isAdmin = currentRole === 'SuperAdmin' || currentRole === 'Admin';

    let directory = [];   // [{ displayName, partyName, shortName, type, ledgerId, mobile, address, gstin }]
    let selected = null;  // one entry from `directory`
    let selectedRows = []; // flat statement rows for the currently selected party (cached)

    const listEl = document.getElementById('partyList');
    const searchEl = document.getElementById('plSearch');
    const typeEl = document.getElementById('plTypeFilter');

    // ---------------- Directory (list) ----------------
    async function loadDirectory() {
      listEl.innerHTML = `<li class="pl-empty-hint">Loading parties…</li>`;
      try {
        const params = new URLSearchParams({
          search: searchEl.value.trim(),
          type: typeEl.value,
        });
        const res = await fetch(`${API_BASE}/ledgers/directory?${params.toString()}`);
        if (!res.ok) throw new Error('Could not load party directory.');
        directory = await res.json();
        renderList();
      } catch (err) {
        listEl.innerHTML = `<li class="pl-empty-hint">${err.message}</li>`;
      }
    }

    function renderList() {
      listEl.innerHTML = '';
      if (!directory.length) {
        listEl.innerHTML = `<li class="pl-empty-hint">No parties match this search/filter.</li>`;
        return;
      }
      directory.forEach((p) => {
        const li = document.createElement('li');
        li.className = 'party-item' + (!p.ledgerId ? ' unregistered' : '') + (selected && selected.partyName === p.partyName ? ' selected' : '');
        const icon = p.type === 'Both' ? 'fa-arrows-rotate' : p.type === 'Supplier' ? 'fa-truck-ramp-box' : 'fa-hand-holding-dollar';
        const tagClass = p.type === 'Both' ? 'both' : p.type.toLowerCase();
        li.innerHTML = `
          <i class="fa-solid ${icon}"></i>
          <span class="p-name">${p.displayName}</span>
          <span class="p-tag ${tagClass}">${p.type}</span>
          ${!p.ledgerId ? '<span class="p-badge-unreg">(unregistered)</span>' : ''}
        `;
        li.addEventListener('click', () => selectParty(p));
        li.addEventListener('dblclick', () => { selectParty(p).then(openStatement); });
        listEl.appendChild(li);
      });
    }

    async function selectParty(p) {
      selected = p;
      selectedRows = [];
      renderList();
      document.getElementById('plHeaderTitle').textContent =
        `${p.partyName}${p.shortName ? ' / ' + p.shortName : ''}  (${p.type} Ledger Selected)`;
      document.getElementById('btnEditLedger').style.display = p.ledgerId ? 'inline-flex' : 'none';
      document.getElementById('btnDeleteLedger').style.display = p.ledgerId ? 'inline-flex' : 'none';
      // Unregistered parties (legacy names sourced only from stock_ledger
      // transactions, no row in the `ledgers` table) have nothing to edit
      // or delete — same as the desktop app (has_registered_ledger gate).
      // Instead offer "Register Ledger": opens the same Create-Ledger form
      // pre-filled with this name/type, so SuperAdmin can properly create
      // it as a real ledger in one click (once created, it automatically
      // replaces the legacy "(unregistered)" entry in this list).
      document.getElementById('btnRegisterLedger').style.display = !p.ledgerId ? 'inline-flex' : 'none';
      document.getElementById('btnOpenStatement').style.display = 'inline-flex';
      document.getElementById('plEmptyHint').style.display = 'none';
      document.getElementById('plSummaryGrid').style.display = 'grid';
      document.getElementById('plSumIn').textContent = '…';
      document.getElementById('plSumOut').textContent = '…';
      document.getElementById('plSumBal').textContent = '…';

      try {
        selectedRows = await fetchStatementRows(p.partyName, p.type);
        const inCount = selectedRows.filter((r) => r.movement === 'IN').length;
        const outCount = selectedRows.filter((r) => r.movement === 'OUT').length;
        document.getElementById('plSumIn').textContent = inCount;
        document.getElementById('plSumOut').textContent = outCount;
        document.getElementById('plSumBal').textContent = inCount - outCount;
      } catch (err) {
        document.getElementById('plSumIn').textContent = '0';
        document.getElementById('plSumOut').textContent = '0';
        document.getElementById('plSumBal').textContent = '0';
      }
      return p;
    }

    async function fetchStatementRows(partyName, type) {
      const params = new URLSearchParams({ name: partyName, type });
      const res = await fetch(`${API_BASE}/ledgers/statement?${params.toString()}`);
      if (!res.ok) throw new Error('Could not load transactions for this party.');
      const data = await res.json();
      return data.rows || [];
    }

    let searchDebounce = null;
    searchEl.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(loadDirectory, 250);
    });
    typeEl.addEventListener('change', loadDirectory);
    document.getElementById('btnRefreshParties').addEventListener('click', () => {
      loadDirectory();
      if (window.showToast) window.showToast('Party list refreshed.');
    });
    document.getElementById('btnOpenStatement').addEventListener('click', openStatement);

    // Import / Template — SuperAdmin only, same as the desktop app's
    // btn_import_ledgers / btn_download_template.
    const importInput = document.getElementById('plImportFile');
    document.getElementById('btnImportLedgers').addEventListener('click', () => {
      if (!isAdmin) { window.openModal('Access Denied', '<p>Only SuperAdmin can import ledgers.</p>'); return; }
      importInput.click();
    });
    importInput.addEventListener('change', handleImportFile);
    document.getElementById('btnDownloadTemplate').addEventListener('click', downloadTemplate);

    loadDirectory();

    // ---------------- Create / Edit Ledger modal ----------------
    const lfOverlay = document.getElementById('ledgerFormOverlay');
    const lfMode = document.getElementById('lfMode');
    const lfShortInput = document.getElementById('lfShort');
    const lfGstinField = document.getElementById('lfGstinField');
    const lfGstinInput = document.getElementById('lfGstin');
    let editingLedgerId = null;

    function updateLedgerFormMode() {
      const isCustomer = lfMode.value === 'Customer';
      lfShortInput.placeholder = isCustomer ? 'Enter order no. / short alias' : 'Enter supplier short name';
      lfGstinField.style.display = isCustomer ? 'none' : 'flex';
      if (isCustomer) lfGstinInput.value = '';
    }
    lfMode.addEventListener('change', updateLedgerFormMode);

    // Locks/unlocks background page scroll while a fullscreen modal is open.
    function lockPageScroll() { document.body.classList.add('no-scroll'); }
    function unlockPageScroll() { document.body.classList.remove('no-scroll'); }

    let lfEscHandler = null;
    function attachLedgerFormEscape() {
      lfEscHandler = (e) => { if (e.key === 'Escape') closeLedgerForm(); };
      document.addEventListener('keydown', lfEscHandler);
    }
    function detachLedgerFormEscape() {
      if (lfEscHandler) { document.removeEventListener('keydown', lfEscHandler); lfEscHandler = null; }
    }

    function openLedgerForm(editing) {
      editingLedgerId = editing ? editing.ledgerId : null;
      document.getElementById('lfName').value = editing ? editing.partyName : '';
      document.getElementById('lfShort').value = editing ? (editing.shortName || '') : '';
      document.getElementById('lfMobile').value = editing && editing.mobile !== '-' ? editing.mobile || '' : '';
      document.getElementById('lfAddress').value = editing && editing.address !== '-' ? editing.address || '' : '';
      lfGstinInput.value = editing && editing.gstin !== '-' ? editing.gstin || '' : '';
      lfMode.value = editing && ['Customer', 'Supplier'].includes(editing.type) ? editing.type : 'Customer';
      updateLedgerFormMode();
      // "editing" is truthy both for a real Edit (has ledgerId) and for a
      // Register (pre-filling an unregistered party's name into a fresh
      // Create form) — only the former is really "editing" an existing row.
      const isRealEdit = !!(editing && editing.ledgerId);
      document.getElementById('ledgerFormTitle').innerHTML =
        `<i class="fa-solid fa-address-book"></i>&nbsp; ${isRealEdit ? 'Edit Ledger' : editing ? 'Register Ledger' : 'Create New Ledger'}`;
      lfOverlay.classList.add('show');
      lockPageScroll();
      attachLedgerFormEscape();
      document.getElementById('lfName').focus();
    }
    function closeLedgerForm() {
      lfOverlay.classList.remove('show');
      unlockPageScroll();
      detachLedgerFormEscape();
    }

    document.getElementById('btnCreateLedger').addEventListener('click', () => {
      if (!isAdmin) { window.openModal('Access Denied', '<p>Only SuperAdmin can create ledgers.</p>'); return; }
      openLedgerForm(null);
    });
    document.getElementById('btnEditLedger').addEventListener('click', () => {
      if (!isAdmin) { window.openModal('Access Denied', '<p>Only SuperAdmin can edit ledgers.</p>'); return; }
      if (selected && selected.ledgerId) openLedgerForm(selected);
    });
    document.getElementById('btnRegisterLedger').addEventListener('click', () => {
      if (!isAdmin) { window.openModal('Access Denied', '<p>Only SuperAdmin can register ledgers.</p>'); return; }
      if (selected && !selected.ledgerId) openLedgerForm(selected);
    });
    document.getElementById('lfCancel').addEventListener('click', closeLedgerForm);
    document.getElementById('closeLedgerForm').addEventListener('click', closeLedgerForm);
    lfOverlay.addEventListener('click', closeLedgerForm);

    document.getElementById('lfSave').addEventListener('click', async () => {
      const name = document.getElementById('lfName').value.trim();
      if (!name) { window.openModal('Missing Info', '<p>Ledger Name is required.</p>'); return; }
      const payload = {
        name,
        short: lfShortInput.value.trim(),
        type: lfMode.value,
        mobile: document.getElementById('lfMobile').value.trim(),
        address: document.getElementById('lfAddress').value.trim(),
        gstin: lfMode.value === 'Customer' ? '' : lfGstinInput.value.trim(),
      };
      const url = editingLedgerId ? `${API_BASE}/ledgers/${editingLedgerId}` : `${API_BASE}/ledgers`;
      const method = editingLedgerId ? 'PUT' : 'POST';
      try {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not save this ledger.');
        closeLedgerForm();
        if (window.showToast) window.showToast(editingLedgerId ? 'Ledger updated successfully!' : 'Ledger created successfully!');
        await loadDirectory();
      } catch (err) {
        window.openModal('Could Not Save', `<p style="color:var(--red);">${err.message}</p>`);
      }
    });

    document.getElementById('btnDeleteLedger').addEventListener('click', async () => {
      if (!isAdmin) { window.openModal('Access Denied', '<p>Only SuperAdmin can delete ledgers.</p>'); return; }
      if (!selected || !selected.ledgerId) return;
      if (!(await window.confirmDanger('Delete Ledger', `Delete the Ledger '${selected.partyName}'?`))) return;
      try {
        const res = await fetch(`${API_BASE}/ledgers/${selected.ledgerId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not delete this ledger.');
        if (window.showToast) window.showToast('Ledger removed from master list.');
        selected = null;
        selectedRows = [];
        document.getElementById('plHeaderTitle').textContent = 'Select a Party from the list to view details';
        document.getElementById('btnEditLedger').style.display = 'none';
        document.getElementById('btnDeleteLedger').style.display = 'none';
        document.getElementById('btnOpenStatement').style.display = 'none';
        document.getElementById('plSummaryGrid').style.display = 'none';
        document.getElementById('plEmptyHint').style.display = 'block';
        await loadDirectory();
      } catch (err) {
        window.openModal('Error', `<p style="color:var(--red);">${err.message}</p>`);
      }
    });

    // ---------------- Import / Export (CSV, same data desktop app's Excel does) ----------------
    function downloadCsv(filename, rows) {
      const csv = rows.map((r) => r.map((v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function downloadTemplate() {
      if (!isAdmin) { window.openModal('Access Denied', '<p>Only SuperAdmin can download the import template.</p>'); return; }
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      downloadCsv(`Party_Ledger_Template_${stamp}.csv`, [
        ['ledger_type', 'ledger_name', 'short_name', 'mobile', 'address', 'gstin'],
        ['Customer', 'Customer / Project Name', 'Order No / Alias', '', '', ''],
        ['Supplier', 'Supplier Name', 'Supplier Short Name', '', '', 'Supplier GSTIN'],
      ]);
      if (window.showToast) window.showToast('Template downloaded successfully.');
    }

    function parseCsv(text) {
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
      if (!lines.length) return [];
      const splitLine = (line) => {
        const out = []; let cur = ''; let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (inQuotes) {
            if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (c === '"') { inQuotes = false; }
            else cur += c;
          } else if (c === '"') { inQuotes = true; }
          else if (c === ',') { out.push(cur); cur = ''; }
          else cur += c;
        }
        out.push(cur);
        return out;
      };
      const header = splitLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
      return lines.slice(1).map((line) => {
        const cells = splitLine(line);
        const row = {};
        header.forEach((h, i) => { row[h] = (cells[i] || '').trim(); });
        return row;
      });
    }

    async function handleImportFile(e) {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      if (!isAdmin) { window.openModal('Access Denied', '<p>Only SuperAdmin can import ledgers.</p>'); return; }
      if (!/\.csv$/i.test(file.name)) {
        window.openModal('Unsupported File', '<p>Please select a CSV file exported from Excel (Save As -> CSV) for import.</p>');
        return;
      }
      const text = await file.text();
      const rows = parseCsv(text);
      if (!rows.length) { window.openModal('No Data', '<p>Selected file has no rows to import.</p>'); return; }

      const valueFrom = (row, keys, def = '') => {
        for (const k of keys) { if (row[k] !== undefined && row[k] !== '') return row[k]; }
        return def;
      };

      // Fetch the full current directory (unfiltered) to dedupe against, same
      // as the desktop app checking self.db.get_all_ledgers() before import.
      const existingRes = await fetch(`${API_BASE}/ledgers/directory?search=&type=All Parties`);
      const existing = existingRes.ok ? await existingRes.json() : [];
      const existingKeys = new Set(existing.filter((p) => p.ledgerId).map((p) => `${p.partyName.trim().toLowerCase()}|${(p.shortName || '').trim().toLowerCase()}`));

      const incoming = [];
      const duplicates = [];
      rows.forEach((row) => {
        const name = valueFrom(row, ['ledger_name', 'name', 'party_name', 'customer_name', 'supplier_name']);
        if (!name) return;
        const short = valueFrom(row, ['short_name', 'short', 'alias', 'order_no', 'order_number']);
        const key = `${name.trim().toLowerCase()}|${short.trim().toLowerCase()}`;
        if (existingKeys.has(key)) { duplicates.push(short ? `${name} (${short})` : name); return; }
        let type = valueFrom(row, ['ledger_type', 'type'], 'Both');
        type = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
        if (!['Both', 'Customer', 'Supplier'].includes(type)) type = 'Both';
        incoming.push({
          name, short, type,
          mobile: valueFrom(row, ['mobile', 'mobile_no', 'phone']),
          address: valueFrom(row, ['address', 'city']),
          gstin: valueFrom(row, ['gstin', 'gst', 'gst_no']),
        });
        existingKeys.add(key);
      });

      if (duplicates.length) {
        const proceed = await window.confirmDialog('Duplicates Found', `${duplicates.length} ledger(s) already exist and will be skipped. Import only new ledgers?`, { kind: 'warning', okLabel: 'Import New Only' });
        if (!proceed) return;
      }
      if (!incoming.length) { window.openModal('Nothing to Import', '<p>All ledgers already exist.</p>'); return; }

      let created = 0;
      const failed = [];
      for (const ledger of incoming) {
        try {
          const res = await fetch(`${API_BASE}/ledgers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ledger),
          });
          const data = await res.json();
          if (res.ok) created++;
          else failed.push(`${ledger.name}: ${data.error || 'failed'}`);
        } catch (err) {
          failed.push(`${ledger.name}: ${err.message}`);
        }
      }
      await loadDirectory();
      if (window.showToast) window.showToast(`${created} new ledger(s) imported successfully.`);
      if (failed.length) window.openModal('Some Rows Failed', `<p>${failed.join('<br>')}</p>`);
    }

    // ---------------- Statement modal (drill-down) ----------------
    const stOverlay = document.getElementById('statementOverlay');
    let stMonth = null, stDate = null, stRef = null;
    let stmtCurrentRow = 0;
    let stmtKeyHandler = null;

    async function openStatement() {
      if (!selected) return;
      stMonth = null; stDate = null; stRef = null;
      document.getElementById('stmtTitle').innerHTML =
        `<i class="fa-solid fa-file-invoice-dollar"></i> ${selected.partyName} &nbsp;|&nbsp; ${selected.type} Account Statement`;
      renderProfile();
      // Rows were already fetched by selectParty(); if not (e.g. dblclick
      // race), fetch them now before rendering the drill-down.
      if (!selectedRows.length) {
        try { selectedRows = await fetchStatementRows(selected.partyName, selected.type); } catch (e) { selectedRows = []; }
      }
      renderSummary();
      renderLevel();
      stOverlay.classList.add('show');
      lockPageScroll();
      attachStatementKeyboardNav();
    }
    function closeStatement() {
      stOverlay.classList.remove('show');
      unlockPageScroll();
      detachStatementKeyboardNav();
    }
    document.getElementById('closeStatement').addEventListener('click', closeStatement);
    stOverlay.addEventListener('click', closeStatement);
    document.getElementById('btnExportStatement').addEventListener('click', () => {
      if (!selected || !selectedRows.length) { window.openModal('No Data', '<p>No records found to export.</p>'); return; }
      const header = ['Movement', 'Date', 'Serial No', 'Item', 'Category', 'Ref/Invoice No', 'Warehouse', 'Status'];
      const lines = selectedRows.map((r) => [r.movement, r.date, r.serial_no, r.item_name, r.category, refDisplay(r), r.warehouse, r.status]);
      const safeName = selected.partyName.replace(/[^a-z0-9]/gi, '_');
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      downloadCsv(`Ledger_${selected.type}_${safeName}_${stamp}.csv`, [header, ...lines]);
      if (window.showToast) window.showToast('Ledger statement exported successfully!');
    });
    document.getElementById('stmtBack').addEventListener('click', goBackLevel);

    function renderProfile() {
      const box = document.getElementById('stmtProfile');
      if (selected.ledgerId) {
        box.innerHTML = `
          <div class="stmt-profile">
            <div class="pf-item"><span class="pf-label">Ledger Name</span><span class="pf-val accent">${selected.partyName}</span></div>
            <div class="pf-item"><span class="pf-label">Short / Alias</span><span class="pf-val">${selected.shortName || '-'}</span></div>
            <div class="pf-item"><span class="pf-label">Ledger Group</span><span class="pf-val">${selected.type}</span></div>
            <div class="pf-item"><span class="pf-label">Mobile No</span><span class="pf-val">${selected.mobile || '-'}</span></div>
            <div class="pf-item"><span class="pf-label">Address / City</span><span class="pf-val">${selected.address || '-'}</span></div>
            <div class="pf-item"><span class="pf-label">GSTIN</span><span class="pf-val">${selected.gstin || '-'}</span></div>
          </div>`;
      } else {
        box.innerHTML = `<div class="stmt-unreg"><i class="fa-solid fa-triangle-exclamation"></i>&nbsp; Unregistered Party (Data sourced from legacy transactions only.)</div>`;
      }
    }

    function renderSummary() {
      const inC = selectedRows.filter((r) => r.movement === 'IN').length;
      const outC = selectedRows.filter((r) => r.movement === 'OUT').length;
      document.getElementById('stmtIn').textContent = inC;
      document.getElementById('stmtOut').textContent = outC;
      document.getElementById('stmtBal').textContent = inC - outC;
    }

    function parseDate(d) {
      const [dd, mm, yyyy] = String(d || '').split('-').map(Number);
      if (!dd || !mm || !yyyy) return null;
      return new Date(yyyy, mm - 1, dd);
    }
    function monthKey(d) { const dt = parseDate(d); return dt ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}` : '-'; }
    function monthLabel(key) {
      const [y, m] = key.split('-').map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    function refDisplay(row) {
      if (row.movement === 'IN') return row.purchase_invoice ? String(row.purchase_invoice) : '-';
      const parts = [];
      if (row.chalan_no && String(row.chalan_no) !== '-' && String(row.chalan_no) !== '') parts.push(`Chalan: ${row.chalan_no}`);
      if (row.sales_invoice && String(row.sales_invoice) !== '-' && String(row.sales_invoice) !== '') parts.push(`Invoice: ${row.sales_invoice}`);
      if (row.order_no && String(row.order_no) !== '-' && String(row.order_no) !== '') parts.push(`Order: ${row.order_no}`);
      return parts.join('  |  ') || '-';
    }

    function updateBreadcrumb() {
      document.getElementById('stmtBack').style.display = stMonth ? 'inline-flex' : 'none';
      const parts = ['📅 All Months'];
      if (stMonth) parts.push(monthLabel(stMonth));
      if (stDate) parts.push(`🗓️ ${stDate}`);
      if (stRef) parts.push(`🧾 ${stRef.key}`);
      document.getElementById('stmtBreadcrumb').textContent = parts.join('  ▸  ');
      document.getElementById('stmtHint').textContent = stRef ? 'Individual serial numbers for this voucher' : 'Click a row to open ▸';
    }

    function setHead(cols) {
      document.getElementById('stmtThead').innerHTML = `<tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>`;
    }

    function renderLevel() {
      const tbody = document.getElementById('stmtTbody');
      tbody.innerHTML = '';
      if (stMonth === null) renderMonths(tbody);
      else if (stDate === null) renderDates(tbody);
      else if (stRef === null) renderRefs(tbody);
      else renderSerials(tbody);
      updateBreadcrumb();
      updateAttachmentsPanel();
      stmtCurrentRow = 0;
      highlightStatementRow(0);
    }

    // ---------------- Voucher Attachments panel ----------------
    // One shared set of real, openable files per voucher (Ref/Invoice No),
    // fetched from the new /api/attachments endpoints — only visible once
    // drilled down to a specific voucher's serial-number list, since that's
    // the level every one of those rows shares the exact same proof at.
    const attachPanel = document.getElementById('stmtAttachments');
    const attachList = document.getElementById('stmtAttachmentsList');
    const attachAddInput = document.getElementById('stmtAttachAddInput');
    let attachRefType = null, attachRefNo = null;

    function fmtFileSize(bytes) {
      if (!bytes) return '';
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    async function updateAttachmentsPanel() {
      if (stRef === null) {
        attachPanel.style.display = 'none';
        attachRefType = null; attachRefNo = null;
        return;
      }
      attachRefType = stRef.movement === 'IN' ? 'purchase' : 'sales';
      attachRefNo = stRef.key;
      attachPanel.style.display = '';
      attachList.innerHTML = `<div class="stmt-attach-empty">Loading attachments...</div>`;
      await refreshAttachmentsList();
    }

    async function refreshAttachmentsList() {
      if (!attachRefType || !attachRefNo || attachRefNo === '-') {
        attachList.innerHTML = `<div class="stmt-attach-empty">No proof was attached for this voucher.</div>`;
        return;
      }
      let files = [];
      try {
        const data = await window.Api.get(`/attachments?refType=${encodeURIComponent(attachRefType)}&refNo=${encodeURIComponent(attachRefNo)}`);
        files = data.files || [];
      } catch (e) {
        attachList.innerHTML = `<div class="stmt-attach-empty">Could not load attachments.</div>`;
        return;
      }
      if (!files.length) {
        attachList.innerHTML = `<div class="stmt-attach-empty">No proof was attached for this voucher.</div>`;
        return;
      }
      attachList.innerHTML = files.map((f) => `
        <div class="stmt-attach-chip" data-id="${f.id}">
          <i class="fa-solid ${/pdf/i.test(f.mimeType) ? 'fa-file-pdf' : /image/i.test(f.mimeType) ? 'fa-file-image' : 'fa-file'}"></i>
          <span class="name" title="${String(f.fileName).replace(/"/g, '&quot;')}">${f.fileName}</span>
          <span class="size">${fmtFileSize(f.fileSize)}</span>
          <button type="button" class="btn btn-ghost attach-open" data-id="${f.id}" title="Open"><i class="fa-solid fa-up-right-from-square"></i></button>
          <button type="button" class="btn btn-ghost attach-remove" data-id="${f.id}" title="Remove"><i class="fa-solid fa-trash"></i></button>
        </div>`).join('');
    }

    attachList.addEventListener('click', async (e) => {
      const openBtn = e.target.closest('.attach-open');
      if (openBtn) {
        window.open(`${API_BASE}/attachments/${openBtn.dataset.id}/file`, '_blank');
        return;
      }
      const removeBtn = e.target.closest('.attach-remove');
      if (removeBtn) {
        const ok = await window.confirmDanger('Remove Attachment', 'Remove this proof file from the voucher? This cannot be undone.');
        if (!ok) return;
        try {
          await window.Api.delete(`/attachments/${removeBtn.dataset.id}`);
          await refreshAttachmentsList();
          if (window.showToast) window.showToast('Attachment removed.');
        } catch (err) {
          window.openModal('Error', `<p>${err.message || 'Could not remove this attachment.'}</p>`);
        }
      }
    });

    attachAddInput.addEventListener('change', async () => {
      const files = attachAddInput.files;
      if (!files || !files.length) { attachAddInput.value = ''; return; }
      if (!attachRefType || !attachRefNo || attachRefNo === '-') {
        attachAddInput.value = '';
        window.openModal('Cannot Attach', '<p>This voucher has no Invoice/Chalan number on file, so a proof file cannot be linked to it. Add the number first (Sale/Purchase Register &gt; Edit), then try again.</p>');
        return;
      }
      try {
        if (typeof window.uploadAttachments !== 'function') {
          throw new Error('Upload helper not loaded — please hard-refresh the page (Ctrl+Shift+R) and try again.');
        }
        const result = await window.uploadAttachments(attachRefType, attachRefNo, files);
        attachAddInput.value = '';
        if (!result.ok) {
          window.openModal('Upload Failed', `<p>${result.error || 'Could not upload the file(s).'}</p>`);
          return;
        }
        await refreshAttachmentsList();
        if (window.showToast) window.showToast('Attachment(s) uploaded.');
      } catch (err) {
        attachAddInput.value = '';
        window.openModal('Upload Failed', `<p>${(err && err.message) || 'Could not upload the file(s).'}</p>`);
      }
    });

    function highlightStatementRow(idx) {
      const rows = document.querySelectorAll('#stmtTbody tr.stmt-table-row');
      rows.forEach((r, i) => r.classList.toggle('kbd-active', i === idx));
      if (rows[idx]) rows[idx].scrollIntoView({ block: 'nearest' });
    }

    function attachStatementKeyboardNav() {
      stmtKeyHandler = (e) => {
        const rows = document.querySelectorAll('#stmtTbody tr.stmt-table-row');
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (rows.length) { stmtCurrentRow = Math.min(stmtCurrentRow + 1, rows.length - 1); highlightStatementRow(stmtCurrentRow); }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (rows.length) { stmtCurrentRow = Math.max(stmtCurrentRow - 1, 0); highlightStatementRow(stmtCurrentRow); }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (rows[stmtCurrentRow]) rows[stmtCurrentRow].click();
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          goBackLevel();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (stMonth === null) closeStatement();
          else goBackLevel();
        }
      };
      document.addEventListener('keydown', stmtKeyHandler);
    }
    function detachStatementKeyboardNav() {
      if (stmtKeyHandler) { document.removeEventListener('keydown', stmtKeyHandler); stmtKeyHandler = null; }
    }

    function renderMonths(tbody) {
      setHead(['Month', 'Total Transactions', 'Inward (Purchase)', 'Outward (Sale)']);
      const months = {};
      selectedRows.forEach((r) => {
        const key = monthKey(r.date);
        if (key === '-') return;
        months[key] = months[key] || { in: 0, out: 0 };
        months[key][r.movement === 'IN' ? 'in' : 'out']++;
      });
      const keys = Object.keys(months).sort((a, b) => b.localeCompare(a));
      if (!keys.length) { tbody.innerHTML = `<tr><td colspan="4" class="pl-empty-hint">No transactions found for this party.</td></tr>`; return; }
      keys.forEach((key) => {
        const info = months[key];
        const tr = document.createElement('tr');
        tr.className = 'stmt-table-row';
        tr.innerHTML = `<td data-label="Month">📅 ${monthLabel(key)}</td>
          <td data-label="Total" style="text-align:center;">${info.in + info.out}</td>
          <td data-label="Inward" style="text-align:center; color:#2ECC71;">${info.in}</td>
          <td data-label="Outward" style="text-align:center; color:var(--red);">${info.out}</td>`;
        tr.addEventListener('click', () => { stMonth = key; renderLevel(); });
        tbody.appendChild(tr);
      });
    }

    function renderDates(tbody) {
      setHead(['Date', 'Total Transactions', 'Inward (Purchase)', 'Outward (Sale)']);
      const flat = selectedRows.filter((r) => monthKey(r.date) === stMonth);
      const dates = {};
      flat.forEach((r) => {
        dates[r.date] = dates[r.date] || { in: 0, out: 0, dt: parseDate(r.date) };
        dates[r.date][r.movement === 'IN' ? 'in' : 'out']++;
      });
      Object.keys(dates).sort((a, b) => dates[b].dt - dates[a].dt).forEach((dateKey) => {
        const info = dates[dateKey];
        const tr = document.createElement('tr');
        tr.className = 'stmt-table-row';
        tr.innerHTML = `<td data-label="Date">🗓️ ${dateKey}</td>
          <td data-label="Total" style="text-align:center;">${info.in + info.out}</td>
          <td data-label="Inward" style="text-align:center; color:#2ECC71;">${info.in}</td>
          <td data-label="Outward" style="text-align:center; color:var(--red);">${info.out}</td>`;
        tr.addEventListener('click', () => { stDate = dateKey; renderLevel(); });
        tbody.appendChild(tr);
      });
    }

    function renderRefs(tbody) {
      setHead(['Voucher / Challan / Invoice No', 'Movement', 'Serial Count', 'Category', 'Warehouse']);
      const groups = {};
      const order = [];
      selectedRows.filter((r) => r.date === stDate).forEach((r) => {
        const key = `${r.movement}|${r.ref_key}`;
        if (!groups[key]) { groups[key] = { movement: r.movement, ref: r.ref_key, rows: [], cats: new Set(), whs: new Set(), first: r }; order.push(key); }
        groups[key].rows.push(r);
        groups[key].cats.add(r.category || '-');
        groups[key].whs.add(r.warehouse || '-');
      });
      order.forEach((key) => {
        const g = groups[key];
        const catText = g.cats.size === 1 ? [...g.cats][0] : 'Multiple';
        const whText = g.whs.size === 1 ? [...g.whs][0] : 'Multiple';
        const tr = document.createElement('tr');
        tr.className = 'stmt-table-row';
        tr.innerHTML = `<td data-label="Ref">🧾 ${refDisplay(g.first)}</td>
          <td data-label="Movement" style="text-align:center; font-weight:700; color:${g.movement === 'IN' ? '#2ECC71' : 'var(--red)'};">${g.movement === 'IN' ? 'INWARD' : 'OUTWARD'}</td>
          <td data-label="Count" style="text-align:center;">${g.rows.length}</td>
          <td data-label="Category" style="text-align:center;">${catText}</td>
          <td data-label="Warehouse" style="text-align:center;">${whText}</td>`;
        tr.addEventListener('click', () => { stRef = { movement: g.movement, key: g.ref }; renderLevel(); });
        tbody.appendChild(tr);
      });
    }

    function renderSerials(tbody) {
      setHead(['Date', 'Movement', 'Serial No', 'Item Specs', 'Category', 'Ref/Invoice No', 'Warehouse', 'Status']);
      const matched = selectedRows.filter((r) => r.date === stDate && r.movement === stRef.movement && r.ref_key === stRef.key);
      const statusColor = { Available: '#2ECC71', Sold: 'var(--red)', Damaged: 'var(--orange)' };
      matched.forEach((r, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'stmt-table-row leaf';
        tr.innerHTML = `<td data-label="Date">${r.date}</td>
          <td data-label="Movement" style="font-weight:700; color:${r.movement === 'IN' ? '#2ECC71' : 'var(--red)'};">${r.movement === 'IN' ? 'INWARD' : 'OUTWARD'}</td>
          <td data-label="Serial">${r.serial_no}</td>
          <td data-label="Item">${r.item_name || '-'}</td>
          <td data-label="Category" style="text-align:center;">${r.category || '-'}</td>
          <td data-label="Ref" style="text-align:center;">${refDisplay(r)}</td>
          <td data-label="Warehouse" style="text-align:center;">${r.warehouse || '-'}</td>
          <td data-label="Status" style="text-align:center; color:${statusColor[r.status] || 'var(--txt)'};">${r.status}</td>`;
        tr.addEventListener('click', () => {
          stmtCurrentRow = idx;
          highlightStatementRow(idx);
        });
        tbody.appendChild(tr);
      });
    }

    function goBackLevel() {
      if (stRef !== null) stRef = null;
      else if (stDate !== null) stDate = null;
      else if (stMonth !== null) stMonth = null;
      renderLevel();
    }
  },
};