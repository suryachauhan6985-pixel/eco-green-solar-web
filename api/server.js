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
const compression = require('compression');
const { corsMiddleware } = require('./config/cors');
const { pool } = require('./db/pool');
const { ensureStartupSchema } = require('./db/schema');
const { masterCache } = require('./utils/cache');
const { authenticateToken, issueToken, requireRole, setAuthPool } = require('./middleware/auth.middleware');
const { globalLimiter, mutationLimiter, exportLimiter, loginLimiter, otpLimiter, registerLimiter, forgotPasswordLimiter } = require('./middleware/rateLimiters');
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
const registerBomRoutes = require('./routes/bom.routes');
const registerBomKitsRoutes = require('./routes/bom_kits.routes');
const registerSerialExcelRoutes = require('./routes/serial_excel.routes');
const registerVouchersRoutes = require('./routes/vouchers.routes');

// =====================================================================
// PROCESS SAFETY & CRASH GUARDS
// =====================================================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process Safety] Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process Safety] Uncaught Exception:', err);
});

const app = express();
app.set('trust proxy', 1);

// Disable server fingerprinting
app.disable('x-powered-by');

// 1. High-Performance Gzip / Deflate Compression Middleware
// Compresses JSON API payloads and static assets by 70-80% for instant mobile load times
app.use(compression({
  threshold: 1024, // Only compress responses above 1KB
  level: 6 // Optimal balance between compression ratio and CPU usage
}));

// 2. HTTP Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), geolocation=(), microphone=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  next();
});

app.use(corsMiddleware());

// Rate limiters across API
app.use('/api/', globalLimiter);
app.use('/api/', mutationLimiter);

// Parse JSON payloads (20mb for bulk uploads/serials)
app.use(express.json({ limit: '20mb' }));
app.use(authenticateToken);

// 3. Static Asset Edge & Browser Caching
app.use(express.static(path.join(__dirname, '..'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0,
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest')) {
      // Revalidate HTML, Service Worker, and Manifest immediately so deploys reflect without cache delay
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf|webp)$/i)) {
      // 1-year immutable edge/browser cache for versioned static assets (?v=...)
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

setAuthPool(pool);

const deps = {
  pool,
  route,
  masterCache,
  requireRole,
  issueToken,
  hashPassword,
  verifyPassword,
  OTP_TTL_MINUTES,
  generateOtp,
  sendOtpEmail,
  maskEmail,
  globalLimiter,
  mutationLimiter,
  exportLimiter,
  loginLimiter,
  otpLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  itemNameSlug,
  getItemId,
  validateSalesLineSerials,
  getOrCreateItem,
  getISTParts,
  ledgerTimestamp
};

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
registerBomRoutes(app, deps);
registerBomKitsRoutes(app, deps);
registerSerialExcelRoutes(app, deps);
registerVouchersRoutes(app, deps);

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

