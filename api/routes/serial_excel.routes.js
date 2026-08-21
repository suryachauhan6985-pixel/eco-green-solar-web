// api/routes/serial_excel.routes.js
// -----------------------------------------------------------------------------
// Scanned Serial Numbers Excel Generation & Network Save Routes
// Generates .xlsx files formatted with:
//   A1: Sr. No.
//   B1: Serial No.
// Saves directly to network share organized by date subfolder & Order/Short Name.
// -----------------------------------------------------------------------------

const { saveSerialExcelToNetwork, buildSerialWorkbook, formatScanDate, sanitizeFileName } = require('../services/serialExcelService');

function registerSerialExcelRoutes(app, deps) {
  const { route, pool } = deps;

  // POST /api/serials/save-excel
  // Body: { orderNo, customerName, shortName, date, serials: [...] }
  app.post('/api/serials/save-excel', route(async (req, res) => {
    const { orderNo, customerName, shortName, date, serials } = req.body || {};
    if (!Array.isArray(serials) || !serials.length) {
      return res.status(400).json({ error: 'serials array with at least 1 serial number is required.' });
    }

    const result = await saveSerialExcelToNetwork({
      orderNo,
      customerName,
      shortName,
      date,
      serials
    });

    res.json(result);
  }));

  // GET /api/serials/download-excel/:orderNo
  // Downloads the serial numbers Excel for a specific order
  app.get('/api/serials/download-excel/:orderNo', route(async (req, res) => {
    const orderNo = req.params.orderNo;
    if (!orderNo) return res.status(400).json({ error: 'orderNo is required' });

    // Query serial numbers for this order from stock_ledger
    const [rows] = await pool.query(
      `SELECT serial_no, customer_name, chalan_date, sales_date
        FROM stock_ledger
        WHERE order_no = ? AND serial_no IS NOT NULL AND serial_no != ''
        ORDER BY id ASC`,
      [orderNo]
    );

    const serials = rows.map((r) => r.serial_no);
    if (!serials.length) {
      return res.status(404).json({ error: `No scanned serial numbers found for Order #${orderNo}` });
    }

    const customerName = rows[0].customer_name || '';
    const date = rows[0].chalan_date || rows[0].sales_date || new Date();
    const cleanOrder = sanitizeFileName(orderNo);
    const cleanCustomer = sanitizeFileName(customerName);
    const fileName = cleanCustomer && cleanCustomer !== '-' ? `${cleanOrder} - ${cleanCustomer}.xlsx` : `${cleanOrder}.xlsx`;

    const workbook = await buildSerialWorkbook(serials);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
  }));
}

module.exports = registerSerialExcelRoutes;
