const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const DEFAULT_NETWORK_BASE_PATH = '\\\\As6302t-989d\\work\\2023-24\\Solar Rooftop\\NP - Site Visit, 3D\\SUMIT\\Solar_ERP_DB\\SERAIL NO. (ORD. & CHLN)';

function getNetworkBasePath() {
  return process.env.SERIAL_EXCEL_NETWORK_PATH || DEFAULT_NETWORK_BASE_PATH;
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
    { header: 'Sr. No.', key: 'sr', width: 12 },
    { header: 'Serial No.', key: 'serial', width: 32 }
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  const list = Array.isArray(serials) ? serials : [];
  list.forEach((sn, idx) => {
    const row = sheet.addRow({
      sr: idx + 1,
      serial: String(sn || '').trim()
    });
    row.font = { name: 'Calibri', size: 11 };
    row.alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell('sr').alignment = { vertical: 'middle', horizontal: 'center' };
    row.height = 20;
  });

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      };
    });
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
      console.warn(`[SerialExcel] Network share write notice (${fsErr.code || fsErr.message}). Generating in-memory buffer.`);
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
