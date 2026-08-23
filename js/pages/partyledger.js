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

    <div class="pl-directory-panel">
      <!-- HEADER & TOP ACTION TOOLBAR -->
      <div class="pl-header-toolbar">
        <div style="display:flex; align-items:center; gap:10px;">
          <h3 style="margin:0; font-size:16px; font-weight:800; color:var(--purple); display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-folder-tree"></i> Registered &amp; Transaction Ledgers Directory
          </h3>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-green" id="btnCreateLedger" style="padding:6px 14px; font-size:12px; border-radius:20px;"><i class="fa-solid fa-plus"></i> Create New Ledger</button>
          <button class="btn btn-green" id="btnImportLedgers" style="background:#10b981; padding:6px 14px; font-size:12px; border-radius:20px;"><i class="fa-solid fa-file-import"></i> Upload Excel</button>
          <button class="btn btn-blue" id="btnDownloadTemplate" style="background:#3b82f6; padding:6px 14px; font-size:12px; border-radius:20px;"><i class="fa-solid fa-download"></i> Download Template</button>
          <button class="btn btn-ghost" id="btnRefreshParties" style="padding:6px 12px; font-size:12px; border-radius:20px;"><i class="fa-solid fa-rotate"></i> Refresh</button>
          <input type="file" id="plImportFile" accept=".csv,.xlsx,.xls" style="display:none;">
        </div>
      </div>

      <!-- DIRECTORY METRICS STRIP -->
      <div class="pl-stats-strip">
        <div class="pl-stat-pill active-total"><i class="fa-solid fa-address-book"></i> Total Accounts: <strong id="plStatTotal">0</strong></div>
        <div class="pl-stat-pill"><i class="fa-solid fa-hand-holding-dollar" style="color:var(--blue);"></i> Customers: <strong id="plStatCust">0</strong></div>
        <div class="pl-stat-pill"><i class="fa-solid fa-truck-ramp-box" style="color:#2ecc71;"></i> Suppliers: <strong id="plStatSupp">0</strong></div>
        <div class="pl-stat-pill"><i class="fa-solid fa-handshake" style="color:var(--orange);"></i> Dealers / Others: <strong id="plStatDealers">0</strong></div>
        <div class="pl-stat-pill"><i class="fa-solid fa-circle-question" style="color:var(--txt-muted);"></i> Unregistered: <strong id="plStatUnreg">0</strong></div>
      </div>

      <!-- SMART SEARCH & FILTER TOOLBAR -->
      <div class="pl-filter-bar">
        <div class="search-mini">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input id="plSearch" type="search" name="pl_search_query" placeholder="Quick search by Party Name, Code, City, Mobile, GSTIN... (Press Tab or / to Focus | Arrow keys to navigate)" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-form-type="other">
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <label style="color:var(--txt-muted); font-size:12px; font-weight:700; white-space:nowrap;"><i class="fa-solid fa-filter"></i> Group / Type:</label>
          <select id="plTypeFilter" style="border-radius:20px; min-width:160px; padding:7px 12px; font-size:12.5px;">
            <option>All Parties</option>
            <option>Suppliers Only</option>
            <option>Customers Only</option>
            <option>Dealers Only</option>
            <option>Installers Only</option>
            <option>Fabricators Only</option>
          </select>
        </div>
      </div>

      <!-- HIGH-DENSITY LEDGER DIRECTORY TABLE -->
      <div class="pl-table-wrap">
        <table class="pl-table">
          <thead>
            <tr>
              <th>Ledger / Account Name</th>
              <th>Short Code</th>
              <th>Group / Type</th>
              <th>City / Address</th>
              <th>Mobile / Phone</th>
              <th>GSTIN</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody id="partyTableBody"></tbody>
        </table>
      </div>

      <!-- SELECTED PARTY BOTTOM BAR -->
      <div class="pl-selected-bar" id="plSelectedBar">
        <div class="pl-selected-info">
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-circle-check" style="color:var(--purple); font-size:16px;"></i>
            <span id="plHeaderTitle" style="font-size:13.5px; color:var(--txt); font-weight:600;">Select a Party from table</span>
          </div>
          <div class="pl-selected-metrics" id="plSummaryGrid" style="display:none;">
            <div class="pl-selected-metric-item in">Inward: <strong id="plSumIn">0</strong></div>
            <div class="pl-selected-metric-item out">Outward: <strong id="plSumOut">0</strong></div>
            <div class="pl-selected-metric-item bal">Net Balance: <strong id="plSumBal">0</strong></div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-green" id="btnOpenStatement" style="display:none; padding:6px 14px; font-size:12px; border-radius:20px;"><i class="fa-solid fa-up-right-from-square"></i> Open Statement</button>
          <button class="btn btn-blue" id="btnEditLedger" style="display:none; padding:6px 12px; font-size:12px; border-radius:20px;"><i class="fa-solid fa-pen"></i> Edit Ledger</button>
          <button class="btn btn-gold" id="btnRegisterLedger" style="display:none; padding:6px 12px; font-size:12px; border-radius:20px;"><i class="fa-solid fa-user-plus"></i> Register</button>
          <button class="btn btn-red" id="btnDeleteLedger" style="display:none; padding:6px 12px; font-size:12px; border-radius:20px;"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
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
              <select id="lfMode"><option>Customer</option><option>Supplier</option><option>Dealer</option><option>Installer</option><option>Fabricator</option></select>
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
            <div class="mini-stat in">
              <div class="m-label">Inward Vouchers</div>
              <div class="m-val" id="stmtIn">0</div>
              <div class="m-sub" id="stmtInSub" style="font-size:11px; color:var(--txt-muted); margin-top:3px;">0 items</div>
            </div>
            <div class="mini-stat out">
              <div class="m-label">Outward Vouchers</div>
              <div class="m-val" id="stmtOut">0</div>
              <div class="m-sub" id="stmtOutSub" style="font-size:11px; color:var(--txt-muted); margin-top:3px;">0 items</div>
            </div>
            <div class="mini-stat bal">
              <div class="m-label">Total Transactions</div>
              <div class="m-val" id="stmtBal">0</div>
              <div class="m-sub" id="stmtBalSub" style="font-size:11px; color:var(--txt-muted); margin-top:3px;">0 total entries</div>
            </div>
          </div>

          <!-- Dynamic UOM Breakdown Ribbon -->
          <div id="stmtUomRibbon" style="display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin: 12px 0; padding: 10px 14px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-light); border-radius: 10px;">
            <span style="font-size:11.5px; font-weight:700; color:var(--txt-muted); text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-scale-balanced" style="color:var(--gold);"></i> UOM Stock Summary:
            </span>
            <div id="stmtUomChips" style="display:flex; flex-wrap:wrap; gap:6px;"></div>
          </div>

          <div class="stmt-nav">
            <button class="btn btn-ghost" id="stmtBack" style="display:none; padding:6px 12px; font-size:12px;"><i class="fa-solid fa-arrow-left"></i> Back</button>
            <div class="breadcrumb" id="stmtBreadcrumb">📅 All Months</div>
            <div class="hint" id="stmtHint">Click any row to open <i class="fa-solid fa-chevron-right" style="font-size:10px; margin-left:3px;"></i></div>
          </div>

          <!-- Active Voucher Action Bar (Print Challan, Edit, Delete) -->
          <div class="stmt-voucher-bar" id="stmtVoucherBar" style="display:none; align-items:center; justify-content:space-between; padding:8px 14px; background:rgba(255,255,255,0.03); border:1px solid var(--border-light); border-radius:10px; margin-bottom:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-receipt" style="color:var(--gold);"></i>
              <strong id="stmtVoucherLabel" style="font-size:13px; color:var(--txt);"></strong>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <button type="button" class="btn btn-ghost" id="stmtVoucherExportSerialsBtn" style="padding:5px 10px; font-size:11px; color:#22c55e;" title="Export Serials Excel"><i class="fa-solid fa-file-excel"></i> Export Serials</button>
              <button type="button" class="btn btn-ghost" id="stmtVoucherPrintBtn" style="display:none; padding:5px 10px; font-size:11px; color:var(--blue);"><i class="fa-solid fa-print"></i> Print Challan</button>
              <button type="button" class="btn btn-ghost" id="stmtVoucherEditBtn" style="padding:5px 10px; font-size:11px;"><i class="fa-solid fa-pen"></i> Edit Voucher</button>
              <button type="button" class="btn btn-ghost" id="stmtVoucherDelBtn" style="padding:5px 10px; font-size:11px; color:var(--red);"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
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

    const tbodyEl = document.getElementById('partyTableBody');
    const searchEl = document.getElementById('plSearch');
    const typeEl = document.getElementById('plTypeFilter');
    if (searchEl) {
      searchEl.value = '';
      searchEl.defaultValue = '';
    }

    // ---------------- Directory (table) ----------------
    async function loadDirectory() {
      if (tbodyEl) tbodyEl.innerHTML = `<tr><td colspan="7" class="pl-empty-hint"><i class="fa-solid fa-spinner fa-spin" style="margin-right:6px; color:var(--purple);"></i> Loading party directory…</td></tr>`;
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
        if (tbodyEl) tbodyEl.innerHTML = `<tr><td colspan="7" class="pl-empty-hint" style="color:var(--red);">${err.message}</td></tr>`;
      }
    }

    function renderList() {
      if (!tbodyEl) return;
      tbodyEl.innerHTML = '';

      // Update Directory Stats
      const total = directory.length;
      const custCount = directory.filter(p => p.type === 'Customer' || p.type === 'Both').length;
      const suppCount = directory.filter(p => p.type === 'Supplier' || p.type === 'Both').length;
      const dealerCount = directory.filter(p => !['Customer', 'Supplier', 'Both'].includes(p.type)).length;
      const unregCount = directory.filter(p => !p.ledgerId).length;

      const statTotal = document.getElementById('plStatTotal');
      const statCust = document.getElementById('plStatCust');
      const statSupp = document.getElementById('plStatSupp');
      const statDealers = document.getElementById('plStatDealers');
      const statUnreg = document.getElementById('plStatUnreg');

      if (statTotal) statTotal.textContent = total;
      if (statCust) statCust.textContent = custCount;
      if (statSupp) statSupp.textContent = suppCount;
      if (statDealers) statDealers.textContent = dealerCount;
      if (statUnreg) statUnreg.textContent = unregCount;

      if (!directory.length) {
        tbodyEl.innerHTML = `<tr><td colspan="7" class="pl-empty-hint">No party accounts match this search or filter criteria.</td></tr>`;
        return;
      }

      const iconMap = {
        Both: 'fa-arrows-rotate',
        Supplier: 'fa-truck-ramp-box',
        Customer: 'fa-hand-holding-dollar',
        Dealer: 'fa-handshake',
        Installer: 'fa-screwdriver-wrench',
        Fabricator: 'fa-industry',
      };

      directory.forEach((p, idx) => {
        const tr = document.createElement('tr');
        const isSel = selected && selected.partyName === p.partyName;
        tr.className = (isSel ? 'selected' : '') + (!p.ledgerId ? ' unregistered' : '');
        tr.dataset.partyIdx = String(idx);
        tr.tabIndex = -1;

        const icon = iconMap[p.type] || 'fa-address-card';
        const tagClass = (p.type || 'both').toLowerCase();

        tr.innerHTML = `
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <i class="fa-solid ${icon}" style="color:var(--purple); width:16px;"></i>
              <strong style="color:var(--txt); font-size:13px;">${p.partyName}</strong>
              ${!p.ledgerId ? '<span class="p-badge-unreg">(unregistered)</span>' : ''}
            </div>
          </td>
          <td>
            ${p.shortName ? `<span class="pl-short-code-badge">${p.shortName}</span>` : '<span style="color:var(--txt-muted);">-</span>'}
          </td>
          <td>
            <span class="p-tag ${tagClass}">${p.type}</span>
          </td>
          <td>
            <span class="pl-address-txt">${p.address && p.address !== '-' ? p.address : '<span style="color:var(--txt-muted);">-</span>'}</span>
          </td>
          <td>
            ${p.mobile && p.mobile !== '-' ? `<span style="color:var(--blue); font-weight:600;"><i class="fa-solid fa-phone" style="font-size:10px; margin-right:4px;"></i>${p.mobile}</span>` : '<span style="color:var(--txt-muted);">-</span>'}
          </td>
          <td>
            <span style="font-family:monospace; font-size:11.5px; color:var(--txt-muted);">${p.gstin && p.gstin !== '-' ? p.gstin : '-'}</span>
          </td>
          <td style="text-align:right;">
            <div style="display:inline-flex; gap:6px; align-items:center; justify-content:flex-end;">
              <button type="button" class="btn btn-green btn-table-stmt" style="padding:4px 10px; font-size:11px; border-radius:14px;" title="Open Statement"><i class="fa-solid fa-up-right-from-square"></i> Statement</button>
              ${p.ledgerId ? `<button type="button" class="btn btn-blue btn-table-edit" style="padding:4px 8px; font-size:11px; border-radius:14px;" title="Edit Ledger"><i class="fa-solid fa-pen"></i></button>` : `<button type="button" class="btn btn-gold btn-table-reg" style="padding:4px 8px; font-size:11px; border-radius:14px;" title="Register Ledger"><i class="fa-solid fa-user-plus"></i></button>`}
              ${p.ledgerId && isAdmin ? `<button type="button" class="btn btn-red btn-table-del" style="padding:4px 8px; font-size:11px; border-radius:14px;" title="Delete Ledger"><i class="fa-solid fa-trash"></i></button>` : ''}
            </div>
          </td>
        `;

        tr.addEventListener('click', () => {
          partyFocusIdx = idx;
          selectParty(p);
          highlightPartyListFocus();
        });

        tr.addEventListener('dblclick', () => {
          selectParty(p).then(() => openStatement());
        });

        const btnStmt = tr.querySelector('.btn-table-stmt');
        if (btnStmt) {
          btnStmt.addEventListener('click', (e) => {
            e.stopPropagation();
            partyFocusIdx = idx;
            selectParty(p).then(() => openStatement());
          });
        }

        const btnEdit = tr.querySelector('.btn-table-edit');
        if (btnEdit) {
          btnEdit.addEventListener('click', (e) => {
            e.stopPropagation();
            selectParty(p);
            openLedgerForm(p);
          });
        }

        const btnReg = tr.querySelector('.btn-table-reg');
        if (btnReg) {
          btnReg.addEventListener('click', (e) => {
            e.stopPropagation();
            selectParty(p);
            openLedgerForm({ partyName: p.partyName, type: p.type === 'Both' ? 'Customer' : p.type });
          });
        }

        const btnDel = tr.querySelector('.btn-table-del');
        if (btnDel) {
          btnDel.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteParty(p);
          });
        }

        tbodyEl.appendChild(tr);
      });

      // Keep focus index in range and default to first table row
      const rows = tbodyEl.querySelectorAll('tr');
      if (partyFocusIdx < 0 && directory.length > 0) {
        partyFocusIdx = 0;
      } else if (partyFocusIdx >= rows.length) {
        partyFocusIdx = Math.max(0, rows.length - 1);
      }
      highlightPartyListFocus();
      if (partyFocusIdx >= 0 && directory[partyFocusIdx] && (!selected || !directory.includes(selected))) {
        selectParty(directory[partyFocusIdx]);
      }
    }

    let partyFocusIdx = -1;
    function highlightPartyListFocus() {
      if (!tbodyEl) return;
      const rows = tbodyEl.querySelectorAll('tr');
      rows.forEach((el, i) => {
        const isCurrent = partyFocusIdx >= 0 && i === partyFocusIdx;
        el.classList.toggle('selected', isCurrent);
        el.classList.toggle('kbd-active', isCurrent);
      });
      if (partyFocusIdx >= 0 && rows[partyFocusIdx]) {
        rows[partyFocusIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    function partyListKeyHandler(e) {
      // Statement modal and Ledger Form own keys while open
      if (stOverlay && stOverlay.classList.contains('show')) return;
      if (lfOverlay && lfOverlay.classList.contains('show')) return;

      const isSearchFocused = document.activeElement === searchEl || (document.activeElement && document.activeElement.id === 'plSearch');
      const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
      const isOtherInput = !isSearchFocused && (tag === 'input' || tag === 'textarea' || tag === 'select');
      if (isOtherInput) return;

      // 1. Tab key behavior: Seamless switch between Search and Table
      if (e.key === 'Tab') {
        if (!isSearchFocused) {
          // Anywhere in table / panel -> Tab jumps straight into search box
          e.preventDefault();
          searchEl.focus();
          if (typeof searchEl.select === 'function') searchEl.select();
          return;
        } else {
          // Inside search bar -> Tab jumps directly into table first row
          e.preventDefault();
          searchEl.blur();
          if (directory.length > 0) {
            partyFocusIdx = partyFocusIdx < 0 ? 0 : partyFocusIdx;
            highlightPartyListFocus();
            const p = directory[partyFocusIdx];
            if (p) selectParty(p);
          }
          return;
        }
      }

      // 2. While inside Search Bar
      if (isSearchFocused) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          e.preventDefault();
          searchEl.blur();
          if (directory.length > 0) {
            partyFocusIdx = partyFocusIdx < 0 ? 0 : partyFocusIdx;
            highlightPartyListFocus();
            const p = directory[partyFocusIdx];
            if (p) selectParty(p);
            if (e.key === 'Enter' && p) {
              openStatement();
            }
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          searchEl.value = '';
          loadDirectory();
          searchEl.blur();
          return;
        }
        return; // standard typing
      }

      // 3. Shortcuts while in Directory Table / Panel
      if (e.key === '/' || (e.ctrlKey && (e.key === 'f' || e.key === 'F'))) {
        e.preventDefault();
        searchEl.focus();
        if (typeof searchEl.select === 'function') searchEl.select();
        return;
      }

      // Insert / Alt+C / Ctrl+N -> Create Ledger
      if (e.key === 'Insert' || (e.altKey && (e.key === 'c' || e.key === 'C')) || (e.ctrlKey && (e.key === 'n' || e.key === 'N'))) {
        if (isAdmin) {
          e.preventDefault();
          openLedgerForm(null);
          return;
        }
      }

      // F2 / Ctrl+E -> Edit Ledger
      if (e.key === 'F2' || (e.ctrlKey && (e.key === 'e' || e.key === 'E'))) {
        if (selected && selected.ledgerId && isAdmin) {
          e.preventDefault();
          openLedgerForm(selected);
          return;
        }
      }

      // Delete -> Delete Ledger
      if (e.key === 'Delete' || e.key === 'Del') {
        if (selected && selected.ledgerId && isAdmin) {
          e.preventDefault();
          deleteParty(selected);
          return;
        }
      }

      if (!tbodyEl) return;
      const rows = tbodyEl.querySelectorAll('tr');
      if (!rows.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const oldIdx = partyFocusIdx;
        partyFocusIdx = partyFocusIdx < 0 ? 0 : Math.min(partyFocusIdx + 1, directory.length - 1);
        if (partyFocusIdx === oldIdx && selected && selected.partyName === (directory[partyFocusIdx] || {}).partyName) {
          return; // Already at bottom boundary, no-op
        }
        const p = directory[partyFocusIdx];
        if (p) selectParty(p);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const oldIdx = partyFocusIdx;
        partyFocusIdx = partyFocusIdx < 0 ? directory.length - 1 : Math.max(partyFocusIdx - 1, 0);
        if (partyFocusIdx === oldIdx && selected && selected.partyName === (directory[partyFocusIdx] || {}).partyName) {
          return; // Already at top boundary, no-op
        }
        const p = directory[partyFocusIdx];
        if (p) selectParty(p);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const p = (partyFocusIdx >= 0 ? directory[partyFocusIdx] : null) || selected;
        if (!p) return;
        selectParty(p, true).then(() => openStatement());
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const p = (partyFocusIdx >= 0 ? directory[partyFocusIdx] : null) || selected;
        if (p) selectParty(p, true).then(() => openStatement());
      }
    }
    document.addEventListener('keydown', partyListKeyHandler);

    const partySummaryCache = new Map();
    let partySummaryDebounce = null;
    let partySummaryReqId = 0;

    async function selectParty(p, immediate = false) {
      if (!p) return;
      selected = p;
      
      const targetIdx = directory.indexOf(p);
      if (targetIdx !== -1) {
        partyFocusIdx = targetIdx;
      }
      
      // Update DOM UI immediately (0ms latency, zero lag!)
      highlightPartyListFocus();

      document.getElementById('plHeaderTitle').innerHTML =
        `<strong>${p.partyName}</strong> ${p.shortName ? ` <span class="pl-short-code-badge">${p.shortName}</span>` : ''} <span class="p-tag ${(p.type||'both').toLowerCase()}">${p.type}</span>`;
      document.getElementById('btnEditLedger').style.display = p.ledgerId ? 'inline-flex' : 'none';
      document.getElementById('btnDeleteLedger').style.display = p.ledgerId && isAdmin ? 'inline-flex' : 'none';
      document.getElementById('btnRegisterLedger').style.display = !p.ledgerId ? 'inline-flex' : 'none';
      document.getElementById('btnOpenStatement').style.display = 'inline-flex';
      document.getElementById('plSummaryGrid').style.display = 'flex';

      // Check In-Memory Cache first:
      const cacheKey = `${p.partyName}::${p.type}`;
      if (partySummaryCache.has(cacheKey)) {
        const cached = partySummaryCache.get(cacheKey);
        selectedRows = cached.rows;
        document.getElementById('plSumIn').textContent = cached.inCount;
        document.getElementById('plSumOut').textContent = cached.outCount;
        document.getElementById('plSumBal').textContent = cached.bal;
        return p;
      }

      // Show temporary indicator
      document.getElementById('plSumIn').textContent = '…';
      document.getElementById('plSumOut').textContent = '…';
      document.getElementById('plSumBal').textContent = '…';

      // Debounce server fetch so holding arrow keys causes ZERO server requests
      clearTimeout(partySummaryDebounce);
      const reqId = ++partySummaryReqId;

      const fetchTask = async () => {
        try {
          const rows = await fetchStatementRows(p.partyName, p.type);
          if (reqId !== partySummaryReqId) return; // Stale request, discard
          selectedRows = rows;
          const inCount = rows.filter((r) => r.movement === 'IN').length;
          const outCount = rows.filter((r) => r.movement === 'OUT').length;
          const bal = inCount - outCount;
          partySummaryCache.set(cacheKey, { rows, inCount, outCount, bal });

          if (selected && selected.partyName === p.partyName) {
            document.getElementById('plSumIn').textContent = inCount;
            document.getElementById('plSumOut').textContent = outCount;
            document.getElementById('plSumBal').textContent = bal;
          }
        } catch (err) {
          if (reqId !== partySummaryReqId) return;
          document.getElementById('plSumIn').textContent = '0';
          document.getElementById('plSumOut').textContent = '0';
          document.getElementById('plSumBal').textContent = '0';
        }
      };

      if (immediate) {
        await fetchTask();
      } else {
        partySummaryDebounce = setTimeout(fetchTask, 200);
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

    async function deleteParty(p) {
      if (!isAdmin) { window.openModal('Access Denied', '<p>Only SuperAdmin can delete ledgers.</p>'); return; }
      const target = p || selected;
      if (!target || !target.ledgerId) return;
      if (!(await window.confirmDanger('Delete Ledger', `Delete the Ledger '${target.partyName}'?`))) return;
      try {
        const res = await fetch(`${API_BASE}/ledgers/${target.ledgerId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not delete this ledger.');
        if (window.showToast) window.showToast('Ledger removed from master list.');
        if (selected && selected.ledgerId === target.ledgerId) {
          selected = null;
          selectedRows = [];
          document.getElementById('plHeaderTitle').textContent = 'Select a Party from table';
          document.getElementById('btnEditLedger').style.display = 'none';
          document.getElementById('btnDeleteLedger').style.display = 'none';
          document.getElementById('btnRegisterLedger').style.display = 'none';
          document.getElementById('btnOpenStatement').style.display = 'none';
          document.getElementById('plSummaryGrid').style.display = 'none';
        }
        await loadDirectory();
      } catch (err) {
        window.openModal('Error', `<p style="color:var(--red);">${err.message}</p>`);
      }
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
    loadDirectory();

    // ---------------- Create / Edit Ledger modal ----------------
    const lfOverlay = document.getElementById('ledgerFormOverlay');
    const lfMode = document.getElementById('lfMode');
    const lfShortInput = document.getElementById('lfShort');
    const lfGstinField = document.getElementById('lfGstinField');
    const lfGstinInput = document.getElementById('lfGstin');
    let editingLedgerId = null;

    function updateLedgerFormMode() {
      const mode = lfMode.value;
      const isCustomer = mode === 'Customer';
      const shortPlaceholders = {
        Customer: 'Enter order no. / short alias',
        Supplier: 'Enter supplier short name',
        Dealer: 'Enter dealer short name',
        Installer: 'Enter installer short name',
        Fabricator: 'Enter fabricator short name',
      };
      lfShortInput.placeholder = shortPlaceholders[mode] || 'Enter short name';
      lfGstinField.style.display = isCustomer ? 'none' : 'flex';
      if (isCustomer) lfGstinInput.value = '';
    }
    lfMode.addEventListener('change', updateLedgerFormMode);

    // Locks/unlocks background page scroll while a fullscreen modal is open.
    function lockPageScroll() {
      if (typeof window.lockBackgroundScroll === 'function') window.lockBackgroundScroll();
      else document.body.classList.add('no-scroll');
    }
    function unlockPageScroll() {
      if (typeof window.unlockBackgroundScroll === 'function') window.unlockBackgroundScroll();
      else document.body.classList.remove('no-scroll');
    }

    let lfEscHandler = null;
    function attachLedgerFormEscape() {
      lfEscHandler = (e) => {
        if (e.key === 'Escape') closeLedgerForm();
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          document.getElementById('lfSave').click();
        }
      };
      document.addEventListener('keydown', lfEscHandler);
    }
    function detachLedgerFormEscape() {
      if (lfEscHandler) { document.removeEventListener('keydown', lfEscHandler); lfEscHandler = null; }
    }

    // Fast Enter-key navigation between ledger form inputs (Tally style)
    const lfInputs = [
      document.getElementById('lfName'),
      document.getElementById('lfShort'),
      document.getElementById('lfMobile'),
      document.getElementById('lfAddress'),
      document.getElementById('lfGstin')
    ].filter(Boolean);

    lfInputs.forEach((inp) => {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            document.getElementById('lfSave').click();
            return;
          }
          const visibleInputs = lfInputs.filter((el) => el.offsetParent !== null);
          const currentVisibleIdx = visibleInputs.indexOf(inp);
          if (currentVisibleIdx >= 0 && currentVisibleIdx < visibleInputs.length - 1) {
            visibleInputs[currentVisibleIdx + 1].focus();
            if (typeof visibleInputs[currentVisibleIdx + 1].select === 'function') {
              visibleInputs[currentVisibleIdx + 1].select();
            }
          } else {
            document.getElementById('lfSave').click();
          }
        }
      });
    });

    function openLedgerForm(editing) {
      editingLedgerId = editing ? editing.ledgerId : null;
      document.getElementById('lfName').value = editing ? editing.partyName : '';
      document.getElementById('lfShort').value = editing ? (editing.shortName || '') : '';
      document.getElementById('lfMobile').value = editing && editing.mobile !== '-' ? editing.mobile || '' : '';
      document.getElementById('lfAddress').value = editing && editing.address !== '-' ? editing.address || '' : '';
      lfGstinInput.value = editing && editing.gstin !== '-' ? editing.gstin || '' : '';
      lfMode.value = editing && ['Customer', 'Supplier', 'Dealer', 'Installer', 'Fabricator'].includes(editing.type) ? editing.type : 'Customer';
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
      setTimeout(() => {
        const nameField = document.getElementById('lfName');
        if (nameField) {
          nameField.focus();
          if (typeof nameField.select === 'function') nameField.select();
        }
      }, 80);
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
    let lfMouseDownTarget = null;
    if (lfOverlay) {
      lfOverlay.addEventListener('mousedown', (e) => { lfMouseDownTarget = e.target; });
      lfOverlay.addEventListener('click', (e) => {
        if (e.target === lfOverlay && lfMouseDownTarget === lfOverlay) closeLedgerForm();
      });
    }

    document.getElementById('lfSave').addEventListener('click', async () => {
      const name = document.getElementById('lfName').value.trim();
      if (!name) {
        if (window.showWarning) window.showWarning('Missing Info', 'Ledger Name is required.');
        else window.openModal('Missing Info', '<p>Ledger Name is required.</p>');
        return;
      }
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
        if (window.showToast) window.showToast(editingLedgerId ? 'Ledger updated successfully!' : 'Ledger created successfully!', 'success');
        await loadDirectory();
      } catch (err) {
        if (window.showError) window.showError('Could Not Save', err.message);
        else window.openModal('Could Not Save', `<p style="color:var(--red);">${err.message}</p>`);
      }
    });

    document.getElementById('btnDeleteLedger').addEventListener('click', () => deleteParty(selected));

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
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
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
    const btnEditVoucher = document.getElementById('btnEditVoucher');
    const btnDeleteVoucher = document.getElementById('btnDeleteVoucher');
    if (btnEditVoucher) btnEditVoucher.addEventListener('click', () => {
      if (stRef) editVoucher(stRef.movement, stRef.key);
    });
    if (btnDeleteVoucher) btnDeleteVoucher.addEventListener('click', () => {
      if (stRef) deleteVoucher(stRef.movement, stRef.key);
    });
    let stMouseDownTarget = null;
    if (stOverlay) {
      stOverlay.addEventListener('mousedown', (e) => { stMouseDownTarget = e.target; });
      stOverlay.addEventListener('click', (e) => {
        if (e.target === stOverlay && stMouseDownTarget === stOverlay) closeStatement();
      });
    }
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
      updateVoucherBar();
      stmtCurrentRow = 0;
      highlightStatementRow(0);
    }

    function updateVoucherBar() {
      const bar = document.getElementById('stmtVoucherBar');
      const label = document.getElementById('stmtVoucherLabel');
      const printBtn = document.getElementById('stmtVoucherPrintBtn');
      if (!bar) return;
      if (stRef && stRef.key && stRef.key !== '-') {
        bar.style.display = 'flex';
        const kind = stRef.movement === 'IN' ? 'Purchase Invoice' : 'Sale / Challan';
        if (label) label.textContent = `${kind} · ${stRef.key}`;
        if (printBtn) {
          printBtn.style.display = stRef.movement === 'OUT' ? 'inline-flex' : 'none';
        }
      } else {
        bar.style.display = 'none';
      }
    }

    function exportVoucherSerialsExcel(rows, refName) {
      if (!rows || !rows.length) {
        if (window.showToast) window.showToast('No records found for this voucher.', 'warning');
        return;
      }
      const serials = rows.map((r) => r.serial_no).filter((s) => s && s !== '-' && String(s).trim());
      if (!serials.length) {
        if (window.showToast) window.showToast('No serial numbers found for this voucher.', 'warning');
        return;
      }

      const cleanRef = String(refName || 'Voucher').replace(/[/\\?%*:|"<>]/g, '-').trim();
      const partyName = selected ? String(selected.short_name || selected.name || selected.partyName || '').replace(/[/\\?%*:|"<>]/g, '-').trim() : '';
      const fileName = partyName && cleanRef ? `${cleanRef} - ${partyName}.xlsx` : `${cleanRef || 'Serials'}.xlsx`;

      if (typeof XLSX !== 'undefined') {
        const data = [
          ['Sr. No.', 'Serial No.']
        ];
        serials.forEach((sn, idx) => {
          data.push([idx + 1, sn]);
        });

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 12 }, { wch: 32 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Serials');

        XLSX.writeFile(wb, fileName);
        if (window.showToast) window.showToast(`Exported ${serials.length} serial(s) to ${fileName}`, 'success');
      } else {
        window.location.href = `/api/serials/download-excel/${encodeURIComponent(refName)}`;
      }
    }

    const stmtVoucherExportSerialsBtn = document.getElementById('stmtVoucherExportSerialsBtn');
    if (stmtVoucherExportSerialsBtn) {
      stmtVoucherExportSerialsBtn.addEventListener('click', () => {
        if (stRef && stRef.key && stRef.key !== '-') {
          const matched = selectedRows.filter((r) => r.date === stDate && r.movement === stRef.movement && r.ref_key === stRef.key);
          exportVoucherSerialsExcel(matched, stRef.key);
        }
      });
    }

    const stmtVoucherPrintBtn = document.getElementById('stmtVoucherPrintBtn');
    if (stmtVoucherPrintBtn) {
      stmtVoucherPrintBtn.addEventListener('click', () => {
        if (stRef && stRef.key && stRef.key !== '-') {
          const matched = selectedRows.filter((r) => r.movement === stRef.movement && r.ref_key === stRef.key);
          const chNo = (matched[0] && matched[0].chalan_no && matched[0].chalan_no !== '-') ? matched[0].chalan_no : stRef.key;
          if (typeof window.printChallanByNo === 'function') {
            window.printChallanByNo(chNo, {
              rows: matched,
              partyName: selected ? selected.partyName : '',
              address: selected ? selected.address : '',
              mobile: selected ? selected.mobile : '',
              date: stDate
            });
          }
        }
      });
    }
    const stmtVoucherEditBtn = document.getElementById('stmtVoucherEditBtn');
    if (stmtVoucherEditBtn) {
      stmtVoucherEditBtn.addEventListener('click', () => {
        if (stRef && stRef.key && stRef.key !== '-') {
          editVoucher(stRef.movement, stRef.key);
        }
      });
    }
    const stmtVoucherDelBtn = document.getElementById('stmtVoucherDelBtn');
    if (stmtVoucherDelBtn) {
      stmtVoucherDelBtn.addEventListener('click', () => {
        if (stRef && stRef.key && stRef.key !== '-') {
          deleteVoucher(stRef.movement, stRef.key);
        }
      });
    }

    async function editVoucher(movement, refKey) {
      if (!refKey || refKey === '-') {
        window.openModal('Cannot Edit', '<p>This row has no invoice/challan number, so it cannot be opened for edit.</p>');
        return;
      }
      closeStatement();
      if (movement === 'IN') {
        if (typeof go === 'function') go('purchase');
        setTimeout(() => {
          if (window.PurchasePageAPI && typeof window.PurchasePageAPI.loadInvoiceForEdit === 'function') {
            window.PurchasePageAPI.loadInvoiceForEdit(refKey);
          } else if (window.showToast) {
            window.showToast('Open Purchase Inward and search invoice: ' + refKey);
          }
        }, 120);
      } else {
        if (typeof go === 'function') go('sales');
        setTimeout(() => {
          if (window.SalesPageAPI && typeof window.SalesPageAPI.loadChallanForEdit === 'function') {
            window.SalesPageAPI.loadChallanForEdit(refKey);
          } else if (window.showToast) {
            window.showToast('Open Project Sales and search challan: ' + refKey);
          }
        }, 120);
      }
    }

    async function deleteVoucher(movement, refKey) {
      if (!refKey || refKey === '-') {
        window.openModal('Cannot Delete', '<p>This row has no invoice/challan number.</p>');
        return;
      }
      const kind = movement === 'IN' ? 'purchase invoice' : 'sale / challan';
      const ok = await window.confirmDanger(
        'Delete voucher?',
        `Permanently delete ${kind} <b>${refKey}</b>?<br><br>` +
        (movement === 'IN'
          ? 'Stock rows for this purchase will be removed (only if none are already sold).'
          : 'Sold items will return to Available stock and the sale link will be cleared.')
      );
      if (!ok) return;
      try {
        if (movement === 'IN') {
          await window.Api.delete('/purchase/' + encodeURIComponent(refKey));
        } else {
          await window.Api.delete('/sales/delete/' + encodeURIComponent(refKey));
        }
        if (window.showToast) window.showToast('Voucher deleted.');
        // Refresh statement data
        selectedRows = await fetchStatementRows(selected.partyName, selected.type);
        stRef = null;
        renderSummary();
        renderLevel();
      } catch (err) {
        window.openModal('Delete failed', `<p>${(err && err.message) || 'Could not delete this voucher.'}</p>`);
      }
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
        } else if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          e.stopImmediatePropagation();
        } else if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) {
          e.preventDefault();
          goBackLevel();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (stMonth === null) closeStatement();
          else goBackLevel();
        } else if (e.ctrlKey && (e.key === 'e' || e.key === 'E')) {
          e.preventDefault();
          document.getElementById('btnExportStatement').click();
        }
      };
      document.addEventListener('keydown', stmtKeyHandler);
    }
    function detachStatementKeyboardNav() {
      if (stmtKeyHandler) { document.removeEventListener('keydown', stmtKeyHandler); stmtKeyHandler = null; }
    }

    function renderSummary() {
      const inRows = selectedRows.filter((r) => r.movement === 'IN');
      const outRows = selectedRows.filter((r) => r.movement === 'OUT');
      
      const inVouchers = new Set(inRows.map((r) => r.ref_key || r.purchase_invoice || r.date)).size;
      const outVouchers = new Set(outRows.map((r) => r.ref_key || r.chalan_no || r.sales_invoice || r.date)).size;
      
      const formatQty = (n) => Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');

      // UOM breakdown calculation
      const uomTotals = {};
      selectedRows.forEach((r) => {
        const uom = r.uom || 'Nos';
        const qty = Number(r.quantity) || 1;
        uomTotals[uom] = (uomTotals[uom] || 0) + qty;
      });

      const elIn = document.getElementById('stmtIn');
      const elOut = document.getElementById('stmtOut');
      const elBal = document.getElementById('stmtBal');
      const elInSub = document.getElementById('stmtInSub');
      const elOutSub = document.getElementById('stmtOutSub');
      const elBalSub = document.getElementById('stmtBalSub');
      const chipsEl = document.getElementById('stmtUomChips');

      if (elIn) elIn.textContent = inVouchers;
      if (elInSub) elInSub.textContent = `${inRows.length} Inward item line${inRows.length === 1 ? '' : 's'}`;
      if (elOut) elOut.textContent = outVouchers;
      if (elOutSub) elOutSub.textContent = `${outRows.length} Outward item line${outRows.length === 1 ? '' : 's'}`;
      if (elBal) elBal.textContent = inVouchers + outVouchers;
      if (elBalSub) elBalSub.textContent = `${selectedRows.length} Total line entries`;

      if (chipsEl) {
        const entries = Object.entries(uomTotals);
        if (!entries.length) {
          chipsEl.innerHTML = '<span style="font-size:12px; color:var(--txt-muted); font-style:italic;">No stock movements recorded</span>';
        } else {
          chipsEl.innerHTML = entries.map(([uom, qty]) => `
            <span class="pill" style="background:rgba(56,189,248,0.12); color:var(--blue); border:1px solid rgba(56,189,248,0.25); font-size:12px; font-weight:700; padding:3px 10px; display:inline-flex; align-items:center; gap:5px;">
              <span style="color:var(--txt); font-weight:800;">${formatQty(qty)}</span> ${uom}
            </span>
          `).join('');
        }
      }
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
      if (row.sales_invoice) parts.push(`INV:${row.sales_invoice}`);
      if (row.chalan_no) parts.push(`CH:${row.chalan_no}`);
      if (row.order_no) parts.push(`ORD:${row.order_no}`);
      return parts.join(' | ') || '-';
    }

    function renderMonths(tbody) {
      setHead(['Month', 'Total Vouchers', 'Inward Lines', 'Outward Lines']);
      const months = {};
      selectedRows.forEach((r) => {
        const key = monthKey(r.date);
        if (!months[key]) months[key] = { in: 0, out: 0, inRefs: new Set(), outRefs: new Set(), label: monthLabel(key) };
        if (r.movement === 'IN') {
          months[key].in++;
          months[key].inRefs.add(r.ref_key || r.purchase_invoice || r.date);
        } else {
          months[key].out++;
          months[key].outRefs.add(r.ref_key || r.chalan_no || r.sales_invoice || r.date);
        }
      });
      const keys = Object.keys(months).sort((a, b) => b.localeCompare(a));
      keys.forEach((key) => {
        const info = months[key];
        const vCount = info.inRefs.size + info.outRefs.size;
        const tr = document.createElement('tr');
        tr.className = 'stmt-table-row';
        tr.innerHTML = `<td data-label="Month">📅 ${monthLabel(key)}</td>
          <td data-label="Total" style="text-align:center; font-weight:700;">${vCount} <small style="font-weight:400; color:var(--txt-muted);">(${info.in + info.out} items)</small></td>
          <td data-label="Inward" style="text-align:center; color:#2ECC71; font-weight:700;">${info.inRefs.size} <small style="font-weight:400;">(${info.in} items)</small></td>
          <td data-label="Outward" style="text-align:center; color:var(--red); font-weight:700;">${info.outRefs.size} <small style="font-weight:400;">(${info.out} items)</small></td>`;
        tr.addEventListener('click', () => {
          stMonth = key;
          renderLevel();
        });
        tbody.appendChild(tr);
      });
    }

    function renderDates(tbody) {
      setHead(['Date', 'Total Vouchers', 'Inward Lines', 'Outward Lines']);
      const dates = {};
      selectedRows.filter((r) => monthKey(r.date) === stMonth).forEach((r) => {
        if (!dates[r.date]) dates[r.date] = { in: 0, out: 0, inRefs: new Set(), outRefs: new Set(), dt: parseDate(r.date) || 0 };
        if (r.movement === 'IN') {
          dates[r.date].in++;
          dates[r.date].inRefs.add(r.ref_key || r.purchase_invoice || r.date);
        } else {
          dates[r.date].out++;
          dates[r.date].outRefs.add(r.ref_key || r.chalan_no || r.sales_invoice || r.date);
        }
      });
      Object.keys(dates).sort((a, b) => dates[b].dt - dates[a].dt).forEach((dateKey) => {
        const info = dates[dateKey];
        const vCount = info.inRefs.size + info.outRefs.size;
        const tr = document.createElement('tr');
        tr.className = 'stmt-table-row';
        tr.innerHTML = `<td data-label="Date">🗓️ ${dateKey}</td>
          <td data-label="Total" style="text-align:center; font-weight:700;">${vCount} <small style="font-weight:400; color:var(--txt-muted);">(${info.in + info.out} items)</small></td>
          <td data-label="Inward" style="text-align:center; color:#2ECC71; font-weight:700;">${info.inRefs.size} <small style="font-weight:400;">(${info.in} items)</small></td>
          <td data-label="Outward" style="text-align:center; color:var(--red); font-weight:700;">${info.outRefs.size} <small style="font-weight:400;">(${info.out} items)</small></td>`;
        tr.addEventListener('click', () => {
          stDate = dateKey;
          renderLevel();
        });
        tbody.appendChild(tr);
      });
    }

    function renderRefs(tbody) {
      setHead(['Voucher / Challan / Invoice No', 'Movement', 'Lines', 'Quantity Summary', 'Category', 'Warehouse', 'Actions']);
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
        const uomSub = {};
        g.rows.forEach((r) => {
          const uom = r.uom || 'Nos';
          uomSub[uom] = (uomSub[uom] || 0) + (Number(r.quantity) || 1);
        });
        const summaryText = Object.entries(uomSub)
          .map(([uom, q]) => `${Number.isInteger(q) ? q : q.toFixed(2).replace(/\.?0+$/, '')} ${uom}`)
          .join(', ');

        const tr = document.createElement('tr');
        tr.className = 'stmt-table-row';
        const canAct = g.ref && g.ref !== '-';
        tr.innerHTML = `<td data-label="Ref">🧾 ${refDisplay(g.first)}</td>
          <td data-label="Movement" style="text-align:center; font-weight:700; color:${g.movement === 'IN' ? '#2ECC71' : 'var(--red)'};">${g.movement === 'IN' ? 'INWARD' : 'OUTWARD'}</td>
          <td data-label="Lines" style="text-align:center; font-weight:700;">${g.rows.length}</td>
          <td data-label="Quantity Summary" style="text-align:center; font-weight:700; color:var(--blue);">${summaryText}</td>
          <td data-label="Category" style="text-align:center;">${catText}</td>
          <td data-label="Warehouse" style="text-align:center;">${whText}</td>
          <td data-label="Actions" class="stmt-row-actions" style="text-align:center; white-space:nowrap;">
            <button type="button" class="btn btn-ghost stmt-act-export-serials" title="Export Serials Excel" style="padding:4px 8px;font-size:11px;color:#22c55e;"><i class="fa-solid fa-file-excel"></i></button>
            ${g.movement === 'OUT' && canAct ? `<button type="button" class="btn btn-ghost stmt-act-print" title="Print Challan" style="padding:4px 8px;font-size:11px;color:var(--blue);"><i class="fa-solid fa-print"></i></button>` : ''}
            <button type="button" class="btn btn-ghost stmt-act-edit" title="Edit voucher" ${canAct ? '' : 'disabled'} style="padding:4px 8px;font-size:11px;"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="btn btn-ghost stmt-act-del" title="Delete voucher" ${canAct ? '' : 'disabled'} style="padding:4px 8px;font-size:11px;color:var(--red);"><i class="fa-solid fa-trash"></i></button>
          </td>`;
        tr.addEventListener('click', (e) => {
          if (e.target.closest('.stmt-act-export-serials')) {
            e.stopPropagation();
            exportVoucherSerialsExcel(g.rows, g.ref);
            return;
          }
          if (e.target.closest('.stmt-act-print')) {
            e.stopPropagation();
            const chNo = (g.first && g.first.chalan_no && g.first.chalan_no !== '-') ? g.first.chalan_no : g.ref;
            if (typeof window.printChallanByNo === 'function') {
              window.printChallanByNo(chNo, {
                rows: g.rows,
                partyName: selected ? selected.partyName : '',
                address: selected ? selected.address : '',
                mobile: selected ? selected.mobile : '',
                date: stDate
              });
            }
            return;
          }
          if (e.target.closest('.stmt-act-edit')) {
            e.stopPropagation();
            editVoucher(g.movement, g.ref);
            return;
          }
          if (e.target.closest('.stmt-act-del')) {
            e.stopPropagation();
            deleteVoucher(g.movement, g.ref);
            return;
          }
          stRef = { movement: g.movement, key: g.ref };
          renderLevel();
        });
        tbody.appendChild(tr);
      });
    }

    function renderSerials(tbody) {
      setHead(['Date', 'Movement', 'Serial No', 'Quantity', 'Item Specs', 'Category', 'Ref/Invoice No', 'Warehouse', 'Status']);
      const matched = selectedRows.filter((r) => r.date === stDate && r.movement === stRef.movement && r.ref_key === stRef.key);
      const statusColor = { Available: '#2ECC71', Sold: 'var(--red)', Damaged: '#f39c12' };
      matched.forEach((r, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'stmt-table-row leaf';
        const serialText = (r.serial_no && String(r.serial_no).trim() !== '' && String(r.serial_no).toLowerCase() !== 'null') ? String(r.serial_no) : '-';
        const qtyNum = Number(r.quantity) || 1;
        const qtyVal = Number.isInteger(qtyNum) ? String(qtyNum) : qtyNum.toFixed(2).replace(/\.?0+$/, '');
        tr.innerHTML = `<td data-label="Date">${r.date}</td>
          <td data-label="Movement" style="font-weight:700; color:${r.movement === 'IN' ? '#2ECC71' : 'var(--red)'};">${r.movement === 'IN' ? 'INWARD' : 'OUTWARD'}</td>
          <td data-label="Serial" style="font-family:monospace; font-weight:600; color:${serialText !== '-' ? 'var(--gold)' : 'var(--txt-muted)'};">${serialText}</td>
          <td data-label="Quantity" style="text-align:center; font-weight:700; color:var(--blue);">${qtyVal} <small style="color:var(--txt-muted); font-weight:600;">${r.uom || 'Nos'}</small></td>
          <td data-label="Item" style="font-weight:600;">${r.item_name || '-'}</td>
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