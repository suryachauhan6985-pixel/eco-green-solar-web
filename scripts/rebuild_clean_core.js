const fs = require('fs');
const execSync = require('child_process').execSync;
const original = execSync('git show a173b2f:js/app.js', { encoding: 'utf8' }).split('\n');

// 1. js/core/ui-feedback.js
const uiFeedbackCode = `// js/core/ui-feedback.js
// Core UI Feedback Engine: Loaders, Toasts, Popups, Modals, Date Picker & Table Filters

(function () {
${original.slice(0, 248).join('\n')}
${original.slice(262, 620).join('\n')}
${original.slice(971, 1463).join('\n')}

  window.getCurrentTableSearchQuery = function () {
    return (typeof currentSearchQuery !== 'undefined') ? currentSearchQuery : '';
  };
  window.setCurrentTableSearchQuery = function (q) {
    if (typeof currentSearchQuery !== 'undefined') currentSearchQuery = q;
  };

${original.slice(7728, 7915).join('\n')}

${original.slice(8016, 8066).join('\n')}
})();

${original.slice(8067, 8278).join('\n')}
`;
fs.writeFileSync('js/core/ui-feedback.js', uiFeedbackCode, 'utf8');

// 2. js/core/pwa-permissions.js
const pwaPermissionsCode = `// js/core/pwa-permissions.js
// Hardware & Browser Permissions Engine (Camera, Mic, Storage, Notifications) & PWA Install Guide

(function () {
${original.slice(620, 860).join('\n')}
})();
`;
fs.writeFileSync('js/core/pwa-permissions.js', pwaPermissionsCode, 'utf8');

// 3. js/core/auth-session.js
const authSessionCode = `// js/core/auth-session.js
// Authentication State, JWT Interceptor, Login Modal, Biometrics, 2FA & Multi-Tenant Sessions

${original.slice(860, 970).join('\n')}

(function () {
${original.slice(1463, 3219).join('\n')}

  // Export session helpers for the app bootstrapper
  window.buildLoginOverlay = buildLoginOverlay;
  window.loadSession = loadSession;
  window.showApp = showApp;
  window.showLoginOverlay = showLoginOverlay;
  window.updateProfileDisplay = updateProfileDisplay;
  window.startHeartbeat = startHeartbeat;
  window.applyUserPreferencesFromServer = applyUserPreferencesFromServer;
  window.resetIdleTimer = resetIdleTimer;
  window.finishLogin = finishLogin;
})();
`;
fs.writeFileSync('js/core/auth-session.js', authSessionCode, 'utf8');

// 4. js/core/settings-panel.js
const settingsPanelCode = `// js/core/settings-panel.js
// App Configuration Panel, Theme Switcher, Typography, Audio & Keyboard Shortcuts Guide

(function () {
${original.slice(3219, 6149).join('\n')}
})();
`;
fs.writeFileSync('js/core/settings-panel.js', settingsPanelCode, 'utf8');

// 5. js/core/navigation-engine.js
const navEngineCode = `// js/core/navigation-engine.js
// Shree Sava / Tally Navigation Engine, Flyouts, Ladder History & Keyboard Hotkeys Router

(function () {
${original.slice(248, 262).join('\n')}
${original.slice(6149, 7728).join('\n')}

${original.slice(7916, 7938).join('\n')}
})();
`;
fs.writeFileSync('js/core/navigation-engine.js', navEngineCode, 'utf8');

// 6. js/app.js (Clean App Bootstrapper & Lifecycle Orchestrator)
const appBootstrapperCode = `// js/app.js
// Main Application Entrypoint & Bootstrapper
// Runs after all core modules and page modules are parsed and registered.

(function () {
  // 1. Fetch global ERP configuration from server
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

  // 2. Render sidebar navigation buttons from registered PAGES
  if (typeof window.renderNavButtons === 'function') {
    window.renderNavButtons();
  }

  // 3. Initialize Login overlay & restore session
  if (typeof window.buildLoginOverlay === 'function') {
    window.buildLoginOverlay();
  }

  const restoredSession = (typeof window.loadSession === 'function') ? window.loadSession() : null;
  if (restoredSession) {
    window.currentAuthToken = restoredSession.token;
    if (typeof window.updateProfileDisplay === 'function') {
      window.updateProfileDisplay(restoredSession.username, restoredSession.role);
    }
    if (typeof window.showApp === 'function') window.showApp();
    if (typeof window.startHeartbeat === 'function') window.startHeartbeat();
    if (typeof window.applyUserPreferencesFromServer === 'function') window.applyUserPreferencesFromServer();
    if (typeof window.resetIdleTimer === 'function') window.resetIdleTimer();

    const startRoute = (typeof window.parseRouteHash === 'function')
      ? window.parseRouteHash(window.location.hash)
      : { id: 'dashboard', opts: {} };

    if (window.PAGES && window.PAGES[startRoute.id]) {
      window.go(startRoute.id, startRoute.opts, false);
    } else {
      window.go('dashboard', {}, false);
    }

    setTimeout(() => {
      if (typeof window.requestNativeSystemPermissions === 'function') {
        window.requestNativeSystemPermissions().catch(() => {});
      }
    }, 2000);
  } else {
    if (typeof window.showLoginOverlay === 'function') {
      window.showLoginOverlay();
    }
  }

  // 4. Listen for route hash changes
  window.addEventListener('popstate', () => {
    const route = (typeof window.parseRouteHash === 'function')
      ? window.parseRouteHash(window.location.hash)
      : { id: 'dashboard', opts: {} };
    if (window.PAGES && window.PAGES[route.id]) {
      window.go(route.id, route.opts, false);
    }
  });

  window.addEventListener('hashchange', () => {
    const route = (typeof window.parseRouteHash === 'function')
      ? window.parseRouteHash(window.location.hash)
      : { id: 'dashboard', opts: {} };
    if (window.PAGES && window.PAGES[route.id]) {
      const curSub = (window.CURRENT_PAGE_OPTS && (window.CURRENT_PAGE_OPTS.sub || window.CURRENT_PAGE_OPTS.tab || window.CURRENT_PAGE_OPTS.action)) || '';
      const newSub = route.opts.sub || route.opts.tab || route.opts.action || '';
      if (window.CURRENT_PAGE_ID === route.id && curSub === newSub) return;
      window.go(route.id, route.opts, false);
    } else {
      window.go('dashboard', {}, false);
    }
  });
})();
`;
fs.writeFileSync('js/app.js', appBootstrapperCode, 'utf8');

console.log('Rebuilt clean core modules and bootstrapper successfully!');
