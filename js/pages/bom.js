// js/pages/bom.js
// -----------------------------------------------------------------------------
// PART 3 of 3 — trimmed from the original 3921-line bom.js. This file now
// only holds the BOM Home view markup and the window.PAGES.bom registration
// (html template + init()). Presentation/Challan helpers moved to
// bom-kit-helpers.js and bom-challan.js (Parts 1 & 2) — MUST load before
// this file. init() itself is untouched (same DOM ids, same order of
// operations) — splitting its ~2700 lines further would require rewriting
// its internal closures, which risked behavior changes, so it was left
// intact per the "no logic change" requirement.
// -----------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// BOM Home — the new landing view for the BOM tab. Replaces "click BOM in
// the sidebar -> straight into the big New BOM Entry form" with a small
// launcher screen: Create BOM / Track BOM / BOM Register buttons up top,
// and a live table of every still-pending bom_orders row underneath so an
// in-progress BOM is one double-click away instead of buried inside the
// BOM Register modal. The actual kit-selection/dispatch form (unchanged)
// now lives inside #bomEntryView, hidden until Create BOM or a table
// double-click switches views — see init()'s showBomHome()/showBomEntry().
// ---------------------------------------------------------------------------
function bomRenderHomeViewHtml() {
  return `
    <div id="bomHomeView" style="display:none;">
      <div class="page-head"><i class="fa-solid fa-truck-fast" style="color:var(--gold);"></i><h2>BOM Order Dispatch & Processing Workstation</h2></div>
      <div class="panel">
        <h3 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <span><i class="fa-solid fa-hourglass-half"></i> Active &amp; Pending BOM Orders <span style="font-weight:400;color:var(--txt-muted);font-size:11.5px;">(Double-click or click Open to process dispatch)</span></span>
          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="btn btn-ghost bom-mini-btn" id="bomHomeBtnRefresh"><i class="fa-solid fa-rotate"></i> Refresh</button>
          </div>
        </h3>
        <div id="bomHomePendingWrap">
          ${window.Skeleton ? '<div class="table-wrap"><table><tbody>' + window.Skeleton.tableRows(6, 3, { pillCols: [3] }) + '</tbody></table></div>' : '<div style="padding:20px; text-align:center; color:var(--txt-muted); font-size:12.5px;">Loading pending orders...</div>'}
        </div>
      </div>
    </div>
  `;
}

window.PAGES.bom = {
  name: 'BOM',
  icon: 'fa-list-check',
  sub: 'Bill of Material — kit-wise item list',
  html: `
    ${bomRenderHomeViewHtml()}
    <div id="bomEntryView" style="display:none;">
    <div class="page-head" style="justify-content:space-between; flex-wrap:wrap; gap:10px;">
      <div style="display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-list-check" style="color:var(--gold);"></i><h2>Bill of Material (BOM)</h2></div>
      <button type="button" class="btn btn-ghost" id="bomBtnBackHome"><i class="fa-solid fa-arrow-left"></i> Back (Esc)</button>
    </div>

    <!-- Populated instead of the Kit Items panel when a pending order is
         opened from the BOM Home table / BOM Register — see
         bomOpenOrderInline() in init(). Hidden the rest of the time. -->
    <div class="panel" id="bomContinuePanel" style="display:none;">
      <h3><i class="fa-solid fa-truck"></i> Continue Dispatch <span style="font-weight:400;color:var(--txt-muted);font-size:11.5px;">(picking up a pending order)</span></h3>
      <div id="bomContinueInlineBody"></div>
    </div>

    <div class="panel" id="bomNewEntryPanel">
      <h3><i class="fa-solid fa-box-open"></i> New BOM Entry</h3>
      <div class="form-grid cols-2">
        <div class="field"><label>BOM Kit <span class="req">*</span></label>
          <div style="display:flex; gap:8px; align-items:center;">
            <select id="bomKitSelect" style="flex:1;">
              <option value="">-- Select Kit --</option>
            </select>
            <button type="button" class="btn btn-ghost" id="bomBtnEditKit" style="display:none; padding:9px 12px;" title="Edit this saved template"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="btn btn-red" id="bomBtnDeleteKit" style="display:none; padding:9px 12px;" title="Delete this saved template"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="field"><label>Order No <span class="req">*</span></label><input id="bomOrderNo" placeholder="Order no. / Customer short code" list="bomOrderNoList" autocomplete="off"><datalist id="bomOrderNoList"></datalist></div>

        <div class="field"><label>Customer Name <span class="req">*</span></label><input id="bomCustomerName" placeholder="Customer / Party" list="bomCustNameList" autocomplete="off"><datalist id="bomCustNameList"></datalist></div>
        <div class="field"><label>Dealer Name</label><input id="bomDealerName" placeholder="Dealer name or short name" list="bomDealerList" autocomplete="off"><datalist id="bomDealerList"></datalist></div>

        <div class="field"><label>Installer Name</label><input id="bomInstallerName" placeholder="Installer name or short name" list="bomInstallerList" autocomplete="off"><datalist id="bomInstallerList"></datalist></div>
        <div class="field"><label>Fabricatore Name</label><input id="bomFabricatorName" placeholder="Fabricator name or short name" list="bomFabricatorList" autocomplete="off"><datalist id="bomFabricatorList"></datalist></div>

        <div class="field"><label>Challan No.</label><input id="bomChallanNo" name="egs_challan_no" placeholder="Challan no." autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true"></div>
        <div class="field"><label>Ch. Date</label><input id="bomChallanDate" type="date"></div>
      </div>
      <div class="actions-row">
        <button class="print-btn" type="button" id="bomBtnPrint">
          <span class="printer-wrapper">
            <span class="printer-container">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 92 75">
                <path stroke-width="5" stroke="currentColor" d="M12 37.5H80C85.2467 37.5 89.5 41.7533 89.5 47V69C89.5 70.933 87.933 72.5 86 72.5H6C4.067 72.5 2.5 70.933 2.5 69V47C2.5 41.7533 6.75329 37.5 12 37.5Z"></path>
                <path fill="currentColor" d="M12 12C12 5.37258 17.3726 0 24 0H57C70.2548 0 81 10.7452 81 24V29H12V12Z"></path>
                <circle fill="currentColor" r="3" cy="49" cx="78"></circle>
              </svg>
            </span>
            <span class="printer-page-wrapper">
              <span class="printer-page"></span>
            </span>
          </span>
          <span>Print BOM</span>
        </button>
        <button class="btn btn-blue" type="button" id="bomBtnVerify" disabled><i class="fa-solid fa-check-double"></i> Verify BOM</button>
        <button class="btn btn-green" type="button" id="bomBtnChallan" disabled><i class="fa-solid fa-file-invoice"></i> Convert into Challan</button>
        <button class="btn btn-green" type="button" id="bomBtnDispatch" disabled><i class="fa-solid fa-truck"></i> Create Dispatch</button>
        <button class="btn btn-green" type="button" id="bomBtnCreateBom" style="display:none;"><i class="fa-solid fa-plus-circle"></i> Generate BOM</button>
        <button class="btn btn-ghost" type="button" id="bomBtnTrackBom"><i class="fa-solid fa-route"></i> Track BOM</button>
        <button type="button" class="btn btn-ghost" id="bomBtnNewKit" title="Create a new BOM Kit / Template"><i class="fa-solid fa-plus"></i> New Kit</button>
      </div>
      <!-- "Pending BOM Register" and "Challan Category Mapping" used to be
           duplicated here AND on the BOM Home launcher screen
           (bomHomeBtnRegister / bomHomeBtnChallanMap) — kept ONLY on Home
           now, per instruction, so each action lives in exactly one place. -->
      <p class="note" id="bomVerifyStatus" style="margin-top:8px;">
        <i class="fa-solid fa-circle-info"></i> Tick every item in the <b>Check</b> column below, then click <b>Verify BOM</b>. "Create Dispatch" stays locked until then.
      </p>
    </div>

    <div class="panel" id="bomKitBuilderPanel" style="display:none;">
      <h3 id="bomKitBuilderTitle"><i class="fa-solid fa-layer-group"></i> Create / Save New BOM Kit &amp; Template</h3>
      <div class="form-grid cols-2">
        <div class="field"><label>Kit Name <span class="req">*</span></label><input id="bomNewKitLabel" placeholder="e.g. 5 kW — Commercial 550 Wp"></div>
        <div class="field"><label>Capacity (kW)</label><input id="bomNewKitKw" placeholder="e.g. 5"></div>
      </div>
      <p class="note" style="margin:6px 0 14px;" id="bomKitBuilderHint">
        <i class="fa-solid fa-circle-info"></i> Starts pre-filled with the standard section/item format below — Model, Quantity &amp; Remarks are left blank for you to fill in. Add or remove sections/items freely, and item names can be renamed too.
      </p>
      <div id="bomNewKitSections"></div>
      <div class="actions-row" style="margin-top:10px;">
        <button class="btn btn-ghost" type="button" id="bomBtnAddKitSection"><i class="fa-solid fa-layer-group"></i> Add Section</button>
        <button class="btn btn-blue" type="button" id="bomBtnSaveKitTemplate"><i class="fa-solid fa-floppy-disk"></i> <span id="bomBtnSaveKitTemplateLabel">Save Kit Template</span></button>
        <button class="btn btn-ghost" type="button" id="bomBtnCancelKitBuilder">Cancel</button>
      </div>
    </div>

    <div class="panel" id="bomKitItemsPanel">
      <h3 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <span><i class="fa-solid fa-list"></i> Kit Items <span style="font-weight:400;color:var(--txt-muted);font-size:11.5px;">(auto-filled from selected kit)</span></span>
        <button type="button" class="btn btn-blue bom-mini-btn" id="bomBtnTickAll" title="Tick every item's Check box in one click"><i class="fa-solid fa-check-double"></i> Tick All</button>
      </h3>
      <div id="bomItemsPreview">${bomRenderScreenItemsHtml(null)}</div>
    </div>

    <!-- "Convert into Challan" — its OWN fullscreen modal (NOT the shared
         window.openModal/#modalOverlay small dialog, which is capped at
         max-width:480px in css/modules/components.css — far too narrow
         for this form + item table). Reuses the exact same
         .modal-overlay.modal-fullscreen pattern already used by Party
         Ledger's "Create/Edit Ledger" and "Ledger Account Statement"
         dialogs (css/modules/party-ledger.css) — genuinely maximized on
         desktop, fully responsive on mobile, no new CSS needed at all. -->
    <!-- PRINT-ONLY: exact Excel replica. Hidden on screen (see .bom-print-only
         in style.css); (re)built from the form fields above right before
         printing, then never shown on-screen at all — this is what fixes
         both the "doesn't look like software" issue and the mobile
         layout breaking, since this Excel-shaped markup no longer renders
         on screen or on phones at all. -->
    <div class="bom-print-only" id="bomPrintRoot"></div>

    <!-- PRINT-ONLY: exact Excel replica of the CHALLAN sheet (Customer Copy /
         Company Copy mirrored side by side). Same hidden-on-screen mechanism
         as #bomPrintRoot above (.bom-print-only) — only (re)built + shown for
         the instant "Print Challan" (inside the Convert into Challan modal)
         runs window.print(). Kept completely separate from #bomPrintRoot so
         the existing BOM print is never touched by this. -->
    <div class="bom-print-only" id="bomChallanPrintRoot"></div>
    </div><!-- /bomEntryView -->

    <!-- "Convert into Challan" / "Challan Category Mapping" — its OWN
         fullscreen modal (NOT the shared window.openModal/#modalOverlay
         small dialog, which is capped at max-width:480px in
         css/modules/components.css — far too narrow for this form + item
         table). Reuses the exact same .modal-overlay.modal-fullscreen
         pattern already used by Party Ledger's "Create/Edit Ledger" and
         "Ledger Account Statement" dialogs (css/modules/party-ledger.css)
         — genuinely maximized on desktop, fully responsive on mobile, no
         new CSS needed at all.
         IMPORTANT: kept OUTSIDE #bomEntryView on purpose, same reasoning
         as #bomRegisterOverlay below — the BOM Home screen's own "Challan
         Category Mapping" button opens this same overlay, and
         #bomEntryView is display:none while Home is showing. -->
    <div class="modal-overlay modal-fullscreen" id="bomChallanOverlay">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-head">
          <h3 id="bomChallanModalTitle"><i class="fa-solid fa-file-invoice"></i> Convert into Challan</h3>
          <button class="modal-close" id="bomChallanCloseBtn"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body" id="bomChallanModalBody"></div>
      </div>
    </div>

    <!-- Step 4: Pending BOM Register — lists every bom_orders row still
         Open (some item still pending) and lets you continue dispatching
         the remainder, from any session, without re-picking the kit or
         retyping what's already gone out. Same modal-fullscreen pattern
         as #bomChallanOverlay above; one overlay, body swapped between a
         "list" view and a "continue this order" view.
         IMPORTANT: kept OUTSIDE #bomEntryView on purpose — the BOM Home
         screen's own "BOM Register" button opens this same overlay, and
         #bomEntryView is display:none while Home is showing. Nesting this
         overlay inside #bomEntryView meant the overlay's own .show class
         was powerless against its hidden ancestor: clicking "BOM Register"
         from Home silently did nothing (overlay had .show but its parent
         was still display:none), and it would only actually appear once
         #bomEntryView itself became visible (e.g. after "Create BOM"). -->
    <div class="modal-overlay modal-fullscreen" id="bomRegisterOverlay">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-head">
          <h3><i class="fa-solid fa-clipboard-list"></i> BOM Register</h3>
          <button class="modal-close" id="bomRegisterCloseBtn"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body" id="bomRegisterModalBody"></div>
      </div>
    </div>
  `,

  async init(opts = {}) {
    const ctx = {};
    const curRole = window.currentUserRole || window.CURRENT_USER_ROLE || (window.CURRENT_USER && window.CURRENT_USER.role) || localStorage.getItem('user_role') || localStorage.getItem('role') || 'User';
    ctx.bomCurrentRole = curRole;
    ctx.bomIsAdmin = curRole === 'SuperAdmin' || curRole === 'Admin';

    ctx.$ = (id) => document.getElementById(id);
    ctx.challanOverlay = ctx.$('bomChallanOverlay');
    ctx.challanModalBody = ctx.$('bomChallanModalBody');
    ctx.challanCloseBtn = ctx.$('bomChallanCloseBtn');
    // These DOM refs must ALSO be grabbed before the factory calls below —
    // createBomKitBuilderModule (and others) read ctx.kitSelect/ctx.itemsPreview
    // etc. synchronously the moment they run (e.g. populateKitDropdown()'s
    // very first line is ctx.kitSelect.value), not just inside deferred
    // callbacks. Previously these were assigned AFTER the Object.assign
    // block below, so at factory-call time they were still undefined,
    // throwing "Cannot read properties of undefined (reading 'value')" and
    // aborting init() — the actual remaining cause of the stuck spinner /
    // dead buttons after the ctx.$ ordering fix.
    ctx.kitSelect = ctx.$('bomKitSelect');
    ctx.itemsPreview = ctx.$('bomItemsPreview');
    ctx.kitItemsPanel = ctx.$('bomKitItemsPanel');
    ctx.btnEditKit = ctx.$('bomBtnEditKit');
    ctx.btnDeleteKit = ctx.$('bomBtnDeleteKit');
    ctx.btnNewKit = ctx.$('bomBtnNewKit');
    ctx.btnPrint = ctx.$('bomBtnPrint');
    ctx.printRoot = ctx.$('bomPrintRoot');
    ctx.challanPrintRoot = ctx.$('bomChallanPrintRoot');

    // Same reasoning again: these are plain function-declaration refs (hoisted
    // within this async init(), so it's always safe to assign them onto ctx
    // this early regardless of where they're textually defined below) — but
    // several factories call e.g. ctx.setVerified()/ctx.updateVerifyButtonState()
    // synchronously the moment they run (refreshItemsPreview does, right at
    // module-4/createBomKitBuilderModule's own call time), so they must be on
    // ctx BEFORE the Object.assign block, not after it.
    ctx.showBomHome = showBomHome;
    ctx.showBomEntry = showBomEntry;
    ctx.showBomEntryForNewKit = showBomEntryForNewKit;
    ctx.bomOverallStatusFromItems = bomOverallStatusFromItems;
    ctx.bomRenderHomePendingTableHtml = bomRenderHomePendingTableHtml;
    ctx.bomLoadHomePendingTable = bomLoadHomePendingTable;
    ctx.bomCollectItemsForCreate = bomCollectItemsForCreate;
    ctx.bomOpenCreateBomModal = bomOpenCreateBomModal;
    ctx.setVerified = setVerified;
    ctx.allItemsChecked = allItemsChecked;
    ctx.updateVerifyButtonState = updateVerifyButtonState;
    ctx.getHeaderValues = getHeaderValues;
    ctx.computeAndApplyFitZoom = computeAndApplyFitZoom;
    // Same reasoning as every other early-grab comment in this block:
    // createBomDispatchModule's factory (Object.assign'd below) reads
    // ctx.homeBtnRegister SYNCHRONOUSLY at its own call time (to wire the
    // "BOM Register" button's click listener) — not just inside a function
    // it hands back. This used to be assigned much later, at the same spot
    // as homeBtnCreate/homeBtnTrack/homeBtnRefresh below, which are only
    // ever read from inside callbacks (safe to leave late) — but
    // homeBtnRegister's `if (ctx.homeBtnRegister) ctx.homeBtnRegister.addEventListener(...)`
    // ran while it was still `undefined`, so the condition was always
    // false and the "BOM Register" button's click handler was NEVER
    // attached: clicking it silently did nothing, with no error, no matter
    // how many times you clicked.
    ctx.homeBtnRegister = ctx.$('bomHomeBtnRegister');

    // Pull in the functions that used to be nested directly inside this
    // init() but were split out into separate files per
    // refactor-bom-prompt.md (pure code-organization refactor — see each
    // file's header comment). Each factory closes over the same shared
    // `ctx` object this init() builds below, then hands its functions back
    // to be exposed on ctx (so any file can call any other file's
    // functions the same way, via ctx.<name>(...)) exactly as if they were
    // still one big nested closure.
    Object.assign(ctx, createBomChallanMapModule(ctx));
    Object.assign(ctx, createBomPartyAutocompleteModule(ctx));
    Object.assign(ctx, createBomTrackRegisterModule(ctx));
    Object.assign(ctx, createBomKitBuilderModule(ctx));
    Object.assign(ctx, createBomSerialScanModule(ctx));
    Object.assign(ctx, createBomSerialModalModule(ctx));
    Object.assign(ctx, createBomDispatchModule(ctx));

    // ------------------------------------------------------------------
    // BOM Home <-> BOM Entry view switching. The BOM tab now lands on a
    // small launcher (bomHomeView: Create BOM / Track BOM / BOM Register +
    // a live pending-orders table) instead of dropping straight into the
    // full kit-selection form (bomEntryView, unchanged, just wrapped).
    // ------------------------------------------------------------------
    ctx.homeView = ctx.$('bomHomeView');
    ctx.entryView = ctx.$('bomEntryView');
    ctx.continuePanel = ctx.$('bomContinuePanel');
    ctx.continueInlineBody = ctx.$('bomContinueInlineBody');
    ctx.newEntryPanel = ctx.$('bomNewEntryPanel');
    ctx.btnBackHome = ctx.$('bomBtnBackHome');
    ctx.bomInlineContinueOrderId = null; // set while bomContinuePanel is showing a specific order
    ctx.bomGeneratedForCurrentOrder = false; // true after Generate BOM (or detected existing order)

    function showBomHome() {
      ctx.bomInlineContinueOrderId = null;
      ctx.bomGeneratedForCurrentOrder = false;
      if (ctx.entryView) ctx.entryView.style.display = 'none';
      if (ctx.homeView) ctx.homeView.style.display = '';
      ctx.bomLoadHomePendingTable();
    }
    function showBomEntry() {
      if (ctx.homeView) ctx.homeView.style.display = 'none';
      if (ctx.entryView) ctx.entryView.style.display = '';
    }
    // Fresh "Create BOM" entry: full kit-picker form, Continue Dispatch
    // panel hidden. Used by both the Home "Create BOM" button and the
    // entry screen's own "Back"-free default state.
    function showBomEntryForNewKit() {
      ctx.bomInlineContinueOrderId = null;
      ctx.bomGeneratedForCurrentOrder = false;
      ctx.bomContinueMode = false;
      if (ctx.continuePanel) ctx.continuePanel.style.display = 'none';
      if (ctx.newEntryPanel) ctx.newEntryPanel.style.display = '';
      const kip = ctx.$('bomKitItemsPanel');
      if (kip) kip.style.display = '';

      // Unlock header + kit fields that may have been locked by Continue Dispatch
      ['bomOrderNo', 'bomCustomerName', 'bomDealerName', 'bomInstallerName',
       'bomFabricatorName', 'bomChallanNo', 'bomChallanDate'].forEach((id) => {
        const el = ctx.$(id);
        if (el) {
          el.removeAttribute('readonly');
          el.removeAttribute('disabled');
        }
      });
      if (ctx.kitSelect) ctx.kitSelect.removeAttribute('disabled');
      if (ctx.btnNewKit) ctx.btnNewKit.style.display = ctx.bomIsAdmin ? '' : 'none';
      if (ctx.btnCreateBom) ctx.btnCreateBom.style.display = ctx.bomIsAdmin ? '' : 'none';
      if (ctx.updateKitActionButtons) ctx.updateKitActionButtons();

      // Restore panel title
      const panelH3 = ctx.newEntryPanel && ctx.newEntryPanel.querySelector('h3');
      if (panelH3) panelH3.innerHTML = '<i class="fa-solid fa-box-open"></i> New BOM Entry';
      if (ctx.verifyStatus) {
        ctx.verifyStatus.innerHTML = '<i class="fa-solid fa-circle-info"></i> First <b>Generate BOM</b>, then verify line items to enable <b>Create Dispatch</b>.';
      }

      // Refresh kit items from currently selected kit (fresh state)
      if (ctx.refreshItemsPreview) ctx.refreshItemsPreview();
      ctx.showBomEntry();
    }
    if (ctx.btnBackHome) {
      ctx.btnBackHome.addEventListener('click', () => {
        ctx.showBomHome();
      });
    }

    function bomOverallStatusFromItems(items) {
      const total = (items || []).reduce((s, it) => s + (it.total || 0), 0);
      const dispatched = (items || []).reduce((s, it) => s + (it.dispatched || 0), 0);
      if (dispatched <= 0) return 'Pending';
      if (dispatched >= total) return 'Dispatched';
      return 'Partially Dispatched';
    }

    function bomRenderHomePendingTableHtml(orders) {
      if (!orders || !orders.length) {
        return `<p class="note" style="padding:10px 0;"><i class="fa-solid fa-circle-check" style="color:var(--green);"></i> Nothing pending — every BOM order has been fully dispatched.</p>`;
      }
      const rows = orders.map((o) => `
        <tr class="bom-home-row" data-bom-order-id="${o.id}" style="cursor:pointer;" title="Double-click to open">
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);">${bomEsc(o.orderNo)}</td>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);">${bomEsc((o.header && o.header.customerName) || '-')}</td>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);">${o.pendingItemCount} item(s) / ${o.pendingQty} unit(s) pending</td>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);">${bomEsc((o.createdAt || '').slice(0, 10))}</td>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);"><button type="button" class="btn btn-blue bom-mini-btn" data-bom-order-id="${o.id}"><i class="fa-solid fa-truck"></i> Open</button></td>
        </tr>
      `).join('');
      return `
        <div class="table-wrap" style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
          <table style="width:100%; min-width:560px; border-collapse:collapse;">
            <thead><tr>
              <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border, #ddd);">Order No</th>
              <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border, #ddd);">Customer</th>
              <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border, #ddd);">Pending</th>
              <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border, #ddd);">Started</th>
              <th style="border-bottom:2px solid var(--border, #ddd);"></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }

    async function bomLoadHomePendingTable() {
      const wrap = ctx.$('bomHomePendingWrap');
      if (!wrap) return;
      if (window.Skeleton) {
        wrap.innerHTML = '<div class="table-wrap"><table><tbody>' + window.Skeleton.tableRows(6, 3, { pillCols: [3] }) + '</tbody></table></div>';
      }
      let orders;
      try {
        orders = await window.Api.get('/bom/orders?status=Open', { silent: true });
      } catch (e) {
        if (wrap) {
          if (window.Skeleton) {
            wrap.innerHTML = window.Skeleton.error(e.message || 'Could not load pending BOM orders.', { retryId: 'btnRetryBomPendingHome' });
            window.Skeleton.wireRetry('btnRetryBomPendingHome', () => bomLoadHomePendingTable());
          } else {
            wrap.innerHTML = `<p class="note" style="color:var(--red);">Could not load pending BOM orders — ${bomEsc((e && e.message) || 'server error')}.</p>`;
          }
        }
        return;
      }
      // BOM Home's own "Pending BOM Orders" list is deliberately narrower
      // than the full BOM Register: it only shows Open orders that are
      // still completely untouched — created (Admin/SuperAdmin only, so
      // every row here is already admin-created) but with zero dispatch
      // trips against them yet (isUntouched, from GET /api/bom/orders —
      // see bom.routes.js's pendingForOrder). The moment even one item
      // gets partially dispatched, it drops off THIS list but keeps
      // showing in the full BOM Register (ctx.bomLoadRegisterList below,
      // which intentionally does NOT apply this filter).
      const untouched = (orders || []).filter((o) => o.isUntouched !== false);
      wrap.innerHTML = ctx.bomRenderHomePendingTableHtml(untouched);
      wrap.querySelectorAll('[data-bom-order-id]').forEach((el) => {
        const id = el.getAttribute('data-bom-order-id');
        if (el.tagName === 'BUTTON') {
          el.addEventListener('click', () => ctx.bomOpenOrderInline(id));
        } else {
          el.addEventListener('dblclick', () => ctx.bomOpenOrderInline(id));
        }
      });
    }

    ctx.homeBtnCreate = ctx.$('bomHomeBtnCreate');
    ctx.homeBtnTrack = ctx.$('bomHomeBtnTrack');
    // ctx.homeBtnRegister moved up above the Object.assign(...) factory
    // calls block — see the comment there for why it had to move.
    ctx.homeBtnRefresh = ctx.$('bomHomeBtnRefresh');
    if (ctx.homeBtnCreate) {
      ctx.homeBtnCreate.addEventListener('click', () => {
        ctx.showBomEntryForNewKit();
      });
    }
    if (ctx.homeBtnRefresh) ctx.homeBtnRefresh.addEventListener('click', ctx.bomLoadHomePendingTable);

    const homeBtnChallanReg = ctx.$('bomHomeBtnChallanReg');
    if (homeBtnChallanReg) {
      homeBtnChallanReg.addEventListener('click', () => {
        if (typeof window.openChallanRegisterModal === 'function') {
          window.openChallanRegisterModal();
        }
      });
    }

    const homeBtnCustomChallan = ctx.$('bomHomeBtnCustomChallan');
    if (homeBtnCustomChallan) {
      homeBtnCustomChallan.addEventListener('click', () => {
        if (typeof window.openCustomChallanModal === 'function') {
          window.openCustomChallanModal();
        }
      });
    }

    // Initial load handled by action router (showBomHome / showBomEntryForNewKit)

    function bomCollectItemsForCreate() {
      const out = [];
      (ctx.currentKitState || []).forEach((sec) => {
        (sec.items || []).forEach((it) => {
          const name = (it.name || '').trim();
          const qty = Number(it.qty) || 0;
          if (name && qty > 0) out.push({ name, qty });
        });
      });
      return out;
    }

    function bomOpenCreateBomModal() {
      if (!ctx.currentKitState) {
        if (window.focusInvalidField) window.focusInvalidField(ctx.$('bomKitSelect'));
        return;
      }
      const header = ctx.getHeaderValues();
      const orderNo = (header.orderNo || '').trim();
      if (!orderNo) {
        if (window.focusInvalidField) window.focusInvalidField(ctx.$('bomOrderNo'));
        return;
      }
      if (!(header.customerName || '').trim()) {
        if (window.focusInvalidField) window.focusInvalidField(ctx.$('bomCustomerName'));
        return;
      }
      const items = ctx.bomCollectItemsForCreate();
      if (!items.length) {
        window.openModal('No Items', '<p>Add at least one item with a quantity before generating a BOM.</p>');
        return;
      }
      window.openModal('Generate BOM', `
        <p class="note" style="margin-bottom:10px;">
          <i class="fa-solid fa-circle-info"></i> This creates the BOM as a tracked entity — before any dispatch happens.
          It will land in <b>BOM Home</b> / the <b>BOM Register</b> as <b>Pending</b> until the first trip goes out, then move to
          <b>Partially Dispatched</b> or <b>Dispatched</b> on its own as dispatch progresses.
        </p>
        <table style="width:100%; min-width:0; border-collapse:collapse; margin-bottom:14px;">
          <tr><td style="padding:6px 0; color:var(--txt-muted);">Order No.</td><td style="padding:6px 0; font-weight:600; overflow-wrap:anywhere;">${bomEsc(orderNo)}</td></tr>
          <tr><td style="padding:6px 0; color:var(--txt-muted);">Customer</td><td style="padding:6px 0; font-weight:600; overflow-wrap:anywhere;">${bomEsc(header.customerName || '—')}</td></tr>
          <tr><td style="padding:6px 0; color:var(--txt-muted);">Items</td><td style="padding:6px 0; font-weight:600;">${items.length} item(s)</td></tr>
          <tr><td style="padding:6px 0; color:var(--txt-muted);">Initial Status</td><td style="padding:6px 0;">${ctx.bomTrackStatusPill('Pending')}</td></tr>
        </table>
        <div class="actions-row">
          <button type="button" class="btn btn-green" id="bomCreateBomConfirmBtn"><i class="fa-solid fa-check"></i> Generate BOM</button>
          <button type="button" class="btn btn-ghost" id="bomCreateBomCancelBtn">Cancel</button>
        </div>
      `);
      const confirmBtn = document.getElementById('bomCreateBomConfirmBtn');
      const cancelBtn = document.getElementById('bomCreateBomCancelBtn');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
          const originalLabel = confirmBtn.innerHTML;
          confirmBtn.disabled = true;
          confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
          try {
            // Snapshot the full kit (sections + key/label/kw) so Continue
            // Dispatch can later reopen this exact BOM Entry UI instead of
            // the simplified flat form.
            const kitKey = ctx.kitSelect ? ctx.kitSelect.value : '';
            const allKits = bomGetAllKits();
            const kitMeta = allKits[kitKey] || {};
            const kitSnapshot = {
              kitKey,
              label: kitMeta.label || '',
              kw: kitMeta.kw || '',
              sections: JSON.parse(JSON.stringify(ctx.currentKitState || [])),
            };
            await window.Api.post('/bom/orders', { orderNo, header, items, kitSnapshot });
          } catch (e) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalLabel;
            window.openModal('Could Not Generate BOM', `<p>${bomEsc((e && e.message) || 'Server error. Please try again.')}</p>`);
            return;
          }
          ctx.bomGeneratedForCurrentOrder = true;
          window.closeModal();
          if (window.showToast) window.showToast('BOM generated — it now appears in BOM Home / BOM Register as Pending.');
          ctx.showBomHome();
        });
      }
      if (cancelBtn) cancelBtn.addEventListener('click', () => window.closeModal());
    }

    if (ctx.btnCreateBom) ctx.btnCreateBom.addEventListener('click', ctx.bomOpenCreateBomModal);
    if (ctx.btnTrackBom) ctx.btnTrackBom.addEventListener('click', ctx.bomTrackCurrentOrder);
    if (ctx.homeBtnTrack) ctx.homeBtnTrack.addEventListener('click', ctx.bomOpenTrackModal);

    // Item -> category -> Serial No. mandatory lookup. Panels (and any other
    // category with the Serial No. mandatory rule set in Masters > Category)
    // are tracked by serial number on Purchase Inward already, so Dispatch
    // (outward) mirrors that with a Serial No. field per matching item. This
    // never touches the print sheet — bomRenderPrintSheetHtml is untouched.
    ctx.bomCategorySerialMandatory = {};
    ctx.bomItemCategoryByName = {};
    function setVerified(isVerified) {
      ctx.bomVerified = isVerified;
      if (ctx.btnDispatch) ctx.btnDispatch.disabled = !isVerified;
      if (ctx.btnChallan) ctx.btnChallan.disabled = !isVerified;
      if (ctx.verifyStatus) {
        ctx.verifyStatus.innerHTML = isVerified
          ? '<i class="fa-solid fa-circle-check" style="color:var(--green);"></i> Verified — ready for dispatch.'
          : '<i class="fa-solid fa-circle-info"></i> Tick every item in the <b>Check</b> column below, then click <b>Verify BOM</b>. "Create Dispatch" stays locked until then.';
      }
    }

    // On-screen equivalent of the print sheet's blank "Checked" box: Verify
    // BOM stays disabled until every item being dispatched in this trip is ticked.
    // Items with 0 dispatch qty (e.g. already fully dispatched in an earlier trip)
    // do not block verification.
    function allItemsChecked() {
      if (!ctx.currentKitState || !ctx.currentKitState.length) return false;
      let activeItemCount = 0;
      for (const sec of ctx.currentKitState) {
        for (const it of (sec.items || [])) {
          const effQty = bomEffectiveQty(it);
          if (effQty > 0) {
            activeItemCount++;
            if (!it.checked) return false;
          }
        }
      }
      return activeItemCount > 0;
    }
    function updateVerifyButtonState() {
      // Verify stays locked until: (1) every active item is ticked, AND
      // (2) a BOM has already been generated for this Order No.
      // Continue-Dispatch mode (ctx.bomInlineContinueOrderId) already has a
      // generated order, so it only needs the tick check.
      const bomReady = !!(ctx.bomInlineContinueOrderId || ctx.bomGeneratedForCurrentOrder);
      if (ctx.btnVerify) ctx.btnVerify.disabled = !(ctx.allItemsChecked() && bomReady);
    }

    // "Tick All" — ticks every item's Check box in one click instead of
    // clicking each row individually. Items whose category needs a Serial
    // No. (see ctx.bomItemNeedsSerial) are still held to the same rule as
    // ticking them one-by-one in ctx.handleItemFieldEdit below: they only get
    // ticked if their serials are already fully entered, otherwise they're
    // left unticked and the person is told how many still need serials.
    ctx.btnTickAll = ctx.$('bomBtnTickAll');
    if (ctx.btnTickAll) {
      ctx.btnTickAll.addEventListener('click', () => {
        if (!ctx.currentKitState || !ctx.currentKitState.length) {
          window.openModal('Select a Kit', '<p>Select a BOM Kit above to load its items before ticking all.</p>');
          return;
        }
        let blocked = 0;
        ctx.currentKitState.forEach((sec) => {
          sec.items.forEach((it) => {
            const required = bomEffectiveQty(it);
            if (required === 0) {
              it.checked = true; // completed / dispatched
              return;
            }
            if (ctx.bomItemNeedsSerial(it.name)) {
              const entered = bomSplitSerials(it.serials).length;
              if (!entered || (required != null && entered !== required)) {
                blocked += 1;
                return; // leave this one unticked — same rule as a manual tick
              }
            }
            it.checked = true;
          });
        });
        ctx.rerenderItemsPreview();
        if (blocked > 0) {
          window.openModal('Some Items Skipped', `<p>${blocked} item(s) still need their Serial No. entered before they can be ticked — fill those in, then click <b>Tick All</b> again.</p>`);
        } else if (window.showToast) {
          window.showToast('All items ticked.');
        }
      });
    }

    // Real item master (Masters > Item Registration) drives the Item Name
    // dropdown once the API/DB is reachable; falls back to kit-derived names
    // otherwise (see bomLoadItemMasterNames). Load once, up front.
    await bomLoadItemMasterNames();
    await ctx.bomLoadSerialMandatoryInfo();

    // Suggest next challan no. from Admin settings when field is empty
    (async function egsSuggestChallanNo() {
      const el = ctx.$ ? ctx.$('bomChallanNo') : document.getElementById('bomChallanNo');
      if (!el || (el.value || '').trim()) return;
      try {
        const data = await window.Api.get('/auth/app-settings', { silent: true });
        const s = (data && data.settings) || {};
        const next = parseInt(s.challan_next || '1', 10) || 1;
        const pad = Math.min(10, Math.max(0, parseInt(s.challan_pad || '4', 10) || 0));
        const prefix = (s.challan_prefix || '').trim();
        const num = pad ? String(next).padStart(pad, '0') : String(next);
        el.placeholder = prefix + num;
      } catch (e) { /* ignore */ }
    })();

    await bomLoadChallanCategoryMap();
    // Kit templates ("New Kit" / "Edit Kit") — now database-backed (see
    // bom-kit-helpers.js) so a kit saved on one device shows up on every
    // device/login instead of being stuck in that browser's localStorage.
    await bomHydrateCustomKits();
    // populateKitDropdown() already ran once inside createBomKitBuilderModule's
    // factory call above (synchronously, at module-setup time) — at that
    // point bomCustomKitsCache was still empty because this hydrate call
    // hadn't resolved yet, so the dropdown was built from an empty
    // catalogue. Re-run it now that the real server-backed kit list has
    // loaded, or every saved kit stays invisible in the dropdown until some
    // other action (e.g. saving a new kit) happens to call this again.
    ctx.populateKitDropdown();

    ctx.btnDeleteKit = ctx.$('bomBtnDeleteKit');
    ctx.btnEditKit = ctx.$('bomBtnEditKit');

    // Both Edit and Delete only make sense for a saved custom template
    // (built-in kits don't exist anymore per BOM_KITS being empty, but the
    // bomIsCustomKitKey guard is kept so this stays correct either way),
    // and — same as "New Kit" — restructuring a kit template is an
    // Admin/SuperAdmin-only action.
    function getHeaderValues() {
      return {
        customerName: ctx.$('bomCustomerName').value,
        orderNo: ctx.$('bomOrderNo').value,
        installerName: ctx.$('bomInstallerName').value,
        challanNo: ctx.$('bomChallanNo').value,
        challanDate: ctx.$('bomChallanDate').value,
        fabricatorName: ctx.$('bomFabricatorName').value,
        dealerName: ctx.$('bomDealerName').value,
      };
    }

    if (ctx.btnVerify) {
      ctx.btnVerify.addEventListener('click', async () => {
        if (!ctx.currentKitState) {
          window.openModal('Select a Kit', '<p>Please select a BOM Kit before verifying.</p>');
          return;
        }
        if (!ctx.allItemsChecked()) {
          window.openModal('Tick Every Item', '<p>Please tick every item in the <b>Check</b> column before verifying.</p>');
          return;
        }

        // Rule: BOM must be generated first (creates the tracked bom_orders
        // row). Continue-Dispatch already has one; new entry must click
        // Generate BOM (or we detect an existing order by Order No.).
        const orderNoEl = ctx.$('bomOrderNo');
        const orderNo = orderNoEl ? String(orderNoEl.value || '').trim() : '';
        const alreadyGenerated = !!(ctx.bomInlineContinueOrderId || ctx.bomGeneratedForCurrentOrder);
        if (!alreadyGenerated) {
          if (!orderNo) {
            if (window.showWarning) window.showWarning('Generate BOM First', 'Please enter an <b>Order No.</b> and click <b>Generate BOM</b> before verifying.');
            else window.openModal('Generate BOM First', '<p>Please enter an <b>Order No.</b> and click <b>Generate BOM</b> before verifying.</p>');
            return;
          }
          // Soft check against server — if this Order No. already exists as
          // a bom_order, treat it as generated and unlock for this session.
          try {
            const existing = await window.Api.get(`/bom/orders/by-order-no/${encodeURIComponent(orderNo)}`, { silent: true });
            if (existing && existing.id) {
              ctx.bomGeneratedForCurrentOrder = true;
            } else {
              if (window.showWarning) window.showWarning('Generate BOM First', 'A BOM has not been generated for this Order No. yet. Click <b>Generate BOM</b> first.');
              else window.openModal('Generate BOM First', '<p>A BOM has not been generated for this Order No. yet. Click <b>Generate BOM</b> first.</p>');
              return;
            }
          } catch (e) {
            if (window.showWarning) window.showWarning('Generate BOM First', 'A BOM has not been generated for this Order No. yet. Click <b>Generate BOM</b> first.');
            else window.openModal('Generate BOM First', '<p>A BOM has not been generated for this Order No. yet. Click <b>Generate BOM</b> first.</p>');
            return;
          }
        }

        // High-Tech Psychological Verification Micro-Interaction (< 1.2s total)
        const verifyResult = await bomPerformAnimatedVerification();
        if (!verifyResult || !verifyResult.success) {
          ctx.updateVerifyButtonState();
          return;
        }

        ctx.setVerified(true);
        ctx.updateVerifyButtonState();

        // Collect scanned serials ONLY from Solar Panel items (Inverters, Batteries, Structures, Cables excluded)
        const allSerials = [];
        const isSolarPanelOnly = (name, cat) => {
          const s = `${name || ''} ${cat || ''}`.toUpperCase().trim();
          if (!s) return false;
          const isInvOrOther = s.includes('INVERTER') || s.includes('DEYE') || s.includes('GROWATT') || s.includes('POLYCAB') || s.includes('SOLIS') || s.includes('HAVELLS') || s.includes('STRUCTURE') || s.includes('WIRE') || s.includes('CABLE') || s.includes('ACDB') || s.includes('DCDB') || s.includes('BATTERY') || s.includes('EARTHING');
          if (isInvOrOther) return false;
          const isPanel = s.includes('PANEL') || s.includes('MODULE') || s.includes('DCR') || s.includes('SOLAR') || s.includes('ADANI') || s.includes('WAAREE') || s.includes('VIKRAM') || s.includes('GOLDI') || s.includes('RENEW') || s.includes('RAYZON') || s.includes('TATA');
          return isPanel;
        };

        // 1. Check current kit state sections (Solar Panels only)
        const kitSections = Array.isArray(ctx.currentKitState)
          ? ctx.currentKitState
          : (ctx.currentKitState && Array.isArray(ctx.currentKitState.sections) ? ctx.currentKitState.sections : []);

        for (const sec of kitSections) {
          for (const it of (sec.items || [])) {
            if (!isSolarPanelOnly(it.name, sec.title || it.category || sec.name)) continue;
            if (it && it.serials) {
              const list = typeof bomSplitSerials === 'function'
                ? bomSplitSerials(it.serials)
                : (Array.isArray(it.serials) ? it.serials : String(it.serials).split(/[\r\n,;]+/));
              list.forEach((s) => {
                const trimmed = String(s || '').trim();
                if (trimmed && !allSerials.includes(trimmed)) allSerials.push(trimmed);
              });
            }
          }
        }

        // 2. Also check items from bomCollectItemsForStockCheck
        if (typeof ctx.bomCollectItemsForStockCheck === 'function') {
          const collected = ctx.bomCollectItemsForStockCheck();
          (collected || []).forEach((it) => {
            if (isSolarPanelOnly(it.name, it.category || '')) {
              (it.serials || []).forEach((s) => {
                const trimmed = String(s || '').trim();
                if (trimmed && !allSerials.includes(trimmed)) allSerials.push(trimmed);
              });
            }
          });
        }

        // 3. Check Continue Order items if active (Solar Panels only)
        if (ctx.currentContinueOrder && Array.isArray(ctx.currentContinueOrder.items)) {
          for (const it of ctx.currentContinueOrder.items) {
            if (!isSolarPanelOnly(it.item_name || it.name, it.category)) continue;
            if (it && it.serials) {
              const list = typeof bomSplitSerials === 'function'
                ? bomSplitSerials(it.serials)
                : (Array.isArray(it.serials) ? it.serials : String(it.serials).split(/[\r\n,;]+/));
              list.forEach((s) => {
                const trimmed = String(s || '').trim();
                if (trimmed && !allSerials.includes(trimmed)) allSerials.push(trimmed);
              });
            }
          }
        }

        // 4. Also check any active panel serial textareas on screen
        document.querySelectorAll('textarea[data-cont-kind="serial"]').forEach((box) => {
          const itemName = String(box.getAttribute('data-cont-name') || '').trim();
          const itemCat = String(box.getAttribute('data-cont-cat') || '').trim();
          if (!isSolarPanelOnly(itemName, itemCat)) return;

          const list = typeof bomSplitSerials === 'function'
            ? bomSplitSerials(box.value || '')
            : String(box.value || '').split(/[\r\n,;]+/);
          list.forEach((s) => {
            const trimmed = String(s || '').trim();
            if (trimmed && !allSerials.includes(trimmed)) allSerials.push(trimmed);
          });
        });

        const custName = (ctx.$('bomCustomerName') ? String(ctx.$('bomCustomerName').value || '').trim() : '')
          || (ctx.currentKitState && ctx.currentKitState.customerName)
          || (ctx.currentContinueOrder && ctx.currentContinueOrder.header && ctx.currentContinueOrder.header.customerName)
          || '';
        const headerDate = (ctx.$('bomChallanDate') ? ctx.$('bomChallanDate').value : '')
          || (ctx.currentContinueOrder && ctx.currentContinueOrder.header && ctx.currentContinueOrder.header.challanDate)
          || new Date().toISOString();

        if (allSerials.length > 0) {
          if (typeof window.saveSerialExcelDirectly === 'function') {
            console.log('[BOM Verify] Saving Solar Panel serials to NAS Excel:', allSerials.length, 'serials for order:', orderNo || 'BOM');
            window.saveSerialExcelDirectly({
              orderNo: orderNo || (ctx.currentContinueOrder && ctx.currentContinueOrder.orderNo) || 'BOM',
              customerName: custName,
              shortName: custName || orderNo,
              date: headerDate,
              serials: allSerials
            });
          }
        }

        if (window.showToast) window.showToast('✔ BOM Verified — Create Dispatch & Challan are now unlocked!', 'success');
      });
    }

    async function bomPerformAnimatedVerification() {
      const modalId = 'bomVerifyProgressModal';
      let existingOverlay = document.getElementById(modalId);
      if (existingOverlay) existingOverlay.remove();

      const overlay = document.createElement('div');
      overlay.id = modalId;
      overlay.className = 'modal-overlay show';
      overlay.style.zIndex = '99999';
      overlay.style.backdropFilter = 'blur(6px)';

      overlay.innerHTML = `
        <div class="bom-verify-modal-box" onclick="event.stopPropagation()">
          <div class="bom-verify-scanner" id="bomVerifyScannerWrap">
            <div class="bom-verify-pulse"></div>
            <div class="bom-verify-ring"></div>
            <i class="fa-solid fa-bolt bom-verify-icon" id="bomVerifyIcon"></i>
          </div>
          <h3 id="bomVerifyTitle" style="margin:8px 0 4px; font-size:17.5px; font-weight:800; color:#ffffff; letter-spacing:0.3px;">Verifying BOM Items</h3>
          <p id="bomVerifyStatus" style="font-size:12.5px; color:var(--txt-muted); margin:0 0 10px; min-height:20px; transition:all .2s ease;">🔍 Scanning BOM Items &amp; Categories...</p>
          <div class="bom-verify-pbar">
            <div class="bom-verify-pbar-fill" id="bomVerifyPbarFill" style="width:25%;"></div>
          </div>
          <div id="bomVerifyIssuesWrap" style="display:none; text-align:left; max-height:190px; overflow-y:auto; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:10px; padding:10px 14px; margin:14px 0 10px;"></div>
          <div id="bomVerifyFooter" style="display:none; margin-top:14px;">
            <button type="button" class="btn btn-ghost" id="bomVerifyCloseBtn" style="width:100%; justify-content:center;">Close &amp; Correct Items</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const scannerWrap = overlay.querySelector('#bomVerifyScannerWrap');
      const iconEl = overlay.querySelector('#bomVerifyIcon');
      const titleEl = overlay.querySelector('#bomVerifyTitle');
      const statusEl = overlay.querySelector('#bomVerifyStatus');
      const pbarFill = overlay.querySelector('#bomVerifyPbarFill');
      const issuesWrap = overlay.querySelector('#bomVerifyIssuesWrap');
      const footerEl = overlay.querySelector('#bomVerifyFooter');
      const closeBtn = overlay.querySelector('#bomVerifyCloseBtn');

      if (closeBtn) closeBtn.addEventListener('click', () => { overlay.remove(); });

      // Instant API Stock Check
      const items = ctx.bomCollectItemsForStockCheck();
      let result = null;
      let checkError = null;

      try {
        result = await window.Api.post('/bom/check-stock', { items });
      } catch (e) {
        checkError = (e && e.message) || 'Server connection error';
      }

      const isSuccess = !checkError && result && result.canDispatch;

      if (isSuccess) {
        // SUCCESS STATE — Instant feedback
        scannerWrap.innerHTML = '<i class="fa-solid fa-circle-check bom-pop-in" style="font-size:52px; color:#22c55e; filter:drop-shadow(0 0 12px rgba(34,197,94,0.4));"></i>';
        titleEl.style.color = '#22c55e';
        titleEl.innerHTML = 'VERIFIED SUCCESSFULLY!';
        statusEl.innerHTML = '<span style="color:var(--txt); font-weight:600;">All serial numbers &amp; stock quantities verified.</span><br><span style="color:var(--green); font-weight:700; font-size:11.5px;">✔ BOM Unlocked for Dispatch &amp; Challan</span>';
        if (pbarFill) {
          pbarFill.style.width = '100%';
          pbarFill.style.background = '#22c55e';
        }

        // Brief 250ms visual confirmation before continuing
        await new Promise((r) => setTimeout(r, 250));
        overlay.classList.remove('show');
        overlay.remove();
        return { success: true };
      } else {
        // FAILED STATE
        scannerWrap.innerHTML = '<i class="fa-solid fa-circle-xmark bom-pop-in" style="font-size:52px; color:#ef4444; filter:drop-shadow(0 0 12px rgba(239,68,68,0.4));"></i>';
        titleEl.style.color = '#ef4444';
        titleEl.innerHTML = 'VERIFICATION BLOCKED';
        statusEl.innerHTML = '<span style="color:#fca5a5;">The following issue(s) were found in database:</span>';
        if (pbarFill) {
          pbarFill.style.width = '100%';
          pbarFill.style.background = '#ef4444';
        }

        const failedRows = (result && result.items ? result.items : []).filter((r) => !r.ok);
        let issuesHtml = '<ul style="margin:0; padding-left:18px; font-size:12px; line-height:1.5;">';
        if (checkError) {
          issuesHtml += `<li style="color:#fca5a5;"><b>Error:</b> ${ctx.bomEsc ? ctx.bomEsc(checkError) : checkError}</li>`;
        } else if (failedRows.length) {
          failedRows.forEach((r) => {
            issuesHtml += `<li style="margin-bottom:6px; color:#fca5a5;"><b style="color:#fff;">${r.name || 'Item'}</b>: ${r.reason || 'Stock shortage'}</li>`;
          });
        } else {
          issuesHtml += `<li style="color:#fca5a5;">Unknown verification failure.</li>`;
        }
        issuesHtml += '</ul>';

        issuesWrap.innerHTML = issuesHtml;
        issuesWrap.style.display = 'block';
        footerEl.style.display = 'block';
        return { success: false };
      }
    }

    // Flattens ctx.currentKitState's sections into the flat { name, qty, serials }
    // list /api/bom/check-stock (and /api/bom/dispatch) expects. `qty` here
    // is bomEffectiveQty() — the User's partial Dispatch Qty when set,
    // otherwise Admin's full Quantity — so a partial dispatch only ever
    // checks/deducts the amount actually being sent right now, not the
    // BOM's full original allocation.
    function computeAndApplyFitZoom() {
      const sheet = ctx.$('bomSheet');
      if (!sheet || !ctx.printRoot) return;
      sheet.style.transform = '';
      sheet.style.width = '850px'; // arbitrary baseline just to measure natural height
      sheet.style.zoom = 1; // measure the sheet's true, un-scaled height first
      ctx.printRoot.classList.add('bom-measuring');
      const naturalHeightPx = sheet.getBoundingClientRect().height;
      ctx.printRoot.classList.remove('bom-measuring');
      if (!naturalHeightPx) return; // nothing rendered yet — nothing to scale

      const PX_PER_MM = 96 / 25.4;
      const A4_HEIGHT_MM = 297;
      const MARGIN_TB_MM = 14;
      const A4_WIDTH_MM = 210;
      const MARGIN_LR_MM = 10;

      // Excel reference: 53-54 items fit on 1 single page with balanced top & bottom margins (14mm).
      // Scale calibrated to match Excel's 77% scale so up to 54 rows fit on Page 1; >54 rows flow to Page 2.
      const usableHeightPx = (A4_HEIGHT_MM - MARGIN_TB_MM * 2) * PX_PER_MM;
      const naturalScale = usableHeightPx / naturalHeightPx;
      const vScale = Math.min(1, Math.max(0.76, naturalScale));

      const usableWidthPx = (A4_WIDTH_MM - MARGIN_LR_MM * 2) * PX_PER_MM;
      const baseWidthPx = usableWidthPx / vScale;

      const supportsZoom = window.CSS && CSS.supports && CSS.supports('zoom', '1');
      if (supportsZoom) {
        sheet.style.width = baseWidthPx + 'px';
        sheet.style.zoom = vScale;
      } else {
        sheet.style.zoom = '';
        sheet.style.width = '850px';
        sheet.style.transform = `scale(${usableWidthPx / 850}, ${vScale})`;
      }
    }

    if (window.__bomBeforePrintHandler) {
      window.removeEventListener('beforeprint', window.__bomBeforePrintHandler);
    }
    window.__bomBeforePrintHandler = ctx.computeAndApplyFitZoom;
    window.addEventListener('beforeprint', ctx.computeAndApplyFitZoom);

    if (ctx.btnPrint) {
      ctx.btnPrint.addEventListener('click', () => {
        if (!ctx.currentKitState) {
          window.openModal('Select a Kit', '<p>Please select a BOM Kit before printing.</p>');
          return;
        }
        const kw = bomGetAllKits()[ctx.kitSelect.value].kw;
        if (typeof window.bomPrintKitDirectly === 'function') {
          window.bomPrintKitDirectly({ kw, sections: ctx.currentKitState }, ctx.getHeaderValues());
        } else {
          ctx.printRoot.innerHTML = bomRenderPrintSheetHtml({ kw, sections: ctx.currentKitState }, ctx.getHeaderValues());
          bomSetPrintPageSize('size:A4 portrait; margin:14mm 10mm;');
          ctx.computeAndApplyFitZoom();
          window.print();
        }
      });
    }

    // Register active workspace cleanup
    window.__activeScreenCleanup = () => {
      if (window.__bomBeforePrintHandler) {
        window.removeEventListener('beforeprint', window.__bomBeforePrintHandler);
        window.__bomBeforePrintHandler = null;
      }
    };

    // Fast workspace action router
    if (opts.action === 'create' || opts.tab === 'create') {
      if (!ctx.bomIsAdmin) {
        if (window.showToast) window.showToast('ℹ️ Standard Users can dispatch and process existing BOM orders.', 'info');
        ctx.showBomHome();
      } else {
        ctx.showBomEntryForNewKit();
      }
    } else if (opts.action === 'dispatch' || opts.action === 'pending' || opts.tab === 'dispatch') {
      ctx.showBomHome();
    } else if (opts.action === 'track' || opts.tab === 'track') {
      ctx.showBomHome();
      if (typeof ctx.openTrackModal === 'function') ctx.openTrackModal();
    } else if (opts.action === 'register' || opts.tab === 'register') {
      ctx.showBomHome();
      if (typeof ctx.openBomRegisterModal === 'function') ctx.openBomRegisterModal();
    } else if (opts.action === 'challan' || opts.tab === 'challan') {
      ctx.showBomHome();
      if (typeof window.openChallanRegisterModal === 'function') window.openChallanRegisterModal();
    } else if (opts.action === 'custom-challan' || opts.tab === 'custom-challan') {
      ctx.showBomHome();
      if (typeof window.openCustomChallanModal === 'function') window.openCustomChallanModal();
    } else {
      if (ctx.bomIsAdmin) {
        ctx.showBomEntryForNewKit();
      } else {
        ctx.showBomHome();
      }
    }
  },
};