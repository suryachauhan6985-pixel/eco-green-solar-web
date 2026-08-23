// js/pages/reports.js
// Mirrors ui/reports.py's ReportsPage from the desktop app: a full
// serial-wise listing of every stock_ledger row (18 columns — Serial No
// through Edited?), with a live Category filter, a Search box that filters
// by Serial No only (same as the desktop's search_input, which only checks
// column 0), and — same as Purchase Register / Sale Register — an
// Excel-style AutoFilter (funnel icon) on every single column header.
// Rows come live from GET /api/reports/master (same build_base_query() /
// ORDER BY id DESC the desktop app runs), so this page always reflects the
// real database. No more hardcoded 3-row preview table.
window.PAGES = window.PAGES || {};

window.PAGES.reports = {
  name: 'Master Reports',
  icon: 'fa-clipboard-list',
  sub: 'Full serial-wise inventory report',
  html: `
    <div class="page-head"><i class="fa-solid fa-clipboard-list" style="color:var(--blue);"></i><h2>Master Reports</h2>
      <button type="button" class="info-btn" data-info="Use the filter icon in any column header to apply an Excel-style filter to that column."><i class="fa-solid fa-circle-info"></i></button>
    </div>
    <div id="repSavedViews"></div>
    <div class="toolbar">
      <div class="grow"><input id="repSearch" placeholder="Search Serial No..." style="width:100%;"></div>
      <div><label>Category</label> <select id="repCategory"><option>All Categories</option></select></div>
      <button class="btn btn-ghost" type="button" id="repBtnClearFilters"><i class="fa-solid fa-filter"></i> Clear Filters</button>
      <button class="btn btn-ghost" type="button" id="repBtnRefresh"><i class="fa-solid fa-sync"></i> Refresh</button>
      <button class="btn btn-green" type="button" id="repBtnExport"><i class="fa-solid fa-file-excel"></i> Export</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th style="width:36px; text-align:center;"><input type="checkbox" id="repSelectAll" title="Select All"></th>
        <th data-col="Serial No">Serial No <button class="th-filter-btn" data-col="Serial No" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Product Brand">Product Brand <button class="th-filter-btn" data-col="Product Brand" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Wattage Spec">Wattage Spec <button class="th-filter-btn" data-col="Wattage Spec" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Quantity">Quantity <button class="th-filter-btn" data-col="Quantity" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Solar Type">Solar Type <button class="th-filter-btn" data-col="Solar Type" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Category">Category <button class="th-filter-btn" data-col="Category" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Pallet ID">Pallet ID <button class="th-filter-btn" data-col="Pallet ID" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Warehouse">Warehouse <button class="th-filter-btn" data-col="Warehouse" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Status">Status <button class="th-filter-btn" data-col="Status" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Supplier">Supplier <button class="th-filter-btn" data-col="Supplier" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Purchase Invoice">Purchase Invoice <button class="th-filter-btn" data-col="Purchase Invoice" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Purchase Date">Purchase Date <button class="th-filter-btn" data-col="Purchase Date" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Customer">Customer <button class="th-filter-btn" data-col="Customer" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Order No">Order No <button class="th-filter-btn" data-col="Order No" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Sales Invoice">Sales Invoice <button class="th-filter-btn" data-col="Sales Invoice" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Sales Invoice Date">Sales Invoice Date <button class="th-filter-btn" data-col="Sales Invoice Date" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Challan No">Challan No <button class="th-filter-btn" data-col="Challan No" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Challan Date">Challan Date <button class="th-filter-btn" data-col="Challan Date" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Edited?">Edited? <button class="th-filter-btn" data-col="Edited?" type="button"><i class="fa-solid fa-filter"></i></button></th>
      </tr></thead>
      <tbody id="repBody"><tr><td colspan="20" style="text-align:center;color:var(--txt-muted);">Loading live data…</td></tr></tbody>
    </table></div>
    <div id="repBulkBar"></div>
  `,

  init() {
    const $ = (id) => document.getElementById(id);
    const tbody = $('repBody');
    const searchEl = $('repSearch');
    const catEl = $('repCategory');

    const columns = [
      'Serial No', 'Product Brand', 'Wattage Spec', 'Quantity', 'Solar Type', 'Category', 'Pallet ID',
      'Warehouse', 'Status', 'Supplier', 'Purchase Invoice', 'Purchase Date', 'Customer',
      'Order No', 'Sales Invoice', 'Sales Invoice Date', 'Challan No', 'Challan Date', 'Edited?',
    ];

    // Category dropdown — live from the Categories master, same source
    // every other page's Category dropdown uses.
    async function loadCategoryFilter() {
      try {
        const cats = await window.Api.get('/masters/categories');
        cats.forEach((c) => {
          const opt = document.createElement('option');
          opt.textContent = c.name;
          catEl.appendChild(opt);
        });
      } catch (e) { /* dropdown just stays "All Categories" on failure */ }
    }
    loadCategoryFilter();

    let allRows = []; // full result set for the selected category, before search/column filters
    const activeFilters = {}; // { colLabel: Set of allowed values }
    let openMenuEl = null;

    function formatWattDisplay(w) {
      if (!w || w === 'N/A' || w === '0W' || w === '0.00W' || w === '0' || Number(w) <= 0) return '-';
      const num = parseFloat(w);
      if (isNaN(num) || num <= 0) return '-';
      return `${num}W`;
    }
    function formatQtyNum(n) {
      const num = parseFloat(n) || 1;
      return Number.isInteger(num) ? String(num) : num.toFixed(2).replace(/\.?0+$/, '');
    }

    function rowToValues(r) {
      const serial = (r.serialNo && r.serialNo !== 'null' && r.serialNo !== '') ? r.serialNo : '-';
      const watt = formatWattDisplay(r.watt);
      const qtyText = `${formatQtyNum(r.qty)} ${r.uom || 'Nos'}`;
      return [
        serial, r.brand, watt, qtyText, r.solarType, r.category, r.palletNo, r.warehouse, r.status,
        r.supplier, r.purchaseInvoice, r.purchaseDate, r.customer, r.orderNo, r.salesInvoice,
        r.invoiceDate, r.chalanNo, r.chalanDate, r.edited,
      ];
    }

    // Search box only matches Serial No — mirrors the desktop app's
    // render_table(), which only checks row_data[0] against the search term.
    function matchesSearch(r) {
      const term = searchEl.value.trim().toLowerCase();
      if (!term) return true;
      return String(r.serialNo || '').toLowerCase().includes(term);
    }

    // INSTANT LIVE LOADING — hits GET /api/reports/master (real stock_ledger
    // data), not any hardcoded preview rows.
    async function loadData() {
      const selectedCat = catEl.value;
      let rows = [];
      try {
        const path = selectedCat && selectedCat !== 'All Categories'
          ? `/reports/master?category=${encodeURIComponent(selectedCat)}`
          : '/reports/master';
        rows = await window.Api.get(path);
      } catch (e) {
        tbody.innerHTML = `<tr><td colspan="19" style="text-align:center; color:var(--txt-muted); font-style:italic;">Could not load report data from the database.</td></tr>`;
        allRows = [];
        return;
      }
      allRows = rows;
      selectedRows.clear();
      if (bulkBarApi) bulkBarApi.update(0);
      const selectAllEl = $('repSelectAll');
      if (selectAllEl) selectAllEl.checked = false;
      renderTable();
    }

    const selectedRows = new Set();
    let bulkBarApi = null;

    function isRowVisible(values) {
      return columns.every((col, i) => !activeFilters[col] || activeFilters[col].has(values[i]));
    }

    function statusPillClass(status) {
      const s = String(status || '').toLowerCase();
      return ['available', 'assigned', 'sold', 'damaged'].includes(s) ? s : '';
    }

    function getRowKey(r) {
      return r.id || r.serialNo || (r.brand + '_' + r.category + '_' + r.purchaseInvoice);
    }

    function renderTable() {
      const visible = allRows.filter((r) => matchesSearch(r) && isRowVisible(rowToValues(r)));
      if (!visible.length) {
        tbody.innerHTML = `<tr><td colspan="20" style="text-align:center; color:var(--txt-muted); font-style:italic;">No records found for the selected filters.</td></tr>`;
        return;
      }
      tbody.innerHTML = visible.map((r) => {
        const key = getRowKey(r);
        return `
        <tr class="${selectedRows.has(key) ? 'selected-row' : ''}">
          <td style="text-align:center;" onclick="event.stopPropagation()">
            <input type="checkbox" class="rep-row-chk" data-key="${key}" ${selectedRows.has(key) ? 'checked' : ''}>
          </td>
          <td data-label="Serial No" class="gold-txt" style="font-family:monospace;">${(r.serialNo && r.serialNo !== 'null' && r.serialNo !== '') ? r.serialNo : '-'}</td>
          <td data-label="Product Brand">${r.brand}</td>
          <td data-label="Wattage Spec">${formatWattDisplay(r.watt)}</td>
          <td data-label="Quantity"><span style="font-weight:700;">${formatQtyNum(r.qty)}</span> <small style="font-weight:600; color:var(--txt-muted);">${r.uom || 'Nos'}</small></td>
          <td data-label="Solar Type">${r.solarType}</td>
          <td data-label="Category">${r.category}</td>
          <td data-label="Pallet ID">${r.palletNo}</td>
          <td data-label="Warehouse">${r.warehouse}</td>
          <td data-label="Status">${statusPillClass(r.status) ? `<span class="pill ${statusPillClass(r.status)}">${r.status}</span>` : r.status}</td>
          <td data-label="Supplier">${r.supplier}</td>
          <td data-label="Purchase Invoice">${r.purchaseInvoice}</td>
          <td data-label="Purchase Date">${r.purchaseDate}</td>
          <td data-label="Customer">${r.customer}</td>
          <td data-label="Order No">${r.orderNo}</td>
          <td data-label="Sales Invoice">${r.salesInvoice}</td>
          <td data-label="Sales Invoice Date">${r.invoiceDate}</td>
          <td data-label="Challan No">${r.chalanNo}</td>
          <td data-label="Challan Date">${r.chalanDate}</td>
          <td data-label="Edited?" ${r.edited === 'Yes' ? 'class="gold-txt"' : ''}>${r.edited}</td>
        </tr>`;
      }).join('');

      // Wire row checkboxes
      tbody.querySelectorAll('.rep-row-chk').forEach(chk => {
        chk.addEventListener('change', () => {
          const key = chk.getAttribute('data-key');
          if (chk.checked) selectedRows.add(key);
          else selectedRows.delete(key);
          const tr = chk.closest('tr');
          if (tr) tr.classList.toggle('selected-row', chk.checked);
          if (bulkBarApi) bulkBarApi.update(selectedRows.size);
        });
      });
    }

    // Select All Checkbox
    const selectAllEl = $('repSelectAll');
    if (selectAllEl) {
      selectAllEl.addEventListener('change', () => {
        const visible = allRows.filter((r) => matchesSearch(r) && isRowVisible(rowToValues(r)));
        if (selectAllEl.checked) {
          visible.forEach(r => selectedRows.add(getRowKey(r)));
        } else {
          selectedRows.clear();
        }
        renderTable();
        if (bulkBarApi) bulkBarApi.update(selectedRows.size);
      });
    }

    // Initialize Bulk Actions Bar
    const bulkContainer = $('repBulkBar');
    if (bulkContainer && window.initBulkActionsBar) {
      bulkBarApi = window.initBulkActionsBar(bulkContainer, {
        getSelectedData: () => {
          return allRows.filter(r => selectedRows.has(getRowKey(r)));
        },
        onExport: (selected) => {
          if (!selected.length) return;
          const header = columns.join(',');
          const lines = selected.map((r) => rowToValues(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
          const csv = [header, ...lines].join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Master_Inventory_Selected_${selected.length}_rows.csv`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          if (window.showToast) window.showToast(`Exported ${selected.length} selected inventory items.`);
        },
        onCopy: (selected) => {
          if (!selected.length) return;
          const serials = selected.map(r => r.serialNo).filter(sn => sn && sn !== 'null' && sn !== '-');
          if (serials.length) {
            navigator.clipboard.writeText(serials.join('\n')).then(() => {
              if (window.showToast) window.showToast(`Copied ${serials.length} Serial Numbers to clipboard!`);
            }).catch(() => {});
          } else {
            const list = selected.map(r => `${r.brand} ${r.category} (${r.qty} ${r.uom || 'Nos'})`).join('\n');
            navigator.clipboard.writeText(list).then(() => {
              if (window.showToast) window.showToast(`Copied ${selected.length} Item references to clipboard!`);
            }).catch(() => {});
          }
        },
        onClear: () => {
          selectedRows.clear();
          if (selectAllEl) selectAllEl.checked = false;
          renderTable();
          if (bulkBarApi) bulkBarApi.update(0);
        }
      });
    }

    // Initialize Saved Views Bar
    const savedViewsContainer = $('repSavedViews');
    if (savedViewsContainer && window.initSavedViewsBar) {
      window.initSavedViewsBar(savedViewsContainer, {
        pageKey: 'master_reports',
        defaultPresets: [
          { id: 'all', label: 'All Inventory', state: { cat: 'All Categories', search: '', status: null } },
          { id: 'available', label: 'Available In-Stock', state: { cat: 'All Categories', search: '', status: 'Available' } },
          { id: 'assigned', label: 'Assigned / In-Transit', state: { cat: 'All Categories', search: '', status: 'Assigned' } },
          { id: 'sold', label: 'Sold Out', state: { cat: 'All Categories', search: '', status: 'Sold' } },
          { id: 'damaged', label: 'Damaged / RMA', state: { cat: 'All Categories', search: '', status: 'Damaged' } }
        ],
        onApply: (state) => {
          if (state.cat) catEl.value = state.cat;
          if (state.search !== undefined) searchEl.value = state.search;
          if (state.status) {
            activeFilters['Status'] = new Set([state.status]);
          } else {
            delete activeFilters['Status'];
          }
          applyAllFilters();
        },
        getCurrentState: () => ({
          cat: catEl.value,
          search: searchEl.value,
          status: activeFilters['Status'] ? Array.from(activeFilters['Status'])[0] : null
        })
      });
    }

    catEl.addEventListener('change', loadData);
    searchEl.addEventListener('input', window.debounce(renderTable, 150));
    $('repBtnRefresh').addEventListener('click', loadData);

    // ---------- Excel-style header filters ----------
    const filterBtns = document.querySelectorAll('.th-filter-btn');

    function uniqueValues(col) {
      const i = columns.indexOf(col);
      return Array.from(new Set(allRows.filter(matchesSearch).map((r) => rowToValues(r)[i])));
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

    $('repBtnClearFilters').addEventListener('click', () => {
      searchEl.value = '';
      Object.keys(activeFilters).forEach((k) => delete activeFilters[k]);
      applyAllFilters();
    });

    $('repBtnExport').addEventListener('click', () => {
      const visible = allRows.filter((r) => matchesSearch(r) && isRowVisible(rowToValues(r)));
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
      a.download = `Solar_Inventory_Master_Report_${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (window.showToast) window.showToast('Master Report exported.');
    });

    loadData();
  },
};