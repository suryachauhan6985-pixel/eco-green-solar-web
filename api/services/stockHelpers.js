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
// Normalization helper for category comparison (e.g. 'DCR SOLAR PANEL' vs 'SOLAR PANELS')
function areCategoriesCompatible(catA, catB) {
  if (!catA || !catB) return true;
  const a = String(catA).trim().toUpperCase();
  const b = String(catB).trim().toUpperCase();
  if (a === b) return true;
  if ((a.includes('PANEL') || a.includes('MODULE')) && (b.includes('PANEL') || b.includes('MODULE'))) return true;
  if (a.includes('INVERTER') && b.includes('INVERTER')) return true;
  if (a.includes('BATTERY') && b.includes('BATTERY')) return true;
  if (a.includes('STRUCTURE') && b.includes('STRUCTURE')) return true;
  if (a.includes('CABLE') && b.includes('CABLE')) return true;
  return false;
}

// Mirrors ui/sales.py's validate_sales_line_serials(): every serial in a
// product line must already exist in stock_ledger, be 'Available', and its
// stored category/brand/watt/type must match the line it's being dispatched
// under. Returns an array of human-readable error strings (empty = valid).
// Optimized with single batch query to eliminate N+1 performance bottleneck.
async function validateSalesLineSerials(runner, serials, line = {}) {
  if (!Array.isArray(serials) || !serials.length) return [];
  const errors = [];
  const cleanSerials = serials.map((s) => String(s || '').trim()).filter(Boolean);
  if (!cleanSerials.length) return [];

  const [rows] = await runner.query(
    `SELECT serial_no, status, category, brand_name, watt, solar_type FROM stock_ledger WHERE serial_no IN (?)`,
    [cleanSerials]
  );

  const rowMap = new Map();
  rows.forEach((r) => {
    rowMap.set(String(r.serial_no).trim().toUpperCase(), r);
    rowMap.set(String(r.serial_no).trim(), r);
  });

  const lineWatt = Number(line.watt) || 0;
  const lineBrand = String(line.brand || '').trim().toUpperCase();
  const lineType = String(line.type || '').trim().toUpperCase();

  for (const sn of cleanSerials) {
    const snLookup = String(sn).trim().toUpperCase();
    const r = rowMap.get(snLookup) || rowMap.get(sn);
    if (!r) {
      errors.push(`'${sn}' - NOT FOUND in database`);
      continue;
    }
    if (String(r.status || '').toLowerCase() !== 'available') {
      errors.push(`'${sn}' - Status is '${r.status}', not 'Available'`);
    }

    // Category check
    if (line.cat && !areCategoriesCompatible(r.category, line.cat)) {
      errors.push(`'${sn}' - Category mismatch: database has '${r.category}'`);
    }

    // Brand check (case-insensitive)
    if (lineBrand && String(r.brand_name || '').trim().toUpperCase() !== lineBrand) {
      errors.push(`'${sn}' - Brand mismatch: database has '${r.brand_name}'`);
    }

    // Wattage check (only if both are defined and non-zero)
    const dbWatt = Number(r.watt) || 0;
    if (lineWatt > 0 && dbWatt > 0 && Math.abs(dbWatt - lineWatt) > 0.01) {
      errors.push(`'${sn}' - Wattage mismatch: database has '${r.watt}W'`);
    }

    // Solar type check: only fail if both lineType and DB solar_type are explicitly specified and conflict
    const dbType = String(r.solar_type || '').trim().toUpperCase();
    if (lineType && lineType !== '-' && lineType !== 'ALL' && lineType !== 'N/A') {
      if (dbType && dbType !== '-' && dbType !== lineType) {
        errors.push(`'${sn}' - Type mismatch: database has '${r.solar_type}'`);
      }
    }
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

async function getOrCreateItem(conn, category, brand, watt, solarType, model, uomVal) {
  let cat = String(category || 'Other').trim() || 'Other';
  const b = String(brand || cat || 'General').trim() || 'General';
  const w = Number(watt) || 0;
  const st = String(solarType || 'Others').trim() || 'Others';
  const m = String(model || '').trim();
  const isModelBased = w <= 0 && !!m;

  // 1. Direct match with specified category
  const lookupSql = isModelBased
    ? `SELECT id FROM items WHERE category=? AND brand_name=? AND LOWER(COALESCE(model,''))=LOWER(?)`
    : `SELECT id FROM items WHERE category=? AND brand_name=? AND watt=? AND solar_type=?`;
  const lookupParams = isModelBased ? [cat, b, m] : [cat, b, w, st];

  const [rows] = await conn.query(lookupSql, lookupParams);
  if (rows.length) return rows[0].id;

  // 2. Intelligent cross-category lookup: If this item was already registered
  // in Masters > Item Registration under its true category, use that item directly!
  const crossLookupSql = isModelBased
    ? `SELECT id FROM items WHERE LOWER(brand_name)=LOWER(?) AND LOWER(COALESCE(model,''))=LOWER(?) LIMIT 1`
    : `SELECT id FROM items WHERE LOWER(brand_name)=LOWER(?) AND watt=? LIMIT 1`;
  const crossLookupParams = isModelBased ? [b, m] : [b, w];
  const [crossRows] = await conn.query(crossLookupSql, crossLookupParams);
  if (crossRows.length) {
    return crossRows[0].id;
  }

  // 3. Match by name slug across all registered items
  const nameSlug = itemNameSlug(b, w, st, m);
  const [nameRows] = await conn.query(`SELECT id FROM items WHERE name=? OR LOWER(name)=LOWER(?) LIMIT 1`, [nameSlug, nameSlug]);
  if (nameRows.length) {
    return nameRows[0].id;
  }

  // 4. Truly brand-new unregistered item: ensure category exists in categories table so FK is satisfied
  cat = await ensureCategoryExists(conn, cat);

  const baseSql = isModelBased
    ? `SELECT uom, minimum_stock FROM items WHERE category=? AND brand_name=? LIMIT 1`
    : `SELECT uom, minimum_stock FROM items WHERE category=? AND brand_name=? AND watt=? LIMIT 1`;
  const baseParams = isModelBased ? [cat, b] : [cat, b, w];
  const [baseRows] = await conn.query(baseSql, baseParams);
  const uom = String(uomVal || (baseRows.length && baseRows[0].uom ? baseRows[0].uom : 'Nos')).trim() || 'Nos';
  const minimumStock = baseRows.length && baseRows[0].minimum_stock != null ? baseRows[0].minimum_stock : 0;

  try {
    const [result] = await conn.query(
      `INSERT INTO items (name, brand_name, watt, solar_type, category, uom, minimum_stock, model) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nameSlug, b, w, st, cat, uom, minimumStock, isModelBased ? m : null]
    );
    return result.insertId;
  } catch (e) {
    const [retryRows] = await conn.query(lookupSql, lookupParams);
    if (retryRows.length) return retryRows[0].id;
    const [retryNameRows] = await conn.query(`SELECT id FROM items WHERE name=? LIMIT 1`, [nameSlug]);
    if (retryNameRows.length) return retryNameRows[0].id;
    throw e;
  }
}

module.exports = { itemNameSlug, getItemId, validateSalesLineSerials, getOrCreateItem };