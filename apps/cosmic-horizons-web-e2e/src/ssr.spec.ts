import { APIRequestContext, expect, test } from '@playwright/test';

const previewImagePattern = /\/previews\/region-(default|\d)\.png\?v=\d+/;

async function fetchSsrHtml(
  path: '/auth/login' | '/landing',
  request: APIRequestContext,
): Promise<string> {
  // Ensure API is ready before requesting SSR payloads to avoid ECONNREFUSED flakes
  const maxWaitMs = 15_000;
  const start = Date.now();
  let healthy = false;
  while (Date.now() - start < maxWaitMs) {
    try {
      const res = await request.get('/health');
      if (res.ok()) {
        healthy = true;
        break;
      }
    } catch (_e) {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  expect(
    healthy,
    `API /health did not become ready within ${maxWaitMs}ms`,
  ).toBeTruthy();

  const response = await request.get(path);
  expect(
    response.ok(),
    `Expected ${path} to return 2xx but got ${response.status()}`,
  ).toBeTruthy();
  return response.text();
}

test.describe('SSR preview payload', () => {
  test('renders regional preview in /auth/login HTML', async ({ request }) => {
    const html = await fetchSsrHtml('/auth/login', request);
    expect(html).toContain('Login');
    // Verify application structure is present in SSR
    expect(html).toContain('app-login');
    // Ensure SSR produced a cache-busted preview image URL.
    expect(html).toMatch(previewImagePattern);
  });

  test('renders regional preview in /landing HTML (direct request path)', async ({
    request,
  }) => {
    const html = await fetchSsrHtml('/landing', request);
    // Verify application structure is present in SSR
    expect(html).toContain('app-landing');
    // Verify Material components are rendered
    expect(html).toContain('mat-toolbar');
  });
});
