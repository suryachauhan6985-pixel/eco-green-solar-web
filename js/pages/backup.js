// js/pages/backup.js
window.PAGES = window.PAGES || {};

window.PAGES.backup = {
  name: 'Backup & Restore',
  icon: 'fa-cloud-arrow-down',
  sub: 'Database backup and restore points',
  html: `
    <div class="page-head"><i class="fa-solid fa-cloud-arrow-down" style="color:var(--blue);"></i><h2>Backup &amp; Restore</h2></div>
    <div class="grid-2">
      <div class="panel">
        <h3><i class="fa-solid fa-download"></i> Create Backup</h3>
        <p style="color:var(--txt-muted); font-size:12.5px;">Poore database ka snapshot NAS storage par le lo, kabhi bhi restore kiya ja sakta hai.</p>
        <button class="btn btn-blue"><i class="fa-solid fa-database"></i> Backup Now</button>
      </div>
      <div class="panel">
        <h3><i class="fa-solid fa-clock-rotate-left"></i> Restore Points</h3>
        <div class="table-wrap"><table><thead><tr><th>Date</th><th>Size</th><th></th></tr></thead>
          <tbody>
            <tr><td data-label="Date">04-07-2026 11:20 PM</td><td data-label="Size">84 MB</td><td data-label=""><button class="btn btn-ghost" style="padding:5px 12px;">Restore</button></td></tr>
            <tr><td data-label="Date">03-07-2026 11:20 PM</td><td data-label="Size">83 MB</td><td data-label=""><button class="btn btn-ghost" style="padding:5px 12px;">Restore</button></td></tr>
          </tbody></table></div>
      </div>
    </div>
  `
};
