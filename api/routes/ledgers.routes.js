module.exports = function registerLedgersRoutes(app, deps) {
  const { pool, route, requireRole, ledgerTimestamp } = deps;
  // LEDGERS (Supplier / Customer master) — mirrors db.py's
  // search_ledgers_for_autocomplete() / find_ledger_by_shortname() /
  // find_ledger_by_name_or_shortname() from the desktop app. Used for the live
  // autocomplete + auto-fill on the Purchase (Supplier) form, and reusable for
  // Sales (Customer) the same way.
  //   GET /api/ledgers?type=Supplier&q=sur   -> up to 25 matches while typing
  //   GET /api/ledgers?type=Supplier         -> full list (q omitted/empty)
  // ---------------------------------------------------------------------------
  app.get('/api/ledgers', route(async (req, res) => {
    const q = (req.query.q || '').trim();
    const type = req.query.type && req.query.type !== 'All' ? req.query.type : null;

    let sql = `SELECT id, ledger_name, short_name, ledger_type, mobile, address, gstin FROM ledgers`;
    const params = [];
    const where = [];

    if (q) {
      where.push(`(ledger_name LIKE ? OR short_name LIKE ?)`);
      params.push(`%${q}%`, `%${q}%`);
    }
    if (type) {
      where.push(`(ledger_type = ? OR ledger_type = 'Both')`);
      params.push(type);
    }
    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    sql += ` ORDER BY ledger_name ASC LIMIT ${q ? 25 : 200}`;

    const [rows] = await pool.query(sql, params);
    res.json(rows.map((r) => ({
      id: r.id,
      name: r.ledger_name,
      short: r.short_name,
      type: r.ledger_type,
      mobile: r.mobile,
      address: r.address,
      gstin: r.gstin,
    })));
  }));

  // ---------------------------------------------------------------------------
  // SUPPLIER/CUSTOMER SHORT CODE LOOKUP — used by the Purchase (and Sales)
  // "Short Code" field autocomplete. Mirrors the desktop app's
  // attach_ledger_shortname_lookup(), which builds its suggestion list ONLY
  // from ledgers.short_name (never ledger_name). The combined /api/ledgers
  // endpoint above matches ledger_name OR short_name together, which is fine
  // for the Supplier Name field, but for the Short Code field it let ledgers
  // that only matched by NAME (with a blank short_name) crowd out the ones
  // that actually had a matching short code — so only one supplier's short
  // code (e.g. "DSP") was ever suggested, even though many suppliers exist.
  //   GET /api/ledgers/shortcodes?type=Supplier&q=ds   -> up to 25 matches
  //   GET /api/ledgers/shortcodes?type=Supplier        -> full list (q omitted)
  // ---------------------------------------------------------------------------
  app.get('/api/ledgers/shortcodes', route(async (req, res) => {
    const q = (req.query.q || '').trim();
    const type = req.query.type && req.query.type !== 'All' ? req.query.type : null;

    let sql = `SELECT id, ledger_name, short_name, ledger_type, mobile, address, gstin FROM ledgers WHERE short_name IS NOT NULL AND short_name <> ''`;
    const params = [];

    if (q) { sql += ` AND short_name LIKE ?`; params.push(`%${q}%`); }
    if (type) { sql += ` AND (ledger_type = ? OR ledger_type = 'Both')`; params.push(type); }
    sql += ` ORDER BY short_name ASC LIMIT ${q ? 25 : 200}`;

    const [rows] = await pool.query(sql, params);
    res.json(rows.map((r) => ({
      id: r.id,
      name: r.ledger_name,
      short: r.short_name,
      type: r.ledger_type,
      mobile: r.mobile,
      address: r.address,
      gstin: r.gstin,
    })));
  }));

  // ---------------------------------------------------------------------------
  // PARTY LEDGER — mirrors ui/party_ledger.py + database/db.py exactly:
  //   GET    /api/ledgers/directory   -> reload_party_list()
  //   POST   /api/ledgers             -> add_new_ledger()
  //   PUT    /api/ledgers/:id         -> update_existing_ledger()
  //   DELETE /api/ledgers/:id         -> delete_ledger()
  //   GET    /api/ledgers/statement   -> PartyStatementDialog.load_statement_data()
  // ---------------------------------------------------------------------------

  async function ledgerExists(name, short, excludeId) {
    const params = [name.toLowerCase(), (short || '').toLowerCase()];
    let sql = `SELECT id FROM ledgers WHERE LOWER(ledger_name)=? AND LOWER(COALESCE(short_name,''))=?`;
    if (excludeId != null) { sql += ` AND id != ?`; params.push(excludeId); }
    sql += ` LIMIT 1`;
    const [rows] = await pool.query(sql, params);
    return rows.length > 0;
  }

  app.get('/api/ledgers/directory', route(async (req, res) => {
    const search = (req.query.search || '').trim().toLowerCase();
    const typeChoice = req.query.type || 'All Parties';

    const [ledgerRows] = await pool.query(
      `SELECT id, ledger_name, short_name, ledger_type, mobile, address, gstin FROM ledgers ORDER BY ledger_name ASC`
    );

    const partyMap = new Map();
    const registeredNames = new Set();

    ledgerRows.forEach((r) => {
      const shortLabel = String(r.short_name || '').trim();
      partyMap.set(`ledger:${r.id}`, {
        displayName: shortLabel ? `${r.ledger_name}  [${shortLabel}]` : r.ledger_name,
        partyName: r.ledger_name,
        shortName: shortLabel,
        type: r.ledger_type,
        ledgerId: r.id,
        mobile: r.mobile,
        address: r.address,
        gstin: r.gstin,
      });
      registeredNames.add(String(r.ledger_name).trim());
    });

    if (typeChoice === 'All Parties' || typeChoice === 'Suppliers Only') {
      const [rows] = await pool.query(
        `SELECT DISTINCT supplier_name FROM stock_ledger WHERE supplier_name IS NOT NULL AND supplier_name != '-' AND supplier_name != ''`
      );
      rows.forEach((r) => {
        const nm = r.supplier_name;
        if (!registeredNames.has(nm)) {
          partyMap.set(`legacy:${nm}`, { displayName: nm, partyName: nm, shortName: '', type: 'Supplier', ledgerId: null, mobile: '-', address: '-', gstin: '-' });
        }
      });
    }

    if (typeChoice === 'All Parties' || typeChoice === 'Customers Only') {
      const [rows] = await pool.query(
        `SELECT DISTINCT customer_name FROM stock_ledger WHERE customer_name IS NOT NULL AND customer_name != '-' AND customer_name != ''`
      );
      rows.forEach((r) => {
        const nm = r.customer_name;
        const key = `legacy:${nm}`;
        if (!registeredNames.has(nm) && !partyMap.has(key)) {
          partyMap.set(key, { displayName: nm, partyName: nm, shortName: '', type: 'Customer', ledgerId: null, mobile: '-', address: '-', gstin: '-' });
        } else if (partyMap.has(key) && partyMap.get(key).type === 'Supplier') {
          partyMap.get(key).type = 'Both';
        }
      });
    }

    let filtered = Array.from(partyMap.values()).filter((p) => {
      if (typeChoice === 'Suppliers Only' && !['Supplier', 'Both'].includes(p.type)) return false;
      if (typeChoice === 'Customers Only' && !['Customer', 'Both'].includes(p.type)) return false;
      if (typeChoice === 'Dealers Only' && p.type !== 'Dealer') return false;
      if (typeChoice === 'Installers Only' && p.type !== 'Installer') return false;
      if (typeChoice === 'Fabricators Only' && p.type !== 'Fabricator') return false;
      return true;
    });

    if (search) {
      filtered = filtered.filter((p) =>
        (p.displayName || '').toLowerCase().includes(search) ||
        (p.partyName || '').toLowerCase().includes(search) ||
        (p.shortName || '').toLowerCase().includes(search) ||
        (p.mobile || '').toLowerCase().includes(search) ||
        (p.address || '').toLowerCase().includes(search) ||
        (p.gstin || '').toLowerCase().includes(search)
      );
    }

    filtered.sort((a, b) => a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase()));
    res.json(filtered);
  }));

  app.post('/api/ledgers', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const short = String(req.body.short || '').trim();
    const type = req.body.type || 'Both';
    const mobile = String(req.body.mobile || '').trim() || '-';
    const address = String(req.body.address || '').trim() || '-';
    const gstin = String(req.body.gstin || '').trim() || '-';

    if (!name) return res.status(400).json({ error: 'Ledger Name cannot be empty.' });
    if (await ledgerExists(name, short)) return res.status(400).json({ error: `Ledger '${name}' already exists.` });

    await pool.query(
      `INSERT INTO ledgers (ledger_name, short_name, ledger_type, mobile, address, gstin, created_on) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, short, type, mobile, address, gstin, ledgerTimestamp()]
    );
    res.json({ success: true });
  }));

  app.put('/api/ledgers/:id', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const { id } = req.params;
    const name = String(req.body.name || '').trim();
    const short = String(req.body.short || '').trim();
    const type = req.body.type || 'Both';
    const mobile = String(req.body.mobile || '').trim() || '-';
    const address = String(req.body.address || '').trim() || '-';
    const gstin = String(req.body.gstin || '').trim() || '-';

    if (!name) return res.status(400).json({ error: 'Ledger Name cannot be empty.' });
    if (await ledgerExists(name, short, Number(id))) return res.status(400).json({ error: `Ledger '${name}' already exists.` });

    const [result] = await pool.query(
      `UPDATE ledgers SET ledger_name=?, short_name=?, ledger_type=?, mobile=?, address=?, gstin=? WHERE id=?`,
      [name, short, type, mobile, address, gstin, id]
    );
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Ledger not found.' });
    res.json({ success: true });
  }));

  app.delete('/api/ledgers/:id', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const { id } = req.params;
    const [result] = await pool.query(`DELETE FROM ledgers WHERE id=?`, [id]);
    if (result.affectedRows === 0) return res.status(400).json({ error: 'Ledger not found.' });
    res.json({ success: true });
  }));

  app.get('/api/ledgers/statement', route(async (req, res) => {
    const name = (req.query.name || '').trim();
    const resolvedType = req.query.type || 'Both';
    if (!name) return res.status(400).json({ error: 'Party name required' });

    const rows = [];

    if (resolvedType === 'Supplier' || resolvedType === 'Both') {
      const [inRows] = await pool.query(
        `SELECT sl.purchase_date, sl.serial_no, sl.item_name, sl.category, sl.purchase_invoice, sl.warehouse, sl.status, sl.purchase_attachment, sl.quantity, COALESCE(it.uom, 'Nos') AS uom
         FROM stock_ledger sl
         LEFT JOIN items it ON sl.item_id = it.id
         WHERE sl.supplier_name=?
         ORDER BY STR_TO_DATE(sl.purchase_date, '%d-%m-%Y') DESC, sl.id DESC`,
        [name]
      );
      inRows.forEach((r) => {
        const refKey = r.purchase_invoice && String(r.purchase_invoice) !== '-' ? String(r.purchase_invoice) : '-';
        const serial = (r.serial_no && String(r.serial_no).trim() !== '' && String(r.serial_no).toLowerCase() !== 'null') ? String(r.serial_no) : null;
        rows.push({
          movement: 'IN',
          date: r.purchase_date,
          serial_no: serial,
          quantity: Number(r.quantity) || 1,
          uom: r.uom || 'Nos',
          item_name: r.item_name,
          category: r.category,
          warehouse: r.warehouse,
          status: r.status,
          proof: r.purchase_attachment,
          purchase_invoice: r.purchase_invoice,
          chalan_no: null,
          sales_invoice: null,
          order_no: null,
          ref_key: refKey,
        });
      });
    }

    if (resolvedType === 'Customer' || resolvedType === 'Both') {
      const [outRows] = await pool.query(
        `SELECT sl.sales_date, sl.chalan_date, sl.serial_no, sl.item_name, sl.category, sl.order_no, sl.warehouse, sl.status, sl.sales_attachment, sl.chalan_no, sl.sales_invoice, sl.quantity, COALESCE(it.uom, 'Nos') AS uom
         FROM stock_ledger sl
         LEFT JOIN items it ON sl.item_id = it.id
         WHERE sl.customer_name=? AND (sl.status='Sold' OR sl.status='Dispatched' OR sl.bom_dispatch_id IS NOT NULL)
         ORDER BY COALESCE(STR_TO_DATE(sl.sales_date, '%d-%m-%Y'), STR_TO_DATE(sl.chalan_date, '%d-%m-%Y')) DESC, sl.id DESC`,
        [name]
      );
      outRows.forEach((r) => {
        let refKey = '-';
        for (const candidate of [r.chalan_no, r.order_no, r.sales_invoice]) {
          if (candidate && String(candidate) !== '-' && String(candidate) !== '') { refKey = String(candidate); break; }
        }
        const serial = (r.serial_no && String(r.serial_no).trim() !== '' && String(r.serial_no).toLowerCase() !== 'null') ? String(r.serial_no) : null;
        rows.push({
          movement: 'OUT',
          date: r.sales_date || r.chalan_date || '-',
          serial_no: serial,
          quantity: Number(r.quantity) || 1,
          uom: r.uom || 'Nos',
          item_name: r.item_name,
          category: r.category,
          warehouse: r.warehouse,
          status: r.status,
          proof: r.sales_attachment,
          purchase_invoice: null,
          chalan_no: r.chalan_no,
          sales_invoice: r.sales_invoice,
          order_no: r.order_no,
          ref_key: refKey,
        });
      });
    }

    res.json({ rows });
  }));

};
