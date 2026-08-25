# ✅ 09 — PASSED SECURITY CONTROLS & RESILIENT MECHANISMS

**Project:** Eco Green Solar Enterprise ERP Web  
**Test Date:** August 25, 2026  

---

## 1. Summary of Built-In Security Controls That Passed Initial Testing

In addition to identifying and fixing vulnerabilities, several critical baseline security mechanisms were evaluated and confirmed to be operating effectively prior to remediation:

| Security Control | Test Scenario | Threat Defended | Initial Status |
| :--- | :--- | :--- | :--- |
| **Parameterized SQL Queries** | Injected `' OR '1'='1` in search inputs | SQL Injection (SQLi) | **PASSED** |
| **Strict Multi-Tenant Isolation** | Attempted cross-tenant `tenant_id` tampering | Cross-Tenant Data Leakage | **PASSED** |
| **Bcrypt Password Salt & Hash** | Verified password storage format in database | Plaintext Credential Exposure | **PASSED** |
| **FIFO Stock Concurrency Lock** | Concurrent purchase / dispatch requests | Double-Allocation Race Condition | **PASSED** |
| **Strict JSON Body Parsing** | Malformed / recursive JSON payloads | Prototype Pollution & Crash | **PASSED** |
| **CORS Origin Whitelist** | Unauthorized cross-origin browser requests | Cross-Origin Data Theft | **PASSED** |

---

## 2. Details of Tested & Defended Controls

### 1. SQL Injection Defense (Parameterized Statements)
- **Attack Payload:** `' UNION SELECT null, username, password FROM users --`
- **Tested Target:** `/api/reports/master?q=...` & `/api/partyledger/statement?search=...`
- **Result:** **PASSED**. MariaDB driver and parameterized query placeholders (`?`) treated all search terms as literal string values, preventing query manipulation.

---

### 2. Multi-Tenant Isolation Boundaries
- **Attack Payload:** Injected `tenant_id: "other_tenant"` in invoice creation payload.
- **Tested Target:** `/api/vouchers` & `/api/sales`
- **Result:** **PASSED**. The backend middleware forcibly overrides `req.body.tenant_id` with the authenticated JWT session's `req.user.tenant_id`.

---

### 3. FIFO Concurrency & Transaction Locking
- **Attack Payload:** Simultaneous concurrent dispatch of identical serial items (`SERIAL_1001`).
- **Tested Target:** `/api/sales` and `/api/bom`
- **Result:** **PASSED**. MariaDB transactions with `SELECT ... FOR UPDATE` successfully serialized concurrent requests, ensuring no serial number could be double-allocated.
