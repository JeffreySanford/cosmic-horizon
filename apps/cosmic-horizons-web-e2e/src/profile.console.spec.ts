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

  test('shows retry button when profile load stalls and retry succeeds', async ({ page }) => {
    // Inject a fetch wrapper to *hold* the initial profile API promise on the client
    await page.addInitScript(() => {
      (window as any).__releaseProfile = null;
      const orig = window.fetch.bind(window);
      window.fetch = (input: RequestInfo, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : (input as Request).url;
        if (url.includes('/api/profiles/adminuser') && !(window as any).__profileHeld) {
          (window as any).__profileHeld = true;
          return new Promise((resolve) => {
            (window as any).__releaseProfile = resolve;
          }).then(() => orig(input, init));
        }
        return orig(input, init);
      };
    });

    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));

    await page.goto('/profile/adminuser');

    // Wait for our timeout log — indicates client-side timeout fired
    const timedOutSeen = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 12000) {
        if (logs.some((l) => l.includes('loadProfile.timedOut'))) return true;
        await new Promise((r) => setTimeout(r, 200));
      }
      return false;
    })();

    expect(timedOutSeen, 'expected component to log loadProfile.timedOut').toBeTruthy();

    // After the timed-out log, the retry button should appear
    await page.waitForSelector('[data-test="profile-retry"]', { timeout: 3000 });
    await expect(page.locator('[data-test="profile-retry"]')).toBeVisible();

    // release the held request so the client receives the API response
    await page.evaluate(() => {
      if ((window as any).__releaseProfile) {
        (window as any).__releaseProfile();
      }
    });

    // click retry and assert the profile eventually renders
    await page.click('[data-test="profile-retry"]');
    await page.locator('mat-card-title').waitFor({ state: 'visible', timeout: 5000 });
    await expect(page.locator('mat-card-title')).toHaveText('Admin User');
  });
});
