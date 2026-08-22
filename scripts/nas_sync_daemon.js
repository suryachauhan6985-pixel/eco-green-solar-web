require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const { saveSerialExcelToNetwork } = require('../api/services/serialExcelService');

let pool = null;

async function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2' } : undefined,
      waitForConnections: true,
      connectionLimit: 3,
    });
  }
  return pool;
}

async function syncCycle() {
  try {
    const p = await getPool();
    await p.query(
      'CREATE TABLE IF NOT EXISTS nas_serial_sync_queue (' +
      'id INT AUTO_INCREMENT PRIMARY KEY, ' +
      'order_no VARCHAR(100) NOT NULL, ' +
      'customer_name VARCHAR(255) DEFAULT "", ' +
      'scan_date VARCHAR(50) DEFAULT "", ' +
      'serials_json LONGTEXT NOT NULL, ' +
      'synced_to_nas TINYINT(1) DEFAULT 0, ' +
      'synced_at DATETIME NULL, ' +
      'created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
    );

    const [queueRows] = await p.query('SELECT * FROM nas_serial_sync_queue WHERE synced_to_nas = 0 ORDER BY id ASC LIMIT 20');
    for (const item of queueRows) {
      const serials = JSON.parse(item.serials_json || '[]');
      if (serials.length) {
        const res = await saveSerialExcelToNetwork({
          orderNo: item.order_no,
          customerName: item.customer_name,
          shortName: item.customer_name || item.order_no,
          date: item.scan_date,
          serials: serials
        });
        if (res.success) {
          await p.query('UPDATE nas_serial_sync_queue SET synced_to_nas = 1, synced_at = NOW() WHERE id = ?', [item.id]);
          console.log('[NAS Sync Daemon] Synced queue item #' + item.id + ' -> ' + res.savedPath);
        }
      } else {
        await p.query('UPDATE nas_serial_sync_queue SET synced_to_nas = 1, synced_at = NOW() WHERE id = ?', [item.id]);
      }
    }

    const [dispatches] = await p.query('SELECT * FROM bom_dispatches ORDER BY id DESC LIMIT 20');
    for (const d of dispatches) {
      const header = JSON.parse(d.header_json || '{}');
      const items = JSON.parse(d.items_json || '[]');
      const serials = [];
      items.forEach(it => {
        if (Array.isArray(it.serials)) {
          it.serials.forEach(s => { if (s && String(s).trim()) serials.push(String(s).trim()); });
        }
      });
      if (serials.length) {
        await saveSerialExcelToNetwork({
          orderNo: d.order_no,
          customerName: header.customerName || header.custName || '',
          shortName: header.customerName || header.custName || d.order_no,
          date: header.challanDate || d.dispatched_at,
          serials: serials
        });
      }
    }
  } catch (err) {
    console.error('[NAS Sync Daemon] Error:', err.message);
  }
}

async function start() {
  console.log('[NAS Sync Daemon] Started real-time sync service for NAS...');
  await syncCycle();
  setInterval(syncCycle, 4000);
}

start();
