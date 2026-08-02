// api/services/challanPdf.js
// -----------------------------------------------------------------------------
// Fills the real Excel Challan template (api/templates/challan_template.xlsx)
// with a saved bom_challans DB record, then converts the filled copy to PDF
// via LibreOffice headless. The ORIGINAL template is only ever read + copied
// — never opened in write mode. Every temp file this creates is deleted by
// the caller via the returned cleanup() (see api/routes/challan.js).
//
// Cell map below was read directly from the real workbook
// (Sample_File_for_Residential_challan.xlsx, sheet "Challan") — NOT guessed.
// The sheet has two mirrored copies side by side: "Customer Copy"
// (columns A-H) and "Company Copy" (columns J-P). Both get the same data.
// -----------------------------------------------------------------------------
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const ExcelJS = require('exceljs'); // already a project dependency (see api/routes/backup.js)

const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'challan_template.xlsx');

// One header field -> { customer cell, company cell }
const HEADER_CELLS = {
  challanNo:    { customer: 'G2',  company: 'O2' },
  challanDate:  { customer: 'G3',  company: 'O3' },
  orderNo:      { customer: 'G4',  company: 'O4' },
  capacityKw:   { customer: 'G5',  company: 'O5' },
  customerName: { customer: 'B6',  company: 'K6' },
  city:         { customer: 'G6',  company: 'O6' },
  vehicleNo:    { customer: 'C36', company: 'L36' },
};

// Qty / Description columns per copy — combined with each row below.
const QTY_COL = { customer: 'E', company: 'N' };
const DESC_COL = { customer: 'G', company: 'P' };

// BOM_CHALLAN_TEMPLATE's fixed 13-line layout mapped to its exact sheet row.
// `descKey` matches how js/pages/bom.js's bomCollectChallanTemplateValues()
// keys description (always "${sr}|", regardless of size) — only the FIRST
// row of a multi-size item (GI Pipe) carries the description write.
const ITEM_ROWS = [
  { sr: 1, size: '', row: 8, firstOfItem: true },
  { sr: 2, size: '', row: 9, firstOfItem: true },
  { sr: 3, size: '20 Feet', row: 10, firstOfItem: true },
  { sr: 3, size: '15 Feet', row: 11, firstOfItem: false },
  { sr: 3, size: '10 Feet', row: 12, firstOfItem: false },
  { sr: 3, size: '5 Feet',  row: 13, firstOfItem: false },
  { sr: 4, size: '20 Feet', row: 14, firstOfItem: true },
  { sr: 4, size: '15 Feet', row: 15, firstOfItem: false },
  { sr: 4, size: '10 Feet', row: 16, firstOfItem: false },
  { sr: 4, size: '5 Feet',  row: 17, firstOfItem: false },
  { sr: 5, size: '', row: 18, firstOfItem: true },
  { sr: 6, size: '', row: 19, firstOfItem: true },
  { sr: 7, size: '', row: 20, firstOfItem: true },
  { sr: 8, size: '', row: 21, firstOfItem: true },
  { sr: 9, size: '', row: 22, firstOfItem: true },
  { sr: 10, size: '', row: 23, firstOfItem: true },
  { sr: 11, size: '', row: 24, firstOfItem: true },
  { sr: 12, size: '', row: 25, firstOfItem: true },
  { sr: 13, size: '', row: 26, firstOfItem: true },
];

function runSoffice(xlsxPath, outDir) {
  return new Promise((resolve, reject) => {
    const bin = process.env.SOFFICE_PATH || 'soffice';
    execFile(
      bin,
      ['--headless', '--norestore', '--convert-to', 'pdf', '--outdir', outDir, xlsxPath],
      { timeout: 60000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error(`LibreOffice conversion failed: ${stderr || err.message}`));
        resolve();
      }
    );
  });
}

async function fillTemplateAndConvertToPdf(record) {
  const workDir = path.join(os.tmpdir(), `challan_${crypto.randomUUID()}`);
  await fsp.mkdir(workDir, { recursive: true });
  const tempXlsx = path.join(workDir, 'challan.xlsx');
  const tempPdf = path.join(workDir, 'challan.pdf');

  const cleanup = async () => {
    try { await fsp.rm(workDir, { recursive: true, force: true }); } catch (e) { /* best-effort */ }
  };

  try {
    // 1) Copy the ORIGINAL template — never write to TEMPLATE_PATH itself.
    await fsp.copyFile(TEMPLATE_PATH, tempXlsx);

    // 2) Fill cells with ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(tempXlsx);
    const sheet = workbook.worksheets[0];

    const headerValues = {
      challanNo: record.challan_no || '',
      challanDate: record.challan_date || '',
      orderNo: record.order_no || '',
      capacityKw: record.capacity_kw || '',
      customerName: record.customer_name || '',
      city: record.city || '',
      vehicleNo: record.vehicle_no || '',
    };
    for (const [field, cells] of Object.entries(HEADER_CELLS)) {
      const value = headerValues[field];
      sheet.getCell(cells.customer).value = value;
      sheet.getCell(cells.company).value = value;
    }

    const items = record.items || {}; // { "sr|size": { qty, desc } }
    for (const spec of ITEM_ROWS) {
      const qtyKey = `${spec.sr}|${spec.size}`;
      const descKey = `${spec.sr}|`;
      const qty = (items[qtyKey] && items[qtyKey].qty) || '';
      sheet.getCell(`${QTY_COL.customer}${spec.row}`).value = qty;
      sheet.getCell(`${QTY_COL.company}${spec.row}`).value = qty;
      if (spec.firstOfItem) {
        const desc = (items[descKey] && items[descKey].desc) || '';
        if (desc) {
          sheet.getCell(`${DESC_COL.customer}${spec.row}`).value = desc;
          sheet.getCell(`${DESC_COL.company}${spec.row}`).value = desc;
        }
      }
    }

    await workbook.xlsx.writeFile(tempXlsx);

    // 3) Convert to PDF via LibreOffice headless
    await runSoffice(tempXlsx, workDir);
    const pdfBuffer = await fsp.readFile(tempPdf);

    return { pdfBuffer, cleanup };
  } catch (err) {
    await cleanup();
    throw err;
  }
}

module.exports = { fillTemplateAndConvertToPdf };
