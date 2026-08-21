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

// Helper for Animated Glowing Solar PDF Loading Window
function getChallanPdfLoadingHtml(title, subtitle) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title || 'Preparing Challan…'}</title>
  <style>
    body {
      margin: 0;
      background: #0b0f17;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      overflow: hidden;
    }
    .card {
      background: rgba(18, 24, 38, 0.88);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 36px 44px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(59, 142, 208, 0.15);
      backdrop-filter: blur(12px);
    }
    .spinner-wrap {
      position: relative;
      width: 64px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .spinner-wrap::before, .spinner-wrap::after {
      content: '';
      position: absolute;
      border-radius: 50%;
    }
    .spinner-wrap::before {
      inset: 0;
      border: 3.5px solid transparent;
      border-top-color: #3b8ed0;
      border-right-color: #3b8ed0;
      animation: spin 0.9s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite;
      box-shadow: 0 0 16px rgba(59, 142, 208, 0.45);
    }
    .spinner-wrap::after {
      inset: 7px;
      border: 3.5px solid transparent;
      border-bottom-color: #ffb020;
      border-left-color: #ffb020;
      animation: spin-rev 0.7s cubic-bezier(0.55, 0.15, 0.45, 0.85) infinite;
      box-shadow: 0 0 12px rgba(255, 176, 32, 0.45);
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes spin-rev { to { transform: rotate(-360deg); } }
    h3 { margin: 0; font-size: 18px; font-weight: 700; color: #f8fafc; letter-spacing: 0.5px; }
    p { margin: 0; font-size: 13px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner-wrap"></div>
    <h3>${title || 'Preparing Challan PDF...'}</h3>
    <p>${subtitle || 'Compiling Landscape A4 Dual Copy…'}</p>
  </div>
</body>
</html>`;
}

// Convert arbitrary Date string to ISO YYYY-MM-DD
function toISODateStr(dStr) {
  if (!dStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return dStr;
  const parts = dStr.split('-');
  if (parts.length === 3 && parts[0].length <= 2 && parts[2].length === 4) {
    return `${parts[2]}-${String(parts[1]).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
  }
  return dStr;
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
  const nameInput = (sr, defaultName) =>
    `<input type="text" class="bom-field-input bom-challan-name-input" data-challan-tpl-name="${sr}" value="${bomEscAttr(defaultName || '')}" placeholder="Item Name">`;
  const unitInput = (sr, defaultUnit) =>
    `<input type="text" class="bom-field-input bom-challan-unit-input" data-challan-tpl-unit="${sr}" value="${bomEscAttr(defaultUnit || 'Nos')}" style="width:65px; text-align:center;">`;

  const rows = template.map((it) => {
    if (it.sizes && it.sizes.length) {
      return it.sizes.map((size, i) => {
        const leadCells = i === 0
          ? `<td rowspan="${it.sizes.length}">${it.sr}</td>
             <td rowspan="${it.sizes.length}">${nameInput(it.sr, it.name)}</td>
             <td rowspan="${it.sizes.length}">${modelInput(it.sr, it.model)}</td>`
          : '';
        const descCell = i === 0 ? `<td rowspan="${it.sizes.length}">${descInput(it.sr)}</td>` : '';
        const delCell = i === 0
          ? `<td rowspan="${it.sizes.length}" style="text-align:center;">
               <button type="button" class="btn btn-ghost bom-mini-btn" onclick="document.querySelectorAll('tr[data-gi-sr=\\'${it.sr}\\']').forEach(r=>r.remove())" style="color:var(--red); padding:4px 8px;" title="Remove GI Pipe group"><i class="fa-solid fa-trash"></i></button>
             </td>`
          : '';
        return `
      <tr data-gi-sr="${it.sr}">
        ${leadCells}
        <td class="bom-challan-size-cell">${bomEsc(size)}</td>
        <td>${qtyInput(it.sr, size)}</td>
        <td>${bomEsc(it.unit)}</td>
        ${descCell}
        ${delCell}
      </tr>`;
      }).join('');
    }
    return `
      <tr>
        <td>${it.sr}</td>
        <td>${nameInput(it.sr, it.name)}</td>
        <td>${modelInput(it.sr, it.model)}</td>
        <td class="bom-challan-size-cell">&mdash;</td>
        <td>${qtyInput(it.sr)}</td>
        <td>${unitInput(it.sr, it.unit)}</td>
        <td>${descInput(it.sr)}</td>
        <td style="text-align:center;">
          <button type="button" class="btn btn-ghost bom-mini-btn" onclick="this.closest('tr').remove()" style="color:var(--red); padding:4px 8px;" title="Remove this item"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="table-wrap">
      <table class="bom-items-form-table">
        <colgroup>
          <col style="width:5%;"><col style="width:20%;"><col style="width:18%;">
          <col style="width:9%;"><col style="width:10%;"><col style="width:8%;"><col style="width:24%;"><col style="width:6%;">
        </colgroup>
        <thead><tr><th>Sr No.</th><th>Item Name</th><th>Model</th><th>Size</th><th>Qty.</th><th>Unit</th><th>Description</th><th></th></tr></thead>
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

function bomRenderChallanEntryModalHtml(header, kit, opts) {
  opts = opts || {};
  const autoResult = bomComputeChallanAutoQty(kit ? kit.sections : []);
  const { qtyBySr, modelBySr, giPipe, unmappedItems, mappedCount } = autoResult;

  let templateToRender = BOM_CHALLAN_TEMPLATE;
  const isOnlyActive = !!(opts.onlyActive || opts.salesMode);

  if (isOnlyActive) {
    const activeTemplate = BOM_CHALLAN_TEMPLATE.filter((it) => {
      if (it.sizes && it.sizes.length) {
        const bucket = giPipe[it.sr];
        return bucket && Object.values(bucket).some((v) => Number(v) > 0);
      }
      return qtyBySr[it.sr] != null && Number(qtyBySr[it.sr]) > 0;
    });
    if (activeTemplate.length) {
      templateToRender = activeTemplate;
    }
  }

  const mappingNoticeHtml = (unmappedItems && unmappedItems.length)
    ? `<div class="banner" style="background:rgba(231,76,60,0.12); border:1px solid var(--red); border-radius:8px; padding:10px 14px; margin:14px 0 16px; display:flex; align-items:center; gap:10px;">
        <i class="fa-solid fa-triangle-exclamation" style="color:var(--red); font-size:18px;"></i>
        <div>
          <strong style="color:var(--red); font-size:13px;">${unmappedItems.length} Custom / Unmapped Item(s) in this Order:</strong>
          <div style="font-size:12px; margin-top:2px; color:var(--txt);">${unmappedItems.map((u) => `<strong>${bomEsc(u.item.name || u.item.brand || 'Item')}</strong> (${u.qty || 1} Nos)`).join(', ')} added to Extra Items below.</div>
        </div>
      </div>`
    : `<div style="display:flex; align-items:center; gap:8px; margin:12px 0 14px; color:var(--green, #2ECC71); font-size:12.5px; font-weight:700;">
        <i class="fa-solid fa-circle-check"></i> All ${mappedCount || (kit && kit.sections && kit.sections.length ? kit.sections.length : 'order')} line items mapped and quantities auto-filled successfully.
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
        <div class="field"><label>Capacity (kW)</label><input type="text" id="bomChallanModalCapacity" value="${bomEscAttr(kit.kw || '')}"></div>
        <div class="field"><label>Name</label><input type="text" id="bomChallanModalName" value="${bomEscAttr(header.customerName)}" placeholder="Customer / Party"></div>
        <div class="field"><label>City</label><input type="text" id="bomChallanModalCity" placeholder="City"></div>
        <div class="field"><label>Vehicle No.</label><input type="text" id="bomChallanModalVehicleNo" placeholder="e.g. GJ-03-BZ-7562"></div>
        <div class="field"><label>Vehicle No. 2 (Optional)</label><input type="text" id="bomChallanModalVehicleNo2" placeholder="e.g. GJ-01-AB-1234 (Second vehicle if multi-trip)"></div>
      </div>

      <div style="display:flex; align-items:center; justify-content:space-between; margin:18px 0 10px; flex-wrap:wrap; gap:8px;">
        <h4 style="margin:0;"><i class="fa-solid fa-list"></i> Items <span style="font-weight:400;color:var(--txt-muted);font-size:11.5px;">(${isOnlyActive ? 'Items in this order only' : 'full 14-category Challan template'} + any extra lines)</span></h4>
        <button type="button" class="btn btn-ghost" id="bomChallanToggleTemplateBtn" style="padding:4px 10px; font-size:11.5px;">
          <i class="fa-solid fa-table-list"></i> ${templateToRender.length < BOM_CHALLAN_TEMPLATE.length ? 'Show All 14 Categories' : 'Show Only Active Items'}
        </button>
      </div>

      ${mappingNoticeHtml}
      <div id="bomChallanTemplateContainer">
        ${bomRenderChallanTemplateItemsHtml(templateToRender)}
      </div>

      <div id="bomChallanExtraItemsWrap" style="margin-top:12px;">
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
        <button type="button" class="btn btn-ghost" id="bomChallanAddItemBtn" style="margin-top:8px;"><i class="fa-solid fa-plus"></i> Add Extra Item</button>
      </div>

      <div class="actions-row" style="margin-top:18px;">
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
  document.querySelectorAll('.bom-challan-name-input').forEach((inp) => {
    const sr = inp.getAttribute('data-challan-tpl-name');
    setVal(`${sr}|`, { name: inp.value });
  });
  document.querySelectorAll('.bom-challan-unit-input').forEach((inp) => {
    const sr = inp.getAttribute('data-challan-tpl-unit');
    setVal(`${sr}|`, { unit: inp.value });
  });
  document.querySelectorAll('[data-challan-tpl-desc]').forEach((inp) => {
    const sr = inp.getAttribute('data-challan-tpl-desc');
    setVal(`${sr}|`, { desc: inp.value });
  });
  return values;
}

// ---------- Challan print sheet — layout engine (CHALLAN_SPEC.md) ----------
const CHALLAN_PRINT_TOTAL_BODY_ROWS = 25;

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
        <td class="bom-c-name"></td>
        <td class="bom-c-model" colspan="2"></td>
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

    const itName = it ? (it.name || '') : '';
    const itNameLen = itName.length;
    const itNameStyle = itNameLen > 30 ? 'font-size: 8pt !important; line-height: 1.1;' : (itNameLen > 20 ? 'font-size: 8.5pt !important;' : '');

    const itModLen = String(modelText || '').length;
    const itModStyle = itModLen > 24 ? 'font-size: 8pt !important; line-height: 1.1;' : (itModLen > 15 ? 'font-size: 8.5pt !important;' : '');

    const itDescLen = String(descVal || '').length;
    const itDescStyle = itDescLen > 28 ? 'font-size: 8pt !important; line-height: 1.1;' : '';

    return `
      <tr class="bom-challan-row">
        <td class="bom-c-sr">${g.displaySr}</td>
        <td class="bom-c-name" style="${itNameStyle}">${bomEsc(itName)}</td>
        <td class="bom-c-model" colspan="2" style="${itModStyle}">${bomEsc(modelText)}</td>
        <td class="bom-c-qtylabel">${bomEsc(qtyVal)}</td>
        <td class="bom-c-qtyunit">${bomEsc(unitVal)}</td>
        <td class="bom-c-desc" style="${itDescStyle}">${bomEsc(descVal)}</td>
      </tr>`;
  }).join('');
}

function bomFormatChallanDate(rawDate) {
  if (!rawDate) return '';
  const str = String(rawDate).trim();
  const m = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m) {
    const dd = m[3].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const yyyy = m[1];
    return `${dd}-${mm}-${yyyy}`;
  }
  const m2 = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m2) {
    const dd = m2[1].padStart(2, '0');
    const mm = m2[2].padStart(2, '0');
    const yyyy = m2[3];
    return `${dd}-${mm}-${yyyy}`;
  }
  return str;
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
  const rawCap = (kit && kit.kw) ? kit.kw : (header.capacity || '');
  const capText = rawCap ? (String(rawCap).trim().toLowerCase().endsWith('kw') ? String(rawCap).trim() : `${rawCap} kW`) : '';
  const formattedDate = bomFormatChallanDate(header.challanDate);
  const nameLen = (header.customerName || '').length;
  let nameStyle = '';
  if (nameLen > 38) {
    nameStyle = 'font-size: 8pt !important; line-height: 1.1;';
  } else if (nameLen > 24) {
    nameStyle = 'font-size: 8.5pt !important; line-height: 1.15;';
  }
  return `
    <tr class="bom-challan-row1">
      <td class="bom-challan-logo-cell" colspan="4" rowspan="2">
        <img class="bom-challan-logo" src="assets/challan_logo.png" alt="Eco Green Solar">
      </td>
      <td class="bom-challan-title-cell ${titleClass}" colspan="3">${bomEsc(copyLabel)}</td>
    </tr>
    <tr class="bom-challan-row2">
      <td class="bom-challan-field-cell" colspan="3"><b>Challan No.:</b> ${bomEsc(header.challanNo)}</td>
    </tr>
    <tr class="bom-challan-row3">
      <td class="bom-challan-gst-cell" colspan="4">GST NO. 24AAHFG9142N1Z1</td>
      <td class="bom-challan-field-cell" colspan="3"><b>Challan Date:</b> ${bomEsc(formattedDate)}</td>
    </tr>
    <tr class="bom-challan-row4">
      <td class="bom-challan-company-cell" colspan="4">Green Energy</td>
      <td class="bom-challan-field-cell" colspan="3"><b>Order No.:</b> ${bomEsc(header.orderNo)}</td>
    </tr>
    <tr class="bom-challan-row5">
      <td class="bom-challan-addr-cell" colspan="4">
        Plot No &ndash; 4,5,6, Gajanand Ind. Area, Rev. S. No.: 183<br>
        Nr R K Exotica,To.: Chhapra&ndash;360021 Ta. Metoda(Rajkot)
      </td>
      <td class="bom-challan-field-cell" colspan="3"><b>Capacity :</b> ${bomEsc(capText)}</td>
    </tr>
    <tr class="bom-challan-row6">
      <td class="bom-challan-namelabel-cell">Name:</td>
      <td class="bom-challan-nameval-cell" colspan="3" style="${nameStyle}">${bomEsc(header.customerName)}</td>
      <td class="bom-challan-citylabel-cell" colspan="2">City:</td>
      <td class="bom-challan-cityval-cell">${bomEsc(header.city)}</td>
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

// Renders rows 36–37 — the footer with ZERO vertical borders and clean write-in line
function bomRenderChallanFooterRowsHtml(header) {
  const v1 = (header.vehicleNo || '').trim();
  const v2 = (header.vehicleNo2 || '').trim();
  const vText = [v1, v2].filter(Boolean).join(' / ') || '—';
  const vStyle = vText.length > 20
    ? 'font-size: 8.5pt !important; letter-spacing: -0.2px;'
    : (vText.length > 14 ? 'font-size: 10pt !important;' : 'font-size: 12.5pt !important;');
  return `
    <tr class="bom-challan-footer-row1">
      <td class="bom-challan-footer-blank-left" colspan="2"></td>
      <td class="bom-challan-footer-vehicle" colspan="4" style="${vStyle} white-space:nowrap !important; overflow:hidden !important;">${bomEsc(vText)}</td>
      <td class="bom-challan-footer-blank-right" colspan="1"></td>
    </tr>
    <tr class="bom-challan-footer-row2">
      <td class="bom-challan-footer-issuedby" colspan="2">Issued by</td>
      <td class="bom-challan-footer-caption" colspan="4">Vehicle No.</td>
      <td class="bom-challan-footer-receivedby" colspan="1">Received by</td>
    </tr>
  `;
}

// Assembles one full copy (Customer or Company) as a single flat <table>
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

// Top-level Challan sheet with single center dashed cut-line
function bomRenderChallanPrintSheetHtml(header, kit, templateValues) {
  return `
    <div class="bom-challan-sheet" id="bomChallanSheet">
      <div class="bom-challan-copy bom-challan-copy-customer">
        ${bomRenderChallanPrintSheetHalfHtml(header, kit, 'Customer Copy', templateValues, false)}
      </div>
      <div class="bom-challan-gutter">
        <div class="bom-challan-cutline"></div>
      </div>
      <div class="bom-challan-copy bom-challan-copy-company">
        ${bomRenderChallanPrintSheetHalfHtml(header, kit, 'Company Copy', templateValues, true)}
      </div>
    </div>
  `;
}

// Direct HTML generator for ANY saved Challan object or custom payload
function bomRenderDirectChallanPrintSheetHtml(challanData) {
  const header = {
    challanNo: challanData.challanNo || challanData.challan_no || '',
    challanDate: challanData.challanDate || challanData.challan_date || '',
    customerName: challanData.customerName || challanData.customer_name || '',
    orderNo: challanData.orderNo || challanData.order_no || '',
    city: challanData.city || '',
    vehicleNo: challanData.vehicleNo || challanData.vehicle_no || '',
    vehicleNo2: challanData.vehicleNo2 || challanData.vehicle_no_2 || '',
  };
  const kit = {
    kw: challanData.capacity || challanData.capacity_kw || challanData.kit_kw || challanData.kw || (challanData.header && (challanData.header.capacity || challanData.header.capacity_kw)) || ''
  };

  let rawItems = [];
  if (Array.isArray(challanData.items) && challanData.items.length) {
    rawItems = challanData.items;
  } else if (Array.isArray(challanData.lines) && challanData.lines.length) {
    rawItems = challanData.lines.map((l) => ({
      item_name: [l.brand, l.watt ? l.watt + 'W' : '', l.model].filter(Boolean).join(' ') || l.cat || 'Item',
      model: l.model || '',
      qty: l.qty != null ? Number(l.qty) : (Array.isArray(l.serials) ? l.serials.length : 1),
      unit: l.unit || 'Nos',
      description: l.desc || l.description || ''
    }));
  }

  const rowsHtml = [];
  let displaySr = 0;
  let physicalRows = 0;

  rawItems.forEach((it) => {
    const qtyNum = Number(it.qty !== undefined ? it.qty : (it.quantity !== undefined ? it.quantity : 0));
    const name = (it.item_name || it.name || '').trim();
    if (qtyNum <= 0 && !name) return; // skip empty
    displaySr += 1;
    physicalRows += 1;
    const model = (it.model || '').trim();
    const unit = (it.unit || 'Nos').trim();
    const itNameLen = name.length;
    const itNameStyle = itNameLen > 30 ? 'font-size: 8pt !important; line-height: 1.1;' : (itNameLen > 20 ? 'font-size: 8.5pt !important;' : '');
    
    const itModLen = model.length;
    const itModStyle = itModLen > 24 ? 'font-size: 8pt !important; line-height: 1.1;' : (itModLen > 15 ? 'font-size: 8.5pt !important;' : '');

    const itDescLen = desc.length;
    const itDescStyle = itDescLen > 28 ? 'font-size: 8pt !important; line-height: 1.1;' : '';

    rowsHtml.push(`
      <tr class="bom-challan-row">
        <td class="bom-c-sr">${displaySr}</td>
        <td class="bom-c-name" style="${itNameStyle}">${bomEsc(name)}</td>
        <td class="bom-c-model" colspan="2" style="${itModStyle}">${bomEsc(model)}</td>
        <td class="bom-c-qtylabel">${qtyNum > 0 ? qtyNum : ''}</td>
        <td class="bom-c-qtyunit">${bomEsc(unit)}</td>
        <td class="bom-c-desc" style="${itDescStyle}">${bomEsc(desc)}</td>
      </tr>
    `);
  });

  while (physicalRows < CHALLAN_PRINT_TOTAL_BODY_ROWS) {
    displaySr += 1;
    physicalRows += 1;
    rowsHtml.push(`
      <tr class="bom-challan-row bom-challan-row-blank">
        <td class="bom-c-sr">${displaySr}</td>
        <td class="bom-c-name"></td>
        <td class="bom-c-model" colspan="2"></td>
        <td class="bom-c-qtylabel"></td>
        <td class="bom-c-qtyunit"></td>
        <td class="bom-c-desc"></td>
      </tr>
    `);
  }

  const bodyRows = rowsHtml.join('');

  const renderHalf = (copyLabel, isCompanyCopy) => `
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
        ${bodyRows}
        ${bomRenderChallanFooterRowsHtml(header)}
      </tbody>
    </table>
  `;

  return `
    <div class="bom-challan-sheet" id="bomChallanSheet">
      <div class="bom-challan-copy bom-challan-copy-customer">
        ${renderHalf('Customer Copy', false)}
      </div>
      <div class="bom-challan-gutter">
        <div class="bom-challan-cutline"></div>
      </div>
      <div class="bom-challan-copy bom-challan-copy-company">
        ${renderHalf('Company Copy', true)}
      </div>
    </div>
  `;
}

// Global instant Challan print function using an isolated iframe for pure Landscape rendering
window.printChallanDirectly = function(challanData) {
  let iframe = document.getElementById('bomChallanPrintFrame');
  if (iframe) {
    iframe.remove();
  }
  iframe = document.createElement('iframe');
  iframe.id = 'bomChallanPrintFrame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const sheetHtml = bomRenderDirectChallanPrintSheetHtml(challanData);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Challan #${bomEsc(challanData.challanNo || challanData.challan_no || '')}</title>
  <style>
    @page {
      size: 297mm 210mm;
      margin: 12mm 5mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      width: 100%;
      height: 100%;
      font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif;
      color: #000000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .bom-challan-sheet {
      width: 282mm;
      margin: 0 auto;
      background: #ffffff;
      display: flex;
      align-items: stretch;
      justify-content: space-between;
      box-sizing: border-box;
      font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif;
      color: #000000;
      padding: 0;
    }
    .bom-challan-copy {
      flex: 0 0 137mm;
      width: 137mm;
      max-width: 137mm;
      box-sizing: border-box;
    }
    .bom-challan-gutter {
      flex: 0 0 8mm;
      width: 8mm;
      position: relative;
      display: flex;
      justify-content: center;
      align-self: stretch;
      box-sizing: border-box;
    }
    .bom-challan-cutline {
      width: 0;
      height: 100%;
      border-left: 1px dashed #000000;
      margin: 0 auto;
    }
    .bom-challan-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      background: #ffffff;
      font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif;
      color: #000000;
      border: 2px solid #000000;
      box-sizing: border-box;
    }
    .bom-challan-col-sr { width: 8.5%; }
    .bom-challan-col-name { width: 23%; }
    .bom-challan-col-model { width: 13.5%; }
    .bom-challan-col-modelcont { width: 9%; }
    .bom-challan-col-qtylabel { width: 6.5%; }
    .bom-challan-col-qtyunit { width: 6.5%; }
    .bom-challan-col-desc { width: 33%; }

    .bom-challan-table th,
    .bom-challan-table td {
      border: 1px solid #000000;
      vertical-align: middle;
      background: #ffffff;
      color: #000000;
      padding: 0 2px;
      overflow: hidden;
      box-sizing: border-box;
    }

    .bom-challan-row1 { height: 18pt; }
    .bom-challan-row2 { height: 18pt; }
    .bom-challan-row3 { height: 16pt; }
    .bom-challan-row4 { height: 18pt; }
    .bom-challan-row5 { height: 20pt; }
    .bom-challan-row6 { height: 25pt; }

    .bom-challan-table td.bom-challan-logo-cell,
    .bom-challan-table td.bom-challan-gst-cell,
    .bom-challan-table td.bom-challan-company-cell,
    .bom-challan-table td.bom-challan-addr-cell {
      border: none !important;
      text-align: center;
    }
    .bom-challan-logo-cell {
      padding: 2px 4px !important;
      text-align: center !important;
      vertical-align: middle !important;
    }
    .bom-challan-logo {
      display: block !important;
      width: 92% !important;
      max-width: 92% !important;
      height: 32pt !important;
      max-height: 32pt !important;
      object-fit: contain !important;
      object-position: center !important;
      margin: 0 auto !important;
    }
    .bom-challan-gst-cell {
      font-size: 9.5pt;
      font-weight: 700;
      text-align: center !important;
      padding: 0 2px !important;
    }
    .bom-challan-company-cell {
      font-size: 15pt;
      font-weight: 700;
      text-align: center !important;
      padding: 0 2px !important;
    }
    .bom-challan-addr-cell {
      font-size: 7pt;
      font-weight: 400;
      line-height: 1.15;
      text-align: center !important;
      padding: 0 2px !important;
    }

    td.bom-challan-title-cell {
      font-size: 13pt;
      font-weight: 700;
      text-align: center;
      vertical-align: middle;
      border: 1px solid #000000;
    }
    .bom-challan-title-normal { background: #ffffff; color: #000000; }
    .bom-challan-title-inverse {
      background: #000000 !important;
      color: #ffffff !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .bom-challan-field-cell {
      font-size: 9.5pt;
      font-weight: 400;
      text-align: left;
      padding: 0 4px !important;
      border: 1px solid #000000;
    }
    .bom-challan-field-cell b { font-weight: 700; }

    .bom-challan-namelabel-cell {
      font-size: 9.5pt;
      font-weight: 700;
      text-align: center;
      border: 1px solid #000000;
      padding: 0 1px !important;
      white-space: nowrap !important;
    }

    .bom-challan-nameval-cell {
      font-size: 9.5pt;
      font-weight: 700;
      text-align: left;
      padding: 0 4px !important;
      border: 1px solid #000000;
      line-height: 1.15;
    }

    .bom-challan-citylabel-cell {
      font-size: 9.5pt;
      font-weight: 700;
      text-align: center;
      border: 1px solid #000000;
    }

    .bom-challan-cityval-cell {
      font-size: 9.5pt;
      font-weight: 700;
      text-align: center;
      border: 1px solid #000000;
      white-space: nowrap;
    }

    .bom-challan-tablehead-row { height: 15pt; }
    .bom-challan-tablehead-row th {
      font-size: 9.5pt;
      font-weight: 700;
      text-align: center;
      vertical-align: middle;
      background: #ffffff;
      color: #000000;
      border: 1px solid #000000;
      white-space: nowrap !important;
      padding: 0 1px !important;
    }

    .bom-challan-row { height: 13.4pt; }
    .bom-challan-row td {
      font-size: 9.5pt;
      font-weight: 400;
      padding: 0 3px;
      vertical-align: middle;
    }
    .bom-c-sr { text-align: center; border: 1px solid #000000; white-space: nowrap !important; }
    .bom-c-name { text-align: left; padding-left: 3px !important; border: 1px solid #000000; word-break: break-word; line-height: 1.15; }
    .bom-c-model { text-align: center; border: 1px solid #000000; word-break: break-word; line-height: 1.15; }
    .bom-c-modelcont { text-align: center; border: 1px solid #000000; }

    td.bom-c-qtylabel {
      border-top: 1px solid #000000 !important;
      border-bottom: 1px solid #000000 !important;
      border-left: 1px solid #000000 !important;
      border-right: none !important;
      text-align: right !important;
      padding-right: 2px !important;
    }
    td.bom-c-qtyunit {
      border-top: 1px solid #000000 !important;
      border-bottom: 1px solid #000000 !important;
      border-right: 1px solid #000000 !important;
      border-left: none !important;
      text-align: left !important;
      padding-left: 2px !important;
    }

    .bom-c-desc {
      text-align: left;
      padding-left: 3px !important;
      border: 1px solid #000000;
      word-break: break-word;
      line-height: 1.15;
    }
    .bom-challan-row-blank td { background: #ffffff; }

    .bom-challan-footer-row1 { height: 19pt; }
    .bom-challan-footer-row2 { height: 16pt; }

    td.bom-challan-footer-blank-left,
    td.bom-challan-footer-blank-right,
    td.bom-challan-footer-vehicle {
      border: none !important;
    }
    td.bom-challan-footer-vehicle {
      font-size: 12.5pt;
      font-weight: 700;
      text-align: center;
      vertical-align: middle;
      white-space: nowrap !important;
      overflow: hidden !important;
    }
    td.bom-challan-footer-issuedby,
    td.bom-challan-footer-receivedby,
    td.bom-challan-footer-caption {
      border: none !important;
      font-size: 10pt;
      font-weight: 700;
      text-align: center;
      vertical-align: middle;
    }
  </style>
</head>
<body>
  ${sheetHtml}
</body>
</html>`);
  doc.close();

  const imgs = doc.querySelectorAll('img');
  const firePrint = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        window.print();
      }
    }, 100);
  };

  let pending = imgs.length;
  if (!pending) {
    firePrint();
  } else {
    let fired = false;
    const check = () => {
      pending--;
      if (pending <= 0 && !fired) {
        fired = true;
        firePrint();
      }
    };
    imgs.forEach((img) => {
      if (img.complete) {
        check();
      } else {
        img.onload = check;
        img.onerror = check;
      }
    });
    setTimeout(() => {
      if (!fired) {
        fired = true;
        firePrint();
      }
    }, 300);
  }
};

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
  const modalHtml = bomRenderChallanEntryModalHtml(header, kit, { onlyActive: true, salesMode: true });

  window.openModal('Generate Challan', modalHtml, { fullscreen: true });

  if (typeof bomApplyChallanAutoQty === 'function') bomApplyChallanAutoQty(sections);

  // Auto-populate any unmapped sales items into the extra items list
  const { unmappedItems } = (typeof bomComputeChallanAutoQty === 'function') ? bomComputeChallanAutoQty(sections) : { unmappedItems: [] };
  if (unmappedItems && unmappedItems.length) {
    const extraTbody = document.getElementById('bomChallanExtraItemsBody');
    if (extraTbody) {
      unmappedItems.forEach((u) => {
        const idx = bomChallanExtraItemSeq++;
        const tr = document.createElement('tr');
        tr.dataset.extraIdx = String(idx);
        tr.innerHTML = `
          <td class="bom-challan-extra-sr">&mdash;</td>
          <td><input type="text" class="bom-field-input" data-extra-field="name" value="${bomEscAttr(u.item.name || u.item.brand || 'Item')}"></td>
          <td><input type="text" class="bom-field-input" data-extra-field="model" value="${bomEscAttr(u.item.model || '')}"></td>
          <td><input type="number" min="0" class="bom-field-input" data-extra-field="qty" value="${bomEscAttr(u.qty || 1)}"></td>
          <td><input type="text" class="bom-field-input" data-extra-field="unit" value="Nos"></td>
          <td><input type="text" class="bom-field-input" data-extra-field="desc" value=""></td>
          <td style="text-align:center;"><button type="button" class="btn btn-ghost bom-mini-btn" onclick="this.closest('tr').remove()" style="color:var(--red);"><i class="fa-solid fa-trash"></i></button></td>
        `;
        extraTbody.appendChild(tr);
      });
    }
  }

  // Wire Toggle Full 14 Template vs Only Active Items
  let isShowingAll = false;
  const toggleBtn = document.getElementById('bomChallanToggleTemplateBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isShowingAll = !isShowingAll;
      const tplContainer = document.getElementById('bomChallanTemplateContainer');
      if (tplContainer) {
        let activeTemplate = BOM_CHALLAN_TEMPLATE.filter((it) => {
          const autoRes = bomComputeChallanAutoQty(sections);
          if (it.sizes && it.sizes.length) {
            const bucket = autoRes.giPipe[it.sr];
            return bucket && Object.values(bucket).some((v) => Number(v) > 0);
          }
          return autoRes.qtyBySr[it.sr] != null && Number(autoRes.qtyBySr[it.sr]) > 0;
        });
        if (!activeTemplate.length) activeTemplate = BOM_CHALLAN_TEMPLATE.slice(0, 1);

        tplContainer.innerHTML = bomRenderChallanTemplateItemsHtml(isShowingAll ? BOM_CHALLAN_TEMPLATE : activeTemplate);
        bomApplyChallanAutoQty(sections);
        toggleBtn.innerHTML = `<i class="fa-solid fa-table-list"></i> ${isShowingAll ? 'Show Only Active Items' : 'Show All 14 Categories'}`;
      }
    });
  }

  const modalNo = document.getElementById('bomChallanModalNo');
  const modalDate = document.getElementById('bomChallanModalDate');
  const modalOrderNo = document.getElementById('bomChallanModalOrderNo');
  const modalCapacity = document.getElementById('bomChallanModalCapacity');
  const modalName = document.getElementById('bomChallanModalName');
  const modalCity = document.getElementById('bomChallanModalCity');
  const modalVehicleNo = document.getElementById('bomChallanModalVehicleNo');
  const modalVehicleNo2 = document.getElementById('bomChallanModalVehicleNo2');
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
      vehicleNo2: modalVehicleNo2 ? modalVehicleNo2.value : '',
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
    if (saleChalanDateEl && payload.challanDate) saleChalanDateEl.value = toISODateStr(payload.challanDate);
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
      printBtn.disabled = true;
      printBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
      try {
        await window.Api.post('/challan', payload);
        syncBackToSalesForm(payload);
        if (window.showToast) window.showToast(`Challan #${payload.challanNo} saved & opening print preview!`, 'success');
        window.closeModal();
        window.printChallanDirectly(payload);
      } catch (err) {
        window.openModal('Print Notice', `<p>${(err && err.message) || 'Could not process Challan.'}</p>`);
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
  try {
    const challanData = await window.Api.get(`/challan/by-no/${encodeURIComponent(challanNo)}`, { silent: true });
    if (!challanData) throw new Error(`Could not find record for Challan #${challanNo}.`);
    window.printChallanDirectly(challanData);
  } catch (err) {
    window.openModal('Print Failed', `<p>${(err && err.message) || 'Could not load Challan for printing.'}</p>`);
  }
};

// Global helper to print Challan by DB ID
window.printChallanById = async function(id) {
  if (!id) return;
  try {
    const challanData = await window.Api.get(`/challan/${encodeURIComponent(id)}`, { silent: true });
    if (!challanData) throw new Error('Could not find Challan record.');
    window.printChallanDirectly(challanData);
  } catch (err) {
    window.openModal('Print Failed', `<p>${(err && err.message) || 'Could not load Challan for printing.'}</p>`);
  }
};

// =============================================================================
// SAVED CHALLAN REGISTER & CUSTOM CHALLAN CREATOR
// =============================================================================

// 1) Open Custom / Direct Challan Modal (Unified Sequential Counter)
window.openCustomChallanModal = async function(prefillData) {
  let challanNo = (prefillData && prefillData.challanNo) || '';
  if (!challanNo) {
    try {
      const nextData = await window.Api.get('/challan/next-no', { silent: true });
      if (nextData && nextData.nextNo) challanNo = nextData.nextNo;
    } catch (e) { /* ignore */ }
  }

  const todayIso = new Date().toISOString().split('T')[0];
  const header = {
    customerName: (prefillData && prefillData.customerName) || '',
    orderNo: (prefillData && prefillData.orderNo) || '',
    challanNo: challanNo,
    challanDate: (prefillData && prefillData.challanDate) || todayIso,
    city: (prefillData && prefillData.city) || '',
    vehicleNo: (prefillData && prefillData.vehicleNo) || '',
    vehicleNo2: (prefillData && prefillData.vehicleNo2) || '',
    installerName: (prefillData && prefillData.installerName) || '',
    fabricatorName: (prefillData && prefillData.fabricatorName) || '',
    dealerName: (prefillData && prefillData.dealerName) || '',
  };

  const kit = { kw: (prefillData && prefillData.capacityKw) || '', sections: [] };

  if (typeof bomLoadChallanCategoryMap === 'function') await bomLoadChallanCategoryMap();
  const modalHtml = bomRenderChallanEntryModalHtml(header, kit, { onlyActive: false, customMode: true });

  window.openModal('Custom Challan Entry', modalHtml, { fullscreen: true });

  const modalNo = document.getElementById('bomChallanModalNo');
  const modalDate = document.getElementById('bomChallanModalDate');
  const modalOrderNo = document.getElementById('bomChallanModalOrderNo');
  const modalCapacity = document.getElementById('bomChallanModalCapacity');
  const modalName = document.getElementById('bomChallanModalName');
  const modalCity = document.getElementById('bomChallanModalCity');
  const modalVehicleNo = document.getElementById('bomChallanModalVehicleNo');
  const modalVehicleNo2 = document.getElementById('bomChallanModalVehicleNo2');
  const saveBtn = document.getElementById('bomChallanSaveBtn');
  const printBtn = document.getElementById('bomChallanPrintBtn');
  const addItemBtn = document.getElementById('bomChallanAddItemBtn');

  if (modalNo && !modalNo.value.trim() && challanNo) modalNo.value = challanNo;
  if (modalDate && !modalDate.value) modalDate.value = todayIso;

  if (addItemBtn) addItemBtn.addEventListener('click', bomChallanAddExtraItemRow);

  function buildPayload() {
    return {
      challanNo: modalNo ? modalNo.value.trim() : '',
      challanDate: modalDate ? modalDate.value : '',
      orderNo: modalOrderNo ? modalOrderNo.value.trim() : '',
      capacityKw: modalCapacity ? modalCapacity.value.trim() : '',
      customerName: modalName ? modalName.value.trim() : '',
      city: modalCity ? modalCity.value.trim() : '',
      vehicleNo: modalVehicleNo ? modalVehicleNo.value.trim() : '',
      vehicleNo2: modalVehicleNo2 ? modalVehicleNo2.value.trim() : '',
      installerName: '',
      fabricatorName: '',
      dealerName: '',
      items: Object.assign({}, bomCollectChallanTemplateValues(), { extra: bomCollectChallanExtraItems() }),
      panelSerials: [],
    };
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
        if (window.showToast) window.showToast(`Custom Challan #${payload.challanNo} saved successfully!`, 'success');
        window.closeModal();
        if (document.getElementById('challanRegisterModalBody')) {
          window.openChallanRegisterModal();
        }
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
      printBtn.disabled = true;
      printBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
      try {
        await window.Api.post('/challan', payload);
        if (window.showToast) window.showToast(`Custom Challan #${payload.challanNo} saved & opening print preview!`, 'success');
        window.closeModal();
        if (document.getElementById('challanRegisterModalBody')) {
          window.openChallanRegisterModal();
        }
        window.printChallanDirectly(payload);
      } catch (err) {
        window.openModal('Print Notice', `<p>${(err && err.message) || 'Could not save Custom Challan.'}</p>`);
      } finally {
        printBtn.disabled = false;
        printBtn.innerHTML = '<i class="fa-solid fa-print"></i> Print Challan';
      }
    });
  }
};

// 2) Open Challan Register (View, Search, Re-print, Manage all saved Challans)
window.openChallanRegisterModal = async function() {
  const loadingHtml = `
    <div style="padding:30px; text-align:center; color:var(--txt-muted);">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:24px; color:var(--gold); margin-bottom:10px;"></i>
      <p>Loading Saved Challan Register...</p>
    </div>
  `;
  window.openModal('Saved Challan Register', loadingHtml, { fullscreen: true });

  try {
    const list = await window.Api.get('/challan');
    let allChallans = Array.isArray(list) ? list : [];

    const isCurrentAdmin = (window.currentUserRole === 'SuperAdmin' || window.currentUserRole === 'Admin');

    const html = `
      <div id="challanRegisterModalBody" style="padding:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
          <div>
            <h3 style="margin:0; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-clipboard-list" style="color:var(--gold);"></i> Saved Challan Register
            </h3>
            <div style="font-size:12px; color:var(--txt-muted); margin-top:2px;">All Challans generated via BOM, Sales, or Custom Direct Entry.</div>
          </div>
          <div style="display:flex; gap:10px;">
            <button type="button" class="btn btn-green" id="challanRegBtnNewCustom"><i class="fa-solid fa-plus-circle"></i> Create Custom Challan</button>
            <button type="button" class="btn btn-ghost" id="challanRegBtnRefresh"><i class="fa-solid fa-rotate"></i> Refresh</button>
          </div>
        </div>

        <div class="masters-filter-bar" style="margin-bottom:14px;">
          <div class="search-box" style="flex:1;">
            <input type="text" id="challanRegSearchInput" placeholder="Search by Challan No, Customer, Order No, City, Vehicle..." style="width:100%;">
          </div>
          <div style="font-size:12.5px; color:var(--txt-muted); font-weight:600; padding:6px 12px; background:rgba(255,255,255,0.05); border-radius:8px; border:1px solid var(--border);">
            Total Saved: <strong style="color:var(--gold);" id="challanRegCount">${allChallans.length}</strong>
          </div>
        </div>

        <div class="table-wrap" style="max-height:calc(100vh - 230px); overflow-y:auto;">
          <table>
            <thead>
              <tr>
                <th style="width:100px;">Challan No</th>
                <th style="width:110px;">Date</th>
                <th>Customer Name</th>
                <th>City</th>
                <th style="width:110px;">Order No</th>
                <th style="width:90px;">Cap (kW)</th>
                <th>Vehicle No</th>
                <th style="width:110px;">Created By</th>
                <th style="width:130px; text-align:center;">Actions</th>
              </tr>
            </thead>
            <tbody id="challanRegTableBody"></tbody>
          </table>
        </div>
      </div>
    `;

    const modalBoxBody = document.querySelector('#modalOverlay .modal-body');
    if (modalBoxBody) {
      modalBoxBody.innerHTML = html;
    }

    function renderChallanRows() {
      const q = (document.getElementById('challanRegSearchInput') ? document.getElementById('challanRegSearchInput').value.trim().toLowerCase() : '');
      const filtered = allChallans.filter((c) => {
        if (!q) return true;
        const cNo = String(c.challan_no || '').toLowerCase();
        const cDate = String(c.challan_date || '').toLowerCase();
        const cName = String(c.customer_name || '').toLowerCase();
        const cCity = String(c.city || '').toLowerCase();
        const cOrd = String(c.order_no || '').toLowerCase();
        const cVeh = String(c.vehicle_no || '').toLowerCase();
        const cUser = String(c.created_by || '').toLowerCase();
        return cNo.includes(q) || cDate.includes(q) || cName.includes(q) || cCity.includes(q) || cOrd.includes(q) || cVeh.includes(q) || cUser.includes(q);
      });

      const countEl = document.getElementById('challanRegCount');
      if (countEl) countEl.textContent = filtered.length;

      const tbody = document.getElementById('challanRegTableBody');
      if (!tbody) return;

      if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:var(--txt-muted); padding:24px;">${q ? 'No matching Challans found.' : 'No saved Challans recorded yet.'}</td></tr>`;
        return;
      }

      tbody.innerHTML = filtered.map((c) => `
        <tr>
          <td><strong style="color:var(--gold); font-size:13.5px;">#${c.challan_no || '-'}</strong></td>
          <td>${c.challan_date || '-'}</td>
          <td style="font-weight:600;">${c.customer_name || '-'}</td>
          <td>${c.city || '-'}</td>
          <td><span class="badge" style="background:rgba(59,142,208,0.12); color:#66a6ff;">${c.order_no || '-'}</span></td>
          <td>${c.capacity_kw ? c.capacity_kw + ' kW' : '-'}</td>
          <td>${c.vehicle_no || '-'}</td>
          <td style="font-size:11.5px; color:var(--txt-muted);">${c.created_by || '-'}</td>
          <td style="text-align:center; white-space:nowrap;">
            <button type="button" class="btn btn-gold bom-mini-btn" title="Edit Challan Details & Items" onclick="window.openChallanEditModal('${c.id}')" style="margin-right:4px;"><i class="fa-solid fa-pen-to-square"></i></button>
            <button type="button" class="btn btn-blue bom-mini-btn" title="Print Landscape A4 Dual Copy PDF" onclick="window.printChallanByNo('${c.challan_no}')" style="margin-right:4px;"><i class="fa-solid fa-print"></i></button>
            ${isCurrentAdmin ? `<button type="button" class="btn btn-red bom-mini-btn" title="Delete Challan" onclick="window.deleteChallanById('${c.id}', '${c.challan_no}')"><i class="fa-solid fa-trash"></i></button>` : ''}
          </td>
        </tr>
      `).join('');
    }

    renderChallanRows();

    const searchInput = document.getElementById('challanRegSearchInput');
    if (searchInput) searchInput.addEventListener('input', renderChallanRows);

    const newBtn = document.getElementById('challanRegBtnNewCustom');
    if (newBtn) newBtn.addEventListener('click', () => window.openCustomChallanModal());

    const refreshBtn = document.getElementById('challanRegBtnRefresh');
    if (refreshBtn) refreshBtn.addEventListener('click', () => window.openChallanRegisterModal());

  } catch (err) {
    window.openModal('Register Error', `<p>${(err && err.message) || 'Failed to load Challan Register.'}</p>`);
  }
};

// 3) Open Existing Saved Challan for Editing & Re-saving (PUT /api/challan/:id)
window.openChallanEditModal = async function(challanId) {
  if (!challanId) return;

  try {
    const record = await window.Api.get(`/challan/${challanId}`);
    if (!record) throw new Error('Challan record could not be loaded.');

    const vehParts = (record.vehicle_no || '').split(' / ');
    const v1 = vehParts[0] || '';
    const v2 = vehParts[1] || '';

    const header = {
      customerName: record.customer_name || '',
      orderNo: record.order_no || '',
      challanNo: record.challan_no || '',
      challanDate: record.challan_date || '',
      city: record.city || '',
      vehicleNo: v1,
      vehicleNo2: v2,
      installerName: record.installer_name || '',
      fabricatorName: record.fabricator_name || '',
      dealerName: record.dealer_name || '',
    };

    const kit = { kw: record.capacity_kw || '', sections: [] };

    if (typeof bomLoadChallanCategoryMap === 'function') await bomLoadChallanCategoryMap();
    const modalHtml = bomRenderChallanEntryModalHtml(header, kit, { onlyActive: false, editMode: true });

    window.openModal(`Edit Challan #${record.challan_no}`, modalHtml, { fullscreen: true });

    const modalNo = document.getElementById('bomChallanModalNo');
    const modalDate = document.getElementById('bomChallanModalDate');
    const modalOrderNo = document.getElementById('bomChallanModalOrderNo');
    const modalCapacity = document.getElementById('bomChallanModalCapacity');
    const modalName = document.getElementById('bomChallanModalName');
    const modalCity = document.getElementById('bomChallanModalCity');
    const modalVehicleNo = document.getElementById('bomChallanModalVehicleNo');
    const modalVehicleNo2 = document.getElementById('bomChallanModalVehicleNo2');
    const saveBtn = document.getElementById('bomChallanSaveBtn');
    const printBtn = document.getElementById('bomChallanPrintBtn');
    const addItemBtn = document.getElementById('bomChallanAddItemBtn');

    if (saveBtn) saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Challan';

    // Populate existing item values into the form
    const items = record.items || {};
    Object.keys(items).forEach((key) => {
      if (key === 'extra') return;
      const it = items[key];
      if (!it) return;

      const qtyInput = document.querySelector(`[data-challan-tpl-key="${key}"]`);
      if (qtyInput && it.qty != null) qtyInput.value = it.qty;

      const descInput = document.querySelector(`[data-challan-tpl-desc="${key}"]`);
      if (descInput && it.desc != null) descInput.value = it.desc;

      const nameInput = document.querySelector(`[data-challan-tpl-name="${key}"]`);
      if (nameInput && it.name) nameInput.value = it.name;

      const modelInput = document.querySelector(`[data-challan-tpl-model="${key}"]`);
      if (modelInput && it.model) modelInput.value = it.model;

      const unitInput = document.querySelector(`[data-challan-tpl-unit="${key}"]`);
      if (unitInput && it.unit) unitInput.value = it.unit;
    });

    // Populate extra items if any
    if (Array.isArray(items.extra) && items.extra.length) {
      const extraTbody = document.getElementById('bomChallanExtraItemsBody');
      if (extraTbody) {
        items.extra.forEach((u) => {
          const idx = bomChallanExtraItemSeq++;
          const tr = document.createElement('tr');
          tr.dataset.extraIdx = String(idx);
          tr.innerHTML = `
            <td class="bom-challan-extra-sr">&mdash;</td>
            <td><input type="text" class="bom-field-input" data-extra-field="name" value="${bomEscAttr(u.name || '')}"></td>
            <td><input type="text" class="bom-field-input" data-extra-field="model" value="${bomEscAttr(u.model || '')}"></td>
            <td><input type="number" min="0" class="bom-field-input" data-extra-field="qty" value="${bomEscAttr(u.qty || '')}"></td>
            <td><input type="text" class="bom-field-input" data-extra-field="unit" value="${bomEscAttr(u.unit || 'Nos')}"></td>
            <td><input type="text" class="bom-field-input" data-extra-field="desc" value="${bomEscAttr(u.desc || '')}"></td>
            <td style="text-align:center;"><button type="button" class="btn btn-ghost bom-mini-btn" onclick="this.closest('tr').remove()" style="color:var(--red);"><i class="fa-solid fa-trash"></i></button></td>
          `;
          extraTbody.appendChild(tr);
        });
      }
    }

    if (addItemBtn) addItemBtn.addEventListener('click', bomChallanAddExtraItemRow);

    function buildPayload() {
      return {
        challanNo: modalNo ? modalNo.value.trim() : '',
        challanDate: modalDate ? modalDate.value : '',
        orderNo: modalOrderNo ? modalOrderNo.value.trim() : '',
        capacityKw: modalCapacity ? modalCapacity.value.trim() : '',
        customerName: modalName ? modalName.value.trim() : '',
        city: modalCity ? modalCity.value.trim() : '',
        vehicleNo: modalVehicleNo ? modalVehicleNo.value.trim() : '',
        vehicleNo2: modalVehicleNo2 ? modalVehicleNo2.value.trim() : '',
        installerName: record.installer_name || '',
        fabricatorName: record.fabricator_name || '',
        dealerName: record.dealer_name || '',
        items: Object.assign({}, bomCollectChallanTemplateValues(), { extra: bomCollectChallanExtraItems() }),
        panelSerials: [],
      };
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const payload = buildPayload();
        if (!payload.challanNo) {
          window.openModal('Validation Error', '<p>Challan No. is required.</p>');
          return;
        }
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
        try {
          await window.Api.put(`/challan/${challanId}`, payload);
          if (window.showToast) window.showToast(`Challan #${payload.challanNo} updated successfully!`, 'success');
          window.closeModal();
          window.openChallanRegisterModal();
        } catch (err) {
          window.openModal('Update Failed', `<p>${(err && err.message) || 'Could not update the Challan.'}</p>`);
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Challan';
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
        printBtn.disabled = true;
        printBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        try {
          await window.Api.put(`/challan/${challanId}`, payload);
          if (window.showToast) window.showToast(`Challan #${payload.challanNo} updated & opening print preview!`, 'success');
          window.closeModal();
          if (document.getElementById('challanRegisterModalBody')) {
            window.openChallanRegisterModal();
          }
          window.printChallanDirectly(payload);
        } catch (err) {
          window.openModal('Print Notice', `<p>${(err && err.message) || 'Could not update Challan.'}</p>`);
        } finally {
          printBtn.disabled = false;
          printBtn.innerHTML = '<i class="fa-solid fa-print"></i> Print Challan';
        }
      });
    }

  } catch (err) {
    window.openModal('Edit Error', `<p>${(err && err.message) || 'Could not open Challan for editing.'}</p>`);
  }
};

// 4) Delete Challan
window.deleteChallanById = async function(id, challanNo) {
  if (!id) return;
  const ok = await window.confirmDanger(
    'Delete Challan',
    `Permanently delete Challan #${challanNo || id}? This will remove it from the Register.`
  );
  if (!ok) return;

  try {
    await window.Api.delete(`/challan/${id}`);
    if (window.showToast) window.showToast(`Challan #${challanNo} deleted successfully.`, 'success');
    window.openChallanRegisterModal();
  } catch (err) {
    window.openModal('Delete Failed', `<p>${(err && err.message) || 'Could not delete Challan.'}</p>`);
  }
};