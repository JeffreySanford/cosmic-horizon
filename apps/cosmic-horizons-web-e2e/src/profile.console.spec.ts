import { test, expect } from '@playwright/test';

const PROFILE_API_PATH = '**/api/profiles/adminuser';

test.describe('Profile — console & retry behavior', () => {
  test('emits debug console logs when profile loads', async ({ page }) => {
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(text);
    });

    await page.goto('/profile/adminuser');

    // wait until API response and UI render
    await page.waitForResponse(PROFILE_API_PATH);
    await page.locator('mat-card-title').waitFor({ state: 'visible' });

    // Check debug logs we added in the component
    const foundStart = consoleMessages.some((m) => m.includes('[ProfileComponent] loadProfile.start'));
    const foundNext = consoleMessages.some((m) => m.includes('[ProfileComponent] getProfile.next'));
    const foundFinalize = consoleMessages.some((m) => m.includes('[ProfileComponent] loadProfile.finalize'));

    expect(foundStart).toBeTruthy();
    expect(foundNext).toBeTruthy();
    expect(foundFinalize).toBeTruthy();
  });

  test('shows retry button when profile load stalls and retry succeeds', async ({ page }) => {
    // Intercept the profile API and delay first response so the component's loadTimedOut becomes true
    let first = true;
    await page.route(PROFILE_API_PATH, async (route) => {
      if (first) {
        first = false;
        // delay > 8s so client shows retry UI (component uses 8s timeout)
        await new Promise((r) => setTimeout(r, 8500));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { username: 'adminuser', display_name: 'Admin User', created_at: new Date().toISOString() }, posts: [] }) });
      } else {
        // immediate response on retry
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { username: 'adminuser', display_name: 'Admin User', created_at: new Date().toISOString() }, posts: [] }) });
      }
    });

    await page.goto('/profile/adminuser');

    // After ~8s the retry button should become visible
    await page.waitForSelector('[data-test="profile-retry"]', { timeout: 12000 });
    await expect(page.locator('[data-test="profile-retry"]')).toBeVisible();

    // click retry and assert the profile eventually renders
    await page.click('[data-test="profile-retry"]');
    await page.locator('mat-card-title').waitFor({ state: 'visible', timeout: 5000 });
    await expect(page.locator('mat-card-title')).toHaveText('Admin User');
  });
});
