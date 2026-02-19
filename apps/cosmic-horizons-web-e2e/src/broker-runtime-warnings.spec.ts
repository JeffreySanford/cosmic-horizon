import { test, expect } from '@playwright/test';

// Reproduce and guard against NG0912 / NG0200 and Location/getBaseHref runtime errors
// by toggling through the SystemMetricsChart view & sample selectors.
test('broker view does not emit Angular runtime NG0912 or NG0200 when switching charts', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(msg.text()));

  await page.goto('/operations/broker-comparison', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('app-system-metrics-chart');

  // Toggle chart view options several times
  const viewSelector = '#chart-view';
  const sampleSelector = '#sample-interval';

  const viewOptions = ['system', 'throughputImpact', 'memoryImpact', 'latencyImpact'];
  for (const v of viewOptions) {
    await page.selectOption(viewSelector, v);
    await page.waitForTimeout(150);
  }

  // Rapidly change sampling interval to provoke render/overlay behaviour
  const sampleValues = ['20', '100', '300', '1000', '5000'];
  for (const s of sampleValues) {
    await page.selectOption(sampleSelector, s);
    await page.waitForTimeout(120);
  }

  // Allow runtime messages to appear
  await page.waitForTimeout(400);

  const joined = logs.join('\n');
  expect(joined).not.toContain('NG0912');
  expect(joined).not.toContain('NG0200');
  expect(joined).not.toMatch(/getBaseHrefFromDOM|Cannot read properties of null \(reading 'getBaseHref'\)/i);
});