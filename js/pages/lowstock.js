// js/pages/lowstock.js
window.PAGES = window.PAGES || {};

window.PAGES.lowstock = {
  name: 'Low Stock Alert',
  icon: 'fa-triangle-exclamation',
  sub: 'Items at or below minimum stock',
  html: `
    <div class="page-head"><i class="fa-solid fa-triangle-exclamation" style="color:var(--red);"></i><h2>Low Stock Alert</h2>
      <div class="hint">Yahan woh sabhi items dikhte hain jinka current stock minimum level se kam ya barabar ho gaya hai.</div>
    </div>
    <div class="toolbar">
      <div class="grow"><input placeholder="Search category, brand, type..." style="width:100%;"></div>
      <button class="btn btn-ghost"><i class="fa-solid fa-filter"></i> Clear Filters</button>
      <button class="btn btn-green"><i class="fa-solid fa-file-excel"></i> Export</button>
      <button class="btn btn-ghost"><i class="fa-solid fa-sync"></i> Refresh</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Category</th><th>Brand</th><th>Wattage</th><th>Type</th><th>Current Stock</th><th>Minimum Stock</th></tr></thead>
      <tbody>
        <tr>
          <td data-label="Category">Solar Panel</td><td data-label="Brand">Vikram Solar</td><td data-label="Wattage">335W</td>
          <td data-label="Type">Poly</td><td data-label="Current Stock" style="color:var(--red);">0</td><td data-label="Minimum Stock">10</td>
        </tr>
        <tr>
          <td data-label="Category">Battery</td><td data-label="Brand">Luminous</td><td data-label="Wattage">150Ah</td>
          <td data-label="Type">Tubular</td><td data-label="Current Stock" style="color:var(--orange);">4</td><td data-label="Minimum Stock">15</td>
        </tr>
        <tr>
          <td data-label="Category">Structure</td><td data-label="Brand">Generic</td><td data-label="Wattage">N/A</td>
          <td data-label="Type">Elevated</td><td data-label="Current Stock" style="color:var(--orange);">6</td><td data-label="Minimum Stock">20</td>
        </tr>
      </tbody>
    </table></div>
  `
};
