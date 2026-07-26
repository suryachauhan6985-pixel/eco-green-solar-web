// js/pages/bom.js
// NEW PAGE: "BOM" — replicates the exact layout of the current Excel BOM
// sheet (Sample_File_for_Residential_550_Wp.xlsx, sheet "3.3 kW") as a
// web page: same header fields (Customer/Order/Installer/Challan/Dealer),
// same kW badge, same 6 columns (Sr No, Item Name, Model, Quantity,
// Checked, Remarks), same category divider rows (Solar Penal, Solar
// Structure, Solar Inverter, Solar Earthing Kit, Solar Wire, BOS), same
// column-width proportions, and a "Print" button that prints ONLY this
// sheet (white background, black text, borders) — nothing else changes
// format-wise.
//
// STAGE 1 (this file): tab + exact-format dummy data + print. No dispatch
// / stock-deduction logic yet — that gets wired in once the full workflow
// (BOM kit sale/dispatch, single dispatch deducting every item from stock
// in one go) is explained and confirmed.
window.PAGES = window.PAGES || {};

// Dummy data — copied 1:1 from the uploaded Excel sample ("3.3 kW" sheet)
// so the on-screen/print format matches exactly.
const BOM_DUMMY = {
  header: {
    customerName: '',
    orderNo: '',
    installerName: '',
    challanNo: '',
    chDate: '',
    fabricatorName: '',
    dealerName: '',
  },
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
};

function bomRenderSheetHtml(data) {
  const h = data.header;
  const rows = data.sections.map((sec) => {
    const catRow = `
      <tr class="bom-cat-row"><td colspan="6">${sec.title}</td></tr>`;
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

  return `
    <div class="bom-sheet" id="bomSheet">
      <table class="bom-table">
        <tr>
          <td colspan="4" class="bom-info-cell"><b>Customer Name:</b> <span contenteditable="true" class="bom-fill">${h.customerName}</span></td>
          <td colspan="2" class="bom-info-cell"><b>Order No -</b> <span contenteditable="true" class="bom-fill">${h.orderNo}</span></td>
        </tr>
        <tr>
          <td colspan="3" class="bom-info-cell"><b>Installer Name :</b> <span contenteditable="true" class="bom-fill">${h.installerName}</span></td>
          <td class="bom-info-cell"><b>Challan No. :</b></td>
          <td class="bom-info-cell"><span contenteditable="true" class="bom-fill">${h.challanNo}</span></td>
          <td class="bom-info-cell"><b>Ch. Date :</b> <span contenteditable="true" class="bom-fill"></span></td>
        </tr>
        <tr>
          <td colspan="3" class="bom-info-cell"><b>Fabricatore Name :</b> <span contenteditable="true" class="bom-fill">${h.fabricatorName}</span></td>
          <td colspan="2" class="bom-info-cell"><b>Dealer Name :</b></td>
          <td class="bom-info-cell"><span contenteditable="true" class="bom-fill">${h.dealerName}</span></td>
        </tr>
        <tr><td colspan="6" class="bom-spacer"></td></tr>
        <tr>
          <td colspan="3" class="bom-kw-cell">${data.kw}</td>
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
  sub: 'Bill of Material — kit-wise item list (same format as Excel)',
  html: `
    <div class="page-head"><i class="fa-solid fa-list-check" style="color:var(--gold);"></i><h2>Bill of Material (BOM)</h2></div>

    <div class="toolbar no-print">
      <div class="field" style="min-width:160px;">
        <label>BOM Kit (dummy)</label>
        <select id="bomKitSelect">
          <option value="3.3">3.3 kW — Residential 550 Wp</option>
        </select>
      </div>
      <button class="btn btn-ghost" type="button" id="bomBtnPrint"><i class="fa-solid fa-print"></i> Print</button>
    </div>

    <div class="panel bom-panel" id="bomPanelWrap">
      ${bomRenderSheetHtml(BOM_DUMMY)}
    </div>

    <p class="note" style="margin-top:10px;">
      Yeh abhi sirf format preview hai (dummy data, "${BOM_DUMMY.kw} kW" sample Excel se). Direct BOM-kit dispatch
      aur ek dispatch mein saare items ek saath stock se deduct karne wala workflow, tumhara pura process
      samjhaane ke baad is tab mein wire kiya jayega.
    </p>
  `,

  init() {
    const $ = (id) => document.getElementById(id);
    const btnPrint = $('bomBtnPrint');
    const sheet = $('bomSheet');

    // Mirrors Excel's "Fit to 1 page" print option: measure the sheet's
    // real height, and if it's taller than one A4 page (10mm margins, same
    // as the @page rule in style.css), shrink it with a CSS transform so
    // it always prints on exactly one page — the print CSS in style.css
    // already tightens fonts/padding to get close; this is the safety net
    // that guarantees it regardless of how many items a kit ends up with.
    function fitSheetToOnePage() {
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

    function resetSheetScale() {
      if (!sheet) return;
      sheet.style.transform = '';
      sheet.style.width = '100%';
    }

    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        fitSheetToOnePage();
        window.print();
      });
    }
    // Undo the print-only scaling once the print dialog closes, so the
    // on-screen view goes back to normal (not shrunk).
    window.addEventListener('afterprint', resetSheetScale);
  },
};
