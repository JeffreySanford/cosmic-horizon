import { test, expect } from '@playwright/test';

function createFakeJwt(exp: number, claims: Record<string, string> = {}) {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: 'admin-1', exp, ...claims }),
  ).toString('base64url');
  const signature = 'test-signature';
  return `${header}.${payload}.${signature}`;
}

// Reproduce and guard against NG0912 / NG0200 and Location/getBaseHref runtime errors
// by toggling through the SystemMetricsChart view & sample selectors.
test('broker view does not emit Angular runtime NG0912 or NG0200 when switching charts', async ({
  page,
}) => {
  // We'll set session/local storage after loading the SPA to ensure the client sees it.
  const token = createFakeJwt(Math.floor(Date.now() / 1000) + 3600);

  const logs: string[] = [];
  page.on('console', (msg) => logs.push(msg.text()));

  // Respond to auth.me checks so the app bootstraps as an authenticated admin user
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        authenticated: true,
        user: {
          id: 'admin-1',
          username: 'adminuser',
          display_name: 'Admin User',
          role: 'admin',
          created_at: new Date().toISOString(),
        },
      }),
    });
  });

  // load SPA first, then inject storage values
  // Inject session/local storage *before* page navigation to satisfy client AuthGuard/SSR behavior.
  await page.addInitScript((jwt: string) => {
    try {
      window.sessionStorage.setItem('auth_token', jwt);
    } catch (e) {
      /* ignore */
    }
    try {
      window.sessionStorage.setItem(
        'auth_user',
        JSON.stringify({
          id: 'admin-1',
          username: 'adminuser',
          display_name: 'Admin User',
          role: 'admin',
          created_at: new Date().toISOString(),
        }),
      );
    } catch (e) {
      /* ignore */
    }

    try {
      const snapshot = {
        cachedAt: Date.now(),
        data: {
          timestamp: new Date().toISOString(),
          brokers: {
            rabbitmq: {
              connected: true,
              messagesPerSecond: 12000,
              p99LatencyMs: 55,
              memoryUsageMb: 512,
            },
            kafka: {
              connected: true,
              messagesPerSecond: 18000,
              p99LatencyMs: 42,
              memoryUsageMb: 768,
            },
            pulsar: {
              connected: true,
              messagesPerSecond: 25000,
              p99LatencyMs: 28,
              memoryUsageMb: 640,
            },
          },
          comparison: {
            throughputImprovement: '+40%',
            latencyImprovement: '-50%',
            memoryEfficiency: '-20%',
          },
        },
      };
      window.localStorage.setItem(
        'broker-comparison:last-metrics',
        JSON.stringify(snapshot),
      );
    } catch (e) {
      /* ignore */
    }
  }, token);

  // Now load the SPA (client bundle) and navigate client-side to the operations page.

  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // perform client-side navigation so the component is instantiated within the running SPA
  await page.evaluate(() => {
    window.history.pushState({}, '', '/operations/broker-comparison');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  // give Angular a moment to render the routed component
  await new Promise((r) => setTimeout(r, 200));
  await expect(page.locator('app-system-metrics-chart')).toBeVisible({ timeout: 10000 });

  // Ensure controls are available
  const viewSelector = '#chart-view';
  const sampleSelector = '#sample-interval';
  await expect(page.locator(viewSelector)).toBeVisible({ timeout: 5000 });
  await expect(page.locator(sampleSelector)).toBeVisible({ timeout: 5000 });

  // Toggle chart view options several times and wait for chart to re-render
  const viewOptions = [
    'system',
    'throughputImpact',
    'memoryImpact',
    'latencyImpact',
  ];
  for (const v of viewOptions) {
    await page.selectOption(viewSelector, v);
    // wait for a visible svg update, but don't fail the test if not present quickly
    await Promise.race([
      // prefer locator.waitFor so linter doesn't require `expect` to be awaited here
      page.locator('.chart-container svg').waitFor({ state: 'visible', timeout: 1200 }),
      new Promise((r) => setTimeout(r, 250)),
    ]);
  }

  // Rapidly change sampling interval to provoke render/overlay behaviour
  const sampleValues = ['20', '100', '300', '1000', '5000'];
  for (const s of sampleValues) {
    await page.selectOption(sampleSelector, s);
    await new Promise((r) => setTimeout(r, 180));
  }

  // Allow runtime messages to appear (give slightly more time in CI)
  await new Promise((r) => setTimeout(r, 1000));
  const joined = logs.join('\n');
  expect(joined).not.toContain('NG0912');
  expect(joined).not.toContain('NG0200');
  expect(joined).not.toMatch(
    /getBaseHrefFromDOM|Cannot read properties of null \(reading 'getBaseHref'\)/i,
  );
});
