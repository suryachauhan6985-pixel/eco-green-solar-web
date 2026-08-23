module.exports = function registerReportsRoutes(app, deps) {
  const { pool, route } = deps;
  // GET /api/reports/master — mirrors ui/reports.py's ReportsPage
  // build_base_query(): every single stock_ledger row, serial-wise, with all
  // 18 columns the desktop Master Report shows, newest first. Optional
  // ?category= filters exactly like the desktop Category dropdown does.
  app.get('/api/reports/master', route(async (req, res) => {
    const category = req.query.category;
    let sql = `SELECT sl.id, sl.serial_no, sl.brand_name, sl.watt, sl.solar_type, sl.category, sl.pallet_no, sl.warehouse, sl.status,
                      sl.supplier_name, sl.purchase_invoice, sl.purchase_date, sl.customer_name, sl.order_no,
                      sl.sales_invoice, sl.invoice_date, sl.chalan_no, sl.chalan_date, sl.edited_flag, sl.quantity,
                      COALESCE(it.uom, 'Nos') AS uom
               FROM stock_ledger sl
               LEFT JOIN items it ON sl.item_id = it.id`;
    const params = [];
    if (category && category !== 'All Categories') { sql += ` WHERE sl.category = ?`; params.push(category); }
    sql += ` ORDER BY sl.id DESC`;

    const [rows] = await pool.query(sql, params);
    const dash = (v) => (v === null || v === undefined || v === '' || String(v).toLowerCase() === 'null' ? '-' : String(v));
    res.json(rows.map((r) => {
      const serial = (r.serial_no && String(r.serial_no).trim() !== '' && String(r.serial_no).toLowerCase() !== 'null') ? String(r.serial_no) : '-';
      const watt = (Number(r.watt) > 0) ? `${Number(r.watt)}W` : '-';
      const qty = (r.quantity != null && Number(r.quantity) > 0) ? Number(r.quantity) : 1;
      return {
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
    }));
  }));

};
