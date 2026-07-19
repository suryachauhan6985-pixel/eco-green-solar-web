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
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'admin',
  database: process.env.DB_NAME || 'eco_green_solar_erp',
  ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2' } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
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

// Which of the given serial numbers already exist in stock_ledger — mirrors
// process_purchase_inward()'s per-serial "SELECT COUNT(*) FROM stock_ledger
// WHERE serial_no=%s" duplicate check from the desktop app. Called by the
// Purchase form right before saving, so an already-used serial blocks the
// inward before it ever reaches the database.
app.get('/api/purchase/check-serials', route(async (req, res) => {
  const serials = String(req.query.serials || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!serials.length) return res.json([]);
  const [rows] = await pool.query(
    `SELECT DISTINCT serial_no FROM stock_ledger WHERE serial_no IN (?)`,
    [serials]
  );
  res.json(rows.map(r => r.serial_no));
}));

// ---------------------------------------------------------------------------
// LEDGERS (Supplier / Customer master) — mirrors db.py's
// search_ledgers_for_autocomplete() / find_ledger_by_shortname() /
// find_ledger_by_name_or_shortname() from the desktop app. Used for the live
// autocomplete + auto-fill on the Purchase (Supplier) form, and reusable for
// Sales (Customer) the same way.
//   GET /api/ledgers?type=Supplier&q=sur   -> up to 25 matches while typing
//   GET /api/ledgers?type=Supplier         -> full list (q omitted/empty)
// ---------------------------------------------------------------------------
app.get('/api/ledgers', route(async (req, res) => {
  const q = (req.query.q || '').trim();
  const type = req.query.type && req.query.type !== 'All' ? req.query.type : null;

  let sql = `SELECT id, ledger_name, short_name, ledger_type, mobile, address, gstin FROM ledgers`;
  const params = [];
  const where = [];

  if (q) {
    where.push(`(ledger_name LIKE ? OR short_name LIKE ?)`);
    params.push(`%${q}%`, `%${q}%`);
  }
  if (type) {
    where.push(`(ledger_type = ? OR ledger_type = 'Both')`);
    params.push(type);
  }
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ` ORDER BY ledger_name ASC LIMIT ${q ? 25 : 200}`;

  const [rows] = await pool.query(sql, params);
  res.json(rows.map((r) => ({
    id: r.id,
    name: r.ledger_name,
    short: r.short_name,
    type: r.ledger_type,
    mobile: r.mobile,
    address: r.address,
    gstin: r.gstin,
  })));
}));

// ---------------------------------------------------------------------------
// SUPPLIER/CUSTOMER SHORT CODE LOOKUP — used by the Purchase (and Sales)
// "Short Code" field autocomplete. Mirrors the desktop app's
// attach_ledger_shortname_lookup(), which builds its suggestion list ONLY
// from ledgers.short_name (never ledger_name). The combined /api/ledgers
// endpoint above matches ledger_name OR short_name together, which is fine
// for the Supplier Name field, but for the Short Code field it let ledgers
// that only matched by NAME (with a blank short_name) crowd out the ones
// that actually had a matching short code — so only one supplier's short
// code (e.g. "DSP") was ever suggested, even though many suppliers exist.
//   GET /api/ledgers/shortcodes?type=Supplier&q=ds   -> up to 25 matches
//   GET /api/ledgers/shortcodes?type=Supplier        -> full list (q omitted)
// ---------------------------------------------------------------------------
app.get('/api/ledgers/shortcodes', route(async (req, res) => {
  const q = (req.query.q || '').trim();
  const type = req.query.type && req.query.type !== 'All' ? req.query.type : null;

  let sql = `SELECT id, ledger_name, short_name, ledger_type, mobile, address, gstin FROM ledgers WHERE short_name IS NOT NULL AND short_name <> ''`;
  const params = [];

  if (q) { sql += ` AND short_name LIKE ?`; params.push(`%${q}%`); }
  if (type) { sql += ` AND (ledger_type = ? OR ledger_type = 'Both')`; params.push(type); }
  sql += ` ORDER BY short_name ASC LIMIT ${q ? 25 : 200}`;

  const [rows] = await pool.query(sql, params);
  res.json(rows.map((r) => ({
    id: r.id,
    name: r.ledger_name,
    short: r.short_name,
    type: r.ledger_type,
    mobile: r.mobile,
    address: r.address,
    gstin: r.gstin,
  })));
}));

// ---------------------------------------------------------------------------
// PARTY LEDGER — mirrors ui/party_ledger.py + database/db.py exactly:
//   GET    /api/ledgers/directory   -> reload_party_list()
//   POST   /api/ledgers             -> add_new_ledger()
//   PUT    /api/ledgers/:id         -> update_existing_ledger()
//   DELETE /api/ledgers/:id         -> delete_ledger()
//   GET    /api/ledgers/statement   -> PartyStatementDialog.load_statement_data()
// ---------------------------------------------------------------------------

function ledgerTimestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function ledgerExists(name, short, excludeId) {
  const params = [name.toLowerCase(), (short || '').toLowerCase()];
  let sql = `SELECT id FROM ledgers WHERE LOWER(ledger_name)=? AND LOWER(COALESCE(short_name,''))=?`;
  if (excludeId != null) { sql += ` AND id != ?`; params.push(excludeId); }
  sql += ` LIMIT 1`;
  const [rows] = await pool.query(sql, params);
  return rows.length > 0;
}

app.get('/api/ledgers/directory', route(async (req, res) => {
  const search = (req.query.search || '').trim().toLowerCase();
  const typeChoice = req.query.type || 'All Parties';

  const [ledgerRows] = await pool.query(
    `SELECT id, ledger_name, short_name, ledger_type, mobile, address, gstin FROM ledgers ORDER BY ledger_name ASC`
  );

  const partyMap = new Map();
  const registeredNames = new Set();

  ledgerRows.forEach((r) => {
    const shortLabel = String(r.short_name || '').trim();
    partyMap.set(`ledger:${r.id}`, {
      displayName: shortLabel ? `${r.ledger_name}  [${shortLabel}]` : r.ledger_name,
      partyName: r.ledger_name,
      shortName: shortLabel,
      type: r.ledger_type,
      ledgerId: r.id,
      mobile: r.mobile,
      address: r.address,
      gstin: r.gstin,
    });
    registeredNames.add(String(r.ledger_name).trim());
  });

  if (typeChoice === 'All Parties' || typeChoice === 'Suppliers Only') {
    const [rows] = await pool.query(
      `SELECT DISTINCT supplier_name FROM stock_ledger WHERE supplier_name IS NOT NULL AND supplier_name != '-' AND supplier_name != ''`
    );
    rows.forEach((r) => {
      const nm = r.supplier_name;
      if (!registeredNames.has(nm)) {
        partyMap.set(`legacy:${nm}`, { displayName: nm, partyName: nm, shortName: '', type: 'Supplier', ledgerId: null, mobile: '-', address: '-', gstin: '-' });
      }
    });
  }

  if (typeChoice === 'All Parties' || typeChoice === 'Customers Only') {
    const [rows] = await pool.query(
      `SELECT DISTINCT customer_name FROM stock_ledger WHERE customer_name IS NOT NULL AND customer_name != '-' AND customer_name != ''`
    );
    rows.forEach((r) => {
      const nm = r.customer_name;
      const key = `legacy:${nm}`;
      if (!registeredNames.has(nm) && !partyMap.has(key)) {
        partyMap.set(key, { displayName: nm, partyName: nm, shortName: '', type: 'Customer', ledgerId: null, mobile: '-', address: '-', gstin: '-' });
      } else if (partyMap.has(key) && partyMap.get(key).type === 'Supplier') {
        partyMap.get(key).type = 'Both';
      }
    });
  }

  let filtered = Array.from(partyMap.values()).filter((p) => {
    if (typeChoice === 'Suppliers Only' && !['Supplier', 'Both'].includes(p.type)) return false;
    if (typeChoice === 'Customers Only' && !['Customer', 'Both'].includes(p.type)) return false;
    return true;
  });

  if (search) {
    filtered = filtered.filter((p) => p.displayName.toLowerCase().includes(search) || p.partyName.toLowerCase().includes(search));
  }

  filtered.sort((a, b) => a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase()));
  res.json(filtered);
}));

app.post('/api/ledgers', route(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const short = String(req.body.short || '').trim();
  const type = req.body.type || 'Both';
  const mobile = String(req.body.mobile || '').trim() || '-';
  const address = String(req.body.address || '').trim() || '-';
  const gstin = String(req.body.gstin || '').trim() || '-';

  if (!name) return res.status(400).json({ error: 'Ledger Name cannot be empty.' });
  if (await ledgerExists(name, short)) return res.status(400).json({ error: `Ledger '${name}' already exists.` });

  await pool.query(
    `INSERT INTO ledgers (ledger_name, short_name, ledger_type, mobile, address, gstin, created_on) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, short, type, mobile, address, gstin, ledgerTimestamp()]
  );
  res.json({ success: true });
}));

app.put('/api/ledgers/:id', route(async (req, res) => {
  const { id } = req.params;
  const name = String(req.body.name || '').trim();
  const short = String(req.body.short || '').trim();
  const type = req.body.type || 'Both';
  const mobile = String(req.body.mobile || '').trim() || '-';
  const address = String(req.body.address || '').trim() || '-';
  const gstin = String(req.body.gstin || '').trim() || '-';

  if (!name) return res.status(400).json({ error: 'Ledger Name cannot be empty.' });
  if (await ledgerExists(name, short, Number(id))) return res.status(400).json({ error: `Ledger '${name}' already exists.` });

  const [result] = await pool.query(
    `UPDATE ledgers SET ledger_name=?, short_name=?, ledger_type=?, mobile=?, address=?, gstin=? WHERE id=?`,
    [name, short, type, mobile, address, gstin, id]
  );
  if (result.affectedRows === 0) return res.status(400).json({ error: 'Ledger not found.' });
  res.json({ success: true });
}));

app.delete('/api/ledgers/:id', route(async (req, res) => {
  const { id } = req.params;
  const [result] = await pool.query(`DELETE FROM ledgers WHERE id=?`, [id]);
  if (result.affectedRows === 0) return res.status(400).json({ error: 'Ledger not found.' });
  res.json({ success: true });
}));

app.get('/api/ledgers/statement', route(async (req, res) => {
  const name = (req.query.name || '').trim();
  const resolvedType = req.query.type || 'Both';
  if (!name) return res.status(400).json({ error: 'Party name required' });

  const rows = [];

  if (resolvedType === 'Supplier' || resolvedType === 'Both') {
    const [inRows] = await pool.query(
      `SELECT purchase_date, serial_no, item_name, category, purchase_invoice, warehouse, status, purchase_attachment
       FROM stock_ledger WHERE supplier_name=? ORDER BY purchase_date DESC, id DESC`,
      [name]
    );
    inRows.forEach((r) => {
      const refKey = r.purchase_invoice && String(r.purchase_invoice) !== '-' ? String(r.purchase_invoice) : '-';
      rows.push({
        movement: 'IN', date: r.purchase_date, serial_no: r.serial_no, item_name: r.item_name,
        category: r.category, warehouse: r.warehouse, status: r.status, proof: r.purchase_attachment,
        purchase_invoice: r.purchase_invoice, chalan_no: null, sales_invoice: null, order_no: null,
        ref_key: refKey,
      });
    });
  }

  if (resolvedType === 'Customer' || resolvedType === 'Both') {
    const [outRows] = await pool.query(
      `SELECT sales_date, serial_no, item_name, category, order_no, warehouse, status, sales_attachment, chalan_no, sales_invoice
       FROM stock_ledger WHERE customer_name=? AND status='Sold' ORDER BY sales_date DESC, id DESC`,
      [name]
    );
    outRows.forEach((r) => {
      let refKey = '-';
      for (const candidate of [r.chalan_no, r.order_no]) {
        if (candidate && String(candidate) !== '-' && String(candidate) !== '') { refKey = String(candidate); break; }
      }
      rows.push({
        movement: 'OUT', date: r.sales_date, serial_no: r.serial_no, item_name: r.item_name,
        category: r.category, warehouse: r.warehouse, status: r.status, proof: r.sales_attachment,
        purchase_invoice: null, chalan_no: r.chalan_no, sales_invoice: r.sales_invoice, order_no: r.order_no,
        ref_key: refKey,
      });
    });
  }

  res.json({ rows });
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