module.exports = function registerAttachmentsRoutes(app, deps) {
  const { pool, route } = deps;
  const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx']);
  const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB per file

  function getFileExtension(fileName) {
    const name = String(fileName || '');
    const dot = name.lastIndexOf('.');
    return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
  }

  // base64 text is ~4/3 the size of the original bytes — decode the actual
  // byte size from the string length rather than trusting the client-supplied
  // `size` field, which is just a number the client claims about itself.
  function base64ByteSize(base64) {
    const str = String(base64 || '');
    const padding = (str.match(/=*$/) || [''])[0].length;
    return Math.floor((str.length * 3) / 4) - padding;
  }

  // POST /api/attachments — body: { refType, refNo, uploadedBy, files: [{ name, mimeType, size, data }] }
  // `data` is base64 WITHOUT the "data:...;base64," prefix (frontend strips
  // it before sending). Multiple files in one call is the normal case, since
  // a single invoice/challan can have several proof photos.
  app.post('/api/attachments', route(async (req, res) => {
    const refType = String(req.body.refType || '').trim();
    const refNo = String(req.body.refNo || '').trim();
    const files = Array.isArray(req.body.files) ? req.body.files : [];
    if (!refType || !refNo) return res.status(400).json({ error: 'refType and refNo are required.' });
    if (!files.length) return res.status(400).json({ error: 'No files provided.' });

    // Validate EVERY file before inserting ANY of them — reject the whole
    // batch on the first problem instead of leaving a half-uploaded set.
    for (const f of files) {
      if (!f || !f.name || !f.data) return res.status(400).json({ error: 'Each file needs a name and data.' });
      const ext = getFileExtension(f.name);
      if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) {
        return res.status(400).json({
          error: `"${f.name}" is not an allowed file type. Allowed: images (jpg/png/webp), PDF, Word (doc/docx), Excel (xls/xlsx).`,
        });
      }
      const actualBytes = base64ByteSize(f.data);
      if (actualBytes > MAX_ATTACHMENT_SIZE_BYTES) {
        return res.status(400).json({
          error: `"${f.name}" is too large (${(actualBytes / (1024 * 1024)).toFixed(1)} MB). Max allowed size is 5 MB.`,
        });
      }
    }

    const uploadedBy = req.body.uploadedBy ? String(req.body.uploadedBy).trim() : null;
    const inserted = [];
    for (const f of files) {
      if (!f || !f.name || !f.data) continue;
      const [result] = await pool.query(
        `INSERT INTO attachments (ref_type, ref_no, file_name, mime_type, file_size, file_data, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [refType, refNo, String(f.name).slice(0, 255), f.mimeType || 'application/octet-stream', Number(f.size) || 0, f.data, uploadedBy]
      );
      inserted.push({ id: result.insertId, fileName: f.name, mimeType: f.mimeType || 'application/octet-stream', fileSize: Number(f.size) || 0 });
    }
    if (!inserted.length) return res.status(400).json({ error: 'No valid files provided.' });
    res.json({ success: true, files: inserted });
  }));

  // GET /api/attachments?refType=&refNo= — metadata only (no file_data), so
  // the Ledger's voucher-level Attachments panel loads instantly even if a
  // file is several MB.
  app.get('/api/attachments', route(async (req, res) => {
    const refType = String(req.query.refType || '').trim();
    const refNo = String(req.query.refNo || '').trim();
    if (!refType || !refNo) return res.status(400).json({ error: 'refType and refNo are required.' });
    const [rows] = await pool.query(
      `SELECT id, file_name, mime_type, file_size, uploaded_by, uploaded_at
       FROM attachments WHERE ref_type=? AND ref_no=? ORDER BY uploaded_at ASC, id ASC`,
      [refType, refNo]
    );
    res.json({ files: rows.map((r) => ({
      id: r.id, fileName: r.file_name, mimeType: r.mime_type, fileSize: r.file_size,
      uploadedBy: r.uploaded_by, uploadedAt: r.uploaded_at,
    })) });
  }));

  // GET /api/attachments/:id/file — streams the actual bytes so the browser
  // can open/preview it (images and PDFs render inline; everything else the
  // browser will offer to download), instead of just showing a filename.
  app.get('/api/attachments/:id/file', route(async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid attachment id.' });
    const [[row]] = await pool.query(`SELECT file_name, mime_type, file_data FROM attachments WHERE id=?`, [id]);
    if (!row) return res.status(404).json({ error: 'Attachment not found.' });
    const buffer = Buffer.from(row.file_data, 'base64');
    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${String(row.file_name).replace(/"/g, '')}"`);
    res.send(buffer);
  }));

  // DELETE /api/attachments/:id — lets a mistaken/duplicate proof be removed.
  app.delete('/api/attachments/:id', route(async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid attachment id.' });
    const [result] = await pool.query(`DELETE FROM attachments WHERE id=?`, [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Attachment not found.' });
    res.json({ success: true });
  }));

};
