// tests/password-policy.test.js
// -----------------------------------------------------------------------------
// Automated Test Suite for Enterprise Password Policy & Security Engine
// -----------------------------------------------------------------------------

const assert = require('assert');
const { validatePasswordPolicy, MIN_LENGTH, MAX_LENGTH } = require('../api/services/passwordPolicy');
const { hashPassword, verifyPassword } = require('../api/services/passwords');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

console.log('\n======================================================');
console.log('🛡️  PASSWORD POLICY & AUTHENTICATION VALIDATION TEST SUITE');
console.log('======================================================\n');

// 1. INVALID PASSWORDS
console.log('--- 1. Testing Invalid Passwords ---');

test('Rejects short password (< 12 chars)', () => {
  const res = validatePasswordPolicy('Abc@123');
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.checks.minLength, false);
});

test('Rejects password without uppercase letters', () => {
  const res = validatePasswordPolicy('solarpower#2026');
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.checks.hasUpper, false);
});

test('Rejects password without lowercase letters', () => {
  const res = validatePasswordPolicy('SOLARPOWER#2026');
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.checks.hasLower, false);
});

test('Rejects password without numbers', () => {
  const res = validatePasswordPolicy('SolarPower#Pass');
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.checks.hasNumber, false);
});

test('Rejects password without special characters', () => {
  const res = validatePasswordPolicy('SolarPower2026');
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.checks.hasSpecial, false);
});

test('Rejects password with leading or trailing whitespace', () => {
  const resLeading = validatePasswordPolicy(' SolarPower#2026');
  assert.strictEqual(resLeading.valid, false);
  assert.strictEqual(resLeading.checks.noSurroundingWhitespace, false);

  const resTrailing = validatePasswordPolicy('SolarPower#2026 ');
  assert.strictEqual(resTrailing.valid, false);
  assert.strictEqual(resTrailing.checks.noSurroundingWhitespace, false);
});

test('Rejects common / weak dictionary passwords', () => {
  const res1 = validatePasswordPolicy('Password@123');
  assert.strictEqual(res1.valid, false);
  assert.strictEqual(res1.checks.notCommon, false);

  const res2 = validatePasswordPolicy('admin12345678');
  assert.strictEqual(res2.valid, false);
  assert.strictEqual(res2.checks.notCommon, false);

  const res3 = validatePasswordPolicy('qwerty123456');
  assert.strictEqual(res3.valid, false);
  assert.strictEqual(res3.checks.notCommon, false);
});

test('Rejects single repeated character sequence', () => {
  const res = validatePasswordPolicy('AAAAAAAAAAAA#1');
  assert.strictEqual(res.valid, false);
});

test('Rejects password containing account username or email handle', () => {
  const res = validatePasswordPolicy('SolarSumit#2026', { username: 'sumit' });
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.checks.notContainsIdentity, false);

  const resEmail = validatePasswordPolicy('SolarAdmin#2026', { email: 'admin@ecogreen.com' });
  assert.strictEqual(resEmail.valid, false);
  assert.strictEqual(resEmail.checks.notContainsIdentity, false);
});

test('Rejects password mismatch when confirmation is provided', () => {
  const res = validatePasswordPolicy('SolarPower#2026', { confirmPassword: 'Different#Password2026' });
  assert.strictEqual(res.valid, false);
  assert.strictEqual(res.checks.passwordsMatch, false);
});

// 2. VALID PASSWORDS & PASSPHRASES
console.log('\n--- 2. Testing Valid Passwords & Passphrases ---');

test('Accepts strong standard password meeting all criteria', () => {
  const res = validatePasswordPolicy('EcoGreen#2026Solar', { confirmPassword: 'EcoGreen#2026Solar' });
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.errors.length, 0);
  assert.strictEqual(res.checks.minLength, true);
  assert.strictEqual(res.checks.hasUpper, true);
  assert.strictEqual(res.checks.hasLower, true);
  assert.strictEqual(res.checks.hasNumber, true);
  assert.strictEqual(res.checks.hasSpecial, true);
  assert.strictEqual(res.checks.passwordsMatch, true);
  assert.ok(res.score >= 75);
});

test('Accepts complex multi-word passphrase with spaces in the middle', () => {
  const res = validatePasswordPolicy('Solar Panels 2026 & Safe Inverters', { confirmPassword: 'Solar Panels 2026 & Safe Inverters' });
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.strength, 'Very Strong');
  assert.ok(res.score >= 90);
});

test('Accepts ultra-secure long password (up to 128 chars)', () => {
  const longPass = 'Super#Secure@Password_For_Solar_Inventory_Management_Suite_2026!WithVeryLongEntropy';
  const res = validatePasswordPolicy(longPass);
  assert.strictEqual(res.valid, true);
  assert.strictEqual(res.strength, 'Very Strong');
});

// 3. PASSWORD HASHING & VERIFICATION
console.log('\n--- 3. Testing Bcrypt Hashing & Verification ---');

async function runCryptoTests() {
  await asyncTest('Hashes password securely with bcrypt salt rounds', async () => {
    const plain = 'EcoGreen#2026Solar';
    const hash = await hashPassword(plain);
    assert.strictEqual(typeof hash, 'string');
    assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'));
    assert.notStrictEqual(hash, plain);
  });

  await asyncTest('Verifies valid password against bcrypt hash', async () => {
    const plain = 'EcoGreen#2026Solar';
    const hash = await hashPassword(plain);
    const result = await verifyPassword(plain, hash);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.needsRehash, false);
  });

  await asyncTest('Rejects invalid password against bcrypt hash', async () => {
    const plain = 'EcoGreen#2026Solar';
    const wrong = 'WrongPassword#123';
    const hash = await hashPassword(plain);
    const result = await verifyPassword(wrong, hash);
    assert.strictEqual(result.valid, false);
  });

  console.log('\n======================================================');
  console.log(`TEST RESULTS: \x1b[32m${passedTests} PASSED\x1b[0m | \x1b[${failedTests ? '31' : '32'}m${failedTests} FAILED\x1b[0m`);
  console.log('======================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runCryptoTests();
