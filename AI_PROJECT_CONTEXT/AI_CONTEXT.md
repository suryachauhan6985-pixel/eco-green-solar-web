# AI Context Summary

> Paste this entire file into a new AI chat (ChatGPT, Claude, Gemini, Qwen,
> DeepSeek, etc.) as the first message to give the model full context on this
> project before asking follow-up questions. Other files in this folder
> contain deeper detail on specific areas if needed.

## 1. Project Identity

- **Root path:** `D:\ERF SOFTWARE - RENDER\eco_green_solar_web`
- **Name:** eco-green-solar-web
- **Description:** Not specified in package.json
- **Generated:** 2026-08-14T09:51:50.628Z

## 2. Architecture Overview

- **Detected technologies:** Node.js (runtime), Express (backend framework), MySQL (database), JWT Authentication (auth), HTML (markup), JavaScript (language), CSS (styling), PWA (platform)
- **Total files (post-ignore):** 71
- **Deeply analyzed files:** 58
- **Typical request flow (heuristic):** Browser → Routes → Controller → Service → Database

## 3. Folder Structure

```
api/
    config/
        cors.js
    db/
        pool.js
        schema.js
    middleware/
        auth.middleware.js
        rateLimiters.js
    routes/
        attachments.routes.js
        auth.routes.js
        backup.routes.js
        bom_kits.routes.js
        bom.routes.js
        challan.routes.js
        health.js
        ledgers.routes.js
        masters.routes.js
        purchase.routes.js
        reports.routes.js
        sales.routes.js
        scansheet.routes.js
        stockassign.routes.js
    services/
        challanPdf.js
        email.js
        passwords.js
        stockHelpers.js
    utils/
        route.js
        time.js
    package.json
    server.js
css/
    modules/
        auth.css
        base.css
        bom.css
        components.css
        layout.css
        party-ledger.css
        responsive.css
        scan-sheet.css
    style.css
js/
    data/
        api.js
        purchase-data.js
        sales-data.js
        sheets-store.js
    pages/
        backup.js
        bom-challan-map.js
        bom-challan.js
        bom-dispatch.js
        bom-kit-builder.js
        bom-kit-helpers.js
        bom-party-autocomplete.js
        bom-serial-modal.js
        bom-serial-scan.js
        bom-track-register.js
        bom.js
        dashboard.js
        lowstock.js
        masters.js
        partyledger.js
        purchase.js
        purchaseregister.js
        reports.js
        returns.js
        saleregister.js
        sales.js
        scansheet.js
        stockassign.js
    app.js
.env
Dockerfile
index.html
manifest.webmanifest
package.json
PROJECT_GOALS.md
sw.js
```

## 4. Key Modules

- `Dockerfile` — Supporting source file.
- `js/app.js` — Application entry point / bootstrap file.
- `js/pages/backup.js` — Defines 3 function(s) implementing supporting logic.
- `js/pages/bom-challan-map.js` — Defines 7 function(s) implementing supporting logic.
- `js/pages/bom-challan.js` — Defines 20 function(s) implementing supporting logic.
- `js/pages/bom-dispatch.js` — Defines 1 class(es) implementing core logic.
- `js/pages/bom-kit-builder.js` — Defines 12 function(s) implementing supporting logic.
- `js/pages/bom-kit-helpers.js` — Defines 30 function(s) implementing supporting logic.
- `js/pages/bom-party-autocomplete.js` — Defines 10 function(s) implementing supporting logic.
- `js/pages/bom-serial-modal.js` — Defines 10 function(s) implementing supporting logic.
- `js/pages/bom-serial-scan.js` — Defines 17 function(s) implementing supporting logic.
- `js/pages/bom-track-register.js` — Defines 11 function(s) implementing supporting logic.
- `js/pages/bom.js` — Defines 1 class(es) implementing core logic.
- `js/pages/dashboard.js` — Defines 18 function(s) implementing supporting logic.
- `js/pages/lowstock.js` — Defines 12 function(s) implementing supporting logic.
- `js/pages/masters.js` — Defines 18 function(s) implementing supporting logic.
- `js/pages/partyledger.js` — Defines 39 function(s) implementing supporting logic.
- `js/pages/purchase.js` — Defines 53 function(s) implementing supporting logic.
- `js/pages/purchaseregister.js` — Defines 15 function(s) implementing supporting logic.
- `js/pages/reports.js` — Defines 14 function(s) implementing supporting logic.
- `js/pages/returns.js` — Defines 8 function(s) implementing supporting logic.
- `js/pages/saleregister.js` — Defines 15 function(s) implementing supporting logic.
- `js/pages/sales.js` — Defines 1 class(es) implementing core logic.
- `js/pages/scansheet.js` — Defines 97 function(s) implementing supporting logic.
- `js/pages/stockassign.js` — Defines 24 function(s) implementing supporting logic.
- `js/data/sheets-store.js` — Defines 14 function(s) implementing supporting logic.
- `api/server.js` — Application entry point / bootstrap file.
- `api/services/challanPdf.js` — Implements business logic as a service layer.
- `api/services/email.js` — Implements business logic as a service layer.
- `api/services/stockHelpers.js` — Implements business logic as a service layer.
- `api/routes/attachments.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/auth.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/backup.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/bom.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/bom_kits.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/challan.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/health.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/ledgers.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/masters.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/purchase.routes.js` — Defines HTTP route handlers (controller/router layer).

## 5. Data Flow / Business Logic Entry Points

Entry point candidates: js/app.js, api/server.js

## 6. Authentication

No route-level authentication middleware detected (verify manually if auth is expected).

## 7. Database

9 SQL table(s): backup_log, otp_codes, attachments, scan_sheets, scan_sheet_entries, bom_challans, bom_dispatches, bom_orders, challan_category_map

## 8. API

102 HTTP endpoint(s) detected. Method breakdown: GET=44, POST=30, DELETE=13, PUT=15.

## 9. Services & Utilities

Service files: 4
Utility/helper files: 2

## 10. Coding Conventions (inferred)

- Project appears to be plain JavaScript (no TypeScript detected).
- File naming leans camelCase.
- 51 of 58 analyzed files define at least one function.

## 11. Known Issues / Risk Areas

- 21 file(s) flagged as High complexity: js/app.js, js/pages/bom-challan.js, js/pages/bom-dispatch.js, js/pages/bom-kit-builder.js, js/pages/bom-kit-helpers.js, js/pages/bom-serial-modal.js, js/pages/bom-serial-scan.js, js/pages/bom.js, js/pages/dashboard.js, js/pages/masters.js, ...
- Raw SQL string usage found in 46 file(s) — verify parameterization to avoid SQL injection.
- No routes appear to use recognizable auth middleware — verify whether this API is intentionally public.
- A real `.env` file exists in the project (.env) — ensure it is excluded from version control.

## 12. Suggested Future Improvements

- Dockerfile: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- Dockerfile: No functions or classes detected — file may be mostly configuration or could benefit from clearer structure.
- sw.js: No functions or classes detected — file may be mostly configuration or could benefit from clearer structure.
- js/app.js: File defines a large number of functions — consider splitting into smaller modules.
- js/app.js: High branching complexity detected — consider refactoring conditional logic into smaller helpers.
- js/app.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/backup.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/bom-challan-map.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/bom-challan.js: File defines a large number of functions — consider splitting into smaller modules.
- js/pages/bom-challan.js: High branching complexity detected — consider refactoring conditional logic into smaller helpers.
- js/pages/bom-challan.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/bom-dispatch.js: File defines a large number of functions — consider splitting into smaller modules.
- js/pages/bom-dispatch.js: High branching complexity detected — consider refactoring conditional logic into smaller helpers.
- js/pages/bom-dispatch.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/bom-kit-builder.js: High branching complexity detected — consider refactoring conditional logic into smaller helpers.
- js/pages/bom-kit-builder.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/bom-kit-helpers.js: File defines a large number of functions — consider splitting into smaller modules.
- js/pages/bom-kit-helpers.js: High branching complexity detected — consider refactoring conditional logic into smaller helpers.
- js/pages/bom-kit-helpers.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/bom-party-autocomplete.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/bom-serial-modal.js: High branching complexity detected — consider refactoring conditional logic into smaller helpers.
- js/pages/bom-serial-modal.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/bom-serial-scan.js: File defines a large number of functions — consider splitting into smaller modules.
- js/pages/bom-serial-scan.js: High branching complexity detected — consider refactoring conditional logic into smaller helpers.
- js/pages/bom-serial-scan.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.

---

_This summary was generated by static heuristic analysis (regex-based, no
AI/LLM involved in producing it), so treat inferred purposes and conventions
as a starting point to verify, not ground truth._
