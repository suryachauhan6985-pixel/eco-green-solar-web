require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const ExcelJS = require('exceljs');

// Auto-detect base path: If running directly inside ASUSTOR Linux NAS or on Windows
function getNasBasePath() {
  const linuxPath = '/volume1/work/2023-24/Solar Rooftop/NP - Site Visit, 3D/SUMIT/Solar_ERP_DB/SERAIL NO. (ORD. & CHLN)';
  const altLinuxPath = '/share/work/2023-24/Solar Rooftop/NP - Site Visit, 3D/SUMIT/Solar_ERP_DB/SERAIL NO. (ORD. & CHLN)';
  const winUnc = '\\\\As6302t-989d\\work\\2023-24\\Solar Rooftop\\NP - Site Visit, 3D\\SUMIT\\Solar_ERP_DB\\SERAIL NO. (ORD. & CHLN)';
  
  if (process.platform === 'linux') {
    if (fs.existsSync('/volume1/work')) return linuxPath;
    if (fs.existsSync('/share/work')) return altLinuxPath;
    return linuxPath;
  }
  return process.env.SERIAL_EXCEL_NETWORK_PATH || winUnc;
}

function sanitizeFileName(name) {
  if (!name) return 'Serials';
  return String(name).trim().replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, ' ');
}

function formatScanDate(rawDate) {
  const d = rawDate ? new Date(rawDate) : new Date();
  if (isNaN(d.getTime())) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${day}-${month}-${year}`;
  }
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

async function buildSerialWorkbook(serials) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Eco Green Solar ERP';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Serials', { views: [{ showGridLines: true }] });
  sheet.columns = [{ key: 'sr', width: 12 }, { key: 'serial', width: 32 }];

  const cellA1 = sheet.getCell('A1');
  const cellB1 = sheet.getCell('B1');
  cellA1.value = 'Sr. No.';
  cellB1.value = 'Serial No.';

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } }
  };

  [cellA1, cellB1].forEach((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = thinBorder;
  });
  sheet.getRow(1).height = 22;

  const list = Array.isArray(serials) ? serials : [];
  list.forEach((sn, idx) => {
    const rowNum = idx + 2;
    const row = sheet.getRow(rowNum);
    const cA = sheet.getCell(`A${rowNum}`);
    const cB = sheet.getCell(`B${rowNum}`);
    
    cA.value = idx + 1;
    cA.font = { name: 'Calibri', size: 11 };
    cA.alignment = { vertical: 'middle', horizontal: 'center' };
    cA.border = thinBorder;

    cB.value = String(sn || '').trim();
    cB.font = { name: 'Calibri', size: 11 };
    cB.alignment = { vertical: 'middle', horizontal: 'left' };
    cB.border = thinBorder;
    row.height = 20;
  });

  return workbook;
}

async function saveSerialExcelToNas({ orderNo, shortName, customerName, date, serials }) {
  const serialList = Array.isArray(serials) ? serials.filter(s => s && String(s).trim()) : [];
  if (!serialList.length) return { success: false, reason: 'No serials' };

  const dateFolder = formatScanDate(date);
  const baseDir = getNasBasePath();
  const targetDir = path.join(baseDir, dateFolder);

  const cleanOrder = sanitizeFileName(orderNo || '');
  const cleanShort = sanitizeFileName(shortName || customerName || '');
  const baseName = (cleanOrder && cleanShort && cleanOrder !== cleanShort) ? `${cleanOrder} - ${cleanShort}` : (cleanOrder || cleanShort || `Serials_${Date.now()}`);
  const fileName = `${baseName}.xlsx`;
  const fullFilePath = path.join(targetDir, fileName);

  try {
    const workbook = await buildSerialWorkbook(serialList);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    await workbook.xlsx.writeFile(fullFilePath);
    console.log(`[NAS Standalone] Successfully saved: ${fullFilePath}`);
    return { success: true, savedPath: fullFilePath, fileName, dateFolder };
  } catch (err) {
    console.error(`[NAS Standalone] Write error:`, err.message);
    return { success: false, error: err.message };
  }
}

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
        const res = await saveSerialExcelToNas({
          orderNo: item.order_no,
          customerName: item.customer_name,
          shortName: item.customer_name || item.order_no,
          date: item.scan_date,
          serials: serials
        });
        if (res.success) {
          await p.query('UPDATE nas_serial_sync_queue SET synced_to_nas = 1, synced_at = NOW() WHERE id = ?', [item.id]);
        }
      } else {
        await p.query('UPDATE nas_serial_sync_queue SET synced_to_nas = 1, synced_at = NOW() WHERE id = ?', [item.id]);
      }
    }

    const [dispatches] = await p.query('SELECT * FROM bom_dispatches ORDER BY id DESC LIMIT 20');
    for (const d of dispatches) {
      const header = JSON.parse(d.header_json || '{}');
      const items = JSON.parse(d.items_json || '[]');
      const panelSerials = [];
      items.forEach(it => {
        const itemName = String(it.name || '').trim().toUpperCase();
        const isInverter = itemName.includes('INVERTER') || itemName.includes('DEYE') || itemName.includes('GROWATT') || itemName.includes('POLYCAB') || itemName.includes('SOLIS');
        if (!isInverter && Array.isArray(it.serials)) {
          it.serials.forEach(s => { if (s && String(s).trim()) panelSerials.push(String(s).trim()); });
        }
      });
      if (panelSerials.length) {
        await saveSerialExcelToNas({
          orderNo: d.order_no,
          customerName: header.customerName || header.custName || '',
          shortName: header.customerName || header.custName || d.order_no,
          date: header.challanDate || d.dispatched_at,
          serials: panelSerials
        });
      }
    }
  } catch (err) {
    console.error('[NAS Standalone] Sync error:', err.message);
  }
}

async function main() {
  console.log('[NAS Standalone Sync] 24/7 Background Service Running on NAS...');
  console.log('[NAS Standalone Sync] Target Storage Path:', getNasBasePath());
  await syncCycle();
  setInterval(syncCycle, 4000);
}

main();
