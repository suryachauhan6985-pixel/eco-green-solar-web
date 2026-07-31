# AI Context Summary

> Paste this entire file into a new AI chat (ChatGPT, Claude, Gemini, Qwen,
> DeepSeek, etc.) as the first message to give the model full context on this
> project before asking follow-up questions. Other files in this folder
> contain deeper detail on specific areas if needed.

## 1. Project Identity

- **Root path:** `D:\ERF SOFTWARE - RENDER\eco_green_solar_web`
- **Name:** eco-green-solar-web
- **Description:** Not specified in package.json
- **Generated:** 2026-07-31T07:33:05.033Z

## 2. Architecture Overview

- **Detected technologies:** Node.js (runtime), Express (backend framework), MySQL (database), HTML (markup), JavaScript (language), CSS (styling), PWA (platform)
- **Total files (post-ignore):** 56
- **Deeply analyzed files:** 45
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
        auth.js
        rateLimiters.js
    routes/
        attachments.js
        auth.js
        backup.js
        health.js
        ledgers.js
        masters.js
        purchase.js
        reports.js
        sales.js
        scansheet.routes.js
        stockassign.js
    services/
        email.js
        passwords.js
        stockHelpers.js
    utils/
        route.js
        time.js
    api.js
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
index.html
manifest.webmanifest
package.json
sw.js
```

## 4. Key Modules

- `js/app.js` — Application entry point / bootstrap file.
- `js/pages/backup.js` — Defines 3 function(s) implementing supporting logic.
- `js/pages/bom.js` — Defines 1 class(es) implementing core logic.
- `js/pages/dashboard.js` — Defines 18 function(s) implementing supporting logic.
- `js/pages/lowstock.js` — Defines 12 function(s) implementing supporting logic.
- `js/pages/masters.js` — Defines 8 function(s) implementing supporting logic.
- `js/pages/partyledger.js` — Defines 39 function(s) implementing supporting logic.
- `js/pages/purchase.js` — Defines 23 function(s) implementing supporting logic.
- `js/pages/purchaseregister.js` — Defines 15 function(s) implementing supporting logic.
- `js/pages/reports.js` — Defines 14 function(s) implementing supporting logic.
- `js/pages/returns.js` — Defines 4 function(s) implementing supporting logic.
- `js/pages/saleregister.js` — Defines 15 function(s) implementing supporting logic.
- `js/pages/sales.js` — Defines 29 function(s) implementing supporting logic.
- `js/pages/scansheet.js` — Defines 95 function(s) implementing supporting logic.
- `js/pages/stockassign.js` — Defines 24 function(s) implementing supporting logic.
- `js/data/sheets-store.js` — Defines 14 function(s) implementing supporting logic.
- `api/server.js` — Application entry point / bootstrap file.
- `api/services/email.js` — Implements business logic as a service layer.
- `api/services/stockHelpers.js` — Implements business logic as a service layer.
- `api/routes/attachments.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/auth.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/backup.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/health.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/ledgers.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/masters.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/purchase.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/reports.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/sales.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/scansheet.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/stockassign.js` — Defines HTTP route handlers (controller/router layer).
- `api/db/pool.js` — Supporting source file.
- `api/db/schema.js` — Defines 8 function(s) implementing supporting logic.

## 5. Data Flow / Business Logic Entry Points

Entry point candidates: js/app.js, api/server.js

## 6. Authentication

No route-level authentication middleware detected (verify manually if auth is expected).

## 7. Database

5 SQL table(s): backup_log, otp_codes, attachments, scan_sheets, scan_sheet_entries

## 8. API

84 HTTP endpoint(s) detected. Method breakdown: GET=34, POST=26, DELETE=11, PUT=13.

## 9. Services & Utilities

Service files: 3
Utility/helper files: 2

## 10. Coding Conventions (inferred)

- Project appears to be plain JavaScript (no TypeScript detected).
- File naming leans camelCase.
- 39 of 45 analyzed files define at least one function.

## 11. Known Issues / Risk Areas

- 10 file(s) flagged as High complexity: js/app.js, js/pages/bom.js, js/pages/dashboard.js, js/pages/masters.js, js/pages/partyledger.js, js/pages/purchase.js, js/pages/sales.js, js/pages/scansheet.js, js/pages/stockassign.js, api/routes/auth.js
- Raw SQL string usage found in 32 file(s) — verify parameterization to avoid SQL injection.
- No routes appear to use recognizable auth middleware — verify whether this API is intentionally public.

## 12. Suggested Future Improvements

- sw.js: No functions or classes detected — file may be mostly configuration or could benefit from clearer structure.
- js/app.js: File defines a large number of functions — consider splitting into smaller modules.
- js/app.js: High branching complexity detected — consider refactoring conditional logic into smaller helpers.
- js/app.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/backup.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/bom.js: File defines a large number of functions — consider splitting into smaller modules.
- js/pages/bom.js: High branching complexity detected — consider refactoring conditional logic into smaller helpers.
- js/pages/bom.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/dashboard.js: File defines a large number of functions — consider splitting into smaller modules.
- js/pages/dashboard.js: High branching complexity detected — consider refactoring conditional logic into smaller helpers.
- js/pages/dashboard.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/lowstock.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/masters.js: High branching complexity detected — consider refactoring conditional logic into smaller helpers.
- js/pages/masters.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/partyledger.js: File defines a large number of functions — consider splitting into smaller modules.
- js/pages/partyledger.js: High branching complexity detected — consider refactoring conditional logic into smaller helpers.
- js/pages/partyledger.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/purchase.js: File defines a large number of functions — consider splitting into smaller modules.
- js/pages/purchase.js: High branching complexity detected — consider refactoring conditional logic into smaller helpers.
- js/pages/purchase.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/purchaseregister.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/reports.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/returns.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/saleregister.js: Raw SQL strings detected — verify parameterized queries are used to prevent SQL injection.
- js/pages/sales.js: File defines a large number of functions — consider splitting into smaller modules.

---

_This summary was generated by static heuristic analysis (regex-based, no
AI/LLM involved in producing it), so treat inferred purposes and conventions
as a starting point to verify, not ground truth._
