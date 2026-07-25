// js/pages/stockassign.js
// Mirrors ui/assign_stock.py from the desktop app: a "Reserve / Assign Stock"
// form on the left (same category/brand/wattage/type strictness as Sales —
// but reserves stock as 'Assigned' instead of 'Sold', and does NOT take a
// manual serial scan since the backend auto-picks the actual serials right
// before committing). On the right sits the "Assigned Stock Register &
// Release" panel: a live table of everything currently assigned, which you
// click to load into the Release section — Release to Firm (cancels the
// assignment, stock goes back to Available) or Release to Customer (also
// frees the stock, then hands off to the Sales page pre-filled, exactly
// like the desktop app's releaseToCustomerRequested signal).
//
// Connected to the real backend (/api/stockassign/*, see server.js), which
// reads/writes the same stock_ledger table the desktop .py app uses —
// Category/Brand/Wattage/Type load live from the database (same source as
// Purchase/Sales), the "Available: N" hint is a real live count, and
// Reserve / Release actually commit to the database. Nothing here is an
// in-memory/mock preview any more.
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
      <div class="hint">Connected to Live Production Database via Node API.</div>
    </div>

    <div class="split-two edit-closed" id="assignSplit">
      <div class="split-two-track">

        <!-- ================= NEW ASSIGNMENT ================= -->
        <div class="panel">
          <h3><i class="fa-solid fa-hand-holding"></i> Reserve / Assign Stock</h3>
          <div class="form-grid cols-2">
            <div class="field"><label>Category <span class="req">*</span></label>
              <select id="assignCat"><option value="">Loading...</option></select></div>
            <div class="field"><label>Brand <span class="req">*</span></label>
              <select id="assignBrand"><option value="">-- Select Category First --</option></select></div>
            <div class="field"><label>Wattage <span class="req">*</span></label>
              <select id="assignWatt"><option value="">-- Select Brand First --</option></select></div>
            <div class="field"><label>Type <span class="req">*</span></label>
              <select id="assignType"><option value="">-- Select Category First --</option></select></div>

            <div class="field"><label>Person Short Code</label><input id="assignPersonShort" placeholder="Ledger short name (optional)" list="assignPersonShortList" autocomplete="off"><datalist id="assignPersonShortList"></datalist></div>
            <div class="field"><label>Assign To (Person/Customer) <span class="req">*</span></label><input id="assignPerson" placeholder="Person / customer to reserve for" list="assignPersonList" autocomplete="off"><datalist id="assignPersonList"></datalist></div>
            <div class="field"><label>Mobile</label><input id="assignPersonMobile" placeholder="Auto-fills from ledger (editable)"></div>
            <div class="field span-full"><label>Address</label><input id="assignPersonAddress" placeholder="Auto-fills from ledger (editable)"></div>

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
                <button class="btn btn-ghost" type="button" id="assignBtnAttach"><i class="fa-solid fa-paperclip"></i> Add Attachment</button>
                <button class="btn btn-ghost" type="button" id="assignBtnClearProof"><i class="fa-solid fa-xmark"></i> Clear All</button>
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
    const PD = window.PurchaseData;

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
    function fillSelect(selectEl, items, placeholder) {
      if (!items || !items.length) {
        selectEl.innerHTML = `<option value="">${placeholder}</option>`;
        return;
      }
      selectEl.innerHTML = items.map((v) => `<option value="${v}">${v}</option>`).join('');
    }

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

    // "Add Attachment" always ADDS to the existing selection instead of
    // replacing it — click it once, pick a file, click it again, pick
    // another, and both stay attached (as clickable chips). Click a chip's
    // name to open that exact file in a new tab (no separate "eye" view
    // button needed); click its small x to remove just that one file.
    // "Clear All" wipes the whole list. Mirrors js/pages/purchase.js and
    // js/pages/sales.js's wireProofButtons() exactly.
    function wireProofButtons(fileInputId, attachBtnId, clearBtnId, labelId, state) {
      const fileInput = $(fileInputId);
      const labelEl = $(labelId);

      function renderFileList() {
        if (!state.files.length) {
          labelEl.textContent = 'No proof selected';
          return;
        }
        labelEl.innerHTML = state.files.map((f, i) => `
          <span class="proof-chip" data-idx="${i}" title="Click to open ${String(f.name).replace(/"/g, '&quot;')}">${String(f.name).replace(/</g, '&lt;')}<button type="button" class="proof-chip-remove" data-idx="${i}" title="Remove this file">&times;</button></span>
        `).join('');
      }
      state.renderFileList = renderFileList;

      $(attachBtnId).addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const picked = Array.from(fileInput.files || []);
        picked.forEach((f) => {
          const isDup = state.files.some((ex) => ex.name === f.name && ex.size === f.size && ex.lastModified === f.lastModified);
          if (!isDup) state.files.push(f);
        });
        fileInput.value = ''; // reset so picking the same file again still fires 'change'
        renderFileList();
      });
      labelEl.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.proof-chip-remove');
        if (removeBtn) {
          state.files.splice(parseInt(removeBtn.dataset.idx, 10), 1);
          renderFileList();
          return;
        }
        const chip = e.target.closest('.proof-chip');
        if (chip) {
          const f = state.files[parseInt(chip.dataset.idx, 10)];
          if (f) window.open(URL.createObjectURL(f), '_blank');
        }
      });
      if (clearBtnId) {
        $(clearBtnId).addEventListener('click', () => {
          state.files = [];
          fileInput.value = '';
          renderFileList();
        });
      }
    }

    // ---------------- Category -> Brand -> Wattage -> Type cascading
    // dropdowns, fetched live from the database — same source + chain as
    // js/pages/sales.js (get_categories() / get_brands_for_category() /
    // get_wattages_for_brand_category() / get_types_for_category_brand_watt()
    // on the desktop app's side).
    const assignCatEl = $('assignCat'), assignBrandEl = $('assignBrand'), assignWattEl = $('assignWatt'), assignTypeEl = $('assignType');

    let categoryWattRules = {};
    async function loadCategoryWattRules() {
      try {
        const cats = await window.Api.get('/masters/categories');
        categoryWattRules = {};
        (cats || []).forEach((c) => { categoryWattRules[c.name] = !!c.watt_mandatory; });
      } catch (e) { categoryWattRules = {}; }
    }
    function isWattMandatory(cat) { return !!categoryWattRules[cat]; }

    async function loadAssignCategories() {
      try {
        const cats = await window.Api.get('/masters/categories');
        fillSelect(assignCatEl, (cats || []).map((c) => c.name), 'No categories found');
      } catch (e) {
        fillSelect(assignCatEl, [], 'Failed to load categories');
      }
      await refreshAssignBrandsAndWatt();
    }

    async function refreshAssignBrandsAndWatt() {
      const cat = assignCatEl.value;
      if (!cat) {
        fillSelect(assignBrandEl, [], '-- Select Category First --');
        fillSelect(assignWattEl, [], '-- Select Brand First --');
        await refreshAssignType();
        return;
      }
      try {
        const brands = await window.Api.get(`/purchase/brands/${encodeURIComponent(cat)}`);
        fillSelect(assignBrandEl, brands, 'No brands under this category');
      } catch (e) {
        fillSelect(assignBrandEl, [], 'Failed to load brands');
      }
      await refreshAssignWattage();
    }

    async function refreshAssignWattage() {
      const cat = assignCatEl.value, brand = assignBrandEl.value;
      if (!cat || !brand) {
        fillSelect(assignWattEl, [], '-- Select Brand First --');
        await refreshAssignType();
        return;
      }
      try {
        const watts = await window.Api.get(`/purchase/wattages?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}`);
        fillSelect(assignWattEl, watts.length ? watts : ['N/A'], 'N/A');
      } catch (e) {
        fillSelect(assignWattEl, ['N/A'], 'N/A');
      }
      await refreshAssignType();
    }

    async function refreshAssignType() {
      const cat = assignCatEl.value, brand = assignBrandEl.value, wattVal = assignWattEl.value;
      if (!cat) { fillSelect(assignTypeEl, [], '-- Select Category First --'); return; }
      const watt = (wattVal && wattVal !== 'N/A' && !isNaN(Number(wattVal))) ? Number(wattVal) : 0;
      let types = [];
      if (brand) {
        try { types = await window.Api.get(`/sales/types?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}&watt=${watt}`); }
        catch (e) { types = []; }
      }
      if (!types.length) {
        try {
          const subtypes = await window.Api.get(`/masters/subtypes/${encodeURIComponent(cat)}`);
          types = subtypes.length ? subtypes : ['Others'];
        } catch (e) { types = ['Others']; }
      }
      fillSelect(assignTypeEl, types, 'Others');
      refreshAvailableHint();
    }

    assignCatEl.addEventListener('change', async () => { await refreshAssignBrandsAndWatt(); refreshAvailableHint(); });
    assignBrandEl.addEventListener('change', async () => { await refreshAssignWattage(); refreshAvailableHint(); });
    assignWattEl.addEventListener('change', async () => { await refreshAssignType(); refreshAvailableHint(); });
    assignTypeEl.addEventListener('change', refreshAvailableHint);
    loadAssignCategories();
    loadCategoryWattRules();

    // ---------------- Assign-To ledger live autocomplete + autofill ----------
    // Mirrors attach_ledger_autocomplete() / attach_ledger_shortname_lookup()
    // in ui/assign_stock.py (type filter "Customer", same as Sales): as the
    // user types in Assign-To or Short Code we live-fetch matching ledgers
    // to feed the suggestion dropdown, and auto-fill Mobile/Address the
    // instant the typed text exactly matches a known ledger name/short code.
    const assignPersonList = $('assignPersonList');
    const assignPersonShortList = $('assignPersonShortList');
    let personSearchTimer = null;

    async function searchPersonLedgers(q) {
      try { return await window.Api.get(`/ledgers?type=Customer&q=${encodeURIComponent(q)}`); }
      catch (e) { return []; }
    }
    async function searchPersonShortCodes(q) {
      try { return await window.Api.get(`/ledgers/shortcodes?type=Customer&q=${encodeURIComponent(q)}`); }
      catch (e) { return []; }
    }
    function fillPersonDatalist(listEl, ledgers, key) {
      listEl.innerHTML = ledgers
        .filter((l) => String(l[key] || '').trim() !== '')
        .map((l) => `<option value="${String(l[key]).replace(/"/g, '&quot;')}">`).join('');
    }
    function applyLedgerToPersonFields(l) {
      $('assignPerson').value = l.name || '';
      $('assignPersonShort').value = l.short || '';
      $('assignPersonMobile').value = l.mobile && l.mobile !== '-' ? l.mobile : '';
      $('assignPersonAddress').value = l.address && l.address !== '-' ? l.address : '';
      if (!$('assignRef').value.trim() && l.short) $('assignRef').value = l.short;
    }
    function wirePersonAutocomplete(inputEl, listEl, matchKey, searchFn) {
      inputEl.addEventListener('input', () => {
        const text = inputEl.value;
        clearTimeout(personSearchTimer);
        personSearchTimer = setTimeout(async () => {
          const ledgers = await searchFn(text);
          fillPersonDatalist(listEl, ledgers, matchKey);
          const exact = ledgers.find((l) => String(l[matchKey] || '').trim().toLowerCase() === text.trim().toLowerCase());
          if (exact) applyLedgerToPersonFields(exact);
        }, 250);
      });
      inputEl.addEventListener('focus', async () => {
        if (inputEl.value.trim()) return;
        const ledgers = await searchFn('');
        fillPersonDatalist(listEl, ledgers, matchKey);
      });
    }
    wirePersonAutocomplete($('assignPerson'), assignPersonList, 'name', searchPersonLedgers);
    wirePersonAutocomplete($('assignPersonShort'), assignPersonShortList, 'short', searchPersonShortCodes);

    // ---------------- NEW ASSIGNMENT panel state ----------------
    const assignLines = [];
    const assignProof = { files: [] };
    const assignLineList = $('assignLineList');
    renderLineList(assignLineList, assignLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
    wireLineSelection(assignLineList);
    wireProofButtons('assignProofFile', 'assignBtnAttach', 'assignBtnClearProof', 'assignProofName', assignProof);

    // Live "Available: N" hint — real count from the database (item's
    // Available stock minus whatever is already queued up in this form's
    // own product lines), mirrors refresh_available_qty_hint().
    async function refreshAvailableHint() {
      const cat = assignCatEl.value, brand = assignBrandEl.value;
      const wattVal = assignWattEl.value, type = assignTypeEl.value;
      const hintEl = $('assignQtyAvailable');
      const watt = (wattVal && wattVal !== 'N/A' && !isNaN(Number(wattVal))) ? Number(wattVal) : 0;
      if (!cat || !brand || !type || (isWattMandatory(cat) && !watt)) {
        hintEl.textContent = 'Available: -';
        hintEl.style.color = 'var(--txt-muted)';
        return;
      }
      let total = 0;
      try {
        const resp = await window.Api.get(`/stockassign/available?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}&watt=${watt}&type=${encodeURIComponent(type)}`);
        total = resp.available || 0;
      } catch (e) { total = 0; }
      const usedInLines = assignLines
        .filter((l) => l.cat === cat && l.brand === brand && l.watt === watt && l.type === type)
        .reduce((sum, l) => sum + Number(l.qty), 0);
      const remaining = total - usedInLines;
      hintEl.textContent = `Available: ${remaining}`;
      hintEl.style.color = remaining > 0 ? '#2ECC71' : 'var(--red)';
    }
    refreshAvailableHint();

    $('assignBtnAddLine').addEventListener('click', async () => {
      const cat = assignCatEl.value, brand = assignBrandEl.value, wattVal = assignWattEl.value;
      const type = assignTypeEl.value, qty = $('assignQty').value.trim();
      const watt = (wattVal && wattVal !== 'N/A' && !isNaN(Number(wattVal))) ? Number(wattVal) : 0;

      if (!cat || !brand || !type || !qty) {
        window.openModal('Validation Error', '<p>Category, Brand, Type and Qty are required for the product line.</p>');
        return;
      }
      if (isWattMandatory(cat) && !watt) {
        window.openModal('Validation Error', `<p>Wattage/Capacity is mandatory for '${cat}' product lines.</p>`);
        return;
      }
      if (!/^\d+$/.test(qty) || Number(qty) <= 0) {
        window.openModal('Validation Error', '<p>Quantity must be a valid positive number.</p>');
        return;
      }

      let total = 0;
      try {
        const resp = await window.Api.get(`/stockassign/available?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}&watt=${watt}&type=${encodeURIComponent(type)}`);
        total = resp.available || 0;
        if (!resp.itemId) {
          window.openModal('Product Not Found', '<p>Selected product master was not found. Please create/check the master item first.</p>');
          return;
        }
      } catch (e) {
        window.openModal('Server Error', '<p>Could not verify available stock against the database. Please try again.</p>');
        return;
      }
      const usedInLines = assignLines
        .filter((l) => l.cat === cat && l.brand === brand && l.watt === watt && l.type === type)
        .reduce((sum, l) => sum + Number(l.qty), 0);
      if (Number(qty) > total - usedInLines) {
        window.openModal('Stock Not Available', `<p>Only ${total - usedInLines} unit(s) of ${brand} | ${watt ? watt + 'W' : 'N/A'} | ${type} are currently Available to reserve (Total Available: ${total}${usedInLines ? `, already added in this form: ${usedInLines}` : ''}). Cannot assign ${qty}.</p>`);
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
      assignCatEl.selectedIndex = 0;
      refreshAssignBrandsAndWatt();
      $('assignDate').valueAsDate = new Date();
      assignLines.length = 0;
      renderLineList(assignLineList, assignLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
      assignProof.files = [];
      $('assignProofFile').value = '';
      $('assignProofName').textContent = 'No proof selected';
      refreshAvailableHint();
    }
    $('assignBtnClearForm').addEventListener('click', clearAssignForm);

    $('assignBtnSave').addEventListener('click', async () => {
      const person = $('assignPerson').value.trim();
      const reference = $('assignRef').value.trim();
      const date = PD.dmyFromISO($('assignDate').value) || '-';
      const remarks = $('assignRemarks').value.trim() || '-';
      const proofName = assignProof.files.length
        ? (assignProof.files.length === 1 ? assignProof.files[0].name : `${assignProof.files.length} files`)
        : '-';

      const missing = [];
      if (!person) missing.push('Assign To (Person/Customer)');
      if (!reference) missing.push('Reference No');
      if (missing.length) {
        window.openModal('Validation Error', `<p>Please fill: ${missing.join(', ')}.</p>`);
        return;
      }

      // If the current form fields still hold an un-added line (qty
      // filled but "Add Product Line" never clicked), add it now first —
      // mirrors process_stock_assignment()'s own auto-add-current-line step.
      if ($('assignQty').value.trim()) {
        $('assignBtnAddLine').click();
        window.openModal('Line Pending', '<p>Product line details were found in the form and validated — please click <strong>Reserve / Assign Stock</strong> again to save.</p>');
        return;
      }
      if (!assignLines.length) {
        window.openModal('Validation Error', '<p>Add at least one product line (or fill Quantity) before reserving stock.</p>');
        return;
      }

      const saveBtn = $('assignBtnSave');
      saveBtn.disabled = true;
      try {
        const result = await window.Api.post('/stockassign', {
          person,
          personShort: $('assignPersonShort').value.trim(),
          mobile: $('assignPersonMobile').value.trim(),
          address: $('assignPersonAddress').value.trim(),
          reference, date, remarks, proofName,
          lines: assignLines.map((l) => ({ cat: l.cat, brand: l.brand, watt: l.watt, type: l.type, qty: Number(l.qty) })),
        });
        if (window.showToast) window.showToast('Stock reserved successfully!');
        window.openModal('Success', `<p>Stock reserved for <strong>${person}</strong> with ${result.lineCount} product line(s) and ${result.serialCount} serial(s).</p>`);
        clearAssignForm();
        loadAssignedRegister();
      } catch (err) {
        window.openModal('Reservation Error', `<p style="color:var(--red); white-space:pre-line;">${err.message}</p>`);
      } finally {
        saveBtn.disabled = false;
      }
    });

    // ---------------- ASSIGNED REGISTER (live from the database) ----------------
    let registerRows = [];
    const assignRegBody = $('assignRegBody');

    function renderRegisterTable() {
      const term = $('assignSearchReg').value.trim().toLowerCase();
      const rows = registerRows.filter((r) => !term || Object.values(r).some((v) => String(v).toLowerCase().includes(term)));
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

    async function loadAssignedRegister() {
      try {
        registerRows = await window.Api.get('/stockassign/register');
      } catch (e) {
        registerRows = [];
      }
      renderRegisterTable();
    }
    loadAssignedRegister();
    $('assignSearchReg').addEventListener('input', renderRegisterTable);
    $('assignBtnRefreshReg').addEventListener('click', loadAssignedRegister);

    // ---------------- RELEASE panel state ----------------
    let loadedRef = null;
    let loadedReleaseLines = [];
    const assignRelLines = $('assignRelLines');

    function clearReleasePanel() {
      loadedRef = null;
      loadedReleaseLines = [];
      $('assignRelRef').value = '-';
      assignRelLines.innerHTML = '<div class="empty">Click a row above to load its lines.</div>';
      $('assignRelCustomer').value = '';
      $('assignRelOrder').value = '';
    }

    assignRegBody.addEventListener('click', async (e) => {
      const row = e.target.closest('.assign-reg-row');
      if (!row) return;
      const ref = row.dataset.ref;
      let data;
      try {
        data = await window.Api.get(`/stockassign/lines/${encodeURIComponent(ref)}`);
      } catch (err) {
        window.openModal('Not Found', `<p>${err.message || 'This assignment could not be found (it may have already been released).'}</p>`);
        return;
      }
      loadedRef = data.reference;
      loadedReleaseLines = data.lines || [];
      $('assignRelRef').value = data.reference;
      renderLineList(assignRelLines, loadedReleaseLines, 'Click a row above to load its lines.');
      $('assignRelCustomer').value = data.person || '';
      $('assignRelOrder').value = data.reference;
      window.openModal('Assignment Loaded', `<p>Loaded <strong>${data.reference}</strong> into the release panel below — ${loadedReleaseLines.length} product line(s), ${data.allSerials.length} serial(s).</p>`);
    });

    $('assignBtnReleaseFirm').addEventListener('click', async () => {
      if (!loadedRef) {
        window.openModal('Nothing Loaded', '<p>Click an assignment row above first to load it for release.</p>');
        return;
      }
      const ok = await window.confirmDialog('Confirm Release', `Cancel assignment '${loadedRef}' and return its stock to Available?`, { kind: 'question', okLabel: 'Release' });
      if (!ok) return;
      try {
        const result = await window.Api.post('/stockassign/release-firm', { reference: loadedRef });
        if (window.showToast) window.showToast('Assignment released to Available stock.');
        window.openModal('Released', `<p>Assignment cancelled and ${result.serialCount} serial(s) returned to the Available pool.</p>`);
        clearReleasePanel();
        loadAssignedRegister();
      } catch (err) {
        window.openModal('Release Error', `<p>${err.message || 'Failed to release this assignment.'}</p>`);
      }
    });

    $('assignBtnReleaseCustomer').addEventListener('click', async () => {
      if (!loadedRef) {
        window.openModal('Nothing Loaded', '<p>Click an assignment row above first to load it for release.</p>');
        return;
      }
      const customer = $('assignRelCustomer').value.trim();
      const orderNo = $('assignRelOrder').value.trim();
      if (!customer || !orderNo) {
        window.openModal('Validation Error', '<p>Release Customer and Release Order No are required.</p>');
        return;
      }
      // Mirrors release_to_customer(): mobile/address handed to Sales come
      // from THIS form's own Mobile/Address fields (whichever person is
      // currently loaded up top), same coupling as the desktop app.
      const mobile = $('assignPersonMobile').value.trim();
      const address = $('assignPersonAddress').value.trim();
      const reference = loadedRef;
      try {
        const result = await window.Api.post('/stockassign/release-customer', { reference, customer, orderNo });
        if (window.showToast) window.showToast('Stock released — loaded into Project Sales.');
        clearReleasePanel();
        loadAssignedRegister();
        window.go('sales');
        if (window.SalesPageAPI && typeof window.SalesPageAPI.prefillFromAssign === 'function') {
          window.SalesPageAPI.prefillFromAssign(customer, orderNo, mobile, address, result.lines || []);
        }
      } catch (err) {
        window.openModal('Release Error', `<p>${err.message || 'Failed to release this assignment.'}</p>`);
      }
    });
  },
};
