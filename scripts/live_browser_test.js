const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runLiveTest() {
  console.log('🚀 Launching Real Chrome Headless QA Simulation...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1600,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.error('  ❌ Browser Console Error:', msg.text());
    }
  });

  page.on('pageerror', err => {
    errors.push(err.message);
    console.error('  ❌ Uncaught Page Error:', err.message);
  });

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
    } else if (url.includes('/api/dashboard/summary') || url.includes('/api/dashboard/pulse')) {
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
          ledgers: [
            { id: 1, name: 'PATEL RASIKBHAI NATHABHAI', city: 'Ahmedabad', mobile: '9876543210', group_type: 'Sundry Debtors', current_balance: 0 }
          ]
        })
      });
    } else if (url.includes('/api/masters/')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, categories: [], items: [], warehouses: [], brands: [] })
      });
    } else if (url.includes('/api/bom/')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          orders: [
            { order_no: 'NP003701', customer_name: 'PATEL RASIKBHAI NATHABHAI', pending_count: 2, created_at: '2026-08-24' }
          ]
        })
      });
    } else if (url.includes('/api/sessions/live') || url.includes('/api/auth/heartbeat')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, activeUsers: [{ username: 'param', role: 'SuperAdmin' }] })
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

  console.log('🌐 Step 1: Navigating to http://localhost:5000 and bootstrapping session...');
  await page.goto('http://localhost:5000', { waitUntil: 'domcontentloaded' });

  // Store active session in localStorage
  await page.evaluate(() => {
    localStorage.setItem('egs_session', JSON.stringify({
      token: 'jwt_valid_live_token',
      username: 'param',
      role: 'SuperAdmin'
    }));
  });

  console.log('🔄 Step 2: Testing Hard Refresh (First-paint instant Dashboard render)...');
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  const dashboardState = await page.evaluate(() => {
    const content = document.getElementById('content');
    const cards = document.querySelectorAll('.dash-shell, .dash-welcome-bar, .banner, .dash-btn-quick');
    const shell = document.querySelector('.shell');
    return {
      currentPage: window.CURRENT_PAGE_ID,
      contentLength: content ? content.innerHTML.length : 0,
      elementsCount: cards.length,
      shellDisplay: shell ? shell.style.display : 'none',
      hasErrorCard: !!document.querySelector('.data-fetch-failed, .alert-danger')
    };
  });
  console.log('  📊 Dashboard render check after Hard Refresh:', dashboardState);

  // Step 3: Test Navigation across 10 major pages
  const testPages = ['partyledger', 'masters', 'purchase', 'sales', 'bom', 'scansheet', 'vouchers', 'reports', 'financialreports', 'dashboard'];
  for (const p of testPages) {
    await page.evaluate(pageId => {
      if (typeof window.go === 'function') window.go(pageId);
    }, p);
    await new Promise(r => setTimeout(r, 400));

    const check = await page.evaluate(pageId => {
      const content = document.getElementById('content');
      return {
        currentPage: window.CURRENT_PAGE_ID,
        contentLength: content ? content.innerHTML.length : 0,
        hasError: !!document.querySelector('.data-fetch-failed, .alert-danger')
      };
    }, p);
    console.log(`     Page #${p}:`, check);
  }

  // Step 4: Test Shree Sava / Tally Escape Ladder Keyboard Navigation
  console.log('  ⌨️ Testing Keyboard Ladder: A -> L -> C -> Esc -> Esc -> Esc');
  await page.evaluate(() => {
    window.go('dashboard');
    document.body.focus();
  });
  await new Promise(r => setTimeout(r, 300));

  // Focus a non-input element so hotkeys trigger
  await page.keyboard.press('KeyA');
  await new Promise(r => setTimeout(r, 250));
  await page.keyboard.press('KeyL');
  await new Promise(r => setTimeout(r, 250));
  await page.keyboard.press('KeyC');
  await new Promise(r => setTimeout(r, 500));

  const afterCreateForm = await page.evaluate(() => {
    const lfOverlay = document.getElementById('ledgerFormOverlay');
    return {
      formOpen: !!(lfOverlay && lfOverlay.classList.contains('show')),
      currentPage: window.CURRENT_PAGE_ID
    };
  });
  console.log('     Create Ledger Form state:', afterCreateForm);

  // 1st Escape (Closes form, opens Tier 1 + Tier 2)
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));
  const afterEsc1 = await page.evaluate(() => {
    const activeFlyout = document.getElementById('egsActiveSidebarFlyout');
    const nested = activeFlyout ? activeFlyout.querySelector('.egs-flyout-item.has-nested.nested-open') : null;
    return {
      tier1FlyoutOpen: !!activeFlyout,
      tier2NestedFlyoutOpen: !!nested
    };
  });
  console.log('     After 1st Esc state (Form closed -> Flyouts visible):', afterEsc1);

  // 2nd Escape (Closes Tier 2 nested flyout, leaves Tier 1 open)
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));
  const afterEsc2 = await page.evaluate(() => {
    const activeFlyout = document.getElementById('egsActiveSidebarFlyout');
    const nested = activeFlyout ? activeFlyout.querySelector('.egs-flyout-item.has-nested.nested-open') : null;
    return {
      tier1FlyoutOpen: !!activeFlyout,
      tier2NestedFlyoutOpen: !!nested
    };
  });
  console.log('     After 2nd Esc state (Tier 2 closed -> Tier 1 open):', afterEsc2);

  // 3rd Escape (Closes Tier 1 flyout, returns to Dashboard)
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));
  const afterEsc3 = await page.evaluate(() => {
    const activeFlyout = document.getElementById('egsActiveSidebarFlyout');
    return {
      flyoutOpen: !!activeFlyout,
      currentPage: window.CURRENT_PAGE_ID
    };
  });
  console.log('     After 3rd Esc state (Tier 1 closed -> Dashboard):', afterEsc3);

  await browser.close();

  console.log('\n======================================================');
  console.log(`TOTAL BROWSER CONSOLE ERRORS: ${errors.length}`);
  if (errors.length > 0) {
    console.log('Errors:', errors);
  } else {
    console.log('🎉 100% CLEAN BROWSER PASS: ZERO JAVASCRIPT / DOM ERRORS!');
  }
  console.log('======================================================');
}

runLiveTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
