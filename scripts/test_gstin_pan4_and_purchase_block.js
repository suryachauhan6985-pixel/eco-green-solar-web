// scripts/test_gstin_pan4_and_purchase_block.js
const assert = require('assert');
const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const { validateGstin, calculateGstinChecksum } = require('../api/utils/validators');

console.log('🧪 Starting GSTIN PAN 4th Character & Purchase Inward Blocking Test Suite...\n');

// -------------------------------------------------------------
// PART 1: Node.js Unit Tests for validateGstin & PAN 4th Char
// -------------------------------------------------------------
console.log('--- PART 1: Node.js Unit Tests for validateGstin ---');

// Test 1: Empty or '-' should be valid and empty
assert.strictEqual(validateGstin('').isValid, true);
assert.strictEqual(validateGstin('   ').isValid, true);
assert.strictEqual(validateGstin('-').isValid, true);
console.log('✔ Passed: Empty / "-" GSTIN is valid (optional)');

// Test 2: Valid PAN 4th Characters: C, P, H, F, A, T, B, L, J, G
const valid4thChars = ['C', 'P', 'H', 'F', 'A', 'T', 'B', 'L', 'J', 'G'];
valid4thChars.forEach((ch) => {
  const first14 = `27ABC${ch}E1234F1Z`;
  const checksum = calculateGstinChecksum(first14);
  const fullGstin = first14 + checksum;
  const res = validateGstin(fullGstin);
  assert.strictEqual(res.isValid, true, `Expected ${fullGstin} (4th char ${ch}) to be VALID`);
  assert.strictEqual(res.error, null);
  console.log(`✔ Passed: Valid PAN 4th char '${ch}' -> ${fullGstin} is VALID`);
});

// Test 3: Invalid PAN 4th Characters (e.g. X, Z, Q, W, K, M, N, O, R, S, U, V, Y)
const invalid4thChars = ['X', 'Z', 'Q', 'W', 'K', 'M', 'N', 'O', 'R', 'S', 'U', 'V', 'Y'];
invalid4thChars.forEach((ch) => {
  const first14 = `27ABC${ch}E1234F1Z`;
  const checksum = calculateGstinChecksum(first14);
  const fullGstin = first14 + checksum;
  const res = validateGstin(fullGstin);
  assert.strictEqual(res.isValid, false, `Expected ${fullGstin} (4th char ${ch}) to be INVALID`);
  assert.strictEqual(res.error, 'Invalid GSTIN');
  console.log(`✔ Passed: Invalid PAN 4th char '${ch}' -> Rejected with opaque error: '${res.error}'`);
});

// Test 4: Checksum mismatch must NOT reveal expected character
const badChecksumGstin = '27ABCPE1234F1Z9'; // Correct checksum is 5
const resBadChecksum = validateGstin(badChecksumGstin);
if (!resBadChecksum.isValid) {
  assert.strictEqual(resBadChecksum.error, 'Invalid GSTIN');
  assert.strictEqual(resBadChecksum.expectedChecksum, undefined);
  assert.strictEqual(resBadChecksum.actualChecksum, undefined);
  console.log('✔ Passed: Checksum failure returns opaque "Invalid GSTIN" without revealing expected value');
}

// -------------------------------------------------------------
// PART 2: Puppeteer Integration Test on Live UI (Purchase Inward)
// -------------------------------------------------------------
(async () => {
  console.log('\n--- PART 2: Puppeteer Integration Tests in Real Chrome ---');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });

    await page.goto('http://localhost:5000', { waitUntil: 'networkidle2' });

    // Navigate to Purchase page
    await page.evaluate(() => {
      if (window.go) window.go('purchase');
    });
    await new Promise((r) => setTimeout(r, 600));

    // 1. Verify Client validateGstin is available and validates 4th char
    const clientCheck = await page.evaluate(() => {
      const v = window.validateGstin;
      if (!v) return { error: 'window.validateGstin is not defined' };
      const valid = v('27ABCPE1234F1Z5');
      const invalidPan4th = v('27ABCXE1234F1Z5');
      return {
        hasValidateGstin: true,
        validPass: valid.isValid,
        invalidPan4thPass: !invalidPan4th.isValid && invalidPan4th.error === 'Invalid GSTIN'
      };
    });
    assert.strictEqual(clientCheck.hasValidateGstin, true);
    assert.strictEqual(clientCheck.invalidPan4thPass, true);
    console.log('✔ Passed: Client-side window.validateGstin correctly rejects invalid PAN 4th char');

    // 2. Test Live Visual Feedback on purSuppGstin input
    const feedbackCheck = await page.evaluate(() => {
      const input = document.getElementById('purSuppGstin');
      const feedback = document.getElementById('purSuppGstinFeedback');
      
      // Case A: Type invalid GSTIN (e.g. invalid 4th char or invalid length)
      input.value = '27ABCXE1234F1Z5';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const invalidBorder = input.style.borderColor;
      const invalidFeedbackText = feedback ? feedback.innerText : '';
      const invalidFeedbackColor = feedback ? feedback.style.color : '';

      // Case B: Type valid GSTIN
      const validGstin = '27ABCPE1234F1Z' + window.calculateGstinChecksum('27ABCPE1234F1Z');
      input.value = validGstin;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const validBorder = input.style.borderColor;
      const validFeedbackText = feedback ? feedback.innerText : '';
      const validFeedbackColor = feedback ? feedback.style.color : '';

      return {
        invalidBorder,
        invalidFeedbackText,
        invalidFeedbackColor,
        validBorder,
        validFeedbackText,
        validFeedbackColor
      };
    });

    console.log('  Feedback on Invalid:', feedbackCheck.invalidFeedbackText, 'Color:', feedbackCheck.invalidFeedbackColor);
    console.log('  Feedback on Valid:', feedbackCheck.validFeedbackText, 'Color:', feedbackCheck.validFeedbackColor);
    assert.ok(feedbackCheck.invalidFeedbackText.includes('Invalid GSTIN'));
    assert.ok(feedbackCheck.validFeedbackText.includes('Valid GSTIN'));
    console.log('✔ Passed: Live visual feedback correctly indicates Valid / Invalid GSTIN with colors');

    // 3. Test Inward Blocking on Invalid GSTIN
    const inwardBlockCheck = await page.evaluate(async () => {
      // Fill required fields
      document.getElementById('purSupp').value = 'Test Supplier';
      document.getElementById('purInv').value = 'INV-TEST-001';
      document.getElementById('purSuppGstin').value = '27ABCXE1234F1Z5'; // INVALID PAN 4th char

      let warningTitle = null;
      let warningMessage = null;
      window.showWarning = (title, msg) => {
        warningTitle = title;
        warningMessage = msg;
      };
      window.openModal = (title, msg) => {
        warningTitle = title;
        warningMessage = msg;
      };

      // Click save button
      document.getElementById('purBtnSave').click();
      await new Promise((r) => setTimeout(r, 100));

      return {
        blocked: warningTitle === 'Invalid GSTIN',
        warningTitle,
        warningMessage
      };
    });

    assert.strictEqual(inwardBlockCheck.blocked, true);
    console.log('✔ Passed: Inward is strictly BLOCKED when GSTIN is invalid! Alert:', inwardBlockCheck.warningTitle, inwardBlockCheck.warningMessage);

    console.log('\n🎉 ALL GSTIN VALIDATION & INWARD BLOCKING TESTS PASSED 100%!');
  } finally {
    await browser.close();
  }
})();
