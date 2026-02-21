import { test, expect } from '@playwright/test';

const apiBase = process.env['API_BASE_URL'] ?? 'http://127.0.0.1:3000';

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test.skip('community post requiring moderation is hidden until approved', async ({
  page,
  request,
}) => {
  // authenticate as admin (use real token so backend JWT validation succeeds)
  const login = await request.post(`${apiBase}/api/auth/login`, {
    data: { email: 'admin@cosmic.local', password: 'AdminPassword123!' },
  });
  expect(login.status()).toBe(201);
  const { access_token: adminToken } = await login.json();

  await page.addInitScript((jwt: string) => {
    window.sessionStorage.setItem('auth_token', jwt);
    window.sessionStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 'admin', username: 'admin', role: 'admin' }),
    );
  }, adminToken);

  const payload = {
    title: `playwright-moderation-${Date.now()}`,
    body: 'Playwright moderation test',
    author: 'playwright-user',
    tags: ['e2e', 'moderation'],
  };

  // Create hidden post via API test helper query param
  const createRes = await request.post(
    `${apiBase}/api/community/posts?forceHidden=true`,
    { data: payload },
  );
  expect(createRes.status()).toBe(201);
  const created = await createRes.json();

  // Visit Community page - hidden post should NOT be visible
  await page.goto('/community', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/community/);
  await expect(page.getByText(payload.title)).toHaveCount(0);

  // Approve via API (authenticated moderator)
  const approveRes = await request.patch(
    `${apiBase}/api/community/posts/${created.id}/approve`,
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    },
  );
  expect(approveRes.status()).toBe(200);

  // Reload page and confirm backend shows the approved post.
  await page.reload({ waitUntil: 'networkidle' });
  const feedRespDirect = await request.get(`${apiBase}/api/community/feed`);
  const feedJsonDirect = await feedRespDirect.json();
  expect(feedJsonDirect.some((f: any) => f.title === payload.title)).toBe(true);

  // UI verification (robust): assert the Angular component's `feed` contains the approved post
  await expect
    .poll(
      async () =>
        await page.evaluate((t) => {
          // runtime-only browser helper (Playwright/Angular devtools)
          const ng = (window as any).ng as any;
          const el = document.querySelector('app-community-feed');
          if (!ng || !el || typeof ng.getComponent !== 'function') return false;
          try {
            // runtime-only browser helper (Playwright/Angular devtools)
            const feed = ng.getComponent(el)?.feed ?? [];
            return feed.some((f: any) => f.title === t);
          } catch {
            return false;
          }
        }, payload.title),
      { timeout: 10000 },
    )
    .toBe(true);
});

test.skip('admin can hide a visible community post and UI updates accordingly', async ({
  page,
  request,
}) => {
  // login as seeded admin user to get a real token
  const login = await request.post(`${apiBase}/api/auth/login`, {
    data: { email: 'admin@cosmic.local', password: 'AdminPassword123!' },
  });
  expect(login.status()).toBe(201);
  const { access_token: adminToken } = await login.json();

  // set browser session so the UI route (protected by AuthGuard) won't redirect to login
  await page.addInitScript((jwt: string) => {
    window.sessionStorage.setItem('auth_token', jwt);
    window.sessionStorage.setItem(
      'auth_user',
      JSON.stringify({ id: 'admin', username: 'admin', role: 'admin' }),
    );
  }, adminToken);

  const payload = {
    title: `playwright-hide-${Date.now()}`,
    body: 'Playwright hide flow test',
    author: 'playwright-admin',
    tags: ['e2e', 'moderation'],
  };

  // create a visible post (no forceHidden)
  const createRes = await request.post(`${apiBase}/api/community/posts`, {
    data: payload,
  });
  expect(createRes.status()).toBe(201);
  const created = await createRes.json();

  // Post should be visible in the Community UI
  await page.goto('/community', { waitUntil: 'domcontentloaded' });
  // Confirm backend contains the newly created post
  const initialFeedResp = await request.get(`${apiBase}/api/community/feed`);
  const initialFeed = await initialFeedResp.json();
  expect(initialFeed.some((f: any) => f.title === payload.title)).toBe(true);
  // UI verification (robust): ensure the Angular component's `feed` contains the newly created post
  await expect
    .poll(
      async () =>
        await page.evaluate((t) => {
          // runtime-only browser helper (Playwright/Angular devtools)
          const ng = (window as any).ng as any;
          const el = document.querySelector('app-community-feed');
          if (!ng || !el || typeof ng.getComponent !== 'function') return false;
          try {
            // runtime-only browser helper (Playwright/Angular devtools)
            const feed = ng.getComponent(el)?.feed ?? [];
            return feed.some((f: any) => f.title === t);
          } catch {
            return false;
          }
        }, payload.title),
      { timeout: 10000 },
    )
    .toBe(true);

  // Hide via API as admin
  const hideRes = await request.patch(
    `${apiBase}/api/community/posts/${created.id}/hide`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  );
  expect(hideRes.status()).toBe(200);

  // After hiding, confirm backend feed no longer includes the post and UI updates
  await page.reload({ waitUntil: 'networkidle' });
  // backend verification (direct request is deterministic)
  const afterFeedResp = await request.get(`${apiBase}/api/community/feed`);
  const afterFeed = await afterFeedResp.json();
  expect(afterFeed.some((f: any) => f.title === payload.title)).toBe(false);

  // UI verification: read component `feed` directly (robust against network/view timing)
  await expect
    .poll(
      async () =>
        await page.evaluate((t) => {
          // runtime-only browser helper (Playwright/Angular devtools)
          const ng = (window as any).ng as any;
          const el = document.querySelector('app-community-feed');
          if (!ng || !el || typeof ng.getComponent !== 'function') return false;
          try {
            // runtime-only browser helper (Playwright/Angular devtools)
            const feed = ng.getComponent(el)?.feed ?? [];
            return !feed.some((f: any) => f.title === t);
          } catch {
            return false;
          }
        }, payload.title),
      { timeout: 10000 },
    )
    .toBe(true);

  // finally assert DOM doesn't show the post
  await expect(page.getByText(payload.title)).toHaveCount(0);
});

test('approve/hide endpoints return 401 unauthenticated and 403 for normal user', async ({
  request,
}) => {
  const payload = {
    title: `playwright-rbac-${Date.now()}`,
    body: 'RBAC negative cases',
    author: 'playwright-user',
    tags: ['e2e', 'moderation'],
  };

  // create hidden post via helper query param
  const createRes = await request.post(
    `${apiBase}/api/community/posts?forceHidden=true`,
    { data: payload },
  );
  expect(createRes.status()).toBe(201);
  const created = await createRes.json();

  // unauthenticated -> 401
  const unauthApprove = await request.patch(
    `${apiBase}/api/community/posts/${created.id}/approve`,
  );
  expect(unauthApprove.status()).toBe(401);

  const unauthHide = await request.patch(
    `${apiBase}/api/community/posts/${created.id}/hide`,
  );
  expect(unauthHide.status()).toBe(401);

  // login as regular seeded user (test@cosmic.local)
  const login = await request.post(`${apiBase}/api/auth/login`, {
    data: { email: 'test@cosmic.local', password: 'Password123!' },
  });
  expect(login.status()).toBe(201);
  const { access_token: userToken } = await login.json();

  // authenticated but not moderator -> 403
  const userApprove = await request.patch(
    `${apiBase}/api/community/posts/${created.id}/approve`,
    { headers: { Authorization: `Bearer ${userToken}` } },
  );
  expect(userApprove.status()).toBe(403);

  const userHide = await request.patch(
    `${apiBase}/api/community/posts/${created.id}/hide`,
    { headers: { Authorization: `Bearer ${userToken}` } },
  );
  expect(userHide.status()).toBe(403);
});
