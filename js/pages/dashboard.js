// js/pages/dashboard.js
window.PAGES = window.PAGES || {};

window.PAGES.dashboard = {
  name: 'Dashboard',
  icon: 'fa-chart-pie',
  sub: 'Live overview of stock & operations',
  html: `
   <div class="banner"><i class="fa-solid fa-triangle-exclamation"></i>
      <div><strong id="dashLowStockCount">0 items</strong> are at or below minimum stock level.
        <a href="#" onclick="go('lowstock');return false;" class="gold-txt">View Low Stock Alert →</a></div>
    </div>

    <div class="stat-grid">
      <div class="stat-card available"><div class="top"><span class="label">Available Stock</span><i class="fa-solid fa-boxes-stacked" style="color:#2ECC71;"></i></div><div class="value" id="dashAvailableVal">0</div></div>
      <div class="stat-card assigned"><div class="top"><span class="label">Assigned</span><i class="fa-solid fa-hand-holding" style="color:var(--blue);"></i></div><div class="value" id="dashAssignedVal">0</div></div>
      <div class="stat-card sold"><div class="top"><span class="label">Sold</span><i class="fa-solid fa-file-invoice-dollar" style="color:var(--red);"></i></div><div class="value" id="dashSoldVal">0</div></div>
      <div class="stat-card damaged"><div class="top"><span class="label">Damaged</span><i class="fa-solid fa-triangle-exclamation" style="color:var(--orange);"></i></div><div class="value" id="dashDamagedVal">0</div></div>
    </div>

    <div class="dashboard-grid">
      <!-- PC/desktop: this panel is hidden by CSS (.dash-usersession-panel,
           @media min-width:901px) because the same "User Sessions" control
           is injected into the header/topbar instead — see init() below.
           Mobile: unchanged, shows here exactly like before. -->
      <div class="panel dash-usersession-panel">
        <h3><i class="fa-solid fa-users"></i> User Sessions</h3>
        <!-- Matches current software: not shown inline — click opens a
             popup with live online/offline status of every user. -->
        <button class="live-btn" id="btnLiveUsers">
          <span class="dot"></span>
          <span>
            <strong>2 users currently online</strong>
            <small>Click to view live session status of all users</small>
          </span>
          <i class="fa-solid fa-chevron-right chevron"></i>
        </button>
      </div>
      <div class="panel">
        <h3><i class="fa-solid fa-chart-pie"></i> Category-wise Snapshot</h3>
        <div class="table-wrap"><table><thead><tr>
            <th data-col="Category">Category <button class="th-filter-btn" data-col="Category" type="button"><i class="fa-solid fa-filter"></i></button></th>
            <th data-col="Avail.">Avail. <button class="th-filter-btn" data-col="Avail." type="button"><i class="fa-solid fa-filter"></i></button></th>
            <th data-col="Assigned">Assigned <button class="th-filter-btn" data-col="Assigned" type="button"><i class="fa-solid fa-filter"></i></button></th>
            <th data-col="Sold">Sold <button class="th-filter-btn" data-col="Sold" type="button"><i class="fa-solid fa-filter"></i></button></th>
            <th data-col="Damaged">Damaged <button class="th-filter-btn" data-col="Damaged" type="button"><i class="fa-solid fa-filter"></i></button></th>
          </tr></thead>
         <tbody id="dashSnapshotBody">
            <tr><td colspan="5" style="text-align:center;color:var(--txt-muted);">Loading live data…</td></tr>
          </tbody></table></div>
      </div>
    </div>
  `,
  init() {
    // ---------- NEW: pull real numbers from the shared database via the
    // backend API (server.js). Falls back silently to the demo numbers
    // already in the HTML above if the API isn't reachable (e.g. you're
    // previewing the UI without the backend running yet). ----------
    (async function loadRealDashboardData() {
      if (!window.Api) return; // api.js not loaded — stay on demo data
      try {
        const data = await window.Api.get('/dashboard/summary');

        const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        setText('dashAvailableVal', fmt(data.available));
        setText('dashAssignedVal', fmt(data.assigned));
        setText('dashSoldVal', fmt(data.sold));
        setText('dashDamagedVal', fmt(data.damaged));
        setText('dashLowStockCount', `${data.lowStockCount || 0} items`);

         const snapshotBody = document.getElementById('dashSnapshotBody');
        if (snapshotBody && Array.isArray(data.categorySnapshot)) {
          snapshotBody.innerHTML = data.categorySnapshot.length
            ? data.categorySnapshot.map((r) => `
            <tr>
              <td data-label="Category">${r.category}</td>
              <td data-label="Avail.">${fmt(r.avail)}</td>
              <td data-label="Assigned">${fmt(r.assigned)}</td>
              <td data-label="Sold">${fmt(r.sold)}</td>
              <td data-label="Damaged">${fmt(r.damaged)}</td>
            </tr>`).join('')
            : `<tr><td colspan="5" style="text-align:center;color:var(--txt-muted);">No data available.</td></tr>`;
        }
        console.log('[Dashboard] Loaded live data from database.');
      } catch (err) {
        console.warn('[Dashboard] Could not reach API:', err.message);
        const snapshotBody = document.getElementById('dashSnapshotBody');
        if (snapshotBody) {
          snapshotBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--txt-muted);">No data available.</td></tr>`;
        }
      }
    })();

    function openLiveUsersModal() {
      const rows = [
        { user: 'sumit', role: 'SuperAdmin', online: true },
        { user: 'priya', role: 'User', online: true },
        { user: 'vishal', role: 'User', online: false },
      ];
      const body = `
        <div class="table-wrap"><table>
          <thead><tr><th>User</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td data-label="User">${r.user}</td>
                <td data-label="Role">${r.role}</td>
                <td data-label="Status"><span class="pill ${r.online ? 'available' : 'sold'}">${r.online ? 'ONLINE' : 'OFFLINE'}</span></td>
              </tr>`).join('')}
          </tbody>
        </table></div>`;
      window.openModal('Live User Sessions', body);
    }

    // Mobile panel button (unchanged from before)
    const btn = document.getElementById('btnLiveUsers');
    if (btn) btn.addEventListener('click', openLiveUsersModal);

    // PC/desktop: build the same control inside the header (.topbar), like
    // the desktop .py app. window.topbarExtra is created once by app.js and
    // is only ever visible on the PC layout (mobile hides .topbar via CSS).
    if (window.topbarExtra) {
      window.topbarExtra.innerHTML = `
        <button class="topbar-live-btn" id="topbarBtnLiveUsers" type="button">
          <span class="dot"></span>
          <span>
            <strong>2 users online</strong>
            <small>Live session status</small>
          </span>
          <i class="fa-solid fa-chevron-right chevron"></i>
        </button>`;
      const topbarBtn = document.getElementById('topbarBtnLiveUsers');
      if (topbarBtn) topbarBtn.addEventListener('click', openLiveUsersModal);
    }

    // ---------- Category-wise Snapshot: Excel-style header filters ----------
    // Click the funnel icon in any column header -> a dropdown lists every
    // unique value in that column with checkboxes (like Excel AutoFilter).
    // Filters across columns combine with AND; within one column, OR.
    // The menu is appended to <body> with position:fixed (anchored to the
    // funnel button's on-screen position) so .table-wrap's horizontal
    // scroll box never clips it.
    const tbody = document.getElementById('dashSnapshotBody');
    const filterBtns = document.querySelectorAll('.th-filter-btn');
    if (tbody && filterBtns.length) {
      const allRows = Array.from(tbody.querySelectorAll('tr'));
      const colIndex = {};
      allRows[0].querySelectorAll('td').forEach((td, i) => {
        colIndex[td.dataset.label] = i;
      });
      const activeFilters = {}; // { colName: Set of allowed values } — absent key = no filter on that column
      let openMenuEl = null;

      function cellValue(row, col) {
        return row.children[colIndex[col]].textContent.trim();
      }
      function uniqueValues(col) {
        return Array.from(new Set(allRows.map(r => cellValue(r, col))));
      }
      function applyAllFilters() {
        allRows.forEach((row) => {
          const visible = Object.keys(activeFilters).every((col) => activeFilters[col].has(cellValue(row, col)));
          row.style.display = visible ? '' : 'none';
        });
        filterBtns.forEach((btn) => btn.classList.toggle('active', !!activeFilters[btn.dataset.col]));
      }

      function closeMenu() {
        if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; }
      }

      function positionMenu(menu, btn) {
        const rect = btn.getBoundingClientRect();
        const menuWidth = 210;
        let left = rect.left;
        if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;
        menu.style.left = Math.max(10, left) + 'px';
        menu.style.top = (rect.bottom + 4) + 'px';
      }

      function openMenuFor(btn) {
        const col = btn.dataset.col;
        closeMenu();

        const values = uniqueValues(col);
        const selected = activeFilters[col] || new Set(values); // if no filter yet, everything is "checked"

        const menu = document.createElement('div');
        menu.className = 'th-filter-menu show';
        menu.innerHTML = `
          <div class="th-filter-search"><input type="text" placeholder="Search..."></div>
          <label class="th-filter-item th-filter-selectall">
            <input type="checkbox" ${selected.size === values.length ? 'checked' : ''}> <span>Select All</span>
          </label>
          <div class="th-filter-list">
            ${values.map(v => `
              <label class="th-filter-item">
                <input type="checkbox" value="${v}" ${selected.has(v) ? 'checked' : ''}> <span>${v}</span>
              </label>`).join('')}
          </div>
          <div class="th-filter-actions">
            <button type="button" class="btn btn-ghost th-filter-clear">Clear</button>
            <button type="button" class="btn btn-blue th-filter-ok">OK</button>
          </div>`;

        document.body.appendChild(menu);
        positionMenu(menu, btn);
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
          const checked = itemCbs().filter(cb => cb.checked).map(cb => cb.value);
          if (checked.length === values.length) delete activeFilters[col];
          else activeFilters[col] = new Set(checked);
          closeMenu();
          applyAllFilters();
        });

        menu.addEventListener('click', (e) => e.stopPropagation());
      }

      filterBtns.forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const wasOpenForThisBtn = openMenuEl && openMenuEl.dataset.forCol === btn.dataset.col;
          closeMenu();
          if (!wasOpenForThisBtn) { openMenuFor(btn); openMenuEl.dataset.forCol = btn.dataset.col; }
        });
      });

      // Close the dropdown on outside click, page scroll, or window resize —
      // scoped with { once:true }-style cleanup via named handlers so
      // revisiting the Dashboard page doesn't stack up duplicate listeners.
      document.addEventListener('click', closeMenu);
      window.addEventListener('scroll', closeMenu, true);
      window.addEventListener('resize', closeMenu);
    }
  }
};