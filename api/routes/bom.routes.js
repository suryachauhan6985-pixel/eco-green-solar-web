// api/routes/bom.routes.js
// -----------------------------------------------------------------------------
// BOM / Bulk Dispatch — Goal 4, Step 1.
// -----------------------------------------------------------------------------
// bom.js's kit contents (BOM_KITS + saved custom templates) stay hardcoded/
// frontend-only for now — most items in a kit aren't registered as real
// Item Master rows yet, so we deliberately do NOT touch that. What WAS
// completely fake until now is the "Create Dispatch" click: it went
// straight to the Challan modal with zero contact with the database, so a
// BOM with no stock at all would "dispatch" just fine.
//
// This endpoint is the first real, read-only contact with the database:
// given the BOM's on-screen items (name + qty + any serials entered), it
// checks each one against the ACTUAL Item Master + stock_ledger and reports,
// per item, whether dispatch is possible and exactly why not if it isn't:
//   - item not registered in Masters > Item Registration at all
//   - serial-mandatory item: a serial that was entered doesn't exist in
//     stock, isn't 'Available', or belongs to a different category/brand/
//     watt/type (mirrors Sales dispatch's validateSalesLineSerials)
//   - serial-mandatory item: entered serial count doesn't match the
//     quantity the BOM line asks for
//   - quantity-based item: not enough 'Available' quantity in stock_ledger
//
// It does NOT reserve, deduct, or write anything — pure availability check.
// Real deduction/partial-dispatch/pending-tracking is later steps of Goal 4.
// -----------------------------------------------------------------------------
module.exports = function registerBomRoutes(app, deps) {
  const { pool, route, validateSalesLineSerials } = deps;

  // Item Master lookup by the exact `name` shown in the BOM's item dropdown
  // (that dropdown is fed by /api/masters/items, so names match 1:1).
  // COALESCE mirrors ensureItemOverrideSchema's effective-rule rule: an
  // item-level override wins, otherwise fall back to the Category default.
  async function findItemByName(name) {
    const [rows] = await pool.query(
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

  async function availableQtyForItem(itemId) {
    const [[row]] = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total FROM stock_ledger WHERE status='Available' AND item_id=?`,
      [itemId]
    );
    return Number(row.total) || 0;
  }

  // POST /api/bom/check-stock
  // Body: { items: [{ name, qty, serials: [] }, ...] }
  // Response: { canDispatch, items: [{ name, ok, reason, category, required, available }] }
  app.post('/api/bom/check-stock', route(async (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!items.length) return res.json({ canDispatch: false, items: [], overallReason: 'No items to check.' });

    const results = [];

    for (const raw of items) {
      const name = (raw.name || '').trim();
      const required = Number(raw.qty) || 0;
      const serials = Array.isArray(raw.serials) ? raw.serials : [];

      if (!name) {
        results.push({ name: name || '(blank)', ok: false, reason: 'No item selected for this row.' });
        continue;
      }

      const item = await findItemByName(name);
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
        const errors = await validateSalesLineSerials(pool, serials, line);
        if (errors.length) {
          results.push({ name, ok: false, category: item.category, required, reason: errors.join('; ') });
          continue;
        }
        results.push({ name, ok: true, category: item.category, required, available: serials.length });
      } else {
        if (!required) {
          results.push({ name, ok: false, category: item.category, reason: 'Quantity for this item is missing or invalid.' });
          continue;
        }
        const available = await availableQtyForItem(item.id);
        if (available < required) {
          results.push({
            name, ok: false, category: item.category, required, available,
            reason: `Only ${available} available in stock, but ${required} needed.`,
          });
          continue;
        }
        results.push({ name, ok: true, category: item.category, required, available });
      }
    }

    const canDispatch = results.length > 0 && results.every((r) => r.ok);
    res.json({ canDispatch, items: results });
  }));
};
