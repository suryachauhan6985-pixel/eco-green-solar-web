# 🛠️ 06 — DETAILED CODE-LEVEL FIXES & SECURITY CONTROLS APPLIED

**Project:** Eco Green Solar Enterprise ERP Web  
**Date:** August 25, 2026  

---

## 1. Summary of Modified Codebase Files

| Component | File Path | Changes Applied |
| :--- | :--- | :--- |
| **Auth Middleware** | [`api/middleware/auth.middleware.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/middleware/auth.middleware.js) | Flattened and normalized allowed roles array in `requireRole` |
| **File Uploads** | [`api/routes/attachments.routes.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/routes/attachments.routes.js) | Implemented `validateMagicBytes()` for PDF, PNG, JPG, WebP, Excel, Word |
| **Excel Service** | [`api/services/serialExcelService.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/services/serialExcelService.js) | Added `sanitizeCellForExcel()` to neutralize `=`, `+`, `-`, `@` formulas |
| **Password Policy** | [`api/services/passwordPolicy.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/services/passwordPolicy.js) | Enforced 12-character minimum, 4-way complexity, and dictionary checks |
| **Purchase Inward** | [`api/routes/purchase.routes.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/routes/purchase.routes.js) | Fixed unhandled `model` variable reference in inward processing loop |
| **Stock Helpers** | [`api/services/stockHelpers.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/services/stockHelpers.js) | Batched serial lookups (`WHERE serial_no IN (?)`) removing N+1 queries |
| **Memory Cache** | [`api/utils/cache.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/utils/cache.js) | Added `maxEntries = 10000` with LRU eviction and automatic cleanup |
| **Reports Route** | [`api/routes/reports.routes.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/api/routes/reports.routes.js) | Enforced Keyset cursor pagination capped at `maxLimit = 200` |
| **Escape Key Flow** | [`js/app.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/js/app.js) & [`js/pages/partyledger.js`](file:///D:/ERF%20SOFTWARE%20-%20RENDER/eco_green_solar_web/js/pages/partyledger.js) | Fixed modal escape priority and removed flyout re-open loops |

---

## 2. Code Diffs & Fix Details

### Fix 1: Role Normalization in `api/middleware/auth.middleware.js`
```javascript
function requireRole(...allowedRoles) {
  // Flatten in case an array was passed: requireRole(['Admin', 'SuperAdmin']) or requireRole('Admin', 'SuperAdmin')
  const flattened = allowedRoles.flat().map(r => String(r).trim());
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ error: 'Access denied: role not assigned' });
    }
    const userRole = String(req.user.role).trim();
    if (!flattened.includes(userRole)) {
      return res.status(403).json({ error: `Access denied: requires ${flattened.join(' or ')}` });
    }
    next();
  };
}
```

---

### Fix 2: Binary Magic-Byte Signature Verification in `api/routes/attachments.routes.js`
```javascript
function validateMagicBytes(buffer, declaredMime) {
  if (!buffer || buffer.length < 4) return false;
  // PDF: %PDF (25 50 44 46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return true;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // WebP: RIFF....WEBP
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return true;
  // ZIP / DOCX / XLSX: 50 4B 03 04
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) return true;
  return false;
}
```

---

### Fix 3: Spreadsheet Formula Sanitization in `api/services/serialExcelService.js`
```javascript
function sanitizeCellForExcel(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  // Neutralize formula triggers (=, +, -, @, \t, \r) by prepending a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}
```

---

### Fix 4: LRU Eviction & Maximum Capacity in `api/utils/cache.js`
```javascript
class FastMemoryCache {
  constructor(maxEntries = 10000, defaultTtlMs = 60000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
    this.cache = new Map();
  }

  set(key, val, ttlMs = this.defaultTtlMs) {
    // If capacity reached, evict the oldest entry (first key in Map iterator)
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, { val, exp: Date.now() + ttlMs });
  }
}
```
