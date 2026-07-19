// js/pages/returns.js
// Mirrors ui/returns.py's ReturnsPage exactly, wired to the real backend
// (/api/returns, see server.js) instead of being a static, non-functional
// preview form:
//   - Action Type: "Sales Return (Make Available)" or "Mark as Damaged /
//     Scrapped" — same two options as the desktop dropdown.
//   - Remarks/Date/Serials mandatory, same as the desktop app.
//   - Serial box auto-splits on comma/space/tab/pipe/semicolon and
//     normalizes pasted text to one serial per line — same behaviour as
//     ui/serial_widgets.py's SerialTextEdit (same helper already used by
//     Purchase/Sales in this web app).
//   - Duplicate scans in the same batch are rejected, exactly like the
//     desktop app's "Duplicate Scans" check.
//   - The whole batch is validated server-side against stock_ledger before
//     anything is written: a "Sales Return" is only allowed if the serial's
//     current status is 'Sold'; "Mark as Damaged" is blocked if the serial
//     is currently 'Sold' (must be returned first). If ANY serial fails,
//     the ENTIRE adjustment is blocked ("ADJUSTMENT BLOCKED" — same as the
//     desktop app's notify.critical message), nothing partial is saved.
//   - On success: Sales Return resets status -> 'Available' and clears the
//     customer/order/invoice/date "ghost" fields (chalan_no gets a
//     '[RETURNED] ' prefix); Mark as Damaged simply flips status ->
//     'Damaged'. Form resets (remarks + serials cleared, date back to
//     today) exactly like the desktop app after a successful adjustment.
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
          <select id="retActionType">
            <option>Sales Return (Make Available)</option>
            <option>Mark as Damaged / Scrapped</option>
          </select>
        </div>
        <div class="field"><label>Remarks / Reason <span class="req">*</span></label>
          <input id="retRemarks" placeholder="Enter reason...">
        </div>
        <div class="field"><label>Action Date <span class="req">*</span></label>
          <input id="retDate" type="date">
        </div>
        <div class="field"><label>Scan Serial Numbers <span class="req">*</span></label>
          <textarea id="retSerials" rows="8" placeholder="Scan serial numbers here..." style="font-family:'Courier New', monospace;"></textarea>
        </div>
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
    const serialsEl = $('retSerials');
    const btnProcess = $('btnProcessReturn');

    // Default the date to today, same as the desktop app's
    // action_date_input.setDate(QDate.currentDate()).
    dateEl.value = new Date().toISOString().slice(0, 10);

    // Serial box: auto-newline on delimiter + paste normalization — mirrors
    // ui/serial_widgets.py's SerialTextEdit exactly (same pattern already
    // wired for Purchase/Sales elsewhere in this web app).
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

    function resetForm() {
      remarksEl.value = '';
      serialsEl.value = '';
      dateEl.value = new Date().toISOString().slice(0, 10);
    }

    btnProcess.addEventListener('click', async () => {
      const actionType = actionEl.value;
      const remarks = remarksEl.value.trim();
      const actionDate = dateEl.value;
      const serials = splitSerials(serialsEl.value);

      if (!remarks || !actionDate || !serials.length) {
        window.openModal('Validation Error', '<p>Remarks, Date, and Serials are mandatory.</p>');
        return;
      }
      if (new Set(serials).size !== serials.length) {
        window.openModal('Duplicate Scans', '<p>The entry queue contains identical duplicates.</p>');
        return;
      }

      btnProcess.disabled = true;
      const originalLabel = btnProcess.innerHTML;
      btnProcess.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';
      try {
        const result = await window.Api.post('/returns', { actionType, remarks, date: actionDate, serials });
        if (window.showToast) window.showToast(`Stock successfully adjusted as ${actionType}!`);
        window.openModal('Success', `<p>${result.count} serial(s) successfully adjusted as <strong>${actionType}</strong>!</p>`);
        resetForm();
      } catch (err) {
        window.openModal('Constraint Mismatch', `<p style="color:var(--red); white-space:pre-line;">${err.message}</p>`);
      } finally {
        btnProcess.disabled = false;
        btnProcess.innerHTML = originalLabel;
      }
    });
  },
};