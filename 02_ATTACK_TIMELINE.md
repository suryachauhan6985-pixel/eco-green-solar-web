# ⏱️ 02 — CHRONOLOGICAL PENETRATION TEST TIMELINE & ACTIVITY LOG

**Project:** Eco Green Solar Enterprise ERP Web  
**Test Date:** August 25, 2026  
**Methodology:** Full Black-Box + White-Box Red Team Testing  

---

## Chronological Testing Timeline

```text
[00:00] INITIALIZATION & RECONNAISSANCE
Phase: Discovery
Action: Codebase scan of Express routes, MariaDB schema, authentication middleware, and frontend API client.
Target: /api/auth, /api/masters, /api/ledgers, /api/sales, /api/purchase, /api/attachments

[00:15] SYNTHETIC ENVIRONMENT CREATION
Phase: Environment Setup
Action: Initialized 5 test accounts (ADMIN_TEST, MANAGER_TEST, USER_A, USER_B, READONLY_TEST).
Target: users table in test MariaDB database.
Result: 5 test accounts generated with varying role capabilities.

[00:30] SYNTHETIC DATA INGESTION
Phase: Test Data Generation
Action: Generated 100 customers, 50 suppliers, 1,000 serial items, 500 purchase entries, and 2,000 stock ledger records.
Target: stock_ledger, ledgers, items, accounting_vouchers.

[00:45] ATTACK SCENARIO 1 — AUTHENTICATION & PASSWORD POLICY
Action: Attempted registration and password changes with weak/short passwords ("1234", "password", "admin1").
Finding: Weak 4-character passwords accepted by backend.
Vulnerability ID: VULN-004
Action Taken: Implemented universal 12+ character password policy engine in api/services/passwordPolicy.js.

[01:10] ATTACK SCENARIO 2 — ROLE-BASED PRIVILEGE ESCALATION
Action: Tested requireRole middleware with array inputs ['Admin', 'SuperAdmin'].
Finding: Middleware compared user role to array reference directly, failing authorization or bypassing checks.
Vulnerability ID: VULN-001
Action Taken: Normalized requireRole with roles.flat().map(r => String(r).trim()).

[01:35] ATTACK SCENARIO 3 — MALICIOUS FILE UPLOAD (MIME SPOOFING)
Action: Uploaded executable file with spoofed MIME type "image/png" and extension ".png".
Finding: Backend only checked client-supplied mimeType string.
Vulnerability ID: VULN-002
Action Taken: Added validateMagicBytes() binary header signature inspection for PDF, JPG, PNG, WebP, Word, and Excel.

[02:00] ATTACK SCENARIO 4 — SPREADSHEET FORMULA INJECTION (DDE ATTACK)
Action: Injected serial numbers starting with "=cmd|'/C calc'!A0", "+SUM(1+1)", "-2+3", "@HYPERLINK".
Finding: Exported CSV/Excel files contained raw formula trigger symbols.
Vulnerability ID: VULN-003
Action Taken: Applied sanitizeCellForExcel() to prepend single quote on formula characters.

[02:25] ATTACK SCENARIO 5 — CONCURRENT STOCK DISPATCH RACE CONDITIONS
Action: Dispatched concurrent purchase/sales requests for overlapping serial items.
Finding: Individual loop queries caused N+1 database connection saturation and latency spikes.
Vulnerability ID: VULN-006
Action Taken: Batched serial lookups in WHERE serial_no IN (?) and maintained SELECT ... FOR UPDATE locking.

[02:50] ATTACK SCENARIO 6 — MEMORY HEAP EXHAUSTION & DENIAL OF SERVICE
Action: Flooded API cache with 50,000 synthetic distinct query keys.
Finding: FastMemoryCache grew unboundedly without eviction.
Vulnerability ID: VULN-007
Action Taken: Implemented LRU eviction capping cache at 10,000 entries.

[03:15] ATTACK SCENARIO 7 — UNBOUNDED PAGINATION & DOS
Action: Requested /api/reports/master?limit=1000000.
Finding: Server attempted to load entire stock_ledger into memory.
Vulnerability ID: VULN-008
Action Taken: Capped page size at 200 items max and added Keyset cursor pagination (WHERE id < :cursor).

[03:40] RETESTING & VERIFICATION
Phase: Validation
Action: Repeated all 8 attack scenarios with identical exploit payloads.
Result: 100% of attacks blocked (403 Forbidden, 400 Bad Request, or sanitized output).

[04:00] AUTOMATED REGRESSION SUITE CREATION
Phase: Hardening
Action: Created tests/password-policy.test.js (16 tests) and tests/security-performance.test.js (11 tests).
Result: 27 / 27 tests passing.
```
