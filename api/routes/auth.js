module.exports = function registerAuthRoutes(app, deps) {
  const { pool, route, issueToken, hashPassword, verifyPassword, generateOtp, sendOtpEmail, maskEmail, OTP_TTL_MINUTES, loginLimiter, otpLimiter, registerLimiter, forgotPasswordLimiter } = deps;
  const SESSION_STALE_SECONDS = 40;

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
    // This is the only place a token is ever handed out — only after the OTP
    // step has actually succeeded. The frontend stores it and sends it back
    // as "Authorization: Bearer <token>" on every subsequent API call.
    const token = issueToken(uname, role);
    res.json({ success: true, username: uname, role, token });
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
    await completeLoginSession(uname, user.role, res);
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
    await completeLoginSession(uname, user.role, res);
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
    // req.user comes from the verified JWT (see authenticateToken above), not
    // from the request body — a logged-in user can only heartbeat as themself.
    const uname = req.user.username;
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

};
