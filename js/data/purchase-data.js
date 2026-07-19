// js/data/purchase-data.js
// -----------------------------------------------------------------------------
// Pure date/serial helper functions shared by js/pages/purchase.js and
// js/pages/purchaseregister.js. This file used to also hold an in-memory
// mock "database" of purchase invoices (window.PurchaseData.invoices) that
// the Purchase Inward / Purchase Register pages read and wrote instead of
// talking to the real backend. That mock is gone now — Purchase Inward
// saves/finds/edits/deletes invoices through window.Api against
// /api/purchase/* (see server.js), and Purchase Register loads its rows from
// /api/purchase/register. Only the small stateless helpers below remain,
// since both pages still need the same date/serial parsing rules the
// desktop app uses.
// -----------------------------------------------------------------------------
window.PurchaseData = (function () {
  // dd-mm-yyyy -> timestamp, for sorting/date-range filtering (0 if invalid).
  function parseDMY(str) {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(str || ''));
    if (!m) return 0;
    return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
  }
  // <input type="date"> gives yyyy-mm-dd; the backend/desktop app stores
  // dd-mm-yyyy everywhere, so every save/edit converts through this pair.
  function dmyFromISO(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}-${m}-${y}`;
  }
  function isoFromDMY(dmy) {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(dmy || ''));
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
  }
  // Basic comma/newline split, used where the stricter multi-delimiter
  // splitSerials() in purchase.js itself isn't already in scope.
  function splitSerials(text) {
    return String(text || '')
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return { parseDMY, dmyFromISO, isoFromDMY, splitSerials };
})();