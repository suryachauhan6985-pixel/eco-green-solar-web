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

// ---------- On-screen items preview (normal dark-theme table, NOT the Excel look) ----------
function bomRenderScreenItemsHtml(kit) {
  if (!kit) return '<div class="empty">Select a BOM Kit above to load its item list.</div>';
  const rows = kit.sections.map((sec) => {
    const catRow = `<tr class="bom-screen-cat"><td colspan="5">${sec.title}</td></tr>`;
    const itemRows = sec.items.map((it) => `
      <tr>
        <td>${it.sr}</td>
        <td>${it.name}</td>
        <td>${it.model || '—'}</td>
        <td>${it.qty}</td>
        <td>${it.remarks || '—'}</td>
      </tr>`).join('');
    return catRow + itemRows;
  }).join('');

  return `
    <div class="table-wrap">
      <table>
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

  const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `
    <div class="bom-sheet" id="bomSheet">
      <table class="bom-table">
        <tr>
          <td colspan="4" class="bom-info-cell"><b>Customer Name:</b> ${esc(h.customerName)}</td>
          <td colspan="2" class="bom-info-cell"><b>Order No -</b> ${esc(h.orderNo)}</td>
        </tr>
        <tr>
          <td colspan="3" class="bom-info-cell"><b>Installer Name :</b> ${esc(h.installerName)}</td>
          <td class="bom-info-cell"><b>Challan No. :</b> ${esc(h.challanNo)}</td>
          <td class="bom-info-cell"><b>Ch. Date :</b> ${esc(h.challanDate)}</td>
        </tr>
        <tr>
          <td colspan="3" class="bom-info-cell"><b>Fabricatore Name :</b> ${esc(h.fabricatorName)}</td>
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

  init() {
    const $ = (id) => document.getElementById(id);
    const kitSelect = $('bomKitSelect');
    const itemsPreview = $('bomItemsPreview');
    const btnPrint = $('bomBtnPrint');
    const printRoot = $('bomPrintRoot');

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
      itemsPreview.innerHTML = bomRenderScreenItemsHtml(kit);
    }
    kitSelect.addEventListener('change', refreshItemsPreview);
    refreshItemsPreview();

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

    // Mirrors Excel's "Fit to 1 page" print option: measure the sheet's
    // real height, and if it's taller than one A4 page (10mm margins, same
    // as the @page rule in style.css), shrink it with a CSS transform so
    // it always prints on exactly one page — the print CSS in style.css
    // already tightens fonts/padding to get close; this is the safety net
    // that guarantees it regardless of how many items a kit ends up with.
    function fitSheetToOnePage() {
      const sheet = $('bomSheet');
      if (!sheet) return;
      sheet.style.transform = '';
      sheet.style.width = '100%';
      const A4_HEIGHT_MM = 297;
      const MARGIN_MM = 10; // must match @page margin in style.css
      const PX_PER_MM = 96 / 25.4;
      const usablePx = (A4_HEIGHT_MM - MARGIN_MM * 2) * PX_PER_MM;
      const naturalPx = sheet.scrollHeight;
      if (naturalPx > usablePx) {
        const scale = usablePx / naturalPx;
        sheet.style.transform = `scale(${scale})`;
        sheet.style.width = `${100 / scale}%`;
      }
    }

    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        const kit = BOM_KITS[kitSelect.value];
        if (!kit) {
          window.openModal('Select a Kit', '<p>Please select a BOM Kit before printing.</p>');
          return;
        }
        printRoot.innerHTML = bomRenderPrintSheetHtml(kit, getHeaderValues());
        fitSheetToOnePage();
        window.print();
      });
    }
  },
};
