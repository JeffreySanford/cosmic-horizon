import { test, expect } from '@playwright/test';

// Reproduce and guard against NG0912 / NG0200 and Location/getBaseHref runtime errors
// by toggling through the SystemMetricsChart view & sample selectors.
test('broker view does not emit Angular runtime NG0912 or NG0200 when switching charts', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(msg.text()));

  await page.goto('/operations/broker-comparison', { waitUntil: 'networkidle' });
  await page.waitForSelector('app-system-metrics-chart', { timeout: 10000 });

  // Ensure controls are available
  const viewSelector = '#chart-view';
  const sampleSelector = '#sample-interval';
  await page.waitForSelector(viewSelector, { timeout: 5000 });
  await page.waitForSelector(sampleSelector, { timeout: 5000 });

  // Toggle chart view options several times and wait for chart to re-render
  const viewOptions = ['system', 'throughputImpact', 'memoryImpact', 'latencyImpact'];
  for (const v of viewOptions) {
    await page.selectOption(viewSelector, v);
    // wait for a visible svg update, but don't fail the test if not present quickly
    await Promise.race([
      page.waitForSelector('.chart-container svg', { timeout: 1200 }),
      new Promise((r) => setTimeout(r, 250)),
    ]);
  }

  // Rapidly change sampling interval to provoke render/overlay behaviour
  const sampleValues = ['20', '100', '300', '1000', '5000'];
  for (const s of sampleValues) {
    await page.selectOption(sampleSelector, s);
    await page.waitForTimeout(180);
  }

  // Allow runtime messages to appear (give slightly more time in CI)
  await page.waitForTimeout(1000);

  const joined = logs.join('\n');
  expect(joined).not.toContain('NG0912');
  expect(joined).not.toContain('NG0200');
  expect(joined).not.toMatch(/getBaseHrefFromDOM|Cannot read properties of null \(reading 'getBaseHref'\)/i);
});