// js/pages/bom-challan.js
// -----------------------------------------------------------------------------
// Split out of js/pages/bom.js (was 3921 lines) — PART 2 of 3.
// Everything for "Convert into Challan": the fixed 13-line item template,
// item -> category mapping, GI Pipe feet->pieces rules, kit-items ->
// Challan Qty auto-compress logic, the Challan entry modal, and the
// Challan print-sheet layout engine.
// Content below is UNCHANGED verbatim from the original bom.js — only its
// file location moved. Depends on nothing from bom-kit-helpers.js; must
// load BEFORE bom.js (which calls these functions from inside init()).
// -----------------------------------------------------------------------------
// ---------- "Convert into Challan" — fixed 13-line item template ----------
// The Excel Challan sheet does NOT list the full BOM kit (~53 rows) — it
// has its own short, fixed summary list, independent of whichever kit is
// selected. Sr/Item Name/Model/Unit are fixed here; Qty is left blank for
// hand entry per challan, same as the source Excel template ships blank.
// GI Pipe (Sr 3 & 4) each carry 4 size sub-rows (20/15/10/5 Feet), each
// with its own Qty, mirroring the merged-cell layout in the workbook.
// This template is completely separate from currentKitState/BOM_KITS —
// do not confuse the two: the on-screen "Kit Items" table
// (bomRenderScreenItemsHtml) keeps listing the full BOM kit exactly as
// before; this fixed list is only for the Challan modal below.
const BOM_CHALLAN_TEMPLATE = [
  { sr: 1, name: 'Solar Panel', model: '', unit: 'Nos' },
  { sr: 2, name: 'GI Structure', model: '', unit: 'Set' },
  { sr: 3, name: 'GI Pipe', model: '1.5 X 1.5', unit: 'Nos', sizes: ['20 Feet', '15 Feet', '10 Feet', '5 Feet'] },
  { sr: 4, name: 'GI Pipe', model: '2.5 X 1.5', unit: 'Nos', sizes: ['20 Feet', '15 Feet', '10 Feet', '5 Feet'] },
  { sr: 5, name: 'Bom Box', model: '', unit: 'Box' },
  { sr: 6, name: 'Inverter', model: '', unit: 'Nos' },
  { sr: 7, name: 'Earthing & LA Kit', model: '', unit: 'Nos' },
  { sr: 8, name: 'Earthing Bag', model: '', unit: 'Nos' },
  // "Wire Box" — added per the challan-category Excel (Book1.xlsx): every
  // DC/AC/Earthing wire item compresses into this one row. Kept alongside
  // "Earthing Bag" (not a replacement) per explicit instruction — both stay
  // on the template even though only Wire Box currently has items mapped
  // to it (see challan_category_map / CHALLAN_CATEGORIES).
  { sr: 9, name: 'Wire Box', model: '', unit: 'Box' },
  { sr: 10, name: 'PVC Pipe', model: '', unit: 'Nos' },
  { sr: 11, name: 'Ferma', model: '', unit: 'Nos' },
  { sr: 12, name: 'Reti Bag', model: '', unit: 'Bori' },
  { sr: 13, name: 'Kapchi Bag', model: '', unit: 'Bori' },
  { sr: 14, name: 'Cement Bag', model: '', unit: 'Bori' },
];

// Category name -> its BOM_CHALLAN_TEMPLATE row Sr No. (everything except
// "GI Pipe", which fans out to Sr 3 / Sr 4 by model — handled separately by
// bomGiPipeModelSr()). Kept as a lookup so the compress logic below never
// hardcodes Sr numbers a second time.
const BOM_CHALLAN_CATEGORY_SR = {};
BOM_CHALLAN_TEMPLATE.forEach((row) => {
  if (row.name !== 'GI Pipe') BOM_CHALLAN_CATEGORY_SR[row.name] = row.sr;
});

// ---------- "Convert into Challan" — item -> category mapping (Goal 5) ----------
// Loaded once from GET /api/challan/category-map (see challan.routes.js).
// bomChallanCategoryMap: { itemName: 'Bom Box' | 'Wire Box' | ... }.
// bomChallanCategoryList: the fixed 13 category names, for the mapping-editor
// dropdown. Both start empty so a slow/failed fetch just means "nothing
// auto-fills yet" (Qty inputs stay blank, exactly like before this feature)
// rather than breaking the Challan modal.
let bomChallanCategoryMap = {};
let bomChallanCategoryList = [];

async function bomLoadChallanCategoryMap() {
  try {
    // window.Api.get (not a raw fetch) — goes through the same wrapper
    // (auth header / base URL / error parsing) every other API call in
    // this app uses, so this can't silently diverge from them and come
    // back empty for a reason none of the other calls would hit.
    const data = await window.Api.get('/challan/category-map');
    bomChallanCategoryMap = (data && data.map) || {};
    bomChallanCategoryList = (data && data.categories) || [];
  } catch (e) {
    // offline/first-load race — Convert into Challan still works, just
    // without auto-fill until the next successful load.
    console.warn('bom: could not load Challan category map', e);
  }
}

// ---------- GI Pipe — hardcoded feet -> standard-length pieces ----------
// Business rule (explicit, NOT configurable from the mapping screen —
// confirmed with the user): total running feet for a given GI Pipe model
// gets broken into the fewest 20/15/10/5-Feet pieces, greedy from the
// largest size down. Every real-world total this feeds is a multiple of 5
// (pipes are only ever cut/counted in 5-Feet steps), so the remainder after
// dividing by 20 is always exactly 0, 5, 10, or 15 — i.e. at most ONE extra
// non-20-Feet piece is ever needed. Examples the user gave, preserved as
// the source of truth:
//   60  Feet -> 3x 20 Feet
//   85  Feet -> 4x 20 Feet + 1x 5 Feet
//   75  Feet -> 3x 20 Feet + 1x 15 Feet
function bomGiPipeFeetToPieces(totalFeet) {
  const pieces = { '20 Feet': 0, '15 Feet': 0, '10 Feet': 0, '5 Feet': 0 };
  let remaining = Math.max(0, Math.round(Number(totalFeet) || 0));
  pieces['20 Feet'] = Math.floor(remaining / 20);
  remaining -= pieces['20 Feet'] * 20;
  // remaining is one of 0/5/10/15 for well-formed (multiple-of-5) totals —
  // for anything else (bad data), fall back to greedy 15->10->5 so no feet
  // silently vanish instead of hard-failing the whole Challan.
  if (remaining >= 15) { pieces['15 Feet'] += 1; remaining -= 15; }
  else if (remaining >= 10) { pieces['10 Feet'] += 1; remaining -= 10; }
  else if (remaining >= 5) { pieces['5 Feet'] += 1; remaining -= 5; }
  return pieces;
}

// Which template row (Sr 3 = "1.5 X 1.5", Sr 4 = "2.5 X 1.5") a GI Pipe
// kit-item's Model text belongs under. Matched by whichever size number
// appears first in the model text (kit items use `1.5" X 1.5"` /
// `2.5" X 1.5"` — quotes and spacing vary, so this only looks for the
// leading "1.5" vs "2.5"). Anything else (e.g. the kit's 3rd "1\" X 1\""
// GI Pipe row, which has no matching template row) returns null and is
// skipped — same as it being left blank/'-' today.
function bomGiPipeModelSr(modelText) {
  const m = String(modelText || '');
  if (m.indexOf('1.5') !== -1) return 3;
  if (m.indexOf('2.5') !== -1) return 4;
  return null;
}

// ---------- "Convert into Challan" — auto-compress a kit's items into Challan Qty ----------
// Walks every item across every section of `sections` (currentKitState —
// the ACTUAL on-screen BOM for this dispatch trip, so Dispatch Qty
// overrides from a partial dispatch are respected via bomEffectiveQty)
// and buckets it under its mapped Challan category (bomChallanCategoryMap).
// Aggregation rule per the user's explicit instruction:
//   - a category with exactly ONE present item (qty > 0) on this BOM ->
//     Challan Qty = that item's own effective quantity, as-is.
//   - a category with MORE THAN ONE present item on this BOM -> Challan
//     Qty = 1 (e.g. 25 different Bom Box items present = "1 Box").
//   - a category with zero present items -> left blank (untouched).
// GI Pipe is handled entirely separately (bomGiPipeFeetToPieces) and never
// goes through this count-based rule.
// Returns { qtyBySr: { [sr]: number }, giPipe: { 3: {size:qty}, 4: {size:qty} } }.
function bomComputeChallanAutoQty(sections) {
  const qtyBySr = {};
  const giPipe = { 3: {}, 4: {} };
  const presentByCategory = {}; // category -> [{ qty }]

  (sections || []).forEach((sec) => {
    (sec.items || []).forEach((it) => {
      const qty = bomEffectiveQty(it);
      if (!qty || qty <= 0) return; // '-' / blank / 0 -> not "present" on this trip
      const category = bomChallanCategoryMap[it.name];
      if (!category) return; // unmapped item — nothing to compress it into yet

      if (category === 'GI Pipe') {
        const sr = bomGiPipeModelSr(it.model);
        if (!sr) return;
        // qty text for GI Pipe is feet (e.g. "60 Feet"), not a plain count —
        // bomEffectiveQty already returns just the leading number, feet or not.
        const pieces = bomGiPipeFeetToPieces(qty);
        Object.keys(pieces).forEach((size) => {
          giPipe[sr][size] = (giPipe[sr][size] || 0) + pieces[size];
        });
        return;
      }

      const sr = BOM_CHALLAN_CATEGORY_SR[category];
      if (!sr) return; // category exists in the map but has no template row (shouldn't happen — defensive)
      if (!presentByCategory[category]) presentByCategory[category] = [];
      presentByCategory[category].push(qty);
    });
  });

  Object.keys(presentByCategory).forEach((category) => {
    const list = presentByCategory[category];
    const sr = BOM_CHALLAN_CATEGORY_SR[category];
    qtyBySr[sr] = list.length === 1 ? list[0] : 1;
  });

  return { qtyBySr, giPipe };
}

// Writes bomComputeChallanAutoQty()'s result straight into the entry
// modal's Qty <input>s (already in the DOM at this point — called right
// after openChallanModal). Every value stays a normal, editable number
// input afterwards — this only sets the starting value, same as any other
// pre-filled field elsewhere in the app; the person can still overwrite any
// of them by hand before Print Challan.
function bomApplyChallanAutoQty(sections) {
  const { qtyBySr, giPipe } = bomComputeChallanAutoQty(sections);
  document.querySelectorAll('.bom-challan-qty-input').forEach((inp) => {
    const sr = Number(inp.getAttribute('data-challan-tpl-sr'));
    const size = inp.getAttribute('data-challan-tpl-size');
    if (size) {
      const bucket = giPipe[sr];
      if (bucket && bucket[size]) inp.value = bucket[size];
    } else if (qtyBySr[sr] != null) {
      inp.value = qtyBySr[sr];
    }
  });
}

// ---------- "Convert into Challan" — ENTRY MODAL (software-style, NOT the Excel look) ----------
// This is the on-screen counterpart to the main BOM entry form (#1 in the
// file-level split described at the top): same .form-grid/.field pattern,
// same dark theme, plain <input>s — no white sheet, no purple bars. Items
// render in the same visual style as the existing on-screen "Kit Items"
// table (.table-wrap/.bom-items-form-table), from BOM_CHALLAN_TEMPLATE
// above (Sr/Name/Model/Unit fixed, Qty a blank editable number per
// line/sub-row) — NOT from currentKitState. The Excel-exact look lives
// ONLY in bomRenderChallanPrintSheetHtml() below (print-only, part B).
// This layout mirrors the Excel Challan sheet's real column order: Sr No.
// | Item Name | Model | Size (only used by GI Pipe's 4 sub-rows) | Qty. |
// Unit | Description — as a fixed <colgroup> so the Qty. INPUT BOX itself
// sits in the same column/x-position on every row (regular items and GI
// Pipe size sub-rows alike), instead of the size label pushing that row's
// box sideways out of line with the others. Description is a separate,
// per-item free-text input (one per item, spanning the item's sub-rows
// via rowspan) — the Excel sheet's "Description" column is blank for the
// user to fill by hand, same as Qty.
function bomRenderChallanTemplateItemsHtml(template) {
  const qtyInput = (sr, sizeLabel) => {
    const sizeAttr = sizeLabel ? ` data-challan-tpl-size="${bomEscAttr(sizeLabel)}"` : '';
    return `<input type="number" min="0" class="bom-field-input bom-challan-qty-input" data-challan-tpl-sr="${sr}"${sizeAttr}>`;
  };
  const descInput = (sr) =>
    `<input type="text" class="bom-field-input" data-challan-tpl-desc="${sr}" placeholder="Description">`;

  const rows = template.map((it) => {
    if (it.sizes && it.sizes.length) {
      return it.sizes.map((size, i) => {
        const leadCells = i === 0
          ? `<td rowspan="${it.sizes.length}">${it.sr}</td>
             <td rowspan="${it.sizes.length}">${bomEsc(it.name)}</td>
             <td rowspan="${it.sizes.length}">${bomEsc(it.model || '')}</td>`
          : '';
        const descCell = i === 0 ? `<td rowspan="${it.sizes.length}">${descInput(it.sr)}</td>` : '';
        return `
      <tr>
        ${leadCells}
        <td class="bom-challan-size-cell">${bomEsc(size)}</td>
        <td>${qtyInput(it.sr, size)}</td>
        <td>${bomEsc(it.unit)}</td>
        ${descCell}
      </tr>`;
      }).join('');
    }
    return `
      <tr>
        <td>${it.sr}</td>
        <td>${bomEsc(it.name)}</td>
        <td>${bomEsc(it.model || '')}</td>
        <td class="bom-challan-size-cell">&mdash;</td>
        <td>${qtyInput(it.sr)}</td>
        <td>${bomEsc(it.unit)}</td>
        <td>${descInput(it.sr)}</td>
      </tr>`;
  }).join('');

  return `
    <div class="table-wrap">
      <table class="bom-items-form-table">
        <colgroup>
          <col style="width:6%;"><col style="width:20%;"><col style="width:14%;">
          <col style="width:12%;"><col style="width:12%;"><col style="width:8%;"><col style="width:28%;">
        </colgroup>
        <thead><tr><th>Sr No.</th><th>Item Name</th><th>Model</th><th>Size</th><th>Qty.</th><th>Unit</th><th>Description</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function bomRenderChallanEntryModalHtml(header, kit) {
  return `
    <div id="bomChallanEntryModalRoot">
      <div class="form-grid cols-2">
        <div class="field"><label>Challan No.</label><input type="text" id="bomChallanModalNo" placeholder="Challan no."></div>
        <div class="field"><label>Challan Date</label><input type="date" id="bomChallanModalDate"></div>
        <div class="field"><label>Order No.</label><input type="text" id="bomChallanModalOrderNo" value="${bomEscAttr(header.orderNo)}" placeholder="Order no."></div>
        <div class="field"><label>Capacity (kW)</label><input type="text" id="bomChallanModalCapacity" value="${bomEscAttr(kit.kw)}"></div>
        <div class="field"><label>Name</label><input type="text" id="bomChallanModalName" value="${bomEscAttr(header.customerName)}" placeholder="Customer / Party"></div>
        <div class="field"><label>City</label><input type="text" id="bomChallanModalCity" placeholder="City"></div>
        <div class="field"><label>Vehicle No.</label><input type="text" id="bomChallanModalVehicleNo" placeholder="e.g. GJ-03-BZ-7562"></div>
      </div>
      <h4 style="margin:16px 0 8px;"><i class="fa-solid fa-list"></i> Items <span style="font-weight:400;color:var(--txt-muted);font-size:11.5px;">(fixed Challan template)</span></h4>
      ${bomRenderChallanTemplateItemsHtml(BOM_CHALLAN_TEMPLATE)}
      <div class="actions-row" style="margin-top:14px;">
        <button type="button" class="btn btn-blue" id="bomChallanPrintBtn"><i class="fa-solid fa-print"></i> Print Challan</button>
      </div>
    </div>
  `;
}

// ---------- "Convert into Challan" — PRINT-ONLY sheet (exact Excel replica) ----------
// Counterpart #2 in the file-level split: built + dropped into
// #bomChallanPrintRoot ONLY at the moment "Print Challan" is clicked (see
// bomChallanPrintBtn's handler in init()), exactly mirroring how
// bomRenderPrintSheetHtml() is only built into #bomPrintRoot when "Print
// BOM" is clicked. Never rendered inside the entry modal above. Recreates
// the workbook's Challan sheet: Customer Copy / Company Copy mirrored side
// by side (columns A–H mirrored into J–P in the original), same GST/address/
// header fields, Sr No./Item Name/Model/Qty./Description columns, and the
// Issued by / Vehicle No. / Received by footer — reusing the same
// bom-table/bom-info-cell/bom-spacer/bom-head-row/bom-cat-row classes
// #bomPrintRoot's sheet uses, so this is the ONLY place that Excel look
// belongs to.
// Collects the actually-entered Qty./Description values from the entry
// modal's item table (BOM_CHALLAN_TEMPLATE inputs — data-challan-tpl-sr/
// -size/-desc, set up in bomRenderChallanTemplateItemsHtml above) right
// before printing. Keyed by `${sr}|${size||''}` so GI Pipe's 4 size
// sub-rows (Sr 3 & 4) each keep their own Qty while sharing one
// Description per item (entered once, same key with an empty size).
function bomCollectChallanTemplateValues() {
  const values = {};
  const setVal = (key, patch) => { values[key] = Object.assign({}, values[key], patch); };
  document.querySelectorAll('.bom-challan-qty-input').forEach((inp) => {
    const sr = inp.getAttribute('data-challan-tpl-sr');
    const size = inp.getAttribute('data-challan-tpl-size') || '';
    setVal(`${sr}|${size}`, { qty: inp.value });
  });
  document.querySelectorAll('[data-challan-tpl-desc]').forEach((inp) => {
    const sr = inp.getAttribute('data-challan-tpl-desc');
    setVal(`${sr}|`, { desc: inp.value });
  });
  return values;
}

// ---------- Challan print sheet — layout engine (CHALLAN_SPEC.md) ----------
// Everything below reproduces the reverse-engineered Excel layout in
// CHALLAN_SPEC.md exactly: one flat 7-column <table> per copy (Sr./Item
// Name/Model/Model-cont./Qty-label/Qty-unit/Description — §3), a fixed
// 28-row body (§4/§15) padded with blank numbered rows past the real
// item list, and the exact rowspan/colspan merge pattern from §5. No
// column widths/row heights/scale are computed here — those are static
// values in bom.css (§14/§15: "no client-side layout computation").

// Fixed total body-row count the printed table always pads/truncates to
// (§4: rows 8–35 = 28 rows; §15: "fill remaining rows to reach 28").
const CHALLAN_PRINT_TOTAL_BODY_ROWS = 28;

// Walks BOM_CHALLAN_TEMPLATE and turns it into physical "row groups": one
// group per template item (rowCount = 4 for GI Pipe's size sub-rows, 1 for
// everything else), then appends blank, sequentially-numbered groups
// (continuing the Sr. No. sequence) until the physical row total reaches
// CHALLAN_PRINT_TOTAL_BODY_ROWS — the exact padding rule in §15.
function bomChallanBuildRowGroups(template) {
  const groups = [];
  let physicalRows = 0;
  let lastSr = 0;
  template.forEach((it) => {
    const rowCount = (it.sizes && it.sizes.length) ? it.sizes.length : 1;
    groups.push({ sr: it.sr, item: it, rowCount, blank: false });
    physicalRows += rowCount;
    lastSr = it.sr;
  });
  let nextSr = lastSr + 1;
  while (physicalRows < CHALLAN_PRINT_TOTAL_BODY_ROWS) {
    groups.push({ sr: nextSr, item: null, rowCount: 1, blank: true });
    physicalRows += 1;
    nextSr += 1;
  }
  return groups;
}

// Renders rows 8–35 (the item table body) from the row groups above,
// populated with the actual Qty./Description values collected from the
// entry modal (bomCollectChallanTemplateValues). Merge pattern per §5:
//  - Multi-length items (GI Pipe): Sr./Item/Model rowspan across the
//    sub-rows (A10:A13-style), one unmerged Model-cont. + Qty-label +
//    Qty-unit cell per sub-row, Description rowspan across the group.
//  - Single-variant items: Item Name colspan across the Model + Model-cont.
//    columns (B18:D18-style) since those items carry no sub-model text.
//  - Blank spacer rows: same colspan shape as a single-variant row, all
//    cells empty except the auto-numbered Sr. No.
function bomRenderChallanBodyRowsHtml(groups, values) {
  const getQty = (sr, size) => (values[`${sr}|${size || ''}`] && values[`${sr}|${size || ''}`].qty) || '';
  const getDesc = (sr) => (values[`${sr}|`] && values[`${sr}|`].desc) || '';

  return groups.map((g) => {
    if (g.blank) {
      return `
      <tr class="bom-challan-row bom-challan-row-blank">
        <td class="bom-c-sr">${g.sr}</td>
        <td class="bom-c-name" colspan="3"></td>
        <td class="bom-c-qtylabel"></td>
        <td class="bom-c-qtyunit"></td>
        <td class="bom-c-desc"></td>
      </tr>`;
    }
    const it = g.item;
    if (it.sizes && it.sizes.length) {
      const desc = getDesc(it.sr);
      return it.sizes.map((size, i) => {
        const leadCells = i === 0
          ? `<td class="bom-c-sr" rowspan="${it.sizes.length}">${it.sr}</td>
             <td class="bom-c-name" rowspan="${it.sizes.length}">${bomEsc(it.name)}</td>
             <td class="bom-c-model" rowspan="${it.sizes.length}">${bomEsc(it.model || '')}</td>`
          : '';
        const descCell = i === 0
          ? `<td class="bom-c-desc" rowspan="${it.sizes.length}">${bomEsc(desc)}</td>`
          : '';
        return `
      <tr class="bom-challan-row">
        ${leadCells}
        <td class="bom-c-modelcont">${bomEsc(size)}</td>
        <td class="bom-c-qtylabel">${bomEsc(getQty(it.sr, size))}</td>
        <td class="bom-c-qtyunit">${bomEsc(it.unit)}</td>
        ${descCell}
      </tr>`;
      }).join('');
    }
    return `
      <tr class="bom-challan-row">
        <td class="bom-c-sr">${it.sr}</td>
        <td class="bom-c-name" colspan="3">${bomEsc(it.name)}</td>
        <td class="bom-c-qtylabel">${bomEsc(getQty(it.sr))}</td>
        <td class="bom-c-qtyunit">${bomEsc(it.unit)}</td>
        <td class="bom-c-desc">${bomEsc(getDesc(it.sr))}</td>
      </tr>`;
  }).join('');
}

// Renders rows 1–6 (§4/§5/§6): logo + copy title on row 1; Challan No. on
// row 2; GST line + Challan Date on row 3; the 2-row company name/address
// block + Order No./Capacity on rows 4–5; Name/City on row 6. Every row
// sums to the same 7 column-units as the item table below it (A–G), so the
// header block and the item grid share one continuous column structure —
// no nested tables (§13). isCompanyCopy switches ONLY the title cell's
// color scheme (§6 asymmetry: Customer = black-on-white, Company =
// white-on-black) — nothing else differs between the two copies.
function bomRenderChallanHeaderRowsHtml(header, kit, copyLabel, isCompanyCopy) {
  const titleClass = isCompanyCopy ? 'bom-challan-title-inverse' : 'bom-challan-title-normal';
  return `
    <tr class="bom-challan-row1">
      <td class="bom-challan-logo-cell" colspan="2">
        <img class="bom-challan-logo" src="assets/logo.png" alt="Eco Green Solar">
      </td>
      <td class="bom-challan-spacer-cell" colspan="2"></td>
      <td class="bom-challan-title-cell ${titleClass}" colspan="3">${bomEsc(copyLabel)}</td>
    </tr>
    <tr class="bom-challan-row2">
      <td class="bom-challan-blank-cell" colspan="4"></td>
      <td class="bom-challan-field-cell" colspan="3">Challan No.: ${bomEsc(header.challanNo)}</td>
    </tr>
    <tr class="bom-challan-row3">
      <td class="bom-challan-gst-cell" colspan="4">GST NO. 24AAHFG9142N1Z1</td>
      <td class="bom-challan-field-cell" colspan="3">Challan Date: ${bomEsc(header.challanDate)}</td>
    </tr>
    <tr class="bom-challan-row4">
      <td class="bom-challan-address-cell" colspan="4" rowspan="2">
        <div class="bom-challan-company-name">Green Energy</div>
        <div class="bom-challan-address">Plot No &ndash; 4,5,6, Gajanand Ind. Area, Rev. S. No.: 183<br>Nr R K Exotica, To.: Chhapra&ndash;360021 Ta. Metoda (Rajkot)</div>
      </td>
      <td class="bom-challan-field-cell" colspan="3">Order No.: ${bomEsc(header.orderNo)}</td>
    </tr>
    <tr class="bom-challan-row5">
      <td class="bom-challan-field-cell" colspan="3">Capacity : ${bomEsc(kit.kw)} kW</td>
    </tr>
    <tr class="bom-challan-row6">
      <td class="bom-challan-name-cell" colspan="4">Name: ${bomEsc(header.customerName)}</td>
      <td class="bom-challan-field-cell" colspan="3">City: ${bomEsc(header.city)}</td>
    </tr>
  `;
}

// Renders row 7 — the item-table column headers (§7): Sr. No. / Item Name
// / Model (colspan across Model + Model-cont., matching C7:D7) / Qty.
// (colspan across the two Qty. columns, matching E7:F7) / Description.
function bomRenderChallanTableHeadRowHtml() {
  return `
    <tr class="bom-challan-tablehead-row">
      <th class="bom-c-sr">Sr. No.</th>
      <th class="bom-c-name">Item Name</th>
      <th class="bom-c-model" colspan="2">Model</th>
      <th class="bom-c-qty" colspan="2">Qty.</th>
      <th class="bom-c-desc">Description</th>
    </tr>
  `;
}

// Renders rows 36–37 — the footer (§11): "Issued by" / "Received by"
// signature boxes (each rowspan across both footer rows), the Vehicle No.
// value on row 36, and a blank signature line captioned "Vehicle No."
// directly beneath it on row 37 — same cell shape/column span on both rows
// (C36:F36 / C37:F37) so the write-in line sits flush under the value.
function bomRenderChallanFooterRowsHtml(header) {
  return `
    <tr class="bom-challan-footer-row1">
      <td class="bom-challan-issuedby-cell" colspan="2" rowspan="2">Issued by</td>
      <td class="bom-challan-vehicle-cell" colspan="4">${bomEsc(header.vehicleNo)}</td>
      <td class="bom-challan-receivedby-cell" rowspan="2">Received by</td>
    </tr>
    <tr class="bom-challan-footer-row2">
      <td class="bom-challan-vehicle-caption-cell" colspan="4">Vehicle No.</td>
    </tr>
  `;
}

// Assembles one full copy (Customer or Company) as a single flat <table>
// with a fixed 7-column <colgroup> (§3 ratio: 10.4:20.9:13.4:11.9:10.4:
// 7.5:25.4) — header rows, the column-header row, the fixed 28-row body,
// then the footer, all inside one continuous grid (§13: no nested tables).
function bomRenderChallanPrintSheetHalfHtml(header, kit, copyLabel, templateValues, isCompanyCopy) {
  const groups = bomChallanBuildRowGroups(BOM_CHALLAN_TEMPLATE);
  return `
    <table class="bom-challan-table">
      <colgroup>
        <col class="bom-challan-col-sr">
        <col class="bom-challan-col-name">
        <col class="bom-challan-col-model">
        <col class="bom-challan-col-modelcont">
        <col class="bom-challan-col-qtylabel">
        <col class="bom-challan-col-qtyunit">
        <col class="bom-challan-col-desc">
      </colgroup>
      <tbody>
        ${bomRenderChallanHeaderRowsHtml(header, kit, copyLabel, isCompanyCopy)}
        ${bomRenderChallanTableHeadRowHtml()}
        ${bomRenderChallanBodyRowsHtml(groups, templateValues)}
        ${bomRenderChallanFooterRowsHtml(header)}
      </tbody>
    </table>
  `;
}

// Top-level Challan sheet: two structurally identical copies, generated
// from ONE shared template (bomRenderChallanPrintSheetHalfHtml) so they
// can never drift out of sync, separated by a fixed-width gutter that
// carries the dashed "cut here" rule running the sheet's full height
// (§9/§13 — the gutter is a spacer, not a CSS margin/gap).
function bomRenderChallanPrintSheetHtml(header, kit, templateValues) {
  return `
    <div class="bom-challan-sheet" id="bomChallanSheet">
      <div class="bom-challan-copy bom-challan-copy-customer">
        ${bomRenderChallanPrintSheetHalfHtml(header, kit, 'Customer Copy', templateValues, false)}
      </div>
      <div class="bom-challan-gutter"></div>
      <div class="bom-challan-copy bom-challan-copy-company">
        ${bomRenderChallanPrintSheetHalfHtml(header, kit, 'Company Copy', templateValues, true)}
      </div>
    </div>
  `;
}
