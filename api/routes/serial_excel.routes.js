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

    const cleanOrder = String(orderNo || '').trim();
    const cleanCust = String(customerName || shortName || '').trim();
    const scanDate = formatScanDate(date);

    // Filter serials to strictly Solar Panels (exclude inverters, batteries, structures, cables)
    let panelSerials = serials;
    try {
      const [stockRows] = await pool.query(
        `SELECT serial_no, category, brand_name, item_name FROM stock_ledger WHERE serial_no IN (?)`,
        [serials]
      );
      if (stockRows && stockRows.length > 0) {
        const panelSet = new Set();
        stockRows.forEach((r) => {
          const cat = String(r.category || '').toUpperCase();
          const item = String(r.item_name || '').toUpperCase();
          const brand = String(r.brand_name || '').toUpperCase();
          const isInv = cat.includes('INVERTER') || item.includes('INVERTER') || brand.includes('POLYCAB') || brand.includes('DEYE') || brand.includes('GROWATT') || brand.includes('SOLIS') || brand.includes('HAVELLS');
          const isOther = cat.includes('STRUCTURE') || cat.includes('WIRE') || cat.includes('CABLE') || cat.includes('BATTERY') || cat.includes('ACDB') || cat.includes('DCDB') || cat.includes('EARTHING');
          if (!isInv && !isOther) {
            panelSet.add(r.serial_no);
          }
        });
        if (panelSet.size > 0) {
          panelSerials = serials.filter((s) => panelSet.has(s));
        }
      }
    } catch (dbErr) {
      console.warn('[SerialExcel] Panel serial filtering warning:', dbErr.message);
    }

    if (!panelSerials.length) {
      return res.json({ success: false, message: 'No Solar Panel serial numbers found to save in Excel.' });
    }

    // 1. Persist to database queue
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS nas_serial_sync_queue (
          id INT AUTO_INCREMENT PRIMARY KEY,
          order_no VARCHAR(100) NOT NULL,
          customer_name VARCHAR(255) DEFAULT '',
          scan_date VARCHAR(50) DEFAULT '',
          serials_json LONGTEXT NOT NULL,
          synced_to_nas TINYINT(1) DEFAULT 0,
          synced_at DATETIME NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(
        `INSERT INTO nas_serial_sync_queue (order_no, customer_name, scan_date, serials_json)
         VALUES (?, ?, ?, ?)`,
        [cleanOrder, cleanCust, scanDate, JSON.stringify(panelSerials)]
      );
    } catch (dbErr) {
      console.warn('[SerialExcel] DB queue insert warning:', dbErr.message);
    }

    // 2. Attempt direct network save
    const result = await saveSerialExcelToNetwork({
      orderNo: cleanOrder,
      customerName: cleanCust,
      shortName: cleanCust || cleanOrder,
      date: scanDate,
      serials: panelSerials
    });

    res.json(result);
  }));

  // GET /api/serials/download-excel/:orderNo
  // Downloads the serial numbers Excel for a specific order
  app.get('/api/serials/download-excel/:orderNo', route(async (req, res) => {
    const orderNo = req.params.orderNo;
    if (!orderNo) return res.status(400).json({ error: 'orderNo is required' });

    // Query Solar Panel serial numbers for this order from stock_ledger (exclude inverters)
    const [rows] = await pool.query(
      `SELECT serial_no, item_name, category, customer_name, chalan_date, sales_date
        FROM stock_ledger
        WHERE order_no = ? AND serial_no IS NOT NULL AND serial_no != ''
          AND (category LIKE '%PANEL%' OR (category NOT LIKE '%INVERTER%' AND item_name NOT LIKE '%INVERTER%' AND item_name NOT LIKE '%DEYE%' AND item_name NOT LIKE '%POLYCAB%' AND item_name NOT LIKE '%GROWATT%' AND item_name NOT LIKE '%SOLIS%'))
        ORDER BY id ASC`,
      [orderNo]
    );

    const serials = rows.map((r) => r.serial_no);
    if (!serials.length) {
      return res.status(404).json({ error: `No Solar Panel serial numbers found for Order #${orderNo}` });
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
