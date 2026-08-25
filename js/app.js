// js/app.js
// Main Application Entrypoint & Bootstrapper
// Wires up core modules, renders initial navigation, and starts routing lifecycle.

(function () {
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

})();
