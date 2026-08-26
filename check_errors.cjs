const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  await page.goto('http://localhost:5173/');
  await page.waitForTimeout(2000);

  // Try to interact
  const startDemoBtn = page.locator('#startDemoBtn');
  if (await startDemoBtn.count() > 0) {
    await startDemoBtn.click();
    await page.waitForTimeout(2000);
  }
  await browser.close();
})();
