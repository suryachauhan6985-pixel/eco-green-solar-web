// server.js
// -----------------------------------------------------------------------------
// Eco Green Solar ERP — Web Backend API (FULL MASTERS LOGIC)
// -----------------------------------------------------------------------------

const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors()); 
app.use(express.json());

// Frontend static files bhi isi Express server se serve karo (index.html,
// css/, js/, assets/) — ab Live Server ki zarurat nahi, ek hi process/port
// (5000) pe pura app (UI + API) chalega, jo public tunnel ke liye zaroori hai.
app.use(express.static(path.join(__dirname, '..')));

// DB Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || '192.168.0.123',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_NAME || 'eco_green_solar_erp',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // TiDB Cloud (aur kai cloud DB providers) SSL/TLS ke bina connection allow
  // nahi karte ("insecure transport" error). DB_SSL=true set hone par SSL
  // enable ho jayega; local MariaDB (192.168.0.123) ke liye ye env var set
  // nahi hoga to normal (bina SSL) connect hota rahega.
  ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
});

// Helper for error handling
function route(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error('[API ERROR]', req.method, req.originalUrl, err.message);
      res.status(500).json({ error: 'Server/DB error', detail: err.message });
    }
  };
}

// Health check
app.get('/api/health', route(async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// DASHBOARD — real live numbers from stock_ledger + items (same MariaDB
// the desktop .py app uses). Matches ui/dashboard.py's counting logic
// (per-status counts + get_low_stock_items()).
// ---------------------------------------------------------------------------
app.get('/api/dashboard/summary', route(async (req, res) => {
  const [[totals]] = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN status='Available' THEN 1 ELSE 0 END),0) AS available,
      COALESCE(SUM(CASE WHEN status='Assigned' THEN 1 ELSE 0 END),0) AS assigned,
      COALESCE(SUM(CASE WHEN status='Sold' THEN 1 ELSE 0 END),0) AS sold,
      COALESCE(SUM(CASE WHEN status='Damaged' THEN 1 ELSE 0 END),0) AS damaged
    FROM stock_ledger
  `);

  const [categorySnapshot] = await pool.query(`
    SELECT i.category AS category,
      COALESCE(SUM(CASE WHEN s.status='Available' THEN 1 ELSE 0 END),0) AS avail,
      COALESCE(SUM(CASE WHEN s.status='Assigned' THEN 1 ELSE 0 END),0) AS assigned,
      COALESCE(SUM(CASE WHEN s.status='Sold' THEN 1 ELSE 0 END),0) AS sold,
      COALESCE(SUM(CASE WHEN s.status='Damaged' THEN 1 ELSE 0 END),0) AS damaged
    FROM items i
    LEFT JOIN stock_ledger s ON s.item_id = i.id
    GROUP BY i.category
    ORDER BY i.category ASC
  `);

  const [[{ lowStockCount }]] = await pool.query(`
    SELECT COUNT(*) AS lowStockCount FROM (
      SELECT i.id, i.minimum_stock,
        COALESCE(SUM(CASE WHEN s.status='Available' THEN 1 ELSE 0 END),0) AS current_stock
      FROM items i
      LEFT JOIN stock_ledger s ON s.item_id = i.id
      WHERE i.minimum_stock > 0
      GROUP BY i.id, i.minimum_stock
      HAVING COALESCE(SUM(CASE WHEN s.status='Available' THEN 1 ELSE 0 END),0) <= i.minimum_stock
    ) t
  `);

  res.json({
    available: totals.available,
    assigned: totals.assigned,
    sold: totals.sold,
    damaged: totals.damaged,
    lowStockCount,
    categorySnapshot,
  });
}));
// ---------------------------------------------------------------------------
// AUTH — real login verification against the `users` table (same table +
// same exact-match rule the desktop .py app uses in
// database/db.py -> validate_user_credentials():
//   SELECT role FROM users WHERE username=%s AND password=%s
// Previously there was NO login endpoint at all — the frontend accepted
// any non-empty username/password without checking the DB. This endpoint
// fixes that: it looks up the user, and only returns success if the
// username AND password match a row. The role returned comes from the DB,
// not from anything the client sends.
// ---------------------------------------------------------------------------
app.post('/api/auth/login', route(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter both username and password.' });
  }
  const uname = username.trim().toLowerCase();
  const [rows] = await pool.query(
    `SELECT role FROM users WHERE username = ? AND password = ?`,
    [uname, password]
  );
  if (!rows.length) {
    return res.status(401).json({ error: 'Incorrect Username or Password.' });
  }
  res.json({ success: true, username: uname, role: rows[0].role });
}));

// ---------------------------------------------------------------------------
// MASTER MANAGEMENT SYSTEM ENDPOINTS
// ---------------------------------------------------------------------------

// Categories
app.get('/api/masters/categories', route(async (req, res) => {
  const [rows] = await pool.query(`SELECT c.id, c.name, COALESCE(c.watt_mandatory,0) AS watt_mandatory, (SELECT COUNT(*) FROM items i WHERE i.category = c.name) AS item_count FROM categories c ORDER BY c.name ASC`);
  res.json(rows);
}));

app.post('/api/masters/categories', route(async (req, res) => {
  const { name, watt_mandatory } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name required' });
  await pool.query(`INSERT INTO categories (name, watt_mandatory) VALUES (?, ?)`, [name, watt_mandatory ? 1 : 0]);
  res.json({ success: true });
}));

// Category: update wattage-mandatory rule
app.put('/api/masters/categories/:name/watt-rule', route(async (req, res) => {
  const { name } = req.params;
  const { watt_mandatory } = req.body;
  await pool.query(`UPDATE categories SET watt_mandatory = ? WHERE name = ?`, [watt_mandatory ? 1 : 0, name]);
  res.json({ success: true });
}));

// Category: delete (blocked if items still exist under it)
app.delete('/api/masters/categories/:name', route(async (req, res) => {
  const { name } = req.params;
  const [[{ cnt }]] = await pool.query(`SELECT COUNT(*) AS cnt FROM items WHERE category = ?`, [name]);
  if (cnt > 0) {
    return res.status(400).json({ error: `Cannot delete '${name}': ${cnt} item(s) still registered under this category.` });
  }
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
// PURCHASE INWARD — cascading dropdown fetch (Category -> Brand -> Wattage),
// same logic as the desktop app's db.py: get_brands_for_category() and
// get_wattages_for_brand_category(). Both read straight from the `items`
// table (unlike the global /api/masters/brands above, these are filtered).
// ---------------------------------------------------------------------------

// Brands registered under one category (used when Category dropdown changes)
app.get('/api/purchase/brands/:category', route(async (req, res) => {
  const { category } = req.params;
  const [rows] = await pool.query(
    `SELECT DISTINCT brand_name FROM items WHERE category = ? AND brand_name IS NOT NULL AND brand_name <> '' ORDER BY brand_name ASC`,
    [category]
  );
  res.json(rows.map(r => r.brand_name));
}));

// Wattages registered for one category+brand combo (used when Brand dropdown changes)
app.get('/api/purchase/wattages', route(async (req, res) => {
  const { category, brand } = req.query;
  if (!category || !brand) return res.json([]);
  const [rows] = await pool.query(
    `SELECT DISTINCT watt FROM items WHERE category = ? AND brand_name = ? AND watt IS NOT NULL AND watt > 0 ORDER BY watt ASC`,
    [category, brand]
  );
  res.json(rows.map(r => r.watt));
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
app.get('/api/masters/items', route(async (req, res) => {
  const [rows] = await pool.query(`SELECT id, name, brand_name, watt, solar_type, category, uom, minimum_stock FROM items ORDER BY category ASC, brand_name ASC`);
  res.json(rows);
}));

app.post('/api/masters/items', route(async (req, res) => {
  const { name, brand_name, watt, solar_type, category, uom, minimum_stock } = req.body;
  await pool.query(`
    INSERT INTO items (name, brand_name, watt, solar_type, category, uom, minimum_stock) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [name || `${brand_name} ${watt || ''}`.trim(), brand_name, watt || 0, solar_type || '-', category, uom || 'Nos', minimum_stock || 0]);
  res.json({ success: true });
}));

app.put('/api/masters/items/:id', route(async (req, res) => {
  const { id } = req.params;
  const { name, brand_name, watt, solar_type, category, uom, minimum_stock } = req.body;
  await pool.query(`
    UPDATE items 
    SET name = ?, brand_name = ?, watt = ?, solar_type = ?, category = ?, uom = ?, minimum_stock = ?
    WHERE id = ?
  `, [name || `${brand_name} ${watt || ''}`.trim(), brand_name, watt || 0, solar_type || '-', category, uom || 'Nos', minimum_stock || 0, id]);
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

// Users — same 2 actions as desktop app's Masters > System Access & User
// Management: Create User + Update Password. No delete/edit — desktop app
// doesn't have that either, so web mirrors it exactly.
app.get('/api/masters/users', route(async (req, res) => {
  const [rows] = await pool.query(`SELECT username, role FROM users ORDER BY username ASC`);
  res.json(rows);
}));

app.post('/api/masters/users', route(async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and Password are mandatory.' });
  const uname = username.trim().toLowerCase();
  try {
    await pool.query(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, [uname, password, role || 'User']);
    await pool.query(`INSERT IGNORE INTO user_sessions (username, is_logged_in, last_login_time) VALUES (?, 0, '-')`, [uname]);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Username already taken.' });
  }
}));

app.put('/api/masters/users/password', route(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and new Password are mandatory.' });
  const [result] = await pool.query(`UPDATE users SET password = ? WHERE username = ?`, [password, username.trim().toLowerCase()]);
  if (result.affectedRows === 0) return res.status(400).json({ error: 'User configuration profile not found.' });
  res.json({ success: true });
}));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API running on port ${PORT}`);
});