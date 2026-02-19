import { test, expect } from '@playwright/test';

const PROFILE_API_PATH = /\/api\/profiles\/adminuser/;

test.describe('Profile — console & retry behavior', () => {
  test('emits debug console logs when profile loads', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(text);
    });

    await page.goto('/profile/adminuser');

    // wait for UI render (API may be served quickly)
    await page.locator('mat-card-title').waitFor({ state: 'visible', timeout: 10000 });

    // Check debug logs we added in the component
    const foundStart = consoleMessages.some((m) => m.includes('[ProfileComponent] loadProfile.start'));
    const foundNext = consoleMessages.some((m) => m.includes('[ProfileComponent] getProfile.next'));
    const foundFinalize = consoleMessages.some((m) => m.includes('[ProfileComponent] loadProfile.finalize'));

    expect(foundStart, 'should log loadProfile.start').toBeTruthy();
    expect(foundNext, 'should log getProfile.next').toBeTruthy();
    expect(foundFinalize, 'should log loadProfile.finalize').toBeTruthy();
  });

  test('shows Try again button on server error and succeeds on retry', async ({ page }) => {
    // Simulate a server error on first GET, then succeed on retry
    let first = true;
    await page.route(PROFILE_API_PATH, async (route) => {
      if (first) {
        first = false;
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'simulated error' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { username: 'adminuser', display_name: 'Admin User', created_at: new Date().toISOString() }, posts: [] }) });
      }
    });

    await page.goto('/profile/adminuser');

    // Error card and Try again button should be visible when server returns 500
    await page.locator('.error-card').waitFor({ state: 'visible', timeout: 5000 });
    await expect(page.locator('.error-card button')).toHaveText('Try again');

    // Click 'Try again' and verify the profile loads on successful retry
    await page.click('.error-card button');
    await page.locator('mat-card-title').waitFor({ state: 'visible', timeout: 5000 });
    await expect(page.locator('mat-card-title')).toHaveText('Admin User');
  });
});
