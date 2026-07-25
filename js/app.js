// js/app.js
// Wires up the sidebar, page-switching, and modal — same role as main.py in the
// desktop app (builds the nav from tab list, swaps the active page).
// Each page module (js/pages/*.js) registers itself into window.PAGES before
// this file runs, e.g. window.PAGES.dashboard = { name, icon, sub, html, init }

(function () {
  const NAV_ORDER = [
    'dashboard', 'masters', 'purchase', 'sales', 'stockassign',
    'purchaseregister', 'saleregister', 'reports', 'returns',
    'partyledger', 'lowstock', 'backup'
  ];

  const navScroll = document.getElementById('navScroll');
  const content = document.getElementById('content');
  const pageTitle = document.getElementById('pageTitle');
  const pageSub = document.getElementById('pageSub');

  // ---------- Topbar "extra" slot (PC/header only) ----------
  // A page (currently only Dashboard) can inject its own widget here — e.g.
  // the "Live Users" indicator, to match the desktop .py app's header.
  // .topbar is hidden on mobile via CSS, so anything placed here only ever
  // shows on the PC layout; mobile keeps its own separate markup untouched.
  let topbarExtra = document.getElementById('topbarExtra');
  if (!topbarExtra) {
    topbarExtra = document.createElement('div');
    topbarExtra.id = 'topbarExtra';
    topbarExtra.className = 'topbar-extra';
    const topbarEl = document.querySelector('.topbar');
    const searchMini = topbarEl ? topbarEl.querySelector('.search-mini') : null;
    if (topbarEl) {
      if (searchMini) topbarEl.insertBefore(topbarExtra, searchMini);
      else topbarEl.appendChild(topbarExtra);
    }
  }
  window.topbarExtra = topbarExtra;

  // ---------- Toast (lightweight "UI preview" confirmation, used by pages) ----------
  let toastWrap = document.getElementById('toastWrap');
  if (!toastWrap) {
    toastWrap = document.createElement('div');
    toastWrap.id = 'toastWrap';
    toastWrap.className = 'toast-wrap';
    document.body.appendChild(toastWrap);
  }
  window.showToast = function (msg, ms = 2200) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    toastWrap.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 250);
    }, ms);
  };

  // ---------- Info buttons (project-wide) ----------
  // Any element with class="info-btn" and a data-info="..." attribute shows
  // its explanation as a toast on click, instead of the page permanently
  // displaying a paragraph of instructional text. One delegated listener
  // covers every info button on every page, including ones added later.
  document.addEventListener('click', (e) => {
    const infoBtn = e.target.closest('.info-btn');
    if (!infoBtn) return;
    e.stopPropagation();
    const msg = infoBtn.dataset.info;
    if (msg && window.showToast) window.showToast(msg, 5000);
  });

  // ---------- Global "Quick Search" (topbar) ----------
  // Dono search boxes (PC .search-mini + mobile .search-mini.mobile-search)
  // isi ek function se judte hain. Jo bhi page currently active hai, uske
  // andar jitni bhi <table> hain unki rows par text-match filter lagta hai —
  // page-specific koi alag wiring nahi karni padti kisi bhi naye/purane
  // table wale page me, ye automatically kaam karega.
  const searchInputs = Array.from(document.querySelectorAll('.search-mini input'));
  let currentSearchQuery = '';

  function applyGlobalTableSearch(query) {
    const q = (query || '').trim().toLowerCase();
    document.querySelectorAll('#content table tbody tr').forEach((row) => {
      if (!q) { row.classList.remove('search-hide'); return; }
      row.classList.toggle('search-hide', !row.textContent.toLowerCase().includes(q));
    });
  }
  window.applyGlobalTableSearch = applyGlobalTableSearch;

// ---------- Generic Excel-style column filter (reusable, Masters tables) ----------
// Dashboard ke Category-wise Snapshot filter jaisa hi hai, bas generic:
// khud thead <th> se columns detect karta hai, koi manual data-col markup
// nahi chahiye. Idempotent hai — same table pe dobara call karo (re-render
// ke baad) to bhi buttons duplicate nahi honge, filters bhi persist rahenge.
window.attachColumnFilters = function (table) {
  if (!table || table.dataset.filtersAttached) return;
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');
  if (!thead || !tbody) return;

  Array.from(thead.querySelectorAll('th')).forEach((th, i) => {
    if (th.querySelector('.th-filter-btn')) return;
    const label = th.textContent.trim();
    if (label.toLowerCase() === 'actions') return; // action-buttons column skip
    th.innerHTML = `${label} <button class="th-filter-btn" data-idx="${i}" type="button"><i class="fa-solid fa-filter"></i></button>`;
  });
  table.dataset.filtersAttached = '1';

  const activeFilters = {};
  let openMenuEl = null;
  const getRows = () => Array.from(tbody.querySelectorAll('tr'));
  const cellValue = (row, idx) => (row.children[idx] ? row.children[idx].textContent.trim() : '');
  const uniqueValues = (idx) => Array.from(new Set(getRows().map((r) => cellValue(r, idx))));

  function applyAllFilters() {
    getRows().forEach((row) => {
      const visible = Object.keys(activeFilters).every((idx) => activeFilters[idx].has(cellValue(row, idx)));
      row.style.display = visible ? '' : 'none';
    });
    table.querySelectorAll('.th-filter-btn').forEach((btn) => btn.classList.toggle('active', !!activeFilters[btn.dataset.idx]));
  }
  function closeMenu() { if (openMenuEl) { openMenuEl.remove(); openMenuEl = null; } }
  function positionMenu(menu, btn) {
    const rect = btn.getBoundingClientRect();
    const menuWidth = 210;
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - 10) left = window.innerWidth - menuWidth - 10;
    menu.style.left = Math.max(10, left) + 'px';
    menu.style.top = (rect.bottom + 4) + 'px';
  }
  function openMenuFor(btn) {
    const idx = btn.dataset.idx;
    closeMenu();
    const values = uniqueValues(idx);
    const selected = activeFilters[idx] || new Set(values);
    const menu = document.createElement('div');
    menu.className = 'th-filter-menu show';
    menu.innerHTML = `
      <div class="th-filter-search"><input type="text" placeholder="Search..."></div>
      <label class="th-filter-item th-filter-selectall">
        <input type="checkbox" ${selected.size === values.length ? 'checked' : ''}> <span>Select All</span>
      </label>
      <div class="th-filter-list">
        ${values.map((v) => `
          <label class="th-filter-item">
            <input type="checkbox" value="${v}" ${selected.has(v) ? 'checked' : ''}> <span>${v || '-'}</span>
          </label>`).join('')}
      </div>
      <div class="th-filter-actions">
        <button type="button" class="btn btn-ghost th-filter-clear">Clear</button>
        <button type="button" class="btn btn-blue th-filter-ok">OK</button>
      </div>`;
    document.body.appendChild(menu);
    positionMenu(menu, btn);
    openMenuEl = menu;
    const selectAllCb = menu.querySelector('.th-filter-selectall input');
    const itemCbs = () => Array.from(menu.querySelectorAll('.th-filter-list input'));
    const searchInput = menu.querySelector('.th-filter-search input');
    selectAllCb.addEventListener('change', () => {
      itemCbs().forEach((cb) => { if (cb.closest('.th-filter-item').style.display !== 'none') cb.checked = selectAllCb.checked; });
    });
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      menu.querySelectorAll('.th-filter-list .th-filter-item').forEach((item) => {
        item.style.display = item.textContent.trim().toLowerCase().includes(q) ? '' : 'none';
      });
    });
    menu.querySelector('.th-filter-clear').addEventListener('click', () => { delete activeFilters[idx]; closeMenu(); applyAllFilters(); });
    menu.querySelector('.th-filter-ok').addEventListener('click', () => {
      const checked = itemCbs().filter((cb) => cb.checked).map((cb) => cb.value);
      if (checked.length === values.length) delete activeFilters[idx]; else activeFilters[idx] = new Set(checked);
      closeMenu(); applyAllFilters();
    });
    menu.addEventListener('click', (e) => e.stopPropagation());
  }
  table.addEventListener('click', (e) => {
    const btn = e.target.closest('.th-filter-btn');
    if (!btn) return;
    e.stopPropagation();
    const wasOpen = openMenuEl && openMenuEl.dataset.forIdx === btn.dataset.idx;
    closeMenu();
    if (!wasOpen) { openMenuFor(btn); openMenuEl.dataset.forIdx = btn.dataset.idx; }
  });
  document.addEventListener('click', closeMenu);
  window.addEventListener('scroll', closeMenu, true);
  window.addEventListener('resize', closeMenu);
};

  searchInputs.forEach((input) => {
    input.addEventListener('input', () => {
      currentSearchQuery = input.value;
      searchInputs.forEach((other) => { if (other !== input) other.value = input.value; });
      applyGlobalTableSearch(currentSearchQuery);
    });
  });

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
    window.currentUsername = username;
    if (userEl) userEl.textContent = '@' + username;
    if (avatarEl) avatarEl.textContent = username.charAt(0).toUpperCase();
    if (role) {
      window.currentUserRole = role;
      if (roleEl) roleEl.textContent = role === 'SuperAdmin' ? 'Super Admin' : 'User';
    }
  }

  function showApp() {
    if (loginOverlay) loginOverlay.style.display = 'none';
    if (shellEl) shellEl.style.display = 'flex';
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
  function saveSession(username, role, persist) {
    const payload = JSON.stringify({ username, role });
    try { sessionStorage.setItem(SESSION_KEY, payload); } catch (e) { /* storage unavailable */ }
    try {
      if (persist) localStorage.setItem(SESSION_KEY, payload);
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* storage unavailable */ }
  }
  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && data.username && data.role) return data;
    } catch (e) { /* corrupt/unavailable storage — just fall through to login */ }
    return null;
  }
  function clearSession() {
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
  function startHeartbeat() {
    if (heartbeatTimer || !window.currentUsername) return;
    const ping = () => {
      fetch('/api/auth/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: window.currentUsername }),
      }).catch(() => { /* offline momentarily — next tick retries */ });
    };
    ping(); // mark online immediately, don't wait for the first interval tick
    heartbeatTimer = setInterval(ping, HEARTBEAT_MS);
  }
  function stopHeartbeat() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }

  // ---------- Auto-logout after 20 minutes of inactivity ----------
  // The heartbeat above pings every 20s purely to say "this tab is still
  // open" — it fires on a timer regardless of whether the person is
  // actually doing anything, so it alone can't detect someone who stepped
  // away and left the tab open. This is a separate, activity-based timer:
  // any mouse move/click, key press, scroll, or touch resets a 20-minute
  // countdown. If NOTHING resets it for the full 20 minutes, the person is
  // logged out automatically — same as clicking Logout — so their session
  // frees up (and, combined with the single-session rule, lets them log
  // back in from elsewhere without being stuck on an abandoned session).
  const IDLE_LIMIT_MS = 20 * 60 * 1000; // 20 minutes
  let idleTimer = null;
  let lastActivityResetAt = 0;
  function resetIdleTimer() {
    if (!window.currentUsername) return; // no one signed in — nothing to time out
    const now = Date.now();
    if (now - lastActivityResetAt < 3000) return; // throttle: mousemove/scroll fire dozens of times/sec
    lastActivityResetAt = now;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(handleIdleLogout, IDLE_LIMIT_MS);
  }
  function stopIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  async function handleIdleLogout() {
    if (!window.currentUsername) return;
    await notifyServerLogout();
    clearSession();
    window.currentUsername = null;
    showLoginOverlay();
    const errorBox = document.getElementById('loginError');
    if (errorBox) {
      errorBox.textContent = 'You were logged out automatically after 20 minutes of inactivity.';
      errorBox.classList.add('show');
    }
  }
  ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((evt) => {
    window.addEventListener(evt, resetIdleTimer, { passive: true, capture: true });
  });
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

  function showLoginOverlay() {
    if (!loginOverlay) buildLoginOverlay();
    const pwdInput = document.getElementById('loginPassword');
    if (pwdInput) pwdInput.value = '';
    const errorBox = document.getElementById('loginError');
    if (errorBox) errorBox.classList.remove('show');
    const stepCreds = document.getElementById('loginStepCreds');
    const stepOtp = document.getElementById('loginStepOtp');
    if (stepCreds) stepCreds.style.display = '';
    if (stepOtp) stepOtp.style.display = 'none';
    loginOverlay.style.display = 'flex';
    if (shellEl) shellEl.style.display = 'none';
  }

  function buildLoginOverlay() {
    loginOverlay = document.createElement('div');
    loginOverlay.className = 'login-overlay';
    loginOverlay.innerHTML = `
      <div class="login-card">
        <div class="login-logo"><img src="assets/logo.png" alt="Eco Green Solar" class="brand-logo"></div>

        <div id="loginStepCreds">
          <div class="login-field">
            <label>Username or Email</label>
            <input type="text" id="loginUsername" placeholder="Username or Email" autocomplete="username">
          </div>
          <div class="login-field">
            <label>Password</label>
            <div class="login-pwd-wrap">
              <input type="password" id="loginPassword" placeholder="Password" autocomplete="current-password">
              <button type="button" class="login-toggle-pwd" id="loginTogglePwd"><i class="fa-solid fa-eye"></i></button>
            </div>
          </div>
          <label class="login-remember"><input type="checkbox" id="loginRemember"> Remember Me on this Computer</label>
          <div class="login-error" id="loginError">Please enter both username/email and password.</div>
          <button type="button" class="login-btn" id="loginSubmit">Sign In</button>
        </div>

        <div id="loginStepOtp" style="display:none;">
          <div style="color:var(--txt-muted); font-size:13px; margin-bottom:12px;" id="loginOtpHint">
            Enter the 6-digit OTP sent to your email.
          </div>
          <div class="login-field">
            <label>OTP</label>
            <input type="text" id="loginOtpInput" placeholder="6-digit OTP" inputmode="numeric" maxlength="6" autocomplete="one-time-code">
          </div>
          <div class="login-error" id="loginOtpError"></div>
          <button type="button" class="login-btn" id="loginOtpSubmit">Verify &amp; Sign In</button>
          <div style="display:flex; justify-content:space-between; margin-top:10px;">
            <button type="button" class="btn btn-ghost" id="loginOtpBack" style="padding:6px 10px; font-size:12px;">&larr; Back</button>
            <button type="button" class="btn btn-ghost" id="loginOtpResend" style="padding:6px 10px; font-size:12px;">Resend OTP</button>
          </div>
        </div>
      </div>`;
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
    const otpInput = loginOverlay.querySelector('#loginOtpInput');
    const otpError = loginOverlay.querySelector('#loginOtpError');
    const otpSubmitBtn = loginOverlay.querySelector('#loginOtpSubmit');
    const otpBackBtn = loginOverlay.querySelector('#loginOtpBack');
    const otpResendBtn = loginOverlay.querySelector('#loginOtpResend');

    // Carries the verified username across from step 1 to step 2 (server
    // already confirmed the password by the time we get here).
    let pendingUsername = null;

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
      stepOtp.style.display = 'none';
      stepCreds.style.display = '';
      otpInput.value = '';
      otpError.classList.remove('show');
      pendingUsername = null;
    }

    function showOtpStep(maskedEmail) {
      stepCreds.style.display = 'none';
      stepOtp.style.display = '';
      otpHint.textContent = maskedEmail
        ? `Enter the 6-digit OTP sent to ${maskedEmail}.`
        : 'Enter the 6-digit OTP sent to your email.';
      otpError.classList.remove('show');
      otpInput.value = '';
      otpInput.focus();
    }

    // Finish signing in after the OTP is verified — same completion steps
    // the old single-step login used to run right after the password check.
    function finishLogin(data) {
      try {
        if (rememberChk.checked) {
          localStorage.setItem('egs_remember', '1');
          localStorage.setItem('egs_user', data.username);
        } else {
          localStorage.removeItem('egs_remember');
          localStorage.removeItem('egs_user');
        }
      } catch (e) { /* localStorage unavailable — Remember Me just won't persist */ }
      saveSession(data.username, data.role, rememberChk.checked);
      updateProfileDisplay(data.username, data.role);
      showApp();
      startHeartbeat();
      resetIdleTimer();
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
      submitBtn.textContent = 'Signing In...';
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: user, password: pwd }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
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
        submitBtn.textContent = 'Sign In';
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
      otpSubmitBtn.textContent = 'Verifying...';
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
          return;
        }
        finishLogin(data);
      } catch (e) {
        otpError.textContent = 'Could not reach the server. Please try again.';
        otpError.classList.add('show');
      } finally {
        otpSubmitBtn.disabled = false;
        otpSubmitBtn.textContent = 'Verify & Sign In';
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
          return;
        }
        otpHint.textContent = `A new OTP was sent to ${data.maskedEmail}.`;
        otpError.classList.remove('show');
      } catch (e) {
        otpError.textContent = 'Could not reach the server. Please try again.';
        otpError.classList.add('show');
      } finally {
        otpResendBtn.disabled = false;
        otpResendBtn.textContent = originalLabel;
      }
    }

    submitBtn.addEventListener('click', attemptLogin);
    pwdInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptLogin(); });
    userInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') pwdInput.focus(); });

    otpSubmitBtn.addEventListener('click', attemptVerifyOtp);
    otpInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptVerifyOtp(); });
    otpBackBtn.addEventListener('click', showCredsStep);
    otpResendBtn.addEventListener('click', attemptResendOtp);
  }

  // =================== PROFILE MENU (sidebar avatar) ===================
  // Clicking the rounded avatar in the sidebar opens a small dropdown, like
  // the desktop app's show_profile_menu(): header (@username / role), then
  // "Switch User" and "Logout" — instead of logging out directly.
  const profileBox = document.querySelector('.profile-box');
  let profileMenuEl = null;

  function closeProfileMenu() {
    if (profileMenuEl) { profileMenuEl.remove(); profileMenuEl = null; }
  }

  function endSessionAndShowLogin() {
    closeProfileMenu();
    notifyServerLogout();
    clearSession();
    showLoginOverlay();
  }

  function openProfileMenu() {
    closeProfileMenu();
    const roleEl = document.querySelector('.profile-box .role');
    const userEl = document.querySelector('.profile-box .user');
    const roleTxt = roleEl ? roleEl.textContent : 'Super Admin';
    const userTxt = userEl ? userEl.textContent : '@user';

    const menu = document.createElement('div');
    menu.className = 'profile-menu';
    menu.innerHTML = `
      <div class="profile-menu-header">
        <div class="name">${userTxt}</div>
        <div class="role">${roleTxt}</div>
      </div>
      <button type="button" class="profile-menu-item" id="profileSwitchUser"><i class="fa-solid fa-user-group"></i> Switch User</button>
      <button type="button" class="profile-menu-item danger" id="profileLogout"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>`;
    document.body.appendChild(menu);

    // Open ABOVE the avatar — it sits near the bottom of the sidebar, so
    // opening downward would push the menu off-screen (same reasoning as
    // the desktop app's show_profile_menu()).
    const rect = profileBox.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    menu.style.left = Math.max(10, rect.left) + 'px';
    menu.style.top = Math.max(10, rect.top - menuRect.height - 8) + 'px';

    profileMenuEl = menu;

    menu.querySelector('#profileLogout').addEventListener('click', async () => {
      closeProfileMenu();
      const ok = await window.confirmDialog('Confirm Logout', 'Are you sure you want to logout?', { kind: 'question', okLabel: 'Logout' });
      if (ok) endSessionAndShowLogin();
    });
    menu.querySelector('#profileSwitchUser').addEventListener('click', async () => {
      closeProfileMenu();
      const ok = await window.confirmDialog('Switch User', 'This will close the current session so another user can login. Continue?', { kind: 'question', okLabel: 'Continue' });
      if (ok) endSessionAndShowLogin();
    });
    menu.addEventListener('click', (e) => e.stopPropagation());
  }

  if (profileBox) {
    profileBox.addEventListener('click', (e) => {
      e.stopPropagation();
      if (profileMenuEl) closeProfileMenu();
      else openProfileMenu();
    });
  }
  document.addEventListener('click', closeProfileMenu);

  // Build sidebar buttons from the registered pages
  NAV_ORDER.forEach((id) => {
    const page = window.PAGES[id];
    if (!page) return;
    const btn = document.createElement('button');
    btn.className = 'nav-btn' + (id === 'dashboard' ? ' active' : '');
    btn.dataset.tab = id;
    btn.innerHTML = `<i class="fa-solid ${page.icon}"></i> ${page.name}`;
    btn.onclick = () => go(id);
    navScroll.appendChild(btn);
  });

  function go(id) {
    const page = window.PAGES[id];
    if (!page) return;

    content.innerHTML = page.html;
    pageTitle.textContent = page.name;
    pageSub.textContent = page.sub || '';
    if (topbarExtra) topbarExtra.innerHTML = ''; // reset header widget before each page's init()

    document.querySelectorAll('.nav-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.tab === id)
    );

    // Page-specific wiring (subtab clicks, form buttons, etc.) runs after
    // its HTML is in the DOM.
    if (typeof page.init === 'function') page.init();

    applyGlobalTableSearch(currentSearchQuery);

    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Sidebar (mobile) ----------
  window.openSidebar = function () {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('overlay').classList.add('show');
  };
  window.closeSidebar = function () {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
  };

  // ---------- Modal (used for "Live User Sessions" popup, etc.) ----------
  window.openModal = function (title, bodyHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalOverlay').classList.add('show');
  };
  window.closeModal = function (event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('modalOverlay').classList.remove('show');
  };

  // ---------- Confirm Dialog (drop-in replacement for window.confirm(),
  // mirrors ui/notify.py's custom question/confirm_danger dialogs: a
  // rounded card with a coloured accent border + icon, and Cancel/Confirm
  // buttons — never the native browser "site says" popup. ----------
  const KIND_STYLE = {
    question: { color: 'var(--purple)', icon: 'fa-circle-question' },
    danger: { color: 'var(--red)', icon: 'fa-triangle-exclamation' },
    warning: { color: 'var(--gold)', icon: 'fa-triangle-exclamation' },
    info: { color: 'var(--blue)', icon: 'fa-circle-info' },
  };
  let confirmResolver = null;

  function closeConfirmDialog(result) {
    document.getElementById('confirmOverlay').classList.remove('show');
    if (confirmResolver) { const r = confirmResolver; confirmResolver = null; r(result); }
  }

  // window.confirmDialog(title, message, opts?) -> Promise<boolean>
  // opts: { kind: 'question'|'danger'|'warning'|'info', okLabel, cancelLabel }
  window.confirmDialog = function (title, message, opts) {
    opts = opts || {};
    const kind = KIND_STYLE[opts.kind] ? opts.kind : 'question';
    const style = KIND_STYLE[kind];
    const card = document.getElementById('confirmCard');
    card.style.setProperty('--confirm-accent', style.color);
    document.getElementById('confirmIcon').innerHTML = `<i class="fa-solid ${style.icon}"></i>`;
    document.getElementById('confirmTitle').textContent = title || 'Please Confirm';
    document.getElementById('confirmMsg').textContent = message || '';
    const okBtn = document.getElementById('confirmBtnOk');
    const cancelBtn = document.getElementById('confirmBtnCancel');
    okBtn.textContent = opts.okLabel || 'Yes';
    cancelBtn.textContent = opts.cancelLabel || 'Cancel';
    document.getElementById('confirmOverlay').classList.add('show');
    return new Promise((resolve) => {
      confirmResolver = resolve;
      okBtn.onclick = () => closeConfirmDialog(true);
      cancelBtn.onclick = () => closeConfirmDialog(false);
    });
  };
  // Convenience wrapper matching notify.py's confirm_danger() — destructive
  // actions (delete etc.), red accent, defaults to "Yes"/"Cancel".
  window.confirmDanger = function (title, message) {
    return window.confirmDialog(title, message, { kind: 'danger', okLabel: 'Yes, Delete' });
  };
  document.getElementById('confirmOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeConfirmDialog(false);
  });

  window.go = go;

  // ---------- Start: restore a saved session if one exists, otherwise show login ----------
  // "Remember Me" only prefills the username (see buildLoginOverlay above) if
  // no session was restored — the password still has to be verified through
  // POST /api/auth/login the first time. After that, this saved session is
  // what keeps someone signed in across refreshes/reopens instead of asking
  // for username/password every single time.
  buildLoginOverlay();
  const restoredSession = loadSession();
  if (restoredSession) {
    updateProfileDisplay(restoredSession.username, restoredSession.role);
    showApp();
    startHeartbeat();
    resetIdleTimer();
  } else {
    showLoginOverlay();
  }

  // Start on Dashboard
  go('dashboard');

  // Footer credit line — always show the current year, no manual updates needed.
  const footerYearEl = document.getElementById('footerYear');
  if (footerYearEl) footerYearEl.textContent = new Date().getFullYear();
})();