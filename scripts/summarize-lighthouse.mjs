import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['.lighthouseci', 'test-output/lighthouse'];

function walk(dir) {
  const found = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        found.push(...walk(full));
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        found.push(full);
      }
    }
  } catch {
    return found;
  }
  return found;
}

function score(value) {
  if (typeof value !== 'number') return null;
  return Math.round(value * 100);
}

const reports = [];
for (const root of roots) {
  for (const file of walk(root)) {
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8'));
      if (!parsed?.categories?.performance) continue;
      reports.push({ file, data: parsed });
    } catch {
      // ignore non-LHR json
    }
  }

  if (reports.length > 0 && root === '.lighthouseci') {
    break;
  }
}

mkdirSync('test-output/lighthouse', { recursive: true });

if (reports.length === 0) {
  const empty = {
    generated_at: new Date().toISOString(),
    runs: [],
    summary: 'No Lighthouse report JSON files were found.',
  };
  writeFileSync('test-output/lighthouse/summary.json', JSON.stringify(empty, null, 2), 'utf8');
  writeFileSync('test-output/lighthouse/summary.md', '# Lighthouse Summary\n\nNo Lighthouse report JSON files were found.\n', 'utf8');
  process.exit(0);
}

const runs = reports.map(({ file, data }) => ({
  file,
  fetchTime: data.fetchTime,
  finalUrl: data.finalUrl,
  performance: score(data.categories.performance.score),
  accessibility: score(data.categories.accessibility?.score),
  bestPractices: score(data.categories['best-practices']?.score),
  seo: score(data.categories.seo?.score),
  fcpMs: data.audits['first-contentful-paint']?.numericValue ?? null,
  lcpMs: data.audits['largest-contentful-paint']?.numericValue ?? null,
  tbtMs: data.audits['total-blocking-time']?.numericValue ?? null,
  cls: data.audits['cumulative-layout-shift']?.numericValue ?? null,
}));

const avg = (key) => {
  const values = runs.map((run) => run[key]).filter((value) => typeof value === 'number');
  if (values.length === 0) return null;
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2));
};

const summary = {
  generated_at: new Date().toISOString(),
  runs,
  aggregates: {
    performance_avg: avg('performance'),
    accessibility_avg: avg('accessibility'),
    best_practices_avg: avg('bestPractices'),
    seo_avg: avg('seo'),
    fcp_ms_avg: avg('fcpMs'),
    lcp_ms_avg: avg('lcpMs'),
    tbt_ms_avg: avg('tbtMs'),
    cls_avg: avg('cls'),
  },
};

writeFileSync('test-output/lighthouse/summary.json', JSON.stringify(summary, null, 2), 'utf8');

const lines = [
  '# Lighthouse Summary',
  '',
  `Generated: ${summary.generated_at}`,
  '',
  '## Aggregates',
  '',
  `- Performance avg: ${summary.aggregates.performance_avg ?? 'n/a'}`,
  `- Accessibility avg: ${summary.aggregates.accessibility_avg ?? 'n/a'}`,
  `- Best Practices avg: ${summary.aggregates.best_practices_avg ?? 'n/a'}`,
  `- SEO avg: ${summary.aggregates.seo_avg ?? 'n/a'}`,
  `- FCP avg (ms): ${summary.aggregates.fcp_ms_avg ?? 'n/a'}`,
  `- LCP avg (ms): ${summary.aggregates.lcp_ms_avg ?? 'n/a'}`,
  `- TBT avg (ms): ${summary.aggregates.tbt_ms_avg ?? 'n/a'}`,
  `- CLS avg: ${summary.aggregates.cls_avg ?? 'n/a'}`,
  '',
  '## Runs',
  '',
];

for (const run of runs) {
  lines.push(`- ${run.finalUrl || 'unknown-url'} | perf=${run.performance ?? 'n/a'} | FCP=${run.fcpMs ?? 'n/a'}ms | LCP=${run.lcpMs ?? 'n/a'}ms | source=${run.file}`);
}

lines.push('');
writeFileSync('test-output/lighthouse/summary.md', `${lines.join('\n')}\n`, 'utf8');
console.log('Lighthouse summaries written to test-output/lighthouse/summary.json and summary.md');
