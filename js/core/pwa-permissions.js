// js/core/pwa-permissions.js
// Hardware & Browser Permissions Engine (Camera, Mic, Storage, Notifications) & PWA Install Guide

(function () {
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
})();
