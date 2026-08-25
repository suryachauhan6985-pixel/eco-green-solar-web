module.exports = function registerAttachmentsRoutes(app, deps) {
  const { pool, route, requireRole } = deps;
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

  function validateMagicBytes(base64Data, ext) {
    try {
      const buf = Buffer.from(String(base64Data || '').slice(0, 32), 'base64');
      if (buf.length < 4) return false;
      const hex = buf.toString('hex').toLowerCase();
      if (ext === 'pdf') return hex.startsWith('25504446'); // %PDF
      if (ext === 'jpg' || ext === 'jpeg') return hex.startsWith('ffd8ff');
      if (ext === 'png') return hex.startsWith('89504e47');
      if (ext === 'webp') return hex.startsWith('52494646'); // RIFF
      if (ext === 'docx' || ext === 'xlsx') return hex.startsWith('504b0304'); // PK..
      if (ext === 'doc' || ext === 'xls') return hex.startsWith('d0cf11e0'); // OLE compound
      return true;
    } catch (e) {
      return false;
    }
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
      if (!validateMagicBytes(f.data, ext)) {
        return res.status(400).json({
          error: `"${f.name}" content does not match its ${ext.toUpperCase()} file extension signature.`,
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
    const tenantId = req.tenantId || '00000000-0000-0000-0000-000000000001';
    const inserted = [];
    for (const f of files) {
      if (!f || !f.name || !f.data) continue;
      const [result] = await pool.query(
        `INSERT INTO attachments (tenant_id, ref_type, ref_no, file_name, mime_type, file_size, file_data, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenantId, refType, refNo, String(f.name).slice(0, 255), f.mimeType || 'application/octet-stream', Number(f.size) || 0, f.data, uploadedBy]
      );
      inserted.push({ id: result.insertId, fileName: f.name, mimeType: f.mimeType || 'application/octet-stream', fileSize: Number(f.size) || 0 });
    }
    if (!inserted.length) return res.status(400).json({ error: 'No valid files provided.' });
    res.json({ success: true, files: inserted });
  }));

  // GET /api/attachments?refType=&refNo= — metadata only (no file_data)
  app.get('/api/attachments', route(async (req, res) => {
    const refType = String(req.query.refType || '').trim();
    const refNo = String(req.query.refNo || '').trim();
    const tenantId = req.tenantId || '00000000-0000-0000-0000-000000000001';
    if (!refType || !refNo) return res.status(400).json({ error: 'refType and refNo are required.' });
    const [rows] = await pool.query(
      `SELECT id, file_name, mime_type, file_size, uploaded_by, uploaded_at
       FROM attachments WHERE (tenant_id=? OR tenant_id IS NULL) AND ref_type=? AND ref_no=? ORDER BY uploaded_at ASC, id ASC`,
      [tenantId, refType, refNo]
    );
    res.json({ files: rows.map((r) => ({
      id: r.id, fileName: r.file_name, mimeType: r.mime_type, fileSize: r.file_size,
      uploadedBy: r.uploaded_by, uploadedAt: r.uploaded_at,
    })) });
  }));

  // GET /api/attachments/:id/file — streams the actual bytes with sanitized disposition
  app.get('/api/attachments/:id/file', route(async (req, res) => {
    const id = Number(req.params.id);
    const tenantId = req.tenantId || '00000000-0000-0000-0000-000000000001';
    if (!id) return res.status(400).json({ error: 'Invalid attachment id.' });
    const [[row]] = await pool.query(`SELECT file_name, mime_type, file_data FROM attachments WHERE id=? AND (tenant_id=? OR tenant_id IS NULL)`, [id, tenantId]);
    if (!row) return res.status(404).json({ error: 'Attachment not found.' });
    const buffer = Buffer.from(row.file_data, 'base64');
    const safeName = String(row.file_name || 'file').replace(/[^\w.-]/g, '_');
    res.setHeader('Content-Type', row.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.send(buffer);
  }));

  // DELETE /api/attachments/:id — SuperAdmin/Admin only
  app.delete('/api/attachments/:id', requireRole('SuperAdmin', 'Admin'), route(async (req, res) => {
    const id = Number(req.params.id);
    const tenantId = req.tenantId || '00000000-0000-0000-0000-000000000001';
    if (!id) return res.status(400).json({ error: 'Invalid attachment id.' });
    const [result] = await pool.query(`DELETE FROM attachments WHERE id=? AND (tenant_id=? OR tenant_id IS NULL)`, [id, tenantId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Attachment not found.' });
    res.json({ success: true });
  }));
};
