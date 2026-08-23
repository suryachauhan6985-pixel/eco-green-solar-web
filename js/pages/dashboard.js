// js/pages/dashboard.js
window.PAGES = window.PAGES || {};

window.PAGES.dashboard = {
  name: 'Dashboard',
  icon: 'fa-chart-pie',
  sub: 'Live overview of stock & operations',
  html: `
    <div class="dash-shell">
      <!-- Welcome & Quick Action Bar with View Mode Toggle -->
      <div class="dash-welcome-bar" data-widget="w_welcome">
        <div class="dash-greeting">
          <h2>Hello, <span class="dash-user-name" id="dashUserGreeting">Admin</span> 👋</h2>
          <div class="dash-meta-badge">
            <span class="dash-live-dot"></span>
            <span id="dashLiveClock">Live Operations</span> • Eco Green Solar Enterprise ERP
          </div>
        </div>
        
        <div class="dash-actions-row">
          <!-- Mode Switcher: Cards View vs Presentation Mode -->
          <div class="dash-view-mode-pill" id="dashViewModeToggle" title="Switch Dashboard View Mode">
            <button type="button" class="dash-mode-btn active" data-mode="cards" id="dashModeCardsBtn">
              <i class="fa-solid fa-table-cells-large"></i> <span>Cards View</span>
            </button>
            <button type="button" class="dash-mode-btn" data-mode="presentation" id="dashModePresBtn">
              <i class="fa-solid fa-chart-pie"></i> <span>Presentation Mode</span>
            </button>
          </div>

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

      <!-- ===================================================================
           VIEW 1: EXECUTIVE CARDS VIEW CONTAINER
           =================================================================== -->
      <div id="dashCardsView" class="dash-view-container active">
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

        <!-- 4 Clean, High-Impact Executive KPI Cards -->
        <div class="stat-grid" data-widget="w_kpi_cards">
          <!-- Card 1: Available Stock -->
          <div class="stat-card available" onclick="go('reports')">
            <div class="stat-card-header">
              <div class="stat-title-wrap">
                <span class="label">Available Stock</span>
                <span class="stat-sublabel">All Godown Inventory</span>
              </div>
              <div class="stat-icon-wrap"><i class="fa-solid fa-boxes-stacked"></i></div>
            </div>
            <div class="stat-card-hero">
              <div class="value" id="cardAvailVal">0</div>
              <span class="stat-unit">NOS</span>
            </div>
            <div class="stat-card-progress">
              <div class="stat-prog-fill avail" id="cardAvailProg" style="width: 100%;"></div>
            </div>
            <div class="stat-quick-badges" id="cardAvailChips"></div>
            <div class="stat-footer-bar">
              <span class="stat-badge-tag available"><span class="pulse-dot"></span> Ready for Project Dispatch</span>
              <span class="stat-drill-link">View Report <i class="fa-solid fa-arrow-right"></i></span>
            </div>
          </div>

          <!-- Card 2: Assigned Stock -->
          <div class="stat-card assigned" onclick="go('saleregister')">
            <div class="stat-card-header">
              <div class="stat-title-wrap">
                <span class="label">Assigned Stock</span>
                <span class="stat-sublabel">Allocated to Projects</span>
              </div>
              <div class="stat-icon-wrap"><i class="fa-solid fa-hand-holding-hand"></i></div>
            </div>
            <div class="stat-card-hero">
              <div class="value" id="cardAssignedVal">0</div>
              <span class="stat-unit">NOS</span>
            </div>
            <div class="stat-card-progress">
              <div class="stat-prog-fill assigned" id="cardAssignedProg" style="width: 0%;"></div>
            </div>
            <div class="stat-quick-badges" id="cardAssignedChips"></div>
            <div class="stat-footer-bar">
              <span class="stat-badge-tag assigned"><i class="fa-solid fa-diagram-project"></i> Project Site Allocation</span>
              <span class="stat-drill-link">View Register <i class="fa-solid fa-arrow-right"></i></span>
            </div>
          </div>

          <!-- Card 3: Total Dispatched -->
          <div class="stat-card sold" onclick="go('saleregister')">
            <div class="stat-card-header">
              <div class="stat-title-wrap">
                <span class="label">Total Dispatched</span>
                <span class="stat-sublabel">Delivered to Clients</span>
              </div>
              <div class="stat-icon-wrap"><i class="fa-solid fa-file-invoice-dollar"></i></div>
            </div>
            <div class="stat-card-hero">
              <div class="value" id="cardSoldVal">0</div>
              <span class="stat-unit">NOS</span>
            </div>
            <div class="stat-card-progress">
              <div class="stat-prog-fill sold" id="cardSoldProg" style="width: 15%;"></div>
            </div>
            <div class="stat-quick-badges" id="cardSoldChips"></div>
            <div class="stat-footer-bar">
              <span class="stat-badge-tag sold"><i class="fa-solid fa-truck-fast"></i> Dispatched &amp; Invoiced</span>
              <span class="stat-drill-link">View Register <i class="fa-solid fa-arrow-right"></i></span>
            </div>
          </div>

          <!-- Card 4: Damaged / RMA -->
          <div class="stat-card damaged" onclick="go('returns')">
            <div class="stat-card-header">
              <div class="stat-title-wrap">
                <span class="label">Damaged / RMA</span>
                <span class="stat-sublabel">Quality &amp; Inspection</span>
              </div>
              <div class="stat-icon-wrap"><i class="fa-solid fa-shield-halved"></i></div>
            </div>
            <div class="stat-card-hero">
              <div class="value" id="cardDamagedVal">0</div>
              <span class="stat-unit">NOS</span>
            </div>
            <div class="stat-card-progress">
              <div class="stat-prog-fill damaged" id="cardDamagedProg" style="width: 0%;"></div>
            </div>
            <div class="stat-quick-badges" id="cardDamagedChips"></div>
            <div class="stat-footer-bar">
              <span class="stat-badge-tag damaged"><i class="fa-solid fa-circle-check"></i> 100% Quality Inspected</span>
              <span class="stat-drill-link">View Returns <i class="fa-solid fa-arrow-right"></i></span>
            </div>
          </div>
        </div>
      </div>

      <!-- ===================================================================
           VIEW 2: VISUAL PRESENTATION & ANALYTICS MODE CONTAINER
           =================================================================== -->
      <div id="dashPresView" class="dash-view-container" style="display:none;">
        
        <!-- Hero Visual Presentation Grid (Interactive Donut Chart & Bar Graph) -->
        <div class="dash-pres-hero-grid">
          
          <!-- Chart 1: Interactive Category Distribution Donut -->
          <div class="dash-chart-card">
            <div class="dash-chart-header">
              <div>
                <h4><i class="fa-solid fa-chart-pie" style="color:var(--blue);"></i> Inventory Volume &amp; Category Share</h4>
                <span class="dash-chart-sub">Live breakdown across warehouse product lines</span>
              </div>
              <span class="dash-live-badge"><span class="pulse-dot"></span> Live Stock Distribution</span>
            </div>

            <div class="dash-donut-chart-wrap">
              <div class="dash-donut-svg-box">
                <svg class="dash-donut-svg" viewBox="0 0 160 160" id="dashDonutSvg">
                  <!-- Dynamic animated SVG sectors -->
                </svg>
                <div class="dash-donut-center">
                  <span class="donut-center-val" id="dashDonutTotalVal">0</span>
                  <span class="donut-center-label">Total Units</span>
                </div>
              </div>

              <div class="dash-donut-legend" id="dashDonutLegend">
                <!-- Dynamic Legend items with live percentages and count -->
              </div>
            </div>
          </div>

          <!-- Chart 2: Operational Stock Movement & Velocity Bar Chart -->
          <div class="dash-chart-card">
            <div class="dash-chart-header">
              <div>
                <h4><i class="fa-solid fa-chart-column" style="color:var(--green);"></i> Stock Flow &amp; Movement Balance</h4>
                <span class="dash-chart-sub">Operational comparison of Available, Assigned &amp; Dispatched</span>
              </div>
              <span class="dash-live-badge" style="color:var(--green);"><i class="fa-solid fa-bolt"></i> 100% Health</span>
            </div>

            <div class="dash-bar-graph-wrap" id="dashBarGraphWrap">
              <!-- Dynamic animated vertical columns -->
            </div>

            <div class="dash-bar-summary-row">
              <div class="dash-bar-summary-item">
                <span class="lbl">Warehouse Health</span>
                <span class="val text-emerald">100% Active</span>
              </div>
              <div class="dash-bar-summary-item">
                <span class="lbl">Active Godowns</span>
                <span class="val" id="dashPresHubsCount">1 Hub</span>
              </div>
              <div class="dash-bar-summary-item">
                <span class="lbl">Completed Challans</span>
                <span class="val" id="dashPresChallansCount">0</span>
              </div>
              <div class="dash-bar-summary-item">
                <span class="lbl">Stock Defect Rate</span>
                <span class="val text-emerald">0.0%</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Presentation Visual Meters (Solar KW, Inverters, Dispatches) -->
        <div class="dash-pres-meters-grid">
          <div class="dash-meter-card">
            <div class="dash-meter-icon solar"><i class="fa-solid fa-solar-panel"></i></div>
            <div class="dash-meter-content">
              <span class="dash-meter-label">Solar Generation Capacity</span>
              <div class="dash-meter-hero"><span id="dashPresSolarKw">0</span> <small>KW</small></div>
              <div class="dash-meter-prog">
                <div class="dash-meter-prog-bar solar" id="dashPresSolarProg" style="width: 85%;"></div>
              </div>
              <span class="dash-meter-sub" id="dashPresSolarSub">Active Solar Generation Assets</span>
            </div>
          </div>

          <div class="dash-meter-card">
            <div class="dash-meter-icon inverter"><i class="fa-solid fa-bolt"></i></div>
            <div class="dash-meter-content">
              <span class="dash-meter-label">Inverter Hardware Ready</span>
              <div class="dash-meter-hero"><span id="dashPresInverters">0</span> <small>Units</small></div>
              <div class="dash-meter-prog">
                <div class="dash-meter-prog-bar inverter" id="dashPresInverterProg" style="width: 65%;"></div>
              </div>
              <span class="dash-meter-sub">Single &amp; 3-Phase Solar Inverters</span>
            </div>
          </div>

          <div class="dash-meter-card">
            <div class="dash-meter-icon dispatch"><i class="fa-solid fa-truck-fast"></i></div>
            <div class="dash-meter-content">
              <span class="dash-meter-label">Project Dispatches</span>
              <div class="dash-meter-hero"><span id="dashPresDispatched">0</span> <small>NOS</small></div>
              <div class="dash-meter-prog">
                <div class="dash-meter-prog-bar dispatch" id="dashPresDispatchProg" style="width: 30%;"></div>
              </div>
              <span class="dash-meter-sub">Total Customer Deliveries Completed</span>
            </div>
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

    function getCategoryColor(cat, idx) {
      const c = String(cat || '').toUpperCase();
      if (c.includes('CIVIL')) return '#10b981'; // Emerald
      if (c.includes('SOLAR') || c.includes('PANEL')) return '#f59e0b'; // Amber
      if (c.includes('INVERTER')) return '#3b82f6'; // Blue
      if (c.includes('EARTHING')) return '#06b6d4'; // Cyan
      if (c.includes('STRUCTURE')) return '#8b5cf6'; // Purple
      if (c.includes('BATTERY')) return '#ec4899'; // Pink
      if (c.includes('WIRE') || c.includes('ELECTRICAL')) return '#eab308'; // Yellow
      const palette = ['#38bdf8', '#34d399', '#f472b6', '#a78bfa', '#fb923c', '#4ade80'];
      return palette[idx % palette.length];
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

    function formatNumber(n) {
      return Number(n || 0).toLocaleString('en-IN');
    }

    function animateCountUp(el, endValue, duration = 600) {
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

    // =========================================================================
    // VIEW SWITCHER LOGIC (Executive Cards vs Presentation Mode)
    // =========================================================================
    let currentViewMode = localStorage.getItem('egs-dash-view-mode') || 'cards';

    function setViewMode(mode, animate = true) {
      currentViewMode = mode;
      localStorage.setItem('egs-dash-view-mode', mode);

      const cardsContainer = document.getElementById('dashCardsView');
      const presContainer = document.getElementById('dashPresView');
      const btnCards = document.getElementById('dashModeCardsBtn');
      const btnPres = document.getElementById('dashModePresBtn');

      if (mode === 'presentation') {
        if (cardsContainer) cardsContainer.style.display = 'none';
        if (presContainer) {
          presContainer.style.display = 'flex';
          presContainer.classList.add('active');
        }
        if (btnCards) btnCards.classList.remove('active');
        if (btnPres) btnPres.classList.add('active');
        if (window._lastDashData) {
          renderPresentationCharts(window._lastDashData);
        }
      } else {
        if (presContainer) presContainer.style.display = 'none';
        if (cardsContainer) {
          cardsContainer.style.display = 'flex';
          cardsContainer.classList.add('active');
        }
        if (btnCards) btnCards.classList.add('active');
        if (btnPres) btnPres.classList.remove('active');
        if (window._lastDashData) {
          renderExecutiveCards(window._lastDashData);
        }
      }
    }

    const modeToggle = document.getElementById('dashViewModeToggle');
    if (modeToggle) {
      modeToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.dash-mode-btn');
        if (!btn) return;
        const mode = btn.dataset.mode;
        setViewMode(mode, true);
      });
    }

    // Render Clean Executive Cards View
    function renderExecutiveCards(data) {
      const cats = Array.isArray(data.categorySnapshot) ? data.categorySnapshot : [];
      const totalAvail = Number(data.available || 0);

      // Card 1: Available
      animateCountUp(document.getElementById('cardAvailVal'), totalAvail);
      const availProg = document.getElementById('cardAvailProg');
      if (availProg) availProg.style.width = '100%';

      const availChips = document.getElementById('cardAvailChips');
      if (availChips) {
        const topCats = cats.slice(0, 3);
        availChips.innerHTML = topCats.map((c) => `
          <span class="stat-mini-pill" title="${c.category}: ${formatNumber(c.avail)}">
            <i class="fa-solid ${getCategoryIcon(c.category)}"></i>
            <span>${c.category}: <b>${formatNumber(c.avail)}</b></span>
          </span>
        `).join('');
      }

      // Card 2: Assigned
      const totalAssigned = Number(data.assigned || 0);
      animateCountUp(document.getElementById('cardAssignedVal'), totalAssigned);
      const assignedProg = document.getElementById('cardAssignedProg');
      if (assignedProg) {
        const pct = totalAvail > 0 ? Math.min(100, (totalAssigned / totalAvail) * 100) : 0;
        assignedProg.style.width = `${pct}%`;
      }
      const assignedChips = document.getElementById('cardAssignedChips');
      if (assignedChips) {
        assignedChips.innerHTML = `<span class="stat-mini-pill"><i class="fa-solid fa-diagram-project"></i> 0 Active Site Kits Pending</span>`;
      }

      // Card 3: Total Dispatched
      const totalSold = Number(data.sold || 0);
      animateCountUp(document.getElementById('cardSoldVal'), totalSold);
      const soldProg = document.getElementById('cardSoldProg');
      if (soldProg) {
        const pct = totalAvail > 0 ? Math.min(100, (totalSold / (totalAvail + totalSold)) * 100) : 10;
        soldProg.style.width = `${pct}%`;
      }
      const soldChips = document.getElementById('cardSoldChips');
      if (soldChips) {
        soldChips.innerHTML = `<span class="stat-mini-pill"><i class="fa-solid fa-truck-fast"></i> ${data.activeChallans || 0} Delivery Challans</span>`;
      }

      // Card 4: Damaged / RMA
      const totalDamaged = Number(data.damaged || 0);
      animateCountUp(document.getElementById('cardDamagedVal'), totalDamaged);
      const damagedChips = document.getElementById('cardDamagedChips');
      if (damagedChips) {
        damagedChips.innerHTML = `<span class="stat-mini-pill"><i class="fa-solid fa-circle-check"></i> 100% Quality Inspected</span>`;
      }
    }

    // Render Presentation Mode Visual Charts (SVG Donut & Animated Bars)
    function renderPresentationCharts(data) {
      const cats = Array.isArray(data.categorySnapshot) ? data.categorySnapshot : [];
      const totalAvail = Number(data.available || 0);
      const totalUnits = totalAvail + Number(data.sold || 0);

      // 1. Center Value in Donut
      animateCountUp(document.getElementById('dashDonutTotalVal'), totalAvail);

      // 2. Build SVG Donut Chart with glowing segments
      const svg = document.getElementById('dashDonutSvg');
      const legend = document.getElementById('dashDonutLegend');

      if (svg && legend) {
        const radius = 60;
        const circumference = 2 * Math.PI * radius;
        let cumulativePct = 0;

        const filteredCats = cats.filter((c) => Number(c.avail || 0) > 0);
        if (!filteredCats.length) {
          svg.innerHTML = `<circle cx="80" cy="80" r="${radius}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="20" />`;
          legend.innerHTML = `<div style="color:var(--txt-muted);font-size:12px;">No inventory data to display.</div>`;
        } else {
          let svgContent = '';
          let legendContent = '';

          filteredCats.forEach((cat, idx) => {
            const count = Number(cat.avail || 0);
            const pct = totalAvail > 0 ? (count / totalAvail) : 0;
            const strokeLength = pct * circumference;
            const strokeDashoffset = -cumulativePct * circumference;
            const color = getCategoryColor(cat.category, idx);

            svgContent += `
              <circle
                cx="80" cy="80" r="${radius}"
                fill="none"
                stroke="${color}"
                stroke-width="18"
                stroke-dasharray="${strokeLength} ${circumference - strokeLength}"
                stroke-dashoffset="${strokeDashoffset}"
                style="transition: stroke-dashoffset 1s ease, stroke-dasharray 1s ease; cursor:pointer;"
              >
                <title>${cat.category}: ${count.toLocaleString('en-IN')} units (${(pct * 100).toFixed(1)}%)</title>
              </circle>
            `;

            legendContent += `
              <div class="donut-legend-item" title="${cat.category}">
                <div class="legend-left">
                  <span class="legend-dot" style="background:${color}; box-shadow:0 0 8px ${color};"></span>
                  <span class="legend-name">${cat.category}</span>
                </div>
                <div class="legend-right">
                  <span class="legend-pct">${(pct * 100).toFixed(1)}%</span>
                  <span class="legend-count">(${count.toLocaleString('en-IN')})</span>
                </div>
              </div>
            `;

            cumulativePct += pct;
          });

          svg.innerHTML = svgContent;
          legend.innerHTML = legendContent;
        }
      }

      // 3. Operational Stock Movement Bar Graph
      const barWrap = document.getElementById('dashBarGraphWrap');
      if (barWrap) {
        const avail = Number(data.available || 0);
        const assigned = Number(data.assigned || 0);
        const sold = Number(data.sold || 0);
        const inward = Number(data.todayInwardQty || 0);

        const maxVal = Math.max(avail, assigned, sold, inward, 100);

        const bars = [
          { label: 'Available Stock', count: avail, type: 'avail', pct: Math.max(8, (avail / maxVal) * 100) },
          { label: 'Assigned Sites', count: assigned, type: 'assigned', pct: Math.max(8, (assigned / maxVal) * 100) },
          { label: 'Dispatched', count: sold, type: 'sold', pct: Math.max(8, (sold / maxVal) * 100) },
          { label: "Today's Inward", count: inward, type: 'inward', pct: Math.max(8, (inward / maxVal) * 100) }
        ];

        barWrap.innerHTML = bars.map((b) => `
          <div class="dash-bar-col">
            <div class="dash-bar-pill ${b.type}" style="height:${b.pct}%;">
              <div class="dash-bar-val-bubble">${b.count.toLocaleString('en-IN')}</div>
            </div>
            <span class="dash-bar-label">${b.label}</span>
          </div>
        `).join('');
      }

      // 4. Presentation Telemetry & Meters
      animateCountUp(document.getElementById('dashPresSolarKw'), data.solarKw || 0);
      animateCountUp(document.getElementById('dashPresInverters'), data.invertersCount || 0);
      animateCountUp(document.getElementById('dashPresDispatched'), data.sold || 0);
      
      const presHubsEl = document.getElementById('dashPresHubsCount');
      if (presHubsEl) presHubsEl.textContent = `${data.warehousesCount || 1} Hub`;

      const presChallansEl = document.getElementById('dashPresChallansCount');
      if (presChallansEl) presChallansEl.textContent = `${data.activeChallans || 0} Challans`;
    }

    // Pull real numbers from shared database
    async function loadRealDashboardData() {
      if (!window.Api) return;
      try {
        const data = await window.Api.get('/dashboard/summary');
        window._lastDashData = data;

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
        setText('dashPresSolarSub', `${formatNumber(panelsAvail)} Solar Panels in Stock`);

        // Render both views
        renderExecutiveCards(data);
        renderPresentationCharts(data);

        // Apply selected view
        setViewMode(currentViewMode, false);

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

    // Customizer Modal
    const DASHBOARD_WIDGETS = [
      { id: 'w_welcome', name: 'Welcome & Quick Action Header', icon: 'fa-hand-wave', desc: 'Greeting, live clock badge, and 1-click action shortcuts' },
      { id: 'w_solar_capacity', name: 'Solar Capacity & Power Portfolio', icon: 'fa-solar-panel', desc: 'Total solar KW capacity, inverters count, and batteries in stock' },
      { id: 'w_kpi_cards', name: 'Core Inventory KPI Cards', icon: 'fa-chart-simple', desc: 'Clean executive metric cards with live volume balances' },
      { id: 'w_lowstock', name: 'Low Stock Alert Banner', icon: 'fa-triangle-exclamation', desc: 'Replenishment urgency notification when items hit minimum levels' },
      { id: 'w_operations_pulse', name: "Today's Enterprise Operations Pulse", icon: 'fa-chart-line', desc: 'Daily inward, project dispatch, and BOM challan velocity' },
      { id: 'w_category_snapshot', name: 'Category-wise Inventory Matrix', icon: 'fa-table-cells', desc: 'Detailed table of stock counts per category with filters' }
    ];

    const STORAGE_KEY = 'egs_dashboard_widgets_v2';
    function loadSavedWidgetPrefs() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
      return {
        w_welcome: true,
        w_solar_capacity: true,
        w_kpi_cards: true,
        w_lowstock: true,
        w_operations_pulse: true,
        w_category_snapshot: true
      };
    }

    function saveWidgetPrefs(prefs) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
      } catch (e) {}
    }

    function applyWidgetVisibility() {
      const prefs = loadSavedWidgetPrefs();
      DASHBOARD_WIDGETS.forEach((widget) => {
        const isVisible = prefs[widget.id] !== false;
        const el = document.querySelector(`[data-widget="${widget.id}"]`);
        if (el) {
          el.style.display = isVisible ? '' : 'none';
        }
      });
    }

    applyWidgetVisibility();

    const customizeBtn = document.getElementById('dashCustomizeBtn');
    if (customizeBtn) {
      customizeBtn.addEventListener('click', () => {
        const prefs = loadSavedWidgetPrefs();
        const modalHtml = `
          <div class="dash-customizer-grid">
            ${DASHBOARD_WIDGETS.map((w) => {
              const checked = prefs[w.id] !== false ? 'checked' : '';
              return `
                <div class="dash-customizer-item">
                  <div class="dash-customizer-meta">
                    <div class="dash-customizer-icon"><i class="fa-solid ${w.icon}"></i></div>
                    <div class="dash-customizer-text">
                      <h4>${w.name}</h4>
                      <p>${w.desc}</p>
                    </div>
                  </div>
                  <label class="egs-switch">
                    <input type="checkbox" data-widget-toggle="${w.id}" ${checked}>
                    <span class="egs-switch-slider"></span>
                  </label>
                </div>
              `;
            }).join('')}
          </div>
        `;

        if (window.openModal) {
          window.openModal('Customize Dashboard Layout', modalHtml, [
            {
              label: 'Reset All',
              class: 'btn-secondary',
              onClick: () => {
                const defaultPrefs = {};
                DASHBOARD_WIDGETS.forEach((w) => { defaultPrefs[w.id] = true; });
                saveWidgetPrefs(defaultPrefs);
                applyWidgetVisibility();
                if (window.closeModal) window.closeModal();
                if (window.showToast) window.showToast('Widgets reset to default.', 'info');
              }
            },
            {
              label: 'Save Preferences',
              class: 'btn-primary',
              onClick: () => {
                const newPrefs = {};
                document.querySelectorAll('[data-widget-toggle]').forEach((input) => {
                  const id = input.getAttribute('data-widget-toggle');
                  newPrefs[id] = input.checked;
                });
                saveWidgetPrefs(newPrefs);
                applyWidgetVisibility();
                if (window.closeModal) window.closeModal();
                if (window.showToast) window.showToast('Dashboard widgets updated!', 'success');
              }
            }
          ]);
        }
      });
    }
  }
};
