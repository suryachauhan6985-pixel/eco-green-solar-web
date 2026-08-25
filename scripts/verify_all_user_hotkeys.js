const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testAllUserHotkeys() {
  console.log('🚀 Running Full Hotkey & Escape Ladder Verification Suite...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });

  // Enable request interception for mock API endpoints
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
        body: JSON.stringify({
          ok: true,
          stats: { panels: 27, inverters: 0, batteries: 0, skus: 68, available: 50, assigned: 0, total_dispatch: 0, damaged: 0 },
          low_stock_count: 67,
          pulse: { inward: 0, dispatched: 0, challans: 1, active_godowns: 1 }
        })
      });
    } else if (url.includes('/api/ledgers')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          ledgers: [{ id: 1, name: 'PATEL RASIKBHAI NATHABHAI', city: 'Ahmedabad', mobile: '9876543210', group_type: 'Sundry Debtors', current_balance: 0 }]
        })
      });
    } else if (url.includes('/api/masters/')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, categories: [], items: [], warehouses: [], brands: [] })
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

  async function getFlyoutState() {
    return page.evaluate(() => {
      const active = document.getElementById('egsActiveSidebarFlyout');
      const nested = active ? active.querySelector('.egs-flyout-item.has-nested.nested-open') : null;
      const selectedT1 = active ? active.querySelector('.egs-flyout-list > .tier1-item.selected') : null;
      return {
        flyoutOpen: !!active,
        title: active ? (active.querySelector('.egs-flyout-header span') ? active.querySelector('.egs-flyout-header span').textContent : '') : '',
        nestedOpen: !!nested,
        selectedT1Text: selectedT1 ? selectedT1.textContent.trim() : '',
        currentPage: window.CURRENT_PAGE_ID
      };
    });
  }

  // --- TEST 1: D -> Esc (Display Flyout opens and closes) ---
  console.log('\n--- 1. Testing D -> Esc ---');
  await page.keyboard.press('KeyD');
  await new Promise(r => setTimeout(r, 200));
  let s1 = await getFlyoutState();
  console.log('After D:', s1);
  if (!s1.flyoutOpen) throw new Error('D did not open Display flyout');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  let s1_esc = await getFlyoutState();
  console.log('After Esc:', s1_esc);
  if (s1_esc.flyoutOpen) throw new Error('Esc did not close Display flyout');
  console.log('✔ PASS: D -> Esc works cleanly');

  // --- TEST 2: U -> Esc (Utilities Flyout opens and closes) ---
  console.log('\n--- 2. Testing U -> Esc ---');
  await page.keyboard.press('KeyU');
  await new Promise(r => setTimeout(r, 200));
  let s2 = await getFlyoutState();
  console.log('After U:', s2);
  if (!s2.flyoutOpen) throw new Error('U did not open Utilities flyout');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  let s2_esc = await getFlyoutState();
  console.log('After Esc:', s2_esc);
  if (s2_esc.flyoutOpen) throw new Error('Esc did not close Utilities flyout');
  console.log('✔ PASS: U -> Esc works cleanly');

  // --- TEST 3: A -> Esc (Accounts Info opens and closes) ---
  console.log('\n--- 3. Testing A -> Esc ---');
  await page.keyboard.press('KeyA');
  await new Promise(r => setTimeout(r, 200));
  let s3 = await getFlyoutState();
  console.log('After A:', s3);
  if (!s3.flyoutOpen) throw new Error('A did not open Accounts flyout');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  let s3_esc = await getFlyoutState();
  console.log('After Esc:', s3_esc);
  if (s3_esc.flyoutOpen) throw new Error('Esc did not close Accounts flyout');
  console.log('✔ PASS: A -> Esc works cleanly');

  // --- TEST 4: D -> A (Display -> Account Books nested submenu) -> Esc ---
  console.log('\n--- 4. Testing D -> A -> Esc ---');
  await page.keyboard.press('KeyD');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyA');
  await new Promise(r => setTimeout(r, 200));
  let s4 = await getFlyoutState();
  console.log('After D -> A (Tier 2 open):', s4);
  if (!s4.nestedOpen) throw new Error('A did not open Account Books nested submenu');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  let s4_esc1 = await getFlyoutState();
  console.log('After 1st Esc (Tier 2 closed, Tier 1 open):', s4_esc1);
  if (s4_esc1.nestedOpen || !s4_esc1.flyoutOpen) throw new Error('1st Esc should close nested menu and keep Display flyout open');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  let s4_esc2 = await getFlyoutState();
  console.log('After 2nd Esc (Flyout closed, on Dashboard):', s4_esc2);
  if (s4_esc2.flyoutOpen) throw new Error('2nd Esc should close Display flyout');
  console.log('✔ PASS: D -> A -> Esc -> Esc works cleanly');

  // --- TEST 5: D -> A -> L -> Esc (Display -> Account Books -> Ledger -> Esc) ---
  console.log('\n--- 5. Testing D -> A -> L -> Esc ---');
  await page.keyboard.press('KeyD');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyA');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyL');
  await new Promise(r => setTimeout(r, 400));
  let s5 = await getFlyoutState();
  console.log('After D -> A -> L (On Party Ledger page):', s5);
  if (s5.currentPage !== 'partyledger') throw new Error('Should be on partyledger page');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));
  let s5_esc1 = await getFlyoutState();
  console.log('After 1st Esc (Back to Display -> Account Books flyout):', s5_esc1);
  if (!s5_esc1.flyoutOpen) throw new Error('1st Esc should step back to Display flyout');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  let s5_esc2 = await getFlyoutState();
  console.log('After 2nd Esc:', s5_esc2);

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  let s5_esc3 = await getFlyoutState();
  console.log('After 3rd Esc (On Dashboard):', s5_esc3);
  if (s5_esc3.flyoutOpen || s5_esc3.currentPage !== 'dashboard') throw new Error('Should be on dashboard');
  console.log('✔ PASS: D -> A -> L -> Esc ladder works cleanly');

  // --- TEST 6: U -> B -> Esc (Utilities -> Backup -> Esc) ---
  console.log('\n--- 6. Testing U -> B -> Esc ---');
  await page.keyboard.press('KeyU');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyB');
  await new Promise(r => setTimeout(r, 400));
  let s6 = await getFlyoutState();
  console.log('After U -> B (On Backup page):', s6);
  if (s6.currentPage !== 'backup') throw new Error('Should be on backup page');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));
  let s6_esc1 = await getFlyoutState();
  console.log('After 1st Esc (Back to Utilities flyout):', s6_esc1);
  if (!s6_esc1.flyoutOpen) throw new Error('1st Esc should step back to Utilities flyout');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  let s6_esc2 = await getFlyoutState();
  console.log('After 2nd Esc (On Dashboard):', s6_esc2);
  if (s6_esc2.flyoutOpen || s6_esc2.currentPage !== 'dashboard') throw new Error('Should be on dashboard');
  console.log('✔ PASS: U -> B -> Esc ladder works cleanly');

  // --- TEST 7: U -> P -> Esc (Utilities -> Print Template Designer -> Esc) ---
  console.log('\n--- 7. Testing U -> P -> Esc ---');
  await page.keyboard.press('KeyU');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyP');
  await new Promise(r => setTimeout(r, 400));
  let s7 = await getFlyoutState();
  console.log('After U -> P (On Template Designer page):', s7);
  if (s7.currentPage !== 'template_designer') throw new Error('Should be on template_designer page');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));
  let s7_esc1 = await getFlyoutState();
  console.log('After 1st Esc (Back to Utilities flyout):', s7_esc1);
  if (!s7_esc1.flyoutOpen) throw new Error('1st Esc should step back to Utilities flyout');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  let s7_esc2 = await getFlyoutState();
  console.log('After 2nd Esc (On Dashboard):', s7_esc2);
  if (s7_esc2.flyoutOpen || s7_esc2.currentPage !== 'dashboard') throw new Error('Should be on dashboard');
  console.log('✔ PASS: U -> P -> Esc ladder works cleanly');

  // --- TEST 8: Tab focus switching (A -> L -> I -> G -> U) ---
  console.log('\n--- 8. Testing Tab focus switching (A -> L -> I -> G -> U) ---');
  await page.keyboard.press('KeyA');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyL');
  await new Promise(r => setTimeout(r, 200));
  let s8_l = await getFlyoutState();
  console.log('After A -> L (Ledger Info open):', s8_l);

  // Press I while in Ledger Info -> switches to Item Info!
  await page.keyboard.press('KeyI');
  await new Promise(r => setTimeout(r, 200));
  let s8_i = await getFlyoutState();
  console.log('After pressing I (Switched to Item Info):', s8_i);
  if (!s8_i.nestedOpen || !s8_i.selectedT1Text.includes('Item')) throw new Error('Pressing I should switch to Item Info');

  // Press G while in Item Info -> navigates directly to Group / Category Info!
  await page.keyboard.press('KeyG');
  await new Promise(r => setTimeout(r, 400));
  let s8_g = await getFlyoutState();
  console.log('After pressing G (Navigated to Masters / Category):', s8_g);
  if (s8_g.currentPage !== 'masters') throw new Error('Pressing G should navigate to masters');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  console.log('✔ PASS: Tab focus switching (A -> L -> I -> G) works cleanly');

  // --- TEST 9: A -> I -> C -> Esc (Accounts -> Item Info -> Create -> Esc) ---
  console.log('\n--- 9. Testing A -> I -> C -> Esc ---');
  await page.keyboard.press('KeyA');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyI');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyC');
  await new Promise(r => setTimeout(r, 400));
  let s9 = await getFlyoutState();
  console.log('After A -> I -> C (On Item Registration / Create):', s9);
  if (s9.currentPage !== 'masters') throw new Error('Should be on masters page');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));
  let s9_esc1 = await getFlyoutState();
  console.log('After 1st Esc (Back to Accounts -> Item Info flyout):', s9_esc1);
  if (!s9_esc1.flyoutOpen) throw new Error('1st Esc should step back to Accounts flyout');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  let s9_esc2 = await getFlyoutState();
  console.log('After 2nd Esc (Nested closed):', s9_esc2);

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  let s9_esc3 = await getFlyoutState();
  console.log('After 3rd Esc (On Dashboard):', s9_esc3);
  if (s9_esc3.flyoutOpen || s9_esc3.currentPage !== 'dashboard') throw new Error('Should be on dashboard');
  console.log('✔ PASS: A -> I -> C -> Esc ladder works cleanly');

  await browser.close();

  console.log('\n======================================================');
  console.log('🎉 ALL 9 USER HOTKEY & ESCAPE LADDER TESTS PASSED WITH 100% SUCCESS!');
  console.log('======================================================');
}

testAllUserHotkeys().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
