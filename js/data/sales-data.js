// js/data/sales-data.js
// -----------------------------------------------------------------------------
// This file used to hold an in-memory mock "database" of sales challans
// (window.SalesData.getAll() / addChallan()) that Sale Register read from
// instead of talking to the real backend — which is why Sale Register used
// to render empty (this file was never even <script>-included in
// index.html). That mock is gone now: Project Sales (js/pages/sales.js)
// saves/finds/edits/deletes sales challans through window.Api against
// /api/sales/* (see server.js), and Sale Register
// (js/pages/saleregister.js) loads its rows live from /api/sales/register.
// Nothing in the Sales module reads window.SalesData any more, so this file
// is intentionally left empty/retired — kept only so any old reference to
// it fails loudly instead of silently falling back to fake data.
// -----------------------------------------------------------------------------
window.SalesData = null;