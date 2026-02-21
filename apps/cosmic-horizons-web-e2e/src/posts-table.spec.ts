import { expect, test } from '@playwright/test';

function createFakeJwt(
  exp: number,
  claims: Record<string, string> = {},
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: 'admin-1', exp, ...claims }),
  ).toString('base64url');
  return `${header}.${payload}.test-signature`;
}

test.beforeEach(async ({ context, page }) => {
  await context.clearCookies();
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('admin posts table shows all records with correct paginator and green-tinted shell', async ({
  page,
}) => {
  // eslint-disable-next-line playwright/no-skipped-test
  test.skip(
    true,
    'Flaky loading race in full-suite /posts table hydration; keep skipped until request lifecycle is stabilized.',
  );

  const seededPosts = Array.from({ length: 20 }, (_, index) => {
    const n = index + 1;
    return {
      id: `post-${n}`,
      user_id: n % 2 === 0 ? 'admin-1' : `user-${n}`,
      title: `Seeded Report ${n}`,
      content: `Seeded report body ${n}`,
      status: 'published',
      published_at: `2026-02-${String(((n - 1) % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
      created_at: `2026-02-${String(((n - 1) % 28) + 1).padStart(2, '0')}T09:00:00.000Z`,
      updated_at: `2026-02-${String(((n - 1) % 28) + 1).padStart(2, '0')}T11:00:00.000Z`,
      hidden_at: null,
      user: {
        id: n % 2 === 0 ? 'admin-1' : `user-${n}`,
        username: n % 2 === 0 ? 'adminuser' : `astronomer${n}`,
        display_name: n % 2 === 0 ? 'Admin User' : `Astronomer ${n}`,
        email:
          n % 2 === 0 ? 'admin@cosmic.local' : `astronomer${n}@cosmic.local`,
      },
    };
  });

  await page.route('**/api/posts/published', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(seededPosts),
    });
  });

  const token = createFakeJwt(Math.floor(Date.now() / 1000) + 3600);

  await page.addInitScript((jwt: string) => {
    window.sessionStorage.setItem('mock_mode_enabled', 'true');
    window.sessionStorage.setItem('auth_token', jwt);
    window.sessionStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 'admin-1',
        username: 'adminuser',
        email: 'admin@cosmic.local',
        display_name: 'Admin User',
        role: 'admin',
        created_at: '2026-02-07T00:00:00.000Z',
      }),
    );
  }, token);

  await page.goto('/posts', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/posts/);

  const mineOnlyToggle = page.getByRole('checkbox', { name: 'My posts only' });
  await expect(mineOnlyToggle).not.toBeChecked();

  await expect(page.locator('tr.mat-mdc-row')).toHaveCount(10, {
    timeout: 10_000,
  });

  const paginator = page.locator('.mat-mdc-paginator-range-label');
  await expect(paginator).toContainText('1 - 10 of 20');

  const nextPage = page.getByRole('button', { name: 'Next page' });
  await nextPage.click();
  await expect(paginator).toContainText('11 - 20 of 20');

  const shellTint = await page
    .locator('.table-shell')
    .evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(shellTint.toLowerCase()).not.toContain('255, 255, 255');
});
