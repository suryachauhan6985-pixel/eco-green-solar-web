# PRE-REFACTOR BEHAVIOR & ARCHITECTURE BASELINE

## 1. Baseline Capture Metadata
* **Timestamp:** 2026-08-25T16:30:00+05:30
* **Target Monolith:** `js/app.js` (7,636 lines)
* **Test Suites Run:**
  - `tests/password-policy.test.js` (16 / 16 PASSED)
  - `tests/security-performance.test.js` (11 / 11 PASSED)
  - `tests/purchase-inward.test.js` (3 / 3 PASSED)

---

## 2. Global Contract & Window Registry Snapshot

| Global Function / Object | Source Section in `app.js` | Consumer Files / Modules |
| :--- | :--- | :--- |
| `window.ERP_CONFIG` | Config bootstrap | `app.js`, `settings`, `navigation` |
| `window.ERP` | ERP Mode checks | `app.js`, `bom.js`, `dashboard.js` |
| `window.showLoader` / `hideLoader` | UI feedback | All pages (`purchase`, `sales`, etc.) |
| `window.withButtonFeedback` | UI feedback | All submit buttons |
| `window.focusInvalidField` | Form validation | `purchase.js`, `sales.js`, `partyledger.js` |
| `window.playScannerTone` | Audio engine | `scansheet.js`, `purchase.js`, `sales.js` |
| `window.showToast` | Toast notifications | All pages |
| `window.showPopup` / `showSuccess` / `showError` | Popups | All pages |
| `window.applyGlobalTableSearch` | Search bar | `index.html` (Ctrl+K), all table views |
| `window.attachColumnFilters` | Table filters | All table views |
| `window.lockBackgroundScroll` / `unlockBackgroundScroll` | Scroll management | All modals |
| `window.openModal` / `closeModal` | Modal engine | All pages, `index.html` inline `onclick` |
| `window.confirmDialog` | Confirm modal | All destructive actions |
| `window.requestNativeSystemPermissions` | Device API | Login, scan sheets, settings |
| `window.openAppInstallGuide` | PWA helper | Header install button |
| `window.fetch` (interceptor) | Auth session | All `window.Api` / fetch calls |
| `window.openSettingsModal` / `openSystemSettingsModal` | Settings panel | Flyouts, sidebar profile menu |
| `window.closeProfileMenu` | Profile dropdown | `document.addEventListener('click')` |
| `window.showKeyboardShortcutsModal` | Shortcuts guide | F1 key, Help button |
| `window.openSidebarFlyout` / `closeAllFlyouts` | Flyout engine | Sidebar buttons, accounting hotkeys |
| `window.stepBackFromFlyoutTrail` | Ladder engine | Escape key, modal close handlers |
| `window.resolveFlyoutTrail` | Route resolver | Escape key navigation router |
| `window.go` / `window.goPage` / `window.navigateToPage` | Router | All buttons, `index.html` |
| `window.renderNavButtons` | Nav builder | Auth change, ERP mode toggle |
| `window.handleAccountingKeyboard` | Keyboard router | Global keydown event listener |

---

## 3. Verified Page Modules & Workspaces

| Page Route | Page Module (`window.PAGES`) | Verified Status |
| :--- | :--- | :--- |
| `#dashboard` | `window.PAGES.dashboard` | Verified (Cards, metrics, quick actions) |
| `#scansheet` | `window.PAGES.scansheet` | Verified (Barcode scanning, serial sheet grid) |
| `#masters` | `window.PAGES.masters` | Verified (Item master, categories, UOM, warehouse, brands) |
| `#purchase` | `window.PAGES.purchase` | Verified (Purchase inward, barcode scan, supplier details) |
| `#sales` | `window.PAGES.sales` | Verified (Project dispatch, client allocation) |
| `#stockassign` | `window.PAGES.stockassign` | Verified (Godown reservation & stock transfer) |
| `#purchaseregister` | `window.PAGES.purchaseregister` | Verified (Inward invoices register & reprint) |
| `#saleregister` | `window.PAGES.saleregister` | Verified (Dispatch register & sales records) |
| `#reports` | `window.PAGES.reports` | Verified (Inventory Explorer, serial registry) |
| `#returns` | `window.PAGES.returns` | Verified (Sales returns & damaged stock) |
| `#vouchers` | `window.PAGES.vouchers` | Verified (Payment, Receipt, Journal vouchers) |
| `#financialreports` | `window.PAGES.financialreports` | Verified (Trial Balance, P&L, Balance Sheet) |
| `#partyledger` | `window.PAGES.partyledger` | Verified (Party Directory, Ledger Form, Statement) |
| `#lowstock` | `window.PAGES.lowstock` | Verified (Threshold alerts & re-order report) |
| `#bom` | `window.PAGES.bom` | Verified (Kit assembly, dispatches, challans) |
| `#template_designer` | `window.PAGES.template_designer` | Verified (Print layout engine) |
