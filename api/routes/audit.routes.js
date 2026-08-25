// api/routes/audit.routes.js
// Activity Timeline & Audit Logging Engine

async function logAuditEvent(pool, { type, ref, user, oldVal, newVal }) {
  if (!pool || !type) return;
  try {
    const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const oldStr = typeof oldVal === 'object' ? JSON.stringify(oldVal) : (oldVal || null);
    const newStr = typeof newVal === 'object' ? JSON.stringify(newVal) : (newVal || null);
    const actionUser = user || 'System';

    await pool.query(
      `INSERT INTO audit_logs (transaction_type, reference_no, action_by, action_timestamp, old_details, new_details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [type, ref || null, actionUser, ts, oldStr, newStr]
    );
  } catch (e) {
    console.warn('[Audit Log Engine] Best-effort write notice:', e.message);
  }
}

function registerAuditRoutes(app, deps) {
  const { pool, route } = deps;

  // GET /api/audit-logs — Paginated, searchable & filterable audit feed
  route('get', '/api/audit-logs', async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const offset = (page - 1) * limit;

    const moduleFilter = (req.query.module || '').trim().toUpperCase();
    const userFilter = (req.query.user || '').trim();
    const search = (req.query.search || '').trim();
    const fromDate = (req.query.from || '').trim();
    const toDate = (req.query.to || '').trim();

    const conditions = ['1=1'];
    const params = [];

    if (moduleFilter && moduleFilter !== 'ALL') {
      conditions.push('transaction_type LIKE ?');
      params.push(`%${moduleFilter}%`);
    }

    if (userFilter) {
      conditions.push('action_by LIKE ?');
      params.push(`%${userFilter}%`);
    }

    if (search) {
      conditions.push('(reference_no LIKE ? OR action_by LIKE ? OR transaction_type LIKE ? OR old_details LIKE ? OR new_details LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    if (fromDate) {
      conditions.push('DATE(created_at) >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push('DATE(created_at) <= ?');
      params.push(toDate);
    }

    // Stealth: Hide SuperAdmin activity traces from non-SuperAdmin audit viewers
    if (!req.user || req.user.role !== 'SuperAdmin') {
      conditions.push(`(action_by NOT IN ('superadmin', 'SuperAdmin', 'sumit') AND action_by NOT LIKE '%SuperAdmin%')`);
    }

    const whereClause = conditions.join(' AND ');

    // Total count query
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM audit_logs WHERE ${whereClause}`,
      params
    );
    const total = countRows[0] ? countRows[0].total : 0;

    // Paginated records query
    const [rows] = await pool.query(
      `SELECT id, transaction_type, reference_no, action_by, action_timestamp, old_details, new_details, created_at
       FROM audit_logs
       WHERE ${whereClause}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      logs: rows || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    });
  });

  // POST /api/audit-logs — Log custom client event
  route('post', '/api/audit-logs', async (req, res) => {
    const { transaction_type, reference_no, action_by, old_details, new_details } = req.body || {};
    if (!transaction_type) {
      return res.status(400).json({ error: 'transaction_type is required' });
    }

    await logAuditEvent(pool, {
      type: transaction_type,
      ref: reference_no,
      user: action_by || (req.user && req.user.username) || 'User',
      oldVal: old_details,
      newVal: new_details
    });

    res.json({ success: true });
  });
}

module.exports = {
  registerAuditRoutes,
  logAuditEvent
};
