// js/pages/reports.js
window.PAGES = window.PAGES || {};

window.PAGES.reports = {
  name: 'Master Reports',
  icon: 'fa-clipboard-list',
  sub: 'Full serial-wise inventory report',
  html: `
    <div class="page-head"><i class="fa-solid fa-clipboard-list" style="color:var(--blue);"></i><h2>Master Reports</h2></div>
    <div class="toolbar">
      <div class="grow"><input placeholder="Search Serial No..." style="width:100%;"></div>
      <div><label>Category</label> <select><option>All Categories</option></select></div>
      <button class="btn btn-ghost"><i class="fa-solid fa-filter"></i> Clear Filters</button>
      <button class="btn btn-ghost"><i class="fa-solid fa-sync"></i> Refresh</button>
      <button class="btn btn-green"><i class="fa-solid fa-file-excel"></i> Export</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Serial No</th><th>Brand</th><th>Wattage</th><th>Category</th><th>Warehouse</th><th>Status</th><th>Supplier</th><th>Customer</th></tr></thead>
      <tbody>
        <tr>
          <td data-label="Serial No">SN00998821</td><td data-label="Brand">Waaree</td><td data-label="Wattage">545W</td>
          <td data-label="Category">Solar Panel</td><td data-label="Warehouse">Main NAS</td>
          <td data-label="Status"><span class="pill available">Available</span></td><td data-label="Supplier">Sunrise Traders</td><td data-label="Customer">-</td>
        </tr>
        <tr>
          <td data-label="Serial No">SN00887744</td><td data-label="Brand">Adani</td><td data-label="Wattage">5KW</td>
          <td data-label="Category">Inverter</td><td data-label="Warehouse">Rajkot Godown</td>
          <td data-label="Status"><span class="pill sold">Sold</span></td><td data-label="Supplier">Adani Distributors</td><td data-label="Customer">Patel Residence</td>
        </tr>
        <tr>
          <td data-label="Serial No">SN00776633</td><td data-label="Brand">Vikram</td><td data-label="Wattage">200Ah</td>
          <td data-label="Category">Battery</td><td data-label="Warehouse">Main NAS</td>
          <td data-label="Status"><span class="pill damaged">Damaged</span></td><td data-label="Supplier">Vikram Energy</td><td data-label="Customer">-</td>
        </tr>
      </tbody>
    </table></div>
  `
};
