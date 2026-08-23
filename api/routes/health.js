module.exports = function registerHealthRoutes(app, deps) {
  const { pool, route } = deps;
  const SESSION_STALE_SECONDS = 40;

  // Health check
  app.get('/api/health', route(async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  }));

  // ---------------------------------------------------------------------------
  // DASHBOARD — real live numbers from stock_ledger + items (same MariaDB
  // the desktop .py app uses). Matches ui/dashboard.py's counting logic
  // (per-status counts + get_low_stock_items()).
  // ---------------------------------------------------------------------------
  app.get('/api/dashboard/summary', route(async (req, res) => {
    const [[totals]] = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN status='Available' THEN COALESCE(quantity, 1) ELSE 0 END),0) AS available,
        COALESCE(SUM(CASE WHEN status='Assigned' THEN COALESCE(quantity, 1) ELSE 0 END),0) AS assigned,
        COALESCE(SUM(CASE WHEN status='Sold' THEN COALESCE(quantity, 1) ELSE 0 END),0) AS sold,
        COALESCE(SUM(CASE WHEN status='Damaged' THEN COALESCE(quantity, 1) ELSE 0 END),0) AS damaged,
        COALESCE(SUM(CASE WHEN status='Available' AND (category LIKE '%SOLAR%' OR category LIKE '%PANEL%') THEN (COALESCE(watt, 0) * COALESCE(quantity, 1)) ELSE 0 END),0) / 1000.0 AS solar_kw,
        COALESCE(SUM(CASE WHEN status='Available' AND category LIKE '%INVERTER%' THEN COALESCE(quantity, 1) ELSE 0 END),0) AS inverters_count,
        COALESCE(SUM(CASE WHEN status='Available' AND category LIKE '%BATTERY%' THEN COALESCE(quantity, 1) ELSE 0 END),0) AS batteries_count
      FROM stock_ledger
    `);

    const [categorySnapshot] = await pool.query(`
      SELECT i.category AS category,
        COALESCE(SUM(CASE WHEN s.status='Available' THEN COALESCE(s.quantity, 1) ELSE 0 END),0) AS avail,
        COALESCE(SUM(CASE WHEN s.status='Assigned' THEN COALESCE(s.quantity, 1) ELSE 0 END),0) AS assigned,
        COALESCE(SUM(CASE WHEN s.status='Sold' THEN COALESCE(s.quantity, 1) ELSE 0 END),0) AS sold,
        COALESCE(SUM(CASE WHEN s.status='Damaged' THEN COALESCE(s.quantity, 1) ELSE 0 END),0) AS damaged
      FROM items i
      LEFT JOIN stock_ledger s ON s.item_id = i.id
      GROUP BY i.category
      ORDER BY i.category ASC
    `);

    const [[{ lowStockCount }]] = await pool.query(`
      SELECT COUNT(*) AS lowStockCount FROM (
        SELECT i.id, i.minimum_stock,
          COALESCE(SUM(CASE WHEN s.status='Available' THEN COALESCE(s.quantity, 1) ELSE 0 END),0) AS current_stock
        FROM items i
        LEFT JOIN stock_ledger s ON s.item_id = i.id
        WHERE i.minimum_stock > 0
        GROUP BY i.id, i.minimum_stock
        HAVING COALESCE(SUM(CASE WHEN s.status='Available' THEN COALESCE(s.quantity, 1) ELSE 0 END),0) <= i.minimum_stock
      ) t
    `);

    const [[{ totalItems }]] = await pool.query(`SELECT COUNT(*) AS totalItems FROM items`);

    res.json({
      available: totals.available,
      assigned: totals.assigned,
      sold: totals.sold,
      damaged: totals.damaged,
      solarKw: parseFloat(Number(totals.solar_kw || 0).toFixed(2)),
      invertersCount: Number(totals.inverters_count || 0),
      batteriesCount: Number(totals.batteries_count || 0),
      lowStockCount,
      totalItems,
      categorySnapshot,
    });
  }));

  // GET /api/lowstock — mirrors ui/low_stock.py's LowStockPage.load_data(),
  // which calls database/db.py's get_low_stock_items() exactly: every item
  // master whose minimum_stock is set (>0) AND whose current 'Available'
  // count has dropped to/under that minimum, worst-shortfall first.
  app.get('/api/lowstock', route(async (req, res) => {
    const [rows] = await pool.query(`
      SELECT i.id, i.brand_name, i.watt, i.solar_type, i.category, i.uom, i.minimum_stock,
             COALESCE(SUM(CASE WHEN s.status='Available' THEN COALESCE(s.quantity, 1) ELSE 0 END),0) AS current_stock
      FROM items i
      LEFT JOIN stock_ledger s ON s.item_id = i.id
      WHERE i.minimum_stock > 0
      GROUP BY i.id, i.brand_name, i.watt, i.solar_type, i.category, i.uom, i.minimum_stock
      HAVING COALESCE(SUM(CASE WHEN s.status='Available' THEN COALESCE(s.quantity, 1) ELSE 0 END),0) <= i.minimum_stock
      ORDER BY (i.minimum_stock - COALESCE(SUM(CASE WHEN s.status='Available' THEN COALESCE(s.quantity, 1) ELSE 0 END),0)) DESC
    `);
    res.json(rows.map((r) => ({
      category: r.category,
      brand: r.brand_name,
      watt: (Number(r.watt) > 0) ? `${Number(r.watt)}W` : '-',
      type: r.solar_type || '-',
      currentStock: Number(r.current_stock) || 0,
      minimumStock: Number(r.minimum_stock) || 0,
      uom: r.uom || 'Nos',
    })));
  }));

};