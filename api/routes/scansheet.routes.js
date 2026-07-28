// api/routes/scansheet.js
// -----------------------------------------------------------------------------
// "SCAN To Sheet" persistence — moved from browser localStorage (js/data/
// sheets-store.js) to the shared MariaDB database, so a user's sheets/rows
// survive logout+login and are available from any browser/device.
// Sheets are scoped to the logged-in user (req.user.username, set by
// middleware/auth.js) — every route below filters/writes by created_by so one
// user can never see or edit another user's scan sheets.
// -----------------------------------------------------------------------------
module.exports = function registerScanSheetRoutes(app, deps) {
  const { pool, route } = deps;

  function mapSheet(row) {
    return {
      id: row.id,
      name: row.name,
      columns: JSON.parse(row.columns_json || '[]'),
      createdAt: row.created_at,
    };
  }
  function mapEntry(row) {
    return {
      id: row.id,
      sno: row.sno,
      values: JSON.parse(row.values_json || '{}'),
      createdAt: row.created_at,
    };
  }
  async function findOwnedSheet(id, username) {
    const [rows] = await pool.query(`SELECT id FROM scan_sheets WHERE id = ? AND created_by = ?`, [id, username]);
    return rows[0] || null;
  }

  // List every sheet belonging to the logged-in user
  app.get('/api/scansheet/sheets', route(async (req, res) => {
    const [rows] = await pool.query(`SELECT * FROM scan_sheets WHERE created_by = ? ORDER BY created_at DESC`, [req.user.username]);
    res.json(rows.map(mapSheet));
  }));

  // Create a sheet
  app.post('/api/scansheet/sheets', route(async (req, res) => {
    const { id, name, columns } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'Sheet id and name are required.' });
    await pool.query(
      `INSERT INTO scan_sheets (id, name, columns_json, created_by) VALUES (?, ?, ?, ?)`,
      [id, name, JSON.stringify(columns || []), req.user.username]
    );
    res.json({ success: true });
  }));

  // Update a sheet's name/columns
  app.put('/api/scansheet/sheets/:id', route(async (req, res) => {
    const { id } = req.params;
    const { name, columns } = req.body;
    const owned = await findOwnedSheet(id, req.user.username);
    if (!owned) return res.status(404).json({ error: 'Sheet not found.' });
    const fields = [];
    const params = [];
    if (name !== undefined) { fields.push('name = ?'); params.push(name); }
    if (columns !== undefined) { fields.push('columns_json = ?'); params.push(JSON.stringify(columns)); }
    if (!fields.length) return res.json({ success: true });
    params.push(id, req.user.username);
    await pool.query(`UPDATE scan_sheets SET ${fields.join(', ')} WHERE id = ? AND created_by = ?`, params);
    res.json({ success: true });
  }));

  // Delete a sheet (its rows go with it via ON DELETE CASCADE)
  app.delete('/api/scansheet/sheets/:id', route(async (req, res) => {
    const { id } = req.params;
    const [result] = await pool.query(`DELETE FROM scan_sheets WHERE id = ? AND created_by = ?`, [id, req.user.username]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Sheet not found.' });
    res.json({ success: true });
  }));

  // List rows for a sheet
  app.get('/api/scansheet/sheets/:id/entries', route(async (req, res) => {
    const { id } = req.params;
    const owned = await findOwnedSheet(id, req.user.username);
    if (!owned) return res.status(404).json({ error: 'Sheet not found.' });
    const [rows] = await pool.query(`SELECT * FROM scan_sheet_entries WHERE sheet_id = ? ORDER BY sno ASC`, [id]);
    res.json(rows.map(mapEntry));
  }));

  // Add a row
  app.post('/api/scansheet/sheets/:id/entries', route(async (req, res) => {
    const { id } = req.params;
    const { entryId, sno, values } = req.body;
    if (!entryId) return res.status(400).json({ error: 'entryId is required.' });
    const owned = await findOwnedSheet(id, req.user.username);
    if (!owned) return res.status(404).json({ error: 'Sheet not found.' });
    await pool.query(
      `INSERT INTO scan_sheet_entries (id, sheet_id, sno, values_json) VALUES (?, ?, ?, ?)`,
      [entryId, id, sno || 0, JSON.stringify(values || {})]
    );
    res.json({ success: true });
  }));

  // Renumber rows (kept in sync with the S.No column after a delete)
  app.put('/api/scansheet/sheets/:id/entries/renumber', route(async (req, res) => {
    const { id } = req.params;
    const { order } = req.body; // [{ id, sno }, ...]
    const owned = await findOwnedSheet(id, req.user.username);
    if (!owned) return res.status(404).json({ error: 'Sheet not found.' });
    for (const item of (order || [])) {
      await pool.query(`UPDATE scan_sheet_entries SET sno = ? WHERE id = ? AND sheet_id = ?`, [item.sno, item.id, id]);
    }
    res.json({ success: true });
  }));

  // Delete a single row
  app.delete('/api/scansheet/sheets/:id/entries/:entryId', route(async (req, res) => {
    const { id, entryId } = req.params;
    const owned = await findOwnedSheet(id, req.user.username);
    if (!owned) return res.status(404).json({ error: 'Sheet not found.' });
    await pool.query(`DELETE FROM scan_sheet_entries WHERE id = ? AND sheet_id = ?`, [entryId, id]);
    res.json({ success: true });
  }));

  // Clear every row in a sheet
  app.delete('/api/scansheet/sheets/:id/entries', route(async (req, res) => {
    const { id } = req.params;
    const owned = await findOwnedSheet(id, req.user.username);
    if (!owned) return res.status(404).json({ error: 'Sheet not found.' });
    await pool.query(`DELETE FROM scan_sheet_entries WHERE sheet_id = ?`, [id]);
    res.json({ success: true });
  }));
};
