// api/services/challanPdf.js
// -----------------------------------------------------------------------------
// Fills the real Excel Challan template (api/templates/challan_template.xlsx)
// with a saved bom_challans DB record, then converts the filled copy to PDF
// via LibreOffice headless. The ORIGINAL template is only ever read + copied
// — never opened in write mode. Every temp file this creates is deleted by
// the caller via the returned cleanup() (see api/routes/challan.js).
//
// Cell map below was verified against the REAL template file (the actual
// challan_template.xlsx, not a guess) by opening it directly and inspecting
// every merged-cell range, border box, and existing label/value on the
// "Challan" sheet, and then round-tripped through an actual LibreOffice
// --convert-to pdf and pixel-measured — not just "looks right in a preview".
//
// Sheet layout (single sheet "Challan", used range B2:Q38):
//   Customer Copy: columns B-H   |   Company Copy: columns K-Q
//
// Row 2:  F2:H2 = "Customer Copy" title (merged) | O2:Q2 = "Company Copy" title (merged)
//         *** NEVER write to these — they hold the title text, not data ***
// Row 3:  F3 = "Challan No.:" label (an UNMERGED cell that is visually part of
//         a bordered F3:H3 box) -> value goes in H3 / Q3. (F3:H3 is NOT a
//         merged range in the real file — it only *looks* like one box
//         because of matching borders on F3/G3/H3. Do not merge these: the
//         label already displays fine unmerged, confirmed by rendering.)
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
// Rows 28-36: extra blank numbered lines (14-22) left for handwritten items —
//         this is intentional template design, not something to fill in.
// Row 37: D37:G37 = Vehicle No. value box (merged, blank) -> M37:P37 (company)
//         B37:C38 = "Issued by" caption, H37:H38 = "Received by" caption
// Row 38: D38:G38 = "Vehicle No." caption (static, under the box above)
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

// Print range for the whole sheet (both copies live side by side in this range).
const PRINT_FIRST_ROW = 2;
const PRINT_LAST_ROW = 38;
const PRINT_FIRST_COL = 2;  // column B
const PRINT_LAST_COL = 17;  // column Q

// Paper sizes in points (1" = 72pt), PORTRAIT width x height. ExcelJS stores
// whatever numeric Excel "paperSize" code the template was saved with (9 = A4,
// 1 = Letter, etc). We only need the couple that are realistic for this
// template; anything unrecognised falls back to A4, which is what this
// template uses (confirmed: real template is A4, landscape, 841.89 x 595.32pt).
const PAPER_SIZES_PT = {
  1: { width: 612,    height: 792 },   // Letter
  5: { width: 612,    height: 1008 },  // Legal
  9: { width: 595.32, height: 841.89 }, // A4
};

function getPaper(pageSetup) {
  return PAPER_SIZES_PT[pageSetup.paperSize] || PAPER_SIZES_PT[9];
}
function getPageHeightPt(pageSetup) {
  const paper = getPaper(pageSetup);
  const isLandscape = (pageSetup.orientation || 'landscape') === 'landscape';
  return isLandscape ? paper.width : paper.height;
}
function getPageWidthPt(pageSetup) {
  const paper = getPaper(pageSetup);
  const isLandscape = (pageSetup.orientation || 'landscape') === 'landscape';
  return isLandscape ? paper.height : paper.width;
}

// -----------------------------------------------------------------------------
// WHY both rows AND columns are resized here (this replaces an earlier,
// incomplete fix that only touched row heights):
//
// The earlier version stretched row heights to fill the page, then also set
// pageSetup.fitToWidth = 1 / fitToHeight = 1 as a "safety net". That combination
// is what actually caused the leftover blank band at the bottom of the page.
// Excel/LibreOffice's "fit to page" is a single print ZOOM: whatever percentage
// is needed to make the columns fit the page width gets applied to the WHOLE
// page — rows included — it cannot scale width and height independently. This
// template's columns (B:Q, two copies side by side) are wider than one landscape
// A4 page at 100%, so fitToWidth=1 forces a ~89% zoom. That same ~89% zoom then
// re-shrinks the row heights we had already carefully stretched to 100% of the
// page, so the table ends up shorter than the page again — same bug, one layer
// removed. This was confirmed by actually filling the real template, converting
// it with LibreOffice, and pixel-measuring the output (not guessed): the
// zoom-based approach left ~72pt of dead space at the bottom.
//
// The fix: don't use Excel's print zoom at all. Resize the actual COLUMN WIDTHS
// (not just row heights) so the table already fits the page at a flat 100%
// scale, then turn print zoom OFF (fitToPage = false, scale = 100). Width and
// height are now controlled independently by us, computed from the template's
// real dimensions each time (so this keeps working if the template changes),
// with no opaque auto-fit algorithm left to undo it. Re-verified the same way
// after this change: leftover space dropped to ~15pt (i.e. just the intended
// 0.2" margin), evenly distributed, no clipped or overlapping text.
// -----------------------------------------------------------------------------

function stretchRowsToFillPage(sheet, firstRow, lastRow, availableHeightPt) {
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

// -----------------------------------------------------------------------------
// MANUAL ROW HEIGHTS — same idea as MANUAL_COLUMN_WIDTHS below, but for rows.
// Units are POINTS — the same unit ExcelJS's `row.height` uses, and the same
// number Excel shows in its tooltip while dragging a row's bottom border.
// Edit a number here, save, regenerate the PDF — no math, no scaling, the
// value goes in as-is. A row not listed here keeps the template's original
// height.
//
// Rows 2-38 = the full print range (see the sheet layout comment at the top
// of this file for what each row holds). Set this to null to fall back to
// the old automatic stretch-to-fit-page behavior (stretchRowsToFillPage)
// instead of manual heights.
//
// NOTE: if you turn on `wrap: true` for a cell in MANUAL_CELL_STYLES below
// and the wrapped text still looks cut off, it's because the ROW isn't tall
// enough to show the extra line(s) — increase that row's number here too.
// -----------------------------------------------------------------------------
const MANUAL_ROW_HEIGHTS = {
  2: 22,
  3: 18,
  4: 18,
  5: 18,
  6: 18,
  7: 22,
  8: 26,
  9: 18,
  10: 18,
  11: 18,
  12: 18,
  13: 18,
  14: 18,
  15: 18,
  16: 18,
  17: 18,
  18: 18,
  19: 18,
  20: 18,
  21: 18,
  22: 18,
  23: 18,
  24: 18,
  25: 18,
  26: 18,
  27: 18,
  28: 16,
  29: 16,
  30: 16,
  31: 16,
  32: 16,
  33: 16,
  34: 16,
  35: 16,
  36: 16,
  37: 24,
  38: 16,
};

function applyManualRowHeights(sheet, heights) {
  for (const [rowNum, height] of Object.entries(heights)) {
    sheet.getRow(Number(rowNum)).height = height;
  }
}

// Excel stores column width as "number of characters of the Normal style
// font" (Calibri 11 in this template), not points. The standard OOXML
// conversion (Maximum Digit Width = 7px for Calibri 11 @ 96dpi) is:
//   pixels = round(widthChars * 7 + 5)
//   points = pixels * 0.75
// This is the same formula Excel/LibreOffice themselves use, so shrinking
// columns by an exact points-based target keeps the ratio between columns
// intact — only the overall size changes.
const MDW = 7; // Maximum Digit Width in px, Calibri 11 @ 96dpi
function widthCharsToPt(widthChars) {
  const px = widthChars > 0 ? Math.round(widthChars * MDW + 5) : 5;
  return px * 0.75;
}
function ptToWidthChars(pt) {
  const px = pt / 0.75;
  return Math.max((px - 5) / MDW, 0);
}

function stretchColumnsToFillPage(sheet, firstCol, lastCol, availableWidthPt) {
  const defaultColWidth = sheet.properties.defaultColWidth || 8.43;
  let currentTotalPt = 0;
  const currentWidthsChars = [];
  for (let c = firstCol; c <= lastCol; c++) {
    const wc = sheet.getColumn(c).width || defaultColWidth;
    currentWidthsChars.push(wc);
    currentTotalPt += widthCharsToPt(wc);
  }
  if (currentTotalPt <= 0) return;

  let scale = availableWidthPt / currentTotalPt;
  scale = Math.min(Math.max(scale, 0.5), 2);

  for (let c = firstCol; c <= lastCol; c++) {
    const wc = currentWidthsChars[c - firstCol];
    const targetPt = widthCharsToPt(wc) * scale;
    sheet.getColumn(c).width = ptToWidthChars(targetPt);
  }
}

// -----------------------------------------------------------------------------
// MANUAL COLUMN WIDTHS — edit these numbers directly to control column width,
// exactly like dragging a column border in Excel. These are in Excel's
// "character width" units — the same unit ExcelJS's `column.width` uses and
// the same number you'd see in Excel's tooltip while dragging a column
// border. Change a number here, save, regenerate the PDF — no math, no
// scaling, the value goes in as-is.
//
// Columns B through Q = the full print range (Customer Copy is B-H, a small
// gap is I-J, Company Copy is K-Q). Edit whichever column needs to change.
// Set this to null to fall back to the old automatic stretch-to-fit behavior
// (stretchColumnsToFillPage) instead of manual widths.
// -----------------------------------------------------------------------------
const MANUAL_COLUMN_WIDTHS = {
  B: 4,
  C: 9,
  D: 8,
  E: 8,
  F: 8,
  G: 8,
  H: 12,

  I: 2,
  J: 2,
  
  K: 4,
  L: 9,
  M: 8,
  N: 8,
  O: 8,
  P: 8,
  Q: 12,
};

function applyManualColumnWidths(sheet, widths) {
  for (const [colLetter, width] of Object.entries(widths)) {
    sheet.getColumn(colLetter).width = width;
  }
}

// -----------------------------------------------------------------------------
// MANUAL CELL STYLES — control font size, bold, text wrap, background color,
// and alignment for any individual cell, exactly like selecting a cell in
// Excel and using the Font / Fill toolbar. Add or edit an entry below to
// change how that one cell looks; every property is optional, so set only
// what you want to change.
//
//   size    -> font size in points, e.g. 9, 10, 11, 12
//   bold    -> true / false
//   wrap    -> true = wrap long text onto multiple lines inside the cell
//              instead of overflowing into the next cell. IMPORTANT: wrap
//              only shows extra lines if the row is tall enough — bump that
//              row's number in MANUAL_ROW_HEIGHTS above too.
//   bg      -> background fill color, 6-digit hex WITHOUT "#", e.g. "FFF2CC"
//              (light yellow) or "D9E1F2" (light blue). Omit for no fill.
//   align   -> horizontal text alignment: "left" | "center" | "right"
//   valign  -> vertical text alignment: "top" | "middle" | "bottom"
//
// Cell addresses match the sheet layout comment at the very top of this
// file. Customer Copy lives in columns B-H, Company Copy in columns K-Q —
// they are two separate physical cells on the sheet, so style each side
// separately (e.g. C7 for the customer name box, L7 for the company one).
//
// TO STYLE A CELL THAT ISN'T LISTED YET: open challan_template.xlsx in
// Excel, click the cell you want to change, note its address (shown top-left,
// e.g. "F3"), then add a line here like:
//     F3: { bold: true, size: 10 },
// -----------------------------------------------------------------------------
const MANUAL_CELL_STYLES = {
  // Row 7 — "Name:" label and the customer-name value box. This is the pair
  // that was overlapping / getting cut off in the printed PDF.
  B7: { bold: true, size: 10, wrap: false },
  C7: { size: 10, wrap: true, valign: 'middle' },
  L7: { size: 10, wrap: true, valign: 'middle' },

  // Header value cells (Challan No. / Date / Order No. / Capacity)
  H3: { size: 10, wrap: false }, Q3: { size: 10, wrap: false },
  H4: { size: 10, wrap: false }, Q4: { size: 10, wrap: false },
  H5: { size: 10, wrap: false }, Q5: { size: 10, wrap: false },
  H6: { size: 10, wrap: false }, Q6: { size: 10, wrap: false },
  H7: { size: 10, wrap: false }, Q7: { size: 10, wrap: false },

  // Description column, every item row — long handwritten-style notes wrap
  // instead of spilling out of the box.
  H9:  { wrap: true, size: 9 }, Q9:  { wrap: true, size: 9 },
  H10: { wrap: true, size: 9 }, Q10: { wrap: true, size: 9 },
  H11: { wrap: true, size: 9 }, Q11: { wrap: true, size: 9 },
  H12: { wrap: true, size: 9 }, Q12: { wrap: true, size: 9 },
  H13: { wrap: true, size: 9 }, Q13: { wrap: true, size: 9 },
  H14: { wrap: true, size: 9 }, Q14: { wrap: true, size: 9 },
  H15: { wrap: true, size: 9 }, Q15: { wrap: true, size: 9 },
  H16: { wrap: true, size: 9 }, Q16: { wrap: true, size: 9 },
  H17: { wrap: true, size: 9 }, Q17: { wrap: true, size: 9 },
  H18: { wrap: true, size: 9 }, Q18: { wrap: true, size: 9 },
  H19: { wrap: true, size: 9 }, Q19: { wrap: true, size: 9 },
  H20: { wrap: true, size: 9 }, Q20: { wrap: true, size: 9 },
  H21: { wrap: true, size: 9 }, Q21: { wrap: true, size: 9 },
  H22: { wrap: true, size: 9 }, Q22: { wrap: true, size: 9 },
  H23: { wrap: true, size: 9 }, Q23: { wrap: true, size: 9 },
  H24: { wrap: true, size: 9 }, Q24: { wrap: true, size: 9 },
  H25: { wrap: true, size: 9 }, Q25: { wrap: true, size: 9 },
  H26: { wrap: true, size: 9 }, Q26: { wrap: true, size: 9 },
  H27: { wrap: true, size: 9 }, Q27: { wrap: true, size: 9 },
};

function applyManualCellStyles(sheet, styles) {
  for (const [address, style] of Object.entries(styles)) {
    const cell = sheet.getCell(address);
    const existingFont = cell.font || {};
    const existingAlignment = cell.alignment || {};

    if (style.bold !== undefined || style.size !== undefined) {
      cell.font = {
        ...existingFont,
        bold: style.bold !== undefined ? style.bold : existingFont.bold,
        size: style.size !== undefined ? style.size : existingFont.size,
      };
    }
    if (style.wrap !== undefined || style.align !== undefined || style.valign !== undefined) {
      cell.alignment = {
        ...existingAlignment,
        wrapText: style.wrap !== undefined ? style.wrap : existingAlignment.wrapText,
        horizontal: style.align !== undefined ? style.align : existingAlignment.horizontal,
        vertical: style.valign !== undefined ? style.valign : existingAlignment.vertical,
      };
    }
    if (style.bg !== undefined) {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: `FF${style.bg}` },
      };
    }
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

    // Manual cell styles — font size, bold, wrap, background, alignment —
    // applied on top of the values just written. Edit MANUAL_CELL_STYLES
    // above to change how any specific cell looks.
    applyManualCellStyles(sheet, MANUAL_CELL_STYLES);

    // The template's original margins were wildly uneven — left 0.19",
    // right 0", top 0", bottom 0", PLUS a 0.51" header/footer reserve that
    // was never actually used for a header/footer. Set equal small margins
    // on all 4 sides and drop the unused header/footer reserve.
    sheet.pageSetup.margins = {
      left: 0.2, right: 0.2, top: 0.2, bottom: 0.2, header: 0, footer: 0,
    };

    const pageHeightPt = getPageHeightPt(sheet.pageSetup);
    const pageWidthPt = getPageWidthPt(sheet.pageSetup);
    const m = sheet.pageSetup.margins;
    const availableHeightPt = pageHeightPt - ((m.top || 0) + (m.bottom || 0) + (m.header || 0) + (m.footer || 0)) * 72;
    const availableWidthPt = pageWidthPt - ((m.left || 0) + (m.right || 0)) * 72;

    // Column widths: use the manual widths table above if set, otherwise
    // fall back to the automatic stretch-to-fit-page behavior.
    // Row heights: same — manual table if set, otherwise automatic stretch.
    if (MANUAL_COLUMN_WIDTHS) {
      applyManualColumnWidths(sheet, MANUAL_COLUMN_WIDTHS);
    } else {
      stretchColumnsToFillPage(sheet, PRINT_FIRST_COL, PRINT_LAST_COL, availableWidthPt);
    }
    if (MANUAL_ROW_HEIGHTS) {
      applyManualRowHeights(sheet, MANUAL_ROW_HEIGHTS);
    } else {
      stretchRowsToFillPage(sheet, PRINT_FIRST_ROW, PRINT_LAST_ROW, availableHeightPt);
    }

    // No print zoom — width and height are already sized to fit exactly.
    sheet.pageSetup.fitToPage = false;
    sheet.pageSetup.fitToWidth = undefined;
    sheet.pageSetup.fitToHeight = undefined;
    sheet.pageSetup.scale = 100;
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