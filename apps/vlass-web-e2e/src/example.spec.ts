import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Current MVP root route redirects to auth and renders login heading.
  expect(await page.locator('h1').innerText()).toContain('Login');
});
