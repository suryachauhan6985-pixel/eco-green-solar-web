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
      <button type="button" class="info-btn" data-info="Execute Stock Inward saves directly to the database. Find, Apply Modifications, and Delete all operate on live records."><i class="fa-solid fa-circle-info"></i></button>
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
            <div class="field" id="purWattField"><label>Wattage <span class="req">*</span></label>
              <select id="purWatt"><option value="">-- Select Brand First --</option></select></div>
            <div class="field" id="purModelField" style="display:none;"><label>Model <span class="req">*</span></label>
              <select id="purModel"><option value="">-- Select Brand First --</option></select></div>
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
                <input type="file" id="purProofFile" multiple style="display:none;" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx">
                <button class="btn btn-ghost" type="button" id="purBtnAttach"><i class="fa-solid fa-paperclip"></i> Add Attachment</button>
                <button class="btn btn-ghost" type="button" id="purBtnClearProof"><i class="fa-solid fa-xmark"></i> Clear All</button>
                <span class="proof-name" id="purProofName">No proof selected</span>
              </div>
            </div>

            <div class="field span-full" id="purSerialWrap"><label>Serial Numbers <span class="req">*</span></label>
              <div class="ss-scan-input-wrap">
                <textarea id="purSerials" placeholder="One serial per line, it auto-splits — or tap the scan icon"></textarea>
                <button type="button" class="ss-scan-icon-btn" id="purScanBtn" title="Scan barcode / QR"><i class="fa-solid fa-barcode"></i></button>
              </div>
            </div>
            <div class="field span-full" id="purQtyOnlyNote" style="display:none;">
              <p style="color:var(--txt-muted); font-style:italic; margin:0;">This category is quantity-tracked (no serial numbers) — the line's Qty is final as entered.</p>
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
            <div class="field" id="purEditWattField"><label>Wattage <span class="req">*</span></label>
              <select id="purEditWatt"><option value="">-- Select Brand First --</option></select></div>
            <div class="field" id="purEditModelField" style="display:none;"><label>Model <span class="req">*</span></label>
              <select id="purEditModel"><option value="">-- Select Brand First --</option></select></div>
            <div class="field"><label>Type <span class="req">*</span></label>
              <select id="purEditType"><option value="">-- Select Category First --</option></select></div>
            <div class="field"><label>Qty <span class="req">*</span></label><input id="purEditQty" type="number" placeholder="0"></div>

            <div class="field span-full"><label>Date <span class="req">*</span></label><input id="purEditDate" type="date"></div>

            <div class="field span-full"><label>Proof File</label>
              <div class="proof-row">
                <input type="file" id="purEditProofFile" multiple style="display:none;" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx">
                <button class="btn btn-ghost" type="button" id="purBtnEditAttach"><i class="fa-solid fa-paperclip"></i> Add Attachment</button>
                <button class="btn btn-ghost" type="button" id="purBtnKeepProof"><i class="fa-solid fa-rotate-left"></i> Keep Existing</button>
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

            <div class="field span-full" id="purEditSerialWrap"><label>Serial Numbers <span class="req">*</span></label>
              <div class="ss-scan-input-wrap">
                <textarea id="purEditSerials" placeholder="Loaded serials will appear here after Find — or tap the scan icon"></textarea>
                <button type="button" class="ss-scan-icon-btn" id="purEditScanBtn" title="Scan barcode / QR"><i class="fa-solid fa-barcode"></i></button>
              </div>
            </div>
            <div class="field span-full" id="purEditQtyOnlyNote" style="display:none;">
              <p style="color:var(--txt-muted); font-style:italic; margin:0;">This category is quantity-tracked (no serial numbers) — the line's Qty is final as entered.</p>
            </div>
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
    const isAdmin = currentRole === 'SuperAdmin' || currentRole === 'Admin';

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
          <span>${ln.cat} • ${ln.brand} ${ln.model ? '• ' + ln.model : (ln.watt ? '• ' + ln.watt + 'W' : '')} • ${ln.type} • ${ln.warehouse}</span>
          <span class="qty-badge">Qty ${ln.qty}${ln.needsSerial === false ? ' <small>(Quantity-based, no serial)</small>' : ''}</span>
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

    const purCatEl = $('purCat'), purBrandEl = $('purBrand'), purWattEl = $('purWatt'), purModelEl = $('purModel'), purTypeEl = $('purType');

    // Category -> serial_mandatory / watt_mandatory lookup — only
    // Panel/Inverter-type categories (flagged in Masters > Category) need
    // actual Serial Numbers. Every other category is quantity-tracked: the
    // Qty field entered on the line IS the final quantity, no serial
    // scanning needed. watt_mandatory drives the Wattage<->Model field swap
    // below (same rule Masters > Item Registration already applies).
    let purCategorySerialMandatory = {};
    let purCategoryWattMandatory = {};
    function purCategoryNeedsSerial(cat) {
      return !!purCategorySerialMandatory[cat];
    }
    // Mirrors masters.js's syncWattMandatoryUI(): when NEITHER Wattage nor
    // Serial No. applies to the selected category, Model replaces Wattage
    // as the differentiator (e.g. PVC Pipe "2 Inch"). Defaults to false
    // (Wattage shown) until a real category is selected.
    function purCategoryNeedsModel(cat) {
      if (!cat) return false;
      return !purCategoryWattMandatory[cat] && !purCategorySerialMandatory[cat];
    }

    async function loadPurCategories() {
      try {
        const cats = await window.Api.get('/masters/categories');
        fillSelect(purCatEl, cats.map((c) => c.name), 'No categories found');
        purCategorySerialMandatory = {};
        purCategoryWattMandatory = {};
        (cats || []).forEach((c) => {
          purCategorySerialMandatory[c.name] = !!c.serial_mandatory;
          purCategoryWattMandatory[c.name] = !!c.watt_mandatory;
        });
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
        await refreshPurModels();
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
      await refreshPurModels();
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

    // Model dropdown's equivalent of refreshPurWattages() above — same
    // Category+Brand cascading, just a different source list. Only ever
    // shown/used for categories where purCategoryNeedsModel() is true.
    async function refreshPurModels() {
      const cat = purCatEl.value, brand = purBrandEl.value;
      if (!cat || !brand) {
        fillSelect(purModelEl, [], '-- Select Brand First --');
        return;
      }
      try {
        const models = await window.Api.get(`/purchase/models?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}`);
        fillSelect(purModelEl, models.length ? models : ['N/A'], 'N/A');
      } catch (e) {
        fillSelect(purModelEl, ['N/A'], 'N/A');
      }
    }

    // Swaps the Wattage field for the Model field (or back) based on the
    // selected category's rule — mirrors masters.js's own Wattage/Model
    // field toggle in Item Registration.
    function updatePurWattModelVisibility() {
      const showModel = purCategoryNeedsModel(purCatEl.value);
      $('purWattField').style.display = showModel ? 'none' : '';
      $('purModelField').style.display = showModel ? '' : 'none';
    }

    purCatEl.addEventListener('change', () => { refreshPurBrandsAndType(); updatePurSerialVisibility(); updatePurWattModelVisibility(); });
    purBrandEl.addEventListener('change', () => { refreshPurWattages(); refreshPurModels(); });
    loadPurCategories().then(() => { updatePurSerialVisibility(); updatePurWattModelVisibility(); });

    // Shows/hides the pooled Serial Numbers box depending on whether it's
    // still needed: visible if EITHER the category currently selected
    // (about to be added as a line) is serial-mandatory, OR any product
    // line already added to this invoice is serial-mandatory (an invoice
    // can mix serial and quantity-tracked lines, so removing/blurring a
    // serial-mandatory category from the dropdown must never hide serials
    // already typed for an earlier line). Purely quantity-tracked invoices
    // never see this box at all.
    function updatePurSerialVisibility() {
      const needsSerial = purCategoryNeedsSerial(purCatEl.value) || purLines.some((ln) => ln.needsSerial);
      $('purSerialWrap').style.display = needsSerial ? '' : 'none';
      $('purQtyOnlyNote').style.display = needsSerial ? 'none' : '';
    }

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

    // ---------------- Serial scanner (camera) ----------------
    // Same "html5-qrcode" library + overlay markup/classes used by the SCAN
    // To Sheet page (js/pages/scansheet.js — loaded globally via CDN in
    // index.html, and .ss-scanner-* / .ss-scan-input-wrap / .ss-scan-icon-btn
    // CSS already ships site-wide via css/modules/scan-sheet.css) so the
    // scan UI looks/feels identical here instead of reinventing it.
    // Flow mirrors scansheet.js's onScanSuccess -> showScanResult ->
    // Retry/Save exactly: after each decode, the camera PAUSES and a result
    // card shows the scanned value with "Retry" (discard, resume scanning)
    // and "Done" (add it to the Serial Numbers box, then resume scanning
    // for the next one). Nothing gets added to the textarea until "Done"
    // is tapped — this replaces the earlier auto-add-on-every-scan version.
    const purScanState = {
      html5QrCode: null,
      cameras: [],
      cameraIndex: 0,
      torchOn: false,
      overlayEl: null,
      targetId: null,
      handledOnce: false,   // true while a scan result is on screen awaiting Retry/Done
      pendingText: null,
      pendingIsDup: false,
      addedCount: 0,
    };

    function purScanBeep() {
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

    function purScanSetStatus(msg) {
      const el = document.getElementById('purScanStatus');
      if (el) el.textContent = msg;
    }

    function openPurchaseScanner(targetId) {
      const box = document.getElementById(targetId);
      if (!box) return;
      purScanState.targetId = targetId;
      purScanState.torchOn = false;
      purScanState.handledOnce = false;
      purScanState.pendingText = null;
      purScanState.pendingIsDup = false;
      purScanState.addedCount = 0;

      const overlay = document.createElement('div');
      overlay.className = 'ss-scanner-overlay';
      overlay.innerHTML = `
        <div class="ss-scanner-topbar">
          <button type="button" class="ss-icon-btn light" id="purScanBack" title="Close"><i class="fa-solid fa-arrow-left"></i></button>
          <div class="ss-scanner-title">Scan Serial Numbers</div>
          <div class="ss-scanner-topbtns">
            <button type="button" class="ss-icon-btn light" id="purScanTorch" title="Flashlight"><i class="fa-solid fa-bolt"></i></button>
            <button type="button" class="ss-icon-btn light" id="purScanFlip" title="Flip camera"><i class="fa-solid fa-camera-rotate"></i></button>
          </div>
        </div>
        <div class="ss-scanner-camwrap">
          <div id="purScanRegion" class="ss-scanner-camfeed"></div>
          <div class="ss-scanner-target" id="purScanTargetBox"></div>
          <div class="ss-scanner-instruction" id="purScanStatus">Requesting camera permission&hellip;</div>
          <div class="ss-scanner-result" id="purScanResult" style="display:none;">
            <div class="ss-scanner-result-card" id="purScanResultCard">
              <div class="ss-scanner-result-label">Scanned value</div>
              <div class="ss-scanner-result-value" id="purScanResultValue"></div>
              <div class="ss-scanner-result-msg" id="purScanResultMsg"></div>
            </div>
            <div class="ss-scanner-result-actions">
              <button type="button" class="btn btn-ghost" id="purScanRetry"><i class="fa-solid fa-rotate-left"></i> Retry</button>
              <button type="button" class="btn btn-green" id="purScanDone2"><i class="fa-solid fa-check"></i> Done</button>
            </div>
          </div>
        </div>
        <div class="ss-scanner-bottom">
          <span class="proof-name" id="purScanCount" style="color:#fff;">0 serial(s) added</span>
          <button type="button" class="btn btn-red ss-scanner-cancel" id="purScanCancel"><i class="fa-solid fa-xmark"></i> Close</button>
        </div>
      `;
      document.body.appendChild(overlay);
      purScanState.overlayEl = overlay;
      document.body.style.overflow = 'hidden';

      overlay.querySelector('#purScanBack').onclick = closePurchaseScanner;
      overlay.querySelector('#purScanCancel').onclick = closePurchaseScanner;
      overlay.querySelector('#purScanTorch').onclick = togglePurchaseTorch;
      overlay.querySelector('#purScanFlip').onclick = flipPurchaseCamera;
      overlay.querySelector('#purScanRetry').onclick = retryPurchaseScan;
      overlay.querySelector('#purScanDone2').onclick = confirmPurchaseScan;

      startPurchaseCamera();
    }

    function startPurchaseCamera() {
      if (!window.Html5Qrcode) {
        purScanSetStatus('Scanner library failed to load. Check your connection and try again.');
        return;
      }
      window.Html5Qrcode.getCameras().then((cameras) => {
        if (!cameras || !cameras.length) { purScanSetStatus('No camera found on this device.'); return; }
        purScanState.cameras = cameras;
        const backIdx = cameras.findIndex((c) => /back|rear|environment/i.test(c.label || ''));
        purScanState.cameraIndex = backIdx !== -1 ? backIdx : 0;
        launchPurchaseCamera();
      }).catch((err) => {
        console.warn('Camera permission error', err);
        purScanSetStatus('Camera permission denied. Please allow camera access in your browser settings, then tap Cancel and try again.');
      });
    }

    function launchPurchaseCamera() {
      const camera = purScanState.cameras[purScanState.cameraIndex];
      if (!camera) return;
      purScanState.handledOnce = false;
      purScanSetStatus('Place the serial barcode / QR in the box');

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

      purScanState.html5QrCode = new window.Html5Qrcode('purScanRegion', { verbose: false });
      purScanState.html5QrCode.start(
        camera.id,
        config,
        onPurchaseScanSuccess,
        () => { /* per-frame "no code found yet" — expected, ignore */ }
      ).catch((err) => {
        console.warn('Camera start error', err);
        purScanSetStatus('Could not start the camera. Tap Cancel and try again.');
      });
    }

    // Decoding pauses here (handledOnce guard, exactly like scansheet.js)
    // until the user explicitly taps Retry or Done on the result card.
    function onPurchaseScanSuccess(decodedText) {
      if (purScanState.handledOnce) return;
      purScanState.handledOnce = true;
      purScanBeep();
      if (navigator.vibrate) { try { navigator.vibrate(180); } catch (e) { /* not supported */ } }
      showPurchaseScanResult(decodedText);
    }

    // Paints the decoded value on a result card over the camera feed and
    // flags it as duplicate (already in this Serial Numbers box) if it is
    // — same "Retry" (discard) / "Done" (add to box) choice scansheet.js
    // gives, so nothing lands in the box on a bad/duplicate scan.
    function showPurchaseScanResult(text) {
      const code = String(text || '').trim();
      const box = document.getElementById(purScanState.targetId);
      const existing = box ? splitSerials(box.value) : [];
      const dup = !!code && existing.some((s) => s.toLowerCase() === code.toLowerCase());

      purScanState.pendingText = code;
      purScanState.pendingIsDup = dup;

      const panel = document.getElementById('purScanResult');
      const card = document.getElementById('purScanResultCard');
      const valueEl = document.getElementById('purScanResultValue');
      const msgEl = document.getElementById('purScanResultMsg');
      const doneBtn = document.getElementById('purScanDone2');
      const targetBox = document.getElementById('purScanTargetBox');
      if (!panel || !valueEl) return;

      valueEl.textContent = code || '(empty)';
      if (card) card.classList.toggle('dup', dup);
      if (msgEl) msgEl.textContent = dup
        ? 'This serial no. is already in the box. Retry with a different code, or remove the old one first.'
        : 'Scanned successfully.';
      if (doneBtn) doneBtn.style.display = dup ? 'none' : '';

      panel.style.display = 'flex';
      purScanSetStatus('');
      if (targetBox) targetBox.style.visibility = 'hidden';
    }

    function hidePurchaseScanResult() {
      const panel = document.getElementById('purScanResult');
      const targetBox = document.getElementById('purScanTargetBox');
      if (panel) panel.style.display = 'none';
      if (targetBox) targetBox.style.visibility = '';
      purScanState.pendingText = null;
      purScanState.pendingIsDup = false;
    }

    // "Retry" — discard the paused result and resume live scanning.
    function retryPurchaseScan() {
      hidePurchaseScanResult();
      purScanState.handledOnce = false;
      purScanSetStatus('Place the serial barcode / QR in the box');
    }

    // "Done" — commit the scanned value into the Serial Numbers box (one
    // per line, same normalization the paste handler above uses), then
    // resume scanning so the next serial can be captured right away.
    function confirmPurchaseScan() {
      if (purScanState.pendingIsDup) return; // guard — Done button is hidden for dupes anyway
      const code = purScanState.pendingText;
      if (!code) { retryPurchaseScan(); return; }

      const box = document.getElementById(purScanState.targetId);
      if (box) {
        const existing = splitSerials(box.value);
        existing.push(code);
        box.value = existing.join('\n') + '\n';
        box.dispatchEvent(new Event('input', { bubbles: true }));
        purScanState.addedCount = existing.length;
        const countEl = document.getElementById('purScanCount');
        if (countEl) countEl.textContent = `${existing.length} serial(s) added`;
      }

      hidePurchaseScanResult();
      purScanState.handledOnce = false;
      purScanSetStatus('Added \u2713 — scan the next one');
    }

    function togglePurchaseTorch() {
      if (!purScanState.html5QrCode) return;
      purScanState.torchOn = !purScanState.torchOn;
      purScanState.html5QrCode.applyVideoConstraints({ advanced: [{ torch: purScanState.torchOn }] })
        .then(() => {
          const btn = document.getElementById('purScanTorch');
          if (btn) btn.classList.toggle('active', purScanState.torchOn);
        })
        .catch(() => { window.showToast('Flashlight not supported on this device'); purScanState.torchOn = false; });
    }

    function flipPurchaseCamera() {
      if (!purScanState.cameras.length || purScanState.cameras.length < 2) { window.showToast('Only one camera available'); return; }
      purScanState.cameraIndex = (purScanState.cameraIndex + 1) % purScanState.cameras.length;
      const qr = purScanState.html5QrCode;
      if (qr) qr.stop().then(launchPurchaseCamera).catch(launchPurchaseCamera);
      else launchPurchaseCamera();
    }

    function closePurchaseScanner() {
      const qr = purScanState.html5QrCode;
      const targetId = purScanState.targetId;
      purScanState.pendingText = null;
      purScanState.pendingIsDup = false;
      const finish = () => {
        if (purScanState.overlayEl) { purScanState.overlayEl.remove(); purScanState.overlayEl = null; }
        document.body.style.overflow = '';
        purScanState.html5QrCode = null;
        // Final normalize pass (dedupe/trim), same cleanup blur() already
        // does for the New Entry box — keeps Edit-box scans tidy too.
        const box = targetId ? document.getElementById(targetId) : null;
        if (box) {
          box.value = splitSerials(box.value).join('\n');
          box.focus();
        }
      };
      if (qr) qr.stop().then(finish).catch(finish);
      else finish();
    }

    const purScanBtnEl = $('purScanBtn');
    if (purScanBtnEl) purScanBtnEl.addEventListener('click', () => openPurchaseScanner('purSerials'));
    const purEditScanBtnEl = $('purEditScanBtn');
    if (purEditScanBtnEl) purEditScanBtnEl.addEventListener('click', () => openPurchaseScanner('purEditSerials'));

    // ---------------- NEW PURCHASE panel state ----------------
    const purLines = [];
    const purProof = { files: [] };
    const purLineList = $('purLineList');
    renderLineList(purLineList, purLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
    wireLineSelection(purLineList);
    wireProofButtons('purProofFile', 'purBtnAttach', 'purBtnClearProof', 'purProofName', purProof);

    $('purBtnAddLine').addEventListener('click', () => {
      const cat = $('purCat').value, brand = $('purBrand').value;
      const needsModel = purCategoryNeedsModel(cat);
      const watt = needsModel ? '' : $('purWatt').value.trim();
      const model = needsModel ? $('purModel').value.trim() : '';
      const type = $('purType').value, wh = $('purWh').value, qty = $('purQty').value.trim();
      if (!qty || Number(qty) <= 0) {
        window.openModal('Validation Error', '<p>Enter a valid Qty before adding a product line.</p>');
        return;
      }
      const needsSerial = purCategoryNeedsSerial(cat);
      purLines.push({ cat, brand, watt, model, type, warehouse: wh, qty, needsSerial });
      renderLineList(purLineList, purLines, '');
      $('purQty').value = '';
      updatePurSerialVisibility();
    });
    $('purBtnRemoveLine').addEventListener('click', () => {
      const idx = selectedLineIndex(purLineList);
      if (idx === -1) return;
      purLines.splice(idx, 1);
      renderLineList(purLineList, purLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
      updatePurSerialVisibility();
    });

    function clearPurchaseForm() {
      ['purSuppShort', 'purSupp', 'purSuppMobile', 'purSuppAddr', 'purSuppGstin', 'purInv', 'purPallet', 'purQty'].forEach((id) => { $(id).value = ''; });
      $('purWatt').value = '';
      $('purModel').value = '';
      $('purDate').value = '';
      $('purSerials').value = '';
      purLines.length = 0;
      renderLineList(purLineList, purLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
      purProof.files = [];
      $('purProofFile').value = '';
      $('purProofName').textContent = 'No proof selected';
      updatePurSerialVisibility();
    }
    $('purBtnClearForm').addEventListener('click', clearPurchaseForm);

    $('purBtnSave').addEventListener('click', async () => {
      const serialLines = purLines.filter((ln) => ln.needsSerial);
      const missing = [];
      if (!$('purSupp').value.trim()) missing.push('Supplier Name');
      if (!$('purInv').value.trim()) missing.push('Invoice No');
      // Serial Numbers are only required if at least one added line belongs
      // to a serial-mandatory category (Panel/Inverter). Pure quantity-based
      // invoices never touch this field at all.
      if (serialLines.length && !$('purSerials').value.trim()) missing.push('Serial Numbers');
      if (missing.length) {
        window.openModal('Validation Error', `<p>Please fill: ${missing.join(', ')}.</p>`);
        return;
      }
      if (!purLines.length) {
        window.openModal('Validation Error', '<p>Add at least one Invoice Product Line before saving.</p>');
        return;
      }
      // Split pasted serials across the SERIAL-MANDATORY product lines only,
      // in order (line 1 takes its qty worth, then line 2, and so on).
      // Quantity-based lines never participate in this split — their Qty
      // is already final as entered.
      const allSerials = splitSerials($('purSerials').value);

      // ---- Check 1: Qty match — mirrors build_current_purchase_line()'s
      // "Quantity mismatch" rule, but now scoped to serial-mandatory lines
      // only: their total Qty must equal exactly how many serials were
      // entered — not less, not more.
      const totalSerialQty = serialLines.reduce((sum, ln) => sum + (Number(ln.qty) || 0), 0);
      if (allSerials.length !== totalSerialQty) {
        window.openModal('Quantity Mismatch',
          `<p>Total Qty across serial-tracked product lines is <strong>${totalSerialQty}</strong>, but <strong>${allSerials.length}</strong> serial number(s) were entered. These must match exactly.</p>`);
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
        if (!ln.needsSerial) {
          // Quantity-based line — Qty is final, no serials attached.
          return { cat: ln.cat, brand: ln.brand, watt: ln.watt, model: ln.model, type: ln.type, warehouse: ln.warehouse, qty, serials: [] };
        }
        const serials = allSerials.slice(cursor, cursor + qty);
        cursor += qty;
        return { cat: ln.cat, brand: ln.brand, watt: ln.watt, model: ln.model, type: ln.type, warehouse: ln.warehouse, qty, serials };
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
        // Upload the actual proof file(s) — separate call so a slow/failed
        // upload never blocks the invoice itself from being marked saved.
        const uploadResult = await window.uploadAttachments('purchase', invoiceNo, purProof.files);
        if (window.showToast) window.showToast('Purchase invoice saved to the database.');
        const uploadWarning = !uploadResult.ok
          ? `<p style="color:var(--red); margin-top:8px;">Note: the invoice was saved, but the proof file(s) could not be uploaded (${uploadResult.error}). You can re-attach them from Purchase Register &gt; Edit.</p>`
          : '';
        window.openModal('Success', `<p>Purchase invoice <strong>${invoiceNo}</strong> saved with ${purLines.length} product line(s) and ${allSerials.length} serial(s). It now appears in the Purchase Register.</p>${uploadWarning}`);
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
    let loadedOriginalQtyRowIds = []; // every quantity-tracked (non-serial) row's db id this invoice had at load time
    let clearEditPanel = () => {};
    let findPurchaseInvoiceForEditing = () => false;

    if (isAdmin) {
      wireLineSelection(purEditLineList);
      wireProofButtons('purEditProofFile', 'purBtnEditAttach', null, 'purEditProofName', purEditProof);

      // ---------------- Edit panel: Category -> Brand/Type -> Wattage,
      // fetched live from the database exactly like the New Purchase Entry
      // form (mirrors ui/purchase.py's sync_edit_purchase_brands() /
      // sync_edit_purchase_wattages() / sync_edit_purchase_types()).
      // Previously these three dropdowns were hardcoded to a fixed 2-3
      // option list unrelated to the real Categories/Brands/Subtypes
      // masters. `injectValue` keeps an already-saved historical value
      // visible/selected even if it's no longer part of the current master
      // data (same "add item if missing" behaviour as the desktop combo).
      const purEditCatEl = $('purEditCat'), purEditBrandEl = $('purEditBrand'), purEditWattEl = $('purEditWatt'), purEditModelEl = $('purEditModel'), purEditTypeEl = $('purEditType');

      async function refreshPurEditBrandsAndType(injectBrand, injectType) {
        const cat = purEditCatEl.value;
        if (!cat) {
          fillSelect(purEditBrandEl, [], '-- Select Category First --');
          fillSelect(purEditTypeEl, [], '-- Select Category First --');
          await refreshPurEditWattages();
          await refreshPurEditModels();
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
        await refreshPurEditModels();
      }

      async function refreshPurEditWattages(injectWatt) {
        const cat = purEditCatEl.value, brand = purEditBrandEl.value;
        if (!cat || !brand) {
          fillSelect(purEditWattEl, [], '-- Select Brand First --');
          return;
        }
        await fillSelectFromApi(purEditWattEl, `/purchase/wattages?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}`, 'N/A', injectWatt);
      }

      // Edit panel's Model dropdown — same idea as refreshPurEditWattages().
      async function refreshPurEditModels(injectModel) {
        const cat = purEditCatEl.value, brand = purEditBrandEl.value;
        if (!cat || !brand) {
          fillSelect(purEditModelEl, [], '-- Select Brand First --');
          return;
        }
        await fillSelectFromApi(purEditModelEl, `/purchase/models?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}`, 'N/A', injectModel);
      }

      // Same Wattage<->Model swap as the New Entry form, applied to the
      // Edit panel's own fields.
      function updatePurEditWattModelVisibility() {
        const showModel = purCategoryNeedsModel(purEditCatEl.value);
        $('purEditWattField').style.display = showModel ? 'none' : '';
        $('purEditModelField').style.display = showModel ? '' : 'none';
      }

      purEditCatEl.addEventListener('change', () => { refreshPurEditBrandsAndType(); updatePurEditSerialVisibility(); updatePurEditWattModelVisibility(); });
      purEditBrandEl.addEventListener('change', () => { refreshPurEditWattages(); refreshPurEditModels(); });

      // Same idea as updatePurSerialVisibility() above, but for the Edit
      // panel's pooled Serials box: visible if either the currently
      // selected category needs serials, or any line already loaded/added
      // into this edit session is serial-mandatory.
      function updatePurEditSerialVisibility() {
        const needsSerial = purCategoryNeedsSerial(purEditCatEl.value) || purEditLines.some((ln) => ln.needsSerial);
        $('purEditSerialWrap').style.display = needsSerial ? '' : 'none';
        $('purEditQtyOnlyNote').style.display = needsSerial ? 'none' : '';
      }
      updatePurEditSerialVisibility();
      updatePurEditWattModelVisibility();

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
        await fillSelectFromApi(purEditModelEl, `/purchase/models?category=${encodeURIComponent(purEditCatEl.value)}&brand=${encodeURIComponent(purEditBrandEl.value)}`, 'N/A', line.model);
        await fillSelectFromApi(purEditWhEl, '/masters/warehouses', 'No warehouses found', line.warehouse);
        updatePurEditWattModelVisibility();
      }

      // Initial fill so the panel isn't empty before any invoice is found.
      fillSelectFromApi(purEditCatEl, '/masters/categories', 'No categories found');
      $('purBtnKeepProof').addEventListener('click', () => {
        purEditProof.files = [];
        $('purEditProofFile').value = '';
        $('purEditProofName').textContent = 'Keeping existing proof file';
      });

      clearEditPanel = function () {
        ['purEditSupp', 'purEditInv', 'purEditPallet', 'purEditWatt', 'purEditModel', 'purEditQty', 'purEditSerials'].forEach((id) => { $(id).value = ''; });
        $('purEditDate').value = '';
        purEditLines.length = 0;
        loadedInvoiceNo = null;
        loadedOriginalSerials = [];
        loadedOriginalQtyRowIds = [];
        renderLineList(purEditLineList, purEditLines, 'Find an invoice above to load its lines.');
        purEditProof.files = [];
        $('purEditProofFile').value = '';
        $('purEditProofName').textContent = 'No proof selected';
        updatePurEditSerialVisibility();
      };
      $('purBtnClearEdit').addEventListener('click', clearEditPanel);

      $('purBtnEditAddLine').addEventListener('click', () => {
        const cat = $('purEditCat').value, brand = $('purEditBrand').value;
        const needsModel = purCategoryNeedsModel(cat);
        const watt = needsModel ? '' : $('purEditWatt').value.trim();
        const model = needsModel ? $('purEditModel').value.trim() : '';
        const type = $('purEditType').value, wh = $('purEditWh').value, qty = $('purEditQty').value.trim();
        if (!qty || Number(qty) <= 0) {
          window.openModal('Validation Error', '<p>Enter a valid Qty before adding a product line.</p>');
          return;
        }
        const needsSerial = purCategoryNeedsSerial(cat);
        // Brand-new line added during this edit — no existing db row(s)
        // behind it yet, so qtyRowIds starts empty (PUT will INSERT it).
        purEditLines.push({ cat, brand, watt, model, type, warehouse: wh, qty, needsSerial, qtyRowIds: [] });
        renderLineList(purEditLineList, purEditLines, '');
        $('purEditQty').value = '';
        updatePurEditSerialVisibility();
      });
      $('purBtnEditRemoveLine').addEventListener('click', () => {
        const idx = selectedLineIndex(purEditLineList);
        if (idx === -1) return;
        purEditLines.splice(idx, 1);
        renderLineList(purEditLineList, purEditLines, 'Find an invoice above to load its lines.');
        updatePurEditSerialVisibility();
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
        loadedOriginalQtyRowIds = inv.originalQtyRowIds || [];
        $('purEditSupp').value = inv.supplier;
        $('purEditInv').value = inv.invoiceNo;
        $('purEditPallet').value = inv.pallet || '';
        $('purEditDate').value = PD.isoFromDMY(inv.date);
        $('purEditProofName').textContent = inv.proofName && inv.proofName !== '-' ? inv.proofName : 'No proof selected';
        purEditProof.files = [];

        purEditLines.length = 0;
        inv.lines.forEach((ln) => purEditLines.push({
          cat: ln.cat, brand: ln.brand, watt: ln.watt, model: ln.model, type: ln.type, warehouse: ln.warehouse,
          qty: ln.qty, serials: ln.serials, qtyRowIds: ln.qtyRowIds || [],
          needsSerial: purCategoryNeedsSerial(ln.cat),
        }));
        renderLineList(purEditLineList, purEditLines, 'Find an invoice above to load its lines.');
        // Category/Brand/Wattage/Type/Warehouse dropdowns all reload live
        // from the database here, pre-selecting whatever this invoice's
        // first line actually had (and keeping that value visible even if
        // it's since been removed from the masters) — mirrors the desktop
        // app's sync_edit_purchase_* methods instead of the old fixed lists.
        await loadEditCascadeForLine(purEditLines[0]);
        const allSerials = inv.lines.reduce((acc, ln) => acc.concat(ln.serials || []), []);
        $('purEditSerials').value = allSerials.join('\n');
        updatePurEditSerialVisibility();

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
        if (!purEditLines.length) {
          window.openModal('Validation Error', '<p>Add at least one Invoice Product Line before applying modifications.</p>');
          return;
        }

        // Pasted serials are split ONLY across serial-mandatory lines, in
        // order — exactly like the Create form's Save handler. Quantity-
        // tracked lines never touch the serial textarea at all; their Qty
        // field is already final as entered/loaded.
        const serialEditLines = purEditLines.filter((ln) => ln.needsSerial);
        const allSerials = splitSerials($('purEditSerials').value);

        const totalSerialQty = serialEditLines.reduce((sum, ln) => sum + (Number(ln.qty) || 0), 0);
        if (serialEditLines.length && allSerials.length !== totalSerialQty) {
          window.openModal('Quantity Mismatch',
            `<p>Total Qty across serial-tracked product lines is <strong>${totalSerialQty}</strong>, but <strong>${allSerials.length}</strong> serial number(s) were entered. These must match exactly.</p>`);
          return;
        }

        let cursor = 0;
        const lines = purEditLines.map((ln) => {
          const qty = Number(ln.qty) || 0;
          if (!ln.needsSerial) {
            // Quantity-tracked line — Qty is final, no serials. qtyRowIds
            // carries forward whichever db row(s) it came from (empty
            // means it's brand-new, added during this edit).
            return { cat: ln.cat, brand: ln.brand, watt: ln.watt, model: ln.model, type: ln.type, warehouse: ln.warehouse, qty, serials: [], qtyRowIds: ln.qtyRowIds || [] };
          }
          const serials = allSerials.slice(cursor, cursor + qty);
          cursor += qty;
          return { cat: ln.cat, brand: ln.brand, watt: ln.watt, model: ln.model, type: ln.type, warehouse: ln.warehouse, qty, serials };
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
            originalQtyRowIds: loadedOriginalQtyRowIds,
          });
          loadedInvoiceNo = result.invoiceNo;
          loadedOriginalSerials = allSerials;
          // qtyRowIds for any brand-new quantity line aren't known until the
          // next Find (PUT doesn't echo back fresh ids) — close enough as
          // an in-memory baseline; a re-Find always gets the exact truth.
          loadedOriginalQtyRowIds = lines.filter((l) => !l.serials.length).flatMap((l) => l.qtyRowIds || []);
          const uploadResult = await window.uploadAttachments('purchase', loadedInvoiceNo, purEditProof.files);
          if (window.showToast) window.showToast('Purchase invoice updated.');
          const uploadWarning = !uploadResult.ok
            ? `<p style="color:var(--red); margin-top:8px;">Note: the invoice was updated, but the new proof file(s) could not be uploaded (${uploadResult.error}). Please try attaching them again.</p>`
            : '';
          window.openModal('Saved', `<p>Purchase invoice <strong>${loadedInvoiceNo}</strong> updated. It's now flagged <strong>Edited: Yes</strong> in the Purchase Register.</p>${uploadWarning}`);
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