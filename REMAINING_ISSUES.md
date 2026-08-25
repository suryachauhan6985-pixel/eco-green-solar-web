# REMAINING ISSUES & ARCHITECTURAL ROADMAP (`REMAINING_ISSUES.md`)

> **Audit & Verification Status**: 
> - **Backend Audit**: 7 Bugs Identified & Fixed (`BUG-001` to `BUG-007`) — **100% PASS**
> - **Live Browser QA Protocol**: 5 Bugs Identified & Fixed (`BUG-FE-001` to `BUG-FE-005`) — **100% PASS** (309 interactive elements verified across all 18 tabs in real Google Chrome)

This document catalogs non-blocking architectural items, future recommendations, and infrastructure improvements for the Eco Green Solar ERP.

---

## 1. INFRASTRUCTURE & HOSTING RECOMMENDATIONS

### A. Cloud Storage for Attachments (AWS S3 / Cloudflare R2 / Google Cloud Storage)
- **Current State**: Document proof attachments (invoices, challans, photos) are stored in the TiDB database as base64-encoded strings in the `attachments` table.
- **Recommendation**: For scale beyond 10,000 orders with multi-megabyte photos, transition attachment binary storage from DB LONGTEXT to object storage (such as AWS S3 or Cloudflare R2) and store only the secure signed URL in the database.

### B. Persistent Secret Keys on Cloud PaaS (Render / Railway)
- **Current State**: `JWT_SECRET` is configured in `.env`. If deployed to Render without setting `JWT_SECRET` in the Environment Variables dashboard, the server generates a random key on startup, which will invalidate user sessions on cold restarts.
- **Action**: Ensure `JWT_SECRET` and `DB_SSL=true` are set in the Render environment variables tab.

### C. Automated Nightly Database Backup Cron
- **Current State**: Daily automated backup is handled by internal memory checks when the server is continuously active (`checkAutoBackup` in `api/routes/backup.routes.js`).
- **Recommendation**: Configure an external Render Cron Job or GitHub Action to trigger `POST /api/backup/run` nightly to ensure guaranteed execution even across container redeployments.

---

## 2. PENDING FUNCTIONAL ROADMAP (From PROJECT_GOALS.md)

1. **Goal 6: BOM User Activity / Audit Trail Dedicated View**:
   - `audit_logs` table and `logAuditEvent` helper exist and log all `BOM_DISPATCH`, `SALES_DISPATCH`, and `VOUCHER_CREATE` operations.
   - Dedicated UI tab inside the BOM page to visualize audit events by Order No.

2. **Goal 9: Settings Tab for Scansheet Visibility**:
   - `window.CONFIG` in `js/data/config-engine.js` allows dynamic feature toggling (`inventory_tracking`, `feature_bom_enabled`, etc.).
   - A dedicated user-facing Settings page to toggle optional navbar tabs (`#scansheet`, `#stockassign`) per tenant or user role.
