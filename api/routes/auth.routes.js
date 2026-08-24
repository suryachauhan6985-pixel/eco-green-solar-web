module.exports = function registerAuthRoutes(app, deps) {
  const { pool, route, requireRole, issueToken, hashPassword, verifyPassword, generateOtp, sendOtpEmail, maskEmail, OTP_TTL_MINUTES, loginLimiter, otpLimiter, registerLimiter, forgotPasswordLimiter } = deps;
  const SESSION_STALE_SECONDS = 40;

  function parseDeviceLabel(ua) {
    const s = String(ua || '');
    let browser = 'Browser';
    if (/Edg\//i.test(s)) browser = 'Edge';
    else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = 'Chrome';
    else if (/Firefox\//i.test(s)) browser = 'Firefox';
    else if (/Safari\//i.test(s) && !/Chrome/i.test(s)) browser = 'Safari';
    else if (/OPR\//i.test(s) || /Opera/i.test(s)) browser = 'Opera';
    let os = 'Device';
    if (/Android/i.test(s)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(s)) os = 'iOS';
    else if (/Windows/i.test(s)) os = 'Windows';
    else if (/Mac OS X|Macintosh/i.test(s)) os = 'Mac';
    else if (/Linux/i.test(s)) os = 'Linux';
    return browser + ' · ' + os;
  }

  async function completeLoginSession(uname, role, res, req) {
    await pool.query(
      `INSERT INTO user_sessions (username, is_logged_in, last_login_time, last_seen)
       VALUES (?, 1, NOW(), NOW())
       ON DUPLICATE KEY UPDATE is_logged_in=1, last_login_time=NOW(), last_seen=NOW()`,
      [uname]
    );

    const issued = issueToken(uname, role);
    const token = issued.token;
    const jti = issued.jti;
    const ua = (req && (req.headers['user-agent'] || '')) || '';
    const ip = (req && (req.headers['x-forwarded-for'] || req.ip || '')) || '';
    const ipOne = String(ip).split(',')[0].trim().slice(0, 64);
    const label = parseDeviceLabel(ua);
    try {
      await pool.query(
        `INSERT INTO auth_device_sessions (jti, username, device_label, user_agent, ip, created_at, last_seen)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [jti, uname, label, String(ua).slice(0, 500), ipOne]
      );
    } catch (e) {
      console.warn('[Auth] could not insert device session:', e.message);
    }

    res.json({ success: true, username: uname, role, token, sessionId: jti, deviceLabel: label });
  }

  app.post('/api/auth/login', loginLimiter, route(async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Please enter both username/email and password.' });
    }
    // Accept either the username or the registered email in the same field.
    const identifier = username.trim().toLowerCase();
    const [rows] = await pool.query(
      `SELECT username, role, email, is_verified, password FROM users WHERE (username = ? OR LOWER(email) = ?)`,
      [identifier, identifier]
    );
    if (!rows.length) {
      return res.status(401).json({ error: 'Incorrect Username/Email or Password.' });
    }
    const user = rows[0];
    const { valid, needsRehash } = await verifyPassword(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect Username/Email or Password.' });
    }
    if (needsRehash) {
      // Legacy plaintext account that just proved it owns the password —
      // upgrade it to a bcrypt hash right now, transparently.
      const upgraded = await hashPassword(password);
      await pool.query(`UPDATE users SET password = ? WHERE username = ?`, [upgraded, user.username]);
    }
    if (!user.is_verified) {
      return res.status(403).json({
        error: 'Please verify your email first. Use "Resend OTP" on the registration screen, or contact a SuperAdmin.',
        unverified: true,
        username: user.username,
      });
    }
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
  app.post('/api/auth/verify-otp', otpLimiter, route(async (req, res) => {
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
    await completeLoginSession(uname, user.role, res, req);
  }));

  // Resend — reuses step 1's already-verified identity (the OTP row only
  // exists if the password step already passed), so this doesn't ask for the
  // password again. Also doubles as the "resend" for a pending Registration
  // (unverified account) since it only cares that a row + email exist.
  app.post('/api/auth/resend-otp', otpLimiter, route(async (req, res) => {
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

  // ---------------------------------------------------------------------------
  // REGISTER — self-service account creation from the login screen (previously
  // the only way to get an account was a SuperAdmin adding one in
  // Masters > Users). New accounts:
  //   - always get role 'User' (never SuperAdmin — that still has to be
  //     granted manually in Masters > Users, same as before);
  //   - are inserted with is_verified=0 and can't login until the OTP emailed
  //     here is confirmed via POST /api/auth/verify-register-otp, which also
  //     signs the person straight in on success.
  // ---------------------------------------------------------------------------
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  app.post('/api/auth/register', registerLimiter, route(async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, Email and Password are all mandatory.' });
    }
    const uname = String(username).trim().toLowerCase();
    const mail = String(email).trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,50}$/.test(uname)) {
      return res.status(400).json({ error: 'Username must be 3-50 characters (letters, numbers, dot, underscore, hyphen only).' });
    }
    if (!EMAIL_RE.test(mail)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const [[usernameTaken]] = await pool.query(`SELECT username FROM users WHERE username = ?`, [uname]);
    if (usernameTaken) return res.status(400).json({ error: 'That username is already taken.' });
    // Self-registration always creates role 'User' (see note above), so the
    // duplicate check only needs to look at existing 'User' accounts — the
    // same email is still free to register a separate Admin/SuperAdmin
    // account (created via Masters > Users), per uniq_email_role.
    const [[emailTaken]] = await pool.query(`SELECT username FROM users WHERE LOWER(email) = ? AND role = 'User'`, [mail]);
    if (emailTaken) return res.status(400).json({ error: 'A User account with that email already exists.' });

    try {
      const hashed = await hashPassword(password);
      await pool.query(
        `INSERT INTO users (username, password, role, email, is_verified) VALUES (?, ?, 'User', ?, 0)`,
        [uname, hashed, mail]
      );
    } catch (e) {
      if (e && e.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'A User account with that email already exists.' });
      }
      throw e;
    }
    await pool.query(`INSERT IGNORE INTO user_sessions (username, is_logged_in, last_login_time) VALUES (?, 0, '-')`, [uname]);

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await pool.query(
      `INSERT INTO otp_codes (username, otp, expires_at, attempts) VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE otp=VALUES(otp), expires_at=VALUES(expires_at), attempts=0`,
      [uname, otp, expiresAt]
    );
    try {
      await sendOtpEmail(mail, otp);
    } catch (e) {
      console.error('[Email OTP] Failed to send:', e.message);
      return res.status(500).json({ error: 'Account created but the verification email could not be sent. Try "Resend OTP".' });
    }

    res.json({ success: true, otpRequired: true, username: uname, maskedEmail: maskEmail(mail) });
  }));

  // Step 2 of Registration — verify the OTP, flip is_verified on, and sign the
  // person straight in (same session logic the login OTP step uses).
  app.post('/api/auth/verify-register-otp', otpLimiter, route(async (req, res) => {
    const uname = String(req.body.username || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();
    if (!uname || !otp) return res.status(400).json({ error: 'OTP is required.' });

    const [rows] = await pool.query(`SELECT otp, expires_at, attempts FROM otp_codes WHERE username=?`, [uname]);
    if (!rows.length) {
      return res.status(400).json({ error: 'OTP expired or not requested. Please register again.' });
    }
    const row = rows[0];
    if (new Date(row.expires_at) < new Date()) {
      await pool.query(`DELETE FROM otp_codes WHERE username=?`, [uname]);
      return res.status(400).json({ error: 'OTP expired. Please use "Resend OTP".' });
    }
    if (row.attempts >= 5) {
      await pool.query(`DELETE FROM otp_codes WHERE username=?`, [uname]);
      return res.status(400).json({ error: 'Too many incorrect attempts. Please use "Resend OTP".' });
    }
    if (row.otp !== otp) {
      await pool.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE username=?`, [uname]);
      return res.status(401).json({ error: `Incorrect OTP. ${4 - row.attempts} attempt(s) left.` });
    }

    await pool.query(`DELETE FROM otp_codes WHERE username=?`, [uname]);
    const [[user]] = await pool.query(`SELECT role FROM users WHERE username=?`, [uname]);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    await pool.query(`UPDATE users SET is_verified=1 WHERE username=?`, [uname]);
    await completeLoginSession(uname, user.role, res, req);
  }));

  // ---------------------------------------------------------------------------
  // FORGOT PASSWORD — 2-step, same shape as login:
  //   Step 1: POST /api/auth/forgot-password   (username or email)
  //           -> if an account exists, emails a 6-digit OTP and returns
  //              { success: true, username, maskedEmail }. Does not require
  //              the current password (that's the whole point).
  //   Step 2: POST /api/auth/reset-password    (username + otp + newPassword)
  //           -> checks the OTP and, only if correct, overwrites the password.
  // ---------------------------------------------------------------------------
  app.post('/api/auth/forgot-password', forgotPasswordLimiter, route(async (req, res) => {
    const identifier = String(req.body.username || '').trim().toLowerCase();
    if (!identifier) return res.status(400).json({ error: 'Please enter your username or email.' });

    const [[user]] = await pool.query(
      `SELECT username, email FROM users WHERE username = ? OR LOWER(email) = ?`,
      [identifier, identifier]
    );
    if (!user) return res.status(404).json({ error: 'No account found with that username/email.' });
    if (!user.email) {
      return res.status(400).json({ error: `No email is registered for '${user.username}'. Ask a SuperAdmin to add one in Masters > Users.` });
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
      return res.status(500).json({ error: 'Could not send OTP email. Please try again.' });
    }

    res.json({ success: true, username: user.username, maskedEmail: maskEmail(user.email) });
  }));

  // Step 2 — verify the OTP and set the new password in one call (no separate
  // reset-token step; the attempts/expiry guard on otp_codes is the same
  // protection login/register already rely on).
  app.post('/api/auth/reset-password', otpLimiter, route(async (req, res) => {
    const uname = String(req.body.username || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();
    const newPassword = String(req.body.newPassword || '');
    if (!uname || !otp || !newPassword) {
      return res.status(400).json({ error: 'Username, OTP and new Password are all required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const [rows] = await pool.query(`SELECT otp, expires_at, attempts FROM otp_codes WHERE username=?`, [uname]);
    if (!rows.length) {
      return res.status(400).json({ error: 'OTP expired or not requested. Please start "Forgot Password" again.' });
    }
    const row = rows[0];
    if (new Date(row.expires_at) < new Date()) {
      await pool.query(`DELETE FROM otp_codes WHERE username=?`, [uname]);
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }
    if (row.attempts >= 5) {
      await pool.query(`DELETE FROM otp_codes WHERE username=?`, [uname]);
      return res.status(400).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
    }
    if (row.otp !== otp) {
      await pool.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE username=?`, [uname]);
      return res.status(401).json({ error: `Incorrect OTP. ${4 - row.attempts} attempt(s) left.` });
    }

    await pool.query(`DELETE FROM otp_codes WHERE username=?`, [uname]);
    const hashedNew = await hashPassword(newPassword);
    const [result] = await pool.query(`UPDATE users SET password = ? WHERE username = ?`, [hashedNew, uname]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ success: true });
  }));

  // POST /api/auth/logout — flips is_logged_in back to 0 the moment someone
  // clicks Logout / Switch User, so they disappear from the live list
  // instantly instead of waiting for the heartbeat to go stale.
  app.post('/api/auth/logout', route(async (req, res) => {
    const header = req.headers['authorization'] || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    let uname = null;
    let jti = null;
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../middleware/auth.middleware');
        const payload = jwt.verify(token, JWT_SECRET);
        uname = payload.username;
        jti = payload.jti || null;
      } catch (e) { /* expired token */ }
    }
    if (!uname) uname = String((req.body && req.body.username) || '').trim().toLowerCase() || null;

    if (jti) {
      await pool.query(`UPDATE auth_device_sessions SET revoked_at=NOW() WHERE jti=? AND revoked_at IS NULL`, [jti]);
    }
    if (uname) {
      const [[left]] = await pool.query(
        `SELECT COUNT(*) AS c FROM auth_device_sessions WHERE username=? AND revoked_at IS NULL`,
        [uname]
      );
      if (!left || !Number(left.c)) {
        await pool.query(`UPDATE user_sessions SET is_logged_in=0 WHERE username=?`, [uname]);
      }
    }
    res.json({ success: true });
  }));

  // POST /api/auth/heartbeat — the frontend pings this every ~20s while the
  // app is open in a tab, just to refresh last_seen. This is what lets
  // GET /api/sessions/live tell "cleanly logged out" apart from "closed the
  // tab / lost network without logging out" — a session whose last_seen goes
  // stale gets auto-marked offline for everyone, even without a clean logout.
  app.post('/api/auth/heartbeat', route(async (req, res) => {
    const uname = req.user.username;
    await pool.query(
      `INSERT INTO user_sessions (username, is_logged_in, last_login_time, last_seen)
       VALUES (?, 1, NOW(), NOW())
       ON DUPLICATE KEY UPDATE is_logged_in=1, last_seen=NOW()`,
      [uname]
    );
    if (req.user.jti) {
      await pool.query(
        `UPDATE auth_device_sessions SET last_seen=NOW() WHERE jti=? AND revoked_at IS NULL`,
        [req.user.jti]
      );
    }
    // Sliding session: re-issue token with same jti so expiry keeps extending
    // while the tab is open. Explicit logout / remote revoke still ends it.
    let token = null;
    try {
      const issued = issueToken(uname, req.user.role, req.user.jti || undefined);
      token = issued.token;
    } catch (e) { /* non-fatal */ }
    res.json({ success: true, token: token || undefined });
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


  // Instagram-style Login activity / remote logout
  app.get('/api/auth/my-sessions', route(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in.' });
    const uname = req.user.username;
    const [rows] = await pool.query(
      `SELECT id, jti, device_label, ip, created_at, last_seen, revoked_at
       FROM auth_device_sessions
       WHERE username=?
       ORDER BY (revoked_at IS NULL) DESC, last_seen DESC
       LIMIT 40`,
      [uname]
    );
    res.json({
      currentJti: req.user.jti || null,
      sessions: rows.map((r) => ({
        id: r.id,
        jti: r.jti,
        deviceLabel: r.device_label || 'Unknown device',
        ip: r.ip || null,
        createdAt: r.created_at,
        lastSeen: r.last_seen,
        revoked: !!r.revoked_at,
        isCurrent: !!(req.user.jti && r.jti === req.user.jti),
      })),
    });
  }));

  app.post('/api/auth/sessions/:id/revoke', route(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in.' });
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid session id.' });
    const [result] = await pool.query(
      `UPDATE auth_device_sessions SET revoked_at=NOW()
       WHERE id=? AND username=? AND revoked_at IS NULL`,
      [id, req.user.username]
    );
    res.json({ success: true, affected: result.affectedRows || 0 });
  }));

  app.post('/api/auth/sessions/revoke-others', route(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in.' });
    const jti = req.user.jti || '';
    const [result] = await pool.query(
      `UPDATE auth_device_sessions SET revoked_at=NOW()
       WHERE username=? AND revoked_at IS NULL AND (jti IS NULL OR jti<>?)`,
      [req.user.username, jti]
    );
    res.json({ success: true, affected: result.affectedRows || 0 });
  }));


  // User preferences (theme etc.) — synced across devices
  app.get('/api/auth/preferences', route(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in.' });
    const [[row]] = await pool.query(`SELECT preferences_json FROM users WHERE username=?`, [req.user.username]);
    let prefs = {};
    try { prefs = row && row.preferences_json ? JSON.parse(row.preferences_json) : {}; } catch (e) { prefs = {}; }
    res.json({ preferences: prefs && typeof prefs === 'object' ? prefs : {} });
  }));

  app.put('/api/auth/preferences', route(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in.' });
    const incoming = req.body && typeof req.body === 'object' ? (req.body.preferences || req.body) : {};
    const [[row]] = await pool.query(`SELECT preferences_json FROM users WHERE username=?`, [req.user.username]);
    let current = {};
    try { current = row && row.preferences_json ? JSON.parse(row.preferences_json) : {}; } catch (e) { current = {}; }
    if (!current || typeof current !== 'object') current = {};
    const merged = Object.assign({}, current, incoming);
    // Only allow known keys
    const clean = {};
    if (merged.theme === 'dark' || merged.theme === 'light' || merged.theme === 'gray') clean.theme = merged.theme;
    if (merged.compact_tables != null) clean.compact_tables = !!merged.compact_tables;
    if (merged.smooth_animations != null) clean.smooth_animations = !!merged.smooth_animations;
    if (merged.scanner_sound) clean.scanner_sound = String(merged.scanner_sound).slice(0, 30);
    await pool.query(`UPDATE users SET preferences_json=? WHERE username=?`, [JSON.stringify(clean), req.user.username]);
    res.json({ success: true, preferences: clean });
  }));

  // Self-Service User Profile Management (Username, Email, Password)
  app.get('/api/auth/profile', route(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in.' });
    const [[user]] = await pool.query(
      `SELECT username, role, email, is_verified FROM users WHERE username = ?`,
      [req.user.username]
    );
    if (!user) return res.status(404).json({ error: 'User profile not found.' });
    res.json({
      username: user.username,
      role: user.role,
      email: user.email || '',
      isVerified: !!user.is_verified,
    });
  }));

  app.put('/api/auth/profile', route(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in.' });
    const curUname = req.user.username;
    const { newUsername, newEmail, currentPassword, newPassword } = req.body || {};

    const [[userRow]] = await pool.query(
      `SELECT username, password, email, role FROM users WHERE username = ?`,
      [curUname]
    );
    if (!userRow) return res.status(404).json({ error: 'User record not found.' });

    let finalUsername = curUname;
    let finalEmail = userRow.email || '';
    let tokenReissued = null;

    // 1. Password Verification (Required if changing password or sensitive account details)
    if (newPassword || newUsername) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Please enter your current Password/PIN to confirm account updates.' });
      }
      const { valid } = await verifyPassword(currentPassword, userRow.password);
      if (!valid) {
        return res.status(401).json({ error: 'Current Password/PIN is incorrect.' });
      }
    }

    // 2. Update Username (Atomic cascade across database)
    if (newUsername && newUsername.trim().toLowerCase() !== curUname.toLowerCase()) {
      const sanitized = newUsername.trim().toLowerCase();
      if (!/^[a-zA-Z0-9_.@-]{3,50}$/.test(sanitized)) {
        return res.status(400).json({ error: 'Username must be 3–50 characters (letters, numbers, dots, underscores, dashes).' });
      }
      const [[existingUser]] = await pool.query(`SELECT username FROM users WHERE username = ?`, [sanitized]);
      if (existingUser) {
        return res.status(400).json({ error: `Username '${sanitized}' is already taken.` });
      }

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();

        await conn.query(`UPDATE users SET username = ? WHERE username = ?`, [sanitized, curUname]);
        await conn.query(`UPDATE user_sessions SET username = ? WHERE username = ?`, [sanitized, curUname]);
        await conn.query(`UPDATE auth_device_sessions SET username = ? WHERE username = ?`, [sanitized, curUname]);
        await conn.query(`UPDATE otp_codes SET username = ? WHERE username = ?`, [sanitized, curUname]);
        await conn.query(`UPDATE scan_sheets SET created_by = ? WHERE created_by = ?`, [sanitized, curUname]);
        await conn.query(`UPDATE bom_challans SET created_by = ? WHERE created_by = ?`, [sanitized, curUname]);
        await conn.query(`UPDATE challan_category_map SET updated_by = ? WHERE updated_by = ?`, [sanitized, curUname]);
        await conn.query(`UPDATE app_settings SET updated_by = ? WHERE updated_by = ?`, [sanitized, curUname]);
        await conn.query(`UPDATE attachments SET uploaded_by = ? WHERE uploaded_by = ?`, [sanitized, curUname]);

        await conn.commit();
        finalUsername = sanitized;
      } catch (err) {
        await conn.rollback();
        console.error('[Profile Update] Username cascade failed:', err);
        return res.status(500).json({ error: 'Database update failed: ' + (err.message || 'Could not rename user.') });
      } finally {
        conn.release();
      }

      // Re-issue fresh token for new username
      try {
        const issued = issueToken(finalUsername, userRow.role, req.user.jti || undefined);
        tokenReissued = issued.token;
      } catch (e) { /* non-fatal */ }
    }

    // 3. Update Email
    if (newEmail !== undefined && newEmail !== null) {
      const sanitizedMail = String(newEmail).trim().toLowerCase();
      if (sanitizedMail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedMail)) {
        return res.status(400).json({ error: 'Please provide a valid email address.' });
      }
      if (sanitizedMail && sanitizedMail !== (userRow.email || '').toLowerCase()) {
        const [[emailTaken]] = await pool.query(
          `SELECT username FROM users WHERE LOWER(email) = ? AND role = ? AND username <> ?`,
          [sanitizedMail, userRow.role, finalUsername]
        );
        if (emailTaken) {
          return res.status(400).json({ error: `A ${userRow.role} account with this email already exists.` });
        }
      }
      await pool.query(`UPDATE users SET email = ? WHERE username = ?`, [sanitizedMail || null, finalUsername]);
      finalEmail = sanitizedMail;
    }

    // 4. Update Password
    if (newPassword && String(newPassword).trim()) {
      const passClean = String(newPassword).trim();
      if (passClean.length < 4) {
        return res.status(400).json({ error: 'New password must be at least 4 characters.' });
      }
      const hashed = await hashPassword(passClean);
      await pool.query(`UPDATE users SET password = ? WHERE username = ?`, [hashed, finalUsername]);
    }

    res.json({
      success: true,
      username: finalUsername,
      email: finalEmail,
      token: tokenReissued || undefined,
    });
  }));

  // App-wide settings & Configuration Engine
  app.get('/api/auth/app-settings', route(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in.' });
    const [rows] = await pool.query(`SELECT setting_key, setting_value FROM app_settings`);
    const settings = {};
    (rows || []).forEach((r) => { settings[r.setting_key] = r.setting_value; });

    // 1. Company Profile Defaults
    if (settings.company_name == null) settings.company_name = 'Eco Green Solar';
    if (settings.company_gstin == null) settings.company_gstin = '24AAAAA0000A1Z5';
    if (settings.company_pan == null) settings.company_pan = 'AAAAA0000A';
    if (settings.company_state_code == null) settings.company_state_code = '24';
    if (settings.company_address == null) settings.company_address = 'Plot No. 12, Industrial Area, Rajkot, Gujarat, India';
    if (settings.company_currency == null) settings.company_currency = 'INR';
    if (settings.company_fy_start == null) settings.company_fy_start = '2026-04-01';

    // 2. Configuration Profile & Feature Flags
    if (settings.config_profile == null) settings.config_profile = 'full_erp';
    if (settings.inventory_tracking == null) settings.inventory_tracking = '1';
    if (settings.serial_tracking == null) settings.serial_tracking = '1';
    if (settings.warehouse_tracking == null) settings.warehouse_tracking = '1';
    if (settings.batch_tracking == null) settings.batch_tracking = '0';
    if (settings.expiry_tracking == null) settings.expiry_tracking = '0';
    if (settings.stock_valuation == null) settings.stock_valuation = 'FIFO';

    // 3. Accounting & GST Defaults
    if (settings.accounting_enabled == null) settings.accounting_enabled = '1';
    if (settings.double_entry == null) settings.double_entry = '1';
    if (settings.cost_center == null) settings.cost_center = '1';
    if (settings.multi_currency == null) settings.multi_currency = '0';

    if (settings.gst_enabled == null) settings.gst_enabled = '1';
    if (settings.cgst_sgst_enabled == null) settings.cgst_sgst_enabled = '1';
    if (settings.igst_enabled == null) settings.igst_enabled = '1';
    if (settings.hsn_sac_enabled == null) settings.hsn_sac_enabled = '1';

    // 4. Document Numbering & Sequence Defaults
    if (settings.purchase_prefix == null) settings.purchase_prefix = 'PUR-';
    if (settings.purchase_next == null) settings.purchase_next = '1001';
    if (settings.sales_prefix == null) settings.sales_prefix = 'SAL-';
    if (settings.sales_next == null) settings.sales_next = '1001';
    if (settings.challan_prefix == null) settings.challan_prefix = 'CHL-';
    if (settings.challan_suffix == null) settings.challan_suffix = '';
    if (settings.challan_next == null) settings.challan_next = '1001';
    if (settings.challan_pad == null) settings.challan_pad = '4';

    if (settings.payment_prefix == null) settings.payment_prefix = 'PMT-';
    if (settings.payment_next == null) settings.payment_next = '1001';
    if (settings.receipt_prefix == null) settings.receipt_prefix = 'RCT-';
    if (settings.receipt_next == null) settings.receipt_next = '1001';
    if (settings.journal_prefix == null) settings.journal_prefix = 'JV-';
    if (settings.journal_next == null) settings.journal_next = '1001';
    if (settings.debitnote_prefix == null) settings.debitnote_prefix = 'DRN-';
    if (settings.debitnote_next == null) settings.debitnote_next = '1001';
    if (settings.creditnote_prefix == null) settings.creditnote_prefix = 'CRN-';
    if (settings.creditnote_next == null) settings.creditnote_next = '1001';

    // 5. Workflows & Approvals
    if (settings.approval_workflow_enabled == null) settings.approval_workflow_enabled = '0';
    if (settings.purchase_approval_threshold == null) settings.purchase_approval_threshold = '50000';
    if (settings.discount_approval_threshold == null) settings.discount_approval_threshold = '10';

    // 6. Alerts & UI Settings
    if (settings.low_stock_threshold == null) settings.low_stock_threshold = '5';
    if (settings.low_stock_alert_enabled == null) settings.low_stock_alert_enabled = '1';
    if (settings.low_stock_alert_emails == null) settings.low_stock_alert_emails = '';
    if (settings.dispatch_alert_enabled == null) settings.dispatch_alert_enabled = '0';
    if (settings.dispatch_alert_emails == null) settings.dispatch_alert_emails = '';
    if (settings.scanner_sound == null) settings.scanner_sound = 'beep';
    if (settings.erp_mode == null) settings.erp_mode = 'hybrid';
    if (settings.feature_bom_enabled == null) settings.feature_bom_enabled = '1';
    if (settings.feature_pricing_enabled == null) settings.feature_pricing_enabled = '1';
    if (settings.feature_warehouse_enabled == null) settings.feature_warehouse_enabled = '1';
    if (settings.feature_pallet_enabled == null) settings.feature_pallet_enabled = '1';
    if (settings.feature_attachment_mandatory == null) settings.feature_attachment_mandatory = '0';
    if (settings.feature_wattage_mandatory == null) settings.feature_wattage_mandatory = 'auto';
    if (settings.nav_style == null) settings.nav_style = 'both';

    res.json({ settings });
  }));

  app.put('/api/auth/app-settings', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in.' });
    const body = (req.body && req.body.settings) ? req.body.settings : (req.body || {});

    // Dependency Rule Validations
    if (body.serial_tracking === '1' && body.inventory_tracking === '0') {
      return res.status(400).json({ error: 'Serial tracking cannot be enabled because Inventory tracking is disabled.' });
    }
    if (body.expiry_tracking === '1' && body.batch_tracking === '0') {
      return res.status(400).json({ error: 'Expiry tracking cannot be enabled because Batch tracking is disabled.' });
    }
    if (body.gst_enabled === '1' && body.accounting_enabled === '0') {
      return res.status(400).json({ error: 'GST tax engine cannot be enabled because Accounting is disabled.' });
    }

    const allowed = [
      'company_name', 'company_gstin', 'company_pan', 'company_state_code', 'company_address',
      'company_currency', 'company_fy_start', 'config_profile',
      'inventory_tracking', 'serial_tracking', 'warehouse_tracking', 'batch_tracking', 'expiry_tracking', 'stock_valuation',
      'accounting_enabled', 'double_entry', 'cost_center', 'multi_currency',
      'gst_enabled', 'cgst_sgst_enabled', 'igst_enabled', 'hsn_sac_enabled',
      'purchase_prefix', 'purchase_next', 'sales_prefix', 'sales_next',
      'challan_prefix', 'challan_suffix', 'challan_next', 'challan_pad',
      'payment_prefix', 'payment_next', 'receipt_prefix', 'receipt_next',
      'journal_prefix', 'journal_next', 'debitnote_prefix', 'debitnote_next',
      'creditnote_prefix', 'creditnote_next',
      'approval_workflow_enabled', 'purchase_approval_threshold', 'discount_approval_threshold',
      'low_stock_threshold', 'low_stock_alert_enabled', 'low_stock_alert_emails',
      'dispatch_alert_enabled', 'dispatch_alert_emails', 'scanner_sound',
      'erp_mode', 'feature_bom_enabled', 'feature_pricing_enabled',
      'feature_warehouse_enabled', 'feature_pallet_enabled',
      'feature_attachment_mandatory', 'feature_wattage_mandatory', 'nav_style'
    ];

    // Read current settings for Audit Log comparison
    const [currentRows] = await pool.query(`SELECT setting_key, setting_value FROM app_settings`);
    const currentSettings = {};
    (currentRows || []).forEach(r => { currentSettings[r.setting_key] = r.setting_value; });

    const auditChanges = [];

    for (const key of allowed) {
      if (body[key] == null) continue;
      let val = String(body[key]).trim();

      // Integer fields
      if (['challan_next', 'purchase_next', 'sales_next', 'payment_next', 'receipt_next', 'journal_next', 'debitnote_next', 'creditnote_next', 'low_stock_threshold'].includes(key)) {
        const n = parseInt(val, 10);
        if (!Number.isFinite(n) || n < 1) return res.status(400).json({ error: `${key} must be a positive integer.` });
        val = String(n);
      }
      if (key === 'challan_pad') {
        const n = parseInt(val, 10);
        if (!Number.isFinite(n) || n < 0 || n > 10) return res.status(400).json({ error: 'Pad length must be 0–10.' });
        val = String(n);
      }
      if (val.length > 500) return res.status(400).json({ error: `Setting value for ${key} is too long.` });

      const oldVal = currentSettings[key] || '';
      if (oldVal !== val) {
        auditChanges.push({ key, oldVal, val });
      }

      await pool.query(
        `INSERT INTO app_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), updated_by=VALUES(updated_by)`,
        [key, val, req.user.username]
      );
    }

    // Record in Audit Logs if changes occurred
    if (auditChanges.length > 0) {
      try {
        await pool.query(
          `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details)
           VALUES (?, ?, ?, NOW(), ?, ?)`,
          [
            'SYSTEM_SETTINGS_UPDATE',
            body.config_profile || 'SETTINGS',
            req.user.username,
            JSON.stringify(auditChanges.map(c => ({ key: c.key, old: c.oldVal }))),
            JSON.stringify(auditChanges.map(c => ({ key: c.key, new: c.val })))
          ]
        );
      } catch (e) {
        console.warn('[Audit Log] Failed to record settings change:', e.message);
      }
    }

    res.json({ success: true, changesCount: auditChanges.length });
  }));

  // Auto-generate consecutive document number preview & increment
  app.get('/api/auth/next-doc-number', route(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in.' });
    const docType = String(req.query.type || 'purchase').toLowerCase();
    const [rows] = await pool.query(`SELECT setting_key, setting_value FROM app_settings WHERE setting_key IN ('${docType}_prefix', '${docType}_next', 'challan_pad', 'company_fy_start')`);
    const map = {};
    (rows || []).forEach(r => { map[r.setting_key] = r.setting_value; });

    const prefix = map[`${docType}_prefix`] || (docType === 'purchase' ? 'PUR-' : docType === 'sales' ? 'SAL-' : docType === 'challan' ? 'CHL-' : `${docType.toUpperCase()}-`);
    const nextSeq = parseInt(map[`${docType}_next`] || '1001', 10);
    const padLen = parseInt(map.challan_pad || '4', 10);
    const padded = String(nextSeq).padStart(padLen, '0');
    const curYear = new Date().getFullYear();
    const formatted = `${prefix}${curYear}-${padded}`;

    res.json({
      type: docType,
      prefix,
      sequence: nextSeq,
      formatted
    });
  }));

  // Audit Logs query endpoint
  app.get('/api/auth/audit-logs', route(async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in.' });
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const search = req.query.search ? `%${req.query.search.trim()}%` : null;

    let query = `SELECT id, transaction_type, reference_no, action_by, action_timestamp, old_details, new_details, created_at FROM audit_logs`;
    let params = [];
    if (search) {
      query += ` WHERE transaction_type LIKE ? OR reference_no LIKE ? OR action_by LIKE ?`;
      params = [search, search, search];
    }
    query += ` ORDER BY id DESC LIMIT ?`;
    params.push(limit);

    const [rows] = await pool.query(query, params);
    res.json({ logs: rows || [] });
  }));

  // Send a test verification email to confirm email address format & delivery
  app.post('/api/auth/send-test-alert-email', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const { email, alertType } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Please enter at least one email address.' });

    const rawList = String(email).split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!rawList.length) return res.status(400).json({ error: 'Please enter at least one email address.' });

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const em of rawList) {
      if (!EMAIL_RE.test(em)) {
        return res.status(400).json({ error: `Invalid email format: '${em}'. Please provide valid email address(es) (e.g. store@gmail.com).` });
      }
    }

    try {
      for (const em of rawList) {
        await sendOtpEmail(
          em,
          'ALERT-TEST',
          `[Test Verification] Eco Green Solar ERP - ${alertType || 'Alert System'}`,
          `Hello,\n\nThis is a verified test notification for Eco Green Solar ERP - ${alertType || 'Alert System'}.\nYour email '${em}' is confirmed and ready to receive automated notifications.\n\nTime: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\nOperator: @${req.user.username}`
        );
      }
      res.json({ success: true, count: rawList.length });
    } catch (err) {
      console.error('[Test Alert Email Error]:', err.message);
      return res.status(500).json({ error: 'Could not send test email: ' + (err.message || 'Check SMTP / mailer setup.') });
    }
  }));

};
