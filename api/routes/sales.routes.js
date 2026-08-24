module.exports = function registerSalesRoutes(app, deps) {
  const {
    pool,
    route,
    requireRole,
    getItemId,
    validateSalesLineSerials,
    itemNameSlug,
    ledgerTimestamp,
    reportCache,
    invalidateStockCaches,
    syncStockSummary
  } = deps;

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
    // `model` is only ever set for quantity-tracked (watt=0) model-based
    // categories (e.g. PVC Pipe) — every other combo has model=NULL. The
    // `<=>` NULL-safe equality operator matches NULL=NULL as well as
    // value=value, so this filter is a no-op for non-model categories and
    // correctly keeps different models of the same brand in separate FIFO
    // pools (same bug class Step 1 fixed for Purchase's grouping key).
    const modelVal = itemKey.model ? String(itemKey.model).trim() : null;
    const [rows] = await conn.query(
      `SELECT id, quantity, item_id, item_name, category, brand_name, watt, solar_type, model, warehouse,
              supplier_name, purchase_invoice, purchase_date, purchase_attachment
       FROM stock_ledger
       WHERE category=? AND brand_name=? AND watt=? AND solar_type=? AND model <=> ? AND status='Available' AND serial_no IS NULL
       ORDER BY id ASC
       FOR UPDATE`,
      [itemKey.cat, itemKey.brand, Number(itemKey.watt) || 0, itemKey.type, modelVal]
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
             (item_id, item_name, category, brand_name, watt, solar_type, model, warehouse, status,
              supplier_name, purchase_invoice, purchase_date, purchase_attachment,
              customer_name, order_no, sales_invoice, invoice_date, sales_date, chalan_no, chalan_date, sales_attachment,
              quantity, serial_no, edited_flag)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Sold', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
          [row.item_id, row.item_name, row.category, row.brand_name, row.watt, row.solar_type, row.model, row.warehouse,
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
    // Same NULL-safe model filter as fifoConsumeQty — see comment there.
    const modelVal = itemKey.model ? String(itemKey.model).trim() : null;
    const [rows] = await conn.query(
      `SELECT id, quantity FROM stock_ledger
       WHERE order_no=? AND category=? AND brand_name=? AND watt=? AND solar_type=? AND model <=> ? AND status='Sold' AND serial_no IS NULL
       ORDER BY id ASC
       FOR UPDATE`,
      [orderNo, itemKey.cat, itemKey.brand, Number(itemKey.watt) || 0, itemKey.type, modelVal]
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
             (item_id, item_name, category, brand_name, watt, solar_type, model, warehouse, status,
              supplier_name, purchase_invoice, purchase_date, purchase_attachment,
              customer_name, order_no, sales_invoice, invoice_date, sales_date, chalan_no, chalan_date, sales_attachment,
              quantity, serial_no, edited_flag)
           SELECT item_id, item_name, category, brand_name, watt, solar_type, model, warehouse, 'Available',
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

  // FIFO-move `qty` units of itemKey from `fromStatus` to `toStatus` for
  // quantity-tracked stock (serial_no IS NULL). Generalizes
  // fifoConsumeQty/releaseQtyToAvailable's split logic to any status pair
  // with NO order_no filter — Return/Damage adjustments (Goal 4) aren't
  // tied to a specific order the way Sales dispatch/modify are, so any
  // matching row for this Category+Brand+Watt+Type combo is fair game,
  // oldest first. `extraFields` resets/tags plain columns on every moved
  // row (e.g. clearing customer/order info on a Sold->Available return,
  // same as the serial-based return branch does). `rawSetClauses` lets the
  // caller pass raw `column = expression` SQL (no bound params) for things
  // like CONCAT('[RETURNED] ', COALESCE(chalan_no, '')) that can't be
  // expressed as a plain value. Caller must already hold the transaction
  // and have validated enough `fromStatus` stock exists. Returns qty moved.
  async function fifoMoveQtyStatus(conn, itemKey, qty, fromStatus, toStatus, extraFields = {}, rawSetClauses = []) {
    let remaining = qty;
    let moved = 0;
    // Same NULL-safe model filter as fifoConsumeQty — see comment there.
    const modelVal = itemKey.model ? String(itemKey.model).trim() : null;
    const [rows] = await conn.query(
      `SELECT id, quantity FROM stock_ledger
       WHERE category=? AND brand_name=? AND watt=? AND solar_type=? AND model <=> ? AND status=? AND serial_no IS NULL
       ORDER BY id ASC
       FOR UPDATE`,
      [itemKey.cat, itemKey.brand, Number(itemKey.watt) || 0, itemKey.type, modelVal, fromStatus]
    );

    const setCols = ['status=?'];
    const setVals = [toStatus];
    for (const [col, val] of Object.entries(extraFields)) { setCols.push(`${col}=?`); setVals.push(val); }
    for (const raw of rawSetClauses) { setCols.push(raw); }
    const setSql = setCols.join(', ');

    for (const row of rows) {
      if (remaining <= 0) break;
      if (row.quantity <= remaining) {
        await conn.query(`UPDATE stock_ledger SET ${setSql} WHERE id=?`, [...setVals, row.id]);
        remaining -= row.quantity;
        moved += row.quantity;
      } else {
        // Partial consume: split the row — copy a new row for the moved
        // portion (still carrying the source row's identity/customer/chalan
        // data), then apply status + extraFields/rawSetClauses to just the
        // new row, and shrink the original row's quantity in place.
        const [insertResult] = await conn.query(
          `INSERT INTO stock_ledger
             (item_id, item_name, category, brand_name, watt, solar_type, model, warehouse, status,
              supplier_name, purchase_invoice, purchase_date, purchase_attachment,
              customer_name, order_no, sales_invoice, invoice_date, sales_date, chalan_no, chalan_date, sales_attachment,
              quantity, serial_no, edited_flag)
           SELECT item_id, item_name, category, brand_name, watt, solar_type, model, warehouse, status,
                  supplier_name, purchase_invoice, purchase_date, purchase_attachment,
                  customer_name, order_no, sales_invoice, invoice_date, sales_date, chalan_no, chalan_date, sales_attachment,
                  ?, NULL, edited_flag
           FROM stock_ledger WHERE id=?`,
          [remaining, row.id]
        );
        const newId = insertResult.insertId;
        await conn.query(`UPDATE stock_ledger SET ${setSql} WHERE id=?`, [...setVals, newId]);
        await conn.query(`UPDATE stock_ledger SET quantity = quantity - ? WHERE id=?`, [remaining, row.id]);
        moved += remaining;
        remaining = 0;
      }
    }
    return moved;
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
  // Model dropdown (Wattage<->Model swap, same rule as Masters > Item
  // Registration — see stockHelpers.js) reuses /api/purchase/models the same
  // way — it's already category+brand scoped and reads the same `items`
  // table, nothing Sales-specific about it, so no new /api/sales/models
  // endpoint is added; js/pages/sales.js just calls it directly.
  // Customer short-code + name autocomplete reuse /api/ledgers and
  // /api/ledgers/shortcodes with type=Customer (same as Supplier on Purchase).
  // ---------------------------------------------------------------------------

  // GET /api/sales/types?category=&brand=&watt= — Type/Subtype options actually
  // registered against this exact Category+Brand+Wattage combo in the `items`
  // master (mirrors get_types_for_category_brand_watt()). The frontend falls
  // back to /api/masters/subtypes/:category (get_subtypes_by_category()) when
  // this comes back empty, exactly like sync_sales_solartype() does.
  // NOTE: items created via Masters > Item Registration Panel have no Type
  // field there, so their solar_type is stored as the literal placeholder
  // '-' (see masters_routes.js POST/PUT /items). That placeholder is
  // excluded here — otherwise a Masters-registered item would make this
  // query return ['-'] (non-empty), which stops the frontend from ever
  // falling back to the category's real registered subtypes.
  app.get('/api/sales/types', route(async (req, res) => {
    const { category, brand } = req.query;
    const watt = Number(req.query.watt) || 0;
    if (!category || !brand) return res.json([]);
    const [rows] = await pool.query(
      `SELECT DISTINCT solar_type FROM items WHERE category=? AND brand_name=? AND watt=? AND solar_type IS NOT NULL AND solar_type <> '' AND solar_type <> '-' ORDER BY solar_type ASC`,
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
    const model = req.query.model ? String(req.query.model).trim() : null;
    const serials = String(req.query.serials || '').split(',').map((s) => s.trim()).filter(Boolean);
    const qty = Number(req.query.qty) || 0;

    if (!category || !brand || !type) return res.json({ errors: [] });

    // Quantity-based line (no serials scanned — category is not
    // serial-mandatory): just confirm enough Available quantity-tracked
    // stock exists for this exact Category+Brand+Wattage+Type(+Model) combo.
    // The `model <=> ?` NULL-safe filter matters most for model-based
    // categories (watt=0 for every model of a brand) — without it, "2 Inch"
    // and "3 Inch" PVC pipe stock would be summed together as one pool.
    if (!serials.length) {
      if (!qty) return res.json({ errors: [] });
      const [[{ totalAvail }]] = await pool.query(
        `SELECT COALESCE(SUM(quantity), 0) AS totalAvail FROM stock_ledger
         WHERE category=? AND brand_name=? AND watt=? AND solar_type=? AND model <=> ? AND status='Available' AND serial_no IS NULL`,
        [category, brand, watt, type, model]
      );
      if (totalAvail < qty) {
        return res.json({ errors: [`Insufficient stock: only ${totalAvail} available, ${qty} requested for ${brand} ${model ? model + ' ' : (watt ? watt + 'W ' : '')}${type}.`] });
      }
      return res.json({ errors: [] });
    }

    // No `model` passed here on purpose: model-based categories (e.g. PVC
    // Pipe) are, by the same rule Masters/Purchase already apply, never
    // serial_mandatory — a category needs Model exactly when it needs
    // NEITHER Wattage nor Serial No. So a serial-based line's category can
    // never be model-based, and validateSalesLineSerials()/stock_ledger's
    // serial rows never carry a model value to compare against.
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
        const model = line.model ? String(line.model).trim() : null;
        const itemId = await getItemId(conn, line.cat, line.brand, line.watt, line.type, model);
        if (!itemId) {
          validationErrors.push(`Selected product master (${line.brand} ${model ? model + ' ' : (line.watt ? line.watt + 'W ' : '')}${line.type}) was not found. Please create/check the master item first.`);
          continue;
        }
        if (isQtyLine(line)) {
          const qty = Number(line.qty) || 0;
          // FOR UPDATE locks every matching Available row now, so a
          // concurrent dispatch can't double-spend the same stock before
          // this transaction commits. `model <=> ?` keeps different models
          // of the same brand+category in separate pools (see stockHelpers.js).
          const [[{ totalAvail }]] = await conn.query(
            `SELECT COALESCE(SUM(quantity), 0) AS totalAvail FROM stock_ledger
             WHERE category=? AND brand_name=? AND watt=? AND solar_type=? AND model <=> ? AND status='Available' AND serial_no IS NULL
             FOR UPDATE`,
            [line.cat, line.brand, Number(line.watt) || 0, line.type, model]
          );
          if (totalAvail < qty) {
            validationErrors.push(`Insufficient stock for ${line.brand} ${model ? model + ' ' : (line.watt ? line.watt + 'W ' : '')}${line.type}: ${totalAvail} available, ${qty} requested.`);
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
          { cat: line.cat, brand: line.brand, watt: line.watt, type: line.type, model: line.model },
          Number(line.qty) || 0,
          { customer, orderNo, invoiceNo, invoiceDate, chalanDate, chalanNo, proofName }
        );
      }

      await conn.commit();
      if (typeof syncStockSummary === 'function') syncStockSummary(pool).catch(() => {});
      if (typeof invalidateStockCaches === 'function') invalidateStockCaches();
      if (typeof deps.logAuditEvent === 'function') {
        deps.logAuditEvent(pool, {
          type: 'SALES_DISPATCH',
          ref: chalanNo || orderNo || 'DISPATCH',
          user: (req.user && req.user.username) || 'User',
          oldVal: null,
          newVal: `Customer: ${customer} | Order: ${orderNo} | Challan: ${chalanNo} | Serials: ${allSerials.length} | Qty: ${qtyDispatchedTotal}`
        });
      }
      res.json({ success: true, orderNo, chalanNo, lineCount: lines.length, serialCount: allSerials.length, qtyDispatched: qtyDispatchedTotal });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }));

  // ---------------------------------------------------------------------------
  // RETURN & DAMAGE — Goal 4: multi-line `lines: [...]` (mirrors the Sales
  // dispatch pattern) instead of a flat `serials: [...]` array, so a single
  // batch can mix serial-based lines AND quantity-based lines:
  //   - Serial line:  { cat, brand, watt, type, serials: ['SN1','SN2',...] }
  //   - Quantity line:{ cat, brand, watt, type, qty: 5 }
  // Same two actions as before, applied to the whole batch:
  //   1) "Sales Return (Make Available)" — serial: only if current status is
  //      'Sold'. qty line: needs enough 'Sold' quantity for that combo.
  //      Resets customer/order/invoice/date fields, tags chalan_no with a
  //      '[RETURNED] ' prefix, status -> 'Available'.
  //   2) "Mark as Damaged / Scrapped" — serial: blocked if status is 'Sold'
  //      (must Sales-Return it back to Available first). qty line: needs
  //      enough 'Available' quantity for that combo (can't damage stock
  //      that's currently Sold — mirrors the serial rule). status -> 'Damaged'.
  // Whole-batch validation: if ANY line/serial fails, the ENTIRE adjustment
  // is blocked — nothing is written — same "ADJUSTMENT BLOCKED" contract as
  // before.
  // ---------------------------------------------------------------------------
  app.post('/api/returns', route(async (req, res) => {
    const actionType = String(req.body.actionType || '').trim();
    const remarks = String(req.body.remarks || '').trim();
    const actionDate = String(req.body.date || '').trim();
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];

    if (!['Sales Return (Make Available)', 'Mark as Damaged / Scrapped'].includes(actionType)) {
      return res.status(400).json({ error: 'Invalid Action Type.' });
    }
    if (!remarks || !actionDate || !lines.length) {
      return res.status(400).json({ error: 'Remarks, Date, and at least one Line are mandatory.' });
    }

    // Split lines into serial-based and quantity-based, same either/or
    // convention used by POST /api/sales/dispatch.
    const serialLines = [];
    const qtyLineInputs = [];
    for (const line of lines) {
      const hasSerials = Array.isArray(line.serials) && line.serials.length;
      const qty = Number(line.qty) || 0;
      if (hasSerials) serialLines.push(line);
      else if (qty > 0) qtyLineInputs.push({ ...line, qty, model: line.model ? String(line.model).trim() : null });
    }

    const allSerials = serialLines.flatMap((l) => (l.serials || []).map((s) => String(s).trim()).filter(Boolean));
    if (!allSerials.length && !qtyLineInputs.length) {
      return res.status(400).json({ error: 'Add Serial Numbers or a Quantity to at least one line before saving.' });
    }
    const seen = new Set(), innerDupes = new Set();
    allSerials.forEach((sn) => { if (seen.has(sn)) innerDupes.add(sn); seen.add(sn); });
    if (innerDupes.size) {
      return res.status(400).json({ error: `Same serial number is present in multiple lines: ${[...innerDupes].join(', ')}` });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const invalidSerials = [];
      const validSerialUpdates = [];
      for (const sn of allSerials) {
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
          validSerialUpdates.push({ sn, newStatus: actionType === 'Sales Return (Make Available)' ? 'Available' : 'Damaged' });
        }
      }

      // Quantity-line validation: confirm enough stock exists in the source
      // status for each combo. FOR UPDATE locks it so a concurrent
      // adjustment can't double-spend before this transaction commits.
      const qtyLineErrors = [];
      const validQtyLines = [];
      const fromStatus = actionType === 'Sales Return (Make Available)' ? 'Sold' : 'Available';
      for (const line of qtyLineInputs) {
        if (!line.cat || !line.brand || !line.type) {
          qtyLineErrors.push('Category, Brand and Type are required for every quantity line.');
          continue;
        }
        const [[{ totalQty }]] = await conn.query(
          `SELECT COALESCE(SUM(quantity),0) AS totalQty FROM stock_ledger
           WHERE category=? AND brand_name=? AND watt=? AND solar_type=? AND model <=> ? AND status=? AND serial_no IS NULL
           FOR UPDATE`,
          [line.cat, line.brand, Number(line.watt) || 0, line.type, line.model, fromStatus]
        );
        if (totalQty < line.qty) {
          const label = actionType === 'Sales Return (Make Available)'
            ? `only ${totalQty} 'Sold' unit(s) available to return`
            : `only ${totalQty} 'Available' unit(s) to mark damaged`;
          qtyLineErrors.push(`${line.brand} ${line.model ? line.model + ' ' : (line.watt ? line.watt + 'W ' : '')}${line.type}: ${label}, ${line.qty} requested.`);
        } else {
          validQtyLines.push({ itemKey: { cat: line.cat, brand: line.brand, watt: line.watt, type: line.type, model: line.model }, qty: line.qty });
        }
      }

      if (invalidSerials.length || qtyLineErrors.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'ADJUSTMENT BLOCKED:\n\n' + [...invalidSerials, ...qtyLineErrors].join('\n') });
      }

      // Apply serial-based updates — unchanged from before.
      for (const { sn, newStatus } of validSerialUpdates) {
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

      // Apply quantity-based moves.
      let qtyAdjustedTotal = 0;
      for (const { itemKey, qty } of validQtyLines) {
        if (actionType === 'Sales Return (Make Available)') {
          qtyAdjustedTotal += await fifoMoveQtyStatus(
            conn, itemKey, qty, 'Sold', 'Available',
            { customer_name: '-', order_no: '-', sales_invoice: '-', invoice_date: '-', sales_date: '-', sales_attachment: '-' },
            [`chalan_no = CONCAT('[RETURNED] ', COALESCE(chalan_no, ''))`]
          );
        } else {
          qtyAdjustedTotal += await fifoMoveQtyStatus(conn, itemKey, qty, 'Available', 'Damaged');
        }
      }

      await conn.commit();
      if (typeof syncStockSummary === 'function') syncStockSummary(pool).catch(() => {});
      if (typeof invalidateStockCaches === 'function') invalidateStockCaches();

      try {
        const oldDetails = `Action: ${actionType} | Date: ${actionDate}`;
        const newDetails = `Remarks: ${remarks} | Serials: ${allSerials.join(', ') || 'none'} | Qty lines adjusted: ${qtyAdjustedTotal}`;
        await pool.query(
          `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('RETURN_ADJUST', ?, 'User', ?, ?, ?)`,
          [remarks.slice(0, 50), ledgerTimestamp(), oldDetails, newDetails]
        );
      } catch (e) { /* audit log is best-effort, never block the adjustment on it */ }

      res.json({
        success: true,
        actionType,
        serialCount: validSerialUpdates.length,
        qtyAdjusted: qtyAdjustedTotal,
      });
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
                      brand_name, watt, solar_type, model, serial_no, quantity, sales_attachment
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
      // model included in the key — without it, different models of the
      // same Category+Brand+Watt(0)+Type would wrongly merge into one line
      // (same bug class Step 1 fixed for Purchase's own grouping key).
      const key = [r.category, r.brand_name, r.watt || 0, r.solar_type, r.model || ''].join('|');
      if (r.serial_no) {
        if (!serialGrouped.has(key)) {
          serialGrouped.set(key, { cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type, model: r.model || '', serials: [] });
        }
        serialGrouped.get(key).serials.push(r.serial_no);
      } else {
        if (!qtyGrouped.has(key)) {
          qtyGrouped.set(key, { cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type, model: r.model || '', qty: 0, qtyRowIds: [] });
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
        const model = line.model ? String(line.model).trim() : null;
        const itemId = await getItemId(conn, line.cat, line.brand, line.watt, line.type, model);
        if (!itemId) {
          validationErrors.push(`Selected product master (${line.brand} ${model ? model + ' ' : (line.watt ? line.watt + 'W ' : '')}${line.type}) was not found. Please create/check the master item first.`);
          continue;
        }
        if (isQtyLine(line)) {
          const itemKey = { cat: line.cat, brand: line.brand, watt: line.watt, type: line.type, model };
          const desiredQty = Number(line.qty) || 0;
          const [[{ ownedQty }]] = await conn.query(
            `SELECT COALESCE(SUM(quantity), 0) AS ownedQty FROM stock_ledger
             WHERE order_no=? AND category=? AND brand_name=? AND watt=? AND solar_type=? AND model <=> ? AND status='Sold' AND serial_no IS NULL
             FOR UPDATE`,
            [loadedOrderNo, line.cat, line.brand, Number(line.watt) || 0, line.type, model]
          );
          const delta = desiredQty - ownedQty;
          if (delta > 0) {
            const [[{ totalAvail }]] = await conn.query(
              `SELECT COALESCE(SUM(quantity), 0) AS totalAvail FROM stock_ledger
               WHERE category=? AND brand_name=? AND watt=? AND solar_type=? AND model <=> ? AND status='Available' AND serial_no IS NULL
               FOR UPDATE`,
              [line.cat, line.brand, Number(line.watt) || 0, line.type, model]
            );
            if (totalAvail < delta) {
              validationErrors.push(`Insufficient stock to increase ${line.brand} ${model ? model + ' ' : (line.watt ? line.watt + 'W ' : '')}${line.type}: ${totalAvail} available, ${delta} more needed.`);
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
        const model = line.model ? String(line.model).trim() : null;
        const itemId = await getItemId(conn, line.cat, line.brand, line.watt, line.type, model);
        const itemName = itemNameSlug(line.brand, line.watt, line.type, model);
        for (const sn of (line.serials || [])) {
          await conn.query(
            `UPDATE stock_ledger SET
               status='Sold', item_id=?, item_name=?, category=?, brand_name=?, watt=?, solar_type=?, model=?,
               customer_name=?, order_no=?, sales_invoice=?, invoice_date=?, sales_date=?, chalan_no=?, chalan_date=?, sales_attachment=?, edited_flag=1
             WHERE serial_no=?`,
            [itemId, itemName, line.cat, line.brand, Number(line.watt) || 0, line.type, model, newCust, loadedOrderNo, newInv || '-', newInvDate, newChalanDate, newChalan, newChalanDate, finalProof, sn]
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
           WHERE order_no=? AND category=? AND brand_name=? AND watt=? AND solar_type=? AND model <=> ? AND status='Sold' AND serial_no IS NULL`,
          [newCust, loadedOrderNo, newInv || '-', newInvDate, newChalanDate, newChalan, newChalanDate, finalProof,
           loadedOrderNo, itemKey.cat, itemKey.brand, Number(itemKey.watt) || 0, itemKey.type, itemKey.model || null]
        );
      }

      await conn.commit();
      if (typeof syncStockSummary === 'function') syncStockSummary(pool).catch(() => {});
      if (typeof invalidateStockCaches === 'function') invalidateStockCaches();
      res.json({ success: true, orderNo: loadedOrderNo, qtyDispatched: qtyDispatchedTotal, qtyReleased: qtyReleasedTotal });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }));

  // DELETE /api/sales/delete/:orderNo — mirrors delete_sales_transaction():
  // permanently reverts every Sold/Dispatched item on this order/challan/invoice
  // back to Available stock (undoes the dispatch; does not delete the underlying purchase row).
  app.delete('/api/sales/delete/:orderNo', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const rawRef = decodeURIComponent(req.params.orderNo || '').trim();
    if (!rawRef || rawRef === '-') {
      return res.status(400).json({ error: 'Valid Order / Challan / Invoice reference is required.' });
    }

    // Build candidate search references (e.g. "NP003700", "3700", "NP3700")
    const candidates = new Set([rawRef]);
    const numPart = rawRef.replace(/^NP0*/i, '');
    if (numPart && numPart !== rawRef) {
      candidates.add(numPart);
      candidates.add(`NP${numPart}`);
      candidates.add(`NP00${numPart}`);
    }
    const candList = [...candidates];

    const whereStock = `(${candList.map(() => '(order_no = ? OR chalan_no = ? OR sales_invoice = ?)').join(' OR ')}) AND (status = 'Sold' OR status = 'Dispatched' OR bom_dispatch_id IS NOT NULL)`;
    const stockParams = [];
    candList.forEach((c) => { stockParams.push(c, c, c); });

    const [serialRows] = await pool.query(
      `SELECT serial_no FROM stock_ledger WHERE ${whereStock} AND serial_no IS NOT NULL AND serial_no != ''`,
      stockParams
    );
    const [qtyRows] = await pool.query(
      `SELECT id, quantity FROM stock_ledger WHERE ${whereStock} AND (serial_no IS NULL OR serial_no = '')`,
      stockParams
    );

    // Also check bom_dispatches
    let dispatchRows = [];
    try {
      const [dRows] = await pool.query(
        `SELECT id, order_no FROM bom_dispatches WHERE order_no IN (?)`,
        [candList]
      );
      dispatchRows = dRows || [];
    } catch (e) { /* ignore */ }

    // 1. Revert stock_ledger items back to Available
    if (serialRows.length || qtyRows.length) {
      await pool.query(
        `UPDATE stock_ledger
         SET status='Available',
             customer_name='-',
             order_no='-',
             sales_invoice='-',
             invoice_date='-',
             sales_date='-',
             chalan_no='-',
             chalan_date='-',
             sales_attachment='-',
             bom_dispatch_id=NULL,
             edited_flag=1
         WHERE ${whereStock}`,
        stockParams
      );
    }

    // 2. Delete from bom_dispatches
    if (dispatchRows.length) {
      try {
        await pool.query(
          `DELETE FROM bom_dispatches WHERE order_no IN (?) OR id IN (?)`,
          [candList, dispatchRows.map((r) => r.id)]
        );
      } catch (e) { /* ignore */ }
    }

    // 3. Revert BOM order status back to Open if applicable
    try {
      await pool.query(
        `UPDATE bom_orders SET status='Open' WHERE order_no IN (?)`,
        [candList]
      );
    } catch (e) { /* ignore */ }

    const totalQtyReverted = qtyRows.reduce((sum, r) => sum + (r.quantity || 0), 0);
    if (typeof syncStockSummary === 'function') syncStockSummary(pool).catch(() => {});
    if (typeof invalidateStockCaches === 'function') invalidateStockCaches();
    if (typeof deps.invalidateLedgerCaches === 'function') deps.invalidateLedgerCaches();
    if (deps.reportCache && typeof deps.reportCache.flush === 'function') deps.reportCache.flush();

    try {
      await pool.query(
        `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('SALE_DELETE', ?, 'User', ?, ?, ?)`,
        [rawRef, ledgerTimestamp(), `Ref:${rawRef}`, `Sale transaction deleted | Serials reverted: ${serialRows.map((r) => r.serial_no).join(', ') || 'none'} | Qty reverted: ${totalQtyReverted} | Dispatches cleaned: ${dispatchRows.length}`]
      );
    } catch (e) { /* audit log is best-effort, never block the delete on it */ }

    res.json({
      success: true,
      revertedCount: serialRows.length,
      revertedQty: totalQtyReverted,
      dispatchesDeleted: dispatchRows.length,
      message: `Voucher / Dispatch #${rawRef} successfully deleted.`
    });
  }));

  // GET /api/sales/register — mirrors ui/registers.py's SaleRegisterPage
  // load_data(): one row per (challan, date, customer, order, category, brand,
  // sales_invoice) group, with the first serial + total qty + whether any row
  // in the group was ever edited. Only Sold rows with a real challan count,
  // exactly like the desktop query's WHERE status='Sold' AND chalan_no != '-'.
  app.get('/api/sales/register', route(async (req, res) => {
    const category = req.query.category;
    const cacheKey = `sales:register:${category || 'all'}`;
    const rows = await deps.reportCache.wrap(cacheKey, async () => {
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

      const [data] = await pool.query(sql, params);
      return data.map((r) => ({
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
      }));
    }, 45000);
    res.json(rows);
  }));

};