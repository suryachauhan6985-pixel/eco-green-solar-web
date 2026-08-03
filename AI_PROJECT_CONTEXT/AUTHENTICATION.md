# Authentication

## Auth-Related Files

| File | Purpose |
| --- | --- |
| api/services/passwords.js | Implements business logic as a service layer. |
| api/routes/auth.js | Defines HTTP route handlers (controller/router layer). |
| api/middleware/auth.js | Implements Express/Koa middleware. |


## Auth-Protected Routes (0)

_None detected._


## Public Routes (96)

| Method | Path | File |
| --- | --- | --- |
| GET | /api/attachments | api/routes/attachments.js |
| POST | /api/attachments | api/routes/attachments.js |
| DELETE | /api/attachments/:id | api/routes/attachments.js |
| GET | /api/attachments/:id/file | api/routes/attachments.js |
| POST | /api/auth/forgot-password | api/routes/auth.js |
| POST | /api/auth/heartbeat | api/routes/auth.js |
| POST | /api/auth/login | api/routes/auth.js |
| POST | /api/auth/logout | api/routes/auth.js |
| POST | /api/auth/register | api/routes/auth.js |
| POST | /api/auth/resend-otp | api/routes/auth.js |
| POST | /api/auth/reset-password | api/routes/auth.js |
| POST | /api/auth/verify-otp | api/routes/auth.js |
| POST | /api/auth/verify-register-otp | api/routes/auth.js |
| GET | /api/backup/download/:fileName | api/routes/backup.js |
| POST | /api/backup/run | api/routes/backup.js |
| GET | /api/backup/status | api/routes/backup.js |
| GET | /api/challan | api/routes/challan.js |
| POST | /api/challan | api/routes/challan.js |
| GET | /api/challan/:id | api/routes/challan.js |
| GET | /api/challan/:id/pdf | api/routes/challan.js |
| GET | /api/dashboard/summary | api/routes/health.js |
| GET | /api/health | api/routes/health.js |
| GET | /api/ledgers | api/routes/ledgers.js |
| POST | /api/ledgers | api/routes/ledgers.js |
| DELETE | /api/ledgers/:id | api/routes/ledgers.js |
| PUT | /api/ledgers/:id | api/routes/ledgers.js |
| GET | /api/ledgers/directory | api/routes/ledgers.js |
| GET | /api/ledgers/shortcodes | api/routes/ledgers.js |
| GET | /api/ledgers/statement | api/routes/ledgers.js |
| GET | /api/lowstock | api/routes/health.js |
| GET | /api/masters/brands | api/routes/masters.js |
| GET | /api/masters/categories | api/routes/masters.js |
| POST | /api/masters/categories | api/routes/masters.js |
| DELETE | /api/masters/categories/:name | api/routes/masters.js |
| PUT | /api/masters/categories/:name/serial-rule | api/routes/masters.js |
| PUT | /api/masters/categories/:name/watt-rule | api/routes/masters.js |
| GET | /api/masters/items | api/routes/masters.js |
| POST | /api/masters/items | api/routes/masters.js |
| PUT | /api/masters/items/:id | api/routes/masters.js |
| DELETE | /api/masters/subtypes | api/routes/masters.js |
| POST | /api/masters/subtypes | api/routes/masters.js |
| PUT | /api/masters/subtypes | api/routes/masters.js |
| GET | /api/masters/subtypes/:category | api/routes/masters.js |
| DELETE | /api/masters/units | api/routes/masters.js |
| GET | /api/masters/units | api/routes/masters.js |
| POST | /api/masters/units | api/routes/masters.js |
| PUT | /api/masters/units | api/routes/masters.js |
| GET | /api/masters/users | api/routes/masters.js |
| POST | /api/masters/users | api/routes/masters.js |
| PUT | /api/masters/users/email | api/routes/masters.js |
| PUT | /api/masters/users/password | api/routes/masters.js |
| DELETE | /api/masters/warehouses | api/routes/masters.js |
| GET | /api/masters/warehouses | api/routes/masters.js |
| POST | /api/masters/warehouses | api/routes/masters.js |
| PUT | /api/masters/warehouses | api/routes/masters.js |
| POST | /api/purchase | api/routes/purchase.js |
| POST | /api/purchase | api/routes/purchase.rout.js |
| DELETE | /api/purchase/:invoiceNo | api/routes/purchase.js |
| DELETE | /api/purchase/:invoiceNo | api/routes/purchase.rout.js |
| PUT | /api/purchase/:invoiceNo | api/routes/purchase.js |
| PUT | /api/purchase/:invoiceNo | api/routes/purchase.rout.js |
| GET | /api/purchase/brands/:category | api/routes/purchase.js |
| GET | /api/purchase/brands/:category | api/routes/purchase.rout.js |
| GET | /api/purchase/check-serials | api/routes/purchase.js |
| GET | /api/purchase/check-serials | api/routes/purchase.rout.js |
| GET | /api/purchase/find | api/routes/purchase.js |
| GET | /api/purchase/find | api/routes/purchase.rout.js |
| GET | /api/purchase/register | api/routes/purchase.js |
| GET | /api/purchase/register | api/routes/purchase.rout.js |
| GET | /api/purchase/wattages | api/routes/purchase.js |
| GET | /api/purchase/wattages | api/routes/purchase.rout.js |
| GET | /api/reports/master | api/routes/reports.js |
| POST | /api/returns | api/routes/sales.js |
| GET | /api/sales/check-line | api/routes/sales.js |
| DELETE | /api/sales/delete/:orderNo | api/routes/sales.js |
| POST | /api/sales/dispatch | api/routes/sales.js |
| GET | /api/sales/find/:term | api/routes/sales.js |
| PUT | /api/sales/modify/:orderNo | api/routes/sales.js |
| GET | /api/sales/register | api/routes/sales.js |
| GET | /api/sales/types | api/routes/sales.js |
| GET | /api/scansheet/sheets | api/routes/scansheet.routes.js |
| POST | /api/scansheet/sheets | api/routes/scansheet.routes.js |
| DELETE | /api/scansheet/sheets/:id | api/routes/scansheet.routes.js |
| PUT | /api/scansheet/sheets/:id | api/routes/scansheet.routes.js |
| DELETE | /api/scansheet/sheets/:id/entries | api/routes/scansheet.routes.js |
| GET | /api/scansheet/sheets/:id/entries | api/routes/scansheet.routes.js |
| POST | /api/scansheet/sheets/:id/entries | api/routes/scansheet.routes.js |
| DELETE | /api/scansheet/sheets/:id/entries/:entryId | api/routes/scansheet.routes.js |
| PUT | /api/scansheet/sheets/:id/entries/renumber | api/routes/scansheet.routes.js |
| GET | /api/sessions/live | api/routes/auth.js |
| POST | /api/stockassign | api/routes/stockassign.js |
| GET | /api/stockassign/available | api/routes/stockassign.js |
| GET | /api/stockassign/lines/:reference | api/routes/stockassign.js |
| GET | /api/stockassign/register | api/routes/stockassign.js |
| POST | /api/stockassign/release-customer | api/routes/stockassign.js |
| POST | /api/stockassign/release-firm | api/routes/stockassign.js |

