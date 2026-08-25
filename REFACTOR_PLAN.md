# SAFE LARGE-FILE REFACTORING PLAN (`js/app.js`)

## 1. Executive Summary & Objective
* **Target File:** `js/app.js` (Total Lines: 7,636)
* **Goal:** Modularize into high-cohesion, maintainable, single-responsibility modules under `js/core/` without altering a single line of business logic, API signature, or DOM contract.
* **Safety Protocol:** Zero logic alteration, preservation of all `window.*` functions, strict `<script>` tag load order verification, and 100% live browser click-through parity.

---

## 2. File Inventory & Line Count Baseline

| File Path | Current Lines | Status | Proposed Action |
| :--- | :--- | :--- | :--- |
| `js/app.js` | **7,636 lines** | High-Risk Monolith | Split into 5 clean core modules + lightweight orchestrator |
| `js/pages/bom-challan.js` | 2,264 lines | Sub-page Module | Inspected (modularized in previous BOM refactor) |
| `js/pages/purchase.js` | 2,074 lines | Page Module | Inspected |
| `js/pages/partyledger.js` | 1,957 lines | Page Module | Inspected |
| `js/pages/scansheet.js` | 1,807 lines | Page Module | Inspected |
| `js/pages/sales.js` | 1,697 lines | Page Module | Inspected |
| `js/pages/masters.js` | 1,594 lines | Page Module | Inspected |

---

## 3. Module Breakdown Plan for `js/app.js`

### Module 1: `js/core/ui-feedback.js` (~1,100 lines)
* **Responsibility:** User interface feedback, spinners, notification modals, dialogs, quick search, scroll locks, and custom date pickers.
* **Extracted Functions & Globals:**
  - `window.showLoader`, `window.hideLoader`, `window.withButtonFeedback`
  - `window.focusInvalidField`, `window.playScannerTone`
  - `window.showToast`, `window.showPopup`, `window.showSuccess`, `window.showError`, `window.showWarning`, `window.showInfo`
  - `window.applyGlobalTableSearch`, `window.attachColumnFilters`
  - `window.lockBackgroundScroll`, `window.unlockBackgroundScroll`, `window.syncModalScrollLock`
  - `window.openModal`, `window.closeModal`, `window.confirmDialog`
  - `initCustomDatePicker`, `autofillObserver`

### Module 2: `js/core/pwa-permissions.js` (~250 lines)
* **Responsibility:** Hardware and browser capability permissions (Camera, Mic, Storage, Notifications) and PWA install prompt handler.
* **Extracted Functions & Globals:**
  - `window.requestNativeNotificationPermission`, `window.requestPushPermission`
  - `window.requestNativeCameraPermission`, `window.requestNativeMicPermission`
  - `window.requestNativeStoragePermission`, `window.requestNativeSystemPermissions`
  - `window.sendAppNotification`, `window.openAppInstallGuide`, `window.__egsDeferredInstallPrompt`

### Module 3: `js/core/auth-session.js` (~1,750 lines)
* **Responsibility:** Authentication state, JWT token management, 401 auto-redirect fetch interceptor, login modal, biometric WebAuthn, 2FA TOTP, and user session switcher.
* **Extracted Functions & Globals:**
  - `window.currentAuthToken`, `window.currentUsername`, `window.currentRole`, `window.currentUserRole`
  - `window.fetch` interceptor
  - `openLoginOverlay`, `closeLoginOverlay`, `initLoginModal`, `handleLoginSubmit`, `handleLogout`
  - `openBiometricAuthModal`, `open2faVerificationModal`, `openUserSessionsModal`

### Module 4: `js/core/settings-panel.js` (~2,800 lines)
* **Responsibility:** App configuration panel, theme selector, typography, audio toggle, database backups, profile menu, and keyboard shortcuts guide.
* **Extracted Functions & Globals:**
  - `openAppSettingsPanel`, `window.openSettingsModal`, `window.openSystemSettingsModal`
  - `window.closeProfileMenu`, `toggleProfileMenu`
  - `window.getKeyboardShortcutsContentHtml`, `window.showKeyboardShortcutsModal`
  - `applyTheme`, `applyFontSize`, `saveAppSettings`, `renderSettingsTabs`

### Module 5: `js/core/navigation-engine.js` (~1,700 lines)
* **Responsibility:** Shree Sava / Tally cascading flyout system, ladder step-back history, screen lifecycle router, and accounting keyboard routing.
* **Extracted Functions & Globals:**
  - `ERP_NAV_GROUPS`, `getErpNavGroups`, `ERP_MODE_ITEMS`, `WORKSPACE_METADATA`
  - `openSidebarFlyout`, `closeAllFlyouts`, `setNestedSubmenuOpen`, `updateTier1Selection`, `updateTier2Selection`
  - `recordFlyoutTrail`, `clearFlyoutTrail`, `resolveFlyoutTrail`, `stepBackFromFlyoutTrail`
  - `go(id, opts)`, `parseRouteHash`, `updateSidebarActiveState`, `cleanupActiveScreen`, `renderNavButtons`
  - `handleAccountingKeyboard`, `TAB_KEY_MAP`, global keyboard event listeners

### Module 6: `js/app.js` (Slim Entrypoint & Bootstrapper) (~100 lines)
* **Responsibility:** Bootstrapping ERP configuration (`window.ERP_CONFIG`, `window.ERP`), DOMContentLoaded listener, initial auth check, and hash routing trigger.

---

## 4. Script Load Order in `index.html`

```html
<!-- Core Infrastructure Modules (Loaded in dependency order) -->
<script src="js/core/ui-feedback.js?v=1"></script>
<script src="js/core/pwa-permissions.js?v=1"></script>
<script src="js/core/auth-session.js?v=1"></script>
<script src="js/core/settings-panel.js?v=1"></script>
<script src="js/core/navigation-engine.js?v=1"></script>

<!-- Slim App Bootstrapper (Runs last) -->
<script src="js/app.js?v=120"></script>
```

---

## 5. Risk Assessment & Verification Protocol
1. **Global Namespace Safety:** Every function attached to `window.*` will remain exactly attached to `window.*`.
2. **Inline HTML `onclick` Safety:** All inline handlers in modals, popups, and sidebar buttons will continue resolving to their exact global targets.
3. **No Duplicate Declarations:** Variables shared across files will be assigned to scoped namespaces or `window.*` objects to prevent `SyntaxError` crashes.
4. **Live Click-Through Verification:** Complete test suite and live simulation will verify all 14 modules before marking complete.
