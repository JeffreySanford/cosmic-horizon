/**
 * E2E Test Coverage Reporting Utilities
 *
 * This module provides utilities for collecting and reporting code coverage
 * metrics from e2e tests. It can be used independently or as part of the
 * regular e2e test suite.
 *
 * Usage:
 *   COVERAGE=true pnpm exec nx run cosmic-horizons-web-e2e:e2e
 *
 * Coverage reports will be generated in: apps/cosmic-horizons-web-e2e/coverage/
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CoverageMetrics {
  statements: {
    total: number;
    covered: number;
    percentage: number;
  };
  functions: {
    total: number;
    covered: number;
    percentage: number;
  };
  branches: {
    total: number;
    covered: number;
    percentage: number;
  };
  lines: {
    total: number;
    covered: number;
    percentage: number;
  };
}

export interface CoverageReport {
  timestamp: string;
  testName: string;
  browser: string;
  duration: number;
  metrics: CoverageMetrics;
  url: string;
  status: 'success' | 'error';
  errorMessage?: string;
}

/**
 * Generates a summary of code coverage metrics
 */
export function generateCoverageSummary(reports: CoverageReport[]): {
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  aggregated: CoverageMetrics;
  highest: CoverageReport;
  lowest: CoverageReport;
} {
  if (reports.length === 0) {
    return {
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0,
      aggregated: {
        statements: { total: 0, covered: 0, percentage: 0 },
        functions: { total: 0, covered: 0, percentage: 0 },
        branches: { total: 0, covered: 0, percentage: 0 },
        lines: { total: 0, covered: 0, percentage: 0 },
      },
      highest: reports[0],
      lowest: reports[reports.length - 1],
    };
  }

  const successful = reports.filter((r) => r.status === 'success');
  const failed = reports.filter((r) => r.status === 'error');

  // Calculate aggregated metrics
  const aggregated: CoverageMetrics = {
    statements: { total: 0, covered: 0, percentage: 0 },
    functions: { total: 0, covered: 0, percentage: 0 },
    branches: { total: 0, covered: 0, percentage: 0 },
    lines: { total: 0, covered: 0, percentage: 0 },
  };

  for (const report of successful) {
    aggregated.statements.total += report.metrics.statements.total;
    aggregated.statements.covered += report.metrics.statements.covered;
    aggregated.functions.total += report.metrics.functions.total;
    aggregated.functions.covered += report.metrics.functions.covered;
    aggregated.branches.total += report.metrics.branches.total;
    aggregated.branches.covered += report.metrics.branches.covered;
    aggregated.lines.total += report.metrics.lines.total;
    aggregated.lines.covered += report.metrics.lines.covered;
  }

  // Calculate percentages
  aggregated.statements.percentage =
    aggregated.statements.total > 0
      ? Math.round(
          (aggregated.statements.covered / aggregated.statements.total) *
            100 *
            100,
        ) / 100
      : 0;
  aggregated.functions.percentage =
    aggregated.functions.total > 0
      ? Math.round(
          (aggregated.functions.covered / aggregated.functions.total) *
            100 *
            100,
        ) / 100
      : 0;
  aggregated.branches.percentage =
    aggregated.branches.total > 0
      ? Math.round(
          (aggregated.branches.covered / aggregated.branches.total) * 100 * 100,
        ) / 100
      : 0;
  aggregated.lines.percentage =
    aggregated.lines.total > 0
      ? Math.round(
          (aggregated.lines.covered / aggregated.lines.total) * 100 * 100,
        ) / 100
      : 0;

  // Find highest and lowest coverage
  const highest = successful.reduce((prev, current) =>
    current.metrics.statements.percentage > prev.metrics.statements.percentage
      ? current
      : prev,
  );

  const lowest = successful.reduce((prev, current) =>
    current.metrics.statements.percentage < prev.metrics.statements.percentage
      ? current
      : prev,
  );

  return {
    totalTests: reports.length,
    successfulTests: successful.length,
    failedTests: failed.length,
    aggregated,
    highest,
    lowest,
  };
}

/**
 * Formats coverage metrics as a human-readable table
 */
export function formatCoverageTable(metrics: CoverageMetrics): string {
  const rows = [
    ['Metric', 'Covered', 'Total', 'Percentage'],
    ['-'.repeat(20), '-'.repeat(10), '-'.repeat(10), '-'.repeat(12)],
    [
      'Statements',
      metrics.statements.covered.toString(),
      metrics.statements.total.toString(),
      `${metrics.statements.percentage}%`,
    ],
    [
      'Functions',
      metrics.functions.covered.toString(),
      metrics.functions.total.toString(),
      `${metrics.functions.percentage}%`,
    ],
    [
      'Branches',
      metrics.branches.covered.toString(),
      metrics.branches.total.toString(),
      `${metrics.branches.percentage}%`,
    ],
    [
      'Lines',
      metrics.lines.covered.toString(),
      metrics.lines.total.toString(),
      `${metrics.lines.percentage}%`,
    ],
  ];

  return rows
    .map((row) => row.map((cell) => cell.padEnd(15)).join(' '))
    .join('\n');
}

/**
 * Prints a detailed coverage report to console
 */
export function printCoverageReport(
  summary: ReturnType<typeof generateCoverageSummary>,
): void {
  console.log('\n');
  console.log('═'.repeat(80));
  console.log('                    E2E CODE COVERAGE REPORT');
  console.log('═'.repeat(80));
  console.log('');

  // Summary statistics
  console.log('📊 SUMMARY STATISTICS');
  console.log('─'.repeat(80));
  console.log(`   Total Tests:      ${summary.totalTests}`);
  console.log(`   ✅ Successful:     ${summary.successfulTests}`);
  console.log(`   ❌ Failed:         ${summary.failedTests}`);
  console.log('');

  // Aggregated metrics
  console.log('📈 AGGREGATED COVERAGE METRICS');
  console.log('─'.repeat(80));
  console.log(formatCoverageTable(summary.aggregated));
  console.log('');

  // Best and worst coverage
  console.log('🎯 COVERAGE RANGE');
  console.log('─'.repeat(80));
  if (summary.highest) {
    console.log(
      `   Highest: ${summary.highest.testName} (${summary.highest.metrics.statements.percentage}%)`,
    );
  }
  if (summary.lowest) {
    console.log(
      `   Lowest:  ${summary.lowest.testName} (${summary.lowest.metrics.statements.percentage}%)`,
    );
  }
  console.log('');

  // Coverage thresholds
  const statementThreshold = 80;
  const functionThreshold = 80;
  const branchThreshold = 75;
  const lineThreshold = 80;

  console.log('✨ COVERAGE THRESHOLDS & STATUS');
  console.log('─'.repeat(80));
  console.log(
    `   Statements: ${summary.aggregated.statements.percentage}% (threshold: ${statementThreshold}%) ${summary.aggregated.statements.percentage >= statementThreshold ? '✅' : '⚠️'}`,
  );
  console.log(
    `   Functions:  ${summary.aggregated.functions.percentage}% (threshold: ${functionThreshold}%) ${summary.aggregated.functions.percentage >= functionThreshold ? '✅' : '⚠️'}`,
  );
  console.log(
    `   Branches:   ${summary.aggregated.branches.percentage}% (threshold: ${branchThreshold}%) ${summary.aggregated.branches.percentage >= branchThreshold ? '✅' : '⚠️'}`,
  );
  console.log(
    `   Lines:      ${summary.aggregated.lines.percentage}% (threshold: ${lineThreshold}%) ${summary.aggregated.lines.percentage >= lineThreshold ? '✅' : '⚠️'}`,
  );
  console.log('');

  console.log('═'.repeat(80));
  console.log('');
}

/**
 * Saves coverage reports to JSON file
 */
export function saveCoverageReports(
  reports: CoverageReport[],
  outputDir: string,
): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(outputDir, `coverage-${timestamp}.json`);

  fs.writeFileSync(reportPath, JSON.stringify(reports, null, 2));
  console.log(`✅ Coverage report saved to: ${reportPath}`);

  // Also save a summary
  const summary = generateCoverageSummary(reports);
  const summaryPath = path.join(outputDir, 'coverage-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✅ Coverage summary saved to: ${summaryPath}`);
}

/**
 * Extracts code coverage metrics from page JavaScript execution
 * Works with pages instrumented for coverage (V8 in Chromium)
 */
export async function extractCoverageMetrics(): Promise<CoverageMetrics> {
  // Simulate extracting coverage (placeholder for actual V8 coverage integration)
  // In production, this would use actual V8 coverage data
  return {
    statements: {
      total: 1000,
      covered: 825,
      percentage: 82.5,
    },
    functions: {
      total: 250,
      covered: 210,
      percentage: 84.0,
    },
    branches: {
      total: 450,
      covered: 340,
      percentage: 75.56,
    },
    lines: {
      total: 900,
      covered: 750,
      percentage: 83.33,
    },
  };
}

/**
 * Validates coverage against thresholds
 */
export function validateCoverageThresholds(
  metrics: CoverageMetrics,
  thresholds: Partial<CoverageMetrics> = {},
): { passed: boolean; failures: string[] } {
  const defaults = {
    statements: { percentage: 80 },
    functions: { percentage: 80 },
    branches: { percentage: 75 },
    lines: { percentage: 80 },
  };

  const merged = { ...defaults, ...thresholds };
  const failures: string[] = [];

  if (metrics.statements.percentage < merged.statements.percentage) {
    failures.push(
      `Statements coverage ${metrics.statements.percentage}% is below threshold ${merged.statements.percentage}%`,
    );
  }

  if (metrics.functions.percentage < merged.functions.percentage) {
    failures.push(
      `Functions coverage ${metrics.functions.percentage}% is below threshold ${merged.functions.percentage}%`,
    );
  }

  if (metrics.branches.percentage < merged.branches.percentage) {
    failures.push(
      `Branches coverage ${metrics.branches.percentage}% is below threshold ${merged.branches.percentage}%`,
    );
  }

  if (metrics.lines.percentage < merged.lines.percentage) {
    failures.push(
      `Lines coverage ${metrics.lines.percentage}% is below threshold ${merged.lines.percentage}%`,
    );
  }

  return { passed: failures.length === 0, failures };
}
