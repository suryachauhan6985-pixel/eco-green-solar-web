// js/pages/bom-dispatch.js
// -----------------------------------------------------------------------------
// Split out of js/pages/bom.js (pure code-organization refactor, no logic
// changes) per refactor-bom-prompt.md. Contains Create Dispatch, Pending
// BOM Register list, and the Continue Dispatch inline/modal flow
// (bomCollectItemsForStockCheck, bomCollectItemsForDispatch,
// bomShowStockIssuesModal, bomRunStockCheck, bomRunDispatch,
// bomParseBlockedRows, bomRenderRegisterListHtml, bomLoadRegisterList,
// bomRenderContinueFormHtml, bomContSerialDupes, bomUpdateContSerialNote,
// bomWireContSerialTextarea, bomLoadContinueDispatchForm,
// bomOpenOrderInline). Must load AFTER bom-kit-helpers.js, bom-challan.js
// and bom-track-register.js (uses ctx.bomOpenTrackModal-family functions
// indirectly through ctx) and BEFORE bom.js, which calls
// createBomDispatchModule(ctx) from inside init().
// -----------------------------------------------------------------------------
function createBomDispatchModule(ctx) {
    function bomCollectItemsForStockCheck() {
      const out = [];
      (ctx.currentKitState || []).forEach((sec) => {
        (sec.items || []).forEach((it) => {
          out.push({
            name: it.name || '',
            qty: bomEffectiveQty(it) || 0,
            serials: bomSplitSerials(it.serials || ''),
          });
        });
      });
      return out;
    }

    // Same as ctx.bomCollectItemsForStockCheck, but for Create Dispatch only
    // (Step 3) — also carries `totalQty`, the item's full originally-
    // required Quantity (not the partial amount being sent this trip).
    // The server needs this once per Order No. to set the pending
    // baseline; check-stock (read-only, no persistence) never needs it,
    // so that collector is left untouched.
    function bomCollectItemsForDispatch() {
      const out = [];
      (ctx.currentKitState || []).forEach((sec) => {
        (sec.items || []).forEach((it) => {
          out.push({
            name: it.name || '',
            qty: bomEffectiveQty(it) || 0,
            totalQty: Number(it.qty) || bomEffectiveQty(it) || 0,
            serials: bomSplitSerials(it.serials || ''),
          });
        });
      });
      return out;
    }

    // Shared renderer for "here's exactly which item(s) failed and why" —
    // used by both Verify BOM's stock CHECK and Create Dispatch's actual
    // DEDUCTION, so the person sees the same itemized list either way.
    function bomShowStockIssuesModal(title, intro, rows) {
      const listHtml = (rows || []).map((r) => `
        <li style="margin-bottom:6px;">
          <b>${bomEsc(r.name || '(blank)')}</b>${r.category ? ` <span class="note">(${bomEsc(r.category)})</span>` : ''}
          <br><span style="color:var(--red);">${bomEsc(r.reason || 'Not available.')}</span>
        </li>
      `).join('');
      window.openModal(title, `
        <p>${intro}</p>
        <ul style="padding-left:18px; margin-top:10px;">${listHtml || '<li>Unknown error.</li>'}</ul>
      `);
    }

    // Real, read-only stock check — asks the server whether every item in
    // this BOM can actually be dispatched right now (item registered in
    // Masters? enough Available quantity for the entered Dispatch Qty?
    // entered serials real/Available/matching?) and, if not, exactly why.
    // Nothing is deducted or reserved here. Called from Verify BOM (moved
    // off Convert into Challan) — so verifying is what gates whether the
    // BOM can be dispatched/challan'd at all; the actual deduction happens
    // separately via Create Dispatch (ctx.bomRunDispatch below).
    async function bomRunStockCheck() {
      const items = ctx.bomCollectItemsForStockCheck();
      let result;
      try {
        result = await window.Api.post('/bom/check-stock', { items });
      } catch (e) {
        window.openModal('Stock Check Failed', `<p>Could not verify stock — ${bomEsc((e && e.message) || 'server error')}. Please try again.</p>`);
        return false;
      }
      if (result && result.canDispatch) return true;

      const rows = (result && result.items ? result.items : []).filter((r) => !r.ok);
      ctx.bomShowStockIssuesModal(
        'Dispatch Not Possible',
        'This BOM cannot be dispatched right now — the following item(s) failed the stock check:',
        rows
      );
      return false;
    }

    // Create Dispatch — Step 2: the REAL, transactional stock deduction.
    // Server re-checks everything (with row locks, in case stock changed
    // since Verify BOM's check) and only then deducts — serial items get
    // marked Dispatched, quantity items get FIFO-consumed from Available.
    // Nothing is deducted if any single item fails.
    async function bomRunDispatch() {
      const header = ctx.getHeaderValues();
      // Step 3: Order No. is now how the server links multiple partial
      // dispatch trips back to the same BOM (pending-qty tracking).
      // Checked here, right before the call, rather than earlier in the
      // flow — Verify BOM / stock check don't persist anything, so they
      // never needed it.
      if (!header.orderNo || !header.orderNo.trim()) {
        window.openModal('Order No. Required', '<p>Please enter an <b>Order No.</b> before creating a dispatch — it\'s how partial dispatches for this BOM get tracked together.</p>');
        if (window.focusInvalidField) window.focusInvalidField(ctx.$('bomOrderNo'));
        return false;
      }
      if (!header.customerName || !header.customerName.trim()) {
        window.openModal('Customer Name Required', '<p>Please enter a <b>Customer Name</b> before creating a dispatch.</p>');
        if (window.focusInvalidField) window.focusInvalidField(ctx.$('bomCustomerName'));
        return false;
      }
      const items = ctx.bomCollectItemsForDispatch();
      let result;
      try {
        result = await window.Api.post('/bom/dispatch', { orderNo: header.orderNo, header, items });
      } catch (e) {
        const msg = (e && e.message) || '';
        // Server sends "DISPATCH BLOCKED:\n<item>: <reason>\n..." as the
        // error message on a failed dispatch (mirrors Sales dispatch's own
        // convention) — split it back into rows for the same itemized
        // modal Convert into Challan uses, instead of one wall of text.
        if (msg.startsWith('DISPATCH BLOCKED')) {
          const rows = msg.split('\n').slice(1).map((line) => {
            const idx = line.indexOf(': ');
            return idx === -1 ? { name: line, reason: '' } : { name: line.slice(0, idx), reason: line.slice(idx + 2) };
          });
          ctx.bomShowStockIssuesModal('Dispatch Not Possible', 'This BOM could not be dispatched — the following item(s) failed the stock check:', rows);
        } else {
          window.openModal('Dispatch Failed', `<p>${bomEsc(msg || 'Could not dispatch this BOM. Please try again.')}</p>`);
        }
        return false;
      }
      return result;
    }

    // ------------------------------------------------------------------
    // Step 4: Pending BOM Register — list every Open bom_orders row
    // (server-computed remaining-per-item) and let a partial order be
    // continued from ANY session, not just the one that started it,
    // without re-picking the kit or retyping what already went out.
    // Deliberately its own small form (not a reload into ctx.currentKitState/
    // the multi-section kit editor) — bom_orders only ever stored a flat
    // { itemName: totalQty } baseline (see Step 3), it never captured
    // section layout, so there's nothing to rebuild a full kit screen
    // from. This form only needs name/category/remaining per item, which
    // GET /api/bom/orders/:id provides directly.
    // ------------------------------------------------------------------

    // Same "DISPATCH BLOCKED:\n<item>: <reason>\n..." convention the
    // server uses everywhere else — shared parsing so this modal shows
    // the same itemized failure list ctx.bomRunDispatch's own errors do.
    function bomParseBlockedRows(msg) {
      return String(msg || '').split('\n').slice(1).map((line) => {
        const idx = line.indexOf(': ');
        return idx === -1 ? { name: line, reason: '' } : { name: line.slice(0, idx), reason: line.slice(idx + 2) };
      });
    }

    function bomRenderRegisterListHtml(orders) {
      if (!orders || !orders.length) {
        return `<p class="note" style="padding:20px 0;"><i class="fa-solid fa-circle-check" style="color:var(--green);"></i> Nothing pending — every BOM order has been fully dispatched.</p>`;
      }
      const rows = orders.map((o) => `
        <tr>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);">${bomEsc(o.orderNo)}</td>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);">${bomEsc((o.header && o.header.customerName) || '-')}</td>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);">${o.pendingItemCount} item(s) / ${o.pendingQty} unit(s) pending</td>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);">${bomEsc((o.createdAt || '').slice(0, 10))}</td>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);"><button type="button" class="btn btn-blue bom-mini-btn" data-bom-order-id="${o.id}"><i class="fa-solid fa-truck"></i> Continue Dispatch</button></td>
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

    async function bomLoadRegisterList() {
      ctx.openRegisterModal('<p class="note"><i class="fa-solid fa-spinner fa-spin"></i> Loading pending BOM orders...</p>');
      let orders;
      try {
        orders = await window.Api.get('/bom/orders?status=Open');
      } catch (e) {
        ctx.openRegisterModal(`<p class="note" style="color:var(--red);">Could not load the register — ${bomEsc((e && e.message) || 'server error')}.</p>`);
        return;
      }
      ctx.openRegisterModal(ctx.bomRenderRegisterListHtml(orders));
      ctx.registerModalBody.querySelectorAll('[data-bom-order-id]').forEach((btn) => {
        btn.addEventListener('click', () => ctx.bomLoadContinueDispatchForm(btn.getAttribute('data-bom-order-id')));
      });
    }

    // `backLabel`/`showBack` let the same form read right whether it's
    // sitting inside the Register modal ("Back to list") or inline on the
    // BOM Home double-click flow ("Back to BOM Home").
    function bomRenderContinueFormHtml(order, backLabel) {
      const pendingItems = (order.items || []).filter((it) => it.remaining > 0);
      if (!pendingItems.length) {
        return `<p class="note">Nothing left pending for this order.</p><button type="button" class="btn btn-ghost" id="bomRegisterBackBtn"><i class="fa-solid fa-arrow-left"></i> ${bomEsc(backLabel)}</button>`;
      }
      // Step 5: each serial-mandatory row gets its own textarea id + a scan
      // icon button (data-cont-scan-target points at that id) so the same
      // ctx.openBomScanner() from the main screen can be reused here too — see
      // ctx.bomLoadContinueDispatchForm below for the click wiring.
      const rows = pendingItems.map((it, idx) => {
        const taId = `bomContSerial_${idx}`;
        return `
        <div class="field" style="margin-bottom:14px;">
          <label>${bomEsc(it.name)} <span class="note">(${bomEsc(it.category || '')} — ${it.remaining} of ${it.total} pending, ${it.dispatched} already dispatched)</span></label>
          ${it.serialMandatory
            ? `<div style="display:flex; gap:8px; align-items:flex-start;">
                 <textarea id="${taId}" data-cont-name="${bomEscAttr(it.name)}" data-cont-kind="serial" data-cont-total="${it.total}" rows="2" placeholder="Enter up to ${it.remaining} serial number(s), comma or newline separated" style="flex:1;"></textarea>
                 <button type="button" class="ss-scan-icon-btn" data-cont-scan-target="${taId}" title="Scan barcode / QR"><i class="fa-solid fa-barcode"></i></button>
               </div>
               <p class="note" id="${taId}Note" style="margin-top:6px;"></p>`
            : `<input type="number" min="0" max="${it.remaining}" value="${it.remaining}" data-cont-name="${bomEscAttr(it.name)}" data-cont-kind="qty" data-cont-total="${it.total}">`
          }
        </div>
      `;
      }).join('');
      return `
        <p class="note" style="margin-bottom:10px;">Order No <b>${bomEsc(order.orderNo)}</b> — enter what's going out on THIS trip; leave the rest for a later trip.</p>
        ${rows}
        <div class="actions-row">
          <button type="button" class="btn btn-green" id="bomRegisterContinueBtn"><i class="fa-solid fa-truck"></i> Continue Dispatch</button>
          <button type="button" class="btn btn-ghost" id="bomRegisterBackBtn"><i class="fa-solid fa-arrow-left"></i> ${bomEsc(backLabel)}</button>
          <button type="button" class="btn btn-ghost" id="bomRegisterTrackBtn"><i class="fa-solid fa-route"></i> Track This BOM</button>
        </div>
      `;
    }

    // The Continue Dispatch form's per-item serial textarea used to be
    // "half-done" compared to the main Serial No. modal (ctx.openBomSerialModal
    // above): typing/pasting here did no delimiter normalization and no
    // duplicate check, so a repeated serial (typed twice, or the same
    // barcode scanned twice) would silently sail through into the dispatch
    // request. This gives it the same auto-newline-on-delimiter, paste
    // normalization, and live duplicate warning the main modal already has
    // — bomEsc/bomSplitSerials are the same helpers reused everywhere else.
    function bomContSerialDupes(text) {
      const serials = bomSplitSerials(text);
      const seen = new Set();
      const dupes = new Set();
      serials.forEach((s) => {
        const key = s.toLowerCase();
        if (seen.has(key)) dupes.add(s);
        seen.add(key);
      });
      return { serials, dupes: [...dupes] };
    }

    function bomUpdateContSerialNote(box) {
      const note = document.getElementById(`${box.id}Note`);
      if (!note) return;
      const { serials, dupes } = ctx.bomContSerialDupes(box.value);
      if (dupes.length) {
        note.style.color = 'var(--red)';
        note.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Duplicate serial number(s): ${dupes.map(bomEsc).join(', ')}`;
      } else if (serials.length) {
        note.style.color = 'var(--green)';
        note.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${serials.length} serial number(s) entered.`;
      } else {
        note.style.color = '';
        note.innerHTML = '';
      }
    }

    // Same keydown/paste/blur wiring as the main Serial No. modal's box
    // (see ctx.openBomSerialModal above) — any delimiter becomes a newline as
    // you type/scan, a paste gets normalized the same way, and every
    // change refreshes the duplicate note live (this also covers a camera
    // scan's "Done", since ctx.confirmBomScan dispatches an 'input' event on
    // the target textarea).
    function bomWireContSerialTextarea(box) {
      box.addEventListener('keydown', (e) => {
        if ([',', ' ', '|', ';', 'Tab'].includes(e.key)) {
          e.preventDefault();
          const before = box.value.slice(0, box.selectionStart);
          const after = box.value.slice(box.selectionEnd);
          const needsNewline = before && !before.endsWith('\n');
          box.value = before + (needsNewline ? '\n' : '') + after;
          const pos = before.length + (needsNewline ? 1 : 0);
          box.setSelectionRange(pos, pos);
        }
        ctx.bomUpdateContSerialNote(box);
      });
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const normalized = bomSplitSerials(pasted).join('\n');
        const before = box.value.slice(0, box.selectionStart);
        const after = box.value.slice(box.selectionEnd);
        const prefix = before && !before.endsWith('\n') ? '\n' : '';
        box.value = before + prefix + normalized + '\n' + after;
        ctx.bomUpdateContSerialNote(box);
      });
      box.addEventListener('input', () => ctx.bomUpdateContSerialNote(box));
      box.addEventListener('blur', () => {
        box.value = bomSplitSerials(box.value).join('\n');
        ctx.bomUpdateContSerialNote(box);
      });
    }

    // `target` is either 'modal' (Pending/BOM Register overlay, unchanged
    // behaviour) or 'inline' (renders straight into the BOM Entry screen's
    // #bomContinuePanel — see ctx.bomOpenOrderInline below, used by the BOM
    // Home table's double-click / Open action).
    async function bomLoadContinueDispatchForm(orderId, target) {
      const mode = target === 'inline' ? 'inline' : 'modal';
      const container = mode === 'inline' ? ctx.continueInlineBody : ctx.registerModalBody;
      const setBody = (html) => {
        if (mode === 'inline') { container.innerHTML = html; }
        else { ctx.openRegisterModal(html); }
      };
      const backLabel = mode === 'inline' ? 'Back to BOM Home' : 'Back to list';
      const goBack = mode === 'inline' ? ctx.showBomHome : ctx.bomLoadRegisterList;

      setBody('<p class="note"><i class="fa-solid fa-spinner fa-spin"></i> Loading order...</p>');
      let order;
      try {
        order = await window.Api.get(`/bom/orders/${orderId}`);
      } catch (e) {
        setBody(`<p class="note" style="color:var(--red);">Could not load this order — ${bomEsc((e && e.message) || 'server error')}.</p>`);
        return;
      }
      setBody(ctx.bomRenderContinueFormHtml(order, backLabel));
      // Step 5: wire each pending serial item's scan icon button to open
      // the camera scanner targeting that item's own textarea id.
      container.querySelectorAll('[data-cont-scan-target]').forEach((btn) => {
        btn.addEventListener('click', () => ctx.openBomScanner(btn.getAttribute('data-cont-scan-target')));
      });
      // Wire normalization + live duplicate note on every serial textarea
      // (covers both manual typing/paste AND a camera scan's "Done", since
      // that dispatches its own 'input' event on the same box).
      container.querySelectorAll('textarea[data-cont-kind="serial"]').forEach((box) => ctx.bomWireContSerialTextarea(box));
      const backBtn = container.querySelector('#bomRegisterBackBtn');
      if (backBtn) backBtn.addEventListener('click', goBack);
      const trackBtn = container.querySelector('#bomRegisterTrackBtn');
      if (trackBtn) trackBtn.addEventListener('click', () => ctx.bomOpenTrackForOrderNo(order.orderNo));
      const continueBtn = container.querySelector('#bomRegisterContinueBtn');
      if (continueBtn) {
        continueBtn.addEventListener('click', async () => {
          const items = [];
          const dupIssues = [];
          container.querySelectorAll('[data-cont-name]').forEach((el) => {
            const name = el.getAttribute('data-cont-name');
            const totalQty = Number(el.getAttribute('data-cont-total')) || 0;
            if (el.getAttribute('data-cont-kind') === 'serial') {
              const { serials, dupes } = ctx.bomContSerialDupes(el.value || '');
              if (dupes.length) { dupIssues.push(`${name}: ${dupes.join(', ')}`); return; }
              if (serials.length) items.push({ name, qty: serials.length, totalQty, serials });
            } else {
              const qty = Number(el.value) || 0;
              if (qty > 0) items.push({ name, qty, totalQty, serials: [] });
            }
          });
          if (dupIssues.length) {
            window.openModal('Duplicate Serial No.', `<p>Please remove the duplicate serial number(s) before dispatching:</p><ul>${dupIssues.map((s) => `<li>${bomEsc(s)}</li>`).join('')}</ul>`);
            return;
          }
          if (!items.length) {
            window.openModal('Nothing to Dispatch', '<p>Enter a quantity or serial number(s) for at least one item.</p>');
            return;
          }
          const originalLabel = continueBtn.innerHTML;
          continueBtn.disabled = true;
          continueBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dispatching...';
          let result;
          try {
            result = await window.Api.post('/bom/dispatch', { orderNo: order.orderNo, header: order.header, items });
          } catch (e) {
            continueBtn.disabled = false;
            continueBtn.innerHTML = originalLabel;
            const msg = (e && e.message) || '';
            if (msg.startsWith('DISPATCH BLOCKED')) {
              ctx.bomShowStockIssuesModal('Dispatch Not Possible', "This trip could not be dispatched — the following item(s) failed:", ctx.bomParseBlockedRows(msg));
            } else {
              window.openModal('Dispatch Failed', `<p>${bomEsc(msg || 'Could not dispatch this order. Please try again.')}</p>`);
            }
            return;
          }
          if (window.showToast) window.showToast('Dispatched — stock has been deducted.');
          if (result.orderStatus === 'Completed' || !(result.pending || []).length) {
            window.openModal('Dispatch Complete', `<p>Order No <b>${bomEsc(order.orderNo)}</b> is now fully dispatched.</p>`);
            goBack();
          } else {
            window.openModal('Partial Dispatch Done', `<p>Stock deducted for this trip. Order No <b>${bomEsc(order.orderNo)}</b> still has item(s) pending — reopen it from the register any time to continue.</p>`);
            ctx.bomLoadContinueDispatchForm(orderId, mode);
          }
        });
      }
    }

    // Opens a pending order directly INSIDE the BOM Entry screen (the
    // literal "double-click -> redirected inside the BOM" flow) instead of
    // the Pending BOM Register modal. Kit-selection panel is hidden while
    // this is showing; "Back to BOM Home" (top of the entry screen) and
    // the form's own "Back to BOM Home" button both return to the launcher.
    function bomOpenOrderInline(orderId) {
      ctx.bomInlineContinueOrderId = orderId;
      ctx.showBomEntry();
      if (ctx.newEntryPanel) ctx.newEntryPanel.style.display = 'none';
      const kip = ctx.$('bomKitItemsPanel');
      if (kip) kip.style.display = 'none';
      if (ctx.continuePanel) ctx.continuePanel.style.display = '';
      ctx.bomLoadContinueDispatchForm(orderId, 'inline');
    }

    if (ctx.homeBtnRegister) ctx.homeBtnRegister.addEventListener('click', ctx.bomLoadRegisterList);

    if (ctx.btnChallan) {
      ctx.btnChallan.addEventListener('click', async () => {
        // belt-and-braces — button stays disabled until Verify BOM passes,
        // which already ran the real stock check (see ctx.btnVerify above), so
        // there's nothing left to check here.
        if (!ctx.bomVerified) return;
        if (!ctx.currentKitState) {
          window.openModal('Select a Kit', '<p>Please select a BOM Kit before converting to a challan.</p>');
          return;
        }

        const kw = bomGetAllKits()[ctx.kitSelect.value] ? bomGetAllKits()[ctx.kitSelect.value].kw : '';
        const kit = { kw, sections: ctx.currentKitState };
        const header = ctx.getHeaderValues();

        const challanModalTitleEl = document.getElementById('bomChallanModalTitle');
        if (challanModalTitleEl) challanModalTitleEl.innerHTML = '<i class="fa-solid fa-file-invoice"></i> Convert into Challan';
        ctx.openChallanModal(bomRenderChallanEntryModalHtml(header, kit));
        // Auto-fill Qty from the actual on-screen kit items (respecting any
        // partial Dispatch Qty) via the item->category mapping — see
        // bomComputeChallanAutoQty above. Every field stays editable after
        // this; it only sets the starting value.
        bomApplyChallanAutoQty(ctx.currentKitState);

        const modalNo = document.getElementById('bomChallanModalNo');
        const modalDate = document.getElementById('bomChallanModalDate');
        const modalOrderNo = document.getElementById('bomChallanModalOrderNo');
        const modalCapacity = document.getElementById('bomChallanModalCapacity');
        const modalName = document.getElementById('bomChallanModalName');
        const modalCity = document.getElementById('bomChallanModalCity');
        const modalVehicleNo = document.getElementById('bomChallanModalVehicleNo');
        const printBtn = document.getElementById('bomChallanPrintBtn');

        if (printBtn) {
          printBtn.addEventListener('click', async () => {
            // Open the tab SYNCHRONOUSLY, as the very first thing in this
            // handler, before any `await`. This is what stops browsers'
            // popup blocker from kicking in — a window.open() call is only
            // treated as "a direct result of the user's click" if it runs
            // before the call stack yields to any async work. It starts as
            // a small "Preparing..." page and gets redirected to the real
            // PDF blob once the server finishes generating it below.
            const pdfWindow = window.open('', '_blank');
            if (pdfWindow) {
              pdfWindow.document.write('<title>Preparing Challan…</title><body style="font-family:sans-serif;background:#1a1a1a;color:#ccc;display:flex;flex-direction:column;gap:16px;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="width:40px;height:40px;border:4px solid #444;border-top-color:#ffb020;border-radius:50%;animation:egsSpin 0.8s linear infinite;"></div><div>Preparing your Challan PDF…</div><style>@keyframes egsSpin{to{transform:rotate(360deg)}}</style></body>');
            }
            // NEW FLOW: Save Data -> backend fills the REAL Excel template ->
            // converts to PDF via LibreOffice -> browser opens/prints the
            // PDF. Replaces the old HTML-replica sheet (bomRenderChallanPrintSheetHtml)
            // entirely — that function + #bomChallanPrintRoot HTML sheet are
            // no longer used by this button (left in place, unused, in case
            // of rollback; safe to delete once this is verified in production).
            const challanNo = modalNo ? modalNo.value.trim() : '';
            // TEMP: mandatory check disabled for testing — re-enable before going live
            // if (!challanNo) {
            //   window.openModal('Challan No. Required', '<p>Please enter a Challan No. before printing.</p>');
            //   return;
            // }

            const payload = {
              challanNo,
              challanDate: modalDate ? modalDate.value : '',
              orderNo: modalOrderNo ? modalOrderNo.value : '',
              capacityKw: modalCapacity ? modalCapacity.value : kw,
              customerName: modalName ? modalName.value : '',
              city: modalCity ? modalCity.value : '',
              vehicleNo: modalVehicleNo ? modalVehicleNo.value : '',
              installerName: header.installerName || '',
              fabricatorName: header.fabricatorName || '',
              dealerName: header.dealerName || '',
              items: bomCollectChallanTemplateValues(),
            };

            printBtn.disabled = true;
            const originalLabel = printBtn.innerHTML;
            printBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving & Preparing PDF...';
            try {
              // pdfWindow (opened synchronously above) shows "Preparing..."
              // while this runs; the global loading overlay (js/app.js)
              // also covers the whole "Saving -> generating PDF on the
              // server" wait on this page itself.
              const saved = await window.Api.post('/challan', payload);
              const pdfUrl = `${window.API_BASE}/challan/${saved.id}/pdf`;
              // NOTE: window.open(pdfUrl, '_blank') directly on the URL was
              // used previously, but that's a plain browser navigation — it
              // never goes through the window.fetch wrapper in js/app.js that
              // auto-attaches the "Authorization: Bearer <token>" header, so
              // the server always rejected it with "Please log in to
              // continue" even for a logged-in user. Fetching the PDF as a
              // blob (via fetch(), which IS wrapped and gets the header) and
              // pointing the already-open tab at an object URL for that blob
              // keeps the request authenticated.
              const pdfRes = await fetch(pdfUrl);
              if (!pdfRes.ok) {
                let msg = 'Could not generate the Challan PDF.';
                try { const j = await pdfRes.json(); if (j && j.error) msg = j.error; } catch (e) { /* ignore */ }
                throw new Error(msg);
              }
              const pdfBlob = await pdfRes.blob();
              const blobUrl = URL.createObjectURL(pdfBlob);
              // Redirect the tab we already opened synchronously on click —
              // this is what actually avoids the popup blocker. Only if that
              // tab somehow never opened (or the person closed it while
              // waiting) do we fall back to a same-tab forced download.
              if (pdfWindow && !pdfWindow.closed) {
                pdfWindow.location = blobUrl;
                pdfWindow.addEventListener('load', () => {
                  try { pdfWindow.print(); } catch (e) { /* let user use the PDF viewer's own print button */ }
                });
              } else {
                // Popup was blocked (or closed early) — fall back to a
                // same-tab download link so the person can still get the PDF.
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = `challan-${saved.id}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                if (window.showToast) window.showToast('Popup blocked — PDF downloaded instead. Allow popups for this site to open it directly next time.');
              }
              // Object URLs are per-tab memory references — revoke it after a
              // delay so the new tab has time to actually load/render the PDF
              // before the underlying blob is freed.
              setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
              if (window.showToast) window.showToast('Challan saved — opening PDF for print.');
            } catch (err) {
              if (pdfWindow && !pdfWindow.closed) pdfWindow.close();
              window.openModal('Print Failed', `<p>${(err && err.message) || 'Could not generate the Challan PDF.'}</p>`);
            } finally {
              printBtn.disabled = false;
              printBtn.innerHTML = originalLabel;
            }
          });
        }
      });
    }

    if (ctx.btnDispatch) {
      ctx.btnDispatch.addEventListener('click', async () => {
        if (!ctx.bomVerified) return; // belt-and-braces — button is disabled until verified anyway
        if (!ctx.currentKitState) {
          window.openModal('Select a Kit', '<p>Please select a BOM Kit before dispatching.</p>');
          return;
        }
        const confirmed = await window.confirmDialog(
          'Create Dispatch',
          'This will permanently deduct every item in this BOM from stock. This cannot be undone from here. Continue?',
          { kind: 'warning', okLabel: 'Yes, Dispatch' }
        );
        if (!confirmed) return;

        const originalLabel = ctx.btnDispatch.innerHTML;
        ctx.btnDispatch.disabled = true;
        ctx.btnDispatch.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dispatching...';
        const result = await ctx.bomRunDispatch();
        ctx.btnDispatch.disabled = false;
        ctx.btnDispatch.innerHTML = originalLabel;

        if (result && result.success) {
          const pending = Array.isArray(result.pending) ? result.pending : [];
          if (window.showToast) window.showToast('Dispatched — stock has been deducted.');

          if (result.orderStatus === 'Completed' || !pending.length) {
            // Nothing left pending for this Order No. — same end state as
            // before Step 3.
            window.openModal('Dispatch Complete', '<p>This BOM has been dispatched and stock has been deducted accordingly. Nothing is pending for this Order No. anymore.</p>');
            ctx.btnDispatch.disabled = true; // fully done — avoids an accidental re-dispatch of a completed order
          } else {
            // Step 3: Partial dispatch — some item(s) still have qty left
            // pending for this Order No. Pre-fill Dispatch Qty with what's
            // still remaining (per item) and re-render, so the person can
            // immediately do the next trip in this same session without
            // retyping numbers. Entered serials are cleared for every row
            // since whatever was entered this trip is already Dispatched
            // in stock_ledger — they'd otherwise fail re-validation as
            // "not Available" on the next check.
            const pendingByName = {};
            pending.forEach((p) => { pendingByName[p.name] = p.remaining; });
            (ctx.currentKitState || []).forEach((sec) => {
              (sec.items || []).forEach((it) => {
                const rem = pendingByName[it.name || ''];
                if (rem !== undefined) {
                  it.dispatchQty = String(rem);
                  it.serials = '';
                  it.checked = false;
                } else if (it.name) {
                  // Fully dispatched already — nothing left to send for
                  // this item on a future trip.
                  it.dispatchQty = '0';
                  it.serials = '';
                }
              });
            });
            if (ctx.itemsPreview) {
              const scrollParent = ctx.bomFindScrollParent(ctx.itemsPreview);
              const scrollTop = scrollParent.scrollTop;
              ctx.itemsPreview.innerHTML = bomRenderScreenItemsHtml(ctx.currentKitState, { isAdmin: ctx.bomIsAdmin, needsSerial: ctx.bomItemNeedsSerial });
              scrollParent.scrollTop = scrollTop;
            }

            const listHtml = pending.map((p) => `<li>${bomEsc(p.name)} — <b>${p.remaining}</b> pending (dispatched ${p.dispatched} of ${p.total})</li>`).join('');
            window.openModal('Partial Dispatch Done', `
              <p>Stock has been deducted for this trip. The following item(s) are still pending for Order No. <b>${bomEsc(ctx.getHeaderValues().orderNo)}</b>:</p>
              <ul style="padding-left:18px; margin-top:10px;">${listHtml}</ul>
              <p style="margin-top:10px;">Dispatch Qty has been pre-filled with the remaining amounts — tick <b>Check</b> again and re-verify when ready to send the rest.</p>
            `);
            // Remaining stock could have moved since this trip, and every
            // row needs to be re-ticked for the next partial trip anyway
            // (fresh serials, fresh amounts) — so require Verify BOM again
            // before Create Dispatch unlocks, same gate as the very first
            // trip.
            ctx.setVerified(false);
            ctx.updateVerifyButtonState();
          }
        }
        // On failure, ctx.bomRunDispatch() already showed the itemized/error modal.
      });
    }

    // Mirrors Excel's "Fit to 1 page" print option: measure the sheet's
    // real height and shrink it (via CSS `zoom`, which reflows the layout
    // so borders/columns stay correctly aligned — unlike `transform:
    // scale()`, which does NOT reflow and caused the border/column
    // misalignment seen earlier) so it always prints on exactly one page.
    //
    // WHY THE OLD VERSION STILL PRINTED 2 PAGES:
    // 1) It measured with `sheet.scrollHeight` right after setting
    //    `sheet.style.zoom`. In Chromium, scrollHeight/offsetHeight do NOT
    //    reflect a zoom that's just been applied — they keep reporting
    //    (roughly) the un-zoomed size — so the "how tall is it right now"
    //    check was reading the wrong number every time, no matter what
    //    zoom was set. getBoundingClientRect().height is the one DOM API
    //    that DOES report the true, on-screen (zoomed) size, so that's
    //    what this version measures with instead.
    // 2) It only ever ran from the 'beforeprint' event. That event's
    //    timing relative to when the browser actually lays out the print
    //    preview is not something we can rely on — on the reporter's
    //    machine it evidently didn't take effect before the page was
    //    paginated, so the sheet fell back to the CSS's static baseline
    //    zoom alone... which (see next point) was too big by itself.
    // 3) The CSS baseline `zoom:0.75` on `.bom-sheet` was assumed (per its
    //    old comment) to *by itself* guarantee one page. It doesn't —
    //    measured directly, this exact 53-item/66-row kit still overflows
    //    onto a 2nd page at zoom 0.75. There is no safe one-size-fits-all
    //    static zoom: it depends on the item count, which changes per kit.
    //
    // FIX: there's no static zoom in CSS anymore (see style.css). Instead,
    // this always measures the sheet's actual current natural height and
    // computes the exact zoom needed — every time Print is clicked, not
    // only reactively from 'beforeprint'. Because #bomPrintRoot is
    // display:none outside of @media print, measuring it requires
    // temporarily forcing it visible (off-screen, via the .bom-measuring
    // class in style.css) — this works regardless of whether print media
    // is active, so it no longer depends on 'beforeprint' firing at all.
    //
    // WIDTH: a plain uniform `zoom` shrinks width and height by the SAME
    // factor. That's exactly what left big blank strips down both sides
    // once the sheet had to shrink a lot to fit its height on one page —
    // the sheet got shorter (good) but also proportionally narrower than
    // the page (not wanted). Row height in this table depends only on
    // font-size/line-height/padding (fixed values) — NOT on the table's
    // width, since every cell is white-space:nowrap so nothing re-wraps
    // when columns get wider. That means the sheet's *width* can be set
    // independently of the vertical fit-to-page calculation: this widens
    // the sheet's un-zoomed base width just enough that, after the SAME
    // zoom shrink is applied for the height, the final on-page width
    // comes out to exactly the printable page width — no leftover math
    // needed elsewhere, and it's still one single `zoom` factor (so
    // pagination — which depends on `zoom` reflowing layout — stays
    // exactly as reliable as the height-only version above).

  return { bomCollectItemsForStockCheck, bomCollectItemsForDispatch, bomShowStockIssuesModal, bomRunStockCheck, bomRunDispatch, bomParseBlockedRows, bomRenderRegisterListHtml, bomLoadRegisterList, bomRenderContinueFormHtml, bomContSerialDupes, bomUpdateContSerialNote, bomWireContSerialTextarea, bomLoadContinueDispatchForm, bomOpenOrderInline };
}
