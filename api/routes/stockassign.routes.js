module.exports = function registerStockassignRoutes(app, deps) {
  const { pool, route, getItemId } = deps;
  // ---------------------------------------------------------------------------
  // STOCK ASSIGN — mirrors ui/assign_stock.py exactly: reserve stock for a
  // person WITHOUT selling it (marks stock_ledger rows 'Assigned' instead of
  // 'Sold'), a live Assigned Register, and two release paths:
  //   1) Release to Firm     -> assignment cancelled, stock back to Available.
  //   2) Release to Customer -> same cancel + hands off Customer/Order/lines
  //      so the frontend can pre-fill the Sales page (releaseToCustomerRequested
  //      signal in the desktop app).
  // Same strictness as Sales dispatch: product master must already exist
  // (never auto-created), and serials are picked server-side (oldest first),
  // never scanned by hand — exactly like get_available_serials_for_item().
  //
  // DUAL ITEM TYPE SUPPORT (Goal 3): a Category is either serial-mandatory
  // (categories.serial_mandatory=1, e.g. Panel/Inverter — every unit is its
  // own stock_ledger row with a serial_no) or quantity-tracked (every other
  // category — one or more stock_ledger rows per Category+Brand+Watt+Type
  // combo, serial_no=NULL, the real count lives in `quantity`). Reserve/
  // Release below branch on this exactly like js/pages/sales.js's dispatch/
  // modify already do, using the same FIFO-consume / FIFO-release pattern
  // (oldest Available row first, splitting a row when only part of it is
  // needed) — just targeting status='Assigned' instead of 'Sold'.
  // ---------------------------------------------------------------------------

  // Category -> serial_mandatory lookup, same source /api/masters/categories
  // reads from. A tiny helper keeps every call site consistent.
  async function isCategorySerialMandatory(conn, category) {
    const [rows] = await conn.query(`SELECT serial_mandatory FROM categories WHERE name=?`, [category]);
    // Default true (serial required) if the category isn't found — same
    // fail-safe default used by isSerialMandatory() in sales.js, so nothing
    // changes for existing categories until serial_mandatory is explicitly 0.
    return rows.length ? !!rows[0].serial_mandatory : true;
  }

  // FIFO-consume `qtyNeeded` units of itemKey from the Available pool,
  // tagging every unit 'Assigned' with this reservation's details. Oldest
  // Available row (lowest id) used first; a row only partially needed gets
  // split (new Assigned row for the taken amount, original row's quantity
  // shrinks but stays Available). Caller must already hold the transaction
  // and have validated enough stock exists via FOR UPDATE. Mirrors
  // fifoConsumeQty() in sales.routes.js, targeting 'Assigned' instead of
  // 'Sold' and assign_* columns instead of customer/order/chalan/invoice.
  async function fifoConsumeQtyForAssign(conn, itemKey, qtyNeeded, meta) {
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
          `UPDATE stock_ledger SET status='Assigned', assign_to=?, assign_reference=?, assign_date=?, assign_remarks=?, assign_attachment=?
           WHERE id=?`,
          [meta.person, meta.reference, meta.date, meta.remarks, meta.proofName, row.id]
        );
        remaining -= row.quantity;
        consumed += row.quantity;
      } else {
        await conn.query(
          `INSERT INTO stock_ledger
             (item_id, item_name, category, brand_name, watt, solar_type, warehouse, status,
              supplier_name, purchase_invoice, purchase_date, purchase_attachment,
              assign_to, assign_reference, assign_date, assign_remarks, assign_attachment,
              quantity, serial_no)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Assigned', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [row.item_id, row.item_name, row.category, row.brand_name, row.watt, row.solar_type, row.warehouse,
           row.supplier_name, row.purchase_invoice, row.purchase_date, row.purchase_attachment,
           meta.person, meta.reference, meta.date, meta.remarks, meta.proofName, remaining]
        );
        await conn.query(`UPDATE stock_ledger SET quantity = quantity - ? WHERE id=?`, [remaining, row.id]);
        consumed += remaining;
        remaining = 0;
      }
    }
    return consumed;
  }

  // Release every quantity-tracked (serial_no IS NULL) 'Assigned' row this
  // reference currently owns, straight back to Available — no split needed
  // since the whole row was created for (and belongs entirely to) this one
  // reference, same as the full-row case in sales.js's delete flow. Returns
  // the total quantity released.
  async function releaseAssignedQtyRows(conn, reference) {
    const [rows] = await conn.query(
      `SELECT id, quantity FROM stock_ledger WHERE assign_reference=? AND status='Assigned' AND serial_no IS NULL FOR UPDATE`,
      [reference]
    );
    if (!rows.length) return 0;
    await conn.query(
      `UPDATE stock_ledger SET status='Available', assign_to='-', assign_reference='-', assign_date='-', assign_remarks='-', assign_attachment='-'
       WHERE assign_reference=? AND status='Assigned' AND serial_no IS NULL`,
      [reference]
    );
    return rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
  }

  // GET /api/stockassign/available?category=&brand=&watt=&type= — mirrors
  // refresh_available_qty_hint(): live "Available: N" counter shown next to
  // the Quantity field as the user picks Category/Brand/Wattage/Type. Uses
  // SUM(quantity) instead of COUNT(*) — a serial-tracked row is always
  // quantity=1 (so this matches the old COUNT(*) behaviour exactly for
  // those), while a quantity-tracked row (serial_no NULL) can represent many
  // units in a single row, which COUNT(*) was under-reporting as just 1.
  app.get('/api/stockassign/available', route(async (req, res) => {
    const { category, brand, type } = req.query;
    const watt = Number(req.query.watt) || 0;
    if (!category || !brand || !type) return res.json({ itemId: null, available: 0 });
    const itemId = await getItemId(pool, category, brand, watt, type);
    if (!itemId) return res.json({ itemId: null, available: 0 });
    const [[{ total }]] = await pool.query(`SELECT COALESCE(SUM(quantity), 0) AS total FROM stock_ledger WHERE status='Available' AND item_id=?`, [itemId]);
    res.json({ itemId, available: total });
  }));

  // POST /api/stockassign — mirrors process_stock_assignment(): reference
  // conflict check, then for every line re-checks availability. Serial-
  // mandatory categories auto-pick the actual serials (oldest first) right
  // before committing, marking them 'Assigned'. Quantity-tracked categories
  // FIFO-consume the requested qty from the Available pool the same way —
  // no serials to pick, the row(s) themselves carry the reserved quantity.
  app.post('/api/stockassign', route(async (req, res) => {
    const person = String(req.body.person || '').trim();
    const reference = String(req.body.reference || '').trim();
    const date = String(req.body.date || '').trim();
    const remarks = String(req.body.remarks || '').trim() || '-';
    const proofName = String(req.body.proofName || '').trim() || '-';
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];

    if (!person || !reference) {
      return res.status(400).json({ error: 'Assign-To Person and Reference No are required.' });
    }
    if (!lines.length) {
      return res.status(400).json({ error: 'Add at least one product line (or fill Quantity) before reserving stock.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Reference no must belong to one person only — mirrors the Sales
      // challan conflict check, applied here to assign_reference instead.
      const [existing] = await conn.query(
        `SELECT DISTINCT assign_to FROM stock_ledger WHERE assign_reference=? AND status='Assigned'`,
        [reference]
      );
      if (existing.length && existing.some((row) => row.assign_to !== person)) {
        await conn.rollback();
        return res.status(400).json({ error: 'This Reference No is already assigned to a different person.' });
      }

      // Re-check availability for every line. Serial-mandatory lines
      // auto-pick serials (oldest first, row-locked). Quantity-tracked
      // lines just confirm enough total quantity exists (also row-locked,
      // via FOR UPDATE) — the actual FIFO consume/split happens in the
      // second pass below, after every line has passed validation.
      const serialLineMap = [];
      const qtyLineMap = [];
      const availabilityErrors = [];
      for (const line of lines) {
        if (!line.cat || !line.brand || !line.type || !line.qty || Number(line.qty) <= 0) {
          availabilityErrors.push('Category, Brand, Type and Qty are required for every product line.');
          continue;
        }
        const itemId = await getItemId(conn, line.cat, line.brand, line.watt, line.type);
        const wattLbl = line.watt ? `${line.watt}W` : 'N/A';
        if (!itemId) {
          availabilityErrors.push(`Selected product master (${line.brand} | ${wattLbl} | ${line.type}) was not found. Please create/check the master item first.`);
          continue;
        }
        const needsSerial = await isCategorySerialMandatory(conn, line.cat);
        if (needsSerial) {
          const [picked] = await conn.query(
            `SELECT serial_no FROM stock_ledger WHERE status='Available' AND item_id=? ORDER BY id ASC LIMIT ? FOR UPDATE`,
            [itemId, Number(line.qty)]
          );
          const serials = picked.map((r) => r.serial_no);
          if (serials.length < Number(line.qty)) {
            availabilityErrors.push(`${line.brand} | ${wattLbl} | ${line.type}: only ${serials.length} unit(s) Available right now (requested ${line.qty}).`);
          } else {
            serialLineMap.push({ line, serials });
          }
        } else {
          const [[{ totalAvail }]] = await conn.query(
            `SELECT COALESCE(SUM(quantity), 0) AS totalAvail FROM stock_ledger
             WHERE category=? AND brand_name=? AND watt=? AND solar_type=? AND status='Available' AND serial_no IS NULL
             FOR UPDATE`,
            [line.cat, line.brand, Number(line.watt) || 0, line.type]
          );
          if (totalAvail < Number(line.qty)) {
            availabilityErrors.push(`${line.brand} | ${wattLbl} | ${line.type}: only ${totalAvail} unit(s) Available right now (requested ${line.qty}).`);
          } else {
            qtyLineMap.push({ line, itemKey: { cat: line.cat, brand: line.brand, watt: line.watt, type: line.type } });
          }
        }
      }
      if (availabilityErrors.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'ASSIGNMENT BLOCKED:\n\n' + availabilityErrors.join('\n') });
      }

      const allSerials = serialLineMap.flatMap((x) => x.serials);
      const failedSerials = [];
      for (const { serials } of serialLineMap) {
        for (const sn of serials) {
          const [result] = await conn.query(
            `UPDATE stock_ledger SET status='Assigned', assign_to=?, assign_reference=?, assign_date=?, assign_remarks=?, assign_attachment=? WHERE serial_no=? AND status='Available'`,
            [person, reference, date, remarks, proofName, sn]
          );
          if (result.affectedRows === 0) failedSerials.push(sn);
        }
      }
      if (failedSerials.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'Some of the reserved units were taken by another action just now. Please try again.' });
      }

      let qtyReserved = 0;
      for (const { line, itemKey } of qtyLineMap) {
        qtyReserved += await fifoConsumeQtyForAssign(conn, itemKey, Number(line.qty), { person, reference, date, remarks, proofName });
      }

      await conn.commit();
      try {
        const nowStr = new Date().toLocaleString('en-GB').replace(',', '');
        await pool.query(
          `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('STOCK_ASSIGN', ?, 'User', ?, ?, ?)`,
          [reference, nowStr, `Status: Available | Units: ${allSerials.length + qtyReserved}`, `Assigned To: ${person} | Ref: ${reference} | Remarks: ${remarks} | Serials: ${allSerials.join(', ') || 'none'} | Qty reserved: ${qtyReserved}`]
        );
      } catch (e) { /* audit log failure shouldn't block the assignment */ }

      res.json({
        success: true, reference, person,
        lineCount: serialLineMap.length + qtyLineMap.length,
        serialCount: allSerials.length,
        qtyCount: qtyReserved,
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }));

  // GET /api/stockassign/register?q=... — mirrors load_assigned_register():
  // every currently-'Assigned' row, grouped back into one row per
  // reference/person/date/brand/watt/type. SUM(quantity) instead of
  // COUNT(*) so a quantity-tracked combo (one row can represent many units)
  // reports its real qty, not just its row count — matches COUNT(*) exactly
  // for serial-tracked combos since those rows are always quantity=1.
  app.get('/api/stockassign/register', route(async (req, res) => {
    const [rows] = await pool.query(`
      SELECT assign_reference AS ref, assign_to AS person, assign_date AS date,
             brand_name AS brand, watt, solar_type AS type, COALESCE(SUM(quantity), 0) AS qty
      FROM stock_ledger WHERE status='Assigned'
      GROUP BY assign_reference, assign_to, assign_date, brand_name, watt, solar_type
      ORDER BY assign_reference DESC
    `);
    const q = String(req.query.q || '').trim().toLowerCase();
    const mapped = rows.map((r) => ({
      ref: r.ref, person: r.person, date: r.date, brand: r.brand,
      watt: r.watt || 0, type: r.type || 'Others', qty: r.qty,
    }));
    const filtered = q
      ? mapped.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)))
      : mapped;
    res.json(filtered);
  }));

  // GET /api/stockassign/lines/:reference — mirrors load_reference_for_release():
  // every still-'Assigned' row under this reference, grouped back into
  // product lines for the Release panel. Serial-tracked rows keep their
  // exact serials (unchanged); quantity-tracked rows (serial_no IS NULL)
  // are grouped separately with qty = SUM(quantity) and their db row ids
  // remembered (qtyRowIds) — mirrors the same serialGrouped/qtyGrouped split
  // already used by GET /api/sales/find/:term.
  app.get('/api/stockassign/lines/:reference', route(async (req, res) => {
    const reference = String(req.params.reference || '').trim();
    const [rows] = await pool.query(
      `SELECT id, serial_no, quantity, assign_to, brand_name, watt, solar_type, category, item_id
       FROM stock_ledger WHERE assign_reference=? AND status='Assigned'`,
      [reference]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'This assignment could not be found (it may have already been released).' });
    }
    const person = rows[0].assign_to;
    const serialGrouped = new Map();
    const qtyGrouped = new Map();
    for (const r of rows) {
      const key = `${r.category}|${r.brand_name}|${r.watt || 0}|${r.solar_type}|${r.item_id}`;
      if (r.serial_no) {
        if (!serialGrouped.has(key)) {
          serialGrouped.set(key, { cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type, itemId: r.item_id, serials: [] });
        }
        serialGrouped.get(key).serials.push(r.serial_no);
      } else {
        if (!qtyGrouped.has(key)) {
          qtyGrouped.set(key, { cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type, itemId: r.item_id, qty: 0, qtyRowIds: [] });
        }
        const g = qtyGrouped.get(key);
        g.qty += r.quantity || 0;
        g.qtyRowIds.push(r.id);
      }
    }
    const lines = [
      ...Array.from(serialGrouped.values()).map((l) => ({ ...l, qty: l.serials.length })),
      ...Array.from(qtyGrouped.values()),
    ];
    const allSerials = rows.filter((r) => r.serial_no).map((r) => r.serial_no);
    res.json({ reference, person, lines, allSerials });
  }));

  // Shared release helper — mirrors the identical "set every serial back to
  // Available + clear assign_* fields" UPDATE loop used by both release_to_firm()
  // and release_to_customer() in the desktop app. Now also releases every
  // quantity-tracked row this reference owns (via releaseAssignedQtyRows).
  async function releaseAssignedSerials(conn, reference) {
    const [rows] = await conn.query(
      `SELECT serial_no FROM stock_ledger WHERE assign_reference=? AND status='Assigned' AND serial_no IS NOT NULL`,
      [reference]
    );
    const serials = rows.map((r) => r.serial_no);
    if (serials.length) {
      await conn.query(
        `UPDATE stock_ledger SET status='Available', assign_to='-', assign_reference='-', assign_date='-', assign_remarks='-' WHERE serial_no IN (?)`,
        [serials]
      );
    }
    const qtyReleased = await releaseAssignedQtyRows(conn, reference);
    return { serials, qtyReleased };
  }

  // POST /api/stockassign/release-firm — mirrors release_to_firm(): cancel
  // the assignment, return every serial AND every quantity-tracked unit to
  // the free Available pool.
  app.post('/api/stockassign/release-firm', route(async (req, res) => {
    const reference = String(req.body.reference || '').trim();
    if (!reference) return res.status(400).json({ error: 'Reference No is required.' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const { serials, qtyReleased } = await releaseAssignedSerials(conn, reference);
      if (!serials.length && !qtyReleased) {
        await conn.rollback();
        return res.status(404).json({ error: 'Nothing to release — this assignment may have already been released.' });
      }
      await conn.commit();
      try {
        const nowStr = new Date().toLocaleString('en-GB').replace(',', '');
        await pool.query(
          `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('STOCK_RELEASE_FIRM', ?, 'User', ?, ?, ?)`,
          [reference, nowStr, `Units: ${serials.length + qtyReleased}`, 'Released back to Available stock']
        );
      } catch (e) { /* audit log failure shouldn't block the release */ }
      res.json({ success: true, reference, serialCount: serials.length, qtyCount: qtyReleased });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }));

  // POST /api/stockassign/release-customer — mirrors release_to_customer():
  // same "back to Available" release (serials AND quantity-tracked rows),
  // then returns Customer/Order/lines so the frontend can redirect to
  // Project Sales pre-filled (Challan No is the only thing left for the
  // user to fill before a normal, fully-validated dispatch). Quantity-based
  // lines carry their qty straight through — js/pages/sales.js's
  // prefillFromAssign() + isSerialMandatory(cat) already know to skip the
  // serial-scan box for those and dispatch purely on quantity.
  app.post('/api/stockassign/release-customer', route(async (req, res) => {
    const reference = String(req.body.reference || '').trim();
    const customer = String(req.body.customer || '').trim();
    const orderNo = String(req.body.orderNo || '').trim();
    if (!reference) return res.status(400).json({ error: 'Reference No is required.' });
    if (!customer || !orderNo) return res.status(400).json({ error: 'Release Customer and Release Order No are required.' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query(
        `SELECT serial_no, quantity, brand_name, watt, solar_type, category, item_id
         FROM stock_ledger WHERE assign_reference=? AND status='Assigned'`,
        [reference]
      );
      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Nothing to release — this assignment may have already been released.' });
      }
      const serialGrouped = new Map();
      const qtyGrouped = new Map();
      for (const r of rows) {
        const key = `${r.category}|${r.brand_name}|${r.watt || 0}|${r.solar_type}|${r.item_id}`;
        if (r.serial_no) {
          if (!serialGrouped.has(key)) serialGrouped.set(key, { cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type, itemId: r.item_id, serials: [] });
          serialGrouped.get(key).serials.push(r.serial_no);
        } else {
          if (!qtyGrouped.has(key)) qtyGrouped.set(key, { cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type, itemId: r.item_id, qty: 0 });
          qtyGrouped.get(key).qty += r.quantity || 0;
        }
      }
      const lines = [
        ...Array.from(serialGrouped.values()).map((l) => ({ cat: l.cat, brand: l.brand, watt: l.watt, type: l.type, qty: l.serials.length })),
        ...Array.from(qtyGrouped.values()).map((l) => ({ cat: l.cat, brand: l.brand, watt: l.watt, type: l.type, qty: l.qty })),
      ];

      await releaseAssignedSerials(conn, reference);
      await conn.commit();
      try {
        const nowStr = new Date().toLocaleString('en-GB').replace(',', '');
        await pool.query(
          `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('STOCK_RELEASE_CUSTOMER', ?, 'User', ?, ?, ?)`,
          [reference, nowStr, `Rows: ${rows.length}`, `Redirected to Sales for Customer: ${customer} | Order: ${orderNo}`]
        );
      } catch (e) { /* audit log failure shouldn't block the release */ }
      res.json({ success: true, reference, customer, orderNo, lines, serialCount: rows.filter((r) => r.serial_no).length });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }));

};