const rateLimit = require('express-rate-limit');
function rateLimitHandler(_req, res) { res.status(429).json({ error: 'Too many attempts. Please wait a few minutes and try again.' }); }
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, handler: rateLimitHandler });
const otpLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, handler: rateLimitHandler });
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, handler: rateLimitHandler });
const forgotPasswordLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false, handler: rateLimitHandler });
module.exports = { loginLimiter, otpLimiter, registerLimiter, forgotPasswordLimiter };
