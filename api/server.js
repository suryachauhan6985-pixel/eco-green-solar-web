// server.js
// -----------------------------------------------------------------------------
// Eco Green Solar ERP — Web Backend API (FULL MASTERS LOGIC)
// -----------------------------------------------------------------------------

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors()); 
app.use(express.json());

// ---------------------------------------------------------------------------
// EMAIL OTP — sending login OTPs.
//
// IMPORTANT (Render free tier): Render blocks outbound SMTP ports (25, 465,
// 587) on free web services, so Gmail SMTP will always time out there no
// matter which port you use. To fix this we send OTP emails over an HTTPS
// email API instead (no SMTP port involved, so it works fine on Render's
// free tier).
//
// --- Option A (in use / recommended — no domain required): Brevo --------
//   Brevo lets you verify a single sender email address (a 6-digit code is
//   emailed to it) WITHOUT owning/verifying a domain, and that sender can
//   then email ANY recipient — perfect for a small team without a website
//   domain.
//   1. Sign up free at https://app.brevo.com/ (no credit card needed)
//   2. Go to Senders, Domains & Dedicated IPs -> Senders -> Add a sender.
//      Enter the mailbox you already use (e.g. greenenergy123@gmail.com),
//      then check that inbox for a 6-digit code and enter it to verify.
//   3. Get an API key: Settings (top right) -> SMTP & API -> API Keys ->
//      Generate a new API key.
//   4. Set these environment variables in Render:
//        BREVO_API_KEY     the key from step 3
//        BREVO_FROM_EMAIL  the sender you verified in step 2
//                          (e.g. greenenergy123@gmail.com)
//        BREVO_FROM_NAME   optional, defaults to "Eco Green Solar ERP"
//   Free tier: 300 emails/day, forever — plenty for login OTPs.
//
// --- Option B: Resend — needs your own domain verified to email anyone ---
//   RESEND_API_KEY, RESEND_FROM  (see resend.com/domains to verify a domain;
//   without a verified domain, Resend can only email the account owner.)
//
// --- Option C: SMTP (Gmail, etc.) — only works on hosts that allow it ----
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (Gmail App Password)
//
// If nothing is configured, the server does NOT crash — it just logs the
// OTP to the server console instead of emailing it, so login still works
// while you're setting email up.
// ---------------------------------------------------------------------------
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_FROM_EMAIL = process.env.BREVO_FROM_EMAIL || '';
const BREVO_FROM_NAME = process.env.BREVO_FROM_NAME || 'Eco Green Solar ERP';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM || 'Eco Green Solar ERP <onboarding@resend.dev>';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const OTP_TTL_MINUTES = 5;

let mailer = null;
if (SMTP_USER && SMTP_PASS) {
  mailer = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000, // fail fast instead of hanging for 60s+
  });
}

if (!BREVO_API_KEY && !RESEND_API_KEY && !mailer) {
  console.warn('[Email OTP] No email service configured (BREVO_API_KEY / RESEND_API_KEY / SMTP_USER+SMTP_PASS) — OTPs will be printed to this console instead of emailed. See comment above for setup.');
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

async function sendOtpEmail(toEmail, otp) {
  const subject = 'Your Eco Green Solar ERP Login OTP';
  const text = `Your OTP is ${otp}. It is valid for ${OTP_TTL_MINUTES} minutes. Do not share this code with anyone.`;
  const html = `<p>Your OTP is <strong style="font-size:20px;">${otp}</strong>.</p><p>It is valid for ${OTP_TTL_MINUTES} minutes. Do not share this code with anyone.</p>`;

  // Preferred path: Brevo's HTTPS API — no SMTP port involved (works on
  // Render's free tier), and a verified single sender can email anyone
  // without needing to own/verify a domain.
  if (BREVO_API_KEY) {
    if (!BREVO_FROM_EMAIL) {
      throw new Error('BREVO_FROM_EMAIL is not set. Set it to the sender address you verified in Brevo.');
    }
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: BREVO_FROM_NAME, email: BREVO_FROM_EMAIL },
        to: [{ email: toEmail }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      throw new Error(`Brevo API error (${resp.status}): ${detail || resp.statusText}`);
    }
    return;
  }

  // Fallback: Resend's HTTPS API (only works for the Resend account's own
  // email unless a domain has been verified there).
  if (RESEND_API_KEY) {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: RESEND_FROM, to: [toEmail], subject, text, html }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      throw new Error(`Resend API error (${resp.status}): ${detail || resp.statusText}`);
    }
    return;
  }

  // Fallback: plain SMTP (only works if the host allows outbound SMTP).
  if (mailer) {
    await mailer.sendMail({ from: `"Eco Green Solar ERP" <${SMTP_USER}>`, to: toEmail, subject, text, html });
    return;
  }

  // Nothing configured — don't crash, just log it so login still works.
  console.log(`[Email OTP] (no email service configured) OTP for ${toEmail}: ${otp}`);
}

function maskEmail(email) {
  const [name, domain] = String(email).split('@');
  if (!domain) return email;
  const visible = name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(name.length - 2, 1))}@${domain}`;
}

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

// ---------------------------------------------------------------------------
// LIVE SESSION TRACKING — schema safety net. `user_sessions` (username PK,
// is_logged_in, last_login_time) already exists (same table the desktop .py
// app's create_tables() makes). We only need one extra column, `last_seen`,
// so the web app can tell a clean logout apart from someone who just closed
// the browser tab (heartbeat keeps last_seen fresh while the tab is open;
// if it goes stale, GET /api/sessions/live self-heals that row back to
// offline). MariaDB supports "ADD COLUMN IF NOT EXISTS", so this is safe to
// run on every boot.
// ---------------------------------------------------------------------------
(async function ensureSessionSchema() {
  try {
    await pool.query(`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_seen DATETIME NULL`);
  } catch (e) {
    console.warn('[Session schema] Could not ensure last_seen column (will retry lazily on first use):', e.message);
  }
})();

// ---------------------------------------------------------------------------
// EMAIL OTP schema — adds `email` to `users` (nullable, so existing accounts
// keep working; each user's email just needs to be set once in Masters >
// Users before that account can complete the OTP step) and a small
// `otp_codes` table that holds exactly one active OTP per username at a
// time (overwritten on every new login attempt / resend).
// ---------------------------------------------------------------------------
(async function ensureAuthOtpSchema() {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150) NULL`);
    await pool.query(`CREATE TABLE IF NOT EXISTS otp_codes (
      username VARCHAR(100) PRIMARY KEY,
      otp VARCHAR(10) NOT NULL,
      expires_at DATETIME NOT NULL,
      attempts INT NOT NULL DEFAULT 0
    )`);
  } catch (e) {
    console.warn('[Auth/OTP schema] Could not ensure email column / otp_codes table:', e.message);
  }
})();


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

// A session whose last_seen is older than this is treated as dead (crashed
// tab / lost network / power cut) even if it was never cleanly logged out.
// Used both by GET /api/sessions/live (self-heals the Live Users list) and
// by POST /api/auth/login below (so a genuinely-dead old session doesn't
// permanently lock a user out of signing back in).
const SESSION_STALE_SECONDS = 40;

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

// GET /api/lowstock — mirrors ui/low_stock.py's LowStockPage.load_data(),
// which calls database/db.py's get_low_stock_items() exactly: every item
// master whose minimum_stock is set (>0) AND whose current 'Available'
// count has dropped to/under that minimum, worst-shortfall first.
app.get('/api/lowstock', route(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT i.id, i.brand_name, i.watt, i.solar_type, i.category, i.uom, i.minimum_stock,
           COALESCE(SUM(CASE WHEN s.status='Available' THEN 1 ELSE 0 END),0) AS current_stock
    FROM items i
    LEFT JOIN stock_ledger s ON s.item_id = i.id
    WHERE i.minimum_stock > 0
    GROUP BY i.id, i.brand_name, i.watt, i.solar_type, i.category, i.uom, i.minimum_stock
    HAVING COALESCE(SUM(CASE WHEN s.status='Available' THEN 1 ELSE 0 END),0) <= i.minimum_stock
    ORDER BY (i.minimum_stock - COALESCE(SUM(CASE WHEN s.status='Available' THEN 1 ELSE 0 END),0)) DESC
  `);
  res.json(rows.map((r) => ({
    category: r.category,
    brand: r.brand_name,
    watt: r.watt ? `${r.watt}W` : 'N/A',
    type: r.solar_type || 'Others',
    currentStock: r.current_stock,
    minimumStock: r.minimum_stock,
  })));
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
// ---------------------------------------------------------------------------
// AUTH — 2-step login:
//   Step 1: POST /api/auth/login          (username-or-email + password)
//           -> verifies credentials, then emails a 6-digit OTP and returns
//              { success: true, otpRequired: true, username, maskedEmail }
//              WITHOUT creating a session yet.
//   Step 2: POST /api/auth/verify-otp     (username + otp)
//           -> checks the OTP, and only then runs the same single-session
//              + "mark online" logic the old one-step login used to run
//              directly. This is the point identity is actually granted.
// The `username` field on the login form now accepts EITHER the account's
// username OR its registered email — same input box, no separate field.
// ---------------------------------------------------------------------------
async function completeLoginSession(uname, role, res) {
  // ---------- One session at a time per user ----------
  // First self-heal: if this username's last session went stale (crashed
  // tab, lost network, power cut — same STALE_SECONDS window
  // /api/sessions/live uses) it doesn't count as "still logged in" any
  // more, so it won't block a fresh login.
  await pool.query(
    `UPDATE user_sessions
     SET is_logged_in=0
     WHERE username=? AND is_logged_in=1 AND (last_seen IS NULL OR last_seen < (NOW() - INTERVAL ? SECOND))`,
    [uname, SESSION_STALE_SECONDS]
  );
  const [[existing]] = await pool.query(
    `SELECT is_logged_in FROM user_sessions WHERE username=?`,
    [uname]
  );
  if (existing && existing.is_logged_in) {
    return res.status(409).json({ error: 'This user is already logged in on another device/browser. Please logout there first.' });
  }

  // Mark this user ONLINE right away — same row the desktop app's
  // "Live Network Users" tracker reads, so a login from either app shows
  // up for everyone immediately.
  await pool.query(
    `INSERT INTO user_sessions (username, is_logged_in, last_login_time, last_seen)
     VALUES (?, 1, NOW(), NOW())
     ON DUPLICATE KEY UPDATE is_logged_in=1, last_login_time=NOW(), last_seen=NOW()`,
    [uname]
  );
  res.json({ success: true, username: uname, role });
}

app.post('/api/auth/login', route(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter both username/email and password.' });
  }
  // Accept either the username or the registered email in the same field.
  const identifier = username.trim().toLowerCase();
  const [rows] = await pool.query(
    `SELECT username, role, email FROM users WHERE (username = ? OR LOWER(email) = ?) AND password = ?`,
    [identifier, identifier, password]
  );
  if (!rows.length) {
    return res.status(401).json({ error: 'Incorrect Username/Email or Password.' });
  }
  const user = rows[0];
  if (!user.email) {
    return res.status(400).json({
      error: `No email is registered for '${user.username}'. Ask a SuperAdmin to add one in Masters > Users before OTP login will work.`,
    });
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await pool.query(
    `INSERT INTO otp_codes (username, otp, expires_at, attempts) VALUES (?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE otp=VALUES(otp), expires_at=VALUES(expires_at), attempts=0`,
    [user.username, otp, expiresAt]
  );

  try {
    await sendOtpEmail(user.email, otp);
  } catch (e) {
    console.error('[Email OTP] Failed to send:', e.message);
    return res.status(500).json({ error: 'Could not send OTP email. Please check SMTP setup / try again.' });
  }

  res.json({
    success: true,
    otpRequired: true,
    username: user.username,
    maskedEmail: maskEmail(user.email),
  });
}));

// Step 2 — verify the OTP and only now actually grant the session.
app.post('/api/auth/verify-otp', route(async (req, res) => {
  const uname = String(req.body.username || '').trim().toLowerCase();
  const otp = String(req.body.otp || '').trim();
  if (!uname || !otp) return res.status(400).json({ error: 'OTP is required.' });

  const [rows] = await pool.query(`SELECT otp, expires_at, attempts FROM otp_codes WHERE username=?`, [uname]);
  if (!rows.length) {
    return res.status(400).json({ error: 'OTP expired or not requested. Please login again.' });
  }
  const row = rows[0];
  if (new Date(row.expires_at) < new Date()) {
    await pool.query(`DELETE FROM otp_codes WHERE username=?`, [uname]);
    return res.status(400).json({ error: 'OTP expired. Please login again to get a new one.' });
  }
  if (row.attempts >= 5) {
    await pool.query(`DELETE FROM otp_codes WHERE username=?`, [uname]);
    return res.status(400).json({ error: 'Too many incorrect attempts. Please login again to get a new OTP.' });
  }
  if (row.otp !== otp) {
    await pool.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE username=?`, [uname]);
    return res.status(401).json({ error: `Incorrect OTP. ${4 - row.attempts} attempt(s) left.` });
  }

  await pool.query(`DELETE FROM otp_codes WHERE username=?`, [uname]);
  const [[user]] = await pool.query(`SELECT role FROM users WHERE username=?`, [uname]);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  await completeLoginSession(uname, user.role, res);
}));

// Resend — reuses step 1's already-verified identity (the OTP row only
// exists if the password step already passed), so this doesn't ask for the
// password again.
app.post('/api/auth/resend-otp', route(async (req, res) => {
  const uname = String(req.body.username || '').trim().toLowerCase();
  if (!uname) return res.status(400).json({ error: 'Username is required.' });
  const [[user]] = await pool.query(`SELECT email FROM users WHERE username=?`, [uname]);
  if (!user || !user.email) return res.status(400).json({ error: 'No email registered for this account.' });

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await pool.query(
    `INSERT INTO otp_codes (username, otp, expires_at, attempts) VALUES (?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE otp=VALUES(otp), expires_at=VALUES(expires_at), attempts=0`,
    [uname, otp, expiresAt]
  );
  try {
    await sendOtpEmail(user.email, otp);
  } catch (e) {
    return res.status(500).json({ error: 'Could not resend OTP email.' });
  }
  res.json({ success: true, maskedEmail: maskEmail(user.email) });
}));

// POST /api/auth/logout — flips is_logged_in back to 0 the moment someone
// clicks Logout / Switch User, so they disappear from the live list
// instantly instead of waiting for the heartbeat to go stale.
app.post('/api/auth/logout', route(async (req, res) => {
  const uname = String(req.body.username || '').trim().toLowerCase();
  if (!uname) return res.status(400).json({ error: 'Username is required.' });
  await pool.query(`UPDATE user_sessions SET is_logged_in=0 WHERE username=?`, [uname]);
  res.json({ success: true });
}));

// POST /api/auth/heartbeat — the frontend pings this every ~20s while the
// app is open in a tab, just to refresh last_seen. This is what lets
// GET /api/sessions/live tell "cleanly logged out" apart from "closed the
// tab / lost network without logging out" — a session whose last_seen goes
// stale gets auto-marked offline for everyone, even without a clean logout.
app.post('/api/auth/heartbeat', route(async (req, res) => {
  const uname = String(req.body.username || '').trim().toLowerCase();
  if (!uname) return res.status(400).json({ error: 'Username is required.' });
  await pool.query(
    `INSERT INTO user_sessions (username, is_logged_in, last_login_time, last_seen)
     VALUES (?, 1, NOW(), NOW())
     ON DUPLICATE KEY UPDATE is_logged_in=1, last_seen=NOW()`,
    [uname]
  );
  res.json({ success: true });
}));

// GET /api/sessions/live — real, database-backed "Live Network Users" list
// (every row in `users`, left-joined with its current `user_sessions` row),
// available to EVERY logged-in role, not just SuperAdmin. Any session whose
// last_seen is older than STALE_SECONDS gets self-healed back to offline
// first, so a crashed tab / lost wifi doesn't leave someone stuck "online"
// forever.
app.get('/api/sessions/live', route(async (req, res) => {
  await pool.query(
    `UPDATE user_sessions
     SET is_logged_in=0
     WHERE is_logged_in=1 AND (last_seen IS NULL OR last_seen < (NOW() - INTERVAL ? SECOND))`,
    [SESSION_STALE_SECONDS]
  );
  const [rows] = await pool.query(`
    SELECT u.username, u.role,
           COALESCE(s.is_logged_in,0) AS is_logged_in,
           s.last_login_time, s.last_seen
    FROM users u
    LEFT JOIN user_sessions s ON s.username = u.username
    ORDER BY COALESCE(s.is_logged_in,0) DESC, u.username ASC
  `);
  res.json(rows.map((r) => ({
    username: r.username,
    role: r.role,
    online: !!r.is_logged_in,
    lastLoginTime: r.last_login_time && r.last_login_time !== '-' ? r.last_login_time : null,
    lastSeen: r.last_seen || null,
  })));
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

// Returns { day, month, year, hour, minute, second } for a Date, always in
// IST (Asia/Kolkata) — regardless of what timezone the server OS/host is
// actually set to. This fixes backup/ledger timestamps showing the wrong
// time (e.g. server running in UTC would otherwise show a time ~5:30 hours
// behind actual IST clock time).
function getISTParts(d) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  // Some environments render midnight as "24" instead of "00" with hour12:false
  if (parts.hour === '24') parts.hour = '00';
  return parts;
}

function ledgerTimestamp() {
  const p = getISTParts(new Date());
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}:${p.second}`;
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
  const proofName = req.body.proofName ? String(req.body.proofName).trim() : '-';
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
        `UPDATE stock_ledger SET status='Sold', customer_name=?, order_no=?, sales_invoice=?, invoice_date=?, sales_date=?, chalan_no=?, chalan_date=?, sales_attachment=?
         WHERE serial_no=?`,
        [customer, orderNo, invoiceNo || '-', invoiceDate, chalanDate, chalanNo, chalanDate, proofName, sn]
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

// ---------------------------------------------------------------------------
// RETURN & DAMAGE — mirrors ui/returns.py's ReturnsPage.process_adjustment()
// exactly: scan serials, apply one of two actions:
//   1) "Sales Return (Make Available)" — only allowed if current status is
//      'Sold'. Resets customer/order/invoice/date fields back to '-' and
//      tags chalan_no with a '[RETURNED] ' prefix (same ghost-data cleanup
//      the desktop app does), status -> 'Available'.
//   2) "Mark as Damaged / Scrapped" — blocked if current status is 'Sold'
//      (must Sales-Return it back to Available first), status -> 'Damaged'.
// Whole-batch validation: if ANY scanned serial fails (not found / wrong
// status for the chosen action), the ENTIRE adjustment is blocked — nothing
// is written — exactly like the desktop app's "ADJUSTMENT BLOCKED" message.
// ---------------------------------------------------------------------------
app.post('/api/returns', route(async (req, res) => {
  const actionType = String(req.body.actionType || '').trim();
  const remarks = String(req.body.remarks || '').trim();
  const actionDate = String(req.body.date || '').trim();
  const serials = Array.isArray(req.body.serials) ? req.body.serials.map((s) => String(s).trim()).filter(Boolean) : [];

  if (!['Sales Return (Make Available)', 'Mark as Damaged / Scrapped'].includes(actionType)) {
    return res.status(400).json({ error: 'Invalid Action Type.' });
  }
  if (!remarks || !actionDate || !serials.length) {
    return res.status(400).json({ error: 'Remarks, Date, and Serials are mandatory.' });
  }
  if (new Set(serials).size !== serials.length) {
    return res.status(400).json({ error: 'The entry queue contains identical duplicates.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const invalidSerials = [];
    const validUpdates = [];
    for (const sn of serials) {
      const [rows] = await conn.query(`SELECT status FROM stock_ledger WHERE serial_no=? FOR UPDATE`, [sn]);
      if (!rows.length) {
        invalidSerials.push(`'${sn}' (Not found in Database Ledger)`);
        continue;
      }
      const { status } = rows[0];
      if (actionType === 'Sales Return (Make Available)' && status !== 'Sold') {
        invalidSerials.push(`'${sn}' (Cannot return, current status is '${status}', not 'Sold')`);
      } else if (actionType === 'Mark as Damaged / Scrapped' && status === 'Sold') {
        invalidSerials.push(`'${sn}' (Cannot mark damaged directly, perform Sales Return first.)`);
      } else {
        validUpdates.push({ sn, newStatus: actionType === 'Sales Return (Make Available)' ? 'Available' : 'Damaged' });
      }
    }

    if (invalidSerials.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'ADJUSTMENT BLOCKED:\n\n' + invalidSerials.join('\n') });
    }

    for (const { sn, newStatus } of validUpdates) {
      if (newStatus === 'Available') {
        await conn.query(
          `UPDATE stock_ledger
             SET status='Available',
                 chalan_no = CONCAT('[RETURNED] ', COALESCE(chalan_no, '')),
                 customer_name='-',
                 order_no='-',
                 sales_invoice='-',
                 invoice_date='-',
                 sales_date='-',
                 sales_attachment='-'
           WHERE serial_no=?`, [sn]
        );
      } else {
        await conn.query(`UPDATE stock_ledger SET status='Damaged' WHERE serial_no=?`, [sn]);
      }
    }

    await conn.commit();
    try {
      const oldDetails = `Action: ${actionType} | Date: ${actionDate}`;
      const newDetails = `Remarks: ${remarks} | Serials: ${serials.join(', ')}`;
      await pool.query(
        `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('RETURN_ADJUST', ?, 'User', ?, ?, ?)`,
        [remarks.slice(0, 50), ledgerTimestamp(), oldDetails, newDetails]
      );
    } catch (e) { /* audit log is best-effort, never block the adjustment on it */ }

    res.json({ success: true, actionType, count: validUpdates.length });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// ---------------------------------------------------------------------------
// STOCK ASSIGN — mirrors ui/assign_stock.py exactly: reserve stock for a
// person WITHOUT selling it (marks stock_ledger rows 'Assigned' instead of
// 'Sold'), a live Assigned Register, and two release paths:
//   1) Release to Firm     -> assignment cancelled, stock back to Available.
//   2) Release to Customer -> same cancel + hands off Customer/Order/lines
//      so the frontend can pre-fill the Sales page (releaseToCustomerRequested
//      signal in the desktop app).
// Same strictness as Sales dispatch: product master must already exist
// (never auto-created), and serials are picked server-side (oldest first),
// never scanned by hand — exactly like get_available_serials_for_item().
// ---------------------------------------------------------------------------

// GET /api/stockassign/available?category=&brand=&watt=&type= — mirrors
// refresh_available_qty_hint(): live "Available: N" counter shown next to
// the Quantity field as the user picks Category/Brand/Wattage/Type.
app.get('/api/stockassign/available', route(async (req, res) => {
  const { category, brand, type } = req.query;
  const watt = Number(req.query.watt) || 0;
  if (!category || !brand || !type) return res.json({ itemId: null, available: 0 });
  const itemId = await getItemId(pool, category, brand, watt, type);
  if (!itemId) return res.json({ itemId: null, available: 0 });
  const [[{ cnt }]] = await pool.query(`SELECT COUNT(*) AS cnt FROM stock_ledger WHERE status='Available' AND item_id=?`, [itemId]);
  res.json({ itemId, available: cnt });
}));

// POST /api/stockassign — mirrors process_stock_assignment(): reference
// conflict check, then for every line re-checks availability and
// auto-picks the actual serials (oldest first) right before committing,
// marking them 'Assigned' in a single transaction.
app.post('/api/stockassign', route(async (req, res) => {
  const person = String(req.body.person || '').trim();
  const reference = String(req.body.reference || '').trim();
  const date = String(req.body.date || '').trim();
  const remarks = String(req.body.remarks || '').trim() || '-';
  const proofName = String(req.body.proofName || '').trim() || '-';
  const lines = Array.isArray(req.body.lines) ? req.body.lines : [];

  if (!person || !reference) {
    return res.status(400).json({ error: 'Assign-To Person and Reference No are required.' });
  }
  if (!lines.length) {
    return res.status(400).json({ error: 'Add at least one product line (or fill Quantity) before reserving stock.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Reference no must belong to one person only — mirrors the Sales
    // challan conflict check, applied here to assign_reference instead.
    const [existing] = await conn.query(
      `SELECT DISTINCT assign_to FROM stock_ledger WHERE assign_reference=? AND status='Assigned'`,
      [reference]
    );
    if (existing.length && existing.some((row) => row.assign_to !== person)) {
      await conn.rollback();
      return res.status(400).json({ error: 'This Reference No is already assigned to a different person.' });
    }

    // Re-check availability + auto-pick serials (oldest first, row-locked
    // so two simultaneous reservations can't grab the same serial).
    const lineSerialMap = [];
    const availabilityErrors = [];
    for (const line of lines) {
      if (!line.cat || !line.brand || !line.type || !line.qty || Number(line.qty) <= 0) {
        availabilityErrors.push('Category, Brand, Type and Qty are required for every product line.');
        continue;
      }
      const itemId = await getItemId(conn, line.cat, line.brand, line.watt, line.type);
      const wattLbl = line.watt ? `${line.watt}W` : 'N/A';
      if (!itemId) {
        availabilityErrors.push(`Selected product master (${line.brand} | ${wattLbl} | ${line.type}) was not found. Please create/check the master item first.`);
        continue;
      }
      const [picked] = await conn.query(
        `SELECT serial_no FROM stock_ledger WHERE status='Available' AND item_id=? ORDER BY id ASC LIMIT ? FOR UPDATE`,
        [itemId, Number(line.qty)]
      );
      const serials = picked.map((r) => r.serial_no);
      if (serials.length < Number(line.qty)) {
        availabilityErrors.push(`${line.brand} | ${wattLbl} | ${line.type}: only ${serials.length} unit(s) Available right now (requested ${line.qty}).`);
      } else {
        lineSerialMap.push({ line, serials });
      }
    }
    if (availabilityErrors.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'ASSIGNMENT BLOCKED:\n\n' + availabilityErrors.join('\n') });
    }

    const allSerials = lineSerialMap.flatMap((x) => x.serials);
    const failedSerials = [];
    for (const { serials } of lineSerialMap) {
      for (const sn of serials) {
        const [result] = await conn.query(
          `UPDATE stock_ledger SET status='Assigned', assign_to=?, assign_reference=?, assign_date=?, assign_remarks=?, assign_attachment=? WHERE serial_no=? AND status='Available'`,
          [person, reference, date, remarks, proofName, sn]
        );
        if (result.affectedRows === 0) failedSerials.push(sn);
      }
    }
    if (failedSerials.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Some of the reserved units were taken by another action just now. Please try again.' });
    }

    await conn.commit();
    try {
      const nowStr = new Date().toLocaleString('en-GB').replace(',', '');
      await pool.query(
        `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('STOCK_ASSIGN', ?, 'User', ?, ?, ?)`,
        [reference, nowStr, `Status: Available | Serials: ${allSerials.length}`, `Assigned To: ${person} | Ref: ${reference} | Remarks: ${remarks} | Serials: ${allSerials.join(', ')}`]
      );
    } catch (e) { /* audit log failure shouldn't block the assignment */ }

    res.json({ success: true, reference, person, lineCount: lineSerialMap.length, serialCount: allSerials.length });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// GET /api/stockassign/register?q=... — mirrors load_assigned_register():
// every currently-'Assigned' serial, grouped back into one row per
// reference/person/date/brand/watt/type. Optional ?q= filters server-side
// too (in addition to the page's own client-side search-as-you-type).
app.get('/api/stockassign/register', route(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT assign_reference AS ref, assign_to AS person, assign_date AS date,
           brand_name AS brand, watt, solar_type AS type, COUNT(*) AS qty
    FROM stock_ledger WHERE status='Assigned'
    GROUP BY assign_reference, assign_to, assign_date, brand_name, watt, solar_type
    ORDER BY assign_reference DESC
  `);
  const q = String(req.query.q || '').trim().toLowerCase();
  const mapped = rows.map((r) => ({
    ref: r.ref, person: r.person, date: r.date, brand: r.brand,
    watt: r.watt || 0, type: r.type || 'Others', qty: r.qty,
  }));
  const filtered = q
    ? mapped.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)))
    : mapped;
  res.json(filtered);
}));

// GET /api/stockassign/lines/:reference — mirrors load_reference_for_release():
// every still-'Assigned' serial under this reference, grouped back into
// product lines (with their exact serials) for the Release panel.
app.get('/api/stockassign/lines/:reference', route(async (req, res) => {
  const reference = String(req.params.reference || '').trim();
  const [rows] = await pool.query(
    `SELECT serial_no, assign_to, brand_name, watt, solar_type, category, item_id
     FROM stock_ledger WHERE assign_reference=? AND status='Assigned'`,
    [reference]
  );
  if (!rows.length) {
    return res.status(404).json({ error: 'This assignment could not be found (it may have already been released).' });
  }
  const person = rows[0].assign_to;
  const grouped = new Map();
  for (const r of rows) {
    const key = `${r.category}|${r.brand_name}|${r.watt || 0}|${r.solar_type}|${r.item_id}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type,
        itemId: r.item_id, serials: [],
      });
    }
    grouped.get(key).serials.push(r.serial_no);
  }
  const lines = Array.from(grouped.values()).map((l) => ({ ...l, qty: l.serials.length }));
  res.json({ reference, person, lines, allSerials: rows.map((r) => r.serial_no) });
}));

// Shared release helper — mirrors the identical "set every serial back to
// Available + clear assign_* fields" UPDATE loop used by both release_to_firm()
// and release_to_customer() in the desktop app.
async function releaseAssignedSerials(conn, reference) {
  const [rows] = await conn.query(
    `SELECT serial_no FROM stock_ledger WHERE assign_reference=? AND status='Assigned'`,
    [reference]
  );
  const serials = rows.map((r) => r.serial_no);
  if (!serials.length) return serials;
  await conn.query(
    `UPDATE stock_ledger SET status='Available', assign_to='-', assign_reference='-', assign_date='-', assign_remarks='-' WHERE serial_no IN (?)`,
    [serials]
  );
  return serials;
}

// POST /api/stockassign/release-firm — mirrors release_to_firm(): cancel
// the assignment, return every serial to the free Available pool.
app.post('/api/stockassign/release-firm', route(async (req, res) => {
  const reference = String(req.body.reference || '').trim();
  if (!reference) return res.status(400).json({ error: 'Reference No is required.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const serials = await releaseAssignedSerials(conn, reference);
    if (!serials.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Nothing to release — this assignment may have already been released.' });
    }
    await conn.commit();
    try {
      const nowStr = new Date().toLocaleString('en-GB').replace(',', '');
      await pool.query(
        `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('STOCK_RELEASE_FIRM', ?, 'User', ?, ?, ?)`,
        [reference, nowStr, `Serials: ${serials.length}`, 'Released back to Available stock']
      );
    } catch (e) { /* audit log failure shouldn't block the release */ }
    res.json({ success: true, reference, serialCount: serials.length });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// POST /api/stockassign/release-customer — mirrors release_to_customer():
// same "back to Available" release, then returns Customer/Order/lines so
// the frontend can redirect to Project Sales pre-filled (Challan No is the
// only thing left for the user to fill before a normal, fully-validated
// dispatch).
app.post('/api/stockassign/release-customer', route(async (req, res) => {
  const reference = String(req.body.reference || '').trim();
  const customer = String(req.body.customer || '').trim();
  const orderNo = String(req.body.orderNo || '').trim();
  if (!reference) return res.status(400).json({ error: 'Reference No is required.' });
  if (!customer || !orderNo) return res.status(400).json({ error: 'Release Customer and Release Order No are required.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT serial_no, brand_name, watt, solar_type, category, item_id
       FROM stock_ledger WHERE assign_reference=? AND status='Assigned'`,
      [reference]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Nothing to release — this assignment may have already been released.' });
    }
    const grouped = new Map();
    for (const r of rows) {
      const key = `${r.category}|${r.brand_name}|${r.watt || 0}|${r.solar_type}|${r.item_id}`;
      if (!grouped.has(key)) grouped.set(key, { cat: r.category, brand: r.brand_name, watt: r.watt || 0, type: r.solar_type, itemId: r.item_id, serials: [] });
      grouped.get(key).serials.push(r.serial_no);
    }
    const lines = Array.from(grouped.values()).map((l) => ({ cat: l.cat, brand: l.brand, watt: l.watt, type: l.type, qty: l.serials.length }));

    await releaseAssignedSerials(conn, reference);
    await conn.commit();
    try {
      const nowStr = new Date().toLocaleString('en-GB').replace(',', '');
      await pool.query(
        `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details) VALUES ('STOCK_RELEASE_CUSTOMER', ?, 'User', ?, ?, ?)`,
        [reference, nowStr, `Serials: ${rows.length}`, `Redirected to Sales for Customer: ${customer} | Order: ${orderNo}`]
      );
    } catch (e) { /* audit log failure shouldn't block the release */ }
    res.json({ success: true, reference, customer, orderNo, lines, serialCount: rows.length });
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
                    brand_name, watt, solar_type, serial_no, sales_attachment
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
    proofName: head.sales_attachment,
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
  const proofName = req.body.proofName ? String(req.body.proofName).trim() : null;
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

    // Keep-Existing support for the Proof File, same pattern as
    // /api/purchase/:invoiceNo — a null proofName means the user didn't
    // attach a replacement, so re-use whatever this order already had.
    const [metaRows] = await conn.query(
      `SELECT sales_attachment FROM stock_ledger WHERE order_no=? LIMIT 1`,
      [loadedOrderNo]
    );
    const existingAttachment = metaRows.length ? metaRows[0].sales_attachment : '-';
    const finalProof = proofName || existingAttachment || '-';

    for (const line of lines) {
      const itemId = await getItemId(conn, line.cat, line.brand, line.watt, line.type);
      const itemName = itemNameSlug(line.brand, line.watt, line.type);
      for (const sn of (line.serials || [])) {
        await conn.query(
          `UPDATE stock_ledger SET
             status='Sold', item_id=?, item_name=?, category=?, brand_name=?, watt=?, solar_type=?,
             customer_name=?, order_no=?, sales_invoice=?, invoice_date=?, sales_date=?, chalan_no=?, chalan_date=?, sales_attachment=?, edited_flag=1
           WHERE serial_no=?`,
          [itemId, itemName, line.cat, line.brand, Number(line.watt) || 0, line.type, newCust, loadedOrderNo, newInv || '-', newInvDate, newChalanDate, newChalan, newChalanDate, finalProof, sn]
        );
      }
    }

    // Any original serial no longer present in the edited lines is reverted
    // back to Available stock — mirrors the trailing `for old_sn in
    // self.original_serial_list` loop.
    const removed = originalSerials.filter((sn) => !allNewSerials.includes(sn));
    if (removed.length) {
      await conn.query(
        `UPDATE stock_ledger SET status='Available', customer_name='-', order_no='-', sales_invoice='-', invoice_date='-', sales_date='-', chalan_no='-', chalan_date='-', sales_attachment='-', edited_flag=1
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
    `UPDATE stock_ledger SET status='Available', customer_name='-', order_no='-', sales_invoice='-', invoice_date='-', sales_date='-', chalan_no='-', chalan_date='-', sales_attachment='-', edited_flag=1
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
  const [rows] = await pool.query(`SELECT username, role, email FROM users ORDER BY username ASC`);
  res.json(rows);
}));

app.post('/api/masters/users', route(async (req, res) => {
  const { username, password, role, email } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and Password are mandatory.' });
  const uname = username.trim().toLowerCase();
  const mail = email ? email.trim().toLowerCase() : null;
  try {
    await pool.query(`INSERT INTO users (username, password, role, email) VALUES (?, ?, ?, ?)`, [uname, password, role || 'User', mail]);
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

// Sets/updates the email OTP login relies on for a given user — separate
// from the password update so an admin can fix/add just the email without
// touching the password.
app.put('/api/masters/users/email', route(async (req, res) => {
  const { username, email } = req.body;
  if (!username || !email) return res.status(400).json({ error: 'Username and Email are mandatory.' });
  const [result] = await pool.query(
    `UPDATE users SET email = ? WHERE username = ?`,
    [email.trim().toLowerCase(), username.trim().toLowerCase()]
  );
  if (result.affectedRows === 0) return res.status(400).json({ error: 'User configuration profile not found.' });
  res.json({ success: true });
}));

// ---------------------------------------------------------------------------
// BACKUP & RESTORE — mirrors ui/backup.py exactly:
//   - Exports a fixed list of tables to one Excel (.xlsx) workbook, one
//     sheet per table (users.password column masked as '********').
//   - Saves to the shared NAS folder if reachable, else falls back to a
//     local folder next to the server (never blocks the backup).
//   - `backup_log` table tracks every backup (Auto or Manual) so every
//     office PC/browser sees the same "today's backup done?" state.
//   - AUTOMATIC: checked every 10 minutes (+ once ~4s after server start);
//     runs at most once per calendar day. Since this is a server that runs
//     continuously (unlike the desktop app opened per-PC), this interval
//     lives here instead of per-page-open.
//   - MANUAL: "Backup Now (Force)" always creates an extra backup on
//     demand; today's automatic routine still only runs once regardless.
// Browsers can't "open" an arbitrary NAS/network folder the way the desktop
// app's QDesktopServices.openUrl does, so the frontend instead offers a
// direct download of any backup file straight from the server.
// ---------------------------------------------------------------------------
const BACKUP_FOLDER_NAME = 'EcoGreenSolar_Backups';
// Override with env var BACKUP_NAS_PATH if this server runs on a different
// machine than the desktop app (same idea as NAS_BACKUP_PATH in backup.py).
const NAS_BACKUP_PATH = process.env.BACKUP_NAS_PATH
  || '\\\\As6302t-989d\\work\\2023-24\\Solar Rooftop\\NP - Site Visit, 3D\\SUMIT\\Solar_ERP_DB';
const BACKUP_AUTO_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const RECENT_BACKUPS_TO_SHOW = 12;
const TABLES_TO_BACKUP = [
  ['categories', 'Categories'],
  ['subtypes', 'Subtypes'],
  ['items', 'Items'],
  ['warehouses', 'Warehouses'],
  ['units', 'Units'],
  ['stock_ledger', 'Stock_Ledger'],
  ['ledgers', 'Ledgers'],
  ['audit_logs', 'Audit_Logs'],
  ['users', 'Users'],
];

async function ensureBackupLogTable() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS backup_log (
      id INT AUTO_INCREMENT PRIMARY KEY,
      backup_type VARCHAR(20) DEFAULT 'Auto',
      file_name VARCHAR(500),
      file_path TEXT,
      taken_by VARCHAR(100) DEFAULT '-',
      taken_on VARCHAR(50),
      status VARCHAR(20) DEFAULT 'Success',
      details TEXT
    )`);
  } catch (e) { /* best-effort, same as the desktop app's safety net */ }
}

// Tries the NAS folder first; falls back to a local folder next to this
// server file if the NAS path isn't reachable right now (offline/network
// issue) — backup never fails just because the NAS is down.
function resolveBackupDir() {
  try {
    fs.mkdirSync(NAS_BACKUP_PATH, { recursive: true });
    const target = path.join(NAS_BACKUP_PATH, BACKUP_FOLDER_NAME);
    fs.mkdirSync(target, { recursive: true });
    return { dir: target, onNas: true };
  } catch (e) { /* fall through to local */ }
  const localTarget = path.join(__dirname, BACKUP_FOLDER_NAME);
  fs.mkdirSync(localTarget, { recursive: true });
  return { dir: localTarget, onNas: false };
}

async function exportAllTablesToExcel(destPath) {
  const workbook = new ExcelJS.Workbook();
  let anySheetWritten = false;
  for (const [tableName, sheetName] of TABLES_TO_BACKUP) {
    let rows;
    try {
      [rows] = await pool.query(`SELECT * FROM ??`, [tableName]);
    } catch (e) {
      continue; // table may not exist in an older DB version — skip, keep the rest
    }
    const sheet = workbook.addWorksheet(sheetName);
    const columns = rows.length ? Object.keys(rows[0]) : [];
    if (columns.length) {
      sheet.addRow(columns);
      rows.forEach((r) => {
        sheet.addRow(columns.map((c) => (tableName === 'users' && c === 'password') ? '********' : r[c]));
      });
    }
    anySheetWritten = true;
  }
  if (!anySheetWritten) {
    const sheet = workbook.addWorksheet('Info');
    sheet.addRow(['Info']);
    sheet.addRow(['No data found to backup.']);
  }
  await workbook.xlsx.writeFile(destPath);
}

function backupTimestampStamp() {
  const p = getISTParts(new Date());
  return `${p.year}${p.month}${p.day}_${p.hour}${p.minute}${p.second}`;
}

async function runBackup(backupType) {
  const { dir, onNas } = resolveBackupDir();
  const fileName = `EcoGreenSolar_Backup_${backupType}_${backupTimestampStamp()}.xlsx`;
  const destPath = path.join(dir, fileName);

  let success = true;
  let message = 'Backup created successfully.';
  try {
    await exportAllTablesToExcel(destPath);
  } catch (e) {
    success = false;
    message = e.message;
  }

  const status = success ? 'Success' : 'Failed';
  const locationNote = onNas ? 'NAS folder' : 'Local server folder (NAS not reachable)';
  try {
    await pool.query(
      `INSERT INTO backup_log (backup_type, file_name, file_path, taken_by, taken_on, status, details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [backupType, fileName, destPath, backupType === 'Auto' ? 'System' : 'Manual User', ledgerTimestamp(), status, `${message} | Saved to: ${locationNote}`]
    );
  } catch (e) { /* logging failure shouldn't hide the backup result */ }

  return { success, message, fileName, destPath, onNas };
}

// Runs at most once per calendar day — mirrors check_auto_backup(): if
// today's backup (any status counts as "checked", only 'Success' counts as
// "done") already happened, skip silently.
async function checkAutoBackup() {
  try {
    const [rows] = await pool.query(`SELECT taken_on FROM backup_log WHERE status='Success' ORDER BY id DESC LIMIT 1`);
    if (rows.length) {
      const lastDate = String(rows[0].taken_on || '').split(' ')[0];
      const todayDate = ledgerTimestamp().split(' ')[0];
      if (lastDate === todayDate) return;
    }
    await runBackup('Auto');
  } catch (e) { /* best-effort, never crash the server over a missed auto-backup */ }
}

app.get('/api/backup/status', route(async (req, res) => {
  const { dir, onNas } = resolveBackupDir();
  const [lastRows] = await pool.query(
    `SELECT backup_type, file_name, taken_on, status FROM backup_log WHERE status='Success' ORDER BY id DESC LIMIT 1`
  );
  const [recentRows] = await pool.query(
    `SELECT backup_type, file_name, taken_on, status, details FROM backup_log ORDER BY id DESC LIMIT ?`,
    [RECENT_BACKUPS_TO_SHOW]
  );
  res.json({
    backupDir: dir,
    onNas,
    lastBackup: lastRows[0] || null,
    recent: recentRows,
  });
}));

app.post('/api/backup/run', route(async (req, res) => {
  const result = await runBackup('Manual');
  if (!result.success) return res.status(500).json({ error: result.message });
  res.json({ success: true, fileName: result.fileName, onNas: result.onNas });
}));

// Serves a specific backup file straight from disk for download — this is
// the web equivalent of the desktop app's "Open Backup Folder" (a browser
// can't open an arbitrary NAS/network folder for security reasons, so
// downloading the actual file is the practical substitute).
app.get('/api/backup/download/:fileName', route(async (req, res) => {
  const { fileName } = req.params;
  const [rows] = await pool.query(`SELECT file_path FROM backup_log WHERE file_name=? ORDER BY id DESC LIMIT 1`, [fileName]);
  if (!rows.length) return res.status(404).json({ error: 'Backup record not found.' });
  const filePath = rows[0].file_path;
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup file no longer exists on disk (it may have been moved/deleted on the NAS).' });
  res.download(filePath, fileName);
}));

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API running on port ${PORT}`);
  ensureBackupLogTable().then(() => {
    setTimeout(checkAutoBackup, 4000);
    setInterval(checkAutoBackup, BACKUP_AUTO_CHECK_INTERVAL_MS);
  });
});