const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.log('PAGE ERROR:', err));

  page.on('requestfinished', async (request) => {
    if (request.url().includes('/api/profiles/')) {
      const response = await request.response();
      console.log('API', request.method(), request.url(), '->', response.status());
    }
  });

  page.on('requestfailed', (req) => console.log('REQUEST FAILED:', req.url(), req.failure()));

  console.log('Navigating to profile page...');
  await page.goto('http://localhost:4200/profile/testuser', { waitUntil: 'networkidle' });

  // Wait a little for SPA fetches to complete
  await page.waitForTimeout(1000);

  const loadingVisible = await page.locator('text=Loading profile...').isVisible().catch(() => false);
  const name = await page.locator('mat-card-title').textContent().catch(() => null);
  console.log('Loading visible:', loadingVisible);
  console.log('Profile name (mat-card-title):', name && name.trim());

  await browser.close();
})();