// tests/security-performance.test.js
// -----------------------------------------------------------------------------
// Automated Test Suite for Security, Performance & Scalability Validations
// -----------------------------------------------------------------------------

const assert = require('assert');
const { requireRole } = require('../api/middleware/auth.middleware');
const { sanitizeCellForExcel } = require('../api/services/serialExcelService');
const { FastMemoryCache } = require('../api/utils/cache');

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

console.log('\n==================================================================');
console.log('🛡️  SECURITY, PERFORMANCE & SCALABILITY VERIFICATION SUITE');
console.log('==================================================================\n');

// 1. AUTHORIZATION TESTS
console.log('--- 1. Testing Role Authorization Middleware ---');

test('requireRole authorizes user when passed varargs', () => {
  const middleware = requireRole('SuperAdmin', 'Admin');
  let nextCalled = false;
  const req = { user: { role: 'Admin' } };
  const res = { status: () => ({ json: () => {} }) };
  middleware(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
});

test('requireRole authorizes user when passed an array', () => {
  const middleware = requireRole(['SuperAdmin', 'Admin']);
  let nextCalled = false;
  const req = { user: { role: 'Admin' } };
  const res = { status: () => ({ json: () => {} }) };
  middleware(req, res, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
});

test('requireRole rejects unauthorized role with 403', () => {
  const middleware = requireRole('SuperAdmin');
  let statusCode = 0;
  let responseData = null;
  const req = { user: { role: 'User' } };
  const res = {
    status: (code) => {
      statusCode = code;
      return { json: (data) => { responseData = data; } };
    }
  };
  middleware(req, res, () => {});
  assert.strictEqual(statusCode, 403);
  assert.ok(responseData && responseData.error);
});

// 2. FORMULA INJECTION SANITIZATION
console.log('\n--- 2. Testing CSV / Spreadsheet Formula Injection Sanitization ---');

test('Escapes malicious leading equals sign (=cmd)', () => {
  const sanitized = sanitizeCellForExcel('=cmd|"/C calc"!A0');
  assert.strictEqual(sanitized, "'=cmd|\"/C calc\"!A0");
});

test('Escapes malicious leading plus sign (+SUM)', () => {
  const sanitized = sanitizeCellForExcel('+SUM(1,2)');
  assert.strictEqual(sanitized, "'+SUM(1,2)");
});

test('Escapes malicious leading minus sign (-1+1)', () => {
  const sanitized = sanitizeCellForExcel('-1+1');
  assert.strictEqual(sanitized, "'-1+1");
});

test('Escapes malicious leading @ symbol (@HYPERLINK)', () => {
  const sanitized = sanitizeCellForExcel('@HYPERLINK("http://attacker.com","Click")');
  assert.strictEqual(sanitized, "'@HYPERLINK(\"http://attacker.com\",\"Click\")");
});

test('Leaves normal alphanumeric serial numbers untouched', () => {
  const standardSerial = 'ADANI545W-2026-987654';
  const sanitized = sanitizeCellForExcel(standardSerial);
  assert.strictEqual(sanitized, standardSerial);
});

// 3. CACHE CAPACITY & LRU EVICTION
console.log('\n--- 3. Testing Bounded Cache & LRU Eviction ---');

test('FastMemoryCache enforces maximum capacity and evicts oldest items', () => {
  const cache = new FastMemoryCache('test', 60000, 3);
  cache.set('key1', 'val1');
  cache.set('key2', 'val2');
  cache.set('key3', 'val3');
  assert.strictEqual(cache.get('key1'), 'val1');

  // Insert 4th item — should evict key2 (because key1 was refreshed on get)
  cache.set('key4', 'val4');
  assert.strictEqual(cache.get('key2'), null);
  assert.strictEqual(cache.get('key1'), 'val1');
  assert.strictEqual(cache.get('key3'), 'val3');
  assert.strictEqual(cache.get('key4'), 'val4');
  assert.strictEqual(cache.stats.evictions, 1);
});

test('FastMemoryCache expires stale entries on TTL', async () => {
  const cache = new FastMemoryCache('test-ttl', 50, 100);
  cache.set('temp', 'data', 50);
  assert.strictEqual(cache.get('temp'), 'data');
  await new Promise((r) => setTimeout(r, 60));
  assert.strictEqual(cache.get('temp'), null);
});

// 4. BATCH OPTIMIZATION VALIDATION
console.log('\n--- 4. Testing Query Batch Optimization Logic ---');

test('Validates batch serial lookup constructs single query without N+1 loops', async () => {
  let queryCount = 0;
  const mockRunner = {
    query: async (sql, params) => {
      queryCount++;
      return [[
        { serial_no: 'SN1', status: 'Available', category: 'Solar Panel', brand_name: 'Adani', watt: 545, solar_type: 'DCR' },
        { serial_no: 'SN2', status: 'Available', category: 'Solar Panel', brand_name: 'Adani', watt: 545, solar_type: 'DCR' }
      ]];
    }
  };

  const { validateSalesLineSerials } = require('../api/services/stockHelpers');
  const line = { cat: 'Solar Panel', brand: 'Adani', watt: 545, type: 'DCR' };
  const errors = await validateSalesLineSerials(mockRunner, ['SN1', 'SN2'], line);
  assert.strictEqual(errors.length, 0);
  assert.strictEqual(queryCount, 1); // 1 single batch query instead of 2 individual queries
});

console.log('\n==================================================================');
console.log(`TEST RESULTS: \x1b[32m${passedTests} PASSED\x1b[0m | \x1b[${failedTests ? '31' : '32'}m${failedTests} FAILED\x1b[0m`);
console.log('==================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
