# AI Context Summary

> Paste this entire file into a new AI chat (ChatGPT, Claude, Gemini, Qwen,
> DeepSeek, etc.) as the first message to give the model full context on this
> project before asking follow-up questions. Other files in this folder
> contain deeper detail on specific areas if needed.

## 1. Project Identity

- **Root path:** `D:\ERF SOFTWARE - RENDER\eco_green_solar_web`
- **Name:** eco-green-solar-web
- **Description:** Not specified in package.json
- **Generated:** 2026-08-08T06:39:12.478Z

## 2. Architecture Overview

- **Detected technologies:** Node.js (runtime), Express (backend framework), MySQL (database), JWT Authentication (auth), HTML (markup), JavaScript (language), CSS (styling), PWA (platform)
- **Total files (post-ignore):** 60
- **Deeply analyzed files:** 47
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
- `js/pages/bom.js` — Defines 1 class(es) implementing core logic.
- `js/pages/dashboard.js` — Defines 18 function(s) implementing supporting logic.
- `js/pages/lowstock.js` — Defines 12 function(s) implementing supporting logic.
- `js/pages/masters.js` — Defines 8 function(s) implementing supporting logic.
- `js/pages/partyledger.js` — Defines 39 function(s) implementing supporting logic.
- `js/pages/purchase.js` — Defines 26 function(s) implementing supporting logic.
- `js/pages/purchaseregister.js` — Defines 15 function(s) implementing supporting logic.
- `js/pages/reports.js` — Defines 14 function(s) implementing supporting logic.
- `js/pages/returns.js` — Defines 8 function(s) implementing supporting logic.
- `js/pages/saleregister.js` — Defines 15 function(s) implementing supporting logic.
- `js/pages/sales.js` — Defines 33 function(s) implementing supporting logic.
- `js/pages/scansheet.js` — Defines 95 function(s) implementing supporting logic.
- `js/pages/stockassign.js` — Defines 24 function(s) implementing supporting logic.
- `js/data/sheets-store.js` — Defines 14 function(s) implementing supporting logic.
- `api/server.js` — Application entry point / bootstrap file.
- `api/services/challanPdf.js` — Implements business logic as a service layer.
- `api/services/email.js` — Implements business logic as a service layer.
- `api/services/stockHelpers.js` — Implements business logic as a service layer.
- `api/routes/attachments.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/auth.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/backup.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/challan.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/health.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/ledgers.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/masters.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/purchase.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/reports.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/sales.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/scansheet.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/routes/stockassign.routes.js` — Defines HTTP route handlers (controller/router layer).
- `api/db/pool.js` — Supporting source file.
- `api/db/schema.js` — Defines 10 function(s) implementing supporting logic.

## 5. Data Flow / Business Logic Entry Points

Entry point candidates: js/app.js, api/server.js

## 6. Authentication

No route-level authentication middleware detected (verify manually if auth is expected).

## 7. Database

6 SQL table(s): backup_log, otp_codes, attachments, scan_sheets, scan_sheet_entries, bom_challans

## 8. API

88 HTTP endpoint(s) detected. Method breakdown: GET=37, POST=27, DELETE=11, PUT=13.

## 9. Services & Utilities

Service files: 4
Utility/helper files: 2

## 10. Coding Conventions (inferred)

- Project appears to be plain JavaScript (no TypeScript detected).
- File naming leans camelCase.
- 40 of 47 analyzed files define at least one function.

## 11. Known Issues / Risk Areas

- 12 file(s) flagged as High complexity: js/app.js, js/pages/bom.js, js/pages/dashboard.js, js/pages/masters.js, js/pages/partyledger.js, js/pages/purchase.js, js/pages/sales.js, js/pages/scansheet.js, js/pages/stockassign.js, api/services/challanPdf.js, ...
- Raw SQL string usage found in 35 file(s) — verify parameterization to avoid SQL injection.
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

---

_This summary was generated by static heuristic analysis (regex-based, no
AI/LLM involved in producing it), so treat inferred purposes and conventions
as a starting point to verify, not ground truth._
