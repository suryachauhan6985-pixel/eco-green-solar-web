// js/pages/purchase.js
// Mirrors ui/purchase.py from the desktop app: a "New Purchase Entry" form on
// the left, plus a SuperAdmin "Purchase Invoice Modification" edit panel on
// the right (Find an invoice -> fields load -> Apply Modifications / Delete).
// "Execute Stock Inward" / "Find" / "Apply Modifications" / "Delete Invoice"
// all hit the real backend now (/api/purchase/*, see server.js), which reads
// and writes the same stock_ledger table the desktop .py app uses — nothing
// here is an in-memory preview any more.
//
// Desktop: both panels sit side by side always (no toggle button, no
// "New Purchase Entry" back-button — CSS hides both on wide screens).
// Mobile (<=900px): only ONE panel is visible at a time. The "Edit / Modify
// Invoice" header button slides the edit panel in from the side; the
// "New Purchase Entry" button inside the edit panel slides the entry form
// back in. Both panels' markup sits inside .split-two-track, which is the
// element that actually gets the sliding transform (see css/style.css).
window.PAGES = window.PAGES || {};

window.PAGES.purchase = {
  name: 'Purchase Inward',
  icon: 'fa-file-import',
  sub: 'Record new stock purchase entries',
  html: `
    <div class="page-head">
      <i class="fa-solid fa-file-import" style="color:var(--green);"></i><h2>Purchase Inward</h2>
      <button class="btn btn-gold btn-toggle-edit" type="button" id="purBtnToggleEdit">
        <i class="fa-solid fa-pen-to-square"></i> <span id="purToggleEditLabel">Edit / Modify Invoice</span>
      </button>
      <div class="hint">Execute Stock Inward saves directly to the database; Find / Apply Modifications / Delete work on live records.</div>
    </div>

    <div class="split-two edit-closed" id="purSplit">
      <div class="split-two-track">

        <!-- ================= NEW PURCHASE ENTRY ================= -->
        <div class="panel">
          <h3><i class="fa-solid fa-file-invoice"></i> New Purchase Entry</h3>
          <div class="form-grid cols-2">
            <div class="field"><label>Category <span class="req">*</span></label>
              <select id="purCat"><option value="">Loading...</option></select></div>
            <div class="field"><label>Brand <span class="req">*</span></label>
              <select id="purBrand"><option value="">-- Select Category First --</option></select></div>
            <div class="field"><label>Wattage <span class="req">*</span></label>
              <select id="purWatt"><option value="">-- Select Brand First --</option></select></div>
            <div class="field"><label>Type <span class="req">*</span></label>
              <select id="purType"><option value="">-- Select Category First --</option></select></div>

            <div class="field"><label>Supplier Short Code</label><input id="purSuppShort" placeholder="Optional short code" list="purSuppShortList" autocomplete="off"><datalist id="purSuppShortList"></datalist></div>
            <div class="field"><label>Supplier Name <span class="req">*</span></label><input id="purSupp" placeholder="Supplier / Party" list="purSuppNameList" autocomplete="off"><datalist id="purSuppNameList"></datalist></div>
            <div class="field"><label>Mobile</label><input id="purSuppMobile" placeholder="Auto-fills from ledger (editable)"></div>
            <div class="field"><label>GSTIN</label><input id="purSuppGstin" placeholder="Auto-fills from ledger (editable)"></div>
            <div class="field span-full"><label>Address</label><input id="purSuppAddr" placeholder="Auto-fills from ledger (editable)"></div>

            <div class="field"><label>Invoice No <span class="req">*</span></label><input id="purInv" placeholder="INV-2026-001"></div>
            <div class="field"><label>Pallet ID</label><input id="purPallet" placeholder="Optional"></div>
            <div class="field"><label>Qty <span class="req">*</span></label><input id="purQty" type="number" placeholder="0"></div>
            <div class="field"><label>Warehouse <span class="req">*</span></label>
              <select id="purWh"><option value="">Loading...</option></select></div>
            <div class="field span-full"><label>Purchase Date <span class="req">*</span></label><input id="purDate" type="date"></div>

            <div class="field span-full"><label>Proof Attachment (Invoice PDF/Image)</label>
              <div class="proof-row">
                <input type="file" id="purProofFile" multiple style="display:none;" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt">
                <button class="btn btn-ghost" type="button" id="purBtnAttach"><i class="fa-solid fa-paperclip"></i> Attach Proof</button>
                <button class="btn btn-ghost" type="button" id="purBtnClearProof"><i class="fa-solid fa-xmark"></i> Clear</button>
                <button class="btn btn-ghost" type="button" id="purBtnViewProof" title="View selected proof file(s)"><i class="fa-solid fa-eye"></i></button>
                <span class="proof-name" id="purProofName">No proof selected</span>
              </div>
            </div>

            <div class="field span-full"><label>Serial Numbers <span class="req">*</span></label>
              <textarea id="purSerials" placeholder="One serial per line, it auto-splits"></textarea>
            </div>

            <div class="field span-full">
              <label>Invoice Product Lines</label>
              <div class="line-list" id="purLineList"><div class="empty">No product lines added yet — fill the fields above and click "Add Product Line".</div></div>
              <div class="line-btns">
                <button class="btn btn-green" type="button" id="purBtnAddLine"><i class="fa-solid fa-plus"></i> Add Product Line</button>
                <button class="btn btn-ghost" type="button" id="purBtnRemoveLine"><i class="fa-solid fa-minus"></i> Remove Line</button>
              </div>
            </div>
          </div>
          <div class="actions-row">
            <button class="btn btn-green" type="button" id="purBtnSave"><i class="fa-solid fa-arrow-down"></i> Execute Stock Inward</button>
            <button class="btn btn-ghost" type="button" id="purBtnClearForm"><i class="fa-solid fa-eraser"></i> Clear Form</button>
          </div>
        </div>

        <!-- ================= PURCHASE INVOICE MODIFICATION ================= -->
        <div class="panel edit-panel" id="purEditPanel">
          <h3 style="color:var(--orange);"><i class="fa-solid fa-pen-to-square"></i> Purchase Invoice Modification <span class="role-tag">(SuperAdmin)</span></h3>

          <div class="search-row">
            <input id="purSearchInv" placeholder="Search by Invoice No, Supplier Name, or Short Name...">
            <button class="btn btn-ghost" type="button" id="purBtnFind"><i class="fa-solid fa-magnifying-glass"></i> Find</button>
          </div>

          <div class="form-grid cols-2">
            <div class="field"><label>Supplier <span class="req">*</span></label><input id="purEditSupp" placeholder="Supplier name"></div>
            <div class="field"><label>Invoice No <span class="req">*</span></label><input id="purEditInv" placeholder="Invoice number"></div>
            <div class="field"><label>Pallet ID</label><input id="purEditPallet" placeholder="Pallet number"></div>
            <div class="field"><label>Warehouse <span class="req">*</span></label>
              <select id="purEditWh"><option value="">Loading...</option></select></div>

            <div class="field"><label>Category <span class="req">*</span></label>
              <select id="purEditCat"><option value="">Loading...</option></select></div>
            <div class="field"><label>Brand <span class="req">*</span></label>
              <select id="purEditBrand"><option value="">-- Select Category First --</option></select></div>
            <div class="field"><label>Wattage <span class="req">*</span></label>
              <select id="purEditWatt"><option value="">-- Select Brand First --</option></select></div>
            <div class="field"><label>Type <span class="req">*</span></label>
              <select id="purEditType"><option value="">-- Select Category First --</option></select></div>

            <div class="field span-full"><label>Date <span class="req">*</span></label><input id="purEditDate" type="date"></div>

            <div class="field span-full"><label>Proof File</label>
              <div class="proof-row">
                <input type="file" id="purEditProofFile" multiple style="display:none;" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt">
                <button class="btn btn-ghost" type="button" id="purBtnEditAttach"><i class="fa-solid fa-paperclip"></i> Replace Proof</button>
                <button class="btn btn-ghost" type="button" id="purBtnKeepProof"><i class="fa-solid fa-rotate-left"></i> Keep Existing</button>
                <button class="btn btn-ghost" type="button" id="purBtnViewEditProof" title="View proof file(s)"><i class="fa-solid fa-eye"></i></button>
                <span class="proof-name" id="purEditProofName">No proof selected</span>
              </div>
            </div>

            <div class="field span-full">
              <label>Invoice Product Lines</label>
              <div class="line-list" id="purEditLineList"><div class="empty">Find an invoice above to load its lines.</div></div>
              <div class="line-btns">
                <button class="btn btn-green" type="button" id="purBtnEditAddLine"><i class="fa-solid fa-plus"></i> Add Line</button>
                <button class="btn btn-ghost" type="button" id="purBtnEditRemoveLine"><i class="fa-solid fa-minus"></i> Remove Line</button>
              </div>
            </div>

            <div class="field span-full"><label>Serial Numbers <span class="req">*</span></label><textarea id="purEditSerials" placeholder="Loaded serials will appear here after Find"></textarea></div>
          </div>

          <div class="actions-row">
            <button class="btn btn-gold" type="button" id="purBtnApply"><i class="fa-solid fa-check"></i> Apply Modifications</button>
            <button class="btn btn-ghost" type="button" id="purBtnClearEdit"><i class="fa-solid fa-eraser"></i> Clear Changes</button>
            <button class="btn btn-red" type="button" id="purBtnDelete"><i class="fa-solid fa-trash"></i> Delete Invoice</button>
          </div>
        </div>

      </div>
    </div>
  `,

  init() {
    const $ = (id) => document.getElementById(id);
    const PD = window.PurchaseData;

    // Mirrors ui/serial_widgets.py's parse_serial_numbers(): split on ANY
    // separator (space, comma, tab, pipe, semicolon, newline) and keep only
    // letters/digits/hyphens — not just comma/newline like PD.splitSerials.
    function splitSerials(text) {
      return String(text || '').match(/[A-Za-z0-9-]+/g) || [];
    }

    // ---------------- Role restriction: only SuperAdmin can view/modify the
    // "Purchase Invoice Modification" panel — mirrors ui/purchase.py's
    // enforce_role_restrictions(role): edit_scroll only visible for
    // SuperAdmin, everyone else sees a locked placeholder instead.
    const currentRole = window.currentUserRole || 'SuperAdmin';
    const isAdmin = currentRole === 'SuperAdmin';

    // ---------------- Date fields: click anywhere to open the native
    // calendar (not just the small icon), and block manual keyboard/paste
    // entry so the date can only ever be set by picking it from the
    // calendar. Same behaviour on desktop and mobile.
    document.querySelectorAll('#purSplit input[type="date"]').forEach((el) => {
      el.addEventListener('click', () => {
        if (el.showPicker) { try { el.showPicker(); } catch (e) {} }
      });
      el.addEventListener('keydown', (e) => { if (e.key !== 'Tab') e.preventDefault(); });
      el.addEventListener('paste', (e) => e.preventDefault());
    });

    // ---------------- Edit section open/close (shared by both buttons) ----------------
    // On desktop (>900px, per CSS) both panels always sit side-by-side —
    // this toggle is effectively a no-op there since the button + back-link
    // are hidden by CSS. On mobile (<=900px) toggling "edit-closed" on
    // #purSplit slides .split-two-track between the entry form and the
    // edit panel — only one is visible at a time.
    const purSplit = $('purSplit');
    const purToggleBtn = $('purBtnToggleEdit');
    const purToggleLabel = $('purToggleEditLabel');

   function setPurEditOpen(open) {
      purSplit.classList.toggle('edit-closed', !open);
      purToggleLabel.textContent = open ? 'Close Edit Section' : 'Edit / Modify Invoice';
      // Both panels sit in the same vertical spot on mobile (the slide is
      // purely horizontal), so we just make sure the page itself is
      // scrolled to the top — never scroll to the panel itself, that's
      // what was pushing the page-head out of view.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    purToggleBtn.addEventListener('click', () => {
      setPurEditOpen(purSplit.classList.contains('edit-closed'));
    });

    if (!isAdmin) {
      purToggleBtn.disabled = true;
      purToggleBtn.title = 'SuperAdmin only';
      purToggleBtn.style.opacity = '0.55';
      purToggleBtn.style.cursor = 'not-allowed';
    }

    // ---------------- shared helpers ----------------
    function renderLineList(container, lines, emptyText) {
      if (!lines.length) {
        container.innerHTML = `<div class="empty">${emptyText}</div>`;
        return;
      }
      container.innerHTML = lines.map((ln, idx) => `
        <div class="line-item" data-idx="${idx}">
          <span>${ln.cat} • ${ln.brand} ${ln.watt ? '• ' + ln.watt + 'W' : ''} • ${ln.type} • ${ln.warehouse}</span>
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

    // ---------------- Category -> Brand -> Wattage cascading dropdowns,
    // fetched live from the database (same source the desktop app's
    // get_categories() / get_brands_for_category() / get_wattages_for_brand_category()
    // / get_subtypes_by_category() read from). Category change refreshes
    // BOTH Brand and Type together (Type/Subtype only depends on Category,
    // not on Brand/Wattage - exactly like ui/purchase.py). Brand change
    // refreshes Wattage.
    function fillSelect(selectEl, items, placeholder) {
      if (!items || !items.length) {
        selectEl.innerHTML = `<option value="">${placeholder}</option>`;
        return;
      }
      selectEl.innerHTML = items.map((v) => `<option value="${v}">${v}</option>`).join('');
    }

    const purCatEl = $('purCat'), purBrandEl = $('purBrand'), purWattEl = $('purWatt'), purTypeEl = $('purType');

    async function loadPurCategories() {
      try {
        const cats = await window.Api.get('/masters/categories');
        fillSelect(purCatEl, cats.map((c) => c.name), 'No categories found');
      } catch (e) {
        fillSelect(purCatEl, [], 'Failed to load categories');
      }
      await refreshPurBrandsAndType();
    }

    async function refreshPurBrandsAndType() {
      const cat = purCatEl.value;
      if (!cat) {
        fillSelect(purBrandEl, [], '-- Select Category First --');
        fillSelect(purTypeEl, [], '-- Select Category First --');
        await refreshPurWattages();
        return;
      }
      try {
        const brands = await window.Api.get(`/purchase/brands/${encodeURIComponent(cat)}`);
        fillSelect(purBrandEl, brands, 'No brands under this category');
      } catch (e) {
        fillSelect(purBrandEl, [], 'Failed to load brands');
      }
      try {
        const subtypes = await window.Api.get(`/masters/subtypes/${encodeURIComponent(cat)}`);
        fillSelect(purTypeEl, subtypes.length ? subtypes : ['Others'], 'Others');
      } catch (e) {
        fillSelect(purTypeEl, ['Others'], 'Others');
      }
      await refreshPurWattages();
    }

    async function refreshPurWattages() {
      const cat = purCatEl.value, brand = purBrandEl.value;
      if (!cat || !brand) {
        fillSelect(purWattEl, [], '-- Select Brand First --');
        return;
      }
      try {
        const watts = await window.Api.get(`/purchase/wattages?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}`);
        fillSelect(purWattEl, watts.length ? watts : ['N/A'], 'N/A');
      } catch (e) {
        fillSelect(purWattEl, ['N/A'], 'N/A');
      }
    }

    purCatEl.addEventListener('change', refreshPurBrandsAndType);
    purBrandEl.addEventListener('change', refreshPurWattages);
    loadPurCategories();

    // ---------------- Warehouse dropdown(s) — fetched live from
    // /api/masters/warehouses (same Warehouses master the Masters page
    // manages), same source the desktop app's get_warehouses() reads from.
    // Previously this was hardcoded to "Main NAS Warehouse" / "Rajkot Godown"
    // regardless of what warehouses actually exist in the database.
    const purWhEl = $('purWh'), purEditWhEl = $('purEditWh');

    // Generic helper: fetch a list from the API (array of strings, or array
    // of objects with a .name), optionally force an extra "injectValue" into
    // the list (used so a value already saved on an old invoice never just
    // disappears from an edit dropdown even if it's no longer in the master
    // table), then fill the given <select>.
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

    async function loadPurWarehouses(injectEditValue) {
      await fillSelectFromApi(purWhEl, '/masters/warehouses', 'No warehouses found');
      await fillSelectFromApi(purEditWhEl, '/masters/warehouses', 'No warehouses found', injectEditValue);
    }
    loadPurWarehouses();

    // ---------------- Supplier ledger live autocomplete + autofill ----------
    // Mirrors attach_ledger_autocomplete() / attach_ledger_shortname_lookup()
    // in ui/purchase.py: as the user types in Supplier Name or Short Code we
    // (1) live-fetch matching ledgers from the DB to feed the suggestion list
    // (QCompleter -> here, a <datalist>), and (2) auto-fill Mobile/Address/
    // GSTIN the instant the typed text exactly matches a known ledger name or
    // short code — same as the desktop app's trigger_name_autofill() /
    // trigger_full_autofill(). The auto-filled fields stay fully EDITABLE
    // (no readonly), exactly like the desktop QLineEdit fields, so the user
    // can still type/override any of them by hand for this one invoice.
    const purSuppNameList = $('purSuppNameList');
    const purSuppShortList = $('purSuppShortList');
    let suppSearchTimer = null;

    async function searchSupplierLedgers(q) {
      try { return await window.Api.get(`/ledgers?type=Supplier&q=${encodeURIComponent(q)}`); }
      catch (e) { return []; }
    }

    // Dedicated short-code search — mirrors the desktop app's
    // attach_ledger_shortname_lookup(), which only ever matches against
    // short_name (never the full ledger name). The combined /api/ledgers
    // search above matches name OR short_name together, so a ledger whose
    // NAME happened to match the typed text (but has no/blank short code)
    // could crowd real short-code matches out of the result list — which is
    // why only one supplier's short code (e.g. "DSP") was ever suggested.
    // Hitting /api/ledgers/shortcodes instead guarantees every ledger that
    // actually has a short code is eligible to show up.
    async function searchSupplierShortCodes(q) {
      try { return await window.Api.get(`/ledgers/shortcodes?type=Supplier&q=${encodeURIComponent(q)}`); }
      catch (e) { return []; }
    }

    function fillSupplierDatalist(listEl, ledgers, key) {
      listEl.innerHTML = ledgers
        .filter((l) => String(l[key] || '').trim() !== '')
        .map((l) => `<option value="${String(l[key]).replace(/"/g, '&quot;')}">`).join('');
    }

    function applyLedgerToSupplierFields(l) {
      $('purSupp').value = l.name || '';
      $('purSuppShort').value = l.short || '';
      $('purSuppMobile').value = l.mobile && l.mobile !== '-' ? l.mobile : '';
      $('purSuppAddr').value = l.address && l.address !== '-' ? l.address : '';
      $('purSuppGstin').value = l.gstin && l.gstin !== '-' ? l.gstin : '';
    }

    function wireSupplierAutocomplete(inputEl, listEl, matchKey, searchFn) {
      inputEl.addEventListener('input', () => {
        const text = inputEl.value;
        clearTimeout(suppSearchTimer);
        suppSearchTimer = setTimeout(async () => {
          const ledgers = await searchFn(text);
          fillSupplierDatalist(listEl, ledgers, matchKey);
          // Exact match (case-insensitive), same rule as Python's
          // trigger_name_autofill / trigger_full_autofill.
          const exact = ledgers.find((l) => String(l[matchKey] || '').trim().toLowerCase() === text.trim().toLowerCase());
          if (exact) applyLedgerToSupplierFields(exact);
        }, 250); // debounce: fetch only after user pauses typing, not on every keystroke
      });
      // Also show the full/matching list as soon as the field gets focus
      // (mirrors QCompleter's popup, which is populated up front rather
      // than only after the first keystroke).
      inputEl.addEventListener('focus', async () => {
        if (inputEl.value.trim()) return; // input() above already covers non-empty case
        const ledgers = await searchFn('');
        fillSupplierDatalist(listEl, ledgers, matchKey);
      });
    }

    wireSupplierAutocomplete($('purSupp'), purSuppNameList, 'name', searchSupplierLedgers);
    wireSupplierAutocomplete($('purSuppShort'), purSuppShortList, 'short', searchSupplierShortCodes);

    // ---------------- Serial box: auto-newline on delimiter ----------------
    // Mirrors ui/serial_widgets.py's SerialTextEdit.keyPressEvent(): typing
    // a comma, space, tab, pipe, or semicolon immediately breaks the line so
    // every serial ends up one-per-line as you scan/type them.
    const purSerialsBox = $('purSerials');
    purSerialsBox.addEventListener('keydown', (e) => {
      if ([',', ' ', '|', ';', 'Tab'].includes(e.key)) {
        e.preventDefault();
        const before = purSerialsBox.value.slice(0, purSerialsBox.selectionStart);
        const after = purSerialsBox.value.slice(purSerialsBox.selectionEnd);
        const needsNewline = before && !before.endsWith('\n');
        purSerialsBox.value = before + (needsNewline ? '\n' : '') + after;
        const pos = before.length + (needsNewline ? 1 : 0);
        purSerialsBox.setSelectionRange(pos, pos);
      }
    });
    // Pasting a comma/space separated block also gets normalized to one
    // serial per line, mirroring insertFromMimeData().
    purSerialsBox.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text');
      const normalized = splitSerials(pasted).join('\n');
      const before = purSerialsBox.value.slice(0, purSerialsBox.selectionStart);
      const after = purSerialsBox.value.slice(purSerialsBox.selectionEnd);
      const prefix = before && !before.endsWith('\n') ? '\n' : '';
      purSerialsBox.value = before + prefix + normalized + '\n' + after;
    });
    // Leaving the box does one final cleanup pass, mirroring focusOutEvent().
    purSerialsBox.addEventListener('blur', () => {
      purSerialsBox.value = splitSerials(purSerialsBox.value).join('\n');
    });

    // ---------------- NEW PURCHASE panel state ----------------
    const purLines = [];
    const purProof = { files: [] };
    const purLineList = $('purLineList');
    renderLineList(purLineList, purLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
    wireLineSelection(purLineList);
    wireProofButtons('purProofFile', 'purBtnAttach', 'purBtnClearProof', 'purBtnViewProof', 'purProofName', purProof);

    $('purBtnAddLine').addEventListener('click', () => {
      const cat = $('purCat').value, brand = $('purBrand').value, watt = $('purWatt').value.trim();
      const type = $('purType').value, wh = $('purWh').value, qty = $('purQty').value.trim();
      if (!qty || Number(qty) <= 0) {
        window.openModal('Validation Error', '<p>Enter a valid Qty before adding a product line.</p>');
        return;
      }
      purLines.push({ cat, brand, watt, type, warehouse: wh, qty });
      renderLineList(purLineList, purLines, '');
      $('purQty').value = '';
    });
    $('purBtnRemoveLine').addEventListener('click', () => {
      const idx = selectedLineIndex(purLineList);
      if (idx === -1) return;
      purLines.splice(idx, 1);
      renderLineList(purLineList, purLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
    });

    function clearPurchaseForm() {
      ['purSuppShort', 'purSupp', 'purSuppMobile', 'purSuppAddr', 'purSuppGstin', 'purInv', 'purPallet', 'purQty'].forEach((id) => { $(id).value = ''; });
      $('purWatt').value = '';
      $('purDate').value = '';
      $('purSerials').value = '';
      purLines.length = 0;
      renderLineList(purLineList, purLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
      purProof.files = [];
      $('purProofFile').value = '';
      $('purProofName').textContent = 'No proof selected';
    }
    $('purBtnClearForm').addEventListener('click', clearPurchaseForm);

    $('purBtnSave').addEventListener('click', async () => {
      const missing = [];
      if (!$('purSupp').value.trim()) missing.push('Supplier Name');
      if (!$('purInv').value.trim()) missing.push('Invoice No');
      if (!$('purSerials').value.trim()) missing.push('Serial Numbers');
      if (missing.length) {
        window.openModal('Validation Error', `<p>Please fill: ${missing.join(', ')}.</p>`);
        return;
      }
      if (!purLines.length) {
        window.openModal('Validation Error', '<p>Add at least one Invoice Product Line before saving.</p>');
        return;
      }
      // Split pasted serials across the product lines in order, same qty
      // grouping the desktop app does (line 1 takes its qty worth, then
      // line 2, and so on).
      const allSerials = splitSerials($('purSerials').value);

      // ---- Check 1: Qty match — mirrors build_current_purchase_line()'s
      // "Quantity mismatch" rule: total Qty across all product lines must
      // equal exactly how many serials were entered — not less, not more.
      const totalQty = purLines.reduce((sum, ln) => sum + (Number(ln.qty) || 0), 0);
      if (allSerials.length !== totalQty) {
        window.openModal('Quantity Mismatch',
          `<p>Total Qty across product lines is <strong>${totalQty}</strong>, but <strong>${allSerials.length}</strong> serial number(s) were entered. These must match exactly.</p>`);
        return;
      }

      // ---- Check 2: duplicate serial within this invoice itself — mirrors
      // process_purchase_inward()'s "Same serial number is present in
      // multiple product lines" check.
      const seen = new Set(), innerDupes = new Set();
      allSerials.forEach((sn) => { if (seen.has(sn)) innerDupes.add(sn); seen.add(sn); });
      if (innerDupes.size) {
        window.openModal('Duplicate Serial Error',
          `<p>These serial numbers are repeated in this invoice: ${[...innerDupes].join(', ')}</p>`);
        return;
      }

      // ---- Check 3: already exists in stock (real DB check) — mirrors
      // process_purchase_inward()'s "Inward Blocked! ... already exist in
      // the database" check against stock_ledger.
      let alreadyExists = [];
      try {
        alreadyExists = await window.Api.get(`/purchase/check-serials?serials=${encodeURIComponent(allSerials.join(','))}`);
      } catch (e) {
        window.openModal('Server Error', '<p>Could not verify serial numbers against the database. Please try again.</p>');
        return;
      }
      if (alreadyExists.length) {
        window.openModal('Duplicate Serial Error',
          `<p>Inward Blocked! The following Serial Numbers already exist in the database:<br><br>${alreadyExists.join(', ')}</p>`);
        return;
      }

      let cursor = 0;
      const lines = purLines.map((ln) => {
        const qty = Number(ln.qty) || 0;
        const serials = allSerials.slice(cursor, cursor + qty);
        cursor += qty;
        return { cat: ln.cat, brand: ln.brand, watt: ln.watt, type: ln.type, warehouse: ln.warehouse, qty, serials };
      });

      const invoiceNo = $('purInv').value.trim();
      const saveBtn = $('purBtnSave');
      saveBtn.disabled = true;
      try {
        await window.Api.post('/purchase', {
          invoiceNo,
          date: PD.dmyFromISO($('purDate').value) || $('purDate').value,
          supplier: $('purSupp').value.trim(),
          supplierShort: $('purSuppShort').value.trim(),
          supplierMobile: $('purSuppMobile').value.trim(),
          supplierGstin: $('purSuppGstin').value.trim(),
          supplierAddress: $('purSuppAddr').value.trim(),
          pallet: $('purPallet').value.trim(),
          proofName: purProof.files.length ? (purProof.files.length === 1 ? purProof.files[0].name : `${purProof.files.length} files`) : '-',
          lines,
        });
        if (window.showToast) window.showToast('Purchase invoice saved to the database.');
        window.openModal('Success', `<p>Purchase invoice <strong>${invoiceNo}</strong> saved with ${purLines.length} product line(s) and ${allSerials.length} serial(s). It now appears in the Purchase Register.</p>`);
        clearPurchaseForm();
      } catch (err) {
        window.openModal('Save Failed', `<p>${err.message || 'Could not save this purchase invoice. Please try again.'}</p>`);
      } finally {
        saveBtn.disabled = false;
      }
    });

    // ---------------- EDIT PANEL state ----------------
    const purEditLines = [];
    const purEditProof = { files: [] };
    const purEditLineList = $('purEditLineList');
    let loadedInvoiceNo = null; // invoice currently loaded in the edit panel, null until Find succeeds
    let loadedOriginalSerials = []; // every serial this invoice had at load time (for diffing on Apply)
    let clearEditPanel = () => {};
    let findPurchaseInvoiceForEditing = () => false;

    if (isAdmin) {
      wireLineSelection(purEditLineList);
      wireProofButtons('purEditProofFile', 'purBtnEditAttach', null, 'purBtnViewEditProof', 'purEditProofName', purEditProof);

      // ---------------- Edit panel: Category -> Brand/Type -> Wattage,
      // fetched live from the database exactly like the New Purchase Entry
      // form (mirrors ui/purchase.py's sync_edit_purchase_brands() /
      // sync_edit_purchase_wattages() / sync_edit_purchase_types()).
      // Previously these three dropdowns were hardcoded to a fixed 2-3
      // option list unrelated to the real Categories/Brands/Subtypes
      // masters. `injectValue` keeps an already-saved historical value
      // visible/selected even if it's no longer part of the current master
      // data (same "add item if missing" behaviour as the desktop combo).
      const purEditCatEl = $('purEditCat'), purEditBrandEl = $('purEditBrand'), purEditWattEl = $('purEditWatt'), purEditTypeEl = $('purEditType');

      async function refreshPurEditBrandsAndType(injectBrand, injectType) {
        const cat = purEditCatEl.value;
        if (!cat) {
          fillSelect(purEditBrandEl, [], '-- Select Category First --');
          fillSelect(purEditTypeEl, [], '-- Select Category First --');
          await refreshPurEditWattages();
          return;
        }
        await fillSelectFromApi(purEditBrandEl, `/purchase/brands/${encodeURIComponent(cat)}`, 'No brands under this category', injectBrand);
        try {
          const subtypes = await window.Api.get(`/masters/subtypes/${encodeURIComponent(cat)}`);
          const list = subtypes.length ? subtypes.slice() : ['Others'];
          if (injectType && !list.includes(injectType)) list.push(injectType);
          fillSelect(purEditTypeEl, list, 'Others');
          if (injectType) purEditTypeEl.value = injectType;
        } catch (e) {
          fillSelect(purEditTypeEl, injectType ? [injectType] : ['Others'], 'Others');
        }
        await refreshPurEditWattages();
      }

      async function refreshPurEditWattages(injectWatt) {
        const cat = purEditCatEl.value, brand = purEditBrandEl.value;
        if (!cat || !brand) {
          fillSelect(purEditWattEl, [], '-- Select Brand First --');
          return;
        }
        await fillSelectFromApi(purEditWattEl, `/purchase/wattages?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}`, 'N/A', injectWatt);
      }

      purEditCatEl.addEventListener('change', () => refreshPurEditBrandsAndType());
      purEditBrandEl.addEventListener('change', () => refreshPurEditWattages());

      // Loads Category -> Brand -> Wattage -> Type -> Warehouse for the
      // edit panel in one go, keeping whatever the loaded invoice line
      // actually had selected (used by findPurchaseInvoiceForEditing below).
      async function loadEditCascadeForLine(line) {
        if (!line) return;
        await fillSelectFromApi(purEditCatEl, '/masters/categories', 'No categories found', line.cat);
        await fillSelectFromApi(purEditBrandEl, `/purchase/brands/${encodeURIComponent(purEditCatEl.value)}`, 'No brands under this category', line.brand);
        try {
          const subtypes = await window.Api.get(`/masters/subtypes/${encodeURIComponent(purEditCatEl.value)}`);
          const list = subtypes.length ? subtypes.slice() : ['Others'];
          if (line.type && !list.includes(line.type)) list.push(line.type);
          fillSelect(purEditTypeEl, list, 'Others');
          purEditTypeEl.value = line.type || '';
        } catch (e) {
          fillSelect(purEditTypeEl, line.type ? [line.type] : ['Others'], 'Others');
        }
        await fillSelectFromApi(purEditWattEl, `/purchase/wattages?category=${encodeURIComponent(purEditCatEl.value)}&brand=${encodeURIComponent(purEditBrandEl.value)}`, 'N/A', line.watt);
        await fillSelectFromApi(purEditWhEl, '/masters/warehouses', 'No warehouses found', line.warehouse);
      }

      // Initial fill so the panel isn't empty before any invoice is found.
      fillSelectFromApi(purEditCatEl, '/masters/categories', 'No categories found');
      $('purBtnKeepProof').addEventListener('click', () => {
        purEditProof.files = [];
        $('purEditProofFile').value = '';
        $('purEditProofName').textContent = 'Keeping existing proof file';
      });

      clearEditPanel = function () {
        ['purEditSupp', 'purEditInv', 'purEditPallet', 'purEditWatt', 'purEditSerials'].forEach((id) => { $(id).value = ''; });
        $('purEditDate').value = '';
        purEditLines.length = 0;
        loadedInvoiceNo = null;
        loadedOriginalSerials = [];
        renderLineList(purEditLineList, purEditLines, 'Find an invoice above to load its lines.');
        purEditProof.files = [];
        $('purEditProofFile').value = '';
        $('purEditProofName').textContent = 'No proof selected';
      };
      $('purBtnClearEdit').addEventListener('click', clearEditPanel);

      $('purBtnEditAddLine').addEventListener('click', () => {
        purEditLines.push({
          cat: $('purEditCat').value, brand: $('purEditBrand').value, watt: $('purEditWatt').value.trim(),
          type: $('purEditType').value, warehouse: $('purEditWh').value, qty: '1',
        });
        renderLineList(purEditLineList, purEditLines, '');
      });
      $('purBtnEditRemoveLine').addEventListener('click', () => {
        const idx = selectedLineIndex(purEditLineList);
        if (idx === -1) return;
        purEditLines.splice(idx, 1);
        renderLineList(purEditLineList, purEditLines, 'Find an invoice above to load its lines.');
      });

      // Mirrors find_purchase_invoice_for_editing(): search by Invoice No,
      // Supplier Name, or Short Name, load the matching invoice's header +
      // every product line + all its serials into the edit panel. This same
      // function backs both the "Find" button and the Purchase Register's
      // double-click-to-edit redirect.
      findPurchaseInvoiceForEditing = async function (term) {
        if (!term) {
          window.openModal('Search Required', '<p>Type an Invoice No, Supplier Name, or Short Name to search first.</p>');
          return false;
        }
        let inv;
        try {
          inv = await window.Api.get(`/purchase/find?term=${encodeURIComponent(term)}`);
        } catch (err) {
          window.openModal('Not Found', `<p>${err.message || 'No purchase invoice records found matching Invoice No / Supplier Name / Short Name.'}</p>`);
          return false;
        }
        loadedInvoiceNo = inv.invoiceNo;
        loadedOriginalSerials = inv.allSerials || [];
        $('purEditSupp').value = inv.supplier;
        $('purEditInv').value = inv.invoiceNo;
        $('purEditPallet').value = inv.pallet || '';
        $('purEditDate').value = PD.isoFromDMY(inv.date);
        $('purEditProofName').textContent = inv.proofName && inv.proofName !== '-' ? inv.proofName : 'No proof selected';
        purEditProof.files = [];

        purEditLines.length = 0;
        inv.lines.forEach((ln) => purEditLines.push({ cat: ln.cat, brand: ln.brand, watt: ln.watt, type: ln.type, warehouse: ln.warehouse, qty: ln.qty, serials: ln.serials }));
        renderLineList(purEditLineList, purEditLines, 'Find an invoice above to load its lines.');
        // Category/Brand/Wattage/Type/Warehouse dropdowns all reload live
        // from the database here, pre-selecting whatever this invoice's
        // first line actually had (and keeping that value visible even if
        // it's since been removed from the masters) — mirrors the desktop
        // app's sync_edit_purchase_* methods instead of the old fixed lists.
        await loadEditCascadeForLine(purEditLines[0]);
        const allSerials = inv.lines.reduce((acc, ln) => acc.concat(ln.serials || []), []);
        $('purEditSerials').value = allSerials.join('\n');

        window.openModal('Invoice Loaded', `<p>Purchase invoice <strong>${inv.invoiceNo}</strong> loaded with ${inv.lines.length} product line(s) and ${allSerials.length} serial(s).</p>`);
        return true;
      };

      $('purBtnFind').addEventListener('click', () => {
        findPurchaseInvoiceForEditing($('purSearchInv').value.trim());
      });

      $('purBtnApply').addEventListener('click', async () => {
        if (!$('purEditSupp').value.trim() || !$('purEditInv').value.trim()) {
          window.openModal('Validation Error', '<p>Supplier and Invoice No are required before applying modifications.</p>');
          return;
        }
        if (!loadedInvoiceNo) {
          window.openModal('Not Found', '<p>Find an invoice first before applying modifications.</p>');
          return;
        }
        const allSerials = PD.splitSerials($('purEditSerials').value);
        let cursor = 0;
        const lines = (purEditLines.length ? purEditLines : [{
          cat: $('purEditCat').value, brand: $('purEditBrand').value, watt: $('purEditWatt').value.trim(),
          type: $('purEditType').value, warehouse: $('purEditWh').value, qty: allSerials.length,
        }]).map((ln) => {
          const qty = Number(ln.qty) || 0;
          const serials = allSerials.slice(cursor, cursor + qty);
          cursor += qty;
          return { cat: ln.cat, brand: ln.brand, watt: ln.watt, type: ln.type, warehouse: ln.warehouse, qty, serials };
        });

        const applyBtn = $('purBtnApply');
        applyBtn.disabled = true;
        try {
          const result = await window.Api.put(`/purchase/${encodeURIComponent(loadedInvoiceNo)}`, {
            invoiceNo: $('purEditInv').value.trim(),
            date: PD.dmyFromISO($('purEditDate').value) || $('purEditDate').value,
            supplier: $('purEditSupp').value.trim(),
            pallet: $('purEditPallet').value.trim(),
            // Only send a new proof name if a replacement file was actually
            // attached this time — null tells the backend to keep whatever
            // attachment the invoice already had (mirrors "Keep Existing").
            proofName: purEditProof.files.length
              ? (purEditProof.files.length === 1 ? purEditProof.files[0].name : `${purEditProof.files.length} files`)
              : null,
            lines,
            originalSerials: loadedOriginalSerials,
          });
          loadedInvoiceNo = result.invoiceNo;
          loadedOriginalSerials = allSerials;
          if (window.showToast) window.showToast('Purchase invoice updated.');
          window.openModal('Saved', `<p>Purchase invoice <strong>${loadedInvoiceNo}</strong> updated. It's now flagged <strong>Edited: Yes</strong> in the Purchase Register.</p>`);
        } catch (err) {
          window.openModal('Update Failed', `<p>${err.message || 'Could not apply modifications. Please try again.'}</p>`);
        } finally {
          applyBtn.disabled = false;
        }
      });

      $('purBtnDelete').addEventListener('click', async () => {
        if (!loadedInvoiceNo) {
          window.openModal('Not Found', '<p>Find an invoice first before trying to delete it.</p>');
          return;
        }
        const invNo = loadedInvoiceNo;
        if (!(await window.confirmDanger('Delete Purchase Invoice', `Are you sure you want to permanently delete purchase invoice ${invNo}? This removes it from the Purchase Register too.`))) return;
        try {
          await window.Api.delete(`/purchase/${encodeURIComponent(invNo)}`);
          if (window.showToast) window.showToast(`Purchase invoice ${invNo} deleted.`);
          clearEditPanel();
          window.openModal('Deleted', `<p>Purchase invoice <strong>${invNo}</strong> deleted successfully.</p>`);
        } catch (err) {
          window.openModal('Delete Failed', `<p>${err.message || 'Could not delete this purchase invoice. Please try again.'}</p>`);
        }
      });
    } else {
      // Non-SuperAdmin: keep the panel's fields visible but non-interactive,
      // and show a locked notice, mirroring enforce_role_restrictions().
      const editPanelEl = $('purEditPanel');
      editPanelEl.querySelectorAll('input, select, textarea, button').forEach((el) => { el.disabled = true; });
      const lockBanner = document.createElement('div');
      lockBanner.className = 'banner';
      lockBanner.style.marginBottom = '14px';
      lockBanner.innerHTML = '<i class="fa-solid fa-lock"></i><div><strong>Locked.</strong> Only a SuperAdmin can view or modify saved purchase invoices.</div>';
      editPanelEl.insertBefore(lockBanner, editPanelEl.children[1] || null);
    }

    // ---------------- Cross-page redirect API ----------------
    // Called from Purchase Register (js/pages/purchaseregister.js) when a
    // record is double-clicked: same open_transaction_editor() flow as the
    // desktop app — jump here, open the edit section, search + autofill it.
    window.PurchasePageAPI = {
      loadInvoiceForEdit(invoiceNo) {
        if (!isAdmin) {
          window.openModal('Locked', '<p>Only a SuperAdmin can modify purchase invoices. Switch users from the profile menu if you need edit access.</p>');
          return;
        }
        setPurEditOpen(true);
        $('purSearchInv').value = invoiceNo;
        findPurchaseInvoiceForEditing(invoiceNo);
        const panel = $('purEditPanel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    };
  },
};