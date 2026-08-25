// api/services/passwordPolicy.js
// -----------------------------------------------------------------------------
// Enterprise Password Policy & Validation Engine
// -----------------------------------------------------------------------------

const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

// Common predictable weak passwords and patterns
const COMMON_WEAK_PASSWORDS = new Set([
  'password', 'password123', 'password1234', 'password@123', 'password123!',
  '123456789012', '1234567890123', '12345678901234', '123456789012345',
  'admin12345678', 'admin@123456', 'administrator', 'administrator1',
  'welcome123456', 'welcome@12345', 'qwerty123456', 'qwertyuiopas',
  'letmein123456', 'changeme12345', 'ecogreensolar', 'ecogreen12345',
  'sunshine12345', 'solarpower123', 'solarpanel123'
]);

/**
 * Validates a password against enterprise security standards
 * @param {string} password
 * @param {object} options - { username, email, confirmPassword }
 * @returns {{ valid: boolean, errors: string[], checks: object, score: number, strength: string }}
 */
function validatePasswordPolicy(password, options = {}) {
  const errors = [];
  const checks = {
    minLength: false,
    maxLength: false,
    hasUpper: false,
    hasLower: false,
    hasNumber: false,
    hasSpecial: false,
    noSurroundingWhitespace: false,
    notCommon: true,
    notContainsIdentity: true,
    passwordsMatch: true,
  };

  if (typeof password !== 'string') {
    return {
      valid: false,
      errors: ['Password must be a valid text string.'],
      checks,
      score: 0,
      strength: 'Weak'
    };
  }

  // 1. Whitespace check (no leading/trailing spaces)
  if (password.length > 0 && password.trim() === password) {
    checks.noSurroundingWhitespace = true;
  } else {
    errors.push('Password must not contain leading or trailing spaces.');
  }

  const cleanPass = password;

  // 2. Length check (12 - 128)
  if (cleanPass.length >= MIN_LENGTH) {
    checks.minLength = true;
  } else {
    errors.push(`Password must be at least ${MIN_LENGTH} characters long.`);
  }

  if (cleanPass.length <= MAX_LENGTH) {
    checks.maxLength = true;
  } else {
    errors.push(`Password must not exceed ${MAX_LENGTH} characters.`);
  }

  // 3. Diversity checks
  if (/[A-Z]/.test(cleanPass)) checks.hasUpper = true;
  else errors.push('Password must contain at least one uppercase letter (A-Z).');

  if (/[a-z]/.test(cleanPass)) checks.hasLower = true;
  else errors.push('Password must contain at least one lowercase letter (a-z).');

  if (/[0-9]/.test(cleanPass)) checks.hasNumber = true;
  else errors.push('Password must contain at least one number (0-9).');

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(cleanPass)) checks.hasSpecial = true;
  else errors.push('Password must contain at least one special character (!@#$%^&*...).');

  // 4. Identity containment check (cannot contain username or email handle)
  if (options.username && options.username.length >= 3) {
    const uname = options.username.toLowerCase();
    if (cleanPass.toLowerCase().includes(uname)) {
      checks.notContainsIdentity = false;
      errors.push('Password must not contain your username.');
    }
  }

  if (options.email && options.email.includes('@')) {
    const handle = options.email.split('@')[0].toLowerCase();
    if (handle.length >= 3 && cleanPass.toLowerCase().includes(handle)) {
      checks.notContainsIdentity = false;
      errors.push('Password must not contain your email address.');
    }
  }

  // 5. Common weak password blacklist & repeated sequence check
  const lowerPass = cleanPass.toLowerCase();
  if (COMMON_WEAK_PASSWORDS.has(lowerPass)) {
    checks.notCommon = false;
    errors.push('Password is too common. Please choose a more unique passphrase.');
  }

  // Check for repeated identical characters (e.g. "aaaaaaaaaaaa")
  if (/^(.)\1{7,}$/.test(cleanPass)) {
    checks.notCommon = false;
    errors.push('Password cannot consist of a single repeated character.');
  }

  // 6. Confirmation match (if provided)
  if (options.confirmPassword !== undefined) {
    if (options.confirmPassword === password) {
      checks.passwordsMatch = true;
    } else {
      checks.passwordsMatch = false;
      errors.push('Password confirmation does not match.');
    }
  }

  // 7. Calculate Strength Score (0 - 100)
  let score = 0;
  if (checks.minLength) score += 25;
  if (cleanPass.length >= 16) score += 15;
  if (cleanPass.length >= 20) score += 10;
  if (checks.hasUpper) score += 10;
  if (checks.hasLower) score += 10;
  if (checks.hasNumber) score += 10;
  if (checks.hasSpecial) score += 15;
  if (checks.notCommon) score += 5;
  if (!checks.noSurroundingWhitespace) score = Math.max(0, score - 20);

  let strength = 'Weak';
  if (score >= 90) strength = 'Very Strong';
  else if (score >= 75) strength = 'Strong';
  else if (score >= 55) strength = 'Good';
  else if (score >= 35) strength = 'Fair';

  const valid = errors.length === 0;

  return {
    valid,
    errors,
    checks,
    score,
    strength,
  };
}

module.exports = {
  MIN_LENGTH,
  MAX_LENGTH,
  validatePasswordPolicy,
};
