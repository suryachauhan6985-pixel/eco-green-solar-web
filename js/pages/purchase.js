// js/pages/purchase.js
// Mirrors ui/purchase.py from the desktop app: a "New Purchase Entry" form on
// the left, plus a SuperAdmin "Purchase Invoice Modification" edit panel on
// the right (Find an invoice -> fields load -> Apply Modifications / Delete).
// This is a UI-only preview: nothing is sent to a server or saved anywhere.
// All interactions below (add/remove line, find, attach proof, save) only
// update the page in memory so the screen behaves correctly for demoing.
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
      <div class="hint">UI preview only — Execute / Apply buttons don't save anywhere yet, no backend is connected.</div>
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
              <select id="purWh"><option>Main NAS Warehouse</option><option>Rajkot Godown</option></select></div>
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

            <div class="field span-full"><label>Scan / Paste Serial Numbers <span class="req">*</span></label>
              <textarea id="purSerials" placeholder="One serial per line — paste comma/space separated, it auto-splits"></textarea>
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
              <select id="purEditWh"><option>Main NAS Warehouse</option><option>Rajkot Godown</option></select></div>

            <div class="field"><label>Category <span class="req">*</span></label>
              <select id="purEditCat"><option>Solar Panel</option><option>Inverter</option><option>Battery</option></select></div>
            <div class="field"><label>Brand <span class="req">*</span></label>
              <select id="purEditBrand"><option>Waaree</option><option>Adani</option><option>Vikram Solar</option></select></div>
            <div class="field"><label>Wattage <span class="req">*</span></label><input id="purEditWatt" placeholder="e.g. 545"></div>
            <div class="field"><label>Type <span class="req">*</span></label>
              <select id="purEditType"><option>Mono PERC</option><option>Bifacial</option></select></div>

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

            <div class="field span-full"><label>Serials <span class="req">*</span></label><textarea id="purEditSerials" placeholder="Loaded serials will appear here after Find"></textarea></div>
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

    function fillSupplierDatalist(listEl, ledgers, key) {
      listEl.innerHTML = ledgers.map((l) => `<option value="${String(l[key] || '').replace(/"/g, '&quot;')}">`).join('');
    }

    function applyLedgerToSupplierFields(l) {
      $('purSupp').value = l.name || '';
      $('purSuppShort').value = l.short || '';
      $('purSuppMobile').value = l.mobile && l.mobile !== '-' ? l.mobile : '';
      $('purSuppAddr').value = l.address && l.address !== '-' ? l.address : '';
      $('purSuppGstin').value = l.gstin && l.gstin !== '-' ? l.gstin : '';
    }

    function wireSupplierAutocomplete(inputEl, listEl, matchKey) {
      inputEl.addEventListener('input', () => {
        const text = inputEl.value;
        clearTimeout(suppSearchTimer);
        suppSearchTimer = setTimeout(async () => {
          const ledgers = await searchSupplierLedgers(text);
          fillSupplierDatalist(listEl, ledgers, matchKey);
          // Exact match (case-insensitive), same rule as Python's
          // trigger_name_autofill / trigger_full_autofill.
          const exact = ledgers.find((l) => String(l[matchKey] || '').trim().toLowerCase() === text.trim().toLowerCase());
          if (exact) applyLedgerToSupplierFields(exact);
        }, 250); // debounce: fetch only after user pauses typing, not on every keystroke
      });
    }

    wireSupplierAutocomplete($('purSupp'), purSuppNameList, 'name');
    wireSupplierAutocomplete($('purSuppShort'), purSuppShortList, 'short');

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
      PD.addInvoice({
        invoiceNo: $('purInv').value.trim(),
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
      if (window.showToast) window.showToast('Purchase invoice saved to the register.');
      window.openModal('Success', `<p>Purchase invoice <strong>${$('purInv').value.trim()}</strong> saved with ${purLines.length} product line(s) and ${allSerials.length} serial(s). It now appears in the Purchase Register.</p>`);
      clearPurchaseForm();
    });

    // ---------------- EDIT PANEL state ----------------
    const purEditLines = [];
    const purEditProof = { files: [] };
    const purEditLineList = $('purEditLineList');
    let loadedInvoiceNo = null; // invoice currently loaded in the edit panel, null until Find succeeds
    let clearEditPanel = () => {};
    let findPurchaseInvoiceForEditing = () => false;

    if (isAdmin) {
      wireLineSelection(purEditLineList);
      wireProofButtons('purEditProofFile', 'purBtnEditAttach', null, 'purBtnViewEditProof', 'purEditProofName', purEditProof);
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
      findPurchaseInvoiceForEditing = function (term) {
        if (!term) {
          window.openModal('Search Required', '<p>Type an Invoice No, Supplier Name, or Short Name to search first.</p>');
          return false;
        }
        const inv = PD.findForEdit(term);
        if (!inv) {
          window.openModal('Not Found', '<p>No purchase invoice records found matching Invoice No / Supplier Name / Short Name.</p>');
          return false;
        }
        loadedInvoiceNo = inv.invoiceNo;
        $('purEditSupp').value = inv.supplier;
        $('purEditInv').value = inv.invoiceNo;
        $('purEditPallet').value = inv.pallet || '';
        $('purEditWh').value = inv.lines[0] ? inv.lines[0].warehouse : $('purEditWh').value;
        $('purEditDate').value = PD.isoFromDMY(inv.date);
        $('purEditProofName').textContent = inv.proofName || 'No proof selected';
        purEditProof.files = [];

        purEditLines.length = 0;
        inv.lines.forEach((ln) => purEditLines.push({ cat: ln.cat, brand: ln.brand, watt: ln.watt, type: ln.type, warehouse: ln.warehouse, qty: ln.qty }));
        renderLineList(purEditLineList, purEditLines, 'Find an invoice above to load its lines.');
        if (purEditLines.length) {
          $('purEditCat').value = purEditLines[0].cat;
          $('purEditBrand').value = purEditLines[0].brand;
          $('purEditWatt').value = purEditLines[0].watt || '';
          $('purEditType').value = purEditLines[0].type;
        }
        const allSerials = inv.lines.reduce((acc, ln) => acc.concat(ln.serials || []), []);
        $('purEditSerials').value = allSerials.join('\n');

        window.openModal('Invoice Loaded', `<p>Purchase invoice <strong>${inv.invoiceNo}</strong> loaded with ${inv.lines.length} product line(s) and ${allSerials.length} serial(s).</p>`);
        return true;
      };

      $('purBtnFind').addEventListener('click', () => {
        findPurchaseInvoiceForEditing($('purSearchInv').value.trim());
      });

      $('purBtnApply').addEventListener('click', () => {
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
        PD.applyEdit(loadedInvoiceNo, {
          invoiceNo: $('purEditInv').value.trim(),
          date: PD.dmyFromISO($('purEditDate').value) || $('purEditDate').value,
          supplier: $('purEditSupp').value.trim(),
          pallet: $('purEditPallet').value.trim(),
          proofName: purEditProof.files.length ? (purEditProof.files.length === 1 ? purEditProof.files[0].name : `${purEditProof.files.length} files`) : $('purEditProofName').textContent,
          lines,
        });
        loadedInvoiceNo = $('purEditInv').value.trim();
        if (window.showToast) window.showToast('Purchase invoice updated.');
        window.openModal('Saved', `<p>Purchase invoice <strong>${loadedInvoiceNo}</strong> updated. It's now flagged <strong>Edited: Yes</strong> in the Purchase Register.</p>`);
      });

      $('purBtnDelete').addEventListener('click', () => {
        if (!loadedInvoiceNo) {
          window.openModal('Not Found', '<p>Find an invoice first before trying to delete it.</p>');
          return;
        }
        const invNo = loadedInvoiceNo;
        if (!window.confirm(`Are you sure you want to permanently delete purchase invoice ${invNo}? This removes it from the Purchase Register too.`)) return;
        PD.deleteInvoice(invNo);
        if (window.showToast) window.showToast(`Purchase invoice ${invNo} deleted.`);
        clearEditPanel();
        window.openModal('Deleted', `<p>Purchase invoice <strong>${invNo}</strong> deleted successfully.</p>`);
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