// js/core/auth-session.js
// Authentication State, JWT Interceptor, Login Modal, Biometrics, 2FA & Multi-Tenant Sessions


// =====================================================================
// YOUTUBE-STYLE GLOBAL NETWORK SENTINEL (Offline & Online Indicators)
// =====================================================================
let networkBannerEl = null;
let onlineToastTimer = null;

function ensureNetworkBanner() {
  if (networkBannerEl) return networkBannerEl;
  networkBannerEl = document.createElement('div');
  networkBannerEl.id = 'egsNetworkBanner';
  networkBannerEl.className = 'egs-offline-banner';
  document.body.appendChild(networkBannerEl);
  return networkBannerEl;
}

function handleNetworkChange() {
  const isOnline = navigator.onLine;
  const banner = ensureNetworkBanner();
  if (onlineToastTimer) clearTimeout(onlineToastTimer);

  document.body.classList.toggle('egs-is-offline', !isOnline);

  let topbarPill = document.getElementById('topbarOfflinePill');
  const topbarHead = document.querySelector('.topbar h1');

  if (!isOnline) {
    banner.className = 'egs-offline-banner is-offline active';
    banner.innerHTML = `<i class="fa-solid fa-wifi"></i> <span>You are offline. Scans &amp; local edits will sync when reconnected.</span>`;

    if (!topbarPill && topbarHead) {
      topbarPill = document.createElement('span');
      topbarPill.id = 'topbarOfflinePill';
      topbarPill.className = 'topbar-offline-pill';
      topbarPill.style.marginLeft = '10px';
      topbarPill.innerHTML = `<i class="fa-solid fa-plane-slash"></i> Offline Mode`;
      topbarHead.appendChild(topbarPill);
    }
  } else {
    if (topbarPill) topbarPill.remove();
    banner.className = 'egs-offline-banner is-online active';
    banner.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>You are back online. Synchronizing data with server...</span>`;

    // Trigger sheets sync
    if (window.SheetsStore && typeof window.SheetsStore.syncNow === 'function') {
      window.SheetsStore.syncNow().catch(() => {});
    }

    onlineToastTimer = setTimeout(() => {
      banner.classList.remove('active');
    }, 3200);
  }
}

window.addEventListener('online', handleNetworkChange);
window.addEventListener('offline', handleNetworkChange);
if (!navigator.onLine) {
  setTimeout(handleNetworkChange, 500);
}

(function () {
  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    let url = '';
    try { url = typeof input === 'string' ? input : (input && input.url) || ''; } catch (e) { /* ignore */ }
    const isApiCall = url.indexOf('/api/') !== -1;
    // Capture the token AT CALL TIME (not at response time). A request fired
    // with an old token can still be in flight after the person has since
    // logged out, or completed a brand-new login (new token). Its 401,
    // when it finally arrives, belongs to that dead request — not to
    // whatever the person is doing right now.
    const tokenUsedForThisCall = window.currentAuthToken || (function () {
      try {
        const s = JSON.parse(sessionStorage.getItem('egs_session') || localStorage.getItem('egs_session') || '{}');
        return s.token || localStorage.getItem('egs_auth_token') || null;
      } catch (e) { return null; }
    })();
    const hadToken = !!(isApiCall && tokenUsedForThisCall);
    if (hadToken) {
      init = init ? Object.assign({}, init) : {};
      const headers = new Headers(init.headers || (typeof input !== 'string' && input && input.headers) || {});
      if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${tokenUsedForThisCall}`);
      init.headers = headers;
    }
    // Show the full-screen overlay for the duration of every /api/... call —
    // covers Api.get/post/put/delete (js/data/api.js) and any direct fetch()
    // to our own backend, from every page, automatically. Non-API fetches
    // (CDN scripts etc.) are left alone.
    // Background/polling calls (e.g. dashboard's 5s live-session refresh,
    // and the 20s session heartbeat below) pass egsSilent:true to opt out
    // of the global overlay — it should only appear for real user-initiated
    // loads, not silent background refreshes.
    const showGlobalLoader = isApiCall && !(init && init.egsSilent);
    if (showGlobalLoader) window.showLoader();
    return originalFetch(input, init).then((res) => {
      // Only raise a real "your session died" event if the token that just
      // failed is STILL the active one. If it isn't (person logged out, or
      // is mid-way through / has already finished a fresh login with a new
      // token), this 401 is stale noise from the old session and must be
      // ignored — this is what used to yank someone off the OTP screen or
      // bounce a fresh login back to the credentials step.
      if (hadToken && res.status === 401 && url.indexOf('/api/auth/') === -1 && window.currentAuthToken === tokenUsedForThisCall) {
        window.dispatchEvent(new CustomEvent('egs:session-expired'));
      }
      return res;
    }).finally(() => {
      if (showGlobalLoader) window.hideLoader();
    });
  };
})();

(function () {
  // =================== LOGIN SCREEN ===================
  // Matches the desktop .py app's LoginWidget: a centered card (logo,
  // username, password w/ show-hide toggle, "Remember Me", Sign In) that
  // covers the whole app until the person signs in. Credentials are now
  // verified against the real DB via POST /api/auth/login (same users
  // table + same exact-match rule as the desktop app's
  // validate_user_credentials()). The role is returned by the server, not
  // chosen by the person, so it can no longer be spoofed from the UI.
  const shellEl = document.querySelector('.shell');
  let loginOverlay = null;

  function updateProfileDisplay(username, role) {
    const userEl = document.querySelector('.profile-box .user');
    const avatarEl = document.querySelector('.profile-box .avatar');
    const roleEl = document.querySelector('.profile-box .role');
    const mobileAvatarEl = document.getElementById('mobileProfileAvatar');
    const btnTenantSwitcher = document.getElementById('btnTopbarTenantSwitcher');

    window.currentUsername = username;
    if (userEl) userEl.textContent = '@' + username;
    if (avatarEl) avatarEl.textContent = username.charAt(0).toUpperCase();
    if (mobileAvatarEl) mobileAvatarEl.textContent = username.charAt(0).toUpperCase();

    if (role) {
      window.currentUserRole = role;
      window.CURRENT_USER_ROLE = role;
      if (roleEl) roleEl.textContent = role === 'SuperAdmin' ? 'Super Admin' : (role === 'Admin' ? 'Administrator' : 'User');
    }

    if (btnTenantSwitcher) {
      btnTenantSwitcher.style.display = (role === 'SuperAdmin') ? 'inline-flex' : 'none';
    }

    if (typeof window.renderNavButtons === 'function') {
      window.renderNavButtons();
    }
  }

  function showApp() {
    const overlay = document.getElementById('loginOverlay') || loginOverlay;
    if (overlay) overlay.style.display = 'none';
    const shell = document.querySelector('.shell') || shellEl;
    if (shell) shell.style.display = 'flex';
  }

  // ---------- Session persistence (fixes "refresh -> back to login screen") ----------
  // Earlier, login state lived only in memory, so any page refresh wiped it
  // and forced the username/password to be typed again — "Remember Me" only
  // ever prefilled the username, it never actually kept anyone signed in.
  // Now, a successful login is saved as a small {username, role} session:
  //   - sessionStorage: always, so a refresh/reopen of THIS TAB stays signed
  //     in until the tab/browser is closed.
  //   - localStorage too, ONLY if "Remember Me" is checked, so the session
  //     also survives closing and reopening the browser entirely.
  // No password is ever stored, only the already-verified username + role.
  const SESSION_KEY = 'egs_session';
  const ACCOUNTS_KEY = 'egs_accounts'; // Instagram-style multi-account list

  function loadSavedAccounts() {
    try {
      const raw = localStorage.getItem(ACCOUNTS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter((a) => a && a.username && a.token) : [];
    } catch (e) { return []; }
  }
  function persistSavedAccounts(list) {
    try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list.slice(0, 8))); } catch (e) {}
  }
  function upsertSavedAccount(username, role, token) {
    const list = loadSavedAccounts().filter((a) => a.username !== username);
    list.unshift({ username, role, token, lastUsed: Date.now() });
    persistSavedAccounts(list);
  }
  function removeSavedAccount(username) {
    persistSavedAccounts(loadSavedAccounts().filter((a) => a.username !== username));
  }

  function saveSession(username, role, persist, token) {
    const payload = JSON.stringify({ username, role, token });
    window.currentAuthToken = token || null;
    window.currentUsername = username;
    window.currentRole = role;
    try { sessionStorage.setItem(SESSION_KEY, payload); } catch (e) { /* storage unavailable */ }
    try {
      if (persist) localStorage.setItem(SESSION_KEY, payload);
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* storage unavailable */ }
    // Always keep multi-account list updated so Switch Account works like Instagram
    if (token && username) upsertSavedAccount(username, role, token);
  }
  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && data.username && data.role && data.token) return data;
    } catch (e) { /* corrupt/unavailable storage — just fall through to login */ }
    return null;
  }
  function clearSession() {
    window.currentAuthToken = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  // ---------- Live session heartbeat ----------
  // Keeps this user marked ONLINE in `user_sessions` (real DB table, same
  // one the desktop app's "Live Network Users" tracker reads) for as long
  // as this tab stays open. Every user's Dashboard (see js/pages/dashboard.js)
  // polls GET /api/sessions/live and shows this in real time — not just
  // SuperAdmin any more.
  const HEARTBEAT_MS = 20000;
  let heartbeatTimer = null;
  function applyUserPreferencesFromServer() {
    if (window.loadThemeFromServer) window.loadThemeFromServer();
  }

  function startHeartbeat() {
    if (heartbeatTimer || !window.currentUsername) return;
    const ping = () => {
      fetch('/api/auth/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: window.currentUsername }),
        egsSilent: true, // runs every 20s in the background — must not flash the global loader
      }).then(async (res) => {
        if (!res || !res.ok) return;
        try {
          const data = await res.json();
          // Sliding session: server may return a fresh token (same device jti).
          if (data && data.token && window.currentUsername) {
            const persist = !!localStorage.getItem(SESSION_KEY);
            saveSession(window.currentUsername, window.currentRole || (loadSession() || {}).role, persist, data.token);
          }
        } catch (e) { /* ignore parse errors */ }
      }).catch(() => { /* offline momentarily — next tick retries */ });
    };
    ping(); // mark online immediately, don't wait for the first interval tick
    heartbeatTimer = setInterval(ping, HEARTBEAT_MS);
  }
  function stopHeartbeat() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }

  // NOTE: There used to be an auto-logout-after-20-minutes-of-inactivity
  // timer here. It has been removed on request — sessions now stay valid
  // until the person explicitly clicks Logout (or the stale-session
  // self-heal kicks in after a genuinely closed/crashed tab, which is a
  // separate mechanism handled server-side and left untouched).
  function resetIdleTimer() { /* no-op: kept as a harmless stub so existing calls elsewhere don't need to change */ }
  function stopIdleTimer() { /* no-op: see resetIdleTimer above */ }
  // Best-effort: tell the server this user just went offline the moment the
  // tab/browser closes, instead of waiting up to ~40s for the heartbeat to
  // go stale and self-heal. sendBeacon fires even during page unload, when
  // a normal fetch() would get cancelled.
  window.addEventListener('pagehide', () => {
    if (!window.currentUsername) return;
    try {
      const blob = new Blob([JSON.stringify({ username: window.currentUsername })], { type: 'application/json' });
      navigator.sendBeacon('/api/auth/logout', blob);
    } catch (e) { /* sendBeacon unavailable — the ~40s stale-session cleanup still catches it */ }
  });
  // Explicit logout / switch-user notifies the server right away so the
  // user disappears from everyone else's Live Users list instantly.
  function notifyServerLogout() {
    const uname = window.currentUsername;
    stopHeartbeat();
    stopIdleTimer();
    if (!uname) return Promise.resolve();
    return fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: uname }),
    }).catch(() => { /* best-effort — stale-session cleanup is the fallback */ });
  }

  function showLoginOverlay(message) {
    if (!loginOverlay) buildLoginOverlay();
    const pwdInput = document.getElementById('loginPassword');
    if (pwdInput) pwdInput.value = '';
    const errorBox = document.getElementById('loginError');
    if (errorBox) {
      if (message) {
        errorBox.textContent = message;
        errorBox.classList.add('show');
      } else {
        errorBox.classList.remove('show');
      }
    }
    // Always land back on the Sign In step, whichever step was last open
    // (e.g. someone closed mid-registration and reopens the app later).
    ['loginStepOtp', 'loginStepRegister', 'loginStepRegisterOtp', 'loginStepForgot', 'loginStepReset'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const stepCreds = document.getElementById('loginStepCreds');
    if (stepCreds) stepCreds.style.display = '';
    loginOverlay.style.display = 'flex';
    if (shellEl) shellEl.style.display = 'none';
  }

  // Set to true the moment someone starts a BRAND NEW login attempt (right
  // after their password is verified and the OTP screen opens) and cleared
  // again once that attempt finishes or is abandoned. While this is true,
  // window.currentAuthToken still holds the OLD (possibly dead) session's
  // token — any late-arriving 401 from THAT old session's leftover
  // background requests (dashboard polling, heartbeat) must NOT be allowed
  // to yank the person back to the credentials step while they're actively
  // typing/verifying their OTP for the new login. This is what used to
  // cause the OTP screen to flash open and immediately snap shut.
  window.freshLoginInProgress = false;

  // Fired by the global fetch wrapper (top of this file) whenever an API
  // call comes back 401 — token missing/expired, or (for anyone who was
  // already signed in before this update shipped) an old session that was
  // saved before tokens existed at all. Either way, the clean recovery is
  // the same: drop the stale session and send them back to a normal login
  // instead of leaving the app stuck making failed requests.
  window.addEventListener('egs:session-expired', () => {
    stopHeartbeat();
    // Clear ONLY auth session. Theme / UI preferences stay in localStorage
    // (and on the server under preferences_json) so re-login restores them.
    clearSession();
    showLoginOverlay('Please sign in again to continue.');
  });

  function buildLoginOverlay() {
    loginOverlay = document.createElement('div');
    loginOverlay.className = 'login-overlay';
    loginOverlay.innerHTML = `
      <div class="login-bg" aria-hidden="true">
        <canvas id="loginParticlesCanvas" class="login-canvas"></canvas>
        <span class="login-orb login-orb-a"></span>
        <span class="login-orb login-orb-b"></span>
        <span class="login-orb login-orb-c"></span>
        <span class="login-orb login-orb-d"></span>
        <span class="login-grid"></span>
      </div>
      <div class="login-shell">
        <div class="login-brand-panel">
          <div class="login-brand-inner">
            <div class="login-logo"><img src="assets/logo.png" alt="Eco Green Solar" class="brand-logo"></div>
            <div class="login-system-status">
              <span class="status-live-dot"></span>
              <span>Eco Green Cloud • Enterprise Operational</span>
            </div>
            <p class="login-brand-tag">ERP for stock, sales &amp; field operations</p>
            
            <!-- Dynamic Moving Highlights Feed -->
            <div class="login-ticker-container" id="loginTickerContainer">
              <div class="login-ticker-card active" data-slide="0">
                <div class="ticker-icon"><i class="fa-solid fa-solar-panel"></i></div>
                <div class="ticker-text">
                  <h4>Solar Project &amp; BOM Engine</h4>
                  <p>Smart kit assembly with serial tracking, warranty &amp; live challan generation.</p>
                </div>
              </div>
              <div class="login-ticker-card" data-slide="1">
                <div class="ticker-icon" style="color:var(--gold); background:rgba(212,175,55,0.15);"><i class="fa-solid fa-shield-halved"></i></div>
                <div class="ticker-text">
                  <h4>Enterprise 2FA &amp; Security</h4>
                  <p>Multi-device hardware tracking with email OTP protection &amp; active session audit.</p>
                </div>
              </div>
              <div class="login-ticker-card" data-slide="2">
                <div class="ticker-icon" style="color:var(--green); background:rgba(46,204,113,0.15);"><i class="fa-solid fa-chart-line"></i></div>
                <div class="ticker-text">
                  <h4>Real-Time Inventory Ledger</h4>
                  <p>Multi-warehouse stock visibility, solar generation metrics &amp; low-stock alerts.</p>
                </div>
              </div>
              <div class="login-ticker-card" data-slide="3">
                <div class="ticker-icon" style="color:var(--purple); background:rgba(155,89,182,0.15);"><i class="fa-solid fa-wifi"></i></div>
                <div class="ticker-text">
                  <h4>Offline-First Mobile Sync</h4>
                  <p>Instant barcode scanning in no-network zones with automatic cloud sync.</p>
                </div>
              </div>
              <div class="login-ticker-card" data-slide="4">
                <div class="ticker-icon" style="color:#00c0ef; background:rgba(0,192,239,0.15);"><i class="fa-solid fa-file-invoice-dollar"></i></div>
                <div class="ticker-text">
                  <h4>Party Ledger &amp; Statements</h4>
                  <p>Interactive statements, instant PDF delivery &amp; real-time balance drilldown.</p>
                </div>
              </div>
            </div>

            <!-- Ticker Controls (Centered Dots) -->
            <div class="login-ticker-footer">
              <div class="login-ticker-dots" id="loginTickerDots">
                <span class="ticker-dot active" data-idx="0"></span>
                <span class="ticker-dot" data-idx="1"></span>
                <span class="ticker-dot" data-idx="2"></span>
                <span class="ticker-dot" data-idx="3"></span>
                <span class="ticker-dot" data-idx="4"></span>
              </div>
            </div>
          </div>
        </div>
        <div class="login-card">

        <div id="loginStepCreds" class="login-step">
          <div class="login-step-head">
            <h2>Welcome back</h2>
            <p>Sign in to continue to your workspace</p>
          </div>
          <div class="login-field">
            <label>Username or Email</label>
            <div class="login-input-icon">
              <i class="fa-solid fa-user"></i>
              <input type="text" id="loginUsername" placeholder="Username or Email" autocomplete="username">
            </div>
          </div>
          <div class="login-field">
            <label>Password</label>
            <div class="login-pwd-wrap login-input-icon">
              <i class="fa-solid fa-lock"></i>
              <input type="password" id="loginPassword" placeholder="Password" autocomplete="current-password">
              <button type="button" class="login-toggle-pwd" id="loginTogglePwd"><i class="fa-solid fa-eye"></i></button>
            </div>
          </div>
          <label class="login-remember checkbox">
            <input type="checkbox" id="loginRemember">
            <div class="checkmark">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="1.5" y="1.5" width="21" height="21" rx="5" ry="5" stroke-width="2.5"></rect>
                  <polyline points="7 10 12 16 22 2" stroke-width="3.5"></polyline>
                </g>
              </svg>
              <span>Remember Me on this device</span>
            </div>
          </label>
          <div class="login-error" id="loginError">Please enter both username/email and password.</div>
          <button type="button" class="login-btn" id="loginSubmit">
            <span>Sign In</span> <i class="fa-solid fa-arrow-right"></i>
          </button>

          <div style="display:flex; align-items:center; margin:14px 0 10px 0; gap:10px;">
            <div style="flex:1; height:1px; background:var(--border-light, rgba(255,255,255,0.12));"></div>
            <span style="font-size:11px; font-weight:700; color:var(--txt-muted, #94a3b8); text-transform:uppercase; letter-spacing:0.5px;">OR</span>
            <div style="flex:1; height:1px; background:var(--border-light, rgba(255,255,255,0.12));"></div>
          </div>

          <div id="googleSignInContainer" style="display:flex; justify-content:center; width:100%; margin-bottom:12px;">
            <button type="button" class="btn btn-ghost" id="btnGoogleSignInDirect" style="width:100%; display:flex; align-items:center; justify-content:center; gap:10px; padding:9px 14px; font-size:13px; font-weight:600; background:rgba(255,255,255,0.06); border:1px solid var(--border-light, rgba(255,255,255,0.15)); border-radius:8px; cursor:pointer; color:var(--txt, #ffffff);">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>

          <div class="login-links">
            <a href="#" id="loginGoForgot">Forgot Password?</a>
            <a href="#" id="loginGoRegister">Create Account</a>
          </div>
        </div>

        <div id="loginStepOtp" class="login-step" style="display:none;">
          <div class="login-step-head">
            <div class="login-step-icon"><i class="fa-solid fa-envelope-circle-check"></i></div>
            <h2>Verify OTP</h2>
            <p id="loginOtpHint">Enter the 6-digit OTP sent to your email.</p>
          </div>
          <div class="login-field">
            <label>One-time password</label>
            <div class="otp-boxes" id="loginOtpBoxes">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1" autocomplete="one-time-code">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
            </div>
            <input type="hidden" id="loginOtpInput">
          </div>
          <div class="otp-note" id="loginOtpNote">
            OTP is valid for a few minutes.
            Didn't receive it? <button type="button" class="otp-resend-link" id="loginOtpResend">Resend OTP</button>
          </div>
          <div class="login-error" id="loginOtpError"></div>
          <button type="button" class="login-btn" id="loginOtpSubmit"><span>Verify &amp; Continue</span> <i class="fa-solid fa-check"></i></button>
          <div class="login-back-wrap">
            <button type="button" class="login-back-btn" id="loginOtpBack"><i class="fa-solid fa-arrow-left"></i> Back</button>
          </div>
        </div>

        <div id="loginStepRegister" class="login-step" style="display:none;">
          <div class="login-step-head">
            <h2>Create account</h2>
            <p>Register with your work email</p>
          </div>
          <div class="login-field">
            <label>Username</label>
            <div class="login-input-icon">
              <i class="fa-solid fa-user"></i>
              <input type="text" id="regUsername" placeholder="Choose a username" autocomplete="username">
            </div>
          </div>
          <div class="login-field">
            <label>Email</label>
            <div class="login-input-icon">
              <i class="fa-solid fa-envelope"></i>
              <input type="email" id="regEmail" placeholder="you@company.com" autocomplete="email">
            </div>
          </div>
          <div class="login-field">
            <label>Password</label>
            <div class="login-pwd-wrap login-input-icon">
              <i class="fa-solid fa-lock"></i>
              <input type="password" id="regPassword" placeholder="At least 12 characters" autocomplete="new-password">
              <button type="button" class="login-toggle-pwd" id="regTogglePwd"><i class="fa-solid fa-eye"></i></button>
            </div>
          </div>
          <div class="login-field">
            <label>Confirm Password</label>
            <div class="login-input-icon">
              <i class="fa-solid fa-lock"></i>
              <input type="password" id="regConfirmPassword" placeholder="Re-enter password" autocomplete="new-password">
            </div>
          </div>
          <div id="regPwdStrengthContainer" style="display:none;"></div>
          <div class="login-error" id="regError"></div>
          <button type="button" class="login-btn" id="regSubmit"><span>Continue</span> <i class="fa-solid fa-arrow-right"></i></button>
          <div class="login-links">
            <a href="#" id="regGoLogin">&larr; Back to Sign In</a>
          </div>
        </div>

        <div id="loginStepRegisterOtp" class="login-step" style="display:none;">
          <div class="login-step-head">
            <div class="login-step-icon"><i class="fa-solid fa-envelope-circle-check"></i></div>
            <h2>Verify email</h2>
            <p id="regOtpHint">Enter the 6-digit OTP sent to your email to activate your account.</p>
          </div>
          <div class="login-field">
            <label>One-time password</label>
            <div class="otp-boxes" id="regOtpBoxes">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1" autocomplete="one-time-code">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
            </div>
            <input type="hidden" id="regOtpInput">
          </div>
          <div class="otp-note" id="regOtpNote">
            Didn't receive OTP? <button type="button" class="otp-resend-link" id="regOtpResend">Resend OTP</button>
          </div>
          <div class="login-error" id="regOtpError"></div>
          <button type="button" class="login-btn" id="regOtpSubmit"><span>Verify &amp; Continue</span> <i class="fa-solid fa-check"></i></button>
          <div class="login-back-wrap">
            <button type="button" class="login-back-btn" id="regOtpBack"><i class="fa-solid fa-arrow-left"></i> Back</button>
          </div>
        </div>

        <div id="loginStepForgot" class="login-step" style="display:none;">
          <div class="login-step-head">
            <h2>Forgot password</h2>
            <p>We'll email you a one-time code</p>
          </div>
          <div class="login-field">
            <label>Username or Email</label>
            <div class="login-input-icon">
              <i class="fa-solid fa-user"></i>
              <input type="text" id="forgotIdentifier" placeholder="Username or Email" autocomplete="username">
            </div>
          </div>
          <div class="login-error" id="forgotError"></div>
          <button type="button" class="login-btn" id="forgotSubmit"><span>Send OTP</span> <i class="fa-solid fa-paper-plane"></i></button>
          <div class="login-links">
            <a href="#" id="forgotGoLogin">&larr; Back to Sign In</a>
          </div>
        </div>

        <div id="loginStepReset" class="login-step" style="display:none;">
          <div class="login-step-head">
            <div class="login-step-icon"><i class="fa-solid fa-key"></i></div>
            <h2>Reset password</h2>
            <p id="resetHint">Enter OTP and your new password</p>
          </div>
          <div class="login-field">
            <label>OTP</label>
            <div class="otp-boxes" id="resetOtpBoxes">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1" autocomplete="one-time-code">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
            </div>
            <input type="hidden" id="resetOtpInput">
          </div>
          <div class="otp-note" id="resetOtpNote">
            OTP sent successfully, and it is valid for 5 mins.
            Didn't receive OTP? <button type="button" class="otp-resend-link" id="resetResend">Resend OTP</button>
          </div>
          <div class="login-field">
            <label>New Password</label>
            <div class="login-pwd-wrap login-input-icon">
              <i class="fa-solid fa-lock"></i>
              <input type="password" id="resetNewPassword" placeholder="At least 12 characters" autocomplete="new-password">
              <button type="button" class="login-toggle-pwd" id="resetTogglePwd"><i class="fa-solid fa-eye"></i></button>
            </div>
          </div>
          <div id="resetPwdStrengthContainer" style="display:none;"></div>
          <div class="login-error" id="resetError"></div>
          <button type="button" class="login-btn" id="resetSubmit"><span>Reset Password &amp; Sign In</span> <i class="fa-solid fa-check"></i></button>
          <div class="login-back-wrap">
            <button type="button" class="login-back-btn" id="resetBack"><i class="fa-solid fa-arrow-left"></i> Back</button>
          </div>
        </div>

        <div id="loginStepGoogle" class="login-step" style="display:none;">
          <div class="login-step-head">
            <div class="login-step-icon" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; margin-bottom:12px;">
              <svg width="24" height="24" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
            </div>
            <h2>Google Sign In</h2>
            <p>Enter your Google account email to sign in</p>
          </div>
          <div class="login-field">
            <label>Google Account Email</label>
            <div class="login-input-icon">
              <i class="fa-solid fa-envelope"></i>
              <input type="email" id="googleAccountEmail" placeholder="e.g. yourname@gmail.com" autocomplete="email">
            </div>
          </div>
          <div class="login-field">
            <label>Full Name (Optional)</label>
            <div class="login-input-icon">
              <i class="fa-solid fa-user"></i>
              <input type="text" id="googleAccountName" placeholder="Your Name" autocomplete="name">
            </div>
          </div>
          <div class="login-error" id="googleStepError"></div>
          <button type="button" class="login-btn" id="googleStepSubmit"><span>Continue with Google</span> <i class="fa-solid fa-arrow-right"></i></button>
          <div class="login-links">
            <a href="#" id="googleGoLogin">&larr; Back to Sign In</a>
          </div>
        </div>

        <div id="loginStepGoogleOtp" class="login-step" style="display:none;">
          <div class="login-step-head">
            <div class="login-step-icon" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; margin-bottom:12px;">
              <i class="fa-solid fa-shield-halved" style="color:var(--blue, #3b8ed0); font-size:22px;"></i>
            </div>
            <h2>Verify Identity</h2>
            <p id="googleOtpHint">Enter the 6-digit code sent to your Google inbox.</p>
          </div>
          <div class="login-field">
            <label>6-Digit Verification Code</label>
            <div class="otp-boxes" id="googleOtpBoxes">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1" autocomplete="one-time-code">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
              <input type="text" class="otp-box" inputmode="numeric" maxlength="1">
            </div>
            <input type="hidden" id="googleOtpInput">
          </div>
          <div class="otp-note" id="googleOtpNote">
            Didn't receive code? <button type="button" class="otp-resend-link" id="googleOtpResend">Resend Code</button>
          </div>
          <div class="login-error" id="googleOtpError"></div>
          <button type="button" class="login-btn" id="googleOtpSubmit"><span>Verify &amp; Sign In</span> <i class="fa-solid fa-check"></i></button>
          <div class="login-back-wrap">
            <button type="button" class="login-back-btn" id="googleOtpBack"><i class="fa-solid fa-arrow-left"></i> Change Email</button>
          </div>
        </div>

        <div id="loginStepSelectAccount" class="login-step" style="display:none;">
          <div class="login-step-head">
            <div class="login-step-icon" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.15); display:inline-flex; align-items:center; justify-content:center; width:48px; height:48px; border-radius:50%; margin-bottom:12px;">
              <i class="fa-solid fa-users" style="color:var(--gold, #f1c40f); font-size:22px;"></i>
            </div>
            <h2>Choose ERP Account</h2>
            <p>Multiple workspaces found for your email. Select which account to open:</p>
          </div>
          <div class="account-select-list" id="accountSelectList"></div>
          <div class="login-error" id="accountSelectError"></div>
          <div class="login-back-wrap">
            <button type="button" class="login-back-btn" id="accountSelectBack"><i class="fa-solid fa-arrow-left"></i> Back</button>
          </div>
        </div>
        </div>
      </div>
    `;
    document.body.appendChild(loginOverlay);

    const stepCreds = loginOverlay.querySelector('#loginStepCreds');
    const stepOtp = loginOverlay.querySelector('#loginStepOtp');
    const userInput = loginOverlay.querySelector('#loginUsername');
    const pwdInput = loginOverlay.querySelector('#loginPassword');
    const rememberChk = loginOverlay.querySelector('#loginRemember');
    const toggleBtn = loginOverlay.querySelector('#loginTogglePwd');
    const errorBox = loginOverlay.querySelector('#loginError');
    const submitBtn = loginOverlay.querySelector('#loginSubmit');

    const otpHint = loginOverlay.querySelector('#loginOtpHint');
    const otpBoxes = loginOverlay.querySelector('#loginOtpBoxes');
    const otpInput = loginOverlay.querySelector('#loginOtpInput');
    const otpError = loginOverlay.querySelector('#loginOtpError');
    const otpSubmitBtn = loginOverlay.querySelector('#loginOtpSubmit');
    const otpBackBtn = loginOverlay.querySelector('#loginOtpBack');
    const otpResendBtn = loginOverlay.querySelector('#loginOtpResend');

    const loginGoForgot = loginOverlay.querySelector('#loginGoForgot');
    const loginGoRegister = loginOverlay.querySelector('#loginGoRegister');

    // ---------- Register ----------
    const stepRegister = loginOverlay.querySelector('#loginStepRegister');
    const regUsername = loginOverlay.querySelector('#regUsername');
    const regEmail = loginOverlay.querySelector('#regEmail');
    const regPassword = loginOverlay.querySelector('#regPassword');
    const regConfirmPassword = loginOverlay.querySelector('#regConfirmPassword');
    const regToggleBtn = loginOverlay.querySelector('#regTogglePwd');
    const regError = loginOverlay.querySelector('#regError');
    const regSubmitBtn = loginOverlay.querySelector('#regSubmit');
    const regGoLogin = loginOverlay.querySelector('#regGoLogin');

    const stepRegisterOtp = loginOverlay.querySelector('#loginStepRegisterOtp');
    const regOtpHint = loginOverlay.querySelector('#regOtpHint');
    const regOtpBoxes = loginOverlay.querySelector('#regOtpBoxes');
    const regOtpInput = loginOverlay.querySelector('#regOtpInput');
    const regOtpError = loginOverlay.querySelector('#regOtpError');
    const regOtpSubmitBtn = loginOverlay.querySelector('#regOtpSubmit');
    const regOtpBackBtn = loginOverlay.querySelector('#regOtpBack');
    const regOtpResendBtn = loginOverlay.querySelector('#regOtpResend');

    // ---------- Forgot Password ----------
    const stepForgot = loginOverlay.querySelector('#loginStepForgot');
    const forgotIdentifier = loginOverlay.querySelector('#forgotIdentifier');
    const forgotError = loginOverlay.querySelector('#forgotError');
    const forgotSubmitBtn = loginOverlay.querySelector('#forgotSubmit');
    const forgotGoLogin = loginOverlay.querySelector('#forgotGoLogin');

    const stepReset = loginOverlay.querySelector('#loginStepReset');
    const resetHint = loginOverlay.querySelector('#resetHint');
    const resetOtpBoxes = loginOverlay.querySelector('#resetOtpBoxes');
    const resetOtpInput = loginOverlay.querySelector('#resetOtpInput');
    const resetNewPassword = loginOverlay.querySelector('#resetNewPassword');
    const resetToggleBtn = loginOverlay.querySelector('#resetTogglePwd');
    const resetError = loginOverlay.querySelector('#resetError');
    const resetSubmitBtn = loginOverlay.querySelector('#resetSubmit');
    const resetBackBtn = loginOverlay.querySelector('#resetBack');
    const resetResendBtn = loginOverlay.querySelector('#resetResend');

    // ---------- Google Sign In ----------
    const stepGoogle = loginOverlay.querySelector('#loginStepGoogle');
    const googleAccountEmail = loginOverlay.querySelector('#googleAccountEmail');
    const googleAccountName = loginOverlay.querySelector('#googleAccountName');
    const googleStepError = loginOverlay.querySelector('#googleStepError');
    const googleStepSubmit = loginOverlay.querySelector('#googleStepSubmit');
    const googleGoLogin = loginOverlay.querySelector('#googleGoLogin');

    const stepGoogleOtp = loginOverlay.querySelector('#loginStepGoogleOtp');
    const googleOtpHint = loginOverlay.querySelector('#googleOtpHint');
    const googleOtpBoxes = loginOverlay.querySelector('#googleOtpBoxes');
    const googleOtpInput = loginOverlay.querySelector('#googleOtpInput');
    const googleOtpError = loginOverlay.querySelector('#googleOtpError');
    const googleOtpSubmit = loginOverlay.querySelector('#googleOtpSubmit');
    const googleOtpBack = loginOverlay.querySelector('#googleOtpBack');
    const googleOtpResend = loginOverlay.querySelector('#googleOtpResend');
    let googleOtpBoxesCtl = null;

    const stepSelectAccount = loginOverlay.querySelector('#loginStepSelectAccount');
    const accountSelectList = loginOverlay.querySelector('#accountSelectList');
    const accountSelectError = loginOverlay.querySelector('#accountSelectError');
    const accountSelectBack = loginOverlay.querySelector('#accountSelectBack');
    let pendingGoogleEmail = '';

    const regPwdStrengthContainer = loginOverlay.querySelector('#regPwdStrengthContainer');
    const resetPwdStrengthContainer = loginOverlay.querySelector('#resetPwdStrengthContainer');

    let regPwdWidget = null;
    let resetPwdWidget = null;

    if (window.PasswordPolicy) {
      regPwdWidget = window.PasswordPolicy.attach({
        passwordInput: regPassword,
        confirmPasswordInput: regConfirmPassword,
        container: regPwdStrengthContainer,
        showMatch: true
      });
      resetPwdWidget = window.PasswordPolicy.attach({
        passwordInput: resetNewPassword,
        container: resetPwdStrengthContainer,
        showMatch: false
      });
    }
    // ---------- OTP boxes: 6 separate single-digit inputs that stay in sync
    // with one hidden <input> (so the rest of the login code below can keep
    // reading/writing otpInput.value exactly as before — nothing else has
    // to change). Handles auto-advance on type, backspace-to-previous, and
    // pasting a full 6-digit code into any one of the boxes. ----------
    function wireOtpBoxes(boxesEl, hiddenEl, onComplete) {
      if (!boxesEl || !hiddenEl) return { focusFirst() {}, clear() {} };
      const boxes = Array.from(boxesEl.querySelectorAll('.otp-box'));
      let triggerTimer = null;
      function sync(instant = false) {
        if (triggerTimer) { clearTimeout(triggerTimer); triggerTimer = null; }
        hiddenEl.value = boxes.map((b) => b.value).join('');
        if (hiddenEl.value.length === boxes.length && typeof onComplete === 'function') {
          if (instant) {
            onComplete(hiddenEl.value);
          } else {
            triggerTimer = setTimeout(() => {
              if (hiddenEl.value.length === boxes.length) onComplete(hiddenEl.value);
            }, 450);
          }
        }
      }
      boxes.forEach((box, i) => {
        box.addEventListener('input', () => {
          box.value = box.value.replace(/[^0-9]/g, '').slice(0, 1);
          if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
          sync(false);
        });
        box.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            sync(true);
            return;
          }
          if (e.key === 'Backspace' && !box.value && i > 0) {
            boxes[i - 1].focus();
          } else if (e.key === 'ArrowLeft' && i > 0) {
            boxes[i - 1].focus();
          } else if (e.key === 'ArrowRight' && i < boxes.length - 1) {
            boxes[i + 1].focus();
          }
        });
        box.addEventListener('paste', (e) => {
          const text = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
          if (!text) return;
          e.preventDefault();
          text.slice(0, boxes.length).split('').forEach((ch, j) => {
            if (boxes[i + j]) boxes[i + j].value = ch;
          });
          sync(true);
          const nextEmpty = boxes.find((b) => !b.value) || boxes[boxes.length - 1];
          nextEmpty.focus();
        });
      });
      return {
        focusFirst() { boxes[0].focus(); },
        clear() { if (triggerTimer) clearTimeout(triggerTimer); boxes.forEach((b) => { b.value = ''; }); hiddenEl.value = ''; },
      };
    }
    // Bound after verify handlers are defined (see bottom of buildLoginOverlay).
    let loginOtpBoxesCtl = { focusFirst() {}, clear() {} };
    let regOtpBoxesCtl = { focusFirst() {}, clear() {} };
    let resetOtpBoxesCtl = { focusFirst() {}, clear() {} };

    // ---------- Resend OTP cooldown: 10 seconds ----------
    // Disables a resend button/link and counts down "Resend OTP in 10s"
    // right after an OTP is sent (either the initial send or a resend),
    // so it can't be spammed. Re-enables itself automatically once the
    // countdown hits 0.
    const RESEND_COOLDOWN_SECONDS = 10;
    const resendTimers = new WeakMap();
    function startResendCooldown(btn, seconds = RESEND_COOLDOWN_SECONDS) {
      if (!btn) return;
      const existing = resendTimers.get(btn);
      if (existing) clearInterval(existing);
      let remaining = seconds;
      btn.disabled = true;
      btn.textContent = `Resend OTP in ${remaining}s`;
      const timer = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(timer);
          resendTimers.delete(btn);
          btn.disabled = false;
          btn.textContent = 'Resend OTP';
          return;
        }
        btn.textContent = `Resend OTP in ${remaining}s`;
      }, 1000);
      resendTimers.set(btn, timer);
    }

    // Carries the verified username across from step 1 to step 2 (server
    // already confirmed the password by the time we get here).
    let pendingUsername = null;
    // Same idea, but for the Registration and Forgot-Password OTP steps.
    let pendingRegUsername = null;
    let pendingResetUsername = null;

    // Prefill remembered username only (never the password), mirrors the
    // desktop app's "Remember Me" for convenience — the password still has
    // to be entered and verified against the DB every time.
    try {
      if (localStorage.getItem('egs_remember') === '1') {
        userInput.value = localStorage.getItem('egs_user') || '';
        rememberChk.checked = true;
      }
    } catch (e) { /* localStorage unavailable — just skip prefill */ }

    toggleBtn.addEventListener('click', () => {
      const showing = pwdInput.type === 'text';
      pwdInput.type = showing ? 'password' : 'text';
      toggleBtn.classList.toggle('active', !showing);
      toggleBtn.innerHTML = showing ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
    });

    function showCredsStep() {
      window.freshLoginInProgress = false;
      hideAllSteps();
      stepCreds.style.display = '';
      loginOtpBoxesCtl.clear();
      otpError.classList.remove('show');
      pendingUsername = null;
      errorBox.classList.remove('show');
      userInput.focus();
    }

    function showOtpStep(maskedEmail) {
      hideAllSteps();
      window.freshLoginInProgress = true;
      stepOtp.style.display = '';
      otpHint.textContent = maskedEmail
        ? `Enter the 6-digit OTP sent to ${maskedEmail}.`
        : 'Enter the 6-digit OTP sent to your email.';
      otpError.classList.remove('show');
      loginOtpBoxesCtl.clear();
      loginOtpBoxesCtl.focusFirst();
      startResendCooldown(otpResendBtn);
    }

    // ---------- Step switching: Register / Forgot Password / Reset ----------
    // All five screens (creds, login-OTP, register, register-OTP, forgot,
    // reset) live in the same card and only one is ever visible at a time.
    function hideAllSteps() {
      [stepCreds, stepOtp, stepRegister, stepRegisterOtp, stepForgot, stepReset, stepGoogle, stepGoogleOtp, stepSelectAccount].forEach((el) => {
        if (el) el.style.display = 'none';
      });
    }

    function showGoogleStep() {
      hideAllSteps();
      stepGoogle.style.display = '';
      googleStepError.classList.remove('show');
      googleAccountEmail.value = '';
      googleAccountName.value = '';
      setTimeout(() => googleAccountEmail.focus(), 50);
    }

    function showGoogleOtpStep(email, maskedEmail) {
      hideAllSteps();
      pendingGoogleEmail = email;
      stepGoogleOtp.style.display = '';
      googleOtpHint.textContent = `Enter the 6-digit verification code sent to ${maskedEmail || email} to verify your identity.`;
      googleOtpError.classList.remove('show');
      if (googleOtpBoxesCtl) {
        googleOtpBoxesCtl.clear();
        googleOtpBoxesCtl.focusFirst();
      }
      startResendCooldown(googleOtpResend);
    }

    function showSelectAccountStep(email, accounts) {
      hideAllSteps();
      pendingGoogleEmail = email;
      stepSelectAccount.style.display = '';
      accountSelectError.classList.remove('show');
      accountSelectList.innerHTML = '';

      (accounts || []).forEach((acc) => {
        const card = document.createElement('div');
        card.className = 'account-select-card';
        const initial = (acc.username || 'U').charAt(0).toUpperCase();
        card.innerHTML = `
          <div class="account-select-info">
            <div class="account-select-avatar">${initial}</div>
            <div>
              <div class="account-select-uname">@${acc.username}</div>
              <div class="account-select-role">${acc.role || 'User'}</div>
            </div>
          </div>
          <i class="fa-solid fa-chevron-right account-select-arrow"></i>
        `;
        card.addEventListener('click', async () => {
          accountSelectError.classList.remove('show');
          try {
            const res = await window.Api.post('/auth/google-select-account', {
              email: pendingGoogleEmail,
              selectedUsername: acc.username
            });
            if (res && res.token && res.username) {
              finishLogin(res);
            } else {
              accountSelectError.textContent = 'Could not open selected workspace.';
              accountSelectError.classList.add('show');
            }
          } catch (err) {
            accountSelectError.textContent = (err && err.message) || 'Failed to select account.';
            accountSelectError.classList.add('show');
          }
        });
        accountSelectList.appendChild(card);
      });
    }

    function showRegisterStep() {
      hideAllSteps();
      stepRegister.style.display = '';
      regError.classList.remove('show');
      regUsername.focus();
    }

    function showRegisterOtpStep(maskedEmail) {
      hideAllSteps();
      stepRegisterOtp.style.display = '';
      regOtpHint.textContent = maskedEmail
        ? `Enter the 6-digit OTP sent to ${maskedEmail} to activate your account.`
        : 'Enter the 6-digit OTP sent to your email to activate your account.';
      regOtpError.classList.remove('show');
      regOtpBoxesCtl.clear();
      regOtpBoxesCtl.focusFirst();
      startResendCooldown(regOtpResendBtn);
    }

    function showForgotStep() {
      hideAllSteps();
      stepForgot.style.display = '';
      forgotError.classList.remove('show');
      forgotIdentifier.value = userInput.value.trim();
      forgotIdentifier.focus();
    }

    function showResetStep(maskedEmail) {
      hideAllSteps();
      stepReset.style.display = '';
      resetHint.textContent = maskedEmail
        ? `Enter the OTP sent to ${maskedEmail}, and choose a new password.`
        : 'Enter the OTP sent to your email, and choose a new password.';
      resetError.classList.remove('show');
      resetOtpBoxesCtl.clear();
      resetNewPassword.value = '';
      resetOtpBoxesCtl.focusFirst();
      startResendCooldown(resetResendBtn);
    }

    // Finish signing in after the OTP is verified — same completion steps
    // the old single-step login used to run right after the password check.
    function finishLogin(data) {
      window.freshLoginInProgress = false;
      try {
        if (rememberChk.checked) {
          localStorage.setItem('egs_remember', '1');
          localStorage.setItem('egs_user', data.username);
        } else {
          localStorage.removeItem('egs_remember');
          localStorage.removeItem('egs_user');
        }
      } catch (e) { /* localStorage unavailable — Remember Me just won't persist */ }
      saveSession(data.username, data.role, rememberChk.checked, data.token);
      updateProfileDisplay(data.username, data.role);
      showApp();
      startHeartbeat(); applyUserPreferencesFromServer();
      resetIdleTimer();
      // Boot may have already rendered Dashboard while logged-out (API calls
      // returned empty/zeros). Re-run the current page now that the token is set
      // so real numbers load without a manual refresh.
      try {
        const pageId = (window.location.hash || '#dashboard').replace(/^#/, '') || 'dashboard';
        if (typeof go === 'function') go(window.PAGES[pageId] ? pageId : 'dashboard');
      } catch (e) { /* ignore */ }
      
      if (typeof window.showSuccess === 'function') {
        window.showSuccess('Login Successful!', `Welcome back, @${data.username}. Loading your ERP workspace...`, 2200);
      } else if (typeof window.openModal === 'function') {
        const welcomeHtml = `
          <div class="login-success-pop" style="text-align:center; padding:12px 0;">
            <div class="login-success-icon" style="font-size:42px; color:var(--green); margin-bottom:12px;"><i class="fa-solid fa-circle-check"></i></div>
            <h3 style="margin:0 0 6px; font-size:20px; font-weight:800; color:var(--txt);">Login Successful!</h3>
            <p style="margin:0; color:var(--txt-muted); font-size:13.5px;">Welcome back, <b style="color:var(--gold);">@${data.username}</b>.</p>
          </div>`;
        window.openModal('Welcome', welcomeHtml);
        setTimeout(() => { if (window.closeModal) window.closeModal(); }, 2000);
      } else if (typeof window.showToast === 'function') {
        window.showToast(`Login successful! Welcome, ${data.username}.`);
      }

      setTimeout(() => {
        if (typeof window.requestNativeSystemPermissions === 'function') {
          window.requestNativeSystemPermissions();
        }
      }, 1000);
    }

    async function attemptLogin() {
      const user = userInput.value.trim();
      const pwd = pwdInput.value.trim();
      if (!user || !pwd) {
        errorBox.textContent = 'Please enter both username/email and password.';
        errorBox.classList.add('show');
        return;
      }
      errorBox.classList.remove('show');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Signing In...</span> <i class="fa-solid fa-circle-notch fa-spin"></i>';
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user, password: pwd }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          if (data.unverified && data.username) {
            // Account exists but registration was never completed — send a
            // fresh OTP straight away and drop them into that same step
            // instead of making them hunt for "Create Account" again.
            pendingRegUsername = data.username;
            showRegisterOtpStep(null);
            attemptResendRegisterOtp();
            return;
          }
          errorBox.textContent = data.error || 'Incorrect Username/Email or Password.';
          errorBox.classList.add('show');
          return;
        }
        // Password verified by the DB — an OTP has been emailed. Role is
        // only handed over after the OTP step below, never from the UI.
        pendingUsername = data.username;
        showOtpStep(data.maskedEmail);
      } catch (e) {
        errorBox.textContent = 'Could not reach the server. Please try again.';
        errorBox.classList.add('show');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Sign In</span> <i class="fa-solid fa-arrow-right"></i>';
      }
    }

    async function attemptVerifyOtp() {
      const otp = otpInput.value.trim();
      if (!pendingUsername) { showCredsStep(); return; }
      if (!otp) {
        otpError.textContent = 'Please enter the OTP.';
        otpError.classList.add('show');
        return;
      }
      otpError.classList.remove('show');
      otpSubmitBtn.disabled = true;
      otpSubmitBtn.innerHTML = '<span>Verifying...</span> <i class="fa-solid fa-circle-notch fa-spin"></i>';
      try {
        const res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: pendingUsername, otp }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          otpError.textContent = data.error || 'Incorrect OTP.';
          otpError.classList.add('show');
          loginOtpBoxesCtl.clear();
          loginOtpBoxesCtl.focusFirst();
          return;
        }
        finishLogin(data);
      } catch (e) {
        otpError.textContent = 'Could not reach the server. Please try again.';
        otpError.classList.add('show');
      } finally {
        otpSubmitBtn.disabled = false;
        otpSubmitBtn.innerHTML = '<span>Verify &amp; Continue</span> <i class="fa-solid fa-check"></i>';
      }
    }

    async function attemptResendOtp() {
      if (!pendingUsername) return;
      otpResendBtn.disabled = true;
      const originalLabel = otpResendBtn.textContent;
      otpResendBtn.textContent = 'Sending...';
      try {
        const res = await fetch('/api/auth/resend-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: pendingUsername }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          otpError.textContent = data.error || 'Could not resend OTP.';
          otpError.classList.add('show');
          otpResendBtn.disabled = false;
          otpResendBtn.textContent = originalLabel;
          return;
        }
        otpHint.textContent = `A new OTP was sent to ${data.maskedEmail}.`;
        otpError.classList.remove('show');
        loginOtpBoxesCtl.clear();
        loginOtpBoxesCtl.focusFirst();
        startResendCooldown(otpResendBtn);
      } catch (e) {
        otpError.textContent = 'Could not reach the server. Please try again.';
        otpError.classList.add('show');
        otpResendBtn.disabled = false;
        otpResendBtn.textContent = originalLabel;
      }
    }

    // ---------- Register ----------
    async function attemptRegister() {
      const uname = regUsername.value.trim();
      const email = regEmail.value.trim();
      const pwd = regPassword.value;
      const confirmPwd = regConfirmPassword.value;
      if (!uname || !email || !pwd || !confirmPwd) {
        regError.textContent = 'Please fill in all fields.';
        regError.classList.add('show');
        return;
      }
      if (window.PasswordPolicy) {
        const pol = window.PasswordPolicy.evaluate(pwd, { confirmPassword: confirmPwd });
        if (!pol.valid) {
          if (!pol.checks.minLength) regError.textContent = `Password must be at least ${window.PasswordPolicy.MIN_LENGTH} characters.`;
          else if (!pol.checks.hasUpper) regError.textContent = 'Password must include at least one uppercase letter (A-Z).';
          else if (!pol.checks.hasLower) regError.textContent = 'Password must include at least one lowercase letter (a-z).';
          else if (!pol.checks.hasNumber) regError.textContent = 'Password must include at least one number (0-9).';
          else if (!pol.checks.hasSpecial) regError.textContent = 'Password must include at least one special character (!@#$%...).';
          else if (!pol.checks.noSurroundingWhitespace) regError.textContent = 'Password must not contain leading or trailing spaces.';
          else if (!pol.checks.notCommon) regError.textContent = 'Password is too common or predictable. Choose a stronger passphrase.';
          else if (!pol.checks.passwordsMatch) regError.textContent = 'Passwords do not match.';
          else regError.textContent = 'Password does not satisfy security policy.';
          regError.classList.add('show');
          regPassword.focus();
          return;
        }
      } else {
        if (pwd !== confirmPwd) {
          regError.textContent = 'Passwords do not match.';
          regError.classList.add('show');
          return;
        }
        if (pwd.length < 12) {
          regError.textContent = 'Password must be at least 12 characters.';
          regError.classList.add('show');
          return;
        }
      }
      regError.classList.remove('show');
      regSubmitBtn.disabled = true;
      regSubmitBtn.textContent = 'Creating Account...';
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: uname, email, password: pwd }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          regError.textContent = data.error || 'Could not create account.';
          regError.classList.add('show');
          return;
        }
        pendingRegUsername = data.username;
        showRegisterOtpStep(data.maskedEmail);
      } catch (e) {
        regError.textContent = 'Could not reach the server. Please try again.';
        regError.classList.add('show');
      } finally {
        regSubmitBtn.disabled = false;
        regSubmitBtn.textContent = 'Create Account';
      }
    }

    async function attemptVerifyRegisterOtp() {
      const otp = regOtpInput.value.trim();
      if (!pendingRegUsername) { showRegisterStep(); return; }
      if (!otp) {
        regOtpError.textContent = 'Please enter the OTP.';
        regOtpError.classList.add('show');
        return;
      }
      regOtpError.classList.remove('show');
      regOtpSubmitBtn.disabled = true;
      regOtpSubmitBtn.textContent = 'Verifying...';
      try {
        const res = await fetch('/api/auth/verify-register-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: pendingRegUsername, otp }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          regOtpError.textContent = data.error || 'Incorrect OTP.';
          regOtpError.classList.add('show');
          regOtpBoxesCtl.clear();
          regOtpBoxesCtl.focusFirst();
          return;
        }
        // Account is verified and the server already granted a session —
        // sign straight in, same as the login OTP step does.
        finishLogin(data);
      } catch (e) {
        regOtpError.textContent = 'Could not reach the server. Please try again.';
        regOtpError.classList.add('show');
      } finally {
        regOtpSubmitBtn.disabled = false;
        regOtpSubmitBtn.textContent = 'Verify & Continue';
      }
    }

    async function attemptResendRegisterOtp() {
      if (!pendingRegUsername) return;
      regOtpResendBtn.disabled = true;
      const originalLabel = regOtpResendBtn.textContent;
      regOtpResendBtn.textContent = 'Sending...';
      try {
        const res = await fetch('/api/auth/resend-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: pendingRegUsername }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          regOtpError.textContent = data.error || 'Could not resend OTP.';
          regOtpError.classList.add('show');
          regOtpResendBtn.disabled = false;
          regOtpResendBtn.textContent = originalLabel;
          return;
        }
        regOtpHint.textContent = `A new OTP was sent to ${data.maskedEmail}.`;
        regOtpError.classList.remove('show');
        regOtpBoxesCtl.clear();
        regOtpBoxesCtl.focusFirst();
        startResendCooldown(regOtpResendBtn);
      } catch (e) {
        regOtpError.textContent = 'Could not reach the server. Please try again.';
        regOtpError.classList.add('show');
        regOtpResendBtn.disabled = false;
        regOtpResendBtn.textContent = originalLabel;
      }
    }

    // ---------- Forgot Password ----------
    async function attemptForgotPassword() {
      const identifier = forgotIdentifier.value.trim();
      if (!identifier) {
        forgotError.textContent = 'Please enter your username or email.';
        forgotError.classList.add('show');
        return;
      }
      forgotError.classList.remove('show');
      forgotSubmitBtn.disabled = true;
      forgotSubmitBtn.textContent = 'Sending...';
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: identifier }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          forgotError.textContent = data.error || 'Could not send OTP.';
          forgotError.classList.add('show');
          return;
        }
        pendingResetUsername = data.username;
        showResetStep(data.maskedEmail);
      } catch (e) {
        forgotError.textContent = 'Could not reach the server. Please try again.';
        forgotError.classList.add('show');
      } finally {
        forgotSubmitBtn.disabled = false;
        forgotSubmitBtn.textContent = 'Send OTP';
      }
    }

    async function attemptResendForgotOtp() {
      if (!pendingResetUsername) return;
      resetResendBtn.disabled = true;
      const originalLabel = resetResendBtn.textContent;
      resetResendBtn.textContent = 'Sending...';
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: pendingResetUsername }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          resetError.textContent = data.error || 'Could not resend OTP.';
          resetError.classList.add('show');
          resetResendBtn.disabled = false;
          resetResendBtn.textContent = originalLabel;
          return;
        }
        resetHint.textContent = `A new OTP was sent to ${data.maskedEmail}.`;
        resetError.classList.remove('show');
        resetOtpBoxesCtl.clear();
        resetOtpBoxesCtl.focusFirst();
        startResendCooldown(resetResendBtn);
      } catch (e) {
        resetError.textContent = 'Could not reach the server. Please try again.';
        resetError.classList.add('show');
        resetResendBtn.disabled = false;
        resetResendBtn.textContent = originalLabel;
      }
    }

    async function attemptResetPassword() {
      const otp = resetOtpInput.value.trim();
      const newPassword = resetNewPassword.value;
      if (!pendingResetUsername) { showForgotStep(); return; }
      if (!otp || !newPassword) {
        resetError.textContent = 'Please enter the OTP and a new password.';
        resetError.classList.add('show');
        return;
      }
      if (window.PasswordPolicy) {
        const pol = window.PasswordPolicy.evaluate(newPassword);
        if (!pol.valid) {
          if (!pol.checks.minLength) resetError.textContent = `Password must be at least ${window.PasswordPolicy.MIN_LENGTH} characters.`;
          else if (!pol.checks.hasUpper) resetError.textContent = 'Password must include at least one uppercase letter (A-Z).';
          else if (!pol.checks.hasLower) resetError.textContent = 'Password must include at least one lowercase letter (a-z).';
          else if (!pol.checks.hasNumber) resetError.textContent = 'Password must include at least one number (0-9).';
          else if (!pol.checks.hasSpecial) resetError.textContent = 'Password must include at least one special character (!@#$%...).';
          else if (!pol.checks.noSurroundingWhitespace) resetError.textContent = 'Password must not contain leading or trailing spaces.';
          else if (!pol.checks.notCommon) resetError.textContent = 'Password is too common or predictable. Choose a stronger passphrase.';
          else resetError.textContent = 'Password does not satisfy security policy.';
          resetError.classList.add('show');
          resetNewPassword.focus();
          return;
        }
      } else {
        if (newPassword.length < 12) {
          resetError.textContent = 'Password must be at least 12 characters.';
          resetError.classList.add('show');
          return;
        }
      }
      resetError.classList.remove('show');
      resetSubmitBtn.disabled = true;
      resetSubmitBtn.textContent = 'Resetting...';
      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: pendingResetUsername, otp, newPassword }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          resetError.textContent = data.error || 'Could not reset password.';
          resetError.classList.add('show');
          return;
        }
        // Password is reset — send them back to Sign In with the username
        // prefilled so they just have to type the new password once.
        showCredsStep();
        userInput.value = pendingResetUsername;
        pwdInput.value = '';
        errorBox.textContent = 'Password reset. Please sign in with your new password.';
        errorBox.classList.add('show');
        pwdInput.focus();
        pendingResetUsername = null;
      } catch (e) {
        resetError.textContent = 'Could not reach the server. Please try again.';
        resetError.classList.add('show');
      } finally {
        resetSubmitBtn.disabled = false;
        resetSubmitBtn.textContent = 'Reset Password & Sign In';
      }
    }

    submitBtn.addEventListener('click', attemptLogin);
    pwdInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptLogin(); });
    userInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') pwdInput.focus(); });

    loginOtpBoxesCtl = wireOtpBoxes(otpBoxes, otpInput, () => attemptVerifyOtp());
    otpSubmitBtn.addEventListener('click', attemptVerifyOtp);
    otpInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptVerifyOtp(); });
    otpBackBtn.addEventListener('click', showCredsStep);
    otpResendBtn.addEventListener('click', attemptResendOtp);

    // ---------- Google Sign-In (GIS & Direct Auth) ----------
    const googleBtn = loginOverlay.querySelector('#btnGoogleSignInDirect');
    async function handleGoogleLoginAction(credentialOrEmail, directName) {
      errorBox.classList.remove('show');
      if (googleStepError) googleStepError.classList.remove('show');
      try {
        let payload = {};
        if (typeof credentialOrEmail === 'string' && credentialOrEmail.startsWith('eyJ') && !credentialOrEmail.includes('@')) {
          payload = { credential: credentialOrEmail };
        } else {
          payload = { email: String(credentialOrEmail || '').trim().toLowerCase(), name: directName };
        }
        submitBtn.disabled = true;
        if (googleStepSubmit) {
          googleStepSubmit.disabled = true;
          googleStepSubmit.innerHTML = '<span>Verifying...</span> <i class="fa-solid fa-spinner fa-spin"></i>';
        }
        const res = await window.Api.post('/auth/google-login', payload);
        if (res && res.token && res.username) {
          finishLogin(res);
        } else {
          const errMsg = 'Google sign in did not return an active session.';
          if (stepGoogle && stepGoogle.style.display !== 'none') {
            googleStepError.textContent = errMsg;
            googleStepError.classList.add('show');
          } else {
            showError(errMsg);
          }
        }
      } catch (err) {
        const errMsg = (err && err.message) || 'Failed to sign in with Google.';
        if (stepGoogle && stepGoogle.style.display !== 'none') {
          googleStepError.textContent = errMsg;
          googleStepError.classList.add('show');
        } else {
          showError(errMsg);
        }
      } finally {
        submitBtn.disabled = false;
        if (googleStepSubmit) {
          googleStepSubmit.disabled = false;
          googleStepSubmit.innerHTML = '<span>Continue with Google</span> <i class="fa-solid fa-arrow-right"></i>';
        }
      }
    }

    if (googleBtn) {
      googleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showGoogleStep();
      });
    }

    if (googleGoLogin) {
      googleGoLogin.addEventListener('click', (e) => {
        e.preventDefault();
        showCredsStep();
      });
    }

    // Google OTP Boxes and Action Handlers
    if (googleOtpBoxes && googleOtpInput) {
      googleOtpBoxesCtl = wireOtpBoxes(googleOtpBoxes, googleOtpInput, () => attemptVerifyGoogleOtp());
    }

    if (googleOtpSubmit) {
      googleOtpSubmit.addEventListener('click', attemptVerifyGoogleOtp);
    }
    if (googleOtpInput) {
      googleOtpInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptVerifyGoogleOtp(); });
    }
    if (googleOtpBack) {
      googleOtpBack.addEventListener('click', (e) => {
        e.preventDefault();
        showGoogleStep();
      });
    }
    if (accountSelectBack) {
      accountSelectBack.addEventListener('click', (e) => {
        e.preventDefault();
        showGoogleStep();
      });
    }

    if (googleOtpResend) {
      googleOtpResend.addEventListener('click', async () => {
        if (!pendingGoogleEmail) return;
        googleOtpError.classList.remove('show');
        googleOtpResend.disabled = true;
        const origText = googleOtpResend.textContent;
        googleOtpResend.textContent = 'Resending...';
        try {
          const res = await window.Api.post('/auth/google-request-otp', { email: pendingGoogleEmail });
          if (res && res.success) {
            googleOtpHint.textContent = `A new verification code was sent to ${res.maskedEmail || pendingGoogleEmail}.`;
            if (googleOtpBoxesCtl) {
              googleOtpBoxesCtl.clear();
              googleOtpBoxesCtl.focusFirst();
            }
            startResendCooldown(googleOtpResend);
          } else {
            googleOtpError.textContent = (res && res.error) || 'Could not resend code.';
            googleOtpError.classList.add('show');
            googleOtpResend.disabled = false;
            googleOtpResend.textContent = origText;
          }
        } catch (err) {
          googleOtpError.textContent = (err && err.message) || 'Failed to resend code.';
          googleOtpError.classList.add('show');
          googleOtpResend.disabled = false;
          googleOtpResend.textContent = origText;
        }
      });
    }

    async function attemptVerifyGoogleOtp() {
      const otp = (googleOtpInput.value || '').trim();
      if (!pendingGoogleEmail) { showGoogleStep(); return; }
      if (!otp || otp.length < 6) {
        googleOtpError.textContent = 'Please enter the complete 6-digit verification code.';
        googleOtpError.classList.add('show');
        return;
      }
      googleOtpError.classList.remove('show');
      googleOtpSubmit.disabled = true;
      googleOtpSubmit.innerHTML = '<span>Verifying...</span> <i class="fa-solid fa-spinner fa-spin"></i>';
      try {
        const res = await window.Api.post('/auth/google-verify-otp', {
          email: pendingGoogleEmail,
          otp
        });
        if (res && res.requiresAccountSelection && res.accounts && res.accounts.length > 1) {
          showSelectAccountStep(res.email, res.accounts);
        } else if (res && res.token && res.username) {
          finishLogin(res);
        } else {
          googleOtpError.textContent = 'Verification did not return an active session.';
          googleOtpError.classList.add('show');
        }
      } catch (err) {
        googleOtpError.textContent = (err && err.message) || 'Verification failed.';
        googleOtpError.classList.add('show');
      } finally {
        googleOtpSubmit.disabled = false;
        googleOtpSubmit.innerHTML = '<span>Verify &amp; Sign In</span> <i class="fa-solid fa-check"></i>';
      }
    }

    if (googleStepSubmit) {
      googleStepSubmit.addEventListener('click', async () => {
        const email = (googleAccountEmail.value || '').trim();
        if (!email || !email.includes('@') || !email.includes('.')) {
          googleStepError.textContent = 'Please enter a valid Google account email address.';
          googleStepError.classList.add('show');
          googleAccountEmail.focus();
          return;
        }
        googleStepError.classList.remove('show');
        googleStepSubmit.disabled = true;
        googleStepSubmit.innerHTML = '<span>Sending code...</span> <i class="fa-solid fa-spinner fa-spin"></i>';
        try {
          const res = await window.Api.post('/auth/google-request-otp', { email });
          if (res && res.success) {
            showGoogleOtpStep(res.email, res.maskedEmail);
          } else {
            googleStepError.textContent = (res && res.error) || 'Could not send verification code.';
            googleStepError.classList.add('show');
          }
        } catch (err) {
          googleStepError.textContent = (err && err.message) || 'Failed to send verification code. Please check your email.';
          googleStepError.classList.add('show');
        } finally {
          googleStepSubmit.disabled = false;
          googleStepSubmit.innerHTML = '<span>Continue with Google</span> <i class="fa-solid fa-arrow-right"></i>';
        }
      });
    }

    if (googleAccountEmail) {
      googleAccountEmail.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          if (googleStepSubmit) googleStepSubmit.click();
        }
      });
    }

    if (googleAccountName) {
      googleAccountName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && googleStepSubmit) {
          googleStepSubmit.click();
        }
      });
    }

    // Navigation between the creds screen and Register / Forgot Password.
    loginGoRegister.addEventListener('click', (e) => { e.preventDefault(); showRegisterStep(); });
    loginGoForgot.addEventListener('click', (e) => { e.preventDefault(); showForgotStep(); });
    regGoLogin.addEventListener('click', (e) => { e.preventDefault(); showCredsStep(); });
    forgotGoLogin.addEventListener('click', (e) => { e.preventDefault(); showCredsStep(); });

    // Register
    regToggleBtn.addEventListener('click', () => {
      const showing = regPassword.type === 'text';
      regPassword.type = showing ? 'password' : 'text';
      regConfirmPassword.type = regPassword.type;
      regToggleBtn.classList.toggle('active', !showing);
      regToggleBtn.innerHTML = showing ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
    });
    regSubmitBtn.addEventListener('click', attemptRegister);
    regConfirmPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptRegister(); });

    regOtpBoxesCtl = wireOtpBoxes(regOtpBoxes, regOtpInput, () => attemptVerifyRegisterOtp());
    regOtpSubmitBtn.addEventListener('click', attemptVerifyRegisterOtp);
    regOtpInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptVerifyRegisterOtp(); });
    regOtpBackBtn.addEventListener('click', showRegisterStep);
    regOtpResendBtn.addEventListener('click', attemptResendRegisterOtp);

    // Forgot Password
    forgotSubmitBtn.addEventListener('click', attemptForgotPassword);
    forgotIdentifier.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptForgotPassword(); });

    resetToggleBtn.addEventListener('click', () => {
      const showing = resetNewPassword.type === 'text';
      resetNewPassword.type = showing ? 'password' : 'text';
      resetToggleBtn.classList.toggle('active', !showing);
      resetToggleBtn.innerHTML = showing ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
    });
    resetOtpBoxesCtl = wireOtpBoxes(resetOtpBoxes, resetOtpInput);
    resetSubmitBtn.addEventListener('click', attemptResetPassword);
    resetNewPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptResetPassword(); });
    resetBackBtn.addEventListener('click', showForgotStep);
    resetResendBtn.addEventListener('click', attemptResendForgotOtp);

    // ---------- 1. Dynamic Moving Highlights Feed (Auto-rotate every 3.5s with smooth horizontal slide) ----------
    const tickerCards = Array.from(loginOverlay.querySelectorAll('.login-ticker-card'));
    const tickerDots = Array.from(loginOverlay.querySelectorAll('.ticker-dot'));
    let currentSlide = 0;
    let tickerTimer = null;
    let isHoveringTicker = false;

    function showSlide(idx, direction = 'next') {
      if (!tickerCards.length) return;
      const prevSlide = currentSlide;
      currentSlide = (idx + tickerCards.length) % tickerCards.length;

      tickerCards.forEach((c, i) => {
        if (i === currentSlide) {
          c.classList.remove('slide-exit');
          c.style.transition = 'none';
          c.style.transform = direction === 'next' ? 'translateX(50px)' : 'translateX(-50px)';
          c.style.opacity = '0';
          // Force layout reflow
          void c.offsetWidth;
          c.style.transition = 'transform 0.85s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.8s ease';
          c.classList.add('active');
          c.style.transform = 'translateX(0)';
          c.style.opacity = '1';
        } else if (i === prevSlide && prevSlide !== currentSlide) {
          c.classList.remove('active');
          c.classList.add('slide-exit');
          c.style.transition = 'transform 0.85s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.8s ease';
          c.style.transform = direction === 'next' ? 'translateX(-50px)' : 'translateX(50px)';
          c.style.opacity = '0';
        } else {
          c.classList.remove('active', 'slide-exit');
          c.style.transform = 'translateX(50px)';
          c.style.opacity = '0';
        }
      });

      tickerDots.forEach((d, i) => {
        d.classList.toggle('active', i === currentSlide);
      });
    }

    function startTicker() {
      if (tickerTimer) clearInterval(tickerTimer);
      tickerTimer = setInterval(() => {
        if (!isHoveringTicker && loginOverlay && loginOverlay.style.display !== 'none') {
          showSlide(currentSlide + 1, 'next');
        }
      }, 5000);
    }

    tickerDots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.dataset.idx, 10) || 0;
        const dir = idx >= currentSlide ? 'next' : 'prev';
        showSlide(idx, dir);
        startTicker();
      });
    });

    const tickerContainer = loginOverlay.querySelector('#loginTickerContainer');
    if (tickerContainer) {
      tickerContainer.addEventListener('mouseenter', () => { isHoveringTicker = true; });
      tickerContainer.addEventListener('mouseleave', () => { isHoveringTicker = false; });
    }
    startTicker();

    // ---------- 2. Interactive Floating Particle Constellation Canvas ----------
    const canvas = loginOverlay.querySelector('#loginParticlesCanvas');
    if (canvas && canvas.getContext) {
      const ctx = canvas.getContext('2d');
      let width = 0;
      let height = 0;
      const particles = [];
      const particleCount = 32;

      function resizeCanvas() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      }
      window.addEventListener('resize', resizeCanvas);
      resizeCanvas();

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.45,
          vy: (Math.random() - 0.5) * 0.45,
          radius: Math.random() * 2 + 1,
          alpha: Math.random() * 0.5 + 0.25,
          color: i % 3 === 0 ? 'rgba(59, 142, 208, ' : (i % 3 === 1 ? 'rgba(212, 175, 55, ' : 'rgba(46, 204, 113, ')
        });
      }

      function drawParticles() {
        if (!loginOverlay || loginOverlay.style.display === 'none') {
          requestAnimationFrame(drawParticles);
          return;
        }
        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `${p.color}${p.alpha})`;
          ctx.fill();

          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 100) {
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `rgba(59, 142, 208, ${0.15 * (1 - dist / 100)})`;
              ctx.lineWidth = 0.8;
              ctx.stroke();
            }
          }
        }
        requestAnimationFrame(drawParticles);
      }
      drawParticles();
    }
  }



  // Export session helpers for the app bootstrapper
  window.buildLoginOverlay = buildLoginOverlay;
  window.loadSession = loadSession;
  window.showApp = showApp;
  window.showLoginOverlay = showLoginOverlay;
  window.updateProfileDisplay = updateProfileDisplay;
  window.startHeartbeat = startHeartbeat;
  window.applyUserPreferencesFromServer = applyUserPreferencesFromServer;
  window.resetIdleTimer = resetIdleTimer;
  window.loadSavedAccounts = loadSavedAccounts;
  window.persistSavedAccounts = persistSavedAccounts;
  window.upsertSavedAccount = upsertSavedAccount;
  window.removeSavedAccount = removeSavedAccount;
  window.saveSession = saveSession;
  window.clearSession = clearSession;
  window.notifyServerLogout = notifyServerLogout;
})();
