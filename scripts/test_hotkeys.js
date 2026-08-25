const puppeteer = require('puppeteer-core');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testKeys() {
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('http://localhost:5000', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('egs_session', JSON.stringify({ token: 'tok', username: 'param', role: 'SuperAdmin' }));
  });
  await page.reload({ waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 600));

  // Test 1: Press 'D' on dashboard
  console.log('--- Test 1: Press D on Dashboard ---');
  await page.keyboard.press('KeyD');
  await new Promise(r => setTimeout(r, 200));
  let state = await page.evaluate(() => {
    const active = document.getElementById('egsActiveSidebarFlyout');
    return {
      flyoutOpen: !!active,
      title: active ? active.querySelector('.egs-flyout-title').textContent : null,
      focusTier: window.navState ? window.navState.focusTier : null
    };
  });
  console.log('After D:', state);

  // Press Escape to close D
  console.log('Press Escape to close D');
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  state = await page.evaluate(() => {
    const active = document.getElementById('egsActiveSidebarFlyout');
    return {
      flyoutOpen: !!active,
      focusTier: window.navState ? window.navState.focusTier : null
    };
  });
  console.log('After Esc on D:', state);

  // Test 2: Press U on dashboard
  console.log('\n--- Test 2: Press U on Dashboard ---');
  await page.keyboard.press('KeyU');
  await new Promise(r => setTimeout(r, 200));
  state = await page.evaluate(() => {
    const active = document.getElementById('egsActiveSidebarFlyout');
    return {
      flyoutOpen: !!active,
      title: active ? active.querySelector('.egs-flyout-title').textContent : null
    };
  });
  console.log('After U:', state);

  console.log('Press Escape to close U');
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 200));
  state = await page.evaluate(() => {
    const active = document.getElementById('egsActiveSidebarFlyout');
    return {
      flyoutOpen: !!active
    };
  });
  console.log('After Esc on U:', state);

  // Test 3: D -> A -> L -> Esc
  console.log('\n--- Test 3: D -> A -> L -> Esc ---');
  await page.keyboard.press('KeyD');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyA');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('KeyL');
  await new Promise(r => setTimeout(r, 400));
  state = await page.evaluate(() => ({
    page: window.CURRENT_PAGE_ID,
    flyoutOpen: !!document.getElementById('egsActiveSidebarFlyout')
  }));
  console.log('After D -> A -> L:', state);

  console.log('Press Escape on Party Ledger:');
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 400));
  state = await page.evaluate(() => ({
    page: window.CURRENT_PAGE_ID,
    flyoutOpen: !!document.getElementById('egsActiveSidebarFlyout')
  }));
  console.log('After Esc on Party Ledger:', state);

  await browser.close();
}

testKeys().catch(console.error);
