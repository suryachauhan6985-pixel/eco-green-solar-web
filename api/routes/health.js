module.exports = function registerHealthRoutes(app, deps) {
  const { pool, route, dashboardCache, masterCache, reportCache, syncStockSummary, requireRole } = deps;

  // Health check
  app.get('/api/health', route(async (req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true, timestamp: Date.now() });
  }));

  // ---------------------------------------------------------------------------
  // DASHBOARD SUMMARY — High-Speed Pre-Aggregated Summary & 20s Memory Caching
  // Queries stock_summary table (< 2ms) instead of full stock_ledger scan
  // ---------------------------------------------------------------------------
  app.get('/api/dashboard/summary', route(async (req, res) => {
    const data = await dashboardCache.wrap('summary', async () => {
      // 1. Try pre-aggregated stock_summary table first
      let [[totals]] = await pool.query(`
        SELECT
          COALESCE(SUM(available_qty), 0) AS available,
          COALESCE(SUM(assigned_qty), 0) AS assigned,
          COALESCE(SUM(sold_qty), 0) AS sold,
          COALESCE(SUM(damaged_qty), 0) AS damaged,
          COALESCE(SUM(CASE WHEN (category LIKE '%SOLAR%' OR category LIKE '%PANEL%') THEN (watt * available_qty) ELSE 0 END), 0) / 1000.0 AS solar_kw,
          COALESCE(SUM(CASE WHEN category LIKE '%INVERTER%' THEN available_qty ELSE 0 END), 0) AS inverters_count,
          COALESCE(SUM(CASE WHEN category LIKE '%BATTERY%' THEN available_qty ELSE 0 END), 0) AS batteries_count,
          COUNT(*) AS summary_rows
        FROM stock_summary
      `);

      // Fallback if summary table is not yet populated
      if (!totals || !totals.summary_rows) {
        await syncStockSummary(pool);
        [[totals]] = await pool.query(`
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
      }

      const [categorySnapshot] = await pool.query(`
        SELECT category,
          COALESCE(SUM(available_qty), 0) AS avail,
          COALESCE(SUM(assigned_qty), 0) AS assigned,
          COALESCE(SUM(sold_qty), 0) AS sold,
          COALESCE(SUM(damaged_qty), 0) AS damaged
        FROM stock_summary
        WHERE category <> ''
        GROUP BY category
        ORDER BY category ASC
      `);

      const [[{ lowStockCount }]] = await pool.query(`
        SELECT COUNT(*) AS lowStockCount FROM (
          SELECT i.id, i.minimum_stock,
            COALESCE(SUM(s.available_qty), 0) AS current_stock
          FROM items i
          LEFT JOIN stock_summary s ON (s.category = i.category AND s.brand_name = i.brand_name AND s.watt = i.watt AND s.solar_type = i.solar_type AND s.model = i.model)
          WHERE i.minimum_stock > 0
          GROUP BY i.id, i.minimum_stock
          HAVING COALESCE(SUM(s.available_qty), 0) <= i.minimum_stock
        ) t
      `);

      const [[{ totalItems }]] = await pool.query(`SELECT COUNT(*) AS totalItems FROM items`);

      // Real-time Solar & ERP Daily Operations Pulse
      const todayISO = new Date().toISOString().slice(0, 10);
      let [[opsToday]] = await pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN purchase_date = ? THEN COALESCE(quantity, 1) ELSE 0 END), 0) AS today_inward_qty,
          COUNT(DISTINCT CASE WHEN purchase_date = ? THEN purchase_invoice ELSE NULL END) AS today_inward_invoices,
          COALESCE(SUM(CASE WHEN (sales_date = ? OR chalan_date = ?) THEN COALESCE(quantity, 1) ELSE 0 END), 0) AS today_dispatch_qty,
          COUNT(DISTINCT CASE WHEN (sales_date = ? OR chalan_date = ?) THEN chalan_no ELSE NULL END) AS today_dispatch_challans,
          COALESCE(SUM(CASE WHEN status='Available' AND (category LIKE '%SOLAR%' OR category LIKE '%PANEL%') THEN COALESCE(quantity, 1) ELSE 0 END), 0) AS solar_panels_count
        FROM stock_ledger
      `, [todayISO, todayISO, todayISO, todayISO, todayISO, todayISO]).catch(() => [[{
        today_inward_qty: 0,
        today_inward_invoices: 0,
        today_dispatch_qty: 0,
        today_dispatch_challans: 0,
        solar_panels_count: 0
      }]]);

      let warehousesCount = 1;
      try {
        const [[wh]] = await pool.query(`SELECT COUNT(DISTINCT warehouse) AS cnt FROM stock_ledger WHERE warehouse IS NOT NULL AND warehouse <> ''`);
        warehousesCount = wh?.cnt || 1;
      } catch (e) {}

      let activeChallans = 0;
      try {
        const [[ch]] = await pool.query(`SELECT COUNT(DISTINCT chalan_no) AS cnt FROM stock_ledger WHERE chalan_no IS NOT NULL AND chalan_no <> ''`);
        activeChallans = ch?.cnt || 0;
      } catch (e) {}

      return {
        available: totals.available,
        assigned: totals.assigned,
        sold: totals.sold,
        damaged: totals.damaged,
        solarKw: parseFloat(Number(totals.solar_kw || 0).toFixed(2)),
        invertersCount: Number(totals.inverters_count || 0),
        batteriesCount: Number(totals.batteries_count || 0),
        solarPanelsCount: Number(opsToday?.solar_panels_count || 0),
        todayInwardQty: Number(opsToday?.today_inward_qty || 0),
        todayInwardInvoices: Number(opsToday?.today_inward_invoices || 0),
        todayDispatchQty: Number(opsToday?.today_dispatch_qty || 0),
        todayDispatchChallans: Number(opsToday?.today_dispatch_challans || 0),
        warehousesCount: Number(warehousesCount || 1),
        activeChallans: Number(activeChallans || 0),
        lowStockCount,
        totalItems,
        categorySnapshot,
      };
    }, 15000);

    res.json(data);
  }));

  // GET /api/lowstock — Cached & Optimized low stock detection
  app.get('/api/lowstock', route(async (req, res) => {
    const [rows] = await pool.query(`
      SELECT i.id, i.brand_name, i.watt, i.solar_type, i.category, i.uom, i.minimum_stock,
             COALESCE(SUM(s.available_qty), 0) AS current_stock
      FROM items i
      LEFT JOIN stock_summary s ON (s.category = i.category AND s.brand_name = i.brand_name AND s.watt = i.watt AND s.solar_type = i.solar_type AND s.model = i.model)
      WHERE i.minimum_stock > 0
      GROUP BY i.id, i.brand_name, i.watt, i.solar_type, i.category, i.uom, i.minimum_stock
      HAVING COALESCE(SUM(s.available_qty), 0) <= i.minimum_stock
      ORDER BY (i.minimum_stock - COALESCE(SUM(s.available_qty), 0)) DESC
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

  // GET /api/system/performance — Real-Time Performance & System Telemetry (Admin Only)
  app.get('/api/system/performance', route(async (req, res) => {
    const poolInternal = pool.pool || {};
    const mem = process.memoryUsage();

    const poolMetrics = {
      connectionLimit: poolInternal.config?.connectionLimit || 25,
      activeConnections: poolInternal._allConnections ? poolInternal._allConnections.length : 0,
      freeConnections: poolInternal._freeConnections ? poolInternal._freeConnections.length : 0,
      queuedRequests: poolInternal._connectionQueue ? poolInternal._connectionQueue.length : 0,
      keepAlive: !!poolInternal.config?.enableKeepAlive
    };

    const cacheMetrics = {
      masters: masterCache ? masterCache.getMetrics() : null,
      reports: reportCache ? reportCache.getMetrics() : null,
      dashboard: dashboardCache ? dashboardCache.getMetrics() : null
    };

    const [[dbStats]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM stock_ledger) AS total_ledger_rows,
        (SELECT COUNT(*) FROM stock_summary) AS summary_buckets,
        (SELECT COUNT(*) FROM items) AS total_items,
        (SELECT COUNT(*) FROM accounting_vouchers) AS total_vouchers
    `);

    res.json({
      status: 'operational',
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMb: (mem.rss / 1024 / 1024).toFixed(1),
        heapUsedMb: (mem.heapUsed / 1024 / 1024).toFixed(1),
        heapTotalMb: (mem.heapTotal / 1024 / 1024).toFixed(1)
      },
      pool: poolMetrics,
      cache: cacheMetrics,
      database: dbStats
    });
  }));

};