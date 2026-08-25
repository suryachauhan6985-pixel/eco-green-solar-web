// js/pages/vouchers.js
// Enterprise Double-Entry Voucher Creation & Register (Payment, Receipt, Journal, Debit Note, Credit Note)

window.PAGES = window.PAGES || {};

window.PAGES.vouchers = {
  name: 'Accounting Vouchers',
  icon: 'fa-money-bill-transfer',
  sub: 'Double-entry financial voucher system (Payment, Receipt, Journal, Debit/Credit Notes)',
  html: `
    <div class="page-head">
      <i class="fa-solid fa-money-bill-transfer" style="color:var(--gold);"></i>
      <div>
        <h2 id="vouchPageTitle">Accounting Voucher Entry</h2>
        <div class="hint">Record double-entry financial transactions &amp; adjustments</div>
      </div>
    </div>

    <!-- Voucher Type Fast-Switch Tabs -->
    <div class="subtabs" id="vouchTypeTabs" style="margin-bottom:18px;">
      <button class="subtab active" data-type="Payment"><i class="fa-solid fa-arrow-up-from-bracket" style="color:#ef4444;"></i> Payment (F5)</button>
      <button class="subtab" data-type="Receipt"><i class="fa-solid fa-arrow-down-to-bracket" style="color:#22c55e;"></i> Receipt (F6)</button>
      <button class="subtab" data-type="Journal"><i class="fa-solid fa-scale-balanced" style="color:#3b82f6;"></i> Journal (F7)</button>
      <button class="subtab" data-type="DebitNote"><i class="fa-solid fa-file-circle-minus" style="color:#f59e0b;"></i> Debit Note (Alt+F5)</button>
      <button class="subtab" data-type="CreditNote"><i class="fa-solid fa-file-circle-plus" style="color:#a855f7;"></i> Credit Note (Alt+F6)</button>
    </div>

    <div class="grid-2" style="grid-template-columns: 1fr 1.25fr; gap:20px; align-items:start;">
      <!-- LEFT PANEL: VOUCHER FORM -->
      <div class="panel" style="border-top:3px solid var(--gold);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid var(--border);">
          <h3 style="margin:0;"><i class="fa-solid fa-pen-nib" style="color:var(--gold);"></i> <span id="vouchFormHeading">Payment Voucher Entry</span></h3>
          <span class="pill pill-gold" id="vouchBadgePrefix">PMT</span>
        </div>

        <form id="voucherEntryForm" onsubmit="return false;">
          <div class="form-grid cols-2">
            <div class="field">
              <label>Voucher Date <span class="req">*</span></label>
              <input type="date" id="vouchDate" required>
            </div>
            <div class="field">
              <label>Ref / Bill / Invoice No.</label>
              <input type="text" id="vouchRefNo" placeholder="Optional reference">
            </div>
          </div>

          <div class="field" style="margin-top:12px;">
            <label id="lblDebitLedger">Debit Account (Dr) <span class="req">*</span></label>
            <input type="text" id="vouchDebitLedger" placeholder="e.g. Supplier / Expense / Bank Ledger" list="vouchLedgersList" autocomplete="off" required>
          </div>

          <div class="field" style="margin-top:12px;">
            <label id="lblCreditLedger">Credit Account (Cr) <span class="req">*</span></label>
            <input type="text" id="vouchCreditLedger" placeholder="e.g. Bank / Cash / Customer Ledger" list="vouchLedgersList" autocomplete="off" required>
          </div>
          <datalist id="vouchLedgersList"></datalist>

          <div class="form-grid cols-2" style="margin-top:12px;">
            <div class="field">
              <label>Voucher Amount (₹) <span class="req">*</span></label>
              <input type="number" step="0.01" min="0.01" id="vouchAmount" placeholder="0.00" style="font-weight:700; color:var(--blue);" required>
            </div>
            <div class="field">
              <label>GST / Tax Component (₹)</label>
              <input type="number" step="0.01" min="0" id="vouchTaxAmount" placeholder="0.00" value="0.00">
            </div>
          </div>

          <div class="field" style="margin-top:12px;">
            <label>Narration / Description</label>
            <textarea id="vouchNarration" rows="2" placeholder="Enter transaction remarks / cheque no. / bank details..."></textarea>
          </div>

          <div class="actions-row" style="margin-top:16px; display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap;">
            <button type="reset" class="btn btn-ghost" id="vouchBtnClear"><i class="fa-solid fa-rotate-left"></i> Reset</button>
            <button type="submit" class="btn btn-green" id="vouchBtnSave"><i class="fa-solid fa-floppy-disk"></i> Post Voucher</button>
          </div>
        </form>
      </div>

      <!-- RIGHT PANEL: RECENT VOUCHERS REGISTER -->
      <div class="panel">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:14px;">
          <h3 style="margin:0;"><i class="fa-solid fa-book-journal-whills" style="color:var(--blue);"></i> Voucher Audit Register</h3>
          <div class="search-mini" style="min-width:min(220px, 100%); padding:6px 12px; max-width:100%; box-sizing:border-box;">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="search" id="vouchSearchInput" placeholder="Filter vouchers...">
          </div>
        </div>

        <div class="table-wrap" style="max-height:540px; overflow-y:auto;">
          <table class="pl-table">
            <thead>
              <tr>
                <th>Voucher No</th>
                <th>Date</th>
                <th>Debit (Dr)</th>
                <th>Credit (Cr)</th>
                <th style="text-align:right;">Amount (₹)</th>
                <th style="text-align:center;">Action</th>
              </tr>
            </thead>
            <tbody id="vouchTableBody">
              ${window.Skeleton ? window.Skeleton.tableRows(6, 5, { pillCols: [5] }) : '<tr><td colspan="6" style="text-align:center; padding:18px; color:var(--txt-muted);">Loading vouchers...</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,

  init: function (opts = {}) {
    window.__activeScreenCleanup = () => {
      window.setVoucherTypeMode = null;
    };

    let currentVoucherType = 'Payment';
    let cachedLedgers = [];
    let cachedVouchers = [];

    const tabs = document.querySelectorAll('#vouchTypeTabs .subtab');
    const formHeading = document.getElementById('vouchFormHeading');
    const badgePrefix = document.getElementById('vouchBadgePrefix');
    const dateInput = document.getElementById('vouchDate');
    const datalist = document.getElementById('vouchLedgersList');
    const tbody = document.getElementById('vouchTableBody');

    const VOUCHER_TITLES = {
      Payment: { title: 'Payment Voucher (F5)', sub: 'Record supplier payments & bank transfers' },
      Receipt: { title: 'Receipt Voucher (F6)', sub: 'Record customer receipts & incoming payments' },
      Journal: { title: 'Journal Voucher (F7)', sub: 'Record double-entry ledger adjustments' },
      DebitNote: { title: 'Debit Note (Alt+F5)', sub: 'Record purchase returns and debit adjustments' },
      CreditNote: { title: 'Credit Note (Alt+F6)', sub: 'Record sales returns and credit adjustments' }
    };

    // Set today's date by default
    if (dateInput) {
      dateInput.value = new Date().toISOString().slice(0, 10);
    }

    // Load Ledgers for Datalist Autocomplete
    async function loadLedgerOptions() {
      try {
        cachedLedgers = await window.Api.get('/ledgers');
        if (datalist) {
          const standardAccounts = [
            { name: 'Cash Account' },
            { name: 'HDFC Bank Ltd' },
            { name: 'State Bank of India' },
            { name: 'ICICI Bank Ltd' },
            { name: 'Sales Account' },
            { name: 'Purchase Account' },
            { name: 'Discount Allowed' },
            { name: 'Discount Received' },
            { name: 'Transport & Freight Charges' }
          ];
          const all = [...(cachedLedgers || []), ...standardAccounts];
          datalist.innerHTML = all.map(l => `<option value="${l.name}">${l.type ? `[${l.type}]` : ''}</option>`).join('');
        }
      } catch (e) {}
    }

    // Load Vouchers Audit Register
    async function loadVouchersRegister() {
      if (tbody && window.Skeleton) {
        tbody.innerHTML = window.Skeleton.tableRows(6, 5, { pillCols: [5] });
      }
      try {
        const data = await window.Api.get(`/vouchers?type=${currentVoucherType}`);
        cachedVouchers = data.vouchers || [];
        renderVoucherTable(cachedVouchers);
      } catch (e) {
      } catch (e) {
        if (tbody) {
          if (window.Skeleton) {
            tbody.innerHTML = window.Skeleton.tableError(6, e.message || 'Could not load vouchers.', { retryId: 'btnRetryVouchers' });
            window.Skeleton.wireRetry('btnRetryVouchers', () => loadVouchersRegister());
          } else {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--red);">Could not load vouchers.</td></tr>`;
          }
        }
      }
    }

    function renderVoucherTable(list) {
      if (!tbody) return;
      if (!list.length) {
        if (window.Skeleton) {
          tbody.innerHTML = window.Skeleton.tableEmpty(6, `No ${currentVoucherType} vouchers recorded yet`, { icon: 'fa-solid fa-book-journal-whills', desc: 'Post a new voucher using the left entry form.' });
        } else {
          tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:18px; color:var(--txt-muted);">No ${currentVoucherType} vouchers recorded yet.</td></tr>`;
        }
        return;
      }
      tbody.innerHTML = list.map(v => `
        <tr>
          <td><strong style="color:var(--gold); font-family:monospace;">${v.voucher_no}</strong></td>
          <td>${v.voucher_date}</td>
          <td><span style="color:#ef4444; font-weight:600;">${v.debit_ledger}</span></td>
          <td><span style="color:#22c55e; font-weight:600;">${v.credit_ledger}</span></td>
          <td style="text-align:right; font-weight:700; color:var(--blue);">₹${Number(v.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
          <td style="text-align:center;">
            <button type="button" class="btn btn-red btn-vouch-del" data-id="${v.id}" style="padding:4px 8px; font-size:11px;" title="Delete Voucher"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    }

    // Switch Voucher Type
    function setVoucherType(type) {
      currentVoucherType = type;
      tabs.forEach(t => t.classList.toggle('active', t.dataset.type === type));

      const typeConfig = {
        Payment: { heading: 'Payment Voucher Entry (F5)', prefix: 'PMT', dr: 'Debit Account (Dr - Payee/Expense)', cr: 'Credit Account (Cr - Bank/Cash)' },
        Receipt: { heading: 'Receipt Voucher Entry (F6)', prefix: 'RCT', dr: 'Debit Account (Dr - Bank/Cash)', cr: 'Credit Account (Cr - Payer/Customer)' },
        Journal: { heading: 'Journal Voucher Entry (F7)', prefix: 'JRN', dr: 'Debit Account (Dr)', cr: 'Credit Account (Cr)' },
        DebitNote: { heading: 'Debit Note Entry (Alt+F5)', prefix: 'DRN', dr: 'Debit Account (Dr - Supplier/Return)', cr: 'Credit Account (Cr - Purchase Return)' },
        CreditNote: { heading: 'Credit Note Entry (Alt+F6)', prefix: 'CRN', dr: 'Debit Account (Dr - Sales Return)', cr: 'Credit Account (Cr - Customer/Rebate)' }
      };

      const cfg = typeConfig[type] || typeConfig.Payment;
      if (formHeading) formHeading.textContent = cfg.heading;
      if (badgePrefix) badgePrefix.textContent = cfg.prefix;
      if (document.getElementById('lblDebitLedger')) document.getElementById('lblDebitLedger').innerHTML = `${cfg.dr} <span class="req">*</span>`;
      if (document.getElementById('lblCreditLedger')) document.getElementById('lblCreditLedger').innerHTML = `${cfg.cr} <span class="req">*</span>`;

      const tMeta = VOUCHER_TITLES[type];
      if (tMeta) {
        const pt = document.getElementById('pageTitle');
        const ps = document.getElementById('pageSub');
        if (pt) pt.textContent = tMeta.title;
        if (ps) ps.textContent = tMeta.sub;
      }

      loadVouchersRegister();
    }

    tabs.forEach(t => {
      t.addEventListener('click', () => {
        setVoucherType(t.dataset.type);
        try {
          history.replaceState(null, '', `#vouchers:${t.dataset.type}`);
        } catch (e) {}
      });
    });

    const initType = opts.action || opts.sub || 'Payment';
    setVoucherType(initType);

    // Form Submit
    const form = document.getElementById('voucherEntryForm');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const voucher_date = document.getElementById('vouchDate').value;
        const ref_no = document.getElementById('vouchRefNo').value.trim();
        const debit_ledger = document.getElementById('vouchDebitLedger').value.trim();
        const credit_ledger = document.getElementById('vouchCreditLedger').value.trim();
        const amount = document.getElementById('vouchAmount').value;
        const tax_amount = document.getElementById('vouchTaxAmount').value;
        const narration = document.getElementById('vouchNarration').value.trim();

        if (!debit_ledger || !credit_ledger) {
          window.openModal('Validation Warning', '<p>Please specify both Debit and Credit accounts.</p>');
          return;
        }

        try {
          const data = await window.Api.post('/vouchers', {
            voucher_type: currentVoucherType,
            voucher_date,
            debit_ledger,
            credit_ledger,
            amount,
            tax_amount,
            narration,
            ref_no
          });

          window.showToast(`${currentVoucherType} Voucher ${data.voucher_no} posted successfully!`);
          document.getElementById('vouchDebitLedger').value = '';
          document.getElementById('vouchCreditLedger').value = '';
          document.getElementById('vouchAmount').value = '';
          document.getElementById('vouchTaxAmount').value = '0.00';
          document.getElementById('vouchNarration').value = '';
          document.getElementById('vouchRefNo').value = '';
          loadVouchersRegister();
        } catch (err) {
          window.openModal('Voucher Error', `<p style="color:var(--red);">${err.message}</p>`);
        }
      });
    }

    // Delete Voucher Handler
    if (tbody) {
      tbody.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-vouch-del');
        if (!btn) return;
        const id = btn.dataset.id;
        const ok = await window.confirmDanger('Delete Voucher', 'Are you sure you want to permanently delete this accounting voucher?');
        if (!ok) return;

        try {
          await window.Api.delete(`/vouchers/${id}`);
          window.showToast('Voucher deleted.');
          loadVouchersRegister();
        } catch (err) {
          window.openModal('Delete Failed', `<p style="color:var(--red);">${err.message}</p>`);
        }
      });
    }

    // Search filter with RAF throttling
    const searchInp = document.getElementById('vouchSearchInput');
    let vouchSearchRaf = null;
    if (searchInp) {
      searchInp.addEventListener('input', (e) => {
        if (vouchSearchRaf) cancelAnimationFrame(vouchSearchRaf);
        vouchSearchRaf = requestAnimationFrame(() => {
          const q = e.target.value.toLowerCase().trim();
          const filtered = cachedVouchers.filter(v => 
            (v.voucher_no && v.voucher_no.toLowerCase().includes(q)) ||
            (v.debit_ledger && v.debit_ledger.toLowerCase().includes(q)) ||
            (v.credit_ledger && v.credit_ledger.toLowerCase().includes(q)) ||
            (v.narration && v.narration.toLowerCase().includes(q))
          );
          renderVoucherTable(filtered);
        });
      });
    }

    window.setVoucherTypeMode = setVoucherType;
    loadLedgerOptions();
    loadVouchersRegister();
  }
};
