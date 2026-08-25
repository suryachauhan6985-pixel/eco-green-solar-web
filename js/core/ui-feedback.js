// js/core/ui-feedback.js
// Core UI Feedback Engine: Loaders, Toasts, Popups, Modals, Date Picker & Table Filters

(function () {
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
// GLOBAL ERP OPERATING MODE ENGINE & CONFIG CACHE
// ---------------------------------------------------------------------------
window.ERP_CONFIG = window.ERP_CONFIG || {
  erp_mode: 'hybrid',
  feature_bom_enabled: '1',
  feature_pricing_enabled: '1',
  feature_warehouse_enabled: '1',
  feature_pallet_enabled: '1',
  feature_attachment_mandatory: '0',
  feature_wattage_mandatory: 'auto',
  nav_style: 'both'
};

window.ERP = {
  getMode() { return (window.CONFIG && window.CONFIG.get('config_profile')) || 'full_erp'; },
  isSerialEnabled() { return window.CONFIG ? window.CONFIG.isSerialTrackingEnabled() : true; },
  isQuantityOnly() { return !this.isSerialEnabled(); },
  isAccountingMode() { return window.CONFIG ? window.CONFIG.isAccountingEnabled() : true; },
  isAccountsOnly() { return !this.isSerialEnabled() && this.isAccountingMode() && (window.CONFIG && window.CONFIG.get('inventory_tracking') === '0'); },
  isFinancialOnly() { return this.isAccountsOnly(); },
  isBomEnabled() { return window.CONFIG ? window.CONFIG.isBomEnabled() : true; },
  isPricingEnabled() { return window.CONFIG ? (window.CONFIG.get('feature_pricing_enabled') !== '0') : true; },
  isWarehouseEnabled() { return window.CONFIG ? window.CONFIG.isWarehouseTrackingEnabled() : true; },
  isPalletEnabled() { return window.CONFIG ? (window.CONFIG.get('feature_pallet_enabled') !== '0') : true; },
  isProofMandatory() { return window.CONFIG ? (window.CONFIG.get('feature_attachment_mandatory') === '1') : false; }
};

window.debounce = function(fn, delayMs = 150) {
  let timer = null;
  return function(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delayMs);
  };
};

window.throttle = function(fn, limitMs = 100) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= limitMs) {
      lastCall = now;
      fn.apply(this, args);
    }
  };
};

// ---------------------------------------------------------------------------
// GLOBAL COMPONENT: SMART SAVED VIEWS & FILTER PRESETS BAR
// ---------------------------------------------------------------------------
window.initSavedViewsBar = function(containerEl, config) {
  if (!containerEl || !config) return null;
  const { pageKey, defaultPresets = [], onApply, getCurrentState } = config;
  const storageKey = `egs_saved_views_${pageKey}`;

  function getCustomViews() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveCustomViews(views) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(views));
    } catch (e) {}
  }

  let activeViewId = defaultPresets[0] ? defaultPresets[0].id : 'all';

  function render() {
    const customViews = getCustomViews();
    const allViews = [...defaultPresets, ...customViews];

    containerEl.innerHTML = `
      <div class="saved-views-bar">
        <div class="saved-views-label"><i class="fa-solid fa-bolt" style="color:var(--gold);"></i> Quick Views:</div>
        <div class="saved-views-pills">
          ${allViews.map(v => `
            <div class="view-pill ${v.id === activeViewId ? 'active' : ''}" data-view-id="${v.id}" title="${v.label}">
              <span>${v.label}</span>
              ${v.isCustom ? `<span class="view-pill-del" data-del-id="${v.id}" title="Delete View"><i class="fa-solid fa-xmark"></i></span>` : ''}
            </div>
          `).join('')}
        </div>
        <button type="button" class="btn btn-ghost btn-save-view" style="font-size:11.5px; padding:3px 8px;" title="Save current filter configuration">
          <i class="fa-solid fa-bookmark" style="color:var(--blue);"></i> Save View
        </button>
      </div>
    `;

    // Click on view pills
    containerEl.querySelectorAll('.view-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        if (e.target.closest('.view-pill-del')) return;
        const viewId = pill.getAttribute('data-view-id');
        const view = allViews.find(v => v.id === viewId);
        if (view) {
          activeViewId = viewId;
          render();
          if (typeof onApply === 'function') onApply(view.state || {});
        }
      });
    });

    // Delete custom view pill
    containerEl.querySelectorAll('.view-pill-del').forEach(delBtn => {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const delId = delBtn.getAttribute('data-del-id');
        const updated = getCustomViews().filter(v => v.id !== delId);
        saveCustomViews(updated);
        if (activeViewId === delId) activeViewId = defaultPresets[0] ? defaultPresets[0].id : 'all';
        render();
        if (window.showToast) window.showToast('Custom view removed.');
      });
    });

    // Save view button
    const btnSave = containerEl.querySelector('.btn-save-view');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const viewName = prompt('Enter a name for this custom view (e.g. "Tata 545W Inward"):');
        if (!viewName || !viewName.trim()) return;
        const state = typeof getCurrentState === 'function' ? getCurrentState() : {};
        const customViews = getCustomViews();
        const newView = {
          id: 'custom_' + Date.now(),
          label: viewName.trim(),
          isCustom: true,
          state
        };
        customViews.push(newView);
        saveCustomViews(customViews);
        activeViewId = newView.id;
        render();
        if (window.showToast) window.showToast(`View "${viewName.trim()}" saved!`);
      });
    }
  }

  render();
  return {
    setActive(id) {
      activeViewId = id;
      render();
    }
  };
};

// ---------------------------------------------------------------------------
// GLOBAL COMPONENT: BULK ACTIONS FLOATING TOOLBAR
// ---------------------------------------------------------------------------
window.initBulkActionsBar = function(containerEl, config) {
  if (!containerEl || !config) return null;
  const { onExport, onPrint, onCopy, onClear, getSelectedData } = config;

  containerEl.innerHTML = `
    <div class="bulk-actions-bar" style="display:none;">
      <div class="bulk-count">
        <i class="fa-solid fa-circle-check" style="color:var(--green);"></i>
        <span><strong class="bulk-count-num">0</strong> items selected</span>
      </div>
      <div class="bulk-btn-group">
        ${onExport ? `<button type="button" class="btn btn-blue btn-bulk-export" style="font-size:12px; padding:4px 10px;"><i class="fa-solid fa-file-excel"></i> Export Selected</button>` : ''}
        ${onPrint ? `<button type="button" class="print-btn btn-bulk-print" style="height:30px; padding:0 10px; font-size:11.5px;">
          <span class="printer-wrapper">
            <span class="printer-container">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 92 75">
                <path stroke-width="5" stroke="currentColor" d="M12 37.5H80C85.2467 37.5 89.5 41.7533 89.5 47V69C89.5 70.933 87.933 72.5 86 72.5H6C4.067 72.5 2.5 70.933 2.5 69V47C2.5 41.7533 6.75329 37.5 12 37.5Z"></path>
                <path fill="currentColor" d="M12 12C12 5.37258 17.3726 0 24 0H57C70.2548 0 81 10.7452 81 24V29H12V12Z"></path>
                <circle fill="currentColor" r="3" cy="49" cx="78"></circle>
              </svg>
            </span>
            <span class="printer-page-wrapper">
              <span class="printer-page"></span>
            </span>
          </span>
          <span>Print</span>
        </button>` : ''}
        ${onCopy ? `<button type="button" class="btn btn-ghost btn-bulk-copy" style="font-size:12px; padding:4px 10px;"><i class="fa-solid fa-copy"></i> Copy Selected</button>` : ''}
        ${onClear ? `<button type="button" class="btn btn-ghost btn-bulk-clear" style="font-size:12px; padding:4px 10px;"><i class="fa-solid fa-xmark"></i> Deselect</button>` : ''}
      </div>
    </div>
  `;

  const barEl = containerEl.querySelector('.bulk-actions-bar');
  const countEl = containerEl.querySelector('.bulk-count-num');

  const btnExport = containerEl.querySelector('.btn-bulk-export');
  if (btnExport && onExport) btnExport.addEventListener('click', () => onExport(getSelectedData ? getSelectedData() : []));

  const btnPrint = containerEl.querySelector('.btn-bulk-print');
  if (btnPrint && onPrint) btnPrint.addEventListener('click', () => onPrint(getSelectedData ? getSelectedData() : []));

  const btnCopy = containerEl.querySelector('.btn-bulk-copy');
  if (btnCopy && onCopy) btnCopy.addEventListener('click', () => onCopy(getSelectedData ? getSelectedData() : []));

  const btnClear = containerEl.querySelector('.btn-bulk-clear');
  if (btnClear && onClear) btnClear.addEventListener('click', () => onClear());

  return {
    update(selectedCount) {
      if (selectedCount > 0) {
        if (countEl) countEl.textContent = selectedCount;
        if (barEl) barEl.style.display = 'flex';
      } else {
        if (barEl) barEl.style.display = 'none';
      }
    },
    hide() {
      if (barEl) barEl.style.display = 'none';
    }
  };
};

window.showLoader = function showLoader(title, sub, forceOverlay = false) {
  __egsLoaderCount++;
  
  // Cancel pending completion if another call fires (cascading batching)
  if (__egsLoaderEndTimer) {
    clearTimeout(__egsLoaderEndTimer);
    __egsLoaderEndTimer = null;
  }

  // 1. Unidirectional Top Micro-Progress Bar (Single sweep across batched calls)
  topProgress.start();

  // 2. Full-Screen Overlay (ONLY for explicit titled actions or long-running operations)
  const el = document.getElementById('loaderOverlay');
  if (!el) return;

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
    if (__egsLoaderTimer) { clearTimeout(__egsLoaderTimer); __egsLoaderTimer = null; }
    el.classList.add('active');
  } else if (forceOverlay) {
    textWrap.innerHTML = '';
    textWrap.style.display = 'none';
    if (__egsLoaderTimer) { clearTimeout(__egsLoaderTimer); __egsLoaderTimer = null; }
    el.classList.add('active');
  } else {
    textWrap.innerHTML = '';
    textWrap.style.display = 'none';
  }
};

window.hideLoader = function hideLoader(force) {
  if (force) __egsLoaderCount = 0;
  else __egsLoaderCount = Math.max(0, __egsLoaderCount - 1);

  if (__egsLoaderCount === 0) {
    if (__egsLoaderTimer) {
      clearTimeout(__egsLoaderTimer);
      __egsLoaderTimer = null;
    }
    const el = document.getElementById('loaderOverlay');
    if (el) {
      el.classList.remove('active');
      const textWrap = el.querySelector('.loader-text-wrap');
      if (textWrap) textWrap.innerHTML = '';
    }

    // Debounce completion by 140ms so cascading requests during page loads
    // (e.g. Purchase / Sales / BOM dropdowns) coalesce into a single progress sweep!
    if (__egsLoaderEndTimer) clearTimeout(__egsLoaderEndTimer);
    __egsLoaderEndTimer = setTimeout(() => {
      if (__egsLoaderCount === 0) {
        topProgress.done();
      }
      __egsLoaderEndTimer = null;
    }, 140);
  }
};

// ---------------------------------------------------------------------------
// IN-BUTTON PROGRESSIVE MICRO-LOADING & FEEDBACK ENGINE
// ---------------------------------------------------------------------------
window.withButtonFeedback = async function withButtonFeedback(btnOrId, asyncFn, options = {}) {
  const btn = typeof btnOrId === 'string' ? document.getElementById(btnOrId) : btnOrId;
  if (!btn || typeof asyncFn !== 'function') return (asyncFn ? asyncFn() : null);

  const minDuration = options.minDuration || 0; // Ultra-fast immediate response (0ms artificial delay)
  const originalHtml = btn.innerHTML;
  const originalDisabled = btn.disabled;
  const startTime = Date.now();

  btn.classList.add('btn-loading');
  btn.disabled = true;

  try {
    const result = await asyncFn();
    const elapsed = Date.now() - startTime;
    if (minDuration > 0 && elapsed < minDuration) {
      await new Promise(r => setTimeout(r, minDuration - elapsed));
    }

    if (options.showSuccess !== false && options.successText) {
      btn.classList.remove('btn-loading');
      btn.classList.add('btn-success');
      btn.innerHTML = `<i class="fa-solid fa-check"></i> <span>${options.successText}</span>`;
      await new Promise(r => setTimeout(r, options.successDuration || 200));
    }
    return result;
  } catch (err) {
    btn.classList.remove('btn-loading');
    btn.classList.add('btn-error-shake');
    if (options.errorText) {
      btn.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> <span>${options.errorText}</span>`;
    }
    await new Promise(r => setTimeout(r, options.errorDuration || 350));
    throw err;
  } finally {
    btn.classList.remove('btn-loading', 'btn-success', 'btn-error-shake');
    btn.innerHTML = originalHtml;
    btn.disabled = originalDisabled;
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

// Web Audio API Sound Synthesizer for Barcode Scanners & Feedback
window.playScannerTone = function (toneName) {
  const chosen = toneName || localStorage.getItem('egs_scanner_sound') || 'beep';
  if (chosen === 'mute' || chosen === 'none') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    if (chosen === 'chime') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (chosen === 'melody') {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const gain2 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(650, now);
      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.12);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1050, now + 0.12);
      gain2.gain.setValueAtTime(0.2, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.32);
    } else if (chosen === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(850, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    }
  } catch (e) {
    console.warn('[Audio] Could not play tone:', e);
  }
};

window.applyUserPreferences = function (prefs) {
  const p = prefs || {};
  const isCompact = p.compact_tables != null ? !!p.compact_tables : (localStorage.getItem('egs_compact_tables') === '1');
  const isSmooth = p.smooth_animations != null ? !!p.smooth_animations : (localStorage.getItem('egs_smooth_animations') !== '0');
  const scannerSound = p.scanner_sound || localStorage.getItem('egs_scanner_sound') || 'beep';

  document.body.classList.toggle('compact-table-mode', isCompact);
  document.body.classList.toggle('disable-ui-animations', !isSmooth);
  localStorage.setItem('egs_compact_tables', isCompact ? '1' : '0');
  localStorage.setItem('egs_smooth_animations', isSmooth ? '1' : '0');
  localStorage.setItem('egs_scanner_sound', scannerSound);
};
try { window.applyUserPreferences(); } catch (e) {}

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
    if (topbarEl) {
      const topbarRight = topbarEl.querySelector('.topbar-right');
      if (topbarRight && topbarRight.parentNode === topbarEl) {
        topbarEl.insertBefore(topbarExtra, topbarRight);
      } else {
        topbarEl.appendChild(topbarExtra);
      }
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

  // ---------- Modern Hover Tooltips & Info Buttons (project-wide) ----------
  let activeTooltipEl = null;
  let tooltipHideTimeout = null;

  function getTooltipContainer() {
    let el = document.getElementById('egsGlobalTooltip');
    if (!el) {
      el = document.createElement('div');
      el.id = 'egsGlobalTooltip';
      el.className = 'egs-tooltip';
      document.body.appendChild(el);
    }
    return el;
  }

  function hideTooltip() {
    if (activeTooltipEl) {
      activeTooltipEl.classList.remove('show');
      activeTooltipEl = null;
    }
  }

  function showTooltipFor(target) {
    if (!target) return;
    // Do not show hover shortcut tooltips on navigation tabs or subtabs
    if (target.closest('.nav-btn, .nav-scroll, .subtabs, .subtab, .m-tab, .tab, .ss-tab, .ss-tabs, .settings-tab-btn, .settings-tabs, .pl-tab-btn')) return;

    const msg = target.dataset.info || target.dataset.tooltip || target.getAttribute('title');
    if (!msg) return;

    // Suppress native browser title tooltip while custom tooltip is active
    if (target.getAttribute('title')) {
      target.dataset.tooltip = target.getAttribute('title');
      target.removeAttribute('title');
    }

    if (tooltipHideTimeout) clearTimeout(tooltipHideTimeout);

    const tooltip = getTooltipContainer();
    tooltip.innerHTML = `<i class="fa-solid fa-circle-info" style="color:var(--blue); margin-right:5px;"></i>${msg}`;
    tooltip.className = 'egs-tooltip';

    // Position tooltip relative to target
    const rect = target.getBoundingClientRect();
    const tooltipWidth = Math.min(340, Math.max(160, msg.length * 7 + 40));
    tooltip.style.width = 'max-content';
    tooltip.style.maxWidth = `${tooltipWidth}px`;

    // Render offscreen first to measure height
    tooltip.style.left = '-9999px';
    tooltip.style.top = '-9999px';
    tooltip.classList.add('show');
    const tipRect = tooltip.getBoundingClientRect();

    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceAbove >= tipRect.height + 12 || spaceAbove > spaceBelow;

    let top = placeAbove ? (rect.top - tipRect.height - 8) : (rect.bottom + 8);
    let left = rect.left + (rect.width / 2) - (tipRect.width / 2);

    // Viewport horizontal bounds clamp
    const minLeft = 10;
    const maxLeft = window.innerWidth - tipRect.width - 10;
    const clampedLeft = Math.max(minLeft, Math.min(maxLeft, left));

    // Arrow positioning
    const arrowX = rect.left + (rect.width / 2) - clampedLeft;
    tooltip.style.setProperty('--arrow-x', `${Math.max(12, Math.min(tipRect.width - 12, arrowX))}px`);

    tooltip.className = `egs-tooltip ${placeAbove ? 'arrow-bottom' : 'arrow-top'} show`;
    tooltip.style.left = `${clampedLeft}px`;
    tooltip.style.top = `${top}px`;
    activeTooltipEl = tooltip;
  }

  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest('.info-btn, [data-info], [data-tooltip]');
    if (target) showTooltipFor(target);
  });

  document.addEventListener('mouseout', (e) => {
    const target = e.target.closest('.info-btn, [data-info], [data-tooltip]');
    if (target) {
      if (tooltipHideTimeout) clearTimeout(tooltipHideTimeout);
      tooltipHideTimeout = setTimeout(hideTooltip, 60);
    }
  });

  document.addEventListener('focusin', (e) => {
    const target = e.target.closest('.info-btn, [data-info], [data-tooltip]');
    if (target) showTooltipFor(target);
  });

  document.addEventListener('focusout', () => hideTooltip());
  window.addEventListener('scroll', () => hideTooltip(), true);

  document.addEventListener('click', (e) => {
    const infoBtn = e.target.closest('.info-btn');
    if (!infoBtn) return;
    e.stopPropagation();
    const msg = infoBtn.dataset.info || infoBtn.dataset.tooltip;
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

  let searchDebounceRaf = null;
  searchInputs.forEach((input) => {
    input.addEventListener('input', () => {
      currentSearchQuery = input.value;
      searchInputs.forEach((other) => { if (other !== input) other.value = input.value; });
      if (searchDebounceRaf) cancelAnimationFrame(searchDebounceRaf);
      searchDebounceRaf = requestAnimationFrame(() => {
        applyGlobalTableSearch(currentSearchQuery);
      });
    });
  });

  // UNIVERSAL MODAL BACKGROUND SCROLL LOCK ENGINE
  // =====================================================================
  let activeModalLockCount = 0;

  window.lockBackgroundScroll = function () {
    activeModalLockCount++;
    document.documentElement.classList.add('egs-modal-locked', 'no-scroll');
    document.body.classList.add('egs-modal-locked', 'no-scroll');
  };

  window.unlockBackgroundScroll = function (force) {
    if (force) activeModalLockCount = 0;
    else activeModalLockCount = Math.max(0, activeModalLockCount - 1);

    if (activeModalLockCount === 0) {
      setTimeout(() => {
        const openModals = document.querySelectorAll(
          '.modal-overlay.show, .confirm-overlay.show, .egs-popup-overlay.active, .egs-onboard-overlay, .sidebar.open, #statementOverlay.show, #ledgerFormOverlay.show'
        );
        if (!openModals.length) {
          document.documentElement.classList.remove('egs-modal-locked', 'no-scroll');
          document.body.classList.remove('egs-modal-locked', 'no-scroll');
        }
      }, 40);
    }
  };

  window.syncModalScrollLock = function () {
    const openModals = document.querySelectorAll(
      '.modal-overlay.show, .confirm-overlay.show, .egs-popup-overlay.active, .egs-onboard-overlay, .sidebar.open, #statementOverlay.show, #ledgerFormOverlay.show'
    );
    const isLocked = document.documentElement.classList.contains('egs-modal-locked');
    if (openModals.length > 0) {
      if (!isLocked) {
        document.documentElement.classList.add('egs-modal-locked', 'no-scroll');
        document.body.classList.add('egs-modal-locked', 'no-scroll');
      }
    } else {
      activeModalLockCount = 0;
      if (isLocked) {
        document.documentElement.classList.remove('egs-modal-locked', 'no-scroll');
        document.body.classList.remove('egs-modal-locked', 'no-scroll');
      }
    }
  };

  // Wheel and Touch Event Trap: Prevents background scrolling when hovering backdrop
  document.addEventListener('wheel', (e) => {
    if (!document.body.classList.contains('egs-modal-locked') && !document.body.classList.contains('no-scroll')) return;

    // If wheel is inside any modal dialog, settings panel, legal doc or drawer, let it scroll naturally!
    const insideModalCard = e.target.closest(
      '.modal-box, .modal-card, .confirm-card, .egs-popup-card, .egs-onboard-card, .settings-layout, .settings-content-wrap, .settings-panel, .settings-tabs, .sess-list, .egs-legal-doc, #statementOverlay .modal-box, #ledgerFormOverlay .modal-box, .sidebar'
    );
    if (!insideModalCard) {
      // Scrolled on empty backdrop/overlay outside the card
      e.preventDefault();
    }
  }, { passive: false });

  document.addEventListener('touchmove', (e) => {
    if (!document.body.classList.contains('egs-modal-locked') && !document.body.classList.contains('no-scroll')) return;
    const insideModalCard = e.target.closest(
      '.modal-box, .modal-card, .confirm-card, .egs-popup-card, .egs-onboard-card, .settings-layout, .settings-content-wrap, .settings-panel, .settings-tabs, .sess-list, .egs-legal-doc, #statementOverlay .modal-box, #ledgerFormOverlay .modal-box, .sidebar'
    );
    if (!insideModalCard) {
      e.preventDefault();
    }
  }, { passive: false });

  // ---------- Sidebar (mobile) ----------
  window.openSidebar = function () {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('overlay').classList.add('show');
    window.lockBackgroundScroll();
  };
  window.closeSidebar = function () {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
    window.unlockBackgroundScroll();
  };

  // ---------- Modal (used for "Live User Sessions" popup, Settings, etc.) ----------
  let currentModalCloseCb = null;
  window.openModal = function (title, bodyHtml, opts) {
    opts = opts || {};
    currentModalCloseCb = typeof opts.onClose === 'function' ? opts.onClose : null;
    if (typeof closeAllFlyouts === 'function') closeAllFlyouts();
    if (typeof window.closeSidebar === 'function') window.closeSidebar();
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    const overlay = document.getElementById('modalOverlay');
    const box = document.querySelector('#modalOverlay .modal-box');
    if (opts.fullscreen) {
      overlay.classList.add('modal-fullscreen');
    } else {
      overlay.classList.remove('modal-fullscreen');
    }
    if (box) {
      box.classList.remove('modal-box-wide', 'modal-box-xl', 'settings-modal-box');
      if (opts.modalClass) box.classList.add(opts.modalClass);
      if (opts.size === 'xl') {
        box.classList.add('modal-box-xl');
      } else if (opts.size === 'large' || opts.size === 'wide' || opts.wide) {
        box.classList.add('modal-box-wide');
      }
    }
    overlay.classList.add('show');
    window.lockBackgroundScroll();
  };

  let modalMouseDownTarget = null;
  document.addEventListener('mousedown', (e) => {
    modalMouseDownTarget = e.target;
  }, true);

  window.closeModal = function (event, skipCallback) {
    if (event) {
      if (event.target !== event.currentTarget) return;
      // Prevent accidental close when selecting text inside textarea/inputs and releasing mouse on backdrop
      if (modalMouseDownTarget && modalMouseDownTarget !== event.currentTarget) return;
    }
    const overlay = document.getElementById('modalOverlay');
    overlay.classList.remove('show');
    overlay.classList.remove('modal-fullscreen');
    const box = document.querySelector('#modalOverlay .modal-box');
    if (box) {
      box.classList.remove('modal-box-wide', 'modal-box-xl', 'settings-modal-box');
    }
    window.unlockBackgroundScroll();
    if (!skipCallback && currentModalCloseCb) {
      const cb = currentModalCloseCb;
      currentModalCloseCb = null;
      cb();
    } else {
      currentModalCloseCb = null;
    }
  };

  // ---------- Confirm Dialog ----------
  const KIND_STYLE = {
    question: { color: 'var(--purple)', icon: 'fa-circle-question' },
    danger: { color: 'var(--red)', icon: 'fa-triangle-exclamation' },
    warning: { color: 'var(--gold)', icon: 'fa-triangle-exclamation' },
    info: { color: 'var(--blue)', icon: 'fa-circle-info' },
  };
  let confirmResolver = null;

  function closeConfirmDialog(result) {
    document.getElementById('confirmOverlay').classList.remove('show');
    window.unlockBackgroundScroll();
    if (confirmResolver) { const r = confirmResolver; confirmResolver = null; r(result); }
  }

  window.confirmDialog = function (title, message, opts) {
    opts = opts || {};
    if (typeof closeAllFlyouts === 'function') closeAllFlyouts();
    if (typeof window.closeSidebar === 'function') window.closeSidebar();
    const kind = KIND_STYLE[opts.kind] ? opts.kind : 'question';
    const style = KIND_STYLE[kind];
    const card = document.getElementById('confirmCard');
    card.style.setProperty('--confirm-accent', style.color);
    document.getElementById('confirmIcon').innerHTML = `<i class="fa-solid ${style.icon}"></i>`;
    document.getElementById('confirmTitle').textContent = title || 'Please Confirm';
    const msgEl = document.getElementById('confirmMsg');
    msgEl.innerHTML = message || '';
    msgEl.style.maxHeight = '55vh';
    msgEl.style.overflowY = 'auto';
    const okBtn = document.getElementById('confirmBtnOk');
    const cancelBtn = document.getElementById('confirmBtnCancel');
    okBtn.textContent = opts.okLabel || 'Yes';
    cancelBtn.textContent = opts.cancelLabel || 'Cancel';
    document.getElementById('confirmOverlay').classList.add('show');
    window.lockBackgroundScroll();
    return new Promise((resolve) => {
      confirmResolver = resolve;
      okBtn.onclick = () => closeConfirmDialog(true);
      cancelBtn.onclick = () => closeConfirmDialog(false);
    });
  };

  window.confirmDanger = function (title, message) {
    return window.confirmDialog(title, message, { kind: 'danger', okLabel: 'Yes, Delete' });
  };
  document.getElementById('confirmOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeConfirmDialog(false);
  });

  window.go = go;

  // Proactive Navigation Link Hover & Touch Prefetching for 0ms Perceived Response
  document.addEventListener('mouseover', (e) => {
    const target = e.target.closest && e.target.closest('[onclick*="go("], .egs-flyout-item, .erp-sidebar-btn');
    if (!target) return;
    const onclick = target.getAttribute('onclick') || '';
    if (onclick.includes("'reports'")) window.Api.prefetch('/reports/master');
    else if (onclick.includes("'masters'")) window.Api.prefetch('/masters/categories');
    else if (onclick.includes("'partyledger'")) window.Api.prefetch('/ledgers');
    else if (onclick.includes("'dashboard'")) window.Api.prefetch('/dashboard/summary');
  }, { passive: true });

  document.addEventListener('touchstart', (e) => {
    const target = e.target.closest && e.target.closest('[onclick*="go("], .egs-flyout-item, .erp-sidebar-btn');
    if (!target) return;
    const onclick = target.getAttribute('onclick') || '';
    if (onclick.includes("'reports'")) window.Api.prefetch('/reports/master');
    else if (onclick.includes("'masters'")) window.Api.prefetch('/masters/categories');
    else if (onclick.includes("'partyledger'")) window.Api.prefetch('/ledgers');
    else if (onclick.includes("'dashboard'")) window.Api.prefetch('/dashboard/summary');
  }, { passive: true });

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
    const startRoute = parseRouteHash(window.location.hash);
    if (window.PAGES[startRoute.id]) {
      go(startRoute.id, startRoute.opts, false);
    } else {
      go('dashboard', {}, false);
    }
    setTimeout(() => {
      if (typeof window.requestNativeSystemPermissions === 'function') {
        window.requestNativeSystemPermissions();
      }
    }, 1200);
  }

  // Also react to Back/Forward browser buttons and manual hash edits, so
  // the visible page always matches the URL hash, not just on first load.
  window.addEventListener('popstate', () => {
    const route = parseRouteHash(window.location.hash);
    if (window.PAGES[route.id]) {
      go(route.id, route.opts, false);
    }
  });

  window.addEventListener('hashchange', () => {
    const route = parseRouteHash(window.location.hash);
    if (window.PAGES[route.id]) {
      const curSub = (window.CURRENT_PAGE_OPTS && (window.CURRENT_PAGE_OPTS.sub || window.CURRENT_PAGE_OPTS.tab || window.CURRENT_PAGE_OPTS.action)) || '';
      const newSub = route.opts.sub || route.opts.tab || route.opts.action || '';
      if (window.CURRENT_PAGE_ID === route.id && curSub === newSub) return;
      go(route.id, route.opts, false);
    }
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

    function toggle() {
      if (pop) closePop();
      else open();
    }

    function open() {
      if (pop) return; // Prevent double-execution flicker when both focus and click fire
      view = parseISO(native.value) || startOfToday();
      renderPop();
    }

    display.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
    icon.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });
    display.addEventListener('focus', () => {
      if (!pop) open();
    });
    native.showPicker = function () {
      open();
    };
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

