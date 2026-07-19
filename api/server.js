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

// ---------------------------------------------------------------------------
// Shared purchase helpers — mirror database/db.py exactly:
//   itemNameSlug()   <-> the f"{brand}_{watt}_{stype}" / f"{brand}_{stype}" slug
//                        used both when inserting into stock_ledger and when
//                        auto-creating an item master.
//   getOrCreateItem()<-> get_or_create_item(): look the (category, brand,
//                        watt, solar_type) item master up, or create it on
//                        the fly, inheriting uom/minimum_stock from any other
//                        item already registered under the same
//                        category+brand+watt (regardless of subtype).
// Both take an explicit `conn` (a connection checked out of the pool, inside
// a transaction) so purchase save/edit stay atomic — mirrors self.db.cursor
// operating on the single shared connection + explicit commit/rollback in
// the desktop app.
// ---------------------------------------------------------------------------
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
// PURCHASE INWARD — save / find-for-edit / apply-modifications / delete.
// Previously the "Execute Stock Inward" and "Purchase Invoice Modification"
// panels only wrote to an in-memory JS array (js/data/purchase-data.js) and
// never touched the database at all. These four endpoints make Purchase
// Inward behave exactly like ui/purchase.py: real INSERTs/UPDATEs/DELETEs
// against stock_ledger, with the same validation rules and error messages.
// ---------------------------------------------------------------------------

// POST /api/purchase — mirrors process_purchase_inward(): one INSERT per
// serial number, across every product line, inside a single transaction
// (either the whole invoice saves, or none of it does).
app.post('/api/purchase', route(async (req, res) => {
  const supplier = String(req.body.supplier || '').trim();
  const invoiceNo = String(req.body.invoiceNo || '').trim();
  const date = String(req.body.date || '').trim();
  const pallet = String(req.body.pallet || '').trim() || '-';
  const proofName = String(req.body.proofName || '').trim() || '-';
  const lines = Array.isArray(req.body.lines) ? req.body.lines : [];

  if (!supplier || !invoiceNo) {
    return res.status(400).json({ error: 'Supplier and Invoice are required.' });
  }
  if (!lines.length) {
    return res.status(400).json({ error: 'Add at least one Invoice Product Line before saving.' });
  }

  const allSerials = lines.flatMap((l) => l.serials || []);
  if (!allSerials.length) {
    return res.status(400).json({ error: 'Serial Numbers are required.' });
  }

  // Same-invoice duplicate check — mirrors "Same serial number is present
  // in multiple product lines."
  const seen = new Set(), innerDupes = new Set();
  allSerials.forEach((sn) => { if (seen.has(sn)) innerDupes.add(sn); seen.add(sn); });
  if (innerDupes.size) {
    return res.status(400).json({ error: `Same serial number is present in multiple product lines: ${[...innerDupes].join(', ')}` });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Already-in-database check — mirrors the per-serial "SELECT COUNT(*)
    // FROM stock_ledger WHERE serial_no=%s" loop.
    const [existingRows] = await conn.query(`SELECT serial_no FROM stock_ledger WHERE serial_no IN (?)`, [allSerials]);
    if (existingRows.length) {
      await conn.rollback();
      return res.status(400).json({
        error: `Inward Blocked! The following Serial Numbers already exist in the database: ${existingRows.map((r) => r.serial_no).join(', ')}`,
      });
    }

    for (const line of lines) {
      const itemId = await getOrCreateItem(conn, line.cat, line.brand, line.watt, line.type);
      const itemName = itemNameSlug(line.brand, line.watt, line.type);
      for (const sn of (line.serials || [])) {
        await conn.query(
          `INSERT INTO stock_ledger (item_id, item_name, category, brand_name, watt, solar_type, serial_no, pallet_no, warehouse, status, supplier_name, purchase_invoice, purchase_date, purchase_attachment)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', ?, ?, ?, ?)`,
          [itemId, itemName, line.cat, line.brand, Number(line.watt) || 0, line.type || 'Others', sn, line.pallet || pallet, line.warehouse, supplier, invoiceNo, date, proofName]
        );
      }
    }

    await conn.commit();
    res.json({ success: true, invoiceNo, lineCount: lines.length, serialCount: allSerials.length });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// GET /api/purchase/find?term=... — mirrors find_purchase_invoice_for_editing():
// search by exact Invoice No, OR supplier name containing the term, OR the
// supplier's short code resolved through the ledgers table. Returns the most
// recent matching invoice, grouped back into product lines + all its serials.
app.get('/api/purchase/find', route(async (req, res) => {
  const term = String(req.query.term || '').trim();
  if (!term) return res.status(400).json({ error: 'Type an Invoice No, Supplier Name, or Short Name to search first.' });

  const [shortMatch] = await pool.query(
    `SELECT ledger_name FROM ledgers WHERE short_name = ? AND (ledger_type = 'Supplier' OR ledger_type = 'Both') LIMIT 1`,
    [term]
  );
  const resolvedName = shortMatch.length ? shortMatch[0].ledger_name : null;

  let sql = `SELECT category, brand_name, watt, solar_type, supplier_name, purchase_invoice, pallet_no, warehouse, purchase_date, serial_no, purchase_attachment
             FROM stock_ledger WHERE purchase_invoice = ? OR supplier_name LIKE ?`;
  const params = [term, `%${term}%`];
  if (resolvedName) { sql += ` OR supplier_name = ?`; params.push(resolvedName); }
  sql += ` ORDER BY STR_TO_DATE(purchase_date, '%d-%m-%Y') DESC, category, brand_name, watt, solar_type, id`;

  const [allMatches] = await pool.query(sql, params);
  if (!allMatches.length) {
    return res.status(404).json({ error: 'No purchase invoice records found matching Invoice No / Supplier Name / Short Name.' });
  }

  // Name/short-name search can span multiple invoices — load the most
  // recent matching invoice only, same as the desktop app.
  const targetInv = allMatches[0].purchase_invoice;
  const records = allMatches.filter((r) => r.purchase_invoice === targetInv);
  const head = records[0];

  const grouped = new Map();
  records.forEach((r) => {
    const key = [r.category, r.brand_name, r.watt || 0, r.solar_type, r.pallet_no || '', r.warehouse || ''].join('|');
    if (!grouped.has(key)) {
      grouped.set(key, {
        cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type,
        pallet: r.pallet_no || '', warehouse: r.warehouse || '', serials: [],
      });
    }
    grouped.get(key).serials.push(r.serial_no);
  });

  res.json({
    invoiceNo: targetInv,
    supplier: head.supplier_name,
    pallet: head.pallet_no,
    date: head.purchase_date,
    proofName: head.purchase_attachment,
    allSerials: records.map((r) => r.serial_no),
    lines: Array.from(grouped.values()).map((l) => ({ ...l, qty: l.serials.length })),
  });
}));

// PUT /api/purchase/:invoiceNo — mirrors process_purchase_modification():
// UPDATE every serial that already belonged to this invoice, INSERT any
// brand-new serial added during the edit, and DELETE any serial that was
// removed. Blocked if a new serial already exists elsewhere, or if any
// original serial has already been sold.
app.put('/api/purchase/:invoiceNo', route(async (req, res) => {
  const originalInvoiceNo = req.params.invoiceNo;
  const newSupp = String(req.body.supplier || '').trim();
  const newInv = String(req.body.invoiceNo || '').trim();
  const newDate = String(req.body.date || '').trim();
  const pallet = String(req.body.pallet || '').trim() || '-';
  const proofName = req.body.proofName ? String(req.body.proofName).trim() : null;
  const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
  const originalSerials = Array.isArray(req.body.originalSerials) ? req.body.originalSerials : [];

  const newSerials = lines.flatMap((l) => l.serials || []);
  if (!newSupp || !newInv || !newSerials.length) {
    return res.status(400).json({ error: 'Supplier, Invoice No, and Serials are required for modification.' });
  }

  const seen = new Set(), innerDupes = new Set();
  newSerials.forEach((sn) => { if (seen.has(sn)) innerDupes.add(sn); seen.add(sn); });
  if (innerDupes.size) {
    return res.status(400).json({ error: `Same serial number is present in multiple product lines: ${[...innerDupes].join(', ')}` });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Any genuinely NEW serial (not part of this invoice before) must not
    // already exist anywhere else in stock_ledger.
    const trulyNew = newSerials.filter((sn) => !originalSerials.includes(sn));
    if (trulyNew.length) {
      const [dupRows] = await conn.query(`SELECT serial_no FROM stock_ledger WHERE serial_no IN (?)`, [trulyNew]);
      if (dupRows.length) {
        await conn.rollback();
        return res.status(400).json({ error: `These Serial Numbers already exist: ${dupRows.map((r) => r.serial_no).join(', ')}` });
      }
    }

    // None of the ORIGINAL serials may already be sold.
    if (originalSerials.length) {
      const [soldRows] = await conn.query(
        `SELECT serial_no FROM stock_ledger WHERE serial_no IN (?) AND status='Sold'`,
        [originalSerials]
      );
      if (soldRows.length) {
        await conn.rollback();
        return res.status(400).json({
          error: `Modification Restricted! Some Serial Numbers belonging to this purchase invoice have already been sold out: ${soldRows.map((r) => r.serial_no).join(', ')}`,
        });
      }
    }

    const [metaRows] = await conn.query(
      `SELECT purchase_attachment FROM stock_ledger WHERE purchase_invoice=? LIMIT 1`,
      [originalInvoiceNo]
    );
    const existingAttachment = metaRows.length ? metaRows[0].purchase_attachment : '-';
    const finalProof = proofName || existingAttachment;

    for (const line of lines) {
      if (!line.cat || !line.brand) {
        await conn.rollback();
        return res.status(400).json({ error: 'One product line has no valid item master.' });
      }
      const itemId = await getOrCreateItem(conn, line.cat, line.brand, line.watt, line.type);
      const itemName = itemNameSlug(line.brand, line.watt, line.type);
      for (const sn of (line.serials || [])) {
        if (originalSerials.includes(sn)) {
          await conn.query(
            `UPDATE stock_ledger SET item_id=?, item_name=?, category=?, brand_name=?, watt=?, solar_type=?,
             pallet_no=?, warehouse=?, supplier_name=?, purchase_invoice=?, purchase_date=?, purchase_attachment=?, edited_flag=1
             WHERE serial_no=?`,
            [itemId, itemName, line.cat, line.brand, Number(line.watt) || 0, line.type || 'Others', line.pallet || pallet, line.warehouse, newSupp, newInv, newDate, finalProof, sn]
          );
        } else {
          await conn.query(
            `INSERT INTO stock_ledger (item_id, item_name, category, brand_name, watt, solar_type, serial_no, pallet_no, warehouse, status, supplier_name, purchase_invoice, purchase_date, purchase_attachment, edited_flag)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Available', ?, ?, ?, ?, 1)`,
            [itemId, itemName, line.cat, line.brand, Number(line.watt) || 0, line.type || 'Others', sn, line.pallet || pallet, line.warehouse, newSupp, newInv, newDate, finalProof]
          );
        }
      }
    }

    // Any original serial no longer present in the edited lines is removed.
    const removed = originalSerials.filter((sn) => !newSerials.includes(sn));
    if (removed.length) {
      await conn.query(`DELETE FROM stock_ledger WHERE serial_no IN (?)`, [removed]);
    }

    await conn.commit();
    res.json({ success: true, invoiceNo: newInv });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// DELETE /api/purchase/:invoiceNo — mirrors delete_purchase_invoice():
// permanently removes every stock_ledger row for this invoice, but blocked
// entirely if any of its serials have already been sold.
app.delete('/api/purchase/:invoiceNo', route(async (req, res) => {
  const { invoiceNo } = req.params;
  const [rows] = await pool.query(`SELECT serial_no, status FROM stock_ledger WHERE purchase_invoice=?`, [invoiceNo]);
  if (!rows.length) {
    return res.status(404).json({ error: 'No records found for this purchase invoice.' });
  }
  const soldSerials = rows.filter((r) => r.status === 'Sold').map((r) => r.serial_no);
  if (soldSerials.length) {
    return res.status(400).json({
      error: `This purchase invoice cannot be deleted because the following Serial Number(s) have already been sold out: ${soldSerials.join(', ')}. Please first remove/reverse that sale from the Sales Order Modification panel (or process a Sales Return), then delete this purchase invoice again.`,
    });
  }

  await pool.query(`DELETE FROM stock_ledger WHERE purchase_invoice=?`, [invoiceNo]);
  try {
    await pool.query(
      `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('PURCHASE_DELETE', ?, 'User', ?, ?, ?)`,
      [invoiceNo, ledgerTimestamp(), `Invoice:${invoiceNo}`, `Invoice permanently deleted | Serials: ${rows.map((r) => r.serial_no).join(', ')}`]
    );
  } catch (e) { /* audit log is best-effort, never block the delete on it */ }

  res.json({ success: true });
}));

// GET /api/purchase/register — mirrors ui/registers.py's PurchaseRegisterPage
// load_data(): one row per (invoice, date, supplier, category, brand,
// warehouse) group, with the first serial + total qty + whether any row in
// the group was ever edited.
app.get('/api/purchase/register', route(async (req, res) => {
  const category = req.query.category;
  let sql = `SELECT purchase_invoice, purchase_date, supplier_name, category, brand_name, warehouse,
                    MIN(serial_no) AS first_serial, COUNT(*) AS qty, MAX(edited_flag) AS edited
             FROM stock_ledger WHERE purchase_invoice IS NOT NULL AND purchase_invoice != '-'`;
  const params = [];
  if (category && category !== 'All Categories') { sql += ` AND category = ?`; params.push(category); }
  sql += ` GROUP BY purchase_invoice, purchase_date, supplier_name, category, brand_name, warehouse
           ORDER BY STR_TO_DATE(purchase_date, '%d-%m-%Y') DESC, purchase_invoice DESC`;

  const [rows] = await pool.query(sql, params);
  res.json(rows.map((r) => ({
    invoiceNo: r.purchase_invoice,
    date: r.purchase_date,
    supplier: r.supplier_name,
    category: r.category,
    brand: r.brand_name,
    warehouse: r.warehouse,
    firstSerial: r.first_serial,
    qty: r.qty,
    edited: !!r.edited,
  })));
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
// PROJECT SALES / DISPATCH — mirrors ui/sales.py exactly (SalesPage). Every
// dropdown, autofill and validation the desktop Sale Outward screen does
// against the live database is now available here for js/pages/sales.js:
//   GET  /api/sales/types            -> sync_sales_solartype()'s
//                                        get_types_for_category_brand_watt()
//   GET  /api/sales/check-line       -> validate_sales_line_serials()
//   POST /api/sales/dispatch         -> process_sales_dispatch()
//   GET  /api/sales/find/:term       -> find_sales_order_for_editing()
//   PUT  /api/sales/modify/:orderNo  -> process_sales_modification()
//   DELETE /api/sales/delete/:orderNo -> delete_sales_transaction()
// Category/Brand/Wattage dropdowns reuse the existing /api/masters/categories,
// /api/purchase/brands/:category and /api/purchase/wattages endpoints (same
// underlying `items` table the desktop app's get_categories() /
// get_brands_for_category() / get_wattages_for_brand_category() read from).
// Customer short-code + name autocomplete reuse /api/ledgers and
// /api/ledgers/shortcodes with type=Customer (same as Supplier on Purchase).
// ---------------------------------------------------------------------------

// GET /api/sales/types?category=&brand=&watt= — Type/Subtype options actually
// registered against this exact Category+Brand+Wattage combo in the `items`
// master (mirrors get_types_for_category_brand_watt()). The frontend falls
// back to /api/masters/subtypes/:category (get_subtypes_by_category()) when
// this comes back empty, exactly like sync_sales_solartype() does.
app.get('/api/sales/types', route(async (req, res) => {
  const { category, brand } = req.query;
  const watt = Number(req.query.watt) || 0;
  if (!category || !brand) return res.json([]);
  const [rows] = await pool.query(
    `SELECT DISTINCT solar_type FROM items WHERE category=? AND brand_name=? AND watt=? AND solar_type IS NOT NULL AND solar_type <> '' ORDER BY solar_type ASC`,
    [category, brand, watt]
  );
  res.json(rows.map((r) => r.solar_type));
}));

// GET /api/sales/check-line?category=&brand=&watt=&type=&serials=a,b,c —
// Live pre-check used the instant "Add Product Line" is clicked, mirroring
// add_sales_line() -> validate_sales_line_serials(): every scanned serial
// must exist, be Available, and match this line's Category/Brand/Wattage/
// Type. Returns { errors: [] } (empty array = safe to add the line).
app.get('/api/sales/check-line', route(async (req, res) => {
  const { category, brand, type } = req.query;
  const watt = Number(req.query.watt) || 0;
  const serials = String(req.query.serials || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!category || !brand || !type || !serials.length) return res.json({ errors: [] });
  const errors = await validateSalesLineSerials(pool, serials, { cat: category, brand, watt, type });
  res.json({ errors });
}));

// POST /api/sales/dispatch — mirrors process_sales_dispatch(): validates
// every product line's serials against stock_ledger, blocks on a Challan No
// already tied to a different customer/order, then marks every serial
// 'Sold' with the dispatch details in a single transaction.
app.post('/api/sales/dispatch', route(async (req, res) => {
  const customer = String(req.body.customer || '').trim();
  const orderNo = String(req.body.orderNo || '').trim();
  const chalanNo = String(req.body.chalanNo || '').trim();
  const chalanDate = String(req.body.chalanDate || '').trim();
  const invoiceNo = String(req.body.invoiceNo || '').trim();
  const invoiceDate = invoiceNo ? String(req.body.invoiceDate || '').trim() : '-';
  const lines = Array.isArray(req.body.lines) ? req.body.lines : [];

  if (!customer || !orderNo || !chalanNo) {
    return res.status(400).json({ error: 'Customer Name, Order No and Challan No are required.' });
  }
  if (!lines.length) {
    return res.status(400).json({ error: 'Add at least one Invoice Product Line before saving.' });
  }

  const allSerials = lines.flatMap((l) => l.serials || []);
  if (!allSerials.length) {
    return res.status(400).json({ error: 'Scan/enter Serial Numbers before saving.' });
  }
  const seen = new Set(), innerDupes = new Set();
  allSerials.forEach((sn) => { if (seen.has(sn)) innerDupes.add(sn); seen.add(sn); });
  if (innerDupes.size) {
    return res.status(400).json({ error: `Same serial number is present in multiple product lines: ${[...innerDupes].join(', ')}` });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Challan Conflict — mirrors "This Challan number has already been
    // assigned to another customer/order."
    const [existing] = await conn.query(`SELECT customer_name, order_no FROM stock_ledger WHERE chalan_no = ?`, [chalanNo]);
    if (existing.length && (existing[0].customer_name !== customer || existing[0].order_no !== orderNo)) {
      await conn.rollback();
      return res.status(400).json({ error: 'This Challan number has already been assigned to another customer/order.' });
    }

    // Product master + serial validation for every line, exactly like
    // build_current_sales_line() + validate_sales_line_serials().
    const validationErrors = [];
    for (const line of lines) {
      if (!line.cat || !line.brand || !line.type) {
        validationErrors.push('Category, Brand and Type are required for every product line.');
        continue;
      }
      const itemId = await getItemId(conn, line.cat, line.brand, line.watt, line.type);
      if (!itemId) {
        validationErrors.push(`Selected product master (${line.brand} ${line.watt ? line.watt + 'W ' : ''}${line.type}) was not found. Please create/check the master item first.`);
        continue;
      }
      validationErrors.push(...(await validateSalesLineSerials(conn, line.serials || [], line)));
    }
    if (validationErrors.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'DISPATCH BLOCKED:\n' + validationErrors.join('\n') });
    }

    for (const sn of allSerials) {
      await conn.query(
        `UPDATE stock_ledger SET status='Sold', customer_name=?, order_no=?, sales_invoice=?, invoice_date=?, sales_date=?, chalan_no=?, chalan_date=?
         WHERE serial_no=?`,
        [customer, orderNo, invoiceNo || '-', invoiceDate, chalanDate, chalanNo, chalanDate, sn]
      );
    }

    await conn.commit();
    res.json({ success: true, orderNo, chalanNo, lineCount: lines.length, serialCount: allSerials.length });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// GET /api/sales/find/:term — mirrors find_sales_order_for_editing(): search
// by Order No, Challan No, Customer Name, or Customer Short Code, load the
// most recent matching Sold order, grouped back into product lines.
app.get('/api/sales/find/:term', route(async (req, res) => {
  const term = String(req.params.term || '').trim();
  if (!term) return res.status(400).json({ error: 'Type an Order No, Challan No, Customer Name, or Short Name to search first.' });

  const [shortMatch] = await pool.query(
    `SELECT ledger_name FROM ledgers WHERE short_name = ? AND (ledger_type = 'Customer' OR ledger_type = 'Both') LIMIT 1`,
    [term]
  );
  const resolvedName = shortMatch.length ? shortMatch[0].ledger_name : null;

  let sql = `SELECT customer_name, order_no, chalan_no, chalan_date, sales_invoice, invoice_date, category,
                    brand_name, watt, solar_type, serial_no
             FROM stock_ledger
             WHERE (order_no=? OR chalan_no=? OR customer_name LIKE ?) AND status='Sold'`;
  const params = [term, term, `%${term}%`];
  if (resolvedName) { sql += ` OR (customer_name=? AND status='Sold')`; params.push(resolvedName); }
  sql += ` ORDER BY STR_TO_DATE(chalan_date, '%d-%m-%Y') DESC, category, brand_name, watt, solar_type, id`;

  const [allMatches] = await pool.query(sql, params);
  if (!allMatches.length) {
    return res.status(404).json({ error: 'No sales records found matching Order No / Challan No / Customer Name / Short Name.' });
  }

  // Name/short-name search can span multiple orders — load the most recent
  // matching order only, same as the desktop app.
  const targetOrder = allMatches[0].order_no;
  const records = allMatches.filter((r) => r.order_no === targetOrder);
  const head = records[0];

  const grouped = new Map();
  records.forEach((r) => {
    const key = [r.category, r.brand_name, r.watt || 0, r.solar_type].join('|');
    if (!grouped.has(key)) {
      grouped.set(key, { cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type, serials: [] });
    }
    grouped.get(key).serials.push(r.serial_no);
  });

  res.json({
    orderNo: targetOrder,
    customer: head.customer_name,
    chalanNo: head.chalan_no,
    chalanDate: head.chalan_date,
    invoiceNo: head.sales_invoice && head.sales_invoice !== '-' ? head.sales_invoice : '',
    invoiceDate: head.invoice_date && head.invoice_date !== '-' ? head.invoice_date : '',
    allSerials: records.map((r) => r.serial_no),
    lines: Array.from(grouped.values()).map((l) => ({ ...l, qty: l.serials.length })),
  });
}));

// PUT /api/sales/modify/:orderNo — mirrors process_sales_modification():
// UPDATEs every serial that stays on the order (re-validating any BRAND NEW
// serial added during the edit), reverts any REMOVED serial back to
// Available, and flags every touched row edited_flag=1.
app.put('/api/sales/modify/:orderNo', route(async (req, res) => {
  const loadedOrderNo = req.params.orderNo;
  const newCust = String(req.body.customer || '').trim();
  const newChalan = String(req.body.chalanNo || '').trim();
  const newChalanDate = String(req.body.chalanDate || '').trim();
  const newInv = String(req.body.invoiceNo || '').trim();
  const newInvDate = newInv ? String(req.body.invoiceDate || '').trim() : '-';
  const lines = Array.isArray(req.body.lines) ? req.body.lines : [];
  const originalSerials = Array.isArray(req.body.originalSerials) ? req.body.originalSerials : [];

  const allNewSerials = lines.flatMap((l) => l.serials || []);
  if (!newCust || !newChalan || !allNewSerials.length) {
    return res.status(400).json({ error: 'Customer, Challan No and Serials are required.' });
  }
  const seen = new Set(), innerDupes = new Set();
  allNewSerials.forEach((sn) => { if (seen.has(sn)) innerDupes.add(sn); seen.add(sn); });
  if (innerDupes.size) {
    return res.status(400).json({ error: `Same serial number is present in multiple product lines: ${[...innerDupes].join(', ')}` });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Challan Conflict — this Challan No must not already belong to a
    // DIFFERENT order.
    const [conflictRows] = await conn.query(
      `SELECT DISTINCT order_no FROM stock_ledger WHERE chalan_no=? AND order_no<>? AND status='Sold'`,
      [newChalan, loadedOrderNo]
    );
    if (conflictRows.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'This Challan number has already been assigned to another order.' });
    }

    const validationErrors = [];
    for (const line of lines) {
      if (!line.cat || !line.brand || !line.type) {
        validationErrors.push('One product line has no valid item master.');
        continue;
      }
      const itemId = await getItemId(conn, line.cat, line.brand, line.watt, line.type);
      if (!itemId) {
        validationErrors.push(`Selected product master (${line.brand} ${line.watt ? line.watt + 'W ' : ''}${line.type}) was not found. Please create/check the master item first.`);
        continue;
      }
      // Only BRAND NEW serials (not already part of this order) get
      // re-validated against stock — mirrors the `if sn not in
      // self.original_serial_list` guard in process_sales_modification().
      const newOnes = (line.serials || []).filter((sn) => !originalSerials.includes(sn));
      if (newOnes.length) {
        validationErrors.push(...(await validateSalesLineSerials(conn, newOnes, line)));
      }
    }
    if (validationErrors.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'DISPATCH BLOCKED:\n' + validationErrors.join('\n') });
    }

    for (const line of lines) {
      const itemId = await getItemId(conn, line.cat, line.brand, line.watt, line.type);
      const itemName = itemNameSlug(line.brand, line.watt, line.type);
      for (const sn of (line.serials || [])) {
        await conn.query(
          `UPDATE stock_ledger SET
             status='Sold', item_id=?, item_name=?, category=?, brand_name=?, watt=?, solar_type=?,
             customer_name=?, order_no=?, sales_invoice=?, invoice_date=?, sales_date=?, chalan_no=?, chalan_date=?, edited_flag=1
           WHERE serial_no=?`,
          [itemId, itemName, line.cat, line.brand, Number(line.watt) || 0, line.type, newCust, loadedOrderNo, newInv || '-', newInvDate, newChalanDate, newChalan, newChalanDate, sn]
        );
      }
    }

    // Any original serial no longer present in the edited lines is reverted
    // back to Available stock — mirrors the trailing `for old_sn in
    // self.original_serial_list` loop.
    const removed = originalSerials.filter((sn) => !allNewSerials.includes(sn));
    if (removed.length) {
      await conn.query(
        `UPDATE stock_ledger SET status='Available', customer_name='-', order_no='-', sales_invoice='-', invoice_date='-', sales_date='-', chalan_no='-', chalan_date='-', edited_flag=1
         WHERE serial_no IN (?)`,
        [removed]
      );
    }

    await conn.commit();
    res.json({ success: true, orderNo: loadedOrderNo });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// DELETE /api/sales/delete/:orderNo — mirrors delete_sales_transaction():
// permanently reverts every Sold serial on this order back to Available
// stock (undoes the dispatch; does not delete the underlying purchase row).
app.delete('/api/sales/delete/:orderNo', route(async (req, res) => {
  const { orderNo } = req.params;
  const [rows] = await pool.query(`SELECT serial_no FROM stock_ledger WHERE order_no=? AND status='Sold'`, [orderNo]);
  if (!rows.length) {
    return res.status(404).json({ error: 'No active sold records found for this order/challan.' });
  }
  await pool.query(
    `UPDATE stock_ledger SET status='Available', customer_name='-', order_no='-', sales_invoice='-', invoice_date='-', sales_date='-', chalan_no='-', chalan_date='-', edited_flag=1
     WHERE order_no=? AND status='Sold'`,
    [orderNo]
  );
  try {
    await pool.query(
      `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('SALE_DELETE', ?, 'User', ?, ?, ?)`,
      [orderNo, ledgerTimestamp(), `Order:${orderNo}`, `Sale transaction deleted | Serials reverted to Available: ${rows.map((r) => r.serial_no).join(', ')}`]
    );
  } catch (e) { /* audit log is best-effort, never block the delete on it */ }

  res.json({ success: true, revertedCount: rows.length });
}));

// GET /api/sales/register — mirrors ui/registers.py's SaleRegisterPage
// load_data(): one row per (challan, date, customer, order, category, brand,
// sales_invoice) group, with the first serial + total qty + whether any row
// in the group was ever edited. Only Sold rows with a real challan count,
// exactly like the desktop query's WHERE status='Sold' AND chalan_no != '-'.
app.get('/api/sales/register', route(async (req, res) => {
  const category = req.query.category;
  let sql = `SELECT chalan_no, chalan_date, customer_name, order_no, category, brand_name, sales_invoice,
                    MIN(serial_no) AS first_serial, COUNT(*) AS qty, MAX(edited_flag) AS edited
             FROM stock_ledger WHERE status='Sold' AND chalan_no IS NOT NULL AND chalan_no != '-'`;
  const params = [];
  if (category && category !== 'All Categories') { sql += ` AND category = ?`; params.push(category); }
  sql += ` GROUP BY chalan_no, chalan_date, customer_name, order_no, category, brand_name, sales_invoice
           ORDER BY STR_TO_DATE(chalan_date, '%d-%m-%Y') DESC, chalan_no DESC`;

  const [rows] = await pool.query(sql, params);
  res.json(rows.map((r) => ({
    challanNo: r.chalan_no,
    date: r.chalan_date,
    customer: r.customer_name,
    orderNo: r.order_no,
    category: r.category,
    brand: r.brand_name,
    qty: r.qty,
    invoice: r.sales_invoice && r.sales_invoice !== '-' ? r.sales_invoice : '',
    firstSerial: r.first_serial,
    edited: !!r.edited,
  })));
}));

// GET /api/reports/master — mirrors ui/reports.py's ReportsPage
// build_base_query(): every single stock_ledger row, serial-wise, with all
// 18 columns the desktop Master Report shows, newest first. Optional
// ?category= filters exactly like the desktop Category dropdown does.
app.get('/api/reports/master', route(async (req, res) => {
  const category = req.query.category;
  let sql = `SELECT serial_no, brand_name, watt, solar_type, category, pallet_no, warehouse, status,
                    supplier_name, purchase_invoice, purchase_date, customer_name, order_no,
                    sales_invoice, invoice_date, chalan_no, chalan_date, edited_flag
             FROM stock_ledger`;
  const params = [];
  if (category && category !== 'All Categories') { sql += ` WHERE category = ?`; params.push(category); }
  sql += ` ORDER BY id DESC`;

  const [rows] = await pool.query(sql, params);
  const dash = (v) => (v === null || v === undefined || v === '' ? '-' : String(v));
  res.json(rows.map((r) => ({
    serialNo: dash(r.serial_no),
    brand: dash(r.brand_name),
    watt: r.watt ? `${r.watt}W` : '-',
    solarType: dash(r.solar_type),
    category: dash(r.category),
    palletNo: dash(r.pallet_no),
    warehouse: dash(r.warehouse),
    status: dash(r.status),
    supplier: dash(r.supplier_name),
    purchaseInvoice: dash(r.purchase_invoice),
    purchaseDate: dash(r.purchase_date),
    customer: dash(r.customer_name),
    orderNo: dash(r.order_no),
    salesInvoice: dash(r.sales_invoice),
    invoiceDate: dash(r.invoice_date),
    chalanNo: dash(r.chalan_no),
    chalanDate: dash(r.chalan_date),
    edited: r.edited_flag ? 'Yes' : 'No',
  })));
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