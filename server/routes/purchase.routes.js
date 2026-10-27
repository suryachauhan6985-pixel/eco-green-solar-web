const { validateGstin } = require('../utils/validators');

module.exports = function registerPurchaseRoutes(app, deps) {
  const {
    pool,
    route,
    requireRole,
    getOrCreateItem,
    itemNameSlug,
    ledgerTimestamp,
    masterCache,
    invalidateStockCaches,
    syncStockSummary
  } = deps;

  // Brands registered under one category (Cached)
  app.get('/api/purchase/brands/:category', route(async (req, res) => {
    const { category } = req.params;
    const cacheKey = `purchase:brands:${String(category).toLowerCase()}`;
    const brands = await masterCache.wrap(cacheKey, async () => {
      const [rows] = await pool.query(
        `SELECT DISTINCT brand_name FROM items WHERE category = ? AND brand_name IS NOT NULL AND brand_name <> '' ORDER BY brand_name ASC`,
        [category]
      );
      return rows.map(r => r.brand_name);
    }, 300000);
    res.json(brands);
  }));

  // Wattages registered for one category+brand combo (Cached)
  app.get('/api/purchase/wattages', route(async (req, res) => {
    const { category, brand } = req.query;
    if (!category || !brand) return res.json([]);
    const cacheKey = `purchase:wattages:${String(category).toLowerCase()}:${String(brand).toLowerCase()}`;
    const wattages = await masterCache.wrap(cacheKey, async () => {
      const [rows] = await pool.query(
        `SELECT DISTINCT watt FROM items WHERE category = ? AND brand_name = ? AND watt IS NOT NULL AND watt > 0 ORDER BY watt ASC`,
        [category, brand]
      );
      return rows.map(r => r.watt);
    }, 300000);
    res.json(wattages);
  }));

  // Models registered for one category+brand combo (Cached)
  app.get('/api/purchase/models', route(async (req, res) => {
    const { category, brand } = req.query;
    if (!category || !brand) return res.json([]);
    const cacheKey = `purchase:models:${String(category).toLowerCase()}:${String(brand).toLowerCase()}`;
    const models = await masterCache.wrap(cacheKey, async () => {
      const [rows] = await pool.query(
        `SELECT DISTINCT model FROM items WHERE category = ? AND brand_name = ? AND model IS NOT NULL AND model <> '' ORDER BY model ASC`,
        [category, brand]
      );
      return rows.map(r => r.model);
    }, 300000);
    res.json(models);
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
    const supplierGstin = String(req.body.supplierGstin || '').trim();
    const date = String(req.body.date || '').trim();
    const pallet = String(req.body.pallet || '').trim() || '-';
    const proofName = String(req.body.proofName || '').trim() || '-';
    const lines = Array.isArray(req.body.lines) ? req.body.lines : [];

    if (!supplier || !invoiceNo) {
      return res.status(400).json({ error: 'Supplier and Invoice are required.' });
    }
    if (supplierGstin && supplierGstin !== '-') {
      const gstCheck = validateGstin(supplierGstin);
      if (!gstCheck.isValid) {
        return res.status(400).json({ error: 'Invalid GSTIN' });
      }
    }
    if (!lines.length) {
      return res.status(400).json({ error: 'Add at least one Invoice Product Line before saving.' });
    }

    // Every line is EITHER serial-tracked (line.serials has entries — for
    // serial-mandatory categories like Panel/Inverter) OR quantity-tracked
    // (line.serials empty, line.qty > 0 — every other category). At least
    // one line must actually carry something to save.
    const allSerials = lines.flatMap((l) => l.serials || []);
    const hasQuantityLine = lines.some((l) => (!l.serials || !l.serials.length) && Number(l.qty) > 0);
    if (!allSerials.length && !hasQuantityLine) {
      return res.status(400).json({ error: 'Each product line needs either Serial Numbers or a Quantity.' });
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
      if (allSerials.length > 0) {
        const [existingRows] = await conn.query(`SELECT serial_no FROM stock_ledger WHERE serial_no IN (?)`, [allSerials]);
        if (existingRows.length) {
          await conn.rollback();
          return res.status(400).json({
            error: `Inward Blocked! The following Serial Numbers already exist in the database: ${existingRows.map((r) => r.serial_no).join(', ')}`,
          });
        }
      }

      for (const line of lines) {
        const cat = String(line.cat || 'Other').trim() || 'Other';
        const brand = String(line.brand || line.name || cat || 'General').trim() || 'General';
        const watt = Number(line.watt) || 0;
        const type = String(line.type || 'Others').trim() || 'Others';
        const model = String(line.model || '').trim();
        const wh = String(line.warehouse || 'Warehouse 1').trim() || 'Warehouse 1';
        const uom = String(line.uom || '').trim();
        const itemId = await getOrCreateItem(conn, cat, brand, watt, type, model, uom);
        const itemName = itemNameSlug(brand, watt, type, model);
        const serials = Array.isArray(line.serials) ? line.serials.map((s) => String(s || '').trim()).filter(Boolean) : [];
        const linePallet = String(line.pallet || pallet || '-').trim() || '-';

        if (serials.length) {
          // Serial-tracked category (e.g. Panel/Inverter) — unchanged:
          // one row per serial, quantity is implicitly 1 per row.
          for (const sn of serials) {
            await conn.query(
              `INSERT INTO stock_ledger (item_id, item_name, category, brand_name, watt, solar_type, model, serial_no, quantity, pallet_no, warehouse, status, supplier_name, purchase_invoice, purchase_date, purchase_attachment)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 'Available', ?, ?, ?, ?)`,
              [itemId, itemName, cat, brand, watt, type, model, sn, linePallet, wh, supplier, invoiceNo, date, proofName]
            );
          }
        } else {
          // Quantity-tracked category (everything else) — ONE row, no
          // serial number, the whole quantity stored in `quantity`.
          const qty = Number(line.qty) || 0;
          if (qty > 0) {
            await conn.query(
              `INSERT INTO stock_ledger (item_id, item_name, category, brand_name, watt, solar_type, model, serial_no, quantity, pallet_no, warehouse, status, supplier_name, purchase_invoice, purchase_date, purchase_attachment)
               VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'Available', ?, ?, ?, ?)`,
              [itemId, itemName, cat, brand, watt, type, model, qty, linePallet, wh, supplier, invoiceNo, date, proofName]
            );
          }
        }
      }

      await conn.commit();
      if (typeof syncStockSummary === 'function') syncStockSummary(pool).catch(() => {});
      if (typeof invalidateStockCaches === 'function') invalidateStockCaches();
      if (typeof deps.logAuditEvent === 'function') {
        deps.logAuditEvent(pool, {
          type: 'PURCHASE_INWARD',
          ref: invoiceNo,
          user: (req.user && req.user.username) || 'User',
          oldVal: null,
          newVal: `Supplier: ${supplier} | Lines: ${lines.length} | Serials: ${allSerials.length}`
        });
      }
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

    let sql = `SELECT sl.id, sl.category, sl.brand_name, sl.watt, sl.solar_type, sl.model, sl.supplier_name, sl.purchase_invoice, sl.pallet_no, sl.warehouse, sl.purchase_date, sl.serial_no, sl.purchase_attachment, sl.quantity, COALESCE(it.uom, 'Nos') AS uom
               FROM stock_ledger sl LEFT JOIN items it ON sl.item_id = it.id WHERE sl.purchase_invoice = ? OR sl.supplier_name LIKE ?`;
    const params = [term, `%${term}%`];
    if (resolvedName) { sql += ` OR sl.supplier_name = ?`; params.push(resolvedName); }
    sql += ` ORDER BY STR_TO_DATE(sl.purchase_date, '%d-%m-%Y') DESC, sl.category, sl.brand_name, sl.watt, sl.solar_type, sl.id`;

    const [allMatches] = await pool.query(sql, params);
    if (!allMatches.length) {
      return res.status(404).json({ error: 'No purchase invoice records found matching Invoice No / Supplier Name / Short Name.' });
    }

    // Name/short-name search can span multiple invoices — load the most
    // recent matching invoice only, same as the desktop app.
    const targetInv = allMatches[0].purchase_invoice;
    const records = allMatches.filter((r) => r.purchase_invoice === targetInv);
    const head = records[0];

    // Each row is EITHER serial-tracked (serial_no set, quantity implicitly 1)
    // OR quantity-tracked (serial_no NULL, real count lives in `quantity`).
    // Group into the same "line" the way the Create form does, but keep the
    // two kinds separate inside a line: `serials` for the serial-tracked
    // rows, `qtyRows` (with each row's real db id) for the quantity-tracked
    // ones — the ids are what PUT below needs to know which exact rows to
    // update/delete instead of re-inserting everything from scratch.
    const grouped = new Map();
    records.forEach((r) => {
      const key = [r.category, r.brand_name, r.watt || 0, r.solar_type, r.model || '', r.pallet_no || '', r.warehouse || ''].join('|');
      if (!grouped.has(key)) {
        grouped.set(key, {
          cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type, model: r.model || '',
          pallet: r.pallet_no || '', warehouse: r.warehouse || '', uom: r.uom || 'Nos', serials: [], qtyRows: [],
        });
      }
      const g = grouped.get(key);
      if (r.serial_no) {
        g.serials.push(r.serial_no);
      } else {
        g.qtyRows.push({ id: r.id, qty: Number(r.quantity) || 0 });
      }
    });

    res.json({
      invoiceNo: targetInv,
      supplier: head.supplier_name,
      pallet: head.pallet_no,
      date: head.purchase_date,
      proofName: head.purchase_attachment,
      // Only real serial numbers now (quantity-tracked rows carry NULL and
      // must not pollute the serial-diffing logic in PUT).
      allSerials: records.filter((r) => r.serial_no).map((r) => r.serial_no),
      // Flat list of every quantity-tracked row's db id belonging to this
      // invoice today — PUT uses this to know what got removed during edit.
      originalQtyRowIds: records.filter((r) => !r.serial_no).map((r) => r.id),
      lines: Array.from(grouped.values()).map((l) => ({
        cat: l.cat, brand: l.brand, watt: l.watt, type: l.type, model: l.model, pallet: l.pallet, warehouse: l.warehouse,
        uom: l.uom || 'Nos',
        serials: l.serials,
        qtyRowIds: l.qtyRows.map((r) => r.id),
        qty: l.serials.length ? l.serials.length : l.qtyRows.reduce((sum, r) => sum + r.qty, 0),
      })),
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
    // Db ids of every quantity-tracked (serial_no NULL) row this invoice had
    // BEFORE the edit — comes straight from GET /find's originalQtyRowIds.
    const originalQtyRowIds = Array.isArray(req.body.originalQtyRowIds) ? req.body.originalQtyRowIds.map(Number) : [];

    const newSerials = lines.flatMap((l) => l.serials || []);
    // A line counts as valid if it has serials (Panel/Inverter) OR a qty > 0
    // (every other category) — mirrors the same either/or check in POST.
    const hasQuantityLine = lines.some((l) => (!l.serials || !l.serials.length) && Number(l.qty) > 0);
    if (!newSupp || !newInv || (!newSerials.length && !hasQuantityLine)) {
      return res.status(400).json({ error: 'Supplier, Invoice No, and at least one Serial Number or Quantity are required for modification.' });
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

      // Same rule for quantity-tracked rows: if any of them has already been
      // (partially) sold, block the whole edit rather than silently losing
      // sold stock history.
      if (originalQtyRowIds.length) {
        const [soldQtyRows] = await conn.query(
          `SELECT id FROM stock_ledger WHERE id IN (?) AND status='Sold'`,
          [originalQtyRowIds]
        );
        if (soldQtyRows.length) {
          await conn.rollback();
          return res.status(400).json({
            error: `Modification Restricted! Some quantity-tracked item(s) on this purchase invoice have already been sold out and cannot be modified.`,
          });
        }
      }

      const [metaRows] = await conn.query(
        `SELECT purchase_attachment FROM stock_ledger WHERE purchase_invoice=? LIMIT 1`,
        [originalInvoiceNo]
      );
      const existingAttachment = metaRows.length ? metaRows[0].purchase_attachment : '-';
      const finalProof = proofName || existingAttachment;

      // Db ids of quantity-tracked rows that survive this edit (either
      // updated in place, or newly inserted has no "original" id to track).
      // Anything in originalQtyRowIds NOT in this list at the end got
      // removed during the edit and must be deleted.
      const survivingQtyRowIds = [];

      for (const line of lines) {
        const cat = String(line.cat || 'Other').trim() || 'Other';
        const brand = String(line.brand || line.name || cat || 'General').trim() || 'General';
        const watt = Number(line.watt) || 0;
        const type = String(line.type || 'Others').trim() || 'Others';
        const model = String(line.model || '').trim();
        const wh = String(line.warehouse || 'Warehouse 1').trim() || 'Warehouse 1';
        const uom = String(line.uom || '').trim();
        const itemId = await getOrCreateItem(conn, cat, brand, watt, type, model, uom);
        const itemName = itemNameSlug(brand, watt, type, model);
        const serials = Array.isArray(line.serials) ? line.serials.map((s) => String(s || '').trim()).filter(Boolean) : [];
        const linePallet = String(line.pallet || pallet || '-').trim() || '-';

        if (serials.length) {
          // Serial-tracked line (e.g. Panel/Inverter) — unchanged.
          for (const sn of serials) {
            if (originalSerials.includes(sn)) {
              await conn.query(
                `UPDATE stock_ledger SET item_id=?, item_name=?, category=?, brand_name=?, watt=?, solar_type=?, model=?,
                 pallet_no=?, warehouse=?, supplier_name=?, purchase_invoice=?, purchase_date=?, purchase_attachment=?, edited_flag=1
                 WHERE serial_no=?`,
                [itemId, itemName, cat, brand, watt, type, model, linePallet, wh, newSupp, newInv, newDate, finalProof, sn]
              );
            } else {
              await conn.query(
                `INSERT INTO stock_ledger (item_id, item_name, category, brand_name, watt, solar_type, model, serial_no, pallet_no, warehouse, status, supplier_name, purchase_invoice, purchase_date, purchase_attachment, edited_flag)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', ?, ?, ?, ?, 1)`,
                [itemId, itemName, cat, brand, watt, type, model, sn, linePallet, wh, newSupp, newInv, newDate, finalProof]
              );
            }
          }
        } else {
          // Quantity-tracked line (every other category) — no serials at all.
          const qty = Number(line.qty) || 0;
          if (qty > 0) {
            const qtyRowIds = Array.isArray(line.qtyRowIds) ? line.qtyRowIds.map(Number) : [];
            if (qtyRowIds.length) {
              // This line already existed — update the first backing row in
              // place with the new total qty + any field changes. If the
              // line originally spanned more than one db row (e.g. leftover
              // from an earlier partial state), the extras are simply left
              // out of survivingQtyRowIds below and get cleaned up by the
              // same "removed" pass as everything else — consolidating them
              // into this one row.
              const primaryId = qtyRowIds[0];
              await conn.query(
                `UPDATE stock_ledger SET item_id=?, item_name=?, category=?, brand_name=?, watt=?, solar_type=?, model=?,
                 pallet_no=?, warehouse=?, supplier_name=?, purchase_invoice=?, purchase_date=?, purchase_attachment=?, quantity=?, edited_flag=1
                 WHERE id=?`,
                [itemId, itemName, cat, brand, watt, type, model, linePallet, wh, newSupp, newInv, newDate, finalProof, qty, primaryId]
              );
              survivingQtyRowIds.push(primaryId);
            } else {
              // Brand-new quantity line added during this edit.
              await conn.query(
                `INSERT INTO stock_ledger (item_id, item_name, category, brand_name, watt, solar_type, model, serial_no, quantity, pallet_no, warehouse, status, supplier_name, purchase_invoice, purchase_date, purchase_attachment, edited_flag)
                 VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'Available', ?, ?, ?, ?, 1)`,
                [itemId, itemName, cat, brand, watt, type, model, qty, linePallet, wh, newSupp, newInv, newDate, finalProof]
              );
            }
          }
        }
      }

      // Any original serial no longer present in the edited lines is removed.
      const removed = originalSerials.filter((sn) => !newSerials.includes(sn));
      if (removed.length) {
        await conn.query(`DELETE FROM stock_ledger WHERE serial_no IN (?)`, [removed]);
      }

      // Any original quantity-tracked row not carried forward (line deleted,
      // or its extra/duplicate rows consolidated above) is removed too.
      const removedQtyRowIds = originalQtyRowIds.filter((id) => !survivingQtyRowIds.includes(id));
      if (removedQtyRowIds.length) {
        await conn.query(`DELETE FROM stock_ledger WHERE id IN (?)`, [removedQtyRowIds]);
      }

      await conn.commit();
      if (typeof syncStockSummary === 'function') syncStockSummary(pool).catch(() => {});
      if (typeof invalidateStockCaches === 'function') invalidateStockCaches();
      if (typeof deps.logAuditEvent === 'function') {
        deps.logAuditEvent(pool, {
          type: 'PURCHASE_UPDATE',
          ref: newInv,
          user: (req.user && req.user.username) || 'User',
          oldVal: `Original Inv: ${originalInvoiceNo} | Serials: ${originalSerials.length}`,
          newVal: `New Inv: ${newInv} | Supplier: ${newSupp} | Serials: ${newSerials.length}`
        });
      }
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
    const rawInvoice = decodeURIComponent(req.params.invoiceNo || '').trim();
    if (!rawInvoice || rawInvoice === '-') {
      return res.status(400).json({ error: 'Valid Purchase Invoice reference is required.' });
    }

    const candidates = new Set([rawInvoice]);
    const cleanNum = rawInvoice.replace(/^[a-zA-Z\-_/]+/i, '');
    if (cleanNum && cleanNum !== rawInvoice) {
      candidates.add(cleanNum);
      candidates.add(`R-${cleanNum}`);
      candidates.add(`R${cleanNum}`);
    }
    const candList = [...candidates];

    const [rows] = await pool.query(
      `SELECT serial_no, status FROM stock_ledger WHERE purchase_invoice IN (?)`,
      [candList]
    );

    if (rows.length) {
      const soldSerials = rows.filter((r) => r.status === 'Sold' || r.status === 'Dispatched').map((r) => r.serial_no).filter(Boolean);
      if (soldSerials.length) {
        return res.status(400).json({
          error: `This purchase invoice cannot be deleted because the following Serial Number(s) have already been sold out: ${soldSerials.join(', ')}. Please first remove/reverse that sale from the Sales Order panel (or process a Sales Return), then delete this purchase invoice again.`,
        });
      }

      await pool.query(`DELETE FROM stock_ledger WHERE purchase_invoice IN (?)`, [candList]);
    }

    if (typeof syncStockSummary === 'function') syncStockSummary(pool).catch(() => {});
    if (typeof invalidateStockCaches === 'function') invalidateStockCaches();
    if (typeof deps.invalidateLedgerCaches === 'function') deps.invalidateLedgerCaches();
    if (deps.reportCache && typeof deps.reportCache.flush === 'function') deps.reportCache.flush();

    try {
      await pool.query(
        `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('PURCHASE_DELETE', ?, 'User', ?, ?, ?)`,
        [rawInvoice, ledgerTimestamp(), `Invoice:${rawInvoice}`, `Invoice permanently deleted | Serials: ${rows.map((r) => r.serial_no).filter(Boolean).join(', ') || 'none'}`]
      );
    } catch (e) { /* audit log is best-effort, never block the delete on it */ }

    res.json({
      success: true,
      deletedCount: rows.length,
      message: `Purchase invoice #${rawInvoice} successfully deleted.`
    });
  }));

  // GET /api/purchase/register — mirrors ui/registers.py's PurchaseRegisterPage
  // load_data(): one row per (invoice, date, supplier, category, brand,
  // warehouse) group, with the first serial + total qty + whether any row in
  // the group was ever edited.
  app.get('/api/purchase/register', route(async (req, res) => {
    const category = req.query.category;
    const cacheKey = `purchase:register:${category || 'all'}`;

    const rows = await deps.reportCache.wrap(cacheKey, async () => {
      let sql = `SELECT sl.purchase_invoice, sl.purchase_date, sl.supplier_name, sl.category, sl.brand_name, sl.warehouse,
                        MIN(sl.serial_no) AS first_serial, SUM(sl.quantity) AS qty, MAX(sl.edited_flag) AS edited,
                        COALESCE(it.uom, 'Nos') AS uom
                 FROM stock_ledger sl
                 LEFT JOIN items it ON sl.item_id = it.id
                 WHERE sl.purchase_invoice IS NOT NULL AND sl.purchase_invoice != '-'`;
      const params = [];
      if (category && category !== 'All Categories') {
        sql += ` AND sl.category = ?`;
        params.push(category);
      }
      sql += ` GROUP BY sl.purchase_invoice, sl.purchase_date, sl.supplier_name, sl.category, sl.brand_name, sl.warehouse, it.uom
               ORDER BY STR_TO_DATE(sl.purchase_date, '%d-%m-%Y') DESC, sl.purchase_invoice DESC`;

      const [data] = await pool.query(sql, params);
      return data.map((r) => ({
        invoiceNo: r.purchase_invoice,
        date: r.purchase_date,
        supplier: r.supplier_name,
        category: r.category,
        brand: r.brand_name,
        warehouse: r.warehouse,
        firstSerial: r.first_serial,
        qty: r.qty,
        uom: r.uom || 'Nos',
        edited: !!r.edited,
      }));
    }, 45000);

    res.json(rows);
  }));

};