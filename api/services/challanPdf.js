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
// Row 3:  F3:G3 = "Challan No.:" label (merged) -> value goes in H3  / Q3
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
// NOTE: challanNo previously wrote to G3/P3 (a narrow, unmerged cell). The
// "Challan No.:" label there isn't merged like the Date/Order No./Capacity
// rows are, so once a value is written next to it, Excel/LibreOffice clips
// the label text instead of letting it overflow (this is what produced the
// garbled "Challan I10" / "Challan N10" text). Fixed by merging F3:G3 /
// O3:P3 for the label (mirroring the F4:G4 / O4:P4 pattern) and writing the
// value into the wide H3 / Q3 cell, same as every other header field below it.
const HEADER_CELLS = {
  challanNo:    { customer: 'H3',  company: 'Q3'  },
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

// Paper sizes in points (1" = 72pt), PORTRAIT width x height. ExcelJS stores
// whatever numeric Excel "paperSize" code the template was saved with (9 = A4,
// 1 = Letter, etc). We only need the couple that are realistic for this
// template; anything unrecognised falls back to A4, which is what this
// template uses.
const PAPER_SIZES_PT = {
  1: { width: 612,    height: 792 },   // Letter
  5: { width: 612,    height: 1008 },  // Legal
  9: { width: 595.32, height: 841.89 }, // A4
};

function getPageHeightPt(pageSetup) {
  const paper = PAPER_SIZES_PT[pageSetup.paperSize] || PAPER_SIZES_PT[9];
  const isLandscape = (pageSetup.orientation || 'landscape') === 'landscape';
  return isLandscape ? paper.width : paper.height;
}

// The template's row heights were authored without regard to how much
// vertical space is actually available at print time — at the "fit to 1
// page wide" scale, the 13-line item table + header only fills part of the
// page, leaving a big blank band under row 38 (see screenshot from user).
// Rather than leaving a gap OR letting one single row balloon, scale EVERY
// row in the print range by the same factor so the whole table grows (or
// shrinks) evenly and lands exactly at the bottom margin — same logic as
// "distribute rows evenly", just computed once instead of dragged by hand.
function stretchRowsToFillPage(sheet, firstRow, lastRow) {
  const pageHeightPt = getPageHeightPt(sheet.pageSetup);
  const m = sheet.pageSetup.margins || {};
  const marginsPt = ((m.top || 0) + (m.bottom || 0) + (m.header || 0) + (m.footer || 0)) * 72;
  const availableHeightPt = pageHeightPt - marginsPt;

  const defaultRowHeight = sheet.properties.defaultRowHeight || 15;
  let currentTotalPt = 0;
  for (let r = firstRow; r <= lastRow; r++) {
    currentTotalPt += sheet.getRow(r).height || defaultRowHeight;
  }
  if (currentTotalPt <= 0) return;

  // Guard against a corrupt/unexpected template blowing rows up or down to
  // something silly — only ever grow/shrink within a sane range.
  let scale = availableHeightPt / currentTotalPt;
  scale = Math.min(Math.max(scale, 0.5), 4);

  for (let r = firstRow; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    row.height = (row.height || defaultRowHeight) * scale;
  }
}

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

    // Merge Challan No. label cells (F3:G3 / O3:P3) so the label has room to
    // display in full, matching how Challan Date/Order No./Capacity are laid
    // out just below it — see note above HEADER_CELLS.
    sheet.mergeCells('F3:G3');
    sheet.mergeCells('O3:P3');

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

    // The template's original margins were wildly uneven — left 0.19",
    // right 0", top 0", bottom 0", PLUS a 0.51" header/footer reserve that
    // was never actually used for a header/footer. Set equal small margins
    // on all 4 sides and drop the unused header/footer reserve.
    sheet.pageSetup.margins = {
      left: 0.2, right: 0.2, top: 0.2, bottom: 0.2, header: 0, footer: 0,
    };

    // Previously this only forced "fit to 1 page wide" (fitToHeight left
    // unconstrained), which is what caused the big blank band under row 38
    // in the printed PDF — the table simply didn't have enough row-height to
    // reach the bottom margin at that width-driven scale. Fix: stretch every
    // row in the print area (2-38) by the SAME factor first, so the table's
    // real height already matches the printable area — no single row grows
    // more than another, they all grow together. With that done, fit-to-1-
    // page (both width AND height) below just becomes a safety net for
    // font/OS rendering differences, not the thing doing the resizing.
    stretchRowsToFillPage(sheet, 2, 38);

    sheet.pageSetup.fitToPage = true;
    sheet.pageSetup.fitToWidth = 1;
    sheet.pageSetup.fitToHeight = 1;
    sheet.pageSetup.scale = undefined;
    sheet.pageSetup.horizontalCentered = true;
    sheet.pageSetup.verticalCentered = false;

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