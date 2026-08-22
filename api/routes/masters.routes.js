module.exports = function registerMastersRoutes(app, deps) {
  const { pool, route, requireRole, hashPassword } = deps;
  const VALID_ROLES = ['User', 'Admin', 'SuperAdmin'];

  // ---------------------------------------------------------------------------
  // MASTER MANAGEMENT SYSTEM ENDPOINTS
  // ---------------------------------------------------------------------------

  // Categories
  app.get('/api/masters/categories', route(async (req, res) => {
    const [rows] = await pool.query(`SELECT c.id, c.name, COALESCE(c.watt_mandatory,0) AS watt_mandatory, COALESCE(c.serial_mandatory,0) AS serial_mandatory, (SELECT COUNT(*) FROM items i WHERE i.category = c.name) AS item_count FROM categories c ORDER BY c.name ASC`);
    res.json(rows);
  }));

  app.post('/api/masters/categories', route(async (req, res) => {
    const { name, watt_mandatory, serial_mandatory } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name required' });
    await pool.query(`INSERT INTO categories (name, watt_mandatory, serial_mandatory) VALUES (?, ?, ?)`, [name, watt_mandatory ? 1 : 0, serial_mandatory ? 1 : 0]);
    res.json({ success: true });
  }));

  // Category: update wattage-mandatory rule
  app.put('/api/masters/categories/:name/watt-rule', route(async (req, res) => {
    const { name } = req.params;
    const { watt_mandatory } = req.body;
    await pool.query(`UPDATE categories SET watt_mandatory = ? WHERE name = ?`, [watt_mandatory ? 1 : 0, name]);
    res.json({ success: true });
  }));

  // Category: update serial-no-mandatory rule
  app.put('/api/masters/categories/:name/serial-rule', route(async (req, res) => {
    const { name } = req.params;
    const { serial_mandatory } = req.body;
    await pool.query(`UPDATE categories SET serial_mandatory = ? WHERE name = ?`, [serial_mandatory ? 1 : 0, name]);
    res.json({ success: true });
  }));

  // Category: delete — cascades to every item registered under it (parent
  // delete removes its children), but stays blocked if ANY of those items
  // still carry stock_ledger history (purchased/dispatched stock), so real
  // inventory/transaction data can never be silently wiped out. Same
  // protective pattern as the standalone Item delete endpoint below.
  app.delete('/api/masters/categories/:name', route(async (req, res) => {
    const { name } = req.params;
    const [[{ cnt }]] = await pool.query(`
      SELECT COUNT(*) AS cnt FROM stock_ledger sl
      JOIN items i ON i.id = sl.item_id
      WHERE i.category = ?
    `, [name]);
    if (cnt > 0) {
      return res.status(400).json({ error: `Cannot delete '${name}': ${cnt} stock record(s) exist for item(s) under this category. Clear/reassign that stock first.` });
    }
    await pool.query(`DELETE FROM items WHERE category = ?`, [name]);
    const [result] = await pool.query(`DELETE FROM categories WHERE name = ?`, [name]);
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Category not found.' });
    res.json({ success: true });
  }));

  // ---------------------------------------------------------------------------
  // SUBTYPES (per category) — DCR / Non-DCR / On-Grid / Hybrid etc.
  // ---------------------------------------------------------------------------
  app.get('/api/masters/subtypes/:category', route(async (req, res) => {
    const { category } = req.params;
    const [rows] = await pool.query(`SELECT subtype_name FROM subtypes WHERE category_name = ? ORDER BY subtype_name ASC`, [category]);
    res.json(rows.map(r => r.subtype_name));
  }));

  app.post('/api/masters/subtypes', route(async (req, res) => {
    const { category_name, subtype_name } = req.body;
    if (!category_name || !subtype_name) return res.status(400).json({ error: 'Category and subtype name required' });
    await pool.query(`INSERT INTO subtypes (category_name, subtype_name) VALUES (?, ?)`, [category_name, subtype_name]);
    res.json({ success: true });
  }));

  app.put('/api/masters/subtypes', route(async (req, res) => {
    const { category_name, old_name, new_name } = req.body;
    const [result] = await pool.query(`UPDATE subtypes SET subtype_name = ? WHERE category_name = ? AND subtype_name = ?`, [new_name, category_name, old_name]);
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Original subtype not found.' });
    res.json({ success: true });
  }));

  app.delete('/api/masters/subtypes', route(async (req, res) => {
    const { category_name, subtype_name } = req.body;
    const [result] = await pool.query(`DELETE FROM subtypes WHERE category_name = ? AND subtype_name = ?`, [category_name, subtype_name]);
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Subtype not found.' });
    res.json({ success: true });
  }));

  // ---------------------------------------------------------------------------
  // UNITS (UOM) MASTER — previously hardcoded on the frontend
  // ---------------------------------------------------------------------------
  app.get('/api/masters/units', route(async (req, res) => {
    const [rows] = await pool.query(`SELECT name FROM units ORDER BY name ASC`);
    res.json(rows.map(r => r.name));
  }));

  app.post('/api/masters/units', route(async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Unit name required' });
    await pool.query(`INSERT INTO units (name) VALUES (?)`, [name]);
    res.json({ success: true });
  }));

  app.put('/api/masters/units', route(async (req, res) => {
    const { old_name, new_name } = req.body;
    const [result] = await pool.query(`UPDATE units SET name = ? WHERE name = ?`, [new_name, old_name]);
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Original unit not found.' });
    await pool.query(`UPDATE items SET uom = ? WHERE uom = ?`, [new_name, old_name]);
    res.json({ success: true });
  }));

  app.delete('/api/masters/units', route(async (req, res) => {
    const { name } = req.body;
    const [[{ cnt }]] = await pool.query(`SELECT COUNT(*) AS cnt FROM items WHERE uom = ?`, [name]);
    if (cnt > 0) return res.status(400).json({ error: `Cannot delete '${name}': ${cnt} item(s) using this unit.` });
    const [result] = await pool.query(`DELETE FROM units WHERE name = ?`, [name]);
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Unit not found.' });
    res.json({ success: true });
  }));

  // Items Read + Create + Update Profile (Desktop matching attributes)
  // watt_mandatory/serial_mandatory here are the raw per-item OVERRIDE
  // values (NULL = no override, inherits Category Master's rule). The
  // *_effective columns are what every UI/consumer should actually check —
  // COALESCE(item override, category default) — so old callers that only
  // look at watt/category still work unchanged.
  app.get('/api/masters/items', route(async (req, res) => {
    const [rows] = await pool.query(`
      SELECT i.id, i.name, i.brand_name, i.watt, i.watt_unit, i.solar_type, i.category, i.uom, i.minimum_stock,
             i.model, i.watt_mandatory, i.serial_mandatory,
             COALESCE(i.watt_mandatory, c.watt_mandatory, 0) AS watt_mandatory_effective,
             COALESCE(i.serial_mandatory, c.serial_mandatory, 0) AS serial_mandatory_effective
      FROM items i
      LEFT JOIN categories c ON c.name = i.category
      ORDER BY i.category ASC, i.brand_name ASC
    `);
    res.json(rows);
  }));

  // Normalizes an incoming Wattage unit into exactly 'W' or 'kW' — anything
  // else (blank, garbage, omitted) falls back to 'W', same "W unless kW is
  // explicitly chosen" rule the Item Registration form itself follows.
  function normalizeWattUnit(val) {
    const s = String(val || '').trim().toLowerCase();
    return s === 'kw' ? 'kW' : 'W';
  }

  // Normalizes an incoming override value into: true / false / null.
  // null means "not specified — inherit Category Master's rule". Accepts
  // booleans, 0/1, and the Yes/No/Mandatory/Optional strings the Excel
  // bulk-import (Goal 11) columns use.
  function normalizeOverrideFlag(val) {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'boolean') return val;
    const s = String(val).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'mandatory', 'required'].includes(s)) return true;
    if (['0', 'false', 'no', 'n', 'optional', 'not mandatory', 'not required'].includes(s)) return false;
    return null;
  }

  // Shared validation used by both the manual "Save Product Profile" form
  // and the bulk Excel import (Goal 11) — kept server-side too so bad rows
  // never slip in even if a client (or a future import path) skips its own
  // checks. Returns a { error } string, or null if the row is valid.
  // `watt_mandatory`/`serial_mandatory` here are raw per-item OVERRIDES
  // (true/false/null) — pass through normalizeOverrideFlag() first.
  async function validateItemPayload({ brand_name, watt, category, model, watt_mandatory, serial_mandatory, editingId }) {
    if (!brand_name || !String(brand_name).trim()) return 'Brand Name is required.';
    if (!category || !String(category).trim()) return 'Category is required.';
    const [[catRow]] = await pool.query(
      `SELECT name, COALESCE(watt_mandatory,0) AS watt_mandatory, COALESCE(serial_mandatory,0) AS serial_mandatory FROM categories WHERE name = ?`,
      [category],
    );
    if (!catRow) return `Category '${category}' does not exist. Create it first in Category Master.`;

    const effWatt = watt_mandatory === null || watt_mandatory === undefined ? !!catRow.watt_mandatory : !!watt_mandatory;
    const effSerial = serial_mandatory === null || serial_mandatory === undefined ? !!catRow.serial_mandatory : !!serial_mandatory;

    if (effWatt && (!watt || Number(watt) <= 0)) {
      return `Wattage/Capacity is mandatory for '${brand_name}' under category '${category}'.`;
    }
    // Neither Wattage nor Serial No. applies to this item — Model becomes
    // the mandatory differentiator instead (e.g. PVC Pipe "2 Inch").
    if (!effWatt && !effSerial && (!model || !String(model).trim())) {
      return `Model is mandatory for '${brand_name}' under category '${category}' (no Wattage/Serial No. rule applies here).`;
    }

    // Duplicate check: same category + brand, differentiated by watt when
    // wattage applies, otherwise by model (case-insensitive either way).
    const hasWatt = Number(watt) > 0;
    const dupParams = hasWatt
      ? [category, String(brand_name).trim(), Number(watt)]
      : [category, String(brand_name).trim(), String(model || '').trim()];
    let dupQuery = hasWatt
      ? `SELECT id FROM items WHERE category = ? AND LOWER(brand_name) = LOWER(?) AND watt = ?`
      : `SELECT id FROM items WHERE category = ? AND LOWER(brand_name) = LOWER(?) AND LOWER(COALESCE(model,'')) = LOWER(?)`;
    if (editingId) { dupQuery += ` AND id <> ?`; dupParams.push(editingId); }
    const [[dupRow]] = await pool.query(dupQuery, dupParams);
    if (dupRow) {
      return hasWatt
        ? `An item with brand '${brand_name}', wattage '${watt || 0}' already exists under '${category}'.`
        : `An item with brand '${brand_name}', model '${model || ''}' already exists under '${category}'.`;
    }
    return null;
  }

  app.post('/api/masters/items', route(async (req, res) => {
    const { name, brand_name, watt, watt_unit, solar_type, category, uom, minimum_stock, model, watt_mandatory, serial_mandatory } = req.body;
    const wattOverride = normalizeOverrideFlag(watt_mandatory);
    const serialOverride = normalizeOverrideFlag(serial_mandatory);
    const errMsg = await validateItemPayload({ brand_name, watt, category, model, watt_mandatory: wattOverride, serial_mandatory: serialOverride });
    if (errMsg) return res.status(400).json({ error: errMsg });
    await pool.query(`
      INSERT INTO items (name, brand_name, watt, watt_unit, solar_type, category, uom, minimum_stock, model, watt_mandatory, serial_mandatory) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name || `${brand_name} ${watt || model || ''}`.trim(), brand_name, watt || 0, normalizeWattUnit(watt_unit), solar_type || '-', category, uom || 'Nos', minimum_stock || 0, model ? String(model).trim() : null, wattOverride, serialOverride]);
    res.json({ success: true });
  }));

  app.put('/api/masters/items/:id', route(async (req, res) => {
    const { id } = req.params;
    const { name, brand_name, watt, watt_unit, solar_type, category, uom, minimum_stock, model, watt_mandatory, serial_mandatory } = req.body;
    const wattOverride = normalizeOverrideFlag(watt_mandatory);
    const serialOverride = normalizeOverrideFlag(serial_mandatory);
    const errMsg = await validateItemPayload({ brand_name, watt, category, model, watt_mandatory: wattOverride, serial_mandatory: serialOverride, editingId: id });
    if (errMsg) return res.status(400).json({ error: errMsg });
    await pool.query(`
      UPDATE items 
      SET name = ?, brand_name = ?, watt = ?, watt_unit = ?, solar_type = ?, category = ?, uom = ?, minimum_stock = ?, model = ?, watt_mandatory = ?, serial_mandatory = ?
      WHERE id = ?
    `, [name || `${brand_name} ${watt || model || ''}`.trim(), brand_name, watt || 0, normalizeWattUnit(watt_unit), solar_type || '-', category, uom || 'Nos', minimum_stock || 0, model ? String(model).trim() : null, wattOverride, serialOverride, id]);
    res.json({ success: true });
  }));

  // Item: delete a single registered item — blocked if any stock_ledger
  // row (purchased or dispatched) still references it, so a delete can
  // never silently erase real purchase/sale/stock history. Same guarded
  // pattern as Units/Warehouses delete above.
  app.delete('/api/masters/items/:id', route(async (req, res) => {
    const { id } = req.params;
    const [[{ cnt }]] = await pool.query(`SELECT COUNT(*) AS cnt FROM stock_ledger WHERE item_id = ?`, [id]);
    if (cnt > 0) {
      return res.status(400).json({ error: `Cannot delete this item: ${cnt} stock record(s) (purchase/stock history) exist for it. Clear/reassign that stock first.` });
    }
    const [result] = await pool.query(`DELETE FROM items WHERE id = ?`, [id]);
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Item not found.' });
    res.json({ success: true });
  }));

  // Warehouses
  app.get('/api/masters/warehouses', route(async (req, res) => {
    const [rows] = await pool.query(`SELECT w.id, w.name, w.location, (SELECT COUNT(*) FROM stock_ledger sl WHERE sl.warehouse = w.name) AS items_stored FROM warehouses w ORDER BY w.name ASC`);
    res.json(rows);
  }));

  app.post('/api/masters/warehouses', route(async (req, res) => {
    const { name, location } = req.body;
    await pool.query(`INSERT INTO warehouses (name, location) VALUES (?, ?)`, [name, location || '']);
    res.json({ success: true });
  }));

  app.put('/api/masters/warehouses', route(async (req, res) => {
    const { old_name, new_name } = req.body;
    const [result] = await pool.query(`UPDATE warehouses SET name = ? WHERE name = ?`, [new_name, old_name]);
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Original warehouse not found.' });
    await pool.query(`UPDATE stock_ledger SET warehouse = ? WHERE warehouse = ?`, [new_name, old_name]);
    res.json({ success: true });
  }));

  app.delete('/api/masters/warehouses', route(async (req, res) => {
    const { name } = req.body;
    const [[{ cnt }]] = await pool.query(`SELECT COUNT(*) AS cnt FROM stock_ledger WHERE warehouse = ?`, [name]);
    if (cnt > 0) return res.status(400).json({ error: `Cannot delete '${name}': ${cnt} stock record(s) tagged with this warehouse.` });
    const [result] = await pool.query(`DELETE FROM warehouses WHERE name = ?`, [name]);
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Warehouse not found.' });
    res.json({ success: true });
  }));

  // Dummy placeholder for user registry matching system sessions
  app.get('/api/masters/brands', route(async (req, res) => {
    const [rows] = await pool.query(`
      SELECT brand_name, COUNT(*) AS item_count
      FROM items
      WHERE brand_name IS NOT NULL AND brand_name <> ''
      GROUP BY brand_name
      ORDER BY brand_name ASC
    `);
    res.json(rows);
  }));

  // Users — SuperAdmin & Admin access
  app.get('/api/masters/users', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const [rows] = await pool.query(`SELECT username, role, email FROM users ORDER BY username ASC`);
    res.json(rows);
  }));

  app.post('/api/masters/users', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const { username, password, role, email } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and Password are mandatory.' });
    const uname = username.trim().toLowerCase();
    const mail = email ? email.trim().toLowerCase() : null;
    const finalRole = role || 'User';
    if (!VALID_ROLES.includes(finalRole)) {
      return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}.` });
    }
    // Same email can be reused across different roles, but never twice for
    // the same role — mirrors the rule enforced on self-registration.
    if (mail) {
      const [[emailRoleTaken]] = await pool.query(`SELECT username FROM users WHERE LOWER(email) = ? AND role = ?`, [mail, finalRole]);
      if (emailRoleTaken) return res.status(400).json({ error: `A ${finalRole} account with that email already exists.` });
    }
    try {
      const hashed = await hashPassword(password);
      await pool.query(`INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)`, [uname, hashed, finalRole, mail]);
      await pool.query(`INSERT IGNORE INTO user_sessions (username, is_logged_in, last_login_time) VALUES (?, 0, '-')`, [uname]);
      res.json({ success: true });
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        const msg = String(err.sqlMessage || err.message || '');
        if (msg.includes('uniq_email_role')) {
          return res.status(400).json({ error: `A ${finalRole} account with that email already exists.` });
        }
        return res.status(400).json({ error: 'Username already taken.' });
      }
      res.status(400).json({ error: 'Username already taken.' });
    }
  }));

  app.put('/api/masters/users/password', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and new Password are mandatory.' });
    const hashed = await hashPassword(password);
    const [result] = await pool.query(`UPDATE users SET password = ? WHERE username = ?`, [hashed, username.trim().toLowerCase()]);
    if (result.affectedRows === 0) return res.status(400).json({ error: 'User configuration profile not found.' });
    res.json({ success: true });
  }));

  // Sets/updates the email OTP login relies on for a given user — separate
  // from the password update so an admin can fix/add just the email without
  // touching the password.
  app.put('/api/masters/users/email', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const { username, email } = req.body;
    if (!username || !email) return res.status(400).json({ error: 'Username and Email are mandatory.' });
    const [result] = await pool.query(
      `UPDATE users SET email = ? WHERE username = ?`,
      [email.trim().toLowerCase(), username.trim().toLowerCase()]
    );
    if (result.affectedRows === 0) return res.status(400).json({ error: 'User configuration profile not found.' });
    res.json({ success: true });
  }));

};