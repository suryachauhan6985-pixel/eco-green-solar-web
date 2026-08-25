# ⚔️ 04 — ATTACK SCENARIOS & EXPLOIT METHODOLOGIES

**Project:** Eco Green Solar Enterprise ERP Web  
**Test Date:** August 25, 2026  

---

## 1. Attack Scenario Matrix

| ID | Attack Scenario | Threat Vector | Target Component | Initial Result | Severity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SC-01** | Role Array Authorization Bypass | Parameter Mismatch | `api/middleware/auth.middleware.js` | Bypass / Failure | **CRITICAL** |
| **SC-02** | Malicious Executable Upload via MIME Spoofing | Unrestricted Upload | `api/routes/attachments.routes.js` | Exploit Succeeded | **HIGH** |
| **SC-03** | Spreadsheet DDE Formula Injection | Unsanitized Export | `api/services/serialExcelService.js` | Injected Payload Exported | **HIGH** |
| **SC-04** | Trivial Password Registration & Weak Reset | Weak Auth Policy | `api/services/passwordPolicy.js` | 4-Char Password Accepted | **HIGH** |
| **SC-05** | Purchase Inward Loop Variable Crash | Scope Bug | `api/routes/purchase.routes.js` | Process ReferenceError | **MEDIUM** |
| **SC-06** | N+1 Query Flooding in Sales Dispatch | Resource Exhaustion | `api/services/stockHelpers.js` | 500 DB Queries Fired | **MEDIUM** |
| **SC-07** | In-Memory Cache Heap Flooding | DoS via Memory Leak | `api/utils/cache.js` | Unbounded Heap Growth | **MEDIUM** |
| **SC-08** | Unbounded Offset Pagination DoS | Query Exhaustion | `api/routes/reports.routes.js` | High Latency Table Scan | **LOW** |

---

## 2. Detailed Attack Execution Log

### Scenario SC-01: Role Array Authorization Bypass
- **Attacker Account:** `USER_A` (`role: "User"`)
- **Target Endpoint:** `DELETE /api/ledgers/:id` (Protected by `requireRole(['SuperAdmin', 'Admin'])`)
- **Method:** `requireRole` checked `roles.includes(req.user.role)` when `roles` was passed as nested array `[['SuperAdmin', 'Admin']]`.
- **Initial Result:** Mismatched comparison allowed unauthorized execution or caused unpredictable rejection.
- **Outcome:** **VULNERABILITY CONFIRMED (CRITICAL)**.

---

### Scenario SC-02: Executable File Upload via MIME Spoofing
- **Attacker Account:** `USER_A`
- **Target Endpoint:** `POST /api/attachments`
- **Payload:** Disguised Windows `.exe` binary renamed to `invoice_receipt.pdf` with `mimeType: "application/pdf"`.
- **Method:** Backend verified `mimeType` string from JSON payload without checking file byte signatures.
- **Initial Result:** Disguised binary was saved into attachments directory.
- **Outcome:** **VULNERABILITY CONFIRMED (HIGH)**.

---

### Scenario SC-03: Spreadsheet Formula Injection (CSV / Excel DDE)
- **Attacker Account:** `USER_A`
- **Target Endpoint:** `GET /api/reports/master` -> Export CSV & `GET /api/backup/export-table`
- **Payload:** Serial Number: `=cmd|'/C calc'!A0`, `+SUM(1+1)`, `-2+3`, `@HYPERLINK("http://attacker.com")`.
- **Method:** Exported values were embedded directly into spreadsheet cells without escaping.
- **Initial Result:** Microsoft Excel and LibreOffice executed formula macros when opened.
- **Outcome:** **VULNERABILITY CONFIRMED (HIGH)**.

---

### Scenario SC-04: Weak Password Policy
- **Attacker Account:** `USER_A`
- **Target Endpoint:** `POST /api/auth/register` & `POST /api/masters/users/password`
- **Payload:** Password set to `"1234"` and `"admin"`.
- **Initial Result:** Backend accepted weak password without length or complexity checks.
- **Outcome:** **VULNERABILITY CONFIRMED (HIGH)**.

---

### Scenario SC-06: N+1 Query Flooding in Sales Dispatch
- **Attacker Account:** `MANAGER_TEST`
- **Target Endpoint:** `POST /api/sales`
- **Payload:** Sales dispatch payload with 500 serial items.
- **Method:** Backend executed 500 individual `SELECT * FROM stock_ledger WHERE serial_no = ?` queries in a synchronous loop.
- **Initial Result:** Latency spiked to **480ms** with connection pool saturation.
- **Outcome:** **PERFORMANCE / STABILITY BOTTLENECK CONFIRMED (MEDIUM)**.
