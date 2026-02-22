import { test, expect, Page } from '@playwright/test';

function createFakeJwt(
  exp: number,
  claims: Record<string, string> = {},
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: 'user-1', exp, ...claims }),
  ).toString('base64url');
  const signature = 'test-signature';
  return `${header}.${payload}.${signature}`;
}

// copy of jobs-flow.spec.ts adjusted for local-llm mode
async function loginAsTestUser(page: Page) {
  const token = createFakeJwt(Math.floor(Date.now() / 1000) + 3600);
  await page.addInitScript((jwt: string) => {
    window.sessionStorage.setItem('auth_token', jwt);
    window.sessionStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 'user-1',
        username: 'testuser',
        email: 'test@cosmic.local',
        display_name: 'Test User',
        role: 'user',
        created_at: '2026-02-07T00:00:00.000Z',
      }),
    );
  }, token);
}

async function enableLocalLlmMode(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem('REMOTE_COMPUTE_MODE', 'local-llm');
  });
}

test('local-llm job flow', async ({ page }: { page: Page }) => {
  await loginAsTestUser(page);
  await enableLocalLlmMode(page);

  // stub endpoints as in main spec
  await page.route('**/api/jobs/capabilities', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ localLLM: true, baseUrlReachable: true }),
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

  await page.fill('input[placeholder="e.g. VLASS2.1.eb123456"]', 'test');
  await page.click('button.submit-btn');
  await expect(page.getByText(/submitted successfully/)).toBeVisible();

  await expect(page.locator('.job-item').first()).toBeVisible();
  await expect(page.locator('.tips-card li')).toHaveCount(2);
});
