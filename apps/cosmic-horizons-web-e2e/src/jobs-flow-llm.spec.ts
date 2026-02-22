import { test, expect, Page, APIRequestContext } from '@playwright/test';
import { primeAuthenticatedSession } from './support/auth';

// copy of jobs-flow.spec.ts adjusted for local-llm mode
async function loginAsTestUser(page: Page, request: APIRequestContext) {
  await primeAuthenticatedSession(page, request);
}

async function enableLocalLlmMode(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('REMOTE_COMPUTE_MODE', 'local-llm');
  });
}

test('local-llm job flow', async ({ page, request }) => {
  await loginAsTestUser(page, request);
  await enableLocalLlmMode(page);

  // stub endpoints as in main spec
  await page.route('**/api/jobs/capabilities', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ localLLM: true, baseUrlReachable: true }),
    });
  });
  await page.route('**/api/datasets**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'VLASS2.1.test',
          label: 'VLASS2.1.test',
          lastUpdated: new Date().toISOString(),
        },
      ]),
    });
  });
  await page.route('**/api/jobs/submit', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'llm-1' }),
    });
  });

  let count = 0;
  await page.route('**/api/jobs/*/status', async (route) => {
    const status = count++ === 0 ? 'QUEUED' : 'COMPLETED';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'llm-1',
        status,
        progress: status === 'COMPLETED' ? 1 : 0,
      }),
    });
  });
  await page.route('**/api/jobs/optimize', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(['LLM tip 1', 'LLM tip 2']),
    });
  });

  await page.goto('/jobs');
  await expect(page).toHaveURL(/\/jobs$/);

  await page.evaluate(() => {
    const ng = (window as any).ng as any;
    const host = document.querySelector('app-jobs-console');
    if (!ng || !host || typeof ng.getComponent !== 'function') {
      throw new Error('jobs component not available');
    }
    const component = ng.getComponent(host);
    component.selectedDataset = { id: 'VLASS2.1.test', label: 'VLASS2.1.test' };
    component.datasetId = 'VLASS2.1.test';
    if (typeof ng.applyChanges === 'function') {
      ng.applyChanges(host);
    }
  });
  await page.click('button.submit-btn');
  await expect(page.getByText(/submitted successfully/)).toBeVisible();

  await expect(page.locator('.job-item').first()).toBeVisible();
  await expect(page.locator('.tips-card li')).toHaveCount(2);
});
