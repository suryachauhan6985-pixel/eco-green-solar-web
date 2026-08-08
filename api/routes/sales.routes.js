module.exports = function registerSalesRoutes(app, deps) {
  const { pool, route, requireRole, getItemId, validateSalesLineSerials, itemNameSlug, ledgerTimestamp } = deps;

  // ---------------------------------------------------------------------------
  // Shared quantity-line helpers (used by POST /dispatch and PUT /modify) —
  // both need to move units between the Available pool and a Sold state for
  // a Category+Brand+Watt+Type combo that has no serial numbers at all.
  // ---------------------------------------------------------------------------

  // FIFO-consume `qtyNeeded` units of itemKey from the Available pool,
  // tagging every unit with this dispatch's details (customer/order/chalan/
  // invoice/proof). Oldest Available row (lowest id) is used first; a row
  // that's only partially needed gets split (new Sold row for the taken
  // amount, original row's quantity shrinks but stays Available). Caller
  // must already hold the transaction and have validated enough stock
  // exists. Returns the total quantity actually consumed.
  async function fifoConsumeQty(conn, itemKey, qtyNeeded, meta, editedFlag = 0) {
    let remaining = qtyNeeded;
    let consumed = 0;
    const [rows] = await conn.query(
      `SELECT id, quantity, item_id, item_name, category, brand_name, watt, solar_type, warehouse,
              supplier_name, purchase_invoice, purchase_date, purchase_attachment
       FROM stock_ledger
       WHERE category=? AND brand_name=? AND watt=? AND solar_type=? AND status='Available' AND serial_no IS NULL
       ORDER BY id ASC
       FOR UPDATE`,
      [itemKey.cat, itemKey.brand, Number(itemKey.watt) || 0, itemKey.type]
    );
    for (const row of rows) {
      if (remaining <= 0) break;
      if (row.quantity <= remaining) {
        await conn.query(
          `UPDATE stock_ledger SET status='Sold', customer_name=?, order_no=?, sales_invoice=?, invoice_date=?, sales_date=?, chalan_no=?, chalan_date=?, sales_attachment=?, edited_flag=?
           WHERE id=?`,
          [meta.customer, meta.orderNo, meta.invoiceNo || '-', meta.invoiceDate, meta.chalanDate, meta.chalanNo, meta.chalanDate, meta.proofName, editedFlag, row.id]
        );
        remaining -= row.quantity;
        consumed += row.quantity;
      } else {
        await conn.query(
          `INSERT INTO stock_ledger
             (item_id, item_name, category, brand_name, watt, solar_type, warehouse, status,
              supplier_name, purchase_invoice, purchase_date, purchase_attachment,
              customer_name, order_no, sales_invoice, invoice_date, sales_date, chalan_no, chalan_date, sales_attachment,
              quantity, serial_no, edited_flag)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Sold', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
          [row.item_id, row.item_name, row.category, row.brand_name, row.watt, row.solar_type, row.warehouse,
           row.supplier_name, row.purchase_invoice, row.purchase_date, row.purchase_attachment,
           meta.customer, meta.orderNo, meta.invoiceNo || '-', meta.invoiceDate, meta.chalanDate, meta.chalanNo, meta.chalanDate, meta.proofName,
           remaining, editedFlag]
        );
        await conn.query(`UPDATE stock_ledger SET quantity = quantity - ? WHERE id=?`, [remaining, row.id]);
        consumed += remaining;
        remaining = 0;
      }
    }
    return consumed;
  }

  // Release `qtyToRelease` units of itemKey that this order currently owns
  // (Sold, serial_no IS NULL) back to Available. Walks the order's own rows
  // oldest-first; a row that's only partially released gets split (new
  // Available row for the released amount, original Sold row's quantity
  // shrinks but stays Sold/tied to this order). Returns quantity released.
  async function releaseQtyToAvailable(conn, itemKey, orderNo, qtyToRelease) {
    let remaining = qtyToRelease;
    let released = 0;
    const [rows] = await conn.query(
      `SELECT id, quantity FROM stock_ledger
       WHERE order_no=? AND category=? AND brand_name=? AND watt=? AND solar_type=? AND status='Sold' AND serial_no IS NULL
       ORDER BY id ASC
       FOR UPDATE`,
      [orderNo, itemKey.cat, itemKey.brand, Number(itemKey.watt) || 0, itemKey.type]
    );
    for (const row of rows) {
      if (remaining <= 0) break;
      if (row.quantity <= remaining) {
        await conn.query(
          `UPDATE stock_ledger SET status='Available', customer_name='-', order_no='-', sales_invoice='-', invoice_date='-', sales_date='-', chalan_no='-', chalan_date='-', sales_attachment='-', edited_flag=1
           WHERE id=?`,
          [row.id]
        );
        remaining -= row.quantity;
        released += row.quantity;
      } else {
        await conn.query(
          `INSERT INTO stock_ledger
             (item_id, item_name, category, brand_name, watt, solar_type, warehouse, status,
              supplier_name, purchase_invoice, purchase_date, purchase_attachment,
              customer_name, order_no, sales_invoice, invoice_date, sales_date, chalan_no, chalan_date, sales_attachment,
              quantity, serial_no, edited_flag)
           SELECT item_id, item_name, category, brand_name, watt, solar_type, warehouse, 'Available',
                  supplier_name, purchase_invoice, purchase_date, purchase_attachment,
                  '-', '-', '-', '-', '-', '-', '-', '-',
                  ?, NULL, 1
           FROM stock_ledger WHERE id=?`,
          [remaining, row.id]
        );
        await conn.query(`UPDATE stock_ledger SET quantity = quantity - ? WHERE id=?`, [remaining, row.id]);
        released += remaining;
        remaining = 0;
      }
    }
    return released;
  }
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
    const qty = Number(req.query.qty) || 0;

    if (!category || !brand || !type) return res.json({ errors: [] });

    // Quantity-based line (no serials scanned — category is not
    // serial-mandatory): just confirm enough Available quantity-tracked
    // stock exists for this exact Category+Brand+Wattage+Type combo.
    if (!serials.length) {
      if (!qty) return res.json({ errors: [] });
      const [[{ totalAvail }]] = await pool.query(
        `SELECT COALESCE(SUM(quantity), 0) AS totalAvail FROM stock_ledger
         WHERE category=? AND brand_name=? AND watt=? AND solar_type=? AND status='Available' AND serial_no IS NULL`,
        [category, brand, watt, type]
      );
      if (totalAvail < qty) {
        return res.json({ errors: [`Insufficient stock: only ${totalAvail} available, ${qty} requested for ${brand} ${watt ? watt + 'W ' : ''}${type}.`] });
      }
      return res.json({ errors: [] });
    }

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
    // A line is valid if it has serials (serial-mandatory category) OR a
    // qty > 0 (quantity-tracked category) — mirrors the same either/or
    // check already used by POST /api/purchase and PUT /api/sales/modify.
    // BUGFIX: this previously only checked allSerials.length, which
    // incorrectly blocked a brand-new order made entirely of quantity-based
    // lines (no serial-mandatory items at all) with "Scan/enter Serial
    // Numbers before saving." even though valid qty lines were present.
    const hasQuantityLine = lines.some((l) => (!l.serials || !l.serials.length) && Number(l.qty) > 0);
    if (!allSerials.length && !hasQuantityLine) {
      return res.status(400).json({ error: 'Add Serial Numbers or a Quantity before saving.' });
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
      // Lines are split into two kinds: serial-based (line.serials is a
      // non-empty array — existing flow, unchanged) and quantity-based
      // (no serials, a line.qty instead — for categories where
      // serial_mandatory=0). Quantity-based stock has serial_no=NULL rows
      // in stock_ledger, one or more rows per Category+Brand+Watt+Type,
      // each carrying its own `quantity`.
      const isQtyLine = (line) => !(Array.isArray(line.serials) && line.serials.length) && Number(line.qty) > 0;

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
        if (isQtyLine(line)) {
          const qty = Number(line.qty) || 0;
          // FOR UPDATE locks every matching Available row now, so a
          // concurrent dispatch can't double-spend the same stock before
          // this transaction commits.
          const [[{ totalAvail }]] = await conn.query(
            `SELECT COALESCE(SUM(quantity), 0) AS totalAvail FROM stock_ledger
             WHERE category=? AND brand_name=? AND watt=? AND solar_type=? AND status='Available' AND serial_no IS NULL
             FOR UPDATE`,
            [line.cat, line.brand, Number(line.watt) || 0, line.type]
          );
          if (totalAvail < qty) {
            validationErrors.push(`Insufficient stock for ${line.brand} ${line.watt ? line.watt + 'W ' : ''}${line.type}: ${totalAvail} available, ${qty} requested.`);
          }
        } else {
          validationErrors.push(...(await validateSalesLineSerials(conn, line.serials || [], line)));
        }
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

      // FIFO consume for every quantity-based line — oldest Available row
      // (lowest id = purchased first) gets used up first.
      let qtyDispatchedTotal = 0;
      for (const line of lines.filter(isQtyLine)) {
        qtyDispatchedTotal += await fifoConsumeQty(
          conn,
          { cat: line.cat, brand: line.brand, watt: line.watt, type: line.type },
          Number(line.qty) || 0,
          { customer, orderNo, invoiceNo, invoiceDate, chalanDate, chalanNo, proofName }
        );
      }

      await conn.commit();
      res.json({ success: true, orderNo, chalanNo, lineCount: lines.length, serialCount: allSerials.length, qtyDispatched: qtyDispatchedTotal });
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

    let sql = `SELECT id, customer_name, order_no, chalan_no, chalan_date, sales_invoice, invoice_date, category,
                      brand_name, watt, solar_type, serial_no, quantity, sales_attachment
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

    // Serial-based lines (existing behaviour, unchanged): one line per
    // Category+Brand+Watt+Type, serials collected into an array.
    const serialGrouped = new Map();
    // Quantity-based lines (serial_no IS NULL): same grouping key, but the
    // amount is the SUM of every matching row's quantity, and we remember
    // every row id currently owned (qtyRowIds) for reference.
    const qtyGrouped = new Map();

    records.forEach((r) => {
      const key = [r.category, r.brand_name, r.watt || 0, r.solar_type].join('|');
      if (r.serial_no) {
        if (!serialGrouped.has(key)) {
          serialGrouped.set(key, { cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type, serials: [] });
        }
        serialGrouped.get(key).serials.push(r.serial_no);
      } else {
        if (!qtyGrouped.has(key)) {
          qtyGrouped.set(key, { cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type, qty: 0, qtyRowIds: [] });
        }
        const g = qtyGrouped.get(key);
        g.qty += r.quantity || 0;
        g.qtyRowIds.push(r.id);
      }
    });

    res.json({
      orderNo: targetOrder,
      customer: head.customer_name,
      chalanNo: head.chalan_no,
      chalanDate: head.chalan_date,
      invoiceNo: head.sales_invoice && head.sales_invoice !== '-' ? head.sales_invoice : '',
      invoiceDate: head.invoice_date && head.invoice_date !== '-' ? head.invoice_date : '',
      proofName: head.sales_attachment,
      allSerials: records.filter((r) => r.serial_no).map((r) => r.serial_no),
      lines: [
        ...Array.from(serialGrouped.values()).map((l) => ({ ...l, qty: l.serials.length })),
        ...Array.from(qtyGrouped.values()),
      ],
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
    // At least one line — serial-based (with serials) or quantity-based
    // (no `serials` key, just a qty) — must be present; an order made
    // entirely of quantity-lines legitimately has zero serials.
    const hasAnyLine = lines.some((l) => (Array.isArray(l.serials) && l.serials.length) || !Array.isArray(l.serials));
    if (!newCust || !newChalan || !hasAnyLine) {
      return res.status(400).json({ error: 'Customer, Challan No and at least one product line are required.' });
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

      // A quantity-based line is one the frontend sent with no `serials`
      // array at all (serial-based lines always carry one, even if empty).
      const isQtyLine = (line) => !Array.isArray(line.serials);

      const validationErrors = [];
      // { itemKey, delta } for every quantity line — delta = desired qty
      // minus what this order currently owns for that Category+Brand+Watt+
      // Type combo. Computed here (locking rows via FOR UPDATE) so a
      // shortfall blocks the whole request before anything is written,
      // same as the serial-line validation below.
      const qtyDeltas = [];
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
        if (isQtyLine(line)) {
          const itemKey = { cat: line.cat, brand: line.brand, watt: line.watt, type: line.type };
          const desiredQty = Number(line.qty) || 0;
          const [[{ ownedQty }]] = await conn.query(
            `SELECT COALESCE(SUM(quantity), 0) AS ownedQty FROM stock_ledger
             WHERE order_no=? AND category=? AND brand_name=? AND watt=? AND solar_type=? AND status='Sold' AND serial_no IS NULL
             FOR UPDATE`,
            [loadedOrderNo, line.cat, line.brand, Number(line.watt) || 0, line.type]
          );
          const delta = desiredQty - ownedQty;
          if (delta > 0) {
            const [[{ totalAvail }]] = await conn.query(
              `SELECT COALESCE(SUM(quantity), 0) AS totalAvail FROM stock_ledger
               WHERE category=? AND brand_name=? AND watt=? AND solar_type=? AND status='Available' AND serial_no IS NULL
               FOR UPDATE`,
              [line.cat, line.brand, Number(line.watt) || 0, line.type]
            );
            if (totalAvail < delta) {
              validationErrors.push(`Insufficient stock to increase ${line.brand} ${line.watt ? line.watt + 'W ' : ''}${line.type}: ${totalAvail} available, ${delta} more needed.`);
              continue;
            }
          }
          qtyDeltas.push({ itemKey, delta });
        } else {
          // Only BRAND NEW serials (not already part of this order) get
          // re-validated against stock — mirrors the `if sn not in
          // self.original_serial_list` guard in process_sales_modification().
          const newOnes = (line.serials || []).filter((sn) => !originalSerials.includes(sn));
          if (newOnes.length) {
            validationErrors.push(...(await validateSalesLineSerials(conn, newOnes, line)));
          }
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

      // Quantity-line adjustments — increase pulls extra units from the
      // Available pool (FIFO, same helper dispatch uses), decrease releases
      // the surplus back to Available (splitting a row if only part of it
      // needs to go back — the reverse of the dispatch split).
      let qtyDispatchedTotal = 0, qtyReleasedTotal = 0;
      for (const { itemKey, delta } of qtyDeltas) {
        if (delta > 0) {
          qtyDispatchedTotal += await fifoConsumeQty(conn, itemKey, delta, {
            customer: newCust, orderNo: loadedOrderNo, invoiceNo: newInv, invoiceDate: newInvDate,
            chalanDate: newChalanDate, chalanNo: newChalan, proofName: finalProof,
          }, 1);
        } else if (delta < 0) {
          qtyReleasedTotal += await releaseQtyToAvailable(conn, itemKey, loadedOrderNo, -delta);
        }
      }

      // Even when qty is unchanged, descriptive fields (customer/chalan/
      // invoice/dates/proof) on every row this order still owns must reflect
      // this edit — same as the serial rows updated above. Rows that were
      // just released above no longer match order_no=loadedOrderNo, so this
      // naturally skips them.
      for (const { itemKey } of qtyDeltas) {
        await conn.query(
          `UPDATE stock_ledger SET customer_name=?, order_no=?, sales_invoice=?, invoice_date=?, sales_date=?, chalan_no=?, chalan_date=?, sales_attachment=?, edited_flag=1
           WHERE order_no=? AND category=? AND brand_name=? AND watt=? AND solar_type=? AND status='Sold' AND serial_no IS NULL`,
          [newCust, loadedOrderNo, newInv || '-', newInvDate, newChalanDate, newChalan, newChalanDate, finalProof,
           loadedOrderNo, itemKey.cat, itemKey.brand, Number(itemKey.watt) || 0, itemKey.type]
        );
      }

      await conn.commit();
      res.json({ success: true, orderNo: loadedOrderNo, qtyDispatched: qtyDispatchedTotal, qtyReleased: qtyReleasedTotal });
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
    const [serialRows] = await pool.query(`SELECT serial_no FROM stock_ledger WHERE order_no=? AND status='Sold' AND serial_no IS NOT NULL`, [orderNo]);
    const [qtyRows] = await pool.query(`SELECT id, quantity FROM stock_ledger WHERE order_no=? AND status='Sold' AND serial_no IS NULL`, [orderNo]);
    if (!serialRows.length && !qtyRows.length) {
      return res.status(404).json({ error: 'No active sold records found for this order/challan.' });
    }
    if (serialRows.length) {
      await pool.query(
        `UPDATE stock_ledger SET status='Available', customer_name='-', order_no='-', sales_invoice='-', invoice_date='-', sales_date='-', chalan_no='-', chalan_date='-', sales_attachment='-', edited_flag=1
         WHERE order_no=? AND status='Sold' AND serial_no IS NOT NULL`,
        [orderNo]
      );
    }
    if (qtyRows.length) {
      // Quantity rows just flip back to Available in place — nothing to
      // split here, the whole row belonged to this order.
      await pool.query(
        `UPDATE stock_ledger SET status='Available', customer_name='-', order_no='-', sales_invoice='-', invoice_date='-', sales_date='-', chalan_no='-', chalan_date='-', sales_attachment='-', edited_flag=1
         WHERE order_no=? AND status='Sold' AND serial_no IS NULL`,
        [orderNo]
      );
    }
    const totalQtyReverted = qtyRows.reduce((sum, r) => sum + (r.quantity || 0), 0);
    try {
      await pool.query(
        `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('SALE_DELETE', ?, 'User', ?, ?, ?)`,
        [orderNo, ledgerTimestamp(), `Order:${orderNo}`, `Sale transaction deleted | Serials reverted to Available: ${serialRows.map((r) => r.serial_no).join(', ') || 'none'} | Qty reverted to Available: ${totalQtyReverted}`]
      );
    } catch (e) { /* audit log is best-effort, never block the delete on it */ }

    res.json({ success: true, revertedCount: serialRows.length, revertedQty: totalQtyReverted });
  }));

  // GET /api/sales/register — mirrors ui/registers.py's SaleRegisterPage
  // load_data(): one row per (challan, date, customer, order, category, brand,
  // sales_invoice) group, with the first serial + total qty + whether any row
  // in the group was ever edited. Only Sold rows with a real challan count,
  // exactly like the desktop query's WHERE status='Sold' AND chalan_no != '-'.
  app.get('/api/sales/register', route(async (req, res) => {
    const category = req.query.category;
    // SUM(quantity) instead of COUNT(*): a serial-tracked row is always
    // quantity=1 (so this matches the old COUNT(*) behaviour exactly for
    // those), while a quantity-tracked row (serial_no NULL) can represent
    // many units in a single row — COUNT(*) was under-reporting it as 1.
    let sql = `SELECT chalan_no, chalan_date, customer_name, order_no, category, brand_name, sales_invoice,
                      MIN(serial_no) AS first_serial, COALESCE(SUM(quantity), 0) AS qty, MAX(edited_flag) AS edited
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