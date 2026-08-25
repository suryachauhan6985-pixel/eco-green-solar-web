# 📝 CHANGELOG: SECURITY & PERFORMANCE ENHANCEMENTS

**Date:** August 2026  
**Status:** Successfully Deployed & Verified

---

## Added
- **Universal Password Policy Engine:** 12+ characters, complexity checklist, entropy scoring, blacklist rejection, identity containment detection, real-time live UI meters, and remote session invalidation.
- **Automated Verification Test Suites:**
  - `tests/password-policy.test.js` (16 unit tests)
  - `tests/security-performance.test.js` (11 unit tests)
- **Composite Database Indexes:** Added indexes across `stock_ledger`, `items`, `ledgers`, `accounting_vouchers`, `attachments`, `audit_logs`, `bom_orders`, and `scan_sheet_entries`.
- **LRU Eviction in Memory Cache:** Added capacity bounding (`maxEntries: 10000`) and LRU pruning in `FastMemoryCache`.
- **Formula Injection Sanitizer:** Added `sanitizeCellForExcel` across Excel generation and database backup endpoints.
- **Comprehensive Audit Deliverables:** Created `SECURITY_AUDIT.md`, `PERFORMANCE_AUDIT.md`, `SCALABILITY_AUDIT.md`, `DATABASE_AUDIT.md`, `SECURITY_FIXES.md`, `PERFORMANCE_FIXES.md`, and `REMAINING_RISKS.md`.

---

## Changed / Optimized
- **Role Authorization (`requireRole`):** Added `roles.flat()` normalization to seamlessly support both arrays and vararg parameters.
- **N+1 Query Elimination in Dispatch Validation:** Replaced serial-by-serial loop in `validateSalesLineSerials` with a single batch `IN` query.
- **N+1 Query Elimination in BOM Item Check:** Replaced line-by-line item queries in `checkItems` with a batched item master lookup.
- **Report Pagination Bounds:** Replaced unbounded page sizes with a 200-item maximum cap and keyset cursor support (`WHERE sl.id < :cursor`).
- **Attachment Tenant Scoping:** Bound `tenant_id` to all attachment operations for multi-tenant data isolation.
- **Purchase Inward Scope:** Extracted `const model = String(line.model || '').trim();` in `POST /api/purchase`.
