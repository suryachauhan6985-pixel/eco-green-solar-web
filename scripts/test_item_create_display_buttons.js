const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testItemButtonsPlacement() {
  console.log('🚀 Running Item Create vs Display Buttons Placement QA Test...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });

  await page.setRequestInterception(true);
  page.on('request', req => {
    const url = req.url();
    if (url.includes('/api/auth/app-settings') || url.includes('/api/auth/profile')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, settings: { erp_mode: 'hybrid' }, username: 'param', role: 'SuperAdmin' })
      });
    } else if (url.includes('/api/dashboard/summary')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, stats: {}, low_stock_count: 0, pulse: {} })
      });
    } else if (url.includes('/api/')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, data: [] })
      });
    } else {
      req.continue();
    }
  });

  await page.goto('http://localhost:5000', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('egs_session', JSON.stringify({ token: 'tok', username: 'param', role: 'SuperAdmin' }));
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  // --- 1. Test A -> I -> C (Create Mode) ---
  console.log('\n--- 1. Testing A -> I -> C (Create Mode) ---');
  await page.keyboard.press('KeyA');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyI');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyC');
  await new Promise(r => setTimeout(r, 400));

  const createModeState = await page.evaluate(() => {
    const createPanel = document.getElementById('mItemCreatePanel');
    const catalogPanel = document.getElementById('mItemCatalogPanel');
    const importBtn = document.getElementById('mBtnImportItems');
    const tplBtn = document.getElementById('mBtnDownloadItemTemplate');

    return {
      currentPage: window.CURRENT_PAGE_ID,
      createPanelVisible: createPanel && createPanel.style.display !== 'none',
      catalogPanelVisible: catalogPanel && catalogPanel.style.display !== 'none',
      importBtnInsideCreate: createPanel ? createPanel.contains(importBtn) : false,
      tplBtnInsideCreate: createPanel ? createPanel.contains(tplBtn) : false
    };
  });

  console.log('Create Mode State:', createModeState);
  if (!createModeState.createPanelVisible) throw new Error('Create panel should be visible in A -> I -> C');
  if (createModeState.catalogPanelVisible) throw new Error('Catalog panel should be hidden in A -> I -> C');
  if (!createModeState.importBtnInsideCreate || !createModeState.tplBtnInsideCreate) {
    throw new Error('Upload Excel and Download Template buttons must be inside Create Panel');
  }
  console.log('✔ PASS: In A -> I -> C (Create Mode), Upload Excel and Download Template buttons are visible in Create Panel!');

  // Close back to dashboard
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));

  // --- 2. Test A -> I -> D (Display Mode) ---
  console.log('\n--- 2. Testing A -> I -> D (Display Mode) ---');
  await page.keyboard.press('KeyA');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyI');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyD');
  await new Promise(r => setTimeout(r, 400));

  const displayModeState = await page.evaluate(() => {
    const createPanel = document.getElementById('mItemCreatePanel');
    const catalogPanel = document.getElementById('mItemCatalogPanel');
    const importBtn = document.getElementById('mBtnImportItems');
    const tplBtn = document.getElementById('mBtnDownloadItemTemplate');

    return {
      currentPage: window.CURRENT_PAGE_ID,
      createPanelVisible: createPanel && createPanel.style.display !== 'none',
      catalogPanelVisible: catalogPanel && catalogPanel.style.display !== 'none',
      importBtnInsideCatalog: catalogPanel ? catalogPanel.contains(importBtn) : false,
      tplBtnInsideCatalog: catalogPanel ? catalogPanel.contains(tplBtn) : false
    };
  });

  console.log('Display Mode State:', displayModeState);
  if (displayModeState.createPanelVisible) throw new Error('Create panel should be hidden in A -> I -> D');
  if (!displayModeState.catalogPanelVisible) throw new Error('Catalog panel should be visible in A -> I -> D');
  if (displayModeState.importBtnInsideCatalog || displayModeState.tplBtnInsideCatalog) {
    throw new Error('Upload Excel and Download Template buttons should NOT be inside Catalog Panel in Display mode');
  }
  console.log('✔ PASS: In A -> I -> D (Display Mode), catalog table is cleanly displayed without create elements!');

  await browser.close();

  console.log('\n======================================================');
  console.log('🎉 BUTTONS PLACEMENT QA VERIFIED & PASSED 100%!');
  console.log('======================================================');
}

testItemButtonsPlacement().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
