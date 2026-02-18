import { test, expect } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:4200';
const apiBase = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';

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
  const createRes = await request.post(`${apiBase}/api/community/posts?forceHidden=true`, { data: payload });
  expect(createRes.status()).toBe(201);
  const created = await createRes.json();

  // Visit Community page - hidden post should NOT be visible
  await page.goto('/community', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/community/);
  await expect(page.getByText(payload.title)).toHaveCount(0);

  // Approve via API (authenticated moderator)
  const approveRes = await request.patch(`${apiBase}/api/community/posts/${created.id}/approve`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(approveRes.status()).toBe(200);

  // Reload page and expect the post to appear
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByText(payload.title)).toBeVisible();
});

test('admin can hide a visible community post and UI updates accordingly', async ({ page, request }) => {
  // login as seeded admin user to get a real token
  const login = await request.post(`${apiBase}/api/auth/login`, { data: { email: 'admin@cosmic.local', password: 'AdminPassword123!' } });
  expect(login.status()).toBe(201);
  const { access_token: adminToken } = await login.json();

  const payload = {
    title: `playwright-hide-${Date.now()}`,
    body: 'Playwright hide flow test',
    author: 'playwright-admin',
    tags: ['e2e', 'moderation'],
  };

  // create a visible post (no forceHidden)
  const createRes = await request.post(`${apiBase}/api/community/posts`, { data: payload });
  expect(createRes.status()).toBe(201);
  const created = await createRes.json();

  // Post should be visible in the Community UI
  await page.goto('/community', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(payload.title)).toBeVisible();

  // Hide via API as admin
  const hideRes = await request.patch(`${apiBase}/api/community/posts/${created.id}/hide`, { headers: { Authorization: `Bearer ${adminToken}` } });
  expect(hideRes.status()).toBe(200);

  // After hiding, the post should no longer be present in the feed
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByText(payload.title)).toHaveCount(0);
});

test('approve/hide endpoints return 401 unauthenticated and 403 for normal user', async ({ request }) => {
  const payload = {
    title: `playwright-rbac-${Date.now()}`,
    body: 'RBAC negative cases',
    author: 'playwright-user',
    tags: ['e2e', 'moderation'],
  };

  // create hidden post via helper query param
  const createRes = await request.post(`${apiBase}/api/community/posts?forceHidden=true`, { data: payload });
  expect(createRes.status()).toBe(201);
  const created = await createRes.json();

  // unauthenticated -> 401
  const unauthApprove = await request.patch(`${apiBase}/api/community/posts/${created.id}/approve`);
  expect(unauthApprove.status()).toBe(401);

  const unauthHide = await request.patch(`${apiBase}/api/community/posts/${created.id}/hide`);
  expect(unauthHide.status()).toBe(401);

  // login as regular seeded user (test@cosmic.local)
  const login = await request.post(`${apiBase}/api/auth/login`, { data: { email: 'test@cosmic.local', password: 'Password123!' } });
  expect(login.status()).toBe(201);
  const { access_token: userToken } = await login.json();

  // authenticated but not moderator -> 403
  const userApprove = await request.patch(`${apiBase}/api/community/posts/${created.id}/approve`, { headers: { Authorization: `Bearer ${userToken}` } });
  expect(userApprove.status()).toBe(403);

  const userHide = await request.patch(`${apiBase}/api/community/posts/${created.id}/hide`, { headers: { Authorization: `Bearer ${userToken}` } });
  expect(userHide.status()).toBe(403);
});
