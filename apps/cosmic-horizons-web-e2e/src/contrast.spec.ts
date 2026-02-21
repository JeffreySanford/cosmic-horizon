import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

function createFakeJwt(exp: number): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: 'user-1', exp }),
  ).toString('base64url');
  return `${header}.${payload}.test-signature`;
}

async function expectNoContrastViolations(
  url: string,
  pageName: string,
  page: Page,
) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const result = await new AxeBuilder({ page })
    .withTags(['wcag2aa'])
    .exclude('mat-icon')
    .exclude('.material-icons')
    .analyze();

  const contrastViolations = result.violations.filter(
    (violation) => violation.id === 'color-contrast',
  );

  expect(
    contrastViolations,
    `${pageName} has color contrast violations: ${contrastViolations
      .map((v) => `${v.id}: ${v.help}`)
      .join(', ')}`,
  ).toEqual([]);
}

test.describe('color contrast lint checks', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.clearCookies();
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('login page passes color contrast checks', async ({ page }) => {
    await expectNoContrastViolations('/auth/login', 'auth/login', page);
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('landing page passes color contrast checks', async ({ page }) => {
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

    await expectNoContrastViolations('/landing', 'landing', page);
    await expect(page).toHaveURL(/\/landing$/);
  });

  test('jobs console page passes color contrast checks', async ({ page }) => {
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

    await expectNoContrastViolations('/jobs', 'jobs', page);
    await expect(page).toHaveURL(/\/jobs$/);
  });
});
