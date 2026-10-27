// api/routes/bom_kits.routes.js
// -----------------------------------------------------------------------------
// BOM Kit Templates — persisted version of what used to live ONLY in the
// browser's localStorage (js/pages/bom-kit-helpers.js's old bomLoadCustomKits/
// bomSaveCustomKits). That meant a kit created/edited on one device never
// showed up on any other device or browser, even under the same login,
// because localStorage never leaves the browser it was written in.
//
// Kit templates are shared, org-wide catalogue data (like the Challan
// category map) — NOT scoped per-user — so every logged-in user sees the
// exact same kit list, and creating/editing one is Admin/SuperAdmin only,
// same gate the frontend already enforces for "New Kit" / "Edit Kit" /
// "Delete Kit".
//
//   GET    /api/bom/kits         -> { [kitKey]: { label, kw, sections } }
//   PUT    /api/bom/kits/:key    -> create or update ONE kit template
//                                    (Admin/SuperAdmin only)
//   DELETE /api/bom/kits/:key    -> remove ONE kit template
//                                    (Admin/SuperAdmin only)
//
// `:key` is always a "custom_..." slug minted client-side by bomSlugify()
// — validated here too so nothing can be saved under a key that would
// collide with a future built-in kit key.
// -----------------------------------------------------------------------------
module.exports = function registerBomKitsRoutes(app, deps) {
  const { pool, route, requireRole } = deps;

  function isValidKitKey(key) {
    return typeof key === 'string' && /^custom_[a-z0-9-]+$/.test(key);
  }

  app.get('/api/bom/kits', route(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT kit_key, label, kw, sections_json FROM bom_kit_templates ORDER BY label ASC`
    );
    const kits = {};
    rows.forEach((r) => {
      let sections = [];
      try { sections = JSON.parse(r.sections_json || '[]'); } catch (e) { sections = []; }
      kits[r.kit_key] = { label: r.label, kw: r.kw || '', sections };
    });
    res.json(kits);
  }));

  app.put('/api/bom/kits/:key', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const key = String(req.params.key || '').trim();
    if (!isValidKitKey(key)) return res.status(400).json({ error: 'Invalid kit key.' });

    const label = String((req.body && req.body.label) || '').trim();
    const kw = String((req.body && req.body.kw) || '').trim();
    const sections = Array.isArray(req.body && req.body.sections) ? req.body.sections : [];
    if (!label) return res.status(400).json({ error: 'Kit Name is required.' });
    if (!sections.length) return res.status(400).json({ error: 'Add at least one item with a name before saving the template.' });

    const username = req.user ? req.user.username : null;
    await pool.query(
      `INSERT INTO bom_kit_templates (kit_key, label, kw, sections_json, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         label = VALUES(label),
         kw = VALUES(kw),
         sections_json = VALUES(sections_json),
         updated_by = VALUES(updated_by)`,
      [key, label, kw, JSON.stringify(sections), username, username]
    );
    res.json({ success: true, key, kit: { label, kw, sections } });
  }));

  app.delete('/api/bom/kits/:key', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const key = String(req.params.key || '').trim();
    const [result] = await pool.query(`DELETE FROM bom_kit_templates WHERE kit_key=?`, [key]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Kit template not found.' });
    res.json({ success: true });
  }));
};
