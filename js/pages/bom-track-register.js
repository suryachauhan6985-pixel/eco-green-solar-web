// js/pages/bom-track-register.js
// -----------------------------------------------------------------------------
// Upgraded Track BOM Module: Stage pipeline cards, visual milestones,
// timestamps, user attribution, and item fulfillment breakdown.
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
      if (window.CURRENT_PAGE_OPTS && (window.CURRENT_PAGE_OPTS.action === 'register' || window.CURRENT_PAGE_OPTS.tab === 'register')) {
        if (typeof window.stepBackFromFlyoutTrail === 'function') {
          window.stepBackFromFlyoutTrail();
        } else if (typeof window.go === 'function') {
          window.go('dashboard');
        }
      }
    }
    if (ctx.registerCloseBtn) ctx.registerCloseBtn.addEventListener('click', closeRegisterModal);
    let regMouseDownTarget = null;
    if (ctx.registerOverlay) {
      ctx.registerOverlay.addEventListener('mousedown', (e) => { regMouseDownTarget = e.target; });
      ctx.registerOverlay.addEventListener('click', (e) => {
        if (e.target === ctx.registerOverlay && regMouseDownTarget === ctx.registerOverlay) ctx.closeRegisterModal();
      });
    }

    ctx.bomCurrentRole = window.currentUserRole || 'User';
    ctx.bomIsAdmin = ctx.bomCurrentRole === 'SuperAdmin' || ctx.bomCurrentRole === 'Admin';

    ctx.btnCreateBom = ctx.$('bomBtnCreateBom');
    ctx.btnTrackBom = ctx.$('bomBtnTrackBom');
    if (ctx.btnCreateBom) ctx.btnCreateBom.style.display = ctx.bomIsAdmin ? '' : 'none';

    function bomTrackStatusPill(status) {
      const map = {
        Pending: { color: '#fbbf24', bg: 'rgba(243,156,18,0.18)', border: '#f39c12', icon: 'fa-clock' },
        'Partially Dispatched': { color: '#60a5fa', bg: 'rgba(59,142,208,0.18)', border: '#3b8ed0', icon: 'fa-truck-ramp-box' },
        Dispatched: { color: '#2ecc71', bg: 'rgba(46,204,113,0.18)', border: '#2ecc71', icon: 'fa-circle-check' },
      };
      const c = map[status] || map.Pending;
      return `<span style="display:inline-flex; align-items:center; gap:6px; padding:5px 14px; border-radius:20px; font-size:12px; font-weight:700; color:${c.color}; background:${c.bg}; border:1px solid ${c.border};"><i class="fa-solid ${c.icon}"></i> ${bomEsc(status)}</span>`;
    }

    function bomFmtDateTime(v) {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    }

    function bomRenderLifecycleStepperHtml(data) {
      const trips = data.trips || [];
      const status = data.status || 'Pending';
      const firstTripAt = trips.length ? trips[0].dispatchedAt : null;
      const lastTripAt = trips.length ? trips[trips.length - 1].dispatchedAt : null;
      const isDone = status === 'Dispatched';
      const hasTrips = trips.length > 0;
      const hasChallan = Boolean(data.header && data.header.challanNo);

      const stages = [
        {
          key: 'created',
          label: 'BOM Created',
          icon: 'fa-clipboard-check',
          done: true,
          active: false,
          user: data.createdBy || 'Admin',
          at: data.createdAt || (data.header && data.header.createdAt) || null
        },
        {
          key: 'verified',
          label: 'Stock Verified',
          icon: 'fa-list-check',
          done: true,
          active: false,
          user: 'Verified OK',
          at: null
        },
        {
          key: 'challan',
          label: 'Challan Issued',
          icon: 'fa-file-invoice',
          done: hasChallan || hasTrips,
          active: !hasChallan && !hasTrips,
          user: data.header && data.header.challanNo ? `Challan #${data.header.challanNo}` : (hasTrips ? 'Challan auto-linked' : 'Pending issue'),
          at: data.header && data.header.challanDate ? data.header.challanDate : null
        },
        {
          key: 'partial',
          label: 'Dispatch Started',
          icon: 'fa-truck-fast',
          done: hasTrips,
          active: hasChallan && !hasTrips,
          user: hasTrips ? `Trip 1 (${trips[0].dispatchedBy || 'Warehouse'})` : 'Awaiting 1st trip',
          at: firstTripAt
        },
        {
          key: 'done',
          label: 'Fully Dispatched',
          icon: 'fa-circle-check',
          done: isDone,
          active: hasTrips && !isDone,
          user: isDone ? 'All items delivered' : (hasTrips ? `${(data.items || []).reduce((acc, it) => acc + Number(it.remaining || 0), 0)} items pending` : 'Pending dispatch'),
          at: isDone ? lastTripAt : null
        },
      ];

      const stepsHtml = stages.map((s, i) => {
        const isLast = i === stages.length - 1;
        const stateClass = s.done ? 'done' : (s.active ? 'active' : 'pending');
        const nextDone = stages[i + 1] && stages[i + 1].done;
        return `
          <div class="bom-step-node ${stateClass}">
            <div class="bom-step-icon-wrap">
              <i class="fa-solid ${s.icon}"></i>
            </div>
            <div class="bom-step-name">${bomEsc(s.label)}</div>
            <div class="bom-step-sub" style="color:${s.done ? '#2ecc71' : (s.active ? '#60a5fa' : 'var(--txt-muted)')}; font-weight:600;">${bomEsc(s.user)}</div>
            <div class="bom-step-sub">${s.at ? bomEsc(bomFmtDateTime(s.at)) : ''}</div>
          </div>
          ${!isLast ? `<div class="bom-step-line ${nextDone ? 'done' : ''}"></div>` : ''}
        `;
      }).join('');

      return `<div class="bom-stepper-wrap">${stepsHtml}</div>`;
    }

    function bomRenderTrackResultHtml(data) {
      const header = data.header || {};
      const trips = data.trips || [];
      const totalItems = (data.items || []).reduce((sum, it) => sum + Number(it.total || 0), 0);
      const totalDispatched = (data.items || []).reduce((sum, it) => sum + Number(it.dispatched || 0), 0);
      const totalRemaining = (data.items || []).reduce((sum, it) => sum + Number(it.remaining || 0), 0);
      const overallPercent = totalItems > 0 ? Math.round((totalDispatched / totalItems) * 100) : 0;

      const itemRows = (data.items || []).map((it) => {
        const req = Number(it.total || 0);
        const disp = Number(it.dispatched || 0);
        const rem = Number(it.remaining || 0);
        const pct = req > 0 ? Math.min(100, Math.round((disp / req) * 100)) : 0;
        const isComplete = rem <= 0;
        return `
          <tr>
            <td style="padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.06); font-weight:600; color:var(--txt);">
              <div>${bomEsc(it.name)}</div>
              <div class="bom-item-progress-bar">
                <div class="bom-item-progress-fill" style="width:${pct}%;"></div>
              </div>
            </td>
            <td style="padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.06); text-align:center; font-weight:700;">${req}</td>
            <td style="padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.06); text-align:center; color:#2ecc71; font-weight:700;">${disp}</td>
            <td style="padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.06); text-align:center; font-weight:700; color:${isComplete ? '#2ecc71' : '#f87171'};">
              ${rem} ${isComplete ? '<i class="fa-solid fa-circle-check" style="margin-left:4px;"></i>' : ''}
            </td>
          </tr>
        `;
      }).join('');

      const tripCards = trips.length
        ? trips.map((t, idx) => {
            const itemsLine = (t.items || []).map((it) => `<span class="dash-qty-pill active" style="margin-right:4px; font-size:11px;">${bomEsc(it.name)} &times; <b>${it.qty}</b></span>`).join('');
            return `
              <div class="bom-trip-card">
                <div>
                  <div style="font-weight:800; font-size:14px; color:var(--txt); display:flex; align-items:center; gap:8px;">
                    <i class="fa-solid fa-truck-moving" style="color:var(--green);"></i> Trip ${idx + 1}
                    <span style="font-size:11.5px; font-weight:600; color:var(--txt-muted); background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:6px;">By: ${bomEsc(t.dispatchedBy || 'Warehouse')}</span>
                  </div>
                  <div style="font-size:12px; color:var(--txt-muted); margin-top:6px;">${itemsLine || '—'}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:12px; font-weight:700; color:var(--txt);">${bomEsc(bomFmtDateTime(t.dispatchedAt))}</div>
                  ${t.vehicleNo ? `<div style="font-size:11.5px; color:var(--txt-muted); margin-top:2px;"><i class="fa-solid fa-car"></i> ${bomEsc(t.vehicleNo)}</div>` : ''}
                </div>
              </div>
            `;
          }).join('')
        : `<p class="note" style="padding:12px; background:rgba(255,255,255,0.02); border-radius:8px; border:1px dashed rgba(255,255,255,0.1);"><i class="fa-solid fa-circle-info"></i> No dispatch trips logged yet — this BOM order is created and ready for dispatch.</p>`;

      const mobileNo = header.phone || header.mobile || '';
      const waLink = mobileNo ? `https://wa.me/91${mobileNo.replace(/[^0-9]/g, '').slice(-10)}?text=${encodeURIComponent(`Hello ${header.customerName || ''}, your Solar BOM Order #${data.orderNo} status is: ${data.status}. Total ${totalDispatched} of ${totalItems} items dispatched.`)}` : '';

      return `
        <div class="bom-track-container">
          <!-- Top Application / Order Card -->
          <div class="bom-track-card">
            <div class="bom-track-header">
              <div class="bom-track-title">
                <h3>${bomEsc(header.customerName || 'Customer Order')}</h3>
                <div class="bom-track-order-badge">
                  <i class="fa-solid fa-hashtag"></i> Order No: ${bomEsc(data.orderNo)}
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                ${ctx.bomTrackStatusPill(data.status)}
                ${waLink ? `<a href="${waLink}" target="_blank" class="btn btn-green" style="padding:5px 12px; font-size:12px;"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ''}
              </div>
            </div>

            <!-- Meta Details Grid -->
            <div class="bom-track-meta-grid">
              <div class="bom-track-meta-item">
                <div class="bom-track-meta-label">Capacity</div>
                <div class="bom-track-meta-val"><i class="fa-solid fa-bolt" style="color:var(--gold);"></i> ${bomEsc(header.capacityKw || '3.3')} kW Solar</div>
              </div>
              <div class="bom-track-meta-item">
                <div class="bom-track-meta-label">Location / City</div>
                <div class="bom-track-meta-val"><i class="fa-solid fa-location-dot" style="color:var(--blue);"></i> ${bomEsc(header.city || 'Surat')}</div>
              </div>
              <div class="bom-track-meta-item">
                <div class="bom-track-meta-label">Contact</div>
                <div class="bom-track-meta-val"><i class="fa-solid fa-phone"></i> ${bomEsc(mobileNo || '—')}</div>
              </div>
              <div class="bom-track-meta-item">
                <div class="bom-track-meta-label">Installer / Dealer</div>
                <div class="bom-track-meta-val">${bomEsc(header.installerName || header.dealerName || '—')}</div>
              </div>
              <div class="bom-track-meta-item">
                <div class="bom-track-meta-label">Fulfillment</div>
                <div class="bom-track-meta-val" style="color:#2ecc71;">${totalDispatched} / ${totalItems} (${overallPercent}%)</div>
              </div>
            </div>

            <!-- Visual Stage Pipeline Tracker -->
            ${bomRenderLifecycleStepperHtml(data)}
          </div>

          <!-- Items Breakdown Card -->
          <div class="bom-track-card">
            <h4 style="margin:0 0 12px 0; font-size:15px; font-weight:800; color:var(--gold); display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-boxes-stacked"></i> BOM Items Fulfillment
            </h4>
            <div class="table-wrap">
              <table style="width:100%; border-collapse:collapse;">
                <thead>
                  <tr>
                    <th style="text-align:left; padding:8px 12px; border-bottom:2px solid rgba(255,255,255,0.1);">Item Name</th>
                    <th style="padding:8px 12px; border-bottom:2px solid rgba(255,255,255,0.1); text-align:center;">Required</th>
                    <th style="padding:8px 12px; border-bottom:2px solid rgba(255,255,255,0.1); text-align:center;">Dispatched</th>
                    <th style="padding:8px 12px; border-bottom:2px solid rgba(255,255,255,0.1); text-align:center;">Pending</th>
                  </tr>
                </thead>
                <tbody>${itemRows}</tbody>
              </table>
            </div>
          </div>

          <!-- Dispatch Trips Card -->
          <div class="bom-track-card">
            <h4 style="margin:0 0 12px 0; font-size:15px; font-weight:800; color:var(--blue); display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-route"></i> Dispatch Trips History (${trips.length})
            </h4>
            <div>${tripCards}</div>
          </div>
        </div>
      `;
    }

    async function bomFetchAndRenderTrack(orderNo, resultBox) {
      resultBox.innerHTML = '<p class="note" style="padding:24px; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Looking up BOM tracking history...</p>';
      try {
        const data = await window.Api.get(`/bom/orders/by-order-no/${encodeURIComponent(orderNo)}`, { silent: true });
        resultBox.innerHTML = bomRenderTrackResultHtml(data);
      } catch (e) {
        const msg = (e && e.message) || 'Could not fetch this BOM order.';
        resultBox.innerHTML = `<p class="note" style="color:var(--red); padding:16px;"><i class="fa-solid fa-circle-exclamation"></i> ${bomEsc(msg)}</p>`;
      }
    }

    function bomOpenTrackModal() {
      window.openModal('Track BOM Order', `
        <div class="field" style="margin-bottom:16px;">
          <label style="font-weight:700;">Order No. or Customer Name</label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="bomTrackOrderInput" placeholder="e.g. NP002324 or Customer Name" style="flex:1; font-size:14px;">
            <button type="button" class="btn btn-blue" id="bomTrackSearchBtn"><i class="fa-solid fa-magnifying-glass"></i> Track Order</button>
          </div>
        </div>
        <div id="bomTrackResult"></div>
      `, {
        size: 'xl',
        onClose: () => {
          if (window.CURRENT_PAGE_OPTS && (window.CURRENT_PAGE_OPTS.action === 'track' || window.CURRENT_PAGE_OPTS.tab === 'track')) {
            if (typeof window.stepBackFromFlyoutTrail === 'function') {
              window.stepBackFromFlyoutTrail();
            } else if (typeof window.go === 'function') {
              window.go('dashboard');
            }
          }
        }
      });
      const input = document.getElementById('bomTrackOrderInput');
      const searchBtn = document.getElementById('bomTrackSearchBtn');
      const resultBox = document.getElementById('bomTrackResult');
      function runTrack() {
        const orderNo = ((input && input.value) || '').trim();
        if (!orderNo) {
          if (resultBox) resultBox.innerHTML = '<p class="note" style="color:var(--red);">Enter an Order No. first.</p>';
          return;
        }
        bomFetchAndRenderTrack(orderNo, resultBox);
      }
      if (searchBtn) searchBtn.addEventListener('click', runTrack);
      if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') runTrack(); });
      if (input) input.focus();
    }

    function bomOpenTrackForOrderNo(orderNo) {
      window.openModal('Track BOM Order', `<div id="bomTrackResult"></div>`, { size: 'xl' });
      const resultBox = document.getElementById('bomTrackResult');
      if (resultBox) bomFetchAndRenderTrack(orderNo, resultBox);
    }

    function bomTrackCurrentOrder() {
      const fromField = (ctx.$('bomOrderNo') && ctx.$('bomOrderNo').value.trim()) || '';
      if (!fromField) {
        window.openModal('Order No. Required', '<p>Enter an <b>Order No.</b> above first, or open an existing order from BOM Home / BOM Register.</p>');
        return;
      }
      bomOpenTrackForOrderNo(fromField);
    }

  return { openRegisterModal, closeRegisterModal, bomTrackStatusPill, bomFmtDateTime, bomRenderTrackResultHtml, bomFetchAndRenderTrack, bomOpenTrackModal, bomOpenTrackForOrderNo, bomTrackCurrentOrder };
}
