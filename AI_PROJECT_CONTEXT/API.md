# API Documentation

Total endpoints detected: **92**

## Endpoints by Method

| Method | Count |
| --- | --- |
| GET | 38 |
| POST | 29 |
| DELETE | 12 |
| PUT | 13 |


## All Endpoints

| Method | Path | File | Auth Middleware Detected |
| --- | --- | --- | --- |
| GET | /api/attachments | api/routes/attachments.routes.js | No |
| POST | /api/attachments | api/routes/attachments.routes.js | No |
| DELETE | /api/attachments/:id | api/routes/attachments.routes.js | No |
| GET | /api/attachments/:id/file | api/routes/attachments.routes.js | No |
| POST | /api/auth/forgot-password | api/routes/auth.routes.js | No |
| POST | /api/auth/heartbeat | api/routes/auth.routes.js | No |
| POST | /api/auth/login | api/routes/auth.routes.js | No |
| POST | /api/auth/logout | api/routes/auth.routes.js | No |
| POST | /api/auth/register | api/routes/auth.routes.js | No |
| POST | /api/auth/resend-otp | api/routes/auth.routes.js | No |
| POST | /api/auth/reset-password | api/routes/auth.routes.js | No |
| POST | /api/auth/verify-otp | api/routes/auth.routes.js | No |
| POST | /api/auth/verify-register-otp | api/routes/auth.routes.js | No |
| GET | /api/backup/download/:fileName | api/routes/backup.routes.js | No |
| POST | /api/backup/run | api/routes/backup.routes.js | No |
| GET | /api/backup/status | api/routes/backup.routes.js | No |
| POST | /api/bom/check-stock | api/routes/bom.routes.js | No |
| POST | /api/bom/dispatch | api/routes/bom.routes.js | No |
| GET | /api/challan | api/routes/challan.routes.js | No |
| POST | /api/challan | api/routes/challan.routes.js | No |
| GET | /api/challan/:id | api/routes/challan.routes.js | No |
| GET | /api/challan/:id/pdf | api/routes/challan.routes.js | No |
| GET | /api/dashboard/summary | api/routes/health.js | No |
| GET | /api/health | api/routes/health.js | No |
| GET | /api/ledgers | api/routes/ledgers.routes.js | No |
| POST | /api/ledgers | api/routes/ledgers.routes.js | No |
| DELETE | /api/ledgers/:id | api/routes/ledgers.routes.js | No |
| PUT | /api/ledgers/:id | api/routes/ledgers.routes.js | No |
| GET | /api/ledgers/directory | api/routes/ledgers.routes.js | No |
| GET | /api/ledgers/shortcodes | api/routes/ledgers.routes.js | No |
| GET | /api/ledgers/statement | api/routes/ledgers.routes.js | No |
| GET | /api/lowstock | api/routes/health.js | No |
| GET | /api/masters/brands | api/routes/masters.routes.js | No |
| GET | /api/masters/categories | api/routes/masters.routes.js | No |
| POST | /api/masters/categories | api/routes/masters.routes.js | No |
| DELETE | /api/masters/categories/:name | api/routes/masters.routes.js | No |
| PUT | /api/masters/categories/:name/serial-rule | api/routes/masters.routes.js | No |
| PUT | /api/masters/categories/:name/watt-rule | api/routes/masters.routes.js | No |
| GET | /api/masters/items | api/routes/masters.routes.js | No |
| POST | /api/masters/items | api/routes/masters.routes.js | No |
| DELETE | /api/masters/items/:id | api/routes/masters.routes.js | No |
| PUT | /api/masters/items/:id | api/routes/masters.routes.js | No |
| DELETE | /api/masters/subtypes | api/routes/masters.routes.js | No |
| POST | /api/masters/subtypes | api/routes/masters.routes.js | No |
| PUT | /api/masters/subtypes | api/routes/masters.routes.js | No |
| GET | /api/masters/subtypes/:category | api/routes/masters.routes.js | No |
| DELETE | /api/masters/units | api/routes/masters.routes.js | No |
| GET | /api/masters/units | api/routes/masters.routes.js | No |
| POST | /api/masters/units | api/routes/masters.routes.js | No |
| PUT | /api/masters/units | api/routes/masters.routes.js | No |
| GET | /api/masters/users | api/routes/masters.routes.js | No |
| POST | /api/masters/users | api/routes/masters.routes.js | No |
| PUT | /api/masters/users/email | api/routes/masters.routes.js | No |
| PUT | /api/masters/users/password | api/routes/masters.routes.js | No |
| DELETE | /api/masters/warehouses | api/routes/masters.routes.js | No |
| GET | /api/masters/warehouses | api/routes/masters.routes.js | No |
| POST | /api/masters/warehouses | api/routes/masters.routes.js | No |
| PUT | /api/masters/warehouses | api/routes/masters.routes.js | No |
| POST | /api/purchase | api/routes/purchase.routes.js | No |
| DELETE | /api/purchase/:invoiceNo | api/routes/purchase.routes.js | No |
| PUT | /api/purchase/:invoiceNo | api/routes/purchase.routes.js | No |
| GET | /api/purchase/brands/:category | api/routes/purchase.routes.js | No |
| GET | /api/purchase/check-serials | api/routes/purchase.routes.js | No |
| GET | /api/purchase/find | api/routes/purchase.routes.js | No |
| GET | /api/purchase/models | api/routes/purchase.routes.js | No |
| GET | /api/purchase/register | api/routes/purchase.routes.js | No |
| GET | /api/purchase/wattages | api/routes/purchase.routes.js | No |
| GET | /api/reports/master | api/routes/reports.routes.js | No |
| POST | /api/returns | api/routes/sales.routes.js | No |
| GET | /api/sales/check-line | api/routes/sales.routes.js | No |
| DELETE | /api/sales/delete/:orderNo | api/routes/sales.routes.js | No |
| POST | /api/sales/dispatch | api/routes/sales.routes.js | No |
| GET | /api/sales/find/:term | api/routes/sales.routes.js | No |
| PUT | /api/sales/modify/:orderNo | api/routes/sales.routes.js | No |
| GET | /api/sales/register | api/routes/sales.routes.js | No |
| GET | /api/sales/types | api/routes/sales.routes.js | No |
| GET | /api/scansheet/sheets | api/routes/scansheet.routes.js | No |
| POST | /api/scansheet/sheets | api/routes/scansheet.routes.js | No |
| DELETE | /api/scansheet/sheets/:id | api/routes/scansheet.routes.js | No |
| PUT | /api/scansheet/sheets/:id | api/routes/scansheet.routes.js | No |
| DELETE | /api/scansheet/sheets/:id/entries | api/routes/scansheet.routes.js | No |
| GET | /api/scansheet/sheets/:id/entries | api/routes/scansheet.routes.js | No |
| POST | /api/scansheet/sheets/:id/entries | api/routes/scansheet.routes.js | No |
| DELETE | /api/scansheet/sheets/:id/entries/:entryId | api/routes/scansheet.routes.js | No |
| PUT | /api/scansheet/sheets/:id/entries/renumber | api/routes/scansheet.routes.js | No |
| GET | /api/sessions/live | api/routes/auth.routes.js | No |
| POST | /api/stockassign | api/routes/stockassign.routes.js | No |
| GET | /api/stockassign/available | api/routes/stockassign.routes.js | No |
| GET | /api/stockassign/lines/:reference | api/routes/stockassign.routes.js | No |
| GET | /api/stockassign/register | api/routes/stockassign.routes.js | No |
| POST | /api/stockassign/release-customer | api/routes/stockassign.routes.js | No |
| POST | /api/stockassign/release-firm | api/routes/stockassign.routes.js | No |

