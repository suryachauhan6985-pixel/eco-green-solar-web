module.exports = function registerPurchaseRoutes(app, deps) {
  const { pool, route, requireRole, getOrCreateItem, itemNameSlug, ledgerTimestamp } = deps;
  // ---------------------------------------------------------------------------
  // PURCHASE INWARD — cascading dropdown fetch (Category -> Brand -> Wattage),
  // same logic as the desktop app's db.py: get_brands_for_category() and
  // get_wattages_for_brand_category(). Both read straight from the `items`
  // table (unlike the global /api/masters/brands above, these are filtered).
  // ---------------------------------------------------------------------------

  // Brands registered under one category (used when Category dropdown changes)
  app.get('/api/purchase/brands/:category', route(async (req, res) => {
    const { category } = req.params;
    const [rows] = await pool.query(
      `SELECT DISTINCT brand_name FROM items WHERE category = ? AND brand_name IS NOT NULL AND brand_name <> '' ORDER BY brand_name ASC`,
      [category]
    );
    res.json(rows.map(r => r.brand_name));
  }));

  // Wattages registered for one category+brand combo (used when Brand dropdown changes)
  app.get('/api/purchase/wattages', route(async (req, res) => {
    const { category, brand } = req.query;
    if (!category || !brand) return res.json([]);
    const [rows] = await pool.query(
      `SELECT DISTINCT watt FROM items WHERE category = ? AND brand_name = ? AND watt IS NOT NULL AND watt > 0 ORDER BY watt ASC`,
      [category, brand]
    );
    res.json(rows.map(r => r.watt));
  }));

  // Which of the given serial numbers already exist in stock_ledger — mirrors
  // process_purchase_inward()'s per-serial "SELECT COUNT(*) FROM stock_ledger
  // WHERE serial_no=%s" duplicate check from the desktop app. Called by the
  // Purchase form right before saving, so an already-used serial blocks the
  // inward before it ever reaches the database.
  app.get('/api/purchase/check-serials', route(async (req, res) => {
    const serials = String(req.query.serials || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!serials.length) return res.json([]);
    const [rows] = await pool.query(
      `SELECT DISTINCT serial_no FROM stock_ledger WHERE serial_no IN (?)`,
      [serials]
    );
    res.json(rows.map(r => r.serial_no));
  }));

  // ---------------------------------------------------------------------------
  // PURCHASE INWARD — save / find-for-edit / apply-modifications / delete.
  // Previously the "Execute Stock Inward" and "Purchase Invoice Modification"
  // panels only wrote to an in-memory JS array (js/data/purchase-data.js) and
  // never touched the database at all. These four endpoints make Purchase
  // Inward behave exactly like ui/purchase.py: real INSERTs/UPDATEs/DELETEs
  // against stock_ledger, with the same validation rules and error messages.
  // ---------------------------------------------------------------------------

  // POST /api/purchase — mirrors process_purchase_inward(): one INSERT per
  // serial number, across every product line, inside a single transaction
  // (either the whole invoice saves, or none of it does).
  app.post('/api/purchase', route(async (req, res) => {
    const supplier = String(req.body.supplier || '').trim();
    const invoiceNo = String(req.body.invoiceNo || '').trim();
    const date = String(req.body.date || '').trim();
    const pallet = String(req.body.pallet || '').trim() || '-';
    const proofName = String(req.body.proofName || '').trim() || '-';
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];

    if (!supplier || !invoiceNo) {
      return res.status(400).json({ error: 'Supplier and Invoice are required.' });
    }
    if (!lines.length) {
      return res.status(400).json({ error: 'Add at least one Invoice Product Line before saving.' });
    }

    const allSerials = lines.flatMap((l) => l.serials || []);
    if (!allSerials.length) {
      return res.status(400).json({ error: 'Serial Numbers are required.' });
    }

    // Same-invoice duplicate check — mirrors "Same serial number is present
    // in multiple product lines."
    const seen = new Set(), innerDupes = new Set();
    allSerials.forEach((sn) => { if (seen.has(sn)) innerDupes.add(sn); seen.add(sn); });
    if (innerDupes.size) {
      return res.status(400).json({ error: `Same serial number is present in multiple product lines: ${[...innerDupes].join(', ')}` });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Already-in-database check — mirrors the per-serial "SELECT COUNT(*)
      // FROM stock_ledger WHERE serial_no=%s" loop.
      const [existingRows] = await conn.query(`SELECT serial_no FROM stock_ledger WHERE serial_no IN (?)`, [allSerials]);
      if (existingRows.length) {
        await conn.rollback();
        return res.status(400).json({
          error: `Inward Blocked! The following Serial Numbers already exist in the database: ${existingRows.map((r) => r.serial_no).join(', ')}`,
        });
      }

      for (const line of lines) {
        const itemId = await getOrCreateItem(conn, line.cat, line.brand, line.watt, line.type);
        const itemName = itemNameSlug(line.brand, line.watt, line.type);
        for (const sn of (line.serials || [])) {
          await conn.query(
            `INSERT INTO stock_ledger (item_id, item_name, category, brand_name, watt, solar_type, serial_no, pallet_no, warehouse, status, supplier_name, purchase_invoice, purchase_date, purchase_attachment)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', ?, ?, ?, ?)`,
            [itemId, itemName, line.cat, line.brand, Number(line.watt) || 0, line.type || 'Others', sn, line.pallet || pallet, line.warehouse, supplier, invoiceNo, date, proofName]
          );
        }
      }

      await conn.commit();
      res.json({ success: true, invoiceNo, lineCount: lines.length, serialCount: allSerials.length });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }));

  // GET /api/purchase/find?term=... — mirrors find_purchase_invoice_for_editing():
  // search by exact Invoice No, OR supplier name containing the term, OR the
  // supplier's short code resolved through the ledgers table. Returns the most
  // recent matching invoice, grouped back into product lines + all its serials.
  app.get('/api/purchase/find', route(async (req, res) => {
    const term = String(req.query.term || '').trim();
    if (!term) return res.status(400).json({ error: 'Type an Invoice No, Supplier Name, or Short Name to search first.' });

    const [shortMatch] = await pool.query(
      `SELECT ledger_name FROM ledgers WHERE short_name = ? AND (ledger_type = 'Supplier' OR ledger_type = 'Both') LIMIT 1`,
      [term]
    );
    const resolvedName = shortMatch.length ? shortMatch[0].ledger_name : null;

    let sql = `SELECT category, brand_name, watt, solar_type, supplier_name, purchase_invoice, pallet_no, warehouse, purchase_date, serial_no, purchase_attachment
               FROM stock_ledger WHERE purchase_invoice = ? OR supplier_name LIKE ?`;
    const params = [term, `%${term}%`];
    if (resolvedName) { sql += ` OR supplier_name = ?`; params.push(resolvedName); }
    sql += ` ORDER BY STR_TO_DATE(purchase_date, '%d-%m-%Y') DESC, category, brand_name, watt, solar_type, id`;

    const [allMatches] = await pool.query(sql, params);
    if (!allMatches.length) {
      return res.status(404).json({ error: 'No purchase invoice records found matching Invoice No / Supplier Name / Short Name.' });
    }

    // Name/short-name search can span multiple invoices — load the most
    // recent matching invoice only, same as the desktop app.
    const targetInv = allMatches[0].purchase_invoice;
    const records = allMatches.filter((r) => r.purchase_invoice === targetInv);
    const head = records[0];

    const grouped = new Map();
    records.forEach((r) => {
      const key = [r.category, r.brand_name, r.watt || 0, r.solar_type, r.pallet_no || '', r.warehouse || ''].join('|');
      if (!grouped.has(key)) {
        grouped.set(key, {
          cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type,
          pallet: r.pallet_no || '', warehouse: r.warehouse || '', serials: [],
        });
      }
      grouped.get(key).serials.push(r.serial_no);
    });

    res.json({
      invoiceNo: targetInv,
      supplier: head.supplier_name,
      pallet: head.pallet_no,
      date: head.purchase_date,
      proofName: head.purchase_attachment,
      allSerials: records.map((r) => r.serial_no),
      lines: Array.from(grouped.values()).map((l) => ({ ...l, qty: l.serials.length })),
    });
  }));

  // PUT /api/purchase/:invoiceNo — mirrors process_purchase_modification():
  // UPDATE every serial that already belonged to this invoice, INSERT any
  // brand-new serial added during the edit, and DELETE any serial that was
  // removed. Blocked if a new serial already exists elsewhere, or if any
  // original serial has already been sold.
  app.put('/api/purchase/:invoiceNo', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const originalInvoiceNo = req.params.invoiceNo;
    const newSupp = String(req.body.supplier || '').trim();
    const newInv = String(req.body.invoiceNo || '').trim();
    const newDate = String(req.body.date || '').trim();
    const pallet = String(req.body.pallet || '').trim() || '-';
    const proofName = req.body.proofName ? String(req.body.proofName).trim() : null;
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
    const originalSerials = Array.isArray(req.body.originalSerials) ? req.body.originalSerials : [];

    const newSerials = lines.flatMap((l) => l.serials || []);
    if (!newSupp || !newInv || !newSerials.length) {
      return res.status(400).json({ error: 'Supplier, Invoice No, and Serials are required for modification.' });
    }

    const seen = new Set(), innerDupes = new Set();
    newSerials.forEach((sn) => { if (seen.has(sn)) innerDupes.add(sn); seen.add(sn); });
    if (innerDupes.size) {
      return res.status(400).json({ error: `Same serial number is present in multiple product lines: ${[...innerDupes].join(', ')}` });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Any genuinely NEW serial (not part of this invoice before) must not
      // already exist anywhere else in stock_ledger.
      const trulyNew = newSerials.filter((sn) => !originalSerials.includes(sn));
      if (trulyNew.length) {
        const [dupRows] = await conn.query(`SELECT serial_no FROM stock_ledger WHERE serial_no IN (?)`, [trulyNew]);
        if (dupRows.length) {
          await conn.rollback();
          return res.status(400).json({ error: `These Serial Numbers already exist: ${dupRows.map((r) => r.serial_no).join(', ')}` });
        }
      }

      // None of the ORIGINAL serials may already be sold.
      if (originalSerials.length) {
        const [soldRows] = await conn.query(
          `SELECT serial_no FROM stock_ledger WHERE serial_no IN (?) AND status='Sold'`,
          [originalSerials]
        );
        if (soldRows.length) {
          await conn.rollback();
          return res.status(400).json({
            error: `Modification Restricted! Some Serial Numbers belonging to this purchase invoice have already been sold out: ${soldRows.map((r) => r.serial_no).join(', ')}`,
          });
        }
      }

      const [metaRows] = await conn.query(
        `SELECT purchase_attachment FROM stock_ledger WHERE purchase_invoice=? LIMIT 1`,
        [originalInvoiceNo]
      );
      const existingAttachment = metaRows.length ? metaRows[0].purchase_attachment : '-';
      const finalProof = proofName || existingAttachment;

      for (const line of lines) {
        if (!line.cat || !line.brand) {
          await conn.rollback();
          return res.status(400).json({ error: 'One product line has no valid item master.' });
        }
        const itemId = await getOrCreateItem(conn, line.cat, line.brand, line.watt, line.type);
        const itemName = itemNameSlug(line.brand, line.watt, line.type);
        for (const sn of (line.serials || [])) {
          if (originalSerials.includes(sn)) {
            await conn.query(
              `UPDATE stock_ledger SET item_id=?, item_name=?, category=?, brand_name=?, watt=?, solar_type=?,
               pallet_no=?, warehouse=?, supplier_name=?, purchase_invoice=?, purchase_date=?, purchase_attachment=?, edited_flag=1
               WHERE serial_no=?`,
              [itemId, itemName, line.cat, line.brand, Number(line.watt) || 0, line.type || 'Others', line.pallet || pallet, line.warehouse, newSupp, newInv, newDate, finalProof, sn]
            );
          } else {
            await conn.query(
              `INSERT INTO stock_ledger (item_id, item_name, category, brand_name, watt, solar_type, serial_no, pallet_no, warehouse, status, supplier_name, purchase_invoice, purchase_date, purchase_attachment, edited_flag)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', ?, ?, ?, ?, 1)`,
              [itemId, itemName, line.cat, line.brand, Number(line.watt) || 0, line.type || 'Others', sn, line.pallet || pallet, line.warehouse, newSupp, newInv, newDate, finalProof]
            );
          }
        }
      }

      // Any original serial no longer present in the edited lines is removed.
      const removed = originalSerials.filter((sn) => !newSerials.includes(sn));
      if (removed.length) {
        await conn.query(`DELETE FROM stock_ledger WHERE serial_no IN (?)`, [removed]);
      }

      await conn.commit();
      res.json({ success: true, invoiceNo: newInv });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }));

  // DELETE /api/purchase/:invoiceNo — mirrors delete_purchase_invoice():
  // permanently removes every stock_ledger row for this invoice, but blocked
  // entirely if any of its serials have already been sold.
  app.delete('/api/purchase/:invoiceNo', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const { invoiceNo } = req.params;
    const [rows] = await pool.query(`SELECT serial_no, status FROM stock_ledger WHERE purchase_invoice=?`, [invoiceNo]);
    if (!rows.length) {
      return res.status(404).json({ error: 'No records found for this purchase invoice.' });
    }
    const soldSerials = rows.filter((r) => r.status === 'Sold').map((r) => r.serial_no);
    if (soldSerials.length) {
      return res.status(400).json({
        error: `This purchase invoice cannot be deleted because the following Serial Number(s) have already been sold out: ${soldSerials.join(', ')}. Please first remove/reverse that sale from the Sales Order Modification panel (or process a Sales Return), then delete this purchase invoice again.`,
      });
    }

    await pool.query(`DELETE FROM stock_ledger WHERE purchase_invoice=?`, [invoiceNo]);
    try {
      await pool.query(
        `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('PURCHASE_DELETE', ?, 'User', ?, ?, ?)`,
        [invoiceNo, ledgerTimestamp(), `Invoice:${invoiceNo}`, `Invoice permanently deleted | Serials: ${rows.map((r) => r.serial_no).join(', ')}`]
      );
    } catch (e) { /* audit log is best-effort, never block the delete on it */ }

    res.json({ success: true });
  }));

  // GET /api/purchase/register — mirrors ui/registers.py's PurchaseRegisterPage
  // load_data(): one row per (invoice, date, supplier, category, brand,
  // warehouse) group, with the first serial + total qty + whether any row in
  // the group was ever edited.
  app.get('/api/purchase/register', route(async (req, res) => {
    const category = req.query.category;
    let sql = `SELECT purchase_invoice, purchase_date, supplier_name, category, brand_name, warehouse,
                      MIN(serial_no) AS first_serial, COUNT(*) AS qty, MAX(edited_flag) AS edited
               FROM stock_ledger WHERE purchase_invoice IS NOT NULL AND purchase_invoice != '-'`;
    const params = [];
    if (category && category !== 'All Categories') { sql += ` AND category = ?`; params.push(category); }
    sql += ` GROUP BY purchase_invoice, purchase_date, supplier_name, category, brand_name, warehouse
             ORDER BY STR_TO_DATE(purchase_date, '%d-%m-%Y') DESC, purchase_invoice DESC`;

    const [rows] = await pool.query(sql, params);
    res.json(rows.map((r) => ({
      invoiceNo: r.purchase_invoice,
      date: r.purchase_date,
      supplier: r.supplier_name,
      category: r.category,
      brand: r.brand_name,
      warehouse: r.warehouse,
      firstSerial: r.first_serial,
      qty: r.qty,
      edited: !!r.edited,
    })));
  }));

};
