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
            <strong>Loading…</strong>
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

        // Count-up animation for the 4 big stat cards (Available / Assigned /
        // Sold / Damaged): instead of the final number just appearing, it
        // ramps up to it with a quick counting motion — runs fresh every
        // time the Dashboard loads, so it plays again on every refresh or
        // reopen of the site, not just once.
        //
        // It does NOT always start counting from 0 — for a number in the
        // thousands/lakhs that would mean a huge, unnatural jump every
        // frame. Instead it starts from a small gap just below the final
        // value (same feel as "28 -> 33"), scaled to the number's size:
        //   final 33        -> starts ~28   (gap 5, the floor)
        //   final 12,400     -> starts ~12,380 (gap ~15% capped at 60)
        //   final 3,40,000   -> starts ~3,39,940 (gap capped at 60)
        // so it always reads as a short, natural "counting up the last bit",
        // never a long sweep from zero.
        function animateCountUp(el, endValue, duration = 900) {
          if (!el) return;
          const target = Number(endValue) || 0;
          const gap = Math.min(60, Math.max(5, Math.round(target * 0.15)));
          const start = Math.max(0, target - gap);
          const startTime = performance.now();
          function tick(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic — fast start, gentle landing
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

    // ---------- Live Network Users — real, database-backed, auto-refreshing ----------
    // Reads GET /api/sessions/live (every row in `users`, joined with its
    // current `user_sessions` status) — same real-time signal the desktop
    // app's session tracker bar uses, and visible to EVERY role now (not
    // SuperAdmin-only). Polls every 5s while Dashboard is open, and also
    // live-updates the modal's contents if it's open when a refresh lands,
    // so someone logging out elsewhere disappears from this list within a
    // few seconds without anyone needing to reopen anything.
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
            ${liveSessions.map(r => `
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
        liveSessions = await window.Api.get('/sessions/live');
      } catch (e) {
        liveSessions = [];
      }
      updateSummaryLabels();
      // If the Live User Sessions modal happens to be open right now, refresh
      // its table in place too — this is what makes a logout show up for
      // everyone else within a few seconds, without them reopening anything.
      const modalOverlay = document.getElementById('modalOverlay');
      const modalTitle = document.getElementById('modalTitle');
      if (modalOverlay && modalOverlay.classList.contains('show') && modalTitle && modalTitle.textContent === 'Live User Sessions') {
        document.getElementById('modalBody').innerHTML = liveUsersTableHtml();
      }
    }

    function openLiveUsersModal() {
      window.openModal('Live User Sessions', liveUsersTableHtml());
      refreshLiveSessions(); // pull the freshest data the moment it's opened
    }

    // Poll every 5s while this page is on screen; self-clears the moment the
    // Dashboard's own table leaves the DOM (same pattern js/pages/lowstock.js
    // uses), so navigating away doesn't leave a stray timer running.
    refreshLiveSessions();
    liveUsersTimer = setInterval(() => {
      if (!document.body.contains(document.getElementById('dashSnapshotBody'))) {
        clearInterval(liveUsersTimer);
        return;
      }
      refreshLiveSessions();
    }, 5000);

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
            <strong>Loading…</strong>
            <small>Live session status</small>
          </span>
          <i class="fa-solid fa-chevron-right chevron"></i>
        </button>`;
      const topbarBtn = document.getElementById('topbarBtnLiveUsers');
      if (topbarBtn) topbarBtn.addEventListener('click', openLiveUsersModal);
      updateSummaryLabels();
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