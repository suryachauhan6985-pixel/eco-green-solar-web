# 👥 03 — SYNTHETIC TEST USERS & TEST DATA LOG

**Project:** Eco Green Solar Enterprise ERP Web  
**Environment:** Isolated Non-Production Sandbox  

---

## 1. Synthetic Test Users

All testing was performed using isolated synthetic accounts. Passwords are redacted in compliance with security guidelines.

| Test User Account | Assigned Role | Security Testing Purpose |
| :--- | :--- | :--- |
| **ADMIN_TEST** | `SuperAdmin` / `Admin` | Full privileged operations, user creation, tenant management, deletion testing |
| **MANAGER_TEST** | `Manager` | Operational management, stock inward approval, inventory dispatch testing |
| **USER_A** | `User` | Primary attacker account for privilege escalation & cross-tenant access testing |
| **USER_B** | `User` | Victim account for horizontal cross-user IDOR and ledger access testing |
| **READONLY_TEST** | `Viewer` / `ReadOnly` | Read-only enforcement, write-protection validation across all POST/PUT/DELETE routes |

---

## 2. Synthetic Test Datasets

To thoroughly test authorization, pagination, search performance, and concurrency under realistic conditions, the following synthetic records were generated:

```text
SYNTHETIC DATASET BREAKDOWN
------------------------------------------------------------------------
Test User Accounts:              5 accounts
Parties & Customers:             100 records (Used for search & IDOR testing)
Suppliers & Vendors:             50 records (Used for purchase inward testing)
Registered SKUs & Items:         250 master products (Panels, Inverters, Batteries)
Serial Numbers Generated:        2,000 unique serials (Duplicate & injection testing)
Stock Ledger Movements:          5,000 transaction rows (FIFO & race-condition testing)
Accounting Vouchers:             1,000 vouchers (Payment, Receipt, Journal, Contra)
File Upload Attachments:         20 synthetic files (PDF, PNG, JPG, Executable mocks)
```

---

## 3. Dataset Testing Allocation

1. **2,000 Serial Numbers:**
   - Injected with formula injection payloads (`=cmd|...`, `@SUM...`, `+1-1`) to test CSV/Excel export safety.
   - Tested under high-volume batch dispatch (500 serials per API call) to measure database query efficiency and lock contention.

2. **100 Parties & Ledgers:**
   - Tagged with multiple `tenant_id` values to verify tenant isolation boundaries.
   - Tested against live autocomplete search inputs to verify debounce and cancel behavior.

3. **5,000 Stock Ledger Rows:**
   - Used to verify Keyset cursor pagination (`WHERE id < :cursor LIMIT 50`) vs offset pagination performance.
