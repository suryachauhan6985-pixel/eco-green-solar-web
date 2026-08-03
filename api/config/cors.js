const cors = require('cors');

// Both domain variants whitelisted as a safety net — the Render dashboard's
// own startup log for this service printed
// "https://eco-green-solar-web.onrender.com" (no "-1"), but the user
// confirms the real live frontend is served from the "-1" domain. Rather
// than guess wrong again, both are allowed here so neither one gets
// blocked; once it's confirmed which Render service is actually serving
// production traffic, the unused one can be removed from this list.
const DEFAULT_ALLOWED_ORIGIN = 'https://eco-green-solar-web-1.onrender.com,https://eco-green-solar-web.onrender.com';
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