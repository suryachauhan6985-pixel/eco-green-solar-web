// js/pages/saleregister.js
window.PAGES = window.PAGES || {};

window.PAGES.saleregister = {
  name: 'Sale Register',
  icon: 'fa-file-invoice',
  sub: 'All sales challans, filterable',
  html: `
    <div class="page-head"><i class="fa-solid fa-file-invoice" style="color:var(--orange);"></i><h2>Sale Register</h2></div>
    <div class="toolbar">
      <div><label>From</label> <input type="date" id="sregFrom"></div>
      <div><label>To</label> <input type="date" id="sregTo"></div>
      <div><label>Category</label> <select id="sregCategory"><option>All Categories</option></select></div>
      <div class="grow"><input id="sregSearch" placeholder="Search challan, customer, order no..." style="width:100%;"></div>
      <button class="btn btn-ghost" type="button" id="sregBtnClearFilters"><i class="fa-solid fa-filter"></i> Clear Column Filters</button>
      <button class="btn btn-green" type="button" id="sregBtnExport"><i class="fa-solid fa-file-excel"></i> Export</button>
      <button class="btn btn-ghost" type="button" id="sregBtnRefresh"><i class="fa-solid fa-rotate"></i> Refresh</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th data-col="Challan No">Challan No <button class="th-filter-btn" data-col="Challan No" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Date">Date <button class="th-filter-btn" data-col="Date" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Customer">Customer <button class="th-filter-btn" data-col="Customer" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Order No">Order No <button class="th-filter-btn" data-col="Order No" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Category">Category <button class="th-filter-btn" data-col="Category" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Brand">Brand <button class="th-filter-btn" data-col="Brand" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Qty">Qty <button class="th-filter-btn" data-col="Qty" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Invoice">Invoice <button class="th-filter-btn" data-col="Invoice" type="button"><i class="fa-solid fa-filter"></i></button></th>
        <th data-col="Edited?">Edited? <button class="th-filter-btn" data-col="Edited?" type="button"><i class="fa-solid fa-filter"></i></button></th>
      </tr></thead>
      <tbody id="sregBody"></tbody>
    </table></div>
    <div class="hint" style="margin-top:8px;">Double-click any record to open it directly in Project Sales modification panel.</div>
  `,

  init() {
    const $ = (id) => document.getElementById(id);
    const tbody = $('sregBody');
    const fromEl = $('sregFrom');
    const toEl = $('sregTo');
    const catEl = $('sregCategory');
    const searchEl = $('sregSearch');

    // Default dates system mirroring purchase module exactly
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    function toISO(d) { return d.toISOString().slice(0, 10); }
    fromEl.value = toISO(firstOfMonth);
    toEl.value = toISO(today);

    document.querySelectorAll('#sregFrom, #sregTo').forEach((el) => {
      el.addEventListener('click', () => { if (el.showPicker) { try { el.showPicker(); } catch (e) {} } });
    });

    let allRows = [];    
    let activeFilters = {}; 
    let openMenuEl = null;
    const columns = ['Challan No', 'Date', 'Customer', 'Order No', 'Category', 'Brand', 'Qty', 'Invoice', 'Edited?'];

    function parseDMY(str) {
      const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(str || ''));
      if (!m) return 0;
      return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
    }

    function inDateRange(dmy) {
      const t = parseDMY(dmy);
      if (!t) return false;
      const from = fromEl.value ? new Date(fromEl.value).getTime() : -Infinity;
      const to = toEl.value ? new Date(toEl.value).getTime() : Infinity;
      return t >= from && t <= to;
    }

    function rowToValues(r) {
      return [r.challanNo, r.date, r.customer, r.orderNo, r.category, r.brand, String(r.qty), r.invoice || '-', r.edited || 'No'];
    }

    // INSTANT LOCAL LOADING BLOCK (Same as purchase core engine architecture)
    function loadData() {
      const data = window.SalesData ? window.SalesData.getAll() : [];
      
      // Dynamic category setup
      const cats = new Set(data.map(r => r.category).filter(Boolean));
      catEl.innerHTML = '<option>All Categories</option>';
      cats.forEach(c => {
        const opt = document.createElement('option');
        opt.textContent = c;
        catEl.appendChild(opt);
      });

      filterBaseDataset(data);
    }

    function filterBaseDataset(data) {
      const selectedCat = catEl.value;
      const term = searchEl.value.trim().toLowerCase();

      allRows = data.filter((r) => {
        if (selectedCat !== 'All Categories' && r.category !== selectedCat) return false;
        if (!inDateRange(r.date)) return false;
        
        const values = rowToValues(r);
        if (term && !values.some((v) => String(v || '').toLowerCase().includes(term))) return false;
        
        return true;
      });

      renderTable();
    }

    function isRowVisible(values) {
      return columns.every((col, i) => !activeFilters[col] || activeFilters[col].has(values[i]));
    }

    function renderTable() {
      const visible = allRows.filter((r) => isRowVisible(rowToValues(r)));
      
      if (!visible.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--txt-muted); font-style:italic;">No sales records found for the selected filters.</td></tr>`;
        return;
      }

      tbody.innerHTML = visible.map((r) => `
        <tr class="sreg-row" data-challan="${r.challanNo}" style="cursor:pointer;" title="Double-click to edit this order">
          <td data-label="Challan No" class="gold-txt">${r.challanNo}</td>
          <td data-label="Date">${r.date}</td>
          <td data-label="Customer">${r.customer}</td>
          <td data-label="Order No">${r.orderNo}</td>
          <td data-label="Category">${r.category}</td>
          <td data-label="Brand">${r.brand}</td>
          <td data-label="Qty">${r.qty}</td>
          <td data-label="Invoice">${r.invoice || '-'}</td>
          <td data-label="Edited?" ${r.edited === 'Yes' ? 'class="gold-txt"' : ''}>${r.edited || 'No'}</td>
        </tr>`).join('');
    }

    [fromEl, toEl, catEl].forEach((el) => el.addEventListener('change', () => {
      if (window.SalesData) filterBaseDataset(window.SalesData.getAll());
    }));
    
    searchEl.addEventListener('input', () => {
      if (window.SalesData) filterBaseDataset(window.SalesData.getAll());
    });

    $('sregBtnRefresh').addEventListener('click', loadData);

    tbody.addEventListener('dblclick', (e) => {
      const row = e.target.closest('.sreg-row');
      if (!row) return;
      const challanNo = row.dataset.challan;
      window.go('sales');
      setTimeout(() => {
        if (window.SalesPageAPI) window.SalesPageAPI.loadChallanForEdit(challanNo);
      }, 100);
    });

    // Excel filter setup logic block
    const filterBtns = document.querySelectorAll('.th-filter-btn');
    function uniqueValues(col) {
      const i = columns.indexOf(col);
      return Array.from(new Set(allRows.map((r) => rowToValues(r)[i])));
    }

    function closeMenu() {
      if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; }
    }

    function openMenuFor(btn) {
      const col = btn.dataset.col;
      closeMenu();
      const values = uniqueValues(col);
      const selected = activeFilters[col] || new Set(values);

      const menu = document.createElement('div');
      menu.className = 'th-filter-menu show';
      menu.style.position = 'fixed';
      
      const rect = btn.getBoundingClientRect();
      menu.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px';
      menu.style.top = (rect.bottom + window.scrollY + 5) + 'px';

      menu.innerHTML = `
        <div class="th-filter-search"><input type="text" placeholder="Search..."></div>
        <label class="th-filter-item th-filter-selectall">
          <input type="checkbox" ${selected.size === values.length ? 'checked' : ''}> <span>Select All</span>
        </label>
        <div class="th-filter-list" style="max-height:180px; overflow-y:auto;">
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
        renderTable();
      });
      menu.querySelector('.th-filter-ok').addEventListener('click', () => {
        const checked = itemCbs().filter((cb) => cb.checked).map((cb) => cb.value);
        if (checked.length === values.length) delete activeFilters[col];
        else activeFilters[col] = new Set(checked);
        closeMenu();
        renderTable();
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
    $('sregBtnClearFilters').addEventListener('click', () => { 
      activeFilters = {}; 
      if (window.SalesData) filterBaseDataset(window.SalesData.getAll()); 
    });

    loadData();
  }
};