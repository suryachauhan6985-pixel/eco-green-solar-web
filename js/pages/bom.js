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

// Standard kit catalogue — keyed by kW so the dropdown is a SINGLE select
// and everything else (items, models, quantities) auto-fills from here.
// Only one kit for now (copied 1:1 from the uploaded Excel sample); more
// kits get added to this object later the same way.
const BOM_KITS = {
  '3.3': {
    label: '3.3 kW — Residential 550 Wp',
    kw: '3.3',
    sections: [
      {
        title: 'Solar Penal',
        items: [
          { sr: 1, name: 'DCR Solar Penal', model: '550 Watts', qty: '06 Nos', remarks: 'ADANI 550 Wp' },
        ],
      },
      {
        title: 'Solar Structure',
        items: [
          { sr: 2, name: 'GI Structure', model: 'Special', qty: '-', remarks: '' },
          { sr: 3, name: 'GI PIPE', model: '1.5" X 1.5"', qty: '60 Feet', remarks: '' },
          { sr: 4, name: 'GI PIPE', model: '2.5" X 1.5"', qty: '55 Feet', remarks: '' },
          { sr: 5, name: 'GI PIPE', model: '1" X 1"', qty: '-', remarks: '' },
          { sr: 6, name: 'Base Plate', model: '-', qty: '04 Nos', remarks: '' },
          { sr: 7, name: 'Base Angle', model: '-', qty: '-', remarks: '' },
          { sr: 8, name: 'Wall Patti', model: '', qty: '-', remarks: '' },
          { sr: 9, name: 'LA Patti', model: '', qty: '01 Nos', remarks: '' },
          { sr: 10, name: 'Anchor Bolt (Pin)', model: '10mm X 125mm', qty: '-', remarks: '' },
          { sr: 11, name: 'American Bolt', model: '2.5"', qty: '16 Nos', remarks: '' },
          { sr: 12, name: 'Stud Bolt with Nut & Washer', model: '12mm X 400 mm', qty: '-', remarks: '' },
          { sr: 13, name: 'Clamps', model: 'With Bolt', qty: '24 Nos', remarks: 'Clamps' },
          { sr: 14, name: 'U - Bolt with Nut Bolt', model: '(125 x 75 x 125) mm', qty: '-', remarks: '' },
          { sr: 15, name: 'Nut Bolt - GI 4 Aani X 0.5" Long', model: '0.5"', qty: '02 Nos', remarks: '' },
          { sr: 16, name: 'Nut Bolt - SS 4 Aani X 1.5" Long', model: '1.5"', qty: '04 Nos', remarks: '' },
          { sr: 17, name: 'Nut Bolt - SS 4 Aani X 2.5" Long', model: '2.5"', qty: '-', remarks: '' },
          { sr: 18, name: 'Nut Bolt - SS 5 Aani X 3" Long', model: '3"', qty: '-', remarks: '' },
          { sr: 19, name: 'Nito Bond Chemical', model: 'White + Black', qty: '300 Ml + 150 Ml', remarks: '' },
        ],
      },
      {
        title: 'Solar Inverter',
        items: [
          { sr: 20, name: 'Solar Inverter - DEYE', model: '3.3 kW', qty: '1 Nos', remarks: 'DEYE' },
          { sr: 21, name: 'ACDB Box', model: '1 In 1 Out', qty: '1 Nos', remarks: '' },
          { sr: 22, name: 'DCDB Box', model: '1 In 1 Out', qty: '1 Nos', remarks: '' },
          { sr: 23, name: 'MC 4 Connector', model: '', qty: '2 Nos', remarks: '' },
        ],
      },
      {
        title: 'Solar Earthing Kit',
        items: [
          { sr: 24, name: 'Earthing Rod & LA Kit', model: '', qty: '1 Kit', remarks: '' },
          { sr: 25, name: 'LA Bracket', model: '', qty: '-', remarks: '' },
        ],
      },
      {
        title: 'Solar Wire',
        items: [
          { sr: 26, name: 'DC Wire - Red - Polycab', model: '4 SQ.MM', qty: '25 Mtr', remarks: '' },
          { sr: 27, name: 'DC Wire - Black - Polycab', model: '4 SQ.MM', qty: '25 Mtr', remarks: '' },
          { sr: 28, name: 'DC Earthing Wire - Yellow - Polycab', model: '2.5 SQ.MM', qty: '30 Mtr', remarks: '' },
          { sr: 29, name: 'AC Earthing Wire - Green - Polycab', model: '2.5 SQ.MM', qty: '13 Mtr', remarks: '' },
          { sr: 30, name: 'LA Earthing Wire - Green (Allu.) - Aircab', model: '16 SQ. MM', qty: '20 Mtr', remarks: '' },
          { sr: 31, name: 'Lug', model: '4 SQ.MM', qty: '04 Nos', remarks: '' },
          { sr: 32, name: 'Lug', model: '16 SQ.MM', qty: '02 Nos', remarks: '' },
          { sr: 33, name: 'AC - 2 Core - Polycab', model: '2.5 SQ.MM', qty: '07 Mtr', remarks: '' },
          { sr: 34, name: 'AC - 4 Core - Polycab', model: '2.5 SQ.MM', qty: '-', remarks: '' },
        ],
      },
      {
        title: 'BOS',
        items: [
          { sr: 35, name: 'PVC Pipe', model: '19mm DIA', qty: '13 Nos', remarks: '' },
          { sr: 36, name: 'PVC Albow', model: '19mm DIA', qty: '20 Nos', remarks: '' },
          { sr: 37, name: 'PVC Bend', model: '19mm DIA', qty: '07 Nos', remarks: '' },
          { sr: 38, name: 'PVC Tee', model: '19mm DIA', qty: '05 Nos', remarks: '' },
          { sr: 39, name: 'PVC Coupler', model: '19mm DIA', qty: '03 Nos', remarks: '' },
          { sr: 40, name: 'Bendable Pipe', model: '19mm DIA', qty: '-', remarks: '' },
          { sr: 41, name: 'Clamp for Pipe', model: '19mm DIA', qty: '50 Nos', remarks: '' },
          { sr: 42, name: 'Cable Tie (PVC)', model: '12"', qty: '12 Nos', remarks: '' },
          { sr: 43, name: 'Cable Tie (S.S)', model: '12"', qty: '06 Nos', remarks: '' },
          { sr: 44, name: 'Screw + Grip', model: '1.5"', qty: '10 Nos', remarks: '' },
          { sr: 45, name: 'Sand - Rati', model: '', qty: '4 Tagara', remarks: '' },
          { sr: 46, name: 'Grit - Kapchi', model: '', qty: '3 Tagara', remarks: '' },
          { sr: 47, name: 'Cement', model: '', qty: '12 KG', remarks: '' },
          { sr: 48, name: 'Farma', model: '', qty: '04 Nos', remarks: '' },
          { sr: 49, name: 'MCB', model: '2Pole / 1 Phase', qty: '01 Nos', remarks: '01 Nos' },
          { sr: 50, name: 'MCB', model: '4 Pole / 3 Phase', qty: '-', remarks: '' },
          { sr: 51, name: 'Nozzle Kit', model: '', qty: '-', remarks: '' },
          { sr: 52, name: 'Zinc Spray', model: '', qty: '01 Nos', remarks: '' },
          { sr: 53, name: 'Cable Tray', model: '1 Mtr', qty: '01 Nos', remarks: '' },
        ],
      },
    ],
  },
};

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
  }));
  bomRenumberAll(cloned);
  return cloned;
}

// ---------- shared escaping helpers ----------
const bomEsc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const bomEscAttr = (s) => bomEsc(s).replace(/"/g, '&quot;');

// ---------- Item Name dropdown source ----------
// Real item master (Masters > Item Registration) is the source of truth once
// the API/DB is reachable. Until then (or for any kit item not yet registered
// as a master item), we fall back to every unique item name already used
// across BOM_KITS, so the field is always a real dropdown — never a plain
// static label — regardless of backend availability.
let bomItemMasterNames = [];

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
function bomRenderScreenItemsHtml(state) {
  if (!state) return '<div class="empty">Select a BOM Kit above to load its item list.</div>';
  const rows = state.map((sec, si) => {
    const catRow = `
      <tr class="bom-screen-cat">
        <td colspan="5">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <input type="text" class="bom-field-input bom-section-title-input" data-sec="${si}" data-field="sectitle" value="${bomEscAttr(sec.title)}" style="max-width:280px;">
            <span style="white-space:nowrap;">
              <button type="button" class="btn btn-ghost bom-mini-btn" data-sec-add-item="${si}" title="Add item to this section"><i class="fa-solid fa-plus"></i> Add Item</button>
              <button type="button" class="btn btn-red bom-mini-btn" data-sec-remove="${si}" title="Remove this section"><i class="fa-solid fa-trash"></i></button>
            </span>
          </div>
        </td>
      </tr>`;
    const itemRows = sec.items.map((it, ii) => `
      <tr>
        <td><input type="text" class="bom-field-input bom-field-sr" data-sec="${si}" data-idx="${ii}" data-field="sr" value="${bomEscAttr(it.sr)}"></td>
        <td><select class="bom-field-input bom-field-name" data-sec="${si}" data-idx="${ii}" data-field="name">${bomBuildItemOptionsHtml(it.name)}</select></td>
        <td><input type="text" class="bom-field-input" data-sec="${si}" data-idx="${ii}" data-field="model" value="${bomEscAttr(it.model)}"></td>
        <td><input type="text" class="bom-field-input" data-sec="${si}" data-idx="${ii}" data-field="qty" value="${bomEscAttr(it.qty)}"></td>
        <td style="white-space:nowrap;">
          <input type="text" class="bom-field-input" data-sec="${si}" data-idx="${ii}" data-field="remarks" value="${bomEscAttr(it.remarks)}" style="width:calc(100% - 60px); display:inline-block;">
          <button type="button" class="btn btn-ghost bom-mini-btn" data-insert-after-sec="${si}" data-insert-after-idx="${ii}" title="Insert item below"><i class="fa-solid fa-plus"></i></button>
          <button type="button" class="btn btn-red bom-mini-btn" data-remove-sec="${si}" data-remove-idx="${ii}" title="Remove item"><i class="fa-solid fa-xmark"></i></button>
        </td>
      </tr>`).join('');
    return catRow + itemRows;
  }).join('');

  return `
    <div class="table-wrap">
      <table class="bom-items-form-table">
        <thead><tr><th>Sr No.</th><th>Item Name</th><th>Model</th><th>Quantity</th><th>Remarks</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="margin-top:10px;">
      <button type="button" class="btn btn-ghost" id="bomBtnAddSectionLive"><i class="fa-solid fa-layer-group"></i> Add Section</button>
    </div>
  `;
}

// ---------- Print-only sheet: exact Excel replica, built from live form values ----------
function bomRenderPrintSheetHtml(kit, header) {
  const h = header;
  const rows = kit.sections.map((sec) => {
    const catRow = `<tr class="bom-cat-row"><td colspan="6">${sec.title}</td></tr>`;
    const itemRows = sec.items.map((it) => `
      <tr>
        <td class="bom-c-sr">${it.sr}</td>
        <td class="bom-c-name">${it.name}</td>
        <td class="bom-c-model">${it.model || ''}</td>
        <td class="bom-c-qty">${it.qty}</td>
        <td class="bom-c-checked"></td>
        <td class="bom-c-remarks">${it.remarks || ''}</td>
      </tr>`).join('');
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

window.PAGES.bom = {
  name: 'BOM',
  icon: 'fa-list-check',
  sub: 'Bill of Material — kit-wise item list',
  html: `
    <div class="page-head"><i class="fa-solid fa-list-check" style="color:var(--gold);"></i><h2>Bill of Material (BOM)</h2></div>

    <div class="panel">
      <h3><i class="fa-solid fa-box-open"></i> New BOM Entry</h3>
      <div class="form-grid cols-2">
        <div class="field"><label>BOM Kit <span class="req">*</span></label>
          <div style="display:flex; gap:8px; align-items:center;">
            <select id="bomKitSelect" style="flex:1;">
              <option value="">-- Select Kit --</option>
            </select>
            <button type="button" class="btn btn-ghost" id="bomBtnNewKit" style="padding:9px 12px; white-space:nowrap;" title="Create a new BOM Kit / Template"><i class="fa-solid fa-plus"></i> New Kit</button>
            <button type="button" class="btn btn-red" id="bomBtnDeleteKit" style="display:none; padding:9px 12px;" title="Delete this saved template"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
        <div class="field"><label>Order No</label><input id="bomOrderNo" placeholder="Order no."></div>

        <div class="field"><label>Customer Name</label><input id="bomCustomerName" placeholder="Customer / Party"></div>
        <div class="field"><label>Dealer Name</label><input id="bomDealerName" placeholder="Dealer name"></div>

        <div class="field"><label>Installer Name</label><input id="bomInstallerName" placeholder="Installer name"></div>
        <div class="field"><label>Fabricatore Name</label><input id="bomFabricatorName" placeholder="Fabricator name"></div>

        <div class="field"><label>Challan No.</label><input id="bomChallanNo" placeholder="Challan no."></div>
        <div class="field"><label>Ch. Date</label><input id="bomChallanDate" type="date"></div>
      </div>
      <div class="actions-row">
        <button class="btn btn-ghost" type="button" id="bomBtnPrint"><i class="fa-solid fa-print"></i> Print BOM (Excel format, 1 page)</button>
        <button class="btn btn-blue" type="button" id="bomBtnVerify"><i class="fa-solid fa-check-double"></i> Verify BOM</button>
        <button class="btn btn-green" type="button" id="bomBtnDispatch" disabled><i class="fa-solid fa-truck"></i> Create Dispatch</button>
      </div>
      <p class="note" id="bomVerifyStatus" style="margin-top:8px;">
        <i class="fa-solid fa-circle-info"></i> Not verified yet — click <b>Verify BOM</b> once every item/quantity above is final. "Create Dispatch" stays locked until then.
      </p>
    </div>

    <div class="panel" id="bomKitBuilderPanel" style="display:none;">
      <h3><i class="fa-solid fa-layer-group"></i> Create / Save New BOM Kit &amp; Template</h3>
      <div class="form-grid cols-2">
        <div class="field"><label>Kit Name <span class="req">*</span></label><input id="bomNewKitLabel" placeholder="e.g. 5 kW — Commercial 550 Wp"></div>
        <div class="field"><label>Capacity (kW)</label><input id="bomNewKitKw" placeholder="e.g. 5"></div>
      </div>
      <p class="note" style="margin:6px 0 14px;">
        <i class="fa-solid fa-circle-info"></i> Starts pre-filled with the standard section/item format below — Model, Quantity &amp; Remarks are left blank for you to fill in. Add or remove sections/items freely, and item names can be renamed too.
      </p>
      <div id="bomNewKitSections"></div>
      <div class="actions-row" style="margin-top:10px;">
        <button class="btn btn-ghost" type="button" id="bomBtnAddKitSection"><i class="fa-solid fa-layer-group"></i> Add Section</button>
        <button class="btn btn-blue" type="button" id="bomBtnSaveKitTemplate"><i class="fa-solid fa-floppy-disk"></i> Save Kit Template</button>
        <button class="btn btn-ghost" type="button" id="bomBtnCancelKitBuilder">Cancel</button>
      </div>
    </div>

    <div class="panel">
      <h3><i class="fa-solid fa-list"></i> Kit Items <span style="font-weight:400;color:var(--txt-muted);font-size:11.5px;">(auto-filled from selected kit)</span></h3>
      <div id="bomItemsPreview">${bomRenderScreenItemsHtml(null)}</div>
    </div>

    <p class="note" style="margin-top:10px;">
      Yeh abhi front-end preview hai — direct BOM-kit dispatch aur ek dispatch mein saare items ek saath stock se
      deduct karne wala workflow, tumhara pura process samjhaane ke baad wire kiya jayega.
    </p>

    <!-- PRINT-ONLY: exact Excel replica. Hidden on screen (see .bom-print-only
         in style.css); (re)built from the form fields above right before
         printing, then never shown on-screen at all — this is what fixes
         both the "doesn't look like software" issue and the mobile
         layout breaking, since this Excel-shaped markup no longer renders
         on screen or on phones at all. -->
    <div class="bom-print-only" id="bomPrintRoot"></div>
  `,

  async init() {
    const $ = (id) => document.getElementById(id);
    const kitSelect = $('bomKitSelect');
    const itemsPreview = $('bomItemsPreview');
    const btnPrint = $('bomBtnPrint');
    const printRoot = $('bomPrintRoot');

    // Live, mutable clone of the selected kit's `sections`. Selecting a kit
    // auto-fills this from BOM_KITS; every field rendered from it is a real
    // input/select, so edits below write straight back into this object —
    // this is what actually gets printed (not the static BOM_KITS data).
    let currentKitState = null;

    // "Verify BOM" gate: Create Dispatch stays locked until the person
    // explicitly confirms the BOM is ready. Any kit change or item edit
    // after that re-locks it, since the verified snapshot no longer matches
    // what's on screen.
    const btnVerify = $('bomBtnVerify');
    const btnDispatch = $('bomBtnDispatch');
    const verifyStatus = $('bomVerifyStatus');
    let bomVerified = false;
    function setVerified(isVerified) {
      bomVerified = isVerified;
      if (btnDispatch) btnDispatch.disabled = !isVerified;
      if (verifyStatus) {
        verifyStatus.innerHTML = isVerified
          ? '<i class="fa-solid fa-circle-check" style="color:var(--green);"></i> Verified — ready for dispatch.'
          : '<i class="fa-solid fa-circle-info"></i> Not verified yet — click <b>Verify BOM</b> once every item/quantity above is final. "Create Dispatch" stays locked until then.';
      }
    }

    // Real item master (Masters > Item Registration) drives the Item Name
    // dropdown once the API/DB is reachable; falls back to kit-derived names
    // otherwise (see bomLoadItemMasterNames). Load once, up front.
    await bomLoadItemMasterNames();

    const btnDeleteKit = $('bomBtnDeleteKit');

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
      if (btnDeleteKit) btnDeleteKit.style.display = bomIsCustomKitKey(kitSelect.value) ? '' : 'none';
    }
    populateKitDropdown();

    function refreshItemsPreview() {
      const kit = bomGetAllKits()[kitSelect.value];
      // Deep clone so editing on-screen never mutates the kit catalogue itself.
      currentKitState = kit ? JSON.parse(JSON.stringify(kit.sections)) : null;
      itemsPreview.innerHTML = bomRenderScreenItemsHtml(currentKitState);
      setVerified(false); // changing the kit invalidates any prior verification
      if (btnDeleteKit) btnDeleteKit.style.display = bomIsCustomKitKey(kitSelect.value) ? '' : 'none';
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

    // Live, mutable working copy of the kit being built — same
    // {title, items:[{sr,name,model,qty,remarks}]} shape as any real kit's
    // `sections`, so it saves straight into the same catalogue format.
    let newKitSections = [];

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
        // Pre-fill with the standard section/item format (names only,
        // Model/Quantity/Remarks blank) — the person only needs to fill in
        // values and add/remove items/sections where this kit differs.
        newKitSections = bomDefaultSectionsTemplate();
        newKitLabelInput.value = '';
        newKitKwInput.value = '';
        renderKitBuilderSections();
        kitBuilderPanel.style.display = '';
        kitBuilderPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        newKitLabelInput.focus();
      });
    }
    if (btnCancelKitBuilder) {
      btnCancelKitBuilder.addEventListener('click', () => {
        kitBuilderPanel.style.display = 'none';
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
        // Unique key: slugified name, de-duplicated if that slug is already taken.
        let key = 'custom_' + bomSlugify(label);
        let n = 2;
        while (custom[key] && custom[key].label !== label) {
          key = 'custom_' + bomSlugify(label) + '-' + n;
          n += 1;
        }
        custom[key] = {
          label,
          kw: newKitKwInput.value.trim(),
          sections: sectionsToSave,
        };
        bomSaveCustomKits(custom);

        kitBuilderPanel.style.display = 'none';
        populateKitDropdown(key); // auto-select the newly saved kit
        refreshItemsPreview();
        if (window.showToast) window.showToast('Kit template saved — it now auto-fills from the dropdown.');
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
        return;
      }
      const ii = Number(el.dataset.idx);
      if (!currentKitState[si].items[ii]) return;
      currentKitState[si].items[ii][field] = el.value;
      setVerified(false); // any edit after verifying means it needs re-verifying
    }

    function rerenderItemsPreview() {
      itemsPreview.innerHTML = bomRenderScreenItemsHtml(currentKitState);
      setVerified(false);
    }

    // Delegated click listener: lets a new item be inserted at ANY position
    // within any section (not just appended at the end) — e.g. right after
    // the 5th item in "Solar Structure" — plus removing an item, adding a
    // whole new section, or removing one. Every structural change
    // renumbers Sr No. across the whole kit so it always stays 1,2,3...
    itemsPreview.addEventListener('click', (e) => {
      if (!currentKitState) return;
      const insertBtn = e.target.closest('[data-insert-after-sec]');
      const removeItemBtn = e.target.closest('[data-remove-sec]');
      const addItemBtn = e.target.closest('[data-sec-add-item]');
      const removeSectionBtn = e.target.closest('[data-sec-remove]');
      const addSectionBtn = e.target.closest('#bomBtnAddSectionLive');
      const blankItem = () => ({ sr: '', name: '', model: '', qty: '', remarks: '' });

      if (insertBtn) {
        const si = Number(insertBtn.dataset.insertAfterSec);
        const idx = Number(insertBtn.dataset.insertAfterIdx);
        currentKitState[si].items.splice(idx + 1, 0, blankItem());
      } else if (removeItemBtn) {
        const si = Number(removeItemBtn.dataset.removeSec);
        const idx = Number(removeItemBtn.dataset.removeIdx);
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

    if (btnDispatch) {
      btnDispatch.addEventListener('click', () => {
        if (!bomVerified) return; // belt-and-braces — button is disabled until verified anyway
        // STAGE 1 (front-end only): the real single-dispatch workflow that
        // deducts every kit item from stock at once still needs to be wired
        // to the backend once that full process is described — this just
        // confirms the verify → unlock → dispatch flow end-to-end for now.
        window.openModal(
          'Create Dispatch',
          '<p>This BOM is verified and ready. The actual stock-deduction dispatch workflow will be wired up here once the process is finalized.</p>',
        );
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
        // Measure and apply the fit-to-one-page zoom BEFORE window.print()
        // is called — this is the actual fix (see the long comment above):
        // don't wait for 'beforeprint', do it right here, synchronously.
        computeAndApplyFitZoom();
        window.print();
      });
    }
  },
};
