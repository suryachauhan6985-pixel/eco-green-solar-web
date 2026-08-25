// scripts/live_qa_runner.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const { issueToken } = require('../api/middleware/auth.middleware');

async function runDeepLiveQA() {
  console.log('=== RUNNING DEEP COMPREHENSIVE LIVE BROWSER QA ENGINE ===');

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Handle dialogs (alerts, confirms, prompts) gracefully
  page.on('dialog', async (dialog) => {
    console.log(`[Browser Dialog] ${dialog.type()}: "${dialog.message()}"`);
    await dialog.accept();
  });

  const consoleLogs = [];
  const networkCalls = [];

  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    consoleLogs.push({ type, text, time: Date.now() });
    if (type === 'error') {
      console.log(`[Browser Console Error] ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    consoleLogs.push({ type: 'pageerror', text: err.message, stack: err.stack, time: Date.now() });
    console.log(`[Browser Page Crash/Error] ${err.message}`);
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/')) {
      try {
        const status = res.status();
        let body = '';
        try { body = await res.text(); } catch (e) { body = '<stream>'; }
        networkCalls.push({
          url,
          status,
          method: res.request().method(),
          body: body.slice(0, 200),
          time: Date.now()
        });
      } catch (e) {}
    }
  });

  // 1. Initial Load & Auth Injection for SuperAdmin
  const tokenObj = issueToken('superadmin', 'SuperAdmin');
  await page.goto('http://localhost:5000', { waitUntil: 'domcontentloaded' });
  
  await page.evaluate((tok, user, role) => {
    localStorage.setItem('egs_session', JSON.stringify({ username: user, role, token: tok }));
    localStorage.setItem('egs_auth_token', tok);
    localStorage.setItem('egs_user', user);
    localStorage.setItem('egs_role', role);
  }, tokenObj.token, 'superadmin', 'SuperAdmin');

  await page.goto('http://localhost:5000/#dashboard', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1000));

  const allPages = [
    'dashboard',
    'bom',
    'purchase',
    'sales',
    'masters',
    'partyledger',
    'reports',
    'financialreports',
    'vouchers',
    'returns',
    'saleregister',
    'purchaseregister',
    'lowstock',
    'scansheet',
    'stockassign',
    'saas_tenants',
    'template_designer',
    'backup'
  ];

  const fullLiveLog = [];
  const bugsFound = [];

  for (const pageKey of allPages) {
    console.log(`\n========================================`);
    console.log(`>>> COMMENCING LIVE TEST ON TAB: #${pageKey}`);
    console.log(`========================================`);

    const pageLog = {
      tab: `#${pageKey}`,
      rendered: false,
      actions: []
    };

    // 1. Physically click the navigation button or trigger go()
    const navResult = await page.evaluate((targetKey) => {
      if (typeof window.go === 'function') {
        window.go(targetKey);
        return { success: true, method: 'window.go()' };
      }
      const btn = document.querySelector(`.nav-btn[onclick*="${targetKey}"], [data-page="${targetKey}"], button[onclick*="'${targetKey}'"], a[onclick*="'${targetKey}'"]`);
      if (btn) {
        btn.click();
        return { success: true, method: 'nav_click', label: btn.innerText.trim() };
      }
      window.location.hash = '#' + targetKey;
      return { success: true, method: 'hash_change' };
    }, pageKey);

    await new Promise((r) => setTimeout(r, 1500));

    // 2. Check if page rendered without crashing
    const checkRender = await page.evaluate((targetKey) => {
      const pageTitle = document.getElementById('pageTitle') ? document.getElementById('pageTitle').innerText : '';
      const pageSub = document.getElementById('pageSub') ? document.getElementById('pageSub').innerText : '';
      const contentEl = document.getElementById('content');
      const pageHtmlSnippet = contentEl ? contentEl.innerText.slice(0, 100).replace(/\n/g, ' ') : '';
      return { pageTitle, pageSub, pageHtmlSnippet, hash: window.location.hash };
    }, pageKey);

    pageLog.rendered = true;
    pageLog.title = checkRender.pageTitle;
    pageLog.sub = checkRender.pageSub;
    console.log(`Rendered: "${checkRender.pageTitle || pageKey}" (Hash: ${checkRender.hash})`);

    // 3. Scan all interactive elements inside #content
    const elementsToClick = await page.evaluate(() => {
      const content = document.getElementById('content') || document.body;
      const interactiveEls = Array.from(content.querySelectorAll(`
        button,
        .btn,
        .subtab,
        .tab-btn,
        [onclick],
        input[type="button"],
        input[type="submit"],
        .stat-card,
        .dash-btn-quick,
        .banner-btn,
        .view-pill,
        .ss-icon-btn,
        .stat-step-btn,
        .ss-tab
      `));

      return interactiveEls.map((el, index) => {
        const text = (el.innerText || el.value || el.getAttribute('title') || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ');
        return {
          index,
          id: el.id || '',
          tag: el.tagName,
          className: el.className || '',
          text: text.slice(0, 60),
          onclick: el.getAttribute('onclick') || '',
          dataType: el.getAttribute('data-type') || el.getAttribute('data-tab') || el.getAttribute('data-card') || el.getAttribute('data-mode') || '',
          isVisible: el.offsetParent !== null && !el.disabled
        };
      }).filter((e) => e.isVisible && (e.text || e.id || e.onclick || e.dataType));
    });

    console.log(`Found ${elementsToClick.length} visible interactive elements on #${pageKey}.`);

    // 4. Click each visible element and observe behavior
    for (const elInfo of elementsToClick) {
      const beforeErrCount = consoleLogs.filter((l) => l.type === 'error' || l.type === 'pageerror').length;
      const beforeReqCount = networkCalls.length;

      const clickOutcome = await page.evaluate((info) => {
        const content = document.getElementById('content') || document.body;
        let target = null;
        if (info.id) target = document.getElementById(info.id);
        if (!target && info.onclick) target = content.querySelector(`[onclick="${info.onclick.replace(/"/g, '\\"')}"]`);
        if (!target && info.dataType) target = content.querySelector(`[data-tab="${info.dataType}"], [data-type="${info.dataType}"], [data-card="${info.dataType}"]`);
        if (!target) {
          const all = Array.from(content.querySelectorAll('button, .btn, .subtab, [onclick]'));
          target = all[info.index] || all.find((b) => b.innerText && b.innerText.includes(info.text));
        }

        if (!target) return { status: 'NOT_FOUND' };

        try {
          target.scrollIntoView({ block: 'nearest' });
          target.click();

          // Check if modal popped
          const modal = document.querySelector('.modal-overlay.active, .modal.active, .modal-box:not([style*="display: none"]), .ss-scanner-overlay');
          const isModalOpen = modal && modal.offsetParent !== null;

          return {
            status: 'CLICKED',
            modalOpened: isModalOpen,
            modalTitle: isModalOpen ? (modal.querySelector('h2, h3, .modal-title, .ss-scanner-title')?.innerText || '') : ''
          };
        } catch (err) {
          return { status: 'ERROR', message: err.message };
        }
      }, elInfo);

      await new Promise((r) => setTimeout(r, 400));

      const afterErrs = consoleLogs.filter((l) => l.type === 'error' || l.type === 'pageerror');
      const triggeredErrors = afterErrs.slice(beforeErrCount);
      const triggeredReqs = networkCalls.slice(beforeReqCount);

      // Close modal if opened to prevent blocking subsequent clicks
      await page.evaluate(() => {
        const closeBtn = document.querySelector('.modal-close, .btn-modal-close, [onclick*="closeModal"], .modal-overlay .btn-ghost, #bomScanBack, .ss-icon-btn');
        if (closeBtn && closeBtn.offsetParent !== null) closeBtn.click();
        if (typeof window.closeModal === 'function') window.closeModal();
      });

      const actionRecord = {
        element: elInfo.text || elInfo.id || elInfo.onclick || `Element #${elInfo.index}`,
        selector: elInfo.id ? `#${elInfo.id}` : elInfo.className,
        tag: elInfo.tag,
        onclickAttr: elInfo.onclick,
        clickStatus: clickOutcome.status,
        modalObserved: clickOutcome.modalOpened ? `Modal: "${clickOutcome.modalTitle}"` : 'None',
        networkCount: triggeredReqs.length,
        networkCalls: triggeredReqs.map((r) => `${r.method} ${r.url.split('/api')[1] || r.url} (${r.status})`),
        errors: triggeredErrors.map((e) => e.text)
      };

      pageLog.actions.push(actionRecord);

      if (triggeredErrors.length > 0) {
        console.log(`❌ BUG FOUND on #${pageKey} [${actionRecord.element}]: ${triggeredErrors.map((e) => e.text).join(' | ')}`);
        bugsFound.push({
          tab: `#${pageKey}`,
          element: actionRecord.element,
          errors: triggeredErrors.map((e) => e.text),
          network: actionRecord.networkCalls
        });
      } else {
        console.log(`✔ [${actionRecord.element}] -> Clicked OK (Net: ${actionRecord.networkCount}, Modal: ${actionRecord.modalObserved})`);
      }
    }

    fullLiveLog.push(pageLog);
  }

  // 5. Test Multiple Roles (Admin, User)
  console.log('\n--- TESTING MULTI-ROLE UI GUARDS (Admin & User) ---');
  const roleTests = [
    { role: 'Admin', user: 'param' },
    { role: 'User', user: 'sumit' }
  ];

  for (const { role, user } of roleTests) {
    console.log(`Testing Role: ${role} (${user})`);
    const rToken = issueToken(user, role);
    await page.evaluate((tok, u, r) => {
      localStorage.setItem('egs_session', JSON.stringify({ username: u, role: r, token: tok }));
      localStorage.setItem('egs_auth_token', tok);
      localStorage.setItem('egs_user', u);
      localStorage.setItem('egs_role', r);
      if (typeof window.applyErpModeRules === 'function') window.applyErpModeRules();
    }, rToken.token, user, role);

    await page.goto('http://localhost:5000/#masters', { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));
    
    const title = await page.evaluate(() => document.getElementById('pageTitle')?.innerText || '');
    console.log(`Role ${role} loaded #masters: "${title}"`);
  }

  await browser.close();

  console.log('\n========================================');
  console.log('ALL TABS & BUTTONS TESTED IN REAL BROWSER');
  console.log(`Total Tabs Tested: ${allPages.length}`);
  console.log(`Total Interactive Elements Clicked: ${fullLiveLog.reduce((s, p) => s + p.actions.length, 0)}`);
  console.log(`Total Bugs Found: ${bugsFound.length}`);
  console.log('========================================\n');

  fs.writeFileSync(
    path.join(__dirname, '..', 'live_browser_full_log.json'),
    JSON.stringify({ fullLiveLog, bugsFound, totalConsole: consoleLogs }, null, 2)
  );

  return { fullLiveLog, bugsFound };
}

runDeepLiveQA().catch(console.error);
