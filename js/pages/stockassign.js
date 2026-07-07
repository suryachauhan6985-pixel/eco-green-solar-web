// js/pages/stockassign.js
// Mirrors ui/assign_stock.py from the desktop app: a "Reserve / Assign Stock"
// form on the left (same category/brand/wattage/type strictness as Sales —
// but reserves stock as 'Assigned' instead of 'Sold', and does NOT take a
// manual serial scan since the backend auto-picks the actual serials right
// before committing). On the right sits the "Assigned Stock Register &
// Release" panel: a live table of everything currently assigned, which you
// click to load into the Release section — Release to Firm (cancels the
// assignment, stock goes back to Available) or Release to Customer (also
// frees the stock, then would hand off to the Sales page pre-filled).
// This is a UI-only preview: nothing is sent to a server or saved anywhere.
//
// Desktop: both panels sit side by side always (no toggle button — CSS
// hides it on wide screens). Mobile (<=900px): only ONE panel is visible at
// a time. The "View Assigned Register" header button slides the register
// panel in from the side (and back). Both panels' markup sits inside
// .split-two-track, which is the element that actually gets the sliding
// transform (see css/style.css).
window.PAGES = window.PAGES || {};

window.PAGES.stockassign = {
  name: 'Stock Assign',
  icon: 'fa-hand-holding',
  sub: 'Reserve stock for a person, then release it back or to a sale',
  html: `
    <div class="page-head">
      <i class="fa-solid fa-hand-holding" style="color:var(--purple);"></i><h2>Stock Assign</h2>
      <button class="btn btn-gold btn-toggle-edit" type="button" id="assignBtnToggleEdit">
        <i class="fa-solid fa-warehouse"></i> <span id="assignToggleEditLabel">View Assigned Register</span>
      </button>
      <div class="hint">UI preview only — Reserve / Release buttons don't save anywhere yet, no backend is connected.</div>
    </div>

    <div class="split-two edit-closed" id="assignSplit">
      <div class="split-two-track">

        <!-- ================= NEW ASSIGNMENT ================= -->
        <div class="panel">
          <h3><i class="fa-solid fa-hand-holding"></i> Reserve / Assign Stock</h3>
          <div class="form-grid cols-2">
            <div class="field"><label>Category <span class="req">*</span></label>
              <select id="assignCat"><option>Solar Panel</option><option>Inverter</option><option>Battery</option></select></div>
            <div class="field"><label>Brand <span class="req">*</span></label>
              <select id="assignBrand"><option>Waaree</option><option>Adani</option><option>Vikram Solar</option></select></div>
            <div class="field"><label>Wattage <span class="req">*</span></label><input id="assignWatt" placeholder="e.g. 545"></div>
            <div class="field"><label>Type <span class="req">*</span></label>
              <select id="assignType"><option>Mono PERC</option><option>Bifacial</option></select></div>

            <div class="field"><label>Person Short Code</label><input id="assignPersonShort" placeholder="Ledger short name (optional)"></div>
            <div class="field"><label>Assign To (Person/Customer) <span class="req">*</span></label><input id="assignPerson" placeholder="Person / customer to reserve for"></div>
            <div class="field"><label>Mobile</label><input id="assignPersonMobile" placeholder="Auto-fills from ledger" readonly></div>
            <div class="field span-full"><label>Address</label><input id="assignPersonAddress" placeholder="Auto-fills from ledger" readonly></div>

            <div class="field"><label>Reference No <span class="req">*</span></label><input id="assignRef" placeholder="e.g. AR-2026-014"></div>
            <div class="field"><label>Assign Date <span class="req">*</span></label><input id="assignDate" type="date"></div>
            <div class="field span-2"><label>Remarks</label><input id="assignRemarks" placeholder="Reason / remarks (optional)"></div>

            <div class="field span-2">
              <label>Quantity <span class="req">*</span></label>
              <div style="display:flex; gap:8px; align-items:center;">
                <input id="assignQty" type="number" placeholder="Enter quantity to reserve" style="flex:1;">
                <span id="assignQtyAvailable" style="color:var(--txt-muted); font-weight:700; font-size:12.5px; white-space:nowrap;">Available: -</span>
              </div>
            </div>

            <div class="field span-full"><label>Proof Attachment (Optional)</label>
              <div class="proof-row">
                <input type="file" id="assignProofFile" multiple style="display:none;" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt">
                <button class="btn btn-ghost" type="button" id="assignBtnAttach"><i class="fa-solid fa-paperclip"></i> Attach Proof</button>
                <button class="btn btn-ghost" type="button" id="assignBtnClearProof"><i class="fa-solid fa-xmark"></i> Clear</button>
                <button class="btn btn-ghost" type="button" id="assignBtnViewProof" title="View selected proof file(s)"><i class="fa-solid fa-eye"></i></button>
                <span class="proof-name" id="assignProofName">No proof selected</span>
              </div>
            </div>

            <div class="field span-full">
              <label>Assignment Product Lines</label>
              <div class="line-list" id="assignLineList"><div class="empty">No product lines added yet — fill the fields above and click "Add Product Line".</div></div>
              <div class="line-btns">
                <button class="btn btn-green" type="button" id="assignBtnAddLine"><i class="fa-solid fa-plus"></i> Add Product Line</button>
                <button class="btn btn-ghost" type="button" id="assignBtnRemoveLine"><i class="fa-solid fa-minus"></i> Remove Line</button>
              </div>
            </div>
          </div>
          <div class="actions-row">
            <button class="btn" type="button" id="assignBtnSave" style="background:var(--purple);"><i class="fa-solid fa-check-circle"></i> Reserve / Assign Stock</button>
            <button class="btn btn-ghost" type="button" id="assignBtnClearForm"><i class="fa-solid fa-eraser"></i> Clear Form</button>
          </div>
        </div>

        <!-- ================= ASSIGNED REGISTER & RELEASE ================= -->
        <div class="panel edit-panel" id="assignRegPanel" style="border-top-color:var(--purple);">
          <h3 style="color:var(--purple);"><i class="fa-solid fa-warehouse"></i> Assigned Stock Register &amp; Release
            <button class="btn btn-ghost" type="button" id="assignBtnRefreshReg" style="margin-left:auto; padding:6px 12px; font-size:11.5px;"><i class="fa-solid fa-sync"></i> Refresh</button>
          </h3>

          <div class="search-row">
            <input id="assignSearchReg" placeholder="Search reference no, assigned-to name, brand...">
          </div>

          <div class="table-wrap">
            <table>
              <thead><tr><th>Reference No</th><th>Assigned To</th><th>Date</th><th>Brand</th><th>Wattage</th><th>Type</th><th>Qty</th></tr></thead>
              <tbody id="assignRegBody"></tbody>
            </table>
          </div>
          <div class="hint" style="width:auto; margin:8px 0 0;">Click a row to load that assignment for release.</div>

          <div class="form-grid cols-2" style="margin-top:14px;">
            <div class="field span-full"><label>Loaded Reference</label><input id="assignRelRef" value="-" readonly></div>
            <div class="field span-full">
              <label>Lines</label>
              <div class="line-list" id="assignRelLines"><div class="empty">Click a row above to load its lines.</div></div>
            </div>
            <div class="field"><label>Release Customer <span class="req">*</span></label><input id="assignRelCustomer" placeholder="Customer name for sales dispatch"></div>
            <div class="field"><label>Release Order No <span class="req">*</span></label><input id="assignRelOrder" placeholder="Order no for sales dispatch"></div>
          </div>

          <div class="actions-row">
            <button class="btn btn-ghost" type="button" id="assignBtnReleaseFirm"><i class="fa-solid fa-rotate-left"></i> Release to Firm</button>
            <button class="btn" type="button" id="assignBtnReleaseCustomer" style="background:var(--orange);"><i class="fa-solid fa-truck-fast"></i> Release to Customer</button>
          </div>
        </div>

      </div>
    </div>
  `,

  init() {
    const $ = (id) => document.getElementById(id);

    // ---------------- Date fields: click anywhere to open the native
    // calendar (not just the small icon), and block manual keyboard/paste
    // entry so the date can only ever be set by picking it from the
    // calendar. Same behaviour on desktop and mobile.
    document.querySelectorAll('#assignSplit input[type="date"]').forEach((el) => {
      el.addEventListener('click', () => {
        if (el.showPicker) { try { el.showPicker(); } catch (e) {} }
      });
      el.addEventListener('keydown', (e) => { if (e.key !== 'Tab') e.preventDefault(); });
      el.addEventListener('paste', (e) => e.preventDefault());
    });
    $('assignDate').valueAsDate = new Date();

    // ---------------- Register panel open/close (mobile slider) ----------------
    // On desktop (>900px, per CSS) both panels always sit side-by-side —
    // this toggle is effectively a no-op there since the button is hidden
    // by CSS. On mobile (<=900px) toggling "edit-closed" on #assignSplit
    // slides .split-two-track between the entry form and the register.
    const assignSplit = $('assignSplit');
    const assignToggleBtn = $('assignBtnToggleEdit');
    const assignToggleLabel = $('assignToggleEditLabel');

    function setAssignRegOpen(open) {
      assignSplit.classList.toggle('edit-closed', !open);
      assignToggleLabel.textContent = open ? 'Close Register' : 'View Assigned Register';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    assignToggleBtn.addEventListener('click', () => {
      setAssignRegOpen(assignSplit.classList.contains('edit-closed'));
    });

    // ---------------- shared helpers ----------------
    function renderLineList(container, lines, emptyText) {
      if (!lines.length) {
        container.innerHTML = `<div class="empty">${emptyText}</div>`;
        return;
      }
      container.innerHTML = lines.map((ln, idx) => `
        <div class="line-item" data-idx="${idx}">
          <span>${ln.brand} ${ln.watt ? '• ' + ln.watt + 'W' : '• N/A'} • ${ln.type}</span>
          <span class="qty-badge">Qty ${ln.qty}</span>
        </div>
      `).join('');
    }

    function wireLineSelection(container) {
      container.addEventListener('click', (e) => {
        const item = e.target.closest('.line-item');
        if (!item) return;
        container.querySelectorAll('.line-item').forEach((el) => el.classList.remove('selected'));
        item.classList.add('selected');
      });
    }

    function selectedLineIndex(container) {
      const sel = container.querySelector('.line-item.selected');
      return sel ? parseInt(sel.dataset.idx, 10) : -1;
    }

    function wireProofButtons(fileInputId, attachBtnId, clearBtnId, viewBtnId, labelId, state) {
      const fileInput = $(fileInputId);
      $(attachBtnId).addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        state.files = Array.from(fileInput.files || []);
        $(labelId).textContent = state.files.length
          ? (state.files.length === 1 ? state.files[0].name : `${state.files.length} proof files selected`)
          : 'No proof selected';
      });
      if (clearBtnId) {
        $(clearBtnId).addEventListener('click', () => {
          state.files = [];
          fileInput.value = '';
          $(labelId).textContent = 'No proof selected';
        });
      }
      $(viewBtnId).addEventListener('click', () => {
        if (!state.files.length) {
          window.openModal('Proof Missing', '<p>No proof file selected to preview.</p>');
          return;
        }
        state.files.forEach((f) => window.open(URL.createObjectURL(f), '_blank'));
      });
    }

    // Deterministic "demo available qty" so the hint number reacts to the
    // selected Category/Brand/Wattage/Type, without a real backend.
    function demoAvailableFor(cat, brand, watt, type) {
      const key = `${cat}|${brand}|${watt}|${type}`;
      let hash = 0;
      for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
      return 8 + (hash % 45);
    }

    // ---------------- NEW ASSIGNMENT panel state ----------------
    const assignLines = [];
    const assignProof = { files: [] };
    const assignLineList = $('assignLineList');
    renderLineList(assignLineList, assignLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
    wireLineSelection(assignLineList);
    wireProofButtons('assignProofFile', 'assignBtnAttach', 'assignBtnClearProof', 'assignBtnViewProof', 'assignProofName', assignProof);

    function refreshAvailableHint() {
      const cat = $('assignCat').value, brand = $('assignBrand').value;
      const watt = $('assignWatt').value.trim(), type = $('assignType').value;
      const hintEl = $('assignQtyAvailable');
      if (!cat || !brand || !type) {
        hintEl.textContent = 'Available: -';
        hintEl.style.color = 'var(--txt-muted)';
        return;
      }
      const total = demoAvailableFor(cat, brand, watt, type);
      const usedInLines = assignLines
        .filter((l) => l.cat === cat && l.brand === brand && l.watt === watt && l.type === type)
        .reduce((sum, l) => sum + Number(l.qty), 0);
      const remaining = total - usedInLines;
      hintEl.textContent = `Available: ${remaining}`;
      hintEl.style.color = remaining > 0 ? '#2ECC71' : 'var(--red)';
    }
    ['assignCat', 'assignBrand', 'assignWatt', 'assignType'].forEach((id) => {
      $(id).addEventListener('input', refreshAvailableHint);
      $(id).addEventListener('change', refreshAvailableHint);
    });
    refreshAvailableHint();

    $('assignBtnAddLine').addEventListener('click', () => {
      const cat = $('assignCat').value, brand = $('assignBrand').value, watt = $('assignWatt').value.trim();
      const type = $('assignType').value, qty = $('assignQty').value.trim();
      if (!qty || Number(qty) <= 0) {
        window.openModal('Validation Error', '<p>Enter a valid Quantity before adding a product line.</p>');
        return;
      }
      const total = demoAvailableFor(cat, brand, watt, type);
      const usedInLines = assignLines
        .filter((l) => l.cat === cat && l.brand === brand && l.watt === watt && l.type === type)
        .reduce((sum, l) => sum + Number(l.qty), 0);
      if (Number(qty) > total - usedInLines) {
        window.openModal('Stock Not Available', `<p>Only ${total - usedInLines} unit(s) of ${brand} | ${watt ? watt + 'W' : 'N/A'} | ${type} are currently Available to reserve. Cannot assign ${qty}.</p>`);
        return;
      }
      assignLines.push({ cat, brand, watt, type, qty });
      renderLineList(assignLineList, assignLines, '');
      $('assignQty').value = '';
      refreshAvailableHint();
    });
    $('assignBtnRemoveLine').addEventListener('click', () => {
      const idx = selectedLineIndex(assignLineList);
      if (idx === -1) return;
      assignLines.splice(idx, 1);
      renderLineList(assignLineList, assignLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
      refreshAvailableHint();
    });

    function clearAssignForm() {
      ['assignPersonShort', 'assignPerson', 'assignPersonMobile', 'assignPersonAddress', 'assignRef', 'assignRemarks', 'assignQty'].forEach((id) => { $(id).value = ''; });
      $('assignWatt').value = '';
      $('assignDate').valueAsDate = new Date();
      assignLines.length = 0;
      renderLineList(assignLineList, assignLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
      assignProof.files = [];
      $('assignProofFile').value = '';
      $('assignProofName').textContent = 'No proof selected';
      refreshAvailableHint();
    }
    $('assignBtnClearForm').addEventListener('click', clearAssignForm);

    $('assignBtnSave').addEventListener('click', () => {
      const missing = [];
      if (!$('assignPerson').value.trim()) missing.push('Assign To (Person/Customer)');
      if (!$('assignRef').value.trim()) missing.push('Reference No');
      if (!assignLines.length && !$('assignQty').value.trim()) missing.push('Quantity (or add at least one product line)');
      if (missing.length) {
        window.openModal('Validation Error', `<p>Please fill: ${missing.join(', ')}.</p>`);
        return;
      }
      window.openModal('Preview Only', '<p>This is a UI preview — the assignment looks good, but no backend is connected yet, so nothing was actually reserved. On the real app, matching serials are auto-picked and marked \'Assigned\' (removed from Available stock) right now.</p>');
    });

    // ---------------- ASSIGNED REGISTER (demo data) ----------------
    const demoRegisterRows = [
      { ref: 'AR-2026-014', person: 'Ramesh Site Team', date: '01-07-2026', brand: 'Waaree', watt: '545', type: 'Mono PERC', qty: '5' },
      { ref: 'AR-2026-013', person: 'Shah Enterprises', date: '28-06-2026', brand: 'Adani', watt: '', type: 'Mono PERC', qty: '2' },
    ];
    const assignRegBody = $('assignRegBody');

    function renderRegisterTable() {
      const term = $('assignSearchReg').value.trim().toLowerCase();
      const rows = demoRegisterRows.filter((r) => !term || Object.values(r).some((v) => String(v).toLowerCase().includes(term)));
      if (!rows.length) {
        assignRegBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--txt-muted); font-style:italic;">No assigned stock found.</td></tr>`;
        return;
      }
      assignRegBody.innerHTML = rows.map((r) => `
        <tr class="assign-reg-row" data-ref="${r.ref}" style="cursor:pointer;">
          <td class="gold-txt" data-label="Reference No">${r.ref}</td>
          <td data-label="Assigned To">${r.person}</td>
          <td data-label="Date">${r.date}</td>
          <td data-label="Brand">${r.brand}</td>
          <td data-label="Wattage">${r.watt ? r.watt + 'W' : 'N/A'}</td>
          <td data-label="Type">${r.type}</td>
          <td data-label="Qty">${r.qty}</td>
        </tr>
      `).join('');
    }
    renderRegisterTable();
    $('assignSearchReg').addEventListener('input', renderRegisterTable);
    $('assignBtnRefreshReg').addEventListener('click', renderRegisterTable);

    // ---------------- RELEASE panel state ----------------
    let loadedRef = null;
    const assignRelLines = $('assignRelLines');

    function clearReleasePanel() {
      loadedRef = null;
      $('assignRelRef').value = '-';
      assignRelLines.innerHTML = '<div class="empty">Click a row above to load its lines.</div>';
      $('assignRelCustomer').value = '';
      $('assignRelOrder').value = '';
    }

    assignRegBody.addEventListener('click', (e) => {
      const row = e.target.closest('.assign-reg-row');
      if (!row) return;
      const ref = row.dataset.ref;
      const data = demoRegisterRows.find((r) => r.ref === ref);
      if (!data) return;
      loadedRef = ref;
      $('assignRelRef').value = ref;
      assignRelLines.innerHTML = `
        <div class="line-item">
          <span>${data.brand} ${data.watt ? '• ' + data.watt + 'W' : '• N/A'} • ${data.type}</span>
          <span class="qty-badge">Qty ${data.qty}</span>
        </div>`;
      $('assignRelCustomer').value = data.person;
      $('assignRelOrder').value = ref;
      window.openModal('Assignment Loaded', `<p>Loaded demo data for <strong>${ref}</strong> into the release panel below (preview only — not a real database lookup yet).</p>`);
    });

    $('assignBtnReleaseFirm').addEventListener('click', () => {
      if (!loadedRef) {
        window.openModal('Nothing Loaded', '<p>Click an assignment row above first to load it for release.</p>');
        return;
      }
      window.openModal('Preview Only', `<p>This is a UI preview — assignment <strong>${loadedRef}</strong> would be cancelled and its stock returned to the Available pool, but no backend is connected yet, so nothing was actually released.</p>`);
      clearReleasePanel();
    });

    $('assignBtnReleaseCustomer').addEventListener('click', () => {
      if (!loadedRef) {
        window.openModal('Nothing Loaded', '<p>Click an assignment row above first to load it for release.</p>');
        return;
      }
      if (!$('assignRelCustomer').value.trim() || !$('assignRelOrder').value.trim()) {
        window.openModal('Validation Error', '<p>Release Customer and Release Order No are required.</p>');
        return;
      }
      window.openModal('Preview Only', `<p>This is a UI preview — stock for <strong>${loadedRef}</strong> would be released and you'd be redirected to Project Sales with Customer, Order No, and product lines pre-filled, ready to just add a Challan No and dispatch. No backend is connected yet, so nothing was actually released.</p>`);
      clearReleasePanel();
    });
  },
};