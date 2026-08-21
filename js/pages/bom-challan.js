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
  // sr:15 (NOT sr:5/6/...) is intentional — BOM only ever has these 3 GI
  // Pipe sizes, but every category below already has its own sr baked into
  // OLD saved bom_challans.items_json rows. Renumbering Bom Box..Cement Bag
  // to make room here would misread every challan printed before this
  // change. sr is just a storage key; ARRAY POSITION (3rd, right after
  // 2.5 X 1.5) is what actually controls where it prints — see
  // bomChallanBuildRowGroups below, which walks this array in order.
  { sr: 15, name: 'GI Pipe', model: '1 X 1', unit: 'Nos', sizes: ['20 Feet', '15 Feet', '10 Feet', '5 Feet'] },
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

// Fallback default Challan Categories list (mirrors CHALLAN_CATEGORIES on server)
const BOM_CHALLAN_CATEGORIES_DEFAULT = [
  'Solar Panel', 'GI Structure', 'GI Pipe', 'Bom Box', 'Inverter',
  'Earthing & LA Kit', 'Earthing Bag', 'Wire Box', 'PVC Pipe',
  'Reti Bag', 'Kapchi Bag', 'Cement Bag', 'Ferma',
];

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
    bomChallanCategoryList = (data && data.categories) || BOM_CHALLAN_CATEGORIES_DEFAULT;
  } catch (e) {
    // offline/first-load race — Convert into Challan still works, just
    // without auto-fill until the next successful load.
    console.warn('bom: could not load Challan category map', e);
    if (!bomChallanCategoryList.length) bomChallanCategoryList = BOM_CHALLAN_CATEGORIES_DEFAULT;
  }
}

// Multi-tier Challan category resolver for any BOM kit item
function bomGetItemChallanCategory(it, sec) {
  if (!it) return null;
  const name = String(it.name || '').trim();
  const brand = String(it.brand || (typeof bomRowBrand === 'function' ? bomRowBrand(it) : '')).trim();
  const model = String(it.model || '').trim();
  const cat = String(it.category || '').trim();
  const secTitle = sec ? String(sec.title || '').trim() : '';

  // 1. Explicit direct mapping in in-memory category map
  if (name && bomChallanCategoryMap[name]) return bomChallanCategoryMap[name];
  if (brand && bomChallanCategoryMap[brand]) return bomChallanCategoryMap[brand];

  // 2. Resolved master name match (brand + model -> masters.name)
  if (brand && model && typeof bomResolveItemName === 'function') {
    const resolved = bomResolveItemName(brand, model);
    if (resolved && bomChallanCategoryMap[resolved]) return bomChallanCategoryMap[resolved];
  }

  // 3. Category match
  if (cat && bomChallanCategoryMap[cat]) return bomChallanCategoryMap[cat];

  // 4. Section category match
  if (secTitle) {
    if (bomChallanCategoryMap[secTitle]) return bomChallanCategoryMap[secTitle];
    if (typeof bomResolveSectionCategory === 'function') {
      const resolvedSec = bomResolveSectionCategory(secTitle);
      if (resolvedSec && bomChallanCategoryMap[resolvedSec]) return bomChallanCategoryMap[resolvedSec];
    }
  }

  // 5. Standard Challan Categories direct name match
  const categoriesPool = (bomChallanCategoryList && bomChallanCategoryList.length) ? bomChallanCategoryList : BOM_CHALLAN_CATEGORIES_DEFAULT;
  const matchStandard = (str) => {
    if (!str) return null;
    const sLower = str.toLowerCase();
    const hit = categoriesPool.find((c) => c.toLowerCase() === sLower);
    return hit || null;
  };

  if (matchStandard(name)) return matchStandard(name);
  if (matchStandard(brand)) return matchStandard(brand);
  if (matchStandard(cat)) return matchStandard(cat);
  if (matchStandard(secTitle)) return matchStandard(secTitle);

  // 6. Substring / Keyword heuristic
  const textToSearch = `${name} ${brand} ${cat} ${secTitle}`.toLowerCase();
  if (textToSearch.includes('solar panel') || textToSearch.includes('solar penal')) return 'Solar Panel';
  if (textToSearch.includes('inverter')) return 'Inverter';
  if (textToSearch.includes('gi pipe')) return 'GI Pipe';
  if (textToSearch.includes('structure')) return 'GI Structure';
  if (textToSearch.includes('wire') || textToSearch.includes('cable')) return 'Wire Box';
  if (textToSearch.includes('earthing & la') || textToSearch.includes('earthing rod & la')) return 'Earthing & LA Kit';
  if (textToSearch.includes('earthing bag')) return 'Earthing Bag';
  if (textToSearch.includes('pvc pipe') || textToSearch.includes('cable tray')) return 'PVC Pipe';
  if (textToSearch.includes('rati') || textToSearch.includes('sand')) return 'Reti Bag';
  if (textToSearch.includes('kapchi') || textToSearch.includes('grit')) return 'Kapchi Bag';
  if (textToSearch.includes('cement')) return 'Cement Bag';
  if (textToSearch.includes('ferma') || textToSearch.includes('farma')) return 'Ferma';

  // 7. Fuzzy search over all keys in bomChallanCategoryMap
  for (const [key, mappedCat] of Object.entries(bomChallanCategoryMap)) {
    if (!key || !mappedCat) continue;
    const kLower = key.toLowerCase();
    if (name && (kLower.includes(name.toLowerCase()) || name.toLowerCase().includes(kLower))) {
      return mappedCat;
    }
    if (brand && (kLower.includes(brand.toLowerCase()) || brand.toLowerCase().includes(kLower))) {
      return mappedCat;
    }
  }

  return null;
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

// Which template row (Sr 3 = "1.5 X 1.5", Sr 4 = "2.5 X 1.5", Sr 15 =
// "1 X 1") a GI Pipe kit-item's Model text belongs under.
function bomGiPipeModelSr(modelText) {
  const match = String(modelText || '').match(/\d+(\.\d+)?/);
  const first = match ? parseFloat(match[0]) : null;
  if (first === 1.5) return 3;
  if (first === 2.5) return 4;
  if (first === 1) return 15;
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
// Returns { qtyBySr: { [sr]: number }, giPipe: { 3: {size:qty}, 4: {size:qty} }, unmappedItems: [], mappedCount: number }.
function bomComputeChallanAutoQty(sections) {
  const qtyBySr = {};
  const modelBySr = {};
  const giPipe = { 3: {}, 4: {}, 15: {} };
  const presentByCategory = {}; // category -> [{ qty, it, model }]
  const unmappedItems = [];
  let mappedCount = 0;

  (sections || []).forEach((sec) => {
    (sec.items || []).forEach((it) => {
      const qty = bomEffectiveQty(it);
      if (!qty || qty <= 0) return; // '-' / blank / 0 -> not "present" on this trip
      const category = bomGetItemChallanCategory(it, sec);
      if (!category) {
        unmappedItems.push({ item: it, secTitle: sec.title, qty });
        return;
      }

      mappedCount++;

      // Extract model: prefer it.model; if it.name is different from category, fallback to it.name or brand
      const itemModel = String(it.model || (it.name !== category ? it.name : '') || it.brand || '').trim();

      if (category === 'GI Pipe') {
        const sr = bomGiPipeModelSr(it.model) || 3;
        const pieces = bomGiPipeFeetToPieces(qty);
        Object.keys(pieces).forEach((size) => {
          giPipe[sr][size] = (giPipe[sr][size] || 0) + pieces[size];
        });
        return;
      }

      const sr = BOM_CHALLAN_CATEGORY_SR[category];
      if (!sr) return; // category exists in the map but has no template row (defensive)
      if (!presentByCategory[category]) presentByCategory[category] = [];
      presentByCategory[category].push({ qty, it, model: itemModel });
    });
  });

  Object.keys(presentByCategory).forEach((category) => {
    const list = presentByCategory[category];
    const sr = BOM_CHALLAN_CATEGORY_SR[category];
    qtyBySr[sr] = list.length === 1 ? list[0].qty : 1;
    const distinctModels = Array.from(new Set(list.map((x) => x.model).filter(Boolean)));
    if (distinctModels.length) {
      modelBySr[sr] = distinctModels.join(', ');
    }
  });

  return { qtyBySr, modelBySr, giPipe, unmappedItems, mappedCount };
}

// Writes bomComputeChallanAutoQty()'s result straight into the entry
// modal's Qty & Model <input>s
function bomApplyChallanAutoQty(sections) {
  const result = bomComputeChallanAutoQty(sections);
  const { qtyBySr, modelBySr, giPipe } = result;
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
  document.querySelectorAll('.bom-challan-model-input').forEach((inp) => {
    const sr = Number(inp.getAttribute('data-challan-tpl-model'));
    if (modelBySr && modelBySr[sr] !== undefined) {
      inp.value = modelBySr[sr];
    }
  });
  return result;
}

// ---------- "Convert into Challan" — ENTRY MODAL (software-style, NOT the Excel look) ----------
function bomRenderChallanTemplateItemsHtml(template) {
  const qtyInput = (sr, sizeLabel) => {
    const sizeAttr = sizeLabel ? ` data-challan-tpl-size="${bomEscAttr(sizeLabel)}"` : '';
    return `<input type="number" min="0" class="bom-field-input bom-challan-qty-input" data-challan-tpl-sr="${sr}"${sizeAttr}>`;
  };
  const descInput = (sr) =>
    `<input type="text" class="bom-field-input" data-challan-tpl-desc="${sr}" placeholder="Description">`;
  const modelInput = (sr, defaultModel) =>
    `<input type="text" class="bom-field-input bom-challan-model-input" data-challan-tpl-model="${sr}" value="${bomEscAttr(defaultModel || '')}" placeholder="Model / Specification">`;

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
        <td>${modelInput(it.sr, it.model)}</td>
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
          <col style="width:6%;"><col style="width:18%;"><col style="width:18%;">
          <col style="width:10%;"><col style="width:12%;"><col style="width:8%;"><col style="width:28%;">
        </colgroup>
        <thead><tr><th>Sr No.</th><th>Item Name</th><th>Model</th><th>Size</th><th>Qty.</th><th>Unit</th><th>Description</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// yyyy-mm-dd for TODAY in the browser's own local timezone — NOT
// new Date().toISOString().slice(0,10), which reads UTC and can silently
// land on the wrong calendar day (e.g. showing tomorrow's date) for any
// user west of UTC in the evening/night. Used to default the Challan
// Date field and as the "is this a future date?" comparison baseline.
function bomTodayLocalDateStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function bomRenderChallanEntryModalHtml(header, kit) {
  const { unmappedItems, mappedCount } = bomComputeChallanAutoQty(kit ? kit.sections : []);
  const mappingNoticeHtml = (unmappedItems && unmappedItems.length)
    ? `<div class="banner" style="background:rgba(231,76,60,0.12); border:1px solid var(--red); border-radius:8px; padding:10px 14px; margin:14px 0 16px; display:flex; align-items:center; gap:10px;">
        <i class="fa-solid fa-triangle-exclamation" style="color:var(--red); font-size:18px;"></i>
        <div>
          <strong style="color:var(--red); font-size:13px;">${unmappedItems.length} Unmapped BOM Item(s) Detected:</strong>
          <div style="font-size:12px; margin-top:2px; color:var(--txt);">${unmappedItems.map((u) => `<strong>${bomEsc(u.item.name || u.item.brand || 'Item')}</strong> (${bomEsc(u.secTitle || '')})`).join(', ')} are not mapped to any Challan category and were skipped during auto-fill.</div>
        </div>
      </div>`
    : `<div style="display:flex; align-items:center; gap:8px; margin:12px 0 14px; color:var(--green, #2ECC71); font-size:12.5px; font-weight:700;">
        <i class="fa-solid fa-circle-check"></i> All ${mappedCount || 'BOM'} line items mapped and quantities auto-filled successfully.
      </div>`;

  return `
    <div id="bomChallanEntryModalRoot">
      <div class="form-grid cols-2">
        <div class="field"><label>Challan No.</label><input type="text" id="bomChallanModalNo" placeholder="Challan no."></div>
        <div class="field">
          <label>Challan Date</label>
          <input type="date" id="bomChallanModalDate" value="${bomEscAttr(bomTodayLocalDateStr())}">
          <div id="bomChallanModalDateWarning" class="note" style="display:none;color:var(--red,#c0392b);margin-top:4px;">
            <i class="fa-solid fa-triangle-exclamation"></i> This is a future date — double-check before saving.
          </div>
        </div>
        <div class="field">
          <label>Order No.</label>
          <input type="text" id="bomChallanModalOrderNo" value="${bomEscAttr(header.orderNo)}" placeholder="Order no. / Customer short code" list="bomChallanModalOrderNoList" autocomplete="off">
          <datalist id="bomChallanModalOrderNoList"></datalist>
        </div>
        <div class="field"><label>Capacity (kW)</label><input type="text" id="bomChallanModalCapacity" value="${bomEscAttr(kit.kw)}"></div>
        <div class="field"><label>Name</label><input type="text" id="bomChallanModalName" value="${bomEscAttr(header.customerName)}" placeholder="Customer / Party"></div>
        <div class="field"><label>City</label><input type="text" id="bomChallanModalCity" placeholder="City"></div>
        <div class="field"><label>Vehicle No.</label><input type="text" id="bomChallanModalVehicleNo" placeholder="e.g. GJ-03-BZ-7562"></div>
      </div>
      <h4 style="margin:16px 0 8px;"><i class="fa-solid fa-list"></i> Items <span style="font-weight:400;color:var(--txt-muted);font-size:11.5px;">(fixed Challan template + any extra lines you add below)</span></h4>
      ${mappingNoticeHtml}
      ${bomRenderChallanTemplateItemsHtml(BOM_CHALLAN_TEMPLATE)}
      <div id="bomChallanExtraItemsWrap" style="margin-top:10px;">
        <div class="table-wrap">
          <table class="bom-items-form-table" id="bomChallanExtraItemsTable">
            <colgroup>
              <col style="width:6%;"><col style="width:24%;"><col style="width:16%;">
              <col style="width:14%;"><col style="width:10%;"><col style="width:24%;"><col style="width:6%;">
            </colgroup>
            <thead><tr><th>Sr No.</th><th>Item Name</th><th>Model</th><th>Qty.</th><th>Unit</th><th>Description</th><th></th></tr></thead>
            <tbody id="bomChallanExtraItemsBody"></tbody>
          </table>
        </div>
        <button type="button" class="btn btn-ghost" id="bomChallanAddItemBtn" style="margin-top:8px;"><i class="fa-solid fa-plus"></i> Add Item</button>
      </div>
      <div class="actions-row" style="margin-top:14px;">
        <button type="button" class="btn btn-ghost" id="bomChallanSaveBtn"><i class="fa-solid fa-floppy-disk"></i> Save Challan</button>
        <button type="button" class="btn btn-blue" id="bomChallanPrintBtn"><i class="fa-solid fa-print"></i> Print Challan</button>
      </div>
    </div>
  `;
}

// ---------- Extra (software-added) Challan item rows ----------
// Fixed BOM_CHALLAN_TEMPLATE rows above stay exactly as they were — this is
// an ADDITIONAL, fully free-form list appended below them, wired to
// #bomChallanExtraItemsBody. Every row here is entirely user-typed (Name/
// Model/Qty/Unit/Description, no dropdown, no auto-fill), so any item that
// doesn't fit one of the 14 fixed categories can still go on the Challan
// without touching this file's hardcoded template. Collected separately
// (bomCollectChallanExtraItems) and sent to the server as items.extra —
// see challanPdf.js's buildChallanRowPlan, which prints each into the same
// shared blank-row pool the fixed template already pads out to 26 rows
// with, so no template/print layout change was needed to support this.
let bomChallanExtraItemSeq = 0;

function bomChallanAddExtraItemRow() {
  const tbody = document.getElementById('bomChallanExtraItemsBody');
  if (!tbody) return;
  const idx = bomChallanExtraItemSeq++;
  const tr = document.createElement('tr');
  tr.dataset.extraIdx = String(idx);
  tr.innerHTML = `
    <td class="bom-challan-extra-sr">&mdash;</td>
    <td><input type="text" class="bom-field-input" data-extra-field="name" placeholder="Item name"></td>
    <td><input type="text" class="bom-field-input" data-extra-field="model" placeholder="Model"></td>
    <td><input type="number" min="0" class="bom-field-input" data-extra-field="qty" placeholder="Qty."></td>
    <td><input type="text" class="bom-field-input" data-extra-field="unit" placeholder="Nos"></td>
    <td><input type="text" class="bom-field-input" data-extra-field="desc" placeholder="Description"></td>
    <td><button type="button" class="btn btn-ghost bom-challan-extra-remove" title="Remove item"><i class="fa-solid fa-xmark"></i></button></td>
  `;
  tbody.appendChild(tr);
  const removeBtn = tr.querySelector('.bom-challan-extra-remove');
  if (removeBtn) removeBtn.addEventListener('click', () => tr.remove());
}

// Reads every extra row's current values into a plain array, skipping any
// row where BOTH Item Name and Qty were left empty (an added-then-untouched
// blank row shouldn't turn into a printed "blank" line with a Sr No wasted
// on it).
function bomCollectChallanExtraItems() {
  const rows = Array.from(document.querySelectorAll('#bomChallanExtraItemsBody tr'));
  return rows.map((tr) => {
    const get = (f) => {
      const el = tr.querySelector(`[data-extra-field="${f}"]`);
      return el ? el.value.trim() : '';
    };
    return { name: get('name'), model: get('model'), qty: get('qty'), unit: get('unit') || 'Nos', desc: get('desc') };
  }).filter((it) => it.name || it.qty);
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
  document.querySelectorAll('.bom-challan-model-input').forEach((inp) => {
    const sr = inp.getAttribute('data-challan-tpl-model');
    setVal(`${sr}|`, { model: inp.value });
  });
  document.querySelectorAll('[data-challan-tpl-desc]').forEach((inp) => {
    const sr = inp.getAttribute('data-challan-tpl-desc');
    setVal(`${sr}|`, { desc: inp.value });
  });
  return values;
}

// ---------- Challan print sheet — layout engine (CHALLAN_SPEC.md) ----------
const CHALLAN_PRINT_TOTAL_BODY_ROWS = 28;

function bomChallanBuildRowGroups(template, values) {
  const groups = [];
  let physicalRows = 0;
  let displaySr = 0;

  template.forEach((it) => {
    if (it.sizes && it.sizes.length) {
      const activeSizes = it.sizes.filter((size) => {
        const v = values[`${it.sr}|${size}`];
        return v && Number(v.qty) > 0;
      });
      if (!activeSizes.length) return; // unused this trip — zero rows, no Sr No consumed
      displaySr += 1;
      groups.push({ sr: it.sr, displaySr, item: it, sizes: activeSizes, rowCount: activeSizes.length, blank: false });
      physicalRows += activeSizes.length;
      return;
    }
    const v = values[`${it.sr}|`];
    if (!v || !v.qty || Number(v.qty) <= 0) return; // ONLY include items with qty > 0
    displaySr += 1;
    groups.push({ sr: it.sr, displaySr, item: it, rowCount: 1, blank: false });
    physicalRows += 1;
  });

  // Extra software-added items (if any)
  const extraItems = Array.isArray(values && values.extra) ? values.extra : [];
  extraItems.forEach((extra) => {
    if (!extra || !extra.qty || Number(extra.qty) <= 0) return;
    displaySr += 1;
    groups.push({ sr: null, displaySr, item: extra, isExtra: true, rowCount: 1, blank: false });
    physicalRows += 1;
  });

  while (physicalRows < CHALLAN_PRINT_TOTAL_BODY_ROWS) {
    displaySr += 1;
    groups.push({ sr: null, displaySr, item: null, rowCount: 1, blank: true });
    physicalRows += 1;
  }
  return groups;
}

// Renders rows 8–35 (the item table body) from the row groups above
function bomRenderChallanBodyRowsHtml(groups, values) {
  const getQty = (sr, size, extra) => {
    if (extra) return extra.qty || '';
    return (values[`${sr}|${size || ''}`] && values[`${sr}|${size || ''}`].qty) || '';
  };
  const getDesc = (sr, extra) => {
    if (extra) return extra.desc || '';
    return (values[`${sr}|`] && values[`${sr}|`].desc) || '';
  };
  const getModel = (sr, it, extra) => {
    if (extra) return extra.model || '';
    return (values[`${sr}|`] && values[`${sr}|`].model) || (it && it.model) || '';
  };

  return groups.map((g) => {
    if (g.blank) {
      return `
      <tr class="bom-challan-row bom-challan-row-blank">
        <td class="bom-c-sr">${g.displaySr}</td>
        <td class="bom-c-name" colspan="3"></td>
        <td class="bom-c-qtylabel"></td>
        <td class="bom-c-qtyunit"></td>
        <td class="bom-c-desc"></td>
      </tr>`;
    }
    const it = g.item;
    if (g.sizes && g.sizes.length) { // g.sizes = only the ACTIVE feet-values for this trip
      const desc = getDesc(it.sr);
      return g.sizes.map((size, i) => {
        const leadCells = i === 0
          ? `<td class="bom-c-sr" rowspan="${g.sizes.length}">${g.displaySr}</td>
             <td class="bom-c-name" rowspan="${g.sizes.length}">${bomEsc(it.name)}</td>
             <td class="bom-c-model" rowspan="${g.sizes.length}">${bomEsc(it.model || '')}</td>`
          : '';
        const descCell = i === 0
          ? `<td class="bom-c-desc" rowspan="${g.sizes.length}">${bomEsc(desc)}</td>`
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

    const modelText = getModel(it ? it.sr : null, it, g.isExtra ? it : null);
    if (modelText) {
      return `
      <tr class="bom-challan-row">
        <td class="bom-c-sr">${g.displaySr}</td>
        <td class="bom-c-name">${bomEsc(it.name)}</td>
        <td class="bom-c-model" colspan="2">${bomEsc(modelText)}</td>
        <td class="bom-c-qtylabel">${bomEsc(getQty(it ? it.sr : null, null, g.isExtra ? it : null))}</td>
        <td class="bom-c-qtyunit">${bomEsc(it.unit || 'Nos')}</td>
        <td class="bom-c-desc">${bomEsc(getDesc(it ? it.sr : null, g.isExtra ? it : null))}</td>
      </tr>`;
    }

    return `
      <tr class="bom-challan-row">
        <td class="bom-c-sr">${g.displaySr}</td>
        <td class="bom-c-name" colspan="3">${bomEsc(it.name)}</td>
        <td class="bom-c-qtylabel">${bomEsc(getQty(it ? it.sr : null, null, g.isExtra ? it : null))}</td>
        <td class="bom-c-qtyunit">${bomEsc(it.unit || 'Nos')}</td>
        <td class="bom-c-desc">${bomEsc(getDesc(it ? it.sr : null, g.isExtra ? it : null))}</td>
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
  const groups = bomChallanBuildRowGroups(BOM_CHALLAN_TEMPLATE, templateValues);
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

// Global helper to open and print Challan from Sales or any other page
window.openChallanFromSalesData = async function(salesData) {
  const customerName = salesData.customer || salesData.customerName || '';
  const orderNo = salesData.orderNo || customerName || '';
  let challanNo = salesData.chalanNo || salesData.challanNo || '';
  const challanDate = salesData.chalanDate || salesData.challanDate || (typeof bomTodayLocalDateStr === 'function' ? bomTodayLocalDateStr() : new Date().toISOString().slice(0, 10));
  const lines = salesData.lines || [];

  // Auto-fetch next sequential Challan Number if not provided
  if (!challanNo) {
    try {
      const nextData = await window.Api.get('/challan/next-no', { silent: true });
      if (nextData && nextData.nextNo) challanNo = nextData.nextNo;
    } catch (e) {
      /* ignore */
    }
  }

  const sections = [{
    title: 'Sales Items',
    items: lines.map((l) => {
      const nameParts = [l.brand, l.watt ? l.watt + 'W' : '', l.model].filter(Boolean);
      const name = nameParts.length ? nameParts.join(' ') : (l.cat || 'Item');
      const qty = l.qty != null ? Number(l.qty) : (Array.isArray(l.serials) ? l.serials.length : 1);
      const serials = Array.isArray(l.serials) ? l.serials.join('\n') : (l.serials || '');
      return {
        name,
        category: l.cat || '',
        qty,
        serials
      };
    })
  }];

  const header = { customerName, orderNo, challanNo, challanDate };
  const kit = { kw: '', sections };

  if (typeof bomLoadChallanCategoryMap === 'function') await bomLoadChallanCategoryMap();
  const modalHtml = bomRenderChallanEntryModalHtml(header, kit);

  window.openModal('Generate Challan', modalHtml, { fullscreen: true });

  if (typeof bomApplyChallanAutoQty === 'function') bomApplyChallanAutoQty(sections);

  const modalNo = document.getElementById('bomChallanModalNo');
  const modalDate = document.getElementById('bomChallanModalDate');
  const modalOrderNo = document.getElementById('bomChallanModalOrderNo');
  const modalCapacity = document.getElementById('bomChallanModalCapacity');
  const modalName = document.getElementById('bomChallanModalName');
  const modalCity = document.getElementById('bomChallanModalCity');
  const modalVehicleNo = document.getElementById('bomChallanModalVehicleNo');
  const saveBtn = document.getElementById('bomChallanSaveBtn');
  const printBtn = document.getElementById('bomChallanPrintBtn');
  const addItemBtn = document.getElementById('bomChallanAddItemBtn');

  if (modalNo && !modalNo.value.trim() && challanNo) modalNo.value = challanNo;

  if (addItemBtn) addItemBtn.addEventListener('click', bomChallanAddExtraItemRow);

  function buildPayload() {
    return {
      challanNo: modalNo ? modalNo.value.trim() : '',
      challanDate: modalDate ? modalDate.value : '',
      orderNo: modalOrderNo ? modalOrderNo.value : '',
      capacityKw: modalCapacity ? modalCapacity.value : '',
      customerName: modalName ? modalName.value : '',
      city: modalCity ? modalCity.value : '',
      vehicleNo: modalVehicleNo ? modalVehicleNo.value : '',
      installerName: '',
      fabricatorName: '',
      dealerName: '',
      items: Object.assign({}, bomCollectChallanTemplateValues(), { extra: bomCollectChallanExtraItems() }),
      panelSerials: [],
    };
  }

  function syncBackToSalesForm(payload) {
    const saleChalanNoEl = document.getElementById('saleChalanNo');
    const saleChalanDateEl = document.getElementById('saleChalanDate');
    if (saleChalanNoEl && payload.challanNo) saleChalanNoEl.value = payload.challanNo;
    if (saleChalanDateEl && payload.challanDate) saleChalanDateEl.value = payload.challanDate;
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const payload = buildPayload();
      if (!payload.challanNo) {
        window.openModal('Validation Error', '<p>Challan No. is required.</p>');
        return;
      }
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
      try {
        await window.Api.post('/challan', payload);
        syncBackToSalesForm(payload);
        if (window.showToast) window.showToast(`Challan #${payload.challanNo} saved & linked to Sales entry!`, 'success');
        window.closeModal();
      } catch (err) {
        window.openModal('Save Failed', `<p>${(err && err.message) || 'Could not save the Challan.'}</p>`);
      } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Challan';
      }
    });
  }

  if (printBtn) {
    printBtn.addEventListener('click', async () => {
      const payload = buildPayload();
      if (!payload.challanNo) {
        window.openModal('Validation Error', '<p>Challan No. is required.</p>');
        return;
      }
      const pdfWindow = window.open('', '_blank');
      if (pdfWindow) {
        pdfWindow.document.write(`<!DOCTYPE html><html><head><title>Preparing Challan…</title><style>body{background:#0b0f17;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;}</style></head><body><h3>Preparing Challan PDF...</h3></body></html>`);
        pdfWindow.document.close();
      }
      printBtn.disabled = true;
      printBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving & Preparing PDF...';
      try {
        const saved = await window.Api.post('/challan', payload);
        syncBackToSalesForm(payload);
        const pdfUrl = `${window.API_BASE}/challan/${saved.id}/pdf`;
        const abortCtrl = new AbortController();
        const timeoutTimer = setTimeout(() => abortCtrl.abort(), 35000);
        let pdfRes;
        try {
          pdfRes = await fetch(pdfUrl, { signal: abortCtrl.signal });
        } finally {
          clearTimeout(timeoutTimer);
        }
        if (!pdfRes.ok) throw new Error('Could not generate Challan PDF.');
        const pdfBlob = await pdfRes.blob();
        const blobUrl = URL.createObjectURL(pdfBlob);
        if (pdfWindow && !pdfWindow.closed) {
          pdfWindow.location.href = blobUrl;
        } else {
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = `challan-${saved.id}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
        if (window.showToast) window.showToast(`Challan #${payload.challanNo} saved & opened for print.`, 'success');
      } catch (err) {
        if (pdfWindow && !pdfWindow.closed) pdfWindow.close();
        window.openModal('Print Notice', `<p>${(err && err.message) || 'PDF generation failed.'}</p>`);
      } finally {
        printBtn.disabled = false;
        printBtn.innerHTML = '<i class="fa-solid fa-print"></i> Print Challan';
      }
    });
  }
};

// Global helper to print any Challan by its Number from anywhere (Ledger, Register, etc.)
window.printChallanByNo = async function(challanNo) {
  if (!challanNo || challanNo === '-') {
    window.openModal('Notice', '<p>No Challan Number attached to this entry.</p>');
    return;
  }
  const pdfWindow = window.open('', '_blank');
  if (pdfWindow) {
    pdfWindow.document.write(`<!DOCTYPE html><html><head><title>Loading Challan #${challanNo}…</title><style>body{background:#0b0f17;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;}</style></head><body><h3>Loading Challan #${challanNo} PDF...</h3></body></html>`);
    pdfWindow.document.close();
  }
  try {
    const pdfUrl = `${window.API_BASE}/challan/by-no/${encodeURIComponent(challanNo)}/pdf`;
    const abortCtrl = new AbortController();
    const timeoutTimer = setTimeout(() => abortCtrl.abort(), 35000);
    let pdfRes;
    try {
      pdfRes = await fetch(pdfUrl, { signal: abortCtrl.signal });
    } finally {
      clearTimeout(timeoutTimer);
    }
    if (!pdfRes.ok) throw new Error(`Could not generate PDF for Challan #${challanNo}.`);
    const pdfBlob = await pdfRes.blob();
    const blobUrl = URL.createObjectURL(pdfBlob);
    if (pdfWindow && !pdfWindow.closed) {
      pdfWindow.location.href = blobUrl;
    } else {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `challan-${challanNo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  } catch (err) {
    if (pdfWindow && !pdfWindow.closed) pdfWindow.close();
    window.openModal('Print Failed', `<p>${(err && err.message) || 'Could not load Challan PDF.'}</p>`);
  }
};