// api/routes/challan.js
// -----------------------------------------------------------------------------
// BOM Challan — persisted version of what used to be a client-only print.
//   POST   /api/challan          -> Save (called right before Print)
//   GET    /api/challan          -> register/history list
//   GET    /api/challan/:id      -> single record (for reprint)
//   GET    /api/challan/:id/pdf  -> fills the real Excel template, converts
//                                    to PDF via LibreOffice, streams it back,
//                                    then deletes every temp file it made.
//   GET    /api/challan/category-map            -> item_name -> Challan
//                                                    category lookup (+ the
//                                                    fixed category list),
//                                                    used by bom.js to
//                                                    auto-compress a BOM's
//                                                    ~53 items down into the
//                                                    Challan's ~14 summary
//                                                    rows instead of the old
//                                                    fully-hand-typed Qty.
//   PUT    /api/challan/category-map             -> bulk save the mapping
//                                                    from the new admin
//                                                    screen (Admin/
//                                                    SuperAdmin only) — pure
//                                                    data, no code deploy
//                                                    needed when item names
//                                                    change.
//
// IMPORTANT - route order: '/category-map' MUST be registered BEFORE
// '/:id' (and '/:id/pdf'). Express's `:id` is a plain string param, NOT
// numeric-only, so a request for GET /api/challan/category-map WILL match
// an earlier-registered GET /api/challan/:id route (with id="category-map")
// instead of ever reaching the category-map handler below. That earlier bug
// made the category-map endpoint unreachable - it always 404'd via the :id
// handler ("Challan not found"), so the frontend's category dropdown stayed
// empty ("0 Challan categories available"). Keep the static route first.
// -----------------------------------------------------------------------------
const { fillTemplateAndConvertToPdf } = require('../services/challanPdf');

// Fixed set of Challan summary rows a BOM item can be filed under — kept in
// one place so both the mapping-editor dropdown and the PUT validation use
// the exact same list. "GI Pipe" is intentionally included even though its
// Qty is computed by a separate hardcoded feet->pieces rule in bom.js (not
// this compress logic) — an item still needs to be tagged "GI Pipe" here so
// it's excluded from every other category's count.
const CHALLAN_CATEGORIES = [
  'Solar Panel', 'GI Structure', 'GI Pipe', 'Bom Box', 'Inverter',
  'Earthing & LA Kit', 'Earthing Bag', 'Wire Box', 'PVC Pipe',
  'Reti Bag', 'Kapchi Bag', 'Cement Bag', 'Ferma',
];

module.exports = function registerChallanRoutes(app, deps) {
  const { pool, route, requireRole } = deps;

  app.post('/api/challan', route(async (req, res) => {
    const b = req.body || {};
    const challanNo = String(b.challanNo || '').trim();
    // if (!challanNo) return res.status(400).json({ error: 'Challan No. is required.' });

    const [result] = await pool.query(
      `INSERT INTO bom_challans
        (challan_no, challan_date, order_no, customer_name, installer_name,
         fabricator_name, dealer_name, capacity_kw, city, vehicle_no, items_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [challanNo, b.challanDate || '', b.orderNo || '', b.customerName || '',
       b.installerName || '', b.fabricatorName || '', b.dealerName || '',
       b.capacityKw || '', b.city || '', b.vehicleNo || '',
       JSON.stringify(b.items || {}), req.user ? req.user.username : null]
    );
    res.json({ success: true, id: result.insertId });
  }));

  app.get('/api/challan', route(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT id, challan_no, challan_date, order_no, customer_name, created_by, created_at
       FROM bom_challans ORDER BY id DESC LIMIT 200`
    );
    res.json(rows);
  }));

  // Auto-generate the next Challan No. — MAX(challan_no)+1 over every
  // already-saved challan whose challan_no happens to be a plain number
  // (older/hand-typed non-numeric challan_no values, if any, are ignored
  // rather than breaking the MAX()). Starts at 1 if none exist yet. Purely
  // a SUGGESTED starting value for the "Convert into Challan" modal's
  // Challan No. field — it stays a normal editable text input, so this
  // never blocks someone from typing over it. MUST be registered before
  // GET '/api/challan/:id' (see route-order note at top of file).
  app.get('/api/challan/next-no', route(async (req, res) => {
    const [[row]] = await pool.query(
      `SELECT MAX(CAST(challan_no AS UNSIGNED)) AS maxNo
       FROM bom_challans
       WHERE challan_no REGEXP '^[0-9]+$'`
    );
    const nextNo = ((row && row.maxNo) || 0) + 1;
    res.json({ nextNo: String(nextNo) });
  }));

  // Returns the fixed category list + every currently-known item_name ->
  // category mapping. MUST be registered before GET '/api/challan/:id'
  // (see route-order note at top of file) — otherwise this never gets hit.
  app.get('/api/challan/category-map', route(async (req, res) => {
    const [rows] = await pool.query(`SELECT item_name, challan_category FROM challan_category_map`);
    const map = {};
    rows.forEach((r) => { map[r.item_name] = r.challan_category; });
    res.json({ categories: CHALLAN_CATEGORIES, map });
  }));

  // Bulk save from the mapping-editor screen. Body: { mappings: [{ itemName, category }, ...] }.
  // Admin/SuperAdmin only — this reassigns which Challan line an item's
  // quantity feeds into, same trust level as editing Item Master.
  app.put('/api/challan/category-map', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const mappings = Array.isArray(req.body && req.body.mappings) ? req.body.mappings : [];
    for (const m of mappings) {
      const itemName = String(m && m.itemName || '').trim();
      const category = String(m && m.category || '').trim();
      if (!itemName) continue;
      if (!category) {
        // Blank selection = "unmapped" — remove any existing row rather than
        // storing an empty category (compress logic just treats a missing
        // row as unmapped/skip, same end result either way).
        await pool.query(`DELETE FROM challan_category_map WHERE item_name=?`, [itemName]);
        continue;
      }
      if (!CHALLAN_CATEGORIES.includes(category)) continue; // ignore unknown categories, don't 500 the whole batch
      await pool.query(
        `INSERT INTO challan_category_map (item_name, challan_category, updated_by)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE challan_category = VALUES(challan_category), updated_by = VALUES(updated_by)`,
        [itemName, category, req.user ? req.user.username : null]
      );
    }
    res.json({ success: true });
  }));

  // Single record (for reprint). Registered AFTER '/category-map' so the
  // static route above always wins that match.
  app.get('/api/challan/:id', route(async (req, res) => {
    const [[row]] = await pool.query(`SELECT * FROM bom_challans WHERE id=?`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Challan not found.' });
    res.json({ ...row, items: JSON.parse(row.items_json || '{}') });
  }));

  app.get('/api/challan/:id/pdf', route(async (req, res) => {
    const [[row]] = await pool.query(`SELECT * FROM bom_challans WHERE id=?`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Challan not found.' });
    const record = { ...row, items: JSON.parse(row.items_json || '{}') };

    const { pdfBuffer, cleanup } = await fillTemplateAndConvertToPdf(record);
    try {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Challan_${row.challan_no}.pdf"`);
      // Without this, browsers (esp. installed PWAs) may heuristically cache
      // this GET response and keep re-serving an old/blank PDF for the same
      // challan id even after the record's data changes.
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.send(pdfBuffer);
    } finally {
      await cleanup();
    }
  }));
};