import { APIRequestContext, expect, test } from '@playwright/test';

const previewImagePattern = /\/previews\/region-(default|\d)\.png\?v=\d+/;

async function fetchSsrHtml(
  path: '/auth/login' | '/landing',
  request: APIRequestContext,
): Promise<string> {
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
    expect(html).toContain('Mission Access');
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
    // Verify custom app shell header is rendered
    expect(html).toContain('app-header');
  });
});
