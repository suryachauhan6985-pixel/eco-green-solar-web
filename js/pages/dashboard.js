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
            <span id="dashLiveClock">Live Operations</span> • Eco Green Solar ERP Operations
          </div>
        </div>
        <div class="dash-actions-row">
          <button type="button" class="dash-btn-quick primary" onclick="go('bom')"><i class="fa-solid fa-file-invoice"></i> BOM & Challan</button>
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
          <strong id="dashLowStockCount">0 items</strong> are at or below minimum stock level. Immediate reorder recommended.
        </div>
        <a href="#" onclick="go('lowstock');return false;" class="banner-btn">Review Low Stock <i class="fa-solid fa-arrow-right"></i></a>
      </div>

      <!-- Solar Capacity & Live Inventory Portfolio Widget -->
      <div class="dash-solar-grid" data-widget="w_solar_capacity">
        <div class="dash-solar-card">
          <div class="dash-solar-icon solar"><i class="fa-solid fa-solar-panel"></i></div>
          <div class="dash-solar-info">
            <span class="dash-solar-label">Solar Panels in Stock</span>
            <div class="dash-solar-value"><span id="dashSolarKwVal">0</span> <small style="font-size:13px; font-weight:700; color:var(--gold);">KW</small></div>
            <span class="dash-solar-sub">Total Generation Capacity</span>
          </div>
        </div>

        <div class="dash-solar-card">
          <div class="dash-solar-icon inverter"><i class="fa-solid fa-bolt"></i></div>
          <div class="dash-solar-info">
            <span class="dash-solar-label">Inverters Ready</span>
            <div class="dash-solar-value" id="dashInvertersVal">0</div>
            <span class="dash-solar-sub">Single &amp; 3-Phase Inverters</span>
          </div>
        </div>

        <div class="dash-solar-card">
          <div class="dash-solar-icon battery"><i class="fa-solid fa-car-battery"></i></div>
          <div class="dash-solar-info">
            <span class="dash-solar-label">Battery Systems</span>
            <div class="dash-solar-value" id="dashBatteriesVal">0</div>
            <span class="dash-solar-sub">Li-Ion &amp; Solar Batteries</span>
          </div>
        </div>

        <div class="dash-solar-card">
          <div class="dash-solar-icon valuation"><i class="fa-solid fa-layer-group"></i></div>
          <div class="dash-solar-info">
            <span class="dash-solar-label">Registered Master Catalog</span>
            <div class="dash-solar-value" id="dashTotalItemsVal">0</div>
            <span class="dash-solar-sub">Active Products &amp; SKUs</span>
          </div>
        </div>
      </div>

      <!-- 4 Big Metric KPI Cards -->
      <div class="stat-grid" data-widget="w_kpi_cards">
        <div class="stat-card available" data-snap-key="avail">
          <div class="top">
            <span class="label">Available Stock</span>
            <div class="stat-icon-wrap"><i class="fa-solid fa-boxes-stacked"></i></div>
          </div>
          <div class="stat-slider-viewport">
            <div class="stat-slider">
              <div class="stat-slide">
                <span class="stat-slide-tag">Total</span>
                <div class="value" id="dashAvailableVal">0</div>
              </div>
            </div>
          </div>
          <span class="stat-badge-tag"><i class="fa-solid fa-check"></i> Ready in Warehouse</span>
          <div class="stat-dots"></div>
          <button class="stat-nav-arrow" type="button" aria-label="Next item"><i class="fa-solid fa-chevron-right"></i></button>
        </div>

        <div class="stat-card assigned" data-snap-key="assigned">
          <div class="top">
            <span class="label">Assigned Stock</span>
            <div class="stat-icon-wrap"><i class="fa-solid fa-hand-holding-hand"></i></div>
          </div>
          <div class="stat-slider-viewport">
            <div class="stat-slider">
              <div class="stat-slide">
                <span class="stat-slide-tag">Total</span>
                <div class="value" id="dashAssignedVal">0</div>
              </div>
            </div>
          </div>
          <span class="stat-badge-tag"><i class="fa-solid fa-diagram-project"></i> Allocated to Projects</span>
          <div class="stat-dots"></div>
          <button class="stat-nav-arrow" type="button" aria-label="Next item"><i class="fa-solid fa-chevron-right"></i></button>
        </div>

        <div class="stat-card sold" data-snap-key="sold">
          <div class="top">
            <span class="label">Total Sold</span>
            <div class="stat-icon-wrap"><i class="fa-solid fa-file-invoice-dollar"></i></div>
          </div>
          <div class="stat-slider-viewport">
            <div class="stat-slider">
              <div class="stat-slide">
                <span class="stat-slide-tag">Total</span>
                <div class="value" id="dashSoldVal">0</div>
              </div>
            </div>
          </div>
          <span class="stat-badge-tag"><i class="fa-solid fa-truck-fast"></i> Dispatched to Clients</span>
          <div class="stat-dots"></div>
          <button class="stat-nav-arrow" type="button" aria-label="Next item"><i class="fa-solid fa-chevron-right"></i></button>
        </div>

        <div class="stat-card damaged" data-snap-key="damaged">
          <div class="top">
            <span class="label">Damaged / Issue</span>
            <div class="stat-icon-wrap"><i class="fa-solid fa-triangle-exclamation"></i></div>
          </div>
          <div class="stat-slider-viewport">
            <div class="stat-slider">
              <div class="stat-slide">
                <span class="stat-slide-tag">Total</span>
                <div class="value" id="dashDamagedVal">0</div>
              </div>
            </div>
          </div>
          <span class="stat-badge-tag"><i class="fa-solid fa-shield-halved"></i> Under Inspection</span>
          <div class="stat-dots"></div>
          <button class="stat-nav-arrow" type="button" aria-label="Next item"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
      </div>

      <!-- Category Stock Distribution Card -->
      <div class="dash-dist-card" id="dashDistCard" data-widget="w_distribution" style="display:none;">
        <div class="dash-dist-header">
          <h3><i class="fa-solid fa-chart-simple" style="color:var(--blue);"></i> Category Stock Distribution</h3>
          <div class="dash-dist-legend" id="dashDistLegend"></div>
        </div>
        <div class="dash-dist-bar-wrap" id="dashDistBar"></div>
      </div>

      <div class="dashboard-grid">
        <!-- PC/desktop: this panel is hidden by CSS (.dash-usersession-panel,
             @media min-width:901px) because the same "User Sessions" control
             is injected into the header/topbar instead — see init() below.
             Mobile: unchanged, shows here exactly like before. -->
        <div class="panel dash-usersession-panel" data-widget="w_usersession">
          <h3><i class="fa-solid fa-users"></i> User Sessions</h3>
          <button class="live-btn" id="btnLiveUsers">
            <span class="dot"></span>
            <span>
              <strong>Loading…</strong>
              <small>Click to view live session status of all users</small>
            </span>
            <i class="fa-solid fa-chevron-right chevron"></i>
          </button>
        </div>

        <!-- Category Snapshot Table Panel -->
        <div class="dash-table-panel" data-widget="w_category_snapshot">
          <div class="dash-table-header-row">
            <h3><i class="fa-solid fa-layer-group"></i> Category-wise Snapshot</h3>
            <div class="dash-table-tools">
              <div class="dash-table-search">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input type="text" id="dashCatSearchInput" placeholder="Filter categories...">
              </div>
            </div>
          </div>
          <div class="table-wrap">
            <table id="dashSnapshotTable">
              <thead>
                <tr>
                  <th data-col="Category" style="min-width:180px;">Category <button class="th-filter-btn" data-col="Category" type="button"><i class="fa-solid fa-filter"></i></button></th>
                  <th data-col="Avail." style="text-align:right;">Avail. <button class="th-filter-btn" data-col="Avail." type="button"><i class="fa-solid fa-filter"></i></button></th>
                  <th data-col="Assigned" style="text-align:right;">Assigned <button class="th-filter-btn" data-col="Assigned" type="button"><i class="fa-solid fa-filter"></i></button></th>
                  <th data-col="Sold" style="text-align:right;">Sold <button class="th-filter-btn" data-col="Sold" type="button"><i class="fa-solid fa-filter"></i></button></th>
                  <th data-col="Damaged" style="text-align:right;">Damaged <button class="th-filter-btn" data-col="Damaged" type="button"><i class="fa-solid fa-filter"></i></button></th>
                </tr>
              </thead>
              <tbody id="dashSnapshotBody">
                <tr><td colspan="5" style="text-align:center;color:var(--txt-muted);padding:24px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading live data…</td></tr>
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
    }
    updateLiveGreeting();

    // Pull real numbers from shared database
    async function loadRealDashboardData() {
      if (!window.Api) return;
      try {
        const data = await window.Api.get('/dashboard/summary');

        const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        function animateCountUp(el, endValue, duration = 800) {
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

        animateCountUp(document.getElementById('dashAvailableVal'), data.available);
        animateCountUp(document.getElementById('dashAssignedVal'), data.assigned);
        animateCountUp(document.getElementById('dashSoldVal'), data.sold);
        animateCountUp(document.getElementById('dashDamagedVal'), data.damaged);
        animateCountUp(document.getElementById('dashSolarKwVal'), data.solarKw || 0);
        animateCountUp(document.getElementById('dashInvertersVal'), data.invertersCount || 0);
        animateCountUp(document.getElementById('dashBatteriesVal'), data.batteriesCount || 0);
        animateCountUp(document.getElementById('dashTotalItemsVal'), data.totalItems || 0);
        setText('dashLowStockCount', `${data.lowStockCount || 0} items`);

        const snapshotBody = document.getElementById('dashSnapshotBody');
        if (snapshotBody && Array.isArray(data.categorySnapshot)) {
          snapshotBody.innerHTML = data.categorySnapshot.length
            ? data.categorySnapshot.map((r) => `
            <tr>
              <td data-label="Category">
                <div class="dash-category-cell">
                  <div class="dash-cat-icon"><i class="fa-solid ${getCategoryIcon(r.category)}"></i></div>
                  <span>${r.category}</span>
                </div>
              </td>
              <td data-label="Avail." style="text-align:right;">${qtyPill(r.avail, 'avail')}</td>
              <td data-label="Assigned" style="text-align:right;">${qtyPill(r.assigned, 'active')}</td>
              <td data-label="Sold" style="text-align:right;">${qtyPill(r.sold, 'sold')}</td>
              <td data-label="Damaged" style="text-align:right;">${qtyPill(r.damaged, 'damaged')}</td>
            </tr>`).join('')
            : `<tr><td colspan="5" style="text-align:center;color:var(--txt-muted);padding:20px;">No data available.</td></tr>`;
        }

        // Distribution Card
        const distCard = document.getElementById('dashDistCard');
        const distBar = document.getElementById('dashDistBar');
        const distLegend = document.getElementById('dashDistLegend');

        if (distCard && distBar && distLegend && Array.isArray(data.categorySnapshot)) {
          const colors = ['#2ecc71', '#3b8ed0', '#f39c12', '#9b59b6', '#e74c3c', '#1abc9c', '#e67e22', '#34495e'];
          const activeCats = data.categorySnapshot.filter((r) => Number(r.avail || 0) > 0);
          const totalAvail = activeCats.reduce((sum, r) => sum + Number(r.avail || 0), 0);

          if (totalAvail > 0) {
            distCard.style.display = 'flex';
            distBar.innerHTML = activeCats.map((r, i) => {
              const pct = ((Number(r.avail) / totalAvail) * 100).toFixed(1);
              const color = colors[i % colors.length];
              return `<div class="dash-dist-segment" style="width:${pct}%; background:${color};" title="${r.category}: ${r.avail} (${pct}%)"></div>`;
            }).join('');

            distLegend.innerHTML = activeCats.slice(0, 6).map((r, i) => {
              const pct = ((Number(r.avail) / totalAvail) * 100).toFixed(0);
              const color = colors[i % colors.length];
              return `
                <div class="dash-legend-item">
                  <span class="dash-legend-dot" style="background:${color};"></span>
                  <span>${r.category} <b style="color:var(--txt);">${pct}%</b></span>
                </div>`;
            }).join('');
          } else {
            distCard.style.display = 'none';
          }
        }

        // Stat Card Sliders
        if (Array.isArray(data.categorySnapshot) && data.categorySnapshot.length) {
          document.querySelectorAll('.stat-card[data-snap-key]').forEach((card) => {
            const snapKey = card.dataset.snapKey;
            const slider = card.querySelector('.stat-slider');
            const dotsWrap = card.querySelector('.stat-dots');
            const arrowBtn = card.querySelector('.stat-nav-arrow');
            if (!slider) return;

            // Reset extra slides
            while (slider.children.length > 1) {
              slider.removeChild(slider.lastChild);
            }

            data.categorySnapshot.forEach((row) => {
              if (!row.category) return;
              const slide = document.createElement('div');
              slide.className = 'stat-slide';
              slide.innerHTML = `<span class="stat-slide-tag">${row.category}</span><div class="value">${fmt(row[snapKey])}</div>`;
              slider.appendChild(slide);
            });

            const slideEls = Array.from(slider.children);
            if (slideEls.length <= 1) return;

            card.classList.add('has-slides');
            dotsWrap.innerHTML = slideEls.map((_, i) => `<span class="stat-dot${i === 0 ? ' active' : ''}"></span>`).join('');
            const dotEls = Array.from(dotsWrap.children);

            let index = 0;
            function goTo(i) {
              index = ((i % slideEls.length) + slideEls.length) % slideEls.length;
              slider.style.transform = `translateX(-${index * 100}%)`;
              dotEls.forEach((d, di) => d.classList.toggle('active', di === index));
            }

            arrowBtn.onclick = () => goTo(index + 1);

            const viewport = card.querySelector('.stat-slider-viewport');
            let touchStartX = null;
            viewport.ontouchstart = (e) => { touchStartX = e.touches[0].clientX; };
            viewport.ontouchend = (e) => {
              if (touchStartX === null) return;
              const dx = e.changedTouches[0].clientX - touchStartX;
              if (Math.abs(dx) > 35) goTo(dx < 0 ? index + 1 : index - 1);
              touchStartX = null;
            };
          });
        }
      } catch (err) {
        console.warn('[Dashboard] Could not reach API:', err.message);
        const snapshotBody = document.getElementById('dashSnapshotBody');
        if (snapshotBody) {
          snapshotBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--txt-muted);padding:20px;">No data available.</td></tr>`;
        }
      }
    }
    loadRealDashboardData();

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
      { id: 'w_kpi_cards', name: 'Core Inventory KPI Cards', icon: 'fa-chart-simple', desc: '4 Big metric cards: Available, Assigned, Sold, and Damaged stock' },
      { id: 'w_lowstock', name: 'Low Stock Alert Banner', icon: 'fa-triangle-exclamation', desc: 'Replenishment urgency notification when items hit minimum levels' },
      { id: 'w_distribution', name: 'Category Stock Distribution Bar', icon: 'fa-chart-pie', desc: 'Visual distribution breakdown of items across categories' },
      { id: 'w_category_snapshot', name: 'Category-wise Snapshot Table', icon: 'fa-table-cells', desc: 'Detailed table of stock counts per category with filters' },
      { id: 'w_usersession', name: 'Live User Sessions Status', icon: 'fa-users', desc: 'Live status of team members currently active in the ERP' },
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
          if (w.id === 'w_distribution') {
            if (!isVisible) el.style.display = 'none';
          } else {
            el.style.display = isVisible ? '' : 'none';
          }
        });
      });
    }

    applyWidgetVisibility();

    function openCustomizerModal() {
      const currentPrefs = getWidgetPrefs();
      const html = `
        <div style="background:rgba(59,142,208,0.1); border:1px solid rgba(59,142,208,0.3); border-radius:10px; padding:10px 14px; margin-bottom:14px; font-size:12px; color:var(--txt); display:flex; align-items:center; gap:10px;">
          <i class="fa-solid fa-circle-info" style="color:var(--blue); font-size:16px;"></i>
          <span><b>Tip:</b> You can customize or restore widgets anytime from the header button, floating button, or <b>System Settings ➔ Appearance</b>.</span>
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

    // Expose globally so it can be invoked from Topbar, System Settings, or shortcuts
    window.openDashboardCustomizerModal = openCustomizerModal;

    const customizeBtn = document.getElementById('dashCustomizeBtn');
    if (customizeBtn) {
      customizeBtn.addEventListener('click', openCustomizerModal);
    }

    // Live Network Users Session Tracker
    let liveSessions = [];
    let liveUsersTimer = null;

    function timeAgo(iso) {
      if (!iso) return 'never';
      const then = new Date(String(iso).replace(' ', 'T')).getTime();
      if (Number.isNaN(then)) return 'just now';
      const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
      if (secs < 10) return 'just now';
      if (secs < 60) return `${secs}s ago`;
      const mins = Math.round(secs / 60);
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.round(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return `${Math.round(hrs / 24)}d ago`;
    }

    function liveUsersTableHtml() {
      if (!liveSessions.length) {
        return `<p style="color:var(--txt-muted); text-align:center; padding:12px 0;">Could not load live session data.</p>`;
      }
      return `
        <div class="table-wrap"><table>
          <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last Active</th></tr></thead>
          <tbody>
            ${liveSessions.map((r) => `
              <tr>
                <td data-label="User">${r.username}${r.username === window.currentUsername ? ' <span class="gold-txt">(you)</span>' : ''}</td>
                <td data-label="Role">${r.role === 'SuperAdmin' ? 'Super Admin' : r.role}</td>
                <td data-label="Status"><span class="pill ${r.online ? 'available' : 'sold'}">${r.online ? 'ONLINE' : 'OFFLINE'}</span></td>
                <td data-label="Last Active">${r.online ? 'now' : timeAgo(r.lastSeen || r.lastLoginTime)}</td>
              </tr>`).join('')}
          </tbody>
        </table></div>`;
    }

    function updateSummaryLabels() {
      const onlineCount = liveSessions.filter((r) => r.online).length;
      const mobileStrong = document.querySelector('#btnLiveUsers strong');
      if (mobileStrong) {
        mobileStrong.textContent = onlineCount
          ? `${onlineCount} user${onlineCount === 1 ? '' : 's'} currently online`
          : 'No users currently online';
      }
      const topbarStrong = document.querySelector('#topbarBtnLiveUsers strong');
      if (topbarStrong) {
        topbarStrong.textContent = onlineCount ? `${onlineCount} user${onlineCount === 1 ? '' : 's'} online` : 'No users online';
      }
    }

    async function refreshLiveSessions() {
      try {
        liveSessions = await window.Api.get('/sessions/live', { silent: true });
      } catch (e) {
        liveSessions = [];
      }
      updateSummaryLabels();
      const modalOverlay = document.getElementById('modalOverlay');
      const modalTitle = document.getElementById('modalTitle');
      if (modalOverlay && modalOverlay.classList.contains('show') && modalTitle && modalTitle.textContent === 'Live User Sessions') {
        document.getElementById('modalBody').innerHTML = liveUsersTableHtml();
      }
    }

    function openLiveUsersModal() {
      window.openModal('Live User Sessions', liveUsersTableHtml());
      refreshLiveSessions();
    }

    refreshLiveSessions();
    liveUsersTimer = setInterval(() => {
      if (!document.body.contains(document.getElementById('dashSnapshotBody'))) {
        clearInterval(liveUsersTimer);
        return;
      }
      refreshLiveSessions();
    }, 5000);

    const btn = document.getElementById('btnLiveUsers');
    if (btn) btn.addEventListener('click', openLiveUsersModal);

    if (window.topbarExtra) {
      window.topbarExtra.innerHTML = `
        <button class="topbar-live-btn" id="topbarBtnLiveUsers" type="button">
          <span class="dot"></span>
          <span>
            <strong>Loading…</strong>
            <small>Live session status</small>
          </span>
          <i class="fa-solid fa-chevron-right chevron"></i>
        </button>`;
      const topbarBtn = document.getElementById('topbarBtnLiveUsers');
      if (topbarBtn) topbarBtn.addEventListener('click', openLiveUsersModal);
      updateSummaryLabels();
    }

    // Category-wise Snapshot: Excel Header Filters
    const tbody = document.getElementById('dashSnapshotBody');
    const filterBtns = document.querySelectorAll('#dashSnapshotTable .th-filter-btn, .panel .th-filter-btn, .dash-table-panel .th-filter-btn');
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
          ['Category', 'Avail.', 'Assigned', 'Sold', 'Damaged'].forEach((k, i) => { colIndex[k] = i; });
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
