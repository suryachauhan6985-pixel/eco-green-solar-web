// js/pages/bom.js
// BOM page — two different jobs, kept deliberately separate:
//
// 1) ON-SCREEN: a normal software entry form (matches the look/feel of
//    every other page in this app — .panel/.form-grid/.field/real <input>s,
//    responsive via the same breakpoints as sales.js/purchase.js). The
//    person picks ONE "BOM Kit" from a single dropdown (e.g. "3.3 kW —
//    Residential 550 Wp") and the standard item list for that kit
//    auto-fills below (Sr No / Item Name / Model / Quantity / Remarks) —
//    nothing to type manually. Customer/Order/Installer/Challan/Dealer
//    etc. are real, working <input> fields.
//
// 2) PRINT ONLY: a hidden sheet (#bomPrintRoot, display:none on screen)
//    that exactly reproduces the original Excel layout (same header
//    fields, same purple category bars, same 6 columns, same borders).
//    It's (re)built from the live form values right when "Print" is
//    clicked, then auto-scaled to fit one A4 page (see fitSheetToOnePage
//    below) before window.print() fires. This is what actually prints —
//    the software-style form above never prints.
//
// STAGE 1: front-end only, dummy kit data. Once the real BOM/dispatch
// workflow (single dispatch deducting every kit item from stock at once)
// is described, kit data will come from the backend and Print/"Confirm
// Dispatch" will be wired to it.
window.PAGES = window.PAGES || {};

// Rewrites the printed page's @page{size/margin} right before
// window.print() is called. Needed because Chrome's print preview does
// not reliably honor CSS named pages (`page:bomChallanPage` bound to a
// named `@page bomChallanPage{}` rule) — the Challan sheet kept printing
// portrait even with a landscape named page defined for it. Writing a
// plain (unnamed) @page rule into its own <style> tag, fresh, right
// before each print, sidesteps that entirely: whichever sheet is about
// to print gets its exact size/margin set at that exact moment, with no
// dependency on named-page support at all.
function bomSetPrintPageSize(cssSizeAndMargin) {
  let styleEl = document.getElementById('bomDynamicPageStyle');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'bomDynamicPageStyle';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `@media print { @page { ${cssSizeAndMargin} } }`;
}

// No built-in kits are shipped anymore — every kit (sections + items) is
// built and saved from this screen via "New Kit" (see the Custom Kit /
// Template storage right below), which persists into bomLoadCustomKits()/
// bomSaveCustomKits() the exact same way it already did for a person's own
// saved templates. bomGetAllKits() below merges this (now always empty)
// object with whatever's been saved, so the rest of the page — kit
// dropdown, item table, print sheet — needs no further changes.
const BOM_KITS = {};

// ---------- Custom Kit / Template storage (localStorage) ----------
// Lets someone build their own BOM Kit right from this screen (a name +
// its item list) and save it as a reusable template. Next time they pick
// that same name from the "BOM Kit" dropdown, every item/model/qty/
// remarks row below auto-fills exactly as saved — same behaviour as the
// built-in kits above. Stored per-browser in localStorage since this app
// has no backend BOM-kit table yet (see the STAGE 1 note at the top of
// this file); keys are always prefixed "custom_" so they can never
// collide with a built-in kW key like "3.3".
const BOM_CUSTOM_KITS_KEY = 'egs_bom_custom_kits';

function bomLoadCustomKits() {
  try {
    const raw = localStorage.getItem(BOM_CUSTOM_KITS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function bomSaveCustomKits(obj) {
  try {
    localStorage.setItem(BOM_CUSTOM_KITS_KEY, JSON.stringify(obj));
  } catch (e) {
    // storage unavailable/full — saving silently no-ops rather than crashing the page
  }
}

// Combined catalogue used everywhere a kit needs to be looked up: built-in
// BOM_KITS plus whatever templates the person has saved.
function bomGetAllKits() {
  return { ...BOM_KITS, ...bomLoadCustomKits() };
}

function bomIsCustomKitKey(key) {
  return typeof key === 'string' && key.indexOf('custom_') === 0;
}

function bomSlugify(label) {
  const slug = String(label).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return slug || 'kit';
}

// Renumbers every item's Sr No. sequentially (1, 2, 3...) across ALL
// sections in order, exactly like the original Excel sheet's continuous
// numbering. Called after any insert/remove of an item or section so the
// numbering never has to be fixed by hand.
function bomRenumberAll(sections) {
  let n = 1;
  sections.forEach((sec) => {
    sec.items.forEach((it) => {
      it.sr = n;
      n += 1;
    });
  });
}

// Deep-clones the standard built-in kit's section/item structure (names +
// section titles only) with Model/Quantity/Remarks blanked out — this is
// what the "New Kit" builder pre-fills with the moment it's opened, so a
// new kit starts in the exact same shape as every existing kit and the
// person only has to fill in values and add/remove items where the new
// kit's BOM actually differs.
function bomDefaultSectionsTemplate() {
  const ref = Object.values(BOM_KITS)[0];
  const cloned = ref
    ? JSON.parse(JSON.stringify(ref.sections))
    : [{ title: 'Items', items: [{ sr: 1, name: '', model: '', qty: '', remarks: '' }] }];
  cloned.forEach((sec) => sec.items.forEach((it) => {
    it.model = '';
    it.qty = '';
    it.remarks = '';
    it.dispatchQty = '';
  }));
  bomRenumberAll(cloned);
  return cloned;
}

// ---------- shared escaping helpers ----------
const bomEsc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const bomEscAttr = (s) => bomEsc(s).replace(/"/g, '&quot;');

// ---------- Serial No. helpers (shared by the Serial No. button + modal) ----------
// Pulls the required serial COUNT out of a Quantity string like "06 Nos" or
// "1 Nos" — the same qty text already shown in the Quantity cell, just read
// as a number. Returns null when the qty has no digit in it at all (e.g.
// "-"), meaning there's no fixed count to enforce.
function bomParseQtyNumber(qtyStr) {
  const m = String(qtyStr || '').match(/\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// ---------- Role-based Dispatch Qty (partial dispatch) ----------
// Admin/SuperAdmin CREATE a BOM — they set the full "Quantity" per item
// (e.g. "06 Nos"), same as before. A plain User does not create BOMs; they
// only DISPATCH from one, and may only send PART of the allocated qty in
// one go (partial dispatch). "Dispatch Qty" is that new, separate column —
// it is ONLY RENDERED for a plain User (see bomRenderScreenItemsHtml —
// Admin's table has no such column at all, keeping Admin's screen and the
// print/Challan output exactly as before, unchanged):
//   - Admin/SuperAdmin: Quantity stays editable (unchanged); Dispatch Qty
//     column doesn't exist on their screen at all. Internally,
//     item.dispatchQty is still kept in sync with Quantity's numeric value
//     under the hood (see handleItemFieldEdit's 'qty' branch), purely so
//     bomEffectiveQty() below behaves the same as before for Admin (full
//     Quantity) — nothing user-facing changes for Admin.
//   - User: Quantity becomes read-only (locked to whatever Admin set, so
//     the original BOM allocation is preserved and never accidentally
//     overwritten by whoever is dispatching it); Dispatch Qty is a new,
//     visible, editable column — auto-filled from Quantity by default,
//     and clamped so it can never exceed the original allocation.
// bomEffectiveQty() is THE single source of truth for "how many units are
// actually being sent right now" — used everywhere serial-count
// requirements and the stock check are computed (Verify BOM, Tick All,
// the Serial No. modal/button, and the check-stock/dispatch API payload),
// so a partial Dispatch Qty of e.g. 4 (out of an allocated 6) only ever
// asks for 4 serials and only ever checks/deducts 4 units of stock.
// NOTE: the print sheet (bomRenderPrintSheetHtml) and the Challan
// Excel/PDF template (bomCollectChallanTemplateValues / challanPdf.js) are
// UNTOUCHED by this — they still read straight from Quantity, exactly as
// before, regardless of who's logged in or what Dispatch Qty is set to.
function bomEffectiveQty(it) {
  if (it && it.dispatchQty !== undefined && it.dispatchQty !== null && String(it.dispatchQty).trim() !== '') {
    const n = Number(it.dispatchQty);
    if (!Number.isNaN(n)) return n;
  }
  return bomParseQtyNumber(it && it.qty);
}

// Fills in a blank/missing dispatchQty on every item from its Quantity
// (e.g. "06 Nos" -> 6) — called whenever a kit is freshly loaded into
// currentKitState, so both Admin and User always start with Dispatch Qty
// = full Quantity, and User then narrows it down for a partial dispatch.
// Never overwrites a dispatchQty that's already been explicitly set.
function bomNormalizeDispatchQty(state) {
  (state || []).forEach((sec) => {
    (sec.items || []).forEach((it) => {
      if (it.dispatchQty === undefined || it.dispatchQty === null || it.dispatchQty === '') {
        const n = bomParseQtyNumber(it.qty);
        it.dispatchQty = n != null ? String(n) : '';
      }
    });
  });
}

// Mirrors Purchase/Sale's serial box: split on ANY separator (space, comma,
// tab, pipe, semicolon, newline) and keep only letters/digits/hyphens — so
// pasting or scanning a run of codes always turns into one serial per line.
function bomSplitSerials(text) {
  return String(text || '').match(/[A-Za-z0-9-]+/g) || [];
}

// ---------- Item Name dropdown source ----------
// Real item master (Masters > Item Registration) is the source of truth once
// the API/DB is reachable. Until then (or for any kit item not yet registered
// as a master item), we fall back to every unique item name already used
// across BOM_KITS, so the field is always a real dropdown — never a plain
// static label — regardless of backend availability.
let bomItemMasterNames = [];

// Category -> [item master names] and the full category name list, used
// to drive the Category/Model dropdown pair on any section whose title
// matches a real category name (see bomResolveSectionCategory — e.g. a
// section titled "Solar Panel" or "Inverter"). Populated by
// bomLoadSerialMandatoryInfo() in init() (same /masters/items +
// /masters/categories calls that already build the serial-mandatory
// lookup), so this never needs its own extra round trip, and is
// loaded/awaited before the first render.
let bomCategoryNameList = [];
let bomItemsByCategory = {};

function bomCollectKitItemNames() {
  const set = new Set();
  Object.values(BOM_KITS).forEach((kit) => {
    kit.sections.forEach((sec) => sec.items.forEach((it) => set.add(it.name)));
  });
  return Array.from(set);
}

async function bomLoadItemMasterNames() {
  try {
    const rows = await window.Api.get('/masters/items');
    if (Array.isArray(rows) && rows.length) {
      bomItemMasterNames = rows.map((r) => r.name).filter(Boolean);
      return;
    }
  } catch (e) {
    // API/DB not reachable in this preview — fall back to kit-derived names below.
  }
  bomItemMasterNames = bomCollectKitItemNames();
}

function bomBuildItemOptionsHtml(selectedName) {
  const names = new Set(bomItemMasterNames);
  if (selectedName) names.add(selectedName);
  const optionsHtml = Array.from(names).map((n) => `
    <option value="${bomEscAttr(n)}" ${n === selectedName ? 'selected' : ''}>${bomEsc(n)}</option>
  `).join('');
  return `<option value="">-- Select Item --</option>${optionsHtml}`;
}

// ---------- Category / Category-Item dropdown source (category-driven sections) ----------
// A section is "category-driven" whenever its title exactly matches a real
// Masters > Category name (case-insensitive) — e.g. a section titled
// "Solar Panel" or "Inverter". Every item row inside that section then
// shows the Category/Model dropdown pair below instead of the flat
// item-name list. Returns the canonical category name (as stored in
// Masters, for exact matching against bomItemsByCategory) or null.
function bomResolveSectionCategory(title) {
  const t = String(title || '').trim().toLowerCase();
  if (!t) return null;
  return bomCategoryNameList.find((c) => String(c).trim().toLowerCase() === t) || null;
}

function bomBuildCategoryOptionsHtml(selectedCategory) {
  const names = new Set(bomCategoryNameList);
  if (selectedCategory) names.add(selectedCategory);
  const optionsHtml = Array.from(names).map((n) => `
    <option value="${bomEscAttr(n)}" ${n === selectedCategory ? 'selected' : ''}>${bomEsc(n)}</option>
  `).join('');
  return `<option value="">-- Select Category --</option>${optionsHtml}`;
}

// The Model cell for a category-driven row: every registered item (Masters >
// Item Registration) under the currently-selected category, e.g. Solar
// Panel -> "Adani 545". Falls back to keeping the already-selected name in
// the list even if it's not (yet) found under this category, so a saved
// value never silently disappears while data is loading.
function bomBuildCategoryItemOptionsHtml(category, selectedName) {
  const list = (category && bomItemsByCategory[category]) || [];
  const names = new Set(list);
  if (selectedName) names.add(selectedName);
  const optionsHtml = Array.from(names).map((n) => `
    <option value="${bomEscAttr(n)}" ${n === selectedName ? 'selected' : ''}>${bomEsc(n)}</option>
  `).join('');
  return `<option value="">-- Select Item --</option>${optionsHtml}`;
}

// ---------- On-screen items preview: REAL editable fields (dark-theme table) ----------
// `state` is a live, mutable clone of the selected kit's `sections` (see
// currentKitState in init()). Selecting a kit auto-fills every field below
// from the kit defaults — but every cell here is a real <input>/<select>,
// so the user can change any of them (item, model, quantity, remarks)
// without having to retype the rest. Edits write straight back into
// `currentKitState`, which is what actually gets printed. Every section
// also gets its own Add-Item / Remove-Section controls, and every item row
// gets an "insert a new item right below this one" + "remove this item"
// pair, so a new item can be dropped in at any position within any
// section (e.g. right after the 5th item in "Solar Structure") — not just
// appended at the very end.
// `opts.isAdmin` gates the row/section add-delete controls (Admin/SuperAdmin
// only — see bomIsAdmin in init()); a plain User still sees and can edit
// every field (name/model/qty/serial/remarks/check) but cannot restructure
// the kit. `opts.needsSerial(name)` says whether that item's category has
// the Serial No. mandatory rule (Masters > Category), same source of truth
// Purchase Inward uses — so the Serial No. cell only appears for items that
// actually need one (e.g. Solar Panels), matching how outward should mirror
// inward's serial-based tracking. The Check column is the on-screen
// equivalent of the print sheet's blank "Checked" box: ticking every item
// here is what unlocks the Verify BOM button (see updateVerifyButtonState).
function bomRenderScreenItemsHtml(state, opts) {
  const isAdmin = !!(opts && opts.isAdmin);
  const needsSerial = (opts && opts.needsSerial) || (() => false);
  if (!state) return '<div class="empty">Select a BOM Kit above to load its item list.</div>';
  const rows = state.map((sec, si) => {
    const catRow = `
      <tr class="bom-screen-cat">
        <td colspan="${isAdmin ? 7 : 8}">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <input type="text" class="bom-field-input bom-section-title-input" data-sec="${si}" data-field="sectitle" value="${bomEscAttr(sec.title)}">
            ${isAdmin ? `
            <span style="white-space:nowrap;">
              <button type="button" class="btn btn-ghost bom-mini-btn" data-sec-add-item="${si}" title="Add item to this section"><i class="fa-solid fa-plus"></i> Add Item</button>
              <button type="button" class="btn btn-red bom-mini-btn" data-sec-remove="${si}" title="Remove this section"><i class="fa-solid fa-trash"></i></button>
            </span>` : ''}
          </div>
        </td>
      </tr>`;
    const sectionCategory = bomResolveSectionCategory(sec.title);
    const itemRows = sec.items.map((it, ii) => {
      let serialCell;
      if (needsSerial(it.name)) {
        const required = bomEffectiveQty(it);
        const entered = bomSplitSerials(it.serials).length;
        const isComplete = required != null && entered === required;
        const btnClass = isComplete ? 'btn-green' : (entered > 0 ? 'btn-ghost' : 'btn-red');
        serialCell = `<button type="button" class="btn ${btnClass} bom-serial-btn" data-sec="${si}" data-idx="${ii}" title="Enter Serial No.">
          <i class="fa-solid fa-barcode"></i> ${entered}/${required != null ? required : '?'}
        </button>`;
      } else {
        serialCell = `<span class="bom-serial-na">—</span>`;
      }
      // A row is category-driven whenever its SECTION's title matches a
      // real Masters > Category name (e.g. a section titled "Solar Panel"
      // or "Inverter") AND it's the FIRST row (ii === 0) of that section —
      // only that lead row gets the Category/Model-item dropdown pair.
      // Item Name becomes a Category select (writes to it.category,
      // defaulting to the section's own category so a freshly-added row
      // doesn't need it re-picked); Model becomes a select of the real
      // registered items under that category (writes to it.name — the
      // value actually sent to the backend for stock matching, same field
      // every other row's Item Name select already writes to). Every
      // OTHER row in a category-driven section (ii > 0) falls back to the
      // normal flat Item Name dropdown + free-text Model input, same as
      // any non-category-driven section.
      const isCategoryDrivenRow = !!sectionCategory && ii === 0;
      const effectiveCategory = it.category || sectionCategory;
      const nameCell = isCategoryDrivenRow
        ? `<select class="bom-field-input bom-field-category" data-sec="${si}" data-idx="${ii}" data-field="category">${bomBuildCategoryOptionsHtml(effectiveCategory)}</select>`
        : `<select class="bom-field-input bom-field-name" data-sec="${si}" data-idx="${ii}" data-field="name">${bomBuildItemOptionsHtml(it.name)}</select>`;
      const modelCell = isCategoryDrivenRow
        ? `<select class="bom-field-input bom-field-modelitem" data-sec="${si}" data-idx="${ii}" data-field="name">${bomBuildCategoryItemOptionsHtml(effectiveCategory, it.name)}</select>`
        : `<input type="text" class="bom-field-input" data-sec="${si}" data-idx="${ii}" data-field="model" value="${bomEscAttr(it.model)}">`;
      return `
      <tr>
        <td><input type="text" class="bom-field-input bom-field-sr" data-sec="${si}" data-idx="${ii}" data-field="sr" value="${bomEscAttr(it.sr)}"></td>
        <td>${nameCell}</td>
        <td>${modelCell}</td>
        <td><input type="text" class="bom-field-input" data-sec="${si}" data-idx="${ii}" data-field="qty" value="${bomEscAttr(it.qty)}" ${isAdmin ? '' : 'disabled title="Set by whoever created this BOM — not editable here."'}></td>
        ${isAdmin ? '' : `<td><input type="number" min="0" class="bom-field-input bom-field-dispatchqty" data-sec="${si}" data-idx="${ii}" data-field="dispatchQty" value="${bomEscAttr(it.dispatchQty)}" title="How many of this item you are dispatching right now (can be less than Quantity for a partial dispatch)."></td>`}
        <td class="bom-serial-cell">${serialCell}</td>
        <td style="white-space:nowrap;">
          <input type="text" class="bom-field-input" data-sec="${si}" data-idx="${ii}" data-field="remarks" value="${bomEscAttr(it.remarks)}" style="width:calc(100% - ${isAdmin ? '60px' : '0px'}); display:inline-block;">
          ${isAdmin ? `
          <button type="button" class="btn btn-ghost bom-mini-btn" data-insert-after-sec="${si}" data-insert-after-idx="${ii}" title="Insert item below"><i class="fa-solid fa-plus"></i></button>
          <button type="button" class="btn btn-red bom-mini-btn" data-remove-sec="${si}" data-remove-idx="${ii}" title="Remove item"><i class="fa-solid fa-xmark"></i></button>` : ''}
        </td>
        <td class="bom-check-cell">
          <input type="checkbox" class="bom-field-check" data-sec="${si}" data-idx="${ii}" data-field="checked" ${it.checked ? 'checked' : ''} title="Tick once this item is verified">
        </td>
      </tr>`;
    }).join('');
    return catRow + itemRows;
  }).join('');

  return `
    <div class="table-wrap">
      <table class="bom-items-form-table">
        <thead><tr><th>Sr No.</th><th>Item Name</th><th>Model</th><th>Quantity</th>${isAdmin ? '' : '<th>Dispatch Qty</th>'}<th>Serial No.</th><th>Remarks</th><th>Check</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:10px;">
      ${isAdmin ? '<button type="button" class="btn btn-ghost" id="bomBtnAddSectionLive"><i class="fa-solid fa-layer-group"></i> Add Section</button>' : ''}
    </div>
  `;
}

// ---------- Print-only sheet: exact Excel replica, built from live form values ----------
function bomRenderPrintSheetHtml(kit, header) {
  const h = header;
  const rows = kit.sections.map((sec) => {
    const catRow = `<tr class="bom-cat-row"><td colspan="6">${sec.title}</td></tr>`;
    const sectionCategory = bomResolveSectionCategory(sec.title);
    // Mirrors the on-screen rule (bomRenderScreenItemsHtml): only the
    // FIRST row of a category-driven section (e.g. Solar Panel, Inverter)
    // was ever entered via the Category/Model-item dropdown pair — every
    // other row in that section was a normal Item Name + Model row, so it
    // must print it.name/it.model directly like any other row.
    const itemRows = sec.items.map((it, idx) => {
      const isCategoryDrivenRow = !!sectionCategory && idx === 0;
      return `
      <tr>
        <td class="bom-c-sr">${it.sr}</td>
        <td class="bom-c-name">${isCategoryDrivenRow ? (it.category || sectionCategory) : it.name}</td>
        <td class="bom-c-model">${isCategoryDrivenRow ? (it.name || '') : (it.model || '')}</td>
        <td class="bom-c-qty">${it.qty}</td>
        <td class="bom-c-checked"></td>
        <td class="bom-c-remarks">${it.remarks || ''}</td>
      </tr>`;
    }).join('');
    return catRow + itemRows;
  }).join('');

  const esc = bomEsc;

  return `
    <div class="bom-sheet" id="bomSheet">
      <table class="bom-table">
        <colgroup>
          <col class="bom-col-sr">
          <col class="bom-col-name">
          <col class="bom-col-model">
          <col class="bom-col-qty">
          <col class="bom-col-checked">
          <col class="bom-col-remarks">
        </colgroup>
        <tr>
          <td colspan="4" class="bom-info-cell"><b>Customer Name:</b> ${esc(h.customerName)}</td>
          <td colspan="2" class="bom-info-cell"><b>Order No -</b> ${esc(h.orderNo)}</td>
        </tr>
        <tr>
          <td colspan="3" class="bom-info-cell"><b>Installer Name :</b> ${esc(h.installerName)}</td>
          <td colspan="2" class="bom-info-cell"><b>Challan No. :</b> ${esc(h.challanNo)}</td>
          <td class="bom-info-cell"><b>Ch. Date :</b> ${esc(h.challanDate)}</td>
        </tr>
        <tr>
          <td colspan="4" class="bom-info-cell"><b>Fabricatore Name :</b> ${esc(h.fabricatorName)}</td>
          <td colspan="2" class="bom-info-cell"><b>Dealer Name :</b> ${esc(h.dealerName)}</td>
        </tr>
        <tr><td colspan="6" class="bom-spacer"></td></tr>
        <tr>
          <td colspan="3" class="bom-kw-cell">${esc(kit.kw)}</td>
          <td colspan="3" class="bom-kw-unit">kW</td>
        </tr>
        <tr><td colspan="6" class="bom-spacer"></td></tr>
        <tr class="bom-head-row">
          <th class="bom-c-sr">Sr No.</th>
          <th class="bom-c-name">Iteam Name</th>
          <th class="bom-c-model">Model</th>
          <th class="bom-c-qty">Quantity</th>
          <th class="bom-c-checked">Checked</th>
          <th class="bom-c-remarks">Remarks</th>
        </tr>
        ${rows}
      </table>
    </div>
  `;
}

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

// ---------------------------------------------------------------------------
// BOM Home — the new landing view for the BOM tab. Replaces "click BOM in
// the sidebar -> straight into the big New BOM Entry form" with a small
// launcher screen: Create BOM / Track BOM / BOM Register buttons up top,
// and a live table of every still-pending bom_orders row underneath so an
// in-progress BOM is one double-click away instead of buried inside the
// BOM Register modal. The actual kit-selection/dispatch form (unchanged)
// now lives inside #bomEntryView, hidden until Create BOM or a table
// double-click switches views — see init()'s showBomHome()/showBomEntry().
// ---------------------------------------------------------------------------
function bomRenderHomeViewHtml() {
  return `
    <div id="bomHomeView">
      <div class="page-head"><i class="fa-solid fa-list-check" style="color:var(--gold);"></i><h2>Bill of Material (BOM)</h2></div>
      <div class="panel">
        <h3><i class="fa-solid fa-box-open"></i> BOM</h3>
        <p class="note" style="margin-bottom:12px;">
          <i class="fa-solid fa-circle-info"></i> Start a new BOM, track any Order No.'s dispatch progress, or open the full register.
        </p>
        <div class="actions-row">
          <button type="button" class="btn btn-green" id="bomHomeBtnCreate"><i class="fa-solid fa-plus-circle"></i> Create BOM</button>
          <button type="button" class="btn btn-ghost" id="bomHomeBtnTrack"><i class="fa-solid fa-route"></i> Track BOM</button>
          <button type="button" class="btn btn-ghost" id="bomHomeBtnRegister"><i class="fa-solid fa-clipboard-list"></i> BOM Register</button>
          <button type="button" class="btn btn-ghost" id="bomHomeBtnChallanMap" style="display:none;" title="Decide which BOM item folds into which Challan line"><i class="fa-solid fa-sitemap"></i> Challan Category Mapping</button>
        </div>
      </div>
      <div class="panel">
        <h3 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <span><i class="fa-solid fa-hourglass-half"></i> Pending BOM Orders <span style="font-weight:400;color:var(--txt-muted);font-size:11.5px;">(double-click a row to open it)</span></span>
          <button type="button" class="btn btn-ghost bom-mini-btn" id="bomHomeBtnRefresh"><i class="fa-solid fa-rotate"></i> Refresh</button>
        </h3>
        <div id="bomHomePendingWrap"><p class="note"><i class="fa-solid fa-spinner fa-spin"></i> Loading pending BOM orders...</p></div>
      </div>
    </div>
  `;
}

window.PAGES.bom = {
  name: 'BOM',
  icon: 'fa-list-check',
  sub: 'Bill of Material — kit-wise item list',
  html: `
    ${bomRenderHomeViewHtml()}
    <div id="bomEntryView" style="display:none;">
    <div class="page-head" style="justify-content:space-between; flex-wrap:wrap; gap:10px;">
      <div style="display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-list-check" style="color:var(--gold);"></i><h2>Bill of Material (BOM)</h2></div>
      <button type="button" class="btn btn-ghost" id="bomBtnBackHome"><i class="fa-solid fa-arrow-left"></i> Back to BOM Home</button>
    </div>

    <!-- Populated instead of the Kit Items panel when a pending order is
         opened from the BOM Home table / BOM Register — see
         bomOpenOrderInline() in init(). Hidden the rest of the time. -->
    <div class="panel" id="bomContinuePanel" style="display:none;">
      <h3><i class="fa-solid fa-truck"></i> Continue Dispatch <span style="font-weight:400;color:var(--txt-muted);font-size:11.5px;">(picking up a pending order)</span></h3>
      <div id="bomContinueInlineBody"></div>
    </div>

    <div class="panel" id="bomNewEntryPanel">
      <h3><i class="fa-solid fa-box-open"></i> New BOM Entry</h3>
      <div class="form-grid cols-2">
        <div class="field"><label>BOM Kit <span class="req">*</span></label>
          <div style="display:flex; gap:8px; align-items:center;">
            <select id="bomKitSelect" style="flex:1;">
              <option value="">-- Select Kit --</option>
            </select>
            <button type="button" class="btn btn-ghost" id="bomBtnEditKit" style="display:none; padding:9px 12px;" title="Edit this saved template"><i class="fa-solid fa-pen"></i></button>
            <button type="button" class="btn btn-red" id="bomBtnDeleteKit" style="display:none; padding:9px 12px;" title="Delete this saved template"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="field"><label>Order No <span class="req">*</span></label><input id="bomOrderNo" placeholder="Order no. / Customer short code" list="bomOrderNoList" autocomplete="off"><datalist id="bomOrderNoList"></datalist></div>

        <div class="field"><label>Customer Name <span class="req">*</span></label><input id="bomCustomerName" placeholder="Customer / Party" list="bomCustNameList" autocomplete="off"><datalist id="bomCustNameList"></datalist></div>
        <div class="field"><label>Dealer Name</label><input id="bomDealerName" placeholder="Dealer name or short name" list="bomDealerList" autocomplete="off"><datalist id="bomDealerList"></datalist></div>

        <div class="field"><label>Installer Name</label><input id="bomInstallerName" placeholder="Installer name or short name" list="bomInstallerList" autocomplete="off"><datalist id="bomInstallerList"></datalist></div>
        <div class="field"><label>Fabricatore Name</label><input id="bomFabricatorName" placeholder="Fabricator name or short name" list="bomFabricatorList" autocomplete="off"><datalist id="bomFabricatorList"></datalist></div>

        <div class="field"><label>Challan No.</label><input id="bomChallanNo" placeholder="Challan no."></div>
        <div class="field"><label>Ch. Date</label><input id="bomChallanDate" type="date"></div>
      </div>
      <div class="actions-row">
        <button class="btn btn-ghost" type="button" id="bomBtnPrint"><i class="fa-solid fa-print"></i> Print BOM (Excel format, 1 page)</button>
        <button class="btn btn-blue" type="button" id="bomBtnVerify" disabled><i class="fa-solid fa-check-double"></i> Verify BOM</button>
        <button class="btn btn-green" type="button" id="bomBtnChallan" disabled><i class="fa-solid fa-file-invoice"></i> Convert into Challan</button>
        <button class="btn btn-green" type="button" id="bomBtnDispatch" disabled><i class="fa-solid fa-truck"></i> Create Dispatch</button>
        <button class="btn btn-green" type="button" id="bomBtnCreateBom" style="display:none;"><i class="fa-solid fa-plus-circle"></i> Generate BOM</button>
        <button class="btn btn-ghost" type="button" id="bomBtnTrackBom"><i class="fa-solid fa-route"></i> Track BOM</button>
        <button class="btn btn-ghost" type="button" id="bomBtnPendingRegister"><i class="fa-solid fa-clipboard-list"></i> Pending BOM Register</button>
        <button type="button" class="btn btn-ghost" id="bomBtnNewKit" title="Create a new BOM Kit / Template"><i class="fa-solid fa-plus"></i> New Kit</button>
        <button type="button" class="btn btn-ghost" id="bomBtnChallanMap" style="display:none;" title="Decide which BOM item folds into which Challan line"><i class="fa-solid fa-sitemap"></i> Challan Category Mapping</button>
      </div>
      <p class="note" id="bomVerifyStatus" style="margin-top:8px;">
        <i class="fa-solid fa-circle-info"></i> Tick every item in the <b>Check</b> column below, then click <b>Verify BOM</b>. "Create Dispatch" stays locked until then.
      </p>
    </div>

    <div class="panel" id="bomKitBuilderPanel" style="display:none;">
      <h3 id="bomKitBuilderTitle"><i class="fa-solid fa-layer-group"></i> Create / Save New BOM Kit &amp; Template</h3>
      <div class="form-grid cols-2">
        <div class="field"><label>Kit Name <span class="req">*</span></label><input id="bomNewKitLabel" placeholder="e.g. 5 kW — Commercial 550 Wp"></div>
        <div class="field"><label>Capacity (kW)</label><input id="bomNewKitKw" placeholder="e.g. 5"></div>
      </div>
      <p class="note" style="margin:6px 0 14px;" id="bomKitBuilderHint">
        <i class="fa-solid fa-circle-info"></i> Starts pre-filled with the standard section/item format below — Model, Quantity &amp; Remarks are left blank for you to fill in. Add or remove sections/items freely, and item names can be renamed too.
      </p>
      <div id="bomNewKitSections"></div>
      <div class="actions-row" style="margin-top:10px;">
        <button class="btn btn-ghost" type="button" id="bomBtnAddKitSection"><i class="fa-solid fa-layer-group"></i> Add Section</button>
        <button class="btn btn-blue" type="button" id="bomBtnSaveKitTemplate"><i class="fa-solid fa-floppy-disk"></i> <span id="bomBtnSaveKitTemplateLabel">Save Kit Template</span></button>
        <button class="btn btn-ghost" type="button" id="bomBtnCancelKitBuilder">Cancel</button>
      </div>
    </div>

    <div class="panel" id="bomKitItemsPanel">
      <h3 style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
        <span><i class="fa-solid fa-list"></i> Kit Items <span style="font-weight:400;color:var(--txt-muted);font-size:11.5px;">(auto-filled from selected kit)</span></span>
        <button type="button" class="btn btn-blue bom-mini-btn" id="bomBtnTickAll" title="Tick every item's Check box in one click"><i class="fa-solid fa-check-double"></i> Tick All</button>
      </h3>
      <div id="bomItemsPreview">${bomRenderScreenItemsHtml(null)}</div>
    </div>

    <p class="note" style="margin-top:10px;">
      Yeh abhi front-end preview hai — direct BOM-kit dispatch aur ek dispatch mein saare items ek saath stock se
      deduct karne wala workflow, tumhara pura process samjhaane ke baad wire kiya jayega.
    </p>

    <!-- "Convert into Challan" — its OWN fullscreen modal (NOT the shared
         window.openModal/#modalOverlay small dialog, which is capped at
         max-width:480px in css/modules/components.css — far too narrow
         for this form + item table). Reuses the exact same
         .modal-overlay.modal-fullscreen pattern already used by Party
         Ledger's "Create/Edit Ledger" and "Ledger Account Statement"
         dialogs (css/modules/party-ledger.css) — genuinely maximized on
         desktop, fully responsive on mobile, no new CSS needed at all. -->
    <!-- PRINT-ONLY: exact Excel replica. Hidden on screen (see .bom-print-only
         in style.css); (re)built from the form fields above right before
         printing, then never shown on-screen at all — this is what fixes
         both the "doesn't look like software" issue and the mobile
         layout breaking, since this Excel-shaped markup no longer renders
         on screen or on phones at all. -->
    <div class="bom-print-only" id="bomPrintRoot"></div>

    <!-- PRINT-ONLY: exact Excel replica of the CHALLAN sheet (Customer Copy /
         Company Copy mirrored side by side). Same hidden-on-screen mechanism
         as #bomPrintRoot above (.bom-print-only) — only (re)built + shown for
         the instant "Print Challan" (inside the Convert into Challan modal)
         runs window.print(). Kept completely separate from #bomPrintRoot so
         the existing BOM print is never touched by this. -->
    <div class="bom-print-only" id="bomChallanPrintRoot"></div>
    </div><!-- /bomEntryView -->

    <!-- "Convert into Challan" / "Challan Category Mapping" — its OWN
         fullscreen modal (NOT the shared window.openModal/#modalOverlay
         small dialog, which is capped at max-width:480px in
         css/modules/components.css — far too narrow for this form + item
         table). Reuses the exact same .modal-overlay.modal-fullscreen
         pattern already used by Party Ledger's "Create/Edit Ledger" and
         "Ledger Account Statement" dialogs (css/modules/party-ledger.css)
         — genuinely maximized on desktop, fully responsive on mobile, no
         new CSS needed at all.
         IMPORTANT: kept OUTSIDE #bomEntryView on purpose, same reasoning
         as #bomRegisterOverlay below — the BOM Home screen's own "Challan
         Category Mapping" button opens this same overlay, and
         #bomEntryView is display:none while Home is showing. -->
    <div class="modal-overlay modal-fullscreen" id="bomChallanOverlay">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-head">
          <h3 id="bomChallanModalTitle"><i class="fa-solid fa-file-invoice"></i> Convert into Challan</h3>
          <button class="modal-close" id="bomChallanCloseBtn"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body" id="bomChallanModalBody"></div>
      </div>
    </div>

    <!-- Step 4: Pending BOM Register — lists every bom_orders row still
         Open (some item still pending) and lets you continue dispatching
         the remainder, from any session, without re-picking the kit or
         retyping what's already gone out. Same modal-fullscreen pattern
         as #bomChallanOverlay above; one overlay, body swapped between a
         "list" view and a "continue this order" view.
         IMPORTANT: kept OUTSIDE #bomEntryView on purpose — the BOM Home
         screen's own "BOM Register" button opens this same overlay, and
         #bomEntryView is display:none while Home is showing. Nesting this
         overlay inside #bomEntryView meant the overlay's own .show class
         was powerless against its hidden ancestor: clicking "BOM Register"
         from Home silently did nothing (overlay had .show but its parent
         was still display:none), and it would only actually appear once
         #bomEntryView itself became visible (e.g. after "Create BOM"). -->
    <div class="modal-overlay modal-fullscreen" id="bomRegisterOverlay">
      <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-head">
          <h3><i class="fa-solid fa-clipboard-list"></i> Pending BOM Register</h3>
          <button class="modal-close" id="bomRegisterCloseBtn"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body" id="bomRegisterModalBody"></div>
      </div>
    </div>
  `,

  async init() {
    const $ = (id) => document.getElementById(id);
    const kitSelect = $('bomKitSelect');
    const itemsPreview = $('bomItemsPreview');
    const kitItemsPanel = $('bomKitItemsPanel');
    const btnPrint = $('bomBtnPrint');
    const printRoot = $('bomPrintRoot');
    const challanPrintRoot = $('bomChallanPrintRoot');
    const challanOverlay = $('bomChallanOverlay');
    const challanModalBody = $('bomChallanModalBody');
    const challanCloseBtn = $('bomChallanCloseBtn');

    // ------------------------------------------------------------------
    // BOM Home <-> BOM Entry view switching. The BOM tab now lands on a
    // small launcher (bomHomeView: Create BOM / Track BOM / BOM Register +
    // a live pending-orders table) instead of dropping straight into the
    // full kit-selection form (bomEntryView, unchanged, just wrapped).
    // ------------------------------------------------------------------
    const homeView = $('bomHomeView');
    const entryView = $('bomEntryView');
    const continuePanel = $('bomContinuePanel');
    const continueInlineBody = $('bomContinueInlineBody');
    const newEntryPanel = $('bomNewEntryPanel');
    const btnBackHome = $('bomBtnBackHome');
    let bomInlineContinueOrderId = null; // set while bomContinuePanel is showing a specific order

    function showBomHome() {
      bomInlineContinueOrderId = null;
      if (entryView) entryView.style.display = 'none';
      if (homeView) homeView.style.display = '';
      bomLoadHomePendingTable();
    }
    function showBomEntry() {
      if (homeView) homeView.style.display = 'none';
      if (entryView) entryView.style.display = '';
    }
    // Fresh "Create BOM" entry: full kit-picker form, Continue Dispatch
    // panel hidden. Used by both the Home "Create BOM" button and the
    // entry screen's own "Back"-free default state.
    function showBomEntryForNewKit() {
      bomInlineContinueOrderId = null;
      if (continuePanel) continuePanel.style.display = 'none';
      if (newEntryPanel) newEntryPanel.style.display = '';
      const kip = $('bomKitItemsPanel');
      if (kip) kip.style.display = '';
      showBomEntry();
    }
    if (btnBackHome) btnBackHome.addEventListener('click', showBomHome);

    function bomOverallStatusFromItems(items) {
      const total = (items || []).reduce((s, it) => s + (it.total || 0), 0);
      const dispatched = (items || []).reduce((s, it) => s + (it.dispatched || 0), 0);
      if (dispatched <= 0) return 'Pending';
      if (dispatched >= total) return 'Dispatched';
      return 'Partially Dispatched';
    }

    function bomRenderHomePendingTableHtml(orders) {
      if (!orders || !orders.length) {
        return `<p class="note" style="padding:10px 0;"><i class="fa-solid fa-circle-check" style="color:var(--green);"></i> Nothing pending — every BOM order has been fully dispatched.</p>`;
      }
      const rows = orders.map((o) => `
        <tr class="bom-home-row" data-bom-order-id="${o.id}" style="cursor:pointer;" title="Double-click to open">
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);">${bomEsc(o.orderNo)}</td>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);">${bomEsc((o.header && o.header.customerName) || '-')}</td>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);">${o.pendingItemCount} item(s) / ${o.pendingQty} unit(s) pending</td>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);">${bomEsc((o.createdAt || '').slice(0, 10))}</td>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);"><button type="button" class="btn btn-blue bom-mini-btn" data-bom-order-id="${o.id}"><i class="fa-solid fa-truck"></i> Open</button></td>
        </tr>
      `).join('');
      return `
        <table style="width:100%; border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border, #ddd);">Order No</th>
            <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border, #ddd);">Customer</th>
            <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border, #ddd);">Pending</th>
            <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border, #ddd);">Started</th>
            <th style="border-bottom:2px solid var(--border, #ddd);"></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    async function bomLoadHomePendingTable() {
      const wrap = $('bomHomePendingWrap');
      if (!wrap) return;
      wrap.innerHTML = '<p class="note"><i class="fa-solid fa-spinner fa-spin"></i> Loading pending BOM orders...</p>';
      let orders;
      try {
        orders = await window.Api.get('/bom/orders?status=Open', { silent: true });
      } catch (e) {
        wrap.innerHTML = `<p class="note" style="color:var(--red);">Could not load pending BOM orders — ${bomEsc((e && e.message) || 'server error')}.</p>`;
        return;
      }
      // BOM Home's own "Pending BOM Orders" list is deliberately narrower
      // than the full BOM Register: it only shows Open orders that are
      // still completely untouched — created (Admin/SuperAdmin only, so
      // every row here is already admin-created) but with zero dispatch
      // trips against them yet (isUntouched, from GET /api/bom/orders —
      // see bom.routes.js's pendingForOrder). The moment even one item
      // gets partially dispatched, it drops off THIS list but keeps
      // showing in the full BOM Register (bomLoadRegisterList below,
      // which intentionally does NOT apply this filter).
      const untouched = (orders || []).filter((o) => o.isUntouched !== false);
      wrap.innerHTML = bomRenderHomePendingTableHtml(untouched);
      wrap.querySelectorAll('[data-bom-order-id]').forEach((el) => {
        const id = el.getAttribute('data-bom-order-id');
        if (el.tagName === 'BUTTON') {
          el.addEventListener('click', () => bomOpenOrderInline(id));
        } else {
          el.addEventListener('dblclick', () => bomOpenOrderInline(id));
        }
      });
    }

    const homeBtnCreate = $('bomHomeBtnCreate');
    const homeBtnTrack = $('bomHomeBtnTrack');
    const homeBtnRegister = $('bomHomeBtnRegister');
    const homeBtnRefresh = $('bomHomeBtnRefresh');
    if (homeBtnCreate) {
      homeBtnCreate.addEventListener('click', () => {
        showBomEntryForNewKit();
      });
    }
    if (homeBtnRefresh) homeBtnRefresh.addEventListener('click', bomLoadHomePendingTable);
    bomLoadHomePendingTable(); // initial load — BOM tab lands on the Home view

    // Open/close for the dedicated Challan modal — mirrors the
    // lockPageScroll/unlockPageScroll + .show/.no-scroll pattern Party
    // Ledger's own modal-fullscreen dialogs already use, so this behaves
    // identically to those (background locked while open, unlocked on close).
    function openChallanModal(bodyHtml) {
      if (!challanOverlay || !challanModalBody) return;
      challanModalBody.innerHTML = bodyHtml;
      challanOverlay.classList.add('show');
      document.body.classList.add('no-scroll');
    }
    function closeChallanModal() {
      if (!challanOverlay) return;
      challanOverlay.classList.remove('show');
      document.body.classList.remove('no-scroll');
    }
    if (challanCloseBtn) challanCloseBtn.addEventListener('click', closeChallanModal);
    if (challanOverlay) {
      challanOverlay.addEventListener('click', (e) => {
        if (e.target === challanOverlay) closeChallanModal(); // backdrop click only
      });
    }

    // ---------- Challan Category Mapping — admin editor (Goal 5) ----------
    // Reuses the same fullscreen Challan overlay/body (openChallanModal
    // above) — it's already a generic "big scrollable panel" host, no need
    // for a second modal shell. Lists every distinct item name that has
    // actually been used in at least one real BOM (GET
    // /api/bom/used-item-names — any bom_orders row, Open or Completed),
    // NOT every item listed in a Kit Template — a kit can carry items that
    // have never actually gone out under any Order No. yet, and mapping
    // those just clutters the editor. With "and even if there are 10
    // registers, only the items that appear across ALL of them show up
    // here" — the backend already de-duplicates across every bom_orders
    // row, so this only ever fetches, never merges anything client-side.
    // "Save Mapping" bulk-PUTs the whole set. This is the ONLY place
    // bomChallanCategoryMap changes — the Convert-into-Challan compress
    // logic (bomComputeChallanAutoQty) only ever reads it.
    async function bomCollectUsedItemNamesForMapping() {
      try {
        const data = await window.Api.get('/bom/used-item-names');
        return (data && Array.isArray(data.names)) ? data.names : [];
      } catch (e) {
        console.warn('bom: could not load used item names for Challan mapping', e);
        return [];
      }
    }

    function bomRenderChallanMapModalHtml(names) {
      const categoryOptions = (selected) =>
        `<option value="">-- Unmapped --</option>` +
        bomChallanCategoryList.map((c) => `<option value="${bomEscAttr(c)}" ${c === selected ? 'selected' : ''}>${bomEsc(c)}</option>`).join('');
      const rows = names.map((name) => `
        <tr>
          <td>${bomEsc(name)}</td>
          <td><select class="bom-field-input bom-challanmap-select" data-item-name="${bomEscAttr(name)}">${categoryOptions(bomChallanCategoryMap[name] || '')}</select></td>
        </tr>`).join('');
      return `
        <div id="bomChallanMapModalRoot">
          <p class="note" style="margin-bottom:12px;">
            <i class="fa-solid fa-circle-info"></i> Decide which Challan line each BOM item's quantity folds into.
            "GI Pipe" items are handled automatically (feet &rarr; 20/15/10/5-Feet pieces) &mdash; you only need to tag
            them "GI Pipe" here so they're excluded from every other category's count. Only items actually used in
            at least one BOM so far are listed below.
          </p>
          <div class="table-wrap" style="max-height:60vh;overflow:auto;">
            <table class="bom-items-form-table">
              <thead><tr><th>Item Name</th><th>Challan Category</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="2">No items used in any BOM yet.</td></tr>'}</tbody>
            </table>
          </div>
          <div class="actions-row" style="margin-top:14px;">
            <button type="button" class="btn btn-blue" id="bomChallanMapSaveBtn"><i class="fa-solid fa-floppy-disk"></i> Save Mapping</button>
          </div>
        </div>
      `;
    }

    async function bomOpenChallanMapModal() {
      openChallanModal('<p class="note"><i class="fa-solid fa-spinner fa-spin"></i> Loading items used across every BOM...</p>');
      const modalTitleEl = document.getElementById('bomChallanModalTitle');
      if (modalTitleEl) modalTitleEl.innerHTML = '<i class="fa-solid fa-sitemap"></i> Challan Category Mapping';
      // Re-fetch BOTH the category list and the used-item list fresh every
      // time this opens — never rely solely on init()'s one-time load
      // having succeeded (a slow/failed first-load fetch used to leave
      // bomChallanCategoryList permanently empty for the rest of the
      // session, which is why every dropdown only ever showed
      // "-- Unmapped --" with no real categories to pick from).
      const [, names] = await Promise.all([bomLoadChallanCategoryMap(), bomCollectUsedItemNamesForMapping()]);
      openChallanModal(bomRenderChallanMapModalHtml(names));
      if (modalTitleEl) modalTitleEl.innerHTML = '<i class="fa-solid fa-sitemap"></i> Challan Category Mapping';
      const saveBtn = document.getElementById('bomChallanMapSaveBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          const mappings = Array.from(document.querySelectorAll('.bom-challanmap-select')).map((sel) => ({
            itemName: sel.getAttribute('data-item-name'),
            category: sel.value,
          }));
          saveBtn.disabled = true;
          try {
            await window.Api.put('/challan/category-map', { mappings });
            await bomLoadChallanCategoryMap(); // refresh the in-memory map the compress logic reads
            if (window.showToast) window.showToast('Challan category mapping saved.');
            closeChallanModal();
          } catch (e) {
            window.openModal('Save Failed', `<p>${bomEsc((e && e.message) || 'Could not save the mapping. Please try again.')}</p>`);
          } finally {
            saveBtn.disabled = false;
          }
        });
      }
    }

    // Step 4: Pending BOM Register modal — same open/close pattern as the
    // Challan modal above, kept as its own overlay/functions so neither
    // modal's state ever leaks into the other.
    const registerOverlay = $('bomRegisterOverlay');
    const registerModalBody = $('bomRegisterModalBody');
    const registerCloseBtn = $('bomRegisterCloseBtn');
    const btnPendingRegister = $('bomBtnPendingRegister');
    function openRegisterModal(bodyHtml) {
      if (!registerOverlay || !registerModalBody) return;
      registerModalBody.innerHTML = bodyHtml;
      registerOverlay.classList.add('show');
      document.body.classList.add('no-scroll');
    }
    function closeRegisterModal() {
      if (!registerOverlay) return;
      registerOverlay.classList.remove('show');
      document.body.classList.remove('no-scroll');
    }
    if (registerCloseBtn) registerCloseBtn.addEventListener('click', closeRegisterModal);
    if (registerOverlay) {
      registerOverlay.addEventListener('click', (e) => {
        if (e.target === registerOverlay) closeRegisterModal(); // backdrop click only
      });
    }

    // Row/section add-delete (Add Item, Remove Item, Add Section, Remove
    // Section) is an Admin/SuperAdmin-only action — a plain User can still
    // edit every field (name/model/qty/serial/remarks) and tick items, but
    // cannot restructure the kit. Computed early so it's available to the
    // very first render below (bomRenderScreenItemsHtml reads it via opts).
    const bomCurrentRole = window.currentUserRole || 'User';
    const bomIsAdmin = bomCurrentRole === 'SuperAdmin' || bomCurrentRole === 'Admin';

    // ---------------- BOM: Create BOM + Track BOM — now REAL, wired to
    // POST /api/bom/orders and GET /api/bom/orders/by-order-no/:orderNo. ----
    // Create BOM (Admin/SuperAdmin only) captures the kit's full baseline
    // (every item's full Quantity) as a bom_orders row up front, before any
    // dispatch trip — it then shows up in BOM Home / BOM Register as
    // "Pending" and flips to "Partially Dispatched"/"Dispatched" on its own
    // as real dispatch trips go out (status is derived from dispatched vs
    // total each time it's read — see bomOverallStatusFromItems above and
    // the server's matching helper in bom.routes.js, no separate DB status
    // needed). Track BOM (visible to everyone) is the read-only counterpart:
    // look up any Order No. and see its real status + per-item breakdown +
    // full dispatch-trip history.
    const btnCreateBom = $('bomBtnCreateBom');
    const btnTrackBom = $('bomBtnTrackBom');
    if (btnCreateBom) btnCreateBom.style.display = bomIsAdmin ? '' : 'none';

    function bomTrackStatusPill(status) {
      const map = {
        Pending: { color: '#a15c00', bg: '#fff3da' },
        'Partially Dispatched': { color: '#0b5ea8', bg: '#e4f1ff' },
        Dispatched: { color: '#1a7f37', bg: '#e6f7ea' },
      };
      const c = map[status] || map.Pending;
      return `<span style="display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; color:${c.color}; background:${c.bg};">${bomEsc(status)}</span>`;
    }

    function bomFmtDateTime(v) {
      if (!v) return '';
      const d = new Date(v);
      if (isNaN(d.getTime())) return String(v);
      return d.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    }

    // Renders the real per-item breakdown + trip-by-trip dispatch history
    // returned by GET /api/bom/orders/by-order-no/:orderNo. `data.trips` is
    // ordered oldest-first, so each trip is one visual "step" — a genuine
    // timeline built from bom_dispatches rows, not a sample/mock one.
    function bomRenderTrackResultHtml(data) {
      const itemRows = (data.items || []).map((it) => `
        <tr>
          <td style="padding:6px 8px; border-bottom:1px solid var(--border, #eee);">${bomEsc(it.name)}</td>
          <td style="padding:6px 8px; border-bottom:1px solid var(--border, #eee); text-align:center;">${it.total}</td>
          <td style="padding:6px 8px; border-bottom:1px solid var(--border, #eee); text-align:center;">${it.dispatched}</td>
          <td style="padding:6px 8px; border-bottom:1px solid var(--border, #eee); text-align:center; color:${it.remaining > 0 ? 'var(--red, #c0392b)' : 'var(--green, #1a7f37)'};">${it.remaining}</td>
        </tr>
      `).join('');

      const trips = data.trips || [];
      const tripSteps = trips.length
        ? trips.map((t, idx) => {
            const isLast = idx === trips.length - 1;
            const itemsLine = (t.items || []).map((it) => `${bomEsc(it.name)} &times; ${it.qty}`).join(', ') || '—';
            return `
              <div style="display:flex; gap:12px;">
                <div style="display:flex; flex-direction:column; align-items:center;">
                  <div style="width:26px; height:26px; border-radius:50%; background:#1a7f37; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; flex-shrink:0;">
                    <i class="fa-solid fa-truck"></i>
                  </div>
                  ${!isLast ? `<div style="width:2px; flex:1; background:#1a7f37; min-height:26px;"></div>` : ''}
                </div>
                <div style="padding-bottom:20px;">
                  <div style="font-weight:600; font-size:13.5px;">Trip ${idx + 1} <span style="font-weight:400; color:var(--txt-muted); font-size:11.5px;">(${bomEsc(t.dispatchedBy || 'Unknown user')})</span></div>
                  <div style="font-size:12px; color:var(--txt-muted); margin-top:2px;">${bomEsc(itemsLine)}</div>
                  <div style="font-size:11px; color:var(--txt-muted); margin-top:2px;">${bomEsc(bomFmtDateTime(t.dispatchedAt))}</div>
                </div>
              </div>
            `;
          }).join('')
        : `<p class="note"><i class="fa-solid fa-circle-info"></i> No dispatch trips yet — this BOM is created but nothing has gone out.</p>`;

      return `
        <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="font-weight:700; font-size:15px;">Order No <span style="color:var(--gold, #b8860b);">${bomEsc(data.orderNo)}</span></div>
            <div style="font-size:12px; color:var(--txt-muted); margin-top:2px;">${bomEsc((data.header && data.header.customerName) || '')}</div>
            <div style="margin-top:6px;">${bomTrackStatusPill(data.status)}</div>
          </div>
        </div>
        <table style="width:100%; border-collapse:collapse; margin-bottom:16px;">
          <thead><tr>
            <th style="text-align:left; padding:6px 8px; border-bottom:2px solid var(--border, #ddd);">Item</th>
            <th style="padding:6px 8px; border-bottom:2px solid var(--border, #ddd);">Total</th>
            <th style="padding:6px 8px; border-bottom:2px solid var(--border, #ddd);">Dispatched</th>
            <th style="padding:6px 8px; border-bottom:2px solid var(--border, #ddd);">Pending</th>
          </tr></thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div style="font-weight:600; font-size:13px; margin-bottom:10px;">Dispatch Trips</div>
        <div>${tripSteps}</div>
      `;
    }

    async function bomFetchAndRenderTrack(orderNo, resultBox) {
      resultBox.innerHTML = '<p class="note"><i class="fa-solid fa-spinner fa-spin"></i> Looking up this BOM...</p>';
      try {
        const data = await window.Api.get(`/bom/orders/by-order-no/${encodeURIComponent(orderNo)}`, { silent: true });
        resultBox.innerHTML = bomRenderTrackResultHtml(data);
      } catch (e) {
        const msg = (e && e.message) || 'Could not fetch this BOM.';
        resultBox.innerHTML = `<p class="note" style="color:var(--red);">${bomEsc(msg)}</p>`;
      }
    }

    // Home screen's Track BOM — asks for an Order No. since there's no
    // "current" BOM in context there.
    function bomOpenTrackModal() {
      window.openModal('Track BOM', `
        <div class="field" style="margin-bottom:12px;">
          <label>Order No.</label>
          <div style="display:flex; gap:8px;">
            <input type="text" id="bomTrackOrderInput" placeholder="e.g. ORD-1234" style="flex:1;">
            <button type="button" class="btn btn-blue" id="bomTrackSearchBtn"><i class="fa-solid fa-magnifying-glass"></i> Track</button>
          </div>
        </div>
        <div id="bomTrackResult"></div>
      `);
      const input = document.getElementById('bomTrackOrderInput');
      const searchBtn = document.getElementById('bomTrackSearchBtn');
      const resultBox = document.getElementById('bomTrackResult');
      function runTrack() {
        const orderNo = ((input && input.value) || '').trim();
        if (!orderNo) {
          if (resultBox) resultBox.innerHTML = '<p class="note" style="color:var(--red);">Enter an Order No. first.</p>';
          return;
        }
        bomFetchAndRenderTrack(orderNo, resultBox);
      }
      if (searchBtn) searchBtn.addEventListener('click', runTrack);
      if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') runTrack(); });
      if (input) input.focus();
    }

    // Used wherever the Order No. is already known — the BOM Entry
    // screen's own Track BOM button, and the Continue Dispatch form's
    // "Track This BOM" button — so the person never has to retype it.
    function bomOpenTrackForOrderNo(orderNo) {
      window.openModal('Track BOM', `<div id="bomTrackResult"></div>`);
      const resultBox = document.getElementById('bomTrackResult');
      if (resultBox) bomFetchAndRenderTrack(orderNo, resultBox);
    }

    // Entry screen's Track BOM: uses whichever Order No. is "current" —
    // the order being continued via BOM Home/Register, or whatever's typed
    // into the Order No. field for a fresh kit — no prompt needed.
    function bomTrackCurrentOrder() {
      const fromField = ($('bomOrderNo') && $('bomOrderNo').value.trim()) || '';
      if (!fromField) {
        window.openModal('Order No. Required', '<p>Enter an <b>Order No.</b> above first, or open an existing order from BOM Home / BOM Register.</p>');
        return;
      }
      bomOpenTrackForOrderNo(fromField);
    }

    // Create BOM — captures the currently-selected kit's FULL baseline
    // (every item's full Quantity, not a partial Dispatch Qty) as a real
    // bom_orders row, before any dispatch trip goes out.
    function bomCollectItemsForCreate() {
      const out = [];
      (currentKitState || []).forEach((sec) => {
        (sec.items || []).forEach((it) => {
          const name = (it.name || '').trim();
          const qty = Number(it.qty) || 0;
          if (name && qty > 0) out.push({ name, qty });
        });
      });
      return out;
    }

    function bomOpenCreateBomModal() {
      if (!currentKitState) {
        window.openModal('Select a Kit', '<p>Please select a BOM Kit before generating a BOM.</p>');
        return;
      }
      const header = getHeaderValues();
      const orderNo = (header.orderNo || '').trim();
      if (!orderNo) {
        window.openModal('Order No. Required', '<p>Please enter an <b>Order No.</b> before generating a BOM.</p>');
        return;
      }
      if (!(header.customerName || '').trim()) {
        window.openModal('Customer Name Required', '<p>Please enter a <b>Customer Name</b> before generating a BOM.</p>');
        return;
      }
      const items = bomCollectItemsForCreate();
      if (!items.length) {
        window.openModal('No Items', '<p>Add at least one item with a quantity before generating a BOM.</p>');
        return;
      }
      window.openModal('Generate BOM', `
        <p class="note" style="margin-bottom:10px;">
          <i class="fa-solid fa-circle-info"></i> This creates the BOM as a tracked entity — before any dispatch happens.
          It will land in <b>BOM Home</b> / the <b>BOM Register</b> as <b>Pending</b> until the first trip goes out, then move to
          <b>Partially Dispatched</b> or <b>Dispatched</b> on its own as dispatch progresses.
        </p>
        <table style="width:100%; border-collapse:collapse; margin-bottom:14px;">
          <tr><td style="padding:6px 0; color:var(--txt-muted);">Order No.</td><td style="padding:6px 0; font-weight:600;">${bomEsc(orderNo)}</td></tr>
          <tr><td style="padding:6px 0; color:var(--txt-muted);">Customer</td><td style="padding:6px 0; font-weight:600;">${bomEsc(header.customerName || '—')}</td></tr>
          <tr><td style="padding:6px 0; color:var(--txt-muted);">Items</td><td style="padding:6px 0; font-weight:600;">${items.length} item(s)</td></tr>
          <tr><td style="padding:6px 0; color:var(--txt-muted);">Initial Status</td><td style="padding:6px 0;">${bomTrackStatusPill('Pending')}</td></tr>
        </table>
        <div class="actions-row">
          <button type="button" class="btn btn-green" id="bomCreateBomConfirmBtn"><i class="fa-solid fa-check"></i> Generate BOM</button>
          <button type="button" class="btn btn-ghost" id="bomCreateBomCancelBtn">Cancel</button>
        </div>
      `);
      const confirmBtn = document.getElementById('bomCreateBomConfirmBtn');
      const cancelBtn = document.getElementById('bomCreateBomCancelBtn');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
          const originalLabel = confirmBtn.innerHTML;
          confirmBtn.disabled = true;
          confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
          try {
            await window.Api.post('/bom/orders', { orderNo, header, items });
          } catch (e) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalLabel;
            window.openModal('Could Not Generate BOM', `<p>${bomEsc((e && e.message) || 'Server error. Please try again.')}</p>`);
            return;
          }
          window.closeModal();
          if (window.showToast) window.showToast('BOM generated — it now appears in BOM Home / BOM Register as Pending.');
          showBomHome();
        });
      }
      if (cancelBtn) cancelBtn.addEventListener('click', () => window.closeModal());
    }

    if (btnCreateBom) btnCreateBom.addEventListener('click', bomOpenCreateBomModal);
    if (btnTrackBom) btnTrackBom.addEventListener('click', bomTrackCurrentOrder);
    if (homeBtnTrack) homeBtnTrack.addEventListener('click', bomOpenTrackModal);

    // Item -> category -> Serial No. mandatory lookup. Panels (and any other
    // category with the Serial No. mandatory rule set in Masters > Category)
    // are tracked by serial number on Purchase Inward already, so Dispatch
    // (outward) mirrors that with a Serial No. field per matching item. This
    // never touches the print sheet — bomRenderPrintSheetHtml is untouched.
    let bomCategorySerialMandatory = {};
    let bomItemCategoryByName = {};
    async function bomLoadSerialMandatoryInfo() {
      try {
        const [items, cats] = await Promise.all([
          window.Api.get('/masters/items'),
          window.Api.get('/masters/categories'),
        ]);
        bomCategoryNameList = (cats || []).map((c) => c.name).filter(Boolean);
        bomItemsByCategory = {};
        (cats || []).forEach((c) => { bomCategorySerialMandatory[c.name] = !!c.serial_mandatory; });
        (items || []).forEach((it) => {
          if (!it.name) return;
          bomItemCategoryByName[it.name] = it.category;
          if (!it.category) return;
          if (!bomItemsByCategory[it.category]) bomItemsByCategory[it.category] = [];
          bomItemsByCategory[it.category].push(it.name);
        });
      } catch (e) {
        // API/DB not reachable in this preview — no item is treated as serial-mandatory,
        // and the Category/Model dropdowns on category-driven sections fall back to empty lists.
      }
    }
    function bomItemNeedsSerial(name) {
      const cat = bomItemCategoryByName[name];
      return !!(cat && bomCategorySerialMandatory[cat]);
    }

    // Live, mutable clone of the selected kit's `sections`. Selecting a kit
    // auto-fills this from BOM_KITS; every field rendered from it is a real
    // input/select, so edits below write straight back into this object —
    // this is what actually gets printed (not the static BOM_KITS data).
    let currentKitState = null;

    // ---------------- Customer ledger live autocomplete + autofill ---------
    // Same idea as Sale/Purchase, but without a separate Short Code field:
    // a customer's short code IS the Order No here, so typing in Order No
    // itself live-searches customer ledgers by short code, and the instant
    // it exactly matches one, Customer Name auto-fills. Typing directly in
    // Customer Name still searches/auto-fills by full name. Both fields
    // stay fully editable so the person can type over the auto-filled value.
    const bomCustNameList = $('bomCustNameList');
    const bomOrderNoList = $('bomOrderNoList');
    let bomCustSearchTimer = null;

    async function searchBomCustomerLedgers(q) {
      // silent: true — this fires on every keystroke (debounced) for
      // autocomplete; flashing the full-screen loader on each one made the
      // BOM page feel like it was constantly "loading". The initial focus
      // load (empty query) also goes through here and stays silent for the
      // same reason — it's a background suggestion fetch, not a page load.
      try { return await window.Api.get(`/ledgers?type=Customer&q=${encodeURIComponent(q)}`, { silent: true }); }
      catch (e) { return []; }
    }
    async function searchBomCustomerShortCodes(q) {
      try { return await window.Api.get(`/ledgers/shortcodes?type=Customer&q=${encodeURIComponent(q)}`, { silent: true }); }
      catch (e) { return []; }
    }
    function fillBomCustomerDatalist(listEl, ledgers, key) {
      if (!listEl) return;
      listEl.innerHTML = ledgers
        .filter((l) => String(l[key] || '').trim() !== '')
        .map((l) => `<option value="${String(l[key]).replace(/"/g, '&quot;')}">`).join('');
    }
    function wireBomCustomerAutocomplete(inputEl, listEl, matchKey, searchFn) {
      if (!inputEl || !listEl) return;
      inputEl.addEventListener('input', () => {
        const text = inputEl.value;
        clearTimeout(bomCustSearchTimer);
        bomCustSearchTimer = setTimeout(async () => {
          const ledgers = await searchFn(text);
          fillBomCustomerDatalist(listEl, ledgers, matchKey);
          const exact = ledgers.find((l) => String(l[matchKey] || '').trim().toLowerCase() === text.trim().toLowerCase());
          if (exact) $('bomCustomerName').value = exact.name || '';
        }, 250);
      });
      inputEl.addEventListener('focus', async () => {
        if (inputEl.value.trim()) return;
        const ledgers = await searchFn('');
        fillBomCustomerDatalist(listEl, ledgers, matchKey);
      });
    }
    wireBomCustomerAutocomplete($('bomCustomerName'), bomCustNameList, 'name', searchBomCustomerLedgers);
    wireBomCustomerAutocomplete($('bomOrderNo'), bomOrderNoList, 'short', searchBomCustomerShortCodes);

    // ---------------- Dealer / Installer / Fabricator ledger autocomplete --
    // These are now real Party Ledger types too. Each field here is a single
    // Name box (no separate short-code field), so this searches by EITHER
    // full name or short name (the plain /ledgers endpoint already matches
    // both) and shows the matching full name in the dropdown — typing the
    // short name and picking/matching it fills the box with the full name.
    function wireBomPartyTypeAutocomplete(inputEl, listEl, ledgerType) {
      if (!inputEl || !listEl) return;
      let timer = null;
      async function search(q) {
        // silent: true — same reasoning as searchBomCustomerLedgers above:
        // this is a debounced keystroke-driven autocomplete call, not a
        // user-initiated page load, so it shouldn't flash the full-screen
        // loader every time someone types a letter.
        try { return await window.Api.get(`/ledgers?type=${encodeURIComponent(ledgerType)}&q=${encodeURIComponent(q)}`, { silent: true }); }
        catch (e) { return []; }
      }
      function fillList(ledgers) {
        listEl.innerHTML = ledgers
          .filter((l) => String(l.name || '').trim() !== '')
          .map((l) => `<option value="${bomEscAttr(l.name)}">`).join('');
      }
      inputEl.addEventListener('input', () => {
        const text = inputEl.value;
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const ledgers = await search(text);
          fillList(ledgers);
          const exact = ledgers.find((l) => {
            const t = text.trim().toLowerCase();
            return String(l.name || '').trim().toLowerCase() === t || String(l.short || '').trim().toLowerCase() === t;
          });
          if (exact) inputEl.value = exact.name || '';
        }, 250);
      });
      inputEl.addEventListener('focus', async () => {
        if (inputEl.value.trim()) return;
        fillList(await search(''));
      });
    }
    wireBomPartyTypeAutocomplete($('bomDealerName'), $('bomDealerList'), 'Dealer');
    wireBomPartyTypeAutocomplete($('bomInstallerName'), $('bomInstallerList'), 'Installer');
    wireBomPartyTypeAutocomplete($('bomFabricatorName'), $('bomFabricatorList'), 'Fabricator');

    // ---------------- Ch. Date: calendar-picker only, no manual typing -----
    // Mirrors sales.js/purchase.js: clicking opens the native date picker,
    // and every keystroke except Tab is blocked, so the date can only be
    // set by picking it from the calendar.
    const bomChallanDateEl = $('bomChallanDate');
    if (bomChallanDateEl) {
      bomChallanDateEl.addEventListener('click', () => {
        if (bomChallanDateEl.showPicker) { try { bomChallanDateEl.showPicker(); } catch (e) {} }
      });
      bomChallanDateEl.addEventListener('keydown', (e) => { if (e.key !== 'Tab') e.preventDefault(); });
    }

    // "Verify BOM" gate: Create Dispatch stays locked until the person
    // explicitly confirms the BOM is ready. Any kit change or item edit
    // after that re-locks it, since the verified snapshot no longer matches
    // what's on screen.
    const btnVerify = $('bomBtnVerify');
    const btnDispatch = $('bomBtnDispatch');
    const btnChallan = $('bomBtnChallan');
    const verifyStatus = $('bomVerifyStatus');
    let bomVerified = false;
    function setVerified(isVerified) {
      bomVerified = isVerified;
      if (btnDispatch) btnDispatch.disabled = !isVerified;
      if (btnChallan) btnChallan.disabled = !isVerified;
      if (verifyStatus) {
        verifyStatus.innerHTML = isVerified
          ? '<i class="fa-solid fa-circle-check" style="color:var(--green);"></i> Verified — ready for dispatch.'
          : '<i class="fa-solid fa-circle-info"></i> Tick every item in the <b>Check</b> column below, then click <b>Verify BOM</b>. "Create Dispatch" stays locked until then.';
      }
    }

    // On-screen equivalent of the print sheet's blank "Checked" box: Verify
    // BOM stays disabled until every item, in every section, is ticked.
    function allItemsChecked() {
      if (!currentKitState || !currentKitState.length) return false;
      return currentKitState.every((sec) => sec.items.length && sec.items.every((it) => it.checked));
    }
    function updateVerifyButtonState() {
      if (btnVerify) btnVerify.disabled = !allItemsChecked();
    }

    // "Tick All" — ticks every item's Check box in one click instead of
    // clicking each row individually. Items whose category needs a Serial
    // No. (see bomItemNeedsSerial) are still held to the same rule as
    // ticking them one-by-one in handleItemFieldEdit below: they only get
    // ticked if their serials are already fully entered, otherwise they're
    // left unticked and the person is told how many still need serials.
    const btnTickAll = $('bomBtnTickAll');
    if (btnTickAll) {
      btnTickAll.addEventListener('click', () => {
        if (!currentKitState || !currentKitState.length) {
          window.openModal('Select a Kit', '<p>Select a BOM Kit above to load its items before ticking all.</p>');
          return;
        }
        let blocked = 0;
        currentKitState.forEach((sec) => {
          sec.items.forEach((it) => {
            if (bomItemNeedsSerial(it.name)) {
              const required = bomEffectiveQty(it);
              const entered = bomSplitSerials(it.serials).length;
              if (!entered || (required != null && entered !== required)) {
                blocked += 1;
                return; // leave this one unticked — same rule as a manual tick
              }
            }
            it.checked = true;
          });
        });
        rerenderItemsPreview();
        if (blocked > 0) {
          window.openModal('Some Items Skipped', `<p>${blocked} item(s) still need their Serial No. entered before they can be ticked — fill those in, then click <b>Tick All</b> again.</p>`);
        } else if (window.showToast) {
          window.showToast('All items ticked.');
        }
      });
    }

    // Real item master (Masters > Item Registration) drives the Item Name
    // dropdown once the API/DB is reachable; falls back to kit-derived names
    // otherwise (see bomLoadItemMasterNames). Load once, up front.
    await bomLoadItemMasterNames();
    await bomLoadSerialMandatoryInfo();
    await bomLoadChallanCategoryMap();

    const btnDeleteKit = $('bomBtnDeleteKit');
    const btnEditKit = $('bomBtnEditKit');

    // Both Edit and Delete only make sense for a saved custom template
    // (built-in kits don't exist anymore per BOM_KITS being empty, but the
    // bomIsCustomKitKey guard is kept so this stays correct either way),
    // and — same as "New Kit" — restructuring a kit template is an
    // Admin/SuperAdmin-only action.
    function updateKitActionButtons() {
      const showActions = bomIsAdmin && bomIsCustomKitKey(kitSelect.value);
      if (btnDeleteKit) btnDeleteKit.style.display = showActions ? '' : 'none';
      if (btnEditKit) btnEditKit.style.display = showActions ? '' : 'none';
    }

    // Populate the kW dropdown from BOM_KITS + any saved custom templates.
    // Pulled into its own function since saving/deleting a template needs
    // to rebuild this list without a full page reload.
    function populateKitDropdown(selectKey) {
      const previousValue = selectKey !== undefined ? selectKey : kitSelect.value;
      kitSelect.innerHTML = '<option value="">-- Select Kit --</option>';
      const allKits = bomGetAllKits();
      Object.keys(allKits).forEach((key) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = allKits[key].label;
        kitSelect.appendChild(opt);
      });
      const keys = Object.keys(allKits);
      if (previousValue && allKits[previousValue]) {
        kitSelect.value = previousValue;
      } else if (keys.length === 1) {
        // Only one kit exists right now — auto-select it so the preview isn't empty.
        kitSelect.value = keys[0];
      }
      updateKitActionButtons();
    }
    populateKitDropdown();

    function refreshItemsPreview() {
      const kit = bomGetAllKits()[kitSelect.value];
      // Deep clone so editing on-screen never mutates the kit catalogue itself.
      currentKitState = kit ? JSON.parse(JSON.stringify(kit.sections)) : null;
      bomNormalizeDispatchQty(currentKitState); // Dispatch Qty defaults to Quantity until User narrows it for a partial dispatch
      itemsPreview.innerHTML = bomRenderScreenItemsHtml(currentKitState, { isAdmin: bomIsAdmin, needsSerial: bomItemNeedsSerial });
      setVerified(false); // changing the kit invalidates any prior verification
      updateVerifyButtonState(); // fresh kit — nothing ticked yet, Verify stays disabled
      updateKitActionButtons();
    }
    kitSelect.addEventListener('change', refreshItemsPreview);
    refreshItemsPreview();

    if (btnDeleteKit) {
      btnDeleteKit.addEventListener('click', async () => {
        const key = kitSelect.value;
        if (!bomIsCustomKitKey(key)) return;
        const custom = bomLoadCustomKits();
        const kitLabel = custom[key] ? custom[key].label : 'this kit';
        const confirmed = await window.confirmDanger(
          'Delete Kit Template',
          `Delete the saved template "${kitLabel}"? This cannot be undone.`,
        );
        if (!confirmed) return;
        delete custom[key];
        bomSaveCustomKits(custom);
        populateKitDropdown('');
        refreshItemsPreview();
        if (window.showToast) window.showToast('Kit template deleted.');
      });
    }

    // ---------- Create / Save New Kit Template ----------
    const kitBuilderPanel = $('bomKitBuilderPanel');
    const btnNewKit = $('bomBtnNewKit');
    const btnCancelKitBuilder = $('bomBtnCancelKitBuilder');
    const btnAddKitSection = $('bomBtnAddKitSection');
    const btnSaveKitTemplate = $('bomBtnSaveKitTemplate');
    const kitBuilderSectionsEl = $('bomNewKitSections');
    const newKitLabelInput = $('bomNewKitLabel');
    const newKitKwInput = $('bomNewKitKw');

    // "New Kit" (creating/saving a BOM Kit template) is an Admin/SuperAdmin
    // action only — a plain User should not see the option at all, same
    // role gate used for the edit sections in sales.js/purchase.js. (role
    // computed once, near the top of init() — see bomIsAdmin above.)
    if (btnNewKit) btnNewKit.style.display = bomIsAdmin ? '' : 'none';

    // "Challan Category Mapping" — same Admin/SuperAdmin gate as New Kit:
    // this decides which BOM item's quantity feeds which Challan summary
    // line, same trust level as editing an Item Master rule. Wired on BOTH
    // the Entry screen's own button AND the BOM Home launcher's button
    // (bomHomeBtnChallanMap) — same modal, same handler, just two entry
    // points so it doesn't require opening/creating a BOM first.
    const btnChallanMap = $('bomBtnChallanMap');
    const homeBtnChallanMap = $('bomHomeBtnChallanMap');
    if (btnChallanMap) {
      btnChallanMap.style.display = bomIsAdmin ? '' : 'none';
      btnChallanMap.addEventListener('click', bomOpenChallanMapModal);
    }
    if (homeBtnChallanMap) {
      homeBtnChallanMap.style.display = bomIsAdmin ? '' : 'none';
      homeBtnChallanMap.addEventListener('click', bomOpenChallanMapModal);
    }

    // Live, mutable working copy of the kit being built — same
    // {title, items:[{sr,name,model,qty,remarks}]} shape as any real kit's
    // `sections`, so it saves straight into the same catalogue format.
    let newKitSections = [];

    // Set to the kit's storage key (e.g. "custom_5-kw-commercial-550-wp")
    // while editing an EXISTING saved template via the pencil/"Edit Kit"
    // button, and back to null for a brand new kit ("New Kit"). This is
    // the only thing that tells Save whether to overwrite that same key
    // in place or mint a fresh one — see btnSaveKitTemplate below.
    let editingKitKey = null;

    const kitBuilderTitleEl = $('bomKitBuilderTitle');
    const kitBuilderHintEl = $('bomKitBuilderHint');
    const saveKitTemplateLabelEl = $('bomBtnSaveKitTemplateLabel');

    // Swaps the builder's heading/hint/save-button text between "creating
    // a brand new kit" and "editing an existing one" — purely cosmetic,
    // but stops someone editing "3.3 kW" from mistakenly thinking they're
    // about to create a whole new template.
    function setKitBuilderMode(isEdit) {
      if (kitBuilderTitleEl) {
        kitBuilderTitleEl.innerHTML = isEdit
          ? '<i class="fa-solid fa-pen"></i> Edit BOM Kit &amp; Template'
          : '<i class="fa-solid fa-layer-group"></i> Create / Save New BOM Kit &amp; Template';
      }
      if (kitBuilderHintEl) {
        kitBuilderHintEl.innerHTML = isEdit
          ? '<i class="fa-solid fa-circle-info"></i> Editing the saved template selected in the BOM Kit dropdown. Change anything below, then click Update — every BOM created from this kit AFTER saving will use the new list (BOMs already created keep their own frozen item list).'
          : '<i class="fa-solid fa-circle-info"></i> Starts pre-filled with the standard section/item format below — Model, Quantity &amp; Remarks are left blank for you to fill in. Add or remove sections/items freely, and item names can be renamed too.';
      }
      if (saveKitTemplateLabelEl) saveKitTemplateLabelEl.textContent = isEdit ? 'Update Kit Template' : 'Save Kit Template';
    }

    function renderKitBuilderSections() {
      bomRenumberAll(newKitSections);
      kitBuilderSectionsEl.innerHTML = newKitSections.map((sec, si) => `
        <div class="panel" style="margin-bottom:14px; background:rgba(255,255,255,0.02);">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px;">
            <input type="text" class="bom-field-input" data-bsec="${si}" data-bfield="sectitle" value="${bomEscAttr(sec.title)}" style="max-width:280px; font-weight:700;">
            <button type="button" class="btn btn-red bom-mini-btn" data-bsec-remove="${si}" ${newKitSections.length <= 1 ? 'disabled' : ''}><i class="fa-solid fa-trash"></i> Remove Section</button>
          </div>
          <div class="table-wrap">
            <table class="bom-items-form-table">
              <thead><tr><th>Sr No.</th><th>Item Name</th><th>Model</th><th>Quantity</th><th>Remarks</th><th></th></tr></thead>
              <tbody>
                ${sec.items.map((it, ii) => `
                  <tr>
                    <td><input type="text" class="bom-field-input" data-bsec="${si}" data-bidx="${ii}" data-bfield="sr" value="${bomEscAttr(it.sr)}"></td>
                    <td><input type="text" class="bom-field-input" data-bsec="${si}" data-bidx="${ii}" data-bfield="name" placeholder="Item name" value="${bomEscAttr(it.name)}"></td>
                    <td><input type="text" class="bom-field-input" data-bsec="${si}" data-bidx="${ii}" data-bfield="model" placeholder="Model" value="${bomEscAttr(it.model)}"></td>
                    <td><input type="text" class="bom-field-input" data-bsec="${si}" data-bidx="${ii}" data-bfield="qty" placeholder="Quantity" value="${bomEscAttr(it.qty)}"></td>
                    <td><input type="text" class="bom-field-input" data-bsec="${si}" data-bidx="${ii}" data-bfield="remarks" placeholder="Remarks" value="${bomEscAttr(it.remarks)}"></td>
                    <td style="white-space:nowrap;">
                      <button type="button" class="btn btn-ghost bom-mini-btn" data-binsert-sec="${si}" data-binsert-idx="${ii}" title="Insert item below"><i class="fa-solid fa-plus"></i></button>
                      <button type="button" class="btn btn-red bom-mini-btn" data-bremove-sec="${si}" data-bremove-idx="${ii}" title="Remove item"><i class="fa-solid fa-xmark"></i></button>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <button type="button" class="btn btn-ghost bom-mini-btn" data-bsec-add-item="${si}" style="margin-top:8px;"><i class="fa-solid fa-plus"></i> Add Item to this Section</button>
        </div>
      `).join('');
    }

    // Field edits (section title, sr, name, model, qty, remarks) write
    // straight back into newKitSections — same delegated-listener pattern
    // used for the live Kit Items preview above.
    if (kitBuilderSectionsEl) {
      kitBuilderSectionsEl.addEventListener('input', handleBuilderFieldEdit);
      kitBuilderSectionsEl.addEventListener('change', handleBuilderFieldEdit);
    }
    function handleBuilderFieldEdit(e) {
      const el = e.target.closest('[data-bfield]');
      if (!el) return;
      const si = Number(el.dataset.bsec);
      const field = el.dataset.bfield;
      if (!newKitSections[si]) return;
      if (field === 'sectitle') {
        newKitSections[si].title = el.value;
        return;
      }
      const ii = Number(el.dataset.bidx);
      if (!newKitSections[si].items[ii]) return;
      newKitSections[si].items[ii][field] = el.value;
    }

    // Structural changes (insert/remove item, add/remove section) — every
    // one re-renders and renumbers Sr No. across the whole builder.
    if (kitBuilderSectionsEl) {
      kitBuilderSectionsEl.addEventListener('click', (e) => {
        const insertBtn = e.target.closest('[data-binsert-sec]');
        const removeItemBtn = e.target.closest('[data-bremove-sec]');
        const addItemBtn = e.target.closest('[data-bsec-add-item]');
        const removeSectionBtn = e.target.closest('[data-bsec-remove]');
        const blankItem = () => ({ sr: '', name: '', model: '', qty: '', remarks: '' });

        if (insertBtn) {
          const si = Number(insertBtn.dataset.binsertSec);
          const idx = Number(insertBtn.dataset.binsertIdx);
          newKitSections[si].items.splice(idx + 1, 0, blankItem());
        } else if (removeItemBtn) {
          const si = Number(removeItemBtn.dataset.bremoveSec);
          const idx = Number(removeItemBtn.dataset.bremoveIdx);
          newKitSections[si].items.splice(idx, 1);
        } else if (addItemBtn) {
          const si = Number(addItemBtn.dataset.bsecAddItem);
          newKitSections[si].items.push(blankItem());
        } else if (removeSectionBtn) {
          if (newKitSections.length <= 1) return; // button is disabled at 1 section anyway
          const si = Number(removeSectionBtn.dataset.bsecRemove);
          newKitSections.splice(si, 1);
        } else {
          return;
        }
        renderKitBuilderSections();
      });
    }

    if (btnAddKitSection) {
      btnAddKitSection.addEventListener('click', () => {
        newKitSections.push({ title: 'New Section', items: [{ sr: '', name: '', model: '', qty: '', remarks: '' }] });
        renderKitBuilderSections();
      });
    }

    if (btnNewKit) {
      btnNewKit.addEventListener('click', () => {
        editingKitKey = null;
        setKitBuilderMode(false);
        // Pre-fill with the standard section/item format (names only,
        // Model/Quantity/Remarks blank) — the person only needs to fill in
        // values and add/remove items/sections where this kit differs.
        newKitSections = bomDefaultSectionsTemplate();
        newKitLabelInput.value = '';
        newKitKwInput.value = '';
        renderKitBuilderSections();
        kitBuilderPanel.style.display = '';
        // The "Kit Items" panel below always mirrors the currently-selected
        // kit (e.g. the default 3.3 kW list) — while building a brand new
        // kit that old list has nothing to do with what's being created, so
        // hide it for the duration of the builder to avoid the confusing
        // "two item lists on screen at once" look. Restored on Cancel/Save.
        if (kitItemsPanel) kitItemsPanel.style.display = 'none';
        kitBuilderPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        newKitLabelInput.focus();
      });
    }

    // ---------- Edit an existing saved Kit Template ----------
    // Opens the SAME builder panel as "New Kit", but pre-filled with the
    // currently-selected custom kit's real sections/items (deep-cloned, so
    // Cancel never mutates the saved template) instead of the blank
    // default — and Save (now "Update Kit Template") overwrites that same
    // saved key rather than minting a new one. Only ever visible for a
    // saved custom kit (see updateKitActionButtons), same Admin/SuperAdmin
    // gate as New Kit/Delete Kit.
    if (btnEditKit) {
      btnEditKit.addEventListener('click', () => {
        const key = kitSelect.value;
        if (!bomIsCustomKitKey(key)) return;
        const custom = bomLoadCustomKits();
        const kit = custom[key];
        if (!kit) return;

        editingKitKey = key;
        setKitBuilderMode(true);
        newKitSections = JSON.parse(JSON.stringify(kit.sections || []));
        if (!newKitSections.length) newKitSections = bomDefaultSectionsTemplate();
        newKitLabelInput.value = kit.label || '';
        newKitKwInput.value = kit.kw || '';
        renderKitBuilderSections();
        kitBuilderPanel.style.display = '';
        if (kitItemsPanel) kitItemsPanel.style.display = 'none';
        kitBuilderPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        newKitLabelInput.focus();
      });
    }

    if (btnCancelKitBuilder) {
      btnCancelKitBuilder.addEventListener('click', () => {
        editingKitKey = null;
        kitBuilderPanel.style.display = 'none';
        if (kitItemsPanel) kitItemsPanel.style.display = '';
      });
    }

    if (btnSaveKitTemplate) {
      btnSaveKitTemplate.addEventListener('click', () => {
        const label = newKitLabelInput.value.trim();
        if (!label) {
          window.openModal('Validation Error', '<p>Kit Name is required.</p>');
          return;
        }
        // Drop any item left with a blank name, and any section left with
        // no named items — everything else (Model/Qty/Remarks) can stay blank.
        const sectionsToSave = newKitSections
          .map((sec) => ({
            title: (sec.title || '').trim() || 'Items',
            items: sec.items
              .map((it) => ({
                sr: it.sr,
                name: (it.name || '').trim(),
                model: (it.model || '').trim(),
                qty: (it.qty || '').trim(),
                remarks: (it.remarks || '').trim(),
              }))
              .filter((it) => it.name),
          }))
          .filter((sec) => sec.items.length);
        if (!sectionsToSave.length) {
          window.openModal('Validation Error', '<p>Add at least one item with a name before saving the template.</p>');
          return;
        }
        bomRenumberAll(sectionsToSave);

        const custom = bomLoadCustomKits();
        let key;
        if (editingKitKey && custom[editingKitKey]) {
          // Editing an existing template — keep the SAME key regardless of
          // whether the label changed, so the dropdown selection, any
          // in-flight BOM's kit reference, and Delete/Edit all keep
          // pointing at the one saved entry instead of leaving behind an
          // orphaned old key + a brand new one.
          key = editingKitKey;
        } else {
          // Unique key: slugified name, de-duplicated if that slug is already taken.
          key = 'custom_' + bomSlugify(label);
          let n = 2;
          while (custom[key] && custom[key].label !== label) {
            key = 'custom_' + bomSlugify(label) + '-' + n;
            n += 1;
          }
        }
        custom[key] = {
          label,
          kw: newKitKwInput.value.trim(),
          sections: sectionsToSave,
        };
        bomSaveCustomKits(custom);
        const wasEditing = !!editingKitKey;
        editingKitKey = null;

        kitBuilderPanel.style.display = 'none';
        if (kitItemsPanel) kitItemsPanel.style.display = '';
        populateKitDropdown(key); // auto-select the newly saved/updated kit
        refreshItemsPreview();
        if (window.showToast) window.showToast(wasEditing ? 'Kit template updated.' : 'Kit template saved — it now auto-fills from the dropdown.');
      });
    }

    // Delegated listener: every field (item dropdown, model/qty/remarks
    // inputs, sr, section title) carries data-sec(+data-idx)/data-field, so
    // one listener on the container catches edits to all rows across kit
    // re-renders and writes them straight into currentKitState — nothing
    // needs to be retyped for the parts that stay the same.
    itemsPreview.addEventListener('input', handleItemFieldEdit);
    itemsPreview.addEventListener('change', handleItemFieldEdit);
    function handleItemFieldEdit(e) {
      const el = e.target.closest('[data-field]');
      if (!el) return;
      const si = Number(el.dataset.sec);
      const field = el.dataset.field;
      if (!currentKitState || !currentKitState[si]) return;
      if (field === 'sectitle') {
        currentKitState[si].title = el.value;
        setVerified(false);
        // A section title can change which real Category it matches (see
        // bomResolveSectionCategory) — re-render on 'change' (blur/Enter)
        // only, not on every keystroke, so every item row in this section
        // switches to/from the Category+Model dropdown pair as soon as the
        // person finishes typing, without the table jumping around while
        // they're still mid-edit.
        if (e.type === 'change') rerenderItemsPreview();
        return;
      }
      const ii = Number(el.dataset.idx);
      const item = currentKitState[si].items[ii];
      if (!item) return;

      // Check column: the on-screen equivalent of the print sheet's blank
      // "Checked" box. Ticking a serial-mandatory item (e.g. a Panel) is
      // blocked until its Serial No. is filled in — Verify BOM only unlocks
      // once every item, including these, is genuinely ready.
      if (field === 'checked') {
        if (el.checked && bomItemNeedsSerial(item.name)) {
          const required = bomEffectiveQty(item);
          const entered = bomSplitSerials(item.serials).length;
          if (!entered) {
            el.checked = false;
            window.openModal('Serial No. Required', '<p>Please enter Serial No. first.</p>');
            return;
          }
          if (required != null && entered !== required) {
            el.checked = false;
            window.openModal('Serial No. Required', `<p>Please enter Serial No. first — <strong>${bomEsc(item.name || 'this item')}</strong> needs exactly ${required} serial number(s), but ${entered} ${entered === 1 ? 'is' : 'are'} entered.</p>`);
            return;
          }
        }
        item.checked = el.checked;
        updateVerifyButtonState();
        return;
      }

      // Category select on a category-driven row (any section whose title
      // matches a real Masters > Category name, e.g. "Solar Panel" or
      // "Inverter" — see bomResolveSectionCategory). Changing the category
      // invalidates whichever real item (it.name) was picked under the old
      // category — force a re-pick and refresh the Model dropdown's option
      // list for the new category.
      if (field === 'category') {
        item.category = el.value;
        item.name = '';
        item.checked = false;
        setVerified(false);
        updateVerifyButtonState();
        rerenderItemsPreview();
        return;
      }

      // Quantity (Admin/SuperAdmin only — disabled for a plain User, see
      // bomRenderScreenItemsHtml). Admin's Dispatch Qty column is disabled
      // and always mirrors Quantity, so keep it in sync here — Admin isn't
      // doing a partial split, that's the User's job on their own copy.
      if (field === 'qty') {
        item.qty = el.value;
        if (bomIsAdmin) {
          const n = bomParseQtyNumber(el.value);
          item.dispatchQty = n != null ? String(n) : '';
        }
        item.checked = false;
        setVerified(false);
        updateVerifyButtonState();
        return;
      }

      // Dispatch Qty — User-only editable field (disabled for Admin, see
      // bomRenderScreenItemsHtml). How many units of the allocated
      // Quantity are being sent right now (partial dispatch). Clamped so
      // it can never exceed the original allocation, and never negative.
      if (field === 'dispatchQty') {
        const full = bomParseQtyNumber(item.qty);
        let n = Number(el.value);
        if (Number.isNaN(n) || n < 0) n = 0;
        if (full != null && n > full) {
          n = full;
          el.value = n;
          if (window.showToast) window.showToast(`Cannot dispatch more than the allocated ${full}.`);
        }
        item.dispatchQty = String(n);
        item.checked = false;
        setVerified(false);
        updateVerifyButtonState();
        return;
      }

      item[field] = el.value;
      item.checked = false; // any content edit invalidates this row's tick
      setVerified(false); // any edit after verifying means it needs re-verifying
      updateVerifyButtonState();
      if (field === 'name') rerenderItemsPreview(); // item changed — refresh the Serial No. column for this row
    }

    // Re-renders the item table in place (after a dropdown/field edit,
    // add/remove row, etc.) WITHOUT jumping the page back to the top.
    // itemsPreview.innerHTML replaces the whole table with a fresh DOM
    // tree, so the browser loses whatever scroll position it had — this
    // finds whichever ancestor is actually scrolling (the page itself, or
    // a scrollable panel wrapping it) and restores its scrollTop right
    // after the swap, so editing row 25 keeps row 25 in view instead of
    // snapping back to row 1.
    function bomFindScrollParent(el) {
      let node = el && el.parentElement;
      while (node && node !== document.body) {
        const style = window.getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
          return node;
        }
        node = node.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    }

    function rerenderItemsPreview() {
      const scrollParent = bomFindScrollParent(itemsPreview);
      const scrollTop = scrollParent.scrollTop;
      itemsPreview.innerHTML = bomRenderScreenItemsHtml(currentKitState, { isAdmin: bomIsAdmin, needsSerial: bomItemNeedsSerial });
      scrollParent.scrollTop = scrollTop;
      setVerified(false);
      updateVerifyButtonState();
    }

    // ---------------- Serial scanner (camera) — Step 5 ----------------
    // Same "html5-qrcode" engine + .ss-scanner-* overlay markup/CSS already
    // used by Purchase Inward (js/pages/purchase.js's openPurchaseScanner)
    // and SCAN To Sheet (js/pages/scansheet.js) — loaded globally via CDN
    // in index.html, CSS ships site-wide via css/modules/scan-sheet.css.
    // Generic over `targetId` so ONE set of functions serves both:
    //   - the main screen's openBomSerialModal() box (#bomSerialModalBox)
    //   - every per-item serial <textarea> the Continue Dispatch form
    //     (Step 4's bomRenderContinueFormHtml) renders — one order can have
    //     several pending serial-mandatory items, each gets its own textarea
    //     id and its own scan button, all calling openBomScanner(thatId).
    // Flow mirrors Purchase's exactly: decode -> camera pauses -> result
    // card with Retry/Done -> Done appends one line to the target textarea
    // and resumes scanning for the next serial, duplicate scans are
    // blocked (Done hidden) until Retry'd.
    //
    // Deliberately NO separate "Bluetooth scanner mode" toggle: unlike
    // scansheet.js's single-line inputs (which need one because a BT
    // wedge-scanner's trailing Enter key would submit/blur a single-line
    // field), these are multi-line <textareas> that already auto-newline
    // on any delimiter (see bomSplitSerials + the keydown/paste handlers
    // below and in the Continue Dispatch form). A Bluetooth scanner just
    // needs the box focused — it types + Enter like a keyboard, which the
    // textarea turns into "one serial per line" on its own. Purchase
    // Inward's identical serial textarea uses this same reasoning and
    // likewise ships no BT toggle.
    const bomScanState = {
      html5QrCode: null,
      cameras: [],
      cameraIndex: 0,
      torchOn: false,
      overlayEl: null,
      targetId: null,
      handledOnce: false,
      pendingText: null,
      pendingIsDup: false,
      addedCount: 0,
    };

    function bomScanBeep() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 1050;
        gain.gain.setValueAtTime(0.001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.16);
        osc.onended = () => ctx.close();
      } catch (e) { /* Web Audio not available — silently skip the beep */ }
    }

    function bomScanSetStatus(msg) {
      const el = document.getElementById('bomScanStatus');
      if (el) el.textContent = msg;
    }

    function openBomScanner(targetId) {
      const box = document.getElementById(targetId);
      if (!box) return;
      bomScanState.targetId = targetId;
      bomScanState.torchOn = false;
      bomScanState.handledOnce = false;
      bomScanState.pendingText = null;
      bomScanState.pendingIsDup = false;
      bomScanState.addedCount = 0;

      const overlay = document.createElement('div');
      overlay.className = 'ss-scanner-overlay';
      overlay.innerHTML = `
        <div class="ss-scanner-topbar">
          <button type="button" class="ss-icon-btn light" id="bomScanBack" title="Close"><i class="fa-solid fa-arrow-left"></i></button>
          <div class="ss-scanner-title">Scan Serial Numbers</div>
          <div class="ss-scanner-topbtns">
            <button type="button" class="ss-icon-btn light" id="bomScanTorch" title="Flashlight"><i class="fa-solid fa-bolt"></i></button>
            <button type="button" class="ss-icon-btn light" id="bomScanFlip" title="Flip camera"><i class="fa-solid fa-camera-rotate"></i></button>
          </div>
        </div>
        <div class="ss-scanner-camwrap">
          <div id="bomScanRegion" class="ss-scanner-camfeed"></div>
          <div class="ss-scanner-target" id="bomScanTargetBox"></div>
          <div class="ss-scanner-instruction" id="bomScanStatus">Requesting camera permission&hellip;</div>
          <div class="ss-scanner-result" id="bomScanResult" style="display:none;">
            <div class="ss-scanner-result-card" id="bomScanResultCard">
              <div class="ss-scanner-result-label">Scanned value</div>
              <div class="ss-scanner-result-value" id="bomScanResultValue"></div>
              <div class="ss-scanner-result-msg" id="bomScanResultMsg"></div>
            </div>
            <div class="ss-scanner-result-actions">
              <button type="button" class="btn btn-ghost" id="bomScanRetry"><i class="fa-solid fa-rotate-left"></i> Retry</button>
              <button type="button" class="btn btn-green" id="bomScanDone2"><i class="fa-solid fa-check"></i> Done</button>
            </div>
          </div>
        </div>
        <div class="ss-scanner-bottom">
          <span class="proof-name" id="bomScanCount" style="color:#fff;">0 serial(s) added</span>
          <button type="button" class="btn btn-red ss-scanner-cancel" id="bomScanCancel"><i class="fa-solid fa-xmark"></i> Close</button>
        </div>
      `;
      document.body.appendChild(overlay);
      bomScanState.overlayEl = overlay;
      document.body.style.overflow = 'hidden';

      overlay.querySelector('#bomScanBack').onclick = closeBomScanner;
      overlay.querySelector('#bomScanCancel').onclick = closeBomScanner;
      overlay.querySelector('#bomScanTorch').onclick = toggleBomScanTorch;
      overlay.querySelector('#bomScanFlip').onclick = flipBomScanCamera;
      overlay.querySelector('#bomScanRetry').onclick = retryBomScan;
      overlay.querySelector('#bomScanDone2').onclick = confirmBomScan;

      startBomScanCamera();
    }

    function startBomScanCamera() {
      if (!window.Html5Qrcode) {
        bomScanSetStatus('Scanner library failed to load. Check your connection and try again.');
        return;
      }
      window.Html5Qrcode.getCameras().then((cameras) => {
        if (!cameras || !cameras.length) { bomScanSetStatus('No camera found on this device.'); return; }
        bomScanState.cameras = cameras;
        const backIdx = cameras.findIndex((c) => /back|rear|environment/i.test(c.label || ''));
        bomScanState.cameraIndex = backIdx !== -1 ? backIdx : 0;
        launchBomScanCamera();
      }).catch((err) => {
        console.warn('Camera permission error', err);
        bomScanSetStatus('Camera permission denied. Please allow camera access in your browser settings, then tap Close and try again.');
      });
    }

    function launchBomScanCamera() {
      const camera = bomScanState.cameras[bomScanState.cameraIndex];
      if (!camera) return;
      bomScanState.handledOnce = false;
      bomScanSetStatus('Place the serial barcode / QR in the box');

      const config = { fps: 10 };
      if (window.Html5QrcodeSupportedFormats) {
        config.formatsToSupport = [
          window.Html5QrcodeSupportedFormats.QR_CODE,
          window.Html5QrcodeSupportedFormats.EAN_13,
          window.Html5QrcodeSupportedFormats.EAN_8,
          window.Html5QrcodeSupportedFormats.CODE_128,
          window.Html5QrcodeSupportedFormats.CODE_39,
          window.Html5QrcodeSupportedFormats.UPC_A,
          window.Html5QrcodeSupportedFormats.UPC_E,
          window.Html5QrcodeSupportedFormats.ITF,
        ];
      }

      bomScanState.html5QrCode = new window.Html5Qrcode('bomScanRegion', { verbose: false });
      bomScanState.html5QrCode.start(
        camera.id,
        config,
        onBomScanSuccess,
        () => { /* per-frame "no code found yet" — expected, ignore */ }
      ).catch((err) => {
        console.warn('Camera start error', err);
        bomScanSetStatus('Could not start the camera. Tap Close and try again.');
      });
    }

    // Decoding pauses here (handledOnce guard, exactly like Purchase/
    // scansheet.js) until the user explicitly taps Retry or Done.
    function onBomScanSuccess(decodedText) {
      if (bomScanState.handledOnce) return;
      bomScanState.handledOnce = true;
      bomScanBeep();
      if (navigator.vibrate) { try { navigator.vibrate(180); } catch (e) { /* not supported */ } }
      showBomScanResult(decodedText);
    }

    function showBomScanResult(text) {
      const code = String(text || '').trim();
      const box = document.getElementById(bomScanState.targetId);
      const existing = box ? bomSplitSerials(box.value) : [];
      const dup = !!code && existing.some((s) => s.toLowerCase() === code.toLowerCase());

      bomScanState.pendingText = code;
      bomScanState.pendingIsDup = dup;

      const panel = document.getElementById('bomScanResult');
      const card = document.getElementById('bomScanResultCard');
      const valueEl = document.getElementById('bomScanResultValue');
      const msgEl = document.getElementById('bomScanResultMsg');
      const doneBtn = document.getElementById('bomScanDone2');
      const targetBox = document.getElementById('bomScanTargetBox');
      if (!panel || !valueEl) return;

      valueEl.textContent = code || '(empty)';
      if (card) card.classList.toggle('dup', dup);
      if (msgEl) msgEl.textContent = dup
        ? 'This serial no. is already in the box. Retry with a different code, or remove the old one first.'
        : 'Scanned successfully.';
      if (doneBtn) doneBtn.style.display = dup ? 'none' : '';

      panel.style.display = 'flex';
      bomScanSetStatus('');
      if (targetBox) targetBox.style.visibility = 'hidden';
    }

    function hideBomScanResult() {
      const panel = document.getElementById('bomScanResult');
      const targetBox = document.getElementById('bomScanTargetBox');
      if (panel) panel.style.display = 'none';
      if (targetBox) targetBox.style.visibility = '';
      bomScanState.pendingText = null;
      bomScanState.pendingIsDup = false;
    }

    function retryBomScan() {
      hideBomScanResult();
      bomScanState.handledOnce = false;
      bomScanSetStatus('Place the serial barcode / QR in the box');
    }

    // "Done" — commit the scanned value into the target textarea (one per
    // line, same normalization Purchase's paste handler uses), then resume
    // scanning so the next serial can be captured right away.
    function confirmBomScan() {
      if (bomScanState.pendingIsDup) return; // guard — Done is hidden for dupes anyway
      const code = bomScanState.pendingText;
      if (!code) { retryBomScan(); return; }

      const box = document.getElementById(bomScanState.targetId);
      if (box) {
        const existing = bomSplitSerials(box.value);
        existing.push(code);
        box.value = existing.join('\n') + '\n';
        box.dispatchEvent(new Event('input', { bubbles: true }));
        bomScanState.addedCount = existing.length;
        const countEl = document.getElementById('bomScanCount');
        if (countEl) countEl.textContent = `${existing.length} serial(s) added`;
      }

      hideBomScanResult();
      bomScanState.handledOnce = false;
      bomScanSetStatus('Added \u2713 — scan the next one');
    }

    function toggleBomScanTorch() {
      if (!bomScanState.html5QrCode) return;
      bomScanState.torchOn = !bomScanState.torchOn;
      bomScanState.html5QrCode.applyVideoConstraints({ advanced: [{ torch: bomScanState.torchOn }] })
        .then(() => {
          const btn = document.getElementById('bomScanTorch');
          if (btn) btn.classList.toggle('active', bomScanState.torchOn);
        })
        .catch(() => { if (window.showToast) window.showToast('Flashlight not supported on this device'); bomScanState.torchOn = false; });
    }

    function flipBomScanCamera() {
      if (!bomScanState.cameras.length || bomScanState.cameras.length < 2) { if (window.showToast) window.showToast('Only one camera available'); return; }
      bomScanState.cameraIndex = (bomScanState.cameraIndex + 1) % bomScanState.cameras.length;
      const qr = bomScanState.html5QrCode;
      if (qr) qr.stop().then(launchBomScanCamera).catch(launchBomScanCamera);
      else launchBomScanCamera();
    }

    function closeBomScanner() {
      const qr = bomScanState.html5QrCode;
      const targetId = bomScanState.targetId;
      bomScanState.pendingText = null;
      bomScanState.pendingIsDup = false;
      const finish = () => {
        if (bomScanState.overlayEl) { bomScanState.overlayEl.remove(); bomScanState.overlayEl = null; }
        document.body.style.overflow = '';
        bomScanState.html5QrCode = null;
        // Final normalize pass (dedupe/trim), same cleanup Purchase's
        // blur() handler already does.
        const box = targetId ? document.getElementById(targetId) : null;
        if (box) {
          box.value = bomSplitSerials(box.value).join('\n');
          box.focus();
          box.dispatchEvent(new Event('input', { bubbles: true }));
        }
      };
      if (qr) qr.stop().then(finish).catch(finish);
      else finish();
    }

    // Serial No. popup — click the Serial No. button on a serial-mandatory
    // row (Solar Panel, Inverter, etc.) to open the same style of box
    // Purchase/Sale already use: scan-or-type with auto-newline on any
    // delimiter, paste normalization, and a live count against the item's
    // Quantity. Adds "Scan Serial No." / "Upload Serial No. through File"
    // as two entry modes on top of the same box, per the requested flow.
    function openBomSerialModal(si, ii) {
      const item = currentKitState[si] && currentKitState[si].items[ii];
      if (!item) return;
      const required = bomEffectiveQty(item);

      window.openModal(`Serial No. — ${item.name || 'Item'}`, `
        <div class="bom-serial-modal">
          <p class="note" style="margin-bottom:10px;">
            <i class="fa-solid fa-box"></i> <b>${bomEsc(item.name || 'Item')}</b>
            &nbsp;—&nbsp; Quantity required: <b>${required != null ? required : '—'}</b> serial number(s)
          </p>
          <div class="actions-row bom-serial-mode-row" style="margin-bottom:10px;">
            <button type="button" class="btn btn-ghost bom-serial-mode-btn active" id="bomSerialModeScan"><i class="fa-solid fa-barcode"></i> Scan Serial No.</button>
            <button type="button" class="btn btn-ghost bom-serial-mode-btn" id="bomSerialModeUpload"><i class="fa-solid fa-file-arrow-up"></i> Upload Serial No. (File)</button>
            <button type="button" class="btn btn-blue" id="bomSerialCameraBtn"><i class="fa-solid fa-camera"></i> Open Camera</button>
          </div>
          <div id="bomSerialUploadPane" style="display:none; margin-bottom:10px;">
            <input type="file" id="bomSerialFileInput" accept=".txt,.csv">
            <p class="note" style="margin-top:6px;">Pick a .txt or .csv file — one serial per line, or comma/space separated. It loads into the box below so you can review before saving.</p>
          </div>
          <textarea id="bomSerialModalBox" rows="8" placeholder="Scan or type serial numbers — one per line...">${bomEsc(item.serials || '')}</textarea>
          <p class="note" id="bomSerialCountNote" style="margin-top:8px;"></p>
          <div class="actions-row" style="margin-top:12px;">
            <button type="button" class="btn btn-blue" id="bomSerialSaveBtn"><i class="fa-solid fa-check"></i> Save</button>
            <button type="button" class="btn btn-ghost" id="bomSerialCancelBtn">Cancel</button>
          </div>
        </div>
      `);

      const box = document.getElementById('bomSerialModalBox');
      const countNote = document.getElementById('bomSerialCountNote');
      const modeScanBtn = document.getElementById('bomSerialModeScan');
      const modeUploadBtn = document.getElementById('bomSerialModeUpload');
      const uploadPane = document.getElementById('bomSerialUploadPane');
      const fileInput = document.getElementById('bomSerialFileInput');
      const saveBtn = document.getElementById('bomSerialSaveBtn');
      const cancelBtn = document.getElementById('bomSerialCancelBtn');
      const cameraBtn = document.getElementById('bomSerialCameraBtn');
      if (!box) return;

      // Step 5: opens the real camera scanner (see openBomScanner above),
      // appending each Done'd scan straight into this modal's box.
      if (cameraBtn) cameraBtn.addEventListener('click', () => openBomScanner('bomSerialModalBox'));

      function updateCountNote() {
        const count = bomSplitSerials(box.value).length;
        if (required != null) {
          const ok = count === required;
          countNote.style.color = ok ? 'var(--green)' : 'var(--red)';
          countNote.innerHTML = `<i class="fa-solid ${ok ? 'fa-circle-check' : 'fa-circle-exclamation'}"></i> ${count} of ${required} serial number(s) entered${ok ? ' — matches quantity.' : ''}`;
        } else {
          countNote.style.color = '';
          countNote.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${count} serial number(s) entered.`;
        }
      }

      // Auto-newline on delimiter + paste normalization — identical logic
      // to Purchase/Sale's serial box (splitSerials there === bomSplitSerials here).
      box.addEventListener('keydown', (e) => {
        if ([',', ' ', '|', ';', 'Tab'].includes(e.key)) {
          e.preventDefault();
          const before = box.value.slice(0, box.selectionStart);
          const after = box.value.slice(box.selectionEnd);
          const needsNewline = before && !before.endsWith('\n');
          box.value = before + (needsNewline ? '\n' : '') + after;
          const pos = before.length + (needsNewline ? 1 : 0);
          box.setSelectionRange(pos, pos);
        }
        updateCountNote();
      });
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData || window.clipboardData).getData('text');
        const normalized = bomSplitSerials(pasted).join('\n');
        const before = box.value.slice(0, box.selectionStart);
        const after = box.value.slice(box.selectionEnd);
        const prefix = before && !before.endsWith('\n') ? '\n' : '';
        box.value = before + prefix + normalized + '\n' + after;
        updateCountNote();
      });
      box.addEventListener('input', updateCountNote);
      box.addEventListener('blur', () => {
        box.value = bomSplitSerials(box.value).join('\n');
        updateCountNote();
      });

      modeScanBtn.addEventListener('click', () => {
        modeScanBtn.classList.add('active');
        modeUploadBtn.classList.remove('active');
        uploadPane.style.display = 'none';
        box.focus();
      });
      modeUploadBtn.addEventListener('click', () => {
        modeUploadBtn.classList.add('active');
        modeScanBtn.classList.remove('active');
        uploadPane.style.display = '';
      });
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const parsed = bomSplitSerials(String(reader.result || ''));
          const merged = bomSplitSerials(box.value).concat(parsed);
          box.value = merged.join('\n');
          updateCountNote();
          modeScanBtn.click(); // back to the box so it can be reviewed/edited before Save
          if (window.showToast) window.showToast(`${parsed.length} serial number(s) loaded from file.`);
        };
        reader.onerror = () => window.openModal('File Read Error', '<p>Could not read that file. Please try a plain .txt or .csv file.</p>');
        reader.readAsText(file);
        fileInput.value = '';
      });

      saveBtn.addEventListener('click', () => {
        const serials = bomSplitSerials(box.value);
        if (!serials.length) {
          countNote.style.color = 'var(--red)';
          countNote.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Please enter Serial No. first.';
          return;
        }
        const seen = new Set();
        const dupes = new Set();
        serials.forEach((s) => { if (seen.has(s)) dupes.add(s); seen.add(s); });
        if (dupes.size) {
          countNote.style.color = 'var(--red)';
          countNote.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Duplicate serial number(s): ${[...dupes].map(bomEsc).join(', ')}`;
          return;
        }
        if (required != null && serials.length !== required) {
          countNote.style.color = 'var(--red)';
          countNote.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Please enter Serial No. first — exactly ${required} needed, ${serials.length} entered.`;
          return;
        }
        item.serials = serials.join('\n');
        item.checked = false; // any serial change invalidates this row's tick
        setVerified(false);
        window.closeModal();
        rerenderItemsPreview();
        if (window.showToast) window.showToast('Serial numbers saved.');
      });

      cancelBtn.addEventListener('click', () => window.closeModal());

      updateCountNote();
    }

    // Delegated click listener: lets a new item be inserted at ANY position
    // within any section (not just appended at the end) — e.g. right after
    // the 5th item in "Solar Structure" — plus removing an item, adding a
    // whole new section, or removing one. Every structural change
    // renumbers Sr No. across the whole kit so it always stays 1,2,3...
    // Restructuring the kit (add/remove item, add/remove section) is
    // Admin/SuperAdmin only — the buttons themselves are already hidden for
    // a plain User (see bomRenderScreenItemsHtml), this is the defensive
    // second check. Remove actions (item/section) ask for confirmation
    // first — a stray tap used to delete a row instantly with no way back;
    // Add actions still fire immediately since they're non-destructive.
    itemsPreview.addEventListener('click', async (e) => {
      if (!currentKitState) return;
      const serialBtn = e.target.closest('.bom-serial-btn');
      if (serialBtn) {
        openBomSerialModal(Number(serialBtn.dataset.sec), Number(serialBtn.dataset.idx));
        return;
      }
      const insertBtn = e.target.closest('[data-insert-after-sec]');
      const removeItemBtn = e.target.closest('[data-remove-sec]');
      const addItemBtn = e.target.closest('[data-sec-add-item]');
      const removeSectionBtn = e.target.closest('[data-sec-remove]');
      const addSectionBtn = e.target.closest('#bomBtnAddSectionLive');
      if ((insertBtn || removeItemBtn || addItemBtn || removeSectionBtn || addSectionBtn) && !bomIsAdmin) return;
      const blankItem = () => ({ sr: '', name: '', model: '', qty: '', remarks: '', serials: '', checked: false, dispatchQty: '' });

      if (insertBtn) {
        const si = Number(insertBtn.dataset.insertAfterSec);
        const idx = Number(insertBtn.dataset.insertAfterIdx);
        currentKitState[si].items.splice(idx + 1, 0, blankItem());
      } else if (removeItemBtn) {
        const si = Number(removeItemBtn.dataset.removeSec);
        const idx = Number(removeItemBtn.dataset.removeIdx);
        const itemName = (currentKitState[si].items[idx] && currentKitState[si].items[idx].name) || 'this item';
        const confirmed = await window.confirmDanger('Remove Item', `Remove "${itemName}" from this BOM? This cannot be undone.`);
        if (!confirmed) return;
        currentKitState[si].items.splice(idx, 1);
      } else if (addItemBtn) {
        const si = Number(addItemBtn.dataset.secAddItem);
        currentKitState[si].items.push(blankItem());
      } else if (removeSectionBtn) {
        if (currentKitState.length <= 1) {
          window.openModal('Cannot Remove', '<p>A kit needs at least one section.</p>');
          return;
        }
        const si = Number(removeSectionBtn.dataset.secRemove);
        const secTitle = currentKitState[si].title || 'this section';
        const confirmed = await window.confirmDanger('Remove Section', `Remove the section "${secTitle}" and all ${currentKitState[si].items.length} item(s) in it? This cannot be undone.`);
        if (!confirmed) return;
        currentKitState.splice(si, 1);
      } else if (addSectionBtn) {
        currentKitState.push({ title: 'New Section', items: [blankItem()] });
      } else {
        return;
      }
      bomRenumberAll(currentKitState);
      rerenderItemsPreview();
    });

    function getHeaderValues() {
      return {
        customerName: $('bomCustomerName').value,
        orderNo: $('bomOrderNo').value,
        installerName: $('bomInstallerName').value,
        challanNo: $('bomChallanNo').value,
        challanDate: $('bomChallanDate').value,
        fabricatorName: $('bomFabricatorName').value,
        dealerName: $('bomDealerName').value,
      };
    }

    if (btnVerify) {
      btnVerify.addEventListener('click', async () => {
        if (!currentKitState) {
          window.openModal('Select a Kit', '<p>Please select a BOM Kit before verifying.</p>');
          return;
        }
        if (!allItemsChecked()) {
          window.openModal('Tick Every Item', '<p>Please tick every item in the <b>Check</b> column before verifying.</p>');
          return;
        }

        // Real stock check now happens HERE (moved off Convert into
        // Challan) — checks whether Dispatch Qty for every item is
        // actually available right now. Convert into Challan and Create
        // Dispatch both stay locked until this passes.
        const originalLabel = btnVerify.innerHTML;
        btnVerify.disabled = true;
        btnVerify.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking Stock...';
        const canProceed = await bomRunStockCheck();
        btnVerify.innerHTML = originalLabel;
        updateVerifyButtonState(); // restores the normal enabled/disabled state (still gated on allItemsChecked)
        if (!canProceed) return;

        const confirmed = await window.confirmDialog(
          'Verify BOM',
          'Are you sure all items in this BOM are ready for dispatch?',
          { kind: 'warning', okLabel: 'Yes, Verified' },
        );
        if (confirmed) {
          setVerified(true);
          if (window.showToast) window.showToast('BOM verified — Create Dispatch is now unlocked.');
        }
      });
    }

    // Flattens currentKitState's sections into the flat { name, qty, serials }
    // list /api/bom/check-stock (and /api/bom/dispatch) expects. `qty` here
    // is bomEffectiveQty() — the User's partial Dispatch Qty when set,
    // otherwise Admin's full Quantity — so a partial dispatch only ever
    // checks/deducts the amount actually being sent right now, not the
    // BOM's full original allocation.
    function bomCollectItemsForStockCheck() {
      const out = [];
      (currentKitState || []).forEach((sec) => {
        (sec.items || []).forEach((it) => {
          out.push({
            name: it.name || '',
            qty: bomEffectiveQty(it) || 0,
            serials: bomSplitSerials(it.serials || ''),
          });
        });
      });
      return out;
    }

    // Same as bomCollectItemsForStockCheck, but for Create Dispatch only
    // (Step 3) — also carries `totalQty`, the item's full originally-
    // required Quantity (not the partial amount being sent this trip).
    // The server needs this once per Order No. to set the pending
    // baseline; check-stock (read-only, no persistence) never needs it,
    // so that collector is left untouched.
    function bomCollectItemsForDispatch() {
      const out = [];
      (currentKitState || []).forEach((sec) => {
        (sec.items || []).forEach((it) => {
          out.push({
            name: it.name || '',
            qty: bomEffectiveQty(it) || 0,
            totalQty: Number(it.qty) || bomEffectiveQty(it) || 0,
            serials: bomSplitSerials(it.serials || ''),
          });
        });
      });
      return out;
    }

    // Shared renderer for "here's exactly which item(s) failed and why" —
    // used by both Verify BOM's stock CHECK and Create Dispatch's actual
    // DEDUCTION, so the person sees the same itemized list either way.
    function bomShowStockIssuesModal(title, intro, rows) {
      const listHtml = (rows || []).map((r) => `
        <li style="margin-bottom:6px;">
          <b>${bomEsc(r.name || '(blank)')}</b>${r.category ? ` <span class="note">(${bomEsc(r.category)})</span>` : ''}
          <br><span style="color:var(--red);">${bomEsc(r.reason || 'Not available.')}</span>
        </li>
      `).join('');
      window.openModal(title, `
        <p>${intro}</p>
        <ul style="padding-left:18px; margin-top:10px;">${listHtml || '<li>Unknown error.</li>'}</ul>
      `);
    }

    // Real, read-only stock check — asks the server whether every item in
    // this BOM can actually be dispatched right now (item registered in
    // Masters? enough Available quantity for the entered Dispatch Qty?
    // entered serials real/Available/matching?) and, if not, exactly why.
    // Nothing is deducted or reserved here. Called from Verify BOM (moved
    // off Convert into Challan) — so verifying is what gates whether the
    // BOM can be dispatched/challan'd at all; the actual deduction happens
    // separately via Create Dispatch (bomRunDispatch below).
    async function bomRunStockCheck() {
      const items = bomCollectItemsForStockCheck();
      let result;
      try {
        result = await window.Api.post('/bom/check-stock', { items });
      } catch (e) {
        window.openModal('Stock Check Failed', `<p>Could not verify stock — ${bomEsc((e && e.message) || 'server error')}. Please try again.</p>`);
        return false;
      }
      if (result && result.canDispatch) return true;

      const rows = (result && result.items ? result.items : []).filter((r) => !r.ok);
      bomShowStockIssuesModal(
        'Dispatch Not Possible',
        'This BOM cannot be dispatched right now — the following item(s) failed the stock check:',
        rows
      );
      return false;
    }

    // Create Dispatch — Step 2: the REAL, transactional stock deduction.
    // Server re-checks everything (with row locks, in case stock changed
    // since Verify BOM's check) and only then deducts — serial items get
    // marked Dispatched, quantity items get FIFO-consumed from Available.
    // Nothing is deducted if any single item fails.
    async function bomRunDispatch() {
      const header = getHeaderValues();
      // Step 3: Order No. is now how the server links multiple partial
      // dispatch trips back to the same BOM (pending-qty tracking).
      // Checked here, right before the call, rather than earlier in the
      // flow — Verify BOM / stock check don't persist anything, so they
      // never needed it.
      if (!header.orderNo || !header.orderNo.trim()) {
        window.openModal('Order No. Required', '<p>Please enter an <b>Order No.</b> before creating a dispatch — it\'s how partial dispatches for this BOM get tracked together.</p>');
        return false;
      }
      if (!header.customerName || !header.customerName.trim()) {
        window.openModal('Customer Name Required', '<p>Please enter a <b>Customer Name</b> before creating a dispatch.</p>');
        return false;
      }
      const items = bomCollectItemsForDispatch();
      let result;
      try {
        result = await window.Api.post('/bom/dispatch', { orderNo: header.orderNo, header, items });
      } catch (e) {
        const msg = (e && e.message) || '';
        // Server sends "DISPATCH BLOCKED:\n<item>: <reason>\n..." as the
        // error message on a failed dispatch (mirrors Sales dispatch's own
        // convention) — split it back into rows for the same itemized
        // modal Convert into Challan uses, instead of one wall of text.
        if (msg.startsWith('DISPATCH BLOCKED')) {
          const rows = msg.split('\n').slice(1).map((line) => {
            const idx = line.indexOf(': ');
            return idx === -1 ? { name: line, reason: '' } : { name: line.slice(0, idx), reason: line.slice(idx + 2) };
          });
          bomShowStockIssuesModal('Dispatch Not Possible', 'This BOM could not be dispatched — the following item(s) failed the stock check:', rows);
        } else {
          window.openModal('Dispatch Failed', `<p>${bomEsc(msg || 'Could not dispatch this BOM. Please try again.')}</p>`);
        }
        return false;
      }
      return result;
    }

    // ------------------------------------------------------------------
    // Step 4: Pending BOM Register — list every Open bom_orders row
    // (server-computed remaining-per-item) and let a partial order be
    // continued from ANY session, not just the one that started it,
    // without re-picking the kit or retyping what already went out.
    // Deliberately its own small form (not a reload into currentKitState/
    // the multi-section kit editor) — bom_orders only ever stored a flat
    // { itemName: totalQty } baseline (see Step 3), it never captured
    // section layout, so there's nothing to rebuild a full kit screen
    // from. This form only needs name/category/remaining per item, which
    // GET /api/bom/orders/:id provides directly.
    // ------------------------------------------------------------------

    // Same "DISPATCH BLOCKED:\n<item>: <reason>\n..." convention the
    // server uses everywhere else — shared parsing so this modal shows
    // the same itemized failure list bomRunDispatch's own errors do.
    function bomParseBlockedRows(msg) {
      return String(msg || '').split('\n').slice(1).map((line) => {
        const idx = line.indexOf(': ');
        return idx === -1 ? { name: line, reason: '' } : { name: line.slice(0, idx), reason: line.slice(idx + 2) };
      });
    }

    function bomRenderRegisterListHtml(orders) {
      if (!orders || !orders.length) {
        return `<p class="note" style="padding:20px 0;"><i class="fa-solid fa-circle-check" style="color:var(--green);"></i> Nothing pending — every BOM order has been fully dispatched.</p>`;
      }
      const rows = orders.map((o) => `
        <tr>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);">${bomEsc(o.orderNo)}</td>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);">${bomEsc((o.header && o.header.customerName) || '-')}</td>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);">${o.pendingItemCount} item(s) / ${o.pendingQty} unit(s) pending</td>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);">${bomEsc((o.createdAt || '').slice(0, 10))}</td>
          <td style="padding:8px; border-bottom:1px solid var(--border, #eee);"><button type="button" class="btn btn-blue bom-mini-btn" data-bom-order-id="${o.id}"><i class="fa-solid fa-truck"></i> Continue Dispatch</button></td>
        </tr>
      `).join('');
      return `
        <table style="width:100%; border-collapse:collapse;">
          <thead><tr>
            <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border, #ddd);">Order No</th>
            <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border, #ddd);">Customer</th>
            <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border, #ddd);">Pending</th>
            <th style="text-align:left; padding:8px; border-bottom:2px solid var(--border, #ddd);">Started</th>
            <th style="border-bottom:2px solid var(--border, #ddd);"></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }

    async function bomLoadRegisterList() {
      openRegisterModal('<p class="note"><i class="fa-solid fa-spinner fa-spin"></i> Loading pending BOM orders...</p>');
      let orders;
      try {
        orders = await window.Api.get('/bom/orders?status=Open');
      } catch (e) {
        openRegisterModal(`<p class="note" style="color:var(--red);">Could not load the register — ${bomEsc((e && e.message) || 'server error')}.</p>`);
        return;
      }
      openRegisterModal(bomRenderRegisterListHtml(orders));
      registerModalBody.querySelectorAll('[data-bom-order-id]').forEach((btn) => {
        btn.addEventListener('click', () => bomLoadContinueDispatchForm(btn.getAttribute('data-bom-order-id')));
      });
    }

    // `backLabel`/`showBack` let the same form read right whether it's
    // sitting inside the Register modal ("Back to list") or inline on the
    // BOM Home double-click flow ("Back to BOM Home").
    function bomRenderContinueFormHtml(order, backLabel) {
      const pendingItems = (order.items || []).filter((it) => it.remaining > 0);
      if (!pendingItems.length) {
        return `<p class="note">Nothing left pending for this order.</p><button type="button" class="btn btn-ghost" id="bomRegisterBackBtn"><i class="fa-solid fa-arrow-left"></i> ${bomEsc(backLabel)}</button>`;
      }
      // Step 5: each serial-mandatory row gets its own textarea id + a scan
      // icon button (data-cont-scan-target points at that id) so the same
      // openBomScanner() from the main screen can be reused here too — see
      // bomLoadContinueDispatchForm below for the click wiring.
      const rows = pendingItems.map((it, idx) => {
        const taId = `bomContSerial_${idx}`;
        return `
        <div class="field" style="margin-bottom:14px;">
          <label>${bomEsc(it.name)} <span class="note">(${bomEsc(it.category || '')} — ${it.remaining} of ${it.total} pending, ${it.dispatched} already dispatched)</span></label>
          ${it.serialMandatory
            ? `<div style="display:flex; gap:8px; align-items:flex-start;">
                 <textarea id="${taId}" data-cont-name="${bomEscAttr(it.name)}" data-cont-kind="serial" data-cont-total="${it.total}" rows="2" placeholder="Enter up to ${it.remaining} serial number(s), comma or newline separated" style="flex:1;"></textarea>
                 <button type="button" class="ss-scan-icon-btn" data-cont-scan-target="${taId}" title="Scan barcode / QR"><i class="fa-solid fa-barcode"></i></button>
               </div>`
            : `<input type="number" min="0" max="${it.remaining}" value="${it.remaining}" data-cont-name="${bomEscAttr(it.name)}" data-cont-kind="qty" data-cont-total="${it.total}">`
          }
        </div>
      `;
      }).join('');
      return `
        <p class="note" style="margin-bottom:10px;">Order No <b>${bomEsc(order.orderNo)}</b> — enter what's going out on THIS trip; leave the rest for a later trip.</p>
        ${rows}
        <div class="actions-row">
          <button type="button" class="btn btn-green" id="bomRegisterContinueBtn"><i class="fa-solid fa-truck"></i> Continue Dispatch</button>
          <button type="button" class="btn btn-ghost" id="bomRegisterBackBtn"><i class="fa-solid fa-arrow-left"></i> ${bomEsc(backLabel)}</button>
          <button type="button" class="btn btn-ghost" id="bomRegisterTrackBtn"><i class="fa-solid fa-route"></i> Track This BOM</button>
        </div>
      `;
    }

    // `target` is either 'modal' (Pending/BOM Register overlay, unchanged
    // behaviour) or 'inline' (renders straight into the BOM Entry screen's
    // #bomContinuePanel — see bomOpenOrderInline below, used by the BOM
    // Home table's double-click / Open action).
    async function bomLoadContinueDispatchForm(orderId, target) {
      const mode = target === 'inline' ? 'inline' : 'modal';
      const container = mode === 'inline' ? continueInlineBody : registerModalBody;
      const setBody = (html) => {
        if (mode === 'inline') { container.innerHTML = html; }
        else { openRegisterModal(html); }
      };
      const backLabel = mode === 'inline' ? 'Back to BOM Home' : 'Back to list';
      const goBack = mode === 'inline' ? showBomHome : bomLoadRegisterList;

      setBody('<p class="note"><i class="fa-solid fa-spinner fa-spin"></i> Loading order...</p>');
      let order;
      try {
        order = await window.Api.get(`/bom/orders/${orderId}`);
      } catch (e) {
        setBody(`<p class="note" style="color:var(--red);">Could not load this order — ${bomEsc((e && e.message) || 'server error')}.</p>`);
        return;
      }
      setBody(bomRenderContinueFormHtml(order, backLabel));
      // Step 5: wire each pending serial item's scan icon button to open
      // the camera scanner targeting that item's own textarea id.
      container.querySelectorAll('[data-cont-scan-target]').forEach((btn) => {
        btn.addEventListener('click', () => openBomScanner(btn.getAttribute('data-cont-scan-target')));
      });
      const backBtn = container.querySelector('#bomRegisterBackBtn');
      if (backBtn) backBtn.addEventListener('click', goBack);
      const trackBtn = container.querySelector('#bomRegisterTrackBtn');
      if (trackBtn) trackBtn.addEventListener('click', () => bomOpenTrackForOrderNo(order.orderNo));
      const continueBtn = container.querySelector('#bomRegisterContinueBtn');
      if (continueBtn) {
        continueBtn.addEventListener('click', async () => {
          const items = [];
          container.querySelectorAll('[data-cont-name]').forEach((el) => {
            const name = el.getAttribute('data-cont-name');
            const totalQty = Number(el.getAttribute('data-cont-total')) || 0;
            if (el.getAttribute('data-cont-kind') === 'serial') {
              const serials = bomSplitSerials(el.value || '');
              if (serials.length) items.push({ name, qty: serials.length, totalQty, serials });
            } else {
              const qty = Number(el.value) || 0;
              if (qty > 0) items.push({ name, qty, totalQty, serials: [] });
            }
          });
          if (!items.length) {
            window.openModal('Nothing to Dispatch', '<p>Enter a quantity or serial number(s) for at least one item.</p>');
            return;
          }
          const originalLabel = continueBtn.innerHTML;
          continueBtn.disabled = true;
          continueBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dispatching...';
          let result;
          try {
            result = await window.Api.post('/bom/dispatch', { orderNo: order.orderNo, header: order.header, items });
          } catch (e) {
            continueBtn.disabled = false;
            continueBtn.innerHTML = originalLabel;
            const msg = (e && e.message) || '';
            if (msg.startsWith('DISPATCH BLOCKED')) {
              bomShowStockIssuesModal('Dispatch Not Possible', "This trip could not be dispatched — the following item(s) failed:", bomParseBlockedRows(msg));
            } else {
              window.openModal('Dispatch Failed', `<p>${bomEsc(msg || 'Could not dispatch this order. Please try again.')}</p>`);
            }
            return;
          }
          if (window.showToast) window.showToast('Dispatched — stock has been deducted.');
          if (result.orderStatus === 'Completed' || !(result.pending || []).length) {
            window.openModal('Dispatch Complete', `<p>Order No <b>${bomEsc(order.orderNo)}</b> is now fully dispatched.</p>`);
            goBack();
          } else {
            window.openModal('Partial Dispatch Done', `<p>Stock deducted for this trip. Order No <b>${bomEsc(order.orderNo)}</b> still has item(s) pending — reopen it from the register any time to continue.</p>`);
            bomLoadContinueDispatchForm(orderId, mode);
          }
        });
      }
    }

    // Opens a pending order directly INSIDE the BOM Entry screen (the
    // literal "double-click -> redirected inside the BOM" flow) instead of
    // the Pending BOM Register modal. Kit-selection panel is hidden while
    // this is showing; "Back to BOM Home" (top of the entry screen) and
    // the form's own "Back to BOM Home" button both return to the launcher.
    function bomOpenOrderInline(orderId) {
      bomInlineContinueOrderId = orderId;
      showBomEntry();
      if (newEntryPanel) newEntryPanel.style.display = 'none';
      const kip = $('bomKitItemsPanel');
      if (kip) kip.style.display = 'none';
      if (continuePanel) continuePanel.style.display = '';
      bomLoadContinueDispatchForm(orderId, 'inline');
    }

    if (btnPendingRegister) btnPendingRegister.addEventListener('click', bomLoadRegisterList);
    if (homeBtnRegister) homeBtnRegister.addEventListener('click', bomLoadRegisterList);

    if (btnChallan) {
      btnChallan.addEventListener('click', async () => {
        // belt-and-braces — button stays disabled until Verify BOM passes,
        // which already ran the real stock check (see btnVerify above), so
        // there's nothing left to check here.
        if (!bomVerified) return;
        if (!currentKitState) {
          window.openModal('Select a Kit', '<p>Please select a BOM Kit before converting to a challan.</p>');
          return;
        }

        const kw = bomGetAllKits()[kitSelect.value] ? bomGetAllKits()[kitSelect.value].kw : '';
        const kit = { kw, sections: currentKitState };
        const header = getHeaderValues();

        const challanModalTitleEl = document.getElementById('bomChallanModalTitle');
        if (challanModalTitleEl) challanModalTitleEl.innerHTML = '<i class="fa-solid fa-file-invoice"></i> Convert into Challan';
        openChallanModal(bomRenderChallanEntryModalHtml(header, kit));
        // Auto-fill Qty from the actual on-screen kit items (respecting any
        // partial Dispatch Qty) via the item->category mapping — see
        // bomComputeChallanAutoQty above. Every field stays editable after
        // this; it only sets the starting value.
        bomApplyChallanAutoQty(currentKitState);

        const modalNo = document.getElementById('bomChallanModalNo');
        const modalDate = document.getElementById('bomChallanModalDate');
        const modalOrderNo = document.getElementById('bomChallanModalOrderNo');
        const modalCapacity = document.getElementById('bomChallanModalCapacity');
        const modalName = document.getElementById('bomChallanModalName');
        const modalCity = document.getElementById('bomChallanModalCity');
        const modalVehicleNo = document.getElementById('bomChallanModalVehicleNo');
        const printBtn = document.getElementById('bomChallanPrintBtn');

        if (printBtn) {
          printBtn.addEventListener('click', async () => {
            // Open the tab SYNCHRONOUSLY, as the very first thing in this
            // handler, before any `await`. This is what stops browsers'
            // popup blocker from kicking in — a window.open() call is only
            // treated as "a direct result of the user's click" if it runs
            // before the call stack yields to any async work. It starts as
            // a small "Preparing..." page and gets redirected to the real
            // PDF blob once the server finishes generating it below.
            const pdfWindow = window.open('', '_blank');
            if (pdfWindow) {
              pdfWindow.document.write('<title>Preparing Challan…</title><body style="font-family:sans-serif;background:#1a1a1a;color:#ccc;display:flex;flex-direction:column;gap:16px;align-items:center;justify-content:center;height:100vh;margin:0;"><div style="width:40px;height:40px;border:4px solid #444;border-top-color:#ffb020;border-radius:50%;animation:egsSpin 0.8s linear infinite;"></div><div>Preparing your Challan PDF…</div><style>@keyframes egsSpin{to{transform:rotate(360deg)}}</style></body>');
            }
            // NEW FLOW: Save Data -> backend fills the REAL Excel template ->
            // converts to PDF via LibreOffice -> browser opens/prints the
            // PDF. Replaces the old HTML-replica sheet (bomRenderChallanPrintSheetHtml)
            // entirely — that function + #bomChallanPrintRoot HTML sheet are
            // no longer used by this button (left in place, unused, in case
            // of rollback; safe to delete once this is verified in production).
            const challanNo = modalNo ? modalNo.value.trim() : '';
            // TEMP: mandatory check disabled for testing — re-enable before going live
            // if (!challanNo) {
            //   window.openModal('Challan No. Required', '<p>Please enter a Challan No. before printing.</p>');
            //   return;
            // }

            const payload = {
              challanNo,
              challanDate: modalDate ? modalDate.value : '',
              orderNo: modalOrderNo ? modalOrderNo.value : '',
              capacityKw: modalCapacity ? modalCapacity.value : kw,
              customerName: modalName ? modalName.value : '',
              city: modalCity ? modalCity.value : '',
              vehicleNo: modalVehicleNo ? modalVehicleNo.value : '',
              installerName: header.installerName || '',
              fabricatorName: header.fabricatorName || '',
              dealerName: header.dealerName || '',
              items: bomCollectChallanTemplateValues(),
            };

            printBtn.disabled = true;
            const originalLabel = printBtn.innerHTML;
            printBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving & Preparing PDF...';
            try {
              // pdfWindow (opened synchronously above) shows "Preparing..."
              // while this runs; the global loading overlay (js/app.js)
              // also covers the whole "Saving -> generating PDF on the
              // server" wait on this page itself.
              const saved = await window.Api.post('/challan', payload);
              const pdfUrl = `${window.API_BASE}/challan/${saved.id}/pdf`;
              // NOTE: window.open(pdfUrl, '_blank') directly on the URL was
              // used previously, but that's a plain browser navigation — it
              // never goes through the window.fetch wrapper in js/app.js that
              // auto-attaches the "Authorization: Bearer <token>" header, so
              // the server always rejected it with "Please log in to
              // continue" even for a logged-in user. Fetching the PDF as a
              // blob (via fetch(), which IS wrapped and gets the header) and
              // pointing the already-open tab at an object URL for that blob
              // keeps the request authenticated.
              const pdfRes = await fetch(pdfUrl);
              if (!pdfRes.ok) {
                let msg = 'Could not generate the Challan PDF.';
                try { const j = await pdfRes.json(); if (j && j.error) msg = j.error; } catch (e) { /* ignore */ }
                throw new Error(msg);
              }
              const pdfBlob = await pdfRes.blob();
              const blobUrl = URL.createObjectURL(pdfBlob);
              // Redirect the tab we already opened synchronously on click —
              // this is what actually avoids the popup blocker. Only if that
              // tab somehow never opened (or the person closed it while
              // waiting) do we fall back to a same-tab forced download.
              if (pdfWindow && !pdfWindow.closed) {
                pdfWindow.location = blobUrl;
                pdfWindow.addEventListener('load', () => {
                  try { pdfWindow.print(); } catch (e) { /* let user use the PDF viewer's own print button */ }
                });
              } else {
                // Popup was blocked (or closed early) — fall back to a
                // same-tab download link so the person can still get the PDF.
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = `challan-${saved.id}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                if (window.showToast) window.showToast('Popup blocked — PDF downloaded instead. Allow popups for this site to open it directly next time.');
              }
              // Object URLs are per-tab memory references — revoke it after a
              // delay so the new tab has time to actually load/render the PDF
              // before the underlying blob is freed.
              setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
              if (window.showToast) window.showToast('Challan saved — opening PDF for print.');
            } catch (err) {
              if (pdfWindow && !pdfWindow.closed) pdfWindow.close();
              window.openModal('Print Failed', `<p>${(err && err.message) || 'Could not generate the Challan PDF.'}</p>`);
            } finally {
              printBtn.disabled = false;
              printBtn.innerHTML = originalLabel;
            }
          });
        }
      });
    }

    if (btnDispatch) {
      btnDispatch.addEventListener('click', async () => {
        if (!bomVerified) return; // belt-and-braces — button is disabled until verified anyway
        if (!currentKitState) {
          window.openModal('Select a Kit', '<p>Please select a BOM Kit before dispatching.</p>');
          return;
        }
        const confirmed = await window.confirmDialog(
          'Create Dispatch',
          'This will permanently deduct every item in this BOM from stock. This cannot be undone from here. Continue?',
          { kind: 'warning', okLabel: 'Yes, Dispatch' }
        );
        if (!confirmed) return;

        const originalLabel = btnDispatch.innerHTML;
        btnDispatch.disabled = true;
        btnDispatch.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dispatching...';
        const result = await bomRunDispatch();
        btnDispatch.disabled = false;
        btnDispatch.innerHTML = originalLabel;

        if (result && result.success) {
          const pending = Array.isArray(result.pending) ? result.pending : [];
          if (window.showToast) window.showToast('Dispatched — stock has been deducted.');

          if (result.orderStatus === 'Completed' || !pending.length) {
            // Nothing left pending for this Order No. — same end state as
            // before Step 3.
            window.openModal('Dispatch Complete', '<p>This BOM has been dispatched and stock has been deducted accordingly. Nothing is pending for this Order No. anymore.</p>');
            btnDispatch.disabled = true; // fully done — avoids an accidental re-dispatch of a completed order
          } else {
            // Step 3: Partial dispatch — some item(s) still have qty left
            // pending for this Order No. Pre-fill Dispatch Qty with what's
            // still remaining (per item) and re-render, so the person can
            // immediately do the next trip in this same session without
            // retyping numbers. Entered serials are cleared for every row
            // since whatever was entered this trip is already Dispatched
            // in stock_ledger — they'd otherwise fail re-validation as
            // "not Available" on the next check.
            const pendingByName = {};
            pending.forEach((p) => { pendingByName[p.name] = p.remaining; });
            (currentKitState || []).forEach((sec) => {
              (sec.items || []).forEach((it) => {
                const rem = pendingByName[it.name || ''];
                if (rem !== undefined) {
                  it.dispatchQty = String(rem);
                  it.serials = '';
                  it.checked = false;
                } else if (it.name) {
                  // Fully dispatched already — nothing left to send for
                  // this item on a future trip.
                  it.dispatchQty = '0';
                  it.serials = '';
                }
              });
            });
            if (itemsPreview) {
              const scrollParent = bomFindScrollParent(itemsPreview);
              const scrollTop = scrollParent.scrollTop;
              itemsPreview.innerHTML = bomRenderScreenItemsHtml(currentKitState, { isAdmin: bomIsAdmin, needsSerial: bomItemNeedsSerial });
              scrollParent.scrollTop = scrollTop;
            }

            const listHtml = pending.map((p) => `<li>${bomEsc(p.name)} — <b>${p.remaining}</b> pending (dispatched ${p.dispatched} of ${p.total})</li>`).join('');
            window.openModal('Partial Dispatch Done', `
              <p>Stock has been deducted for this trip. The following item(s) are still pending for Order No. <b>${bomEsc(getHeaderValues().orderNo)}</b>:</p>
              <ul style="padding-left:18px; margin-top:10px;">${listHtml}</ul>
              <p style="margin-top:10px;">Dispatch Qty has been pre-filled with the remaining amounts — tick <b>Check</b> again and re-verify when ready to send the rest.</p>
            `);
            // Remaining stock could have moved since this trip, and every
            // row needs to be re-ticked for the next partial trip anyway
            // (fresh serials, fresh amounts) — so require Verify BOM again
            // before Create Dispatch unlocks, same gate as the very first
            // trip.
            setVerified(false);
            updateVerifyButtonState();
          }
        }
        // On failure, bomRunDispatch() already showed the itemized/error modal.
      });
    }

    // Mirrors Excel's "Fit to 1 page" print option: measure the sheet's
    // real height and shrink it (via CSS `zoom`, which reflows the layout
    // so borders/columns stay correctly aligned — unlike `transform:
    // scale()`, which does NOT reflow and caused the border/column
    // misalignment seen earlier) so it always prints on exactly one page.
    //
    // WHY THE OLD VERSION STILL PRINTED 2 PAGES:
    // 1) It measured with `sheet.scrollHeight` right after setting
    //    `sheet.style.zoom`. In Chromium, scrollHeight/offsetHeight do NOT
    //    reflect a zoom that's just been applied — they keep reporting
    //    (roughly) the un-zoomed size — so the "how tall is it right now"
    //    check was reading the wrong number every time, no matter what
    //    zoom was set. getBoundingClientRect().height is the one DOM API
    //    that DOES report the true, on-screen (zoomed) size, so that's
    //    what this version measures with instead.
    // 2) It only ever ran from the 'beforeprint' event. That event's
    //    timing relative to when the browser actually lays out the print
    //    preview is not something we can rely on — on the reporter's
    //    machine it evidently didn't take effect before the page was
    //    paginated, so the sheet fell back to the CSS's static baseline
    //    zoom alone... which (see next point) was too big by itself.
    // 3) The CSS baseline `zoom:0.75` on `.bom-sheet` was assumed (per its
    //    old comment) to *by itself* guarantee one page. It doesn't —
    //    measured directly, this exact 53-item/66-row kit still overflows
    //    onto a 2nd page at zoom 0.75. There is no safe one-size-fits-all
    //    static zoom: it depends on the item count, which changes per kit.
    //
    // FIX: there's no static zoom in CSS anymore (see style.css). Instead,
    // this always measures the sheet's actual current natural height and
    // computes the exact zoom needed — every time Print is clicked, not
    // only reactively from 'beforeprint'. Because #bomPrintRoot is
    // display:none outside of @media print, measuring it requires
    // temporarily forcing it visible (off-screen, via the .bom-measuring
    // class in style.css) — this works regardless of whether print media
    // is active, so it no longer depends on 'beforeprint' firing at all.
    //
    // WIDTH: a plain uniform `zoom` shrinks width and height by the SAME
    // factor. That's exactly what left big blank strips down both sides
    // once the sheet had to shrink a lot to fit its height on one page —
    // the sheet got shorter (good) but also proportionally narrower than
    // the page (not wanted). Row height in this table depends only on
    // font-size/line-height/padding (fixed values) — NOT on the table's
    // width, since every cell is white-space:nowrap so nothing re-wraps
    // when columns get wider. That means the sheet's *width* can be set
    // independently of the vertical fit-to-page calculation: this widens
    // the sheet's un-zoomed base width just enough that, after the SAME
    // zoom shrink is applied for the height, the final on-page width
    // comes out to exactly the printable page width — no leftover math
    // needed elsewhere, and it's still one single `zoom` factor (so
    // pagination — which depends on `zoom` reflowing layout — stays
    // exactly as reliable as the height-only version above).
    function computeAndApplyFitZoom() {
      const sheet = $('bomSheet');
      if (!sheet || !printRoot) return;
      sheet.style.transform = '';
      sheet.style.width = '850px'; // arbitrary baseline just to measure natural height
      sheet.style.zoom = 1; // measure the sheet's true, un-scaled height first
      printRoot.classList.add('bom-measuring');
      const naturalHeightPx = sheet.getBoundingClientRect().height;
      printRoot.classList.remove('bom-measuring');
      if (!naturalHeightPx) return; // nothing rendered yet — nothing to scale

      const PX_PER_MM = 96 / 25.4;
      // Must match the @page rule in style.css: size:A4 portrait;
      // margin:19.05mm 6.35mm (top/bottom 0.75in, left/right 0.25in —
      // the workbook's real Page Setup margins).
      const A4_HEIGHT_MM = 297;
      const MARGIN_TB_MM = 19.05;
      const A4_WIDTH_MM = 210;
      const MARGIN_LR_MM = 6.35;

      // SAFETY_MARGIN_H: scaling to *exactly* fill the usable page height
      // leaves zero headroom — on a real printer (different default paper
      // size, a substitute font if Calibri isn't installed, sub-pixel
      // rounding once `zoom` is applied, etc.) the sheet could still end
      // up a few px taller than the page and spill onto a 2nd page.
      // Scaling to 96% of the usable height leaves enough slack that
      // those real-world variations can no longer push it over.
      const SAFETY_MARGIN_H = 0.96;
      const usableHeightPx = (A4_HEIGHT_MM - MARGIN_TB_MM * 2) * PX_PER_MM * SAFETY_MARGIN_H;
      // Never scale UP past 1 — a short BOM (few items) should print at
      // its natural 11pt size, matching Excel, not be stretched taller.
      const vScale = Math.min(1, usableHeightPx / naturalHeightPx);

      // SAFETY_MARGIN_W: a small 1% margin so sub-pixel rounding never
      // pushes the sheet a hair past the printable width.
      const SAFETY_MARGIN_W = 0.99;
      const usableWidthPx = (A4_WIDTH_MM - MARGIN_LR_MM * 2) * PX_PER_MM * SAFETY_MARGIN_W;
      // Base width chosen so that AFTER the zoom below shrinks it by
      // vScale, the sheet's final on-page width lands exactly at
      // usableWidthPx — i.e. fills the page edge-to-edge instead of
      // leaving blank strips down both sides.
      const baseWidthPx = usableWidthPx / vScale;

      const supportsZoom = window.CSS && CSS.supports && CSS.supports('zoom', '1');
      if (supportsZoom) {
        sheet.style.width = baseWidthPx + 'px';
        sheet.style.zoom = vScale;
      } else {
        // Fallback for browsers without CSS `zoom`: transform doesn't
        // reflow, so set the final on-page size directly instead of a
        // base-width-then-shrink two-step.
        sheet.style.zoom = '';
        sheet.style.width = '850px';
        sheet.style.transform = `scale(${usableWidthPx / 850}, ${vScale})`;
      }
    }

    // Kept as a defensive backup in case anything (e.g. Ctrl+P on a stale
    // sheet) triggers printing without going through the Print button
    // below — harmless to re-run since it's idempotent (re-measuring after
    // it has already run just recomputes the same scale).
    if (window.__bomBeforePrintHandler) {
      window.removeEventListener('beforeprint', window.__bomBeforePrintHandler);
    }
    window.__bomBeforePrintHandler = computeAndApplyFitZoom;
    window.addEventListener('beforeprint', computeAndApplyFitZoom);

    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        if (!currentKitState) {
          window.openModal('Select a Kit', '<p>Please select a BOM Kit before printing.</p>');
          return;
        }
        const kw = bomGetAllKits()[kitSelect.value].kw;
        printRoot.innerHTML = bomRenderPrintSheetHtml({ kw, sections: currentKitState }, getHeaderValues());
        bomSetPrintPageSize('size:A4 portrait; margin:19.05mm 6.35mm;');
        // Measure and apply the fit-to-one-page zoom BEFORE window.print()
        // is called — this is the actual fix (see the long comment above):
        // don't wait for 'beforeprint', do it right here, synchronously.
        computeAndApplyFitZoom();
        window.print();
      });
    }

    // ---------- Challan print: no runtime scaling ----------
    // CHALLAN_SPEC.md §1/§15: the source sheet prints at a fixed, manual
    // 96% scale (NOT "fit to page"), and its 28-row body is a fixed height
    // by design — there is nothing here to measure. The @page size/margin
    // is set once above (bomSetPrintPageSize, in the Print Challan click
    // handler); the 96% scale and every column/row dimension live as
    // static rules in bom.css. Unlike the BOM kit sheet above (a genuinely
    // variable-length list that has to be measured and fitted every time),
    // the Challan sheet never needs a beforeprint handler at all.
  },
};