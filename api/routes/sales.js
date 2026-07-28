module.exports = function registerSalesRoutes(app, deps) {
  const { pool, route, requireRole, getItemId, validateSalesLineSerials, itemNameSlug, ledgerTimestamp } = deps;
  // ---------------------------------------------------------------------------
  // PROJECT SALES / DISPATCH — mirrors ui/sales.py exactly (SalesPage). Every
  // dropdown, autofill and validation the desktop Sale Outward screen does
  // against the live database is now available here for js/pages/sales.js:
  //   GET  /api/sales/types            -> sync_sales_solartype()'s
  //                                        get_types_for_category_brand_watt()
  //   GET  /api/sales/check-line       -> validate_sales_line_serials()
  //   POST /api/sales/dispatch         -> process_sales_dispatch()
  //   GET  /api/sales/find/:term       -> find_sales_order_for_editing()
  //   PUT  /api/sales/modify/:orderNo  -> process_sales_modification()
  //   DELETE /api/sales/delete/:orderNo -> delete_sales_transaction()
  // Category/Brand/Wattage dropdowns reuse the existing /api/masters/categories,
  // /api/purchase/brands/:category and /api/purchase/wattages endpoints (same
  // underlying `items` table the desktop app's get_categories() /
  // get_brands_for_category() / get_wattages_for_brand_category() read from).
  // Customer short-code + name autocomplete reuse /api/ledgers and
  // /api/ledgers/shortcodes with type=Customer (same as Supplier on Purchase).
  // ---------------------------------------------------------------------------

  // GET /api/sales/types?category=&brand=&watt= — Type/Subtype options actually
  // registered against this exact Category+Brand+Wattage combo in the `items`
  // master (mirrors get_types_for_category_brand_watt()). The frontend falls
  // back to /api/masters/subtypes/:category (get_subtypes_by_category()) when
  // this comes back empty, exactly like sync_sales_solartype() does.
  app.get('/api/sales/types', route(async (req, res) => {
    const { category, brand } = req.query;
    const watt = Number(req.query.watt) || 0;
    if (!category || !brand) return res.json([]);
    const [rows] = await pool.query(
      `SELECT DISTINCT solar_type FROM items WHERE category=? AND brand_name=? AND watt=? AND solar_type IS NOT NULL AND solar_type <> '' ORDER BY solar_type ASC`,
      [category, brand, watt]
    );
    res.json(rows.map((r) => r.solar_type));
  }));

  // GET /api/sales/check-line?category=&brand=&watt=&type=&serials=a,b,c —
  // Live pre-check used the instant "Add Product Line" is clicked, mirroring
  // add_sales_line() -> validate_sales_line_serials(): every scanned serial
  // must exist, be Available, and match this line's Category/Brand/Wattage/
  // Type. Returns { errors: [] } (empty array = safe to add the line).
  app.get('/api/sales/check-line', route(async (req, res) => {
    const { category, brand, type } = req.query;
    const watt = Number(req.query.watt) || 0;
    const serials = String(req.query.serials || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!category || !brand || !type || !serials.length) return res.json({ errors: [] });
    const errors = await validateSalesLineSerials(pool, serials, { cat: category, brand, watt, type });
    res.json({ errors });
  }));

  // POST /api/sales/dispatch — mirrors process_sales_dispatch(): validates
  // every product line's serials against stock_ledger, blocks on a Challan No
  // already tied to a different customer/order, then marks every serial
  // 'Sold' with the dispatch details in a single transaction.
  app.post('/api/sales/dispatch', route(async (req, res) => {
    const customer = String(req.body.customer || '').trim();
    const orderNo = String(req.body.orderNo || '').trim();
    const chalanNo = String(req.body.chalanNo || '').trim();
    const chalanDate = String(req.body.chalanDate || '').trim();
    const invoiceNo = String(req.body.invoiceNo || '').trim();
    const invoiceDate = invoiceNo ? String(req.body.invoiceDate || '').trim() : '-';
    const proofName = req.body.proofName ? String(req.body.proofName).trim() : '-';
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];

    if (!customer || !orderNo || !chalanNo) {
      return res.status(400).json({ error: 'Customer Name, Order No and Challan No are required.' });
    }
    if (!lines.length) {
      return res.status(400).json({ error: 'Add at least one Invoice Product Line before saving.' });
    }

    const allSerials = lines.flatMap((l) => l.serials || []);
    if (!allSerials.length) {
      return res.status(400).json({ error: 'Scan/enter Serial Numbers before saving.' });
    }
    const seen = new Set(), innerDupes = new Set();
    allSerials.forEach((sn) => { if (seen.has(sn)) innerDupes.add(sn); seen.add(sn); });
    if (innerDupes.size) {
      return res.status(400).json({ error: `Same serial number is present in multiple product lines: ${[...innerDupes].join(', ')}` });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Challan Conflict — mirrors "This Challan number has already been
      // assigned to another customer/order."
      const [existing] = await conn.query(`SELECT customer_name, order_no FROM stock_ledger WHERE chalan_no = ?`, [chalanNo]);
      if (existing.length && (existing[0].customer_name !== customer || existing[0].order_no !== orderNo)) {
        await conn.rollback();
        return res.status(400).json({ error: 'This Challan number has already been assigned to another customer/order.' });
      }

      // Product master + serial validation for every line, exactly like
      // build_current_sales_line() + validate_sales_line_serials().
      const validationErrors = [];
      for (const line of lines) {
        if (!line.cat || !line.brand || !line.type) {
          validationErrors.push('Category, Brand and Type are required for every product line.');
          continue;
        }
        const itemId = await getItemId(conn, line.cat, line.brand, line.watt, line.type);
        if (!itemId) {
          validationErrors.push(`Selected product master (${line.brand} ${line.watt ? line.watt + 'W ' : ''}${line.type}) was not found. Please create/check the master item first.`);
          continue;
        }
        validationErrors.push(...(await validateSalesLineSerials(conn, line.serials || [], line)));
      }
      if (validationErrors.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'DISPATCH BLOCKED:\n' + validationErrors.join('\n') });
      }

      for (const sn of allSerials) {
        await conn.query(
          `UPDATE stock_ledger SET status='Sold', customer_name=?, order_no=?, sales_invoice=?, invoice_date=?, sales_date=?, chalan_no=?, chalan_date=?, sales_attachment=?
           WHERE serial_no=?`,
          [customer, orderNo, invoiceNo || '-', invoiceDate, chalanDate, chalanNo, chalanDate, proofName, sn]
        );
      }

      await conn.commit();
      res.json({ success: true, orderNo, chalanNo, lineCount: lines.length, serialCount: allSerials.length });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }));

  // ---------------------------------------------------------------------------
  // RETURN & DAMAGE — mirrors ui/returns.py's ReturnsPage.process_adjustment()
  // exactly: scan serials, apply one of two actions:
  //   1) "Sales Return (Make Available)" — only allowed if current status is
  //      'Sold'. Resets customer/order/invoice/date fields back to '-' and
  //      tags chalan_no with a '[RETURNED] ' prefix (same ghost-data cleanup
  //      the desktop app does), status -> 'Available'.
  //   2) "Mark as Damaged / Scrapped" — blocked if current status is 'Sold'
  //      (must Sales-Return it back to Available first), status -> 'Damaged'.
  // Whole-batch validation: if ANY scanned serial fails (not found / wrong
  // status for the chosen action), the ENTIRE adjustment is blocked — nothing
  // is written — exactly like the desktop app's "ADJUSTMENT BLOCKED" message.
  // ---------------------------------------------------------------------------
  app.post('/api/returns', route(async (req, res) => {
    const actionType = String(req.body.actionType || '').trim();
    const remarks = String(req.body.remarks || '').trim();
    const actionDate = String(req.body.date || '').trim();
    const serials = Array.isArray(req.body.serials) ? req.body.serials.map((s) => String(s).trim()).filter(Boolean) : [];

    if (!['Sales Return (Make Available)', 'Mark as Damaged / Scrapped'].includes(actionType)) {
      return res.status(400).json({ error: 'Invalid Action Type.' });
    }
    if (!remarks || !actionDate || !serials.length) {
      return res.status(400).json({ error: 'Remarks, Date, and Serials are mandatory.' });
    }
    if (new Set(serials).size !== serials.length) {
      return res.status(400).json({ error: 'The entry queue contains identical duplicates.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const invalidSerials = [];
      const validUpdates = [];
      for (const sn of serials) {
        const [rows] = await conn.query(`SELECT status FROM stock_ledger WHERE serial_no=? FOR UPDATE`, [sn]);
        if (!rows.length) {
          invalidSerials.push(`'${sn}' (Not found in Database Ledger)`);
          continue;
        }
        const { status } = rows[0];
        if (actionType === 'Sales Return (Make Available)' && status !== 'Sold') {
          invalidSerials.push(`'${sn}' (Cannot return, current status is '${status}', not 'Sold')`);
        } else if (actionType === 'Mark as Damaged / Scrapped' && status === 'Sold') {
          invalidSerials.push(`'${sn}' (Cannot mark damaged directly, perform Sales Return first.)`);
        } else {
          validUpdates.push({ sn, newStatus: actionType === 'Sales Return (Make Available)' ? 'Available' : 'Damaged' });
        }
      }

      if (invalidSerials.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'ADJUSTMENT BLOCKED:\n\n' + invalidSerials.join('\n') });
      }

      for (const { sn, newStatus } of validUpdates) {
        if (newStatus === 'Available') {
          await conn.query(
            `UPDATE stock_ledger
               SET status='Available',
                   chalan_no = CONCAT('[RETURNED] ', COALESCE(chalan_no, '')),
                   customer_name='-',
                   order_no='-',
                   sales_invoice='-',
                   invoice_date='-',
                   sales_date='-',
                   sales_attachment='-'
             WHERE serial_no=?`, [sn]
          );
        } else {
          await conn.query(`UPDATE stock_ledger SET status='Damaged' WHERE serial_no=?`, [sn]);
        }
      }

      await conn.commit();
      try {
        const oldDetails = `Action: ${actionType} | Date: ${actionDate}`;
        const newDetails = `Remarks: ${remarks} | Serials: ${serials.join(', ')}`;
        await pool.query(
          `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('RETURN_ADJUST', ?, 'User', ?, ?, ?)`,
          [remarks.slice(0, 50), ledgerTimestamp(), oldDetails, newDetails]
        );
      } catch (e) { /* audit log is best-effort, never block the adjustment on it */ }

      res.json({ success: true, actionType, count: validUpdates.length });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }));

  app.get('/api/sales/find/:term', route(async (req, res) => {
    const term = String(req.params.term || '').trim();
    if (!term) return res.status(400).json({ error: 'Type an Order No, Challan No, Customer Name, or Short Name to search first.' });

    const [shortMatch] = await pool.query(
      `SELECT ledger_name FROM ledgers WHERE short_name = ? AND (ledger_type = 'Customer' OR ledger_type = 'Both') LIMIT 1`,
      [term]
    );
    const resolvedName = shortMatch.length ? shortMatch[0].ledger_name : null;

    let sql = `SELECT customer_name, order_no, chalan_no, chalan_date, sales_invoice, invoice_date, category,
                      brand_name, watt, solar_type, serial_no, sales_attachment
               FROM stock_ledger
               WHERE (order_no=? OR chalan_no=? OR customer_name LIKE ?) AND status='Sold'`;
    const params = [term, term, `%${term}%`];
    if (resolvedName) { sql += ` OR (customer_name=? AND status='Sold')`; params.push(resolvedName); }
    sql += ` ORDER BY STR_TO_DATE(chalan_date, '%d-%m-%Y') DESC, category, brand_name, watt, solar_type, id`;

    const [allMatches] = await pool.query(sql, params);
    if (!allMatches.length) {
      return res.status(404).json({ error: 'No sales records found matching Order No / Challan No / Customer Name / Short Name.' });
    }

    // Name/short-name search can span multiple orders — load the most recent
    // matching order only, same as the desktop app.
    const targetOrder = allMatches[0].order_no;
    const records = allMatches.filter((r) => r.order_no === targetOrder);
    const head = records[0];

    const grouped = new Map();
    records.forEach((r) => {
      const key = [r.category, r.brand_name, r.watt || 0, r.solar_type].join('|');
      if (!grouped.has(key)) {
        grouped.set(key, { cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type, serials: [] });
      }
      grouped.get(key).serials.push(r.serial_no);
    });

    res.json({
      orderNo: targetOrder,
      customer: head.customer_name,
      chalanNo: head.chalan_no,
      chalanDate: head.chalan_date,
      invoiceNo: head.sales_invoice && head.sales_invoice !== '-' ? head.sales_invoice : '',
      invoiceDate: head.invoice_date && head.invoice_date !== '-' ? head.invoice_date : '',
      proofName: head.sales_attachment,
      allSerials: records.map((r) => r.serial_no),
      lines: Array.from(grouped.values()).map((l) => ({ ...l, qty: l.serials.length })),
    });
  }));

  // PUT /api/sales/modify/:orderNo — mirrors process_sales_modification():
  // UPDATEs every serial that stays on the order (re-validating any BRAND NEW
  // serial added during the edit), reverts any REMOVED serial back to
  // Available, and flags every touched row edited_flag=1.
  app.put('/api/sales/modify/:orderNo', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const loadedOrderNo = req.params.orderNo;
    const newCust = String(req.body.customer || '').trim();
    const newChalan = String(req.body.chalanNo || '').trim();
    const newChalanDate = String(req.body.chalanDate || '').trim();
    const newInv = String(req.body.invoiceNo || '').trim();
    const newInvDate = newInv ? String(req.body.invoiceDate || '').trim() : '-';
    const proofName = req.body.proofName ? String(req.body.proofName).trim() : null;
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
    const originalSerials = Array.isArray(req.body.originalSerials) ? req.body.originalSerials : [];

    const allNewSerials = lines.flatMap((l) => l.serials || []);
    if (!newCust || !newChalan || !allNewSerials.length) {
      return res.status(400).json({ error: 'Customer, Challan No and Serials are required.' });
    }
    const seen = new Set(), innerDupes = new Set();
    allNewSerials.forEach((sn) => { if (seen.has(sn)) innerDupes.add(sn); seen.add(sn); });
    if (innerDupes.size) {
      return res.status(400).json({ error: `Same serial number is present in multiple product lines: ${[...innerDupes].join(', ')}` });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Challan Conflict — this Challan No must not already belong to a
      // DIFFERENT order.
      const [conflictRows] = await conn.query(
        `SELECT DISTINCT order_no FROM stock_ledger WHERE chalan_no=? AND order_no<>? AND status='Sold'`,
        [newChalan, loadedOrderNo]
      );
      if (conflictRows.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'This Challan number has already been assigned to another order.' });
      }

      const validationErrors = [];
      for (const line of lines) {
        if (!line.cat || !line.brand || !line.type) {
          validationErrors.push('One product line has no valid item master.');
          continue;
        }
        const itemId = await getItemId(conn, line.cat, line.brand, line.watt, line.type);
        if (!itemId) {
          validationErrors.push(`Selected product master (${line.brand} ${line.watt ? line.watt + 'W ' : ''}${line.type}) was not found. Please create/check the master item first.`);
          continue;
        }
        // Only BRAND NEW serials (not already part of this order) get
        // re-validated against stock — mirrors the `if sn not in
        // self.original_serial_list` guard in process_sales_modification().
        const newOnes = (line.serials || []).filter((sn) => !originalSerials.includes(sn));
        if (newOnes.length) {
          validationErrors.push(...(await validateSalesLineSerials(conn, newOnes, line)));
        }
      }
      if (validationErrors.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'DISPATCH BLOCKED:\n' + validationErrors.join('\n') });
      }

      // Keep-Existing support for the Proof File, same pattern as
      // /api/purchase/:invoiceNo — a null proofName means the user didn't
      // attach a replacement, so re-use whatever this order already had.
      const [metaRows] = await conn.query(
        `SELECT sales_attachment FROM stock_ledger WHERE order_no=? LIMIT 1`,
        [loadedOrderNo]
      );
      const existingAttachment = metaRows.length ? metaRows[0].sales_attachment : '-';
      const finalProof = proofName || existingAttachment || '-';

      for (const line of lines) {
        const itemId = await getItemId(conn, line.cat, line.brand, line.watt, line.type);
        const itemName = itemNameSlug(line.brand, line.watt, line.type);
        for (const sn of (line.serials || [])) {
          await conn.query(
            `UPDATE stock_ledger SET
               status='Sold', item_id=?, item_name=?, category=?, brand_name=?, watt=?, solar_type=?,
               customer_name=?, order_no=?, sales_invoice=?, invoice_date=?, sales_date=?, chalan_no=?, chalan_date=?, sales_attachment=?, edited_flag=1
             WHERE serial_no=?`,
            [itemId, itemName, line.cat, line.brand, Number(line.watt) || 0, line.type, newCust, loadedOrderNo, newInv || '-', newInvDate, newChalanDate, newChalan, newChalanDate, finalProof, sn]
          );
        }
      }

      // Any original serial no longer present in the edited lines is reverted
      // back to Available stock — mirrors the trailing `for old_sn in
      // self.original_serial_list` loop.
      const removed = originalSerials.filter((sn) => !allNewSerials.includes(sn));
      if (removed.length) {
        await conn.query(
          `UPDATE stock_ledger SET status='Available', customer_name='-', order_no='-', sales_invoice='-', invoice_date='-', sales_date='-', chalan_no='-', chalan_date='-', sales_attachment='-', edited_flag=1
           WHERE serial_no IN (?)`,
          [removed]
        );
      }

      await conn.commit();
      res.json({ success: true, orderNo: loadedOrderNo });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }));

  // DELETE /api/sales/delete/:orderNo — mirrors delete_sales_transaction():
  // permanently reverts every Sold serial on this order back to Available
  // stock (undoes the dispatch; does not delete the underlying purchase row).
  app.delete('/api/sales/delete/:orderNo', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const { orderNo } = req.params;
    const [rows] = await pool.query(`SELECT serial_no FROM stock_ledger WHERE order_no=? AND status='Sold'`, [orderNo]);
    if (!rows.length) {
      return res.status(404).json({ error: 'No active sold records found for this order/challan.' });
    }
    await pool.query(
      `UPDATE stock_ledger SET status='Available', customer_name='-', order_no='-', sales_invoice='-', invoice_date='-', sales_date='-', chalan_no='-', chalan_date='-', sales_attachment='-', edited_flag=1
       WHERE order_no=? AND status='Sold'`,
      [orderNo]
    );
    try {
      await pool.query(
        `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('SALE_DELETE', ?, 'User', ?, ?, ?)`,
        [orderNo, ledgerTimestamp(), `Order:${orderNo}`, `Sale transaction deleted | Serials reverted to Available: ${rows.map((r) => r.serial_no).join(', ')}`]
      );
    } catch (e) { /* audit log is best-effort, never block the delete on it */ }

    res.json({ success: true, revertedCount: rows.length });
  }));

  // GET /api/sales/register — mirrors ui/registers.py's SaleRegisterPage
  // load_data(): one row per (challan, date, customer, order, category, brand,
  // sales_invoice) group, with the first serial + total qty + whether any row
  // in the group was ever edited. Only Sold rows with a real challan count,
  // exactly like the desktop query's WHERE status='Sold' AND chalan_no != '-'.
  app.get('/api/sales/register', route(async (req, res) => {
    const category = req.query.category;
    let sql = `SELECT chalan_no, chalan_date, customer_name, order_no, category, brand_name, sales_invoice,
                      MIN(serial_no) AS first_serial, COUNT(*) AS qty, MAX(edited_flag) AS edited
               FROM stock_ledger WHERE status='Sold' AND chalan_no IS NOT NULL AND chalan_no != '-'`;
    const params = [];
    if (category && category !== 'All Categories') { sql += ` AND category = ?`; params.push(category); }
    sql += ` GROUP BY chalan_no, chalan_date, customer_name, order_no, category, brand_name, sales_invoice
             ORDER BY STR_TO_DATE(chalan_date, '%d-%m-%Y') DESC, chalan_no DESC`;

    const [rows] = await pool.query(sql, params);
    res.json(rows.map((r) => ({
      challanNo: r.chalan_no,
      date: r.chalan_date,
      customer: r.customer_name,
      orderNo: r.order_no,
      category: r.category,
      brand: r.brand_name,
      qty: r.qty,
      invoice: r.sales_invoice && r.sales_invoice !== '-' ? r.sales_invoice : '',
      firstSerial: r.first_serial,
      edited: !!r.edited,
    })));
  }));

};
