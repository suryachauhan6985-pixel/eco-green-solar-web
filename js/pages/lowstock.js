// js/pages/lowstock.js
// Mirrors ui/low_stock.py's LowStockPage exactly, wired to the real backend
// (GET /api/lowstock, see server.js -> same get_low_stock_items() query the
// desktop app runs: every item master with minimum_stock > 0 whose current
// 'Available' count has dropped to/under that minimum, worst shortfall
// first) instead of a static 3-row preview table.
//   - Free-text Search across all columns (category/brand/wattage/type/etc)
//   - Excel-style per-column AutoFilter (funnel icon), same mechanism
//     already used on Purchase Register / Dashboard in this web app —
//     mirrors the desktop app's attach_column_filter.
//   - "Clear Filters" resets both search + column filters.
//   - "Export" saves the currently-visible (filtered) rows to CSV — same
//     idea as the desktop app's export_to_excel().
//   - "Refresh" reloads live from the database, and the page also
//     auto-refreshes every 15 seconds on its own, exactly like the desktop
//     app's self.refresh_timer (QTimer, 15000ms).
//   - Current Stock is colored red when it has hit zero, orange otherwise
//     — same as the desktop app's QColor("#E74C3C") / QColor("#F39C12").
window.PAGES = window.PAGES || {};

window.PAGES.lowstock = {
  name: 'Low Stock Alert',
  icon: 'fa-triangle-exclamation',
  sub: 'Items at or below minimum stock',
  html: `
    <div class="page-head"><i class="fa-solid fa-triangle-exclamation" style="color:var(--red);"></i><h2>Low Stock Alert</h2>
      <button type="button" class="info-btn" data-info="Lists every item whose current stock has dropped to or below its configured minimum level."><i class="fa-solid fa-circle-info"></i></button>
    </div>
    <div class="toolbar">
      <div class="grow"><input id="lsSearch" placeholder="Search category, brand, type..." style="width:100%;"></div>
      <button class="btn btn-ghost" type="button" id="lsBtnClearFilters"><i class="fa-solid fa-filter"></i> Clear Filters</button>
      <button class="btn btn-green" type="button" id="lsBtnExport"><i class="fa-solid fa-file-excel"></i> Export</button>
      <button class="btn btn-ghost" type="button" id="lsBtnRefresh"><i class="fa-solid fa-sync"></i> Refresh</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th data-col="Category">Category <button class="th-filter-btn" data-col="Category" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Brand">Brand <button class="th-filter-btn" data-col="Brand" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Wattage">Wattage <button class="th-filter-btn" data-col="Wattage" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Type">Type <button class="th-filter-btn" data-col="Type" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Current Stock">Current Stock <button class="th-filter-btn" data-col="Current Stock" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Minimum Stock">Minimum Stock <button class="th-filter-btn" data-col="Minimum Stock" type="button"><i class="fa-solid fa-filter"></i></button></th>
      </tr></thead>
      <tbody id="lsBody"></tbody>
    </table></div>
  `,

  init() {
    const $ = (id) => document.getElementById(id);

    const tbody = $('lsBody');
    const searchEl = $('lsSearch');
    const columns = ['Category', 'Brand', 'Wattage', 'Type', 'Current Stock', 'Minimum Stock'];

    let allRows = [];               // raw rows from the API (all low-stock items, unfiltered)
    const activeFilters = {};       // { colLabel: Set of allowed values } — Excel-style header filter
    let openMenuEl = null;
    let refreshTimer = null;

    function rowToValues(r) {
      return [r.category, r.brand, r.watt, r.type, String(r.currentStock), `${r.minimumStock} ${r.uom || 'Nos'}`];
    }

    function matchesSearch(values) {
      const term = searchEl.value.trim().toLowerCase();
      if (!term) return true;
      return values.some((v) => String(v || '').toLowerCase().includes(term));
    }

    function isRowVisible(values) {
      return columns.every((col, i) => !activeFilters[col] || activeFilters[col].has(values[i]));
    }

    async function loadData() {
      // If this page's table is no longer in the DOM (user navigated away),
      // stop polling — app.js has no page-teardown hook, so the interval
      // has to notice this on its own instead of leaking forever.
      if (!document.body.contains(tbody)) { if (refreshTimer) clearInterval(refreshTimer); return; }
      try {
        // silent: true — this runs every 15s in the background (and can
        // keep firing for a few seconds after the user has navigated to a
        // different page, until the DOM-presence check above catches up),
        // so it must not trigger the global full-screen loader overlay —
        // same pattern as dashboard.js's refreshLiveSessions().
        allRows = await window.Api.get('/lowstock', { silent: true });
      } catch (e) {
        allRows = [];
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--txt-muted); font-style:italic;">Could not load low stock data from the database.</td></tr>`;
        return;
      }
      renderTable();
    }

    function renderTable() {
      const visible = allRows.filter((r) => matchesSearch(rowToValues(r)) && isRowVisible(rowToValues(r)));
      if (!visible.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--txt-muted); font-style:italic;">No low stock items found for the selected filters.</td></tr>`;
        return;
      }
      tbody.innerHTML = visible.map((r) => `
        <tr>
          <td data-label="Category">${r.category}</td>
          <td data-label="Brand">${r.brand}</td>
          <td data-label="Wattage">${r.watt}</td>
          <td data-label="Type">${r.type}</td>
          <td data-label="Current Stock" style="color:${Number(r.currentStock) <= 0 ? 'var(--red)' : 'var(--orange)'};">${r.currentStock}</td>
          <td data-label="Minimum Stock">${r.minimumStock} ${r.uom || 'Nos'}</td>
        </tr>`).join('');
    }

    searchEl.addEventListener('input', renderTable);
    $('lsBtnRefresh').addEventListener('click', loadData);

    // ---------- Excel-style header filters (same mechanism as Purchase Register / Dashboard) ----------
    const filterBtns = document.querySelectorAll('.th-filter-btn');

    function uniqueValues(col) {
      const i = columns.indexOf(col);
      return Array.from(new Set(allRows.map((r) => rowToValues(r)[i])));
    }
    function applyAllFilters() {
      renderTable();
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
      const selected = activeFilters[col] || new Set(values);

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
      openMenuEl.dataset.forCol = col;

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

    filterBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpenForThisBtn = openMenuEl && openMenuEl.dataset.forCol === btn.dataset.col;
        closeMenu();
        if (!wasOpenForThisBtn) openMenuFor(btn);
      });
    });
    document.addEventListener('click', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);

    $('lsBtnClearFilters').addEventListener('click', () => {
      searchEl.value = '';
      Object.keys(activeFilters).forEach((k) => delete activeFilters[k]);
      applyAllFilters();
    });

    // ---------- Export (visible/filtered rows only) — same idea as export_to_excel() ----------
    $('lsBtnExport').addEventListener('click', () => {
      const visible = allRows.filter((r) => matchesSearch(rowToValues(r)) && isRowVisible(rowToValues(r)));
      if (!visible.length) {
        window.openModal('No Records', '<p>No data available to export with the current filters.</p>');
        return;
      }
      const header = columns.join(',');
      const lines = visible.map((r) => rowToValues(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
      const csv = [header, ...lines].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `Low_Stock_Alert_${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (window.showToast) window.showToast('Low stock data exported to Excel successfully!');
    });

    // Auto-refresh every 15s, same as the desktop app's self.refresh_timer
    // (QTimer, 15000ms). Self-clears via the DOM-presence check inside
    // loadData() once the user navigates to a different page.
    refreshTimer = setInterval(loadData, 15000);

    loadData();
  },
};