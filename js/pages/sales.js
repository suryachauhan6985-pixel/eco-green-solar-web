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
            <div class="field" id="saleWattField"><label>Wattage <span class="req">*</span></label>
              <select id="saleWatt"><option value="">-- Select Brand First --</option></select></div>
            <div class="field" id="saleModelField" style="display:none;"><label>Model <span class="req">*</span></label>
              <select id="saleModel"><option value="">-- Select Brand First --</option></select></div>
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
                <input type="file" id="saleProofFile" multiple style="display:none;" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx">
                <button class="btn btn-ghost" type="button" id="saleBtnAttach"><i class="fa-solid fa-paperclip"></i> Add Attachment</button>
                <button class="btn btn-ghost" type="button" id="saleBtnClearProof"><i class="fa-solid fa-xmark"></i> Clear All</button>
                <span class="proof-name" id="saleProofName">No proof selected</span>
              </div>
            </div>

            <div class="field span-full" id="saleSerialsField"><label>Scan Serial Numbers <span class="req">*</span></label>
              <div class="ss-scan-input-wrap" style="position:relative;">
                <textarea id="saleSerials" placeholder="One serial per line, it auto-splits — or tap the scan icon"></textarea>
                <button type="button" class="ss-scan-icon-btn" id="saleScanBtn" title="Scan barcode / QR"><i class="fa-solid fa-barcode"></i></button>
                <div id="saleBtCard" style="display:none; position:absolute; inset:0; background:var(--bg2, #1e1e1e); border:1px solid var(--border, #444); border-radius:8px; padding:14px; flex-direction:column; justify-content:center; align-items:center; text-align:center; gap:8px; z-index:2;">
                  <div class="note" style="font-size:12px;">Scanned value</div>
                  <div id="saleBtValue" style="font-size:18px; font-weight:700; word-break:break-all;"></div>
                  <div id="saleBtMsg" class="note" style="margin:0;"></div>
                  <div class="actions-row" style="margin-top:6px;">
                    <button type="button" class="btn btn-ghost" id="saleBtRetry"><i class="fa-solid fa-rotate-left"></i> Retry</button>
                    <button type="button" class="btn btn-green" id="saleBtDone"><i class="fa-solid fa-check"></i> Done</button>
                  </div>
                </div>
              </div>
              <div class="actions-row" style="margin-top:6px;">
                <button type="button" class="btn btn-ghost" id="saleBtBtn" title="Bluetooth scanner mode — disables the camera and keeps this box ready for a BT scanner"><i class="fa-brands fa-bluetooth-b"></i> BT Scan</button>
              </div>
            </div>
            <div class="field span-full" id="saleQtyOnlyNote" style="display:none;">
              <p style="color:var(--txt-muted); font-style:italic; margin:0;">This category is quantity-tracked (no serial numbers) — just set the Expected Qty above and click "Add Product Line".</p>
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
            <button class="btn btn-blue" type="button" id="saleBtnChallan"><i class="fa-solid fa-file-invoice"></i> Create Challan</button>
            <button class="btn btn-ghost" type="button" id="saleBtnOpenChallanReg"><i class="fa-solid fa-clipboard-list" style="color:var(--gold);"></i> Challan Register</button>
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
            <div class="field" id="saleEditWattField"><label>Wattage <span class="req">*</span></label>
              <select id="saleEditWatt"><option value="">-- Select Brand First --</option></select></div>
            <div class="field" id="saleEditModelField" style="display:none;"><label>Model <span class="req">*</span></label>
              <select id="saleEditModel"><option value="">-- Select Brand First --</option></select></div>
            <div class="field"><label>Type <span class="req">*</span></label>
              <select id="saleEditType"><option value="">-- Select Category First --</option></select></div>

            <div class="field" id="saleEditQtyField" style="display:none;"><label>Qty <span class="req">*</span></label>
              <input id="saleEditQty" type="number" placeholder="0"></div>
            <div class="field span-full" id="saleEditQtyOnlyNote" style="display:none;">
              <p style="color:var(--txt-muted); font-style:italic; margin:0;">This category is quantity-tracked (no serial numbers) — set Qty and click "Add Line" for this line.</p>
            </div>

            <div class="field span-full"><label>Proof File</label>
              <div class="proof-row">
                <input type="file" id="saleEditProofFile" multiple style="display:none;" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx">
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

            <div class="field span-full" id="saleEditSerialsWrap"><label>Serials <span class="req">*</span></label>
              <div class="ss-scan-input-wrap" style="position:relative;">
                <textarea id="saleEditSerials" placeholder="Serials will load here... or tap the scan icon"></textarea>
                <button type="button" class="ss-scan-icon-btn" id="saleEditScanBtn" title="Scan barcode / QR"><i class="fa-solid fa-barcode"></i></button>
                <div id="saleEditBtCard" style="display:none; position:absolute; inset:0; background:var(--bg2, #1e1e1e); border:1px solid var(--border, #444); border-radius:8px; padding:14px; flex-direction:column; justify-content:center; align-items:center; text-align:center; gap:8px; z-index:2;">
                  <div class="note" style="font-size:12px;">Scanned value</div>
                  <div id="saleEditBtValue" style="font-size:18px; font-weight:700; word-break:break-all;"></div>
                  <div id="saleEditBtMsg" class="note" style="margin:0;"></div>
                  <div class="actions-row" style="margin-top:6px;">
                    <button type="button" class="btn btn-ghost" id="saleEditBtRetry"><i class="fa-solid fa-rotate-left"></i> Retry</button>
                    <button type="button" class="btn btn-green" id="saleEditBtDone"><i class="fa-solid fa-check"></i> Done</button>
                  </div>
                </div>
              </div>
              <div class="actions-row" style="margin-top:6px;">
                <button type="button" class="btn btn-ghost" id="saleEditBtBtn" title="Bluetooth scanner mode — disables the camera and keeps this box ready for a BT scanner"><i class="fa-brands fa-bluetooth-b"></i> BT Scan</button>
              </div>
            </div>
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
    const isAdmin = currentRole === 'SuperAdmin' || currentRole === 'Admin';

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
    // Category -> serial_mandatory lookup (same source Purchase Inward's
    // create flow already reads categories.serial_mandatory from). When a
    // category is NOT serial-mandatory, the New Sales form skips the serial
    // scan box entirely and dispatches purely on quantity.
    let categorySerialRules = {};
    async function loadCategoryWattRules() {
      try {
        const cats = await window.Api.get('/masters/categories');
        categoryWattRules = {};
        categorySerialRules = {};
        (cats || []).forEach((c) => {
          categoryWattRules[c.name] = !!c.watt_mandatory;
          categorySerialRules[c.name] = !!c.serial_mandatory;
        });
      } catch (e) { categoryWattRules = {}; categorySerialRules = {}; }
    }
    function isWattMandatory(cat) { return !!categoryWattRules[cat]; }
    // Default true (serial required) if the category hasn't loaded yet or
    // isn't found — matches the existing behaviour so nothing changes until
    // the categories master explicitly says serial_mandatory=0.
    function isSerialMandatory(cat) { return categorySerialRules[cat] !== false; }
    // Mirrors masters.js's syncWattMandatoryUI() / purchase.js's
    // purCategoryNeedsModel(): when NEITHER Wattage nor Serial No. applies
    // to the selected category, Model replaces Wattage as the
    // differentiator (e.g. PVC Pipe "2 Inch"). Defaults to false (Wattage
    // shown) until a real category is selected / rules have loaded.
    function saleCategoryNeedsModel(cat) {
      if (!cat) return false;
      return !isWattMandatory(cat) && !isSerialMandatory(cat);
    }

    // Serial box: auto-newline on delimiter, and paste normalization —
    // mirrors ui/serial_widgets.py's SerialTextEdit exactly (same behaviour
    // wired for Purchase in purchase.js).
    function splitSerials(text) {
      return String(text || '').match(/[A-Za-z0-9-]+/g) || [];
    }
    function wireSerialBox(el, btToggleGetter) {
      el.addEventListener('keydown', (e) => {
        if (btToggleGetter && btToggleGetter() && btToggleGetter().isBtMode()) return; // BT toggle owns input while ON
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
        if (btToggleGetter && btToggleGetter() && btToggleGetter().isBtMode()) return;
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const normalized = splitSerials(pasted).join('\n');
        const before = el.value.slice(0, el.selectionStart);
        const after = el.value.slice(el.selectionEnd);
        const prefix = before && !before.endsWith('\n') ? '\n' : '';
        el.value = before + prefix + normalized + '\n' + after;
      });
      el.addEventListener('blur', () => {
        if (btToggleGetter && btToggleGetter() && btToggleGetter().isBtMode()) return;
        el.value = splitSerials(el.value).join('\n');
      });
    }
    // BT toggles are wired further below (after saleScanBeep is defined) —
    // declared here first and passed into wireSerialBox as getters so it
    // can consult isBtMode() live once they're assigned.
    let saleSerialBt = null;
    let saleEditSerialBt = null;
    wireSerialBox($('saleSerials'), () => saleSerialBt);
    wireSerialBox($('saleEditSerials'), () => saleEditSerialBt);

    // ---------------- Serial scanner (camera) ----------------
    // Same html5-qrcode-based scanner used by Purchase Inward (see
    // js/pages/purchase.js's openPurchaseScanner) — identical UI/behaviour
    // ported over here for Sales so scanning feels exactly the same in
    // both places. Each decode pauses the camera and shows a result card
    // with "Retry" (discard, resume scanning) and "Done" (add to the
    // Serial Numbers box, then resume scanning for the next one).
    const saleScanState = {
      html5QrCode: null,
      cameras: [],
      cameraIndex: 0,
      torchOn: false,
      overlayEl: null,
      targetId: null,
      handledOnce: false,
      pendingText: null,
      pendingIsDup: false,
      pendingBlocked: false, // dup OR over the saleQty cap — either way Done stays disabled
      addedCount: 0,
    };

    // Live cap for the camera scanner, mirroring wireSerialBtToggle's own
    // requiredQty() below — only the New Sale Entry box (saleSerials) has a
    // single Qty field to cap against (one product line per scan session);
    // the Edit/Modify box (saleEditSerials) holds serials across potentially
    // several lines at once and is checked at Apply time instead, same
    // reasoning purchase.js's serial boxes already use.
    function saleScanRequiredQty() {
      if (saleScanState.targetId !== 'saleSerials') return null;
      const el = document.getElementById('saleQty');
      if (!el) return null;
      const v = parseInt(el.value, 10);
      return (Number.isFinite(v) && v > 0) ? v : null;
    }

    function saleScanBeep() {
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

    function saleScanSetStatus(msg) {
      const el = document.getElementById('saleScanStatus');
      if (el) el.textContent = msg;
    }

    function openSaleScanner(targetId) {
      // Guard: never stack a second overlay/camera session on top of one
      // already open — see purScanSwallowKeydown's note in purchase.js for
      // the full "BT scanner during permission request" deadlock story
      // this (plus the focus-blur + keydown-swallow below) prevents.
      if (saleScanState.overlayEl) return;
      const box = document.getElementById(targetId);
      if (!box) return;
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      saleScanState.targetId = targetId;
      saleScanState.torchOn = false;
      saleScanState.handledOnce = false;
      saleScanState.pendingText = null;
      saleScanState.pendingIsDup = false;
      saleScanState.pendingBlocked = false;
      saleScanState.addedCount = 0;

      const overlay = document.createElement('div');
      overlay.className = 'ss-scanner-overlay';
      overlay.innerHTML = `
        <div class="ss-scanner-topbar">
          <button type="button" class="ss-icon-btn light" id="saleScanBack" title="Close"><i class="fa-solid fa-arrow-left"></i></button>
          <div class="ss-scanner-title">Scan Serial Numbers</div>
          <div class="ss-scanner-topbtns">
            <button type="button" class="ss-icon-btn light" id="saleScanTorch" title="Flashlight"><i class="fa-solid fa-bolt"></i></button>
            <button type="button" class="ss-icon-btn light" id="saleScanFlip" title="Flip camera"><i class="fa-solid fa-camera-rotate"></i></button>
          </div>
        </div>
        <div class="ss-scanner-camwrap">
          <div id="saleScanRegion" class="ss-scanner-camfeed"></div>
          <div class="ss-scanner-target" id="saleScanTargetBox"></div>
          <div class="ss-scanner-instruction" id="saleScanStatus">Requesting camera permission&hellip;</div>
          <div class="ss-scanner-result" id="saleScanResult" style="display:none;">
            <div class="ss-scanner-result-card" id="saleScanResultCard">
              <div class="ss-scanner-result-label">Scanned value</div>
              <div class="ss-scanner-result-value" id="saleScanResultValue"></div>
              <div class="ss-scanner-result-msg" id="saleScanResultMsg"></div>
            </div>
            <div class="ss-scanner-result-actions">
              <button type="button" class="btn btn-ghost" id="saleScanRetry"><i class="fa-solid fa-rotate-left"></i> Retry</button>
              <button type="button" class="btn btn-green" id="saleScanDone2"><i class="fa-solid fa-check"></i> Done</button>
            </div>
          </div>
        </div>
        <div class="ss-scanner-bottom">
          <span class="proof-name" id="saleScanCount" style="color:#fff;">0 serial(s) added</span>
          <button type="button" class="btn btn-red ss-scanner-cancel" id="saleScanCancel"><i class="fa-solid fa-xmark"></i> Close</button>
        </div>
      `;
      document.body.appendChild(overlay);
      saleScanState.overlayEl = overlay;
      document.body.style.overflow = 'hidden';

      overlay.querySelector('#saleScanBack').onclick = closeSaleScanner;
      overlay.querySelector('#saleScanCancel').onclick = closeSaleScanner;
      overlay.querySelector('#saleScanTorch').onclick = toggleSaleTorch;
      overlay.querySelector('#saleScanFlip').onclick = flipSaleCamera;
      overlay.querySelector('#saleScanRetry').onclick = retrySaleScan;
      overlay.querySelector('#saleScanDone2').onclick = confirmSaleScan;

      // Move real keyboard focus INTO the overlay so a paired BT/HID
      // scanner has nothing behind the overlay to type into while the
      // camera is starting up — see saleScanSwallowKeydown below.
      overlay.setAttribute('tabindex', '-1');
      overlay.style.outline = 'none';
      overlay.focus({ preventScroll: true });
      document.addEventListener('keydown', saleScanSwallowKeydown, true);

      startSaleCamera();
    }

    // Same fix as purchase.js's purScanSwallowKeydown: while this overlay
    // is open (including the whole "Requesting camera permission…" wait,
    // which can take a few seconds on mobile), a paired Bluetooth/HID
    // scanner is still just a keyboard sending real keydown events. If a
    // background button (e.g. the scan icon that opened this overlay)
    // still has focus, a scan's Enter/Tab can silently re-click it,
    // opening a SECOND overlay + camera session on top of the first —
    // two sessions then fight over one camera + a duplicate
    // #saleScanRegion id, and every button on screen stops responding
    // ("requesting camera permission" freeze). Capturing keydown here and
    // swallowing everything except Escape (which closes the overlay)
    // means a BT scanner simply can't reach anything while this is open.
    function saleScanSwallowKeydown(e) {
      if (e.key === 'Escape') { closeSaleScanner(); }
      e.preventDefault();
      e.stopPropagation();
    }

    function startSaleCamera() {
      if (!window.Html5Qrcode) {
        saleScanSetStatus('Scanner library failed to load. Check your connection and try again.');
        return;
      }
      window.Html5Qrcode.getCameras().then((cameras) => {
        if (!cameras || !cameras.length) { saleScanSetStatus('No camera found on this device.'); return; }
        saleScanState.cameras = cameras;
        const backIdx = cameras.findIndex((c) => /back|rear|environment/i.test(c.label || ''));
        saleScanState.cameraIndex = backIdx !== -1 ? backIdx : 0;
        launchSaleCamera();
      }).catch((err) => {
        console.warn('Camera permission error', err);
        saleScanSetStatus('Camera permission denied. Please allow camera access in your browser settings, then tap Cancel and try again.');
      });
    }

    function launchSaleCamera() {
      const camera = saleScanState.cameras[saleScanState.cameraIndex];
      if (!camera) return;
      saleScanState.handledOnce = false;
      saleScanSetStatus('Place the serial barcode / QR in the box');

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

      saleScanState.html5QrCode = new window.Html5Qrcode('saleScanRegion', { verbose: false });
      saleScanState.html5QrCode.start(
        camera.id,
        config,
        onSaleScanSuccess,
        () => { /* per-frame "no code found yet" — expected, ignore */ }
      ).catch((err) => {
        console.warn('Camera start error', err);
        saleScanSetStatus('Could not start the camera. Tap Cancel and try again.');
      });
    }

    // Decoding pauses here (handledOnce guard, exactly like Purchase) until
    // the user explicitly taps Retry or Done on the result card.
    function onSaleScanSuccess(decodedText) {
      if (saleScanState.handledOnce) return;
      saleScanState.handledOnce = true;
      saleScanBeep();
      if (navigator.vibrate) { try { navigator.vibrate(180); } catch (e) { /* not supported */ } }
      showSaleScanResult(decodedText);
    }

    // Paints the decoded value on a result card over the camera feed and
    // flags it as duplicate (already in this Serial Numbers box) if it is
    // — same Retry (discard) / Done (add to box) choice Purchase gives, so
    // nothing lands in the box on a bad/duplicate scan.
    function showSaleScanResult(text) {
      const code = String(text || '').trim();
      const box = document.getElementById(saleScanState.targetId);
      const existing = box ? splitSerials(box.value) : [];
      const dup = !!code && existing.some((s) => s.toLowerCase() === code.toLowerCase());
      // Same live cap the BT toggle already enforces (qtyFieldId: 'saleQty')
      // — without this, the camera path let you keep scanning past the
      // entered Qty with no warning until "Add Product Line" rejected the
      // whole line with a Quantity Mismatch error, forcing a manual cleanup.
      const req = saleScanRequiredQty();
      const overCap = !dup && req != null && existing.length >= req;

      saleScanState.pendingText = code;
      saleScanState.pendingIsDup = dup;
      saleScanState.pendingBlocked = dup || overCap;

      const panel = document.getElementById('saleScanResult');
      const card = document.getElementById('saleScanResultCard');
      const valueEl = document.getElementById('saleScanResultValue');
      const msgEl = document.getElementById('saleScanResultMsg');
      const doneBtn = document.getElementById('saleScanDone2');
      const targetBox = document.getElementById('saleScanTargetBox');
      if (!panel || !valueEl) return;

      valueEl.textContent = code || '(empty)';
      if (card) card.classList.toggle('dup', dup || overCap);
      if (msgEl) msgEl.textContent = dup
        ? 'This serial no. is already in the box. Retry with a different code, or remove the old one first.'
        : overCap
          ? `You cannot scan more than the entered quantity — ${req} serial number(s) allowed.`
          : 'Scanned successfully.';
      if (doneBtn) doneBtn.style.display = (dup || overCap) ? 'none' : '';

      panel.style.display = 'flex';
      saleScanSetStatus('');
      if (targetBox) targetBox.style.visibility = 'hidden';
    }

    function hideSaleScanResult() {
      const panel = document.getElementById('saleScanResult');
      const targetBox = document.getElementById('saleScanTargetBox');
      if (panel) panel.style.display = 'none';
      if (targetBox) targetBox.style.visibility = '';
      saleScanState.pendingText = null;
      saleScanState.pendingIsDup = false;
      saleScanState.pendingBlocked = false;
    }

    // "Retry" — discard the paused result and resume live scanning.
    function retrySaleScan() {
      hideSaleScanResult();
      saleScanState.handledOnce = false;
      saleScanSetStatus('Place the serial barcode / QR in the box');
    }

    // "Done" — commit the scanned value into the Serial Numbers box (one
    // per line, same normalization the paste handler above uses), then
    // resume scanning so the next serial can be captured right away.
    function confirmSaleScan() {
      if (saleScanState.pendingBlocked) return; // guard — Done button is hidden for dupes/over-cap anyway
      const code = saleScanState.pendingText;
      if (!code) { retrySaleScan(); return; }

      const box = document.getElementById(saleScanState.targetId);
      if (box) {
        const existing = splitSerials(box.value);
        existing.push(code);
        box.value = existing.join('\n') + '\n';
        box.dispatchEvent(new Event('input', { bubbles: true }));
        saleScanState.addedCount = existing.length;
        const countEl = document.getElementById('saleScanCount');
        if (countEl) countEl.textContent = `${existing.length} serial(s) added`;
      }

      hideSaleScanResult();
      saleScanState.handledOnce = false;
      saleScanSetStatus('Added \u2713 — scan the next one');
    }

    function toggleSaleTorch() {
      if (!saleScanState.html5QrCode) return;
      saleScanState.torchOn = !saleScanState.torchOn;
      saleScanState.html5QrCode.applyVideoConstraints({ advanced: [{ torch: saleScanState.torchOn }] })
        .then(() => {
          const btn = document.getElementById('saleScanTorch');
          if (btn) btn.classList.toggle('active', saleScanState.torchOn);
        })
        .catch(() => { window.showToast('Flashlight not supported on this device'); saleScanState.torchOn = false; });
    }

    function flipSaleCamera() {
      if (!saleScanState.cameras.length || saleScanState.cameras.length < 2) { window.showToast('Only one camera available'); return; }
      saleScanState.cameraIndex = (saleScanState.cameraIndex + 1) % saleScanState.cameras.length;
      const qr = saleScanState.html5QrCode;
      if (qr) qr.stop().then(launchSaleCamera).catch(launchSaleCamera);
      else launchSaleCamera();
    }

    function closeSaleScanner() {
      const qr = saleScanState.html5QrCode;
      const targetId = saleScanState.targetId;
      saleScanState.pendingText = null;
      saleScanState.pendingIsDup = false;
      saleScanState.pendingBlocked = false;
      document.removeEventListener('keydown', saleScanSwallowKeydown, true);
      const finish = () => {
        if (saleScanState.overlayEl) { saleScanState.overlayEl.remove(); saleScanState.overlayEl = null; }
        document.body.style.overflow = '';
        saleScanState.html5QrCode = null;
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

    const saleScanBtnEl = $('saleScanBtn');
    if (saleScanBtnEl) saleScanBtnEl.addEventListener('click', () => openSaleScanner('saleSerials'));
    const saleEditScanBtnEl = $('saleEditScanBtn');
    if (saleEditScanBtnEl) saleEditScanBtnEl.addEventListener('click', () => openSaleScanner('saleEditSerials'));

    // ---------------- Serial scanner — Bluetooth toggle ----------------
    // Adds a "BT Scan" mode next to the camera scanner, mirroring
    // js/pages/bom-serial-modal.js's Bluetooth toggle exactly: while ON, a
    // physical BT/HID scanner's keystrokes are buffered ourselves (never
    // typed straight into the box) and Enter/Tab pops a Retry/Done confirm
    // card instead of landing directly — catches a misread before it lands,
    // and hard-blocks a duplicate the same way the camera scanner already
    // does. The camera scan button is disabled while BT mode is ON (only
    // one input method active at a time). `qtyFieldId`, when given, is read
    // live on every scan as this box's serial-count cap — wired below for
    // the New Entry box against Expected Qty (cleared after every "Add
    // Product Line", so it's always THIS line's target); the Edit box has
    // no single per-line Qty to cap against (its total is only checked when
    // a line is added / at Apply time), so it's wired with no live cap,
    // just duplicate-blocking, same as Purchase's boxes.
    function wireSerialBtToggle(opts) {
      const box = document.getElementById(opts.boxId);
      const btBtn = document.getElementById(opts.btBtnId);
      const cameraBtn = document.getElementById(opts.cameraBtnId);
      const card = document.getElementById(opts.cardId);
      const valueEl = document.getElementById(opts.valueId);
      const msgEl = document.getElementById(opts.msgId);
      const retryBtn = document.getElementById(opts.retryId);
      const doneBtn = document.getElementById(opts.doneId);
      if (!box || !btBtn || !card) return { isBtMode: () => false };

      let btMode = false;
      let buffer = '';
      let pendingCode = null;

      function requiredQty() {
        if (!opts.qtyFieldId) return null;
        const el = document.getElementById(opts.qtyFieldId);
        if (!el) return null;
        const v = parseInt(el.value, 10);
        return (Number.isFinite(v) && v > 0) ? v : null;
      }

      function focusBox() {
        if (btMode) {
          box.setAttribute('readonly', 'readonly');
          box.focus({ preventScroll: true });
          window.setTimeout(() => {
            box.removeAttribute('readonly');
            const len = box.value.length;
            if (typeof box.setSelectionRange === 'function') box.setSelectionRange(len, len);
            box.focus({ preventScroll: true });
          }, 450);
        } else {
          box.focus({ preventScroll: true });
        }
      }

      function applyUi() {
        btBtn.classList.toggle('active', btMode);
        btBtn.classList.toggle('btn-blue', btMode);
        btBtn.classList.toggle('btn-ghost', !btMode);
        btBtn.innerHTML = `<i class="fa-brands fa-bluetooth-b"></i> ${btMode ? 'BT Scan: ON' : 'BT Scan'}`;
        if (cameraBtn) {
          cameraBtn.disabled = btMode;
          cameraBtn.classList.toggle('ss-disabled', btMode);
          cameraBtn.title = btMode ? 'Camera disabled in Bluetooth scanner mode' : 'Scan barcode / QR';
        }
        box.setAttribute('inputmode', btMode ? 'none' : 'text');
      }

      function hideCard() {
        card.style.display = 'none';
        pendingCode = null;
      }
      function showCard(code, flags) {
        flags = flags || {};
        pendingCode = flags.blocked ? null : code;
        if (valueEl) valueEl.textContent = code || '(empty)';
        const req = requiredQty();
        if (msgEl) {
          msgEl.textContent = flags.dup
            ? 'This serial no. is already in the box. Retry with a different code.'
            : flags.overCap
              ? `You cannot scan more than the entered quantity — ${req} serial number(s) allowed.`
              : 'Scanned — tap Done to add it.';
        }
        if (doneBtn) doneBtn.style.display = flags.blocked ? 'none' : '';
        card.style.display = 'flex';
      }

      if (retryBtn) retryBtn.addEventListener('click', () => { hideCard(); focusBox(); });
      if (doneBtn) {
        doneBtn.addEventListener('click', () => {
          if (!pendingCode) return;
          const existing = splitSerials(box.value);
          existing.push(pendingCode);
          box.value = existing.join('\n') + '\n';
          box.dispatchEvent(new Event('input', { bubbles: true }));
          hideCard();
          focusBox();
        });
      }

      btBtn.addEventListener('click', () => {
        btMode = !btMode;
        buffer = '';
        hideCard();
        applyUi();
        if (window.showToast) {
          window.showToast(btMode
            ? 'Bluetooth scanner mode ON — camera disabled, box ready for the scanner.'
            : 'Bluetooth scanner mode OFF — camera scan available again.');
        }
        focusBox();
      });

      // Capture phase so this runs before wireSerialBox's own
      // auto-newline-on-delimiter listener and can shadow it completely
      // while BT mode is on — that listener also checks isBtMode() itself
      // as a second guard.
      box.addEventListener('keydown', (e) => {
        if (!btMode) return;
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        // Drop OS auto-repeat echoes from a fast HID/BT wedge scanner —
        // see bom-serial-modal.js's identical guard for why (a real
        // scanner keystroke is never itself a repeat).
        if (e.repeat) { e.preventDefault(); return; }
        if (card.style.display !== 'none') { e.preventDefault(); return; } // card showing — ignore further input
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          const code = buffer.trim();
          buffer = '';
          if (!code) return;
          const existing = splitSerials(box.value);
          const req = requiredQty();
          if (req != null && existing.length >= req) { showCard(code, { blocked: true, overCap: true }); return; }
          const dup = existing.some((s) => s.toLowerCase() === code.toLowerCase());
          if (dup) { showCard(code, { blocked: true, dup: true }); return; }
          if (opts.beepFn) opts.beepFn();
          showCard(code);
          return;
        }
        if (e.key === 'Escape') { buffer = ''; return; }
        if (e.key.length === 1) { e.preventDefault(); buffer += e.key; }
      }, true);

      // Turns BT mode off and clears any pending confirm card — called on
      // Clear Form / Clear Changes so a leftover pending scan or an ON
      // toggle never survives a form reset.
      function reset() {
        btMode = false;
        buffer = '';
        hideCard();
        applyUi();
      }

      return { isBtMode: () => btMode, reset };
    }

    saleSerialBt = wireSerialBtToggle({
      boxId: 'saleSerials', btBtnId: 'saleBtBtn', cameraBtnId: 'saleScanBtn',
      cardId: 'saleBtCard', valueId: 'saleBtValue', msgId: 'saleBtMsg',
      retryId: 'saleBtRetry', doneId: 'saleBtDone', beepFn: saleScanBeep,
      qtyFieldId: 'saleQty',
    });
    saleEditSerialBt = wireSerialBtToggle({
      boxId: 'saleEditSerials', btBtnId: 'saleEditBtBtn', cameraBtnId: 'saleEditScanBtn',
      cardId: 'saleEditBtCard', valueId: 'saleEditBtValue', msgId: 'saleEditBtMsg',
      retryId: 'saleEditBtRetry', doneId: 'saleEditBtDone', beepFn: saleScanBeep,
    });

    function renderLineList(container, lines, emptyText) {
      if (!lines.length) {
        container.innerHTML = `<div class="empty">${emptyText}</div>`;
        return;
      }
      container.innerHTML = lines.map((ln, idx) => `
        <div class="line-item" data-idx="${idx}">
          <span>${ln.cat} • ${ln.brand} ${ln.model ? '• ' + ln.model : (ln.watt ? '• ' + ln.watt + 'W' : '')} • ${ln.type}</span>
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
    const saleCatEl = $('saleCat'), saleBrandEl = $('saleBrand'), saleWattEl = $('saleWatt'), saleModelEl = $('saleModel'), saleTypeEl = $('saleType');

    async function loadSaleCategories() {
      await fillSelectFromApi(saleCatEl, '/masters/categories', 'No categories found');
      await refreshSaleBrandsAndWatt();
    }

    async function refreshSaleBrandsAndWatt() {
      const cat = saleCatEl.value;
      if (!cat) {
        fillSelect(saleBrandEl, [], '-- Select Category First --');
        fillSelect(saleWattEl, [], '-- Select Brand First --');
        fillSelect(saleModelEl, [], '-- Select Brand First --');
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
      await refreshSaleModels();
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

    // Model dropdown's equivalent of refreshSaleWattage() above — same
    // Category+Brand cascading. Reuses the existing /api/purchase/models
    // endpoint (already category+brand scoped, reads the same `items`
    // table) — no separate /api/sales/models endpoint exists, see the
    // comment above registerSalesRoutes' dispatch section in
    // sales.routes.js. Only ever shown/used for categories where
    // saleCategoryNeedsModel() is true.
    async function refreshSaleModels() {
      const cat = saleCatEl.value, brand = saleBrandEl.value;
      if (!cat || !brand) {
        fillSelect(saleModelEl, [], '-- Select Brand First --');
        return;
      }
      try {
        const models = await window.Api.get(`/purchase/models?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}`);
        fillSelect(saleModelEl, models.length ? models : ['N/A'], 'N/A');
      } catch (e) {
        fillSelect(saleModelEl, ['N/A'], 'N/A');
      }
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

    saleCatEl.addEventListener('change', () => { refreshSaleBrandsAndWatt(); updateSaleSerialFieldVisibility(); updateSaleWattModelVisibility(); });
    saleBrandEl.addEventListener('change', () => { refreshSaleWattage(); refreshSaleModels(); });
    saleWattEl.addEventListener('change', refreshSaleType);
    loadSaleCategories();
    loadCategoryWattRules().then(() => {
      updateSaleSerialFieldVisibility();
      updateSaleEditQtyFieldVisibility();
      updateSaleWattModelVisibility();
      updateSaleEditWattModelVisibility();
    });

    // Shows/hides the serial-scan textarea depending on whether the
    // currently-selected category needs serial numbers at all (mirrors the
    // same serial_mandatory-driven show/hide already used on Purchase
    // Inward's create panel).
    function updateSaleSerialFieldVisibility() {
      const cat = saleCatEl.value;
      const needsSerial = isSerialMandatory(cat);
      $('saleSerialsField').style.display = needsSerial ? '' : 'none';
      $('saleQtyOnlyNote').style.display = needsSerial ? 'none' : '';
    }

    // Swaps the Wattage field for the Model field (or back) based on the
    // selected category's rule — mirrors purchase.js's
    // updatePurWattModelVisibility() / masters.js's own Wattage/Model swap.
    function updateSaleWattModelVisibility() {
      const showModel = saleCategoryNeedsModel(saleCatEl.value);
      $('saleWattField').style.display = showModel ? 'none' : '';
      $('saleModelField').style.display = showModel ? '' : 'none';
    }

    // Same idea for the Edit panel — the shared Serials textarea there only
    // makes sense for serial-mandatory categories; quantity-tracked ones get
    // their own per-line Qty input (a loaded order can mix both kinds of
    // lines, this only affects what "Add Line" currently expects). The
    // pooled Serials box stays visible if EITHER the category currently
    // selected in the dropdown is serial-mandatory, OR any line already
    // loaded/added into this edit session is serial-mandatory — so
    // switching the dropdown to a quantity-tracked category never hides
    // serials already typed for an earlier serial-based line.
    function updateSaleEditQtyFieldVisibility() {
      const cat = saleEditCatEl.value;
      const needsSerial = isSerialMandatory(cat);
      $('saleEditQtyField').style.display = needsSerial ? 'none' : '';
      $('saleEditQtyOnlyNote').style.display = needsSerial ? 'none' : '';
      const anyLineNeedsSerial = saleEditLines.some((ln) => ln.needsSerial);
      $('saleEditSerialsWrap').style.display = (needsSerial || anyLineNeedsSerial) ? '' : 'none';
    }

    // Same Wattage<->Model swap as the New Entry form, applied to the Edit
    // panel's own fields — mirrors purchase.js's
    // updatePurEditWattModelVisibility(). Defined here (not gated behind
    // `if (isAdmin)`) for the same reason updateSaleEditQtyFieldVisibility()
    // is: it's harmless to call for a locked/disabled edit panel too, and
    // loadCategoryWattRules().then(...) above calls it unconditionally.
    function updateSaleEditWattModelVisibility() {
      const showModel = saleCategoryNeedsModel(saleEditCatEl.value);
      $('saleEditWattField').style.display = showModel ? 'none' : '';
      $('saleEditModelField').style.display = showModel ? '' : 'none';
    }

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
      const cat = saleCatEl.value, brand = saleBrandEl.value;
      const needsModel = saleCategoryNeedsModel(cat);
      const wattVal = needsModel ? '' : saleWattEl.value.trim();
      const model = needsModel ? saleModelEl.value.trim() : '';
      const type = saleTypeEl.value, qtyStr = $('saleQty').value.trim();
      const watt = (wattVal && wattVal !== 'N/A' && !isNaN(Number(wattVal))) ? Number(wattVal) : 0;

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
      const qtyNum = Number(qtyStr);

      // ---- Quantity-based category (no serial numbers at all) ----
      if (!isSerialMandatory(cat)) {
        let errors = [];
        try {
          const resp = await window.Api.get(`/sales/check-line?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}&watt=${watt}&type=${encodeURIComponent(type)}&qty=${qtyNum}&model=${encodeURIComponent(model)}`);
          errors = resp.errors || [];
        } catch (e) {
          window.openModal('Server Error', '<p>Could not verify stock availability against the database. Please try again.</p>');
          return;
        }
        if (errors.length) {
          window.openModal('Stock Validation Error', `<p><strong>DISPATCH BLOCKED:</strong></p><p>${errors.join('<br>')}</p>`);
          return;
        }
        saleLines.push({ cat, brand, watt, model, type, qty: qtyNum });
        renderLineList(saleLineList, saleLines, '');
        $('saleQty').value = '';
        return;
      }

      // ---- Serial-based category (existing flow, unchanged) ----
      const serials = splitSerials($('saleSerials').value);
      if (serials.length !== qtyNum) {
        window.openModal('Quantity Mismatch', `<p>Quantity mismatch: Qty is ${qtyStr}, but ${serials.length} serial number(s) found.</p>`);
        return;
      }
      if (new Set(serials).size !== serials.length) {
        window.openModal('Duplicate Serial Error', '<p>Duplicate serial numbers found inside this product line.</p>');
        return;
      }
      const existingSerials = new Set(saleLines.flatMap((l) => l.serials || []));
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

      saleLines.push({ cat, brand, watt, model, type, serials });
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
      updateSaleSerialFieldVisibility();
      updateSaleWattModelVisibility();
      ['saleCustShort', 'saleCust', 'saleCustMobile', 'saleCustAddr', 'saleOrder', 'saleChalanNo', 'saleInvNo', 'saleQty'].forEach((id) => { $(id).value = ''; });
      $('saleChalanDate').value = '';
      $('saleInvDate').value = '';
      $('saleSerials').value = '';
      saleLines.length = 0;
      renderLineList(saleLineList, saleLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
      saleProof.files = [];
      $('saleProofFile').value = '';
      $('saleProofName').textContent = 'No proof selected';
      if (saleSerialBt) saleSerialBt.reset();
    }
    $('saleBtnClearForm').addEventListener('click', clearSalesForm);

    $('saleBtnChallan').addEventListener('click', () => {
      const customer = $('saleCust').value.trim();
      const orderNo = $('saleOrder').value.trim() || customer;
      const chalanNo = $('saleChalanNo').value.trim();
      const chalanDate = $('saleChalanDate').value || new Date().toISOString().slice(0, 10);
      if (!customer) {
        window.openModal('Customer Name Required', '<p>Please enter Customer Name first.</p>');
        return;
      }
      if (!saleLines.length && !$('saleQty').value.trim() && !$('saleSerials').value.trim()) {
        window.openModal('Items Required', '<p>Please add at least one product line before creating Challan.</p>');
        return;
      }
      if ($('saleQty').value.trim() || $('saleSerials').value.trim()) {
        $('saleBtnAddLine').click();
      }
      if (typeof window.openChallanFromSalesData === 'function') {
        window.openChallanFromSalesData({ customer, orderNo, chalanNo, chalanDate, lines: saleLines });
      }
    });

    if ($('saleBtnOpenChallanReg')) {
      $('saleBtnOpenChallanReg').addEventListener('click', () => {
        if (typeof window.openChallanRegisterModal === 'function') {
          window.openChallanRegisterModal();
        }
      });
    }

    $('saleBtnSave').addEventListener('click', async () => {
      const customer = $('saleCust').value.trim();
      let orderNo = $('saleOrder').value.trim();
      if (!orderNo && customer) orderNo = customer;
      let chalanNo = $('saleChalanNo').value.trim();
      let chalanDate = PD.dmyFromISO($('saleChalanDate').value);
      if (!chalanDate) chalanDate = PD.dmyFromISO(new Date().toISOString().slice(0, 10));
      const invoiceNo = $('saleInvNo').value.trim();
      const invoiceDate = invoiceNo ? (PD.dmyFromISO($('saleInvDate').value) || '-') : '-';

      if (!customer || !chalanNo || !chalanDate) {
        window.openModal('Missing Fields', '<p><strong>Customer Name</strong>, <strong>Challan No</strong>, and <strong>Challan Date</strong> are required for Sales Dispatch.</p>');
        return;
      }

      // If the current form fields still hold an un-added line (qty/serials
      // filled in but "Add Product Line" never clicked), add it now first —
      // mirrors process_sales_dispatch()'s own auto-add-current-line step.
      if (($('saleQty').value.trim() || $('saleSerials').value.trim())) {
        $('saleBtnAddLine').click();
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
        const savedLines = saleLines.map((l) => ({ cat: l.cat, brand: l.brand, watt: l.watt, model: l.model, type: l.type, serials: l.serials, qty: l.qty }));
        const result = await window.Api.post('/sales/dispatch', {
          customer, orderNo, chalanNo, chalanDate, invoiceNo, invoiceDate,
          proofName: saleProof.files.length ? (saleProof.files.length === 1 ? saleProof.files[0].name : `${saleProof.files.length} files`) : '-',
          lines: savedLines,
        });
        if (window.showToast) window.showToast('Sales Dispatch executed successfully!', 'success');

        // Auto-save serials Excel to network path if serials were dispatched
        const allSalesSerials = savedLines.flatMap((l) => l.serials || []).filter(Boolean);
        if (allSalesSerials.length) {
          window.Api.post('/serials/save-excel', {
            orderNo: orderNo || chalanNo,
            customerName: customer,
            shortName: orderNo,
            date: chalanDate || new Date().toISOString(),
            serials: allSalesSerials
          }, { silent: true }).catch(() => {});
        }
        
        let uploadWarning = '';
        if (chalanNo && saleProof.files.length) {
          const uploadResult = await window.uploadAttachments('sales', chalanNo, saleProof.files);
          if (!uploadResult.ok) {
            uploadWarning = `<p style="color:var(--red); margin-top:8px;">Note: the dispatch was saved, but the proof file(s) could not be uploaded (${uploadResult.error}). You can re-attach them from Sale Register &gt; Edit.</p>`;
          }
        }

        const successHtml = `
          <p>Project dispatch saved with <b>${result.lineCount}</b> product line(s) and <b>${result.serialCount}</b> serial(s).</p>
          ${uploadWarning}
          <div class="actions-row" style="margin-top:16px;">
            <button class="btn btn-blue" id="salesModalPrintChallanBtn" type="button"><i class="fa-solid fa-file-invoice"></i> Generate &amp; Print Challan</button>
            <button class="btn btn-ghost" type="button" onclick="closeModal()">Done</button>
          </div>
        `;
        window.openModal('Dispatch Completed!', successHtml);

        const printChallanBtn = document.getElementById('salesModalPrintChallanBtn');
        if (printChallanBtn) {
          printChallanBtn.addEventListener('click', () => {
            if (typeof window.openChallanFromSalesData === 'function') {
              window.openChallanFromSalesData({ customer, orderNo, chalanNo, chalanDate, lines: savedLines });
            }
          });
        }

        clearSalesForm();
      } catch (err) {
        if (window.showError) {
          window.showError('Execution Error', err.message);
        } else {
          window.openModal('Execution Error', `<p style="color:var(--red); white-space:pre-line;">${err.message}</p>`);
        }
      } finally {
        saveBtn.disabled = false;
      }
    });

    // ---------------- EDIT PANEL ----------------
    const saleEditCatEl = $('saleEditCat'), saleEditBrandEl = $('saleEditBrand'), saleEditWattEl = $('saleEditWatt'), saleEditModelEl = $('saleEditModel'), saleEditTypeEl = $('saleEditType');
    const saleEditLineList = $('saleEditLineList');
    const saleEditLines = [];
    let loadedOrderNo = null;
    let loadedOriginalSerials = [];
    // Quantity-line combos this order owned when it was loaded (or after
    // the last successful Apply) — {cat,brand,watt,type} only. Used at
    // Apply time to detect a qty-line the user removed from saleEditLines
    // entirely, so we can tell the backend to release it (qty:0) instead of
    // silently leaving that stock stuck in 'Sold'.
    let loadedQtyLines = [];
    // `model` included in the key — without it, different models of the
    // same Category+Brand+Type (both carrying watt=0) would wrongly
    // collide into one key here, same bug class Step 1 fixed for
    // Purchase's own grouping key and sales.routes.js's GET /find grouping.
    const qtyLineKey = (l) => [l.cat, l.brand, l.watt || 0, l.type, l.model || ''].join('|');

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
          fillSelect(saleEditModelEl, [], '-- Select Brand First --');
          await refreshSaleEditType();
          return;
        }
        await fillSelectFromApi(saleEditBrandEl, `/purchase/brands/${encodeURIComponent(cat)}`, 'No brands under this category', injectBrand);
        await refreshSaleEditWattage(injectWatt);
        await refreshSaleEditModels();
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

      // Edit panel's Model dropdown — same idea as refreshSaleEditWattage()
      // above, reusing /api/purchase/models (see refreshSaleModels()).
      async function refreshSaleEditModels(injectModel) {
        const cat = saleEditCatEl.value, brand = saleEditBrandEl.value;
        if (!cat || !brand) {
          fillSelect(saleEditModelEl, [], '-- Select Brand First --');
          return;
        }
        await fillSelectFromApi(saleEditModelEl, `/purchase/models?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}`, 'N/A', injectModel);
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

      saleEditCatEl.addEventListener('change', () => { refreshSaleEditBrandsAndWatt(); updateSaleEditQtyFieldVisibility(); updateSaleEditWattModelVisibility(); });
      saleEditBrandEl.addEventListener('change', () => { refreshSaleEditWattage(); refreshSaleEditModels(); });
      saleEditWattEl.addEventListener('change', () => refreshSaleEditType());
      fillSelectFromApi(saleEditCatEl, '/masters/categories', 'No categories found');

      async function loadEditCascadeForLine(line) {
        if (!line) return;
        await fillSelectFromApi(saleEditCatEl, '/masters/categories', 'No categories found', line.cat);
        await fillSelectFromApi(saleEditBrandEl, `/purchase/brands/${encodeURIComponent(saleEditCatEl.value)}`, 'No brands under this category', line.brand);
        await fillSelectFromApi(saleEditWattEl, `/purchase/wattages?category=${encodeURIComponent(saleEditCatEl.value)}&brand=${encodeURIComponent(saleEditBrandEl.value)}`, 'N/A', line.watt);
        await fillSelectFromApi(saleEditModelEl, `/purchase/models?category=${encodeURIComponent(saleEditCatEl.value)}&brand=${encodeURIComponent(saleEditBrandEl.value)}`, 'N/A', line.model);
        await refreshSaleEditType(line.type);
        updateSaleEditQtyFieldVisibility();
        updateSaleEditWattModelVisibility();
      }

      function clearEditPanel() {
        $('saleSearchOrder').value = '';
        ['saleEditCust', 'saleEditChalanNo', 'saleEditInvNo', 'saleEditQty'].forEach((id) => { $(id).value = ''; });
        $('saleEditChalanDate').value = '';
        $('saleEditInvDate').value = '';
        $('saleEditSerials').value = '';
        saleEditLines.length = 0;
        renderLineList(saleEditLineList, saleEditLines, 'Find an order above to load its lines.');
        loadedOrderNo = null;
        loadedOriginalSerials = [];
        loadedQtyLines = [];
        saleEditProof.files = [];
        $('saleEditProofFile').value = '';
        $('saleEditProofName').textContent = 'No proof selected';
        updateSaleEditQtyFieldVisibility();
        updateSaleEditWattModelVisibility();
        if (saleEditSerialBt) saleEditSerialBt.reset();
      }
      $('saleBtnClearEdit').addEventListener('click', clearEditPanel);

      $('saleBtnEditAddLine').addEventListener('click', async () => {
        const cat = saleEditCatEl.value, brand = saleEditBrandEl.value;
        const needsModel = saleCategoryNeedsModel(cat);
        const wattVal = needsModel ? '' : saleEditWattEl.value.trim();
        const model = needsModel ? saleEditModelEl.value.trim() : '';
        const type = saleEditTypeEl.value;
        const watt = (wattVal && wattVal !== 'N/A' && !isNaN(Number(wattVal))) ? Number(wattVal) : 0;
        if (!cat || !brand || !type) {
          window.openModal('Line Error', '<p>Category, Brand and Type are required for this line.</p>');
          return;
        }

        // ---- Quantity-tracked category (no serial numbers) ----
        if (!isSerialMandatory(cat)) {
          const qtyStr = $('saleEditQty').value.trim();
          if (!/^\d+$/.test(qtyStr) || Number(qtyStr) <= 0) {
            window.openModal('Validation Error', '<p>Enter a valid positive Qty for this line.</p>');
            return;
          }
          const qtyNum = Number(qtyStr);
          // Live check-line only guards against the general Available pool
          // — it can't know this order already owns some of that stock, so
          // a line that's mostly just "keep what we have" may still show as
          // short here; Apply's own delta check (against what this order
          // owns) is the real gate, this is just an early heads-up.
          let errors = [];
          try {
            const resp = await window.Api.get(`/sales/check-line?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}&watt=${watt}&type=${encodeURIComponent(type)}&qty=${qtyNum}&model=${encodeURIComponent(model)}`);
            errors = resp.errors || [];
          } catch (e) { /* best-effort pre-check only */ }
          if (errors.length) {
            window.openModal('Stock Validation Error', `<p>${errors.join('<br>')}</p><p style="margin-top:8px;">If this quantity includes stock the order already owns, it may still be fine — Apply will do the real check.</p>`);
            return;
          }
          saleEditLines.push({ cat, brand, watt, model, type, needsSerial: false, qty: qtyNum });
          renderLineList(saleEditLineList, saleEditLines, '');
          $('saleEditQty').value = '';
          updateSaleEditQtyFieldVisibility();
          return;
        }

        // ---- Serial-based category (existing flow, unchanged) — model-
        // based categories are never serial_mandatory, so `model` here is
        // always '' by construction (see saleCategoryNeedsModel).
        saleEditLines.push({ cat, brand, watt, model, type, needsSerial: true, serials: [] });
        renderLineList(saleEditLineList, saleEditLines, '');
        updateSaleEditQtyFieldVisibility();
      });
      $('saleBtnEditRemoveLine').addEventListener('click', () => {
        const idx = selectedLineIndex(saleEditLineList);
        if (idx === -1) return;
        saleEditLines.splice(idx, 1);
        renderLineList(saleEditLineList, saleEditLines, 'Find an order above to load its lines.');
        updateSaleEditQtyFieldVisibility();
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
        loadedQtyLines = [];
        (order.lines || []).forEach((ln) => {
          if (Array.isArray(ln.serials)) {
            saleEditLines.push({ cat: ln.cat, brand: ln.brand, watt: ln.watt, model: ln.model, type: ln.type, needsSerial: true, serials: ln.serials });
          } else {
            saleEditLines.push({ cat: ln.cat, brand: ln.brand, watt: ln.watt, model: ln.model, type: ln.type, needsSerial: false, qty: ln.qty });
            loadedQtyLines.push({ cat: ln.cat, brand: ln.brand, watt: ln.watt, model: ln.model, type: ln.type });
          }
        });
        renderLineList(saleEditLineList, saleEditLines, 'Find an order above to load its lines.');
        await loadEditCascadeForLine(saleEditLines[0]);
        $('saleEditSerials').value = (order.allSerials || []).join('\n');
        if (saleEditSerialBt) saleEditSerialBt.reset(); // fresh order — drop any in-progress BT scan from before

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
        // Only serial-based lines participate in the shared textarea's
        // distribution — quantity lines carry their own explicit qty and
        // never touch this textarea.
        const serialLinesIn = saleEditLines.filter((ln) => ln.needsSerial);
        const qtyLinesIn = saleEditLines.filter((ln) => !ln.needsSerial);

        // Distribute the (possibly re-ordered/edited) serial list back
        // across the loaded serial-based lines in order, same grouping rule
        // the New Entry panel uses when splitting a single textarea across
        // lines. Falls back to the currently-selected dropdowns only if
        // there are no lines at all yet and this category needs serials.
        let cursor = 0;
        const serialSourceLines = serialLinesIn.length ? serialLinesIn
          : (!saleEditLines.length && isSerialMandatory(saleEditCatEl.value)
            ? [{ cat: saleEditCatEl.value, brand: saleEditBrandEl.value, watt: saleEditWattEl.value.trim(), type: saleEditTypeEl.value }]
            : []);
        const serialLines = serialSourceLines.map((ln, idx, arr) => {
          const remainingLines = arr.length - idx;
          const takeCount = idx === arr.length - 1 ? (allSerials.length - cursor) : Math.ceil((allSerials.length - cursor) / remainingLines);
          const serials = allSerials.slice(cursor, cursor + takeCount);
          cursor += takeCount;
          return { cat: ln.cat, brand: ln.brand, watt: ln.watt, type: ln.type, serials };
        });

        // Any qty-line combo this order owned at load time but that isn't
        // in the current line list anymore (user removed it) gets sent as
        // qty:0 — the backend releases everything it owns for that combo
        // back to Available instead of leaving it stuck.
        const currentQtyKeys = new Set(qtyLinesIn.map(qtyLineKey));
        const removedQtyLines = loadedQtyLines.filter((ln) => !currentQtyKeys.has(qtyLineKey(ln)));
        const qtyLines = [
          ...qtyLinesIn.map((ln) => ({ cat: ln.cat, brand: ln.brand, watt: ln.watt, model: ln.model, type: ln.type, qty: ln.qty })),
          ...removedQtyLines.map((ln) => ({ cat: ln.cat, brand: ln.brand, watt: ln.watt, model: ln.model, type: ln.type, qty: 0 })),
        ];

        const lines = [...serialLines, ...qtyLines];

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
          // Reflect the now-current ownership so a further edit in this same
          // session diffs against what actually exists post-Apply.
          loadedQtyLines = qtyLinesIn.map((ln) => ({ cat: ln.cat, brand: ln.brand, watt: ln.watt, model: ln.model, type: ln.type }));
          const uploadResult = await window.uploadAttachments('sales', newChalan, saleEditProof.files);
          if (window.showToast) window.showToast('Sales modifications saved.', 'success');
          const uploadWarning = !uploadResult.ok
            ? `<p style="color:var(--red); margin-top:8px;">Note: the order was updated, but the new proof file(s) could not be uploaded (${uploadResult.error}). Please try attaching them again.</p>`
            : '';
          if (window.showSuccess) {
            window.showSuccess('Modifications Saved', `<p>Sales order <strong>${loadedOrderNo}</strong> updated successfully.</p>${uploadWarning}`);
          } else {
            window.openModal('Saved', `<p>Sales order <strong>${loadedOrderNo}</strong> updated successfully.</p>${uploadWarning}`);
          }
        } catch (err) {
          if (window.showError) {
            window.showError('Modification Failed', err.message || 'Failed to modify tracking register');
          } else {
            window.openModal('Error', `<p style="white-space:pre-line;">${err.message || 'Failed to modify tracking register'}</p>`);
          }
        } finally {
          applyBtn.disabled = false;
        }
      });

      $('saleBtnDelete').addEventListener('click', async () => {
        if (!loadedOrderNo) {
          if (window.showWarning) window.showWarning('Not Found', 'Find an order first before trying to delete it.');
          else window.openModal('Not Found', '<p>Find an order first before trying to delete it.</p>');
          return;
        }
        const orderNo = loadedOrderNo;
        if (!(await window.confirmDanger('Delete Sale Transaction', `Permanently delete this sale transaction (Order '${orderNo}')? All its serials will revert back to Available stock. This cannot be undone.`))) return;
        try {
          const result = await window.Api.delete(`/sales/delete/${encodeURIComponent(orderNo)}`);
          if (window.showToast) window.showToast('Transaction completely rolled back.', 'success');
          if (window.showSuccess) {
            window.showSuccess('Order Deleted', `<p>Sale transaction for order <strong>${orderNo}</strong> deleted successfully. ${result.revertedCount} serial(s) reverted to Available.</p>`);
          } else {
            window.openModal('Deleted', `<p>Sale transaction for order <strong>${orderNo}</strong> deleted successfully. ${result.revertedCount} serial(s) reverted to Available.</p>`);
          }
          clearEditPanel();
        } catch (err) {
          if (window.showError) {
            window.showError('Deletion Failed', err.message || 'Deletion failed.');
          } else {
            window.openModal('Error', `<p>${err.message || 'Deletion failed.'}</p>`);
          }
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
        saleLines.push({ cat: line.cat, brand: line.brand, watt: line.watt, model: line.model, type: line.type, qty: line.qty, serials: [] });
      });
      renderLineList(saleLineList, saleLines, 'No product lines added yet — fill the fields above and click "Add Product Line".');
      window.openModal('Assignment Released', '<p>Reserved stock loaded into this Sales form. Please scan/enter serials for each product line, fill Challan No, and confirm dispatch.</p>');
    }
  },
};