# Module Relationships

This is a heuristic data-flow view based on detected routes, services, and
database usage. Typical flow for a web backend project:

```
Browser
   |
Routes
   |
Controller
   |
Service
   |
Database
```

## Files Grouped by Directory (module boundaries)

### `/`

| File | Purpose |
| --- | --- |
| Dockerfile | Supporting source file. |
| package.json | Supporting source file. |
| sw.js | Supporting source file. |

### `api`

| File | Purpose |
| --- | --- |
| api/package.json | Supporting source file. |
| api/server.js | Application entry point / bootstrap file. |

### `api/config`

| File | Purpose |
| --- | --- |
| api/config/cors.js | Defines 1 function(s) implementing supporting logic. |

### `api/db`

| File | Purpose |
| --- | --- |
| api/db/pool.js | Supporting source file. |
| api/db/schema.js | Defines 16 function(s) implementing supporting logic. |

### `api/middleware`

| File | Purpose |
| --- | --- |
| api/middleware/auth.middleware.js | Implements Express/Koa middleware. |
| api/middleware/rateLimiters.js | Implements Express/Koa middleware. |

### `api/routes`

| File | Purpose |
| --- | --- |
| api/routes/attachments.routes.js | Defines HTTP route handlers (controller/router layer). |
| api/routes/auth.routes.js | Defines HTTP route handlers (controller/router layer). |
| api/routes/backup.routes.js | Defines HTTP route handlers (controller/router layer). |
| api/routes/bom.routes.js | Defines HTTP route handlers (controller/router layer). |
| api/routes/challan.routes.js | Defines HTTP route handlers (controller/router layer). |
| api/routes/health.js | Defines HTTP route handlers (controller/router layer). |
| api/routes/ledgers.routes.js | Defines HTTP route handlers (controller/router layer). |
| api/routes/masters.routes.js | Defines HTTP route handlers (controller/router layer). |
| api/routes/purchase.routes.js | Defines HTTP route handlers (controller/router layer). |
| api/routes/reports.routes.js | Defines HTTP route handlers (controller/router layer). |
| api/routes/sales.routes.js | Defines HTTP route handlers (controller/router layer). |
| api/routes/scansheet.routes.js | Defines HTTP route handlers (controller/router layer). |
| api/routes/stockassign.routes.js | Defines HTTP route handlers (controller/router layer). |

### `api/services`

| File | Purpose |
| --- | --- |
| api/services/challanPdf.js | Implements business logic as a service layer. |
| api/services/email.js | Implements business logic as a service layer. |
| api/services/passwords.js | Implements business logic as a service layer. |
| api/services/stockHelpers.js | Implements business logic as a service layer. |

### `api/utils`

| File | Purpose |
| --- | --- |
| api/utils/route.js | Provides shared utility/helper functions. |
| api/utils/time.js | Provides shared utility/helper functions. |

### `js`

| File | Purpose |
| --- | --- |
| js/app.js | Application entry point / bootstrap file. |

### `js/data`

| File | Purpose |
| --- | --- |
| js/data/api.js | Defines 5 function(s) implementing supporting logic. |
| js/data/purchase-data.js | Defines 4 function(s) implementing supporting logic. |
| js/data/sales-data.js | Supporting source file. |
| js/data/sheets-store.js | Defines 14 function(s) implementing supporting logic. |

### `js/pages`

| File | Purpose |
| --- | --- |
| js/pages/backup.js | Defines 3 function(s) implementing supporting logic. |
| js/pages/bom.js | Defines 2 class(es) implementing core logic. |
| js/pages/dashboard.js | Defines 18 function(s) implementing supporting logic. |
| js/pages/lowstock.js | Defines 12 function(s) implementing supporting logic. |
| js/pages/masters.js | Defines 17 function(s) implementing supporting logic. |
| js/pages/partyledger.js | Defines 39 function(s) implementing supporting logic. |
| js/pages/purchase.js | Defines 45 function(s) implementing supporting logic. |
| js/pages/purchaseregister.js | Defines 15 function(s) implementing supporting logic. |
| js/pages/reports.js | Defines 14 function(s) implementing supporting logic. |
| js/pages/returns.js | Defines 8 function(s) implementing supporting logic. |
| js/pages/saleregister.js | Defines 15 function(s) implementing supporting logic. |
| js/pages/sales.js | Defines 1 class(es) implementing core logic. |
| js/pages/scansheet.js | Defines 95 function(s) implementing supporting logic. |
| js/pages/stockassign.js | Defines 24 function(s) implementing supporting logic. |


