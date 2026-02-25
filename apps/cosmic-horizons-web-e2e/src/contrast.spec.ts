import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { primeAuthenticatedSession } from './support/auth';

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

  test('landing page passes color contrast checks', async ({
    page,
    request,
  }) => {
    await primeAuthenticatedSession(page, request);

    await expectNoContrastViolations('/landing', 'landing', page);
    await expect(page).toHaveURL(/\/landing$/);
  });

  test('jobs console page passes color contrast checks', async ({
    page,
    request,
  }) => {
    await primeAuthenticatedSession(page, request);

    await expectNoContrastViolations('/jobs', 'jobs', page);
    await expect(page).toHaveURL(/\/jobs$/);
  });
});
