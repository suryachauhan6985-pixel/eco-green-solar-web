// api/routes/challan.js
// -----------------------------------------------------------------------------
// BOM Challan — persisted version of what used to be a client-only print.
//   POST   /api/challan          -> Save (called right before Print)
//                                   Also auto-writes a Panel Serials Excel
//                                   to the NAS folder when panelSerials[] is
//                                   present in the body.
//   GET    /api/challan          -> register/history list
//   GET    /api/challan/:id      -> single record (for reprint)
//   GET    /api/challan/:id/pdf  -> fills the real Excel template, converts
//                                    to PDF via LibreOffice, streams it back,
//                                    then deletes every temp file it made.
//   GET    /api/challan/category-map            -> item_name -> Challan
//                                                    category lookup (+ the
//                                                    fixed category list),
//                                                    used by bom.js to
//                                                    auto-compress a BOM's
//                                                    ~53 items down into the
//                                                    Challan's ~14 summary
//                                                    rows instead of the old
//                                                    fully-hand-typed Qty.
//   PUT    /api/challan/category-map             -> bulk save the mapping
//                                                    from the new admin
//                                                    screen (Admin/
//                                                    SuperAdmin only) — pure
//                                                    data, no code deploy
//                                                    needed when item names
//                                                    change.
//
// IMPORTANT - route order: '/category-map' MUST be registered BEFORE
// '/:id' (and '/:id/pdf'). Express's `:id` is a plain string param, NOT
// numeric-only, so a request for GET /api/challan/category-map WILL match
// an earlier-registered GET /api/challan/:id route (with id="category-map")
// instead of ever reaching the category-map handler below. That earlier bug
// made the category-map endpoint unreachable - it always 404'd via the :id
// handler ("Challan not found"), so the frontend's category dropdown stayed
// empty ("0 Challan categories available"). Keep the static route first.
// -----------------------------------------------------------------------------
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const ExcelJS = require('exceljs');
const { fillTemplateAndConvertToPdf } = require('../services/challanPdf');

// Fixed set of Challan summary rows a BOM item can be filed under — kept in
// one place so both the mapping-editor dropdown and the PUT validation use
// the exact same list. "GI Pipe" is intentionally included even though its
// Qty is computed by a separate hardcoded feet->pieces rule in bom.js (not
// this compress logic) — an item still needs to be tagged "GI Pipe" here so
// it's excluded from every other category's count.
const CHALLAN_CATEGORIES = [
  'Solar Panel', 'GI Structure', 'GI Pipe', 'Bom Box', 'Inverter',
  'Earthing & LA Kit', 'Earthing Bag', 'Wire Box', 'PVC Pipe',
  'Reti Bag', 'Kapchi Bag', 'Cement Bag', 'Ferma',
];

// NAS root (same machine path used by backup.routes.js). Override with
// BACKUP_NAS_PATH if the server runs elsewhere.
const NAS_ROOT = process.env.BACKUP_NAS_PATH
  || '\\\\As6302t-989d\\work\\2023-24\\Solar Rooftop\\NP - Site Visit, 3D\\SUMIT\\Solar_ERP_DB';
const PANEL_SERIALS_FOLDER = 'SERAIL NO. (ORD. & CHLN)';

// Sanitize a folder/file name so Windows path separators / reserved chars
// cannot escape the target directory.
function safePathSegment(raw) {
  return String(raw || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120) || 'UNKNOWN';
}

// Pick a non-colliding .xlsx filename inside `dir` (async).
async function uniqueXlsxPath(dir, baseName) {
  const clean = safePathSegment(baseName).replace(/\.xlsx$/i, '');
  let candidate = path.join(dir, `${clean}.xlsx`);
  try {
    await fsp.access(candidate);
  } catch (e) {
    return candidate; // file does not exist, safe to use
  }
  for (let n = 1; n < 1000; n += 1) {
    candidate = path.join(dir, `${clean} (${n}).xlsx`);
    try {
      await fsp.access(candidate);
    } catch (e) {
      return candidate;
    }
  }
  return path.join(dir, `${clean}_${Date.now()}.xlsx`);
}

// Build + write the Panel Serials Excel (completely async & non-blocking).
async function writePanelSerialsExcel({ orderNo, challanNo, serials }) {
  const list = Array.isArray(serials)
    ? serials.map((s) => String(s || '').trim()).filter(Boolean)
    : [];
  if (!list.length) return { ok: false, skipped: true, reason: 'no serials' };

  const folderKey = safePathSegment(orderNo || challanNo || 'NO_ORDER');
  const baseName = challanNo
    ? `Panel_Serials_Challan_${safePathSegment(challanNo)}`
    : 'Panel_Serials';

  // Default to local folder for instant reliability, attempt NAS in background
  const localRoot = path.join(__dirname, '..', 'Panel_Serials_Local');
  const localDir = path.join(localRoot, folderKey);
  await fsp.mkdir(localDir, { recursive: true });

  const filePath = await uniqueXlsxPath(localDir, baseName);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Panel Serials');
  sheet.getCell('A1').value = 'SR. NO.';
  sheet.getCell('B1').value = 'SERIAL NO.';
  sheet.getCell('A1').font = { bold: true };
  sheet.getCell('B1').font = { bold: true };
  list.forEach((serial, idx) => {
    sheet.getCell(`A${idx + 2}`).value = idx + 1;
    sheet.getCell(`B${idx + 2}`).value = serial;
  });
  sheet.getColumn(1).width = 12;
  sheet.getColumn(2).width = 36;
  await workbook.xlsx.writeFile(filePath);

  // Optional background copy to NAS if configured
  if (process.env.BACKUP_NAS_PATH) {
    setImmediate(async () => {
      try {
        const nasDir = path.join(process.env.BACKUP_NAS_PATH, PANEL_SERIALS_FOLDER, folderKey);
        await fsp.mkdir(nasDir, { recursive: true });
        const nasFilePath = path.join(nasDir, path.basename(filePath));
        await fsp.copyFile(filePath, nasFilePath);
        console.log(`[Challan] Panel serials copied to NAS: ${nasFilePath}`);
      } catch (err) {
        // NAS copy warning (does not affect local save)
      }
    });
  }

  return {
    ok: true,
    filePath,
    fileName: path.basename(filePath),
    folder: folderKey,
    onNas: false,
    count: list.length,
  };
}

module.exports = function registerChallanRoutes(app, deps) {
  const { pool, route, requireRole } = deps;

  const pdfCache = new Map();
  function getCachedPdf(key) {
    const it = pdfCache.get(key);
    if (!it) return null;
    if (Date.now() - it.time > 15 * 60 * 1000) {
      pdfCache.delete(key);
      return null;
    }
    return it.buffer;
  }
  function setCachedPdf(key, buffer) {
    if (pdfCache.size > 150) {
      const first = pdfCache.keys().next().value;
      pdfCache.delete(first);
    }
    pdfCache.set(key, { buffer, time: Date.now() });
  }
  function invalidatePdfCache(id, challanNo) {
    if (id) pdfCache.delete(`id_${id}`);
    if (challanNo) pdfCache.delete(`no_${challanNo}`);
  }

  app.post('/api/challan', route(async (req, res) => {
    const b = req.body || {};
    const challanNo = String(b.challanNo || '').trim();
    const orderNo = String(b.orderNo || '').trim();
    const v1 = String(b.vehicleNo || '').trim();
    const v2 = String(b.vehicleNo2 || '').trim();
    const vehicleCombined = [v1, v2].filter(Boolean).join(' / ');

    const [result] = await pool.query(
      `INSERT INTO bom_challans
        (challan_no, challan_date, order_no, customer_name, installer_name,
         fabricator_name, dealer_name, capacity_kw, city, vehicle_no, items_json, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [challanNo, b.challanDate || '', orderNo, b.customerName || '',
       b.installerName || '', b.fabricatorName || '', b.dealerName || '',
       b.capacityKw || '', b.city || '', vehicleCombined,
       JSON.stringify(b.items || {}), req.user ? req.user.username : null]
    );

    invalidatePdfCache(result.insertId, challanNo);

    // Auto-generate Panel Serials Excel in detached background task
    const serials = Array.isArray(b.panelSerials) ? b.panelSerials : [];
    if (serials.length) {
      setImmediate(() => {
        writePanelSerialsExcel({ orderNo, challanNo, serials })
          .then((resInfo) => {
            if (resInfo && resInfo.ok) {
              console.log(`[Challan] Panel serials saved (${resInfo.count}): ${resInfo.filePath}`);
            }
          })
          .catch((err) => {
            console.warn('[Challan] Panel serials background write error:', err.message);
          });
      });
    }

    res.json({
      success: true,
      id: result.insertId,
    });
  }));

  app.get('/api/challan', route(async (req, res) => {
    const [rows] = await pool.query(
      `SELECT id, challan_no, challan_date, order_no, customer_name, vehicle_no, capacity_kw, city,
              installer_name, fabricator_name, dealer_name, created_by, created_at
       FROM bom_challans ORDER BY id DESC LIMIT 500`
    );
    res.json(rows);
  }));

  // Specific routes MUST come before generic '/:id' routes
  app.get('/api/challan/next-no', route(async (req, res) => {
    const [[row]] = await pool.query(
      `SELECT MAX(CAST(challan_no AS UNSIGNED)) AS maxNo
       FROM bom_challans
       WHERE challan_no REGEXP '^[0-9]+$'`
    );
    const nextNo = ((row && row.maxNo) || 0) + 1;
    res.json({ nextNo: String(nextNo) });
  }));

  app.get('/api/challan/category-map', route(async (req, res) => {
    const [rows] = await pool.query(`SELECT item_name, challan_category FROM challan_category_map`);
    const map = {};
    rows.forEach((r) => { map[r.item_name] = r.challan_category; });
    res.json({ categories: CHALLAN_CATEGORIES, map });
  }));

  app.put('/api/challan/category-map', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const mappings = Array.isArray(req.body && req.body.mappings) ? req.body.mappings : [];
    for (const m of mappings) {
      const itemName = String(m && m.itemName || '').trim();
      const category = String(m && m.category || '').trim();
      if (!itemName) continue;
      if (!category) {
        await pool.query(`DELETE FROM challan_category_map WHERE item_name=?`, [itemName]);
        continue;
      }
      if (!CHALLAN_CATEGORIES.includes(category)) continue;
      await pool.query(
        `INSERT INTO challan_category_map (item_name, challan_category, updated_by)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE challan_category = VALUES(challan_category), updated_by = VALUES(updated_by)`,
        [itemName, category, req.user ? req.user.username : null]
      );
    }
    res.json({ success: true });
  }));

  app.get('/api/challan/by-no/:challanNo', route(async (req, res) => {
    const [[row]] = await pool.query(
      `SELECT * FROM bom_challans WHERE challan_no = ? ORDER BY id DESC LIMIT 1`,
      [req.params.challanNo]
    );
    if (!row) return res.status(404).json({ error: 'Challan not found.' });
    res.json({ ...row, items: JSON.parse(row.items_json || '{}') });
  }));

  app.get('/api/challan/by-no/:challanNo/pdf', route(async (req, res) => {
    const cKey = `no_${req.params.challanNo}`;
    const cached = getCachedPdf(cKey);
    if (cached) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Challan_${req.params.challanNo}.pdf"`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.send(cached);
    }

    const [[row]] = await pool.query(
      `SELECT * FROM bom_challans WHERE challan_no = ? ORDER BY id DESC LIMIT 1`,
      [req.params.challanNo]
    );
    if (!row) return res.status(404).json({ error: 'Challan not found.' });
    const record = { ...row, items: JSON.parse(row.items_json || '{}') };
    const { pdfBuffer, cleanup } = await fillTemplateAndConvertToPdf(record);
    try {
      setCachedPdf(cKey, pdfBuffer);
      if (row.id) setCachedPdf(`id_${row.id}`, pdfBuffer);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Challan_${row.challan_no}.pdf"`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.send(pdfBuffer);
    } finally {
      await cleanup();
    }
  }));

  // Generic parameterized ':id' routes
  app.delete('/api/challan/:id', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const id = req.params.id;
    const [[existing]] = await pool.query(`SELECT challan_no, customer_name FROM bom_challans WHERE id=?`, [id]);
    if (!existing) return res.status(404).json({ error: 'Challan not found.' });

    await pool.query(`DELETE FROM bom_challans WHERE id=?`, [id]);
    invalidatePdfCache(id, existing.challan_no);
    res.json({ success: true, message: `Challan #${existing.challan_no} deleted.` });
  }));

  app.put('/api/challan/:id', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const id = req.params.id;
    const b = req.body || {};
    const challanNo = String(b.challanNo || '').trim();
    const orderNo = String(b.orderNo || '').trim();
    const v1 = String(b.vehicleNo || '').trim();
    const v2 = String(b.vehicleNo2 || '').trim();
    const vehicleCombined = [v1, v2].filter(Boolean).join(' / ');

    const [[existing]] = await pool.query(`SELECT id, challan_no FROM bom_challans WHERE id=?`, [id]);
    if (!existing) return res.status(404).json({ error: 'Challan record not found.' });

    await pool.query(
      `UPDATE bom_challans
       SET challan_no=?, challan_date=?, order_no=?, customer_name=?, installer_name=?,
           fabricator_name=?, dealer_name=?, capacity_kw=?, city=?, vehicle_no=?, items_json=?
       WHERE id=?`,
      [challanNo, b.challanDate || '', orderNo, b.customerName || '',
       b.installerName || '', b.fabricatorName || '', b.dealerName || '',
       b.capacityKw || '', b.city || '', vehicleCombined,
       JSON.stringify(b.items || {}), id]
    );

    invalidatePdfCache(id, challanNo);
    if (existing.challan_no !== challanNo) invalidatePdfCache(id, existing.challan_no);

    res.json({
      success: true,
      id: Number(id),
      message: `Challan #${challanNo} updated successfully.`
    });
  }));

  // Single record (for reprint).
  app.get('/api/challan/:id', route(async (req, res) => {
    const [[row]] = await pool.query(`SELECT * FROM bom_challans WHERE id=?`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Challan not found.' });
    res.json({ ...row, items: JSON.parse(row.items_json || '{}') });
  }));

  app.get('/api/challan/:id/pdf', route(async (req, res) => {
    const cKey = `id_${req.params.id}`;
    const cached = getCachedPdf(cKey);
    if (cached) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Challan_${req.params.id}.pdf"`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return res.send(cached);
    }

    const [[row]] = await pool.query(`SELECT * FROM bom_challans WHERE id=?`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Challan not found.' });
    const record = { ...row, items: JSON.parse(row.items_json || '{}') };

    const { pdfBuffer, cleanup } = await fillTemplateAndConvertToPdf(record);
    try {
      setCachedPdf(cKey, pdfBuffer);
      if (row.challan_no) setCachedPdf(`no_${row.challan_no}`, pdfBuffer);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Challan_${row.challan_no}.pdf"`);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.send(pdfBuffer);
    } finally {
      await cleanup();
    }
  }));
};