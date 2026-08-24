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
  getMode() { return (window.ERP_CONFIG && window.ERP_CONFIG.erp_mode) || 'hybrid'; },
  isSerialEnabled() { const m = this.getMode(); return m !== 'quantity_only' && m !== 'accounts_only'; },
  isQuantityOnly() { return this.getMode() === 'quantity_only'; },
  isAccountingMode() { const m = this.getMode(); return m === 'full_accounting' || m === 'accounts_only'; },
  isAccountsOnly() { return this.getMode() === 'accounts_only'; },
  isFinancialOnly() { return this.getMode() === 'accounts_only'; },
  isBomEnabled() { return !window.ERP_CONFIG || (window.ERP_CONFIG.feature_bom_enabled !== '0' && this.getMode() !== 'accounts_only'); },
  isPricingEnabled() { return !window.ERP_CONFIG || window.ERP_CONFIG.feature_pricing_enabled !== '0'; },
  isWarehouseEnabled() { return !window.ERP_CONFIG || (window.ERP_CONFIG.feature_warehouse_enabled !== '0' && this.getMode() !== 'accounts_only'); },
  isPalletEnabled() { return !window.ERP_CONFIG || (window.ERP_CONFIG.feature_pallet_enabled !== '0' && this.getMode() !== 'accounts_only'); },
  isProofMandatory() { return !!(window.ERP_CONFIG && window.ERP_CONFIG.feature_attachment_mandatory === '1'); }
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
        ${onPrint ? `<button type="button" class="btn btn-ghost btn-bulk-print" style="font-size:12px; padding:4px 10px;"><i class="fa-solid fa-print"></i> Print</button>` : ''}
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

function applyErpModeRules() {
  const mode = window.ERP.getMode();
  if (document.body) {
    document.body.setAttribute('data-erp-mode', mode);
    document.body.classList.toggle('erp-mode-quantity-only', window.ERP.isQuantityOnly());
    document.body.classList.toggle('erp-mode-financial-only', window.ERP.isAccountsOnly());
    document.body.classList.toggle('erp-mode-full-accounting', window.ERP.isAccountingMode());
  }
  if (typeof window.renderNavButtons === 'function') {
    window.renderNavButtons();
  }
}
window.applyErpModeRules = applyErpModeRules;

// ---------------------------------------------------------------------------
// GLOBAL LOADING INDICATORS — Smooth Unidirectional Top Progress Bar + Action Loader
// Batches cascading API calls into a SINGLE smooth sweep (0 -> 100% -> fade).
// ---------------------------------------------------------------------------
let __egsLoaderCount = 0;
let __egsLoaderTimer = null;
let __egsLoaderEndTimer = null;

const topProgress = {
  el: null,
  percent: 0,
  trickleTimer: null,
  resetTimer: null,
  isRunning: false,

  init() {
    if (this.el) return this.el;
    this.el = document.getElementById('egsTopProgressBar');
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'egsTopProgressBar';
      this.el.className = 'egs-top-progress';
      document.body.appendChild(this.el);
    }
    return this.el;
  },

  start() {
    this.init();
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }

    if (!this.isRunning || this.percent === 0 || this.percent >= 100) {
      this.isRunning = true;
      this.percent = 0;
      this.el.style.transition = 'none';
      this.el.style.width = '0%';
      this.el.style.opacity = '1';
      void this.el.offsetWidth; // flush layout
      this.set(35);
    }

    if (!this.trickleTimer) {
      this.trickleTimer = setInterval(() => {
        if (this.percent < 90) {
          const step = (90 - this.percent) * 0.16;
          this.set(this.percent + step);
        }
      }, 140);
    }
  },

  set(pct) {
    this.init();
    // Strictly unidirectional forward progression
    if (pct < this.percent && this.percent < 100) return;
    this.percent = Math.min(100, Math.max(0, pct));
    this.el.style.transition = 'width 0.26s cubic-bezier(0.1, 0.85, 0.25, 1), opacity 0.2s ease';
    this.el.style.width = `${this.percent}%`;
    this.el.style.opacity = '1';
  },

  done() {
    if (!this.el) return;
    if (this.trickleTimer) {
      clearInterval(this.trickleTimer);
      this.trickleTimer = null;
    }
    this.set(100);
    this.isRunning = false;

    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => {
      if (this.el) {
        this.el.style.transition = 'opacity 0.22s ease';
        this.el.style.opacity = '0';
        setTimeout(() => {
          if (this.el && !this.isRunning) {
            this.percent = 0;
            this.el.style.transition = 'none';
            this.el.style.width = '0%';
          }
        }, 240);
      }
      this.resetTimer = null;
    }, 150);
  }
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

// =====================================================================
// NATIVE SYSTEM-LEVEL PERMISSIONS ENGINE (Direct OS/Browser Dialogs)
// =====================================================================
window.requestNativeNotificationPermission = async function () {
  if (!('Notification' in window)) {
    if (window.showToast) window.showToast('Push notifications are not supported in this browser.', 'warning');
    return 'unsupported';
  }
  try {
    const res = await Notification.requestPermission();
    if (res === 'granted') {
      if (window.showToast) window.showToast('Push notifications successfully enabled!', 'success');
      window.sendAppNotification('🔔 Notifications Enabled', {
        body: 'Real-time alerts for Dispatches and Low Stock are active.',
        tag: 'perm-granted'
      });
    } else if (res === 'denied') {
      if (window.showToast) window.showToast('Notification permission was blocked in browser/system settings.', 'error', 3500);
    }
    return res;
  } catch (e) {
    console.error('Notification permission request error:', e);
    return 'denied';
  }
};

window.requestPushPermission = window.requestNativeNotificationPermission;

window.requestNativeCameraPermission = async function () {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (window.showToast) window.showToast('Camera API is not supported on this device.', 'warning');
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    // Stop tracks immediately so hardware camera LED/indicator shuts off
    stream.getTracks().forEach((track) => track.stop());
    if (window.showToast) window.showToast('Camera permission granted for Barcode & QR scanning!', 'success');
    return true;
  } catch (e) {
    if (window.showToast) window.showToast('Camera access was blocked or cancelled.', 'warning');
    return false;
  }
};

window.requestNativeMicPermission = async function () {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (window.showToast) window.showToast('Microphone API is not supported on this device.', 'warning');
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    if (window.showToast) window.showToast('Microphone permission granted!', 'success');
    return true;
  } catch (e) {
    if (window.showToast) window.showToast('Microphone access was blocked or cancelled.', 'warning');
    return false;
  }
};

window.requestNativeStoragePermission = async function () {
  if (navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      if (isPersisted) {
        if (window.showToast) window.showToast('Persistent offline storage is active!', 'success');
      } else {
        if (window.showToast) window.showToast('Storage persistence granted with standard quota.', 'info');
      }
      return isPersisted;
    } catch (e) {}
  }
  return true;
};

window.requestNativeSystemPermissions = async function () {
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (e) {}
  }
};

let hasRequestedInitialNativePerms = false;
function autoRequestNativePermissionsOnGesture() {
  if (hasRequestedInitialNativePerms) return;
  hasRequestedInitialNativePerms = true;
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      Notification.requestPermission().catch(() => {});
    } catch (e) {}
  }
  document.removeEventListener('click', autoRequestNativePermissionsOnGesture);
  document.removeEventListener('touchstart', autoRequestNativePermissionsOnGesture);
}
document.addEventListener('click', autoRequestNativePermissionsOnGesture, { once: true, passive: true });
document.addEventListener('touchstart', autoRequestNativePermissionsOnGesture, { once: true, passive: true });

window.sendAppNotification = function (title, options = {}) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const defaultOpts = {
      body: 'Eco Green Solar ERP System Notification',
      icon: 'assets/icons/icon-192.png?v=2',
      badge: 'assets/icons/icon-192.png?v=2',
      vibrate: [200, 100, 200]
    };
    const opts = Object.assign({}, defaultOpts, options);
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, opts);
      }).catch(() => {
        new Notification(title, opts);
      });
    } else {
      new Notification(title, opts);
    }
  } catch (e) {
    console.warn('sendAppNotification error:', e);
  }
};

// =====================================================================
// IOS & ANDROID PWA INSTALL APPLICATION GUIDE
// =====================================================================
window.openAppInstallGuide = async function () {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  if (isStandalone) {
    if (window.showToast) window.showToast('Eco Green Solar ERP is already running in Standalone App Mode!', 'success');
    return;
  }

  // 1. Direct Native PWA installation prompt trigger:
  if (window.__egsDeferredInstallPrompt) {
    try {
      window.__egsDeferredInstallPrompt.prompt();
      const choice = await window.__egsDeferredInstallPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        if (window.showToast) window.showToast('Installing Eco Green Solar ERP on your device...', 'success');
        window.__egsDeferredInstallPrompt = null;
      }
      return;
    } catch (e) {
      console.warn('Install prompt error:', e);
    }
  }

  if (document.getElementById('egsInstallModal')) return;

  const modalHtml = `
    <div class="egs-onboard-overlay" id="egsInstallModal" onclick="if(event.target===this) this.remove();">
      <div class="egs-onboard-card">
        <div class="egs-onboard-header">
          <div class="egs-onboard-logo" style="background:transparent; border:none; width:auto; height:auto;">
            <img src="assets/icons/icon-192.png" style="width:58px; height:58px; border-radius:14px; box-shadow:0 4px 16px rgba(0,0,0,0.4);" alt="Logo">
          </div>
          <h3 class="egs-onboard-title">Install Eco Green Solar ERP</h3>
          <p class="egs-onboard-sub">Install this Enterprise Application onto your device for native app performance, full-screen UI and zero address bar.</p>
        </div>

        ${isIOS ? `
        <div class="egs-ios-guide">
          <strong style="color:var(--gold); font-size:14px; display:flex; align-items:center; gap:8px;">
            <i class="fa-brands fa-apple" style="font-size:18px;"></i> How to Install on iPhone / iPad (Safari)
          </strong>
          <div class="egs-ios-steps">
            <div class="egs-ios-step">
              <span class="egs-ios-badge">1</span>
              <span>Tap the <strong>Share</strong> button <i class="fa-solid fa-arrow-up-from-bracket" style="color:var(--blue); margin:0 4px;"></i> at the bottom bar of Safari.</span>
            </div>
            <div class="egs-ios-step">
              <span class="egs-ios-badge">2</span>
              <span>Scroll down and tap <strong>"Add to Home Screen"</strong> <i class="fa-solid fa-square-plus" style="color:var(--green); margin:0 4px;"></i>.</span>
            </div>
            <div class="egs-ios-step">
              <span class="egs-ios-badge">3</span>
              <span>Tap <strong>"Add"</strong> in the top-right corner to finish.</span>
            </div>
          </div>
        </div>
        ` : `
        <div class="egs-ios-guide">
          <strong style="color:var(--blue); font-size:14px; display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-download" style="font-size:16px;"></i> Direct Browser Installation
          </strong>
          <p style="font-size:12.5px; color:var(--txt-muted); margin:8px 0 12px; line-height:1.5;">
            Click the <strong>Install icon <i class="fa-solid fa-arrow-up-right-from-square"></i> in your browser's address bar</strong> or click the button below to launch the official installer:
          </p>
          <button type="button" class="btn btn-blue" id="btnModalTriggerPrompt" style="width:100%; font-weight:700; padding:10px;">
            <i class="fa-solid fa-download"></i> Click to Open Install Prompt
          </button>
        </div>
        `}

        <div class="actions-row" style="margin-top:18px; justify-content:flex-end;">
          <button type="button" class="btn btn-ghost" onclick="document.getElementById('egsInstallModal').remove();">
            Close
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const triggerBtn = document.getElementById('btnModalTriggerPrompt');
  if (triggerBtn) {
    triggerBtn.addEventListener('click', async () => {
      if (window.__egsDeferredInstallPrompt) {
        window.__egsDeferredInstallPrompt.prompt();
        const choice = await window.__egsDeferredInstallPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          if (window.showToast) window.showToast('Installing Eco Green Solar ERP...', 'success');
          const m = document.getElementById('egsInstallModal');
          if (m) m.remove();
        }
      } else {
        if (window.showToast) window.showToast('Please click the Install / App icon in your browser address bar at the top right.', 'info', 4000);
      }
    });
  }
};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__egsDeferredInstallPrompt = e;
  const installBtn = document.getElementById('btnTopbarInstallApp');
  if (installBtn) installBtn.style.display = 'inline-flex';
});

setTimeout(() => {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const installBtn = document.getElementById('btnTopbarInstallApp');
  if (installBtn && !isStandalone) {
    installBtn.style.display = 'inline-flex';
  }
}, 1500);

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
          <div class="profile-theme-row" style="padding:8px 0; gap:8px;">
            <button type="button" class="theme-btn" data-theme-set="dark"><i class="fa-solid fa-moon"></i> Dark</button>
            <button type="button" class="theme-btn" data-theme-set="gray"><i class="fa-solid fa-circle-half-stroke"></i> Gray</button>
            <button type="button" class="theme-btn" data-theme-set="light"><i class="fa-solid fa-sun"></i> Light</button>
            <button type="button" class="theme-btn" data-theme-set="emerald"><i class="fa-solid fa-leaf" style="color:#2ecc71;"></i> Emerald</button>
            <button type="button" class="theme-btn" data-theme-set="ocean"><i class="fa-solid fa-water" style="color:#38bdf8;"></i> Ocean</button>
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
  let profileMenuBackdrop = null;

  function closeProfileMenu() {
    if (profileMenuEl) { profileMenuEl.remove(); profileMenuEl = null; }
    if (profileMenuBackdrop) { profileMenuBackdrop.remove(); profileMenuBackdrop = null; }
  }
  window.closeProfileMenu = closeProfileMenu;

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

  function getKeyboardShortcutsContentHtml() {
    return `
      <div style="display:flex; flex-direction:column; gap:16px; font-size:13px;">
        <!-- Top Summary Banner -->
        <div style="background:rgba(30, 58, 138, 0.15); border:1px solid rgba(59, 130, 246, 0.3); border-radius:10px; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
          <div>
            <strong style="color:var(--blue); font-size:14px;"><i class="fa-solid fa-keyboard"></i> Enterprise ERP Keyboard Fast-Lane</strong>
            <div style="font-size:12px; color:var(--txt-muted); margin-top:2px;">Operate the entire ERP seamlessly without a mouse using single-key hotkeys, cascading menus, and voucher function keys.</div>
          </div>
          <span class="pill pill-gold" style="font-weight:700;">Press F1 Anytime</span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap:14px;">
          
          <!-- 1. Gateway & Sidebar Top-Level Hotkeys -->
          <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:12px; padding:14px;">
            <h4 style="margin:0 0 10px; color:var(--gold); display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-compass"></i> Gateway &amp; Main Navigation
            </h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Gateway / Dashboard</span><kbd class="egs-kbd">G</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Accounts Info Group</span><kbd class="egs-kbd">A</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Transaction Entry Group</span><kbd class="egs-kbd">T</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Display / Print Books</span><kbd class="egs-kbd">D</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Utilities &amp; Setup Group</span><kbd class="egs-kbd">U</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt-muted); font-size:12px;">Flyout Menu Navigation</span><div><kbd class="egs-kbd">↑</kbd> <kbd class="egs-kbd">↓</kbd> <kbd class="egs-kbd">→</kbd> <kbd class="egs-kbd">←</kbd></div></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt-muted); font-size:12px;">Select / Execute Item</span><kbd class="egs-kbd">Enter</kbd></div>
            </div>
          </div>

          <!-- 2. Accounts Info Hotkeys -->
          <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:12px; padding:14px;">
            <h4 style="margin:0 0 10px; color:var(--blue); display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-folder-open"></i> Accounts Info Hotkeys (Press A)
            </h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Ledger Info Submenu</span><kbd class="egs-kbd">L</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Create Ledger</span><kbd class="egs-kbd">C</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Display Ledger Register</span><kbd class="egs-kbd">D</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Alter / Edit Ledger</span><kbd class="egs-kbd">A</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Item / Product Info (Create/Disp/Alt)</span><kbd class="egs-kbd">I</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Group / Category Info</span><kbd class="egs-kbd">G</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Unit of Measure (UOM)</span><kbd class="egs-kbd">U</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Warehouse / Godown Info</span><kbd class="egs-kbd">W</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Brand Directory</span><kbd class="egs-kbd">B</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Customer &amp; Supplier Master</span><kbd class="egs-kbd">C</kbd></div>
            </div>
          </div>

          <!-- 3. Transaction Entry Hotkeys -->
          <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:12px; padding:14px;">
            <h4 style="margin:0 0 10px; color:#22c55e; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-receipt"></i> Transaction Entry Hotkeys (Press T)
            </h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Purchase Inward (Stock In)</span><kbd class="egs-kbd">P</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Project Sales &amp; Dispatch</span><kbd class="egs-kbd">S</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">BOM Kit Assembly &amp; Delivery</span><kbd class="egs-kbd">B</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Custom Challan Generator</span><kbd class="egs-kbd">C</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Stock Allocation &amp; Assignment</span><kbd class="egs-kbd">A</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Return / Damage Voucher</span><kbd class="egs-kbd">M</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Barcode Scan Sheet</span><kbd class="egs-kbd">N</kbd></div>
            </div>
          </div>

          <!-- 4. Accounting Vouchers Function Keys -->
          <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:12px; padding:14px;">
            <h4 style="margin:0 0 10px; color:#f59e0b; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-money-bill-transfer"></i> Accounting Voucher Keys
            </h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Payment Voucher Entry</span><kbd class="egs-kbd">F5</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Receipt Voucher Entry</span><kbd class="egs-kbd">F6</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Journal Voucher (Adjustments)</span><kbd class="egs-kbd">F7</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Debit Note (Purchase Return)</span><kbd class="egs-kbd">Alt + F5</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Credit Note (Sales Return)</span><kbd class="egs-kbd">Alt + F6</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Accounting Vouchers Studio</span><kbd class="egs-kbd">V</kbd></div>
            </div>
          </div>

          <!-- 5. Display & Print Books Hotkeys -->
          <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:12px; padding:14px;">
            <h4 style="margin:0 0 10px; color:#a855f7; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-chart-pie"></i> Display / Print Hotkeys (Press D)
            </h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Account Books &amp; Statements</span><kbd class="egs-kbd">A</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Party Ledger Register</span><kbd class="egs-kbd">L</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Purchase Register</span><kbd class="egs-kbd">P</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Sale Register</span><kbd class="egs-kbd">S</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Trial Balance Statement</span><kbd class="egs-kbd">T</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Profit &amp; Loss Account</span><kbd class="egs-kbd">O</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Balance Sheet</span><kbd class="egs-kbd">B</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Day Book</span><kbd class="egs-kbd">D</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Stock Books &amp; Registers</span><kbd class="egs-kbd">S</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Inventory Master Report</span><kbd class="egs-kbd">M</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Low Stock Alert Register</span><kbd class="egs-kbd">L</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ BOM Dispatch Register</span><kbd class="egs-kbd">B</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Challan Register</span><kbd class="egs-kbd">C</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center; padding-left:14px;"><span style="color:var(--txt-muted); font-size:12px;">↳ Track Order Register</span><kbd class="egs-kbd">T</kbd></div>
            </div>
          </div>

          <!-- 6. Universal ERP Actions & Quick Keys -->
          <div style="background:var(--input-bg); border:1px solid var(--border-light); border-radius:12px; padding:14px;">
            <h4 style="margin:0 0 10px; color:var(--txt); display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-bolt"></i> Universal ERP Actions
            </h4>
            <div style="display:flex; flex-direction:column; gap:8px;">
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Universal Quick Search</span><kbd class="egs-kbd">Ctrl + K</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Active Page Table Search</span><kbd class="egs-kbd">/</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Step-by-Step Back / Unfocus</span><kbd class="egs-kbd">Esc</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Next Field / Confirm Form</span><kbd class="egs-kbd">Enter</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Previous Form Field</span><kbd class="egs-kbd">Shift + Enter</kbd></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Save Voucher / Submit</span><div><kbd class="egs-kbd">Ctrl + Enter</kbd> or <kbd class="egs-kbd">Ctrl + S</kbd></div></div>
              <div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--txt);">Shortcuts Reference Guide</span><kbd class="egs-kbd">F1</kbd></div>
            </div>
          </div>

        </div>
      </div>
    `;
  }
  window.getKeyboardShortcutsContentHtml = getKeyboardShortcutsContentHtml;

  function openAppSettingsPanel(defaultTabId) {
    closeProfileMenu();
    const activeTheme = (typeof window.getAppTheme === 'function') ? window.getAppTheme() : 'dark';
    const activeFont = (typeof window.getAppFont === 'function') ? window.getAppFont() : 'segoe';
    const activeAvatar = (typeof window.getAppAvatarColor === 'function') ? window.getAppAvatarColor() : 'gold';
    const currentRole = window.currentUserRole || 'User';
    const isAdmin = currentRole === 'SuperAdmin' || currentRole === 'Admin';
    const currentUsername = window.currentUsername || 'user';
    const initialTab = defaultTabId || 'tab-profile';

    const isCompactSaved = localStorage.getItem('egs_compact_tables') === '1';
    const isSmoothSaved = localStorage.getItem('egs_smooth_animations') !== '0';
    const activeSoundSaved = localStorage.getItem('egs_scanner_sound') || 'beep';

    const settingsHtml = `
      <div class="settings-layout">
        <div class="settings-tabs">
          <button type="button" class="settings-tab-btn" data-tab="tab-profile"><i class="fa-solid fa-user-gear"></i> My Profile &amp; Security</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-shortcuts"><i class="fa-solid fa-keyboard"></i> Shortcuts &amp; Hotkeys</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-audit"><i class="fa-solid fa-clock-rotate-left"></i> Activity Audit Feed</button>
          ${isAdmin ? '<button type="button" class="settings-tab-btn" data-tab="tab-perf"><i class="fa-solid fa-gauge-high"></i> Performance &amp; Engine</button>' : ''}
          ${isAdmin ? '<button type="button" class="settings-tab-btn" data-tab="tab-erp-mode"><i class="fa-solid fa-sliders"></i> ERP Mode &amp; Features</button>' : ''}
          ${isAdmin ? '<button type="button" class="settings-tab-btn" data-tab="tab-users"><i class="fa-solid fa-users-gear"></i> User Accounts</button>' : ''}
          <button type="button" class="settings-tab-btn" data-tab="tab-challan"><i class="fa-solid fa-file-invoice"></i> Challan &amp; Print</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-theme"><i class="fa-solid fa-palette"></i> Appearance</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-permissions"><i class="fa-solid fa-mobile-screen-button"></i> Device &amp; Notifications</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-company"><i class="fa-solid fa-building"></i> Company Profile</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-inventory"><i class="fa-solid fa-boxes-stacked"></i> Alerts &amp; Stock</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-privacy"><i class="fa-solid fa-shield-halved"></i> Privacy Policy &amp; Terms</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-about"><i class="fa-solid fa-circle-info"></i> About &amp; Version</button>
          <button type="button" class="settings-tab-btn" data-tab="tab-roadmap"><i class="fa-solid fa-rocket"></i> Cloud Roadmap</button>
        </div>

        <div class="settings-content-wrap">
          <!-- 1. My Profile & Security Tab -->
          <div class="settings-panel" id="tab-profile">
          <div class="settings-card">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:14px; padding-bottom:12px; border-bottom:1px solid var(--border-light);">
              <div style="display:flex; align-items:center; gap:12px;">
                <span class="pa-avatar" style="width:40px; height:40px; font-size:16px; border-radius:50%; background:var(--blue); color:#fff; display:inline-flex; align-items:center; justify-content:center; font-weight:700;">${(currentUsername[0] || 'U').toUpperCase()}</span>
                <div>
                  <strong style="font-size:15px; color:var(--txt);">@${currentUsername}</strong>
                  <div style="font-size:12px; color:var(--txt-muted); display:flex; align-items:center; gap:6px; margin-top:2px;">
                    <span class="pill pill-${currentRole === 'SuperAdmin' ? 'purple' : currentRole === 'Admin' ? 'gold' : 'blue'}" style="font-size:10.5px; padding:2px 8px; font-weight:700;">${currentRole}</span>
                    <span>· OTP 2FA Enabled</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="settings-card-title"><i class="fa-solid fa-id-card" style="color:var(--blue);"></i> Edit Account Credentials</div>
            <p style="margin:0 0 10px; font-size:12px; color:var(--txt-muted);">Updating credentials takes effect instantly across all ERP modules and active device sessions.</p>
            <div class="form-grid cols-2" style="margin-top:10px;">
              <div class="field">
                <label>Username</label>
                <input type="text" id="myProfileUsername" value="${currentUsername}" placeholder="Enter new username">
              </div>
              <div class="field">
                <label>Registered Email (for OTP Login)</label>
                <input type="email" id="myProfileEmail" placeholder="e.g. user@example.com">
              </div>
              <div class="field span-2">
                <label>Current Password / PIN <span class="req">*</span> <small style="color:var(--gold); font-weight:normal;">(Required to confirm updates)</small></label>
                <input type="password" id="myProfileCurPass" placeholder="Enter current password/PIN">
                <div style="margin-top:5px; text-align:right;">
                  <a href="javascript:void(0)" id="btnProfileForgotPass" style="color:var(--gold); font-size:12px; text-decoration:underline; font-weight:600;"><i class="fa-solid fa-key"></i> Forgot current password? Reset via OTP</a>
                </div>
              </div>

              <!-- Inline Forgot Password OTP Box (Hidden by default) -->
              <div id="profileForgotOtpBox" class="field span-2" style="display:none; background:rgba(218,165,32,0.07); border:1px solid rgba(218,165,32,0.3); border-radius:10px; padding:14px; margin-bottom:10px;">
                <div style="font-weight:700; color:var(--gold); font-size:13px; margin-bottom:4px;"><i class="fa-solid fa-envelope-circle-check"></i> Reset Password via Email OTP</div>
                <p id="profileForgotOtpDesc" style="margin:0 0 12px; font-size:12px; color:var(--txt-muted);">We have emailed a 6-digit verification OTP to your registered address.</p>
                <div class="form-grid cols-2">
                  <div class="field">
                    <label>Enter 6-Digit OTP <span class="req">*</span></label>
                    <input type="text" id="profileForgotOtpInput" placeholder="123456" maxlength="6" style="font-weight:700; letter-spacing:2px; text-align:center;">
                  </div>
                  <div class="field">
                    <label>Set New Password / PIN <span class="req">*</span></label>
                    <input type="password" id="profileForgotNewPass" placeholder="At least 6 characters">
                  </div>
                  <div class="field span-2">
                    <label>Confirm New Password / PIN <span class="req">*</span></label>
                    <input type="password" id="profileForgotConfirmPass" placeholder="Re-enter new password">
                  </div>
                </div>
                <div class="actions-row" style="margin-top:12px; justify-content:flex-end; gap:8px;">
                  <button type="button" class="btn btn-ghost" id="btnProfileCancelForgot">Cancel</button>
                  <button type="button" class="btn btn-gold" id="btnProfileVerifyOtpReset"><i class="fa-solid fa-lock-open"></i> Verify OTP &amp; Reset Password</button>
                </div>
              </div>

              <div class="field">
                <label>New Password / PIN <small style="color:var(--txt-muted); font-weight:normal;">(Leave empty to keep existing)</small></label>
                <input type="password" id="myProfileNewPass" placeholder="New password (optional)">
              </div>
              <div class="field">
                <label>Confirm New Password / PIN</label>
                <input type="password" id="myProfileConfirmPass" placeholder="Re-enter new password">
              </div>
            </div>
            <div class="actions-row" style="margin-top:14px; justify-content:flex-end;">
              <button type="button" class="btn btn-blue" id="btnSaveMyProfile"><i class="fa-solid fa-check"></i> Save Profile Changes</button>
            </div>
          </div>

          <!-- Embedded Active Devices & Login Activity -->
          <div class="settings-card" style="margin-top:16px;">
            <div class="settings-card-title" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <span style="display:flex; align-items:center; gap:8px;">
                <i class="fa-solid fa-mobile-screen-button" style="color:var(--gold);"></i> Active Devices &amp; Login Activity
                <span id="setProfileSessionsCount" class="pill pill-blue" style="font-size:10.5px; padding:2px 8px;">Loading...</span>
              </span>
              <button type="button" class="btn btn-ghost" id="setProfileRevokeOthers" style="font-size:11.5px; padding:4px 10px;"><i class="fa-solid fa-shield-halved"></i> Log out other devices</button>
            </div>
            <p style="margin:0 0 10px; font-size:12px; color:var(--txt-muted);">
              Manage devices signed into your account. You can log out individual devices or all other sessions at once.
            </p>
            <div id="setProfileSessionsList" class="sess-list" style="max-height:220px; overflow-y:auto;">
              <div style="text-align:center; padding:14px; color:var(--txt-muted); font-size:12.5px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading active devices...</div>
            </div>
          </div>
        </div>

        <!-- Shortcuts & Hotkeys Reference Tab -->
        <div class="settings-panel" id="tab-shortcuts">
          <div class="settings-card">
            <div class="settings-card-title" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-keyboard" style="color:var(--gold);"></i> Keyboard Shortcuts &amp; Hotkeys Guide</span>
              <span class="pill pill-gold" style="font-size:11px; padding:2px 8px; font-weight:700;">Press F1 Anywhere</span>
            </div>
            <p style="margin:0 0 14px 0; font-size:12.5px; color:var(--txt-muted);">
              Operate the entire ERP system effortlessly with fast single-letter hotkeys, cascading multi-tier navigation, and double-entry voucher function keys.
            </p>
            ${getKeyboardShortcutsContentHtml()}
          </div>
        </div>

        <!-- 2. User Accounts Management Tab (Admin / SuperAdmin) -->
        ${isAdmin ? `
        <div class="settings-panel" id="tab-users">
          <div style="display:flex; flex-direction:column; gap:16px;">
            <!-- Top: Create / Update Account Form -->
            <div class="settings-card" style="margin-bottom:0;">
              <div class="settings-card-title">
                <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-user-plus" style="color:var(--blue);"></i> Create / Update User Account</span>
              </div>
              <div class="form-grid" style="margin-top:12px;">
                <div class="field"><label>Username <span class="req">*</span></label><input id="setMngUname" placeholder="e.g. amit" autocomplete="off"></div>
                <div class="field"><label>Password / PIN <span class="req">*</span></label><input type="password" id="setMngPass" placeholder="••••••••"></div>
                <div class="field"><label>Email (for OTP Login) <span class="req">*</span></label><input type="email" id="setMngEmail" placeholder="e.g. amit@example.com"></div>
                <div class="field"><label>System Privilege</label>
                  <select id="setMngRole"><option value="User">User</option><option value="Admin">Admin</option><option value="SuperAdmin">SuperAdmin</option></select>
                </div>
              </div>
              <div class="actions-row" style="margin-top:14px; flex-wrap:wrap; gap:10px;">
                <button type="button" class="btn btn-blue" id="setBtnAddUser"><i class="fa-solid fa-user-plus"></i> Add User</button>
                <button type="button" class="btn btn-ghost" id="setBtnUpdatePass"><i class="fa-solid fa-key" style="color:var(--blue);"></i> Update Pass</button>
                <button type="button" class="btn btn-ghost" id="setBtnUpdateEmail"><i class="fa-solid fa-envelope" style="color:var(--blue);"></i> Update Email</button>
              </div>
            </div>

            <!-- Bottom: Access Control Ledger Table -->
            <div class="settings-card" style="margin-bottom:0;">
              <div class="settings-card-title">
                <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-users" style="color:var(--blue);"></i> Access Control Ledger</span>
              </div>
              <div class="table-wrap" style="max-height:260px; overflow-y:auto; margin-top:10px;">
                <table>
                  <thead><tr><th>Username</th><th>Email</th><th>Role</th></tr></thead>
                  <tbody id="setUsersLedgerBody"><tr><td colspan="3" class="pl-empty-hint"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>` : ''}

        <!-- 3. Challan & Print Config Tab -->
        <div class="settings-panel" id="tab-challan">
          <div class="settings-card">
            <div class="settings-card-title" style="display:flex; align-items:center; justify-content:space-between;">
              <span><i class="fa-solid fa-barcode" style="color:var(--gold);"></i> Challan Serial Numbering Series</span>
              ${isAdmin ? '<span class="pill pill-green" style="font-size:11px; padding:2px 8px;">Admin Configurable</span>' : '<span class="pill pill-muted" style="font-size:11px; padding:2px 8px;">Read Only</span>'}
            </div>
            <p style="margin:0 0 12px 0; font-size:12.5px; color:var(--txt-muted);">
              Configure how automatic sequential delivery challan numbers are generated (Prefix, Starting Sequence, Zero-Padding, Suffix).
            </p>
            <div class="form-grid cols-2" style="margin-top:10px;">
              <div class="field">
                <label>Challan Prefix (Optional)</label>
                <input type="text" id="setChallanPrefix" placeholder="e.g. RF- or EGS-" ${isAdmin ? '' : 'readonly'}>
              </div>
              <div class="field">
                <label>Next Sequence Number <span class="req">*</span></label>
                <input type="number" id="setChallanNext" min="1" placeholder="e.g. 1 or 1001" ${isAdmin ? '' : 'readonly'}>
              </div>
              <div class="field">
                <label>Number Digit Padding</label>
                <select id="setChallanPad" ${isAdmin ? '' : 'disabled'}>
                  <option value="0">No Padding (1, 2, ...)</option>
                  <option value="2">2 Digits (01, 02, ...)</option>
                  <option value="3" selected>3 Digits (001, 002, ...)</option>
                  <option value="4">4 Digits (0001, 0002, ...)</option>
                  <option value="5">5 Digits (00001, 00002, ...)</option>
                </select>
              </div>
              <div class="field">
                <label>Challan Suffix (Optional)</label>
                <input type="text" id="setChallanSuffix" placeholder="e.g. /2026 or -A" ${isAdmin ? '' : 'readonly'}>
              </div>
            </div>

            <!-- Live Preview Display -->
            <div style="margin-top:14px; padding:12px 16px; background:rgba(218,165,32,0.08); border:1px solid rgba(218,165,32,0.25); border-radius:10px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
              <span style="font-size:13px; color:var(--txt);">Next Generated Challan Preview:</span>
              <strong id="setChallanPreview" style="font-size:16px; color:var(--gold); letter-spacing:0.5px;">...</strong>
            </div>

            ${isAdmin ? `
            <div class="actions-row" style="margin-top:14px; justify-content:flex-end;">
              <button type="button" class="btn btn-green" id="setBtnSaveChallan"><i class="fa-solid fa-floppy-disk"></i> Save Challan Configuration</button>
            </div>` : ''}
          </div>
        </div>

        <!-- 4. Appearance Tab -->
        <div class="settings-panel" id="tab-theme">
          <!-- 1. 5 High-Contrast Enterprise Themes -->
          <div class="settings-card">
            <div class="settings-card-title"><i class="fa-solid fa-circle-half-stroke" style="color:var(--gold);"></i> Workspace Themes (5 High-Contrast Presets)</div>
            <p class="note" style="margin:0 0 12px 0;">Select your preferred high-contrast workspace color theme (tested for zero glare &amp; crisp AAA readability).</p>
            <div class="profile-theme-row">
              <button type="button" class="theme-btn${activeTheme === 'dark' ? ' active' : ''}" data-theme-set="dark" title="Midnight Dark"><i class="fa-solid fa-moon"></i> Midnight Dark</button>
              <button type="button" class="theme-btn${activeTheme === 'gray' ? ' active' : ''}" data-theme-set="gray" title="Charcoal Slate"><i class="fa-solid fa-circle-half-stroke"></i> Charcoal Slate</button>
              <button type="button" class="theme-btn${activeTheme === 'light' ? ' active' : ''}" data-theme-set="light" title="Cloud Light"><i class="fa-solid fa-sun"></i> Cloud Light</button>
              <button type="button" class="theme-btn${activeTheme === 'emerald' ? ' active' : ''}" data-theme-set="emerald" title="Solar Emerald"><i class="fa-solid fa-leaf" style="color:#2ecc71;"></i> Solar Emerald</button>
              <button type="button" class="theme-btn${activeTheme === 'ocean' ? ' active' : ''}" data-theme-set="ocean" title="Deep Ocean"><i class="fa-solid fa-water" style="color:#38bdf8;"></i> Deep Ocean</button>
            </div>
          </div>

          <!-- 2. Official Enterprise Typography & Font Family -->
          <div class="settings-card" style="margin-top:16px;">
            <div class="settings-card-title"><i class="fa-solid fa-font" style="color:var(--blue);"></i> System Typography &amp; Font Family</div>
            <p class="note" style="margin:0 0 12px 0;">Select an official, high-legibility enterprise typeface (no cursive, only clean professional fonts).</p>
            <div class="font-selector-grid">
              <button type="button" class="theme-btn${activeFont === 'segoe' ? ' active' : ''}" data-font-set="segoe" style="font-family:'Segoe UI', system-ui, sans-serif; justify-content:flex-start; padding:10px 14px;">
                <i class="fa-solid fa-font" style="font-size:12px;"></i> Segoe UI (System)
              </button>
              <button type="button" class="theme-btn${activeFont === 'inter' ? ' active' : ''}" data-font-set="inter" style="font-family:'Inter', sans-serif; justify-content:flex-start; padding:10px 14px;">
                <i class="fa-solid fa-font" style="font-size:12px;"></i> Inter Modern
              </button>
              <button type="button" class="theme-btn${activeFont === 'roboto' ? ' active' : ''}" data-font-set="roboto" style="font-family:'Roboto', sans-serif; justify-content:flex-start; padding:10px 14px;">
                <i class="fa-solid fa-font" style="font-size:12px;"></i> Roboto Corporate
              </button>
              <button type="button" class="theme-btn${activeFont === 'jakarta' ? ' active' : ''}" data-font-set="jakarta" style="font-family:'Plus Jakarta Sans', sans-serif; justify-content:flex-start; padding:10px 14px;">
                <i class="fa-solid fa-font" style="font-size:12px;"></i> Plus Jakarta
              </button>
              <button type="button" class="theme-btn${activeFont === 'outfit' ? ' active' : ''}" data-font-set="outfit" style="font-family:'Outfit', sans-serif; justify-content:flex-start; padding:10px 14px;">
                <i class="fa-solid fa-font" style="font-size:12px;"></i> Outfit Tech
              </button>
              <button type="button" class="theme-btn${activeFont === 'jetbrains' ? ' active' : ''}" data-font-set="jetbrains" style="font-family:'JetBrains Mono', monospace; justify-content:flex-start; padding:10px 14px;">
                <i class="fa-solid fa-terminal" style="font-size:12px;"></i> JetBrains Mono
              </button>
            </div>
          </div>

          <!-- 3. Avatar Circle / Background Color Customizer -->
          <div class="settings-card" style="margin-top:16px;">
            <div class="settings-card-title"><i class="fa-solid fa-circle-user" style="color:var(--gold);"></i> User Avatar Circle Accent Color</div>
            <p class="note" style="margin:0 0 12px 0;">Customize the background badge and border color of your profile avatar across the sidebar and headers.</p>
            <div class="avatar-palette-row">
              <button type="button" class="avatar-color-btn${activeAvatar === 'gold' ? ' active' : ''}" data-avatar-set="gold" title="Solar Gold" style="background:linear-gradient(135deg, #D4AF37, #B6952C); color:#111; border:2px solid #D4AF37;">A</button>
              <button type="button" class="avatar-color-btn${activeAvatar === 'blue' ? ' active' : ''}" data-avatar-set="blue" title="Royal Blue" style="background:linear-gradient(135deg, #3B8ED0, #2563EB); color:#fff; border:2px solid #3B8ED0;">A</button>
              <button type="button" class="avatar-color-btn${activeAvatar === 'emerald' ? ' active' : ''}" data-avatar-set="emerald" title="Emerald Green" style="background:linear-gradient(135deg, #2ECC71, #27AE60); color:#fff; border:2px solid #2ECC71;">A</button>
              <button type="button" class="avatar-color-btn${activeAvatar === 'purple' ? ' active' : ''}" data-avatar-set="purple" title="Purple Violet" style="background:linear-gradient(135deg, #9B59B6, #8E44AD); color:#fff; border:2px solid #9B59B6;">A</button>
              <button type="button" class="avatar-color-btn${activeAvatar === 'crimson' ? ' active' : ''}" data-avatar-set="crimson" title="Crimson Red" style="background:linear-gradient(135deg, #E74C3C, #C0392B); color:#fff; border:2px solid #E74C3C;">A</button>
              <button type="button" class="avatar-color-btn${activeAvatar === 'cyan' ? ' active' : ''}" data-avatar-set="cyan" title="Cyan Teal" style="background:linear-gradient(135deg, #00C0EF, #0097A7); color:#fff; border:2px solid #00C0EF;">A</button>
              <button type="button" class="avatar-color-btn${activeAvatar === 'amber' ? ' active' : ''}" data-avatar-set="amber" title="Sunset Amber" style="background:linear-gradient(135deg, #F39C12, #E67E22); color:#fff; border:2px solid #F39C12;">A</button>
              <button type="button" class="avatar-color-btn${activeAvatar === 'slate' ? ' active' : ''}" data-avatar-set="slate" title="Slate Titanium" style="background:linear-gradient(135deg, #64748B, #475569); color:#fff; border:2px solid #64748B;">A</button>
            </div>
          </div>

          <!-- 4. Display Density & Animation -->
          <div class="settings-card" style="margin-top:16px;">
            <div class="settings-card-title"><i class="fa-solid fa-table-cells" style="color:var(--blue);"></i> Display Density &amp; Animation</div>
            <div style="display:flex; flex-direction:column; gap:14px; margin-top:12px;">
              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckAnimations" ${isSmoothSaved ? 'checked' : ''} style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:600; color:var(--txt); font-size:13px;">Smooth UI Animations &amp; Transitions</div>
                  <div style="font-size:12px; color:var(--txt-muted);">Enables smooth modal transitions, tab fades, and button interactive effects.</div>
                </div>
              </label>
              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckCompactTables" ${isCompactSaved ? 'checked' : ''} style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:600; color:var(--txt); font-size:13px;">Compact Table Row Density (High Information Density)</div>
                  <div style="font-size:12px; color:var(--txt-muted);">Reduces table row heights and cell padding to display 50%+ more inventory &amp; ledger rows simultaneously on PC screens.</div>
                </div>
              </label>
            </div>
          </div>

          <!-- 5. Live Appearance Preview Banner -->
          <div class="settings-card" style="margin-top:16px; background:linear-gradient(145deg, rgba(255,255,255,0.03), rgba(0,0,0,0.25)); border:1px solid var(--border-light);">
            <div class="settings-card-title"><i class="fa-solid fa-eye" style="color:var(--gold);"></i> Live Appearance Preview</div>
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; padding:12px 14px; background:var(--panel-alt); border-radius:12px; border:1px solid var(--border);">
              <div style="display:flex; align-items:center; gap:12px;">
                <div id="setPreviewAvatarCircle" class="avatar" style="width:44px; height:44px; font-size:16px;">${(currentUsername[0] || 'U').toUpperCase()}</div>
                <div>
                  <div id="setPreviewUserName" style="font-weight:700; font-size:14px; color:var(--txt);">@${currentUsername}</div>
                  <div style="font-size:11.5px; color:var(--txt-muted); display:flex; align-items:center; gap:6px; margin-top:2px;">
                    <span id="setPreviewRolePill" class="pill pill-gold">${currentRole}</span>
                    <span id="setPreviewFontLabel" style="font-style:italic;">Font: Segoe UI</span>
                  </div>
                </div>
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span id="setPreviewThemeBadge" class="pill pill-blue"><i class="fa-solid fa-moon"></i> Midnight Dark</span>
              </div>
            </div>
          </div>

          <!-- 6. Dashboard Widgets Launcher -->
          <div class="settings-card" style="margin-top:16px;">
            <div class="settings-card-title"><i class="fa-solid fa-sliders" style="color:var(--blue);"></i> Dashboard Widgets &amp; Metrics</div>
            <p style="margin:0 0 14px; font-size:12.5px; color:var(--txt-muted);">
              Choose which metric cards, solar generation summaries, and tables appear on your ERP Dashboard. You can also re-enable hidden sections anytime from here.
            </p>
            <button type="button" class="btn btn-blue" id="btnOpenDashCustomizerFromSettings"><i class="fa-solid fa-sliders"></i> Customize Dashboard Widgets</button>
          </div>

          <!-- 7. Save Appearance Action Bar -->
          <div class="actions-row" style="margin-top:18px; justify-content:flex-end; border-top:1px solid var(--border-light); padding-top:14px;">
            <button type="button" class="btn btn-green" id="btnSaveAppearanceSettings" style="padding:11px 24px; font-size:13.5px; font-weight:700; box-shadow:0 4px 14px rgba(46,204,113,0.3);">
              <i class="fa-solid fa-floppy-disk"></i> Save Appearance Preferences
            </button>
          </div>
        </div>

        <!-- 5. Company Profile Tab -->
        <div class="settings-panel" id="tab-company">
          <div class="settings-card">
            <div class="settings-card-title"><i class="fa-solid fa-building" style="color:var(--blue);"></i> Enterprise Identity</div>
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
                <label>Operating State &amp; City</label>
                <input type="text" value="Gujarat — Surat" readonly>
              </div>
              <div class="field">
                <label>Default Currency</label>
                <input type="text" value="INR (₹)" readonly>
              </div>
            </div>
          </div>
          <div class="settings-card">
            <div class="settings-card-title"><i class="fa-solid fa-code" style="color:var(--gold);"></i> System Attribution</div>
            <p style="margin:0; font-size:13px; color:var(--txt-muted);">
              Eco Green Solar ERP Suite • Developed by <strong style="color:var(--gold);">Sumit Chauhan</strong>
            </p>
          </div>
        </div>

        <!-- 6. Alerts & Inventory Tab -->
        <div class="settings-panel" id="tab-inventory">
          <!-- Card 1: Stock Thresholds & Scanner Audio -->
          <div class="settings-card">
            <div class="settings-card-title" style="display:flex; align-items:center; justify-content:space-between;">
              <span><i class="fa-solid fa-boxes-stacked" style="color:var(--gold);"></i> Stock Thresholds &amp; Scanner Audio</span>
              ${isAdmin ? '<span class="pill pill-green" style="font-size:11px; padding:2px 8px;">Admin Configurable</span>' : '<span class="pill pill-muted" style="font-size:11px; padding:2px 8px;">Read Only</span>'}
            </div>
            <div class="form-grid cols-2" style="margin-top:10px;">
              <div class="field">
                <label style="font-weight:600; color:var(--txt); font-size:12px; margin-bottom:6px; display:block;">Low Stock Warning Threshold (Units) <span class="req">*</span></label>
                <input type="number" id="setLowStockThreshold" min="1" placeholder="5" class="settings-email-input" ${isAdmin ? '' : 'readonly'}>
              </div>
              <div class="field">
                <label style="font-weight:600; color:var(--txt); font-size:12px; margin-bottom:6px; display:block;">Scan Sheet Audio Feedback</label>
                <div style="display:flex; gap:6px;">
                  <select id="setScannerSound" class="settings-email-input" style="flex:1;">
                    <option value="beep" ${activeSoundSaved === 'beep' ? 'selected' : ''}>Classic ERP Beep (850Hz)</option>
                    <option value="chime" ${activeSoundSaved === 'chime' ? 'selected' : ''}>High Chime Tone (1200Hz)</option>
                    <option value="melody" ${activeSoundSaved === 'melody' ? 'selected' : ''}>Two-Tone Success Melody (650Hz ➔ 1050Hz)</option>
                    <option value="click" ${activeSoundSaved === 'click' ? 'selected' : ''}>Subtle Soft Click</option>
                    <option value="mute" ${activeSoundSaved === 'mute' ? 'selected' : ''}>Mute / Disabled</option>
                  </select>
                  <button type="button" class="btn btn-ghost" id="btnTestScannerSound" title="Listen to selected sound"><i class="fa-solid fa-volume-high"></i> Test</button>
                </div>
              </div>
            </div>
            ${isAdmin ? `
            <div class="actions-row" style="margin-top:14px; justify-content:flex-end; border-top:1px solid var(--border-light); padding-top:12px;">
              <button type="button" class="btn btn-green" id="setBtnSaveStockScanner"><i class="fa-solid fa-floppy-disk"></i> Save Stock &amp; Scanner Settings</button>
            </div>` : ''}
          </div>

          <!-- Card 2: Automated Email Alert Triggers -->
          <div class="settings-card" style="margin-top:16px;">
            <div class="settings-card-title"><i class="fa-solid fa-envelope" style="color:var(--blue);"></i> Automated Email Alert Triggers</div>
            <p style="margin:0 0 14px; font-size:12.5px; color:var(--txt-muted);">
              Set recipient Gmail address(es) for automated ERP notifications. Multiple email addresses can be added separated by commas.
            </p>

            <div style="display:flex; flex-direction:column; gap:12px; margin-top:8px;">
              <!-- Low Stock Email Alert -->
              <div class="settings-email-card">
                <label style="display:flex; align-items:center; gap:9px; cursor:pointer; margin-bottom:10px;">
                  <input type="checkbox" id="setCheckLowStockEmail" style="accent-color:var(--gold); transform:scale(1.15);" ${isAdmin ? '' : 'disabled'}>
                  <strong style="color:var(--txt); font-size:13.5px;"><i class="fa-solid fa-triangle-exclamation" style="color:var(--gold); margin-right:4px;"></i> Low Stock Warning Email Alert</strong>
                </label>
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:12px; font-weight:600; color:var(--txt); margin-bottom:6px; display:block;">Recipient Email Address(es) for Low Stock Alerts</label>
                  <div style="display:flex; gap:8px;">
                    <input type="text" id="setLowStockEmails" class="settings-email-input" placeholder="e.g. store@gmail.com, purchase@gmail.com" ${isAdmin ? '' : 'readonly'}>
                    ${isAdmin ? `<button type="button" class="btn btn-ghost" id="btnTestLowStockEmail" title="Send a verification test email to verify address"><i class="fa-solid fa-paper-plane"></i> Test Mail</button>` : ''}
                  </div>
                </div>
              </div>

              <!-- Dispatch Email Alert -->
              <div class="settings-email-card">
                <label style="display:flex; align-items:center; gap:9px; cursor:pointer; margin-bottom:10px;">
                  <input type="checkbox" id="setCheckDispatchEmail" style="accent-color:var(--gold); transform:scale(1.15);" ${isAdmin ? '' : 'disabled'}>
                  <strong style="color:var(--txt); font-size:13.5px;"><i class="fa-solid fa-truck-fast" style="color:var(--blue); margin-right:4px;"></i> BOM Challan &amp; Dispatch Summary Email</strong>
                </label>
                <div class="field" style="margin-bottom:0;">
                  <label style="font-size:12px; font-weight:600; color:var(--txt); margin-bottom:6px; display:block;">Recipient Email Address(es) for Dispatch Alerts</label>
                  <div style="display:flex; gap:8px;">
                    <input type="text" id="setDispatchEmails" class="settings-email-input" placeholder="e.g. dispatch@gmail.com, logistics@gmail.com" ${isAdmin ? '' : 'readonly'}>
                    ${isAdmin ? `<button type="button" class="btn btn-ghost" id="btnTestDispatchEmail" title="Send a verification test email to verify address"><i class="fa-solid fa-paper-plane"></i> Test Mail</button>` : ''}
                  </div>
                </div>
              </div>
            </div>

            ${isAdmin ? `
            <div class="actions-row" style="margin-top:16px; justify-content:flex-end; border-top:1px solid var(--border-light); padding-top:12px;">
              <button type="button" class="btn btn-green" id="setBtnSaveEmailAlerts"><i class="fa-solid fa-floppy-disk"></i> Save Email Notification Settings</button>
            </div>` : ''}
          </div>
        </div>

        <!-- 5. Device & Notifications Tab -->
        <div class="settings-panel" id="tab-permissions">
          <!-- Card 1: System Level Permissions -->
          <div class="settings-card">
            <div class="settings-card-title">
              <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-shield-halved" style="color:var(--blue);"></i> System &amp; Hardware Permissions</span>
            </div>
            <p style="margin:0 0 14px; font-size:12.5px; color:var(--txt-muted);">
              Manage native OS and browser device permissions. Requesting or enabling an option directly prompts the system security dialog (Allow while using app / Only this time / Don't allow).
            </p>

            <div class="egs-perm-list">
              <!-- Push Notifications -->
              <div class="egs-perm-item">
                <div class="egs-perm-icon notify"><i class="fa-solid fa-bell"></i></div>
                <div class="egs-perm-meta">
                  <div class="egs-perm-name">
                    <span>Push &amp; System Notifications</span>
                    <span id="permBadgeNotify" class="pill pill-gold">Checking...</span>
                  </div>
                  <div class="egs-perm-desc">Real-time alerts for Dispatches, Low Stock warnings, and Background Sync.</div>
                </div>
                <div class="egs-perm-actions">
                  <button type="button" class="btn btn-blue" id="btnRequestNotifyPerm"><i class="fa-solid fa-bell"></i> Request Permission</button>
                  <button type="button" class="btn btn-ghost" id="btnTestNotifyPerm"><i class="fa-solid fa-paper-plane"></i> Test Notification</button>
                </div>
              </div>

              <!-- Camera Scanner -->
              <div class="egs-perm-item">
                <div class="egs-perm-icon camera"><i class="fa-solid fa-camera"></i></div>
                <div class="egs-perm-meta">
                  <div class="egs-perm-name">
                    <span>Camera (Barcode &amp; QR Scanning)</span>
                    <span id="permBadgeCamera" class="pill pill-gold">Checking...</span>
                  </div>
                  <div class="egs-perm-desc">Hardware camera access for physical barcode and QR scanning across inventory modules.</div>
                </div>
                <div class="egs-perm-actions">
                  <button type="button" class="btn btn-blue" id="btnRequestCameraPerm"><i class="fa-solid fa-camera"></i> Request Permission</button>
                </div>
              </div>

              <!-- Microphone -->
              <div class="egs-perm-item">
                <div class="egs-perm-icon mic"><i class="fa-solid fa-microphone"></i></div>
                <div class="egs-perm-meta">
                  <div class="egs-perm-name">
                    <span>Microphone (Voice Input)</span>
                    <span id="permBadgeMic" class="pill pill-gold">Checking...</span>
                  </div>
                  <div class="egs-perm-desc">Voice commands and serial number voice dictation support.</div>
                </div>
                <div class="egs-perm-actions">
                  <button type="button" class="btn btn-blue" id="btnRequestMicPerm"><i class="fa-solid fa-microphone"></i> Request Permission</button>
                </div>
              </div>

              <!-- Persistent Storage -->
              <div class="egs-perm-item">
                <div class="egs-perm-icon storage"><i class="fa-solid fa-hard-drive"></i></div>
                <div class="egs-perm-meta">
                  <div class="egs-perm-name">
                    <span>Persistent Offline Storage</span>
                    <span id="permBadgeStorage" class="pill pill-green"><i class="fa-solid fa-circle-check"></i> Active</span>
                  </div>
                  <div class="egs-perm-desc">Guarantees local SQLite/IndexedDB offline databases won't be cleared by the OS.</div>
                </div>
                <div class="egs-perm-actions">
                  <button type="button" class="btn btn-ghost" id="btnRequestStoragePerm"><i class="fa-solid fa-database"></i> Enable Persist</button>
                </div>
              </div>
            </div>
          </div>

          <!-- Card 2: Physical Audio & Installation -->
          <div class="settings-card" style="margin-top:14px;">
            <div class="settings-card-title">
              <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-volume-high" style="color:var(--gold);"></i> Scanner Audio &amp; App Installation</span>
            </div>
            
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:14px; margin-top:12px;">
              <div class="egs-setting-box">
                <label style="font-size:12.5px; font-weight:600; color:var(--txt); display:block; margin-bottom:6px;">Scanner Audio Feedback</label>
                <select id="setScannerAudioSelect" class="form-control" style="width:100%;">
                  <option value="beep">Standard POS Beep</option>
                  <option value="chime">Modern Upbeat Chime</option>
                  <option value="success">Melodic Success Chime</option>
                  <option value="silent">Silent (No Audio)</option>
                </select>
                <button type="button" class="btn btn-ghost btn-sm" id="btnTestScannerAudio" style="margin-top:8px; font-size:12px;"><i class="fa-solid fa-play"></i> Play Sample Sound</button>
              </div>

              <div class="egs-setting-box">
                <label style="font-size:12.5px; font-weight:600; color:var(--txt); display:block; margin-bottom:6px;">Application Installation</label>
                <div style="font-size:12.5px; color:var(--txt-muted); margin-bottom:10px;" id="setPwaModeVal">Browser Tab (PWA Ready)</div>
                <button type="button" class="btn btn-gold" onclick="window.openAppInstallGuide()"><i class="fa-solid fa-download"></i> Install App on Device</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Privacy Policy & Legal Terms Tab -->
        <div class="settings-panel" id="tab-privacy">
          <div class="settings-card">
            <div class="settings-card-title">
              <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-shield-halved" style="color:var(--blue);"></i> Enterprise Privacy Policy &amp; Data Security</span>
            </div>
            <p style="margin:0 0 14px; font-size:12.5px; color:var(--txt-muted);">
              Official security terms, data privacy practices, and enterprise compliance standards governing Eco Green Solar ERP.
            </p>

            <div class="egs-legal-doc">
              <div class="egs-legal-section">
                <div class="egs-legal-h4">1. Enterprise Data Encryption &amp; Security</div>
                <p>All communication between your browser or device and the Eco Green Solar ERP Cloud is protected using 256-bit TLS/SSL encryption and HSTS headers. Sensitive authentication credentials, including passwords and PINs, are irreversibly salted and hashed with bcrypt. User access tokens are cryptographically signed with short-lived expiration.</p>
              </div>

              <div class="egs-legal-section">
                <div class="egs-legal-h4">2. Role-Based Access Control &amp; Audit Logs</div>
                <p>System features, pricing, stock ledgers, and BOM dispatches are strictly compartmentalized based on your assigned user role (SuperAdmin, Admin, User). All sensitive transactional actions, master deletions, and batch modifications are permanently logged with user ID, timestamp, and client IP metadata for enterprise accountability.</p>
              </div>

              <div class="egs-legal-section">
                <div class="egs-legal-h4">3. Offline Cache &amp; Device Storage Privacy</div>
                <p>When operating in Offline-First mode, scanned serial numbers and pending dispatch records are stored locally within your device's sandboxed IndexedDB and encrypted local storage. This data is strictly private to this device and automatically synchronizes with the central database upon internet restoration.</p>
              </div>

              <div class="egs-legal-section">
                <div class="egs-legal-h4">4. Push Notifications &amp; Alert Telemetry</div>
                <p>Device notification tokens and camera permissions are utilized exclusively for physical barcode scanning and real-time operational notifications (e.g. low stock alerts, dispatch generation). No private browsing history, audio recordings, or personal data is collected or transmitted.</p>
              </div>

              <div class="egs-legal-section">
                <div class="egs-legal-h4">5. Data Ownership &amp; Confidentiality</div>
                <p>All inventory records, serial scan ledgers, party accounts, and customer details remain the exclusive proprietary property of Eco Green Solar Pvt. Ltd. No third-party data tracking, advertising pixels, or external analytics SDKs are incorporated into this platform.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- About ERP & Live Version Tab -->
        <div class="settings-panel" id="tab-about">
          <div class="settings-card egs-about-hero-clean">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px;">
              <div style="display:flex; align-items:center; gap:16px;">
                <div style="width:58px; height:58px; min-width:58px; border-radius:50%; background:#ffffff; display:flex; align-items:center; justify-content:center; padding:6px; box-shadow:0 4px 16px rgba(0,0,0,0.3); flex-shrink:0;">
                  <img src="assets/icons/icon-192.png" style="width:100%; height:100%; object-fit:contain; border-radius:50%;" alt="Eco Green Solar Logo">
                </div>
                <div>
                  <div style="font-size:16.5px; font-weight:800; color:var(--txt); letter-spacing:-0.01em;">Eco Green Solar ERP</div>
                  <div style="font-size:12.5px; color:var(--txt-muted); margin-top:2px;">Enterprise Operations &amp; Inventory Suite</div>
                  <div style="display:flex; align-items:center; gap:6px; margin-top:8px;">
                    <span class="pill pill-gold" style="font-size:11px; padding:2px 10px;">v1.10.0 Enterprise</span>
                    <span class="pill pill-green" style="font-size:11px; padding:2px 10px;">Build 112 (Live)</span>
                  </div>
                </div>
              </div>
              <button type="button" class="btn btn-blue" id="btnAboutCheckUpdate" style="padding:9px 18px; font-size:13px;">
                <i class="fa-solid fa-arrows-rotate"></i> Check for Updates
              </button>
            </div>
          </div>

          <div class="settings-card">
            <div class="settings-card-title">
              <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-sliders" style="color:var(--blue);"></i> System Specifications &amp; Environment</span>
            </div>
            
            <div class="egs-about-specs-table">
              <div class="egs-about-spec-row">
                <div class="egs-spec-key"><i class="fa-solid fa-code-branch"></i> Release Track</div>
                <div class="egs-spec-val" style="color:var(--blue); font-weight:600;">v1.10.0 Enterprise Monolith</div>
              </div>
              <div class="egs-about-spec-row">
                <div class="egs-spec-key"><i class="fa-solid fa-server"></i> Backend Engine</div>
                <div class="egs-spec-val">Node.js 20+ High-Performance Monolith</div>
              </div>
              <div class="egs-about-spec-row">
                <div class="egs-spec-key"><i class="fa-solid fa-database"></i> Database Cluster</div>
                <div class="egs-spec-val">MySQL 8.0 Concurrency Pool (10 Conn)</div>
              </div>
              <div class="egs-about-spec-row">
                <div class="egs-spec-key"><i class="fa-solid fa-bolt"></i> Memory &amp; Cache</div>
                <div class="egs-spec-val" style="color:var(--green);"><i class="fa-solid fa-circle-check" style="font-size:11px;"></i> L1 RAM + L2 In-Memory Fast-Path</div>
              </div>
              <div class="egs-about-spec-row">
                <div class="egs-spec-key"><i class="fa-solid fa-hard-drive"></i> PWA &amp; Offline Engine</div>
                <div class="egs-spec-val">Service Worker v112 + IndexedDB Sync</div>
              </div>
              <div class="egs-about-spec-row">
                <div class="egs-spec-key"><i class="fa-solid fa-shield-halved"></i> Security &amp; Network</div>
                <div class="egs-spec-val">TLS 1.3 / SSL Encryption + Gzip Transport</div>
              </div>
              <div class="egs-about-spec-row">
                <div class="egs-spec-key"><i class="fa-solid fa-building"></i> Organization</div>
                <div class="egs-spec-val">Eco Green Solar Pvt. Ltd.</div>
              </div>
              <div class="egs-about-spec-row">
                <div class="egs-spec-key"><i class="fa-solid fa-user-tie"></i> Lead Developer</div>
                <div class="egs-spec-val" style="color:var(--blue); font-weight:600;">Sumit Chauhan</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Roadmap Tab -->
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

        <!-- Audit Trail & Enterprise Mutation Logs Tab -->
        <div class="settings-panel" id="tab-audit">
          <div class="settings-card">
            <div class="settings-card-title" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-shield-halved" style="color:var(--gold);"></i> Enterprise Audit Trail &amp; Mutations</span>
              <button type="button" class="btn btn-blue" id="btnRefreshAuditLogs" style="font-size:11.5px; padding:4px 10px;"><i class="fa-solid fa-rotate"></i> Refresh Feed</button>
            </div>
            <p style="margin:0 0 12px 0; font-size:12.5px; color:var(--txt-muted);">
              Live audit trail of enterprise transactions: Inwards, Dispatches, Deletions, Vouchers, and Security events.
            </p>

            <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px; align-items:center;">
              <input type="text" id="auditSearchInput" placeholder="Search reference, user, or details..." style="flex:1 1 180px; min-width:0;">
              <select id="auditModuleFilter" style="width:min(170px, 100%); min-width:140px;">
                <option value="ALL">All Operations</option>
                <option value="PURCHASE">Purchase Inward</option>
                <option value="SALES">Sales / Dispatch</option>
                <option value="VOUCHER">Double-Entry Vouchers</option>
                <option value="STOCK">Stock Adjustments</option>
                <option value="SECURITY">Security &amp; Auth</option>
              </select>
            </div>

            <div id="auditTimelineContainer">
              <div style="text-align:center; padding:24px; color:var(--txt-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Loading live activity feed...</div>
            </div>
          </div>
        </div>

        <!-- Performance & System Telemetry Tab -->
        ${isAdmin ? `
        <div class="settings-panel" id="tab-perf">
          <div class="settings-card">
            <div class="settings-card-title" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <span style="display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-gauge-high" style="color:var(--gold);"></i> High-Speed Engine Telemetry &amp; Caches</span>
              <div style="display:flex; gap:8px;">
                <button type="button" class="btn btn-ghost" id="btnPurgeClientCache" style="font-size:11.5px; padding:4px 10px;"><i class="fa-solid fa-broom"></i> Purge Client Cache</button>
                <button type="button" class="btn btn-blue" id="btnRefreshPerfStats" style="font-size:11.5px; padding:4px 10px;"><i class="fa-solid fa-rotate"></i> Refresh</button>
              </div>
            </div>
            <p style="margin:0 0 14px 0; font-size:12.5px; color:var(--txt-muted);">
              Real-time backend connection pool saturation, multi-tier memory caching hit rates, database scale, and client latency.
            </p>
            <div id="perfTelemetryContainer">
              <div style="text-align:center; padding:20px; color:var(--txt-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Fetching real-time telemetry...</div>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- ERP Mode & Feature Switches Tab -->
        <div class="settings-panel" id="tab-erp-mode">
          <!-- Card 1: ERP Core Operating Mode -->
          <div class="settings-card">
            <div class="settings-card-title" style="display:flex; align-items:center; justify-content:space-between;">
              <span><i class="fa-solid fa-layer-group" style="color:var(--gold);"></i> Core ERP Operating Mode</span>
              <span class="pill pill-green" style="font-size:11px; padding:2px 8px;">Instant Switch</span>
            </div>
            <p style="margin:0 0 14px; font-size:12.5px; color:var(--txt-muted);">
              Select how your enterprise tracks inventory, serial numbers, and accounting across the entire software. Switching modes applies dynamically without code modifications.
            </p>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap:12px;" id="erpModeRadioGroup">
              
              <label class="egs-mode-card" style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; background:var(--panel-alt); border:1.5px solid var(--border); border-radius:10px; cursor:pointer; transition:all 0.15s ease;">
                <input type="radio" name="setErpMode" value="hybrid" style="accent-color:var(--blue); margin-top:3px; transform:scale(1.2);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13.5px;"><i class="fa-solid fa-solar-panel" style="color:var(--gold); margin-right:4px;"></i> Hybrid (Serial + Quantity) <span class="pill pill-gold" style="font-size:10px; padding:1px 6px;">Recommended</span></div>
                  <div style="font-size:12px; color:var(--txt-muted); margin-top:3px;">Track high-value items (Panels, Inverters) by unique Serial Numbers, and cables, hardware, civil items by Quantity &amp; UOM.</div>
                </div>
              </label>

              <label class="egs-mode-card" style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; background:var(--panel-alt); border:1.5px solid var(--border); border-radius:10px; cursor:pointer; transition:all 0.15s ease;">
                <input type="radio" name="setErpMode" value="serial_only" style="accent-color:var(--blue); margin-top:3px; transform:scale(1.2);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13.5px;"><i class="fa-solid fa-barcode" style="color:var(--blue); margin-right:4px;"></i> Strict Serial-Only Inventory</div>
                  <div style="font-size:12px; color:var(--txt-muted); margin-top:3px;">Every single inward/outward item requires an individual barcode / serial scan for strict warranty management.</div>
                </div>
              </label>

              <label class="egs-mode-card" style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; background:var(--panel-alt); border:1.5px solid var(--border); border-radius:10px; cursor:pointer; transition:all 0.15s ease;">
                <input type="radio" name="setErpMode" value="quantity_only" style="accent-color:var(--blue); margin-top:3px; transform:scale(1.2);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13.5px;"><i class="fa-solid fa-cubes-stacked" style="color:#2ecc71; margin-right:4px;"></i> Quantity &amp; UOM Bulk Mode</div>
                  <div style="font-size:12px; color:var(--txt-muted); margin-top:3px;">No serial number scans required anywhere. High-speed bulk inward/dispatch using decimals (Kg, Feet, Meters, Sets).</div>
                </div>
              </label>

              <label class="egs-mode-card" style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; background:var(--panel-alt); border:1.5px solid var(--border); border-radius:10px; cursor:pointer; transition:all 0.15s ease;">
                <input type="radio" name="setErpMode" value="full_accounting" style="accent-color:var(--blue); margin-top:3px; transform:scale(1.2);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13.5px;"><i class="fa-solid fa-file-invoice-dollar" style="color:#a855f7; margin-right:4px;"></i> Full Accounting + Inventory ERP</div>
                  <div style="font-size:12px; color:var(--txt-muted); margin-top:3px;">Complete item stock control + Rate, Price, GST/Tax computation, and Debit/Credit party ledger accounting.</div>
                </div>
              </label>

              <label class="egs-mode-card" style="display:flex; align-items:flex-start; gap:12px; padding:12px 14px; background:var(--panel-alt); border:1.5px solid var(--border); border-radius:10px; cursor:pointer; transition:all 0.15s ease;">
                <input type="radio" name="setErpMode" value="accounts_only" style="accent-color:var(--blue); margin-top:3px; transform:scale(1.2);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13.5px;"><i class="fa-solid fa-book" style="color:var(--red); margin-right:4px;"></i> Financial Accounting Only (No Stock)</div>
                  <div style="font-size:12px; color:var(--txt-muted); margin-top:3px;">Hides physical warehouse &amp; stock allocation; operates as a pure financial ledger &amp; voucher accounting system.</div>
                </div>
              </label>

            </div>
          </div>

          <!-- Card 2: Feature Switchboard & Mandatory Rules -->
          <div class="settings-card" style="margin-top:16px;">
            <div class="settings-card-title"><i class="fa-solid fa-toggle-on" style="color:var(--blue);"></i> Feature Switchboard &amp; Mandatory Rules</div>
            
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap:14px; margin-top:12px;">
              
              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckFeatureBom" style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13px;">BOM Kit Assembly &amp; Project Dispatch</div>
                  <div style="font-size:11.5px; color:var(--txt-muted);">Enable multi-item Bill of Materials kits and automated customer dispatch challans.</div>
                </div>
              </label>

              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckFeaturePricing" style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13px;">Pricing &amp; Rate Valuation in Forms</div>
                  <div style="font-size:11.5px; color:var(--txt-muted);">Show Unit Rate, Subtotal, and GST columns during Purchase Inward and Sales.</div>
                </div>
              </label>

              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckFeatureWarehouse" style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13px;">Warehouse &amp; Godown Hub Tracking</div>
                  <div style="font-size:11.5px; color:var(--txt-muted);">Track specific godown / warehouse locations for all stock transactions.</div>
                </div>
              </label>

              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckFeaturePallet" style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13px;">Pallet ID Allocation</div>
                  <div style="font-size:11.5px; color:var(--txt-muted);">Enable Pallet / Box grouping for incoming solar panels &amp; modules.</div>
                </div>
              </label>

              <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
                <input type="checkbox" id="setCheckFeatureProofMandatory" style="accent-color:var(--gold); margin-top:3px; transform:scale(1.15);">
                <div>
                  <div style="font-weight:700; color:var(--txt); font-size:13px;">Invoice / Challan Attachment Mandatory</div>
                  <div style="font-size:11.5px; color:var(--txt-muted);">Block saving inward/sales vouchers without an uploaded PDF/Photo proof.</div>
                </div>
              </label>

              <div class="field" style="margin:0;">
                <label style="font-weight:700; color:var(--txt); font-size:13px; display:block; margin-bottom:4px;">Wattage Requirement Rule</label>
                <select id="setFeatureWattRule" class="form-control" style="width:100%; font-size:12.5px;">
                  <option value="auto">Auto (Only for Solar Panels &amp; Inverters)</option>
                  <option value="always">Always Mandatory for all categories</option>
                  <option value="never">Optional / Disabled</option>
                </select>
              </div>

            </div>

            <div class="actions-row" style="margin-top:18px; justify-content:flex-end; border-top:1px solid var(--border-light); padding-top:14px;">
              <button type="button" class="btn btn-green" id="btnSaveErpModeSettings" style="padding:11px 24px; font-size:13.5px; font-weight:700; box-shadow:0 4px 14px rgba(46,204,113,0.3);">
                <i class="fa-solid fa-floppy-disk"></i> Save ERP Operating Mode &amp; Features
              </button>
            </div>
          </div>
        </div>
        </div>
      </div>
    `;

    window.openModal('⚙️ System & ERP Settings', settingsHtml, { size: 'large', modalClass: 'settings-modal-box' });

    // Wire Settings Tabs
    const tabBtns = document.querySelectorAll('.settings-tab-btn');
    const panels = document.querySelectorAll('.settings-panel');
    const contentWrap = document.querySelector('.settings-content-wrap');
    function activateTab(tabId) {
      tabBtns.forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === tabId));
      panels.forEach((p) => p.classList.toggle('active', p.id === tabId));
      if (contentWrap) contentWrap.scrollTop = 0;
      if (tabId === 'tab-audit') {
        loadActivityAuditFeed();
      }
      if (tabId === 'tab-perf') {
        loadPerformanceTelemetry();
      }
    }
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => activateTab(btn.getAttribute('data-tab')));
    });

    // Activity Timeline & Audit Feed Handlers
    async function loadActivityAuditFeed() {
      const container = document.getElementById('auditTimelineContainer');
      const searchInput = document.getElementById('auditSearchInput');
      const moduleFilter = document.getElementById('auditModuleFilter');
      if (!container) return;

      if (window.Skeleton) {
        container.innerHTML = window.Skeleton.list(4);
      } else {
        container.innerHTML = `<div style="text-align:center; padding:24px; color:var(--txt-muted); font-size:13px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading live activity feed...</div>`;
      }

      try {
        const search = searchInput ? searchInput.value.trim() : '';
        const mod = moduleFilter ? moduleFilter.value : 'ALL';
        const url = `/audit-logs?module=${encodeURIComponent(mod)}&search=${encodeURIComponent(search)}&limit=50`;
        const res = await window.Api.get(url, { bypassCache: true });
        const logs = (res && res.logs) || [];

        if (!logs.length) {
          if (window.Skeleton) {
            container.innerHTML = window.Skeleton.empty('No activity records found', { icon: 'fa-solid fa-clock-rotate-left', desc: 'No transaction or mutation logs match your filter criteria.' });
          } else {
            container.innerHTML = `
              <div style="text-align:center; padding:30px 10px; color:var(--txt-muted);">
                <i class="fa-solid fa-clock-rotate-left" style="font-size:28px; opacity:0.3; margin-bottom:8px;"></i>
                <div style="font-weight:600; font-size:13px;">No activity records found matching the criteria.</div>
              </div>
            `;
          }
          return;
        }

        container.innerHTML = `
          <div class="audit-timeline">
            ${logs.map(log => {
              const type = (log.transaction_type || '').toUpperCase();
              let icon = 'fa-circle-info';
              let itemClass = 'audit-item';
              let badgeColor = 'blue';

              if (type.includes('DELETE') || type.includes('DAMAGE')) {
                icon = 'fa-trash-can';
                itemClass = 'audit-item audit-delete';
                badgeColor = 'red';
              } else if (type.includes('PURCHASE') || type.includes('INWARD')) {
                icon = 'fa-cart-plus';
                badgeColor = 'green';
              } else if (type.includes('SALES') || type.includes('DISPATCH') || type.includes('BOM')) {
                icon = 'fa-truck-fast';
                badgeColor = 'blue';
              } else if (type.includes('VOUCHER')) {
                icon = 'fa-file-invoice-dollar';
                badgeColor = 'purple';
              } else if (type.includes('SECURITY') || type.includes('LOGIN') || type.includes('AUTH') || type.includes('PASSWORD')) {
                icon = 'fa-shield-halved';
                itemClass = 'audit-item audit-security';
                badgeColor = 'gold';
              }

              const timeStr = log.action_timestamp || (log.created_at ? new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '');

              return `
                <div class="${itemClass}">
                  <div class="audit-header">
                    <div class="audit-meta">
                      <span class="pill pill-${badgeColor}" style="font-size:10.5px; padding:2px 7px; font-weight:700;"><i class="fa-solid ${icon}"></i> ${type}</span>
                      ${log.reference_no ? `<strong style="color:var(--txt); font-size:12px;">#${log.reference_no}</strong>` : ''}
                      <span style="color:var(--txt-muted); font-size:11.5px;"><i class="fa-solid fa-user"></i> @${log.action_by || 'User'}</span>
                    </div>
                    <div style="font-size:11.5px; color:var(--txt-muted);">${timeStr}</div>
                  </div>
                  <div class="audit-desc">${log.new_details || log.old_details || 'Activity logged.'}</div>
                  ${log.old_details && log.new_details ? `
                    <div style="margin-top:6px;">
                      <a href="javascript:void(0)" class="btn-view-audit-diff" data-id="${log.id}" style="color:var(--blue); font-size:11.5px; text-decoration:underline;"><i class="fa-solid fa-code-compare"></i> View Details Snapshot</a>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        `;

        // Wire diff inspection
        container.querySelectorAll('.btn-view-audit-diff').forEach(link => {
          link.addEventListener('click', () => {
            const logId = parseInt(link.getAttribute('data-id'), 10);
            const found = logs.find(l => l.id === logId);
            if (!found) return;

            window.openModal(`Audit Snapshot — ${found.transaction_type} (${found.reference_no || ''})`, `
              <div style="display:flex; flex-direction:column; gap:12px;">
                <div style="font-size:12px; color:var(--txt-muted);">Timestamp: <strong>${found.action_timestamp || found.created_at}</strong> · Action by: <strong>@${found.action_by}</strong></div>
                <div style="background:rgba(231,76,60,0.06); border:1px solid rgba(231,76,60,0.25); border-radius:6px; padding:10px;">
                  <div style="font-size:11px; font-weight:700; color:var(--red); text-transform:uppercase; margin-bottom:4px;">Original Snapshot</div>
                  <pre style="margin:0; font-size:12px; color:var(--txt); white-space:pre-wrap; word-break:break-word;">${found.old_details || 'N/A'}</pre>
                </div>
                <div style="background:rgba(46,204,113,0.06); border:1px solid rgba(46,204,113,0.25); border-radius:6px; padding:10px;">
                  <div style="font-size:11px; font-weight:700; color:var(--green); text-transform:uppercase; margin-bottom:4px;">Updated Snapshot</div>
                  <pre style="margin:0; font-size:12px; color:var(--txt); white-space:pre-wrap; word-break:break-word;">${found.new_details || 'N/A'}</pre>
                </div>
              </div>
            `);
          });
        });
      } catch (err) {
        if (window.Skeleton) {
          container.innerHTML = window.Skeleton.error(err.message || 'Error loading audit logs.', { retryId: 'btnRetryAuditFeed' });
          window.Skeleton.wireRetry('btnRetryAuditFeed', () => loadActivityAuditFeed());
        } else {
          container.innerHTML = `<div style="padding:14px; color:var(--red); font-size:12.5px;"><i class="fa-solid fa-triangle-exclamation"></i> Error loading audit logs: ${err.message}</div>`;
        }
      }
    }

    const btnRefreshAudit = document.getElementById('btnRefreshAuditLogs');
    if (btnRefreshAudit) {
      btnRefreshAudit.addEventListener('click', () => loadActivityAuditFeed());
    }

    const auditSearch = document.getElementById('auditSearchInput');
    if (auditSearch) {
      auditSearch.addEventListener('input', window.debounce(() => loadActivityAuditFeed(), 200));
    }

    const auditFilter = document.getElementById('auditModuleFilter');
    if (auditFilter) {
      auditFilter.addEventListener('change', () => loadActivityAuditFeed());
    }

    // Performance & Telemetry Handlers
    async function loadPerformanceTelemetry() {
      const container = document.getElementById('perfTelemetryContainer');
      if (!container) return;
      if (window.Skeleton) {
        container.innerHTML = window.Skeleton.chart(6);
      } else {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--txt-muted); font-size:13px;"><i class="fa-solid fa-spinner fa-spin"></i> Fetching real-time telemetry metrics...</div>`;
      }
      try {
        const start = performance.now();
        const data = await window.Api.get('/system/performance', { bypassCache: true });
        const roundTripMs = Math.round(performance.now() - start);

        const pool = data.pool || {};
        const cache = data.cache || {};
        const db = data.database || {};
        const mem = data.memory || {};

        container.innerHTML = `
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:16px;">
            <div style="background:var(--bg-subtle, rgba(255,255,255,0.03)); border:1px solid var(--border-light); border-radius:8px; padding:12px;">
              <div style="font-size:11.5px; color:var(--txt-muted); text-transform:uppercase; font-weight:700;"><i class="fa-solid fa-stopwatch" style="color:var(--gold);"></i> API Latency</div>
              <div style="font-size:22px; font-weight:800; color:var(--green); margin-top:4px;">${roundTripMs} ms</div>
              <div style="font-size:11.5px; color:var(--txt-muted); margin-top:2px;">Uptime: ${Math.floor(data.uptimeSeconds / 60)}m · Heap: ${mem.heapUsedMb} MB</div>
            </div>

            <div style="background:var(--bg-subtle, rgba(255,255,255,0.03)); border:1px solid var(--border-light); border-radius:8px; padding:12px;">
              <div style="font-size:11.5px; color:var(--txt-muted); text-transform:uppercase; font-weight:700;"><i class="fa-solid fa-database" style="color:var(--blue);"></i> Connection Pool</div>
              <div style="font-size:22px; font-weight:800; color:var(--blue); margin-top:4px;">${pool.activeConnections} / ${pool.connectionLimit}</div>
              <div style="font-size:11.5px; color:var(--txt-muted); margin-top:2px;">Free: ${pool.freeConnections} · Queued: ${pool.queuedRequests} · KeepAlive: ${pool.keepAlive ? 'On' : 'Off'}</div>
            </div>

            <div style="background:var(--bg-subtle, rgba(255,255,255,0.03)); border:1px solid var(--border-light); border-radius:8px; padding:12px;">
              <div style="font-size:11.5px; color:var(--txt-muted); text-transform:uppercase; font-weight:700;"><i class="fa-solid fa-bolt" style="color:var(--gold);"></i> Cache Hit Rate</div>
              <div style="font-size:22px; font-weight:800; color:var(--gold); margin-top:4px;">${cache.masters ? cache.masters.hitRate : '100%'}</div>
              <div style="font-size:11.5px; color:var(--txt-muted); margin-top:2px;">Masters: ${cache.masters?.hits || 0} · Reports: ${cache.reports?.hits || 0}</div>
            </div>

            <div style="background:var(--bg-subtle, rgba(255,255,255,0.03)); border:1px solid var(--border-light); border-radius:8px; padding:12px;">
              <div style="font-size:11.5px; color:var(--txt-muted); text-transform:uppercase; font-weight:700;"><i class="fa-solid fa-table-cells" style="color:#9b59b6;"></i> Ledger Scale</div>
              <div style="font-size:22px; font-weight:800; color:var(--txt); margin-top:4px;">${Number(db.total_ledger_rows || 0).toLocaleString()} <span style="font-size:12px; color:var(--txt-muted); font-weight:normal;">rows</span></div>
              <div style="font-size:11.5px; color:var(--txt-muted); margin-top:2px;">Summary: ${db.summary_buckets || 0} buckets · Vouchers: ${db.total_vouchers || 0}</div>
            </div>
          </div>

          <div style="border:1px solid var(--border-light); border-radius:8px; overflow:hidden;">
            <table class="report-table" style="margin:0; width:100%;">
              <thead>
                <tr>
                  <th>Cache Domain</th>
                  <th>Cached Entries</th>
                  <th>Hits</th>
                  <th>Misses</th>
                  <th>Hit Ratio</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Masters &amp; Metadata Cache</strong></td>
                  <td>${cache.masters?.size || 0}</td>
                  <td style="color:var(--green); font-weight:700;">${cache.masters?.hits || 0}</td>
                  <td style="color:var(--txt-muted);">${cache.masters?.misses || 0}</td>
                  <td><span class="pill pill-gold">${cache.masters?.hitRate || '100%'}</span></td>
                </tr>
                <tr>
                  <td><strong>Reports &amp; Registers Cache</strong></td>
                  <td>${cache.reports?.size || 0}</td>
                  <td style="color:var(--green); font-weight:700;">${cache.reports?.hits || 0}</td>
                  <td style="color:var(--txt-muted);">${cache.reports?.misses || 0}</td>
                  <td><span class="pill pill-blue">${cache.reports?.hitRate || '100%'}</span></td>
                </tr>
                <tr>
                  <td><strong>Dashboard Summary Cache</strong></td>
                  <td>${cache.dashboard?.size || 0}</td>
                  <td style="color:var(--green); font-weight:700;">${cache.dashboard?.hits || 0}</td>
                  <td style="color:var(--txt-muted);">${cache.dashboard?.misses || 0}</td>
                  <td><span class="pill pill-green">${cache.dashboard?.hitRate || '100%'}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      } catch (e) {
        if (window.Skeleton) {
          container.innerHTML = window.Skeleton.error(e.message || 'Telemetry unavailable.', { retryId: 'btnRetryTelemetry' });
          window.Skeleton.wireRetry('btnRetryTelemetry', () => loadPerformanceTelemetry());
        } else {
          container.innerHTML = `<div style="padding:14px; color:var(--red); font-size:12.5px;"><i class="fa-solid fa-triangle-exclamation"></i> Telemetry unavailable: ${e.message}</div>`;
        }
      }
    }

    const btnRefreshPerf = document.getElementById('btnRefreshPerfStats');
    if (btnRefreshPerf) {
      btnRefreshPerf.addEventListener('click', () => loadPerformanceTelemetry());
    }

    const btnPurgeClient = document.getElementById('btnPurgeClientCache');
    if (btnPurgeClient) {
      btnPurgeClient.addEventListener('click', () => {
        if (typeof window.clearClientApiCache === 'function') {
          window.clearClientApiCache();
          if (window.showToast) window.showToast('Client-side in-memory cache purged successfully.');
        }
      });
    }

    activateTab(initialTab);

    // Wire Theme buttons inside Settings
    const modalBox = document.querySelector('#modalOverlay .modal-box');
    if (modalBox && window.wireThemeButtons) window.wireThemeButtons(modalBox);

    // -------------------------------------------------------------
    // 1. My Profile Tab Async Initialization & Save
    // -------------------------------------------------------------
    const profileEmailInput = document.getElementById('myProfileEmail');
    const profileUnameInput = document.getElementById('myProfileUsername');
    if (profileEmailInput && window.Api) {
      window.Api.get('/auth/profile').then((data) => {
        if (data && data.email && profileEmailInput) profileEmailInput.value = data.email;
        if (data && data.username && profileUnameInput) profileUnameInput.value = data.username;
      }).catch(() => {});
    }

    const btnSaveProfile = document.getElementById('btnSaveMyProfile');
    if (btnSaveProfile) {
      btnSaveProfile.addEventListener('click', async () => {
        const newUsername = (document.getElementById('myProfileUsername') || {}).value.trim();
        const newEmail = (document.getElementById('myProfileEmail') || {}).value.trim();
        const currentPassword = (document.getElementById('myProfileCurPass') || {}).value.trim();
        const newPassword = (document.getElementById('myProfileNewPass') || {}).value.trim();
        const confirmPassword = (document.getElementById('myProfileConfirmPass') || {}).value.trim();

        if (newPassword || newUsername) {
          if (!currentPassword) {
            window.openModal('Authentication Required', '<p>Please enter your current Password / PIN to confirm changes to your account.</p>');
            return;
          }
        }
        if (newPassword && newPassword !== confirmPassword) {
          window.openModal('Password Mismatch', '<p>The new password and confirmation do not match.</p>');
          return;
        }

        try {
          const res = await window.Api.put('/auth/profile', {
            newUsername,
            newEmail,
            currentPassword: currentPassword || undefined,
            newPassword: newPassword || undefined
          });

          if (res && res.success) {
            if (res.token) {
              const saved = JSON.parse(sessionStorage.getItem('auth_user') || '{}');
              sessionStorage.setItem('auth_user', JSON.stringify({ ...saved, username: res.username, token: res.token }));
            }
            if (res.username) {
              window.currentUsername = res.username;
              updateProfileDisplay(res.username, currentRole);
            }
            if (window.showToast) window.showToast('Profile & credentials updated successfully!');
            document.getElementById('myProfileCurPass').value = '';
            document.getElementById('myProfileNewPass').value = '';
            document.getElementById('myProfileConfirmPass').value = '';
          }
        } catch (err) {
          window.openModal('Update Failed', `<p style="color:var(--red);">${err.message || 'Could not update profile.'}</p>`);
        }
      });
    }

    // Forgot Password flow inside Profile
    const btnForgotPass = document.getElementById('btnProfileForgotPass');
    const forgotBox = document.getElementById('profileForgotOtpBox');
    const btnCancelForgot = document.getElementById('btnProfileCancelForgot');
    const btnVerifyForgot = document.getElementById('btnProfileVerifyOtpReset');

    if (btnForgotPass && forgotBox) {
      btnForgotPass.addEventListener('click', async () => {
        try {
          const res = await window.Api.post('/auth/forgot-password', { username: currentUsername });
          if (res && res.success) {
            const desc = document.getElementById('profileForgotOtpDesc');
            if (desc) desc.textContent = `We have emailed a 6-digit verification OTP to ${res.maskedEmail || 'your registered email'}. Enter it below with your new password.`;
            forgotBox.style.display = 'block';
            forgotBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
            if (window.showToast) window.showToast('OTP sent to your email!');
          }
        } catch (e) {
          window.openModal('OTP Failed', `<p style="color:var(--red);">${(e && e.message) || 'Could not send OTP. Ensure your account has a registered email.'}</p>`);
        }
      });
    }

    if (btnCancelForgot && forgotBox) {
      btnCancelForgot.addEventListener('click', () => {
        forgotBox.style.display = 'none';
      });
    }

    if (btnVerifyForgot) {
      btnVerifyForgot.addEventListener('click', async () => {
        const otp = (document.getElementById('profileForgotOtpInput') || {}).value.trim();
        const newPass = (document.getElementById('profileForgotNewPass') || {}).value.trim();
        const confirmPass = (document.getElementById('profileForgotConfirmPass') || {}).value.trim();

        if (!otp || !newPass) {
          window.openModal('Validation Error', '<p>Please enter the OTP and your new password.</p>');
          return;
        }
        if (newPass !== confirmPass) {
          window.openModal('Password Mismatch', '<p>The new password and confirmation do not match.</p>');
          return;
        }

        try {
          await window.Api.post('/auth/reset-password', {
            username: currentUsername,
            otp,
            newPassword: newPass
          });
          if (window.showToast) window.showToast('Password reset successfully!');
          if (forgotBox) forgotBox.style.display = 'none';
          document.getElementById('profileForgotOtpInput').value = '';
          document.getElementById('profileForgotNewPass').value = '';
          document.getElementById('profileForgotConfirmPass').value = '';
        } catch (e) {
          window.openModal('Reset Failed', `<p style="color:var(--red);">${(e && e.message) || 'Could not reset password.'}</p>`);
        }
      });
    }

    // -------------------------------------------------------------
    // Active Devices List & Revocation (Embedded)
    // -------------------------------------------------------------
    const sessionsListEl = document.getElementById('setProfileSessionsList');
    const sessionsCountEl = document.getElementById('setProfileSessionsCount');

    async function loadProfileActiveSessions() {
      if (!sessionsListEl) return;
      try {
        const data = await window.Api.get('/auth/my-sessions');
        const sessions = (data && data.sessions) || [];
        const active = sessions.filter((s) => !s.revoked);
        if (sessionsCountEl) sessionsCountEl.textContent = `${active.length} Device${active.length === 1 ? '' : 's'} Active`;

        if (!active.length) {
          sessionsListEl.innerHTML = '<p class="note" style="padding:10px 0; margin:0;">No other active sessions found.</p>';
          return;
        }

        sessionsListEl.innerHTML = active.map((s) => {
          const when = s.lastSeen ? String(s.lastSeen).replace('T', ' ').slice(0, 16) : 'Just now';
          const isThis = !!s.isCurrent;
          const badge = isThis ? '<span class="pill pill-green" style="font-size:10px; padding:2px 6px;">This device</span>' : '';
          const btn = isThis ? '' : `<button type="button" class="btn btn-ghost bom-mini-btn" data-revoke-session-id="${s.id}"><i class="fa-solid fa-right-from-bracket"></i> Log out</button>`;
          return `
            <div class="sess-row" style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; border-bottom:1px solid var(--border-light); gap:10px;">
              <div style="display:flex; align-items:center; gap:10px;">
                <div style="font-size:16px; color:var(--blue); width:24px; text-align:center;"><i class="fa-solid ${s.deviceLabel && s.deviceLabel.toLowerCase().includes('mobile') ? 'fa-mobile-screen' : 'fa-desktop'}"></i></div>
                <div>
                  <div style="font-size:12.5px; font-weight:700; color:var(--txt);">${s.deviceLabel || 'Device / Browser'} ${badge}</div>
                  <div style="font-size:11.5px; color:var(--txt-muted);">Last active ${when}${s.ip ? ' · IP ' + s.ip : ''}</div>
                </div>
              </div>
              <div>${btn}</div>
            </div>
          `;
        }).join('');

        sessionsListEl.querySelectorAll('[data-revoke-session-id]').forEach((b) => {
          b.addEventListener('click', async () => {
            const sid = b.getAttribute('data-revoke-session-id');
            try {
              await window.Api.post('/auth/sessions/' + sid + '/revoke', {});
              if (window.showToast) window.showToast('Device logged out');
              loadProfileActiveSessions();
            } catch (e) {
              window.openModal('Error', `<p>${(e && e.message) || 'Failed to revoke device.'}</p>`);
            }
          });
        });
      } catch (e) {
        if (sessionsListEl) sessionsListEl.innerHTML = '<p class="note" style="color:var(--red);">Could not load active devices.</p>';
      }
    }

    loadProfileActiveSessions();

    const btnRevokeOthers = document.getElementById('setProfileRevokeOthers');
    if (btnRevokeOthers) {
      btnRevokeOthers.addEventListener('click', async () => {
        const ok = await window.confirmDialog('Log out other devices', 'All other devices will be signed out. This device stays logged in.', { kind: 'warning', okLabel: 'Log out others' });
        if (!ok) return;
        try {
          await window.Api.post('/auth/sessions/revoke-others', {});
          if (window.showToast) window.showToast('Other devices logged out successfully');
          loadProfileActiveSessions();
        } catch (e) {
          window.openModal('Error', `<p>${(e && e.message) || 'Failed to log out others.'}</p>`);
        }
      });
    }

    // -------------------------------------------------------------
    // 2. Challan Tab Async Initialization & Live Preview
    // -------------------------------------------------------------
    const prefixInput = document.getElementById('setChallanPrefix');
    const nextInput = document.getElementById('setChallanNext');
    const padSelect = document.getElementById('setChallanPad');
    const suffixInput = document.getElementById('setChallanSuffix');
    const previewEl = document.getElementById('setChallanPreview');

    function refreshChallanPreview() {
      if (!previewEl) return;
      const p = (prefixInput ? prefixInput.value : '');
      const s = (suffixInput ? suffixInput.value : '');
      const n = parseInt(nextInput ? nextInput.value : '1', 10) || 1;
      const pad = parseInt(padSelect ? padSelect.value : '0', 10) || 0;
      const padded = pad > 0 ? String(n).padStart(pad, '0') : String(n);
      previewEl.textContent = `${p}${padded}${s}`;
    }

    [prefixInput, nextInput, padSelect, suffixInput].forEach((el) => {
      if (el) el.addEventListener('input', refreshChallanPreview);
      if (el) el.addEventListener('change', refreshChallanPreview);
    });

    if (window.Api) {
      window.Api.get('/auth/app-settings').then((res) => {
        const s = (res && res.settings) || {};
        if (prefixInput && s.challan_prefix != null) prefixInput.value = s.challan_prefix;
        if (nextInput && s.challan_next != null) nextInput.value = s.challan_next;
        if (padSelect && s.challan_pad != null) padSelect.value = s.challan_pad;
        if (suffixInput && s.challan_suffix != null) suffixInput.value = s.challan_suffix;
        refreshChallanPreview();
      }).catch(() => refreshChallanPreview());
    }

    const btnSaveChallan = document.getElementById('setBtnSaveChallan');
    if (btnSaveChallan) {
      btnSaveChallan.addEventListener('click', async () => {
        const prefix = (prefixInput ? prefixInput.value.trim() : '');
        const nextVal = (nextInput ? nextInput.value.trim() : '1');
        const padVal = (padSelect ? padSelect.value : '3');
        const suffixVal = (suffixInput ? suffixInput.value.trim() : '');

        try {
          await window.Api.put('/auth/app-settings', {
            settings: {
              challan_prefix: prefix,
              challan_next: nextVal,
              challan_pad: padVal,
              challan_suffix: suffixVal
            }
          });
          if (window.showToast) window.showToast('Challan numbering settings saved!');
        } catch (err) {
          window.openModal('Save Failed', `<p style="color:var(--red);">${err.message || 'Could not save challan settings.'}</p>`);
        }
      });
    }

    // -------------------------------------------------------------
    // 3. User Accounts Tab (Admin / SuperAdmin)
    // -------------------------------------------------------------
    if (isAdmin) {
      const unameInp = document.getElementById('setMngUname');
      const passInp = document.getElementById('setMngPass');
      const emailInp = document.getElementById('setMngEmail');
      const roleInp = document.getElementById('setMngRole');
      const ledgerBody = document.getElementById('setUsersLedgerBody');

      async function loadSettingsUsersLedger() {
        if (!ledgerBody) return;
        try {
          const rows = await window.Api.get('/masters/users');
          if (!rows || !rows.length) {
            ledgerBody.innerHTML = `<tr><td colspan="3" class="pl-empty-hint">No user accounts found</td></tr>`;
            return;
          }
          ledgerBody.innerHTML = rows.map((u) => `
            <tr style="cursor:pointer;" title="Click to fill form">
              <td style="font-weight:700; color:var(--txt);">@${u.username}</td>
              <td style="color:var(--txt-muted); font-size:12px;">${u.email || '-'}</td>
              <td><span class="pill pill-${u.role === 'SuperAdmin' ? 'purple' : u.role === 'Admin' ? 'gold' : 'blue'}" style="font-size:10.5px; padding:2px 7px;">${u.role}</span></td>
            </tr>
          `).join('');

          ledgerBody.querySelectorAll('tr').forEach((tr, i) => {
            tr.addEventListener('click', () => {
              const u = rows[i];
              if (u) {
                if (unameInp) unameInp.value = u.username;
                if (emailInp) emailInp.value = u.email || '';
                if (roleInp) roleInp.value = u.role || 'User';
                if (passInp) passInp.focus();
              }
            });
          });
        } catch (e) {
          ledgerBody.innerHTML = `<tr><td colspan="3" class="pl-empty-hint" style="color:var(--red);">Could not load user accounts</td></tr>`;
        }
      }

      loadSettingsUsersLedger();

      const btnAddUser = document.getElementById('setBtnAddUser');
      if (btnAddUser) {
        btnAddUser.addEventListener('click', async () => {
          const username = unameInp.value.trim();
          const password = passInp.value.trim();
          const email = emailInp.value.trim();
          const role = roleInp.value;
          if (!username || !password || !email) {
            window.openModal('Validation Error', '<p>Username, Password, and Email are required.</p>');
            return;
          }
          try {
            await window.Api.post('/masters/users', { username, password, email, role });
            if (window.showToast) window.showToast(`User '@${username}' created!`);
            unameInp.value = '';
            passInp.value = '';
            emailInp.value = '';
            loadSettingsUsersLedger();
          } catch (e) {
            window.openModal('Failed', `<p style="color:var(--red);">${e.message || 'Could not add user.'}</p>`);
          }
        });
      }

      const btnUpdatePass = document.getElementById('setBtnUpdatePass');
      if (btnUpdatePass) {
        btnUpdatePass.addEventListener('click', async () => {
          const username = unameInp.value.trim();
          const password = passInp.value.trim();
          if (!username || !password) {
            window.openModal('Validation Error', '<p>Please enter username and new password.</p>');
            return;
          }
          try {
            await window.Api.put('/masters/users/password', { username, password });
            if (window.showToast) window.showToast(`Password updated for '@${username}'!`);
            passInp.value = '';
          } catch (e) {
            window.openModal('Failed', `<p style="color:var(--red);">${e.message || 'Could not update password.'}</p>`);
          }
        });
      }

      const btnUpdateEmail = document.getElementById('setBtnUpdateEmail');
      if (btnUpdateEmail) {
        btnUpdateEmail.addEventListener('click', async () => {
          const username = unameInp.value.trim();
          const email = emailInp.value.trim();
          if (!username || !email) {
            window.openModal('Validation Error', '<p>Please enter username and new email.</p>');
            return;
          }
          try {
            await window.Api.put('/masters/users/email', { username, email });
            if (window.showToast) window.showToast(`Email updated for '@${username}'!`);
            loadSettingsUsersLedger();
          } catch (e) {
            window.openModal('Failed', `<p style="color:var(--red);">${e.message || 'Could not update email.'}</p>`);
          }
        });
      }
    }

    // -------------------------------------------------------------
    // 4. Appearance Tab Interactive Preview & Explicit Save Action
    // -------------------------------------------------------------
    let selectedTheme = activeTheme;
    let selectedFont = activeFont;
    let selectedAvatar = activeAvatar;

    const themeBtns = document.querySelectorAll('#tab-theme [data-theme-set]');
    const fontBtns = document.querySelectorAll('#tab-theme [data-font-set]');
    const avatarBtns = document.querySelectorAll('#tab-theme [data-avatar-set]');

    const previewAvatar = document.getElementById('setPreviewAvatarCircle');
    const previewFontLabel = document.getElementById('setPreviewFontLabel');
    const previewThemeBadge = document.getElementById('setPreviewThemeBadge');
    const previewUserName = document.getElementById('setPreviewUserName');

    function updateAppearancePreview() {
      // 1. Theme preview
      if (previewThemeBadge) {
        const themeLabels = {
          'dark': '<i class="fa-solid fa-moon"></i> Midnight Dark',
          'gray': '<i class="fa-solid fa-circle-half-stroke"></i> Charcoal Slate',
          'light': '<i class="fa-solid fa-sun"></i> Cloud Light',
          'emerald': '<i class="fa-solid fa-leaf" style="color:#2ecc71;"></i> Solar Emerald',
          'ocean': '<i class="fa-solid fa-water" style="color:#38bdf8;"></i> Deep Ocean'
        };
        previewThemeBadge.innerHTML = themeLabels[selectedTheme] || selectedTheme;
      }
      themeBtns.forEach((b) => b.classList.toggle('active', b.getAttribute('data-theme-set') === selectedTheme));

      // 2. Font preview
      const fontLabels = {
        'segoe': 'Segoe UI (System)',
        'inter': 'Inter Modern',
        'roboto': 'Roboto Corporate',
        'jakarta': 'Plus Jakarta Sans',
        'outfit': 'Outfit Tech',
        'jetbrains': 'JetBrains Mono'
      };
      if (previewFontLabel) previewFontLabel.textContent = `Font: ${fontLabels[selectedFont] || selectedFont}`;
      if (previewUserName && window.FONTS_PALETTE && window.FONTS_PALETTE[selectedFont]) {
        previewUserName.style.fontFamily = window.FONTS_PALETTE[selectedFont];
      }
      fontBtns.forEach((b) => b.classList.toggle('active', b.getAttribute('data-font-set') === selectedFont));

      // 3. Avatar color preview
      const palette = (window.AVATAR_PALETTE && window.AVATAR_PALETTE[selectedAvatar]) || {
        bg: 'linear-gradient(135deg, #D4AF37, #B6952C)',
        txt: '#111111',
        border: '#D4AF37'
      };
      if (previewAvatar) {
        previewAvatar.style.setProperty('background', palette.bg, 'important');
        previewAvatar.style.setProperty('color', palette.txt, 'important');
        previewAvatar.style.setProperty('border-color', palette.border, 'important');
      }
      avatarBtns.forEach((b) => b.classList.toggle('active', b.getAttribute('data-avatar-set') === selectedAvatar));
    }

    themeBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedTheme = btn.getAttribute('data-theme-set');
        if (window.setAppTheme) window.setAppTheme(selectedTheme, { skipServer: true });
        updateAppearancePreview();
      });
    });

    fontBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFont = btn.getAttribute('data-font-set');
        if (window.setAppFont) window.setAppFont(selectedFont, { skipServer: true });
        updateAppearancePreview();
      });
    });

    avatarBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedAvatar = btn.getAttribute('data-avatar-set');
        if (window.setAppAvatarColor) window.setAppAvatarColor(selectedAvatar, { skipServer: true });
        updateAppearancePreview();
      });
    });

    updateAppearancePreview();

    const chkAnimations = document.getElementById('setCheckAnimations');
    const chkCompact = document.getElementById('setCheckCompactTables');

    // Explicit "Save Appearance Preferences" Button
    const btnSaveAppearance = document.getElementById('btnSaveAppearanceSettings');
    if (btnSaveAppearance) {
      btnSaveAppearance.addEventListener('click', async () => {
        try {
          btnSaveAppearance.disabled = true;
          btnSaveAppearance.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

          // Apply & Persist Theme, Font, Avatar
          if (window.setAppTheme) window.setAppTheme(selectedTheme);
          if (window.setAppFont) window.setAppFont(selectedFont);
          if (window.setAppAvatarColor) window.setAppAvatarColor(selectedAvatar);

          const isSmooth = chkAnimations ? chkAnimations.checked : true;
          const isCompact = chkCompact ? chkCompact.checked : false;

          if (window.applyUserPreferences) {
            window.applyUserPreferences({
              smooth_animations: isSmooth,
              compact_tables: isCompact
            });
          }

          if (window.Api) {
            await window.Api.put('/auth/preferences', {
              theme: selectedTheme,
              font_family: selectedFont,
              avatar_color: selectedAvatar,
              smooth_animations: isSmooth,
              compact_tables: isCompact
            });
          }

          if (window.showSuccess) {
            window.showSuccess('Appearance Settings Saved', 'Your theme, typography, avatar badge color, and display preferences have been saved and applied successfully across all devices.');
          } else if (window.openModal) {
            window.openModal('Appearance Saved', '<p style="color:var(--green); font-weight:700;"><i class="fa-solid fa-circle-check"></i> Appearance preferences saved successfully!</p>');
          }
        } catch (err) {
          if (window.showError) {
            window.showError('Save Failed', (err && err.message) || 'Could not save appearance preferences.');
          } else {
            window.openModal('Save Failed', `<p style="color:var(--red);">${(err && err.message) || 'Could not save appearance preferences.'}</p>`);
          }
        } finally {
          btnSaveAppearance.disabled = false;
          btnSaveAppearance.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Appearance Preferences';
        }
      });
    }

    const btnOpenDashCust = document.getElementById('btnOpenDashCustomizerFromSettings');
    if (btnOpenDashCust) {
      btnOpenDashCust.addEventListener('click', () => {
        if (window.openDashboardCustomizerModal) {
          window.openDashboardCustomizerModal();
        } else {
          go('dashboard');
          setTimeout(() => {
            if (window.openDashboardCustomizerModal) window.openDashboardCustomizerModal();
          }, 150);
        }
      });
    }

    // -------------------------------------------------------------
    // 5. Alerts & Stock Tab
    // -------------------------------------------------------------
    const lowStockThreshInp = document.getElementById('setLowStockThreshold');
    const scannerSoundSel = document.getElementById('setScannerSound');
    const btnTestSound = document.getElementById('btnTestScannerSound');
    const chkLowStockEmail = document.getElementById('setCheckLowStockEmail');
    const lowStockEmailsInp = document.getElementById('setLowStockEmails');
    const btnTestLowStock = document.getElementById('btnTestLowStockEmail');
    const chkDispatchEmail = document.getElementById('setCheckDispatchEmail');
    const dispatchEmailsInp = document.getElementById('setDispatchEmails');
    const btnTestDispatch = document.getElementById('btnTestDispatchEmail');
    const btnSaveStockScanner = document.getElementById('setBtnSaveStockScanner');
    const btnSaveEmailAlerts = document.getElementById('setBtnSaveEmailAlerts');

    if (btnTestSound && scannerSoundSel) {
      btnTestSound.addEventListener('click', () => {
        const sound = scannerSoundSel.value;
        if (window.playScannerTone) window.playScannerTone(sound);
      });
    }

    if (window.Api) {
      window.Api.get('/auth/app-settings').then((res) => {
        const s = (res && res.settings) || {};
        if (lowStockThreshInp && s.low_stock_threshold != null) lowStockThreshInp.value = s.low_stock_threshold;
        if (scannerSoundSel && s.scanner_sound != null) scannerSoundSel.value = s.scanner_sound;
        if (chkLowStockEmail) chkLowStockEmail.checked = s.low_stock_alert_enabled === '1';
        if (lowStockEmailsInp && s.low_stock_alert_emails != null) lowStockEmailsInp.value = s.low_stock_alert_emails;
        if (chkDispatchEmail) chkDispatchEmail.checked = s.dispatch_alert_enabled === '1';
        if (dispatchEmailsInp && s.dispatch_alert_emails != null) dispatchEmailsInp.value = s.dispatch_alert_emails;

        // ERP Mode & Feature Switches population
        const curMode = s.erp_mode || 'hybrid';
        document.querySelectorAll('input[name="setErpMode"]').forEach((r) => {
          r.checked = (r.value === curMode);
          const card = r.closest('.egs-mode-card');
          if (card) {
            card.style.borderColor = r.checked ? 'var(--blue)' : 'var(--border)';
            card.style.background = r.checked ? 'rgba(59,142,208,0.08)' : 'var(--panel-alt)';
          }
        });
        const chkFeatureBom = document.getElementById('setCheckFeatureBom');
        const chkFeaturePricing = document.getElementById('setCheckFeaturePricing');
        const chkFeatureWarehouse = document.getElementById('setCheckFeatureWarehouse');
        const chkFeaturePallet = document.getElementById('setCheckFeaturePallet');
        const chkFeatureProofMandatory = document.getElementById('setCheckFeatureProofMandatory');
        const selFeatureWattRule = document.getElementById('setFeatureWattRule');

        if (chkFeatureBom) chkFeatureBom.checked = (s.feature_bom_enabled !== '0');
        if (chkFeaturePricing) chkFeaturePricing.checked = (s.feature_pricing_enabled !== '0');
        if (chkFeatureWarehouse) chkFeatureWarehouse.checked = (s.feature_warehouse_enabled !== '0');
        if (chkFeaturePallet) chkFeaturePallet.checked = (s.feature_pallet_enabled !== '0');
        if (chkFeatureProofMandatory) chkFeatureProofMandatory.checked = (s.feature_attachment_mandatory === '1');
        if (selFeatureWattRule && s.feature_wattage_mandatory) selFeatureWattRule.value = s.feature_wattage_mandatory;
      }).catch(() => {});
    }

    // ERP Mode Radio card highlight on change
    document.querySelectorAll('input[name="setErpMode"]').forEach((r) => {
      r.addEventListener('change', () => {
        document.querySelectorAll('input[name="setErpMode"]').forEach((other) => {
          const card = other.closest('.egs-mode-card');
          if (card) {
            card.style.borderColor = other.checked ? 'var(--blue)' : 'var(--border)';
            card.style.background = other.checked ? 'rgba(59,142,208,0.08)' : 'var(--panel-alt)';
          }
        });
      });
    });

    // Save ERP Mode & Features Button
    const btnSaveErpMode = document.getElementById('btnSaveErpModeSettings');
    if (btnSaveErpMode) {
      btnSaveErpMode.addEventListener('click', async () => {
        let selectedMode = 'hybrid';
        document.querySelectorAll('input[name="setErpMode"]').forEach((r) => { if (r.checked) selectedMode = r.value; });
        const chkFeatureBom = document.getElementById('setCheckFeatureBom');
        const chkFeaturePricing = document.getElementById('setCheckFeaturePricing');
        const chkFeatureWarehouse = document.getElementById('setCheckFeatureWarehouse');
        const chkFeaturePallet = document.getElementById('setCheckFeaturePallet');
        const chkFeatureProofMandatory = document.getElementById('setCheckFeatureProofMandatory');
        const selFeatureWattRule = document.getElementById('setFeatureWattRule');

        const featureBom = (chkFeatureBom && chkFeatureBom.checked) ? '1' : '0';
        const featurePricing = (chkFeaturePricing && chkFeaturePricing.checked) ? '1' : '0';
        const featureWarehouse = (chkFeatureWarehouse && chkFeatureWarehouse.checked) ? '1' : '0';
        const featurePallet = (chkFeaturePallet && chkFeaturePallet.checked) ? '1' : '0';
        const featureProofMandatory = (chkFeatureProofMandatory && chkFeatureProofMandatory.checked) ? '1' : '0';
        const featureWattRule = (selFeatureWattRule ? selFeatureWattRule.value : 'auto') || 'auto';

        try {
          await window.Api.put('/auth/app-settings', {
            settings: {
              erp_mode: selectedMode,
              feature_bom_enabled: featureBom,
              feature_pricing_enabled: featurePricing,
              feature_warehouse_enabled: featureWarehouse,
              feature_pallet_enabled: featurePallet,
              feature_attachment_mandatory: featureProofMandatory,
              feature_wattage_mandatory: featureWattRule
            }
          });

          // Sync into window.ERP_CONFIG
          window.ERP_CONFIG = Object.assign(window.ERP_CONFIG || {}, {
            erp_mode: selectedMode,
            feature_bom_enabled: featureBom,
            feature_pricing_enabled: featurePricing,
            feature_warehouse_enabled: featureWarehouse,
            feature_pallet_enabled: featurePallet,
            feature_attachment_mandatory: featureProofMandatory,
            feature_wattage_mandatory: featureWattRule
          });

          if (typeof window.applyErpModeRules === 'function') {
            window.applyErpModeRules();
          }

          if (window.showSuccess) {
            window.showSuccess('ERP Operating Mode Updated', `Active ERP mode set to '${selectedMode.toUpperCase()}'. Features & validation rules applied across software.`);
          } else if (window.showToast) {
            window.showToast('ERP mode and feature settings saved!', 'success');
          }
        } catch (e) {
          window.showError('Save Failed', (e && e.message) || 'Could not save ERP mode settings.');
        }
      });
    }

    // Helper: validate comma-separated emails
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    function parseAndValidateEmails(str) {
      if (!str || !str.trim()) return { valid: true, emails: [] };
      const rawList = str.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
      for (const em of rawList) {
        if (!EMAIL_REGEX.test(em)) {
          return { valid: false, invalidEmail: em, emails: rawList };
        }
      }
      return { valid: true, emails: rawList };
    }

    // 1. Save Button: Stock Thresholds & Scanner Audio
    if (btnSaveStockScanner) {
      btnSaveStockScanner.addEventListener('click', async () => {
        const threshold = (lowStockThreshInp ? lowStockThreshInp.value.trim() : '5') || '5';
        const numThresh = parseInt(threshold, 10);
        if (!Number.isFinite(numThresh) || numThresh < 1) {
          window.showError('Invalid Threshold', 'Low stock warning threshold must be a valid positive number (e.g. 5).');
          return;
        }
        const sound = scannerSoundSel ? scannerSoundSel.value : 'beep';

        try {
          await window.Api.put('/auth/app-settings', {
            settings: {
              low_stock_threshold: String(numThresh),
              scanner_sound: sound
            }
          });

          localStorage.setItem('egs_scanner_sound', sound);
          if (window.showSuccess) {
            window.showSuccess('Saved Successfully', `Stock threshold (${numThresh} units) and audio feedback have been updated.`);
          } else if (window.showToast) {
            window.showToast('Stock and scanner settings saved!', 'success');
          }
        } catch (e) {
          window.showError('Save Failed', (e && e.message) || 'Could not save stock & scanner settings.');
        }
      });
    }

    // 2. Test Verification Email: Low Stock
    if (btnTestLowStock && lowStockEmailsInp) {
      btnTestLowStock.addEventListener('click', async () => {
        const parsed = parseAndValidateEmails(lowStockEmailsInp.value);
        if (!parsed.emails.length) {
          window.showWarning('Email Address Required', 'Please enter at least one recipient email address to send a verification test mail.');
          lowStockEmailsInp.focus();
          return;
        }
        if (!parsed.valid) {
          window.showError('Invalid Email Address', `The email address '${parsed.invalidEmail}' is not formatted correctly. Please use format like name@gmail.com.`);
          lowStockEmailsInp.focus();
          return;
        }
        try {
          btnTestLowStock.disabled = true;
          btnTestLowStock.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
          await window.Api.post('/auth/send-test-alert-email', {
            email: parsed.emails.join(', '),
            alertType: 'Low Stock Alerts'
          });
          window.showSuccess('Test Email Sent Successfully', `Verification email has been dispatched to: ${parsed.emails.join(', ')}`);
        } catch (err) {
          window.showError('Verification Failed', err.message || 'Could not send test email.');
        } finally {
          btnTestLowStock.disabled = false;
          btnTestLowStock.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Test Mail';
        }
      });
    }

    // 3. Test Verification Email: Dispatch
    if (btnTestDispatch && dispatchEmailsInp) {
      btnTestDispatch.addEventListener('click', async () => {
        const parsed = parseAndValidateEmails(dispatchEmailsInp.value);
        if (!parsed.emails.length) {
          window.showWarning('Email Address Required', 'Please enter at least one recipient email address to send a verification test mail.');
          dispatchEmailsInp.focus();
          return;
        }
        if (!parsed.valid) {
          window.showError('Invalid Email Address', `The email address '${parsed.invalidEmail}' is not formatted correctly. Please use format like name@gmail.com.`);
          dispatchEmailsInp.focus();
          return;
        }
        try {
          btnTestDispatch.disabled = true;
          btnTestDispatch.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
          await window.Api.post('/auth/send-test-alert-email', {
            email: parsed.emails.join(', '),
            alertType: 'BOM Challan & Dispatch Alerts'
          });
          window.showSuccess('Test Email Sent Successfully', `Verification email has been dispatched to: ${parsed.emails.join(', ')}`);
        } catch (err) {
          window.showError('Verification Failed', err.message || 'Could not send test email.');
        } finally {
          btnTestDispatch.disabled = false;
          btnTestDispatch.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Test Mail';
        }
      });
    }

    // 4. Save Button: Email Notification Settings
    if (btnSaveEmailAlerts) {
      btnSaveEmailAlerts.addEventListener('click', async () => {
        const lowStockEnabled = (chkLowStockEmail && chkLowStockEmail.checked) ? '1' : '0';
        const lowStockEmailsRaw = (lowStockEmailsInp ? lowStockEmailsInp.value.trim() : '');
        const dispatchEnabled = (chkDispatchEmail && chkDispatchEmail.checked) ? '1' : '0';
        const dispatchEmailsRaw = (dispatchEmailsInp ? dispatchEmailsInp.value.trim() : '');

        // Validation
        const parsedLowStock = parseAndValidateEmails(lowStockEmailsRaw);
        if (!parsedLowStock.valid) {
          window.showError('Invalid Low Stock Email', `The email address '${parsedLowStock.invalidEmail}' is invalid. Please provide valid email address(es) (e.g. name@gmail.com).`);
          if (lowStockEmailsInp) lowStockEmailsInp.focus();
          return;
        }
        if (lowStockEnabled === '1' && !parsedLowStock.emails.length) {
          window.showWarning('Email Address Missing', 'Low Stock Warning Email Alert is enabled, but no recipient email address was provided.');
          if (lowStockEmailsInp) lowStockEmailsInp.focus();
          return;
        }

        const parsedDispatch = parseAndValidateEmails(dispatchEmailsRaw);
        if (!parsedDispatch.valid) {
          window.showError('Invalid Dispatch Email', `The email address '${parsedDispatch.invalidEmail}' is invalid. Please provide valid email address(es) (e.g. name@gmail.com).`);
          if (dispatchEmailsInp) dispatchEmailsInp.focus();
          return;
        }
        if (dispatchEnabled === '1' && !parsedDispatch.emails.length) {
          window.showWarning('Email Address Missing', 'BOM Challan & Dispatch Email Alert is enabled, but no recipient email address was provided.');
          if (dispatchEmailsInp) dispatchEmailsInp.focus();
          return;
        }

        try {
          await window.Api.put('/auth/app-settings', {
            settings: {
              low_stock_alert_enabled: lowStockEnabled,
              low_stock_alert_emails: parsedLowStock.emails.join(', '),
              dispatch_alert_enabled: dispatchEnabled,
              dispatch_alert_emails: parsedDispatch.emails.join(', ')
            }
          });

          if (lowStockEmailsInp) lowStockEmailsInp.value = parsedLowStock.emails.join(', ');
          if (dispatchEmailsInp) dispatchEmailsInp.value = parsedDispatch.emails.join(', ');

          if (window.showSuccess) {
            window.showSuccess('Email Alerts Saved Successfully', 'Automated ERP email alert triggers and verified recipient addresses have been saved.');
          } else if (window.showToast) {
            window.showToast('Email alerts saved successfully!', 'success');
          }
        } catch (e) {
          window.showError('Save Failed', (e && e.message) || 'Could not save email notification settings.');
        }
      });
    }

    // -------------------------------------------------------------
    // 6. Native Device Permissions & Notifications Tab Wiring
    // -------------------------------------------------------------
    const badgeNotify = document.getElementById('permBadgeNotify');
    const badgeCamera = document.getElementById('permBadgeCamera');
    const badgeMic = document.getElementById('permBadgeMic');
    const badgeStorage = document.getElementById('permBadgeStorage');
    const btnReqNotify = document.getElementById('btnRequestNotifyPerm');
    const btnTestNotify = document.getElementById('btnTestNotifyPerm');
    const btnReqCamera = document.getElementById('btnRequestCameraPerm');
    const btnReqMic = document.getElementById('btnRequestMicPerm');
    const btnReqStorage = document.getElementById('btnRequestStoragePerm');
    const audioSelect = document.getElementById('setScannerAudioSelect');
    const btnTestAudio = document.getElementById('btnTestScannerAudio');
    const pwaModeVal = document.getElementById('setPwaModeVal');

    const updateAllPermissionBadges = async () => {
      // 1. Notification Badge
      if (badgeNotify) {
        if (!('Notification' in window)) {
          badgeNotify.className = 'pill pill-muted';
          badgeNotify.textContent = 'Not Supported';
          if (btnReqNotify) btnReqNotify.style.display = 'none';
        } else if (Notification.permission === 'granted') {
          badgeNotify.className = 'pill pill-green';
          badgeNotify.innerHTML = '<i class="fa-solid fa-circle-check"></i> Allowed';
          if (btnReqNotify) btnReqNotify.style.display = 'none';
        } else if (Notification.permission === 'denied') {
          badgeNotify.className = 'pill pill-red';
          badgeNotify.innerHTML = '<i class="fa-solid fa-ban"></i> Blocked in OS';
          if (btnReqNotify) {
            btnReqNotify.textContent = 'Blocked in Settings';
            btnReqNotify.disabled = true;
          }
        } else {
          badgeNotify.className = 'pill pill-gold';
          badgeNotify.textContent = 'Not Enabled';
          if (btnReqNotify) {
            btnReqNotify.style.display = 'inline-flex';
            btnReqNotify.disabled = false;
          }
        }
      }

      // 2. Camera Badge
      if (badgeCamera) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          badgeCamera.className = 'pill pill-muted';
          badgeCamera.textContent = 'Not Supported';
        } else if (navigator.permissions && navigator.permissions.query) {
          try {
            const camStat = await navigator.permissions.query({ name: 'camera' });
            if (camStat.state === 'granted') {
              badgeCamera.className = 'pill pill-green';
              badgeCamera.innerHTML = '<i class="fa-solid fa-circle-check"></i> Allowed';
              if (btnReqCamera) btnReqCamera.style.display = 'none';
            } else if (camStat.state === 'denied') {
              badgeCamera.className = 'pill pill-red';
              badgeCamera.innerHTML = '<i class="fa-solid fa-ban"></i> Blocked';
            } else {
              badgeCamera.className = 'pill pill-gold';
              badgeCamera.textContent = 'Prompt on Use';
            }
          } catch (e) {
            badgeCamera.className = 'pill pill-blue';
            badgeCamera.textContent = 'Ready';
          }
        } else {
          badgeCamera.className = 'pill pill-blue';
          badgeCamera.textContent = 'Ready';
        }
      }

      // 3. Microphone Badge
      if (badgeMic) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          badgeMic.className = 'pill pill-muted';
          badgeMic.textContent = 'Not Supported';
        } else if (navigator.permissions && navigator.permissions.query) {
          try {
            const micStat = await navigator.permissions.query({ name: 'microphone' });
            if (micStat.state === 'granted') {
              badgeMic.className = 'pill pill-green';
              badgeMic.innerHTML = '<i class="fa-solid fa-circle-check"></i> Allowed';
              if (btnReqMic) btnReqMic.style.display = 'none';
            } else if (micStat.state === 'denied') {
              badgeMic.className = 'pill pill-red';
              badgeMic.innerHTML = '<i class="fa-solid fa-ban"></i> Blocked';
            } else {
              badgeMic.className = 'pill pill-gold';
              badgeMic.textContent = 'Prompt on Use';
            }
          } catch (e) {
            badgeMic.className = 'pill pill-blue';
            badgeMic.textContent = 'Ready';
          }
        } else {
          badgeMic.className = 'pill pill-blue';
          badgeMic.textContent = 'Ready';
        }
      }

      // 4. Storage Persistence Badge
      if (badgeStorage && navigator.storage && navigator.storage.persisted) {
        try {
          const isPersisted = await navigator.storage.persisted();
          if (isPersisted) {
            badgeStorage.className = 'pill pill-green';
            badgeStorage.innerHTML = '<i class="fa-solid fa-circle-check"></i> Persisted';
            if (btnReqStorage) btnReqStorage.style.display = 'none';
          }
        } catch (e) {}
      }
    };
    updateAllPermissionBadges();

    // Wire Notification Request Button
    if (btnReqNotify) {
      btnReqNotify.addEventListener('click', async () => {
        await window.requestNativeNotificationPermission();
        updateAllPermissionBadges();
      });
    }

    // Wire Test Notification Button
    if (btnTestNotify) {
      btnTestNotify.addEventListener('click', async () => {
        if ('Notification' in window && Notification.permission === 'granted') {
          window.sendAppNotification('🔔 Eco Green Solar System Alert', {
            body: 'Native push notifications are active on this device! Dispatch & inventory alerts will appear here.',
            tag: 'test-alert'
          });
          if (window.showToast) window.showToast('Test notification sent!', 'success');
        } else {
          const res = await window.requestNativeNotificationPermission();
          if (res === 'granted') {
            window.sendAppNotification('🔔 Eco Green Solar System Alert', {
              body: 'Native push notifications are active on this device!',
              tag: 'test-alert'
            });
          }
          updateAllPermissionBadges();
        }
      });
    }

    // Wire Camera Permission Request Button
    if (btnReqCamera) {
      btnReqCamera.addEventListener('click', async () => {
        await window.requestNativeCameraPermission();
        updateAllPermissionBadges();
      });
    }

    // Wire Mic Permission Request Button
    if (btnReqMic) {
      btnReqMic.addEventListener('click', async () => {
        await window.requestNativeMicPermission();
        updateAllPermissionBadges();
      });
    }

    // Wire Storage Persistence Request Button
    if (btnReqStorage) {
      btnReqStorage.addEventListener('click', async () => {
        await window.requestNativeStoragePermission();
        updateAllPermissionBadges();
      });
    }

    // Wire Scanner Audio Feedback Selector
    if (audioSelect) {
      const curSound = localStorage.getItem('egs_scanner_sound') || 'beep';
      audioSelect.value = curSound;
      audioSelect.addEventListener('change', () => {
        const val = audioSelect.value;
        localStorage.setItem('egs_scanner_sound', val);
        if (window.showToast) window.showToast(`Scanner sound updated to: ${val}`, 'info');
      });
    }
    if (btnTestAudio) {
      btnTestAudio.addEventListener('click', () => {
        if (window.playScannerTone) window.playScannerTone();
      });
    }

    if (pwaModeVal) {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      pwaModeVal.innerHTML = isStandalone
        ? '<span style="color:var(--green);"><i class="fa-solid fa-circle-check"></i> Standalone Installed App</span>'
        : '<span>Web Browser Tab (PWA Ready)</span>';
    }

    // -------------------------------------------------------------
    // 7. About System Tab Wiring (Check for Updates)
    // -------------------------------------------------------------
    const btnCheckUpdate = document.getElementById('btnAboutCheckUpdate');
    if (btnCheckUpdate) {
      btnCheckUpdate.addEventListener('click', async () => {
        btnCheckUpdate.disabled = true;
        btnCheckUpdate.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking server...';
        try {
          if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) await reg.update();
          }
          setTimeout(() => {
            btnCheckUpdate.disabled = false;
            btnCheckUpdate.innerHTML = '<i class="fa-solid fa-circle-check"></i> You are on the Latest Version';
            if (window.showToast) window.showToast('App is running the latest Build 113 (v1.10.0)!', 'success');
          }, 1200);
        } catch (e) {
          btnCheckUpdate.disabled = false;
          btnCheckUpdate.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Check for Updates';
        }
      });
    }
  }

  window.openSettingsModal = openAppSettingsPanel;

  function openProfileMenu(targetElement) {
    closeProfileMenu();
    const isMobile = window.innerWidth <= 900;
    if (isMobile) {
      if (typeof window.closeSidebar === 'function') window.closeSidebar();
      if (typeof closeAllFlyouts === 'function') closeAllFlyouts();
    }
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

    if (isMobile) {
      profileMenuBackdrop = document.createElement('div');
      profileMenuBackdrop.className = 'egs-flyout-backdrop';
      profileMenuBackdrop.style.zIndex = '24999';
      profileMenuBackdrop.onclick = closeProfileMenu;
      document.body.appendChild(profileMenuBackdrop);
    }

    const menu = document.createElement('div');
    menu.className = 'profile-menu profile-menu-wide' + (isMobile ? ' profile-menu-mobile' : '');
    menu.innerHTML = `
      <div class="profile-menu-header" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div class="name">${userTxt}</div>
          <div class="role">${roleTxt}</div>
        </div>
        ${isMobile ? '<button type="button" class="modal-close" style="width:28px;height:28px;font-size:13px;border:none;background:transparent;color:var(--txt-muted);cursor:pointer;" onclick="window.closeProfileMenu()"><i class="fa-solid fa-xmark"></i></button>' : ''}
      </div>
      <div class="profile-menu-section-label">Accounts</div>
      <div class="profile-accounts">${accountRows || '<p class="note" style="padding:8px 12px;margin:0;">No saved accounts yet</p>'}</div>
      <button type="button" class="profile-menu-item" id="profileAddAccount"><i class="fa-solid fa-user-plus"></i> Add account</button>
      <div class="profile-menu-divider"></div>
      <div class="profile-menu-section-label">Workspace Theme</div>
      <div class="profile-theme-row">
        <button type="button" class="theme-btn" data-theme-set="dark" title="Dark"><i class="fa-solid fa-moon"></i> Dark</button>
        <button type="button" class="theme-btn" data-theme-set="gray" title="Gray"><i class="fa-solid fa-circle-half-stroke"></i> Gray</button>
        <button type="button" class="theme-btn" data-theme-set="light" title="Light"><i class="fa-solid fa-sun"></i> Light</button>
        <button type="button" class="theme-btn" data-theme-set="emerald" title="Emerald"><i class="fa-solid fa-leaf" style="color:#2ecc71;"></i> Emerald</button>
        <button type="button" class="theme-btn" data-theme-set="ocean" title="Ocean"><i class="fa-solid fa-water" style="color:#38bdf8;"></i> Ocean</button>
      </div>
      <div class="profile-menu-divider"></div>
      <button type="button" class="profile-menu-item" id="profileSettings"><i class="fa-solid fa-gear"></i> System Settings</button>
      <button type="button" class="profile-menu-item" id="profileInstallApp"><i class="fa-solid fa-download"></i> Install ERP App (iOS / Android / PC)</button>
      <button type="button" class="profile-menu-item" id="profileLoginActivity"><i class="fa-solid fa-mobile-screen-button"></i> Login activity</button>
      <button type="button" class="profile-menu-item danger" id="profileLogout"><i class="fa-solid fa-right-from-bracket"></i> Log out</button>`;
    document.body.appendChild(menu);

    if (isMobile) {
      menu.style.position = 'fixed';
      menu.style.left = '50%';
      menu.style.top = '50%';
      menu.style.transform = 'translate(-50%, -50%)';
      menu.style.width = 'min(340px, calc(100vw - 28px))';
      menu.style.maxHeight = 'calc(100vh - 40px)';
      menu.style.overflowY = 'auto';
      menu.style.zIndex = '25000';
    } else {
      const anchor = targetElement || profileBox;
      const rect = anchor ? anchor.getBoundingClientRect() : { left: 10, top: 500 };
      const menuRect = menu.getBoundingClientRect();
      menu.style.left = Math.max(10, rect.left) + 'px';
      menu.style.top = Math.max(10, rect.top - menuRect.height - 8) + 'px';
      menu.style.zIndex = '25000';
    }
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

    const installAppBtn = menu.querySelector('#profileInstallApp');
    if (installAppBtn) {
      installAppBtn.addEventListener('click', () => {
        closeProfileMenu();
        if (window.openAppInstallGuide) window.openAppInstallGuide();
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
    const target = e ? (e.currentTarget || e.target) : null;
    if (profileMenuEl) closeProfileMenu();
    else openProfileMenu(target);
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

  // =====================================================================
  // SHREE SAVA / TALLY STYLE SIDEBAR NAVIGATION & FLOATING FLYOUT SYSTEM
  // =====================================================================

  function formatHkLabel(text, char) {
    if (!char) return text;
    const idx = text.toLowerCase().indexOf(char.toLowerCase());
    if (idx === -1) return text;
    const match = text.substr(idx, 1);
    return text.substring(0, idx) + `<span class="erp-hk-char">${match}</span>` + text.substring(idx + 1);
  }

  function getErpNavGroups() {
    const isAcc = window.ERP && window.ERP.isAccountingMode();
    const isFinOnly = window.ERP && window.ERP.isFinancialOnly();
    const isQtyOnly = window.ERP && window.ERP.isQuantityOnly();

    const accountsItems = [
      {
        name: 'Ledger Info',
        hotkey: 'L',
        icon: 'fa-address-book',
        hasNested: true,
        nestedTitle: 'Ledger Info',
        nestedItems: [
          { name: 'Create', hotkey: 'C', icon: 'fa-plus', page: 'partyledger', action: 'create' },
          { name: 'Display', hotkey: 'D', icon: 'fa-eye', page: 'partyledger', action: 'display' },
          { name: 'Alter', hotkey: 'A', icon: 'fa-pen-to-square', page: 'partyledger', action: 'alter' }
        ]
      }
    ];

    if (!isFinOnly) {
      accountsItems.push(
        {
          name: 'Item / Product Info',
          hotkey: 'I',
          icon: 'fa-cubes',
          hasNested: true,
          nestedTitle: 'Item / Product Info',
          nestedItems: [
            { name: 'Create', hotkey: 'C', icon: 'fa-plus', page: 'masters', sub: 'item-reg', action: 'create' },
            { name: 'Display', hotkey: 'D', icon: 'fa-eye', page: 'masters', sub: 'item-reg', action: 'display' },
            { name: 'Alter', hotkey: 'A', icon: 'fa-pen-to-square', page: 'masters', sub: 'item-reg', action: 'alter' }
          ]
        },
        {
          name: 'Group / Category Info',
          hotkey: 'G',
          icon: 'fa-layer-group',
          hasNested: true,
          nestedTitle: 'Category Info',
          nestedItems: [
            { name: 'Create', hotkey: 'C', icon: 'fa-plus', page: 'masters', sub: 'category', action: 'create' },
            { name: 'Display / Alter', hotkey: 'D', icon: 'fa-list-check', page: 'masters', sub: 'category', action: 'display' }
          ]
        },
        {
          name: 'Unit of Measure (UOM)',
          hotkey: 'U',
          icon: 'fa-ruler-combined',
          hasNested: true,
          nestedTitle: 'UOM Info',
          nestedItems: [
            { name: 'Create', hotkey: 'C', icon: 'fa-plus', page: 'masters', sub: 'uom', action: 'create' },
            { name: 'Display / Alter', hotkey: 'D', icon: 'fa-list-check', page: 'masters', sub: 'uom', action: 'display' }
          ]
        }
      );

      if (window.ERP && window.ERP.isWarehouseEnabled()) {
        accountsItems.push({
          name: 'Warehouse / Godown Info',
          hotkey: 'W',
          icon: 'fa-warehouse',
          requires: 'warehouse',
          hasNested: true,
          nestedTitle: 'Warehouse Info',
          nestedItems: [
            { name: 'Create', hotkey: 'C', icon: 'fa-plus', page: 'masters', sub: 'warehouse', action: 'create' },
            { name: 'Display / Alter', hotkey: 'D', icon: 'fa-list-check', page: 'masters', sub: 'warehouse', action: 'display' }
          ]
        });
      }

      accountsItems.push({
        name: 'Brand Directory',
        hotkey: 'B',
        icon: 'fa-tags',
        hasNested: true,
        nestedTitle: 'Brand Directory',
        nestedItems: [
          { name: 'Display / Alter', hotkey: 'D', icon: 'fa-list-check', page: 'masters', sub: 'brand', action: 'display' }
        ]
      });
    }

    accountsItems.push({
      name: 'Customer & Supplier Directory',
      hotkey: 'C',
      icon: 'fa-users',
      hasNested: true,
      nestedTitle: 'Parties Directory',
      nestedItems: [
        { name: 'Customer Directory', hotkey: 'C', icon: 'fa-hand-holding-dollar', page: 'partyledger', filter: 'Customer' },
        { name: 'Supplier Directory', hotkey: 'S', icon: 'fa-truck-ramp-box', page: 'partyledger', filter: 'Supplier' }
      ]
    });

    const transactionItems = [];
    if (isAcc) {
      transactionItems.push(
        { name: 'Payment Voucher (F5)', hotkey: 'V', icon: 'fa-arrow-up-from-bracket', page: 'vouchers', action: 'Payment' },
        { name: 'Receipt Voucher (F6)', hotkey: 'R', icon: 'fa-arrow-down-to-bracket', page: 'vouchers', action: 'Receipt' },
        { name: 'Journal Voucher (F7)', hotkey: 'J', icon: 'fa-scale-balanced', page: 'vouchers', action: 'Journal' },
        { name: 'Debit Note (Alt+F5)', hotkey: 'E', icon: 'fa-file-circle-minus', page: 'vouchers', action: 'DebitNote' },
        { name: 'Credit Note (Alt+F6)', hotkey: 'O', icon: 'fa-file-circle-plus', page: 'vouchers', action: 'CreditNote' }
      );
    }

    if (!isFinOnly) {
      transactionItems.push(
        { name: 'Purchase Inward (Stock In)', hotkey: 'P', icon: 'fa-truck-ramp-box', page: 'purchase' },
        { name: 'Project Sales & Dispatch', hotkey: 'S', icon: 'fa-handshake', page: 'sales' }
      );
      if (window.ERP && window.ERP.isBomEnabled()) {
        transactionItems.push(
          { name: 'BOM Kit Assembly & Dispatch', hotkey: 'B', icon: 'fa-boxes-packing', page: 'bom', action: 'create', requires: 'bom' },
          { name: 'Custom Delivery Challan', hotkey: 'C', icon: 'fa-pen-nib', page: 'bom', action: 'custom-challan', requires: 'bom' }
        );
      }
      transactionItems.push(
        { name: 'Stock Allocation & Journal', hotkey: 'A', icon: 'fa-tag', page: 'stockassign', requires: 'stock' },
        { name: 'Sales Return & Damage', hotkey: 'M', icon: 'fa-arrow-rotate-left', page: 'returns' }
      );
      if (!isQtyOnly) {
        transactionItems.push(
          { name: 'Serial Number Scan Sheet', hotkey: 'N', icon: 'fa-barcode', page: 'scansheet', requires: 'serial' }
        );
      }
    }

    const accountBookItems = [
      { name: 'Party Ledger Statement', hotkey: 'L', icon: 'fa-money-check-dollar', page: 'partyledger', action: 'display' },
      { name: 'Purchase Register', hotkey: 'P', icon: 'fa-cart-shopping', page: 'purchaseregister' },
      { name: 'Sale Register', hotkey: 'S', icon: 'fa-money-bill-transfer', page: 'saleregister' }
    ];

    if (isAcc) {
      accountBookItems.push(
        { name: 'Trial Balance', hotkey: 'T', icon: 'fa-list-ol', page: 'financialreports', tab: 'trial-balance' },
        { name: 'Profit & Loss Statement', hotkey: 'O', icon: 'fa-chart-line', page: 'financialreports', tab: 'profit-loss' },
        { name: 'Balance Sheet', hotkey: 'B', icon: 'fa-building-columns', page: 'financialreports', tab: 'balance-sheet' },
        { name: 'Day Book Journal', hotkey: 'D', icon: 'fa-calendar-day', page: 'financialreports', tab: 'day-book' }
      );
    }

    const displayItems = [
      {
        name: 'Account Books',
        hotkey: 'A',
        icon: 'fa-book',
        hasNested: true,
        nestedTitle: 'Account Books',
        nestedItems: accountBookItems
      }
    ];

    if (!isFinOnly) {
      const stockBookItems = [
        { name: 'Master Inventory Report', hotkey: 'M', icon: 'fa-clipboard-list', page: 'reports', requires: 'stock' },
        { name: 'Low Stock Alert', hotkey: 'L', icon: 'fa-triangle-exclamation', page: 'lowstock', requires: 'stock' }
      ];
      if (window.ERP && window.ERP.isBomEnabled()) {
        stockBookItems.push(
          { name: 'BOM Dispatch Register', hotkey: 'B', icon: 'fa-clipboard-list', page: 'bom', action: 'register', requires: 'bom' },
          { name: 'Delivery Challans Register', hotkey: 'C', icon: 'fa-file-invoice', page: 'bom', action: 'challan', requires: 'bom' },
          { name: 'Track BOM Order Progress', hotkey: 'T', icon: 'fa-route', page: 'bom', action: 'track', requires: 'bom' }
        );
      }
      displayItems.push({
        name: 'Stock Books',
        hotkey: 'S',
        icon: 'fa-boxes-stacked',
        requires: 'stock',
        hasNested: true,
        nestedTitle: 'Stock Books',
        nestedItems: stockBookItems
      });
    }

    return [
      {
        type: 'single',
        id: 'dashboard',
        name: 'Gateway / Dashboard',
        hotkey: 'G',
        icon: 'fa-house-chimney',
        page: 'dashboard'
      },
      {
        type: 'group',
        id: 'grp-accounts',
        name: 'Accounts Info',
        flyoutTitle: 'A/c Info',
        hotkey: 'A',
        icon: 'fa-folder-open',
        items: accountsItems
      },
      {
        type: 'group',
        id: 'grp-transactions',
        name: 'Transaction Entry',
        flyoutTitle: 'Transaction Entry',
        hotkey: 'T',
        icon: 'fa-receipt',
        items: transactionItems
      },
      {
        type: 'group',
        id: 'grp-display',
        name: 'Display / Print',
        flyoutTitle: 'Display / Print',
        hotkey: 'D',
        icon: 'fa-chart-pie',
        items: displayItems
      },
      {
        type: 'group',
        id: 'grp-utilities',
        name: 'Utilities & Setup',
        flyoutTitle: 'Utilities & Setup',
        hotkey: 'U',
        icon: 'fa-gear',
        items: [
          { name: 'ERP Mode & Feature Controls', hotkey: 'S', icon: 'fa-sliders', action: 'openSettings', sub: 'tab-erp-mode' },
          { name: 'User Accounts & Roles', hotkey: 'U', icon: 'fa-users-gear', action: 'openSettings', sub: 'tab-users' },
          { name: 'Backup & Restore', hotkey: 'B', icon: 'fa-cloud-arrow-up', page: 'backup' }
        ]
      }
    ];
  }

  let ERP_NAV_GROUPS = getErpNavGroups();

  function shouldShowNavItem(item) {
    if (!item.requires) return true;
    if (item.requires === 'bom') return window.ERP ? window.ERP.isBomEnabled() : true;
    if (item.requires === 'serial') return window.ERP ? window.ERP.isSerialEnabled() : true;
    if (item.requires === 'warehouse') return window.ERP ? window.ERP.isWarehouseEnabled() : true;
    if (item.requires === 'stock') return window.ERP ? !window.ERP.isAccountsOnly() : true;
    return true;
  }

  // Navigation State Engine
  const navState = {
    focusTier: 'none', // 'none' | 'sidebar' | 'flyout_tier1' | 'flyout_tier2'
    sidebarIndex: 0,
    tier1Index: 0,
    tier2Index: -1,
    activeFlyoutGroup: null,
    activeNestedParentEl: null
  };

  function closeAllFlyouts() {
    navState.focusTier = 'none';
    navState.tier1Index = -1;
    navState.tier2Index = -1;
    navState.activeFlyoutGroup = null;
    navState.activeNestedParentEl = null;

    const existing = document.getElementById('egsActiveSidebarFlyout');
    if (existing) existing.remove();
    const backdrop = document.getElementById('egsActiveFlyoutBackdrop');
    if (backdrop) backdrop.remove();
    document.querySelectorAll('.erp-sidebar-btn').forEach((b) => {
      b.classList.remove('flyout-open');
    });
  }

  function setNestedSubmenuOpen(parentRowEl, open = true) {
    const flyout = document.getElementById('egsActiveSidebarFlyout');
    if (!flyout) return;

    flyout.querySelectorAll('.egs-flyout-item.has-nested').forEach((row) => {
      if (row !== parentRowEl || !open) {
        row.classList.remove('nested-open');
        row.querySelectorAll('.egs-flyout-item').forEach((sub) => sub.classList.remove('selected'));
      }
    });

    if (open && parentRowEl) {
      parentRowEl.classList.add('nested-open');
      navState.activeNestedParentEl = parentRowEl;
    } else if (!open) {
      navState.activeNestedParentEl = null;
    }
  }

  function updateTier1Selection(index, openNested = false) {
    const flyout = document.getElementById('egsActiveSidebarFlyout');
    if (!flyout) return;
    const items = Array.from(flyout.querySelectorAll('.egs-flyout-list > .tier1-item'));
    if (!items.length) return;

    if (index < 0) index = 0;
    if (index >= items.length) index = items.length - 1;
    navState.tier1Index = index;

    items.forEach((it, idx) => {
      const isSel = (idx === index);
      it.classList.toggle('selected', isSel);
      if (isSel && it.classList.contains('has-nested') && openNested) {
        setNestedSubmenuOpen(it, true);
      }
    });

    if (!openNested) {
      setNestedSubmenuOpen(null, false);
    }
  }

  function updateTier2Selection(index) {
    if (!navState.activeNestedParentEl) return;
    const subItems = Array.from(navState.activeNestedParentEl.querySelectorAll('.egs-nested-flyout-box .tier2-item'));
    if (!subItems.length) return;

    if (index < 0) index = 0;
    if (index >= subItems.length) index = subItems.length - 1;
    navState.tier2Index = index;

    subItems.forEach((it, idx) => {
      it.classList.toggle('selected', idx === index);
    });
  }

  function openSidebarFlyout(grp, anchorEl, selectFirst = true) {
    closeAllFlyouts();
    if (!grp) return;
    navState.activeFlyoutGroup = grp;
    navState.focusTier = 'flyout_tier1';
    navState.tier1Index = selectFirst ? 0 : -1;
    navState.tier2Index = -1;

    if (anchorEl) anchorEl.classList.add('flyout-open');

    // Create Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'egsActiveFlyoutBackdrop';
    backdrop.className = 'egs-flyout-backdrop';
    backdrop.onclick = closeAllFlyouts;
    document.body.appendChild(backdrop);

    // Create Flyout Box
    const flyout = document.createElement('div');
    flyout.id = 'egsActiveSidebarFlyout';
    flyout.className = 'egs-flyout-box';

    const rect = anchorEl ? anchorEl.getBoundingClientRect() : { top: 120, right: 260, bottom: 160 };
    const isMobile = window.innerWidth <= 900;
    if (isMobile) {
      if (typeof window.closeSidebar === 'function') window.closeSidebar();
      flyout.style.left = '50%';
      flyout.style.top = '50%';
      flyout.style.transform = 'translate(-50%, -50%)';
      flyout.style.width = 'min(340px, calc(100vw - 28px))';
      flyout.style.maxWidth = 'calc(100vw - 28px)';
      flyout.style.maxHeight = 'calc(100vh - 60px)';
      flyout.style.overflowY = 'auto';
      flyout.style.zIndex = '20000';
      backdrop.style.zIndex = '19999';
    } else {
      flyout.style.left = (rect.right + 10) + 'px';
      flyout.style.top = Math.min(Math.max(rect.top, 60), window.innerHeight - 380) + 'px';
      flyout.style.zIndex = '10005';
    }

    let itemsHtml = '';
    grp.items.forEach((item) => {
      if (!shouldShowNavItem(item)) return;

      const itemLabelHtml = formatHkLabel(item.name, item.hotkey);

      if (item.hasNested) {
        let nestedRows = '';
        item.nestedItems.forEach((sub) => {
          if (!shouldShowNavItem(sub)) return;
          const subLabelHtml = formatHkLabel(sub.name, sub.hotkey);
          nestedRows += `
            <div class="egs-flyout-item tier2-item" data-page="${sub.page || ''}" data-sub="${sub.sub || sub.tab || ''}" data-action="${sub.action || ''}" data-filter="${sub.filter || ''}" data-group-id="${grp.id}" data-hotkey="${sub.hotkey || ''}">
              <span class="item-text"><i class="fa-solid ${sub.icon}" style="color:var(--blue); font-size:12px;"></i> <span>${subLabelHtml}</span></span>
            </div>
          `;
        });

        itemsHtml += `
          <div class="egs-flyout-item tier1-item has-nested" data-hotkey="${item.hotkey || ''}">
            <span class="item-text"><i class="fa-solid ${item.icon}" style="color:var(--gold); font-size:12px;"></i> <span>${itemLabelHtml}</span></span>
            <i class="fa-solid fa-chevron-right item-arrow"></i>
            <div class="egs-nested-flyout-box">
              <div class="egs-flyout-header"><span>${item.nestedTitle || item.name}</span></div>
              <div class="egs-flyout-list">${nestedRows}</div>
            </div>
          </div>
        `;
      } else {
        itemsHtml += `
          <div class="egs-flyout-item tier1-item" data-page="${item.page || ''}" data-sub="${item.sub || item.tab || ''}" data-action="${item.action || ''}" data-filter="${item.filter || ''}" data-group-id="${grp.id}" data-hotkey="${item.hotkey || ''}">
            <span class="item-text"><i class="fa-solid ${item.icon}" style="color:var(--blue); font-size:12px;"></i> <span>${itemLabelHtml}</span></span>
          </div>
        `;
      }
    });

    flyout.innerHTML = `
      <div class="egs-flyout-header">
        <span>${grp.flyoutTitle || grp.name}</span>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="flyout-hint"><kbd>Esc</kbd></span>
          <button type="button" class="btn-flyout-close" style="background:transparent; border:none; color:var(--txt-muted); font-size:14px; cursor:pointer; padding:2px 6px; display:inline-flex; align-items:center;" aria-label="Close menu"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
      <div class="egs-flyout-list">${itemsHtml}</div>
    `;

    document.body.appendChild(flyout);

    const closeBtn = flyout.querySelector('.btn-flyout-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllFlyouts();
      });
    }

    function dismissMobileSidebar() {
      if (window.innerWidth <= 900) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.remove('open');
        const overlay = document.getElementById('sidebarOverlay') || document.querySelector('.overlay');
        if (overlay) overlay.classList.remove('show');
      }
    }

    // Wire mouseenter and clicks on flyout items
    const tier1Els = Array.from(flyout.querySelectorAll('.egs-flyout-list > .tier1-item'));
    tier1Els.forEach((row, idx) => {
      row.addEventListener('mouseenter', () => {
        if (window.innerWidth <= 768) return; // Ignore hover on mobile/touch
        navState.focusTier = 'flyout_tier1';
        navState.tier1Index = idx;
        tier1Els.forEach((r, i) => r.classList.toggle('selected', i === idx));
        if (row.classList.contains('has-nested')) {
          setNestedSubmenuOpen(row, true);
        } else {
          setNestedSubmenuOpen(null, false);
        }
      });

      row.addEventListener('click', (e) => {
        if (row.classList.contains('has-nested') && !e.target.closest('.egs-nested-flyout-box .tier2-item')) {
          e.stopPropagation();
          const isOpen = row.classList.contains('nested-open');
          setNestedSubmenuOpen(row, !isOpen);
          if (!isOpen) {
            navState.focusTier = 'flyout_tier2';
            navState.tier2Index = 0;
            updateTier2Selection(0);
          }
          return;
        }
        e.stopPropagation();
        const page = row.dataset.page;
        const sub = row.dataset.sub;
        const action = row.dataset.action;
        const filter = row.dataset.filter;
        const groupId = row.dataset.groupId;

        closeAllFlyouts();
        dismissMobileSidebar();
        if (action === 'openSettings' && typeof window.openSystemSettingsModal === 'function') {
          window.openSystemSettingsModal(sub || 'tab-erp-mode');
        } else if (page) {
          go(page, { sub, action, filter, groupId });
        }
      });
    });

    // Wire mouseenter and clicks on Tier 2 items
    flyout.querySelectorAll('.tier2-item').forEach((subRow) => {
      subRow.addEventListener('mouseenter', () => {
        navState.focusTier = 'flyout_tier2';
        const parentBox = subRow.closest('.egs-nested-flyout-box');
        if (parentBox) {
          const allSubs = Array.from(parentBox.querySelectorAll('.tier2-item'));
          const sIdx = allSubs.indexOf(subRow);
          navState.tier2Index = sIdx;
          allSubs.forEach((sr, i) => sr.classList.toggle('selected', i === sIdx));
        }
      });

      subRow.addEventListener('click', (e) => {
        e.stopPropagation();
        const page = subRow.dataset.page;
        const sub = subRow.dataset.sub;
        const action = subRow.dataset.action;
        const filter = subRow.dataset.filter;
        const groupId = subRow.dataset.groupId;
        closeAllFlyouts();
        dismissMobileSidebar();
        if (page) go(page, { sub, action, filter, groupId });
      });
    });

    if (selectFirst && tier1Els.length > 0) {
      updateTier1Selection(0, false);
    }
  }

  window.openSidebarFlyout = openSidebarFlyout;
  window.closeSidebarFlyout = closeAllFlyouts;

  function renderNavButtons() {
    const navEl = document.getElementById('navScroll') || document.querySelector('.nav-scroll');
    if (!navEl) return;
    navEl.innerHTML = '';

    ERP_NAV_GROUPS = getErpNavGroups();

    ERP_NAV_GROUPS.forEach((grp, gIdx) => {
      const labelHtml = formatHkLabel(grp.name, grp.hotkey);

      if (grp.type === 'single') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'erp-sidebar-btn' + (grp.id === 'dashboard' ? ' active' : '');
        btn.id = 'btnNav_' + grp.id;
        btn.dataset.tab = grp.id;
        btn.dataset.index = gIdx;
        btn.innerHTML = `
          <span class="btn-label"><i class="fa-solid ${grp.icon}"></i> <span>${labelHtml}</span></span>
        `;
        btn.onclick = () => {
          closeAllFlyouts();
          if (typeof window.closeSidebar === 'function') window.closeSidebar();
          go(grp.page);
        };
        navEl.appendChild(btn);
        return;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'erp-sidebar-btn';
      btn.id = 'btnNav_' + grp.id;
      btn.dataset.groupId = grp.id;
      btn.dataset.index = gIdx;
      btn.innerHTML = `
        <span class="btn-label"><i class="fa-solid ${grp.icon}" style="color:var(--gold);"></i> <span>${labelHtml}</span></span>
        <i class="fa-solid fa-chevron-right btn-arrow"></i>
      `;

      btn.onclick = (e) => {
        e.stopPropagation();
        if (navState.activeFlyoutGroup === grp) {
          closeAllFlyouts();
        } else {
          openSidebarFlyout(grp, btn, true);
        }
      };

      navEl.appendChild(btn);
    });
  }
  window.renderNavButtons = renderNavButtons;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderNavButtons);
  } else {
    renderNavButtons();
  }

  function go(id, opts = {}) {
    const page = window.PAGES[id];
    if (!page) return;

    closeAllFlyouts();
    if (window.innerWidth <= 900 && typeof window.closeSidebar === 'function') {
      window.closeSidebar();
    }

    // Prevent redundant reload spam if key is held down
    if (window.CURRENT_PAGE_ID === id && !opts.sub && !opts.tab && !opts.action && !opts.filter && !opts.force) {
      return;
    }
    window.CURRENT_PAGE_ID = id;

    const contentEl = document.getElementById('content') || content;
    const pageTitleEl = document.getElementById('pageTitle') || pageTitle;
    const pageSubEl = document.getElementById('pageSub') || pageSub;

    if (contentEl) {
      contentEl.classList.remove('page-entering');
      void contentEl.offsetWidth;
      contentEl.innerHTML = page.html || '';
      contentEl.classList.add('page-entering');
    }

    if (pageTitleEl) pageTitleEl.textContent = page.name || 'Dashboard';
    if (pageSubEl) pageSubEl.textContent = page.sub || '';
    if (window.topbarExtra) window.topbarExtra.innerHTML = '';

    // Mark active sidebar parent group or single item strictly
    document.querySelectorAll('.erp-sidebar-btn').forEach((b) => {
      let isMatch = false;
      if (opts.groupId && b.dataset.groupId) {
        isMatch = (b.dataset.groupId === opts.groupId);
      } else if (b.dataset.tab === id) {
        isMatch = true;
      } else if (b.dataset.groupId) {
        const grp = ERP_NAV_GROUPS.find((g) => g.id === b.dataset.groupId);
        if (grp && grp.items) {
          isMatch = grp.items.some((item) => {
            if (item.page === id) {
              if (opts.sub && item.sub) return item.sub === opts.sub;
              return true;
            }
            if (item.nestedItems && item.nestedItems.some((sub) => {
              if (sub.page === id) {
                if (opts.sub && sub.sub) return sub.sub === opts.sub;
                return true;
              }
              return false;
            })) return true;
            return false;
          });
        }
      }
      b.classList.toggle('active', isMatch);
      b.classList.remove('selected');
    });

    if (typeof page.init === 'function') {
      try {
        page.init();
      } catch (err) {
        console.error(`Error initializing page "${id}":`, err);
      }
    }

    if (opts.tab || opts.sub || opts.action || opts.filter) {
      setTimeout(() => {
        const subKey = opts.sub || opts.tab;
        if (subKey) {
          const subTabBtn = document.querySelector(
            `#mastersSubtabs [data-sub="${subKey}"], .subtabs [data-sub="${subKey}"], [data-tab="${subKey}"], #${subKey}`
          );
          if (subTabBtn) {
            subTabBtn.click();
          }
        }

        // BOM specific view switching
        if (id === 'bom') {
          if (opts.action === 'create' || opts.tab === 'create') {
            const btn = document.getElementById('bomHomeBtnCreate');
            if (btn) btn.click();
          } else if (opts.action === 'track' || opts.tab === 'track') {
            const btn = document.getElementById('bomHomeBtnTrack');
            if (btn) btn.click();
          } else if (opts.action === 'register' || opts.tab === 'register') {
            const btn = document.getElementById('bomHomeBtnRegister');
            if (btn) btn.click();
          } else if (opts.action === 'challan' || opts.tab === 'challan') {
            const btn = document.getElementById('bomHomeBtnChallanReg');
            if (btn) btn.click();
          } else if (opts.action === 'custom-challan' || opts.tab === 'custom-challan') {
            const btn = document.getElementById('bomHomeBtnCustomChallan');
            if (btn) btn.click();
          }
        }

        // Party Ledger filter & action switching (No autofocus on search)
        if (id === 'partyledger') {
          if (opts.filter) {
            const typeFilter = document.getElementById('plTypeFilter');
            if (typeFilter) {
              typeFilter.value = opts.filter;
              typeFilter.dispatchEvent(new Event('change'));
            }
          }
          if (typeof window.setPartyLedgerMode === 'function') {
            window.setPartyLedgerMode(opts.action || 'display');
          }
        }

        // Masters actions switching (No autofocus on search)
        if (id === 'masters') {
          if (opts.action && typeof window.setMasterViewMode === 'function') {
            window.setMasterViewMode(opts.action);
          }
          if (opts.action === 'create') {
            if (subKey === 'category') {
              const catInp = document.getElementById('mInputCatName');
              if (catInp) catInp.focus();
            } else if (subKey === 'uom') {
              const uomInp = document.getElementById('mInputUomName');
              if (uomInp) uomInp.focus();
            } else if (subKey === 'warehouse') {
              const whInp = document.getElementById('mInputWhName');
              if (whInp) whInp.focus();
            }
          }
        }

        // Vouchers Fast-switch
        if (id === 'vouchers') {
          if (opts.action && typeof window.setVoucherTypeMode === 'function') {
            window.setVoucherTypeMode(opts.action);
          }
        }

        // Financial Reports Fast-switch
        if (id === 'financialreports') {
          if (opts.tab) {
            const tabBtn = document.querySelector(`#finReportTabs .subtab[data-tab="${opts.tab}"]`);
            if (tabBtn) tabBtn.click();
          }
        }
      }, 70);
    }

    if (typeof applyGlobalTableSearch === 'function') {
      applyGlobalTableSearch(currentSearchQuery);
    }

    if (typeof closeSidebar === 'function') closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      if (contentEl) contentEl.classList.remove('page-entering');
    }, 400);

    try {
      const subParam = opts.sub || opts.tab || opts.action;
      const newHash = subParam ? `#${id}:${subParam}` : `#${id}`;
      if (window.location.hash !== newHash) {
        history.replaceState(null, '', newHash);
      }
    } catch (e) {}
  }

  window.goPage = go;
  window.navigateToPage = go;
  window.renderNavButtons = renderNavButtons;

  // =========================================================================
  // SHREE SAVA / TALLY KEYBOARD HOTKEY & ARROW ROUTER
  // =========================================================================
  function handleAccountingKeyboard(e) {
    if (e.repeat) return false;
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);

    // ESCAPE KEY: UNIVERSAL STEP-BY-STEP EXIT & BACK ENGINE (Tally / Shree Sava Standard)
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();

      // Step 1: If typing in any input/textarea/select, blur it immediately so focus returns to the page root!
      if (isTyping && document.activeElement) {
        document.activeElement.blur();
        if (e.target && (e.target.id === 'egsQuickSearch' || e.target.id === 'egsQuickSearchMobile')) {
          e.target.value = '';
          applyGlobalTableSearch('');
        }
      }

      // Step 2: If Tier 2 flyout is open, step back to Tier 1
      if (navState.focusTier === 'flyout_tier2') {
        setNestedSubmenuOpen(null, false);
        navState.focusTier = 'flyout_tier1';
        navState.tier2Index = -1;
        updateTier1Selection(navState.tier1Index, false);
        return true;
      }

      // Step 3: If Tier 1 flyout is open, close all flyouts
      if (navState.focusTier === 'flyout_tier1' || document.getElementById('egsActiveSidebarFlyout')) {
        closeAllFlyouts();
        return true;
      }

      // Step 4: If any Modal / Overlay / Statement / Popup is open, close it!
      const modalOverlay = document.getElementById('modalOverlay');
      if (modalOverlay && modalOverlay.classList.contains('show')) {
        window.closeModal();
        return true;
      }
      const popupOverlay = document.getElementById('egsPopupOverlay');
      if (popupOverlay && popupOverlay.classList.contains('show')) {
        popupOverlay.classList.remove('show');
        return true;
      }
      const stOverlay = document.getElementById('statementOverlay');
      if (stOverlay && stOverlay.classList.contains('show')) {
        const stmtBack = document.getElementById('stmtBack');
        if (stmtBack && stmtBack.style.display !== 'none') {
          stmtBack.click();
        } else {
          const closeStmt = document.getElementById('closeStatement');
          if (closeStmt) closeStmt.click();
        }
        return true;
      }
      const lfOverlay = document.getElementById('ledgerFormOverlay');
      if (lfOverlay && lfOverlay.classList.contains('show')) {
        const closeLf = document.getElementById('closeLedgerForm') || document.getElementById('lfCancel');
        if (closeLf) closeLf.click();
        return true;
      }
      const bomChallanOverlay = document.getElementById('bomChallanOverlay');
      if (bomChallanOverlay && bomChallanOverlay.classList.contains('show')) {
        const closeBtn = document.getElementById('bomChallanCloseBtn');
        if (closeBtn) closeBtn.click();
        return true;
      }
      const bomRegisterOverlay = document.getElementById('bomRegisterOverlay');
      if (bomRegisterOverlay && bomRegisterOverlay.classList.contains('show')) {
        const closeBtn = document.getElementById('bomRegisterCloseBtn');
        if (closeBtn) closeBtn.click();
        return true;
      }
      const sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('open')) {
        window.closeSidebar();
        return true;
      }
      const filterMenu = document.querySelector('.th-filter-menu');
      if (filterMenu) {
        filterMenu.remove();
        return true;
      }

      // Step 5: If in BOM Entry view, step back to BOM Home
      const bomEntryView = document.getElementById('bomEntryView');
      const bomBtnBackHome = document.getElementById('bomBtnBackHome');
      if (bomEntryView && bomEntryView.style.display !== 'none' && bomBtnBackHome) {
        bomBtnBackHome.click();
        return true;
      }

      // Step 6: If in Master Create view, step back to Master Display
      if (window.CURRENT_PAGE_ID === 'masters' && window.CURRENT_MASTER_MODE === 'create') {
        if (typeof window.setMasterViewMode === 'function') {
          window.setMasterViewMode('display');
          return true;
        }
      }

      // Step 7: Step-by-step back to Gateway / Dashboard!
      if (window.CURRENT_PAGE_ID && window.CURRENT_PAGE_ID !== 'dashboard') {
        go('dashboard');
        return true;
      }

      return true;
    }

    if (isTyping) return false;

    const modalOpen = document.querySelector('.modal-overlay.show, .settings-modal-box, #statementOverlay.show, #ledgerFormOverlay.show, #egsPopupOverlay.show, #bomChallanOverlay.show, #bomRegisterOverlay.show');
    if (modalOpen) return false;

    const key = e.key;

    // 1. Tier 2 (Nested Submenu) is Active
    if (navState.focusTier === 'flyout_tier2' && navState.activeNestedParentEl) {
      const subItems = Array.from(navState.activeNestedParentEl.querySelectorAll('.tier2-item'));

      if (key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        navState.tier2Index = (navState.tier2Index + 1) % subItems.length;
        updateTier2Selection(navState.tier2Index);
        return true;
      }
      if (key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        navState.tier2Index = (navState.tier2Index - 1 + subItems.length) % subItems.length;
        updateTier2Selection(navState.tier2Index);
        return true;
      }
      if (key === 'ArrowLeft' || key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        // Step-by-step back to Tier 1!
        setNestedSubmenuOpen(null, false);
        navState.focusTier = 'flyout_tier1';
        navState.tier2Index = -1;
        updateTier1Selection(navState.tier1Index, false);
        return true;
      }
      if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (subItems[navState.tier2Index]) {
          subItems[navState.tier2Index].click();
        }
        return true;
      }
      if (/^[a-zA-Z]$/.test(key)) {
        const uKey = key.toUpperCase();
        const matched = subItems.find((it) => it.dataset.hotkey && it.dataset.hotkey.toUpperCase() === uKey);
        if (matched) {
          e.preventDefault();
          e.stopPropagation();
          matched.click();
          return true;
        }
      }
    }

    // 2. Tier 1 (Flyout Menu) is Active
    if (navState.focusTier === 'flyout_tier1' && navState.activeFlyoutGroup) {
      const flyout = document.getElementById('egsActiveSidebarFlyout');
      const tier1Items = flyout ? Array.from(flyout.querySelectorAll('.egs-flyout-list > .tier1-item')) : [];

      if (key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        navState.tier1Index = (navState.tier1Index + 1) % tier1Items.length;
        updateTier1Selection(navState.tier1Index, false);
        return true;
      }
      if (key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        navState.tier1Index = (navState.tier1Index - 1 + tier1Items.length) % tier1Items.length;
        updateTier1Selection(navState.tier1Index, false);
        return true;
      }
      if (key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        const curItem = tier1Items[navState.tier1Index];
        if (curItem && curItem.classList.contains('has-nested')) {
          setNestedSubmenuOpen(curItem, true);
          navState.focusTier = 'flyout_tier2';
          navState.tier2Index = 0;
          updateTier2Selection(0);
        }
        return true;
      }
      if (key === 'ArrowLeft' || key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        // Step-by-step back to Sidebar!
        closeAllFlyouts();
        return true;
      }
      if (key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const curItem = tier1Items[navState.tier1Index];
        if (curItem) {
          if (curItem.classList.contains('has-nested')) {
            setNestedSubmenuOpen(curItem, true);
            navState.focusTier = 'flyout_tier2';
            navState.tier2Index = 0;
            updateTier2Selection(0);
          } else {
            curItem.click();
          }
        }
        return true;
      }
      if (/^[a-zA-Z]$/.test(key)) {
        const uKey = key.toUpperCase();
        const matched = tier1Items.find((it) => it.dataset.hotkey && it.dataset.hotkey.toUpperCase() === uKey);
        if (matched) {
          e.preventDefault();
          e.stopPropagation();
          if (matched.classList.contains('has-nested')) {
            setNestedSubmenuOpen(matched, true);
            navState.focusTier = 'flyout_tier2';
            navState.tier2Index = 0;
            updateTier2Selection(0);
          } else {
            matched.click();
          }
          return true;
        }
      }
    }

    // 3. No Flyout Open — Root Navigation & Global Hotkeys
    if (navState.focusTier === 'none') {
      // ONLY handle Arrow keys / Enter on root sidebar if currently on Dashboard
      if (window.CURRENT_PAGE_ID === 'dashboard') {
        const sidebarBtns = Array.from(document.querySelectorAll('.erp-sidebar-btn'));

        if (key === 'ArrowDown' || key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          const curIdx = sidebarBtns.findIndex((b) => b.classList.contains('selected'));
          let nextIdx = (curIdx === -1) ? 0 : (key === 'ArrowDown' ? curIdx + 1 : curIdx - 1 + sidebarBtns.length) % sidebarBtns.length;
          sidebarBtns.forEach((b, i) => b.classList.toggle('selected', i === nextIdx));
          return true;
        }
        if (key === 'ArrowRight' || key === 'Enter') {
          const selBtn = sidebarBtns.find((b) => b.classList.contains('selected'));
          if (selBtn) {
            e.preventDefault();
            e.stopPropagation();
            selBtn.click();
            return true;
          }
        }
      }

      if (/^[a-zA-Z]$/.test(key) && !e.ctrlKey && !e.altKey && !e.metaKey && key !== '/') {
        const uKey = key.toUpperCase();
        if (uKey === 'G') {
          e.preventDefault();
          e.stopPropagation();
          go('dashboard');
          return true;
        }
        if (uKey === 'A') {
          e.preventDefault();
          e.stopPropagation();
          const grp = ERP_NAV_GROUPS.find((g) => g.id === 'grp-accounts');
          const anchor = document.getElementById('btnNav_grp-accounts');
          openSidebarFlyout(grp, anchor, true);
          return true;
        }
        if (uKey === 'T' || uKey === 'V') {
          e.preventDefault();
          e.stopPropagation();
          const grp = ERP_NAV_GROUPS.find((g) => g.id === 'grp-transactions');
          const anchor = document.getElementById('btnNav_grp-transactions');
          openSidebarFlyout(grp, anchor, true);
          return true;
        }
        if (uKey === 'D') {
          e.preventDefault();
          e.stopPropagation();
          const grp = ERP_NAV_GROUPS.find((g) => g.id === 'grp-display');
          const anchor = document.getElementById('btnNav_grp-display');
          openSidebarFlyout(grp, anchor, true);
          return true;
        }
        if (uKey === 'U') {
          e.preventDefault();
          e.stopPropagation();
          const grp = ERP_NAV_GROUPS.find((g) => g.id === 'grp-utilities');
          const anchor = document.getElementById('btnNav_grp-utilities');
          openSidebarFlyout(grp, anchor, true);
          return true;
        }
      }
    }

    return false;
  }

  // =====================================================================
  // ENTERPRISE ERP KEYBOARD ENGINE (All 14 Modules + Universal Shortcuts)
  // =====================================================================
  const TAB_KEY_MAP = {
    // Number keys (1 to 9, 0)
    '1': 'dashboard',
    '2': 'scansheet',
    '3': 'masters',
    '4': 'purchase',
    '5': 'sales',
    '6': 'stockassign',
    '7': 'purchaseregister',
    '8': 'saleregister',
    '9': 'partyledger',
    '0': 'bom',

    // Direct Letter keys (with Alt or Alt+Shift)
    'r': 'reports',
    'R': 'reports',
    'd': 'returns',
    'D': 'returns',
    'p': 'partyledger',
    'P': 'partyledger',
    'l': 'lowstock',
    'L': 'lowstock',
    'b': 'backup',
    'B': 'backup',
    'm': 'bom',
    'M': 'bom',
    's': 'sales',
    'S': 'sales',
    'u': 'purchaseregister',
    'U': 'purchaseregister',
    'k': 'bom',
    'K': 'bom'
  };

  window.showKeyboardShortcutsModal = function () {
    const html = `
      <div style="max-height:calc(85vh - 120px); overflow-y:auto; padding-right:4px;">
        ${getKeyboardShortcutsContentHtml()}
      </div>
    `;
    window.openModal('⌨️ Keyboard Shortcuts & Quick Navigation Guide', html, { size: 'large' });
  };

  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);

    // 1. Universal Quick Search: Ctrl + K (or Cmd + K) -> Always focus top global search bar
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      e.stopPropagation();
      const topSearch = document.getElementById('egsQuickSearch') || document.getElementById('egsQuickSearchMobile') || document.querySelector('.search-mini input');
      if (topSearch) {
        topSearch.removeAttribute('readonly');
        topSearch.focus();
        if (typeof topSearch.select === 'function') topSearch.select();
        const parentMini = topSearch.closest('.search-mini');
        if (parentMini) {
          parentMini.classList.add('search-mini-highlight');
          setTimeout(() => parentMini.classList.remove('search-mini-highlight'), 1200);
        }
      }
      return;
    }

    // 2. Accounting ERP Keyboard Navigation & Flyout Engine (Arrows, Enter, Esc, Underlined Hotkeys)
    if (typeof handleAccountingKeyboard === 'function') {
      const wasHandled = handleAccountingKeyboard(e);
      if (wasHandled) return;
    }

    // 3. Universal Escape Key: Closes any active modal, dialog, popup, drawer, or quick search
    if (e.key === 'Escape') {
      if (e.target && (e.target.id === 'egsQuickSearch' || e.target.id === 'egsQuickSearchMobile')) {
        e.preventDefault();
        e.target.value = '';
        applyGlobalTableSearch('');
        e.target.blur();
        return;
      }

      let handled = false;
      if (typeof closeAllFlyouts === 'function') {
        closeAllFlyouts();
      }
      const modalOverlay = document.getElementById('modalOverlay');
      if (modalOverlay && modalOverlay.classList.contains('show')) {
        window.closeModal();
        handled = true;
      }
      const popupOverlay = document.getElementById('egsPopupOverlay');
      if (popupOverlay && popupOverlay.classList.contains('show')) {
        popupOverlay.classList.remove('show');
        handled = true;
      }
      const stOverlay = document.getElementById('statementOverlay');
      if (stOverlay && stOverlay.classList.contains('show')) {
        const stmtBack = document.getElementById('stmtBack');
        if (stmtBack && stmtBack.style.display !== 'none') {
          stmtBack.click();
        } else {
          const closeStmt = document.getElementById('closeStatement');
          if (closeStmt) closeStmt.click();
        }
        handled = true;
      }
      const lfOverlay = document.getElementById('ledgerFormOverlay');
      if (lfOverlay && lfOverlay.classList.contains('show')) {
        const closeLf = document.getElementById('closeLedgerForm') || document.getElementById('lfCancel');
        if (closeLf) closeLf.click();
        handled = true;
      }
      const sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('open')) {
        window.closeSidebar();
        handled = true;
      }
      const filterMenu = document.querySelector('.th-filter-menu');
      if (filterMenu) {
        filterMenu.remove();
        handled = true;
      }
      if (handled) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }
    }

    // 3. F1 or Shift + ? -> Shortcuts help
    if (!isTyping && (e.key === 'F1' || (e.shiftKey && e.key === '?'))) {
      e.preventDefault();
      window.showKeyboardShortcutsModal();
      return;
    }

    // 4. Active Page Search: Global '/' outside typing inputs
    if (!isTyping && e.key === '/') {
      e.preventDefault();
      e.stopPropagation();
      const pageSearch = document.querySelector('#plSearch, #ssSearchInput, #mrSearch, #srSearch, #prSearch, #purSearchInv');
      const topSearch = document.getElementById('egsQuickSearch') || document.getElementById('egsQuickSearchMobile') || document.querySelector('.search-mini input');
      const target = pageSearch || topSearch;
      if (target) {
        target.removeAttribute('readonly');
        target.focus();
        if (typeof target.select === 'function') target.select();
      }
      return;
    }

    // 5. Module & Tab Navigation: Alt + [Key] or Ctrl + [Number]
    if (e.altKey && !e.ctrlKey && !e.metaKey && TAB_KEY_MAP[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      go(TAB_KEY_MAP[e.key]);
      return;
    }
    if (e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && !isTyping && /^[0-9]$/.test(e.key) && TAB_KEY_MAP[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      go(TAB_KEY_MAP[e.key]);
      return;
    }

    // 6. Enter as field progression inside forms
    if (e.key === 'Enter' && isTyping && tag !== 'textarea' && e.target.type !== 'submit' && e.target.type !== 'button') {
      const form = e.target.closest('form, .form-grid, .field-wrap, .auth-card, .modal-box');
      if (form) {
        const inputs = Array.from(form.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled])'))
          .filter((el) => el.offsetParent !== null);
        const idx = inputs.indexOf(e.target);
        if (idx !== -1) {
          if (e.shiftKey) {
            // Shift + Enter: previous field
            e.preventDefault();
            if (idx > 0) {
              inputs[idx - 1].focus();
              if (typeof inputs[idx - 1].select === 'function') inputs[idx - 1].select();
            }
          } else if (idx < inputs.length - 1) {
            // Enter: next field
            e.preventDefault();
            inputs[idx + 1].focus();
            if (typeof inputs[idx + 1].select === 'function') inputs[idx + 1].select();
          }
        }
      }
    }
  });

  // =====================================================================
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
    setTimeout(() => {
      if (typeof window.requestNativeSystemPermissions === 'function') {
        window.requestNativeSystemPermissions();
      }
    }, 1200);
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

// ============================================================================
// ENTERPRISE ERP MODE & GATEWAY CASCADING MENU SYSTEM (Shree Sava / Tally Inspired)
// ============================================================================
(function () {
  // 1. Fetch initial config from server
  async function loadGlobalErpConfig() {
    if (!window.Api) return;
    try {
      const res = await window.Api.get('/auth/app-settings', { silent: true });
      if (res && res.settings) {
        window.ERP_CONFIG = Object.assign(window.ERP_CONFIG || {}, res.settings);
        if (typeof window.applyErpModeRules === 'function') {
          window.applyErpModeRules();
        }
      }
    } catch (e) {}
  }
  loadGlobalErpConfig();
})();
