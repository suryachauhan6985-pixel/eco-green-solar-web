// js/pages/purchaseregister.js
// Mirrors ui/registers.py -> PurchaseRegisterPage from the desktop app:
// From/To date range + Category + free-text Search filter the rows, every
// column header also gets an Excel-style AutoFilter (funnel icon -> checkbox
// list), and double-clicking a row jumps to Purchase Inward with that
// invoice loaded into the edit panel, autofilled, ready to modify — exactly
// like double_clicked -> open_selected_ledger -> edit flow in the .py app.
// Rows come live from GET /api/purchase/register (same GROUP BY query as
// load_data() in registers.py), so this page always reflects whatever
// Purchase Inward has saved/edited/deleted in the real database.
window.PAGES = window.PAGES || {};

window.PAGES.purchaseregister = {
  name: 'Purchase Register',
  icon: 'fa-receipt',
  sub: 'All purchase invoices, filterable',
  html: `
    <div class="page-head"><i class="fa-solid fa-receipt" style="color:var(--green);"></i><h2>Purchase Register</h2>
      <button type="button" class="info-btn" data-info="Double-click any record to open it in Purchase Inward's edit panel, pre-filled. You can also filter any column using the filter icon in its header."><i class="fa-solid fa-circle-info"></i></button>
    </div>
    <div id="pregSavedViews"></div>
    <div class="toolbar">
      <div><label>From</label> <input type="date" id="pregFrom"></div>
      <div><label>To</label> <input type="date" id="pregTo"></div>
      <div><label>Category</label> <select id="pregCategory"><option>All Categories</option></select></div>
      <div class="grow"><input id="pregSearch" placeholder="Search invoice, supplier, brand, serial..." style="width:100%;"></div>
      <button class="btn btn-ghost" type="button" id="pregBtnClearFilters"><i class="fa-solid fa-filter"></i> Clear Column Filters</button>
      <button class="btn btn-green" type="button" id="pregBtnExport"><i class="fa-solid fa-file-excel"></i> Export</button>
      <button class="btn btn-ghost" type="button" id="pregBtnRefresh"><i class="fa-solid fa-rotate"></i> Refresh</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th style="width:36px; text-align:center;"><input type="checkbox" id="pregSelectAll" title="Select All"></th>
        <th data-col="Invoice No">Invoice No <button class="th-filter-btn" data-col="Invoice No" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Date">Date <button class="th-filter-btn" data-col="Date" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Supplier">Supplier <button class="th-filter-btn" data-col="Supplier" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Category">Category <button class="th-filter-btn" data-col="Category" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Brand">Brand <button class="th-filter-btn" data-col="Brand" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Qty">Qty <button class="th-filter-btn" data-col="Qty" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Warehouse">Warehouse <button class="th-filter-btn" data-col="Warehouse" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Edited?">Edited? <button class="th-filter-btn" data-col="Edited?" type="button"><i class="fa-solid fa-filter"></i></button></th>
      </tr></thead>
      <tbody id="pregBody"></tbody>
    </table></div>
    <div id="pregBulkBar"></div>
  `,

  init() {
    const $ = (id) => document.getElementById(id);
    const PD = window.PurchaseData;

    const tbody = $('pregBody');
    const fromEl = $('pregFrom');
    const toEl = $('pregTo');
    const catEl = $('pregCategory');
    const searchEl = $('pregSearch');

    // Default range: 1st of this month -> today, same default as the desktop page.
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    function toISO(d) { return d.toISOString().slice(0, 10); }
    fromEl.value = toISO(firstOfMonth);
    toEl.value = toISO(today);

    // Category dropdown — live from the Categories master (same source the
    // Purchase Inward form's Category dropdown uses), not a list derived
    // from whatever purchase rows happen to already be loaded.
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

    document.querySelectorAll('#pregFrom, #pregTo').forEach((el) => {
      el.addEventListener('click', () => { if (el.showPicker) { try { el.showPicker(); } catch (e) {} } });
    });

    let allRows = []; // date/category/search-filtered rows, before column (Excel-style) filters
    const activeFilters = {}; // { colLabel: Set of allowed values }
    let openMenuEl = null;
    const columns = ['Invoice No', 'Date', 'Supplier', 'Category', 'Brand', 'Qty', 'Warehouse', 'Edited?'];

    function rowToValues(r) {
      return [r.invoiceNo, r.date, r.supplier, r.category, r.brand, `${r.qty} ${r.uom || 'Nos'}`, r.warehouse, r.edited ? 'Yes' : 'No'];
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

    async function loadData() {
      const selectedCat = catEl.value;
      let rows = [];
      try {
        const path = selectedCat && selectedCat !== 'All Categories'
          ? `/purchase/register?category=${encodeURIComponent(selectedCat)}`
          : '/purchase/register';
        rows = await window.Api.get(path);
      } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--txt-muted); font-style:italic;">Could not load purchase records from the database.</td></tr>`;
        allRows = [];
        return;
      }
      allRows = rows.filter((r) => inDateRange(r.date) && matchesSearch(rowToValues(r)));
      selectedInvoices.clear();
      if (bulkBarApi) bulkBarApi.update(0);
      const selectAllEl = $('pregSelectAll');
      if (selectAllEl) selectAllEl.checked = false;
      renderTable();
    }

    const selectedInvoices = new Set();
    let bulkBarApi = null;

    function isRowVisible(values) {
      return columns.every((col, i) => !activeFilters[col] || activeFilters[col].has(values[i]));
    }

    function renderTable() {
      const visible = allRows.filter((r) => isRowVisible(rowToValues(r)));
      if (!visible.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--txt-muted); font-style:italic;">No purchase records found for the selected filters.</td></tr>`;
        return;
      }
      tbody.innerHTML = visible.map((r) => `
        <tr class="preg-row ${selectedInvoices.has(r.invoiceNo) ? 'selected-row' : ''}" data-inv="${r.invoiceNo}" style="cursor:pointer;" title="Double-click to edit this invoice">
          <td style="text-align:center;" onclick="event.stopPropagation()">
            <input type="checkbox" class="preg-row-chk" data-inv="${r.invoiceNo}" ${selectedInvoices.has(r.invoiceNo) ? 'checked' : ''}>
          </td>
          <td data-label="Invoice No" class="gold-txt">${r.invoiceNo}</td>
          <td data-label="Date">${r.date}</td>
          <td data-label="Supplier">${r.supplier}</td>
          <td data-label="Category">${r.category}</td>
          <td data-label="Brand">${r.brand}</td>
          <td data-label="Qty"><span style="font-weight:700;">${r.qty}</span> <small style="font-weight:600; color:var(--txt-muted);">${r.uom || 'Nos'}</small></td>
          <td data-label="Warehouse">${r.warehouse}</td>
          <td data-label="Edited?" ${r.edited ? 'class="gold-txt"' : ''}>${r.edited ? 'Yes' : 'No'}</td>
        </tr>`).join('');

      // Wire row checkboxes
      tbody.querySelectorAll('.preg-row-chk').forEach(chk => {
        chk.addEventListener('change', () => {
          const inv = chk.getAttribute('data-inv');
          if (chk.checked) selectedInvoices.add(inv);
          else selectedInvoices.delete(inv);
          const tr = chk.closest('tr');
          if (tr) tr.classList.toggle('selected-row', chk.checked);
          if (bulkBarApi) bulkBarApi.update(selectedInvoices.size);
        });
      });
    }

    // Select All Checkbox
    const selectAllEl = $('pregSelectAll');
    if (selectAllEl) {
      selectAllEl.addEventListener('change', () => {
        const visible = allRows.filter((r) => isRowVisible(rowToValues(r)));
        if (selectAllEl.checked) {
          visible.forEach(r => selectedInvoices.add(r.invoiceNo));
        } else {
          selectedInvoices.clear();
        }
        renderTable();
        if (bulkBarApi) bulkBarApi.update(selectedInvoices.size);
      });
    }

    // Initialize Bulk Actions Bar
    const bulkContainer = $('pregBulkBar');
    if (bulkContainer && window.initBulkActionsBar) {
      bulkBarApi = window.initBulkActionsBar(bulkContainer, {
        getSelectedData: () => {
          return allRows.filter(r => selectedInvoices.has(r.invoiceNo));
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
          a.download = `Purchase_Selected_${selected.length}_rows.csv`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          if (window.showToast) window.showToast(`Exported ${selected.length} selected invoices.`);
        },
        onCopy: (selected) => {
          if (!selected.length) return;
          const invList = selected.map(r => r.invoiceNo).join('\n');
          navigator.clipboard.writeText(invList).then(() => {
            if (window.showToast) window.showToast(`Copied ${selected.length} Invoice Numbers to clipboard!`);
          }).catch(() => {});
        },
        onClear: () => {
          selectedInvoices.clear();
          if (selectAllEl) selectAllEl.checked = false;
          renderTable();
          if (bulkBarApi) bulkBarApi.update(0);
        }
      });
    }

    // Initialize Saved Views Bar
    const savedViewsContainer = $('pregSavedViews');
    if (savedViewsContainer && window.initSavedViewsBar) {
      window.initSavedViewsBar(savedViewsContainer, {
        pageKey: 'purchase_register',
        defaultPresets: [
          { id: 'all', label: 'All Inwards', state: { cat: 'All Categories', search: '', from: toISO(firstOfMonth), to: toISO(today) } },
          { id: 'today', label: "Today's Inward", state: { cat: 'All Categories', search: '', from: toISO(today), to: toISO(today) } },
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
    $('pregBtnRefresh').addEventListener('click', loadData);

    // ---------- double-click a row -> Purchase Inward, edit panel, autofilled ----------
    tbody.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.preg-row');
      if (!row) return;
      const invoiceNo = row.dataset.inv;
      window.go('purchase');
      if (window.PurchasePageAPI && typeof window.PurchasePageAPI.loadInvoiceForEdit === 'function') {
        window.PurchasePageAPI.loadInvoiceForEdit(invoiceNo);
      }
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

    $('pregBtnClearFilters').addEventListener('click', () => {
      Object.keys(activeFilters).forEach((k) => delete activeFilters[k]);
      applyAllFilters();
    });

    $('pregBtnExport').addEventListener('click', () => {
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
      a.download = `Purchase_Register_${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (window.showToast) window.showToast('Purchase Register exported.');
    });

    loadData();
  },
};