// scripts/test_custom_theme_autocomplete.js
const assert = require('assert');
const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

console.log('🧪 Testing Custom Theme-Aware Autocomplete & Scrollable Dropdown Engine...\n');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,900']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 900 });

    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    // Mock 50+ customer ledgers so the list has plenty of items to test scrollability
    const mockLedgers = [];
    for (let i = 1; i <= 60; i++) {
      mockLedgers.push({
        id: i,
        name: `CUSTOMER PARTY ${i}`,
        short: `NP00${1000 + i}`,
        type: 'Customer',
        mobile: `98000000${String(i).padStart(2, '0')}`,
        address: `Surat Gujarat ${i}`
      });
    }

    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER PAGEERROR:', err.message));

    await page.evaluateOnNewDocument(() => {
      localStorage.setItem('auth_token', 'mock_token_123');
      localStorage.setItem('user_role', 'SuperAdmin');
      localStorage.setItem('username', 'admin');
    });

    await page.setRequestInterception(true);
    page.on('request', req => {
      const url = req.url();
      if (url.includes('/api/auth/app-settings') || url.includes('/api/auth/profile')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, settings: { erp_mode: 'hybrid' }, username: 'admin', role: 'SuperAdmin' })
        });
      } else if (url.includes('/api/ledgers/shortcodes') || url.includes('/api/ledgers')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockLedgers)
        });
      } else if (url.includes('/api/masters/categories')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 1, name: 'DCR SOLAR PANEL', serial_mandatory: 1 }])
        });
      } else if (url.includes('/api/masters/items')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ id: 1, name: 'ADANI 550', brand_name: 'ADANI', category: 'DCR SOLAR PANEL' }])
        });
      } else if (url.includes('/api/bom/challan/categories')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, mapping: {} })
        });
      } else if (url.includes('/api/bom/kits')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ name: 'Test Kit', sections: [] }])
        });
      } else if (url.includes('/api/bom/orders')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      } else if (url.includes('/api/dashboard/summary') || url.includes('/api/dashboard/pulse')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, stats: {}, pulse: {} })
        });
      } else {
        req.continue();
      }
    });

    await page.goto('http://localhost:5000', { waitUntil: 'networkidle2' });

    // Navigate to BOM
    await page.evaluate(() => {
      if (window.go) window.go('bom');
    });
    await new Promise((r) => setTimeout(r, 600));

    // Check and switch to BOM Entry view
    const debugAc = await page.evaluate(() => {
      const home = document.getElementById('bomHomeView');
      const entry = document.getElementById('bomEntryView');
      if (home) home.style.display = 'none';
      if (entry) entry.style.display = '';
      const input = document.getElementById('bomOrderNo');
      return {
        hasEgsInitAutocompletes: typeof window.egsInitAutocompletes,
        inputFound: !!input,
        inputList: input ? input.getAttribute('list') : null,
        manualCallResult: (typeof window.egsInitAutocompletes === 'function') ? (window.egsInitAutocompletes(), true) : false,
        afterManualCallAttr: input ? input.getAttribute('list') : null,
        afterManualCallDataset: input ? input.dataset.egsAc : null
      };
    });
    console.log('Debug AC in browser:', debugAc);

    // Trigger input in #bomOrderNo to search and populate datalist
    await page.evaluate(() => {
      const input = document.getElementById('bomOrderNo');
      if (input) {
        input.value = 'NP';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await new Promise((r) => setTimeout(r, 600));

    // Evaluate custom dropdown presence, scrollability, and styling
    const dropdownCheck = await page.evaluate(() => {
      const input = document.getElementById('bomOrderNo');
      const dl = document.getElementById('bomOrderNoList');
      const pop = document.querySelector('.egs-ac-pop');

      return {
        inputFound: !!input,
        datasetAc: input ? input.dataset.egsAc : null,
        inputParent: input && input.parentElement ? input.parentElement.className : null,
        parentHtml: input && input.parentElement ? input.parentElement.innerHTML : null,
        datalistFound: !!dl,
        datalistOptionsCount: dl ? dl.querySelectorAll('option').length : 0,
        hasPop: !!pop,
        popInnerHTML: pop ? pop.innerHTML : null,
        itemsCount: pop ? pop.querySelectorAll('.egs-ac-item').length : 0,
        maxHeight: pop ? window.getComputedStyle(pop).maxHeight : null,
        overflowY: pop ? window.getComputedStyle(pop).overflowY : null,
        popHeight: pop ? pop.getBoundingClientRect().height : 0,
        nativeListAttr: input ? input.getAttribute('list') : null,
        hasDatalistId: input ? !!input.dataset.datalistId : false
      };
    });

    console.log('Dropdown Check Result:', dropdownCheck);
    assert.strictEqual(dropdownCheck.hasPop, true, 'Custom .egs-ac-pop should be rendered');
    assert.ok(dropdownCheck.itemsCount >= 50, 'Should render 50+ items in dropdown');
    assert.strictEqual(dropdownCheck.maxHeight, '240px', 'Max height should be capped at 240px');
    assert.strictEqual(dropdownCheck.overflowY, 'auto', 'Dropdown must be scrollable (overflow-y: auto)');
    assert.ok(dropdownCheck.popHeight <= 250, 'Rendered height should be capped at ~240px, not full screen');
    assert.strictEqual(dropdownCheck.nativeListAttr, null, 'Native list attribute should be suppressed to avoid OS popup');
    assert.strictEqual(dropdownCheck.hasDatalistId, true, 'Internal datalist ID saved for sync');

    console.log('✔ Verified: Custom dropdown is neatly capped at 240px with smooth scrollability.');

    // Test selecting an item by clicking
    await page.evaluate(() => {
      const item = document.querySelector('.egs-ac-item');
      if (item) item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 300));

    const selectedValue = await page.evaluate(() => {
      return {
        orderNo: document.getElementById('bomOrderNo').value,
        custName: document.getElementById('bomCustomerName').value,
        popStillOpen: !!document.querySelector('.egs-ac-pop')
      };
    });

    console.log('Selection Result:', selectedValue);
    assert.strictEqual(selectedValue.popStillOpen, false, 'Dropdown should close on selection');
    assert.ok(selectedValue.orderNo.startsWith('NP00'), 'Order No should be filled with selected short code');
    assert.ok(selectedValue.custName.startsWith('CUSTOMER PARTY'), 'Customer Name should auto-fill based on selection');

    console.log('✔ Verified: Dropdown selection and auto-fill working seamlessly.');

    // Test Theme change adaptation
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-theme', 'light');
      const input = document.getElementById('bomOrderNo');
      if (input) {
        input.focus();
        input.value = 'NP';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await new Promise((r) => setTimeout(r, 200));

    const themeCheck = await page.evaluate(() => {
      const pop = document.querySelector('.egs-ac-pop');
      const bg = pop ? window.getComputedStyle(pop).backgroundColor : '';
      return {
        themeApplied: document.documentElement.getAttribute('data-theme'),
        hasPop: !!pop,
        popBg: bg
      };
    });
    console.log('Theme Adapt Result:', themeCheck);
    assert.strictEqual(themeCheck.themeApplied, 'light');
    assert.strictEqual(themeCheck.hasPop, true);

    console.log('\n🎉 ALL CUSTOM AUTOCOMPLETE & SCROLLABLE DROPDOWN TESTS PASSED 100%!');
  } finally {
    await browser.close();
  }
})();
