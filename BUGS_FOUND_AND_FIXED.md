# BUGS FOUND AND FIXED — QA AUDIT & REMEDIATION LOG

All bugs identified during the end-to-end full-stack code audit, along with root cause analysis, fixes applied, and verified test results.

---

### BUG-001: Financial Statements Non-Existent Columns SQL Error
- **Location**: `api/routes/vouchers.routes.js` (lines 159–165)
- **Endpoint**: `GET /api/financial/statements`
- **Severity**: **HIGH (500 Server Error)**
- **Root Cause**: The query in `/api/financial/statements` attempted to select `movement`, `party_name`, `rate`, and `amount` from the `stock_ledger` table. In the real schema, `stock_ledger` does not contain `movement`, `party_name`, `rate`, or `amount` columns. Any call to calculate financial statements would immediately throw an unhandled SQL error and crash the endpoint.
- **Fix Applied**: Removed the broken query against non-existent columns. Inventory value aggregation is cleanly decoupled to rely strictly on validated voucher journals until full cost-of-goods ledger tables are configured.
- **Re-test Result**: `GET /api/financial/statements` now executes cleanly without SQL errors (returns `401` when unauthenticated, and full JSON payload when authenticated).

---

### BUG-002: Dashboard Operations Pulse Multi-Tenant Data Leak
- **Location**: `api/routes/health.js` (lines 74–104)
- **Endpoint**: `GET /api/dashboard/summary`
- **Severity**: **HIGH (Data Isolation / Multi-Tenant Security)**
- **Root Cause**: The real-time operations query (`opsToday`, `warehousesCount`, and `activeChallans`) on `stock_ledger` had no `tenant_id` filter. In multi-tenant SaaS mode, all tenants' today's inward quantities, invoices, dispatch counts, and challans were aggregated together, leaking operational volume data across tenants.
- **Fix Applied**: Added dynamic `tenant_id` scoping to `opsToday`, `warehousesCount`, and `activeChallans` queries using the resolved `req.tenant.id`.
- **Re-test Result**: Queries now strictly isolate stock metrics per tenant.

---

### BUG-003: Balance Sheet Hardcoded Magic Number
- **Location**: `api/routes/vouchers.routes.js` (line 254)
- **Endpoint**: `GET /api/financial/statements`
- **Severity**: **MEDIUM (Business Logic / Reporting Inaccuracy)**
- **Root Cause**: Capital account was hardcoded as `capitalAccount: 500000 + netProfit`.
- **Fix Applied**: Removed the hardcoded `500000` base value. Capital account accurately reflects actual computed retained earnings (`netProfit`).
- **Re-test Result**: Balance sheet outputs strictly computed values without arbitrary offsets.

---

### BUG-004: Server Internal Telemetry Exposed Without Authorization
- **Location**: `api/routes/health.js` (line 147)
- **Endpoint**: `GET /api/system/performance`
- **Severity**: **HIGH (Information Disclosure / Security)**
- **Root Cause**: The `/api/system/performance` endpoint, which exposes server heap memory usage, DB connection pool internals, active connections, and table record counts, had no `requireRole` middleware guard. Any standard user could view sensitive infrastructure metrics.
- **Fix Applied**: Added `requireRole('SuperAdmin')` middleware.
- **Re-test Result**: Non-SuperAdmin requests are rejected with `403 Forbidden` / `401 Unauthorized`.

---

### BUG-005: Master Category & Subtypes Mutation Missing Role Authorization
- **Location**: `api/routes/masters.routes.js` (lines 18, 129, 137, 145)
- **Endpoints**: `POST /api/masters/categories`, `POST/PUT/DELETE /api/masters/subtypes`
- **Severity**: **HIGH (Privilege Escalation / Security)**
- **Root Cause**: Category creation and all Subtype mutating endpoints lacked `requireRole` guards. Any logged-in basic user could create categories, add subtypes, rename them, or delete them.
- **Fix Applied**: Added `requireRole('SuperAdmin', 'Admin')` to category creation and all subtype mutation endpoints.
- **Re-test Result**: Unauthorized requests now receive `401/403` responses.

---

### BUG-006: Units of Measurement (UOM) Mutating Endpoints Missing Role Authorization
- **Location**: `api/routes/masters.routes.js` (lines 165, 173, 182)
- **Endpoints**: `POST /api/masters/units`, `PUT /api/masters/units`, `DELETE /api/masters/units`
- **Severity**: **HIGH (Privilege Escalation / Security)**
- **Root Cause**: Any authenticated user could create, rename, or delete units of measurement, potentially breaking item catalogs across the system.
- **Fix Applied**: Added `requireRole('SuperAdmin', 'Admin')` to `POST`, `PUT`, and `DELETE` endpoints for `/api/masters/units`.
- **Re-test Result**: Endpoints now strictly require administrative privileges.

---

### BUG-007: Items & Warehouses CRUD Missing Role Authorization and Name Validation
- **Location**: `api/routes/masters.routes.js` (lines 281, 295, 312, 333, 340, 349)
- **Endpoints**: `POST/PUT/DELETE /api/masters/items`, `POST/PUT/DELETE /api/masters/warehouses`
- **Severity**: **HIGH (Privilege Escalation / Data Integrity)**
- **Root Cause**: Item creation/editing/deletion and Warehouse creation/editing/deletion lacked `requireRole` guards. Furthermore, `POST /api/masters/warehouses` had no validation ensuring `name` was provided, which could insert empty warehouse rows.
- **Fix Applied**: Added `requireRole('SuperAdmin', 'Admin')` to all mutating item and warehouse endpoints, and added mandatory `name` validation for warehouse creation.
- **Re-test Result**: Mutation endpoints are protected and validate required fields before executing database queries.

---

## SUMMARY OF APPLIED FIXES

| Bug ID | Component | File Modified | Status |
|---|---|---|---|
| BUG-001 | Vouchers & Financial Statements | `api/routes/vouchers.routes.js` | **FIXED & VERIFIED** |
| BUG-002 | Health & Dashboard Telemetry | `api/routes/health.js` | **FIXED & VERIFIED** |
| BUG-003 | Accounting Reports | `api/routes/vouchers.routes.js` | **FIXED & VERIFIED** |
| BUG-004 | System Performance Telemetry | `api/routes/health.js` | **FIXED & VERIFIED** |
| BUG-005 | Category & Subtypes Master | `api/routes/masters.routes.js` | **FIXED & VERIFIED** |
| BUG-006 | Units Master | `api/routes/masters.routes.js` | **FIXED & VERIFIED** |
| BUG-007 | Items & Warehouses Master | `api/routes/masters.routes.js` | **FIXED & VERIFIED** |
