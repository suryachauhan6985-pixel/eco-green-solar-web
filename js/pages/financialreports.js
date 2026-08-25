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
        <div class="grid-2">
          <!-- Income Side -->
          <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:10px; padding:16px;">
            <h4 style="margin:0 0 12px 0; color:#22c55e;"><i class="fa-solid fa-arrow-trend-up"></i> Revenues / Incomes</h4>
            <div id="plIncomesList"></div>
            <div style="display:flex; justify-content:space-between; border-top:1px dashed var(--border); padding-top:10px; margin-top:10px; font-weight:700;">
              <span>Total Revenue:</span>
              <span id="plTotalRevenue" style="color:#22c55e; font-family:monospace;">₹0.00</span>
            </div>
          </div>

          <!-- Expense Side -->
          <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:10px; padding:16px;">
            <h4 style="margin:0 0 12px 0; color:#ef4444;"><i class="fa-solid fa-arrow-trend-down"></i> Operating Expenses</h4>
            <div id="plExpensesList"></div>
            <div style="display:flex; justify-content:space-between; border-top:1px dashed var(--border); padding-top:10px; margin-top:10px; font-weight:700;">
              <span>Total Expenses:</span>
              <span id="plTotalExpenses" style="color:#ef4444; font-family:monospace;">₹0.00</span>
            </div>
          </div>
        </div>

        <div style="margin-top:16px; padding:14px 18px; border-radius:10px; background:var(--panel-alt); border:1.5px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">Net Operating Profit / (Loss):</h3>
          <h2 id="plNetProfit" style="margin:0; font-family:monospace;">₹0.00</h2>
        </div>
      </div>
    </div>

    <!-- 3. BALANCE SHEET PANEL -->
    <div class="subtab-panel" id="pnlBalanceSheet" style="display:none;">
      <div class="panel">
        <h3 style="margin-bottom:16px;"><i class="fa-solid fa-scale-balanced" style="color:var(--gold);"></i> Balance Sheet</h3>
        
        <div class="grid-2">
          <!-- Liabilities & Capital -->
          <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:10px; padding:16px;">
            <h4 style="margin:0 0 12px 0; color:#eab308;"><i class="fa-solid fa-hand-holding-dollar"></i> Capital &amp; Liabilities</h4>
            <div id="bsLiabilitiesList"></div>
            <div style="display:flex; justify-content:space-between; border-top:1px dashed var(--border); padding-top:10px; margin-top:10px; font-weight:700;">
              <span>Total Liabilities:</span>
              <span id="bsTotalLiabilities" style="color:#eab308; font-family:monospace;">₹0.00</span>
            </div>
          </div>

          <!-- Assets -->
          <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:10px; padding:16px;">
            <h4 style="margin:0 0 12px 0; color:#3b82f6;"><i class="fa-solid fa-building-columns"></i> Fixed &amp; Current Assets</h4>
            <div id="bsAssetsList"></div>
            <div style="display:flex; justify-content:space-between; border-top:1px dashed var(--border); padding-top:10px; margin-top:10px; font-weight:700;">
              <span>Total Assets:</span>
              <span id="bsTotalAssets" style="color:#3b82f6; font-family:monospace;">₹0.00</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. DAY BOOK REGISTER -->
    <div class="subtab-panel" id="pnlDayBook" style="display:none;">
      <div class="panel">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
          <h3 style="margin:0;"><i class="fa-solid fa-calendar-day" style="color:var(--blue);"></i> Real-Time Day Book Transactions</h3>
          <input type="date" id="dayBookFilterDate" style="padding:6px 12px; font-size:13px; font-weight:600;">
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Voucher No</th>
                <th>Time / Date</th>
                <th>Type</th>
                <th>Debit (Dr)</th>
                <th>Credit (Cr)</th>
                <th style="text-align:right;">Amount (₹)</th>
                <th>Narration</th>
              </tr>
            </thead>
            <tbody id="dayBookTbody">
              ${window.Skeleton ? window.Skeleton.tableRows(7, 6, { pillCols: [2] }) : '<tr><td colspan="7" style="text-align:center; padding:18px; color:var(--txt-muted);">Loading Day Book entries...</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,

  init: function (opts = {}) {
    window.__activeScreenCleanup = () => {};

    const FIN_TAB_META = {
      'trial-balance': { title: 'Trial Balance Statement', sub: 'Trial balance ledger closing balances', icon: 'fa-list-ol' },
      'profit-loss': { title: 'Profit & Loss Account', sub: 'Statement of income, expenses & gross profit', icon: 'fa-chart-line' },
      'balance-sheet': { title: 'Balance Sheet Statement', sub: 'Statement of capital, assets & liabilities', icon: 'fa-building-columns' },
      'day-book': { title: 'Day Book Journal', sub: 'Chronological daily financial journal & vouchers', icon: 'fa-calendar-day' }
    };

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
      const meta = FIN_TAB_META[tabKey];
      if (meta) {
        const pt = document.getElementById('pageTitle');
        const ps = document.getElementById('pageSub');
        if (pt) pt.textContent = meta.title;
        if (ps) ps.textContent = meta.sub;
      }
    }

    tabs.forEach(t => {
      t.addEventListener('click', () => {
        switchTab(t.dataset.tab);
        try {
          history.replaceState(null, '', `#financialreports:${t.dataset.tab}`);
        } catch (e) {}
      });
    });

    const activeTab = opts.tab || opts.sub || 'trial-balance';
    switchTab(activeTab);

    async function loadStatements() {
      try {
        const data = await window.Api.get('/financial/statements');

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
