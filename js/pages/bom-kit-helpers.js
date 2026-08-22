// js/pages/bom-kit-helpers.js
// -----------------------------------------------------------------------------
// Split out of js/pages/bom.js (was 3921 lines) — PART 1 of 3.
// Pure, presentation-only helpers with no DOM-event wiring: kit storage
// (localStorage), print page sizing, Serial No. helpers, Item/Category
// dropdown builders, on-screen "Kit Items" preview rendering, and the
// print-only Excel-replica sheet (kit print, NOT the Challan print).
// Content below is UNCHANGED verbatim from the original bom.js — only its
// file location moved. Must load BEFORE bom-challan.js and bom.js
// (plain top-level function/const declarations, shared via global scope —
// this project has no bundler/ES-modules, script tag order = the "import").
// -----------------------------------------------------------------------------
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
  styleEl.innerHTML = `@page { ${cssSizeAndMargin} }`;
}

// No built-in kits are shipped anymore — every kit (sections + items) is
// built and saved from this screen via "New Kit" (see the Custom Kit /
// Template storage right below), which persists into bomLoadCustomKits()/
// bomUpsertCustomKit() the exact same way it already did for a person's own
// saved templates. bomGetAllKits() below merges this (now always empty)
// object with whatever's been saved, so the rest of the page — kit
// dropdown, item table, print sheet — needs no further changes.
const BOM_KITS = {};

// ---------- Custom Kit / Template storage ----------
// Kit templates are now a shared, database-backed catalogue (the
// bom_kit_templates table via GET/PUT/DELETE /api/bom/kits — see
// api/routes/bom_kits.routes.js) instead of being stuck in one browser's
// localStorage. A kit created/edited on one device (Admin/SuperAdmin only)
// is now visible from every device/login, including mobile — a kit saved
// on desktop used to never show up on mobile under the same account,
// because localStorage never leaves the browser it was written in.
//
// Architecture mirrors js/data/sheets-store.js: an in-memory cache gives
// every existing call site (populateKitDropdown, refreshItemsPreview, etc.)
// the same SYNCHRONOUS bomGetAllKits()/bomLoadCustomKits() object it always
// got — nothing else on the page needs to change. A localStorage mirror is
// kept purely as an OFFLINE FALLBACK so the dropdown still shows the
// last-known kits if the network/API is unreachable; it is never written
// to directly by a save/delete, only kept in sync as a read cache — the
// server is always the source of truth.
let bomCustomKitsCache = {};
const BOM_CUSTOM_KITS_LOCAL_CACHE_KEY = 'egs_bom_custom_kits_cache_v1';

function bomPersistCustomKitsLocalCache() {
  try { localStorage.setItem(BOM_CUSTOM_KITS_LOCAL_CACHE_KEY, JSON.stringify(bomCustomKitsCache)); } catch (e) { /* ignore */ }
}

function bomLoadCustomKitsLocalCache() {
  try {
    const raw = localStorage.getItem(BOM_CUSTOM_KITS_LOCAL_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

// Call once during bom.js's init() — pulls the real catalogue down from the
// server before the kit dropdown is first populated. Seeds from the
// last-known local cache immediately (in case the app was used offline, or
// the API is briefly unreachable), so the dropdown never shows a false
// "no kits yet" flash while the network request is in flight.
async function bomHydrateCustomKits() {
  bomCustomKitsCache = bomLoadCustomKitsLocalCache();
  try {
    const kits = await window.Api.get('/bom/kits');
    bomCustomKitsCache = (kits && typeof kits === 'object') ? kits : {};
    bomPersistCustomKitsLocalCache();
  } catch (e) {
    console.warn('bom: could not load kit templates from the server, showing last-known kits', e);
    if (window.showToast) window.showToast('Could not reach the server — showing last-saved kit templates.', 3500);
  }
  return bomCustomKitsCache;
}

// Synchronous getter — every existing call site keeps working unchanged.
function bomLoadCustomKits() {
  return bomCustomKitsCache;
}

// Create or update ONE kit template. Saves to the server FIRST; the local
// cache only updates once the server confirms, so a failed save (offline,
// validation error, no permission) never leaves the in-memory catalogue
// (or the dropdown built from it) out of sync with what's actually stored.
// Throws on failure — callers catch this and show the server's message.
async function bomUpsertCustomKit(key, kit) {
  await window.Api.put(`/bom/kits/${encodeURIComponent(key)}`, kit);
  bomCustomKitsCache = { ...bomCustomKitsCache, [key]: kit };
  bomPersistCustomKitsLocalCache();
}

// Delete ONE kit template — same server-first-then-cache ordering as above.
async function bomDeleteCustomKit(key) {
  await window.Api.delete(`/bom/kits/${encodeURIComponent(key)}`);
  const next = { ...bomCustomKitsCache };
  delete next[key];
  bomCustomKitsCache = next;
  bomPersistCustomKitsLocalCache();
}

// Combined catalogue used everywhere a kit needs to be looked up: built-in
// BOM_KITS plus whatever templates have been saved (server-backed cache above).
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

// Every distinct Model value registered anywhere in Masters > Item
// Registration (e.g. "2 Inch", "20 Feet") — drives the free-standing
// Model dropdown on a normal (non-category-driven) kit-builder row, same
// "always list every known value" approach as bomItemMasterNames above.
// Populated alongside it in bomLoadItemMasterNames().
let bomItemMasterModels = [];

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

// name -> { brand_name, model } for every real Masters > Item Registration
// row, keyed by the same composite `name` value used as bomItemMasterNames'
// entries/option values. Lets the flat Item Name dropdown show a clean
// Brand-only label (instead of the stored Brand+Model composite) while the
// underlying <option value> stays the real unique name — nothing that
// matches/saves against item.name elsewhere breaks. Also used to auto-fill
// the row's separate Model field the moment an item is picked, instead of
// leaving Model as a totally independent dropdown that just repeats
// whatever the (now-hidden) composite name already implied.
let bomItemMasterMeta = {};

// brand_name -> [models] for every real Masters > Item Registration row
// under that brand. Drives the Model dropdown so it only ever lists the
// models that actually belong to whichever brand is picked in the Item
// Name column, instead of every model registered anywhere (bomItemMasterModels,
// still kept around as the "no brand picked yet" fallback). Populated
// alongside everything else in bomLoadItemMasterNames().
let bomModelsByBrand = {};

// brand_name -> [{ model, name }] for every real Masters > Item
// Registration row under that brand — lets us go from "brand picked in
// Item Name" + "model picked in Model" back to the exact registered
// `name` (e.g. brand "Lug" + model "16" -> "Lug_16"), which is the only
// value the backend actually matches against (see findItemByName in
// bom.routes.js). Populated alongside everything else in
// bomLoadItemMasterNames().
let bomRowsByBrand = {};

async function bomLoadItemMasterNames() {
  try {
    const rows = await window.Api.get('/masters/items');
    if (Array.isArray(rows) && rows.length) {
      bomItemMasterNames = rows.map((r) => r.name).filter(Boolean);
      bomItemMasterModels = Array.from(new Set(rows.map((r) => r.model).filter(Boolean)));
      bomItemMasterMeta = {};
      bomModelsByBrand = {};
      bomRowsByBrand = {};
      rows.forEach((r) => {
        // `uom` — the UOM picked for this item back in Masters > Item
        // Registration (e.g. "Nos", "Mtr", "Kg" — see GET /api/masters/items
        // in masters.routes.js, column `i.uom`). Kept here so the live
        // Quantity cell (bomRenderScreenItemRowHtml) can show it as a
        // fixed, non-typeable suffix instead of a separate column.
        if (r.name) bomItemMasterMeta[r.name] = { brand_name: r.brand_name || r.name, model: r.model || '', unit: r.uom || '' };
        const brand = r.brand_name || r.name;
        if (brand && r.name) {
          if (!bomRowsByBrand[brand]) bomRowsByBrand[brand] = [];
          bomRowsByBrand[brand].push({ model: r.model || '', name: r.name });
        }
        if (r.brand_name && r.model) {
          if (!bomModelsByBrand[r.brand_name]) bomModelsByBrand[r.brand_name] = [];
          if (!bomModelsByBrand[r.brand_name].includes(r.model)) bomModelsByBrand[r.brand_name].push(r.model);
        }
      });
      return;
    }
  } catch (e) {
    // API/DB not reachable in this preview — fall back to kit-derived names below.
  }
  bomItemMasterNames = bomCollectKitItemNames();
  bomItemMasterModels = [];
  bomItemMasterMeta = {};
  bomModelsByBrand = {};
  bomRowsByBrand = {};
}

// Resolves the exact Masters > Item Registration `name` for a brand +
// model pair — the real value that must be sent to the backend (it does
// an exact `items.name` match, see findItemByName in bom.routes.js).
// A brand with only ONE registered row (no real model choice to make,
// e.g. "GI Structure") resolves as soon as the brand is picked, without
// needing a model at all. A brand with several rows (e.g. "Lug" with
// models 4 and 16) only resolves once the matching model is also picked;
// returns '' until then so a half-picked row never silently saves the
// wrong item.
function bomResolveItemName(brand, model) {
  const rows = bomRowsByBrand[brand];
  if (!rows || !rows.length) return '';
  if (rows.length === 1) return rows[0].name;
  const m = String(model || '').trim().toLowerCase();
  if (!m) return '';
  const hit = rows.find((r) => String(r.model || '').trim().toLowerCase() === m);
  return hit ? hit.name : '';
}

// A row's current brand, for both the Name select's "selected" state and
// the Model dropdown's filter. Prefers the new item.brand field (set the
// moment someone picks from the deduped Name list); falls back to
// resolving it from item.name for rows saved before this change (old
// kits/templates that still store the full composite name directly).
function bomRowBrand(it) {
  if (it.brand) return it.brand;
  const meta = it.name ? bomItemMasterMeta[it.name] : null;
  return meta ? meta.brand_name : (it.name || '');
}

// Item Name dropdown — ONE entry per brand (e.g. "Lug" once, not once per
// Lug model), sorted A-Z. The specific model is picked afterward in the
// Model column (bomBuildModelOptionsHtml), same two-step pattern already
// used by the Category-driven Solar Panel/Inverter rows. `selectedBrand`
// is the row's current brand (callers derive this from item.brand, or —
// for older rows saved before this change — from item.name via
// bomItemMasterMeta).
function bomBuildItemOptionsHtml(selectedBrand) {
  const brands = new Set();
  bomItemMasterNames.forEach((n) => {
    const meta = bomItemMasterMeta[n];
    brands.add(meta ? meta.brand_name : n);
  });
  if (selectedBrand) brands.add(selectedBrand);
  const sorted = Array.from(brands).sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true })
  );
  const optionsHtml = sorted.map((b) =>
    `<option value="${bomEscAttr(b)}" ${b === selectedBrand ? 'selected' : ''}>${bomEsc(b)}</option>`
  ).join('');
  return `<option value="">-- Select Item --</option>${optionsHtml}`;
}

// The free-standing Model dropdown for a normal (non-category-driven) kit
// row — restricted to the models registered under whichever brand is
// currently picked in that row's Item Name column (bomModelsByBrand), so
// picking e.g. "PVCBrand" only shows PVCBrand's own models (2 Inch, 3
// Inch, ...) instead of every model registered across every brand. If no
// item is selected yet (brandName empty/unknown) it falls back to the
// full master list so the dropdown is never empty before a brand is
// chosen. Falls back to keeping whatever value is already saved even if
// it's not (yet) in the list, so an older free-typed value never silently
// disappears the moment this becomes a dropdown.
function bomBuildModelOptionsHtml(selectedModel, brandName) {
  // brandName given -> show only that brand's models (possibly none).
  // brandName omitted/empty (no item picked yet) -> fall back to every
  // model, same as before this change.
  const models = new Set(brandName ? (bomModelsByBrand[brandName] || []) : bomItemMasterModels);
  if (selectedModel) models.add(selectedModel);
  const optionsHtml = Array.from(models).map((n) => `
    <option value="${bomEscAttr(n)}" ${n === selectedModel ? 'selected' : ''}>${bomEsc(n)}</option>
  `).join('');
  return `<option value="">-- Select Model --</option>${optionsHtml}`;
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
// Hide redundant "generic" item names when typed variants exist.
// Handles BOTH naming styles that exist in the DB:
//   "DEYE 3.3"           (space-separated, often older rows)
//   "DEYE_3.3"           (underscore, no type)
//   "DEYE_3.3_ON-GRID"   (underscore + type)
//   "DEYE 3.3 ON-GRID"   (spaces + type)
// If any specific type (ON-GRID / OFF-GRID / …) exists for brand+watt,
// bare / Others variants are removed from the BOM dropdown.
function bomFilterRedundantItemNames(nameList) {
  const list = Array.from(nameList || []).filter(Boolean);
  if (list.length < 2) return list;

  const TYPE_RE = /^(on[-\s]?grid|off[-\s]?grid|hybrid|others)$/i;

  function parseSlug(name) {
    const raw = String(name || '').trim();
    // Normalize separators so "DEYE 3.3 ON-GRID" and "DEYE_3.3_ON-GRID" parse alike
    const norm = raw.replace(/[_\s]+/g, ' ').trim();
    const tokens = norm.split(' ').filter(Boolean);
    if (!tokens.length) {
      return { brand: raw, watt: '', type: '', isGenericType: true, name: raw };
    }

    // Find last token that looks like a solar type
    let type = '';
    let end = tokens.length;
    if (tokens.length >= 2 && TYPE_RE.test(tokens[tokens.length - 1])) {
      type = tokens[tokens.length - 1];
      end = tokens.length - 1;
    }

    // Find wattage token (number like 3.3 / 5.2 / 10) just before type (or at end)
    let watt = '';
    let brandEnd = end;
    if (end >= 1 && !Number.isNaN(Number(tokens[end - 1])) && tokens[end - 1] !== '') {
      watt = String(tokens[end - 1]);
      brandEnd = end - 1;
    }

    const brand = tokens.slice(0, brandEnd).join(' ').trim() || raw;
    const isGenericType = !type || /^others$/i.test(type);
    return { brand, watt, type, isGenericType, name: raw };
  }

  const parsed = list.map(parseSlug);
  const groups = new Map();
  parsed.forEach((p) => {
    if (!p.watt || !p.brand) return;
    const key = `${p.brand.toLowerCase()}|${p.watt}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  });

  const drop = new Set();
  groups.forEach((group) => {
    if (group.length < 2) return;
    const hasSpecific = group.some((p) => !p.isGenericType);
    if (!hasSpecific) return;
    group.forEach((p) => {
      if (p.isGenericType) drop.add(p.name);
    });
  });

  return list.filter((n) => !drop.has(n));
}

function bomBuildCategoryItemOptionsHtml(category, selectedName) {
  const list = (category && bomItemsByCategory[category]) || [];
  let names = bomFilterRedundantItemNames(list);
  // Always keep the currently selected value visible even if it would be filtered
  if (selectedName && !names.includes(selectedName)) names = names.concat([selectedName]);
  names = Array.from(new Set(names)).sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true })
  );
  const optionsHtml = names.map((n) => `
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
// Renders ONE item row (<tr>). Pulled out of bomRenderScreenItemsHtml so a
// single field edit (Name/Category select, Serial No. save) can re-render
// just this one <tr> in place — see bomRerenderItemRow — instead of
// rebuilding the entire table and losing scroll position on a long BOM.
// The <tr> itself carries data-row-sec/data-row-idx so that lookup can find
// it directly.
function bomRenderScreenItemRowHtml(sec, si, it, ii, opts) {
  const isAdmin = !!(opts && opts.isAdmin);
  const needsSerial = (opts && opts.needsSerial) || (() => false);
  const isFullyDispatched = !isAdmin && (it.dispatchQty === '0' || (it.dispatchQty !== undefined && it.dispatchQty !== null && Number(it.dispatchQty) === 0));

  let serialCell;
  if (isFullyDispatched) {
    serialCell = `<span class="badge" style="background:#16a34a; color:#fff; font-size:11px; font-weight:700; padding:3px 8px; border-radius:4px; display:inline-block; white-space:nowrap;"><i class="fa-solid fa-check-double"></i> Fully Dispatched</span>`;
  } else if (needsSerial(it.name)) {
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
  const sectionCategory = bomResolveSectionCategory(sec.title);
  const isCategoryDrivenRow = !!sectionCategory && ii === 0;
  const effectiveCategory = it.category || sectionCategory;
  const nameCell = isCategoryDrivenRow
    ? `<select class="bom-field-input bom-field-category" data-sec="${si}" data-idx="${ii}" data-field="category">${bomBuildCategoryOptionsHtml(effectiveCategory)}</select>`
    : `<select class="bom-field-input bom-field-name" data-sec="${si}" data-idx="${ii}" data-field="name">${bomBuildItemOptionsHtml(bomRowBrand(it))}</select>`;
  // Model select — same brand-filtered dropdown used by the Kit Builder
  // (renderKitBuilderSections/bomBuildModelOptionsHtml) so a normal row's
  // Model is never a free-typed value here; only a category-driven lead
  // row (Solar Panel/Inverter's first row) keeps the Model-item select.
  const modelCell = isCategoryDrivenRow
    ? `<select class="bom-field-input bom-field-modelitem" data-sec="${si}" data-idx="${ii}" data-field="modelitem">${bomBuildCategoryItemOptionsHtml(effectiveCategory, it.name)}</select>`
    : `<select class="bom-field-input" data-sec="${si}" data-idx="${ii}" data-field="model">${bomBuildModelOptionsHtml(it.model, bomRowBrand(it))}</select>`;
  // UOM suffix — shown INSIDE the same Quantity field (not a separate
  // column), sourced from whatever unit was picked for this item back in
  // Masters > Item Registration (bomItemMasterMeta[...].unit). It's a
  // plain non-interactive <span> layered over the input via padding, so
  // it can never be typed over/edited — only the numeric qty itself is.
  const itemUnit = (it.name && bomItemMasterMeta[it.name] && bomItemMasterMeta[it.name].unit) || '';
  const qtyCell = itemUnit
    ? `<div class="bom-qty-field-wrap" style="position:relative;">
         <input type="text" class="bom-field-input bom-qty-has-unit" data-sec="${si}" data-idx="${ii}" data-field="qty" value="${bomEscAttr(it.qty)}" style="width:100%; padding-right:44px; box-sizing:border-box;" ${isAdmin ? '' : 'disabled title="Set by whoever created this BOM — not editable here."'}>
         <span class="bom-qty-unit-suffix" title="Unit set in Item Master — not editable here" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); pointer-events:none; opacity:0.65; font-size:12px;">${bomEsc(itemUnit)}</span>
       </div>`
    : `<input type="text" class="bom-field-input" data-sec="${si}" data-idx="${ii}" data-field="qty" value="${bomEscAttr(it.qty)}" ${isAdmin ? '' : 'disabled title="Set by whoever created this BOM — not editable here."'}>`;
  const mappedCat = (typeof bomGetItemChallanCategory === 'function') ? bomGetItemChallanCategory(it, sec) : null;
  const mapBadge = mappedCat
    ? `<button type="button" class="btn btn-ghost bom-mini-btn bom-challan-map-badge mapped" data-sec="${si}" data-idx="${ii}" ${isAdmin ? '' : 'disabled style="pointer-events:none; opacity:0.9;"'} title="${isAdmin ? 'Click to change Challan category' : 'Challan Category: ' + mappedCat}">
         <i class="fa-solid fa-link" style="color:var(--green, #2ECC71); font-size:10px; margin-right:3px;"></i> <span style="font-weight:600; font-size:11px;">${bomEsc(mappedCat)}</span>
         ${isAdmin ? '<i class="fa-solid fa-pen" style="font-size:8.5px; margin-left:4px; opacity:0.6;"></i>' : ''}
       </button>`
    : `<button type="button" class="btn btn-red bom-mini-btn bom-challan-map-badge unmapped" data-sec="${si}" data-idx="${ii}" ${isAdmin ? '' : 'disabled style="pointer-events:none; opacity:0.9;"'} title="${isAdmin ? 'Click to map this item to a Challan category' : 'Not mapped to any Challan category'}">
         <i class="fa-solid fa-triangle-exclamation" style="font-size:10px; margin-right:3px;"></i> <span style="font-size:11px; font-weight:600;">Unmapped</span>
         ${isAdmin ? '<i class="fa-solid fa-arrow-pointer" style="font-size:8.5px; margin-left:4px;"></i>' : ''}
       </button>`;

  const dispatchQtyCell = isAdmin ? '' : (
    isFullyDispatched
      ? `<td><input type="number" min="0" class="bom-field-input bom-field-dispatchqty" data-sec="${si}" data-idx="${ii}" data-field="dispatchQty" value="0" disabled style="opacity:0.6; cursor:not-allowed; text-align:center;" title="0 pending (already dispatched in earlier trip)"></td>`
      : `<td><input type="number" min="0" class="bom-field-input bom-field-dispatchqty" data-sec="${si}" data-idx="${ii}" data-field="dispatchQty" value="${bomEscAttr(it.dispatchQty)}" title="How many of this item you are dispatching right now (can be less than Quantity for a partial dispatch)."></td>`
  );

  const checkCell = isFullyDispatched
    ? `<input type="checkbox" class="bom-field-check" data-sec="${si}" data-idx="${ii}" data-field="checked" checked disabled title="This item was already completely dispatched in an earlier trip">`
    : `<input type="checkbox" class="bom-field-check" data-sec="${si}" data-idx="${ii}" data-field="checked" ${it.checked ? 'checked' : ''} title="Tick once this item is verified">`;

  const rowStyle = isFullyDispatched ? 'style="opacity:0.65; background:rgba(22, 163, 74, 0.05);"' : '';

  return `
      <tr data-row-sec="${si}" data-row-idx="${ii}" ${rowStyle}>
        <td><input type="text" class="bom-field-input bom-field-sr" data-sec="${si}" data-idx="${ii}" data-field="sr" value="${bomEscAttr(it.sr)}"></td>
        <td>${nameCell}</td>
        <td>${modelCell}</td>
        <td>${qtyCell}</td>
        ${dispatchQtyCell}
        <td class="bom-serial-cell">${serialCell}</td>
        <td class="bom-map-cell" style="text-align:center;">${mapBadge}</td>
        <td style="white-space:nowrap;">
          <input type="text" class="bom-field-input" data-sec="${si}" data-idx="${ii}" data-field="remarks" value="${bomEscAttr(it.remarks)}" style="width:calc(100% - ${isAdmin ? '60px' : '0px'}); display:inline-block;">
          ${isAdmin ? `
          <button type="button" class="btn btn-ghost bom-mini-btn" data-insert-after-sec="${si}" data-insert-after-idx="${ii}" title="Insert item below"><i class="fa-solid fa-plus"></i></button>
          <button type="button" class="btn btn-red bom-mini-btn" data-remove-sec="${si}" data-remove-idx="${ii}" title="Remove item"><i class="fa-solid fa-xmark"></i></button>` : ''}
        </td>
        <td class="bom-check-cell">
          ${checkCell}
        </td>
      </tr>`;
}

function bomRenderScreenItemsHtml(state, opts) {
  const isAdmin = !!(opts && opts.isAdmin);
  if (!state) return '<div class="empty">Select a BOM Kit above to load its item list.</div>';
  const rows = state.map((sec, si) => {
    const catRow = `
      <tr class="bom-screen-cat">
        <td colspan="${isAdmin ? 8 : 9}">
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
    const itemRows = sec.items.map((it, ii) => bomRenderScreenItemRowHtml(sec, si, it, ii, opts)).join('');
    return catRow + itemRows;
  }).join('');

  return `
    <div class="table-wrap">
      <table class="bom-items-form-table">
        <thead><tr><th>Sr No.</th><th>Item Name</th><th>Model</th><th>Quantity</th>${isAdmin ? '' : '<th>Dispatch Qty</th>'}<th>Serial No.</th><th>Challan Mapping</th><th>Remarks</th><th>Check</th></tr></thead>
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

// -----------------------------------------------------------------------------
// Direct Network & Browser Serial Numbers Excel Handler
// Automatically saves formatted Excel sheets (A1=Sr. No., B1=Serial No., NO blue fill)
// into daily subfolders (e.g. 21-08-2026/NP003700 - VIKRAM 555.xlsx)
// -----------------------------------------------------------------------------
const EGS_FS_DB = 'egs_erp_fs_v1';
const EGS_FS_STORE = 'handles';
const EGS_FS_KEY = 'serial_excel_dir_handle';
const DEFAULT_NETWORK_PATH_DISPLAY = '\\\\As6302t-989d\\work\\2023-24\\Solar Rooftop\\NP - Site Visit, 3D\\SUMIT\\Solar_ERP_DB\\SERAIL NO. (ORD. & CHLN)';

function getStoredSerialDirHandle() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(EGS_FS_DB, 1);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(EGS_FS_STORE);
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(EGS_FS_STORE, 'readonly');
        const store = tx.objectStore(EGS_FS_STORE);
        const getReq = store.get(EGS_FS_KEY);
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

function setStoredSerialDirHandle(handle) {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(EGS_FS_DB, 1);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore(EGS_FS_STORE);
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction(EGS_FS_STORE, 'readwrite');
        const store = tx.objectStore(EGS_FS_STORE);
        store.put(handle, EGS_FS_KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    } catch (e) {
      reject(e);
    }
  });
}

async function verifyFsPermission(fileHandle, readWrite) {
  if (!fileHandle) return false;
  const options = {};
  if (readWrite) options.mode = 'readwrite';
  try {
    if ((await fileHandle.queryPermission(options)) === 'granted') return true;
    if ((await fileHandle.requestPermission(options)) === 'granted') return true;
  } catch (e) {
    return false;
  }
  return false;
}

function generateSerialExcelBlob(serials) {
  const data = [
    ['Sr. No.', 'Serial No.']
  ];
  const list = Array.isArray(serials) ? serials : [];
  list.forEach((sn, idx) => {
    data.push([idx + 1, String(sn || '').trim()]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 12 }, { wch: 32 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Serials');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

window.connectSerialNetworkFolder = async function() {
  if (!('showDirectoryPicker' in window)) {
    window.openModal('Browser Notice', '<p>Your current browser does not support local folder integration. Excel files will be downloaded directly.</p>');
    return false;
  }
  try {
    const dirHandle = await window.showDirectoryPicker({
      id: 'egs_serial_folder',
      mode: 'readwrite',
      startIn: 'desktop'
    });
    if (dirHandle) {
      await setStoredSerialDirHandle(dirHandle);
      if (window.showToast) window.showToast(`Network folder connected: ${dirHandle.name}`, 'success');
      return dirHandle;
    }
  } catch (err) {
    if (err && err.name !== 'AbortError') {
      console.warn('Directory pick error:', err);
    }
  }
  return null;
};

window.saveSerialExcelDirectly = async function(params) {
  const { orderNo, customerName, shortName, date, serials, showPromptIfUnset } = params || {};
  const list = Array.isArray(serials) ? serials.filter((s) => s && String(s).trim()) : [];
  if (!list.length) return false;

  const now = date ? new Date(date) : new Date();
  const d = isNaN(now.getTime()) ? new Date() : now;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const dateFolder = `${day}-${month}-${year}`;

  const cleanOrder = String(orderNo || '').replace(/[/\\?%*:|"<>]/g, '-').trim();
  const cleanShort = String(shortName || customerName || '').replace(/[/\\?%*:|"<>]/g, '-').trim();
  let baseName = '';
  if (cleanOrder && cleanShort && cleanOrder !== cleanShort) {
    baseName = `${cleanOrder} - ${cleanShort}`;
  } else if (cleanOrder) {
    baseName = cleanOrder;
  } else if (cleanShort) {
    baseName = cleanShort;
  } else {
    baseName = `Serials_${Date.now()}`;
  }
  const fileName = `${baseName}.xlsx`;

  // 1. Also notify backend API (in case running in LAN node environment)
  if (window.Api && typeof window.Api.post === 'function') {
    window.Api.post('/serials/save-excel', {
      orderNo: cleanOrder,
      customerName: cleanShort,
      shortName: cleanShort,
      date: dateFolder,
      serials: list
    }, { silent: true }).catch(() => {});
  }

  // 2. Try File System Access API directly to network share from browser
  let writtenSuccessfully = false;
  if ('showDirectoryPicker' in window) {
    try {
      const dirHandle = await getStoredSerialDirHandle();
      if (dirHandle) {
        const hasPerm = await verifyFsPermission(dirHandle, true);
        if (hasPerm) {
          const dateDir = await dirHandle.getDirectoryHandle(dateFolder, { create: true });
          const fileHandle = await dateDir.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          const blob = generateSerialExcelBlob(list);
          await writable.write(blob);
          await writable.close();
          writtenSuccessfully = true;

          if (window.showToast) {
            window.showToast(`✔ Serial Excel saved: ${dateFolder}/${fileName}`, 'success');
          }
          return true;
        }
      }
    } catch (fsErr) {
      console.warn('[SerialFS] Auto-write failed:', fsErr);
    }
  }

  // 3. If not written and showPromptIfUnset is true, show one-time folder connector or instant download
  if (!writtenSuccessfully) {
    if (showPromptIfUnset && 'showDirectoryPicker' in window) {
      const modalHtml = `
        <div style="font-size:13px; line-height:1.6; text-align:left;">
          <p style="margin-bottom:8px; color:var(--txt);">Scanned <b>${list.length}</b> serial number(s) for <b>${bomEsc(fileName)}</b>.</p>
          <p style="margin-bottom:8px; color:var(--txt-muted);">To automatically save all serial Excel files directly into your network folder:</p>
          <div style="background:rgba(255,255,255,0.06); padding:8px 12px; border-radius:8px; font-family:monospace; font-size:11px; margin-bottom:14px; word-break:break-all; border:1px solid var(--border-light); color:var(--gold);">
            ${DEFAULT_NETWORK_PATH_DISPLAY}
          </div>
          <p style="margin-bottom:16px; font-size:12px; color:var(--txt);">Click <b>Select Network Folder</b> once to connect. After this one-time setup, every scan and BOM verify will save into daily subfolders <b>instantly in the background</b>!</p>
          <div class="actions-row" style="gap:10px; flex-wrap:wrap;">
            <button type="button" class="btn btn-green" id="btnPickSerialDir"><i class="fa-solid fa-folder-open"></i> Select Network Folder &amp; Save</button>
            <button type="button" class="btn btn-blue" id="btnDownloadSerialExcel"><i class="fa-solid fa-download"></i> Direct Download (.xlsx)</button>
            <button type="button" class="btn btn-ghost" onclick="closeModal()">Close</button>
          </div>
        </div>
      `;
      window.openModal('📁 Save Serial Numbers Excel', modalHtml);

      const pickBtn = document.getElementById('btnPickSerialDir');
      if (pickBtn) {
        pickBtn.addEventListener('click', async () => {
          window.closeModal();
          const handle = await window.connectSerialNetworkFolder();
          if (handle) {
            window.saveSerialExcelDirectly({ orderNo, customerName, shortName, date, serials: list, showPromptIfUnset: false });
          }
        });
      }

      const dlBtn = document.getElementById('btnDownloadSerialExcel');
      if (dlBtn) {
        dlBtn.addEventListener('click', () => {
          window.closeModal();
          const blob = generateSerialExcelBlob(list);
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = fileName;
          a.click();
          if (window.showToast) window.showToast(`Downloaded ${fileName}`, 'success');
        });
      }
    } else {
      const blob = generateSerialExcelBlob(list);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      if (window.showToast) window.showToast(`✔ Serial Excel saved: ${fileName}`, 'success');
    }
  }

  return true;
};

window.openSerialFolderSetupModal = async function() {
  const dirHandle = await getStoredSerialDirHandle();
  const folderName = dirHandle ? dirHandle.name : null;

  const modalHtml = `
    <div style="font-size:13px; line-height:1.6; text-align:left;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; padding:10px; border-radius:8px; background:${folderName ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)'}; border:1px solid ${folderName ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.3)'};">
        <i class="fa-solid ${folderName ? 'fa-circle-check' : 'fa-triangle-exclamation'}" style="color:${folderName ? '#22c55e' : '#eab308'}; font-size:20px;"></i>
        <div>
          <div style="font-weight:700; color:var(--txt);">${folderName ? `Connected: ${bomEsc(folderName)}` : 'Network Folder Not Connected Yet'}</div>
          <div style="font-size:12px; color:var(--txt-muted);">${folderName ? 'Excel files will auto-save directly into date subfolders.' : 'Connect once to enable automatic background saving into date subfolders.'}</div>
        </div>
      </div>

      <p style="margin-bottom:6px; color:var(--txt);"><b>Target Network Path:</b></p>
      <div style="background:rgba(255,255,255,0.06); padding:8px 12px; border-radius:8px; font-family:monospace; font-size:11px; margin-bottom:14px; word-break:break-all; border:1px solid var(--border-light); color:var(--gold);">
        ${DEFAULT_NETWORK_PATH_DISPLAY}
      </div>

      <p style="margin-bottom:16px; font-size:12px; color:var(--txt);">Click below to select the <b>SERAIL NO. (ORD. &amp; CHLN)</b> folder on your network drive. Browser will remember the connection permanently!</p>

      <div class="actions-row" style="gap:10px; flex-wrap:wrap;">
        <button type="button" class="btn btn-green" id="btnConnectFolderNow"><i class="fa-solid fa-folder-open"></i> ${folderName ? 'Change / Reconnect Network Folder' : 'Connect Network Folder'}</button>
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Close</button>
      </div>
    </div>
  `;

  window.openModal('📁 Serial Numbers Excel Network Folder', modalHtml);

  const btn = document.getElementById('btnConnectFolderNow');
  if (btn) {
    btn.addEventListener('click', async () => {
      window.closeModal();
      const h = await window.connectSerialNetworkFolder();
      if (h && window.showToast) {
        window.showToast(`✔ Connected to network folder: ${h.name}`, 'success');
      }
    });
  }
};