const rateLimit = require('express-rate-limit');

function rateLimitHandler(_req, res) {
  res.status(429).json({ error: 'Too many requests. Please slow down and try again in a moment.' });
}

// Global API Limiter: 300 requests per minute per IP (prevents flood/DoS)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// Mutation Limiter: 60 write operations per minute per IP (POST, PUT, DELETE)
const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'HEAD',
  handler: rateLimitHandler,
});

// Heavy Export Limiter: 15 exports/downloads per minute per IP
const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

// Auth-Specific Limiters (brute force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: 'Too many login attempts. Please wait 15 minutes before trying again.' }),
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: 'Too many OTP attempts. Please wait a few minutes and try again.' }),
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: 'Too many registration attempts from this network. Please try again later.' }),
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: 'Too many password reset requests. Please wait a few minutes.' }),
});

module.exports = {
  globalLimiter,
  mutationLimiter,
  exportLimiter,
  loginLimiter,
  otpLimiter,
  registerLimiter,
  forgotPasswordLimiter,
};

