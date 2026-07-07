// js/pages/returns.js
window.PAGES = window.PAGES || {};

window.PAGES.returns = {
  name: 'Return & Damage',
  icon: 'fa-rotate-left',
  sub: 'Process sales returns & damaged stock',
  html: `
    <div class="page-head"><i class="fa-solid fa-rotate-left" style="color:var(--red);"></i><h2>Return &amp; Damage Control</h2></div>
    <div class="panel" style="max-width:640px;">
      <h3><i class="fa-solid fa-tools"></i> Stock Adjustment</h3>
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div class="field"><label>Action Type</label>
          <select><option>Sales Return (Make Available)</option><option>Mark as Damaged / Scrapped</option></select>
        </div>
        <div class="field"><label>Remarks / Reason <span class="req">*</span></label><input placeholder="Enter reason..."></div>
        <div class="field"><label>Action Date <span class="req">*</span></label><input type="date"></div>
        <div class="field"><label>Scan Serial Numbers <span class="req">*</span></label><textarea placeholder="Scan serial numbers here..."></textarea></div>
      </div>
      <div class="actions-row"><button class="btn btn-red"><i class="fa-solid fa-tools"></i> Execute Stock Adjustment</button></div>
    </div>
  `
};
