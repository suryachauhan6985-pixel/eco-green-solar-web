// js/pages/sales.js
// Mirrors ui/sales.py from the desktop app: a "New Sales / Dispatch Entry"
// form on the left, plus a SuperAdmin "Sales Order Modification" edit panel
// on the right (Find an order -> fields load -> Apply Modifications /
// Delete). Every field that used to be hardcoded (Category, Brand, Type
// dropdown options) now loads live from the database, exactly like
// js/pages/purchase.js does for Purchase Inward — and "Confirm Dispatch" /
// "Find" / "Apply Modifications" / "Delete Transaction" all hit the real
// backend (/api/sales/*, see server.js), which reads and writes the same
// stock_ledger table the desktop .py app uses. Nothing here is an
// in-memory/mock preview any more.
window.PAGES = window.PAGES || {};

window.PAGES.sales = {
  name: 'Project Sales',
  icon: 'fa-dolly-flatbed',
  sub: 'Dispatch stock against sales orders',
  html: `
    <div class="page-head">
      <i class="fa-solid fa-dolly-flatbed" style="color:var(--orange);"></i><h2>Project Sales</h2>
      <button class="btn btn-gold btn-toggle-edit" type="button" id="saleBtnToggleEdit">
        <i class="fa-solid fa-pen-to-square"></i> <span id="saleToggleEditLabel">Edit / Modify Order</span>
      </button>
      <div class="hint">Connected to Live Production Database via Node API.</div>
    </div>

    <div class="split-two edit-closed" id="saleSplit">
      <div class="split-two-track">

        <div class="panel">
          <h3><i class="fa-solid fa-file-invoice-dollar"></i> New Sales / Dispatch Entry</h3>
          <div class="form-grid cols-2">
            <div class="field"><label>Category <span class="req">*</span></label>
              <select id="saleCat"><option value="">Loading...</option></select></div>
            <div class="field"><label>Brand <span class="req">*</span></label>
              <select id="saleBrand"><option value="">-- Select Category First --</option></select></div>
            <div class="field"><label>Wattage <span class="req">*</span></label>
              <select id="saleWatt"><option value="">-- Select Brand First --</option></select></div>
            <div class="field"><label>Type <span class="req">*</span></label>
              <select id="saleType"><option value="">-- Select Category First --</option></select></div>

            <div class="field"><label>Customer Short Code</label><input id="saleCustShort" placeholder="Ledger short name (optional)" list="saleCustShortList" autocomplete="off"><datalist id="saleCustShortList"></datalist></div>
            <div class="field"><label>Customer Name <span class="req">*</span></label><input id="saleCust" placeholder="Customer / Party" list="saleCustNameList" autocomplete="off"><datalist id="saleCustNameList"></datalist></div>
            <div class="field"><label>Mobile</label><input id="saleCustMobile" placeholder="Auto-fills from ledger (editable)"></div>
            <div class="field span-full"><label>Address / Site</label><input id="saleCustAddr" placeholder="Auto-fills from ledger (editable)"></div>

            <div class="field"><label>Order No <span class="req">*</span></label><input id="saleOrder" placeholder="NP order no."></div>
            <div class="field"><label>Challan No <span class="req">*</span></label><input id="saleChalanNo" placeholder="CH-2026-001"></div>
            <div class="field"><label>Challan Date <span class="req">*</span></label><input id="saleChalanDate" type="date"></div>
            <div class="field"><label>Sales Invoice No</label><input id="saleInvNo" placeholder="Optional"></div>
            <div class="field"><label>Invoice Date</label><input id="saleInvDate" type="date"></div>
            <div class="field"><label>Expected Qty <span class="req">*</span></label><input id="saleQty" type="number" placeholder="0"></div>

            <div class="field span-full"><label>Proof Attachment (Challan/Invoice PDF/Image)</label>
              <div class="proof-row">
                <input type="file" id="saleProofFile" multiple style="display:none;" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt">
                <button class="btn btn-ghost" type="button" id="saleBtnAttach"><i class="fa-solid fa-paperclip"></i> Add Attachment</button>
                <button class="btn btn-ghost" type="button" id="saleBtnClearProof"><i class="fa-solid fa-xmark"></i> Clear All</button>
                <span class="proof-name" id="saleProofName">No proof selected</span>
              </div>
            </div>

            <div class="field span-full"><label>Scan Serial Numbers <span class="req">*</span></label>
              <textarea id="saleSerials" placeholder="One serial per line, it auto-splits"></textarea>
            </div>

            <div class="field span-full">
              <label>Invoice Product Lines</label>
              <div class="line-list" id="saleLineList"><div class="empty">No product lines added yet — fill the fields above and click "Add Product Line".</div></div>
              <div class="line-btns">
                <button class="btn btn-green" type="button" id="saleBtnAddLine"><i class="fa-solid fa-plus"></i> Add Product Line</button>
                <button class="btn btn-ghost" type="button" id="saleBtnRemoveLine"><i class="fa-solid fa-minus"></i> Remove Line</button>
              </div>
            </div>
          </div>
          <div class="actions-row">
            <button class="btn btn-red" type="button" id="saleBtnSave"><i class="fa-solid fa-truck"></i> Confirm Dispatch</button>
            <button class="btn btn-ghost" type="button" id="saleBtnClearForm"><i class="fa-solid fa-eraser"></i> Clear Form</button>
          </div>
        </div>

        <div class="panel edit-panel sales-edit" id="saleEditPanel">
          <h3 style="color:var(--purple);"><i class="fa-solid fa-pen-to-square"></i> Sales Order Modification <span class="role-tag" id="saleRoleTag">(SuperAdmin)</span></h3>

          <div class="search-row">
            <input id="saleSearchOrder" placeholder="Search by Order No, Challan No, Customer Name, or Short Name...">
            <button class="btn btn-ghost" type="button" id="saleBtnFind"><i class="fa-solid fa-magnifying-glass"></i> Find</button>
          </div>

          <div class="form-grid cols-2">
            <div class="field span-full"><label>Customer <span class="req">*</span></label><input id="saleEditCust" placeholder="Customer name"></div>
            <div class="field"><label>Challan No <span class="req">*</span></label><input id="saleEditChalanNo" placeholder="Challan number"></div>
            <div class="field"><label>Challan Date <span class="req">*</span></label><input id="saleEditChalanDate" type="date"></div>
            <div class="field"><label>Invoice No</label><input id="saleEditInvNo" placeholder="Invoice number"></div>
            <div class="field"><label>Invoice Date</label><input id="saleEditInvDate" type="date"></div>

            <div class="field"><label>Category <span class="req">*</span></label>
              <select id="saleEditCat"><option value="">Loading...</option></select></div>
            <div class="field"><label>Brand <span class="req">*</span></label>
              <select id="saleEditBrand"><option value="">-- Select Category First --</option></select></div>
            <div class="field"><label>Wattage <span class="req">*</span></label>
              <select id="saleEditWatt"><option value="">-- Select Brand First --</option></select></div>
            <div class="field"><label>Type <span class="req">*</span></label>
              <select id="saleEditType"><option value="">-- Select Category First --</option></select></div>

            <div class="field span-full"><label>Proof File</label>
              <div class="proof-row">
                <input type="file" id="saleEditProofFile" multiple style="display:none;" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt">
                <button class="btn btn-ghost" type="button" id="saleBtnEditAttach"><i class="fa-solid fa-paperclip"></i> Add Attachment</button>
                <button class="btn btn-ghost" type="button" id="saleBtnKeepProof"><i class="fa-solid fa-rotate-left"></i> Keep Existing</button>
                <span class="proof-name" id="saleEditProofName">No proof selected</span>
              </div>
            </div>

            <div class="field span-full">
              <label>Invoice Product Lines</label>
              <div class="line-list" id="saleEditLineList"><div class="empty">Find an order above to load its lines.</div></div>
              <div class="line-btns">
                <button class="btn btn-green" type="button" id="saleBtnEditAddLine"><i class="fa-solid fa-plus"></i> Add Line</button>
                <button class="btn btn-ghost" type="button" id="saleBtnEditRemoveLine"><i class="fa-solid fa-minus"></i> Remove Line</button>
              </div>
            </div>

            <div class="field span-full"><label>Serials <span class="req">*</span></label><textarea id="saleEditSerials" placeholder="Serials will load here..."></textarea></div>
          </div>

          <div class="actions-row">
            <button class="btn btn-gold" type="button" id="saleBtnApply"><i class="fa-solid fa-check"></i> Apply Modifications</button>
            <button class="btn btn-ghost" type="button" id="saleBtnClearEdit"><i class="fa-solid fa-eraser"></i> Clear Changes</button>
            <button class="btn btn-red" type="button" id="saleBtnDelete"><i class="fa-solid fa-trash"></i> Delete Transaction</button>
          </div>
        </div>

      </div>
    </div>
  `,

  init() {
    const $ = (id) => document.getElementById(id);
    const currentRole = window.currentUserRole || 'User';
    const isAdmin = currentRole === 'SuperAdmin';

    const saleSplit = $('saleSplit');
    const saleToggleLabel = $('saleToggleEditLabel');
    const editPanelEl = $('saleEditPanel');
    const PD = window.PurchaseData;

    // ROLE WISE RESTRICTIONS AND LOCK BANNER DISPLAY (Synced with purchase.js specifications)
    if (!isAdmin) {
      $('saleRoleTag').textContent = '(Locked — View Only)';

      const toggleBtn = $('saleBtnToggleEdit');
      toggleBtn.disabled = true;
      toggleBtn.style.opacity = '0.55';
      toggleBtn.style.cursor = 'not-allowed';
      toggleBtn.title = 'SuperAdmin only';

      editPanelEl.querySelectorAll('input, select, textarea, button').forEach((el) => {
        el.disabled = true;
      });

      const lockBanner = document.createElement('div');
      lockBanner.className = 'banner';
      lockBanner.style.marginBottom = '14px';
      lockBanner.innerHTML = '<i class="fa-solid fa-lock"></i><div><strong>Locked.</strong> Only a SuperAdmin can view or modify saved sales challans.</div>';
      editPanelEl.insertBefore(lockBanner, editPanelEl.children[1] || null);
    }

    $('saleBtnToggleEdit').addEventListener('click', () => {
      if (!isAdmin) return;
      const isClosed = saleSplit.classList.contains('edit-closed');
      saleSplit.classList.toggle('edit-closed', !isClosed);
      saleToggleLabel.textContent = isClosed ? 'Close Edit Section' : 'Edit / Modify Order';
    });

    document.querySelectorAll('#saleSplit input[type="date"]').forEach((el) => {
      el.addEventListener('click', () => { if (el.showPicker) { try { el.showPicker(); } catch (e) {} } });
      el.addEventListener('keydown', (e) => { if (e.key !== 'Tab') e.preventDefault(); });
    });

    // ---------------- shared helpers ----------------
    function fillSelect(selectEl, items, placeholder) {
      if (!items || !items.length) {
        selectEl.innerHTML = `<option value="">${placeholder}</option>`;
        return;
      }
      selectEl.innerHTML = items.map((v) => `<option value="${v}">${v}</option>`).join('');
    }

    async function fillSelectFromApi(selectEl, apiPath, emptyLabel, injectValue) {
      let items = [];
      try {
        const raw = await window.Api.get(apiPath);
        items = (raw || []).map((it) => (it && typeof it === 'object' ? it.name : it)).map(String);
      } catch (e) {
        items = [];
      }
      if (injectValue !== undefined && injectValue !== null && injectValue !== '' && !items.includes(String(injectValue))) {
        items.push(String(injectValue));
      }
      fillSelect(selectEl, items, emptyLabel);
      if (injectValue !== undefined && injectValue !== null && injectValue !== '') {
        selectEl.value = String(injectValue);
      }
    }

    // Category -> watt_mandatory lookup, so "Wattage is mandatory for this
    // category" is enforced the same way is_watt_mandatory() enforces it on
    // the desktop app, instead of guessing from a hardcoded Panel/Inverter list.
    let categoryWattRules = {};
    async function loadCategoryWattRules() {
      try {
        const cats = await window.Api.get('/masters/categories');
        categoryWattRules = {};
        (cats || []).forEach((c) => { categoryWattRules[c.name] = !!c.watt_mandatory; });
      } catch (e) { categoryWattRules = {}; }
    }
    function isWattMandatory(cat) { return !!categoryWattRules[cat]; }

    // Serial box: auto-newline on delimiter, and paste normalization —
    // mirrors ui/serial_widgets.py's SerialTextEdit exactly (same behaviour
    // wired for Purchase in purchase.js).
    function splitSerials(text) {
      return String(text || '').match(/[A-Za-z0-9-]+/g) || [];
    }
    function wireSerialBox(el) {
      el.addEventListener('keydown', (e) => {
        if ([',', ' ', '|', ';', 'Tab'].includes(e.key)) {
          e.preventDefault();
          const before = el.value.slice(0, el.selectionStart);
          const after = el.value.slice(el.selectionEnd);
          const needsNewline = before && !before.endsWith('\n');
          el.value = before + (needsNewline ? '\n' : '') + after;
          const pos = before.length + (needsNewline ? 1 : 0);
          el.setSelectionRange(pos, pos);
        }
      });
      el.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const normalized = splitSerials(pasted).join('\n');
        const before = el.value.slice(0, el.selectionStart);
        const after = el.value.slice(el.selectionEnd);
        const prefix = before && !before.endsWith('\n') ? '\n' : '';
        el.value = before + prefix + normalized + '\n' + after;
      });
      el.addEventListener('blur', () => {
        el.value = splitSerials(el.value).join('\n');
      });
    }
    wireSerialBox($('saleSerials'));
    wireSerialBox($('saleEditSerials'));

    function renderLineList(container, lines, emptyText) {
      if (!lines.length) {
        container.innerHTML = `<div class="empty">${emptyText}</div>`;
        return;
      }
      container.innerHTML = lines.map((ln, idx) => `
        <div class="line-item" data-idx="${idx}">
          <span>${ln.cat} • ${ln.brand} ${ln.watt ? '• ' + ln.watt + 'W' : ''} • ${ln.type}</span>
          <span class="qty-badge">Qty ${(ln.serials && ln.serials.length) ? ln.serials.length : (ln.qty || 0)}</span>
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

    // ---------------- Proof attachment (Challan/Invoice PDF or image) —
    // mirrors ui/sales.py's select_sales_proof_file() / clear_sales_proof_file()
    // / select_edit_sales_proof_file() / keep_existing_edit_sales_proof(),
    // wired identically to purchase.js's wireProofButtons(). Like Purchase,
    // only the file NAME is sent to the backend (stored in the
    // `sales_attachment` column on every serial row of the dispatch) — the
    // actual file stays local to the browser for this session's preview.
    // "Add Attachment" always ADDS to the existing selection instead of
    // replacing it — click it once, pick a file, click it again, pick
    // another, and both stay attached (as chips, each removable with its
    // own x). Only "Clear All" / "Keep Existing" wipe the whole list.
    // "Add Attachment" always ADDS to the existing selection instead of
    // replacing it — click it once, pick a file, click it again, pick
    // another, and both stay attached (as clickable chips). Click a chip's
    // name to open that exact file in a new tab (cursor:pointer signals
    // this — no separate "eye" view button needed any more); click its
    // small x to remove just that one file. "Clear All" / "Keep Existing"
    // wipe the whole list.
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
    // dropdowns, fetched live from the database (same source the desktop
    // app's get_categories() / get_brands_for_category() /
    // get_wattages_for_brand_category() / get_types_for_category_brand_watt()
    // read from). Category change refreshes Brand + Wattage together, then
    // Wattage change refreshes Type — exactly like ui/sales.py's
    // sync_sales_brands() -> sync_sales_wattage() -> sync_sales_solartype()
    // chain. Type falls back to the category's general Subtypes master
    // (get_subtypes_by_category()) whenever no item is registered for this
    // exact Category+Brand+Wattage combo yet.
    const saleCatEl = $('saleCat'), saleBrandEl = $('saleBrand'), saleWattEl = $('saleWatt'), saleTypeEl = $('saleType');

    async function loadSaleCategories() {
      await fillSelectFromApi(saleCatEl, '/masters/categories', 'No categories found');
      await refreshSaleBrandsAndWatt();
    }

    async function refreshSaleBrandsAndWatt() {
      const cat = saleCatEl.value;
      if (!cat) {
        fillSelect(saleBrandEl, [], '-- Select Category First --');
        fillSelect(saleWattEl, [], '-- Select Brand First --');
        await refreshSaleType();
        return;
      }
      try {
        const brands = await window.Api.get(`/purchase/brands/${encodeURIComponent(cat)}`);
        fillSelect(saleBrandEl, brands, 'No brands under this category');
      } catch (e) {
        fillSelect(saleBrandEl, [], 'Failed to load brands');
      }
      await refreshSaleWattage();
    }

    async function refreshSaleWattage() {
      const cat = saleCatEl.value, brand = saleBrandEl.value;
      if (!cat || !brand) {
        fillSelect(saleWattEl, [], '-- Select Brand First --');
        await refreshSaleType();
        return;
      }
      try {
        const watts = await window.Api.get(`/purchase/wattages?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}`);
        fillSelect(saleWattEl, watts.length ? watts : ['N/A'], 'N/A');
      } catch (e) {
        fillSelect(saleWattEl, ['N/A'], 'N/A');
      }
      await refreshSaleType();
    }

    async function refreshSaleType() {
      const cat = saleCatEl.value, brand = saleBrandEl.value, wattVal = saleWattEl.value;
      if (!cat) { fillSelect(saleTypeEl, [], '-- Select Category First --'); return; }
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
      fillSelect(saleTypeEl, types, 'Others');
    }

    saleCatEl.addEventListener('change', refreshSaleBrandsAndWatt);
    saleBrandEl.addEventListener('change', refreshSaleWattage);
    saleWattEl.addEventListener('change', refreshSaleType);
    loadSaleCategories();
    loadCategoryWattRules();

    // ---------------- Customer ledger live autocomplete + autofill ---------
    // Mirrors attach_ledger_autocomplete() / attach_ledger_shortname_lookup()
    // in ui/sales.py: as the user types in Customer Name or Short Code we
    // live-fetch matching ledgers from the DB to feed the suggestion
    // dropdown, and auto-fill Mobile/Address the instant the typed text
    // exactly matches a known ledger name or short code. The auto-filled
    // fields stay fully EDITABLE (no readonly) so the user can still
    // type/override them by hand for this one dispatch.
    const saleCustNameList = $('saleCustNameList');
    const saleCustShortList = $('saleCustShortList');
    let custSearchTimer = null;

    async function searchCustomerLedgers(q) {
      try { return await window.Api.get(`/ledgers?type=Customer&q=${encodeURIComponent(q)}`); }
      catch (e) { return []; }
    }
    async function searchCustomerShortCodes(q) {
      try { return await window.Api.get(`/ledgers/shortcodes?type=Customer&q=${encodeURIComponent(q)}`); }
      catch (e) { return []; }
    }
    function fillCustomerDatalist(listEl, ledgers, key) {
      listEl.innerHTML = ledgers
        .filter((l) => String(l[key] || '').trim() !== '')
        .map((l) => `<option value="${String(l[key]).replace(/"/g, '&quot;')}">`).join('');
    }
    function applyLedgerToCustomerFields(l) {
      $('saleCust').value = l.name || '';
      $('saleCustShort').value = l.short || '';
      $('saleCustMobile').value = l.mobile && l.mobile !== '-' ? l.mobile : '';
      $('saleCustAddr').value = l.address && l.address !== '-' ? l.address : '';
      // Mirrors trigger_sales_autofill(): the resolved short code also
      // pre-fills the Order No field, same as the desktop app.
      if (!$('saleOrder').value.trim() && l.short) $('saleOrder').value = l.short;
    }
    function wireCustomerAutocomplete(inputEl, listEl, matchKey, searchFn) {
      inputEl.addEventListener('input', () => {
        const text = inputEl.value;
        clearTimeout(custSearchTimer);
        custSearchTimer = setTimeout(async () => {
          const ledgers = await searchFn(text);
          fillCustomerDatalist(listEl, ledgers, matchKey);
          const exact = ledgers.find((l) => String(l[matchKey] || '').trim().toLowerCase() === text.trim().toLowerCase());
          if (exact) applyLedgerToCustomerFields(exact);
        }, 250);
      });
      inputEl.addEventListener('focus', async () => {
        if (inputEl.value.trim()) return;
        const ledgers = await searchFn('');
        fillCustomerDatalist(listEl, ledgers, matchKey);
      });
    }
    wireCustomerAutocomplete($('saleCust'), saleCustNameList, 'name', searchCustomerLedgers);
    wireCustomerAutocomplete($('saleCustShort'), saleCustShortList, 'short', searchCustomerShortCodes);

    // ---------------- NEW SALES panel state ----------------
    const saleLines = [];
    const saleLineList = $('saleLineList');
    renderLineList(saleLineList, saleLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
    wireLineSelection(saleLineList);

    const saleProof = { files: [] };
    wireProofButtons('saleProofFile', 'saleBtnAttach', 'saleBtnClearProof', 'saleProofName', saleProof);

    $('saleBtnAddLine').addEventListener('click', async () => {
      const cat = saleCatEl.value, brand = saleBrandEl.value, wattVal = saleWattEl.value.trim();
      const type = saleTypeEl.value, qtyStr = $('saleQty').value.trim();
      const watt = (wattVal && wattVal !== 'N/A' && !isNaN(Number(wattVal))) ? Number(wattVal) : 0;
      const serials = splitSerials($('saleSerials').value);

      if (!cat || !brand || !type || !qtyStr) {
        window.openModal('Validation Error', '<p>Category, Brand, Type and Qty are required for the product line.</p>');
        return;
      }
      if (isWattMandatory(cat) && !watt) {
        window.openModal('Validation Error', `<p>Wattage/Capacity is mandatory for '${cat}' product lines.</p>`);
        return;
      }
      if (!/^\d+$/.test(qtyStr) || Number(qtyStr) <= 0) {
        window.openModal('Validation Error', '<p>Expected Dispatch Quantity must be a valid positive number.</p>');
        return;
      }
      if (serials.length !== Number(qtyStr)) {
        window.openModal('Quantity Mismatch', `<p>Quantity mismatch: Qty is ${qtyStr}, but ${serials.length} serial number(s) found.</p>`);
        return;
      }
      if (new Set(serials).size !== serials.length) {
        window.openModal('Duplicate Serial Error', '<p>Duplicate serial numbers found inside this product line.</p>');
        return;
      }
      const existingSerials = new Set(saleLines.flatMap((l) => l.serials));
      const overlap = serials.filter((sn) => existingSerials.has(sn));
      if (overlap.length) {
        window.openModal('Duplicate Line Serials', `<p>These serials are already in another line:<br><br>${overlap.join(', ')}</p>`);
        return;
      }

      // Live DB validation — mirrors validate_sales_line_serials(): every
      // serial must exist, be Available, and match this line's Category /
      // Brand / Wattage / Type.
      let errors = [];
      try {
        const resp = await window.Api.get(`/sales/check-line?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}&watt=${watt}&type=${encodeURIComponent(type)}&serials=${encodeURIComponent(serials.join(','))}`);
        errors = resp.errors || [];
      } catch (e) {
        window.openModal('Server Error', '<p>Could not verify serial numbers against the database. Please try again.</p>');
        return;
      }
      if (errors.length) {
        window.openModal('Serial Validation Error', `<p><strong>DISPATCH BLOCKED:</strong></p><p>${errors.join('<br>')}</p>`);
        return;
      }

      saleLines.push({ cat, brand, watt, type, serials });
      renderLineList(saleLineList, saleLines, '');
      $('saleQty').value = '';
      $('saleSerials').value = '';
    });
    $('saleBtnRemoveLine').addEventListener('click', () => {
      const idx = selectedLineIndex(saleLineList);
      if (idx === -1) return;
      saleLines.splice(idx, 1);
      renderLineList(saleLineList, saleLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
    });

    function clearSalesForm() {
      saleCatEl.selectedIndex = 0;
      refreshSaleBrandsAndWatt();
      ['saleCustShort', 'saleCust', 'saleCustMobile', 'saleCustAddr', 'saleOrder', 'saleChalanNo', 'saleInvNo', 'saleQty'].forEach((id) => { $(id).value = ''; });
      $('saleChalanDate').value = '';
      $('saleInvDate').value = '';
      $('saleSerials').value = '';
      saleLines.length = 0;
      renderLineList(saleLineList, saleLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
      saleProof.files = [];
      $('saleProofFile').value = '';
      $('saleProofName').textContent = 'No proof selected';
    }
    $('saleBtnClearForm').addEventListener('click', clearSalesForm);

    $('saleBtnSave').addEventListener('click', async () => {
      const customer = $('saleCust').value.trim();
      const orderNo = $('saleOrder').value.trim();
      const chalanNo = $('saleChalanNo').value.trim();
      const chalanDate = PD.dmyFromISO($('saleChalanDate').value);
      const invoiceNo = $('saleInvNo').value.trim();
      const invoiceDate = invoiceNo ? (PD.dmyFromISO($('saleInvDate').value) || '-') : '-';

      if (!customer || !orderNo || !chalanNo || !chalanDate) {
        window.openModal('Missing Fields', '<p>Customer Name, Order No, Challan No and Challan Date are required.</p>');
        return;
      }

      // If the current form fields still hold an un-added line (qty/serials
      // filled in but "Add Product Line" never clicked), add it now first —
      // mirrors process_sales_dispatch()'s own auto-add-current-line step.
      if (($('saleQty').value.trim() || $('saleSerials').value.trim())) {
        $('saleBtnAddLine').click();
        // Give the async validation inside the click handler a chance to
        // either push the line or show its own error modal.
        window.openModal('Line Pending', '<p>Product line details were found in the form and validated — please click <strong>Confirm Dispatch</strong> again to save.</p>');
        return;
      }
      if (!saleLines.length) {
        window.openModal('Validation Error', '<p>Add at least one Invoice Product Line before saving.</p>');
        return;
      }

      const saveBtn = $('saleBtnSave');
      saveBtn.disabled = true;
      try {
        const result = await window.Api.post('/sales/dispatch', {
          customer, orderNo, chalanNo, chalanDate, invoiceNo, invoiceDate,
          proofName: saleProof.files.length ? (saleProof.files.length === 1 ? saleProof.files[0].name : `${saleProof.files.length} files`) : '-',
          lines: saleLines.map((l) => ({ cat: l.cat, brand: l.brand, watt: l.watt, type: l.type, serials: l.serials })),
        });
        if (window.showToast) window.showToast('Sales Dispatch Executed successfully!');
        window.openModal('Success', `<p>Project dispatch saved with ${result.lineCount} product line(s) and ${result.serialCount} serial(s).</p>`);
        clearSalesForm();
      } catch (err) {
        window.openModal('Execution Error', `<p style="color:var(--red); white-space:pre-line;">${err.message}</p>`);
      } finally {
        saveBtn.disabled = false;
      }
    });

    // ---------------- EDIT PANEL ----------------
    const saleEditCatEl = $('saleEditCat'), saleEditBrandEl = $('saleEditBrand'), saleEditWattEl = $('saleEditWatt'), saleEditTypeEl = $('saleEditType');
    const saleEditLineList = $('saleEditLineList');
    const saleEditLines = [];
    let loadedOrderNo = null;
    let loadedOriginalSerials = [];

    const saleEditProof = { files: [] };

    if (isAdmin) {
      wireLineSelection(saleEditLineList);
      wireProofButtons('saleEditProofFile', 'saleBtnEditAttach', null, 'saleEditProofName', saleEditProof);
      $('saleBtnKeepProof').addEventListener('click', () => {
        saleEditProof.files = [];
        $('saleEditProofFile').value = '';
        $('saleEditProofName').textContent = 'Keeping existing proof file';
      });

      async function refreshSaleEditBrandsAndWatt(injectBrand, injectWatt) {
        const cat = saleEditCatEl.value;
        if (!cat) {
          fillSelect(saleEditBrandEl, [], '-- Select Category First --');
          fillSelect(saleEditWattEl, [], '-- Select Brand First --');
          await refreshSaleEditType();
          return;
        }
        await fillSelectFromApi(saleEditBrandEl, `/purchase/brands/${encodeURIComponent(cat)}`, 'No brands under this category', injectBrand);
        await refreshSaleEditWattage(injectWatt);
      }
      async function refreshSaleEditWattage(injectWatt) {
        const cat = saleEditCatEl.value, brand = saleEditBrandEl.value;
        if (!cat || !brand) {
          fillSelect(saleEditWattEl, [], '-- Select Brand First --');
          await refreshSaleEditType();
          return;
        }
        await fillSelectFromApi(saleEditWattEl, `/purchase/wattages?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}`, 'N/A', injectWatt);
        await refreshSaleEditType();
      }
      async function refreshSaleEditType(injectType) {
        const cat = saleEditCatEl.value, brand = saleEditBrandEl.value, wattVal = saleEditWattEl.value;
        if (!cat) { fillSelect(saleEditTypeEl, [], '-- Select Category First --'); return; }
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
        if (injectType && !types.includes(injectType)) types.push(injectType);
        fillSelect(saleEditTypeEl, types, 'Others');
        if (injectType) saleEditTypeEl.value = injectType;
      }

      saleEditCatEl.addEventListener('change', () => refreshSaleEditBrandsAndWatt());
      saleEditBrandEl.addEventListener('change', () => refreshSaleEditWattage());
      saleEditWattEl.addEventListener('change', () => refreshSaleEditType());
      fillSelectFromApi(saleEditCatEl, '/masters/categories', 'No categories found');

      async function loadEditCascadeForLine(line) {
        if (!line) return;
        await fillSelectFromApi(saleEditCatEl, '/masters/categories', 'No categories found', line.cat);
        await fillSelectFromApi(saleEditBrandEl, `/purchase/brands/${encodeURIComponent(saleEditCatEl.value)}`, 'No brands under this category', line.brand);
        await fillSelectFromApi(saleEditWattEl, `/purchase/wattages?category=${encodeURIComponent(saleEditCatEl.value)}&brand=${encodeURIComponent(saleEditBrandEl.value)}`, 'N/A', line.watt);
        await refreshSaleEditType(line.type);
      }

      function clearEditPanel() {
        $('saleSearchOrder').value = '';
        ['saleEditCust', 'saleEditChalanNo', 'saleEditInvNo'].forEach((id) => { $(id).value = ''; });
        $('saleEditChalanDate').value = '';
        $('saleEditInvDate').value = '';
        $('saleEditSerials').value = '';
        saleEditLines.length = 0;
        renderLineList(saleEditLineList, saleEditLines, 'Find an order above to load its lines.');
        loadedOrderNo = null;
        loadedOriginalSerials = [];
        saleEditProof.files = [];
        $('saleEditProofFile').value = '';
        $('saleEditProofName').textContent = 'No proof selected';
      }
      $('saleBtnClearEdit').addEventListener('click', clearEditPanel);

      $('saleBtnEditAddLine').addEventListener('click', () => {
        const cat = saleEditCatEl.value, brand = saleEditBrandEl.value, wattVal = saleEditWattEl.value.trim();
        const type = saleEditTypeEl.value;
        const watt = (wattVal && wattVal !== 'N/A' && !isNaN(Number(wattVal))) ? Number(wattVal) : 0;
        if (!cat || !brand || !type) {
          window.openModal('Line Error', '<p>Category, Brand and Type are required for this line.</p>');
          return;
        }
        saleEditLines.push({ cat, brand, watt, type, serials: [] });
        renderLineList(saleEditLineList, saleEditLines, '');
      });
      $('saleBtnEditRemoveLine').addEventListener('click', () => {
        const idx = selectedLineIndex(saleEditLineList);
        if (idx === -1) return;
        saleEditLines.splice(idx, 1);
        renderLineList(saleEditLineList, saleEditLines, 'Find an order above to load its lines.');
      });

      // Mirrors find_sales_order_for_editing(): search by Order No, Challan
      // No, Customer Name, or Customer Short Code; loads the matching
      // order's header + every product line + all its serials.
      async function findSalesOrderForEditing(term) {
        if (!term) {
          window.openModal('Search Required', '<p>Type an Order No, Challan No, Customer Name, or Short Name to search first.</p>');
          return false;
        }
        let order;
        try {
          order = await window.Api.get(`/sales/find/${encodeURIComponent(term)}`);
        } catch (err) {
          window.openModal('Not Found', `<p>${err.message || 'No sales records found matching Order No / Challan No / Customer Name / Short Name.'}</p>`);
          return false;
        }
        loadedOrderNo = order.orderNo;
        loadedOriginalSerials = order.allSerials || [];
        $('saleEditCust').value = order.customer || '';
        $('saleEditChalanNo').value = order.chalanNo || '';
        $('saleEditChalanDate').value = PD.isoFromDMY(order.chalanDate);
        $('saleEditInvNo').value = order.invoiceNo || '';
        $('saleEditInvDate').value = PD.isoFromDMY(order.invoiceDate);
        $('saleEditProofName').textContent = order.proofName && order.proofName !== '-' ? order.proofName : 'No proof selected';
        saleEditProof.files = [];

        saleEditLines.length = 0;
        (order.lines || []).forEach((ln) => saleEditLines.push({ cat: ln.cat, brand: ln.brand, watt: ln.watt, type: ln.type, serials: ln.serials }));
        renderLineList(saleEditLineList, saleEditLines, 'Find an order above to load its lines.');
        await loadEditCascadeForLine(saleEditLines[0]);
        $('saleEditSerials').value = (order.allSerials || []).join('\n');

        window.openModal('Loaded', `<p>Sales challan/order loaded with ${saleEditLines.length} product line(s).</p>`);
        return true;
      }

      $('saleBtnFind').addEventListener('click', () => {
        findSalesOrderForEditing($('saleSearchOrder').value.trim());
      });

      $('saleBtnApply').addEventListener('click', async () => {
        if (!loadedOrderNo) {
          window.openModal('Not Found', '<p>Find an order first before applying modifications.</p>');
          return;
        }
        const newCust = $('saleEditCust').value.trim();
        const newChalan = $('saleEditChalanNo').value.trim();
        if (!newCust || !newChalan) {
          window.openModal('Validation Error', '<p>Customer and Challan No are required before applying modifications.</p>');
          return;
        }
        const allSerials = PD.splitSerials($('saleEditSerials').value);
        // Distribute the (possibly re-ordered/edited) serial list back
        // across the loaded product lines in order, same grouping rule the
        // New Entry panel uses when splitting a single textarea across lines.
        let cursor = 0;
        const lines = (saleEditLines.length ? saleEditLines : [{
          cat: saleEditCatEl.value, brand: saleEditBrandEl.value, watt: saleEditWattEl.value.trim(), type: saleEditTypeEl.value,
        }]).map((ln, idx, arr) => {
          const remainingLines = arr.length - idx;
          const takeCount = idx === arr.length - 1 ? (allSerials.length - cursor) : Math.ceil((allSerials.length - cursor) / remainingLines);
          const serials = allSerials.slice(cursor, cursor + takeCount);
          cursor += takeCount;
          return { cat: ln.cat, brand: ln.brand, watt: ln.watt, type: ln.type, serials };
        });

        const applyBtn = $('saleBtnApply');
        applyBtn.disabled = true;
        try {
          const result = await window.Api.put(`/sales/modify/${encodeURIComponent(loadedOrderNo)}`, {
            customer: newCust,
            chalanNo: newChalan,
            chalanDate: PD.dmyFromISO($('saleEditChalanDate').value) || $('saleEditChalanDate').value,
            invoiceNo: $('saleEditInvNo').value.trim(),
            invoiceDate: PD.dmyFromISO($('saleEditInvDate').value) || $('saleEditInvDate').value,
            // Only send a new proof name if a replacement file was actually
            // attached this time — null tells the backend to keep whatever
            // attachment the order already had (mirrors "Keep Existing").
            proofName: saleEditProof.files.length
              ? (saleEditProof.files.length === 1 ? saleEditProof.files[0].name : `${saleEditProof.files.length} files`)
              : null,
            lines,
            originalSerials: loadedOriginalSerials,
          });
          loadedOrderNo = result.orderNo;
          loadedOriginalSerials = allSerials;
          if (window.showToast) window.showToast('Sales Modifications Saved.');
          window.openModal('Saved', `<p>Sales order <strong>${loadedOrderNo}</strong> updated successfully.</p>`);
        } catch (err) {
          window.openModal('Error', `<p style="white-space:pre-line;">${err.message || 'Failed to modify tracking register'}</p>`);
        } finally {
          applyBtn.disabled = false;
        }
      });

      $('saleBtnDelete').addEventListener('click', async () => {
        if (!loadedOrderNo) {
          window.openModal('Not Found', '<p>Find an order first before trying to delete it.</p>');
          return;
        }
        const orderNo = loadedOrderNo;
        if (!(await window.confirmDanger('Delete Sale Transaction', `Permanently delete this sale transaction (Order '${orderNo}')? All its serials will revert back to Available stock. This cannot be undone.`))) return;
        try {
          const result = await window.Api.delete(`/sales/delete/${encodeURIComponent(orderNo)}`);
          if (window.showToast) window.showToast('Transaction completely rolled back.');
          window.openModal('Deleted', `<p>Sale transaction for order <strong>${orderNo}</strong> deleted successfully. ${result.revertedCount} serial(s) reverted to Available.</p>`);
          clearEditPanel();
        } catch (err) {
          window.openModal('Error', `<p>${err.message || 'Deletion failed.'}</p>`);
        }
      });

      window.SalesPageAPI = {
        loadChallanForEdit(reference) {
          if (!isAdmin) {
            window.openModal('Locked', '<p>Only a SuperAdmin can modify sales invoices.</p>');
            return;
          }
          saleSplit.classList.remove('edit-closed');
          saleToggleLabel.textContent = 'Close Edit Section';
          $('saleSearchOrder').value = reference;
          findSalesOrderForEditing(reference);
        },
        prefillFromAssign,
      };
    } else {
      window.SalesPageAPI = {
        loadChallanForEdit() {
          window.openModal('Locked', '<p>Only a SuperAdmin can modify sales invoices.</p>');
        },
        prefillFromAssign,
      };
    }

    // ---------------- Prefill from Stock Assign "Release to Customer" ------
    // Mirrors ui/sales.py's prefill_from_assignment(): called when a
    // reserved (Assigned) stock is released to a customer, so the user only
    // needs to add a Challan No and confirm — the usual strict dispatch
    // validation still applies. Lines carry a Qty but no scanned serials
    // yet (the release already returned the stock to Available), so the
    // user re-adds each line's serials the normal way before dispatching.
    function prefillFromAssign(customerName, orderNo, mobile, address, lines) {
      saleSplit.classList.add('edit-closed');
      clearSalesForm();
      $('saleCust').value = customerName || '';
      $('saleCustMobile').value = mobile || '';
      $('saleCustAddr').value = address || '';
      $('saleOrder').value = orderNo || '';
      (lines || []).forEach((line) => {
        saleLines.push({ cat: line.cat, brand: line.brand, watt: line.watt, type: line.type, qty: line.qty, serials: [] });
      });
      renderLineList(saleLineList, saleLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
      window.openModal('Assignment Released', '<p>Reserved stock loaded into this Sales form. Please scan/enter serials for each product line, fill Challan No, and confirm dispatch.</p>');
    }
  },
};