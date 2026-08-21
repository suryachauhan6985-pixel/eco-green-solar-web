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
// Rows 9-10: Solar Panel / GI Structure — STATIC, always these 2 rows,
//         never move. Item name/model/unit stay baked in the template;
//         only Qty/Description are written per record (same as before).
// Rows 11-36: a SHARED DYNAMIC POOL (26 rows, both copies) — GI Pipe's
//         active feet-sub-rows, the 10 fixed single-line categories, and
//         any leftover blank numbered rows, ALL computed fresh per PDF.
//         See the "Dynamic GI Pipe / fixed-category row pool" block below
//         (GI_PIPE_MODELS / FIXED_CATEGORIES / buildChallanRowPlan /
//         applyChallanRowPlan) — item name/model/size/unit are NO LONGER
//         static template text in this range, because which row a given
//         category lands on now varies per record. POOL_START_ROW (11) and
//         POOL_END_ROW (36) themselves never change, which is what keeps
//         the outer table box / print area / row heights identical on
//         every printed challan regardless of content.
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

// Shared alignment object used everywhere in the dynamic item-table pool
// (Sr./Item Name/Model/Size/Qty./Unit/Description) so every row — GI Pipe
// blocks, fixed categories, and blank pool rows alike — renders centered
// both horizontally and vertically, regardless of which physical row a
// category ends up landing on this render.
const CENTER_ALIGN = { horizontal: 'center', vertical: 'middle' };

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

// -----------------------------------------------------------------------------
// Dynamic GI Pipe / fixed-category row pool (rows 11-36 on both copies)
// -----------------------------------------------------------------------------
// Rows 9-10 (Solar Panel / GI Structure) are NOT part of this — their
// name/model/unit text stays static in the template exactly as before,
// these two rows never move.
//
// Everything from row 11 to row 36 (26 rows, both copies) used to be a
// FIXED row->category mapping (the old ITEM_ROWS above). It is now built
// FRESH for every single PDF, because:
//   - a GI Pipe model only takes as many sub-rows as it has active
//     (qty > 0) feet-values (1 to 4) this trip, not always a hardcoded 4
//   - a GI Pipe model with NO qty at all this trip takes ZERO rows
//   - a 3rd GI Pipe size ("1 X 1") can appear or not, borrowing rows from
//     the SAME shared blank-row pool at the bottom — never a fixed slot
// Whatever rows GI Pipe frees up (or uses up) simply changes how many
// blank numbered rows are left at the bottom. POOL_START_ROW/POOL_END_ROW
// themselves NEVER change, which is what keeps the outer table box, print
// area, and every row height byte-identical on every printed challan
// regardless of how many GI Pipe sizes/lines are actually used.
//
// Because rows now MOVE (e.g. "Bom Box" might land on row 19 on one
// challan and row 23 on another, depending on how many GI Pipe rows came
// before it), the item name / model / size / unit text can no longer be
// static template content the way it used to be — this code now writes
// ALL of it (not just Qty/Description) into whichever row a category
// actually lands on this time.
//
// `sr` below is a STABLE STORAGE KEY ONLY (matches BOM_CHALLAN_TEMPLATE /
// items_json in bom-challan.js on the frontend) — it is NOT the printed
// Sr. No., which is recomputed fresh (3, 4, 5, 6...) based on what
// actually prints. Do NOT renumber these `sr` values to "make room" for a
// new category — that would misread every already-saved
// bom_challans.items_json row in the database. This is why GI Pipe 1 X 1
// below is sr:15 (not sr:5) even though it prints 3rd, right after
// 2.5 X 1.5 — array/list POSITION controls print order, `sr` is just a
// lookup key.
const GI_FEET_ORDER = ['20 Feet', '15 Feet', '10 Feet', '5 Feet'];
const GI_UNIT = 'Nos';

// Unified categories list for the printed Challan.
// Only items with Qty > 0 on this challan trip are printed into rows.
const ALL_CHALLAN_CATEGORIES = [
  { sr: 1,  name: 'Solar Panel',       unit: 'Nos', isGi: false },
  { sr: 2,  name: 'GI Structure',      unit: 'Set', isGi: false },
  { sr: 3,  name: 'GI Pipe',           unit: 'Nos', isGi: true, model: '1.5 X 1.5' },
  { sr: 4,  name: 'GI Pipe',           unit: 'Nos', isGi: true, model: '2.5 X 1.5' },
  { sr: 15, name: 'GI Pipe',           unit: 'Nos', isGi: true, model: '1 X 1' },
  { sr: 5,  name: 'Bom Box',           unit: 'Box', isGi: false },
  { sr: 6,  name: 'Inverter',          unit: 'Nos', isGi: false },
  { sr: 7,  name: 'Earthing & LA Kit', unit: 'Nos', isGi: false },
  { sr: 8,  name: 'Earthing Bag',      unit: 'Nos', isGi: false },
  { sr: 9,  name: 'Wire Box',          unit: 'Box', isGi: false },
  { sr: 10, name: 'PVC Pipe',          unit: 'Nos', isGi: false },
  { sr: 11, name: 'Ferma',             unit: 'Nos', isGi: false },
  { sr: 12, name: 'Reti Bag',          unit: 'Bori', isGi: false },
  { sr: 13, name: 'Kapchi Bag',        unit: 'Bori', isGi: false },
  { sr: 14, name: 'Cement Bag',        unit: 'Bori', isGi: false },
];

const POOL_START_ROW = 9;
const POOL_END_ROW = 36; // inclusive, 28 rows total (rows 9-36) — NEVER changes.

// Column letters for each logical field, per copy. Mirrors HEADER_CELLS'
// customer/company split above.
const POOL_COLS = {
  customer: { sr: 'B', name: 'C', model: 'D', size: 'E', qty: 'F', unit: 'G', desc: 'H' },
  company:  { sr: 'K', name: 'L', model: 'M', size: 'N', qty: 'O', unit: 'P', desc: 'Q' },
};

// Builds the row plan for ONE render: which physical row (9-36) gets
// which content, and what its printed Sr. No. is. Same plan is reused for
// both copies (Customer/Company), since they always mirror each other.
function buildChallanRowPlan(items) {
  const plan = [];
  let row = POOL_START_ROW;
  let printSr = 1;

  ALL_CHALLAN_CATEGORIES.forEach((cat) => {
    if (row > POOL_END_ROW) return;

    if (cat.isGi) {
      const activeFeet = GI_FEET_ORDER.filter((size) => {
        const v = items[`${cat.sr}|${size}`];
        return v && Number(v.qty) > 0;
      });
      if (!activeFeet.length) return; // zero qty -> skip!

      activeFeet.forEach((size, i) => {
        plan.push({
          kind: 'gi',
          row: row + i,
          blockFirst: i === 0,
          blockLast: i === activeFeet.length - 1,
          blockSize: activeFeet.length,
          printSr,
          model: cat.model,
          size,
          unit: cat.unit,
          qtyKey: `${cat.sr}|${size}`,
          descKey: `${cat.sr}|`,
        });
      });
      row += activeFeet.length;
      printSr += 1;
      return;
    }

    // Non-GI category: only include if qty > 0!
    const itemData = (items && items[`${cat.sr}|`]) || {};
    const qtyVal = itemData.qty;
    const hasQty = qtyVal !== undefined && qtyVal !== null && String(qtyVal).trim() !== '' && Number(qtyVal) > 0;
    if (!hasQty) return;

    plan.push({
      kind: 'item',
      row,
      printSr,
      name: String(itemData.name || cat.name).trim(),
      model: String(itemData.model || cat.model || '').trim(),
      unit: String(itemData.unit || cat.unit || 'Nos').trim(),
      qty: qtyVal,
      desc: String(itemData.desc || '').trim(),
    });
    row += 1;
    printSr += 1;
  });

  // Extra software-added items
  const extraItems = Array.isArray(items && items.extra) ? items.extra : [];
  extraItems.forEach((extra) => {
    if (row > POOL_END_ROW) return;
    const name = String((extra && extra.name) || '').trim();
    const qtyVal = extra && extra.qty;
    if (!name || !qtyVal || Number(qtyVal) <= 0) return;
    plan.push({
      kind: 'item',
      row,
      printSr,
      name,
      model: String((extra && extra.model) || '').trim(),
      unit: String((extra && extra.unit) || 'Nos'),
      qty: qtyVal,
      desc: String((extra && extra.desc) || '').trim(),
    });
    row += 1;
    printSr += 1;
  });

  while (row <= POOL_END_ROW) {
    plan.push({ kind: 'blank', row, printSr });
    row += 1;
    printSr += 1;
  }

  return plan;
}

function runSoffice(xlsxPath, outDir) {
  return new Promise((resolve, reject) => {
    const bin = process.env.SOFFICE_PATH || 'soffice';
    const profileDir = path.join(os.tmpdir(), `lo_prof_${crypto.randomUUID()}`);
    const profileUri = 'file:///' + profileDir.replace(/\\/g, '/');
    execFile(
      bin,
      [
        `-env:UserInstallation=${profileUri}`,
        '--headless',
        '--norestore',
        '--nolockcheck',
        '--convert-to', 'pdf',
        '--outdir', outDir,
        xlsxPath,
      ],
      { timeout: 25000 },
      async (err, stdout, stderr) => {
        try { await fsp.rm(profileDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
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
//
// -----------------------------------------------------------------------------
// 6) values — set the literal text/number of ANY cell directly from code.
// -----------------------------------------------------------------------------
//   Keyed by cell address, e.g. { A1: 'Note:', R39: 'v2' }. Works for ANY
//   address on the sheet — not limited to B2:Q38. This is for STATIC content
//   you want baked into the template layout itself (titles, notes, fixed
//   labels). It is separate from the dynamic per-record data (challan no.,
//   customer name, item qty/desc) which is still written further down in
//   fillTemplateAndConvertToPdf() via HEADER_CELLS / ITEM_ROWS — if the same
//   address appears in both, the dynamic write wins (it runs after `values`).
//
// NOTE: `columns`, `rows`, and `cells` above are NOT limited to the
// B2:Q38 area either — they accept any column letter, row number, or cell
// address on the sheet (A1 through R39 and beyond). The template's current
// used range is just B2:Q38 because that's the only area styled so far.
// #############################################################################

const SHEET_CONFIG = {
  page: {
    marginsIn: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0 },
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToPage: false,
    scale: 95,
    horizontalCentered: true,
    verticalCentered: false,
    printArea: 'A1:R39',
  },

  columns: {
    A: { width: 2 },
    B: { width: 10 },
    C: { width: 10 },
    D: { width: 8 },
    E: { width: 8 },
    F: { width: 5 },
    G: { width: 7 },
    H: { width: 23 },

    I: { width: 2 },
    J: { width: 2 },

    K: { width: 10 },
    L: { width: 10 },
    M: { width: 8 },
    N: { width: 8 },
    O: { width: 5 },
    P: { width: 7 },
    Q: { width: 23 },
    R: { width: 2 },
  },

  rows: {
    1:  { height: 20 },
    39: { height: 20 },
    6:  { height: 17 },
    7:  { height: 26 }, // 2-line wrap height for Customer Name
    8:  { height: 15 },
    38: { height: 16 },
  },

  unmerges: [
    // 'C7:E7',
  ],

  merges: [
    // 'F7:G7',
  ],

  cells: {
    B7: { align: 'center', valign: 'middle', font: { bold: true, size: 10 } },
    C7: { align: 'left', valign: 'middle', wrap: true, font: { bold: true, size: 9.5 } },
    F7: { align: 'center', valign: 'middle' },
    K7: { align: 'center', valign: 'middle', font: { bold: true, size: 10 } },
    L7: { align: 'left', valign: 'middle', wrap: true, font: { bold: true, size: 9.5 } },
    O7: { align: 'center', valign: 'middle' },
  },

  values: {
    // Add cell addresses here to set literal static text/numbers, e.g.:
    // A1: 'Eco Green Solar',
    // R39: 'v2',
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

// Applies literal static values from SHEET_CONFIG.values to any cell
// address. Runs AFTER structure (merges/unmerges) but BEFORE the dynamic
// per-record header/item values below, so if the same address appears in
// both places, the real record data always wins over a static placeholder.
function applySheetValues(sheet, config) {
  const values = config.values || {};
  for (const [address, value] of Object.entries(values)) {
    sheet.getCell(address).value = value;
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

// -----------------------------------------------------------------------------
// Dynamic pool engine — unmerge/rebuild rows 11-36 fresh on every render.
// -----------------------------------------------------------------------------

// Strips every merge the template currently has inside the dynamic pool
// (rows 11-36, columns B-H / K-Q) — DISCOVERED from the loaded workbook
// itself (sheet.model.merges) rather than hardcoded, so this keeps working
// even if challan_template.xlsx's exact merge pattern is edited later.
// Must run before applyChallanRowPlan() below, which rebuilds merges to
// match THIS render's plan — otherwise a leftover template merge (e.g. the
// template's own B11:B14) can collide with a plan that now wants B11:B12.
function unmergePoolZone(sheet) {
  const merges = (sheet.model && sheet.model.merges) ? sheet.model.merges.slice() : [];
  merges.forEach((range) => {
    const m = String(range).match(/^([A-Z]+)(\d+):/);
    if (!m) return;
    const col = m[1];
    const row = Number(m[2]);
    if (row < POOL_START_ROW || row > POOL_END_ROW) return;
    if (!'BCDEFGHKLMNOPQ'.includes(col)) return;
    try { sheet.unMergeCells(range); } catch (e) { /* already unmerged — ignore */ }
  });
}

// Merges an existing border object (reusing the same normalizeBorderSide
// used by the SHEET_CONFIG engine above) with only the sides passed in —
// sides left `undefined` are untouched. Needed because the template's OWN
// border data for the INTERIOR rows of a merge is intentionally blank
// (Excel doesn't draw internal gridlines inside a merged box), so leftover
// border state from the original template cannot be trusted once a row's
// merge span changes size on this render — every pool cell gets its full
// border re-applied explicitly, every time.
function setBorder(cell, sides) {
  const existing = cell.border || {};
  const next = { ...existing };
  for (const side of BORDER_STYLE_KEYS) {
    if (sides[side] !== undefined) next[side] = normalizeBorderSide(sides[side]);
  }
  cell.border = next;
}

// Wipes any leftover value (item name / model / size / qty / unit / desc)
// from every cell in the pool, both copies, before the new plan writes
// anything. REQUIRED because challan_template.xlsx has real static text
// baked into these rows (e.g. row 21 = "Earthing & LA Kit", row 23 =
// "PVC Pipe") from the original fixed-row design — if a category now
// lands on a DIFFERENT row than that baked text (e.g. because GI Pipe used
// fewer/zero rows this time and everything shifted up), the leftover text
// stays sitting in whatever row it's still baked into and bleeds through
// as duplicate/garbled text on rows the new plan marked "blank". Only `sr`
// is left alone here since every plan row (gi/fixed/blank) always
// overwrites it anyway.
function clearPoolZone(sheet) {
  for (let r = POOL_START_ROW; r <= POOL_END_ROW; r++) {
    ['customer', 'company'].forEach((copy) => {
      const cols = POOL_COLS[copy];
      [cols.name, cols.model, cols.size, cols.qty, cols.unit, cols.desc].forEach((col) => {
        sheet.getCell(`${col}${r}`).value = null;
      });
    });
  }
}

// Writes one render's row plan (from buildChallanRowPlan) into both copies.
// Call unmergePoolZone(sheet) then clearPoolZone(sheet) once before this,
// for the same sheet, in that order (unmerge before clearing values, since
// a non-anchor cell of a still-active merge can't be written directly).
function applyChallanRowPlan(sheet, plan, items) {
  ['customer', 'company'].forEach((copy) => {
    const cols = POOL_COLS[copy];
    const outerLeft = 'medium';  // matches the template's own left/right table edge
    const outerRight = 'medium';

    plan.forEach((entry) => {
      const r = entry.row;

      if (entry.kind === 'gi') {
        if (entry.blockFirst) {
          sheet.mergeCells(`${cols.sr}${r}:${cols.sr}${r + entry.blockSize - 1}`);
          sheet.mergeCells(`${cols.name}${r}:${cols.name}${r + entry.blockSize - 1}`);
          sheet.mergeCells(`${cols.model}${r}:${cols.model}${r + entry.blockSize - 1}`);
          sheet.getCell(`${cols.sr}${r}`).value = entry.printSr;
          sheet.getCell(`${cols.name}${r}`).value = 'GI Pipe';
          sheet.getCell(`${cols.model}${r}`).value = entry.model;
          sheet.getCell(`${cols.sr}${r}`).alignment = CENTER_ALIGN;
          sheet.getCell(`${cols.name}${r}`).alignment = CENTER_ALIGN;
          sheet.getCell(`${cols.model}${r}`).alignment = CENTER_ALIGN;
          const desc = (items[entry.descKey] && items[entry.descKey].desc) || '';
          if (desc) sheet.getCell(`${cols.desc}${r}`).value = desc;
          sheet.getCell(`${cols.desc}${r}`).alignment = CENTER_ALIGN;
        }
        const qty = (items[entry.qtyKey] && items[entry.qtyKey].qty) || '';
        sheet.getCell(`${cols.size}${r}`).value = entry.size;
        sheet.getCell(`${cols.qty}${r}`).value = qty;
        sheet.getCell(`${cols.unit}${r}`).value = entry.unit;
        sheet.getCell(`${cols.size}${r}`).alignment = CENTER_ALIGN;
        sheet.getCell(`${cols.qty}${r}`).alignment = CENTER_ALIGN;
        sheet.getCell(`${cols.unit}${r}`).alignment = CENTER_ALIGN;

        // Box border: only the block's top row gets a top edge, only its
        // bottom row gets a bottom edge — same visual as Excel's own
        // "Merge & Center" box, whether the block is 1 row or 4.
        [cols.sr, cols.name, cols.model].forEach((col) => {
          setBorder(sheet.getCell(`${col}${r}`), {
            top: entry.blockFirst ? 'thin' : 'none',
            bottom: entry.blockLast ? 'thin' : 'none',
            left: col === cols.sr ? outerLeft : 'thin',
            right: 'thin',
          });
        });
        setBorder(sheet.getCell(`${cols.size}${r}`), { top: 'thin', bottom: 'thin', left: 'thin', right: 'thin' });
        setBorder(sheet.getCell(`${cols.qty}${r}`), { top: 'thin', bottom: 'thin', left: 'thin', right: 'none' });
        setBorder(sheet.getCell(`${cols.unit}${r}`), { top: 'thin', bottom: 'thin', left: 'none', right: 'thin' });
        setBorder(sheet.getCell(`${cols.desc}${r}`), { top: 'thin', bottom: 'thin', left: 'thin', right: outerRight });
        return;
      }

      if (entry.kind === 'item') {
        sheet.getCell(`${cols.sr}${r}`).value = entry.printSr;
        sheet.getCell(`${cols.name}${r}`).value = entry.name;
        sheet.getCell(`${cols.sr}${r}`).alignment = CENTER_ALIGN;
        sheet.getCell(`${cols.name}${r}`).alignment = CENTER_ALIGN;

        if (entry.model) {
          sheet.mergeCells(`${cols.model}${r}:${cols.size}${r}`);
          sheet.getCell(`${cols.model}${r}`).value = entry.model;
          sheet.getCell(`${cols.model}${r}`).alignment = CENTER_ALIGN;
          setBorder(sheet.getCell(`${cols.name}${r}`), { top: 'thin', bottom: 'thin', left: 'thin', right: 'thin' });
          setBorder(sheet.getCell(`${cols.model}${r}`), { top: 'thin', bottom: 'thin', left: 'thin', right: 'thin' });
        } else {
          sheet.mergeCells(`${cols.name}${r}:${cols.size}${r}`);
          setBorder(sheet.getCell(`${cols.name}${r}`), { top: 'thin', bottom: 'thin', left: 'thin', right: 'thin' });
        }

        sheet.getCell(`${cols.qty}${r}`).value = entry.qty;
        sheet.getCell(`${cols.unit}${r}`).value = entry.unit;
        sheet.getCell(`${cols.qty}${r}`).alignment = CENTER_ALIGN;
        sheet.getCell(`${cols.unit}${r}`).alignment = CENTER_ALIGN;

        if (entry.desc) sheet.getCell(`${cols.desc}${r}`).value = entry.desc;
        sheet.getCell(`${cols.desc}${r}`).alignment = CENTER_ALIGN;

        setBorder(sheet.getCell(`${cols.sr}${r}`), { top: 'thin', bottom: 'thin', left: outerLeft, right: 'thin' });
        setBorder(sheet.getCell(`${cols.qty}${r}`), { top: 'thin', bottom: 'thin', left: 'thin', right: 'none' });
        setBorder(sheet.getCell(`${cols.unit}${r}`), { top: 'thin', bottom: 'thin', left: 'none', right: 'thin' });
        setBorder(sheet.getCell(`${cols.desc}${r}`), { top: 'thin', bottom: 'thin', left: 'thin', right: outerRight });
        return;
      }

      // blank pool row — just the running Sr. No., everything else stays empty.
      // Name/Model/Size MUST be merged into one cell here (same as the
      // "fixed" category branch above) — leaving them as 3 separate bordered
      // cells with nothing merged is what drew a stray vertical line down
      // the middle of every blank row (13-28 on a typical challan), since
      // each of those 3 cells still got its own left+right border independently.
      sheet.mergeCells(`${cols.name}${r}:${cols.size}${r}`);
      sheet.getCell(`${cols.sr}${r}`).value = entry.printSr;
      sheet.getCell(`${cols.sr}${r}`).alignment = CENTER_ALIGN;
      sheet.getCell(`${cols.name}${r}`).alignment = CENTER_ALIGN;
      setBorder(sheet.getCell(`${cols.sr}${r}`), { top: 'thin', bottom: 'thin', left: outerLeft, right: 'thin' });
      setBorder(sheet.getCell(`${cols.name}${r}`), { top: 'thin', bottom: 'thin', left: 'thin', right: 'thin' });
      setBorder(sheet.getCell(`${cols.qty}${r}`), { top: 'thin', bottom: 'thin', left: 'thin', right: 'none' });
      setBorder(sheet.getCell(`${cols.unit}${r}`), { top: 'thin', bottom: 'thin', left: 'none', right: 'thin' });
      setBorder(sheet.getCell(`${cols.desc}${r}`), { top: 'thin', bottom: 'thin', left: 'thin', right: outerRight });
    });
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

    // Apply merges/unmerges FIRST, before writing values below, so dynamic
    // values land on the correct (possibly new) top-left cell of any
    // merged/split range — see SHEET_CONFIG.merges / .unmerges above.
    applySheetStructure(sheet, SHEET_CONFIG);

    // Static values from SHEET_CONFIG.values (any cell, A1:R39 or beyond) —
    // written before the dynamic per-record data below so real data always
    // takes priority if an address is used in both places.
    applySheetValues(sheet, SHEET_CONFIG);

    const headerValues = {
      challanNo: record.challan_no || '',
      challanDate: record.challan_date || '',
      orderNo: record.order_no || '',
      capacityKw: record.capacity_kw || '',
      customerName: record.customer_name || '',
      city: record.city || '',
      vehicleNo: [
        record.vehicle_no || record.vehicleNo || '',
        record.vehicle_no_2 || record.vehicleNo2 || ''
      ].filter(Boolean).join(' / '),
    };
    for (const [field, cells] of Object.entries(HEADER_CELLS)) {
      const value = headerValues[field];
      sheet.getCell(cells.customer).value = value;
      sheet.getCell(cells.company).value = value;
    }

    const items = record.items || {}; // { "sr|size": { qty, desc } }
    unmergePoolZone(sheet);
    clearPoolZone(sheet);
    const rowPlan = buildChallanRowPlan(items);
    applyChallanRowPlan(sheet, rowPlan, items);

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