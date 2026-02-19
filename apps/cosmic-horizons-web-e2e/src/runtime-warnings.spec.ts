import { test, expect } from '@playwright/test';

// Guard test to detect duplicate Angular runtime registrations (NG0912)
// This prevents regressions where multiple copies of @angular/* or @angular/cdk
// are bundled and the runtime emits "Component ID generation collision" warnings.
test('no Angular NG0912 duplicate component-definition warnings on app load', async ({
  page,
}) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(msg.text()));

  await page.goto('/landing', { waitUntil: 'domcontentloaded' });
  // allow a short window for runtime warnings to appear
  await page.waitForTimeout(400);

  const joined = logs.join('\n');
  expect(joined).not.toContain('NG0912');
});

test('labeling center should not emit Aladin logger CORS/fetch or passive-event warnings', async ({
  page,
}) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(msg.text()));

  await page.goto('/view', { waitUntil: 'domcontentloaded' });

  // Wait for the Aladin host to exist and allow Aladin to initialize
  await page.waitForSelector('.aladin-host');
  await page.waitForTimeout(600);

  // Enter a center label and annotate — should not produce noisy console errors
  await page.fill('.label-name-field input', 'Playwright Test Label');
  await page.click('button:has-text("Label Center")');

  // give time for any backend / Aladin interactions
  await page.waitForTimeout(500);

  const joined = logs.join('\n');
  expect(joined).not.toMatch(
    /AladinLiteLogger|Failed to fetch|Unable to preventDefault/i,
  );
});
