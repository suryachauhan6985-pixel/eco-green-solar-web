# VISUAL & UI AUDIT REPORT (`VISUAL_ISSUES.md`)

This document details the visual, CSS, responsive, and UI component audit conducted across all pages of the Eco Green Solar ERP.

---

## 1. DESIGN SYSTEM & CSS ARCHITECTURE

- **Stylesheets**: Modular CSS located in `css/modules/` imported via `css/style.css`.
  - `base.css`: CSS Variables, typography, custom scrollbars, root reset.
  - `layout.css`: Sidebar, Topbar, Content Viewport, Hash Page Containers.
  - `components.css`: Buttons, Badges, Modals, Forms, Custom Steppers, Pulse dots, Toast notifications.
  - `auth.css`: Login / OTP / Registration / Password Reset cards and split views.
  - `dashboard.css`: Solar grid, KPI cards, Sliding category carousel, Donut SVG charts, Bar telemetry.
  - `bom.css`: Solar kit builder, Capacity calculators, Serial popups, Track BOM timelines.
  - `scan-sheet.css`: Fullscreen camera viewfinder, laser beam animations, barcode confirm cards.
  - `party-ledger.css`: Ledger directory, Debit/Credit colored statement rows, summary cards.
  - `responsive.css`: Breakpoint optimizations for Mobile (<= 768px), Tablet (<= 1024px), and 4K Displays.

---

## 2. AUDIT FINDINGS BY COMPONENT

### A. Dashboard View Modes (Cards View vs Presentation Mode)
- **Status**: **PASS (Clean & Functional)**
- **Findings**:
  - The toggle between "Cards View" and "Presentation Mode" smoothly transitions with display toggles and preserves state in `localStorage` (`egs-dash-view-mode`).
  - Presentation mode renders dynamic SVG donut charts with glowing animated segments and custom tooltips.
  - Operational stock movement bar graph animates counts up smoothly without flicker.

### B. Mobile & Tablet Responsive Layout (`css/modules/responsive.css`)
- **Status**: **PASS (Clean & Functional)**
- **Findings**:
  - Sidebar automatically collapses on viewports under `1024px` with a hamburger toggle.
  - Mobile bottom navigation bar activates for quick access to primary workflows (BOM, Inward, Sales, Reports).
  - Stat cards switch to 1-column stack on screens under `640px` to prevent overflow.

### C. Dark / Light Theme & Tenant White-Labeling
- **Status**: **PASS (Clean & Functional)**
- **Findings**:
  - Dynamic CSS variables (`--bg`, `--card-bg`, `--accent`, `--primary`, `--gold`, `--blue`, `--green`, `--red`) are cleanly injected at startup.
  - Inline head script in `index.html` prevents Flash of Unstyled Content (FOUC) on initial reload.

### D. Modals, Confirm Dialogs & Keyboard Navigation
- **Status**: **PASS (Clean & Functional)**
- **Findings**:
  - Modals lock `body.style.overflow = 'hidden'` on open and restore on close.
  - Escape key handlers properly close top-level active modals.
  - High z-index stacking (`z-index: 9999` for scanner overlay, `z-index: 1000` for modals) prevents layering conflicts with the sidebar.

### E. Print & PDF Export Styles
- **Status**: **PASS (Clean & Functional)**
- **Findings**:
  - `@media print` rules in `css/style.css` hide navigation bars, search headers, and action buttons, focusing strictly on tabular and invoice output.
