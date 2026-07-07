// js/pages/partyledger.js
// Mirrors the desktop app's ui/party_ledger.py page:
//   - Left panel: "Party Ledger Control" (Create Ledger / Refresh / Import / Template)
//   - Right panel: search + type filter toolbar, party directory list,
//     selected-party action row (Edit Ledger / Open Statement / Delete Ledger),
//     inline Inward/Outward/Net-Balance summary
//   - "Ledger Account Statement" modal: profile card + summary cards +
//     Month -> Date -> Voucher -> Serial No. drill-down table (exactly like
//     PartyStatementDialog in the desktop app)
//   - "Create / Edit Ledger" modal: same fields as LedgerFormDialog
//
// IMPORTANT: This is a UI-only preview. All data below is dummy/sample data
// kept in memory for this page instance. No ledger is actually created,
// edited, or deleted, and no export/import actually happens — every such
// action just shows a small toast confirming it's a UI preview.
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
              <label id="lfShortLabel">Short Name / Order No.</label>
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
              <button class="btn btn-green" id="btnEditTransaction" style="display:none; padding:7px 12px; font-size:12px;"><i class="fa-solid fa-up-right-from-square"></i> Edit Transaction</button>
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
    // ---------------------------------------------------------------
    // Dummy data — UI preview only, nothing here is persisted anywhere.
    // ---------------------------------------------------------------
    const LEDGERS = [
      { id: 1, name: 'Sunrise Traders', short: '', type: 'Supplier', mobile: '9825012345', address: 'Rajkot, Gujarat', gstin: '24ABCDE1234F1Z5' },
      { id: 2, name: 'Patel Residence', short: 'NP-88231', type: 'Customer', mobile: '9021098765', address: 'Surat, Gujarat', gstin: '-' },
      { id: 3, name: 'Adani Distributors', short: '', type: 'Supplier', mobile: '9998877665', address: 'Ahmedabad, Gujarat', gstin: '24ADANI9988K1Z2' },
      { id: 4, name: 'Vikram Energy', short: '', type: 'Supplier', mobile: '9911223344', address: 'Rajkot, Gujarat', gstin: '24VIKRM5566L1Z9' },
    ];

    const TXNS = {
      'Sunrise Traders': [
        { movement: 'IN', date: '28-06-2026', ref: 'INV-2026-041', category: 'Solar Panel', warehouse: 'Main NAS Warehouse', serials: [
          { sn: 'SN00998821', item: 'Waaree 545W Mono PERC', status: 'Available' },
          { sn: 'SN00998822', item: 'Waaree 545W Mono PERC', status: 'Sold' },
          { sn: 'SN00998823', item: 'Waaree 545W Mono PERC', status: 'Available' },
        ]},
        { movement: 'IN', date: '15-06-2026', ref: 'INV-2026-038', category: 'Inverter', warehouse: 'Main NAS Warehouse', serials: [
          { sn: 'SN00887001', item: 'Adani 5KW Hybrid', status: 'Sold' },
          { sn: 'SN00887002', item: 'Adani 5KW Hybrid', status: 'Available' },
        ]},
        { movement: 'IN', date: '20-05-2026', ref: 'INV-2026-030', category: 'Battery', warehouse: 'Rajkot Godown', serials: [
          { sn: 'SN00776001', item: 'Luminous 150Ah Tubular', status: 'Available' },
        ]},
      ],
      'Patel Residence': [
        { movement: 'OUT', date: '30-06-2026', ref: 'CH-2026-118', extra: { invoice: 'SI-6621', order: 'NP-88231' }, category: 'Solar Panel', warehouse: 'Main NAS Warehouse', serials: [
          { sn: 'SN00998821', item: 'Waaree 545W Mono PERC', status: 'Sold' },
          { sn: 'SN00998822', item: 'Waaree 545W Mono PERC', status: 'Sold' },
        ]},
        { movement: 'OUT', date: '10-06-2026', ref: 'CH-2026-101', extra: { invoice: 'SI-6590', order: 'NP-88231' }, category: 'Inverter', warehouse: 'Main NAS Warehouse', serials: [
          { sn: 'SN00887001', item: 'Adani 5KW Hybrid', status: 'Sold' },
        ]},
      ],
      'Adani Distributors': [
        { movement: 'IN', date: '25-06-2026', ref: 'INV-2026-040', category: 'Inverter', warehouse: 'Rajkot Godown', serials: [
          { sn: 'SN00887744', item: 'Adani 5KW Hybrid', status: 'Available' },
          { sn: 'SN00887745', item: 'Adani 5KW Hybrid', status: 'Available' },
        ]},
      ],
      'Vikram Energy': [
        { movement: 'IN', date: '19-06-2026', ref: 'INV-2026-039', category: 'Battery', warehouse: 'Main NAS Warehouse', serials: [
          { sn: 'SN00776633', item: 'Vikram 200Ah Tubular', status: 'Damaged' },
        ]},
      ],
      'Shah Enterprises': [
        { movement: 'OUT', date: '29-06-2026', ref: 'CH-2026-117', extra: { invoice: 'SI-6608', order: 'NP-88109' }, category: 'Inverter', warehouse: 'Rajkot Godown', serials: [
          { sn: 'SN00990011', item: 'Adani 3KW On-Grid', status: 'Sold' },
        ]},
      ],
    };

    function buildDirectory() {
      const dir = [];
      const seen = new Set();
      LEDGERS.forEach((l) => { dir.push({ name: l.name, type: l.type, ledger: l }); seen.add(l.name); });
      Object.keys(TXNS).forEach((name) => {
        if (seen.has(name)) return;
        const hasIn = TXNS[name].some((r) => r.movement === 'IN');
        const hasOut = TXNS[name].some((r) => r.movement === 'OUT');
        dir.push({ name, type: hasIn && hasOut ? 'Both' : hasIn ? 'Supplier' : 'Customer', ledger: null });
      });
      dir.sort((a, b) => a.name.localeCompare(b.name));
      return dir;
    }
    const directory = buildDirectory();
    let selected = null;

    const listEl = document.getElementById('partyList');
    const searchEl = document.getElementById('plSearch');
    const typeEl = document.getElementById('plTypeFilter');

    function renderList() {
      const term = searchEl.value.trim().toLowerCase();
      const typeChoice = typeEl.value;
      listEl.innerHTML = '';
      const filtered = directory.filter((p) => {
        if (term && !p.name.toLowerCase().includes(term)) return false;
        if (typeChoice === 'Suppliers Only' && !['Supplier', 'Both'].includes(p.type)) return false;
        if (typeChoice === 'Customers Only' && !['Customer', 'Both'].includes(p.type)) return false;
        return true;
      });
      if (!filtered.length) {
        listEl.innerHTML = `<li class="pl-empty-hint">No parties match this search/filter.</li>`;
        return;
      }
      filtered.forEach((p) => {
        const li = document.createElement('li');
        li.className = 'party-item' + (!p.ledger ? ' unregistered' : '') + (selected && selected.name === p.name ? ' selected' : '');
        const icon = p.type === 'Both' ? 'fa-arrows-rotate' : p.type === 'Supplier' ? 'fa-truck-ramp-box' : 'fa-hand-holding-dollar';
        const tagClass = p.type === 'Both' ? 'both' : p.type.toLowerCase();
        li.innerHTML = `
          <i class="fa-solid ${icon}"></i>
          <span class="p-name">${p.name}${p.ledger && p.ledger.short ? ` [${p.ledger.short}]` : ''}</span>
          <span class="p-tag ${tagClass}">${p.type}</span>
          ${!p.ledger ? '<span class="p-badge-unreg">(unregistered)</span>' : ''}
        `;
        li.addEventListener('click', () => selectParty(p));
        li.addEventListener('dblclick', () => { selectParty(p); openStatement(); });
        listEl.appendChild(li);
      });
    }

    function selectParty(p) {
      selected = p;
      renderList();
      document.getElementById('plHeaderTitle').textContent =
        `${p.name}${p.ledger && p.ledger.short ? ' / ' + p.ledger.short : ''}  (${p.type} Ledger Selected)`;
      document.getElementById('btnEditLedger').style.display = p.ledger ? 'inline-flex' : 'none';
      document.getElementById('btnDeleteLedger').style.display = p.ledger ? 'inline-flex' : 'none';
      document.getElementById('btnOpenStatement').style.display = 'inline-flex';
      document.getElementById('plEmptyHint').style.display = 'none';

      const rows = TXNS[p.name] || [];
      const inCount = rows.filter((r) => r.movement === 'IN').reduce((s, r) => s + r.serials.length, 0);
      const outCount = rows.filter((r) => r.movement === 'OUT').reduce((s, r) => s + r.serials.length, 0);
      document.getElementById('plSummaryGrid').style.display = 'grid';
      document.getElementById('plSumIn').textContent = inCount;
      document.getElementById('plSumOut').textContent = outCount;
      document.getElementById('plSumBal').textContent = inCount - outCount;
    }

    searchEl.addEventListener('input', renderList);
    typeEl.addEventListener('change', renderList);
    document.getElementById('btnRefreshParties').addEventListener('click', () => {
      renderList();
      window.showToast('Party list refreshed (UI preview)');
    });
    document.getElementById('btnImportLedgers').addEventListener('click', () => window.showToast('Import from Excel — UI preview only'));
    document.getElementById('btnDownloadTemplate').addEventListener('click', () => window.showToast('Template download — UI preview only'));
    document.getElementById('btnOpenStatement').addEventListener('click', openStatement);

    renderList();

    // ---------------- Create / Edit Ledger modal ----------------
    const lfOverlay = document.getElementById('ledgerFormOverlay');
    const lfMode = document.getElementById('lfMode');
    const lfShortLabel = document.getElementById('lfShortLabel');
    const lfGstinField = document.getElementById('lfGstinField');

    function updateLedgerFormMode() {
      const isCustomer = lfMode.value === 'Customer';
      lfShortLabel.textContent = isCustomer ? 'Short Name / Order No.' : 'Short Name / Alias';
      lfGstinField.style.display = isCustomer ? 'none' : 'flex';
    }
    lfMode.addEventListener('change', updateLedgerFormMode);

    // Locks/unlocks background page scroll while a fullscreen modal is open,
    // so scrolling inside the modal never affects the page/list behind it.
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
      document.getElementById('lfName').value = editing ? editing.name : '';
      document.getElementById('lfShort').value = editing && editing.short ? editing.short : '';
      document.getElementById('lfMobile').value = editing && editing.mobile !== '-' ? editing.mobile || '' : '';
      document.getElementById('lfAddress').value = editing && editing.address !== '-' ? editing.address || '' : '';
      document.getElementById('lfGstin').value = editing && editing.gstin !== '-' ? editing.gstin || '' : '';
      lfMode.value = editing ? editing.type : 'Customer';
      updateLedgerFormMode();
      document.getElementById('ledgerFormTitle').innerHTML =
        `<i class="fa-solid fa-address-book"></i>&nbsp; ${editing ? 'Edit Ledger' : 'Create New Ledger'}`;
      lfOverlay.classList.add('show');
      lockPageScroll();
      attachLedgerFormEscape();
    }
    function closeLedgerForm() {
      lfOverlay.classList.remove('show');
      unlockPageScroll();
      detachLedgerFormEscape();
    }

    document.getElementById('btnCreateLedger').addEventListener('click', () => openLedgerForm(null));
    document.getElementById('btnEditLedger').addEventListener('click', () => { if (selected && selected.ledger) openLedgerForm(selected.ledger); });
    document.getElementById('lfCancel').addEventListener('click', closeLedgerForm);
    document.getElementById('closeLedgerForm').addEventListener('click', closeLedgerForm);
    lfOverlay.addEventListener('click', closeLedgerForm);
    document.getElementById('lfSave').addEventListener('click', () => {
      closeLedgerForm();
      window.showToast('UI Preview — ledger not actually saved');
    });
    document.getElementById('btnDeleteLedger').addEventListener('click', () => {
      if (!selected) return;
      window.showToast(`UI Preview — "${selected.name}" not actually deleted`);
    });

    // ---------------- Statement modal (drill-down) ----------------
    const stOverlay = document.getElementById('statementOverlay');
    let stMonth = null, stDate = null, stRef = null;
    let stmtCurrentRow = 0;
    let stmtKeyHandler = null;

    function openStatement() {
      if (!selected) return;
      stMonth = null; stDate = null; stRef = null;
      document.getElementById('stmtTitle').innerHTML =
        `<i class="fa-solid fa-file-invoice-dollar"></i> ${selected.name} &nbsp;|&nbsp; ${selected.type} Account Statement`;
      renderProfile();
      renderSummary();
      document.getElementById('btnEditTransaction').style.display = 'none';
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
    document.getElementById('btnExportStatement').addEventListener('click', () => window.showToast('Export Statement — UI preview only'));
    document.getElementById('stmtBack').addEventListener('click', goBackLevel);

    function renderProfile() {
      const box = document.getElementById('stmtProfile');
      if (selected.ledger) {
        const l = selected.ledger;
        box.innerHTML = `
          <div class="stmt-profile">
            <div class="pf-item"><span class="pf-label">Ledger Name</span><span class="pf-val accent">${l.name}</span></div>
            <div class="pf-item"><span class="pf-label">Short / Alias</span><span class="pf-val">${l.short || '-'}</span></div>
            <div class="pf-item"><span class="pf-label">Ledger Group</span><span class="pf-val">${selected.type}</span></div>
            <div class="pf-item"><span class="pf-label">Mobile No</span><span class="pf-val">${l.mobile || '-'}</span></div>
            <div class="pf-item"><span class="pf-label">Address / City</span><span class="pf-val">${l.address || '-'}</span></div>
            <div class="pf-item"><span class="pf-label">GSTIN</span><span class="pf-val">${l.gstin || '-'}</span></div>
          </div>`;
      } else {
        box.innerHTML = `<div class="stmt-unreg"><i class="fa-solid fa-triangle-exclamation"></i>&nbsp; Unregistered Party (Data sourced from legacy transactions only.)</div>`;
      }
    }

    function getRows() { return TXNS[selected.name] || []; }
    function flatRows() {
      const out = [];
      getRows().forEach((g) => g.serials.forEach((s) => out.push({ ...g, ...s })));
      return out;
    }

    function renderSummary() {
      const flat = flatRows();
      const inC = flat.filter((r) => r.movement === 'IN').length;
      const outC = flat.filter((r) => r.movement === 'OUT').length;
      document.getElementById('stmtIn').textContent = inC;
      document.getElementById('stmtOut').textContent = outC;
      document.getElementById('stmtBal').textContent = inC - outC;
    }

    function parseDate(d) {
      const [dd, mm, yyyy] = d.split('-').map(Number);
      return new Date(yyyy, mm - 1, dd);
    }
    function monthKey(d) { const dt = parseDate(d); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; }
    function monthLabel(key) {
      const [y, m] = key.split('-').map(Number);
      return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    function refDisplay(g) {
      if (g.movement === 'IN') return g.ref;
      const parts = [];
      if (g.ref) parts.push(`Chalan: ${g.ref}`);
      if (g.extra && g.extra.invoice) parts.push(`Invoice: ${g.extra.invoice}`);
      if (g.extra && g.extra.order) parts.push(`Order: ${g.extra.order}`);
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
      // Land on the first row by default, like the desktop app does, so
      // arrow keys + Enter can drill down without first clicking a row.
      stmtCurrentRow = 0;
      highlightStatementRow(0);
    }

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
          if (rows[stmtCurrentRow]) rows[stmtCurrentRow].click(); // no-op on leaf (serial) rows, same as desktop app
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          goBackLevel();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (stMonth === null) closeStatement(); // already at top level -> Esc exits, matches desktop app
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
      flatRows().forEach((r) => {
        const key = monthKey(r.date);
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
      const flat = flatRows().filter((r) => monthKey(r.date) === stMonth);
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
      getRows().filter((g) => g.date === stDate).forEach((g) => {
        const tr = document.createElement('tr');
        tr.className = 'stmt-table-row';
        tr.innerHTML = `<td data-label="Ref">🧾 ${refDisplay(g)}</td>
          <td data-label="Movement" style="text-align:center; font-weight:700; color:${g.movement === 'IN' ? '#2ECC71' : 'var(--red)'};">${g.movement === 'IN' ? 'INWARD' : 'OUTWARD'}</td>
          <td data-label="Count" style="text-align:center;">${g.serials.length}</td>
          <td data-label="Category" style="text-align:center;">${g.category}</td>
          <td data-label="Warehouse" style="text-align:center;">${g.warehouse}</td>`;
        tr.addEventListener('click', () => { stRef = { movement: g.movement, key: g.ref, group: g }; renderLevel(); });
        tbody.appendChild(tr);
      });
    }

    function renderSerials(tbody) {
      setHead(['Date', 'Movement', 'Serial No', 'Item Specs', 'Category', 'Ref/Invoice No', 'Warehouse', 'Status', 'Proof']);
      const g = stRef.group;
      const statusColor = { Available: '#2ECC71', Sold: 'var(--red)', Damaged: 'var(--orange)' };
      g.serials.forEach((s, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'stmt-table-row leaf';
        tr.innerHTML = `<td data-label="Date">${g.date}</td>
          <td data-label="Movement" style="font-weight:700; color:${g.movement === 'IN' ? '#2ECC71' : 'var(--red)'};">${g.movement === 'IN' ? 'INWARD' : 'OUTWARD'}</td>
          <td data-label="Serial">${s.sn}</td>
          <td data-label="Item">${s.item}</td>
          <td data-label="Category" style="text-align:center;">${g.category}</td>
          <td data-label="Ref" style="text-align:center;">${refDisplay(g)}</td>
          <td data-label="Warehouse" style="text-align:center;">${g.warehouse}</td>
          <td data-label="Status" style="text-align:center; color:${statusColor[s.status] || 'var(--txt)'};">${s.status}</td>
          <td data-label="Proof" style="text-align:center;"><button class="btn btn-ghost" style="padding:4px 10px; font-size:11px;" disabled>-</button></td>`;
        // 🚀 FIX: leaf (serial) rows previously had NO click handler at all,
        // so only the row auto-highlighted by renderLevel()/keyboard-nav
        // (always row 0) ever showed as selected — clicking any other row
        // visually did nothing. Leaf rows don't drill further, but a click
        // should still move the selection highlight to that row.
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