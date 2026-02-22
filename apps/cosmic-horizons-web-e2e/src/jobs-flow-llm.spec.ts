import { test, expect, Page } from '@playwright/test';

// copy of jobs-flow.spec.ts adjusted for local-llm mode
async function loginAsTestUser(page: Page) {
  const token = 'fake';
  await page.addInitScript((jwt: string) => {
    window.sessionStorage.setItem('auth_token', jwt);
  }, token);
}

test('local-llm job flow', async ({ page }: { page: Page }) => {
  await loginAsTestUser(page);
  // force local-llm mode in storage
  await page.evaluate(() => {
    sessionStorage.setItem('REMOTE_COMPUTE_MODE', 'local-llm');
  });

  // stub endpoints as in main spec
  await page.route('**/api/jobs/capabilities', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ localLLM: true, baseUrlReachable: true }) });
  });
  await page.route('**/api/jobs/submit', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'llm-1' }) });
  });

  let count = 0;
  await page.route('**/api/jobs/*/status', async (route) => {
    const status = count++ === 0 ? 'QUEUED' : 'COMPLETED';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'llm-1', status, progress: status === 'COMPLETED' ? 1 : 0 }),
    });
  });
  await page.route('**/api/jobs/optimize', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(['LLM tip 1', 'LLM tip 2']) });
  });

  await page.goto('/jobs');
  await expect(page).toHaveURL(/\/jobs$/);

  await page.fill('input[placeholder="e.g. VLASS2.1.eb123456"]', 'test');
  await page.click('button.submit-btn');
  await expect(page.getByText(/submitted successfully/)).toBeVisible();

  const card = page.locator('.job-item');
  await expect(card).toHaveCount(1);
  await expect(card.locator('mat-chip')).toHaveText(/QUEUED|COMPLETED/);

  await expect(page.locator('.tips-card li')).toHaveCount(2);
  await expect(card.locator('mat-chip')).toHaveText('COMPLETED', { timeout: 10000 });
});
