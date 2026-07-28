function itemNameSlug(brand, watt, solarType) {
  const w = Number(watt) || 0;
  const st = solarType || 'Others';
  return w > 0 ? `${brand}_${w}_${st}` : `${brand}_${st}`;
}

// Read-only lookup used by Sales Dispatch — mirrors db.py's get_item_id():
// unlike getOrCreateItem() (used by Purchase Inward), Sales must NEVER
// silently create a new item master. If the (category, brand, watt, type)
// combo doesn't already exist as a registered item, the dispatch is blocked
// with "Selected product master was not found", exactly like the desktop app.
async function getItemId(runner, category, brand, watt, solarType) {
  const w = Number(watt) || 0;
  const st = solarType || 'Others';
  const [rows] = await runner.query(
    `SELECT id FROM items WHERE category=? AND brand_name=? AND watt=? AND solar_type=?`,
    [category, brand, w, st]
  );
  return rows.length ? rows[0].id : null;
}

// Mirrors ui/sales.py's validate_sales_line_serials(): every serial in a
// product line must already exist in stock_ledger, be 'Available', and its
// stored category/brand/watt/type must match the line it's being dispatched
// under. Returns an array of human-readable error strings (empty = valid).
async function validateSalesLineSerials(runner, serials, line) {
  const errors = [];
  for (const sn of serials) {
    const [rows] = await runner.query(
      `SELECT status, category, brand_name, watt, solar_type FROM stock_ledger WHERE serial_no=?`,
      [sn]
    );
    if (!rows.length) {
      errors.push(`'${sn}' - NOT FOUND in database`);
      continue;
    }
    const r = rows[0];
    const lineWatt = Number(line.watt) || 0;
    if (r.status !== 'Available') errors.push(`'${sn}' - Status is '${r.status}', not 'Available'`);
    if (r.category !== line.cat) errors.push(`'${sn}' - Category mismatch: database has '${r.category}'`);
    if (r.brand_name !== line.brand) errors.push(`'${sn}' - Brand mismatch: database has '${r.brand_name}'`);
    if ((Number(r.watt) || 0) !== lineWatt) errors.push(`'${sn}' - Wattage mismatch: database has '${r.watt}W'`);
    if (r.solar_type !== line.type) errors.push(`'${sn}' - Type mismatch: database has '${r.solar_type}'`);
  }
  return errors;
}

async function getOrCreateItem(conn, category, brand, watt, solarType) {
  const w = Number(watt) || 0;
  const st = solarType || 'Others';

  const [rows] = await conn.query(
    `SELECT id FROM items WHERE category=? AND brand_name=? AND watt=? AND solar_type=?`,
    [category, brand, w, st]
  );
  if (rows.length) return rows[0].id;

  const [baseRows] = await conn.query(
    `SELECT uom, minimum_stock FROM items WHERE category=? AND brand_name=? AND watt=? LIMIT 1`,
    [category, brand, w]
  );
  const uom = baseRows.length && baseRows[0].uom ? baseRows[0].uom : 'Nos';
  const minimumStock = baseRows.length && baseRows[0].minimum_stock != null ? baseRows[0].minimum_stock : 0;
  const nameSlug = itemNameSlug(brand, w, st);

  try {
    const [result] = await conn.query(
      `INSERT INTO items (name, brand_name, watt, solar_type, category, uom, minimum_stock) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nameSlug, brand, w, st, category, uom, minimumStock]
    );
    return result.insertId;
  } catch (e) {
    // Race/duplicate safety net, same as the .py try/except around the
    // INSERT: if another line/request created it in the meantime, or the
    // name slug collided, just look it up instead of failing the whole save.
    const [retryRows] = await conn.query(
      `SELECT id FROM items WHERE category=? AND brand_name=? AND watt=? AND solar_type=?`,
      [category, brand, w, st]
    );
    if (retryRows.length) return retryRows[0].id;
    throw e;
  }
}

module.exports = { itemNameSlug, getItemId, validateSalesLineSerials, getOrCreateItem };
