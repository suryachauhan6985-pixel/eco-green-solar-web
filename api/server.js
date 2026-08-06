// Loads .env for LOCAL development only. On Render this is a harmless
// no-op: there is no .env file in the deployed environment, and dotenv
// never overrides a variable that's already set in process.env — so
// Render's dashboard-configured env vars always win in production.
// Must be the very first thing that runs, before any of the requires
// below (cors.js, db/pool.js, middleware/auth.js, routes/backup.js all
// read process.env the moment they're required).
require('dotenv').config();

// Eco Green Solar ERP - Web Backend API

const express = require('express');
const path = require('path');
const { corsMiddleware } = require('./config/cors');
const { pool } = require('./db/pool');
const { ensureStartupSchema } = require('./db/schema');
const { authenticateToken, issueToken, requireRole } = require('./middleware/auth.middleware');
const { loginLimiter, otpLimiter, registerLimiter, forgotPasswordLimiter } = require('./middleware/rateLimiters');
const { hashPassword, verifyPassword } = require('./services/passwords');
const { OTP_TTL_MINUTES, generateOtp, sendOtpEmail, maskEmail } = require('./services/email');
const { itemNameSlug, getItemId, validateSalesLineSerials, getOrCreateItem } = require('./services/stockHelpers');
const { route } = require('./utils/route');
const { getISTParts, ledgerTimestamp } = require('./utils/time');
const registerAttachmentRoutes = require('./routes/attachments.routes');
const registerHealthRoutes = require('./routes/health');
const registerAuthRoutes = require('./routes/auth.routes');
const registerMastersRoutes = require('./routes/masters.routes');
const registerPurchaseRoutes = require('./routes/purchase.routes');
const registerLedgersRoutes = require('./routes/ledgers.routes');
const registerSalesRoutes = require('./routes/sales.routes');
const registerStockassignRoutes = require('./routes/stockassign.routes');
const registerScanSheetRoutes = require('./routes/scansheet.routes');
const registerReportsRoutes = require('./routes/reports.routes');
const registerBackupRoutes = require('./routes/backup.routes');
const registerChallanRoutes = require('./routes/challan.routes');

const app = express();
app.set('trust proxy', 1);
app.use(corsMiddleware());
app.use(express.json({ limit: '20mb' }));
app.use(authenticateToken);
app.use(express.static(path.join(__dirname, '..')));

const deps = { pool, route, requireRole, issueToken, hashPassword, verifyPassword, OTP_TTL_MINUTES, generateOtp, sendOtpEmail, maskEmail, loginLimiter, otpLimiter, registerLimiter, forgotPasswordLimiter, itemNameSlug, getItemId, validateSalesLineSerials, getOrCreateItem, getISTParts, ledgerTimestamp };

registerAttachmentRoutes(app, deps);
registerHealthRoutes(app, deps);
registerAuthRoutes(app, deps);
registerMastersRoutes(app, deps);
registerPurchaseRoutes(app, deps);
registerLedgersRoutes(app, deps);
registerSalesRoutes(app, deps);
registerStockassignRoutes(app, deps);
registerScanSheetRoutes(app, deps);
registerReportsRoutes(app, deps);
const backupTasks = registerBackupRoutes(app, deps);
registerChallanRoutes(app, deps);

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API running on port ${PORT}`);
  ensureStartupSchema(pool).then(() => {
    backupTasks.ensureBackupLogTable().then(() => {
      setTimeout(backupTasks.checkAutoBackup, 4000);
      setInterval(backupTasks.checkAutoBackup, backupTasks.BACKUP_AUTO_CHECK_INTERVAL_MS);
    });
  });
});
