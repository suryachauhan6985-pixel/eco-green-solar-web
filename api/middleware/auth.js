const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('[Auth] JWT_SECRET is not set - using a random secret generated for this process only. Every logged-in session will be invalidated on restart/redeploy.');
}
const JWT_EXPIRES_IN = '7d';
const PUBLIC_API_PATHS = new Set([
  '/api/health', '/api/auth/login', '/api/auth/verify-otp', '/api/auth/resend-otp',
  '/api/auth/register', '/api/auth/verify-register-otp', '/api/auth/forgot-password',
  '/api/auth/reset-password', '/api/auth/logout',
]);

function issueToken(username, role) { return jwt.sign({ username, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }); }
function authenticateToken(req, res, next) {
  if (!req.path.startsWith('/api/')) return next();
  if (PUBLIC_API_PATHS.has(req.path)) return next();
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return res.status(401).json({ error: 'Please log in to continue.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { username: payload.username, role: payload.role };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    next();
  };
}

module.exports = { authenticateToken, issueToken, requireRole };
