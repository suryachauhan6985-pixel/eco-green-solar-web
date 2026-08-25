# ⚠️ REMAINING RISKS & INFRASTRUCTURE RECOMMENDATIONS

**Document Version:** 1.0  
**Audit Completion Date:** August 2026

---

## 1. Code-Level vs Infrastructure-Level Distinction

All code-level vulnerabilities, bottlenecks, and race conditions within the application layer have been resolved. The following items require infrastructure-level management:

---

## 2. Infrastructure & Deployment Recommendations

### 2.1 JWT Secret Persistence on Render
- **Risk:** If `JWT_SECRET` is not set in the cloud provider's environment variables (e.g., Render Dashboard), a transient random key is generated on server startup. Every server redeploy or cold restart will invalidate active client JWT tokens, requiring users to log in again.
- **Action:** Set a permanent, cryptographically random `JWT_SECRET` (at least 64 characters) in the Render Dashboard environment settings.

### 2.2 Database Automated Snapshots & Backups
- **Risk:** Hardware failures or accidental physical database corruption require disaster recovery capability.
- **Action:** Enable automated daily snapshots and point-in-time recovery (PITR) in your managed MariaDB/MySQL provider (e.g. Aiven, AWS RDS, DigitalOcean).

### 2.3 Network Attached Storage (NAS) Availability
- **Risk:** Saving serial Excel workbooks to local network SMB shares (`Z:\...` or `\\As6302t-989d\...`) depends on local network connectivity.
- **Mitigation:** The system now queues records in `nas_serial_sync_queue` in the database and falls back to in-memory buffer downloads if the SMB network path is temporarily unreachable.

### 2.4 SSL / TLS Termination
- **Action:** Ensure production traffic is routed exclusively over HTTPS (enforced via HSTS header in `api/server.js`).
