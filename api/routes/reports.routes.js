module.exports = function registerReportsRoutes(app, deps) {
  const { pool, route, reportCache } = deps;

  // GET /api/reports/master — High-Speed Master Inventory Report with query caching & pagination
  app.get('/api/reports/master', route(async (req, res) => {
    const category = req.query.category;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = req.query.all === 'true' ? 5000 : Math.min(1000, Math.max(10, parseInt(req.query.limit) || 200));
    const offset = (page - 1) * limit;

    const cacheKey = `reports:master:${category || 'all'}:${page}:${limit}`;
    const result = await reportCache.wrap(cacheKey, async () => {
      let sql = `SELECT sl.id, sl.serial_no, sl.brand_name, sl.watt, sl.solar_type, sl.category, sl.pallet_no, sl.warehouse, sl.status,
                        sl.supplier_name, sl.purchase_invoice, sl.purchase_date, sl.customer_name, sl.order_no,
                        sl.sales_invoice, sl.invoice_date, sl.chalan_no, sl.chalan_date, sl.edited_flag, sl.quantity,
                        COALESCE(it.uom, 'Nos') AS uom
                 FROM stock_ledger sl
                 LEFT JOIN items it ON sl.item_id = it.id`;
      const params = [];
      if (category && category !== 'All Categories') {
        sql += ` WHERE sl.category = ?`;
        params.push(category);
      }
      sql += ` ORDER BY sl.id DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const [rows] = await pool.query(sql, params);
      const dash = (v) => (v === null || v === undefined || v === '' || String(v).toLowerCase() === 'null' ? '-' : String(v));
      
      return rows.map((r) => {
        const serial = (r.serial_no && String(r.serial_no).trim() !== '' && String(r.serial_no).toLowerCase() !== 'null') ? String(r.serial_no) : '-';
        const watt = (Number(r.watt) > 0) ? `${Number(r.watt)}W` : '-';
        const qty = (r.quantity != null && Number(r.quantity) > 0) ? Number(r.quantity) : 1;
        return {
          id: r.id,
          serialNo: serial,
          brand: dash(r.brand_name),
          watt: watt,
          qty: qty,
          uom: r.uom || 'Nos',
          solarType: dash(r.solar_type),
          category: dash(r.category),
          palletNo: dash(r.pallet_no),
          warehouse: dash(r.warehouse),
          status: dash(r.status),
          supplier: dash(r.supplier_name),
          purchaseInvoice: dash(r.purchase_invoice),
          purchaseDate: dash(r.purchase_date),
          customer: dash(r.customer_name),
          orderNo: dash(r.order_no),
          salesInvoice: dash(r.sales_invoice),
          invoiceDate: dash(r.invoice_date),
          chalanNo: dash(r.chalan_no),
          chalanDate: dash(r.chalan_date),
          edited: r.edited_flag ? 'Yes' : 'No',
        };
      });
    }, 45000);

    res.json(result);
  }));

};
