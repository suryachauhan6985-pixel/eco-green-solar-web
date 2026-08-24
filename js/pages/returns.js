// js/pages/returns.js
// Goal 4: Return/Damage now supports BOTH serial-based and quantity-based
// items in a single batch, mirroring the Sales multi-line pattern instead
// of the old flat "scan any serial" box:
//   - Each product line picks Category -> Brand -> Wattage -> Type (same
//     cascading dropdowns as Purchase/Sales, reusing the same endpoints).
//   - Category's `serial_mandatory` flag (from /api/masters/categories,
//     see Goal 2/3) decides the line's input: serial-mandatory categories
//     show the scan/paste serial textarea (same auto-split/dedupe behaviour
//     as before); non-mandatory categories show a plain Quantity number
//     input instead — no serial box at all.
//   - Multiple lines (mixed serial + qty) can be queued and submitted as
//     ONE batch, sharing the same Action Type / Remarks / Date, same as
//     before. Whole-batch validation still applies server-side: if ANY
//     line fails, nothing is written ("ADJUSTMENT BLOCKED").
window.PAGES = window.PAGES || {};

window.PAGES.returns = {
  name: 'Return & Damage',
  icon: 'fa-rotate-left',
  sub: 'Process sales returns & damaged stock',
  html: `
    <div class="page-head"><i class="fa-solid fa-rotate-left" style="color:var(--red);"></i><h2>Return &amp; Damage Control</h2></div>

    <div class="panel" style="max-width:760px; width:100%;">
      <h3><i class="fa-solid fa-tools"></i> Stock Adjustment</h3>
      <div class="form-grid cols-2">
        <div class="field"><label>Action Type</label>
          <select id="retActionType">
            <option>Sales Return (Make Available)</option>
            <option>Mark as Damaged / Scrapped</option>
          </select>
        </div>
        <div class="field"><label>Action Date <span class="req">*</span></label>
          <input id="retDate" type="date">
        </div>
        <div class="field span-full"><label>Remarks / Reason <span class="req">*</span></label>
          <input id="retRemarks" placeholder="Enter reason...">
        </div>
      </div>
    </div>

    <div class="panel" style="max-width:760px; width:100%;">
      <h3><i class="fa-solid fa-layer-group"></i> Add Product Line</h3>
      <div class="form-grid cols-2">
        <div class="field"><label>Category</label>
          <select id="retLineCat"><option value="">Select Category...</option></select>
        </div>
        <div class="field"><label>Brand</label>
          <select id="retLineBrand" disabled><option value="">Select Brand...</option></select>
        </div>
        <div class="field"><label>Wattage</label>
          <select id="retLineWatt" disabled><option value="">Select Wattage...</option></select>
        </div>
        <div class="field"><label>Subtype</label>
          <select id="retLineType" disabled><option value="">Select Subtype...</option></select>
        </div>
      </div>

      <div id="retLineSerialWrap" class="field" style="display:none; margin-top:10px;">
        <label>Scan Serial Numbers <span class="req">*</span></label>
        <textarea id="retLineSerials" rows="6" placeholder="Scan serial numbers here..." style="font-family:'Courier New', monospace;"></textarea>
      </div>
      <div id="retLineQtyWrap" class="field" style="display:none; margin-top:10px;">
        <label>Quantity <span class="req">*</span></label>
        <input id="retLineQty" type="number" min="1" step="1" placeholder="Enter quantity...">
      </div>
      <div id="retLineHint" style="color:var(--muted,#888); font-size:.85em; margin:4px 0 8px;"></div>

      <div class="actions-row">
        <button class="btn btn-outline" id="btnAddLine" disabled><i class="fa-solid fa-plus"></i> Add Line</button>
      </div>
    </div>

    <div class="panel" style="max-width:760px; width:100%;">
      <h3><i class="fa-solid fa-list"></i> Queued Lines</h3>
      <div class="table-wrap">
        <table class="data-table" id="retLinesTable">
          <thead>
            <tr><th>Category</th><th>Brand</th><th>Watt</th><th>Type</th><th>Serials / Qty</th><th></th></tr>
          </thead>
          <tbody id="retLinesBody">
            <tr id="retLinesEmpty"><td colspan="6" style="text-align:center; color:var(--muted,#888);">No lines added yet</td></tr>
          </tbody>
        </table>
      </div>
      <div class="actions-row">
        <button class="btn btn-red" id="btnProcessReturn"><i class="fa-solid fa-tools"></i> Execute Stock Adjustment</button>
      </div>
    </div>
  `,

  init() {
    const $ = (id) => document.getElementById(id);

    const actionEl = $('retActionType');
    const remarksEl = $('retRemarks');
    const dateEl = $('retDate');

    const catEl = $('retLineCat');
    const brandEl = $('retLineBrand');
    const wattEl = $('retLineWatt');
    const typeEl = $('retLineType');
    const serialWrap = $('retLineSerialWrap');
    const serialsEl = $('retLineSerials');
    const qtyWrap = $('retLineQtyWrap');
    const qtyEl = $('retLineQty');
    const hintEl = $('retLineHint');
    const btnAddLine = $('btnAddLine');
    const linesBody = $('retLinesBody');
    const linesEmptyRow = $('retLinesEmpty');
    const btnProcess = $('btnProcessReturn');

    dateEl.value = new Date().toISOString().slice(0, 10);

    // Queued lines for this batch: { cat, brand, watt, type, serials: [] }
    // OR { cat, brand, watt, type, qty: N }. Exactly one of serials/qty is set.
    let queuedLines = [];
    let categories = []; // cached /api/masters/categories rows (has serial_mandatory)
    let currentCategoryMeta = null; // the category row matching catEl's selection

    // --- Serial box helpers (unchanged behaviour from before) ---------------
    function splitSerials(text) {
      return String(text || '').match(/[A-Za-z0-9-]+/g) || [];
    }
    function wireSerialBox(el) {
      el.addEventListener('keydown', (e) => {
        if ([',', ' ', '|', ';', 'Tab'].includes(e.key)) {
          e.preventDefault();
          const before = el.value.slice(0, el.selectionStart);
          const after = el.value.slice(el.selectionEnd);
          const needsNewline = before && !before.endsWith('\n');
          el.value = before + (needsNewline ? '\n' : '') + after;
          const pos = before.length + (needsNewline ? 1 : 0);
          el.setSelectionRange(pos, pos);
        }
      });
      el.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const normalized = splitSerials(pasted).join('\n');
        const before = el.value.slice(0, el.selectionStart);
        const after = el.value.slice(el.selectionEnd);
        const prefix = before && !before.endsWith('\n') ? '\n' : '';
        el.value = before + prefix + normalized + '\n' + after;
      });
      el.addEventListener('blur', () => {
        el.value = splitSerials(el.value).join('\n');
      });
    }
    wireSerialBox(serialsEl);

    // --- Cascading dropdowns (Category -> Brand -> Wattage -> Type) --------
    function resetSelect(el, placeholder) {
      el.innerHTML = `<option value="">${placeholder}</option>`;
      el.disabled = true;
    }
    function fillSelect(el, values, placeholder) {
      el.innerHTML = `<option value="">${placeholder}</option>` +
        values.map((v) => `<option value="${v}">${v}</option>`).join('');
      el.disabled = !values.length;
    }

    function updateLineInputVisibility() {
      resetSelect(brandEl, 'Select Brand...');
      resetSelect(wattEl, 'Select Wattage...');
      resetSelect(typeEl, 'Select Type...');
      serialWrap.style.display = 'none';
      qtyWrap.style.display = 'none';
      hintEl.textContent = '';
      btnAddLine.disabled = true;
    }

    catEl.addEventListener('change', async () => {
      updateLineInputVisibility();
      const cat = catEl.value;
      currentCategoryMeta = categories.find((c) => c.name === cat) || null;
      if (!cat) return;
      try {
        const brands = await window.Api.get(`/purchase/brands/${encodeURIComponent(cat)}`);
        fillSelect(brandEl, (brands || []).map((b) => b.brand_name || b), 'Select Brand...');
      } catch (e) {
        fillSelect(brandEl, [], 'Select Brand...');
      }
    });

    brandEl.addEventListener('change', async () => {
      resetSelect(wattEl, 'Select Wattage...');
      resetSelect(typeEl, 'Select Type...');
      serialWrap.style.display = 'none';
      qtyWrap.style.display = 'none';
      btnAddLine.disabled = true;
      const cat = catEl.value, brand = brandEl.value;
      if (!cat || !brand) return;
      try {
        const watts = await window.Api.get(`/purchase/wattages?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}`);
        fillSelect(wattEl, watts || [], 'Select Wattage...');
        // Some categories have no wattage concept at all (watt_mandatory=0
        // and no rows come back) — allow proceeding straight to Type in
        // that case by treating wattage as "0".
        if (!(watts || []).length) {
          wattEl.innerHTML = `<option value="0">N/A</option>`;
          wattEl.disabled = false;
        }
      } catch (e) {
        fillSelect(wattEl, [], 'Select Wattage...');
      }
    });

    wattEl.addEventListener('change', async () => {
      resetSelect(typeEl, 'Select Type...');
      serialWrap.style.display = 'none';
      qtyWrap.style.display = 'none';
      btnAddLine.disabled = true;
      const cat = catEl.value, brand = brandEl.value, watt = wattEl.value;
      if (!cat || !brand || watt === '') return;
      try {
        let types = await window.Api.get(`/sales/types?category=${encodeURIComponent(cat)}&brand=${encodeURIComponent(brand)}&watt=${encodeURIComponent(watt)}`);
        if (!types || !types.length) {
          // Fall back to subtypes-by-category, same fallback sync_sales_solartype() uses.
          types = await window.Api.get(`/masters/subtypes/${encodeURIComponent(cat)}`);
        }
        fillSelect(typeEl, types || [], 'Select Type...');
      } catch (e) {
        fillSelect(typeEl, [], 'Select Type...');
      }
    });

    typeEl.addEventListener('change', () => {
      serialsEl.value = '';
      qtyEl.value = '';
      if (!typeEl.value) {
        serialWrap.style.display = 'none';
        qtyWrap.style.display = 'none';
        hintEl.textContent = '';
        btnAddLine.disabled = true;
        return;
      }
      const serialMandatory = (window.CONFIG && !window.CONFIG.isSerialTrackingEnabled()) ? false : (currentCategoryMeta ? !!currentCategoryMeta.serial_mandatory : true);
      if (serialMandatory) {
        serialWrap.style.display = '';
        qtyWrap.style.display = 'none';
        hintEl.textContent = 'This category requires Serial Numbers.';
      } else {
        serialWrap.style.display = 'none';
        qtyWrap.style.display = '';
        hintEl.textContent = 'This category is quantity-tracked — no Serial Number needed.';
      }
      btnAddLine.disabled = false;
    });

    // --- Queued lines table ---------------------------------------------------
    function renderLines() {
      linesBody.querySelectorAll('tr[data-idx]').forEach((tr) => tr.remove());
      linesEmptyRow.style.display = queuedLines.length ? 'none' : '';
      queuedLines.forEach((line, idx) => {
        const tr = document.createElement('tr');
        tr.dataset.idx = idx;
        const detail = line.serials
          ? `${line.serials.length} serial(s): ${line.serials.slice(0, 3).join(', ')}${line.serials.length > 3 ? '...' : ''}`
          : `Qty: ${line.qty}`;
        tr.innerHTML = `
          <td>${line.cat}</td><td>${line.brand}</td><td>${line.watt || 'N/A'}</td><td>${line.type}</td>
          <td>${detail}</td>
          <td><button class="btn btn-sm btn-outline" data-remove="${idx}"><i class="fa-solid fa-xmark"></i></button></td>
        `;
        linesBody.appendChild(tr);
      });
      linesBody.querySelectorAll('[data-remove]').forEach((btn) => {
        btn.addEventListener('click', () => {
          queuedLines.splice(Number(btn.dataset.remove), 1);
          renderLines();
        });
      });
    }

    btnAddLine.addEventListener('click', () => {
      const cat = catEl.value, brand = brandEl.value, watt = wattEl.value, type = typeEl.value;
      if (!cat || !brand || watt === '' || !type) {
        window.openModal('Validation Error', '<p>Select Category, Brand, Wattage and Type first.</p>');
        return;
      }
      const serialMandatory = (window.CONFIG && !window.CONFIG.isSerialTrackingEnabled()) ? false : (currentCategoryMeta ? !!currentCategoryMeta.serial_mandatory : true);
      if (serialMandatory) {
        const serials = splitSerials(serialsEl.value);
        if (!serials.length) {
          window.openModal('Validation Error', '<p>Scan at least one Serial Number for this line.</p>');
          return;
        }
        const allExisting = queuedLines.flatMap((l) => l.serials || []);
        const dupes = serials.filter((s) => allExisting.includes(s));
        if (dupes.length) {
          window.openModal('Duplicate Scans', `<p>Already queued: ${dupes.join(', ')}</p>`);
          return;
        }
        queuedLines.push({ cat, brand, watt, type, serials });
      } else {
        const qty = Number(qtyEl.value) || 0;
        if (qty <= 0) {
          window.openModal('Validation Error', '<p>Enter a Quantity greater than 0 for this line.</p>');
          return;
        }
        queuedLines.push({ cat, brand, watt, type, qty });
      }
      renderLines();
      // Reset just the line-entry inputs, keep Category selected for
      // convenience when adding several lines of the same category.
      serialsEl.value = '';
      qtyEl.value = '';
    });

    function resetForm() {
      remarksEl.value = '';
      dateEl.value = new Date().toISOString().slice(0, 10);
      queuedLines = [];
      renderLines();
      catEl.value = '';
      updateLineInputVisibility();
    }

    btnProcess.addEventListener('click', async () => {
      const actionType = actionEl.value;
      const remarks = remarksEl.value.trim();
      const actionDate = dateEl.value;

      if (!remarks || !actionDate || !queuedLines.length) {
        if (window.showWarning) window.showWarning('Validation Error', 'Remarks, Date, and at least one queued Line are mandatory.');
        else window.openModal('Validation Error', '<p>Remarks, Date, and at least one queued Line are mandatory.</p>');
        return;
      }

      btnProcess.disabled = true;
      const originalLabel = btnProcess.innerHTML;
      btnProcess.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
      try {
        const result = await window.Api.post('/returns', {
          actionType, remarks, date: actionDate,
          lines: queuedLines.map((l) => ({
            cat: l.cat, brand: l.brand, watt: l.watt, type: l.type,
            serials: l.serials || [], qty: l.qty || 0,
          })),
        });
        if (window.showToast) window.showToast(`Stock successfully adjusted as ${actionType}!`, 'success');
        if (window.showSuccess) {
          window.showSuccess('Adjustment Complete', `<p>${result.serialCount || 0} serial(s) and ${result.qtyAdjusted || 0} unit(s) successfully adjusted as <strong>${actionType}</strong>!</p>`);
        } else {
          window.openModal('Success', `<p>${result.serialCount || 0} serial(s) and ${result.qtyAdjusted || 0} unit(s) successfully adjusted as <strong>${actionType}</strong>!</p>`);
        }
        resetForm();
      } catch (err) {
        if (window.showError) {
          window.showError('Constraint Mismatch', err.message);
        } else {
          window.openModal('Constraint Mismatch', `<p style="color:var(--red); white-space:pre-line;">${err.message}</p>`);
        }
      } finally {
        btnProcess.disabled = false;
        btnProcess.innerHTML = originalLabel;
      }
    });

    // --- Load categories once, on init ---------------------------------------
    (async () => {
      try {
        categories = await window.Api.get('/masters/categories');
        fillSelect(catEl, categories.map((c) => c.name), 'Select Category...');
      } catch (e) {
        // leave categories empty; dropdown stays on placeholder
      }
    })();

    renderLines();
  },
};