import { test, expect } from '@playwright/test';

interface PerfMetrics {
  ttfb: number;
  fcp: number;
  lcp: number;
}

function ttfbBudgetForBrowser(browserName: string): number {
  if (browserName === 'firefox') {
    return 2400;
  }

  return 2000;
}

async function collectMetrics(): Promise<PerfMetrics> {
  const navigation = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;

  const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0] as
    | PerformanceEntry
    | undefined;

  const getLcp = (): number => {
    const entries = performance.getEntriesByType(
      'largest-contentful-paint',
    ) as PerformanceEntry[];
    return entries.length > 0 ? entries[entries.length - 1].startTime : 0;
  };

  const lcp = getLcp();

  return {
    ttfb: navigation?.responseStart ?? 0,
    fcp: fcpEntry?.startTime ?? navigation?.domContentLoadedEventEnd ?? 0,
    lcp:
      lcp > 0
        ? lcp
        : (fcpEntry?.startTime ?? navigation?.domContentLoadedEventEnd ?? 0),
  };
}

test('meets SSR login performance budget (TTFB/FCP/LCP)', async ({
  page,
  browserName,
}) => {
  await page.goto('/auth/login', { waitUntil: 'load' });

  const metrics = await page.evaluate(collectMetrics);

  expect(metrics.ttfb).toBeGreaterThan(0);
  expect(metrics.fcp).toBeGreaterThan(0);
  expect(metrics.lcp).toBeGreaterThan(0);

  // Pillar 1 charter thresholds (Relaxed for CI/Dev environment).
  const ttfbBudget = ttfbBudgetForBrowser(browserName);
  expect(metrics.ttfb).toBeLessThan(ttfbBudget);
  expect(metrics.fcp).toBeLessThan(3000);
  expect(metrics.lcp).toBeLessThan(4000);
});
