const bcrypt = require('bcryptjs');
const BCRYPT_ROUNDS = 10;

async function hashPassword(plain) { return bcrypt.hash(String(plain), BCRYPT_ROUNDS); }
function looksLikeBcryptHash(stored) { return typeof stored === 'string' && /^\$2[aby]\$\d{2}\$/.test(stored); }
async function verifyPassword(plain, stored) {
  if (!stored) return { valid: false, needsRehash: false };
  if (looksLikeBcryptHash(stored)) {
    const valid = await bcrypt.compare(String(plain), stored);
    return { valid, needsRehash: false };
  }
  const valid = String(plain) === String(stored);
  return { valid, needsRehash: valid };
}

module.exports = { hashPassword, verifyPassword };
