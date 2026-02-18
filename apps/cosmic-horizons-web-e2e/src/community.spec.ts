import { test, expect } from '@playwright/test';

function createFakeJwt(exp: number) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 'user-1', exp })).toString('base64url');
  return `${header}.${payload}.sig`;
}

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('community post requiring moderation is hidden until approved', async ({ page, request }) => {
  const token = createFakeJwt(Math.floor(Date.now() / 1000) + 3600);
  await page.addInitScript((jwt: string) => {
    window.sessionStorage.setItem('auth_token', jwt);
    window.sessionStorage.setItem('auth_user', JSON.stringify({ id: 'user-1', username: 'modtester', role: 'user' }));
  }, token);

  const payload = {
    title: `playwright-moderation-${Date.now()}`,
    body: 'Playwright moderation test',
    author: 'playwright-user',
    tags: ['e2e', 'moderation'],
  };

  // Create hidden post via API test helper query param
  const createRes = await request.post('/api/community/posts?forceHidden=true', { data: payload });
  expect(createRes.status()).toBe(201);
  const created = await createRes.json();

  // Visit Community page - hidden post should NOT be visible
  await page.goto('/community', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/community/);
  await expect(page.getByText(payload.title)).toHaveCount(0);

  // Approve via API
  const approveRes = await request.patch(`/api/community/posts/${created.id}/approve`);
  expect(approveRes.status()).toBe(200);

  // Reload page and expect the post to appear
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByText(payload.title)).toBeVisible();
});
