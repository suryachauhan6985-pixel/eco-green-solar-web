// js/data/purchase-data.js
// Shared in-memory "database" for Purchase Inward + Purchase Register.
// This mirrors what the desktop app's stock_ledger table gives ui/purchase.py
// and ui/registers.py (PurchaseRegisterPage): one purchase invoice can have
// several product lines, each line has its own serial numbers. Purchase
// Register groups rows the same way the desktop SQL GROUP BY does:
// (invoice, date, supplier, category, brand, warehouse).
//
// Loaded once, before any page script, so window.PurchaseData is ready by
// the time purchase.js / purchaseregister.js run their init().
window.PurchaseData = (function () {
  // ---------- seed demo data (same invoices purchaseregister.js used to
  // hardcode, now living in one place so both pages agree on them) ----------
  const invoices = [
    {
      invoiceNo: 'INV-2026-041',
      date: '28-06-2026',
      supplier: 'Sunrise Traders',
      supplierShort: 'SUNRISE',
      supplierMobile: '9825012345',
      supplierGstin: '24AASFS1234R1Z5',
      supplierAddress: 'Plot 12, GIDC, Rajkot',
      pallet: 'PLT-014',
      proofName: 'inv_041_proof.pdf',
      edited: false,
      lines: [
        { cat: 'Solar Panel', brand: 'Waaree', watt: '545', type: 'Mono PERC', warehouse: 'Main NAS Warehouse', qty: 120,
          serials: Array.from({ length: 120 }, (_, i) => 'SN009988' + String(21 + i).padStart(2, '0')) },
      ],
    },
    {
      invoiceNo: 'INV-2026-040',
      date: '25-06-2026',
      supplier: 'Adani Distributors',
      supplierShort: 'ADANI',
      supplierMobile: '9998877665',
      supplierGstin: '24AADCA5678K1Z3',
      supplierAddress: 'Ambavadi Estate, Ahmedabad',
      pallet: 'PLT-013',
      proofName: 'inv_040_proof.pdf',
      edited: true,
      lines: [
        { cat: 'Inverter', brand: 'Adani', watt: '', type: 'On-Grid', warehouse: 'Rajkot Godown', qty: 45,
          serials: Array.from({ length: 45 }, (_, i) => 'SN008877' + String(44 + i).padStart(2, '0')) },
      ],
    },
    {
      invoiceNo: 'INV-2026-039',
      date: '19-06-2026',
      supplier: 'Vikram Energy',
      supplierShort: 'VIKRAM',
      supplierMobile: '9723456781',
      supplierGstin: '24AAVPE4321F1Z9',
      supplierAddress: 'Near Bhaktinagar, Rajkot',
      pallet: 'PLT-012',
      proofName: 'inv_039_proof.pdf',
      edited: false,
      lines: [
        { cat: 'Battery', brand: 'Vikram Solar', watt: '', type: 'Lithium', warehouse: 'Main NAS Warehouse', qty: 60,
          serials: Array.from({ length: 60 }, (_, i) => 'SN007766' + String(33 + i).padStart(2, '0')) },
      ],
    },
    {
      invoiceNo: 'INV-2026-038',
      date: '12-06-2026',
      supplier: 'Sunrise Traders',
      supplierShort: 'SUNRISE',
      supplierMobile: '9825012345',
      supplierGstin: '24AASFS1234R1Z5',
      supplierAddress: 'Plot 12, GIDC, Rajkot',
      pallet: 'PLT-011',
      proofName: 'inv_038_proof.pdf',
      edited: false,
      lines: [
        { cat: 'Solar Panel', brand: 'Waaree', watt: '400', type: 'Bifacial', warehouse: 'Main NAS Warehouse', qty: 30,
          serials: Array.from({ length: 30 }, (_, i) => 'SN006655' + String(10 + i).padStart(2, '0')) },
        { cat: 'Structure', brand: 'Waaree', watt: '', type: 'GI Mount', warehouse: 'Rajkot Godown', qty: 10,
          serials: Array.from({ length: 10 }, (_, i) => 'SN005544' + String(5 + i).padStart(2, '0')) },
      ],
    },
  ];

  // ---------- helpers ----------
  function parseDMY(str) {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(str || ''));
    if (!m) return 0;
    return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
  }
  function dmyFromISO(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}-${m}-${y}`;
  }
  function isoFromDMY(dmy) {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(dmy || ''));
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
  }
  function splitSerials(text) {
    return String(text || '')
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // ---------- read ----------
  function getAll() {
    return invoices;
  }
  function getCategories() {
    const set = new Set();
    invoices.forEach((inv) => inv.lines.forEach((ln) => set.add(ln.cat)));
    return Array.from(set).sort();
  }
  function findByInvoiceNo(invoiceNo) {
    return invoices.find((inv) => inv.invoiceNo === invoiceNo) || null;
  }

  // Mirrors find_purchase_invoice_for_editing(): search by exact Invoice No,
  // OR supplier name / short name containing the term. If several invoices
  // match a name search, load the most recent one only.
  function findForEdit(term) {
    const t = String(term || '').trim();
    if (!t) return null;
    const lower = t.toLowerCase();
    let matches = invoices.filter((inv) => inv.invoiceNo === t);
    if (!matches.length) {
      matches = invoices.filter(
        (inv) => inv.supplier.toLowerCase().includes(lower) || (inv.supplierShort || '').toLowerCase() === lower
      );
    }
    if (!matches.length) return null;
    matches = matches.slice().sort((a, b) => parseDMY(b.date) - parseDMY(a.date));
    return matches[0];
  }

  // Register rows, grouped exactly like the desktop SQL:
  // GROUP BY invoice, date, supplier, category, brand, warehouse
  function registerRows() {
    const rows = [];
    invoices.forEach((inv) => {
      const groups = {};
      inv.lines.forEach((line) => {
        const key = [inv.invoiceNo, inv.date, inv.supplier, line.cat, line.brand, line.warehouse].join('|');
        if (!groups[key]) {
          groups[key] = {
            invoiceNo: inv.invoiceNo, date: inv.date, supplier: inv.supplier,
            category: line.cat, brand: line.brand, warehouse: line.warehouse,
            qty: 0, serials: [], edited: inv.edited,
          };
        }
        groups[key].qty += Number(line.qty) || 0;
        groups[key].serials.push(...(line.serials || []));
      });
      Object.values(groups).forEach((g) => {
        g.firstSerial = g.serials[0] || '-';
        rows.push(g);
      });
    });
    rows.sort((a, b) => parseDMY(b.date) - parseDMY(a.date) || (b.invoiceNo > a.invoiceNo ? 1 : -1));
    return rows;
  }

  // ---------- write ----------
  // Execute Stock Inward: create a brand-new invoice from the entry form.
  function addInvoice(record) {
    invoices.unshift({
      invoiceNo: record.invoiceNo,
      date: record.date,
      supplier: record.supplier,
      supplierShort: record.supplierShort || '',
      supplierMobile: record.supplierMobile || '',
      supplierGstin: record.supplierGstin || '',
      supplierAddress: record.supplierAddress || '',
      pallet: record.pallet || '',
      proofName: record.proofName || '-',
      edited: false,
      lines: record.lines || [],
    });
  }

  // Apply Modifications: overwrite an existing invoice's header + lines,
  // flip edited_flag to Yes — same as the desktop "Edited?" column.
  function applyEdit(originalInvoiceNo, updated) {
    const idx = invoices.findIndex((inv) => inv.invoiceNo === originalInvoiceNo);
    if (idx === -1) return false;
    invoices[idx] = { ...invoices[idx], ...updated, edited: true };
    return true;
  }

  function deleteInvoice(invoiceNo) {
    const idx = invoices.findIndex((inv) => inv.invoiceNo === invoiceNo);
    if (idx === -1) return false;
    invoices.splice(idx, 1);
    return true;
  }

  return {
    getAll, getCategories, findByInvoiceNo, findForEdit, registerRows,
    addInvoice, applyEdit, deleteInvoice,
    parseDMY, dmyFromISO, isoFromDMY, splitSerials,
  };
})();
