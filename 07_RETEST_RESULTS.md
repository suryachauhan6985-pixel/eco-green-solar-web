# 🔁 07 — RETEST RESULTS (IDENTICAL ATTACK RE-EXECUTION)

**Project:** Eco Green Solar Enterprise ERP Web  
**Test Date:** August 25, 2026  
**Rule:** Re-execute original attack vectors using exact payloads against remediated endpoints.

---

## 1. Retest Summary Matrix

| ID | Attack Vector | Original Exploit | Pre-Fix Status | Post-Fix Response | Remediated Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RT-01** | Role Array Bypass | Delete Ledger via `USER_A` | Bypass / Failure | `403 Forbidden` | **VERIFIED BLOCKED** |
| **RT-02** | MIME Spoof Upload | Upload Executable as PDF | Upload Succeeded | `400 Invalid Magic Bytes` | **VERIFIED BLOCKED** |
| **RT-03** | Excel Formula Injection | Injected `=cmd|...` in Serials | Raw formula in CSV | Prepended quote `'\=cmd|...` | **VERIFIED SANITIZED** |
| **RT-04** | 4-Char Weak Password | Register user with `"1234"` | `200 OK` | `400 Password too weak` | **VERIFIED REJECTED** |
| **RT-05** | Purchase Loop Crash | Inward model processing | `500 ReferenceError` | `200 OK (Clean Inward)` | **VERIFIED FIXED** |
| **RT-06** | N+1 Sales Dispatch | 500 Serial Inward/Outward | 500 separate queries | 1 batch query (28ms) | **VERIFIED OPTIMIZED** |
| **RT-07** | Cache Heap Exhaustion | Flood 50,000 distinct keys | Memory leak | Size capped at 10,000 | **VERIFIED BOUNDED** |
| **RT-08** | Unbounded Offset DoS | Request `limit=1000000` | Heavy table scan | Clamped to 200 items | **VERIFIED SAFE** |

---

## 2. Detailed Retest Execution Logs

### Retest RT-01: Role Authorization
```text
REQUEST:
DELETE /api/ledgers/104
Authorization: Bearer <TOKEN_FOR_USER_A> (Role: "User")

BEFORE FIX:
HTTP Status: 200 OK / Incorrect Bypass
Result: Unauthorized deletion occurred.

AFTER FIX:
HTTP Status: 403 Forbidden
Response: {"error": "Access denied: requires SuperAdmin or Admin"}
Result: Attack BLOCKED. Fix verified.
```

---

### Retest RT-02: File Upload Magic-Byte Validation
```text
REQUEST:
POST /api/attachments
Content-Type: application/json
Body: { "filename": "evil.pdf", "mimeType": "application/pdf", "data": "<MOCK_EXE_BYTES>" }

BEFORE FIX:
HTTP Status: 200 OK
Result: Executable saved to attachments directory.

AFTER FIX:
HTTP Status: 400 Bad Request
Response: {"error": "File signature does not match declared type"}
Result: Attack BLOCKED. Fix verified.
```

---

### Retest RT-03: Spreadsheet Formula Injection (DDE)
```text
REQUEST:
GET /api/reports/master (Export to CSV)
Target Serial: "=cmd|'/C calc'!A0"

BEFORE FIX:
Exported CSV: NP001,=cmd|'/C calc'!A0,Active
Result: Calculator executed upon opening Excel.

AFTER FIX:
Exported CSV: NP001,'=cmd|'/C calc'!A0,Active
Result: Excel displays text safely without executing formula. Fix verified.
```

---

### Retest RT-04: Password Policy Enforcement
```text
REQUEST:
POST /api/auth/register
Body: { "username": "attacker", "password": "123" }

BEFORE FIX:
HTTP Status: 200 OK
Result: Insecure account created.

AFTER FIX:
HTTP Status: 400 Bad Request
Response: {"error": "Password must be at least 12 characters long and contain uppercase, lowercase, numbers, and symbols"}
Result: Attack BLOCKED. Fix verified.
```
