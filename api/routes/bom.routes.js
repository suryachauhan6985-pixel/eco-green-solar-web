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
  // Shared validation used by BOTH endpoints below — Step 1's read-only
  // check and Step 2's inside-transaction re-check run the exact same
  // rules, so a BOM that passed Convert-into-Challan never fails
  // Create Dispatch for a different reason. `runner` decides whether rows
  // get FOR UPDATE-locked (Step 2, inside a transaction) or not (Step 1).
  // Optimized to batch-query items and available quantities, eliminating N+1 queries.
  async function checkItems(runner, items, forUpdate) {
    const results = [];
    const validItems = items.filter((raw) => {
      const name = (raw.name || '').trim();
      const required = Number(raw.qty) || 0;
      return name && required > 0;
    });

    const itemNames = [...new Set(validItems.map((r) => String(r.name).trim()))];
    const itemMap = new Map();

    if (itemNames.length) {
      const [itemRows] = await runner.query(
        `SELECT i.id, i.name, i.category, i.brand_name, i.watt, i.solar_type, i.model,
                COALESCE(i.serial_mandatory, c.serial_mandatory, 0) AS serial_mandatory
         FROM items i
         LEFT JOIN categories c ON c.name = i.category
         WHERE i.name IN (?)`,
        [itemNames]
      );
      itemRows.forEach((r) => itemMap.set(r.name, r));
    }

    for (const raw of items) {
      const name = (raw.name || '').trim();
      const required = Number(raw.qty) || 0;
      const serials = Array.isArray(raw.serials) ? raw.serials : [];

      if (!name) {
        results.push({ name: name || '(blank)', ok: false, reason: 'No item selected for this row.' });
        continue;
      }

      // If an item has 0 qty to dispatch in this trip (e.g. already completed), skip it
      if (required <= 0) {
        continue;
      }

      const item = itemMap.get(name);
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

  // ---- Goal 4, Step 3: Partial Dispatch + Pending Qty helpers ----

  // Finds (and FOR UPDATE-locks) the bom_orders row for this Order No., or
  // creates it if this is the first-ever dispatch trip for that order. The
  // baseline captured on creation is FROZEN — it's the source of truth
  // every later partial trip's "how much is still pending" math uses, so a
  // later trip editing the on-screen Quantity field can never quietly
  // shrink/inflate what the order originally required. The one exception:
  // if a later trip includes an item name that wasn't part of the
  // baseline at all (order genuinely grew), that item gets appended to the
  // baseline (and persisted back) rather than rejected outright — it's a
  // legitimate order expansion, not drift on an existing line.
  async function getOrCreateBomOrder(conn, orderNo, items, header, username) {
    const [existingRows] = await conn.query(`SELECT * FROM bom_orders WHERE order_no=? FOR UPDATE`, [orderNo]);
    if (existingRows.length) {
      const order = existingRows[0];
      const baseline = JSON.parse(order.items_json || '{}');
      let changed = false;
      for (const it of items) {
        const name = (it.name || '').trim();
        if (name && !(name in baseline)) {
          baseline[name] = Number(it.totalQty) || Number(it.qty) || 0;
          changed = true;
        }
      }
      if (changed) {
        await conn.query(`UPDATE bom_orders SET items_json=? WHERE id=?`, [JSON.stringify(baseline), order.id]);
        order.items_json = JSON.stringify(baseline);
      }
      return order;
    }
    const baseline = {};
    for (const it of items) {
      const name = (it.name || '').trim();
      if (name) baseline[name] = Number(it.totalQty) || Number(it.qty) || 0;
    }
    const [result] = await conn.query(
      `INSERT INTO bom_orders (order_no, header_json, items_json, status, created_by) VALUES (?, ?, ?, 'Open', ?)`,
      [orderNo, JSON.stringify(header || {}), JSON.stringify(baseline), username]
    );
    return { id: result.insertId, order_no: orderNo, header_json: JSON.stringify(header || {}), items_json: JSON.stringify(baseline), status: 'Open' };
  }

  // Sums every past dispatch trip's qty per item name for this bom_order —
  // always recomputed from bom_dispatches.items_json rather than cached,
  // so it stays correct even if a dispatch row is ever hand-corrected.
  async function dispatchedSoFarByName(conn, bomOrderId) {
    const totals = {};
    if (!bomOrderId) return totals;
    const [rows] = await conn.query(`SELECT items_json FROM bom_dispatches WHERE bom_order_id=?`, [bomOrderId]);
    for (const row of rows) {
      let items;
      try { items = JSON.parse(row.items_json || '[]'); } catch (e) { items = []; }
      for (const it of items) {
        const name = (it.name || '').trim();
        if (!name) continue;
        totals[name] = (totals[name] || 0) + (Number(it.qty) || 0);
      }
    }
    return totals;
  }

  // Step 4: computes, for one bom_orders row, every baseline item's
  // dispatched-so-far and remaining qty. `withItemInfo` additionally joins
  // each item name back to `items`/`categories` (category + effective
  // serial_mandatory) — needed by the Continue Dispatch form so it knows
  // whether to render a qty box or a serial textarea for each pending
  // item; the list view doesn't need it, so it's skipped there to avoid
  // an extra query per item per order.
  async function pendingForOrder(runner, order, withItemInfo) {
    const baseline = JSON.parse(order.items_json || '{}');
    const dispatchedSoFar = await dispatchedSoFarByName(runner, order.id);
    const items = [];
    let pendingItemCount = 0;
    let pendingQty = 0;
    let totalQty = 0;
    let dispatchedQty = 0;
    for (const name of Object.keys(baseline)) {
      const total = baseline[name] || 0;
      const dispatched = dispatchedSoFar[name] || 0;
      const remaining = Math.max(0, total - dispatched);
      totalQty += total;
      dispatchedQty += dispatched;
      if (remaining > 0) { pendingItemCount += 1; pendingQty += remaining; }
      const row = { name, total, dispatched, remaining };
      if (withItemInfo) {
        const item = await findItemByName(runner, name);
        row.category = item ? item.category : null;
        row.serialMandatory = item ? !!item.serial_mandatory : false;
      }
      items.push(row);
    }
    return { items, pendingItemCount, pendingQty, totalQty, dispatchedQty };
  }

  // GET /api/bom/orders?status=Open|Completed|all — Step 4 register list.
  // Defaults to 'Open' (what the Pending BOM Register tab shows).
  app.get('/api/bom/orders', route(async (req, res) => {
    const status = String(req.query.status || 'Open').trim();
    const rows = status.toLowerCase() === 'all'
      ? (await pool.query(`SELECT * FROM bom_orders ORDER BY created_at DESC`))[0]
      : (await pool.query(`SELECT * FROM bom_orders WHERE status=? ORDER BY created_at DESC`, [status]))[0];

    const out = [];
    for (const row of rows) {
      const { pendingItemCount, pendingQty, totalQty, dispatchedQty } = await pendingForOrder(pool, row, false);
      out.push({
        id: row.id,
        orderNo: row.order_no,
        header: JSON.parse(row.header_json || '{}'),
        status: row.status,
        createdBy: row.created_by,
        createdAt: row.created_at,
        pendingItemCount,
        pendingQty,
        totalQty,
        dispatchedQty,
        // true once even a single unit has gone out on any trip — the BOM
        // Home "Pending BOM Orders" list uses this to show only BOMs
        // nobody has started working on yet (see bom.js's
        // bomLoadHomePendingTable); the full BOM Register (same endpoint,
        // no client-side filter) still shows every Open order regardless.
        isUntouched: dispatchedQty <= 0,
      });
    }
    res.json(out);
  }));

  // POST /api/bom/orders — "Create BOM" for real: captures a kit's FULL
  // baseline (every item's full Quantity, not a partial Dispatch Qty) as
  // its own bom_orders row up front, before any dispatch trip has gone
  // out. No new status value is introduced — the row is inserted with
  // status='Open' exactly like a dispatch-created order, and
  // pendingForOrder naturally reports dispatched=0/remaining=total for
  // every item until the first real trip, which is what "Pending" (not
  // yet started) looks like. getOrCreateBomOrder (used by /dispatch) needs
  // no changes — it already finds and extends this row on the first trip.
  // Body: { orderNo, header: {...}, items: [{ name, qty }], kitSnapshot?: { kitKey, label, kw, sections } }
  // kitSnapshot is the full on-screen kit at Generate BOM time — stored so
  // Continue Dispatch can reopen the same full BOM Entry UI later.
  app.post('/api/bom/orders', route(async (req, res) => {
    const orderNo = String(req.body.orderNo || '').trim();
    const header = req.body.header && typeof req.body.header === 'object' ? req.body.header : {};
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const kitSnapshot = req.body.kitSnapshot && typeof req.body.kitSnapshot === 'object' ? req.body.kitSnapshot : null;
    if (!orderNo) return res.status(400).json({ error: 'Order No. is required.' });

    const baseline = {};
    for (const it of items) {
      const name = (it.name || '').trim();
      const qty = Number(it.qty) || 0;
      if (name && qty > 0) baseline[name] = qty;
    }
    if (!Object.keys(baseline).length) {
      return res.status(400).json({ error: 'Add at least one item with a quantity before creating the BOM.' });
    }

    const [existing] = await pool.query(`SELECT id FROM bom_orders WHERE order_no=?`, [orderNo]);
    if (existing.length) {
      return res.status(409).json({
        error: `A BOM already exists for Order No. '${orderNo}'. Use Track BOM or the BOM Register to continue it instead of creating a duplicate.`,
      });
    }

    try {
      const [result] = await pool.query(
        `INSERT INTO bom_orders (order_no, header_json, items_json, kit_snapshot_json, status, created_by) VALUES (?, ?, ?, ?, 'Open', ?)`,
        [orderNo, JSON.stringify(header), JSON.stringify(baseline), kitSnapshot ? JSON.stringify(kitSnapshot) : null, req.user ? req.user.username : null]
      );
      res.json({ success: true, id: result.insertId, orderNo, status: 'Open' });
    } catch (e) {
      // Race safety net — two people creating the same Order No. at once.
      if (e && e.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: `A BOM already exists for Order No. '${orderNo}'.` });
      }
      throw e;
    }
  }));

  // GET /api/bom/used-item-names — every distinct item name that has
  // actually been used in at least one REAL BOM (any bom_orders row,
  // Open or Completed — "used in a BOM" means it was part of an order's
  // baseline, not whether it's still pending). Powers the Challan
  // Category Mapping editor's item list (see bom.js's
  // bomOpenChallanMapModal) — deliberately DB-driven from real orders
  // instead of every Kit Template's full item list, since a kit can list
  // items that have never actually been dispatched under any Order No.
  // yet, and mapping those clutters the editor with items nobody needs
  // categorized yet.
  app.get('/api/bom/used-item-names', route(async (req, res) => {
    const [rows] = await pool.query(`SELECT items_json FROM bom_orders`);
    const set = new Set();
    for (const row of rows) {
      let baseline;
      try { baseline = JSON.parse(row.items_json || '{}'); } catch (e) { baseline = {}; }
      Object.keys(baseline).forEach((name) => { if (name) set.add(name); });
    }
    const names = Array.from(set).sort((a, b) => a.localeCompare(b));
    res.json({ names });
  }));

  // GET /api/bom/orders/by-order-no/:orderNo — the real Track BOM lookup.
  // Registered BEFORE GET /api/bom/orders/:id below so "by-order-no" is
  // never swallowed as a numeric :id. Same per-item breakdown as GET
  // /:id, PLUS the full dispatch-trip history (bom_dispatches rows for
  // this order, oldest first) so Track BOM can render a real "who
  // dispatched what, when" timeline. `status` is the 3-state label the
  // frontend's status pill expects (Pending / Partially Dispatched /
  // Dispatched), derived from the items breakdown rather than stored.
  app.get('/api/bom/orders/by-order-no/:orderNo', route(async (req, res) => {
    const orderNo = String(req.params.orderNo || '').trim();
    if (!orderNo) return res.status(400).json({ error: 'Order No. is required.' });
    const [[row]] = await pool.query(`SELECT * FROM bom_orders WHERE order_no=?`, [orderNo]);
    if (!row) return res.status(404).json({ error: `No BOM found for Order No. '${orderNo}'.` });

    const { items } = await pendingForOrder(pool, row, true);
    const totalAcross = items.reduce((s, it) => s + it.total, 0);
    const dispatchedAcross = items.reduce((s, it) => s + it.dispatched, 0);
    const overallStatus = dispatchedAcross <= 0
      ? 'Pending'
      : (dispatchedAcross >= totalAcross ? 'Dispatched' : 'Partially Dispatched');

    const [tripRows] = await pool.query(
      `SELECT id, items_json, dispatched_by, dispatched_at FROM bom_dispatches WHERE bom_order_id=? ORDER BY dispatched_at ASC`,
      [row.id]
    );
    const trips = tripRows.map((t) => {
      let tripItems;
      try { tripItems = JSON.parse(t.items_json || '[]'); } catch (e) { tripItems = []; }
      return { id: t.id, dispatchedBy: t.dispatched_by, dispatchedAt: t.dispatched_at, items: tripItems };
    });

    let kitSnapshot = null;
    try { kitSnapshot = row.kit_snapshot_json ? JSON.parse(row.kit_snapshot_json) : null; } catch (e) { kitSnapshot = null; }

    res.json({
      id: row.id,
      orderNo: row.order_no,
      header: JSON.parse(row.header_json || '{}'),
      status: overallStatus,
      createdBy: row.created_by,
      createdAt: row.created_at,
      items,
      trips,
      kitSnapshot,
    });
  }));

  // GET /api/bom/orders/:id — Step 4 Continue Dispatch form data. Full
  // per-item breakdown (category/serialMandatory included) for every
  // baseline item, not just the pending ones — the frontend filters to
  // remaining>0 itself, but keeping the full list here makes this
  // endpoint equally useful for a future "order history" view.
  // Also returns kitSnapshot (full sections captured at Generate BOM) so
  // the frontend can reopen the full BOM Entry UI instead of the flat form.
  app.get('/api/bom/orders/:id', route(async (req, res) => {
    const [[row]] = await pool.query(`SELECT * FROM bom_orders WHERE id=?`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'BOM order not found.' });
    const { items } = await pendingForOrder(pool, row, true);
    let kitSnapshot = null;
    try { kitSnapshot = row.kit_snapshot_json ? JSON.parse(row.kit_snapshot_json) : null; } catch (e) { kitSnapshot = null; }
    res.json({
      id: row.id,
      orderNo: row.order_no,
      header: JSON.parse(row.header_json || '{}'),
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      items,
      kitSnapshot,
    });
  }));

  // FIFO-consume `qtyNeeded` quantity-tracked units for one item, tagging
  // every unit BOM_DISPATCH_STATUS + this dispatch's id. Mirrors
  // sales.routes.js's fifoConsumeQty / stockassign.routes.js's
  // fifoConsumeQtyForAssign exactly (oldest Available row first, splitting
  // a row when only part of it is needed) — just targeting the BOM
  // dispatch status/reference instead of Sold/Assigned. Caller must
  // already hold the transaction and have re-verified enough stock exists
  // (checkItems with forUpdate=true, called just before this).
  async function fifoConsumeQtyForBom(conn, item, qtyNeeded, dispatchId, customerName, orderNo, challanNo, challanDate) {
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
          `UPDATE stock_ledger
           SET status=?, bom_dispatch_id=?, customer_name=?, order_no=?, chalan_no=?, chalan_date=?, sales_date=?
           WHERE id=?`,
          [BOM_DISPATCH_STATUS, dispatchId, customerName || null, orderNo || null, challanNo || null, challanDate || null, challanDate || null, row.id]
        );
        remaining -= row.quantity;
      } else {
        await conn.query(
          `INSERT INTO stock_ledger
             (item_id, item_name, category, brand_name, watt, solar_type, model, warehouse, status,
              supplier_name, purchase_invoice, purchase_date, purchase_attachment,
              customer_name, order_no, chalan_no, chalan_date, sales_date,
              bom_dispatch_id, quantity, serial_no)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [row.item_id, row.item_name, row.category, row.brand_name, row.watt, row.solar_type, row.model, row.warehouse,
           BOM_DISPATCH_STATUS, row.supplier_name, row.purchase_invoice, row.purchase_date, row.purchase_attachment,
           customerName || null, orderNo || null, challanNo || null, challanDate || null, challanDate || null,
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
    // Step 3: Order No. is now the key every partial trip is linked back to
    // (bom_orders.order_no) — without it there's no way to know "this
    // trip" and "that trip next week" are the same BOM, so pending
    // tracking can't work at all. Required from here on, unlike before.
    if (!orderNo) return res.status(400).json({ error: 'Order No. is required before you can create a dispatch.', items: [] });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Baseline (first trip ever for this Order No. creates it; every
      // later trip just locks + reuses it) — see getOrCreateBomOrder.
      const bomOrder = await getOrCreateBomOrder(conn, orderNo, items, header, req.user ? req.user.username : null);
      const baseline = JSON.parse(bomOrder.items_json || '{}');
      const dispatchedSoFar = await dispatchedSoFarByName(conn, bomOrder.id);

      // Pending ceiling check — this trip can never ask for more of an
      // item than what's still left un-dispatched for this Order No.,
      // regardless of whether enough physical stock exists. Checked BEFORE
      // the stock-availability check below so a "you're trying to
      // over-dispatch this order" mistake shows its own clear reason
      // instead of getting mixed in with a stock-shortage reason.
      const pendingFailed = [];
      for (const raw of items) {
        const name = (raw.name || '').trim();
        if (!name) continue;
        const requested = Number(raw.qty) || 0;
        const total = baseline[name] || 0;
        const remaining = total - (dispatchedSoFar[name] || 0);
        if (requested > remaining) {
          pendingFailed.push({
            name,
            ok: false,
            reason: `Only ${remaining} still pending for this Order No. (already dispatched ${dispatchedSoFar[name] || 0} of ${total}), but ${requested} requested now.`,
          });
        }
      }
      if (pendingFailed.length) {
        await conn.rollback();
        return res.status(400).json({
          error: 'DISPATCH BLOCKED:\n' + pendingFailed.map((r) => `${r.name}: ${r.reason}`).join('\n'),
          items: pendingFailed,
        });
      }

      const dispatchItems = items.filter((it) => (Number(it && it.qty) || 0) > 0);
      if (!dispatchItems.length) {
        await conn.rollback();
        return res.status(400).json({ error: 'No items with quantity > 0 selected for this dispatch trip.', items: [] });
      }

      const results = await checkItems(conn, dispatchItems, true);
      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        await conn.rollback();
        return res.status(400).json({
          error: 'DISPATCH BLOCKED:\n' + failed.map((r) => `${r.name}: ${r.reason}`).join('\n'),
          items: failed.map(({ item, serials, kind, ...rest }) => rest),
        });
      }

      const [dispatchResult] = await conn.query(
        `INSERT INTO bom_dispatches (order_no, bom_order_id, header_json, items_json, dispatched_by)
         VALUES (?, ?, ?, ?, ?)`,
        [orderNo, bomOrder.id, JSON.stringify(header), JSON.stringify(dispatchItems), req.user ? req.user.username : null]
      );
      const dispatchId = dispatchResult.insertId;

      const custName = String(header.customerName || header.custName || '').trim();
      const challanNo = String(header.challanNo || '').trim();
      const challanDate = header.challanDate || new Date().toISOString().slice(0, 10);
      const salesDate = challanDate;

      for (const r of results) {
        if (r.kind === 'serial') {
          for (const sn of r.serials) {
            await conn.query(
              `UPDATE stock_ledger
               SET status=?, bom_dispatch_id=?, customer_name=?, order_no=?, chalan_no=?, chalan_date=?, sales_date=?
               WHERE serial_no=?`,
              [BOM_DISPATCH_STATUS, dispatchId, custName || null, orderNo || null, challanNo || null, challanDate || null, salesDate || null, sn]
            );
          }
        } else {
          await fifoConsumeQtyForBom(conn, r.item, r.qty, dispatchId, custName, orderNo, challanNo, challanDate);
        }
      }

      // Auto-save Solar Panel serials to network folder (exclude inverters)
      const dispatchedSerials = [];
      for (const r of results) {
        if (r.kind === 'serial' && Array.isArray(r.serials)) {
          const itemName = String(r.item || '').trim().toUpperCase();
          const isInverter = itemName.includes('INVERTER') || itemName.includes('DEYE') || itemName.includes('GROWATT') || itemName.includes('POLYCAB') || itemName.includes('SOLIS');
          if (!isInverter) {
            dispatchedSerials.push(...r.serials);
          }
        }
      }
      if (dispatchedSerials.length) {
        const { saveSerialExcelToNetwork } = require('../services/serialExcelService');
        saveSerialExcelToNetwork({
          orderNo,
          customerName: header.customerName || header.custName || '',
          shortName: header.customerName || header.custName || orderNo,
          date: header.challanDate || header.date || new Date(),
          serials: dispatchedSerials
        }).catch((e) => console.warn('[BOM Dispatch] Serial Excel auto-save note:', e.message));
      }

      // Recompute pending across the WHOLE order's baseline (not just the
      // items in this trip) so the response always reflects the full
      // picture — e.g. an item nobody touched this trip still shows up if
      // it was never fully dispatched by an earlier trip either.
      const dispatchedNow = {};
      for (const it of items) {
        const name = (it.name || '').trim();
        if (!name) continue;
        dispatchedNow[name] = (dispatchedNow[name] || 0) + (Number(it.qty) || 0);
      }
      const pending = [];
      let allDone = true;
      for (const name of Object.keys(baseline)) {
        const total = baseline[name] || 0;
        const doneSoFar = (dispatchedSoFar[name] || 0) + (dispatchedNow[name] || 0);
        const remaining = Math.max(0, total - doneSoFar);
        if (remaining > 0) { pending.push({ name, total, dispatched: doneSoFar, remaining }); allDone = false; }
      }
      const orderStatus = allDone ? 'Completed' : 'Open';
      if (orderStatus !== bomOrder.status) {
        await conn.query(`UPDATE bom_orders SET status=? WHERE id=?`, [orderStatus, bomOrder.id]);
      }

      await conn.commit();
      res.json({ success: true, dispatchId, bomOrderId: bomOrder.id, orderStatus, pending });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }));
};