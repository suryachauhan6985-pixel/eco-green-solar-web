# 🚨 05 — DETAILED VULNERABILITIES FOUND & ROOT CAUSE ANALYSIS

**Project:** Eco Green Solar Enterprise ERP Web  
**Test Date:** August 25, 2026  

---

## 1. Vulnerability Index

| Vulnerability ID | Title | Severity | OWASP Category | Remediated? |
| :--- | :--- | :--- | :--- | :--- |
| **VULN-001** | Role Authorization Middleware Array Flattening Flaw | **CRITICAL** | A01: Broken Access Control | **YES** |
| **VULN-002** | File Upload Binary Signature Verification Bypass | **HIGH** | A04: Insecure Design | **YES** |
| **VULN-003** | CSV / Excel Dynamic Data Exchange Formula Injection | **HIGH** | A03: Injection | **YES** |
| **VULN-004** | Sub-Standard Password Policy Enforcement | **HIGH** | A07: Identification & Auth Failures | **YES** |
| **VULN-005** | Uncaught ReferenceError in Purchase Inward Processing | **MEDIUM** | A05: Security Misconfiguration | **YES** |
| **VULN-006** | N+1 Database Query Flood in Sales Serial Verification | **MEDIUM** | A04: Insecure Design (Perf/DoS) | **YES** |
| **VULN-007** | Unbounded In-Memory Cache Growing to Heap Exhaustion | **MEDIUM** | A04: Insecure Design (DoS) | **YES** |
| **VULN-008** | Unbounded Keyset Pagination on Stock Ledger Reports | **LOW** | A04: Insecure Design (DoS) | **YES** |

---

## 2. Detailed Vulnerability Records

### VULN-001: Role Authorization Middleware Array Mismatch
- **Severity:** **CRITICAL** (CVSS: 9.1)
- **Affected File:** [`api/middleware/auth.middleware.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/middleware/auth.middleware.js)
- **Function:** `requireRole(...allowedRoles)`
- **Root Cause:** When routes passed roles as an array `requireRole(['Admin', 'SuperAdmin'])`, `...allowedRoles` became a nested array `[['Admin', 'SuperAdmin']]`. The array comparison failed or allowed unexpected role bypasses.
- **Impact:** Administrative and ledger management routes could be improperly bypassed or wrongly denied.

---

### VULN-002: File Upload Binary Signature Verification Bypass
- **Severity:** **HIGH** (CVSS: 8.2)
- **Affected File:** [`api/routes/attachments.routes.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/routes/attachments.routes.js)
- **Function:** `POST /api/attachments`
- **Root Cause:** The endpoint trusted the client-supplied `mimeType` property and file extension without reading the file buffer's magic bytes.
- **Impact:** Attacker could upload malicious executable payloads disguised as `.pdf` or `.png`.

---

### VULN-003: CSV / Excel Formula Injection (DDE Attack)
- **Severity:** **HIGH** (CVSS: 7.8)
- **Affected Files:** [`api/services/serialExcelService.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/services/serialExcelService.js), [`api/routes/backup.routes.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/routes/backup.routes.js)
- **Root Cause:** Serial numbers or party names starting with `=`, `+`, `-`, `@` were written directly into CSV / Excel cells without sanitization.
- **Impact:** When exported files were opened in Microsoft Excel, malicious formulas could execute arbitrary local commands.

---

### VULN-004: Sub-Standard Password Policy Enforcement
- **Severity:** **HIGH** (CVSS: 7.4)
- **Affected Files:** [`api/services/passwordPolicy.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/services/passwordPolicy.js), [`api/routes/auth.routes.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/routes/auth.routes.js)
- **Root Cause:** Backend accepted 4-character passwords without requiring uppercase, lowercase, numbers, special characters, or common-dictionary checks.
- **Impact:** User accounts were vulnerable to trivial brute-force and dictionary attacks.

---

### VULN-005: Uncaught ReferenceError in Purchase Inward Processing
- **Severity:** **MEDIUM** (CVSS: 6.5)
- **Affected File:** [`api/routes/purchase.routes.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/routes/purchase.routes.js)
- **Function:** `POST /api/purchase`
- **Root Cause:** Variable `model` was referenced inside the inward line processing loop without declaration, causing unhandled runtime crashes when processing certain models.
- **Impact:** Purchase inward requests threw 500 internal server errors.

---

### VULN-006: N+1 Database Query Flood in Sales Dispatch
- **Severity:** **MEDIUM** (CVSS: 5.9)
- **Affected File:** [`api/services/stockHelpers.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/services/stockHelpers.js)
- **Function:** `validateSalesLineSerials()`
- **Root Cause:** Synchronously executed individual SQL `SELECT` queries inside a JavaScript `for` loop for every single serial number.
- **Impact:** High latency (480ms+) and database connection exhaustion when dispatching large commercial orders.

---

### VULN-007: Unbounded In-Memory Cache Heap Flooding
- **Severity:** **MEDIUM** (CVSS: 5.5)
- **Affected File:** [`api/utils/cache.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/utils/cache.js)
- **Function:** `FastMemoryCache`
- **Root Cause:** In-memory cache had no upper boundary (`maxEntries`) or LRU eviction mechanism.
- **Impact:** Continuous API traffic could cause process memory to grow indefinitely, leading to Node.js Out-Of-Memory (OOM) crashes.

---

### VULN-008: Unbounded Keyset Pagination on Stock Ledger Reports
- **Severity:** **LOW** (CVSS: 4.3)
- **Affected File:** [`api/routes/reports.routes.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/routes/reports.routes.js)
- **Function:** `GET /api/reports/master`
- **Root Cause:** Endpoint did not enforce a strict maximum limit on requested records.
- **Impact:** A malicious query with `limit=1000000` could trigger heavy table scans.
