const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

module.exports = function registerBackupRoutes(app, deps) {
  const { pool, route, getISTParts, ledgerTimestamp } = deps;
  const BACKUP_FOLDER_NAME = 'EcoGreenSolar_Backups';
  // Override with env var BACKUP_NAS_PATH if this server runs on a different
  // machine than the desktop app (same idea as NAS_BACKUP_PATH in backup.py).
  const NAS_BACKUP_PATH = process.env.BACKUP_NAS_PATH
    || '\\\\As6302t-989d\\work\\2023-24\\Solar Rooftop\\NP - Site Visit, 3D\\SUMIT\\Solar_ERP_DB';
  const BACKUP_AUTO_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
  const RECENT_BACKUPS_TO_SHOW = 12;
  const TABLES_TO_BACKUP = [
    ['categories', 'Categories'],
    ['subtypes', 'Subtypes'],
    ['items', 'Items'],
    ['warehouses', 'Warehouses'],
    ['units', 'Units'],
    ['stock_ledger', 'Stock_Ledger'],
    ['ledgers', 'Ledgers'],
    ['audit_logs', 'Audit_Logs'],
    ['users', 'Users'],
  ];

  async function ensureBackupLogTable() {
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS backup_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        backup_type VARCHAR(20) DEFAULT 'Auto',
        file_name VARCHAR(500),
        file_path TEXT,
        taken_by VARCHAR(100) DEFAULT '-',
        taken_on VARCHAR(50),
        status VARCHAR(20) DEFAULT 'Success',
        details TEXT
      )`);
    } catch (e) { /* best-effort, same as the desktop app's safety net */ }
  }

  // Tries the NAS folder first; falls back to a local folder next to this
  // server file if the NAS path isn't reachable right now (offline/network
  // issue) — backup never fails just because the NAS is down.
  function resolveBackupDir() {
    try {
      fs.mkdirSync(NAS_BACKUP_PATH, { recursive: true });
      const target = path.join(NAS_BACKUP_PATH, BACKUP_FOLDER_NAME);
      fs.mkdirSync(target, { recursive: true });
      return { dir: target, onNas: true };
    } catch (e) { /* fall through to local */ }
    const localTarget = path.join(__dirname, BACKUP_FOLDER_NAME);
    fs.mkdirSync(localTarget, { recursive: true });
    return { dir: localTarget, onNas: false };
  }

  async function exportAllTablesToExcel(destPath) {
    const workbook = new ExcelJS.Workbook();
    let anySheetWritten = false;
    for (const [tableName, sheetName] of TABLES_TO_BACKUP) {
      let rows;
      try {
        [rows] = await pool.query(`SELECT * FROM ??`, [tableName]);
      } catch (e) {
        continue; // table may not exist in an older DB version — skip, keep the rest
      }
      const sheet = workbook.addWorksheet(sheetName);
      const columns = rows.length ? Object.keys(rows[0]) : [];
      if (columns.length) {
        sheet.addRow(columns);
        rows.forEach((r) => {
          sheet.addRow(columns.map((c) => (tableName === 'users' && c === 'password') ? '********' : r[c]));
        });
      }
      anySheetWritten = true;
    }
    if (!anySheetWritten) {
      const sheet = workbook.addWorksheet('Info');
      sheet.addRow(['Info']);
      sheet.addRow(['No data found to backup.']);
    }
    await workbook.xlsx.writeFile(destPath);
  }

  function backupTimestampStamp() {
    const p = getISTParts(new Date());
    return `${p.year}${p.month}${p.day}_${p.hour}${p.minute}${p.second}`;
  }

  async function runBackup(backupType) {
    const { dir, onNas } = resolveBackupDir();
    const fileName = `EcoGreenSolar_Backup_${backupType}_${backupTimestampStamp()}.xlsx`;
    const destPath = path.join(dir, fileName);

    let success = true;
    let message = 'Backup created successfully.';
    try {
      await exportAllTablesToExcel(destPath);
    } catch (e) {
      success = false;
      message = e.message;
    }

    const status = success ? 'Success' : 'Failed';
    const locationNote = onNas ? 'NAS folder' : 'Local server folder (NAS not reachable)';
    try {
      await pool.query(
        `INSERT INTO backup_log (backup_type, file_name, file_path, taken_by, taken_on, status, details) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [backupType, fileName, destPath, backupType === 'Auto' ? 'System' : 'Manual User', ledgerTimestamp(), status, `${message} | Saved to: ${locationNote}`]
      );
    } catch (e) { /* logging failure shouldn't hide the backup result */ }

    return { success, message, fileName, destPath, onNas };
  }

  // Runs at most once per calendar day — mirrors check_auto_backup(): if
  // today's backup (any status counts as "checked", only 'Success' counts as
  // "done") already happened, skip silently.
  async function checkAutoBackup() {
    try {
      const [rows] = await pool.query(`SELECT taken_on FROM backup_log WHERE status='Success' ORDER BY id DESC LIMIT 1`);
      if (rows.length) {
        const lastDate = String(rows[0].taken_on || '').split(' ')[0];
        const todayDate = ledgerTimestamp().split(' ')[0];
        if (lastDate === todayDate) return;
      }
      await runBackup('Auto');
    } catch (e) { /* best-effort, never crash the server over a missed auto-backup */ }
  }

  app.get('/api/backup/status', route(async (req, res) => {
    const { dir, onNas } = resolveBackupDir();
    const [lastRows] = await pool.query(
      `SELECT backup_type, file_name, taken_on, status FROM backup_log WHERE status='Success' ORDER BY id DESC LIMIT 1`
    );
    const [recentRows] = await pool.query(
      `SELECT backup_type, file_name, taken_on, status, details FROM backup_log ORDER BY id DESC LIMIT ?`,
      [RECENT_BACKUPS_TO_SHOW]
    );
    res.json({
      backupDir: dir,
      onNas,
      lastBackup: lastRows[0] || null,
      recent: recentRows,
    });
  }));

  app.post('/api/backup/run', route(async (req, res) => {
    const result = await runBackup('Manual');
    if (!result.success) return res.status(500).json({ error: result.message });
    res.json({ success: true, fileName: result.fileName, onNas: result.onNas });
  }));

  // Serves a specific backup file straight from disk for download — this is
  // the web equivalent of the desktop app's "Open Backup Folder" (a browser
  // can't open an arbitrary NAS/network folder for security reasons, so
  // downloading the actual file is the practical substitute).
  app.get('/api/backup/download/:fileName', route(async (req, res) => {
    const { fileName } = req.params;
    const [rows] = await pool.query(`SELECT file_path FROM backup_log WHERE file_name=? ORDER BY id DESC LIMIT 1`, [fileName]);
    if (!rows.length) return res.status(404).json({ error: 'Backup record not found.' });
    const filePath = rows[0].file_path;
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup file no longer exists on disk (it may have been moved/deleted on the NAS).' });
    res.download(filePath, fileName);
  }));

  return { ensureBackupLogTable, checkAutoBackup, BACKUP_AUTO_CHECK_INTERVAL_MS };
};
