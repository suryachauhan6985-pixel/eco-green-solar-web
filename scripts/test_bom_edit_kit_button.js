// scripts/test_bom_edit_kit_button.js
const assert = require('assert');
const puppeteer = require('puppeteer-core');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

console.log('🧪 Testing BOM Kit Edit Button (#bomBtnEditKit) & Kit Builder Panel...\n');

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
    page.on('pageerror', err => { console.log('PAGEERROR:', err.message); errors.push(err.message); });
    page.on('console', msg => console.log('CONSOLE:', msg.text()));

    await page.evaluateOnNewDocument(() => {
      const sess = JSON.stringify({ username: 'admin', role: 'SuperAdmin', token: 'mock_token_123' });
      sessionStorage.setItem('egs_session', sess);
      localStorage.setItem('egs_session', sess);
      localStorage.setItem('auth_token', 'mock_token_123');
      localStorage.setItem('user_role', 'SuperAdmin');
      localStorage.setItem('username', 'admin');
      window.currentUserRole = 'SuperAdmin';
    });

    const mockKits = {
      'custom_3-3-kw-resedential': {
        label: '3.3 kw resedential',
        kw: '3.3',
        sections: [
          {
            title: 'SOLAR PANEL',
            items: [
              { sr: '1', name: 'ADANI 550', model: '550 W', qty: '2', remarks: '' }
            ]
          },
          {
            title: 'INVERTER',
            items: [
              { sr: '2', name: 'POLYCAB 3.6', model: '3.6 KW', qty: '1', remarks: '' }
            ]
          }
        ]
      }
    };

    await page.setRequestInterception(true);
    page.on('request', req => {
      const url = req.url();
      if (url.includes('/api/auth/app-settings') || url.includes('/api/auth/profile')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, settings: { erp_mode: 'hybrid' }, username: 'admin', role: 'SuperAdmin' })
        });
      } else if (url.includes('/api/bom/kits')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockKits)
        });
      } else if (url.includes('/api/bom/challan/categories')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, mapping: {} })
        });
      } else if (url.includes('/api/bom/orders')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        });
      } else if (url.includes('/api/masters/categories')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 1, name: 'DCR SOLAR PANEL', serial_mandatory: 1 },
            { id: 2, name: 'NON DCR SOLAR PANEL', serial_mandatory: 1 },
            { id: 3, name: 'INVERTER', serial_mandatory: 1 }
          ])
        });
      } else if (url.includes('/api/masters/items')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 101, name: 'ADANI 550', brand_name: 'ADANI', category: 'DCR SOLAR PANEL', model: '550 W' },
            { id: 102, name: 'POLYCAB 3.6', brand_name: 'POLYCAB', category: 'INVERTER', model: '3.6 KW' }
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

    // Navigate to BOM Entry page
    await page.evaluate(() => {
      if (window.go) window.go('bom');
    });
    await new Promise((r) => setTimeout(r, 600));

    await page.evaluate(() => {
      const home = document.getElementById('bomHomeView');
      const entry = document.getElementById('bomEntryView');
      if (home) home.style.display = 'none';
      if (entry) entry.style.display = '';
    });
    await page.waitForSelector('#bomKitSelect', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 400));

    // Check kit select and edit button visibility
    const kitState = await page.evaluate(() => {
      const kitSel = document.getElementById('bomKitSelect');
      const editBtn = document.getElementById('bomBtnEditKit');
      const deleteBtn = document.getElementById('bomBtnDeleteKit');
      const builderPanel = document.getElementById('bomKitBuilderPanel');
      const itemsPanel = document.getElementById('bomKitItemsPanel');

      return {
        userRole: window.currentUserRole,
        localRole: localStorage.getItem('user_role'),
        kitSelected: kitSel ? kitSel.value : null,
        isCustomKey: kitSel ? (typeof window.bomIsCustomKitKey === 'function' ? window.bomIsCustomKitKey(kitSel.value) : kitSel.value.startsWith('custom_')) : false,
        optionsCount: kitSel ? kitSel.options.length : 0,
        editBtnStyleDisplay: editBtn ? editBtn.style.display : null,
        editBtnVisible: editBtn ? window.getComputedStyle(editBtn).display !== 'none' : false,
        deleteBtnVisible: deleteBtn ? window.getComputedStyle(deleteBtn).display !== 'none' : false,
        builderPanelOpen: builderPanel ? window.getComputedStyle(builderPanel).display !== 'none' : false,
        itemsPanelVisible: itemsPanel ? window.getComputedStyle(itemsPanel).display !== 'none' : false
      };
    });

    console.log('Initial Kit State:', kitState);
    assert.ok(kitState.kitSelected, 'Custom kit should be selected in dropdown');
    assert.strictEqual(kitState.editBtnVisible, true, 'Edit kit pencil button (#bomBtnEditKit) must be visible for custom kits');
    assert.strictEqual(kitState.deleteBtnVisible, true, 'Delete kit trash button (#bomBtnDeleteKit) must be visible for custom kits');
    assert.strictEqual(kitState.builderPanelOpen, false, 'Kit builder panel should initially be hidden');

    console.log('✔ Verified: Edit (#bomBtnEditKit) and Delete (#bomBtnDeleteKit) buttons are visible for selected custom kit.');

    // Click Edit button (#bomBtnEditKit)
    await page.evaluate(() => {
      const btn = document.getElementById('bomBtnEditKit');
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 400));

    // Check builder panel open state and populated values
    const builderState = await page.evaluate(() => {
      const builderPanel = document.getElementById('bomKitBuilderPanel');
      const titleEl = document.getElementById('bomKitBuilderTitle');
      const labelInput = document.getElementById('bomNewKitLabel');
      const kwInput = document.getElementById('bomNewKitKw');
      const saveBtnLabel = document.getElementById('bomBtnSaveKitTemplateLabel');
      const sectionsContainer = document.getElementById('bomNewKitSections');
      const itemsPanel = document.getElementById('bomKitItemsPanel');

      return {
        builderPanelOpen: builderPanel ? window.getComputedStyle(builderPanel).display !== 'none' : false,
        itemsPanelHidden: itemsPanel ? window.getComputedStyle(itemsPanel).display === 'none' : false,
        titleText: titleEl ? titleEl.textContent.trim() : '',
        kitLabelValue: labelInput ? labelInput.value : '',
        kitKwValue: kwInput ? kwInput.value : '',
        saveBtnText: saveBtnLabel ? saveBtnLabel.textContent.trim() : '',
        sectionsCount: sectionsContainer ? sectionsContainer.querySelectorAll('.bom-items-form-table').length : 0
      };
    });

    console.log('Builder State after Edit click:', builderState);
    assert.strictEqual(builderState.builderPanelOpen, true, 'Kit builder panel MUST open when Edit button is clicked');
    assert.strictEqual(builderState.itemsPanelHidden, true, 'Kit items preview panel should be hidden while editing');
    assert.ok(builderState.titleText.includes('Edit BOM Kit'), 'Title should say Edit BOM Kit & Template');
    assert.strictEqual(builderState.kitLabelValue, '3.3 kw resedential', 'Kit name input should be pre-filled');
    assert.strictEqual(builderState.kitKwValue, '3.3', 'Kit kW input should be pre-filled');
    assert.strictEqual(builderState.saveBtnText, 'Update Kit Template', 'Save button should say Update Kit Template');
    assert.strictEqual(builderState.sectionsCount, 2, 'Should render 2 sections (SOLAR PANEL and INVERTER)');

    console.log('✔ Verified: Edit Kit (#bomBtnEditKit) opens builder with pre-filled kit data and correct Update button.');

    // Test Cancel button (#bomBtnCancelKitBuilder)
    await page.evaluate(() => {
      const btn = document.getElementById('bomBtnCancelKitBuilder');
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    const cancelState = await page.evaluate(() => {
      const builderPanel = document.getElementById('bomKitBuilderPanel');
      const itemsPanel = document.getElementById('bomKitItemsPanel');
      return {
        builderPanelClosed: builderPanel ? window.getComputedStyle(builderPanel).display === 'none' : false,
        itemsPanelRestored: itemsPanel ? window.getComputedStyle(itemsPanel).display !== 'none' : false
      };
    });

    console.log('Cancel State:', cancelState);
    assert.strictEqual(cancelState.builderPanelClosed, true, 'Builder panel should close on Cancel');
    assert.strictEqual(cancelState.itemsPanelRestored, true, 'Items preview panel should be restored on Cancel');

    console.log('✔ Verified: Cancel button closes builder and restores normal view.');

    assert.strictEqual(errors.length, 0, `Errors encountered: ${errors.join(', ')}`);
    console.log('\n🎉 ALL BOM EDIT KIT BUTTON TESTS PASSED 100%!');
  } finally {
    await browser.close();
  }
})();
