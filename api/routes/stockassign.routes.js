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
  // ---------------------------------------------------------------------------

  // GET /api/stockassign/available?category=&brand=&watt=&type= — mirrors
  // refresh_available_qty_hint(): live "Available: N" counter shown next to
  // the Quantity field as the user picks Category/Brand/Wattage/Type.
  app.get('/api/stockassign/available', route(async (req, res) => {
    const { category, brand, type } = req.query;
    const watt = Number(req.query.watt) || 0;
    if (!category || !brand || !type) return res.json({ itemId: null, available: 0 });
    const itemId = await getItemId(pool, category, brand, watt, type);
    if (!itemId) return res.json({ itemId: null, available: 0 });
    const [[{ cnt }]] = await pool.query(`SELECT COUNT(*) AS cnt FROM stock_ledger WHERE status='Available' AND item_id=?`, [itemId]);
    res.json({ itemId, available: cnt });
  }));

  // POST /api/stockassign — mirrors process_stock_assignment(): reference
  // conflict check, then for every line re-checks availability and
  // auto-picks the actual serials (oldest first) right before committing,
  // marking them 'Assigned' in a single transaction.
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

      // Re-check availability + auto-pick serials (oldest first, row-locked
      // so two simultaneous reservations can't grab the same serial).
      const lineSerialMap = [];
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
        const [picked] = await conn.query(
          `SELECT serial_no FROM stock_ledger WHERE status='Available' AND item_id=? ORDER BY id ASC LIMIT ? FOR UPDATE`,
          [itemId, Number(line.qty)]
        );
        const serials = picked.map((r) => r.serial_no);
        if (serials.length < Number(line.qty)) {
          availabilityErrors.push(`${line.brand} | ${wattLbl} | ${line.type}: only ${serials.length} unit(s) Available right now (requested ${line.qty}).`);
        } else {
          lineSerialMap.push({ line, serials });
        }
      }
      if (availabilityErrors.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'ASSIGNMENT BLOCKED:\n\n' + availabilityErrors.join('\n') });
      }

      const allSerials = lineSerialMap.flatMap((x) => x.serials);
      const failedSerials = [];
      for (const { serials } of lineSerialMap) {
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

      await conn.commit();
      try {
        const nowStr = new Date().toLocaleString('en-GB').replace(',', '');
        await pool.query(
          `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('STOCK_ASSIGN', ?, 'User', ?, ?, ?)`,
          [reference, nowStr, `Status: Available | Serials: ${allSerials.length}`, `Assigned To: ${person} | Ref: ${reference} | Remarks: ${remarks} | Serials: ${allSerials.join(', ')}`]
        );
      } catch (e) { /* audit log failure shouldn't block the assignment */ }

      res.json({ success: true, reference, person, lineCount: lineSerialMap.length, serialCount: allSerials.length });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }));

  // GET /api/stockassign/register?q=... — mirrors load_assigned_register():
  // every currently-'Assigned' serial, grouped back into one row per
  // reference/person/date/brand/watt/type. Optional ?q= filters server-side
  // too (in addition to the page's own client-side search-as-you-type).
  app.get('/api/stockassign/register', route(async (req, res) => {
    const [rows] = await pool.query(`
      SELECT assign_reference AS ref, assign_to AS person, assign_date AS date,
             brand_name AS brand, watt, solar_type AS type, COUNT(*) AS qty
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
  // every still-'Assigned' serial under this reference, grouped back into
  // product lines (with their exact serials) for the Release panel.
  app.get('/api/stockassign/lines/:reference', route(async (req, res) => {
    const reference = String(req.params.reference || '').trim();
    const [rows] = await pool.query(
      `SELECT serial_no, assign_to, brand_name, watt, solar_type, category, item_id
       FROM stock_ledger WHERE assign_reference=? AND status='Assigned'`,
      [reference]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'This assignment could not be found (it may have already been released).' });
    }
    const person = rows[0].assign_to;
    const grouped = new Map();
    for (const r of rows) {
      const key = `${r.category}|${r.brand_name}|${r.watt || 0}|${r.solar_type}|${r.item_id}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type,
          itemId: r.item_id, serials: [],
        });
      }
      grouped.get(key).serials.push(r.serial_no);
    }
    const lines = Array.from(grouped.values()).map((l) => ({ ...l, qty: l.serials.length }));
    res.json({ reference, person, lines, allSerials: rows.map((r) => r.serial_no) });
  }));

  // Shared release helper — mirrors the identical "set every serial back to
  // Available + clear assign_* fields" UPDATE loop used by both release_to_firm()
  // and release_to_customer() in the desktop app.
  async function releaseAssignedSerials(conn, reference) {
    const [rows] = await conn.query(
      `SELECT serial_no FROM stock_ledger WHERE assign_reference=? AND status='Assigned'`,
      [reference]
    );
    const serials = rows.map((r) => r.serial_no);
    if (!serials.length) return serials;
    await conn.query(
      `UPDATE stock_ledger SET status='Available', assign_to='-', assign_reference='-', assign_date='-', assign_remarks='-' WHERE serial_no IN (?)`,
      [serials]
    );
    return serials;
  }

  // POST /api/stockassign/release-firm — mirrors release_to_firm(): cancel
  // the assignment, return every serial to the free Available pool.
  app.post('/api/stockassign/release-firm', route(async (req, res) => {
    const reference = String(req.body.reference || '').trim();
    if (!reference) return res.status(400).json({ error: 'Reference No is required.' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const serials = await releaseAssignedSerials(conn, reference);
      if (!serials.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Nothing to release — this assignment may have already been released.' });
      }
      await conn.commit();
      try {
        const nowStr = new Date().toLocaleString('en-GB').replace(',', '');
        await pool.query(
          `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('STOCK_RELEASE_FIRM', ?, 'User', ?, ?, ?)`,
          [reference, nowStr, `Serials: ${serials.length}`, 'Released back to Available stock']
        );
      } catch (e) { /* audit log failure shouldn't block the release */ }
      res.json({ success: true, reference, serialCount: serials.length });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }));

  // POST /api/stockassign/release-customer — mirrors release_to_customer():
  // same "back to Available" release, then returns Customer/Order/lines so
  // the frontend can redirect to Project Sales pre-filled (Challan No is the
  // only thing left for the user to fill before a normal, fully-validated
  // dispatch).
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
        `SELECT serial_no, brand_name, watt, solar_type, category, item_id
         FROM stock_ledger WHERE assign_reference=? AND status='Assigned'`,
        [reference]
      );
      if (!rows.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Nothing to release — this assignment may have already been released.' });
      }
      const grouped = new Map();
      for (const r of rows) {
        const key = `${r.category}|${r.brand_name}|${r.watt || 0}|${r.solar_type}|${r.item_id}`;
        if (!grouped.has(key)) grouped.set(key, { cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type, itemId: r.item_id, serials: [] });
        grouped.get(key).serials.push(r.serial_no);
      }
      const lines = Array.from(grouped.values()).map((l) => ({ cat: l.cat, brand: l.brand, watt: l.watt, type: l.type, qty: l.serials.length }));

      await releaseAssignedSerials(conn, reference);
      await conn.commit();
      try {
        const nowStr = new Date().toLocaleString('en-GB').replace(',', '');
        await pool.query(
          `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('STOCK_RELEASE_CUSTOMER', ?, 'User', ?, ?, ?)`,
          [reference, nowStr, `Serials: ${rows.length}`, `Redirected to Sales for Customer: ${customer} | Order: ${orderNo}`]
        );
      } catch (e) { /* audit log failure shouldn't block the release */ }
      res.json({ success: true, reference, customer, orderNo, lines, serialCount: rows.length });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }));

};
