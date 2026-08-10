async function ensureStartupSchema(pool) {
  await ensureSessionSchema(pool);
  await ensureSerialRuleSchema(pool);
  await ensureLedgerTypeSchema(pool);
  await ensureAuthOtpSchema(pool);
  await ensureEmailRoleUniqueSchema(pool);
  await ensureAttachmentsSchema(pool);
  await ensureScanSheetSchema(pool);
  await ensureBomChallanSchema(pool);
  await ensureStockQuantitySchema(pool);
  await ensureItemOverrideSchema(pool);
  await ensureStockModelSchema(pool);
  await ensureWattDecimalSchema(pool);
  await ensureWattUnitSchema(pool);
  await ensureBomDispatchSchema(pool);
  await ensureBomOrderSchema(pool);
  await ensureChallanCategoryMapSchema(pool);
}
async function ensureSessionSchema(pool) { try { await pool.query(`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_seen DATETIME NULL`); } catch (e) { console.warn('[Session schema] Could not ensure last_seen column (will retry lazily on first use):', e.message); } }
async function ensureSerialRuleSchema(pool) { try { await pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS serial_mandatory TINYINT(1) NOT NULL DEFAULT 0`); } catch (e) { console.warn('[Serial rule schema] Could not ensure serial_mandatory column (will retry lazily on first use):', e.message); } }
async function ensureLedgerTypeSchema(pool) { try { await pool.query(`ALTER TABLE ledgers MODIFY COLUMN ledger_type VARCHAR(20) NOT NULL DEFAULT 'Both'`); } catch (e) { console.warn('[Ledger type schema] Could not widen ledger_type column (will retry lazily on first use):', e.message); } }
async function ensureAuthOtpSchema(pool) {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150) NULL`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified TINYINT(1) NOT NULL DEFAULT 1`);
    await pool.query(`CREATE TABLE IF NOT EXISTS otp_codes (username VARCHAR(100) PRIMARY KEY, otp VARCHAR(10) NOT NULL, expires_at DATETIME NOT NULL, attempts INT NOT NULL DEFAULT 0)`);
  } catch (e) { console.warn('[Auth/OTP schema] Could not ensure email column / otp_codes table:', e.message); }
}
async function ensureEmailRoleUniqueSchema(pool) {
  try {
    const [rows] = await pool.query(`SELECT COUNT(*) AS cnt FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'users' AND index_name = 'uniq_email_role'`);
    if (!rows[0].cnt) await pool.query(`ALTER TABLE users ADD UNIQUE INDEX uniq_email_role (email, role)`);
  } catch (e) { console.warn('[Email/Role uniqueness] Could not add uniq_email_role index (likely duplicate email+role rows already exist - clean those up, then restart):', e.message); }
}
async function ensureAttachmentsSchema(pool) {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS attachments (id INT AUTO_INCREMENT PRIMARY KEY, ref_type VARCHAR(30) NOT NULL, ref_no VARCHAR(100) NOT NULL, file_name VARCHAR(255) NOT NULL, mime_type VARCHAR(120), file_size INT, file_data LONGTEXT NOT NULL, uploaded_by VARCHAR(100), uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, INDEX idx_attachments_ref (ref_type, ref_no))`);
  } catch (e) { console.warn('[Attachments schema] Could not ensure attachments table:', e.message); }
}
async function ensureScanSheetSchema(pool) {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS scan_sheets (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      columns_json LONGTEXT NOT NULL,
      created_by VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_scan_sheets_owner (created_by)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS scan_sheet_entries (
      id VARCHAR(64) PRIMARY KEY,
      sheet_id VARCHAR(64) NOT NULL,
      sno INT NOT NULL,
      values_json LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_scan_entries_sheet (sheet_id),
      CONSTRAINT fk_scan_entries_sheet FOREIGN KEY (sheet_id) REFERENCES scan_sheets(id) ON DELETE CASCADE
    )`);
  } catch (e) { console.warn('[Scan sheet schema] Could not ensure scan_sheets / scan_sheet_entries tables:', e.message); }
}
async function ensureBomChallanSchema(pool) {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS bom_challans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      challan_no VARCHAR(50) NOT NULL,
      challan_date VARCHAR(20),
      order_no VARCHAR(100),
      customer_name VARCHAR(255),
      installer_name VARCHAR(255),
      fabricator_name VARCHAR(255),
      dealer_name VARCHAR(255),
      capacity_kw VARCHAR(20),
      city VARCHAR(100),
      vehicle_no VARCHAR(50),
      items_json LONGTEXT NOT NULL,
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bom_challans_no (challan_no)
    )`);
  } catch (e) { console.warn('[BOM Challan schema] Could not ensure bom_challans table:', e.message); }
}
// Adds quantity-based stock tracking alongside the existing serial-based
// model. `serial_no` in stock_ledger is already nullable (DEFAULT NULL) with
// a UNIQUE index that permits multiple NULLs, so no change is needed there.
// Every existing (serial-based) row implicitly represents exactly 1 unit,
// so DEFAULT 1 backfills all of them correctly with zero data risk.
// Non-serial-mandatory categories (per categories.serial_mandatory = 0)
// will instead insert ONE row per purchase/dispatch line with
// serial_no = NULL and quantity = <entered qty>.
async function ensureStockQuantitySchema(pool) {
  try {
    await pool.query(`ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1`);
  } catch (e) { console.warn('[Stock quantity schema] Could not ensure quantity column on stock_ledger (will retry lazily on first use):', e.message); }
}
// Goal: per-item override of the Wattage/Serial "mandatory" rule, plus a
// free-text `model` field for items that need neither (e.g. PVC Pipe,
// distinguished by size/model instead of wattage). These 3 columns are
// nullable and default to NULL, which means "no override — inherit the
// rule from Category Master" (categories.watt_mandatory /
// categories.serial_mandatory). A non-NULL 0/1 here means this specific
// item explicitly overrides its category's default (set manually or via
// the Excel bulk-import's optional wattage_mandatory/serial_mandatory
// columns). Every place that used to read category.watt_mandatory /
// category.serial_mandatory directly must now read the EFFECTIVE value:
// COALESCE(item.watt_mandatory, category.watt_mandatory), same for serial.
async function ensureItemOverrideSchema(pool) {
  try {
    await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS watt_mandatory TINYINT(1) NULL DEFAULT NULL`);
    await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS serial_mandatory TINYINT(1) NULL DEFAULT NULL`);
    await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS model VARCHAR(120) NULL DEFAULT NULL`);
  } catch (e) { console.warn('[Item override schema] Could not ensure watt_mandatory/serial_mandatory/model columns on items (will retry lazily on first use):', e.message); }
}

// Goal: for categories where NEITHER Wattage nor Serial No. applies (e.g.
// PVC Pipe, distinguished by size/model instead), Purchase Inward and
// Project Sales need to record WHICH model of that brand a line is for —
// exactly the same "model" concept already stored on `items` (see
// ensureItemOverrideSchema above). stock_ledger denormalizes category/
// brand_name/watt/solar_type onto every row for fast reads (Purchase
// Register, Reports, etc. read straight from stock_ledger instead of
// joining items every time) — `model` needs the same treatment, or every
// model-based line would be indistinguishable from every other model of
// the same brand once written to stock_ledger (watt is always 0 for them).
// Nullable, defaults to NULL: existing wattage/serial-based rows are
// untouched and simply never populate it.
async function ensureStockModelSchema(pool) {
  try {
    await pool.query(`ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS model VARCHAR(120) NULL DEFAULT NULL`);
  } catch (e) { console.warn('[Stock model schema] Could not ensure model column on stock_ledger (will retry lazily on first use):', e.message); }
}

// Goal: Wattage / Capacity must accept decimal values (e.g. 3.3, 4.2, 0.3)
// instead of being silently rounded to the nearest whole number. Both
// `items.watt` and `stock_ledger.watt` were originally INT columns, so even
// after the frontend was fixed to send decimals, MySQL would still truncate
// them on INSERT/UPDATE. Widening both to DECIMAL(8,2) preserves 2 decimal
// places and is safe to run repeatedly (MODIFY COLUMN is idempotent) and
// safe on existing data (existing whole-number values convert unchanged).
async function ensureWattDecimalSchema(pool) {
  try {
    await pool.query(`ALTER TABLE items MODIFY COLUMN watt DECIMAL(8,2) NOT NULL DEFAULT 0`);
    await pool.query(`ALTER TABLE stock_ledger MODIFY COLUMN watt DECIMAL(8,2) NOT NULL DEFAULT 0`);
  } catch (e) { console.warn('[Watt decimal schema] Could not widen watt column to DECIMAL(8,2) (will retry lazily on first use):', e.message); }
}

// Goal: let Item Registration record whether a Wattage/Capacity value
// should display with a "W" or "kW" suffix (e.g. "545W" vs "5.5kW"),
// instead of always hardcoding "W". Nullable-free with a 'W' default so
// every existing item (registered before this column existed) keeps
// showing exactly as before.
async function ensureWattUnitSchema(pool) {
  try {
    await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS watt_unit VARCHAR(4) NOT NULL DEFAULT 'W'`);
  } catch (e) { console.warn('[Watt unit schema] Could not ensure watt_unit column on items (will retry lazily on first use):', e.message); }
}

module.exports = { ensureStartupSchema };

// Goal 4, Step 2: "Create Dispatch" moves from a frontend-only stub to a
// real, transactional stock deduction. Two additions:
//   1. `bom_dispatches` — one row per Create Dispatch click. There's no
//      persisted BOM record yet (kit contents are still deliberately
//      frontend-only — most kit items aren't registered in Masters yet,
//      per explicit instruction), so this table doubles as the only
//      durable record that a dispatch happened at all: which order it was
//      for, who dispatched it, when, and a snapshot of exactly what was
//      sent (header_json/items_json) for later reference/audit. It is
//      also the anchor Steps 3 (partial dispatch) and 4 (Pending BOM
//      Register) will build on — a `bom_no`/proper BOM identity can be
//      layered on top of this later without re-touching stock_ledger.
//   2. `stock_ledger.bom_dispatch_id` — every row a BOM dispatch touches
//      (serial-based UPDATE or quantity-based FIFO split/UPDATE) is tagged
//      with the bom_dispatches.id that consumed it. This is what stays
//      traceable regardless of which status string ends up being used
//      (see BOM_DISPATCH_STATUS in api/routes/bom.routes.js — still a
//      single easy-to-change constant, business decision on 'Sold' vs a
//      dedicated status not made yet).
async function ensureBomDispatchSchema(pool) {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS bom_dispatches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_no VARCHAR(100),
      header_json LONGTEXT,
      items_json LONGTEXT NOT NULL,
      dispatched_by VARCHAR(100),
      dispatched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_bom_dispatches_order (order_no)
    )`);
    await pool.query(`ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS bom_dispatch_id INT NULL DEFAULT NULL`);
  } catch (e) { console.warn('[BOM dispatch schema] Could not ensure bom_dispatches table / bom_dispatch_id column (will retry lazily on first use):', e.message); }
}

// Goal 4, Step 3: Partial Dispatch + Pending Qty tracking.
// A single BOM can now be dispatched across MULTIPLE trips (e.g. site can
// only fit half the panels today, rest goes next week) instead of one
// all-or-nothing "Create Dispatch". `bom_orders` is the new durable anchor
// for "this Order No. is one BOM order" — one row per Order No., created
// the FIRST time that order is dispatched. `items_json` on this row is the
// frozen BASELINE (the full originally-required qty per item, captured
// once and never silently changed by a later trip's edits) that every
// later partial trip's "how much is still pending?" math is computed
// against. `bom_dispatches.bom_order_id` links each individual trip back
// to its order — pending-remaining for an item is always baseline qty
// minus the SUM of that item's qty across every bom_dispatches row sharing
// the same bom_order_id (computed fresh each time in bom.routes.js rather
// than cached here, so it's always correct even if a dispatch is ever
// manually corrected in the DB).
// `status`: 'Open' while any baseline item still has qty pending,
// 'Completed' once every baseline item's pending reaches 0 — set by
// bom.routes.js after each successful dispatch, not by this schema file.
async function ensureBomOrderSchema(pool) {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS bom_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_no VARCHAR(100) NOT NULL,
      header_json LONGTEXT,
      items_json LONGTEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Open',
      created_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE INDEX uniq_bom_orders_order_no (order_no)
    )`);
    await pool.query(`ALTER TABLE bom_dispatches ADD COLUMN IF NOT EXISTS bom_order_id INT NULL DEFAULT NULL`);
  } catch (e) { console.warn('[BOM order schema] Could not ensure bom_orders table / bom_order_id column (will retry lazily on first use):', e.message); }
}

// Goal 5: "Convert into Challan" compresses the ~53-line BOM kit down into
// the Challan's ~14 fixed summary rows (see BOM_CHALLAN_TEMPLATE in
// bom.js / CHALLAN_CATEGORIES in bom.routes.js). WHICH BOM item folds into
// WHICH Challan category used to have no representation at all (Challan
// Qty was 100% hand-typed by whoever printed it). This table is that
// mapping, one row per distinct BOM item name -> one of the fixed Challan
// category names — deliberately a plain DB table (not hardcoded in JS) so
// it's editable from the app (Masters-style admin screen) as item names
// change/grow, instead of needing a code deploy every time. `item_name` is
// unique/PK: every BOM item name maps to exactly one Challan category.
// Seeded once from the user's source Excel (Book1.xlsx) mapping sheet —
// INSERT IGNORE so re-running this on every startup never clobbers any
// category re-assignment made later from the admin screen.
async function ensureChallanCategoryMapSchema(pool) {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS challan_category_map (
      item_name VARCHAR(190) NOT NULL PRIMARY KEY,
      challan_category VARCHAR(60) NOT NULL,
      updated_by VARCHAR(100),
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    const seed = [
      ['Solar Penal', 'Solar Panel'],
      ['DCR Solar Penal', 'Solar Panel'],
      ['GI Structure', 'GI Structure'],
      ['LA Bracket', 'GI Structure'],
      ['GI PIPE', 'GI Pipe'],
      ['GI Pipe', 'GI Pipe'],
      ['Base Plate', 'Bom Box'],
      ['Base Angle', 'Bom Box'],
      ['Wall Patti', 'Bom Box'],
      ['LA Patti', 'Bom Box'],
      ['Anchor Bolt (Pin)', 'Bom Box'],
      ['American Bolt', 'Bom Box'],
      ['Stud Bolt with Nut & Washer', 'Bom Box'],
      ['Clamps', 'Bom Box'],
      ['U - Bolt with Nut Bolt', 'Bom Box'],
      ['Nut Bolt - GI 4 Aani X 0.5" Long', 'Bom Box'],
      ['Nut Bolt - SS 4 Aani X 1.5" Long', 'Bom Box'],
      ['Nut Bolt - SS 4 Aani X 2.5" Long', 'Bom Box'],
      ['Nut Bolt - SS 5 Aani X 3" Long', 'Bom Box'],
      ['Nito Bond Chemical', 'Bom Box'],
      ['ACDB Box', 'Bom Box'],
      ['DCDB Box', 'Bom Box'],
      ['MC 4 Connector', 'Bom Box'],
      ['Lug', 'Bom Box'],
      ['PVC Albow', 'Bom Box'],
      ['PVC Bend', 'Bom Box'],
      ['PVC Tee', 'Bom Box'],
      ['PVC Coupler', 'Bom Box'],
      ['Bendable Pipe', 'Bom Box'],
      ['Clamp for Pipe', 'Bom Box'],
      ['Cable Tie (PVC)', 'Bom Box'],
      ['Cable Tie (S.S)', 'Bom Box'],
      ['Screw + Grip', 'Bom Box'],
      ['MCB', 'Bom Box'],
      ['Nozzle Kit', 'Bom Box'],
      ['Zinc Spray', 'Bom Box'],
      ['Solar Inverter - DEYE', 'Inverter'],
      ['Earthing Rod & LA Kit', 'Earthing & LA Kit'],
      ['DC Wire - Red - Polycab', 'Wire Box'],
      ['DC Wire - Black - Polycab', 'Wire Box'],
      ['DC Earthing Wire - Yellow - Polycab', 'Wire Box'],
      ['AC Earthing Wire - Green - Polycab', 'Wire Box'],
      ['LA Earthing Wire - Green (Allu.) - Aircab', 'Wire Box'],
      ['AC - 2 Core - Polycab', 'Wire Box'],
      ['AC - 4 Core - Polycab', 'Wire Box'],
      ['PVC Pipe', 'PVC Pipe'],
      ['Cable Tray', 'PVC Pipe'],
      ['Sand - Rati', 'Reti Bag'],
      ['Grit - Kapchi', 'Kapchi Bag'],
      ['Cement', 'Cement Bag'],
      ['Farma', 'Ferma'],
    ];
    for (const [itemName, category] of seed) {
      await pool.query(
        `INSERT IGNORE INTO challan_category_map (item_name, challan_category) VALUES (?, ?)`,
        [itemName, category]
      );
    }
  } catch (e) { console.warn('[Challan category map schema] Could not ensure challan_category_map table:', e.message); }
}