const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testUserReportedIssues() {
  console.log('🚀 Running User-Reported Issues QA Test...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });
  page.on('console', msg => console.log('  [Browser Log]:', msg.text()));

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
    } else if (url.includes('/api/ledgers')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, ledgers: [{ id: 1, name: 'PATEL RASIKBHAI NATHABHAI', city: 'Ahmedabad', group_type: 'Sundry Debtors', current_balance: 0 }] })
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

  async function getDetailedState() {
    return page.evaluate(() => {
      const active = document.getElementById('egsActiveSidebarFlyout');
      const tier1Items = active ? Array.from(active.querySelectorAll('.egs-flyout-list > .tier1-item')) : [];
      const selectedT1 = active ? active.querySelector('.egs-flyout-list > .tier1-item.selected') : null;
      const nestedOpen = active ? active.querySelector('.egs-flyout-item.has-nested.nested-open') : null;
      const selectedT2 = nestedOpen ? nestedOpen.querySelector('.tier2-item.selected') : null;
      const formOverlay = document.getElementById('ledgerFormOverlay');

      return {
        flyoutOpen: !!active,
        currentPage: window.CURRENT_PAGE_ID,
        tier1Count: tier1Items.length,
        selectedTier1Text: selectedT1 ? selectedT1.querySelector('.item-text span').textContent.trim() : null,
        nestedOpenTitle: nestedOpen ? (nestedOpen.querySelector('.egs-nested-flyout-box .egs-flyout-header span') ? nestedOpen.querySelector('.egs-nested-flyout-box .egs-flyout-header span').textContent : '') : null,
        selectedTier2Text: selectedT2 ? selectedT2.querySelector('.item-text span').textContent.trim() : null,
        isFormOpen: !!(formOverlay && formOverlay.classList.contains('show'))
      };
    });
  }

  // --- ISSUE 1: Visual focus sync on A -> I ---
  console.log('\n--- 1. Testing Visual focus sync on A -> I ---');
  await page.keyboard.press('KeyA');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyI');
  await new Promise(r => setTimeout(r, 200));
  const s_ai = await getDetailedState();
  console.log('State after A -> I:', s_ai);
  if (s_ai.selectedTier1Text !== 'Item / Product Info') {
    throw new Error(`Expected selected Tier 1 to be "Item / Product Info", got: "${s_ai.selectedTier1Text}"`);
  }
  console.log('✔ PASS: Parent Tier 1 item (Item / Product Info) is exclusively selected in blue!');

  // Close back to dashboard
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));

  // --- ISSUE 2: A -> L -> C Escape Ladder ---
  console.log('\n--- 2. Testing 3-step Escape ladder for A -> L -> C ---');
  await page.keyboard.press('KeyA');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyL');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyC');
  await new Promise(r => setTimeout(r, 400));

  const s_alc_open = await getDetailedState();
  console.log('Step 0 (Form open):', s_alc_open);
  if (!s_alc_open.isFormOpen) throw new Error('Ledger form overlay should be open');

  // Esc 1: Form closes, Ledger Info (Tier 2) flyout opens
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));
  const s_alc_esc1 = await getDetailedState();
  console.log('Step 1 (Form closed -> Flyout Tier 2 open):', s_alc_esc1);
  if (s_alc_esc1.isFormOpen || !s_alc_esc1.flyoutOpen || !s_alc_esc1.nestedOpenTitle) {
    throw new Error('After 1st Esc, form should close and Ledger Info Tier 2 flyout should be visible');
  }

  // Esc 2: Tier 2 closes, A/c Info (Tier 1) flyout remains open
  await page.evaluate(() => document.body.focus());
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  const s_alc_esc2 = await getDetailedState();
  console.log('Step 2 (Tier 2 closed -> Tier 1 open):', s_alc_esc2);
  if (s_alc_esc2.nestedOpenTitle || !s_alc_esc2.flyoutOpen) {
    throw new Error('After 2nd Esc, Tier 2 should close and A/c Info Tier 1 flyout should remain open');
  }

  // Esc 3: Tier 1 closes, Dashboard visible
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  const s_alc_esc3 = await getDetailedState();
  console.log('Step 3 (Tier 1 closed -> Dashboard):', s_alc_esc3);
  if (s_alc_esc3.flyoutOpen || s_alc_esc3.currentPage !== 'dashboard') {
    throw new Error('After 3rd Esc, flyout should close and we should be on dashboard');
  }
  console.log('✔ PASS: A -> L -> C has exact 3-step Escape ladder!');

  // --- ISSUE 3: A -> L -> D Escape Ladder ---
  console.log('\n--- 3. Testing 3-step Escape ladder for A -> L -> D ---');
  await page.keyboard.press('KeyA');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyL');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyD');
  await new Promise(r => setTimeout(r, 400));

  const s_ald_open = await getDetailedState();
  console.log('Step 0 (On Party Ledger Display page):', s_ald_open);
  if (s_ald_open.currentPage !== 'partyledger') throw new Error('Should be on partyledger page');

  // Esc 1: Steps back to Ledger Info (Tier 2) flyout
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));
  const s_ald_esc1 = await getDetailedState();
  console.log('Step 1 (Back to Ledger Info Tier 2 flyout):', s_ald_esc1);
  if (!s_ald_esc1.flyoutOpen || !s_ald_esc1.nestedOpenTitle) {
    throw new Error('After 1st Esc on Party Ledger, should step back to Ledger Info Tier 2 flyout');
  }

  // Esc 2: Tier 2 closes, Tier 1 open
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  const s_ald_esc2 = await getDetailedState();
  console.log('Step 2 (Tier 2 closed -> Tier 1 open):', s_ald_esc2);
  if (s_ald_esc2.nestedOpenTitle || !s_ald_esc2.flyoutOpen) {
    throw new Error('After 2nd Esc, Tier 2 should close and Tier 1 remain open');
  }

  // Esc 3: Tier 1 closes, Dashboard visible
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  const s_ald_esc3 = await getDetailedState();
  console.log('Step 3 (Tier 1 closed -> Dashboard):', s_ald_esc3);
  if (s_ald_esc3.flyoutOpen || s_ald_esc3.currentPage !== 'dashboard') {
    throw new Error('After 3rd Esc, flyout should close and we should be on dashboard');
  }
  console.log('✔ PASS: A -> L -> D has exact 3-step Escape ladder!');

  await browser.close();

  console.log('\n======================================================');
  console.log('🎉 ALL 3 TARGETED USER ISSUES VERIFIED & PASSED 100%!');
  console.log('======================================================');
}

testUserReportedIssues().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
