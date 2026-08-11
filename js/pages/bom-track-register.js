// js/pages/bom-track-register.js
// -----------------------------------------------------------------------------
// Split out of js/pages/bom.js (pure code-organization refactor, no logic
// changes) per refactor-bom-prompt.md. Contains the "Track BOM" modal
// (openRegisterModal/closeRegisterModal share the Pending BOM Register's
// overlay helpers too) and the order-status lookup used by it
// (bomTrackStatusPill, bomFmtDateTime, bomRenderTrackResultHtml,
// bomFetchAndRenderTrack, bomOpenTrackModal, bomOpenTrackForOrderNo,
// bomTrackCurrentOrder). Split off from the rest of the dispatch/register
// logic (bom-dispatch.js) purely to keep both files under the 800-line cap
// — see refactor-bom-prompt.md's note that it's fine to end up with 5 files
// instead of 4. Must load AFTER bom-kit-helpers.js/bom-challan.js and
// BEFORE bom.js, which calls createBomTrackRegisterModule(ctx) from inside
// init().
// -----------------------------------------------------------------------------
function createBomTrackRegisterModule(ctx) {
    function openRegisterModal(bodyHtml) {
      if (!ctx.registerOverlay || !ctx.registerModalBody) return;
      ctx.registerModalBody.innerHTML = bodyHtml;
      ctx.registerOverlay.classList.add('show');
      document.body.classList.add('no-scroll');
    }
    function closeRegisterModal() {
      if (!ctx.registerOverlay) return;
      ctx.registerOverlay.classList.remove('show');
      document.body.classList.remove('no-scroll');
    }
    // Bare local function, not ctx.closeRegisterModal — see the matching
    // comment in bom-challan-map.js; ctx.closeRegisterModal isn't assigned
    // yet at this point in the factory, so referencing it here would bind
    // the click permanently to `undefined`.
    if (ctx.registerCloseBtn) ctx.registerCloseBtn.addEventListener('click', closeRegisterModal);
    if (ctx.registerOverlay) {
      ctx.registerOverlay.addEventListener('click', (e) => {
        if (e.target === ctx.registerOverlay) ctx.closeRegisterModal(); // backdrop click only
      });
    }

    // Row/section add-delete (Add Item, Remove Item, Add Section, Remove
    // Section) is an Admin/SuperAdmin-only action — a plain User can still
    // edit every field (name/model/qty/serial/remarks) and tick items, but
    // cannot restructure the kit. Computed early so it's available to the
    // very first render below (bomRenderScreenItemsHtml reads it via opts).
    ctx.bomCurrentRole = window.currentUserRole || 'User';
    ctx.bomIsAdmin = ctx.bomCurrentRole === 'SuperAdmin' || ctx.bomCurrentRole === 'Admin';

    // ---------------- BOM: Create BOM + Track BOM — now REAL, wired to
    // POST /api/bom/orders and GET /api/bom/orders/by-order-no/:orderNo. ----
    // Create BOM (Admin/SuperAdmin only) captures the kit's full baseline
    // (every item's full Quantity) as a bom_orders row up front, before any
    // dispatch trip — it then shows up in BOM Home / BOM Register as
    // "Pending" and flips to "Partially Dispatched"/"Dispatched" on its own
    // as real dispatch trips go out (status is derived from dispatched vs
    // total each time it's read — see ctx.bomOverallStatusFromItems above and
    // the server's matching helper in bom.routes.js, no separate DB status
    // needed). Track BOM (visible to everyone) is the read-only counterpart:
    // look up any Order No. and see its real status + per-item breakdown +
    // full dispatch-trip history.
    ctx.btnCreateBom = ctx.$('bomBtnCreateBom');
    ctx.btnTrackBom = ctx.$('bomBtnTrackBom');
    if (ctx.btnCreateBom) ctx.btnCreateBom.style.display = ctx.bomIsAdmin ? '' : 'none';

    function bomTrackStatusPill(status) {
      const map = {
        Pending: { color: '#a15c00', bg: '#fff3da' },
        'Partially Dispatched': { color: '#0b5ea8', bg: '#e4f1ff' },
        Dispatched: { color: '#1a7f37', bg: '#e6f7ea' },
      };
      const c = map[status] || map.Pending;
      return `<span style="display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; color:${c.color}; background:${c.bg};">${bomEsc(status)}</span>`;
    }

    function bomFmtDateTime(v) {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return d.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    }

    // Renders the real per-item breakdown + trip-by-trip dispatch history
    // returned by GET /api/bom/orders/by-order-no/:orderNo. `data.trips` is
    // ordered oldest-first, so each trip is one visual "step" — a genuine
    // timeline built from bom_dispatches rows, not a sample/mock one.
    function bomRenderTrackResultHtml(data) {
      const itemRows = (data.items || []).map((it) => `
        <tr>
          <td style="padding:6px 8px; border-bottom:1px solid var(--border, #eee);">${bomEsc(it.name)}</td>
          <td style="padding:6px 8px; border-bottom:1px solid var(--border, #eee); text-align:center;">${it.total}</td>
          <td style="padding:6px 8px; border-bottom:1px solid var(--border, #eee); text-align:center;">${it.dispatched}</td>
          <td style="padding:6px 8px; border-bottom:1px solid var(--border, #eee); text-align:center; color:${it.remaining > 0 ? 'var(--red, #c0392b)' : 'var(--green, #1a7f37)'};">${it.remaining}</td>
        </tr>
      `).join('');

      const trips = data.trips || [];
      const tripSteps = trips.length
        ? trips.map((t, idx) => {
            const isLast = idx === trips.length - 1;
            const itemsLine = (t.items || []).map((it) => `${bomEsc(it.name)} &times; ${it.qty}`).join(', ') || '—';
            return `
              <div style="display:flex; gap:12px;">
                <div style="display:flex; flex-direction:column; align-items:center;">
                  <div style="width:26px; height:26px; border-radius:50%; background:#1a7f37; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; flex-shrink:0;">
                    <i class="fa-solid fa-truck"></i>
                  </div>
                  ${!isLast ? `<div style="width:2px; flex:1; background:#1a7f37; min-height:26px;"></div>` : ''}
                </div>
                <div style="padding-bottom:20px;">
                  <div style="font-weight:600; font-size:13.5px;">Trip ${idx + 1} <span style="font-weight:400; color:var(--txt-muted); font-size:11.5px;">(${bomEsc(t.dispatchedBy || 'Unknown user')})</span></div>
                  <div style="font-size:12px; color:var(--txt-muted); margin-top:2px;">${bomEsc(itemsLine)}</div>
                  <div style="font-size:11px; color:var(--txt-muted); margin-top:2px;">${bomEsc(ctx.bomFmtDateTime(t.dispatchedAt))}</div>
                </div>
              </div>
            `;
          }).join('')
        : `<p class="note"><i class="fa-solid fa-circle-info"></i> No dispatch trips yet — this BOM is created but nothing has gone out.</p>`;

      return `
        <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="font-weight:700; font-size:15px;">Order No <span style="color:var(--gold, #b8860b);">${bomEsc(data.orderNo)}</span></div>
            <div style="font-size:12px; color:var(--txt-muted); margin-top:2px;">${bomEsc((data.header && data.header.customerName) || '')}</div>
            <div style="margin-top:6px;">${ctx.bomTrackStatusPill(data.status)}</div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
          <thead><tr>
            <th style="text-align:left; padding:6px 8px; border-bottom:2px solid var(--border, #ddd);">Item</th>
            <th style="padding:6px 8px; border-bottom:2px solid var(--border, #ddd);">Total</th>
            <th style="padding:6px 8px; border-bottom:2px solid var(--border, #ddd);">Dispatched</th>
            <th style="padding:6px 8px; border-bottom:2px solid var(--border, #ddd);">Pending</th>
          </tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div style="font-weight:600; font-size:13px; margin-bottom:10px;">Dispatch Trips</div>
        <div>${tripSteps}</div>
      `;
    }

    async function bomFetchAndRenderTrack(orderNo, resultBox) {
      resultBox.innerHTML = '<p class="note"><i class="fa-solid fa-spinner fa-spin"></i> Looking up this BOM...</p>';
      try {
        const data = await window.Api.get(`/bom/orders/by-order-no/${encodeURIComponent(orderNo)}`, { silent: true });
        resultBox.innerHTML = ctx.bomRenderTrackResultHtml(data);
      } catch (e) {
        const msg = (e && e.message) || 'Could not fetch this BOM.';
        resultBox.innerHTML = `<p class="note" style="color:var(--red);">${bomEsc(msg)}</p>`;
      }
    }

    // Home screen's Track BOM — asks for an Order No. since there's no
    // "current" BOM in context there.
    function bomOpenTrackModal() {
      window.openModal('Track BOM', `
        <div class="field" style="margin-bottom:12px;">
          <label>Order No.</label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="bomTrackOrderInput" placeholder="e.g. ORD-1234" style="flex:1;">
            <button type="button" class="btn btn-blue" id="bomTrackSearchBtn"><i class="fa-solid fa-magnifying-glass"></i> Track</button>
          </div>
        </div>
        <div id="bomTrackResult"></div>
      `);
      const input = document.getElementById('bomTrackOrderInput');
      const searchBtn = document.getElementById('bomTrackSearchBtn');
      const resultBox = document.getElementById('bomTrackResult');
      function runTrack() {
        const orderNo = ((input && input.value) || '').trim();
        if (!orderNo) {
          if (resultBox) resultBox.innerHTML = '<p class="note" style="color:var(--red);">Enter an Order No. first.</p>';
          return;
        }
        ctx.bomFetchAndRenderTrack(orderNo, resultBox);
      }
      if (searchBtn) searchBtn.addEventListener('click', runTrack);
      if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') runTrack(); });
      if (input) input.focus();
    }

    // Used wherever the Order No. is already known — the BOM Entry
    // screen's own Track BOM button, and the Continue Dispatch form's
    // "Track This BOM" button — so the person never has to retype it.
    function bomOpenTrackForOrderNo(orderNo) {
      window.openModal('Track BOM', `<div id="bomTrackResult"></div>`);
      const resultBox = document.getElementById('bomTrackResult');
      if (resultBox) ctx.bomFetchAndRenderTrack(orderNo, resultBox);
    }

    // Entry screen's Track BOM: uses whichever Order No. is "current" —
    // the order being continued via BOM Home/Register, or whatever's typed
    // into the Order No. field for a fresh kit — no prompt needed.
    function bomTrackCurrentOrder() {
      const fromField = (ctx.$('bomOrderNo') && ctx.$('bomOrderNo').value.trim()) || '';
      if (!fromField) {
        window.openModal('Order No. Required', '<p>Enter an <b>Order No.</b> above first, or open an existing order from BOM Home / BOM Register.</p>');
        return;
      }
      ctx.bomOpenTrackForOrderNo(fromField);
    }

    // Create BOM — captures the currently-selected kit's FULL baseline
    // (every item's full Quantity, not a partial Dispatch Qty) as a real
    // bom_orders row, before any dispatch trip goes out.

  return { openRegisterModal, closeRegisterModal, bomTrackStatusPill, bomFmtDateTime, bomRenderTrackResultHtml, bomFetchAndRenderTrack, bomOpenTrackModal, bomOpenTrackForOrderNo, bomTrackCurrentOrder };
}
