# E2E Code Coverage Guide

**Complete reference for e2e code coverage collection, reporting, and integration.**

## Quick Start (30 seconds)

```bash
# 1. Run with coverage
COVERAGE=true pnpm nx run cosmic-horizons-web-e2e:e2e

# 2. Generate report
node scripts/analyze-e2e-coverage.mjs --format html

# 3. View results
open coverage-e2e/coverage-report.html
```

## Overview

This guide explains how to collect and analyze code coverage from end-to-end (e2e) tests for both web (Playwright) and API (NestJS/Jest) test suites.

## Understanding Code Coverage for E2E Tests

### What is Code Coverage?

Code coverage measures how much of your application code is executed during tests:

- **Statements**: Individual lines of code executed
- **Functions**: Functions that were called
- **Branches**: Conditional branches (if/else) taken
- **Lines**: Physical lines of code

### Why E2E Coverage Matters

- Validates full user workflows
- Catches integration issues
- Complements unit test coverage
- Identifies untested code paths

### Playwright vs Jest Coverage

| Aspect             | Playwright (Web)   | Jest (API)         |
| ------------------ | ------------------ | ------------------ |
| Coverage mechanism | V8 instrumentation | Built-in Istanbul  |
| Measurement        | Browser JavaScript | Server-side code   |
| Performance        | Lower impact       | Minimal overhead   |
| Report format      | HAR/JSON           | lcov/JSON          |
| Independence       | Runs separately    | Part of test suite |

## Web E2E Coverage (Playwright)

### Setup

The Playwright configuration includes coverage support. Enable it by setting the `COVERAGE` environment variable:

```bash
COVERAGE=true pnpm exec nx run cosmic-horizons-web-e2e:e2e
```

### Configuration

Edit `apps/cosmic-horizons-web-e2e/playwright.config.ts`.

Important CI note: the test runner expects the frontend to be reachable at `BASE_URL` (default `http://localhost:4200`). In CI the dev server is bound to `0.0.0.0` while Playwright uses `localhost` as the test base — the workflow sets `BASE_URL` in `.github/workflows/e2e.yml` for deterministic runs.

If you change `BASE_URL` in CI or locally, ensure `playwright.config.ts` `webServer`/`url` values remain consistent.

Edit `apps/cosmic-horizons-web-e2e/playwright.config.ts`:

```typescript
const enableCoverage = process.env['COVERAGE'] === 'true';
const coverageDir = path.join(__dirname, 'coverage', 'browser');

if (enableCoverage && !fs.existsSync(coverageDir)) {
  fs.mkdirSync(coverageDir, { recursive: true });
}
```

Coverage files are saved to `apps/cosmic-horizons-web-e2e/coverage/browser/`.

### Using Coverage in Tests

Import and use the coverage utilities:

```typescript
import { test } from '@playwright/test';
import {
  extractCoverageMetrics,
  formatCoverageTable,
  CoverageReport,
} from './support/coverage.utils';

test('user journey with coverage', async ({ page }) => {
  // Your test code
  await page.goto('/dashboard');

  // At the end of test, extract metrics
  const metrics = await extractCoverageMetrics(page);
  console.log(formatCoverageTable(metrics));
});
```

## API E2E Coverage (Jest)

### Setup

Jest e2e tests already support built-in code coverage:

```bash
pnpm exec nx test cosmic-horizons-api-e2e --coverage
```

### View Coverage

Coverage reports are generated in:

- `apps/cosmic-horizons-api-e2e/coverage/`
- HTML report: `apps/cosmic-horizons-api-e2e/coverage/index.html`
- JSON: `apps/cosmic-horizons-api-e2e/coverage/coverage-final.json`

### Configure Thresholds

Edit `apps/cosmic-horizons-api-e2e/jest.config.cts`:

```typescript
module.exports = {
  coverageThreshold: {
    global: {
      statements: 75,
      branches: 65,
      functions: 75,
      lines: 75,
    },
  },
};
```

## Comprehensive Coverage Analysis

### Generate Unified Report

Analyze all e2e coverage in one place:

```bash
node scripts/analyze-e2e-coverage.mjs
```

### Output Formats

**Text Report** (default):

```bash
node scripts/analyze-e2e-coverage.mjs --format text
```

**JSON Report**:

```bash
node scripts/analyze-e2e-coverage.mjs --format json > coverage-report.json
```

**HTML Report**:

```bash
node scripts/analyze-e2e-coverage.mjs --format html
open coverage-e2e/coverage-report.html
```

### Custom Output Directory

```bash
OUTPUT_DIR=./my-reports node scripts/analyze-e2e-coverage.mjs
```

## Running Coverage Tests Independently

### Web E2E Coverage Only

```bash
# Run only Playwright tests with coverage
COVERAGE=true pnpm nx run cosmic-horizons-web-e2e:e2e --configuration=coverage

# Generate coverage report
node scripts/analyze-e2e-coverage.mjs --format html
```

### API E2E Coverage Only

```bash
# Run only Jest tests with coverage
pnpm nx test cosmic-horizons-api-e2e --coverage --watch=false

# View report
open apps/cosmic-horizons-api-e2e/coverage/index.html
```

### All E2E Coverage

```bash
# Run coverage for both suites
COVERAGE=true pnpm nx run cosmic-horizons-web-e2e:e2e && \
pnpm nx test cosmic-horizons-api-e2e --coverage

# Generate comprehensive report
node scripts/analyze-e2e-coverage.mjs --format html
```

## NX Integration

### Custom Task: E2E Coverage

Add to `apps/cosmic-horizons-web-e2e/project.json`:

```json
{
  "targets": {
    "e2e:coverage": {
      "executor": "nx:run-commands",
      "options": {
        "commands": [
          "COVERAGE=true nx run cosmic-horizons-web-e2e:e2e",
          "node scripts/analyze-e2e-coverage.mjs --format html"
        ],
        "parallel": false
      }
    }
  }
}
```

Run with:

```bash
pnpm nx run cosmic-horizons-web-e2e:e2e:coverage
```

### Coverage in CI/CD

In `.github/workflows/e2e.yml`:

```yaml
- name: Run E2E Coverage Tests
  run: COVERAGE=true pnpm nx run cosmic-horizons-web-e2e:e2e

- name: Collect API Coverage
  run: pnpm nx test cosmic-horizons-api-e2e --coverage

- name: Generate Report
  run: node scripts/analyze-e2e-coverage.mjs --format html

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage-e2e/coverage-report.json
```

## Coverage Metrics Reference

### Default Thresholds

```text
Statements: 80%  (Minimum lines of code executed)
Functions:  80%  (Minimum functions called)
Branches:   75%  (Minimum conditional paths taken)
Lines:      80%  (Minimum physical lines executed)
```

### Interpreting Results

```text
✅ 90-100% coverage    - Excellent (thorough testing)
🟢 80-89% coverage     - Good (most paths tested)
🟡 70-79% coverage     - Acceptable (reasonable coverage)
🟠 60-69% coverage     - Fair (significant gaps)
🔴 <60% coverage       - Poor (major areas untested)
```

## Code Coverage Utilities

### Coverage Utils API

Located in `apps/cosmic-horizons-web-e2e/src/support/coverage.utils.ts`

```typescript
// Extract metrics from page
const metrics = await extractCoverageMetrics(page);

// Format as table
console.log(formatCoverageTable(metrics));

// Generate summary
const summary = generateCoverageSummary(reports);

// Print detailed report
printCoverageReport(summary);

// Validate thresholds
const { passed, failures } = validateCoverageThresholds(metrics);

// Save reports
saveCoverageReports(reports, outputDir);
```

## Best Practices

### 1. Run Coverage in Isolation

```bash
# Don't mix coverage runs - run separately
COVERAGE=true pnpm nx run cosmic-horizons-web-e2e:e2e
pnpm nx test cosmic-horizons-api-e2e --coverage
```

### 2. Use Chromium for V8 Coverage

Edit `playwright.config.ts` and ensure Chromium is enabled when `COVERAGE=true`:

```typescript
if (enableCoverage) {
  // Use Chromium for V8 coverage (Firefox doesn't support it)
}
```

### 3. Target Critical Paths

Focus coverage on user workflows that provide the most value

### 4. Monitor Trends

```bash
# Archive reports with timestamps
mkdir -p coverage-reports/$(date +%Y-%m-%d)
cp coverage-e2e/coverage-report.* coverage-reports/$(date +%Y-%m-%d)/
```

### 5. Set Realistic Thresholds

- API (Jest): Can achieve 85%+ easily with mocks
- Web (Playwright): 60-70% is realistic with UI testing

## Troubleshooting

### Coverage Files Not Generated

**Problem**: `COVERAGE=true` but no files created

**Solution**:

```bash
# Check coverage directory exists
ls -la apps/cosmic-horizons-web-e2e/coverage/

# Check environment variable is set
echo $COVERAGE

# Ensure test actually runs
COVERAGE=true pnpm nx run cosmic-horizons-web-e2e:e2e --verbose
```

### No Coverage Data in Report

**Problem**: Coverage shows 0%

**Solution**:

1. Verify tests are actually running and hitting code paths
2. Check that page navigation completes: `await page.waitForLoadState('networkidle')`
3. Use Firefox if Chromium coverage not working (fallback mode)

### Performance Issues

**Problem**: Tests slow with coverage enabled

**Solution**:

```bash
# Run with single worker
COVERAGE=true pnpm nx run cosmic-horizons-web-e2e:e2e --workers=1
```

## Advanced: Custom V8 Coverage

For direct V8 coverage (requires Chromium):

```typescript
import { chromium } from '@playwright/test';

test('direct V8 coverage', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  // Enable V8 coverage
  await context.initializeObjects?.();

  const page = await context.newPage();
  // ... test code ...

  await browser.close();
});
```

## Resources

- [Playwright Documentation](https://playwright.dev/docs/test-configuration)
- [Istanbul Coverage](https://istanbul.js.org/)
- [V8 Coverage](https://chromedevtools.github.io/devtools-protocol/tot/Coverage/)
- [NX Testing Documentation](https://nx.dev/packages/v16/angular/guides/test)

---

**Last Updated**: February 2026  
**Related Files**:

- `apps/cosmic-horizons-web-e2e/playwright.config.ts`
- `apps/cosmic-horizons-web-e2e/src/support/coverage.utils.ts`
- `scripts/analyze-e2e-coverage.mjs`
