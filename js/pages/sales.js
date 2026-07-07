// js/pages/sales.js
window.PAGES = window.PAGES || {};

window.PAGES.sales = {
  name: 'Project Sales',
  icon: 'fa-dolly-flatbed',
  sub: 'Dispatch stock against sales orders',
  html: `
    <div class="page-head">
      <i class="fa-solid fa-dolly-flatbed" style="color:var(--orange);"></i><h2>Project Sales</h2>
      <button class="btn btn-gold btn-toggle-edit" type="button" id="saleBtnToggleEdit">
        <i class="fa-solid fa-pen-to-square"></i> <span id="saleToggleEditLabel">Edit / Modify Order</span>
      </button>
      <div class="hint">Connected to Live Production Database via Node API.</div>
    </div>

    <div class="split-two edit-closed" id="saleSplit">
      <div class="split-two-track">

        <div class="panel">
          <h3><i class="fa-solid fa-file-invoice-dollar"></i> New Sales / Dispatch Entry</h3>
          <div class="form-grid cols-2">
            <div class="field"><label>Category <span class="req">*</span></label>
              <select id="saleCat"><option>Solar Panel</option><option>Inverter</option><option>Battery</option></select></div>
            <div class="field"><label>Brand <span class="req">*</span></label>
              <select id="saleBrand"><option>Waaree</option><option>Adani</option><option>Vikram Solar</option></select></div>
            <div class="field"><label>Wattage <span class="req">*</span></label><input id="saleWatt" placeholder="e.g. 545"></div>
            <div class="field"><label>Type <span class="req">*</span></label>
              <select id="saleType"><option>Mono PERC</option><option>Bifacial</option></select></div>

            <div class="field"><label>Customer Short Code</label><input id="saleCustShort" placeholder="Ledger short name (optional)"></div>
            <div class="field"><label>Customer Name <span class="req">*</span></label><input id="saleCust" placeholder="Customer / Party"></div>
            <div class="field"><label>Mobile</label><input id="saleCustMobile" placeholder="Auto-fills from ledger" readonly></div>
            <div class="field span-full"><label>Address / Site</label><input id="saleCustAddr" placeholder="Auto-fills from ledger" readonly></div>

            <div class="field"><label>Order No <span class="req">*</span></label><input id="saleOrder" placeholder="NP order no."></div>
            <div class="field"><label>Challan No <span class="req">*</span></label><input id="saleChalanNo" placeholder="CH-2026-001"></div>
            <div class="field"><label>Challan Date <span class="req">*</span></label><input id="saleChalanDate" type="date"></div>
            <div class="field"><label>Sales Invoice No</label><input id="saleInvNo" placeholder="Optional"></div>
            <div class="field"><label>Invoice Date</label><input id="saleInvDate" type="date"></div>
            <div class="field"><label>Expected Qty <span class="req">*</span></label><input id="saleQty" type="number" placeholder="0"></div>

            <div class="field span-full"><label>Scan Serial Numbers <span class="req">*</span></label>
              <textarea id="saleSerials" placeholder="One serial per line"></textarea>
            </div>

            <div class="field span-full">
              <label>Invoice Product Lines</label>
              <div class="line-list" id="saleLineList"></div>
              <div class="line-btns">
                <button class="btn btn-green" type="button" id="saleBtnAddLine"><i class="fa-solid fa-plus"></i> Add Product Line</button>
                <button class="btn btn-ghost" type="button" id="saleBtnRemoveLine"><i class="fa-solid fa-minus"></i> Remove Line</button>
              </div>
            </div>
          </div>
          <div class="actions-row">
            <button class="btn btn-red" type="button" id="saleBtnSave"><i class="fa-solid fa-truck"></i> Confirm Dispatch</button>
            <button class="btn btn-ghost" type="button" id="saleBtnClearForm"><i class="fa-solid fa-eraser"></i> Clear Form</button>
          </div>
        </div>

        <div class="panel edit-panel sales-edit" id="saleEditPanel">
          <h3 style="color:var(--purple);"><i class="fa-solid fa-pen-to-square"></i> Sales Order Modification <span class="role-tag" id="saleRoleTag">(SuperAdmin)</span></h3>

          <div class="search-row">
            <input id="saleSearchOrder" placeholder="Search by Order No, Challan No, or Customer Name...">
            <button class="btn btn-ghost" type="button" id="saleBtnFind"><i class="fa-solid fa-magnifying-glass"></i> Find</button>
          </div>

          <div class="form-grid cols-2">
            <div class="field span-full"><label>Customer <span class="req">*</span></label><input id="saleEditCust" placeholder="Customer name"></div>
            <div class="field"><label>Challan No <span class="req">*</span></label><input id="saleEditChalanNo" placeholder="Challan number"></div>
            <div class="field"><label>Challan Date <span class="req">*</span></label><input id="saleEditChalanDate" type="date"></div>
            <div class="field"><label>Invoice No</label><input id="saleEditInvNo" placeholder="Invoice number"></div>
            <div class="field"><label>Invoice Date</label><input id="saleEditInvDate" type="date"></div>

            <div class="field span-full"><label>Serials <span class="req">*</span></label><textarea id="saleEditSerials" placeholder="Serials will load here..."></textarea></div>
          </div>

          <div class="actions-row">
            <button class="btn btn-gold" type="button" id="saleBtnApply"><i class="fa-solid fa-check"></i> Apply Modifications</button>
            <button class="btn btn-ghost" type="button" id="saleBtnClearEdit"><i class="fa-solid fa-eraser"></i> Clear Changes</button>
            <button class="btn btn-red" type="button" id="saleBtnDelete"><i class="fa-solid fa-trash"></i> Delete Transaction</button>
          </div>
        </div>

      </div>
    </div>
  `,

  init() {
    const $ = (id) => document.getElementById(id);
    const API_BASE = window.API_BASE || 'http://192.168.0.123:5000/api';
    const currentRole = window.currentUserRole || 'User';
    const isAdmin = currentRole === 'SuperAdmin';

    const saleSplit = $('saleSplit');
    const saleToggleLabel = $('saleToggleEditLabel');
    const editPanelEl = $('saleEditPanel');

    // ROLE WISE RESTRICTIONS AND LOCK BANNER DISPLAY (Synced with purchase.js specifications)
    if (!isAdmin) {
      $('saleRoleTag').textContent = '(Locked — View Only)';
      
      // Gray out edit toggle button on mobile header row layout completely
      const toggleBtn = $('saleBtnToggleEdit');
      toggleBtn.disabled = true;
      toggleBtn.style.opacity = '0.55';
      toggleBtn.style.cursor = 'not-allowed';
      toggleBtn.title = 'SuperAdmin only';

      // Lock down modification fields internally
      editPanelEl.querySelectorAll('input, select, textarea, button').forEach((el) => { 
        el.disabled = true; 
      });

      // Injecting exact Lock Banner component match
      const lockBanner = document.createElement('div');
      lockBanner.className = 'banner';
      lockBanner.style.marginBottom = '14px';
      lockBanner.innerHTML = '<i class="fa-solid fa-lock"></i><div><strong>Locked.</strong> Only a SuperAdmin can view or modify saved sales challans.</div>';
      editPanelEl.insertBefore(lockBanner, editPanelEl.children[1] || null);
    }

    $('saleBtnToggleEdit').addEventListener('click', () => {
      if (!isAdmin) return;
      const isClosed = saleSplit.classList.contains('edit-closed');
      saleSplit.classList.toggle('edit-closed', !isClosed);
      saleToggleLabel.textContent = isClosed ? 'Close Edit Section' : 'Edit / Modify Order';
    });

    document.querySelectorAll('#saleSplit input[type="date"]').forEach((el) => {
      el.addEventListener('click', () => { if (el.showPicker) { try { el.showPicker(); } catch (e) {} } });
      el.addEventListener('keydown', (e) => { if (e.key !== 'Tab') e.preventDefault(); });
    });

    const saleLines = [];
    const saleLineList = $('saleLineList');

    function renderLines() {
      if (!saleLines.length) {
        saleLineList.innerHTML = `<div class="empty">No product lines added yet — fill the fields above and click "Add Product Line".</div>`;
        return;
      }
      saleLineList.innerHTML = saleLines.map((ln, idx) => `
        <div class="line-item ${ln.selected ? 'selected' : ''}" onclick="window.PAGES.sales.toggleLineSelect(${idx})">
          <span>${ln.cat} • ${ln.brand} • ${ln.watt}W • ${ln.type}</span>
          <span class="qty-badge">Qty ${ln.qty}</span>
        </div>
      `).join('');
    }
    renderLines();

    $('saleBtnAddLine').addEventListener('click', () => {
      const cat = $('saleCat').value, brand = $('saleBrand').value, watt = $('saleWatt').value.trim();
      const type = $('saleType').value, qty = $('saleQty').value.trim();
      if (!qty || Number(qty) <= 0) {
        window.openModal('Validation Error', '<p>Enter a valid Quantity before adding a product line.</p>');
        return;
      }
      saleLines.push({ cat, brand, watt, type, qty, selected: false });
      renderLines();
      $('saleQty').value = '';
    });

    $('saleBtnRemoveLine').addEventListener('click', () => {
      const idx = saleLines.findIndex(l => l.selected);
      if (idx !== -1) {
        saleLines.splice(idx, 1);
        renderLines();
      }
    });

    window.PAGES.sales.toggleLineSelect = (idx) => {
      saleLines.forEach((l, i) => l.selected = (i === idx));
      renderLines();
    };

    $('saleBtnSave').addEventListener('click', async () => {
      const customer = $('saleCust').value.trim();
      const orderNo = $('saleOrder').value.trim();
      const challanNo = $('saleChalanNo').value.trim();
      const challanDate = $('saleChalanDate').value;
      const serialsRaw = $('saleSerials').value.split('\n').map(s => s.trim()).filter(Boolean);

      if (!customer || !orderNo || !challanNo || !challanDate || !serialsRaw.length) {
        window.openModal('Missing Fields', '<p>Please fill all mandatory (*) fields.</p>');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/sales/dispatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lines: saleLines, customer, orderNo, challanNo, challanDate, invoiceNo: $('saleInvNo').value, invoiceDate: $('saleInvDate').value, serials: serialsRaw })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server rejected request');
        
        window.showToast('Sales Dispatch Executed successfully!');
        ['saleCust', 'saleOrder', 'saleChalanNo', 'saleChalanDate', 'saleInvNo', 'saleInvDate', 'saleSerials'].forEach(id => $(id).value = '');
        saleLines.length = 0;
        renderLines();
      } catch (err) {
        window.openModal('Execution Error', `<p style="color:var(--red);">${err.message}</p>`);
      }
    });

    let originalChallanId = null;
    $('saleBtnFind').addEventListener('click', async () => {
      if (!isAdmin) return;
      const term = $('saleSearchOrder').value.trim();
      if (!term) return;
      try {
        const res = await fetch(`${API_BASE}/sales/find/${encodeURIComponent(term)}`);
        if (!res.ok) throw new Error('No record found');
        const rows = await res.json();
        
        originalChallanId = rows[0].challanNo;
        $('saleEditCust').value = rows[0].customer;
        $('saleEditChalanNo').value = rows[0].challanNo;
        $('saleEditChalanDate').value = rows[0].date;
        $('saleEditInvNo').value = rows[0].invoiceNo || '';
        $('saleEditInvDate').value = rows[0].invoiceDate || '';
        $('saleEditSerials').value = rows.map(r => r.sn).join('\n');
        
        window.showToast('Sales Records Loaded successfully.');
      } catch (err) {
        window.openModal('Not Found', `<p>${err.message}</p>`);
      }
    });

    $('saleBtnApply').addEventListener('click', async () => {
      if (!isAdmin || !originalChallanId) return;
      const serials = $('saleEditSerials').value.split('\n').map(s => s.trim()).filter(Boolean);
      try {
        const res = await fetch(`${API_BASE}/sales/modify/${originalChallanId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer: $('saleEditCust').value, challanNo: $('saleEditChalanNo').value, challanDate: $('saleEditChalanDate').value, invoiceNo: $('saleEditInvNo').value, invoiceDate: $('saleEditInvDate').value, serials })
        });
        if (!res.ok) throw new Error('Failed to modify tracking register');
        window.showToast('Sales Modifications Saved.');
      } catch (err) {
        window.openModal('Error', `<p>${err.message}</p>`);
      }
    });

    $('saleBtnDelete').addEventListener('click', async () => {
      if (!isAdmin || !originalChallanId || !confirm('Permanently delete this order from database?')) return;
      try {
        const res = await fetch(`${API_BASE}/sales/delete/${originalChallanId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Deletion failed.');
        window.showToast('Transaction completely rolled back.');
        ['saleEditCust', 'saleEditChalanNo', 'saleEditChalanDate', 'saleEditInvNo', 'saleEditInvDate', 'saleEditSerials'].forEach(id => $(id).value = '');
        originalChallanId = null;
      } catch (err) {
        window.openModal('Error', `<p>${err.message}</p>`);
      }
    });

    window.SalesPageAPI = {
      loadChallanForEdit(challanNo) {
        if (!isAdmin) {
          window.openModal('Locked', '<p>Only a SuperAdmin can modify sales invoices.</p>');
          return;
        }
        saleSplit.classList.remove('edit-closed');
        saleToggleLabel.textContent = 'Close Edit Section';
        $('saleSearchOrder').value = challanNo;
        $('saleBtnFind').click();
      }
    };
  }
};