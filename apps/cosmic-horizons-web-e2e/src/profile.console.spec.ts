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
    await page
      .locator('mat-card-title')
      .waitFor({ state: 'visible', timeout: 10000 });

    // Check debug logs we added in the component
    const foundStart = consoleMessages.some((m) =>
      m.includes('[ProfileComponent] loadProfile.start'),
    );
    const foundNext = consoleMessages.some((m) =>
      m.includes('[ProfileComponent] getProfile.next'),
    );
    const foundFinalize = consoleMessages.some((m) =>
      m.includes('[ProfileComponent] loadProfile.finalize'),
    );

    expect(foundStart, 'should log loadProfile.start').toBeTruthy();
    expect(foundNext, 'should log getProfile.next').toBeTruthy();
    expect(foundFinalize, 'should log loadProfile.finalize').toBeTruthy();
  });

  test('shows Try again button on server error and succeeds on retry', async ({
    browser,
  }) => {
    // Use a fresh browser context so cached/in-memory profile data can't short-circuit the network request
    const context = await browser.newContext();
    const page = await context.newPage();

    // Attach interceptors and shims *before* navigating to the profile page (do not pre-navigate to '/')

    // Deterministic Playwright route that intercepts any profile API request (absolute or relative)
    // and returns 500 the first time, then 200 on subsequent calls. This is the stable approach for CI.
    let firstRouteCall = true;
    await page.route(PROFILE_API_PATH, async (route) => {
      if (firstRouteCall) {
        firstRouteCall = false;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({ message: 'simulated error' }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: JSON.stringify({
            user: {
              username: 'adminuser',
              display_name: 'Admin User',
              created_at: new Date().toISOString(),
            },
            posts: [],
          }),
        });
      }
    });

    // Capture console logs and all page requests for debugging — helps identify why the API path is sometimes not hit
    const consoleMessages: string[] = [];
    page.on('console', (msg) => consoleMessages.push(msg.text()));

    const reqUrls: string[] = [];
    page.on('request', (r) => {
      reqUrls.push(r.url());

      console.log('[E2E DEBUG] request ->', r.method(), r.url());
    });

    page.on('response', (res) => {
      console.log('[E2E DEBUG] response ->', res.status(), res.url());
    });

    // Load the SPA (client bundle) then navigate client-side so the component issues a fresh GET
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // ensure no seeded session prevents the component from issuing a network request
    await page.evaluate(() => {
      try {
        sessionStorage.removeItem('auth_user');
        sessionStorage.removeItem('auth_token');
      } catch (e) {
        /* ignore */
      }
    });

    // navigate client-side so the ProfileComponent performs the GET (this will be the *first* route call -> 500)
    await page.evaluate(() => {
      window.history.pushState({}, '', '/profile/adminuser');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // wait for the app's profile GET and assert it received the simulated 500
    const errorResp = await page.waitForResponse(
      (r) => PROFILE_API_PATH.test(r.url()) && r.status() === 500,
      { timeout: 5000 },
    );
    expect(errorResp.status()).toBe(500);

    // surface profile debug logs if present (helps CI failure inspection)

    console.log('[E2E DEBUG] consoleMessages:', consoleMessages.slice(-20));

    // sanity: ensure the profile network request occurred
    expect(reqUrls.some((u) => PROFILE_API_PATH.test(u))).toBeTruthy();

    // Error card and Try again button should be visible when server returns 500
    try {
      await expect(page.locator('.error-card')).toBeVisible({ timeout: 5000 });
    } catch (e) {
      const bodyText = await page.locator('body').innerText();
      console.log('[E2E DEBUG] bodyText snippet:', bodyText.slice(0, 1000));
      console.log('[E2E DEBUG] requests seen:', reqUrls.slice(-20));
      console.log('[E2E DEBUG] consoleMessages:', consoleMessages.slice(-50));
      throw new Error(
        'Expected error UI (.error-card) to be visible after simulated 500 — check debug output above.',
      );
    }

    await expect(page.locator('.error-card button')).toHaveText('Try again');

    // Click 'Try again' and verify the profile loads on successful retry
    await page.click('.error-card button');

    // wait for the retry request and ensure it returned 200
    const successResp = await page.waitForResponse(
      (r) => PROFILE_API_PATH.test(r.url()) && r.status() === 200,
      { timeout: 5000 },
    );
    expect(successResp.status()).toBe(200);

    await page
      .locator('mat-card-title')
      .waitFor({ state: 'visible', timeout: 5000 });
    await expect(page.locator('mat-card-title')).toHaveText('Admin User');

    await context.close();
  });
});
