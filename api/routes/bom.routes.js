// api/routes/bom.routes.js
// -----------------------------------------------------------------------------
// BOM / Bulk Dispatch — Goal 4, Steps 1 & 2.
// -----------------------------------------------------------------------------
// bom.js's kit contents (BOM_KITS + saved custom templates) stay hardcoded/
// frontend-only for now — most items in a kit aren't registered as real
// Item Master rows yet, so we deliberately do NOT touch that. What WAS
// completely fake until Step 1 was the "Convert into Challan" click (zero
// contact with the database) and what was completely fake until Step 2 is
// the "Create Dispatch" click (a frontend-only stub that didn't touch
// stock at all). Confirmed flow with the user:
//   - "Convert into Challan" -> stock AVAILABILITY CHECK only (Step 1,
//     POST /api/bom/check-stock, read-only, unchanged below).
//   - "Create Dispatch" -> the actual stock DEDUCTION (Step 2,
//     POST /api/bom/dispatch, transactional, new below). Independent of
//     Challan — can be clicked whether or not a Challan was made first.
// -----------------------------------------------------------------------------
module.exports = function registerBomRoutes(app, deps) {
  const { pool, route, validateSalesLineSerials } = deps;

  // BUSINESS DECISION NOT YET MADE (flagged to user, deliberately deferred):
  // should a BOM dispatch mark stock_ledger rows 'Sold' (same as Sales —
  // would then also show up in Sale Register/Reports), or a dedicated
  // status kept separate from Sales reporting? Using a distinct status for
  // now (safer default — additive, doesn't change what Sale Register shows
  // until explicitly asked to merge). Every dispatched row is ALSO tagged
  // with bom_dispatch_id (see schema.js's ensureBomDispatchSchema), so
  // switching this one constant to 'Sold' later is a one-line change —
  // full traceability back to the dispatch event doesn't depend on which
  // status string is used.
  const BOM_DISPATCH_STATUS = 'Dispatched';

  // Item Master lookup by the exact `name` shown in the BOM's item dropdown
  // (that dropdown is fed by /api/masters/items, so names match 1:1).
  // COALESCE mirrors ensureItemOverrideSchema's effective-rule rule: an
  // item-level override wins, otherwise fall back to the Category default.
  // `runner` is `pool` for the read-only Step-1 check, or a transaction
  // `conn` for Step 2 so the SELECT participates in the same transaction.
  async function findItemByName(runner, name) {
    const [rows] = await runner.query(
      `SELECT i.id, i.category, i.brand_name, i.watt, i.solar_type, i.model,
              COALESCE(i.serial_mandatory, c.serial_mandatory, 0) AS serial_mandatory
       FROM items i
       LEFT JOIN categories c ON c.name = i.category
       WHERE i.name = ?
       LIMIT 1`,
      [name]
    );
    return rows[0] || null;
  }

  async function availableQtyForItem(runner, itemId, forUpdate) {
    const [[row]] = await runner.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total FROM stock_ledger WHERE status='Available' AND item_id=?${forUpdate ? ' FOR UPDATE' : ''}`,
      [itemId]
    );
    return Number(row.total) || 0;
  }

  // Shared validation used by BOTH endpoints below — Step 1's read-only
  // check and Step 2's inside-transaction re-check run the exact same
  // rules, so a BOM that passed Convert-into-Challan never fails
  // Create Dispatch for a different reason. `runner` decides whether rows
  // get FOR UPDATE-locked (Step 2, inside a transaction) or not (Step 1).
  async function checkItems(runner, items, forUpdate) {
    const results = [];
    for (const raw of items) {
      const name = (raw.name || '').trim();
      const required = Number(raw.qty) || 0;
      const serials = Array.isArray(raw.serials) ? raw.serials : [];

      if (!name) {
        results.push({ name: name || '(blank)', ok: false, reason: 'No item selected for this row.' });
        continue;
      }

      const item = await findItemByName(runner, name);
      if (!item) {
        results.push({
          name, ok: false,
          reason: `'${name}' is not registered in Masters > Item Registration yet — create it there first.`,
        });
        continue;
      }

      const isSerialMandatory = !!item.serial_mandatory;

      if (isSerialMandatory) {
        if (!required) {
          results.push({ name, ok: false, category: item.category, reason: 'Quantity for this item is missing or invalid.' });
          continue;
        }
        if (serials.length !== required) {
          results.push({
            name, ok: false, category: item.category, required,
            reason: `Needs exactly ${required} serial number(s), but ${serials.length} ${serials.length === 1 ? 'is' : 'are'} entered.`,
          });
          continue;
        }
        const line = { cat: item.category, brand: item.brand_name, watt: item.watt, type: item.solar_type };
        const errors = await validateSalesLineSerials(runner, serials, line);
        if (errors.length) {
          results.push({ name, ok: false, category: item.category, required, reason: errors.join('; ') });
          continue;
        }
        results.push({ name, ok: true, category: item.category, required, available: serials.length, item, serials, kind: 'serial' });
      } else {
        if (!required) {
          results.push({ name, ok: false, category: item.category, reason: 'Quantity for this item is missing or invalid.' });
          continue;
        }
        const available = await availableQtyForItem(runner, item.id, forUpdate);
        if (available < required) {
          results.push({
            name, ok: false, category: item.category, required, available,
            reason: `Only ${available} available in stock, but ${required} needed.`,
          });
          continue;
        }
        results.push({ name, ok: true, category: item.category, required, available, item, qty: required, kind: 'qty' });
      }
    }
    return results;
  }

  // POST /api/bom/check-stock — Step 1. Read-only, no locks.
  // Body: { items: [{ name, qty, serials: [] }, ...] }
  // Response: { canDispatch, items: [{ name, ok, reason, category, required, available }] }
  app.post('/api/bom/check-stock', route(async (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.json({ canDispatch: false, items: [], overallReason: 'No items to check.' });

    const results = await checkItems(pool, items, false);
    // Strip the internal item/serials/qty/kind fields before responding —
    // those exist only so Step 2 can reuse this same function; the
    // frontend's check-stock caller only ever reads name/ok/reason/
    // category/required/available.
    const clean = results.map(({ item, serials, kind, ...rest }) => rest);
    const canDispatch = results.length > 0 && results.every((r) => r.ok);
    res.json({ canDispatch, items: clean });
  }));

  // FIFO-consume `qtyNeeded` quantity-tracked units for one item, tagging
  // every unit BOM_DISPATCH_STATUS + this dispatch's id. Mirrors
  // sales.routes.js's fifoConsumeQty / stockassign.routes.js's
  // fifoConsumeQtyForAssign exactly (oldest Available row first, splitting
  // a row when only part of it is needed) — just targeting the BOM
  // dispatch status/reference instead of Sold/Assigned. Caller must
  // already hold the transaction and have re-verified enough stock exists
  // (checkItems with forUpdate=true, called just before this).
  async function fifoConsumeQtyForBom(conn, item, qtyNeeded, dispatchId) {
    let remaining = qtyNeeded;
    const modelVal = item.model ? String(item.model).trim() : null;
    const [rows] = await conn.query(
      `SELECT id, quantity, item_id, item_name, category, brand_name, watt, solar_type, model, warehouse,
              supplier_name, purchase_invoice, purchase_date, purchase_attachment
       FROM stock_ledger
       WHERE category=? AND brand_name=? AND watt=? AND solar_type=? AND model <=> ? AND status='Available' AND serial_no IS NULL
       ORDER BY id ASC
       FOR UPDATE`,
      [item.category, item.brand_name, Number(item.watt) || 0, item.solar_type, modelVal]
    );
    for (const row of rows) {
      if (remaining <= 0) break;
      if (row.quantity <= remaining) {
        await conn.query(
          `UPDATE stock_ledger SET status=?, bom_dispatch_id=? WHERE id=?`,
          [BOM_DISPATCH_STATUS, dispatchId, row.id]
        );
        remaining -= row.quantity;
      } else {
        await conn.query(
          `INSERT INTO stock_ledger
             (item_id, item_name, category, brand_name, watt, solar_type, model, warehouse, status,
              supplier_name, purchase_invoice, purchase_date, purchase_attachment,
              bom_dispatch_id, quantity, serial_no)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [row.item_id, row.item_name, row.category, row.brand_name, row.watt, row.solar_type, row.model, row.warehouse,
           BOM_DISPATCH_STATUS, row.supplier_name, row.purchase_invoice, row.purchase_date, row.purchase_attachment,
           dispatchId, remaining]
        );
        await conn.query(`UPDATE stock_ledger SET quantity = quantity - ? WHERE id=?`, [remaining, row.id]);
        remaining = 0;
      }
    }
  }

  // POST /api/bom/dispatch — Step 2. THE real stock deduction.
  // Body: { orderNo, header: {...}, items: [{ name, qty, serials }] }
  // Re-runs the exact same checks as check-stock, but with FOR UPDATE row
  // locks inside a transaction (so two people can't dispatch the same
  // stock at once), then actually moves stock:
  //   - serial-mandatory items: each entered serial -> status=Dispatched
  //   - quantity-based items: FIFO-consume the needed qty from Available
  // On any failure, rolls back and returns the same itemized-reasons shape
  // as check-stock — nothing is ever partially deducted.
  app.post('/api/bom/dispatch', route(async (req, res) => {
    const orderNo = String(req.body.orderNo || '').trim();
    const header = req.body.header && typeof req.body.header === 'object' ? req.body.header : {};
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.status(400).json({ error: 'No items to dispatch.', items: [] });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const results = await checkItems(conn, items, true);
      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        await conn.rollback();
        return res.status(400).json({
          error: 'DISPATCH BLOCKED:\n' + failed.map((r) => `${r.name}: ${r.reason}`).join('\n'),
          items: failed.map(({ item, serials, kind, ...rest }) => rest),
        });
      }

      const [dispatchResult] = await conn.query(
        `INSERT INTO bom_dispatches (order_no, header_json, items_json, dispatched_by)
         VALUES (?, ?, ?, ?)`,
        [orderNo || null, JSON.stringify(header), JSON.stringify(items), req.user ? req.user.username : null]
      );
      const dispatchId = dispatchResult.insertId;

      for (const r of results) {
        if (r.kind === 'serial') {
          for (const sn of r.serials) {
            await conn.query(`UPDATE stock_ledger SET status=?, bom_dispatch_id=? WHERE serial_no=?`, [BOM_DISPATCH_STATUS, dispatchId, sn]);
          }
        } else {
          await fifoConsumeQtyForBom(conn, r.item, r.qty, dispatchId);
        }
      }

      await conn.commit();
      res.json({ success: true, dispatchId });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }));
};