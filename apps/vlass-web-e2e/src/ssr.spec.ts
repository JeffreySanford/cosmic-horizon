import { APIRequestContext, expect, test } from '@playwright/test';

const previewImagePattern = /\/previews\/region-(default|\d)\.png\?v=\d+/;

async function fetchSsrHtml(
  path: '/auth/login' | '/landing',
  request: APIRequestContext
) : Promise<string> {
  const response = await request.get(path);
  expect(response.ok(), `Expected ${path} to return 2xx but got ${response.status()}`).toBeTruthy();
  return response.text();
}

test.describe('SSR preview payload', () => {
  test('renders regional preview in /auth/login HTML', async ({ request }) => {
    const html = await fetchSsrHtml('/auth/login', request);
    expect(html).toContain('Personalize background');
    expect(html).toContain('--sky-preview-url: url(/previews/region-default.png?v=20260207);');
    expect(html).toMatch(previewImagePattern);
  });

  test('renders regional preview in /landing HTML (direct request path)', async ({ request }) => {
    const html = await fetchSsrHtml('/landing', request);
    expect(html).toContain('Personalize background');
    expect(html).toContain('--sky-preview-url: url(/previews/region-default.png?v=20260207);');
    expect(html).toMatch(previewImagePattern);
  });
});
