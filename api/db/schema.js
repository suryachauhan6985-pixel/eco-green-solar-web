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

module.exports = { ensureStartupSchema };