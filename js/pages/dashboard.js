// js/pages/dashboard.js
window.PAGES = window.PAGES || {};

window.PAGES.dashboard = {
  name: 'Dashboard',
  icon: 'fa-chart-pie',
  sub: 'Live overview of stock & operations',
  html: `
    <div class="dash-shell">
      <!-- Welcome & Quick Action Bar -->
      <div class="dash-welcome-bar" data-widget="w_welcome">
        <div class="dash-greeting">
          <h2>Hello, <span class="dash-user-name" id="dashUserGreeting">Admin</span> 👋</h2>
          <div class="dash-meta-badge">
            <span class="dash-live-dot"></span>
            <span id="dashLiveClock">Live Operations</span> • Eco Green Solar Enterprise ERP
          </div>
        </div>
        <div class="dash-actions-row">
          <button type="button" class="dash-btn-quick primary" onclick="go('bom')"><i class="fa-solid fa-file-invoice"></i> BOM &amp; Challan</button>
          <button type="button" class="dash-btn-quick" onclick="go('purchase')"><i class="fa-solid fa-truck-ramp-box"></i> Inward</button>
          <button type="button" class="dash-btn-quick" onclick="go('sales')"><i class="fa-solid fa-cart-shopping"></i> Sales</button>
          <button type="button" class="dash-btn-quick" onclick="go('scansheet')"><i class="fa-solid fa-qrcode"></i> Scan Sheets</button>
          <button type="button" class="dash-btn-quick" id="dashCustomizeBtn" title="Customize Dashboard Widgets"><i class="fa-solid fa-sliders"></i> Customize</button>
          <button type="button" class="dash-btn-quick" id="dashRefreshBtn" title="Refresh Live Data"><i class="fa-solid fa-rotate-right"></i></button>
        </div>
      </div>

      <!-- Low Stock Alert Banner -->
      <div class="banner" data-widget="w_lowstock">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <div class="banner-content">
          <strong id="dashLowStockCount">0 items</strong> are at or below minimum stock level. Immediate replenishment recommended.
        </div>
        <a href="#" onclick="go('lowstock');return false;" class="banner-btn">Review Low Stock <i class="fa-solid fa-arrow-right"></i></a>
      </div>

      <!-- Solar Generation & Power Assets Strip -->
      <div class="dash-solar-grid" data-widget="w_solar_capacity">
        <div class="dash-solar-card" onclick="go('reports')" style="cursor:pointer;" title="View Solar Panels in Inventory">
          <div class="dash-solar-icon solar"><i class="fa-solid fa-solar-panel"></i></div>
          <div class="dash-solar-info">
            <span class="dash-solar-label">Solar Panels in Stock</span>
            <div class="dash-solar-value"><span id="dashSolarKwVal">0</span> <small style="font-size:13px; font-weight:700; color:var(--gold);">KW</small></div>
            <span class="dash-solar-sub" id="dashSolarPanelsSub">Total Generation Capacity</span>
          </div>
          <div class="dash-solar-badge"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
        </div>

        <div class="dash-solar-card" onclick="go('reports')" style="cursor:pointer;" title="View Inverters in Stock">
          <div class="dash-solar-icon inverter"><i class="fa-solid fa-bolt"></i></div>
          <div class="dash-solar-info">
            <span class="dash-solar-label">Inverters Ready</span>
            <div class="dash-solar-value"><span id="dashInvertersVal">0</span> <small style="font-size:12px; font-weight:700; color:var(--txt-muted);">Units</small></div>
            <span class="dash-solar-sub">Single &amp; 3-Phase Inverters</span>
          </div>
          <div class="dash-solar-badge"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
        </div>

        <div class="dash-solar-card" onclick="go('reports')" style="cursor:pointer;" title="View Batteries in Stock">
          <div class="dash-solar-icon battery"><i class="fa-solid fa-car-battery"></i></div>
          <div class="dash-solar-info">
            <span class="dash-solar-label">Battery Systems</span>
            <div class="dash-solar-value"><span id="dashBatteriesVal">0</span> <small style="font-size:12px; font-weight:700; color:var(--txt-muted);">Units</small></div>
            <span class="dash-solar-sub">Li-Ion &amp; Solar Batteries</span>
          </div>
          <div class="dash-solar-badge"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
        </div>

        <div class="dash-solar-card" onclick="go('masters')" style="cursor:pointer;" title="Manage Master Catalog">
          <div class="dash-solar-icon valuation"><i class="fa-solid fa-layer-group"></i></div>
          <div class="dash-solar-info">
            <span class="dash-solar-label">Registered Master Catalog</span>
            <div class="dash-solar-value"><span id="dashTotalItemsVal">0</span> <small style="font-size:12px; font-weight:700; color:var(--txt-muted);">SKUs</small></div>
            <span class="dash-solar-sub">Active Products &amp; Categories</span>
          </div>
          <div class="dash-solar-badge"><i class="fa-solid fa-arrow-up-right-from-square"></i></div>
        </div>
      </div>

      <!-- 4 Core Executive ERP Metric KPI Cards with Interactive Category Carousel -->
      <div class="stat-grid" data-widget="w_kpi_cards">
        
        <!-- Available Stock Card -->
        <div class="stat-card available" id="card-avail" data-kpi-key="avail">
          <div class="stat-card-header">
            <div class="stat-title-wrap">
              <span class="label">Available Stock</span>
              <span class="stat-sublabel" id="lbl-avail-ctx">All Godown Inventory</span>
            </div>
            <div class="stat-header-controls">
              <div class="stat-stepper-pill" onclick="event.stopPropagation();">
                <button type="button" class="stat-step-btn prev" data-card="avail" title="Previous Category"><i class="fa-solid fa-chevron-left"></i></button>
                <span class="stat-step-index" id="idx-avail">1 / 1</span>
                <button type="button" class="stat-step-btn next" data-card="avail" title="Next Category"><i class="fa-solid fa-chevron-right"></i></button>
              </div>
              <div class="stat-icon-wrap"><i class="fa-solid fa-boxes-stacked"></i></div>
            </div>
          </div>
          <div class="stat-viewport" id="viewport-avail">
            <div class="stat-main-metric">
              <div class="value" id="val-avail">0</div>
              <span class="stat-unit">Nos</span>
            </div>
            <div class="stat-category-badge-wrap">
              <span class="stat-category-badge" id="tag-avail">
                <i class="fa-solid fa-layer-group"></i> Total All Stock
              </span>
              <span class="stat-pct-badge" id="pct-avail">100% Volume</span>
            </div>
          </div>
          <div class="stat-chips-bar" id="chips-avail" onclick="event.stopPropagation();"></div>
          <div class="stat-footer-bar">
            <span class="stat-badge-tag available"><span class="pulse-dot"></span> Ready for Project Dispatch</span>
            <span class="stat-drill-link" title="Open in Master Reports">View Report <i class="fa-solid fa-arrow-up-right-from-square"></i></span>
          </div>
        </div>

        <!-- Assigned Stock Card -->
        <div class="stat-card assigned" id="card-assigned" data-kpi-key="assigned">
          <div class="stat-card-header">
            <div class="stat-title-wrap">
              <span class="label">Assigned Stock</span>
              <span class="stat-sublabel" id="lbl-assigned-ctx">Allocated to Projects</span>
            </div>
            <div class="stat-header-controls">
              <div class="stat-stepper-pill" onclick="event.stopPropagation();">
                <button type="button" class="stat-step-btn prev" data-card="assigned" title="Previous Category"><i class="fa-solid fa-chevron-left"></i></button>
                <span class="stat-step-index" id="idx-assigned">1 / 1</span>
                <button type="button" class="stat-step-btn next" data-card="assigned" title="Next Category"><i class="fa-solid fa-chevron-right"></i></button>
              </div>
              <div class="stat-icon-wrap"><i class="fa-solid fa-hand-holding-hand"></i></div>
            </div>
          </div>
          <div class="stat-viewport" id="viewport-assigned">
            <div class="stat-main-metric">
              <div class="value" id="val-assigned">0</div>
              <span class="stat-unit">Nos</span>
            </div>
            <div class="stat-category-badge-wrap">
              <span class="stat-category-badge" id="tag-assigned">
                <i class="fa-solid fa-layer-group"></i> Total All Stock
              </span>
              <span class="stat-pct-badge" id="pct-assigned">100% Volume</span>
            </div>
          </div>
          <div class="stat-chips-bar" id="chips-assigned" onclick="event.stopPropagation();"></div>
          <div class="stat-footer-bar">
            <span class="stat-badge-tag assigned"><i class="fa-solid fa-diagram-project"></i> Project Site Allocation</span>
            <span class="stat-drill-link" title="Open Sale Register">View Register <i class="fa-solid fa-arrow-up-right-from-square"></i></span>
          </div>
        </div>

        <!-- Total Sold & Dispatched Card -->
        <div class="stat-card sold" id="card-sold" data-kpi-key="sold">
          <div class="stat-card-header">
            <div class="stat-title-wrap">
              <span class="label">Total Dispatched</span>
              <span class="stat-sublabel" id="lbl-sold-ctx">Delivered to Clients</span>
            </div>
            <div class="stat-header-controls">
              <div class="stat-stepper-pill" onclick="event.stopPropagation();">
                <button type="button" class="stat-step-btn prev" data-card="sold" title="Previous Category"><i class="fa-solid fa-chevron-left"></i></button>
                <span class="stat-step-index" id="idx-sold">1 / 1</span>
                <button type="button" class="stat-step-btn next" data-card="sold" title="Next Category"><i class="fa-solid fa-chevron-right"></i></button>
              </div>
              <div class="stat-icon-wrap"><i class="fa-solid fa-file-invoice-dollar"></i></div>
            </div>
          </div>
          <div class="stat-viewport" id="viewport-sold">
            <div class="stat-main-metric">
              <div class="value" id="val-sold">0</div>
              <span class="stat-unit">Nos</span>
            </div>
            <div class="stat-category-badge-wrap">
              <span class="stat-category-badge" id="tag-sold">
                <i class="fa-solid fa-layer-group"></i> Total All Stock
              </span>
              <span class="stat-pct-badge" id="pct-sold">100% Volume</span>
            </div>
          </div>
          <div class="stat-chips-bar" id="chips-sold" onclick="event.stopPropagation();"></div>
          <div class="stat-footer-bar">
            <span class="stat-badge-tag sold"><i class="fa-solid fa-truck-fast"></i> Dispatched &amp; Invoiced</span>
            <span class="stat-drill-link" title="Open Sale Register">View Register <i class="fa-solid fa-arrow-up-right-from-square"></i></span>
          </div>
        </div>

        <!-- Damaged & RMA Card -->
        <div class="stat-card damaged" id="card-damaged" data-kpi-key="damaged">
          <div class="stat-card-header">
            <div class="stat-title-wrap">
              <span class="label">Damaged / RMA</span>
              <span class="stat-sublabel" id="lbl-damaged-ctx">Quality &amp; Inspection</span>
            </div>
            <div class="stat-header-controls">
              <div class="stat-stepper-pill" onclick="event.stopPropagation();">
                <button type="button" class="stat-step-btn prev" data-card="damaged" title="Previous Category"><i class="fa-solid fa-chevron-left"></i></button>
                <span class="stat-step-index" id="idx-damaged">1 / 1</span>
                <button type="button" class="stat-step-btn next" data-card="damaged" title="Next Category"><i class="fa-solid fa-chevron-right"></i></button>
              </div>
              <div class="stat-icon-wrap"><i class="fa-solid fa-shield-halved"></i></div>
            </div>
          </div>
          <div class="stat-viewport" id="viewport-damaged">
            <div class="stat-main-metric">
              <div class="value" id="val-damaged">0</div>
              <span class="stat-unit">Nos</span>
            </div>
            <div class="stat-category-badge-wrap">
              <span class="stat-category-badge" id="tag-damaged">
                <i class="fa-solid fa-layer-group"></i> Total All Stock
              </span>
              <span class="stat-pct-badge" id="pct-damaged">100% Volume</span>
            </div>
          </div>
          <div class="stat-chips-bar" id="chips-damaged" onclick="event.stopPropagation();"></div>
          <div class="stat-footer-bar">
            <span class="stat-badge-tag damaged"><i class="fa-solid fa-circle-check"></i> Quality Inspected</span>
            <span class="stat-drill-link" title="Open Return Register">View Returns <i class="fa-solid fa-arrow-up-right-from-square"></i></span>
          </div>
        </div>

      </div>

      <!-- Advanced ERP Daily Operations Pulse & Live Telemetry Hub -->
      <div class="dash-pulse-grid" data-widget="w_operations_pulse">
        <div class="dash-pulse-card">
          <div class="dash-pulse-header">
            <div class="dash-pulse-title">
              <i class="fa-solid fa-chart-line" style="color:var(--gold);"></i>
              <h4>Today's Enterprise Operations Pulse</h4>
            </div>
            <span class="dash-pulse-date" id="dashPulseDate">Live Today</span>
          </div>
          
          <div class="dash-pulse-metrics">
            <div class="dash-pulse-stat" onclick="go('purchaseregister')" style="cursor:pointer;" title="View Purchase Inwards">
              <div class="pulse-stat-icon in"><i class="fa-solid fa-arrow-down-long"></i></div>
              <div class="pulse-stat-info">
                <span class="pulse-stat-label">Inward Received (Today)</span>
                <div class="pulse-stat-val"><span id="dashTodayInwardQty">0</span> <small>Nos</small></div>
                <span class="pulse-stat-sub"><span id="dashTodayInwardInvoices">0</span> Inward Invoices</span>
              </div>
            </div>

            <div class="dash-pulse-stat" onclick="go('saleregister')" style="cursor:pointer;" title="View Sales Dispatches">
              <div class="pulse-stat-icon out"><i class="fa-solid fa-arrow-up-long"></i></div>
              <div class="pulse-stat-info">
                <span class="pulse-stat-label">Dispatched to Projects</span>
                <div class="pulse-stat-val"><span id="dashTodayDispatchQty">0</span> <small>Nos</small></div>
                <span class="pulse-stat-sub"><span id="dashTodayDispatchChallans">0</span> Delivery Challans</span>
              </div>
            </div>

            <div class="dash-pulse-stat" onclick="go('bom')" style="cursor:pointer;" title="View Project BOM & Delivery Challans">
              <div class="pulse-stat-icon challan"><i class="fa-solid fa-file-invoice"></i></div>
              <div class="pulse-stat-info">
                <span class="pulse-stat-label">BOM &amp; Project Challans</span>
                <div class="pulse-stat-val"><span id="dashActiveChallans">0</span> <small>Challans</small></div>
                <span class="pulse-stat-sub">Active Site Dispatches</span>
              </div>
            </div>

            <div class="dash-pulse-stat" onclick="go('reports')" style="cursor:pointer;" title="View Warehouses Stock">
              <div class="pulse-stat-icon wh"><i class="fa-solid fa-warehouse"></i></div>
              <div class="pulse-stat-info">
                <span class="pulse-stat-label">Active Godowns</span>
                <div class="pulse-stat-val"><span id="dashWarehousesCount">1</span> <small>Hubs</small></div>
                <span class="pulse-stat-sub">Multi-Godown Live Sync</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Category Snapshot Table Panel with Filter Pills -->
      <div class="dashboard-grid">
        <div class="dash-table-panel" data-widget="w_category_snapshot">
          <div class="dash-table-header-row">
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
              <h3><i class="fa-solid fa-layer-group"></i> Category-wise Inventory Matrix</h3>
              <div class="dash-cat-pills" id="dashCatPills">
                <button type="button" class="dash-cat-pill active" data-filter="ALL">All Categories</button>
                <button type="button" class="dash-cat-pill" data-filter="SOLAR">Solar Panels</button>
                <button type="button" class="dash-cat-pill" data-filter="INVERTER">Inverters</button>
                <button type="button" class="dash-cat-pill" data-filter="STRUCTURE">Structures</button>
                <button type="button" class="dash-cat-pill" data-filter="CIVIL">Civil &amp; BOS</button>
              </div>
            </div>
            <div class="dash-table-tools">
              <div class="dash-table-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="dashCatSearchInput" placeholder="Quick search category...">
              </div>
            </div>
          </div>
          <div class="table-wrap">
            <table id="dashSnapshotTable">
              <thead>
                <tr>
                  <th data-col="Category" style="min-width:180px;">Category <button class="th-filter-btn" data-col="Category" type="button"><i class="fa-solid fa-filter"></i></button></th>
                  <th data-col="Share" style="min-width:140px;">Warehouse Share</th>
                  <th data-col="Avail." style="text-align:right;">Available</th>
                  <th data-col="Assigned" style="text-align:right;">Assigned</th>
                  <th data-col="Sold" style="text-align:right;">Sold</th>
                  <th data-col="Damaged" style="text-align:right;">Damaged</th>
                  <th style="width:90px; text-align:center;">Action</th>
                </tr>
              </thead>
              <tbody id="dashSnapshotBody">
                <tr><td colspan="7" style="text-align:center;color:var(--txt-muted);padding:24px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading live data…</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`,

  init() {
    function getCategoryIcon(cat) {
      const c = String(cat || '').toUpperCase();
      if (c.includes('SOLAR') || c.includes('PANEL')) return 'fa-solar-panel';
      if (c.includes('INVERTER')) return 'fa-bolt';
      if (c.includes('BATTERY')) return 'fa-car-battery';
      if (c.includes('STRUCTURE') || c.includes('PIPE')) return 'fa-cubes-stacked';
      if (c.includes('WIRE') || c.includes('ELECTRICAL')) return 'fa-plug';
      if (c.includes('FASTNER') || c.includes('NOZZLE')) return 'fa-screwdriver-wrench';
      if (c.includes('CIVIL')) return 'fa-trowel-bricks';
      if (c.includes('EARTHING')) return 'fa-shield-halved';
      return 'fa-box';
    }

    function qtyPill(val, type) {
      const n = Number(val || 0);
      if (n <= 0) return `<span class="dash-qty-pill zero">0</span>`;
      return `<span class="dash-qty-pill ${type}">${n.toLocaleString('en-IN')}</span>`;
    }

    function updateLiveGreeting() {
      const greetingEl = document.getElementById('dashUserGreeting');
      if (greetingEl) {
        greetingEl.textContent = window.currentUsername || 'Admin';
      }
      const clockEl = document.getElementById('dashLiveClock');
      if (clockEl) {
        const now = new Date();
        clockEl.textContent = now.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' }) + ' • ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      }
      const pulseDateEl = document.getElementById('dashPulseDate');
      if (pulseDateEl) {
        pulseDateEl.textContent = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      }
    }
    updateLiveGreeting();

    const KPI_CONFIGS = {
      avail: { targetPage: 'reports', defaultSub: 'All Godown Inventory' },
      assigned: { targetPage: 'saleregister', defaultSub: 'Allocated to Projects' },
      sold: { targetPage: 'saleregister', defaultSub: 'Delivered to Clients' },
      damaged: { targetPage: 'returns', defaultSub: 'Quality & Inspection' }
    };

    const cardSlides = { avail: [], assigned: [], sold: [], damaged: [] };
    const cardState = { avail: 0, assigned: 0, sold: 0, damaged: 0 };

    function formatNumber(n) {
      return Number(n || 0).toLocaleString('en-IN');
    }

    function animateCountUp(el, endValue, duration = 500) {
      if (!el) return;
      const target = Number(endValue) || 0;
      const gap = Math.min(60, Math.max(5, Math.round(target * 0.15)));
      const start = Math.max(0, target - gap);
      const startTime = performance.now();
      function tick(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(start + (target - start) * eased);
        el.textContent = current.toLocaleString('en-IN');
        if (progress < 1) requestAnimationFrame(tick);
        else el.textContent = target.toLocaleString('en-IN');
      }
      requestAnimationFrame(tick);
    }

    function goToSlide(cardKey, targetIndex, animate = true) {
      const slides = cardSlides[cardKey];
      if (!slides || !slides.length) return;

      const newIndex = ((targetIndex % slides.length) + slides.length) % slides.length;
      cardState[cardKey] = newIndex;
      const slide = slides[newIndex];

      const valEl = document.getElementById(`val-${cardKey}`);
      const lblEl = document.getElementById(`lbl-${cardKey}-ctx`);
      const tagEl = document.getElementById(`tag-${cardKey}`);
      const pctEl = document.getElementById(`pct-${cardKey}`);
      const idxEl = document.getElementById(`idx-${cardKey}`);

      if (valEl) {
        if (animate) animateCountUp(valEl, slide.count, 400);
        else valEl.textContent = formatNumber(slide.count);
      }
      if (lblEl) lblEl.textContent = slide.sub;
      if (tagEl) tagEl.innerHTML = `<i class="fa-solid ${slide.icon}"></i> ${slide.name}`;
      if (pctEl) pctEl.textContent = slide.pct;
      if (idxEl) idxEl.textContent = `${newIndex + 1} / ${slides.length}`;

      // Update active chip
      const chipsBar = document.getElementById(`chips-${cardKey}`);
      if (chipsBar) {
        chipsBar.querySelectorAll('.stat-chip').forEach((chip, i) => {
          const isActive = i === newIndex;
          chip.classList.toggle('active', isActive);
          if (isActive) {
            chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        });
      }
    }

    function setupCardCarousel(cardKey, totalCount, categories) {
      const total = Number(totalCount || 0);
      const slides = [
        {
          name: 'Total All Stock',
          icon: 'fa-layer-group',
          count: total,
          pct: '100% Volume',
          sub: KPI_CONFIGS[cardKey].defaultSub
        }
      ];

      categories.forEach((cat) => {
        const count = Number(cat[cardKey] || 0);
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) + '% Share' : '0%';
        slides.push({
          name: cat.category,
          icon: getCategoryIcon(cat.category),
          count: count,
          pct: pct,
          sub: `Showing ${cat.category}`
        });
      });

      cardSlides[cardKey] = slides;
      cardState[cardKey] = 0;

      // Render horizontal chips
      const chipsBar = document.getElementById(`chips-${cardKey}`);
      if (chipsBar) {
        chipsBar.innerHTML = slides.map((s, idx) => `
          <button type="button" class="stat-chip${idx === 0 ? ' active' : ''}" data-card="${cardKey}" data-index="${idx}" title="${s.name}: ${s.count}">
            <i class="fa-solid ${s.icon}"></i>
            <span>${idx === 0 ? 'All' : s.name}</span>
            <span class="stat-chip-count">${s.count > 0 ? formatNumber(s.count) : '0'}</span>
          </button>
        `).join('');

        chipsBar.querySelectorAll('.stat-chip').forEach((chip) => {
          chip.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = Number(chip.dataset.index || 0);
            goToSlide(cardKey, idx, true);
          });
        });
      }

      // Hook Stepper Prev/Next Buttons
      const cardEl = document.getElementById(`card-${cardKey}`);
      if (cardEl) {
        const prevBtn = cardEl.querySelector('.stat-step-btn.prev');
        const nextBtn = cardEl.querySelector('.stat-step-btn.next');

        if (prevBtn) {
          prevBtn.onclick = (e) => {
            e.stopPropagation();
            goToSlide(cardKey, cardState[cardKey] - 1, true);
          };
        }
        if (nextBtn) {
          nextBtn.onclick = (e) => {
            e.stopPropagation();
            goToSlide(cardKey, cardState[cardKey] + 1, true);
          };
        }

        // Touch Swipe
        const viewport = document.getElementById(`viewport-${cardKey}`);
        if (viewport) {
          let touchStartX = null;
          viewport.ontouchstart = (e) => { touchStartX = e.touches[0].clientX; };
          viewport.ontouchend = (e) => {
            if (touchStartX === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(dx) > 30) {
              goToSlide(cardKey, dx < 0 ? cardState[cardKey] + 1 : cardState[cardKey] - 1, true);
            }
            touchStartX = null;
          };
        }

        // Card Click Jump
        cardEl.onclick = () => {
          const cfg = KPI_CONFIGS[cardKey];
          if (cfg && cfg.targetPage) {
            window.go(cfg.targetPage);
          }
        };
      }

      goToSlide(cardKey, 0, false);
    }

    // Pull real numbers from shared database
    async function loadRealDashboardData() {
      if (!window.Api) return;
      try {
        const data = await window.Api.get('/dashboard/summary');

        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        // Top Solar Bar
        animateCountUp(document.getElementById('dashSolarKwVal'), data.solarKw || 0);
        animateCountUp(document.getElementById('dashInvertersVal'), data.invertersCount || 0);
        animateCountUp(document.getElementById('dashBatteriesVal'), data.batteriesCount || 0);
        animateCountUp(document.getElementById('dashTotalItemsVal'), data.totalItems || 0);
        setText('dashLowStockCount', `${data.lowStockCount || 0} items`);

        // Daily Operations Pulse
        animateCountUp(document.getElementById('dashTodayInwardQty'), data.todayInwardQty || 0);
        setText('dashTodayInwardInvoices', data.todayInwardInvoices || 0);
        animateCountUp(document.getElementById('dashTodayDispatchQty'), data.todayDispatchQty || 0);
        setText('dashTodayDispatchChallans', data.todayDispatchChallans || 0);
        animateCountUp(document.getElementById('dashActiveChallans'), data.activeChallans || 0);
        setText('dashWarehousesCount', data.warehousesCount || 1);

        const cats = Array.isArray(data.categorySnapshot) ? data.categorySnapshot : [];

        let panelsAvail = 0;
        cats.forEach((r) => {
          const c = String(r.category || '').toUpperCase();
          if (c.includes('SOLAR') || c.includes('PANEL')) {
            panelsAvail += Number(r.avail || 0);
          }
        });
        setText('dashSolarPanelsSub', `${formatNumber(panelsAvail)} Panels • Active Gen Stock`);

        // Initialize 4 Advanced Interactive Category Carousels
        setupCardCarousel('avail', data.available, cats);
        setupCardCarousel('assigned', data.assigned, cats);
        setupCardCarousel('sold', data.sold, cats);
        setupCardCarousel('damaged', data.damaged, cats);

        renderCategorySnapshotTable(cats, Number(data.available || 0));

      } catch (err) {
        console.warn('[Dashboard] Could not reach API:', err.message);
        const snapshotBody = document.getElementById('dashSnapshotBody');
        if (snapshotBody) {
          snapshotBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--txt-muted);padding:20px;">No data available.</td></tr>`;
        }
      }
    }

    function renderCategorySnapshotTable(cats, totalAvailSum) {
      const snapshotBody = document.getElementById('dashSnapshotBody');
      if (!snapshotBody) return;

      if (!cats || !cats.length) {
        snapshotBody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--txt-muted);padding:24px;">No categories found.</td></tr>`;
        return;
      }

      const totalAvail = totalAvailSum > 0 ? totalAvailSum : cats.reduce((s, r) => s + Number(r.avail || 0), 0) || 1;

      snapshotBody.innerHTML = cats.map((r) => {
        const availNum = Number(r.avail || 0);
        const pct = Math.min(100, ((availNum / totalAvail) * 100)).toFixed(1);

        return `
          <tr data-cat-name="${r.category.toUpperCase()}">
            <td data-label="Category">
              <div class="dash-category-cell">
                <div class="dash-cat-icon"><i class="fa-solid ${getCategoryIcon(r.category)}"></i></div>
                <span>${r.category}</span>
              </div>
            </td>
            <td data-label="Share">
              <div style="display:flex; flex-direction:column; gap:3px;">
                <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--txt-muted);">
                  <span>${pct}% share</span>
                  <span>${availNum.toLocaleString('en-IN')} units</span>
                </div>
                <div style="height:5px; background:rgba(255,255,255,0.06); border-radius:3px; overflow:hidden;">
                  <div style="height:100%; width:${pct}%; background:var(--blue); border-radius:3px;"></div>
                </div>
              </div>
            </td>
            <td data-label="Avail." style="text-align:right;">${qtyPill(r.avail, 'avail')}</td>
            <td data-label="Assigned" style="text-align:right;">${qtyPill(r.assigned, 'active')}</td>
            <td data-label="Sold" style="text-align:right;">${qtyPill(r.sold, 'sold')}</td>
            <td data-label="Damaged" style="text-align:right;">${qtyPill(r.damaged, 'damaged')}</td>
            <td style="text-align:center;">
              <button type="button" class="btn btn-ghost" onclick="go('reports')" title="View in Master Reports" style="padding:3px 8px; font-size:11px; color:var(--blue);">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    loadRealDashboardData();

    // Category Pill Filters
    const catPillsWrap = document.getElementById('dashCatPills');
    if (catPillsWrap) {
      catPillsWrap.addEventListener('click', (e) => {
        const pill = e.target.closest('.dash-cat-pill');
        if (!pill) return;
        catPillsWrap.querySelectorAll('.dash-cat-pill').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');

        const filter = pill.getAttribute('data-filter') || 'ALL';
        const rows = document.querySelectorAll('#dashSnapshotBody tr');
        rows.forEach((tr) => {
          const catName = tr.getAttribute('data-cat-name') || '';
          if (filter === 'ALL') {
            tr.style.display = '';
          } else if (filter === 'SOLAR' && (catName.includes('SOLAR') || catName.includes('PANEL'))) {
            tr.style.display = '';
          } else if (filter === 'INVERTER' && catName.includes('INVERTER')) {
            tr.style.display = '';
          } else if (filter === 'STRUCTURE' && (catName.includes('STRUCTURE') || catName.includes('PIPE') || catName.includes('FASTNER'))) {
            tr.style.display = '';
          } else if (filter === 'CIVIL' && (catName.includes('CIVIL') || catName.includes('EARTHING') || catName.includes('ELECTRICAL') || catName.includes('WIRE'))) {
            tr.style.display = '';
          } else {
            tr.style.display = 'none';
          }
        });
      });
    }

    // Instant Search Filter for Snapshot table
    const catSearchInput = document.getElementById('dashCatSearchInput');
    if (catSearchInput) {
      catSearchInput.addEventListener('input', () => {
        const q = catSearchInput.value.toLowerCase().trim();
        const rows = document.querySelectorAll('#dashSnapshotBody tr');
        rows.forEach((tr) => {
          const text = tr.textContent.toLowerCase();
          tr.style.display = (!q || text.includes(q)) ? '' : 'none';
        });
      });
    }

    // Refresh Button Handler
    const refreshBtn = document.getElementById('dashRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('rotating');
        await loadRealDashboardData();
        setTimeout(() => refreshBtn.classList.remove('rotating'), 600);
        if (window.showToast) window.showToast('Dashboard data refreshed.', 'info');
      });
    }

    // =========================================================================
    // CUSTOMIZABLE DASHBOARD METRICS & WIDGET CONFIGURATION
    // =========================================================================
    const DASHBOARD_WIDGETS = [
      { id: 'w_welcome', name: 'Welcome & Quick Action Header', icon: 'fa-hand-wave', desc: 'Greeting, live clock badge, and 1-click action shortcuts' },
      { id: 'w_solar_capacity', name: 'Solar Capacity & Power Portfolio', icon: 'fa-solar-panel', desc: 'Total solar KW capacity, inverters count, and batteries in stock' },
      { id: 'w_kpi_cards', name: 'Core Inventory KPI Cards', icon: 'fa-chart-simple', desc: '4 Big metric cards with interactive category stepper carousels' },
      { id: 'w_lowstock', name: 'Low Stock Alert Banner', icon: 'fa-triangle-exclamation', desc: 'Replenishment urgency notification when items hit minimum levels' },
      { id: 'w_operations_pulse', name: "Today's Enterprise Operations Pulse", icon: 'fa-chart-line', desc: 'Daily inward, project dispatch, and BOM challan velocity' },
      { id: 'w_category_snapshot', name: 'Category-wise Inventory Matrix', icon: 'fa-table-cells', desc: 'Detailed table of stock counts per category with filters' },
    ];

    function getWidgetPrefs() {
      try {
        const raw = localStorage.getItem('egs_dashboard_widgets_v1');
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      const defaults = {};
      DASHBOARD_WIDGETS.forEach((w) => { defaults[w.id] = true; });
      return defaults;
    }

    function applyWidgetVisibility() {
      const prefs = getWidgetPrefs();
      DASHBOARD_WIDGETS.forEach((w) => {
        const isVisible = prefs[w.id] !== false;
        const els = document.querySelectorAll(`[data-widget="${w.id}"]`);
        els.forEach((el) => {
          el.style.display = isVisible ? '' : 'none';
        });
      });
    }

    applyWidgetVisibility();

    function openCustomizerModal() {
      const currentPrefs = getWidgetPrefs();
      const html = `
        <div style="background:rgba(59,142,208,0.1); border:1px solid rgba(59,142,208,0.3); border-radius:10px; padding:10px 14px; margin-bottom:14px; font-size:12px; color:var(--txt); display:flex; align-items:center; gap:10px;">
          <i class="fa-solid fa-circle-info" style="color:var(--blue); font-size:16px;"></i>
          <span><b>Tip:</b> You can customize or restore widgets anytime from the header button or <b>System Settings ➔ Appearance</b>.</span>
        </div>
        <div class="dash-customizer-grid">
          ${DASHBOARD_WIDGETS.map((w) => `
            <div class="dash-customizer-item">
              <div class="dash-customizer-meta">
                <div class="dash-customizer-icon"><i class="fa-solid ${w.icon}"></i></div>
                <div class="dash-customizer-text">
                  <h4>${w.name}</h4>
                  <p>${w.desc}</p>
                </div>
              </div>
              <label class="egs-switch">
                <input type="checkbox" data-custom-widget="${w.id}" ${currentPrefs[w.id] !== false ? 'checked' : ''}>
                <span class="egs-switch-slider"></span>
              </label>
            </div>
          `).join('')}
        </div>
        <div class="actions-row" style="margin-top:18px; justify-content:space-between; border-top:1px solid var(--border-light); padding-top:14px;">
          <button type="button" class="btn btn-ghost" id="dashResetWidgetsBtn"><i class="fa-solid fa-rotate-left"></i> Reset to Default</button>
          <button type="button" class="btn btn-green" id="dashSaveWidgetsBtn"><i class="fa-solid fa-floppy-disk"></i> Save Dashboard Layout</button>
        </div>
      `;

      window.openModal('⚙️ Customize Dashboard Widgets', html, { size: 'medium' });

      const saveBtn = document.getElementById('dashSaveWidgetsBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          const newPrefs = {};
          document.querySelectorAll('[data-custom-widget]').forEach((input) => {
            const wid = input.dataset.customWidget;
            newPrefs[wid] = input.checked;
          });
          localStorage.setItem('egs_dashboard_widgets_v1', JSON.stringify(newPrefs));
          applyWidgetVisibility();
          window.closeModal();
          if (window.showSuccess) {
            window.showSuccess('Layout Saved Successfully', 'Your customized dashboard metrics and widget preferences have been saved.');
          } else if (window.showToast) {
            window.showToast('Dashboard layout saved!', 'success');
          }
          if (window.Api) {
            window.Api.put('/auth/preferences', { dashboard_widgets: newPrefs }).catch(() => {});
          }
        });
      }

      const resetBtn = document.getElementById('dashResetWidgetsBtn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          document.querySelectorAll('[data-custom-widget]').forEach((input) => {
            input.checked = true;
          });
        });
      }
    }

    // Expose globally
    window.openDashboardCustomizerModal = openCustomizerModal;

    const customizeBtn = document.getElementById('dashCustomizeBtn');
    if (customizeBtn) {
      customizeBtn.addEventListener('click', openCustomizerModal);
    }

    // Category-wise Snapshot: Excel Header Filters
    const tbody = document.getElementById('dashSnapshotBody');
    const filterBtns = document.querySelectorAll('#dashSnapshotTable .th-filter-btn');
    if (tbody && filterBtns.length) {
      function liveRows() { return Array.from(tbody.querySelectorAll('tr')); }
      function buildColIndex(row) {
        const colIndex = {};
        if (!row) return colIndex;
        row.querySelectorAll('td').forEach((td, i) => {
          const key = td.dataset.label || (td.getAttribute('data-label') || '').trim();
          if (key) colIndex[key] = i;
        });
        if (!Object.keys(colIndex).length) {
          ['Category', 'Share', 'Avail.', 'Assigned', 'Sold', 'Damaged'].forEach((k, i) => { colIndex[k] = i; });
        }
        return colIndex;
      }
      const activeFilters = {};
      let openMenuEl = null;

      function cellValue(row, col) {
        const colIndex = buildColIndex(row);
        const idx = colIndex[col];
        if (idx == null || !row.children[idx]) return '';
        return row.children[idx].textContent.trim();
      }
      function uniqueValues(col) {
        return Array.from(new Set(liveRows().map((r) => cellValue(r, col)).filter(Boolean)));
      }
      function applyAllFilters() {
        liveRows().forEach((row) => {
          const visible = Object.keys(activeFilters).every((col) => activeFilters[col].has(cellValue(row, col)));
          row.style.display = visible ? '' : 'none';
        });
        filterBtns.forEach((b) => b.classList.toggle('active', !!activeFilters[b.dataset.col]));
      }

      function closeMenu() {
        if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; }
      }

      function positionMenu(menu, targetBtn) {
        const rect = targetBtn.getBoundingClientRect();
        const menuWidth = 210;
        let left = rect.left;
        if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;
        menu.style.left = Math.max(10, left) + 'px';
        menu.style.top = (rect.bottom + 4) + 'px';
      }

      function openMenuFor(targetBtn) {
        const col = targetBtn.dataset.col;
        closeMenu();

        const values = uniqueValues(col);
        if (!values.length) {
          if (window.showToast) window.showToast('Table data still loading…');
          return;
        }
        const selected = activeFilters[col] || new Set(values);

        const menu = document.createElement('div');
        menu.className = 'th-filter-menu show';
        menu.innerHTML = `
          <div class="th-filter-search"><input type="text" placeholder="Search..."></div>
          <label class="th-filter-item th-filter-selectall">
            <input type="checkbox" ${selected.size === values.length ? 'checked' : ''}> <span>Select All</span>
          </label>
          <div class="th-filter-list">
            ${values.map((v) => `
              <label class="th-filter-item">
                <input type="checkbox" value="${v}" ${selected.has(v) ? 'checked' : ''}> <span>${v}</span>
              </label>`).join('')}
          </div>
          <div class="th-filter-actions">
            <button type="button" class="btn btn-ghost th-filter-clear">Clear</button>
            <button type="button" class="btn btn-blue th-filter-ok">OK</button>
          </div>`;

        document.body.appendChild(menu);
        positionMenu(menu, targetBtn);
        openMenuEl = menu;

        const selectAllCb = menu.querySelector('.th-filter-selectall input');
        const itemCbs = () => Array.from(menu.querySelectorAll('.th-filter-list input'));
        const searchInput = menu.querySelector('.th-filter-search input');

        selectAllCb.addEventListener('change', () => {
          itemCbs().forEach((cb) => { if (cb.closest('.th-filter-item').style.display !== 'none') cb.checked = selectAllCb.checked; });
        });

        searchInput.addEventListener('input', () => {
          const q = searchInput.value.toLowerCase();
          menu.querySelectorAll('.th-filter-list .th-filter-item').forEach((item) => {
            item.style.display = item.textContent.trim().toLowerCase().includes(q) ? '' : 'none';
          });
        });

        menu.querySelector('.th-filter-clear').addEventListener('click', () => {
          delete activeFilters[col];
          closeMenu();
          applyAllFilters();
        });

        menu.querySelector('.th-filter-ok').addEventListener('click', () => {
          const checked = itemCbs().filter((cb) => cb.checked).map((cb) => cb.value);
          if (checked.length === values.length) delete activeFilters[col];
          else activeFilters[col] = new Set(checked);
          closeMenu();
          applyAllFilters();
        });

        menu.addEventListener('click', (e) => e.stopPropagation());
      }

      filterBtns.forEach((b) => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          const wasOpenForThisBtn = openMenuEl && openMenuEl.dataset.forCol === b.dataset.col;
          closeMenu();
          if (!wasOpenForThisBtn) { openMenuFor(b); openMenuEl.dataset.forCol = b.dataset.col; }
        });
      });

      document.addEventListener('click', closeMenu);
      function onScroll(e) {
        if (openMenuEl && e.target && openMenuEl.contains(e.target)) return;
        closeMenu();
      }
      window.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', closeMenu);
    }
  }
};
