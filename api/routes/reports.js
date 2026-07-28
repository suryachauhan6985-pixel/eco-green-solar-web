module.exports = function registerReportsRoutes(app, deps) {
  const { pool, route } = deps;
  // GET /api/reports/master — mirrors ui/reports.py's ReportsPage
  // build_base_query(): every single stock_ledger row, serial-wise, with all
  // 18 columns the desktop Master Report shows, newest first. Optional
  // ?category= filters exactly like the desktop Category dropdown does.
  app.get('/api/reports/master', route(async (req, res) => {
    const category = req.query.category;
    let sql = `SELECT serial_no, brand_name, watt, solar_type, category, pallet_no, warehouse, status,
                      supplier_name, purchase_invoice, purchase_date, customer_name, order_no,
                      sales_invoice, invoice_date, chalan_no, chalan_date, edited_flag
               FROM stock_ledger`;
    const params = [];
    if (category && category !== 'All Categories') { sql += ` WHERE category = ?`; params.push(category); }
    sql += ` ORDER BY id DESC`;

    const [rows] = await pool.query(sql, params);
    const dash = (v) => (v === null || v === undefined || v === '' ? '-' : String(v));
    res.json(rows.map((r) => ({
      serialNo: dash(r.serial_no),
      brand: dash(r.brand_name),
      watt: r.watt ? `${r.watt}W` : '-',
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
    })));
  }));

};
