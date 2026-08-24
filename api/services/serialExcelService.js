const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const CANDIDATE_NETWORK_PATHS = [
  process.env.SERIAL_EXCEL_NETWORK_PATH,
  'Z:\\2023-24\\Solar Rooftop\\NP - Site Visit, 3D\\SUMIT\\Solar_ERP_DB\\SERAIL NO. (ORD. & CHLN)',
  '\\\\As6302t-989d\\work\\2023-24\\Solar Rooftop\\NP - Site Visit, 3D\\SUMIT\\Solar_ERP_DB\\SERAIL NO. (ORD. & CHLN)',
  'D:\\2023-24\\Solar Rooftop\\NP - Site Visit, 3D\\SUMIT\\Solar_ERP_DB\\SERAIL NO. (ORD. & CHLN)'
].filter(Boolean);

function getNetworkBasePath() {
  for (const p of CANDIDATE_NETWORK_PATHS) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (e) { /* ignore and try next */ }
  }
  return CANDIDATE_NETWORK_PATHS[0] || CANDIDATE_NETWORK_PATHS[1];
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

/**
 * Generates an Excel workbook for scanned serial numbers.
 * Columns: A1 = 'Sr. No.', B1 = 'Serial No.'
 * Clean standard Excel formatting without background colors.
 * @param {Array<string>} serials
 * @returns {Promise<ExcelJS.Workbook>}
 */
async function buildSerialWorkbook(serials) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Eco Green Solar ERP';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Serials', {
    views: [{ showGridLines: true }]
  });

  sheet.columns = [
    { key: 'sr', width: 12 },
    { key: 'serial', width: 32 }
  ];

  // Header row (Row 1): Clean, bold, NO background color
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

/**
 * Saves serials Excel to the network path organized by date folder and Order/Short Name.
 * @param {Object} params
 * @param {string} params.orderNo
 * @param {string} [params.shortName]
 * @param {string} [params.customerName]
 * @param {string} [params.date]
 * @param {Array<string>} params.serials
 */
async function saveSerialExcelToNetwork(params) {
  const { orderNo, shortName, customerName, date, serials } = params || {};
  const serialList = Array.isArray(serials) ? serials.filter((s) => s && String(s).trim()) : [];
  
  if (!serialList.length) {
    return { success: false, reason: 'No serial numbers to save' };
  }

  const dateFolder = formatScanDate(date);
  const baseDir = getNetworkBasePath();
  const targetDir = path.join(baseDir, dateFolder);

  const cleanOrder = sanitizeFileName(orderNo || '');
  const cleanShort = sanitizeFileName(shortName || customerName || '');
  
  let baseName = '';
  if (cleanOrder && cleanShort && cleanOrder !== cleanShort) {
    baseName = `${cleanOrder} - ${cleanShort}`;
  } else if (cleanOrder) {
    baseName = cleanOrder;
  } else if (cleanShort) {
    baseName = cleanShort;
  } else {
    baseName = `Serials_${Date.now()}`;
  }

  const fileName = `${baseName}.xlsx`;
  const fullFilePath = path.join(targetDir, fileName);

  try {
    const workbook = await buildSerialWorkbook(serialList);

    // Ensure target folder exists
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      await workbook.xlsx.writeFile(fullFilePath);
      console.log(`[SerialExcel] Saved successfully to: ${fullFilePath}`);
      return {
        success: true,
        savedPath: fullFilePath,
        fileName,
        dateFolder,
        serialCount: serialList.length
      };
    } catch (fsErr) {
      console.warn(`[SerialExcel] Network write note (${fsErr.code || fsErr.message}). Generating in-memory buffer.`);
      const buffer = await workbook.xlsx.writeBuffer();
      return {
        success: false,
        savedPath: null,
        networkError: fsErr.message,
        fileName,
        dateFolder,
        serialCount: serialList.length,
        buffer: buffer.toString('base64')
      };
    }
  } catch (err) {
    console.error(`[SerialExcel] Error building workbook:`, err);
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  getNetworkBasePath,
  buildSerialWorkbook,
  saveSerialExcelToNetwork,
  formatScanDate,
  sanitizeFileName
};
