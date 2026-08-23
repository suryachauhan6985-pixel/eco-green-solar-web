function itemNameSlug(brand, watt, solarType, model) {
  const w = Number(watt) || 0;
  const st = solarType || 'Others';
  const m = (model || '').trim();
  // Model-based items (Wattage/Serial both non-mandatory for the category,
  // e.g. PVC Pipe) have watt=0 — fold the model into the slug so different
  // models of the same brand never collide into one name (e.g.
  // "PVCBrand_2 Inch" vs "PVCBrand_3 Inch" instead of both being
  // "PVCBrand_Others").
  if (w <= 0 && m) return `${brand}_${m}`;
  return w > 0 ? `${brand}_${w}_${st}` : `${brand}_${st}`;
}

// Read-only lookup used by Sales Dispatch — mirrors db.py's get_item_id():
// unlike getOrCreateItem() (used by Purchase Inward), Sales must NEVER
// silently create a new item master. If the (category, brand, watt, type)
// combo doesn't already exist as a registered item, the dispatch is blocked
// with "Selected product master was not found", exactly like the desktop app.
async function getItemId(runner, category, brand, watt, solarType, model) {
  const w = Number(watt) || 0;
  const st = solarType || 'Others';
  // Model-based items (category has neither Wattage nor Serial No. rule,
  // e.g. PVC Pipe) always carry watt=0 — matching on watt+solar_type alone
  // would collapse every model of the same brand into a single item, so
  // fall back to the same category+brand+model key Masters > Item
  // Registration uses (see masters_routes.js's validateItemPayload).
  if (w <= 0 && model) {
    const [rows] = await runner.query(
      `SELECT id FROM items WHERE category=? AND brand_name=? AND LOWER(COALESCE(model,''))=LOWER(?)`,
      [category, brand, String(model).trim()]
    );
    return rows.length ? rows[0].id : null;
  }
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

async function ensureCategoryExists(conn, categoryName) {
  const cat = String(categoryName || 'Other').trim() || 'Other';
  try {
    const [rows] = await conn.query(`SELECT name FROM categories WHERE name = ? LIMIT 1`, [cat]);
    if (!rows.length) {
      await conn.query(
        `INSERT INTO categories (name, watt_mandatory, serial_mandatory) VALUES (?, 0, 0)
         ON DUPLICATE KEY UPDATE name=VALUES(name)`,
        [cat]
      );
    }
  } catch (e) {
    // Ignore duplicate or existing
  }
  return cat;
}

async function getOrCreateItem(conn, category, brand, watt, solarType, model) {
  let cat = String(category || 'Other').trim() || 'Other';
  const b = String(brand || cat || 'General').trim() || 'General';
  const w = Number(watt) || 0;
  const st = String(solarType || 'Others').trim() || 'Others';
  const m = String(model || '').trim();
  // Model-based items (Wattage/Serial both non-mandatory for this category)
  // must be looked up / created by category+brand+model, not watt — every
  // model-based item shares watt=0, so watt+solar_type can't tell them
  // apart (see getItemId above for the same reasoning).
  const isModelBased = w <= 0 && !!m;

  // Ensure category exists in categories table so FK items_ibfk_1 is satisfied!
  cat = await ensureCategoryExists(conn, cat);

  const lookupSql = isModelBased
    ? `SELECT id FROM items WHERE category=? AND brand_name=? AND LOWER(COALESCE(model,''))=LOWER(?)`
    : `SELECT id FROM items WHERE category=? AND brand_name=? AND watt=? AND solar_type=?`;
  const lookupParams = isModelBased ? [cat, b, m] : [cat, b, w, st];

  const [rows] = await conn.query(lookupSql, lookupParams);
  if (rows.length) return rows[0].id;

  const baseSql = isModelBased
    ? `SELECT uom, minimum_stock FROM items WHERE category=? AND brand_name=? LIMIT 1`
    : `SELECT uom, minimum_stock FROM items WHERE category=? AND brand_name=? AND watt=? LIMIT 1`;
  const baseParams = isModelBased ? [cat, b] : [cat, b, w];
  const [baseRows] = await conn.query(baseSql, baseParams);
  const uom = baseRows.length && baseRows[0].uom ? baseRows[0].uom : 'Nos';
  const minimumStock = baseRows.length && baseRows[0].minimum_stock != null ? baseRows[0].minimum_stock : 0;
  const nameSlug = itemNameSlug(b, w, st, m);

  try {
    const [result] = await conn.query(
      `INSERT INTO items (name, brand_name, watt, solar_type, category, uom, minimum_stock, model) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nameSlug, b, w, st, cat, uom, minimumStock, isModelBased ? m : null]
    );
    return result.insertId;
  } catch (e) {
    // Race/duplicate safety net, same as the .py try/except around the
    // INSERT: if another line/request created it in the meantime, or the
    // name slug collided, just look it up instead of failing the whole save.
    const [retryRows] = await conn.query(lookupSql, lookupParams);
    if (retryRows.length) return retryRows[0].id;
    const [nameRows] = await conn.query(`SELECT id FROM items WHERE name=? LIMIT 1`, [nameSlug]);
    if (nameRows.length) return nameRows[0].id;
    throw e;
  }
}

module.exports = { itemNameSlug, getItemId, validateSalesLineSerials, getOrCreateItem };