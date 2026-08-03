const cors = require('cors');

const DEFAULT_ALLOWED_ORIGIN = 'https://eco-green-solar-web-1.onrender.com';
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || DEFAULT_ALLOWED_ORIGIN)
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

function corsMiddleware() {
  return cors({
    origin(origin, callback) {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
  });
}

module.exports = { corsMiddleware, ALLOWED_ORIGINS };
