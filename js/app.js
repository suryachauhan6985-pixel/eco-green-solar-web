// js/app.js
// Wires up the sidebar, page-switching, and modal — same role as main.py in the
// desktop app (builds the nav from tab list, swaps the active page).
// Each page module (js/pages/*.js) registers itself into window.PAGES before
// this file runs, e.g. window.PAGES.dashboard = { name, icon, sub, html, init }

// ---------------------------------------------------------------------------
// AUTH TOKEN — global fetch wrapper.
// The backend now requires "Authorization: Bearer <token>" on every
// protected /api/... call (see api/server.js authenticateToken). Rather
// than editing every fetch()/window.Api call across js/data/api.js and
// every js/pages/*.js file individually, this patches window.fetch ONCE,
// here — any request to this app's own /api/... endpoints automatically
// gets the header attached (when we have a token); every other request
// (other origins, static assets) passes through untouched.
// window.currentAuthToken is set on login and restored on page refresh
// below. If a call that ACTUALLY CARRIED a token comes back 401 (expired/
// invalid token), we broadcast 'egs:session-expired' so the app can drop
// back to the login screen instead of leaving the person stuck looking at
// failed requests.
//   IMPORTANT: the Dashboard page loads (and polls) in the background even
//   while the login overlay is showing on top of it — e.g. mid-way through
//   entering an OTP, before any token exists yet. Those background calls
//   are EXPECTED to 401 (there's no session yet) and must NOT be treated as
//   an expiry, or they'd yank the person off the OTP screen while typing.
//   That's why this only fires for requests that actually had a token
//   attached (hadToken below) — a 401 with no token just means "not logged
//   in yet", which is normal and not an error to react to.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// GLOBAL LOADING OVERLAY — window.showLoader() / window.hideLoader().
// Uses a counter (not a simple on/off flag) so that if two API calls happen
// to overlap (e.g. a page loads two datasets at once), the overlay only
// hides once ALL of them have finished — not the moment the first one
// returns. Wired automatically into every /api/... call by the window.fetch
// wrapper right below; pages/modules can also call these manually if they
// ever need to show the overlay around non-fetch work.
// ---------------------------------------------------------------------------
let __egsLoaderCount = 0;
window.showLoader = function showLoader(title, sub) {
  __egsLoaderCount++;
  const el = document.getElementById('loaderOverlay');
  if (el) {
    let textWrap = el.querySelector('.loader-text-wrap');
    if (!textWrap) {
      textWrap = document.createElement('div');
      textWrap.className = 'loader-text-wrap';
      el.appendChild(textWrap);
    }
    if (title) {
      textWrap.innerHTML = `
        <div class="loader-title">${title}</div>
        ${sub ? `<div class="loader-sub">${sub}</div>` : ''}
      `;
      textWrap.style.display = 'flex';
    } else {
      textWrap.innerHTML = '';
      textWrap.style.display = 'none';
    }
    el.classList.add('active');
  }
};
window.hideLoader = function hideLoader(force) {
  if (force) __egsLoaderCount = 0;
  else __egsLoaderCount = Math.max(0, __egsLoaderCount - 1);
  if (__egsLoaderCount === 0) {
    const el = document.getElementById('loaderOverlay');
    if (el) {
      el.classList.remove('active');
      const textWrap = el.querySelector('.loader-text-wrap');
      if (textWrap) textWrap.innerHTML = '';
    }
  }
};

// ---------------------------------------------------------------------------
// window.focusInvalidField(el) — generic "missing required field" UX used
// across every page's forms (BOM, Sales, Purchase, Masters, ...): instead of
// (or alongside) an openModal() popup, this scrolls the actual offending
// field into view, focuses it, and gives it a red outline + a brief shake so
// it's unmistakable which field still needs filling in — same pattern any
// normal web form uses for client-side validation. The red outline clears
// itself the moment the person starts fixing that field (input/change/
// focus), and also auto-clears after a few seconds so it never gets stuck
// highlighted if they go fix it some other way (e.g. picking a datalist
// suggestion that doesn't fire 'input' in every browser).
// `el` can be an <input>/<select>/<textarea>, OR a non-field wrapper (e.g. a
// custom dropdown trigger) — either way it just needs to be a real element
// already in the DOM. Safe to call with a null/missing element (no-ops).
// ---------------------------------------------------------------------------
window.focusInvalidField = function focusInvalidField(el) {
  if (!el || !el.scrollIntoView) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const doFocus = () => { if (el.focus) el.focus({ preventScroll: true }); };
  // Give the smooth-scroll a beat to land before focusing/highlighting —
  // focusing mid-scroll on some mobile browsers cancels the scroll early.
  setTimeout(doFocus, 120);

  el.classList.remove('egs-field-invalid'); // restart the shake if already flagged
  // eslint-disable-next-line no-unused-expressions
  void el.offsetWidth; // force reflow so re-adding the class replays the CSS animation
  el.classList.add('egs-field-invalid');

  let cleared = false;
  const clear = () => {
    if (cleared) return;
    cleared = true;
    el.classList.remove('egs-field-invalid');
    el.removeEventListener('input', clear);
    el.removeEventListener('change', clear);
  };
  el.addEventListener('input', clear);
  el.addEventListener('change', clear);
  setTimeout(clear, 3500); // safety auto-clear, e.g. for datalist picks that skip 'input'
};

// Injects the red-outline/shake styling for window.focusInvalidField() once.
// Self-contained here (rather than in css/modules/*.css, which weren't
// available when this was added) — safe to move into an actual CSS file
// later, the class name (egs-field-invalid) is what matters, not where the
// rule lives.
(function injectInvalidFieldStyles() {
  if (document.getElementById('egsInvalidFieldStyles')) return;
  const style = document.createElement('style');
  style.id = 'egsInvalidFieldStyles';
  style.textContent = `
    .egs-field-invalid {
      border-color: #e5484d !important;
      box-shadow: 0 0 0 1px rgba(229, 72, 77, 0.55) !important;
      outline: none !important;
      animation: egsFieldShake 0.4s ease-in-out;
    }
    @keyframes egsFieldShake {
      0%, 100% { transform: translateX(0); }
      15% { transform: translateX(-3px); }
      30% { transform: translateX(3px); }
      45% { transform: translateX(-2px); }
      60% { transform: translateX(2px); }
      75% { transform: translateX(-1px); }
    }
  `;

  document.head.appendChild(style);
})();

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
    const tokenUsedForThisCall = window.currentAuthToken;
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
  const NAV_ORDER = [
    'dashboard', 'scansheet', 'masters', 'purchase', 'sales', 'stockassign',
    'purchaseregister', 'saleregister', 'reports', 'returns',
    'partyledger', 'lowstock', 'backup', 'bom'
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

  // =====================================================================
  // ADVANCED TOAST NOTIFICATION ENGINE (Multi-type, animated, auto-dismiss)
  // =====================================================================
  let toastWrap = document.getElementById('toastWrap');
  if (!toastWrap) {
    toastWrap = document.createElement('div');
    toastWrap.id = 'toastWrap';
    toastWrap.className = 'toast-wrap';
    document.body.appendChild(toastWrap);
  }

  const TOAST_ICONS = {
    success: 'fa-solid fa-circle-check',
    error: 'fa-solid fa-circle-xmark',
    warning: 'fa-solid fa-triangle-exclamation',
    info: 'fa-solid fa-circle-info'
  };

  /**
   * window.showToast(msg, typeOrDuration?, maybeDuration?)
   * Examples:
   *   window.showToast('Item saved successfully!', 'success');
   *   window.showToast('Failed to connect to server', 'error', 4000);
   *   window.showToast('Quantity is required', 'warning');
   *   window.showToast('Loading data...', 2000);
   */
  window.showToast = function (msg, typeOrDuration = 'info', maybeDuration = null) {
    if (!msg) return;
    let type = 'info';
    let duration = 2800;

    if (typeof typeOrDuration === 'number') {
      duration = typeOrDuration;
    } else if (typeof typeOrDuration === 'string') {
      const lower = typeOrDuration.toLowerCase();
      if (TOAST_ICONS[lower]) type = lower;
      if (typeof maybeDuration === 'number') duration = maybeDuration;
      else if (type === 'error') duration = 4000;
      else if (type === 'warning') duration = 3200;
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const iconHtml = `<div class="toast-icon"><i class="${TOAST_ICONS[type] || TOAST_ICONS.info}"></i></div>`;
    const msgHtml = `<div class="toast-msg">${msg}</div>`;
    const closeBtnHtml = `<button type="button" class="toast-close" title="Dismiss"><i class="fa-solid fa-xmark"></i></button>`;
    const progressHtml = `<div class="toast-progress" style="transition: transform ${duration}ms linear; transform: scaleX(1);"></div>`;

    toast.innerHTML = `${iconHtml}${msgHtml}${closeBtnHtml}${progressHtml}`;
    toastWrap.appendChild(toast);

    // Entrance animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
      const progressBar = toast.querySelector('.toast-progress');
      if (progressBar) {
        requestAnimationFrame(() => {
          progressBar.style.transform = 'scaleX(0)';
        });
      }
    });

    let dismissTimer = null;
    let isDismissed = false;

    const dismissToast = () => {
      if (isDismissed) return;
      isDismissed = true;
      if (dismissTimer) clearTimeout(dismissTimer);
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 320);
    };

    dismissTimer = setTimeout(dismissToast, duration);

    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) closeBtn.onclick = dismissToast;

    // Swipe / Click to dismiss
    toast.addEventListener('click', (e) => {
      if (e.target.closest('a') || e.target.closest('button')) return;
      dismissToast();
    });
  };

  // =====================================================================
  // SWEETALERT-GRADE RICH POPUP DIALOGS (Success, Error, Warning, Info)
  // =====================================================================
  let popupOverlay = null;

  function ensurePopupDom() {
    if (popupOverlay) return popupOverlay;
    popupOverlay = document.createElement('div');
    popupOverlay.id = 'egsPopupOverlay';
    popupOverlay.className = 'egs-popup-overlay';
    popupOverlay.innerHTML = `
      <div class="egs-popup-card" id="egsPopupCard">
        <div class="egs-popup-icon-wrap" id="egsPopupIcon"></div>
        <h3 class="egs-popup-title" id="egsPopupTitle"></h3>
        <div class="egs-popup-body" id="egsPopupBody"></div>
        <div class="egs-popup-actions" id="egsPopupActions"></div>
        <div class="egs-popup-progress-track" id="egsPopupProgressTrack" style="display:none;">
          <div class="egs-popup-progress-bar" id="egsPopupProgressBar"></div>
        </div>
      </div>
    `;
    document.body.appendChild(popupOverlay);
    return popupOverlay;
  }

  const POPUP_SVGS = {
    success: `
      <svg class="egs-svg-icon" viewBox="0 0 52 52">
        <circle class="egs-svg-circle" cx="26" cy="26" r="24"/>
        <path class="egs-svg-check" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
      </svg>`,
    error: `
      <svg class="egs-svg-icon" viewBox="0 0 52 52">
        <circle class="egs-svg-circle" cx="26" cy="26" r="24"/>
        <path class="egs-svg-cross1" d="M16 16 36 36"/>
        <path class="egs-svg-cross2" d="M36 16 16 36"/>
      </svg>`,
    warning: `<i class="fa-solid fa-triangle-exclamation" style="font-size:36px;"></i>`,
    info: `<i class="fa-solid fa-circle-info" style="font-size:36px;"></i>`
  };

  /**
   * window.showPopup(opts) -> Promise<boolean>
   * opts: { type: 'success'|'error'|'warning'|'info', title, message, html, confirmText, showCancel, cancelText, timer }
   */
  window.showPopup = function (opts = {}) {
    ensurePopupDom();
    const type = (opts.type || 'info').toLowerCase();
    const title = opts.title || (type === 'success' ? 'Success!' : (type === 'error' ? 'Error' : 'Notice'));
    const body = opts.html || opts.message || opts.text || '';
    const confirmText = opts.confirmText || opts.confirmBtnText || 'OK';
    const showCancel = !!opts.showCancel;
    const cancelText = opts.cancelText || opts.cancelBtnText || 'Cancel';
    const timer = typeof opts.timer === 'number' ? opts.timer : null;

    const card = document.getElementById('egsPopupCard');
    card.className = `egs-popup-card egs-popup-${type}`;

    document.getElementById('egsPopupIcon').innerHTML = POPUP_SVGS[type] || POPUP_SVGS.info;
    document.getElementById('egsPopupTitle').textContent = title;
    document.getElementById('egsPopupBody').innerHTML = body;

    const actionsEl = document.getElementById('egsPopupActions');
    const primaryBtnClass = type === 'success' ? 'success' : (type === 'error' ? 'error' : 'primary');

    actionsEl.innerHTML = `
      ${showCancel ? `<button type="button" class="egs-popup-btn cancel" id="egsPopupBtnCancel">${cancelText}</button>` : ''}
      <button type="button" class="egs-popup-btn ${primaryBtnClass}" id="egsPopupBtnOk">${confirmText}</button>
    `;

    const progressTrack = document.getElementById('egsPopupProgressTrack');
    const progressBar = document.getElementById('egsPopupProgressBar');
    if (timer && timer > 0) {
      progressTrack.style.display = 'block';
      progressBar.style.transition = 'none';
      progressBar.style.transform = 'scaleX(1)';
      requestAnimationFrame(() => {
        progressBar.style.transition = `transform ${timer}ms linear`;
        progressBar.style.transform = 'scaleX(0)';
      });
    } else {
      progressTrack.style.display = 'none';
    }

    popupOverlay.classList.add('active');

    return new Promise((resolve) => {
      let timerId = null;
      let resolved = false;

      const finish = (result) => {
        if (resolved) return;
        resolved = true;
        if (timerId) clearTimeout(timerId);
        popupOverlay.classList.remove('active');
        document.removeEventListener('keydown', keyHandler);
        resolve(result);
      };

      const okBtn = document.getElementById('egsPopupBtnOk');
      const cancelBtn = document.getElementById('egsPopupBtnCancel');
      if (okBtn) {
        okBtn.onclick = () => finish(true);
        setTimeout(() => okBtn.focus(), 60);
      }
      if (cancelBtn) cancelBtn.onclick = () => finish(false);

      if (timer && timer > 0) {
        timerId = setTimeout(() => finish(true), timer);
      }

      const keyHandler = (e) => {
        if (e.key === 'Escape') finish(false);
        else if (e.key === 'Enter') finish(true);
      };
      document.addEventListener('keydown', keyHandler);

      popupOverlay.onclick = (e) => {
        if (e.target === popupOverlay) finish(false);
      };
    });
  };

  window.showSuccess = function (title, message, timer = 2400) {
    return window.showPopup({ type: 'success', title: title || 'Completed Successfully', message: message || '', timer: timer });
  };
  window.showError = function (title, message) {
    return window.showPopup({ type: 'error', title: title || 'Something Went Wrong', message: message || '' });
  };
  window.showWarning = function (title, message) {
    return window.showPopup({ type: 'warning', title: title || 'Attention Required', message: message || '' });
  };
  window.showInfo = function (title, message, timer = null) {
    return window.showPopup({ type: 'info', title: title || 'Information', message: message || '', timer: timer });
  };

  // ---------- Info buttons (project-wide) ----------
  document.addEventListener('click', (e) => {
    const infoBtn = e.target.closest('.info-btn');
    if (!infoBtn) return;
    e.stopPropagation();
    const msg = infoBtn.dataset.info;
    if (msg && window.showToast) window.showToast(msg, 'info', 5000);
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
      if (roleEl) roleEl.textContent = role === 'SuperAdmin' ? 'Super Admin' : (role === 'Admin' ? 'Admin' : 'User');
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
        <span class="login-orb login-orb-a"></span>
        <span class="login-orb login-orb-b"></span>
        <span class="login-orb login-orb-c"></span>
        <span class="login-grid"></span>
      </div>
      <div class="login-shell">
        <div class="login-brand-panel">
          <div class="login-brand-inner">
            <div class="login-logo"><img src="assets/logo.png" alt="Eco Green Solar" class="brand-logo"></div>
            <h1 class="login-brand-title">Eco Green Solar</h1>
            <p class="login-brand-tag">ERP for stock, sales &amp; field operations</p>
            <ul class="login-brand-points">
              <li><i class="fa-solid fa-lock"></i> Protected access with email OTP</li>
              <li><i class="fa-solid fa-chart-line"></i> Real-time inventory visibility</li>
              <li><i class="fa-solid fa-briefcase"></i> Built for field &amp; office teams</li>
            </ul>
            <div style="margin-top:24px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.12); font-size:12px; color:rgba(255,255,255,0.7); display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-code" style="color:var(--gold);"></i> Developed by <strong style="color:var(--gold); font-weight:700;">Sumit Chauhan</strong>
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
          <label class="login-remember"><input type="checkbox" id="loginRemember"> Remember Me on this device</label>
          <div class="login-error" id="loginError">Please enter both username/email and password.</div>
          <button type="button" class="login-btn" id="loginSubmit"><span>Sign In</span> <i class="fa-solid fa-arrow-right"></i></button>
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
              <input type="password" id="regPassword" placeholder="At least 6 characters" autocomplete="new-password">
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
              <input type="password" id="resetNewPassword" placeholder="At least 6 characters" autocomplete="new-password">
              <button type="button" class="login-toggle-pwd" id="resetTogglePwd"><i class="fa-solid fa-eye"></i></button>
            </div>
          </div>
          <div class="login-error" id="resetError"></div>
          <button type="button" class="login-btn" id="resetSubmit"><span>Reset Password &amp; Sign In</span> <i class="fa-solid fa-check"></i></button>
          <div class="login-back-wrap">
            <button type="button" class="login-back-btn" id="resetBack"><i class="fa-solid fa-arrow-left"></i> Back</button>
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

    // ---------- OTP boxes: 6 separate single-digit inputs that stay in sync
    // with one hidden <input> (so the rest of the login code below can keep
    // reading/writing otpInput.value exactly as before — nothing else has
    // to change). Handles auto-advance on type, backspace-to-previous, and
    // pasting a full 6-digit code into any one of the boxes. ----------
    function wireOtpBoxes(boxesEl, hiddenEl, onComplete) {
      if (!boxesEl || !hiddenEl) return { focusFirst() {}, clear() {} };
      const boxes = Array.from(boxesEl.querySelectorAll('.otp-box'));
      let completed = false;
      function sync() {
        hiddenEl.value = boxes.map((b) => b.value).join('');
        if (!completed && hiddenEl.value.length === boxes.length && typeof onComplete === 'function') {
          completed = true;
          setTimeout(() => { completed = false; onComplete(hiddenEl.value); }, 40);
        }
      }
      boxes.forEach((box, i) => {
        box.addEventListener('input', () => {
          box.value = box.value.replace(/[^0-9]/g, '').slice(0, 1);
          if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
          sync();
        });
        box.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            sync();
            if (hiddenEl.value.length === boxes.length && typeof onComplete === 'function') onComplete(hiddenEl.value);
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
          sync();
          const nextEmpty = boxes.find((b) => !b.value) || boxes[boxes.length - 1];
          nextEmpty.focus();
        });
      });
      return {
        focusFirst() { boxes[0].focus(); },
        clear() { boxes.forEach((b) => { b.value = ''; }); hiddenEl.value = ''; completed = false; },
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
    }

    function showOtpStep(maskedEmail) {
      window.freshLoginInProgress = true;
      stepCreds.style.display = 'none';
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
      [stepCreds, stepOtp, stepRegister, stepRegisterOtp, stepForgot, stepReset].forEach((el) => {
        if (el) el.style.display = 'none';
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
      const welcomeHtml = `
        <div class="login-success-pop">
          <div class="login-success-icon"><i class="fa-solid fa-circle-check"></i></div>
          <h3 style="margin:10px 0 6px;font-size:18px;">Login successful</h3>
          <p style="margin:0;color:var(--txt-muted);font-size:13px;">Welcome back, <b style="color:var(--txt);">${data.username}</b>.</p>
        </div>`;
      if (typeof window.openModal === 'function') {
        window.openModal('Welcome', welcomeHtml);
        // Brief confirmation only — no Continue click required
        setTimeout(() => { if (window.closeModal) window.closeModal(); }, 900);
      } else if (typeof window.showToast === 'function') {
        window.showToast(`Login successful! Welcome, ${data.username}.`);
      }
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
      if (pwd !== confirmPwd) {
        regError.textContent = 'Passwords do not match.';
        regError.classList.add('show');
        return;
      }
      if (pwd.length < 6) {
        regError.textContent = 'Password must be at least 6 characters.';
        regError.classList.add('show');
        return;
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
      if (newPassword.length < 6) {
        resetError.textContent = 'Password must be at least 6 characters.';
        resetError.classList.add('show');
        return;
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
  }


  // =================== APP SETTINGS PANEL ===================
  async function openAppSettingsPanel() {
    const role = (window.currentRole || '').toLowerCase();
    const isAdmin = role === 'admin' || role === 'superadmin';
    let settings = { challan_prefix: '', challan_next: '1', challan_pad: '4' };
    try {
      const data = await window.Api.get('/auth/app-settings');
      if (data && data.settings) settings = Object.assign(settings, data.settings);
    } catch (e) { /* defaults */ }

    const theme = (window.getAppTheme && window.getAppTheme()) || 'dark';
    const themeBlock = `
      <div class="egs-set-section">
        <button type="button" class="egs-set-accordion" id="egsSetThemeToggle">
          <span><i class="fa-solid fa-palette"></i> Theme</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="egs-set-panel" id="egsSetThemePanel" style="display:none;">
          <div class="profile-theme-row" style="padding:8px 0;">
            <button type="button" class="theme-btn" data-theme-set="dark"><i class="fa-solid fa-moon"></i> Dark</button>
            <button type="button" class="theme-btn" data-theme-set="gray"><i class="fa-solid fa-circle-half-stroke"></i> Gray</button>
            <button type="button" class="theme-btn" data-theme-set="light"><i class="fa-solid fa-sun"></i> Light</button>
          </div>
        </div>
      </div>`;

    const challanBlock = isAdmin ? `
      <div class="egs-set-section">
        <button type="button" class="egs-set-accordion" id="egsSetChallanToggle">
          <span><i class="fa-solid fa-hashtag"></i> Challan number</span>
          <i class="fa-solid fa-chevron-down"></i>
        </button>
        <div class="egs-set-panel" id="egsSetChallanPanel" style="display:none;">
          <p class="note" style="margin:0 0 10px;font-size:12px;">Admin only — set prefix, next number and zero-padding. Example: prefix <b>CH</b>, next <b>127</b>, pad <b>4</b> → <b>CH0127</b>.</p>
          <div class="field" style="margin-bottom:8px;"><label>Prefix</label>
            <input id="egsChallanPrefix" type="text" value="${String(settings.challan_prefix || '').replace(/"/g,'&quot;')}" placeholder="e.g. CH or blank" autocomplete="off">
          </div>
          <div class="field" style="margin-bottom:8px;"><label>Next number</label>
            <input id="egsChallanNext" type="number" min="1" value="${String(settings.challan_next || '1').replace(/"/g,'&quot;')}" autocomplete="off">
          </div>
          <div class="field" style="margin-bottom:8px;"><label>Zero pad length</label>
            <input id="egsChallanPad" type="number" min="0" max="10" value="${String(settings.challan_pad || '4').replace(/"/g,'&quot;')}" autocomplete="off">
          </div>
          <div style="text-align:right;margin-top:8px;">
            <button type="button" class="btn btn-blue" id="egsChallanSave"><i class="fa-solid fa-floppy-disk"></i> Save challan settings</button>
          </div>
        </div>
      </div>` : `
      <p class="note" style="font-size:12px;margin:8px 0 0;">Challan sequence settings are available to Admin / Super Admin only.</p>`;

    const html = `
      <div class="egs-settings">
        ${themeBlock}
        ${challanBlock}
      </div>`;

    if (typeof window.openModal !== 'function') return;
    window.openModal('Settings', html);

    setTimeout(() => {
      const themeToggle = document.getElementById('egsSetThemeToggle');
      const themePanel = document.getElementById('egsSetThemePanel');
      if (themeToggle && themePanel) {
        themeToggle.addEventListener('click', () => {
          const open = themePanel.style.display !== 'none';
          themePanel.style.display = open ? 'none' : 'block';
        });
      }
      if (window.wireThemeButtons) window.wireThemeButtons(document.getElementById('modalBody') || document);
      if (window.getAppTheme) {
        document.querySelectorAll('#modalBody [data-theme-set]').forEach((btn) => {
          btn.classList.toggle('active', btn.getAttribute('data-theme-set') === window.getAppTheme());
        });
      }
      const chToggle = document.getElementById('egsSetChallanToggle');
      const chPanel = document.getElementById('egsSetChallanPanel');
      if (chToggle && chPanel) {
        chToggle.addEventListener('click', () => {
          chPanel.style.display = chPanel.style.display !== 'none' ? 'none' : 'block';
        });
      }
      const saveBtn = document.getElementById('egsChallanSave');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          try {
            await window.Api.put('/auth/app-settings', {
              settings: {
                challan_prefix: (document.getElementById('egsChallanPrefix') || {}).value || '',
                challan_next: (document.getElementById('egsChallanNext') || {}).value || '1',
                challan_pad: (document.getElementById('egsChallanPad') || {}).value || '4',
              },
            });
            if (window.showToast) window.showToast('Challan settings saved');
          } catch (err) {
            window.openModal('Save failed', `<p>${(err && err.message) || 'Could not save settings.'}</p>`);
          }
        });
      }
    }, 0);
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

  function updateProfileBox(username, role) {
    const roleEl = document.querySelector('.profile-box .role');
    const userEl = document.querySelector('.profile-box .user');
    const av = document.querySelector('.profile-box .avatar');
    if (roleEl) roleEl.textContent = role || '';
    if (userEl) userEl.textContent = username ? '@' + username : '';
    if (av && username) av.textContent = (username[0] || '?').toUpperCase();
  }

  async function switchToAccount(acc) {
    closeProfileMenu();
    if (!acc || !acc.token) return;
    // Activate saved token locally (no password) — Instagram-style quick switch
    saveSession(acc.username, acc.role, true, acc.token);
    updateProfileBox(acc.username, acc.role);
    if (window.showToast) window.showToast('Switched to @' + acc.username);
    // Soft reload current page data
    try {
      const hash = (location.hash || '#dashboard').replace(/^#/, '') || 'dashboard';
      if (typeof go === 'function') go(hash);
    } catch (e) { location.reload(); }
  }

  async function openLoginActivityPanel() {
    closeProfileMenu();
    let data;
    try {
      data = await window.Api.get('/auth/my-sessions');
    } catch (e) {
      window.openModal('Login activity', `<p class="note" style="color:var(--red);">${(e && e.message) || 'Could not load sessions.'}</p>`);
      return;
    }
    const sessions = (data && data.sessions) || [];
    const active = sessions.filter((s) => !s.revoked);
    const rows = active.length ? active.map((s) => {
      const when = s.lastSeen ? String(s.lastSeen).replace('T', ' ').slice(0, 16) : '—';
      const badge = s.isCurrent ? '<span class="sess-badge current">This device</span>' : '';
      const btn = s.isCurrent
        ? ''
        : `<button type="button" class="btn btn-ghost bom-mini-btn" data-revoke-id="${s.id}"><i class="fa-solid fa-right-from-bracket"></i> Log out</button>`;
      return `<div class="sess-row">
        <div class="sess-icon"><i class="fa-solid fa-desktop"></i></div>
        <div class="sess-meta">
          <div class="sess-title">${s.deviceLabel || 'Device'} ${badge}</div>
          <div class="sess-sub">Last active ${when}${s.ip ? ' · ' + s.ip : ''}</div>
        </div>
        <div class="sess-actions">${btn}</div>
      </div>`;
    }).join('') : '<p class="note">No active sessions.</p>';

    window.openModal('Login activity', `
      <p class="note" style="margin-top:0;">Where you're logged in — log out any device you don't recognise.</p>
      <div class="sess-list">${rows}</div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="btn btn-ghost" id="sessRevokeOthers"><i class="fa-solid fa-shield-halved"></i> Log out other devices</button>
      </div>
    `);

    const body = document.getElementById('modalBody');
    if (!body) return;
    body.querySelectorAll('[data-revoke-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-revoke-id');
        try {
          await window.Api.post('/auth/sessions/' + id + '/revoke', {});
          if (window.showToast) window.showToast('Device logged out');
          openLoginActivityPanel();
        } catch (e) {
          window.openModal('Error', `<p>${(e && e.message) || 'Failed'}</p>`);
        }
      });
    });
    const others = body.querySelector('#sessRevokeOthers');
    if (others) {
      others.addEventListener('click', async () => {
        const ok = await window.confirmDialog('Log out other devices', 'All other devices will be signed out. This device stays logged in.', { kind: 'warning', okLabel: 'Log out others' });
        if (!ok) return;
        try {
          await window.Api.post('/auth/sessions/revoke-others', {});
          if (window.showToast) window.showToast('Other devices logged out');
          openLoginActivityPanel();
        } catch (e) {
          window.openModal('Error', `<p>${(e && e.message) || 'Failed'}</p>`);
        }
      });
    }
  }

  function openAppSettingsPanel() {
    closeProfileMenu();
    const activeTheme = (typeof window.getAppTheme === 'function') ? window.getAppTheme() : 'dark';
    const settingsHtml = `
      <div class="settings-layout">
        <div class="settings-tabs">
          <button type="button" class="settings-tab-btn active" data-tab="tab-theme"><i class="fa-solid fa-palette"></i> Appearance</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-company"><i class="fa-solid fa-building"></i> Company Profile</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-challan"><i class="fa-solid fa-file-invoice"></i> Challan & Print</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-inventory"><i class="fa-solid fa-boxes-stacked"></i> Alerts & Inventory</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-security"><i class="fa-solid fa-shield-halved"></i> Security & 2FA</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-roadmap"><i class="fa-solid fa-rocket"></i> Cloud Roadmap</button>
        </div>

        <!-- 1. Appearance Tab -->
        <div class="settings-panel active" id="tab-theme">
          <div class="settings-card">
            <div class="settings-card-title">Theme & Color Mode</div>
            <p class="note" style="margin:0 0 12px 0;">Select your preferred workspace color theme.</p>
            <div class="profile-theme-row" style="max-width:320px;">
              <button type="button" class="theme-btn${activeTheme === 'dark' ? ' active' : ''}" data-theme-set="dark" title="Dark"><i class="fa-solid fa-moon"></i> Dark</button>
              <button type="button" class="theme-btn${activeTheme === 'gray' ? ' active' : ''}" data-theme-set="gray" title="Gray"><i class="fa-solid fa-circle-half-stroke"></i> Gray</button>
              <button type="button" class="theme-btn${activeTheme === 'light' ? ' active' : ''}" data-theme-set="light" title="Light"><i class="fa-solid fa-sun"></i> Light</button>
            </div>
          </div>
          <div class="settings-card">
            <div class="settings-card-title">Display Density & Animation</div>
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:8px;">
              <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                <input type="checkbox" checked style="accent-color:var(--gold);">
                <span>Smooth UI Animations & Transitions</span>
              </label>
              <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                <input type="checkbox" style="accent-color:var(--gold);">
                <span>Compact Table Row Density (High Information Density)</span>
              </label>
            </div>
          </div>
        </div>

        <!-- 2. Company Profile Tab -->
        <div class="settings-panel" id="tab-company">
          <div class="settings-card">
            <div class="settings-card-title">Enterprise Identity</div>
            <div class="form-grid cols-2" style="margin-top:10px;">
              <div class="field">
                <label>Company Name</label>
                <input type="text" value="Eco Green Solar" readonly style="font-weight:700; color:var(--gold);">
              </div>
              <div class="field">
                <label>Default Warehouse Hub</label>
                <input type="text" value="Main Warehouse (Surat)" readonly>
              </div>
              <div class="field">
                <label>Operating State & City</label>
                <input type="text" value="Gujarat — Surat" readonly>
              </div>
              <div class="field">
                <label>Default Currency</label>
                <input type="text" value="INR (₹)" readonly>
              </div>
            </div>
          </div>
          <div class="settings-card">
            <div class="settings-card-title">System Attribution</div>
            <p style="margin:0; font-size:13px; color:var(--txt-muted);">
              Eco Green Solar ERP Suite • Developed by <strong style="color:var(--gold);">Sumit Chauhan</strong>
            </p>
          </div>
        </div>

        <!-- 3. Challan & Print Config Tab -->
        <div class="settings-panel" id="tab-challan">
          <div class="settings-card">
            <div class="settings-card-title">Challan PDF Generation</div>
            <div class="form-grid cols-2" style="margin-top:10px;">
              <div class="field">
                <label>Default Layout</label>
                <input type="text" value="Landscape A4 (Customer + Company Copy)" readonly>
              </div>
              <div class="field">
                <label>Numbering System</label>
                <input type="text" value="Automatic Sequential (Auto Next-No)" readonly style="color:#2ecc71; font-weight:700;">
              </div>
            </div>
          </div>
          <div class="settings-card">
            <div class="settings-card-title">Sales Integration</div>
            <p style="margin:0 0 10px 0; font-size:13px; color:var(--txt-muted);">
              When a Challan is saved or generated, Challan No. and Date automatically sync back into the Project Sales entry.
            </p>
            <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
              <input type="checkbox" checked disabled style="accent-color:var(--gold);">
              <span>Auto-link Challan No. to Project Sales Form</span>
            </label>
          </div>
        </div>

        <!-- 4. Alerts & Inventory Tab -->
        <div class="settings-panel" id="tab-inventory">
          <div class="settings-card">
            <div class="settings-card-title">Stock Thresholds & Scanner</div>
            <div class="form-grid cols-2" style="margin-top:10px;">
              <div class="field">
                <label>Low Stock Warning Threshold</label>
                <input type="text" value="5 Units" readonly>
              </div>
              <div class="field">
                <label>Scan Sheet Audio Feedback</label>
                <input type="text" value="Beep on Valid Serial" readonly style="color:#2ecc71;">
              </div>
            </div>
          </div>
          <div class="settings-card">
            <div class="settings-card-title">
              <span>Automated Dispatch Alerts</span>
              <span class="settings-badge-soon">Coming Soon</span>
            </div>
            <p style="margin:0 0 10px 0; font-size:13px; color:var(--txt-muted);">
              Instant SMS and WhatsApp notifications sent to customers upon stock dispatch.
            </p>
            <div style="display:flex; gap:16px; opacity:0.6;">
              <label><input type="checkbox" disabled> WhatsApp Notification</label>
              <label><input type="checkbox" disabled> Email Dispatch Summary</label>
            </div>
          </div>
        </div>

        <!-- 5. Security & 2FA Tab -->
        <div class="settings-panel" id="tab-security">
          <div class="settings-card">
            <div class="settings-card-title">Two-Factor Authentication (2FA)</div>
            <p style="margin:0 0 12px 0; font-size:13px; color:var(--txt-muted);">
              Secure OTP verification enabled on unrecognized devices and login sessions.
            </p>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="pill" style="background:rgba(46,204,113,0.15); color:#2ecc71; border:1px solid rgba(46,204,113,0.3); padding:4px 10px; border-radius:6px; font-weight:700;">
                <i class="fa-solid fa-lock"></i> OTP 2FA Active
              </span>
            </div>
          </div>
          <div class="settings-card">
            <div class="settings-card-title">Active Devices & Sessions</div>
            <p style="margin:0 0 12px 0; font-size:13px; color:var(--txt-muted);">
              View all active browsers and revoke sessions across devices.
            </p>
            <button type="button" class="btn btn-ghost" id="setOpenLoginActivityBtn" style="font-size:12.5px;">
              <i class="fa-solid fa-mobile-screen-button"></i> Open Login Activity Panel
            </button>
          </div>
        </div>

        <!-- 6. Roadmap Tab -->
        <div class="settings-panel" id="tab-roadmap">
          <div class="settings-card">
            <div class="settings-card-title">
              <span><i class="fa-solid fa-sun" style="color:var(--gold);"></i> PM Surya Ghar National Portal Sync</span>
              <span class="settings-badge-planned">Planned Q4</span>
            </div>
            <p style="margin:0; font-size:13px; color:var(--txt-muted);">
              Direct API integration with the National Portal for automated consumer subsidy verification and project milestone uploads.
            </p>
          </div>
          <div class="settings-card">
            <div class="settings-card-title">
              <span><i class="fa-solid fa-network-wired" style="color:var(--blue);"></i> Multi-Branch Live Cloud Sync</span>
              <span class="settings-badge-soon">Coming Soon</span>
            </div>
            <p style="margin:0; font-size:13px; color:var(--txt-muted);">
              Seamless inter-branch stock transfers with automatic GST delivery challan generation between warehouses.
            </p>
          </div>
          <div class="settings-card">
            <div class="settings-card-title">
              <span><i class="fa-solid fa-file-invoice-dollar" style="color:#2ecc71;"></i> Tally Prime / Busy Accounting Bridge</span>
              <span class="settings-badge-soon">Coming Soon</span>
            </div>
            <p style="margin:0; font-size:13px; color:var(--txt-muted);">
              1-click XML ledger sync directly into Tally Prime and Busy Accounting software.
            </p>
          </div>
        </div>
      </div>
    `;

    window.openModal('System & ERP Settings', settingsHtml, { size: 'large' });

    // Wire Settings Tabs
    const tabBtns = document.querySelectorAll('.settings-tab-btn');
    const panels = document.querySelectorAll('.settings-panel');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        tabBtns.forEach((b) => b.classList.remove('active'));
        panels.forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        const p = document.getElementById(targetId);
        if (p) p.classList.add('active');
      });
    });

    // Wire Theme buttons inside Settings
    const modalBox = document.querySelector('#modalOverlay .modal-box');
    if (modalBox && window.wireThemeButtons) window.wireThemeButtons(modalBox);

    const loginActBtn = document.getElementById('setOpenLoginActivityBtn');
    if (loginActBtn) {
      loginActBtn.addEventListener('click', () => {
        window.closeModal();
        openLoginActivityPanel();
      });
    }
  }

  function openProfileMenu() {
    closeProfileMenu();
    const roleEl = document.querySelector('.profile-box .role');
    const userEl = document.querySelector('.profile-box .user');
    const roleTxt = roleEl ? roleEl.textContent : (window.currentRole || '');
    const userTxt = userEl ? userEl.textContent : ('@' + (window.currentUsername || 'user'));
    const currentUser = (window.currentUsername || '').toLowerCase();
    const accounts = loadSavedAccounts();

    const accountRows = accounts.map((a) => {
      const isCur = a.username.toLowerCase() === currentUser;
      return `<button type="button" class="profile-account-row${isCur ? ' current' : ''}" data-switch-user="${a.username}">
        <span class="pa-avatar">${(a.username[0] || '?').toUpperCase()}</span>
        <span class="pa-meta">
          <span class="pa-name">@${a.username}</span>
          <span class="pa-role">${a.role || ''}${isCur ? ' · Active' : ''}</span>
        </span>
        ${isCur ? '<i class="fa-solid fa-check pa-check"></i>' : ''}
      </button>`;
    }).join('');

    const menu = document.createElement('div');
    menu.className = 'profile-menu profile-menu-wide';
    menu.innerHTML = `
      <div class="profile-menu-header">
        <div class="name">${userTxt}</div>
        <div class="role">${roleTxt}</div>
      </div>
      <div class="profile-menu-section-label">Accounts</div>
      <div class="profile-accounts">${accountRows || '<p class="note" style="padding:8px 12px;margin:0;">No saved accounts yet</p>'}</div>
      <button type="button" class="profile-menu-item" id="profileAddAccount"><i class="fa-solid fa-user-plus"></i> Add account</button>
      <div class="profile-menu-divider"></div>
      <div class="profile-menu-section-label">Theme</div>
      <div class="profile-theme-row">
        <button type="button" class="theme-btn" data-theme-set="dark" title="Dark"><i class="fa-solid fa-moon"></i> Dark</button>
        <button type="button" class="theme-btn" data-theme-set="gray" title="Gray"><i class="fa-solid fa-circle-half-stroke"></i> Gray</button>
        <button type="button" class="theme-btn" data-theme-set="light" title="Light"><i class="fa-solid fa-sun"></i> Light</button>
      </div>
      <div class="profile-menu-divider"></div>
      <button type="button" class="profile-menu-item" id="profileSettings"><i class="fa-solid fa-gear"></i> System Settings</button>
      <button type="button" class="profile-menu-item" id="profileLoginActivity"><i class="fa-solid fa-mobile-screen-button"></i> Login activity</button>
      <button type="button" class="profile-menu-item danger" id="profileLogout"><i class="fa-solid fa-right-from-bracket"></i> Log out</button>`;
    document.body.appendChild(menu);

    const rect = profileBox.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    menu.style.left = Math.max(10, rect.left) + 'px';
    menu.style.top = Math.max(10, rect.top - menuRect.height - 8) + 'px';
    profileMenuEl = menu;
    if (window.wireThemeButtons) window.wireThemeButtons(menu);
    if (window.getAppTheme) {
      menu.querySelectorAll('[data-theme-set]').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-theme-set') === window.getAppTheme());
      });
    }

    menu.querySelectorAll('[data-switch-user]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uname = btn.getAttribute('data-switch-user');
        const acc = accounts.find((a) => a.username === uname);
        if (acc && acc.username.toLowerCase() !== currentUser) switchToAccount(acc);
        else closeProfileMenu();
      });
    });

    menu.querySelector('#profileAddAccount').addEventListener('click', () => {
      closeProfileMenu();
      clearSession();
      showLoginOverlay('Add another account — your previous account stays saved for switching.');
    });

    const settingsBtn = menu.querySelector('#profileSettings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        closeProfileMenu();
        openAppSettingsPanel();
      });
    }

    menu.querySelector('#profileLoginActivity').addEventListener('click', () => openLoginActivityPanel());

    menu.querySelector('#profileLogout').addEventListener('click', async () => {
      closeProfileMenu();
      const ok = await window.confirmDialog('Log out', 'Log out of this device?', { kind: 'question', okLabel: 'Log out' });
      if (!ok) return;
      const u = window.currentUsername;
      await notifyServerLogout();
      clearSession();
      // Keep account in switcher list (token cleared for this session only) — remove token so dead session isn't reusable
      if (u) {
        const list = loadSavedAccounts().map((a) => a.username === u ? { ...a, token: '' } : a).filter((a) => a.token);
        persistSavedAccounts(list);
      }
      showLoginOverlay();
    });
    menu.addEventListener('click', (e) => e.stopPropagation());
  }

  function toggleProfileMenu(e) {
    if (e) e.stopPropagation();
    if (profileMenuEl) closeProfileMenu();
    else openProfileMenu();
  }
  if (profileBox) {
    profileBox.addEventListener('click', toggleProfileMenu);
  }
  // Mobile topbar avatar — same menu as sidebar profile
  const mobileAvatar = document.getElementById('mobileProfileAvatar');
  if (mobileAvatar) {
    mobileAvatar.addEventListener('click', toggleProfileMenu);
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

    // Trigger smooth page transition animation
    content.classList.remove('page-entering');
    void content.offsetWidth; // force reflow
    content.innerHTML = page.html;
    content.classList.add('page-entering');

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

    // Auto-remove page-entering class after animation completes
    setTimeout(() => {
      content.classList.remove('page-entering');
    }, 400);

    // Remember which page is open by writing it into the URL hash (e.g.
    // "#sales"). On a refresh/reopen, the startup code below reads this
    // hash to restore the same page instead of always falling back to
    // Dashboard. history.replaceState (not pushState) so navigating
    // between tabs doesn't pile up entries in the browser's Back history.
    try {
      const newHash = `#${id}`;
      if (window.location.hash !== newHash) {
        history.replaceState(null, '', newHash);
      }
    } catch (e) { /* ignore (e.g. sandboxed iframe) */ }
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
  window.openModal = function (title, bodyHtml, opts) {
    opts = opts || {};
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    const box = document.querySelector('#modalOverlay .modal-box');
    if (box) {
      box.classList.remove('modal-box-wide', 'modal-box-xl');
      if (opts.size === 'xl') {
        box.classList.add('modal-box-xl');
      } else if (opts.size === 'large' || opts.size === 'wide' || opts.wide) {
        box.classList.add('modal-box-wide');
      }
    }
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
    const msgEl = document.getElementById('confirmMsg');
    msgEl.innerHTML = message || '';
    // Safety net: even if some caller passes long content without its own
    // scrollList()-style wrapper, the dialog itself never grows past this —
    // it scrolls internally instead of stretching the whole card/page.
    msgEl.style.maxHeight = '55vh';
    msgEl.style.overflowY = 'auto';
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
    // Show the app immediately — no network round-trip here, so a valid
    // saved session never flashes the login form before the dashboard
    // appears. If this token actually IS dead (server restarted since it
    // was issued), the dashboard's own background API calls will get a
    // real 401 within a moment, and the fetch wrapper + session-expired
    // handler above (see top of file) will cleanly drop back to login —
    // this is the correct, honest way to discover an expired session,
    // instead of blocking every single reload on an extra round-trip.
    window.currentAuthToken = restoredSession.token;
    updateProfileDisplay(restoredSession.username, restoredSession.role);
    showApp();
    startHeartbeat(); applyUserPreferencesFromServer();
    resetIdleTimer();
  } else {
    showLoginOverlay();
  }

  // Only load a page when a session exists. If still on login, finishLogin
  // will call go() after the token is saved (avoids first paint of all zeros).
  if (restoredSession) {
    const startPageId = (window.location.hash || '').replace('#', '');
    go(window.PAGES[startPageId] ? startPageId : 'dashboard');
  }

  // Also react to Back/Forward browser buttons and manual hash edits, so
  // the visible page always matches the URL hash, not just on first load.
  window.addEventListener('hashchange', () => {
    const id = (window.location.hash || '').replace('#', '');
    if (window.PAGES[id]) go(id);
  });

  // Footer credit line — always show the current year, no manual updates needed.
  const footerYearEl = document.getElementById('footerYear');
  if (footerYearEl) footerYearEl.textContent = new Date().getFullYear();

  // ---------- Global anti-autofill guard (everywhere EXCEPT the login screen) ----------
  // Chrome/Edge keep trying to pour a saved credential (e.g. "superadmin")
  // into whichever plain text input happens to be first/empty on the page —
  // first the quick-search box, then, once that was blocked, the first
  // empty text field on the currently open page (e.g. BOM's "Challan No.").
  // Fix: every real input on every app page starts as readonly, so the
  // browser has nothing it's allowed to write into. The moment a person
  // actually clicks/taps/tabs into a field, readonly is removed so typing
  // works completely normally; if they leave it empty again, it goes back
  // to readonly so a later autofill pass still can't touch it. This never
  // runs inside .login-overlay — Sign In / Register / Forgot Password keep
  // normal autocomplete so saved passwords still work there as intended.
  const AUTOFILL_GUARD_SELECTOR =
    'input[type="text"], input[type="search"], input[type="email"], ' +
    'input[type="tel"], input[type="number"], input[type="url"], ' +
    'input[type="date"], input[type="datetime-local"], input[type="month"], ' +
    'input:not([type])';

  function guardField(el) {
    if (!el || el.dataset.egsGuarded === '1') return;
    if (el.closest('.login-overlay')) return; // login/register/OTP/reset stay untouched
    // Scan Sheet's own barcode/text scan fields manage their own anti-autofill
    // readonly state (see js/pages/scansheet.js). They must stay writable
    // while empty and focused so a Bluetooth/USB (keyboard-wedge) scanner can
    // type a code into them — this global guard's blur handler would
    // re-lock them to readonly the moment they blur while still empty
    // (e.g. while pairing/aiming the scanner), silently breaking every
    // Bluetooth scan since a readonly field can't receive the scanned
    // characters. So skip them here entirely.
    if (el.matches && el.matches('input[data-type="barcode"], input[data-type="text"]') && el.closest('.ss-wrap')) return;
    el.dataset.egsGuarded = '1';
    if (!el.value) el.setAttribute('readonly', 'readonly');
    el.addEventListener('focus', () => el.removeAttribute('readonly'));
    el.addEventListener('mousedown', () => el.removeAttribute('readonly'));
    el.addEventListener('touchstart', () => el.removeAttribute('readonly'));
    el.addEventListener('blur', () => {
      if (!el.value) el.setAttribute('readonly', 'readonly');
    });
  }

  function guardAllFields(root) {
    if (!root || root.closest && root.closest('.login-overlay')) return;
    if (root.matches && root.matches(AUTOFILL_GUARD_SELECTOR)) guardField(root);
    if (root.querySelectorAll) {
      root.querySelectorAll(AUTOFILL_GUARD_SELECTOR).forEach(guardField);
    }
  }

  // Cover everything already on the page (dashboard, topbar, etc.)
  guardAllFields(document.body);

  // Cover every page swap (BOM, Sales, Purchase, Masters...) and modal opens,
  // since js/pages/*.js inject their HTML via innerHTML at runtime.
  const autofillObserver = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 1) guardAllFields(node);
      });
    });
  });
  autofillObserver.observe(document.body, { childList: true, subtree: true });
})();

// =================== Custom date picker (replaces native boring calendar) ===================
(function () {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  function pad(n) { return String(n).padStart(2, '0'); }
  function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseISO(s) {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  function startOfToday() {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }
  function formatDisplay(iso) {
    const d = parseISO(iso);
    if (!d) return '';
    return pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear();
  }

  function enhanceDateInput(native) {
    if (!native || native.dataset.egsDp === '1') return;
    if (native.closest('.login-overlay')) return;
    native.dataset.egsDp = '1';

    const wrap = document.createElement('div');
    wrap.className = 'egs-dp-wrap';
    native.parentNode.insertBefore(wrap, native);
    wrap.appendChild(native);
    native.style.position = 'absolute';
    native.style.opacity = '0';
    native.style.pointerEvents = 'none';
    native.style.width = '1px';
    native.style.height = '1px';
    native.tabIndex = -1;

    const display = document.createElement('input');
    display.type = 'text';
    display.className = 'egs-dp-input';
    display.readOnly = true;
    display.placeholder = native.placeholder || 'dd-mm-yyyy';
    display.autocomplete = 'off';
    if (native.value) display.value = formatDisplay(native.value);
    else {
      // default today when empty on first enhance (optional — only if data-default-today)
      if (native.dataset.defaultToday === '1' || native.id === 'bomChallanDate') {
        const iso = toISO(startOfToday());
        native.value = iso;
        display.value = formatDisplay(iso);
      }
    }
    wrap.appendChild(display);

    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-calendar-days egs-dp-icon';
    wrap.appendChild(icon);

    let pop = null;
    let view = parseISO(native.value) || startOfToday();

    function closePop() {
      if (pop) { pop.remove(); pop = null; }
      document.removeEventListener('mousedown', onDocDown, true);
    }
    function onDocDown(e) {
      if (pop && !pop.contains(e.target) && !wrap.contains(e.target)) closePop();
    }

    function renderPop() {
      closePop();
      pop = document.createElement('div');
      pop.className = 'egs-dp-pop';
      const y = view.getFullYear();
      const m = view.getMonth();
      const first = new Date(y, m, 1);
      const startPad = first.getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const selected = native.value;
      const todayIso = toISO(startOfToday());

      let cells = DOW.map((d) => `<div class="egs-dp-dow">${d}</div>`).join('');
      for (let i = 0; i < startPad; i++) cells += `<button type="button" class="egs-dp-day muted" disabled></button>`;
      for (let day = 1; day <= daysInMonth; day++) {
        const iso = y + '-' + pad(m + 1) + '-' + pad(day);
        const isFuture = iso > todayIso;
        const cls = ['egs-dp-day'];
        if (iso === selected) cls.push('selected');
        if (iso === todayIso) cls.push('today');
        if (isFuture) cls.push('future-warn');
        cells += `<button type="button" class="${cls.join(' ')}" data-iso="${iso}">${day}</button>`;
      }

      pop.innerHTML = `
        <div class="egs-dp-head">
          <button type="button" data-nav="-1" aria-label="Previous month"><i class="fa-solid fa-chevron-left"></i></button>
          <div class="egs-dp-title">${MONTHS[m]} ${y}</div>
          <button type="button" data-nav="1" aria-label="Next month"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <div class="egs-dp-grid">${cells}</div>
        <div class="egs-dp-foot">
          <button type="button" class="btn btn-ghost" data-today>Today</button>
          <button type="button" class="btn btn-ghost" data-clear>Clear</button>
        </div>`;
      wrap.appendChild(pop);
      document.addEventListener('mousedown', onDocDown, true);

      pop.querySelectorAll('[data-nav]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const delta = Number(btn.getAttribute('data-nav'));
          view = new Date(view.getFullYear(), view.getMonth() + delta, 1);
          renderPop();
        });
      });
      pop.querySelectorAll('.egs-dp-day[data-iso]').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          const iso = btn.getAttribute('data-iso');
          if (iso > todayIso) {
            const ok = await window.confirmDialog(
              'Future date',
              'You selected a <b>future date</b>. Continue with this date?',
              { kind: 'warning', okLabel: 'Use date', cancelLabel: 'Cancel' }
            );
            if (!ok) return;
          }
          native.value = iso;
          display.value = formatDisplay(iso);
          native.dispatchEvent(new Event('change', { bubbles: true }));
          native.dispatchEvent(new Event('input', { bubbles: true }));
          closePop();
        });
      });
      const tBtn = pop.querySelector('[data-today]');
      if (tBtn) tBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const iso = todayIso;
        native.value = iso;
        display.value = formatDisplay(iso);
        view = startOfToday();
        native.dispatchEvent(new Event('change', { bubbles: true }));
        closePop();
      });
      const cBtn = pop.querySelector('[data-clear]');
      if (cBtn) cBtn.addEventListener('click', (e) => {
        e.preventDefault();
        native.value = '';
        display.value = '';
        native.dispatchEvent(new Event('change', { bubbles: true }));
        closePop();
      });
    }

    function open() {
      view = parseISO(native.value) || startOfToday();
      renderPop();
    }
    display.addEventListener('click', open);
    display.addEventListener('focus', open);
  }

  function scan(root) {
    (root || document).querySelectorAll('input[type="date"]').forEach(enhanceDateInput);
  }

  window.egsInitDatePickers = scan;

  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes && m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.matches && n.matches('input[type="date"]')) enhanceDateInput(n);
        if (n.querySelectorAll) n.querySelectorAll('input[type="date"]').forEach(enhanceDateInput);
      });
    }
  });
  if (document.body) {
    mo.observe(document.body, { childList: true, subtree: true });
    scan(document);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      mo.observe(document.body, { childList: true, subtree: true });
      scan(document);
    });
  }
})();
