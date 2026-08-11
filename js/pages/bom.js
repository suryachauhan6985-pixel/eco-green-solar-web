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
    <div id="bomHomeView">
      <div class="page-head"><i class="fa-solid fa-list-check" style="color:var(--gold);"></i><h2>Bill of Material (BOM)</h2></div>
      <div class="panel">
        <h3><i class="fa-solid fa-box-open"></i> BOM</h3>
        <p class="note" style="margin-bottom:12px;">
          <i class="fa-solid fa-circle-info"></i> Start a new BOM, track any Order No.'s dispatch progress, or open the full register.
        </p>
        <div class="actions-row">
          <button type="button" class="btn btn-green" id="bomHomeBtnCreate"><i class="fa-solid fa-plus-circle"></i> Create BOM</button>
          <button type="button" class="btn btn-ghost" id="bomHomeBtnTrack"><i class="fa-solid fa-route"></i> Track BOM</button>
          <button type="button" class="btn btn-ghost" id="bomHomeBtnRegister"><i class="fa-solid fa-clipboard-list"></i> BOM Register</button>
          <button type="button" class="btn btn-ghost" id="bomHomeBtnChallanMap" style="display:none;" title="Decide which BOM item folds into which Challan line"><i class="fa-solid fa-sitemap"></i> Challan Category Mapping</button>
        </div>
      </div>
      <div class="panel">
        <h3 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <span><i class="fa-solid fa-hourglass-half"></i> Pending BOM Orders <span style="font-weight:400;color:var(--txt-muted);font-size:11.5px;">(double-click a row to open it)</span></span>
          <button type="button" class="btn btn-ghost bom-mini-btn" id="bomHomeBtnRefresh"><i class="fa-solid fa-rotate"></i> Refresh</button>
        </h3>
        <div id="bomHomePendingWrap"><p class="note"><i class="fa-solid fa-spinner fa-spin"></i> Loading pending BOM orders...</p></div>
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
      <button type="button" class="btn btn-ghost" id="bomBtnBackHome"><i class="fa-solid fa-arrow-left"></i> Back to BOM Home</button>
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

        <div class="field"><label>Challan No.</label><input id="bomChallanNo" placeholder="Challan no."></div>
        <div class="field"><label>Ch. Date</label><input id="bomChallanDate" type="date"></div>
      </div>
      <div class="actions-row">
        <button class="btn btn-ghost" type="button" id="bomBtnPrint"><i class="fa-solid fa-print"></i> Print BOM (Excel format, 1 page)</button>
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

    <p class="note" style="margin-top:10px;">
      Yeh abhi front-end preview hai — direct BOM-kit dispatch aur ek dispatch mein saare items ek saath stock se
      deduct karne wala workflow, tumhara pura process samjhaane ke baad wire kiya jayega.
    </p>

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
          <h3><i class="fa-solid fa-clipboard-list"></i> Pending BOM Register</h3>
          <button class="modal-close" id="bomRegisterCloseBtn"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body" id="bomRegisterModalBody"></div>
      </div>
    </div>
  `,

  async init() {
    const ctx = {};
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
    ctx.$ = (id) => document.getElementById(id);
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
    ctx.kitSelect = ctx.$('bomKitSelect');
    ctx.itemsPreview = ctx.$('bomItemsPreview');
    ctx.kitItemsPanel = ctx.$('bomKitItemsPanel');
    ctx.btnPrint = ctx.$('bomBtnPrint');
    ctx.printRoot = ctx.$('bomPrintRoot');
    ctx.challanPrintRoot = ctx.$('bomChallanPrintRoot');
    ctx.challanOverlay = ctx.$('bomChallanOverlay');
    ctx.challanModalBody = ctx.$('bomChallanModalBody');
    ctx.challanCloseBtn = ctx.$('bomChallanCloseBtn');

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

    function showBomHome() {
      ctx.bomInlineContinueOrderId = null;
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
      if (ctx.continuePanel) ctx.continuePanel.style.display = 'none';
      if (ctx.newEntryPanel) ctx.newEntryPanel.style.display = '';
      const kip = ctx.$('bomKitItemsPanel');
      if (kip) kip.style.display = '';
      ctx.showBomEntry();
    }
    if (ctx.btnBackHome) ctx.btnBackHome.addEventListener('click', ctx.showBomHome);

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
        <table style="width:100%; border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border, #ddd);">Order No</th>
            <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border, #ddd);">Customer</th>
            <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border, #ddd);">Pending</th>
            <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border, #ddd);">Started</th>
            <th style="border-bottom:2px solid var(--border, #ddd);"></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    async function bomLoadHomePendingTable() {
      const wrap = ctx.$('bomHomePendingWrap');
      if (!wrap) return;
      wrap.innerHTML = '<p class="note"><i class="fa-solid fa-spinner fa-spin"></i> Loading pending BOM orders...</p>';
      let orders;
      try {
        orders = await window.Api.get('/bom/orders?status=Open', { silent: true });
      } catch (e) {
        wrap.innerHTML = `<p class="note" style="color:var(--red);">Could not load pending BOM orders — ${bomEsc((e && e.message) || 'server error')}.</p>`;
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
    ctx.homeBtnRegister = ctx.$('bomHomeBtnRegister');
    ctx.homeBtnRefresh = ctx.$('bomHomeBtnRefresh');
    if (ctx.homeBtnCreate) {
      ctx.homeBtnCreate.addEventListener('click', () => {
        ctx.showBomEntryForNewKit();
      });
    }
    if (ctx.homeBtnRefresh) ctx.homeBtnRefresh.addEventListener('click', ctx.bomLoadHomePendingTable);
    ctx.bomLoadHomePendingTable(); // initial load — BOM tab lands on the Home view

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
        window.openModal('Select a Kit', '<p>Please select a BOM Kit before generating a BOM.</p>');
        if (window.focusInvalidField) window.focusInvalidField(ctx.$('bomKitSelect'));
        return;
      }
      const header = ctx.getHeaderValues();
      const orderNo = (header.orderNo || '').trim();
      if (!orderNo) {
        window.openModal('Order No. Required', '<p>Please enter an <b>Order No.</b> before generating a BOM.</p>');
        if (window.focusInvalidField) window.focusInvalidField(ctx.$('bomOrderNo'));
        return;
      }
      if (!(header.customerName || '').trim()) {
        window.openModal('Customer Name Required', '<p>Please enter a <b>Customer Name</b> before generating a BOM.</p>');
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
        <table style="width:100%; border-collapse:collapse; margin-bottom:14px;">
          <tr><td style="padding:6px 0; color:var(--txt-muted);">Order No.</td><td style="padding:6px 0; font-weight:600;">${bomEsc(orderNo)}</td></tr>
          <tr><td style="padding:6px 0; color:var(--txt-muted);">Customer</td><td style="padding:6px 0; font-weight:600;">${bomEsc(header.customerName || '—')}</td></tr>
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
            await window.Api.post('/bom/orders', { orderNo, header, items });
          } catch (e) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalLabel;
            window.openModal('Could Not Generate BOM', `<p>${bomEsc((e && e.message) || 'Server error. Please try again.')}</p>`);
            return;
          }
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
    // BOM stays disabled until every item, in every section, is ticked.
    function allItemsChecked() {
      if (!ctx.currentKitState || !ctx.currentKitState.length) return false;
      return ctx.currentKitState.every((sec) => sec.items.length && sec.items.every((it) => it.checked));
    }
    function updateVerifyButtonState() {
      if (ctx.btnVerify) ctx.btnVerify.disabled = !ctx.allItemsChecked();
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
            if (ctx.bomItemNeedsSerial(it.name)) {
              const required = bomEffectiveQty(it);
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
    await bomLoadChallanCategoryMap();
    // Kit templates ("New Kit" / "Edit Kit") — now database-backed (see
    // bom-kit-helpers.js) so a kit saved on one device shows up on every
    // device/login instead of being stuck in that browser's localStorage.
    await bomHydrateCustomKits();

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

        // Real stock check now happens HERE (moved off Convert into
        // Challan) — checks whether Dispatch Qty for every item is
        // actually available right now. Convert into Challan and Create
        // Dispatch both stay locked until this passes.
        const originalLabel = ctx.btnVerify.innerHTML;
        ctx.btnVerify.disabled = true;
        ctx.btnVerify.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking Stock...';
        const canProceed = await ctx.bomRunStockCheck();
        ctx.btnVerify.innerHTML = originalLabel;
        ctx.updateVerifyButtonState(); // restores the normal enabled/disabled state (still gated on ctx.allItemsChecked)
        if (!canProceed) return;

        const confirmed = await window.confirmDialog(
          'Verify BOM',
          'Are you sure all items in this BOM are ready for dispatch?',
          { kind: 'warning', okLabel: 'Yes, Verified' },
        );
        if (confirmed) {
          ctx.setVerified(true);
          if (window.showToast) window.showToast('BOM verified — Create Dispatch is now unlocked.');
        }
      });
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
      // Must match the @page rule in style.css: size:A4 portrait;
      // margin:19.05mm 6.35mm (top/bottom 0.75in, left/right 0.25in —
      // the workbook's real Page Setup margins).
      const A4_HEIGHT_MM = 297;
      const MARGIN_TB_MM = 19.05;
      const A4_WIDTH_MM = 210;
      const MARGIN_LR_MM = 6.35;

      // SAFETY_MARGIN_H: scaling to *exactly* fill the usable page height
      // leaves zero headroom — on a real printer (different default paper
      // size, a substitute font if Calibri isn't installed, sub-pixel
      // rounding once `zoom` is applied, etc.) the sheet could still end
      // up a few px taller than the page and spill onto a 2nd page.
      // Scaling to 96% of the usable height leaves enough slack that
      // those real-world variations can no longer push it over.
      const SAFETY_MARGIN_H = 0.96;
      const usableHeightPx = (A4_HEIGHT_MM - MARGIN_TB_MM * 2) * PX_PER_MM * SAFETY_MARGIN_H;
      // Never scale UP past 1 — a short BOM (few items) should print at
      // its natural 11pt size, matching Excel, not be stretched taller.
      const vScale = Math.min(1, usableHeightPx / naturalHeightPx);

      // SAFETY_MARGIN_W: a small 1% margin so sub-pixel rounding never
      // pushes the sheet a hair past the printable width.
      const SAFETY_MARGIN_W = 0.99;
      const usableWidthPx = (A4_WIDTH_MM - MARGIN_LR_MM * 2) * PX_PER_MM * SAFETY_MARGIN_W;
      // Base width chosen so that AFTER the zoom below shrinks it by
      // vScale, the sheet's final on-page width lands exactly at
      // usableWidthPx — i.e. fills the page edge-to-edge instead of
      // leaving blank strips down both sides.
      const baseWidthPx = usableWidthPx / vScale;

      const supportsZoom = window.CSS && CSS.supports && CSS.supports('zoom', '1');
      if (supportsZoom) {
        sheet.style.width = baseWidthPx + 'px';
        sheet.style.zoom = vScale;
      } else {
        // Fallback for browsers without CSS `zoom`: transform doesn't
        // reflow, so set the final on-page size directly instead of a
        // base-width-then-shrink two-step.
        sheet.style.zoom = '';
        sheet.style.width = '850px';
        sheet.style.transform = `scale(${usableWidthPx / 850}, ${vScale})`;
      }
    }

    // Kept as a defensive backup in case anything (e.g. Ctrl+P on a stale
    // sheet) triggers printing without going through the Print button
    // below — harmless to re-run since it's idempotent (re-measuring after
    // it has already run just recomputes the same scale).
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
        ctx.printRoot.innerHTML = bomRenderPrintSheetHtml({ kw, sections: ctx.currentKitState }, ctx.getHeaderValues());
        bomSetPrintPageSize('size:A4 portrait; margin:19.05mm 6.35mm;');
        // Measure and apply the fit-to-one-page zoom BEFORE window.print()
        // is called — this is the actual fix (see the long comment above):
        // don't wait for 'beforeprint', do it right here, synchronously.
        ctx.computeAndApplyFitZoom();
        window.print();
      });
    }

    // ---------- Challan print: no runtime scaling ----------
    // CHALLAN_SPEC.md §1/§15: the source sheet prints at a fixed, manual
    // 96% scale (NOT "fit to page"), and its 28-row body is a fixed height
    // by design — there is nothing here to measure. The @page size/margin
    // is set once above (bomSetPrintPageSize, in the Print Challan click
    // handler); the 96% scale and every column/row dimension live as
    // static rules in bom.css. Unlike the BOM kit sheet above (a genuinely
    // variable-length list that has to be measured and fitted every time),
    // the Challan sheet never needs a beforeprint handler at all.
  },
};