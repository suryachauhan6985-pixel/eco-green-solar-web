function isDbInternalError(err) {
  if (!err) return false;
  const msg = String(err.sqlMessage || err.message || '');
  const code = String(err.code || '');
  return (
    code.startsWith('ER_') ||
    code.startsWith('PROTOCOL_') ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    /SELECT\s+|UPDATE\s+|INSERT\s+|DELETE\s+|FROM\s+|TABLE\s+|information_schema|WHERE\s+|syntax to use near/i.test(msg)
  );
}

function route(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      console.error(`[API Error] ${req.method} ${req.originalUrl || req.url}:`, e);
      
      // If error is an explicit business message thrown with status (e.g. invalid input), preserve it.
      // If error is an internal database exception / syntax error, shield the client from database internals.
      if (isDbInternalError(e)) {
        res.status(500).json({ error: 'A database error occurred. Please verify your data and try again.' });
      } else {
        const clientMsg = (e && typeof e.message === 'string' && e.message.length < 300)
          ? e.message
          : 'An unexpected internal server error occurred.';
        res.status(500).json({ error: clientMsg });
      }
    }
  };
}

module.exports = { route, isDbInternalError };

