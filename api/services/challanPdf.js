// api/services/challanPdf.js
// -----------------------------------------------------------------------------
// Fills the real Excel Challan template (api/templates/challan_template.xlsx)
// with a saved bom_challans DB record, then converts the filled copy to PDF
// via LibreOffice headless. The ORIGINAL template is only ever read + copied
// — never opened in write mode. Every temp file this creates is deleted by
// the caller via the returned cleanup() (see api/routes/challan.js).
//
// Cell map below was verified by directly opening the REAL template file
// (api/templates/challan_template.xlsx) with openpyxl and inspecting every
// merged-cell range and existing label/value on the "Challan" sheet — not
// copied from a different sample file. Confirmed by test-filling + rendering
// to PDF (single page, all fields land correctly, no titles get overwritten).
//
// Sheet layout (single sheet "Challan", used range B2:Q38):
//   Customer Copy: columns B-H   |   Company Copy: columns K-Q
//
// Row 2:  F2:H2 = "Customer Copy" title (merged) | O2:Q2 = "Company Copy" title (merged)
//         *** NEVER write to these — they hold the title text, not data ***
// Row 3:  F3 = "Challan No.:" label            -> value goes in G3  / P3
// Row 4:  F4:G4 = "Challan Date:" label         -> value goes in H4  / Q4
// Row 5:  F5:G5 = "Order No.:" label            -> value goes in H5  / Q5
// Row 6:  F6:G6 = "Capacity :" label            -> value goes in H6  / Q6
// Row 7:  B7 = "Name:" label, C7:E7 = value box -> value goes in C7  / L7
//         F7:G7 = "City:" label                 -> value goes in H7  / Q7
// Row 8:  column headers (Sr.No / Item Name / Model / Qty. / Description)
// Rows 9-27: the fixed 13-line item table (item name/model/size/unit are
//         ALL STATIC in the template — only Qty and Description are blank):
//           Qty column   = F (customer) / O (company)  [G/P hold static units]
//           Desc column  = H (customer) / Q (company)  [these are single, unmerged]
// Row 37: D37:G37 = Vehicle No. value box (merged)     -> M37:P37 (company)
// Row 38: D38 = "Vehicle No." caption (static, under the box above)
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
  challanNo:    { customer: 'G3',  company: 'P3'  },
  challanDate:  { customer: 'H4',  company: 'Q4'  },
  orderNo:      { customer: 'H5',  company: 'Q5'  },
  capacityKw:   { customer: 'H6',  company: 'Q6'  },
  customerName: { customer: 'C7',  company: 'L7'  },
  city:         { customer: 'H7',  company: 'Q7'  },
  vehicleNo:    { customer: 'D37', company: 'M37' },
};

// Qty / Description columns per copy — combined with each row below.
const QTY_COL = { customer: 'F', company: 'O' };
const DESC_COL = { customer: 'H', company: 'Q' };

// BOM_CHALLAN_TEMPLATE's fixed 13-line layout mapped to its exact sheet row
// (verified against the real template: item names/models/sizes/units below
// are already static text in the sheet — only qty + description are blank).
// `descKey` matches how js/pages/bom.js's bomCollectChallanTemplateValues()
// keys description (always "${sr}|", regardless of size) — only the FIRST
// row of a multi-size item (GI Pipe) carries the description write.
const ITEM_ROWS = [
  { sr: 1, size: '', row: 9,  firstOfItem: true  },  // Solar Panel
  { sr: 2, size: '', row: 10, firstOfItem: true  },  // GI Structure
  { sr: 3, size: '20 Feet', row: 11, firstOfItem: true  }, // GI Pipe 1.5 X 1.5
  { sr: 3, size: '15 Feet', row: 12, firstOfItem: false },
  { sr: 3, size: '10 Feet', row: 13, firstOfItem: false },
  { sr: 3, size: '5 Feet',  row: 14, firstOfItem: false },
  { sr: 4, size: '20 Feet', row: 15, firstOfItem: true  }, // GI Pipe 2.5 X 1.5
  { sr: 4, size: '15 Feet', row: 16, firstOfItem: false },
  { sr: 4, size: '10 Feet', row: 17, firstOfItem: false },
  { sr: 4, size: '5 Feet',  row: 18, firstOfItem: false },
  { sr: 5,  size: '', row: 19, firstOfItem: true }, // Bom Box
  { sr: 6,  size: '', row: 20, firstOfItem: true }, // Inverter
  { sr: 7,  size: '', row: 21, firstOfItem: true }, // Earthing & LA Kit
  { sr: 8,  size: '', row: 22, firstOfItem: true }, // Earthing Bag
  { sr: 9,  size: '', row: 23, firstOfItem: true }, // PVC Pipe
  { sr: 10, size: '', row: 24, firstOfItem: true }, // Ferma
  { sr: 11, size: '', row: 25, firstOfItem: true }, // Reti Bag
  { sr: 12, size: '', row: 26, firstOfItem: true }, // Kapchi Bag
  { sr: 13, size: '', row: 27, firstOfItem: true }, // Cement Bag
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

    // The template's own page setup uses a fixed 92% "scale" (not "fit to
    // page"). That magic number was tuned on whatever machine/font-set the
    // template was authored on — on a different OS/LibreOffice/font combo
    // (e.g. Windows vs Linux) text metrics differ slightly and the sheet can
    // spill onto a second page (this is exactly what caused the Company Copy
    // to get cut in half across pages). Force an explicit "fit to 1 page
    // wide x 1 page tall" instead, which is robust regardless of fonts/OS.
    sheet.pageSetup.fitToPage = true;
    sheet.pageSetup.fitToWidth = 1;
    sheet.pageSetup.fitToHeight = 1;
    sheet.pageSetup.scale = undefined;

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
