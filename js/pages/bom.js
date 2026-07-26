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
// `currentKitState`, which is what actually gets printed.
function bomRenderScreenItemsHtml(state) {
  if (!state) return '<div class="empty">Select a BOM Kit above to load its item list.</div>';
  const rows = state.map((sec, si) => {
    const catRow = `<tr class="bom-screen-cat"><td colspan="5">${bomEsc(sec.title)}</td></tr>`;
    const itemRows = sec.items.map((it, ii) => `
      <tr>
        <td><input type="text" class="bom-field-input bom-field-sr" data-sec="${si}" data-idx="${ii}" data-field="sr" value="${bomEscAttr(it.sr)}"></td>
        <td><select class="bom-field-input bom-field-name" data-sec="${si}" data-idx="${ii}" data-field="name">${bomBuildItemOptionsHtml(it.name)}</select></td>
        <td><input type="text" class="bom-field-input" data-sec="${si}" data-idx="${ii}" data-field="model" value="${bomEscAttr(it.model)}"></td>
        <td><input type="text" class="bom-field-input" data-sec="${si}" data-idx="${ii}" data-field="qty" value="${bomEscAttr(it.qty)}"></td>
        <td><input type="text" class="bom-field-input" data-sec="${si}" data-idx="${ii}" data-field="remarks" value="${bomEscAttr(it.remarks)}"></td>
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
          <select id="bomKitSelect">
            <option value="">-- Select Kit --</option>
          </select>
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

    // Populate the single kW dropdown from BOM_KITS.
    Object.keys(BOM_KITS).forEach((key) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = BOM_KITS[key].label;
      kitSelect.appendChild(opt);
    });
    // Only one kit exists right now — auto-select it so the preview isn't empty.
    const kitKeys = Object.keys(BOM_KITS);
    if (kitKeys.length === 1) kitSelect.value = kitKeys[0];

    function refreshItemsPreview() {
      const kit = BOM_KITS[kitSelect.value];
      // Deep clone so editing on-screen never mutates the BOM_KITS catalogue itself.
      currentKitState = kit ? JSON.parse(JSON.stringify(kit.sections)) : null;
      itemsPreview.innerHTML = bomRenderScreenItemsHtml(currentKitState);
      setVerified(false); // changing the kit invalidates any prior verification
    }
    kitSelect.addEventListener('change', refreshItemsPreview);
    refreshItemsPreview();

    // Delegated listener: every field (item dropdown, model/qty/remarks
    // inputs, sr) carries data-sec/data-idx/data-field, so one listener on
    // the container catches edits to all rows across kit re-renders and
    // writes them straight into currentKitState — nothing needs to be
    // retyped for the parts that stay the same.
    itemsPreview.addEventListener('input', handleItemFieldEdit);
    itemsPreview.addEventListener('change', handleItemFieldEdit);
    function handleItemFieldEdit(e) {
      const el = e.target.closest('[data-field]');
      if (!el) return;
      const si = Number(el.dataset.sec);
      const ii = Number(el.dataset.idx);
      const field = el.dataset.field;
      if (!currentKitState || !currentKitState[si] || !currentKitState[si].items[ii]) return;
      currentKitState[si].items[ii][field] = el.value;
      setVerified(false); // any edit after verifying means it needs re-verifying
    }

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
    function computeAndApplyFitZoom() {
      const sheet = $('bomSheet');
      if (!sheet || !printRoot) return;
      sheet.style.transform = '';
      sheet.style.width = '';
      sheet.style.zoom = 1; // measure the sheet's true, un-scaled height first
      printRoot.classList.add('bom-measuring');
      const naturalHeightPx = sheet.getBoundingClientRect().height;
      printRoot.classList.remove('bom-measuring');

      const A4_HEIGHT_MM = 297;
      // Must match the @page top+bottom margin in style.css (19.05mm =
      // 0.75in each, same as the workbook's real Page Setup margins).
      const MARGIN_MM = 19.05;
      const PX_PER_MM = 96 / 25.4;
      // SAFETY_MARGIN: scaling to *exactly* fill the usable page height
      // leaves zero headroom — on a real printer (different default
      // paper size picked by the OS print dialog, a substitute font if
      // Calibri isn't installed, sub-pixel rounding once `zoom` is
      // applied, etc.) the sheet could still end up a few px taller than
      // the page and spill onto a 2nd page. Scaling to 96% of the usable
      // height on purpose leaves enough slack that those real-world
      // variations can no longer push it over.
      const SAFETY_MARGIN = 0.96;
      const usablePx = (A4_HEIGHT_MM - MARGIN_MM * 2) * PX_PER_MM * SAFETY_MARGIN;

      if (!naturalHeightPx) return; // nothing rendered yet — nothing to scale
      // Never scale UP past 1 — a short BOM (few items) should print at its
      // natural 11pt size, matching Excel, not be stretched to fill the page.
      const scale = Math.min(1, usablePx / naturalHeightPx);
      const supportsZoom = window.CSS && CSS.supports && CSS.supports('zoom', '1');
      if (supportsZoom) {
        sheet.style.zoom = scale;
      } else {
        sheet.style.zoom = '';
        sheet.style.transform = `scale(${scale})`;
        sheet.style.width = '850px';
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
        const kw = BOM_KITS[kitSelect.value].kw;
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
