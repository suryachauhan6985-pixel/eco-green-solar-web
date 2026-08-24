// js/pages/saleregister.js
// Mirrors ui/registers.py -> SaleRegisterPage from the desktop app:
// From/To date range + Category + free-text Search filter the rows, every
// column header also gets an Excel-style AutoFilter (funnel icon -> checkbox
// list), and double-clicking a row jumps to Project Sales with that
// challan/order loaded into the edit panel, autofilled, ready to modify —
// exactly like double_clicked -> open_selected_ledger -> edit flow in the
// .py app. Rows come live from GET /api/sales/register (same GROUP BY query
// as load_data() in registers.py's SaleRegisterPage), so this page always
// reflects whatever Project Sales has dispatched/edited/deleted in the real
// database. No more in-memory/mock window.SalesData — that preview dataset
// is retired here, same as Purchase Register's window.PurchaseData.invoices
// was retired in favour of /api/purchase/register.
window.PAGES = window.PAGES || {};

window.PAGES.saleregister = {
  name: 'Sale Register',
  icon: 'fa-file-invoice',
  sub: 'All sales challans, filterable',
  html: `
    <div class="page-head"><i class="fa-solid fa-file-invoice" style="color:var(--orange);"></i><h2>Sale Register</h2>
      <button type="button" class="info-btn" data-info="Double-click any record to open it directly in the Project Sales modification panel. You can also filter any column using the filter icon in its header."><i class="fa-solid fa-circle-info"></i></button>
    </div>
    <div id="sregSavedViews"></div>
    <div class="toolbar">
      <div><label>From</label> <input type="date" id="sregFrom"></div>
      <div><label>To</label> <input type="date" id="sregTo"></div>
      <div><label>Category</label> <select id="sregCategory"><option>All Categories</option></select></div>
      <div class="grow"><input id="sregSearch" placeholder="Search challan, customer, order no, invoice, serial..." style="width:100%;"></div>
      <button class="btn btn-ghost" type="button" id="sregBtnClearFilters"><i class="fa-solid fa-filter"></i> Clear Column Filters</button>
      <button class="btn btn-green" type="button" id="sregBtnExport"><i class="fa-solid fa-file-excel"></i> Export</button>
      <button class="btn btn-ghost" type="button" id="sregBtnRefresh"><i class="fa-solid fa-rotate"></i> Refresh</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th style="width:36px; text-align:center;"><input type="checkbox" id="sregSelectAll" title="Select All"></th>
        <th data-col="Challan No">Challan No <button class="th-filter-btn" data-col="Challan No" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Date">Date <button class="th-filter-btn" data-col="Date" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Customer">Customer <button class="th-filter-btn" data-col="Customer" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Order No">Order No <button class="th-filter-btn" data-col="Order No" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Category">Category <button class="th-filter-btn" data-col="Category" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Brand">Brand <button class="th-filter-btn" data-col="Brand" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Qty">Qty <button class="th-filter-btn" data-col="Qty" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Sales Invoice">Sales Invoice <button class="th-filter-btn" data-col="Sales Invoice" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Edited?">Edited? <button class="th-filter-btn" data-col="Edited?" type="button"><i class="fa-solid fa-filter"></i></button></th>
      </tr></thead>
      <tbody id="sregBody"></tbody>
    </table></div>
    <div id="sregBulkBar"></div>
  `,

  init() {
    const $ = (id) => document.getElementById(id);
    const PD = window.PurchaseData;

    const tbody = $('sregBody');
    const fromEl = $('sregFrom');
    const toEl = $('sregTo');
    const catEl = $('sregCategory');
    const searchEl = $('sregSearch');

    // Default range: 1st of this month -> today, same default as the desktop page.
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    function toISO(d) { return d.toISOString().slice(0, 10); }
    fromEl.value = toISO(firstOfMonth);
    toEl.value = toISO(today);

    // Category dropdown — live from the Categories master (same source
    // Project Sales' own Category dropdown uses), not derived from whatever
    // sale rows happen to already be loaded.
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

    document.querySelectorAll('#sregFrom, #sregTo').forEach((el) => {
      el.addEventListener('click', () => { if (el.showPicker) { try { el.showPicker(); } catch (e) {} } });
    });

    let allRows = []; // date/category/search-filtered rows, before column (Excel-style) filters
    const activeFilters = {}; // { colLabel: Set of allowed values }
    let openMenuEl = null;
    const columns = ['Challan No', 'Date', 'Customer', 'Order No', 'Category', 'Brand', 'Qty', 'Sales Invoice', 'Edited?'];

    function rowToValues(r) {
      return [r.challanNo, r.date, r.customer, r.orderNo, r.category, r.brand, String(r.qty), r.invoice || '-', r.edited ? 'Yes' : 'No'];
    }

    function inDateRange(dmy) {
      const t = PD.parseDMY(dmy);
      if (!t) return false;
      const from = fromEl.value ? new Date(fromEl.value).getTime() : -Infinity;
      const to = toEl.value ? new Date(toEl.value).getTime() : Infinity;
      return t >= from && t <= to;
    }

    function matchesSearch(values) {
      const term = searchEl.value.trim().toLowerCase();
      if (!term) return true;
      return values.some((v) => String(v || '').toLowerCase().includes(term));
    }

    // INSTANT LIVE LOADING — same shape as Purchase Register's loadData():
    // hits GET /api/sales/register (real stock_ledger data), not any
    // in-memory mock.
    async function loadData() {
      const selectedCat = catEl.value;
      let rows = [];
      if (window.Skeleton) {
        tbody.innerHTML = window.Skeleton.tableRows(10, 6);
      }
      try {
        const path = selectedCat && selectedCat !== 'All Categories'
          ? `/sales/register?category=${encodeURIComponent(selectedCat)}`
          : '/sales/register';
        rows = await window.Api.get(path);
      } catch (e) {
        if (window.Skeleton) {
          tbody.innerHTML = window.Skeleton.tableError(10, e.message || 'Could not load sales records from the database.', { retryId: 'btnRetrySaleRegister' });
          window.Skeleton.wireRetry('btnRetrySaleRegister', () => loadData());
        } else {
          tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:var(--txt-muted); font-style:italic;">Could not load sales records from the database.</td></tr>`;
        }
        allRows = [];
        return;
      }
      allRows = rows.filter((r) => inDateRange(r.date) && matchesSearch(rowToValues(r)));
      selectedChallans.clear();
      if (bulkBarApi) bulkBarApi.update(0);
      const selectAllEl = $('sregSelectAll');
      if (selectAllEl) selectAllEl.checked = false;
      renderTable();
    }

    const selectedChallans = new Set();
    let bulkBarApi = null;

    function isRowVisible(values) {
      return columns.every((col, i) => !activeFilters[col] || activeFilters[col].has(values[i]));
    }

    function renderTable() {
      const visible = allRows.filter((r) => isRowVisible(rowToValues(r)));
      if (!visible.length) {
        if (window.Skeleton) {
          tbody.innerHTML = window.Skeleton.tableEmpty(10, 'No sales records found', { icon: 'fa-solid fa-cart-shopping', desc: 'Try adjusting your date range, category, or search filters.' });
        } else {
          tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; color:var(--txt-muted); font-style:italic;">No sales records found for the selected filters.</td></tr>`;
        }
        return;
      }
      tbody.innerHTML = visible.map((r) => `
        <tr class="sreg-row ${selectedChallans.has(r.challanNo) ? 'selected-row' : ''}" data-challan="${r.challanNo}" style="cursor:pointer;" title="Double-click to edit this order">
          <td style="text-align:center;" onclick="event.stopPropagation()">
            <input type="checkbox" class="sreg-row-chk" data-challan="${r.challanNo}" ${selectedChallans.has(r.challanNo) ? 'checked' : ''}>
          </td>
          <td data-label="Challan No" class="gold-txt">
            <div style="display:inline-flex; align-items:center; gap:6px;">
              <span>${r.challanNo}</span>
              <button type="button" class="btn btn-ghost sreg-print-btn" data-challan="${r.challanNo}" title="Print Challan" style="padding:2px 6px; font-size:11px; color:var(--blue);"><i class="fa-solid fa-print"></i></button>
            </div>
          </td>
          <td data-label="Date">${r.date}</td>
          <td data-label="Customer">${r.customer}</td>
          <td data-label="Order No">${r.orderNo}</td>
          <td data-label="Category">${r.category}</td>
          <td data-label="Brand">${r.brand}</td>
          <td data-label="Qty">${r.qty}</td>
          <td data-label="Sales Invoice">${r.invoice || '-'}</td>
          <td data-label="Edited?" ${r.edited ? 'class="gold-txt"' : ''}>${r.edited ? 'Yes' : 'No'}</td>
        </tr>`).join('');

      // Wire row checkboxes
      tbody.querySelectorAll('.sreg-row-chk').forEach(chk => {
        chk.addEventListener('change', () => {
          const chNo = chk.getAttribute('data-challan');
          if (chk.checked) selectedChallans.add(chNo);
          else selectedChallans.delete(chNo);
          const tr = chk.closest('tr');
          if (tr) tr.classList.toggle('selected-row', chk.checked);
          if (bulkBarApi) bulkBarApi.update(selectedChallans.size);
        });
      });
    }

    // Select All Checkbox
    const selectAllEl = $('sregSelectAll');
    if (selectAllEl) {
      selectAllEl.addEventListener('change', () => {
        const visible = allRows.filter((r) => isRowVisible(rowToValues(r)));
        if (selectAllEl.checked) {
          visible.forEach(r => selectedChallans.add(r.challanNo));
        } else {
          selectedChallans.clear();
        }
        renderTable();
        if (bulkBarApi) bulkBarApi.update(selectedChallans.size);
      });
    }

    // Initialize Bulk Actions Bar
    const bulkContainer = $('sregBulkBar');
    if (bulkContainer && window.initBulkActionsBar) {
      bulkBarApi = window.initBulkActionsBar(bulkContainer, {
        getSelectedData: () => {
          return allRows.filter(r => selectedChallans.has(r.challanNo));
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
          a.download = `Sales_Selected_${selected.length}_rows.csv`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          if (window.showToast) window.showToast(`Exported ${selected.length} selected sales records.`);
        },
        onPrint: (selected) => {
          if (!selected.length) return;
          selected.forEach(r => {
            if (typeof window.printChallanByNo === 'function') {
              window.printChallanByNo(r.challanNo);
            }
          });
        },
        onCopy: (selected) => {
          if (!selected.length) return;
          const list = selected.map(r => `Challan: ${r.challanNo} | Order: ${r.orderNo} | Customer: ${r.customer}`).join('\n');
          navigator.clipboard.writeText(list).then(() => {
            if (window.showToast) window.showToast(`Copied ${selected.length} Challan references to clipboard!`);
          }).catch(() => {});
        },
        onClear: () => {
          selectedChallans.clear();
          if (selectAllEl) selectAllEl.checked = false;
          renderTable();
          if (bulkBarApi) bulkBarApi.update(0);
        }
      });
    }

    // Initialize Saved Views Bar
    const savedViewsContainer = $('sregSavedViews');
    if (savedViewsContainer && window.initSavedViewsBar) {
      window.initSavedViewsBar(savedViewsContainer, {
        pageKey: 'sales_register',
        defaultPresets: [
          { id: 'all', label: 'All Dispatches', state: { cat: 'All Categories', search: '', from: toISO(firstOfMonth), to: toISO(today) } },
          { id: 'today', label: "Today's Dispatches", state: { cat: 'All Categories', search: '', from: toISO(today), to: toISO(today) } },
          { id: 'solar', label: 'Solar Panels', state: { cat: 'Solar Panel', search: '', from: toISO(firstOfMonth), to: toISO(today) } },
          { id: 'inverter', label: 'Inverters', state: { cat: 'Inverter', search: '', from: toISO(firstOfMonth), to: toISO(today) } }
        ],
        onApply: (state) => {
          if (state.from) fromEl.value = state.from;
          if (state.to) toEl.value = state.to;
          if (state.cat) catEl.value = state.cat;
          if (state.search !== undefined) searchEl.value = state.search;
          loadData();
        },
        getCurrentState: () => ({
          from: fromEl.value,
          to: toEl.value,
          cat: catEl.value,
          search: searchEl.value
        })
      });
    }

    [fromEl, toEl, catEl].forEach((el) => el.addEventListener('change', loadData));
    searchEl.addEventListener('input', window.debounce(loadData, 150));
    $('sregBtnRefresh').addEventListener('click', loadData);

    // ---------- click print button or double-click row -> Project Sales ----------
    tbody.addEventListener('click', (e) => {
      const printBtn = e.target.closest('.sreg-print-btn');
      if (printBtn) {
        e.stopPropagation();
        const chNo = printBtn.dataset.challan;
        if (typeof window.printChallanByNo === 'function') {
          window.printChallanByNo(chNo);
        }
      }
    });

    tbody.addEventListener('dblclick', (e) => {
      if (e.target.closest('.sreg-print-btn')) return;
      const row = e.target.closest('.sreg-row');
      if (!row) return;
      const challanNo = row.dataset.challan;
      window.go('sales');
      setTimeout(() => {
        if (window.SalesPageAPI) window.SalesPageAPI.loadChallanForEdit(challanNo);
      }, 100);
    });

    // ---------- Excel-style header filters ----------
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

    $('sregBtnClearFilters').addEventListener('click', () => {
      Object.keys(activeFilters).forEach((k) => delete activeFilters[k]);
      applyAllFilters();
    });

    $('sregBtnExport').addEventListener('click', () => {
      const visible = allRows.filter((r) => isRowVisible(rowToValues(r)));
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
      a.download = `Sale_Register_${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (window.showToast) window.showToast('Sale Register exported.');
    });

    loadData();
  },
};