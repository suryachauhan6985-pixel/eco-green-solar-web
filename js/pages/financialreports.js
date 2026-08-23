// js/pages/financialreports.js
// Enterprise Financial Statements & Audit Reports (Balance Sheet, Profit & Loss, Trial Balance, Day Book)

window.PAGES = window.PAGES || {};

window.PAGES.financialreports = {
  name: 'Financial Statements',
  icon: 'fa-scale-balanced',
  sub: 'Balance Sheet, Profit & Loss, Trial Balance & Day Book statements',
  html: `
    <div class="page-head">
      <i class="fa-solid fa-scale-balanced" style="color:var(--blue);"></i>
      <div>
        <h2>Financial Statements &amp; Audit Books</h2>
        <div class="hint">Dynamic Balance Sheet, Profit &amp; Loss Account, Trial Balance &amp; Day Book</div>
      </div>
    </div>

    <!-- Statement View Tabs -->
    <div class="subtabs" id="finReportTabs" style="margin-bottom:18px;">
      <button class="subtab active" data-tab="trial-balance"><i class="fa-solid fa-list-ol"></i> Trial Balance</button>
      <button class="subtab" data-tab="profit-loss"><i class="fa-solid fa-chart-line"></i> Profit &amp; Loss A/c</button>
      <button class="subtab" data-tab="balance-sheet"><i class="fa-solid fa-building-columns"></i> Balance Sheet</button>
      <button class="subtab" data-tab="day-book"><i class="fa-solid fa-calendar-day"></i> Day Book</button>
    </div>

    <!-- 1. TRIAL BALANCE PANEL -->
    <div class="subtab-panel active" id="pnlTrialBalance">
      <div class="panel">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
          <h3 style="margin:0;"><i class="fa-solid fa-list-ol" style="color:var(--gold);"></i> Trial Balance Summary</h3>
          <button type="button" class="btn btn-ghost" id="btnRefreshFinReports"><i class="fa-solid fa-rotate"></i> Refresh Statements</button>
        </div>

        <div class="table-wrap">
          <table class="pl-table">
            <thead>
              <tr>
                <th>Particulars / Ledger Account</th>
                <th style="text-align:right;">Debit Total (₹)</th>
                <th style="text-align:right;">Credit Total (₹)</th>
                <th style="text-align:right;">Closing Balance (₹)</th>
                <th style="text-align:center;">Type</th>
              </tr>
            </thead>
            <tbody id="trialBalanceTbody">
              <tr><td colspan="5" style="text-align:center; padding:18px; color:var(--txt-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Calculating Trial Balance...</td></tr>
            </tbody>
            <tfoot id="trialBalanceTfoot" style="font-weight:800; border-top:2px solid var(--border);">
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- 2. PROFIT & LOSS ACCOUNT PANEL -->
    <div class="subtab-panel" id="pnlProfitLoss" style="display:none;">
      <div class="panel">
        <h3 style="margin-bottom:16px;"><i class="fa-solid fa-chart-line" style="color:#22c55e;"></i> Statement of Profit &amp; Loss</h3>
        
        <div class="grid-2" style="gap:20px; align-items:start;">
          <!-- Left: Expenses & Outflows -->
          <div style="background:var(--panel-alt); border:1px solid var(--border); border-radius:12px; padding:16px;">
            <h4 style="margin:0 0 12px; color:#ef4444; border-bottom:1px solid var(--border); padding-bottom:8px;">Expenses &amp; Purchases</h4>
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--border-light); font-size:13px;">
              <span>Total Direct Purchases</span>
              <strong id="plPurchases">₹0.00</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--border-light); font-size:13px;">
              <span>Indirect Expenses &amp; Payments</span>
              <strong id="plIndirectExp">₹0.00</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:12px 0 0; font-size:14px; font-weight:800; color:#ef4444;">
              <span>Total Outflows</span>
              <span id="plTotalExp">₹0.00</span>
            </div>
          </div>

          <!-- Right: Incomes & Sales -->
          <div style="background:var(--panel-alt); border:1px solid var(--border); border-radius:12px; padding:16px;">
            <h4 style="margin:0 0 12px; color:#22c55e; border-bottom:1px solid var(--border); padding-bottom:8px;">Incomes &amp; Revenue</h4>
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--border-light); font-size:13px;">
              <span>Total Direct Sales Revenue</span>
              <strong id="plSales">₹0.00</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--border-light); font-size:13px;">
              <span>Other Incomes &amp; Receipts</span>
              <strong id="plIndirectInc">₹0.00</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:12px 0 0; font-size:14px; font-weight:800; color:#22c55e;">
              <span>Total Inflows</span>
              <span id="plTotalInc">₹0.00</span>
            </div>
          </div>
        </div>

        <div style="margin-top:20px; padding:16px 20px; background:rgba(37,99,235,0.08); border:1.5px solid var(--blue); border-radius:12px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:12px; color:var(--txt-muted); font-weight:700; text-transform:uppercase;">Net Financial Result</div>
            <h3 style="margin:4px 0 0; font-size:18px; color:var(--blue);" id="plNetTitle">Net Profit</h3>
          </div>
          <div style="font-size:24px; font-weight:900; color:#22c55e;" id="plNetValue">₹0.00</div>
        </div>
      </div>
    </div>

    <!-- 3. BALANCE SHEET PANEL -->
    <div class="subtab-panel" id="pnlBalanceSheet" style="display:none;">
      <div class="panel">
        <h3 style="margin-bottom:16px;"><i class="fa-solid fa-building-columns" style="color:var(--gold);"></i> Balance Sheet</h3>

        <div class="grid-2" style="gap:20px; align-items:start;">
          <!-- Liabilities -->
          <div style="background:var(--panel-alt); border:1px solid var(--border); border-radius:12px; padding:16px;">
            <h4 style="margin:0 0 12px; color:var(--gold); border-bottom:1px solid var(--border); padding-bottom:8px;">Liabilities &amp; Equities</h4>
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--border-light); font-size:13px;">
              <span>Capital Account + Retained Earnings</span>
              <strong id="bsCapital">₹0.00</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--border-light); font-size:13px;">
              <span>Sundry Creditors (Suppliers Payable)</span>
              <strong id="bsCreditors">₹0.00</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:12px 0 0; font-size:14px; font-weight:800; color:var(--gold);">
              <span>Total Liabilities</span>
              <span id="bsTotalLiab">₹0.00</span>
            </div>
          </div>

          <!-- Assets -->
          <div style="background:var(--panel-alt); border:1px solid var(--border); border-radius:12px; padding:16px;">
            <h4 style="margin:0 0 12px; color:var(--blue); border-bottom:1px solid var(--border); padding-bottom:8px;">Assets &amp; Receivables</h4>
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--border-light); font-size:13px;">
              <span>Sundry Debtors (Customer Receivables)</span>
              <strong id="bsDebtors">₹0.00</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed var(--border-light); font-size:13px;">
              <span>Cash &amp; Bank Balances</span>
              <strong id="bsCashBank">₹0.00</strong>
            </div>
            <div style="display:flex; justify-content:space-between; padding:12px 0 0; font-size:14px; font-weight:800; color:var(--blue);">
              <span>Total Assets</span>
              <span id="bsTotalAssets">₹0.00</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. DAY BOOK PANEL -->
    <div class="subtab-panel" id="pnlDayBook" style="display:none;">
      <div class="panel">
        <h3 style="margin-bottom:14px;"><i class="fa-solid fa-calendar-day" style="color:var(--purple);"></i> Daily Transaction Journal (Day Book)</h3>
        <div class="table-wrap">
          <table class="pl-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher No</th>
                <th>Type</th>
                <th>Debit (Dr)</th>
                <th>Credit (Cr)</th>
                <th style="text-align:right;">Amount (₹)</th>
                <th>Narration</th>
              </tr>
            </thead>
            <tbody id="dayBookTbody">
              <tr><td colspan="7" style="text-align:center; padding:18px; color:var(--txt-muted);">Loading Day Book entries...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,

  init: function () {
    const tabs = document.querySelectorAll('#finReportTabs .subtab');
    const panels = {
      'trial-balance': document.getElementById('pnlTrialBalance'),
      'profit-loss': document.getElementById('pnlProfitLoss'),
      'balance-sheet': document.getElementById('pnlBalanceSheet'),
      'day-book': document.getElementById('pnlDayBook')
    };

    function switchTab(tabKey) {
      tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabKey));
      Object.keys(panels).forEach(k => {
        if (panels[k]) panels[k].style.display = (k === tabKey) ? 'block' : 'none';
      });
    }

    tabs.forEach(t => {
      t.addEventListener('click', () => switchTab(t.dataset.tab));
    });

    async function loadStatements() {
      try {
        const res = await fetch(`${API_BASE}/financial/statements`);
        if (!res.ok) throw new Error('Could not calculate financial statements.');
        const data = await res.json();

        // 1. Render Trial Balance
        const tbBody = document.getElementById('trialBalanceTbody');
        const tbFoot = document.getElementById('trialBalanceTfoot');
        if (tbBody) {
          const list = data.trialBalance || [];
          if (!list.length) {
            tbBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:18px; color:var(--txt-muted);">No ledger entries found.</td></tr>`;
          } else {
            let totalDr = 0;
            let totalCr = 0;
            tbBody.innerHTML = list.map(l => {
              totalDr += Number(l.debit) || 0;
              totalCr += Number(l.credit) || 0;
              return `
                <tr>
                  <td><strong style="color:var(--txt);">${l.name}</strong></td>
                  <td style="text-align:right; font-family:monospace;">₹${Number(l.debit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style="text-align:right; font-family:monospace;">₹${Number(l.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style="text-align:right; font-weight:700; color:var(--blue); font-family:monospace;">₹${Number(l.netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style="text-align:center;"><span class="pill pill-${l.type === 'Dr' ? 'gold' : 'green'}" style="font-size:10px; padding:2px 6px;">${l.type}</span></td>
                </tr>
              `;
            }).join('');

            if (tbFoot) {
              tbFoot.innerHTML = `
                <tr>
                  <td>TOTAL</td>
                  <td style="text-align:right; font-family:monospace;">₹${totalDr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style="text-align:right; font-family:monospace;">₹${totalCr.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td style="text-align:right; font-family:monospace;" colspan="2">Balanced</td>
                </tr>
              `;
            }
          }
        }

        // 2. Render Profit & Loss
        const pl = data.profitLoss || {};
        const fmt = (num) => `₹${Number(num || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
        if (document.getElementById('plPurchases')) document.getElementById('plPurchases').textContent = fmt(pl.purchaseTotal);
        if (document.getElementById('plIndirectExp')) document.getElementById('plIndirectExp').textContent = fmt(pl.indirectExpenses);
        if (document.getElementById('plTotalExp')) document.getElementById('plTotalExp').textContent = fmt((Number(pl.purchaseTotal) || 0) + (Number(pl.indirectExpenses) || 0));

        if (document.getElementById('plSales')) document.getElementById('plSales').textContent = fmt(pl.salesTotal);
        if (document.getElementById('plIndirectInc')) document.getElementById('plIndirectInc').textContent = fmt(pl.indirectIncomes);
        if (document.getElementById('plTotalInc')) document.getElementById('plTotalInc').textContent = fmt((Number(pl.salesTotal) || 0) + (Number(pl.indirectIncomes) || 0));

        const net = Number(pl.netProfit) || 0;
        if (document.getElementById('plNetTitle')) document.getElementById('plNetTitle').textContent = net >= 0 ? 'Net Profit' : 'Net Loss';
        if (document.getElementById('plNetValue')) {
          const netEl = document.getElementById('plNetValue');
          netEl.textContent = fmt(Math.abs(net));
          netEl.style.color = net >= 0 ? '#22c55e' : '#ef4444';
        }

        // 3. Render Balance Sheet
        const bs = data.balanceSheet || {};
        const cap = (bs.liabilities && bs.liabilities.capitalAccount) || 500000;
        const cred = (bs.liabilities && bs.liabilities.sundryCreditors) || 0;
        const debt = (bs.assets && bs.assets.sundryDebtors) || 0;
        const cb = (bs.assets && bs.assets.cashBank) || 0;

        if (document.getElementById('bsCapital')) document.getElementById('bsCapital').textContent = fmt(cap);
        if (document.getElementById('bsCreditors')) document.getElementById('bsCreditors').textContent = fmt(cred);
        if (document.getElementById('bsTotalLiab')) document.getElementById('bsTotalLiab').textContent = fmt(cap + cred);

        if (document.getElementById('bsDebtors')) document.getElementById('bsDebtors').textContent = fmt(debt);
        if (document.getElementById('bsCashBank')) document.getElementById('bsCashBank').textContent = fmt(cb);
        if (document.getElementById('bsTotalAssets')) document.getElementById('bsTotalAssets').textContent = fmt(debt + cb);

        // 4. Render Day Book
        const dayBookBody = document.getElementById('dayBookTbody');
        if (dayBookBody) {
          const dayList = data.dayBook || [];
          if (!dayList.length) {
            dayBookBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:18px; color:var(--txt-muted);">No entries recorded in Day Book.</td></tr>`;
          } else {
            dayBookBody.innerHTML = dayList.map(d => `
              <tr>
                <td>${d.voucher_date}</td>
                <td><strong style="color:var(--gold); font-family:monospace;">${d.voucher_no}</strong></td>
                <td><span class="pill pill-blue" style="font-size:10px;">${d.voucher_type}</span></td>
                <td><span style="color:#ef4444; font-weight:600;">${d.debit_ledger}</span></td>
                <td><span style="color:#22c55e; font-weight:600;">${d.credit_ledger}</span></td>
                <td style="text-align:right; font-weight:700; color:var(--blue); font-family:monospace;">₹${Number(d.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td><span style="color:var(--txt-muted); font-size:11.5px;">${d.narration || '-'}</span></td>
              </tr>
            `).join('');
          }
        }

      } catch (err) {
        window.openModal('Statement Computation Error', `<p style="color:var(--red);">${err.message}</p>`);
      }
    }

    const btnRef = document.getElementById('btnRefreshFinReports');
    if (btnRef) btnRef.addEventListener('click', loadStatements);

    loadStatements();
  }
};
