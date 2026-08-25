// scripts/test_bom_panel_category_matching.js
const assert = require('assert');
const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

console.log('🧪 Testing BOM Solar Panel Sub-Category (DCR / NON-DCR) Dynamic Resolution...\n');

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

    // Mock category & item responses where "Solar Panel" was replaced with "DCR SOLAR PANEL" & "NON DCR SOLAR PANEL"
    await page.setRequestInterception(true);
    page.on('request', req => {
      const url = req.url();
      if (url.includes('/api/auth/app-settings') || url.includes('/api/auth/profile')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, settings: { erp_mode: 'hybrid' }, username: 'admin', role: 'SuperAdmin' })
        });
      } else if (url.includes('/api/masters/categories')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 1, name: 'DCR SOLAR PANEL', serial_mandatory: 1 },
            { id: 2, name: 'NON DCR SOLAR PANEL', serial_mandatory: 1 },
            { id: 3, name: 'INVERTER', serial_mandatory: 1 },
            { id: 4, name: 'STRUCTURE', serial_mandatory: 0 },
            { id: 5, name: 'WIRE', serial_mandatory: 0 }
          ])
        });
      } else if (url.includes('/api/masters/items')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 101, name: 'ADANI 550', brand_name: 'ADANI', watt: 550, category: 'DCR SOLAR PANEL', model: '550 W', uom: 'Nos' },
            { id: 102, name: 'WAAREE 540', brand_name: 'WAAREE', watt: 540, category: 'NON DCR SOLAR PANEL', model: '540 W', uom: 'Nos' },
            { id: 103, name: 'POLYCAB 3.6', brand_name: 'POLYCAB', watt: 3600, category: 'INVERTER', model: '3.6 KW', uom: 'Nos' },
            { id: 104, name: 'GI STRUCTURE 3KW', brand_name: 'GI STRUCTURE', watt: 0, category: 'STRUCTURE', model: '3 KW', uom: 'Set' }
          ])
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

    // Navigate to BOM page
    await page.evaluate(() => {
      if (window.go) window.go('bom');
    });
    await new Promise((r) => setTimeout(r, 800));

    // Test BOM section rendering
    const checkResult = await page.evaluate(() => {
      // Create a test kit state mimicking user's screenshot
      const testKit = {
        name: '3.3 kw residential',
        sections: [
          {
            title: 'SOLAR PANEL',
            items: [
              { sr: '1', name: 'ADANI 550', qty: '2', remarks: '', serials: '' }
            ]
          },
          {
            title: 'INVERTER',
            items: [
              { sr: '2', name: 'POLYCAB 3.6', qty: '1', remarks: '', serials: '' }
            ]
          }
        ]
      };

      // Set currentKitState and re-render
      const ctx = window._bomModuleContext || {};
      if (typeof window.bomRenderScreenItemsHtml === 'function') {
        const html = window.bomRenderScreenItemsHtml(testKit.sections, {
          isAdmin: true,
          needsSerial: (name) => {
            const cat = (window._bomItemCategoryByName && window._bomItemCategoryByName[name]);
            return cat === 'DCR SOLAR PANEL' || cat === 'NON DCR SOLAR PANEL' || cat === 'INVERTER';
          }
        });
        const container = document.getElementById('bomItemsPreview') || document.getElementById('content');
        if (container) container.innerHTML = html;
      }

      // Check rendered dropdowns for Section 1 (SOLAR PANEL)
      const sec1CatSelect = document.querySelector('select[data-sec="0"][data-idx="0"][data-field="category"]');
      const sec1ModelSelect = document.querySelector('select[data-sec="0"][data-idx="0"][data-field="modelitem"]');
      const sec1SerialBtn = document.querySelector('button.bom-serial-btn[data-sec="0"][data-idx="0"]');

      // Check rendered dropdowns for Section 2 (INVERTER)
      const sec2CatSelect = document.querySelector('select[data-sec="1"][data-idx="0"][data-field="category"]');
      const sec2ModelSelect = document.querySelector('select[data-sec="1"][data-idx="0"][data-field="modelitem"]');
      const sec2SerialBtn = document.querySelector('button.bom-serial-btn[data-sec="1"][data-idx="0"]');

      return {
        sec1HasCategoryDropdown: !!sec1CatSelect,
        sec1SelectedCategory: sec1CatSelect ? sec1CatSelect.value : null,
        sec1HasModelDropdown: !!sec1ModelSelect,
        sec1SelectedModel: sec1ModelSelect ? sec1ModelSelect.value : null,
        sec1HasSerialBtn: !!sec1SerialBtn,
        sec2HasCategoryDropdown: !!sec2CatSelect,
        sec2SelectedCategory: sec2CatSelect ? sec2CatSelect.value : null,
        sec2HasModelDropdown: !!sec2ModelSelect,
        sec2SelectedModel: sec2ModelSelect ? sec2ModelSelect.value : null,
        sec2HasSerialBtn: !!sec2SerialBtn
      };
    });

    console.log('BOM Render Check Result:', checkResult);
    assert.strictEqual(checkResult.sec1HasCategoryDropdown, true, 'Section 1 (SOLAR PANEL) should have Category dropdown in Item Name column');
    assert.strictEqual(checkResult.sec1SelectedCategory, 'DCR SOLAR PANEL', 'Section 1 should select DCR SOLAR PANEL');
    assert.strictEqual(checkResult.sec1HasModelDropdown, true, 'Section 1 should have Model-item dropdown');
    assert.strictEqual(checkResult.sec1SelectedModel, 'ADANI 550', 'Section 1 Model dropdown should select ADANI 550');
    assert.strictEqual(checkResult.sec1HasSerialBtn, true, 'Section 1 should have Serial No button (0/2)');

    assert.strictEqual(checkResult.sec2HasCategoryDropdown, true, 'Section 2 (INVERTER) should have Category dropdown');
    assert.strictEqual(checkResult.sec2SelectedCategory, 'INVERTER', 'Section 2 should select INVERTER');
    assert.strictEqual(checkResult.sec2SelectedModel, 'POLYCAB 3.6', 'Section 2 Model dropdown should select POLYCAB 3.6');
    assert.strictEqual(checkResult.sec2HasSerialBtn, true, 'Section 2 should have Serial No button (0/1)');

    console.log('✔ Passed: SOLAR PANEL section now renders Category dropdown ("DCR SOLAR PANEL") and Model dropdown ("ADANI 550") with Serial No button!');
    console.log('✔ Passed: INVERTER section renders Category dropdown ("INVERTER") and Model dropdown ("POLYCAB 3.6") with Serial No button!');

    console.log('\n🎉 ALL BOM SOLAR PANEL SUB-CATEGORY RESOLUTION TESTS PASSED 100%!');
  } finally {
    await browser.close();
  }
})();
