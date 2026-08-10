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
        COALESCE(SUM(CASE WHEN status='Available' THEN 1 ELSE 0 END),0) AS available,
        COALESCE(SUM(CASE WHEN status='Assigned' THEN 1 ELSE 0 END),0) AS assigned,
        COALESCE(SUM(CASE WHEN status='Sold' THEN 1 ELSE 0 END),0) AS sold,
        COALESCE(SUM(CASE WHEN status='Damaged' THEN 1 ELSE 0 END),0) AS damaged
      FROM stock_ledger
    `);

    const [categorySnapshot] = await pool.query(`
      SELECT i.category AS category,
        COALESCE(SUM(CASE WHEN s.status='Available' THEN 1 ELSE 0 END),0) AS avail,
        COALESCE(SUM(CASE WHEN s.status='Assigned' THEN 1 ELSE 0 END),0) AS assigned,
        COALESCE(SUM(CASE WHEN s.status='Sold' THEN 1 ELSE 0 END),0) AS sold,
        COALESCE(SUM(CASE WHEN s.status='Damaged' THEN 1 ELSE 0 END),0) AS damaged
      FROM items i
      LEFT JOIN stock_ledger s ON s.item_id = i.id
      GROUP BY i.category
      ORDER BY i.category ASC
    `);

    const [[{ lowStockCount }]] = await pool.query(`
      SELECT COUNT(*) AS lowStockCount FROM (
        SELECT i.id, i.minimum_stock,
          COALESCE(SUM(CASE WHEN s.status='Available' THEN 1 ELSE 0 END),0) AS current_stock
        FROM items i
        LEFT JOIN stock_ledger s ON s.item_id = i.id
        WHERE i.minimum_stock > 0
        GROUP BY i.id, i.minimum_stock
        HAVING COALESCE(SUM(CASE WHEN s.status='Available' THEN 1 ELSE 0 END),0) <= i.minimum_stock
      ) t
    `);

    res.json({
      available: totals.available,
      assigned: totals.assigned,
      sold: totals.sold,
      damaged: totals.damaged,
      lowStockCount,
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
             COALESCE(SUM(CASE WHEN s.status='Available' THEN 1 ELSE 0 END),0) AS current_stock
      FROM items i
      LEFT JOIN stock_ledger s ON s.item_id = i.id
      WHERE i.minimum_stock > 0
      GROUP BY i.id, i.brand_name, i.watt, i.solar_type, i.category, i.uom, i.minimum_stock
      HAVING COALESCE(SUM(CASE WHEN s.status='Available' THEN 1 ELSE 0 END),0) <= i.minimum_stock
      ORDER BY (i.minimum_stock - COALESCE(SUM(CASE WHEN s.status='Available' THEN 1 ELSE 0 END),0)) DESC
    `);
    res.json(rows.map((r) => ({
      category: r.category,
      brand: r.brand_name,
      watt: r.watt ? `${r.watt}W` : 'N/A',
      type: r.solar_type || 'Others',
      currentStock: r.current_stock,
      minimumStock: r.minimum_stock,
      uom: r.uom || 'Nos',
    })));
  }));

};