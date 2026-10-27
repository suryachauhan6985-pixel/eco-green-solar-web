// api/routes/vouchers.routes.js
// Enterprise Double-Entry Voucher and Financial Reports Engine (Tally / ERP Standard)

module.exports = function registerVouchersRoutes(app, deps) {
  const { pool, route, requireRole, getISTParts, invalidateVoucherCaches } = deps;

  // -------------------------------------------------------------------------
  // 1. GET /api/vouchers — List vouchers with pagination, type, & date filter
  // -------------------------------------------------------------------------
  app.get('/api/vouchers', route(async (req, res) => {
    const q = (req.query.q || '').trim();
    const type = req.query.type || '';
    const fromDate = req.query.from || '';
    const toDate = req.query.to || '';

    let sql = `SELECT * FROM accounting_vouchers WHERE 1=1`;
    const params = [];

    if (type && type !== 'All') {
      sql += ` AND voucher_type = ?`;
      params.push(type);
    }
    if (fromDate) {
      sql += ` AND voucher_date >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      sql += ` AND voucher_date <= ?`;
      params.push(toDate);
    }
    if (q) {
      sql += ` AND (voucher_no LIKE ? OR debit_ledger LIKE ? OR credit_ledger LIKE ? OR narration LIKE ? OR ref_no LIKE ?)`;
      const term = `%${q}%`;
      params.push(term, term, term, term, term);
    }

    sql += ` ORDER BY voucher_date DESC, id DESC LIMIT 300`;
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, vouchers: rows });
  }));

  // -------------------------------------------------------------------------
  // 2. POST /api/vouchers — Create Accounting Voucher
  // -------------------------------------------------------------------------
  app.post('/api/vouchers', requireRole(['Admin', 'SuperAdmin']), route(async (req, res) => {
    const {
      voucher_type,
      voucher_date,
      debit_ledger,
      credit_ledger,
      amount,
      tax_amount,
      narration,
      ref_no
    } = req.body;

    if (!voucher_type || !debit_ledger || !credit_ledger) {
      return res.status(400).json({ error: 'Voucher type, Debit ledger, and Credit ledger are required.' });
    }
    const numAmt = parseFloat(amount) || 0;
    if (numAmt <= 0) {
      return res.status(400).json({ error: 'Voucher amount must be greater than zero.' });
    }

    const { dateStr, timeStr } = getISTParts ? getISTParts() : { dateStr: new Date().toISOString().slice(0, 10), timeStr: '' };
    const finalDate = voucher_date || dateStr;

    // Generate Voucher Number
    const prefixMap = {
      Payment: 'PMT',
      Receipt: 'RCT',
      Journal: 'JRN',
      Sales: 'SLS',
      Purchase: 'PUR',
      DebitNote: 'DRN',
      CreditNote: 'CRN'
    };
    const prefix = prefixMap[voucher_type] || 'VCH';
    const timestamp = Date.now().toString().slice(-6);
    const voucher_no = `${prefix}-${finalDate.replace(/-/g, '')}-${timestamp}`;

    const [result] = await pool.query(
      `INSERT INTO accounting_vouchers 
       (voucher_type, voucher_no, voucher_date, debit_ledger, credit_ledger, amount, tax_amount, narration, ref_no, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        voucher_type,
        voucher_no,
        finalDate,
        debit_ledger.trim(),
        credit_ledger.trim(),
        numAmt,
        parseFloat(tax_amount) || 0,
        (narration || '').trim(),
        (ref_no || '').trim(),
        req.user ? req.user.username : 'admin'
      ]
    );

    if (typeof invalidateVoucherCaches === 'function') invalidateVoucherCaches();
    if (typeof deps.logAuditEvent === 'function') {
      deps.logAuditEvent(pool, {
        type: 'VOUCHER_CREATE',
        ref: voucher_no,
        user: req.user ? req.user.username : 'User',
        oldVal: null,
        newVal: `${voucher_type} Voucher ${voucher_no} | Dr: ${debit_ledger} | Cr: ${credit_ledger} | Rs. ${numAmt}`
      });
    }
    res.json({
      success: true,
      message: `${voucher_type} Voucher ${voucher_no} recorded successfully.`,
      voucher_id: result.insertId,
      voucher_no
    });
  }));

  // -------------------------------------------------------------------------
  // 3. DELETE /api/vouchers/:id — Delete Voucher
  // -------------------------------------------------------------------------
  app.delete('/api/vouchers/:id', requireRole(['SuperAdmin']), route(async (req, res) => {
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid voucher ID.' });

    const [vRow] = await pool.query(`SELECT voucher_no, voucher_type, amount FROM accounting_vouchers WHERE id = ?`, [id]);
    const voucherMeta = vRow && vRow[0] ? `${vRow[0].voucher_type} ${vRow[0].voucher_no} (Rs. ${vRow[0].amount})` : `ID:${id}`;

    const [resDelete] = await pool.query(`DELETE FROM accounting_vouchers WHERE id = ?`, [id]);
    if (resDelete.affectedRows === 0) {
      return res.status(404).json({ error: 'Voucher not found.' });
    }
    if (typeof invalidateVoucherCaches === 'function') invalidateVoucherCaches();
    if (typeof deps.logAuditEvent === 'function') {
      deps.logAuditEvent(pool, {
        type: 'VOUCHER_DELETE',
        ref: vRow && vRow[0] ? vRow[0].voucher_no : `ID:${id}`,
        user: req.user ? req.user.username : 'User',
        oldVal: voucherMeta,
        newVal: 'Voucher permanently deleted'
      });
    }
    res.json({ success: true, message: 'Voucher deleted successfully.' });
  }));

  // -------------------------------------------------------------------------
  // 4. GET /api/financial/statements — Dynamic Financial Computation Engine
  // Computes Trial Balance, Balance Sheet, Profit & Loss Statement, and Day Book
  // -------------------------------------------------------------------------
  app.get('/api/financial/statements', route(async (req, res) => {
    const fromDate = req.query.from || '2000-01-01';
    const toDate = req.query.to || '2099-12-31';

    // Fetch all vouchers in period
    const [vouchers] = await pool.query(
      `SELECT * FROM accounting_vouchers WHERE voucher_date >= ? AND voucher_date <= ? ORDER BY voucher_date ASC`,
      [fromDate, toDate]
    );

    // Fetch stock transaction summary (purchase inward / sales dispatch amounts)
    // Note: stock_ledger does not store rate/amount columns — inventory value
    // calculations are derived from vouchers only in the current schema.
    const stockRows = []; // Reserved for future inventory valuation integration

    // 1. Trial Balance Map (Debits vs Credits per Ledger)
    const ledgerBalances = {};
    function ensureLedger(name) {
      if (!ledgerBalances[name]) {
        ledgerBalances[name] = { name, debit: 0, credit: 0, net: 0 };
      }
    }

    vouchers.forEach((v) => {
      ensureLedger(v.debit_ledger);
      ensureLedger(v.credit_ledger);
      const amt = parseFloat(v.amount) || 0;
      ledgerBalances[v.debit_ledger].debit += amt;
      ledgerBalances[v.credit_ledger].credit += amt;
    });

    let totalDirectSales = 0;
    let totalDirectPurchase = 0;

    stockRows.forEach((s) => {
      const party = s.party_name || 'Counter Sale';
      ensureLedger(party);
      const amt = parseFloat(s.amount) || ((parseFloat(s.quantity) || 0) * (parseFloat(s.rate) || 0));
      if (s.movement === 'IN') {
        ensureLedger('Purchase Account');
        ledgerBalances['Purchase Account'].debit += amt;
        ledgerBalances[party].credit += amt;
        totalDirectPurchase += amt;
      } else if (s.movement === 'OUT') {
        ensureLedger('Sales Account');
        ledgerBalances['Sales Account'].credit += amt;
        ledgerBalances[party].debit += amt;
        totalDirectSales += amt;
      }
    });

    // Compute net balances
    const trialBalance = Object.values(ledgerBalances).map((l) => {
      const net = l.debit - l.credit;
      return {
        name: l.name,
        debit: l.debit,
        credit: l.credit,
        netBalance: Math.abs(net),
        type: net >= 0 ? 'Dr' : 'Cr'
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    // 2. Profit & Loss Summary
    const salesTotal = (ledgerBalances['Sales Account'] ? ledgerBalances['Sales Account'].credit : 0) + totalDirectSales;
    const purchaseTotal = (ledgerBalances['Purchase Account'] ? ledgerBalances['Purchase Account'].debit : 0) + totalDirectPurchase;
    
    let indirectExpenses = 0;
    let indirectIncomes = 0;
    vouchers.forEach((v) => {
      if (v.voucher_type === 'Payment') indirectExpenses += parseFloat(v.amount) || 0;
      if (v.voucher_type === 'Receipt') indirectIncomes += parseFloat(v.amount) || 0;
    });

    const grossProfit = salesTotal - purchaseTotal;
    const netProfit = grossProfit + indirectIncomes - indirectExpenses;

    // 3. Balance Sheet Summary
    const debtors = trialBalance.filter(l => l.type === 'Dr' && l.name !== 'Purchase Account');
    const creditors = trialBalance.filter(l => l.type === 'Cr' && l.name !== 'Sales Account');

    const totalDebtors = debtors.reduce((acc, curr) => acc + curr.netBalance, 0);
    const totalCreditors = creditors.reduce((acc, curr) => acc + curr.netBalance, 0);

    res.json({
      success: true,
      trialBalance,
      profitLoss: {
        salesTotal,
        purchaseTotal,
        grossProfit,
        indirectExpenses,
        indirectIncomes,
        netProfit
      },
      balanceSheet: {
        assets: {
          sundryDebtors: totalDebtors,
          debtorsList: debtors.slice(0, 15),
          cashBank: indirectIncomes - indirectExpenses
        },
        liabilities: {
          sundryCreditors: totalCreditors,
          creditorsList: creditors.slice(0, 15),
          capitalAccount: netProfit // Retained earnings (net profit)
        }
      },
      dayBook: vouchers.slice(0, 50)
    });
  }));
};
