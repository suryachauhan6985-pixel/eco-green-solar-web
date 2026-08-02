// api/routes/challan.js
// -----------------------------------------------------------------------------
// BOM Challan — persisted version of what used to be a client-only print.
//   POST   /api/challan          -> Save (called right before Print)
//   GET    /api/challan          -> register/history list
//   GET    /api/challan/:id      -> single record (for reprint)
//   GET    /api/challan/:id/pdf  -> fills the real Excel template, converts
//                                    to PDF via LibreOffice, streams it back,
//                                    then deletes every temp file it made.
// -----------------------------------------------------------------------------
const { fillTemplateAndConvertToPdf } = require('../services/challanPdf');

module.exports = function registerChallanRoutes(app, deps) {
  const { pool, route } = deps;

  app.post('/api/challan', route(async (req, res) => {
    const b = req.body || {};
    const challanNo = String(b.challanNo || '').trim();
    if (!challanNo) return res.status(400).json({ error: 'Challan No. is required.' });

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
      res.send(pdfBuffer);
    } finally {
      await cleanup();
    }
  }));
};
