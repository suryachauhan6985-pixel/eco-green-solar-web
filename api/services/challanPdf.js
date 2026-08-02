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

// #############################################################################
// ██████████████████████████████████████████████████████████████████████████
// ✏️  EDIT-ME SECTION — SHEET_CONFIG  ✏️
// ██████████████████████████████████████████████████████████████████████████
//
// This is the ONLY section you need to touch to change how the printed PDF
// looks. Everything about the sheet — page margins, which columns/rows are
// how wide/tall, and every individual cell's font, wrap, background, border,
// alignment, and merge — is controlled from this one object. Think of it as
// writing the Excel file by hand, in code, cell by cell.
//
// After the ENGINE section below (do not edit that part unless you're adding
// a brand-new capability), this config is read and applied automatically
// every time a challan PDF is generated. No other part of the file needs to
// change for day-to-day formatting tweaks.
//
// -----------------------------------------------------------------------------
// 1) page  — page-level setup: margins, orientation, paper, print scaling.
// -----------------------------------------------------------------------------
//   marginsIn: { top, bottom, left, right, header, footer } — ALL IN INCHES,
//     same as Excel's Page Setup > Margins dialog. This controls exactly
//     where the printed content starts from each edge of the paper.
//   orientation: 'landscape' | 'portrait'
//   paperSize: Excel's numeric paper code — 9 = A4, 1 = Letter, 5 = Legal.
//     Leave as-is unless you know the template's paper needs to change.
//   fitToPage: true = let Excel/LibreOffice scale everything to fit the
//     page (a single zoom % applied to the whole sheet — width AND height
//     together, cannot be independent). false = use column widths / row
//     heights below EXACTLY as given, no auto-scaling at all. Default false
//     because this whole config is about manual, cell-by-cell control.
//   scale: only used when fitToPage is false — print zoom percentage
//     (100 = normal size).
//   horizontalCentered / verticalCentered: true/false — centers the printed
//     content on the page horizontally/vertically within the margins.
//   printArea: optional, e.g. 'B2:Q38' — the exact range that gets printed.
//     Leave null to keep the template's existing print area untouched.
//
// -----------------------------------------------------------------------------
// 2) columns — per-column width and visibility, keyed by column letter.
// -----------------------------------------------------------------------------
//   width:  Excel's "characters" unit — same number shown in Excel's tooltip
//           while dragging a column border. Omit to leave that column's
//           width exactly as it is in the template.
//   hidden: true = column disappears completely (like right-click > Hide
//           Columns in Excel) — nothing in that column shows or prints.
//
// -----------------------------------------------------------------------------
// 3) rows — per-row height and visibility, keyed by row number.
// -----------------------------------------------------------------------------
//   height: in POINTS — same number Excel shows while dragging a row's
//           bottom border. Omit to leave that row's height exactly as it is
//           in the template.
//   hidden: true = row disappears completely (like right-click > Hide Rows
//           in Excel) — nothing in that row shows or prints.
//
// -----------------------------------------------------------------------------
// 4) merges / unmerges — join or split cells, exactly like Excel's
//    "Merge & Center" / "Unmerge Cells".
// -----------------------------------------------------------------------------
//   unmerges: list of ranges to split apart FIRST, e.g. ['C7:E7'].
//   merges:   list of ranges to join together AFTER unmerging, e.g.
//             ['F7:G7']. Only the top-left cell of a merged range keeps its
//             value — write your value there.
//   Both are applied before any header/item values are written further
//   down in this file, so a merge/unmerge here changes which single cell
//   address holds the value for that box.
//
// -----------------------------------------------------------------------------
// 5) cells — every visual property of one individual cell, keyed by its
//    address (e.g. "B7", "H3", "C9"). ALL properties are optional — set
//    only what you want to change; anything you leave out keeps the
//    template's existing look for that property.
// -----------------------------------------------------------------------------
//   font:     { size, bold, italic, color }
//               size  -> font size in points (9, 10, 11, 12...)
//               bold  -> true / false
//               italic-> true / false
//               color -> 6-digit hex WITHOUT "#", e.g. "000000" (black),
//                        "C00000" (dark red)
//   wrap:     true = wrap long text onto multiple lines instead of
//               overflowing into the next cell. Only shows extra lines if
//               the row is tall enough — set that row's height above too.
//   align:    horizontal text position: "left" | "center" | "right"
//   valign:   vertical text position: "top" | "middle" | "bottom"
//   bg:       background fill color, 6-digit hex WITHOUT "#", e.g.
//               "FFF2CC" (light yellow), "D9E1F2" (light blue). Omit for
//               no fill / transparent.
//   border:   { top, bottom, left, right } — each side is EITHER a plain
//               string style ("thin", "medium", "thick", "double", "dotted",
//               "dashed", "hair", "none") using the default black color, OR
//               an object { style, color } for a specific line color, e.g.
//               { style: 'medium', color: 'C00000' }. Omit a side to leave
//               that side's border exactly as it is in the template.
//   hidden:   true = makes the cell's text invisible on the printed PDF
//               (done by painting the text the same color as its
//               background) WITHOUT touching the underlying value. Use
//               this to visually blank out a cell without breaking any
//               code elsewhere that reads/writes that cell's value. Note:
//               this is a visual trick, not a true "empty cell" — for a
//               real always-empty/removed cell, use `rows`/`columns`
//               `hidden` above instead if the whole row/column can go, or
//               simply don't write a value to that cell.
//
// EXAMPLE — style the "Name:" label bold, and make its value box wrap with
// a light-yellow background and a thin black border all around:
//   cells: {
//     B7: { font: { bold: true, size: 10 } },
//     C7: { wrap: true, valign: 'middle', bg: 'FFF2CC',
//           border: { top: 'thin', bottom: 'thin', left: 'thin', right: 'thin' } },
//   }
//
// TO FIND A CELL'S ADDRESS: open challan_template.xlsx in Excel, click the
// cell, read its address from the Name Box (top-left corner, e.g. "F3").
// #############################################################################

const SHEET_CONFIG = {
  page: {
    marginsIn: { top: 0.2, bottom: 0.2, left: 0.2, right: 0.2, header: 0, footer: 0 },
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToPage: false,
    scale: 100,
    horizontalCentered: true,
    verticalCentered: false,
    printArea: null,
  },

  columns: {
    B: { width: 4 },
    C: { width: 10 },
    D: { width: 8 },
    E: { width: 8 },
    F: { width: 10 },
    G: { width: 8 },
    H: { width: 14 },
    I: { width: 2 },
    J: { width: 2 },
    K: { width: 4 },
    L: { width: 10 },
    M: { width: 8 },
    N: { width: 8 },
    O: { width: 10 },
    P: { width: 8 },
    Q: { width: 14 },
  },

  rows: {
    // Add a row number here to control its height, e.g. 7: { height: 22 }.
    // Any row left out keeps the template's original height untouched.
  },

  unmerges: [
    // 'C7:E7',
  ],

  merges: [
    // 'F7:G7',
  ],

  cells: {
    // Add cell addresses here to style them, e.g.:
    // B7: { font: { bold: true, size: 10 } },
    // C7: { wrap: true, valign: 'middle' },
  },
};

// ██████████████████████████████████████████████████████████████████████████
// 🛑 ENGINE — reads SHEET_CONFIG above and applies it. Don't edit below this
// line unless you're adding a brand-new capability (a new property type).
// ██████████████████████████████████████████████████████████████████████████

const BORDER_STYLE_KEYS = ['top', 'bottom', 'left', 'right'];

function normalizeBorderSide(side) {
  if (!side) return undefined;
  if (typeof side === 'string') {
    return { style: side, color: { argb: 'FF000000' } };
  }
  return {
    style: side.style || 'thin',
    color: { argb: `FF${(side.color || '000000').replace('#', '')}` },
  };
}

// Applies structural changes that must happen BEFORE any values are written:
// unmerging, then merging. This runs right after the template is opened.
function applySheetStructure(sheet, config) {
  const unmerges = config.unmerges || [];
  const merges = config.merges || [];

  for (const range of unmerges) {
    try {
      sheet.unMergeCells(range);
    } catch (e) {
      // Not currently merged, or invalid range — skip so one bad entry
      // doesn't break the whole PDF generation.
    }
  }

  for (const range of merges) {
    try {
      sheet.mergeCells(range);
    } catch (e) {
      // Already merged, overlapping an existing merge, or invalid range —
      // skip so one bad entry doesn't break the whole PDF generation.
    }
  }
}

// Applies every visual/layout property. This runs AFTER header/item values
// are written, so cell styling always lands on top of the final content.
function applySheetFormatting(sheet, config) {
  const page = config.page || {};
  const columns = config.columns || {};
  const rows = config.rows || {};
  const cells = config.cells || {};

  // --- Page setup -----------------------------------------------------------
  if (page.marginsIn) {
    sheet.pageSetup.margins = { ...sheet.pageSetup.margins, ...page.marginsIn };
  }
  if (page.orientation) sheet.pageSetup.orientation = page.orientation;
  if (page.paperSize !== undefined) sheet.pageSetup.paperSize = page.paperSize;
  if (page.fitToPage) {
    sheet.pageSetup.fitToPage = true;
    sheet.pageSetup.fitToWidth = 1;
    sheet.pageSetup.fitToHeight = 1;
  } else {
    sheet.pageSetup.fitToPage = false;
    sheet.pageSetup.fitToWidth = undefined;
    sheet.pageSetup.fitToHeight = undefined;
    sheet.pageSetup.scale = page.scale !== undefined ? page.scale : 100;
  }
  if (page.horizontalCentered !== undefined) sheet.pageSetup.horizontalCentered = page.horizontalCentered;
  if (page.verticalCentered !== undefined) sheet.pageSetup.verticalCentered = page.verticalCentered;
  if (page.printArea) sheet.pageSetup.printArea = page.printArea;

  // --- Column widths / visibility --------------------------------------------
  for (const [colLetter, colConfig] of Object.entries(columns)) {
    const column = sheet.getColumn(colLetter);
    if (colConfig.width !== undefined) column.width = colConfig.width;
    if (colConfig.hidden !== undefined) column.hidden = colConfig.hidden;
  }

  // --- Row heights / visibility -----------------------------------------------
  for (const [rowNum, rowConfig] of Object.entries(rows)) {
    const row = sheet.getRow(Number(rowNum));
    if (rowConfig.height !== undefined) row.height = rowConfig.height;
    if (rowConfig.hidden !== undefined) row.hidden = rowConfig.hidden;
  }

  // --- Per-cell styling --------------------------------------------------------
  for (const [address, style] of Object.entries(cells)) {
    const cell = sheet.getCell(address);
    const existingFont = cell.font || {};
    const existingAlignment = cell.alignment || {};

    if (style.font) {
      let fontColor = existingFont.color;
      if (style.font.color !== undefined) {
        fontColor = { argb: `FF${style.font.color.replace('#', '')}` };
      }
      cell.font = {
        ...existingFont,
        size: style.font.size !== undefined ? style.font.size : existingFont.size,
        bold: style.font.bold !== undefined ? style.font.bold : existingFont.bold,
        italic: style.font.italic !== undefined ? style.font.italic : existingFont.italic,
        color: fontColor,
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
        fgColor: { argb: `FF${style.bg.replace('#', '')}` },
      };
    }

    if (style.border) {
      const existingBorder = cell.border || {};
      const newBorder = { ...existingBorder };
      for (const side of BORDER_STYLE_KEYS) {
        if (style.border[side] !== undefined) {
          newBorder[side] = normalizeBorderSide(style.border[side]);
        }
      }
      cell.border = newBorder;
    }

    // "hidden" = visually blank without touching the real value: paint the
    // font the same color as the cell's current background (default white
    // if no fill is set) so nothing is legible on the printed PDF.
    if (style.hidden) {
      const bgColor = (cell.fill && cell.fill.fgColor && cell.fill.fgColor.argb) || 'FFFFFFFF';
      cell.font = { ...(cell.font || {}), color: { argb: bgColor } };
    }
  }
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

    // Apply merges/unmerges FIRST, before writing values below, so dynamic
    // values land on the correct (possibly new) top-left cell of any
    // merged/split range — see SHEET_CONFIG.merges / .unmerges above.
    applySheetStructure(sheet, SHEET_CONFIG);

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

    // Apply every layout/visual property from SHEET_CONFIG — page margins,
    // column widths, row heights, and per-cell styling — now that all the
    // dynamic values above are already in place.
    applySheetFormatting(sheet, SHEET_CONFIG);

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