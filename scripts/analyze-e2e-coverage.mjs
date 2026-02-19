#!/usr/bin/env node

/**
 * E2E Code Coverage Analysis Script
 *
 * Generates comprehensive code coverage reports for e2e tests.
 * Supports both web (Playwright) and API (Jest) e2e test suites.
 *
 * Usage:
 *   node scripts/analyze-e2e-coverage.mjs [--output ./coverage] [--format html|json|text]
 *
 * Environment Variables:
 *   COVERAGE=true         - Enable coverage collection
 *   OUTPUT_DIR=path       - Output directory for reports
 *   COVERAGE_FORMAT=type  - Report format (html, json, text)
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { join } from 'node:path';

// Configuration
const outputDir = process.env.OUTPUT_DIR || './coverage-e2e';
const format = process.env.COVERAGE_FORMAT || 'text';
const projectRoot = process.cwd();

// Coverage data locations
const coveragePaths = [
  'apps/cosmic-horizons-web-e2e/coverage',
  'apps/cosmic-horizons-api-e2e/coverage',
  'coverage/e2e',
];

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

/**
 * Find all coverage files
 */
function findCoverageFiles() {
  const files = [];

  for (const basePath of coveragePaths) {
    const fullPath = join(projectRoot, basePath);
    if (!existsSync(fullPath)) continue;

    const walker = (dir) => {
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = join(dir, entry.name);
          if (entry.isDirectory()) {
            walker(full);
          } else if (entry.isFile() && entry.name.endsWith('.json')) {
            files.push(full);
          }
        }
      } catch {
        // Silently skip inaccessible directories
      }
    };

    walker(fullPath);
  }

  return files;
}

/**
 * Parse Jest coverage data
 */
function parseJestCoverage(data) {
  if (!data.total) return null;

  return {
    type: 'jest',
    stats: {
      statements: {
        total: data.total.statements?.total || 0,
        covered: data.total.statements?.covered || 0,
        percentage: data.total.statements?.pct || 0,
      },
      functions: {
        total: data.total.functions?.total || 0,
        covered: data.total.functions?.covered || 0,
        percentage: data.total.functions?.pct || 0,
      },
      branches: {
        total: data.total.branches?.total || 0,
        covered: data.total.branches?.covered || 0,
        percentage: data.total.branches?.pct || 0,
      },
      lines: {
        total: data.total.lines?.total || 0,
        covered: data.total.lines?.covered || 0,
        percentage: data.total.lines?.pct || 0,
      },
    },
  };
}

/**
 * Aggregate coverage data
 */
function aggregateCoverage(files) {
  const coverageData = [];
  const aggregated = {
    statements: { total: 0, covered: 0 },
    functions: { total: 0, covered: 0 },
    branches: { total: 0, covered: 0 },
    lines: { total: 0, covered: 0 },
  };

  for (const file of files) {
    try {
      const content = JSON.parse(readFileSync(file, 'utf8'));
      const parsed = parseJestCoverage(content);

      if (!parsed) continue;

      coverageData.push({
        file,
        ...parsed,
      });

      // Aggregate metrics
      aggregated.statements.total += parsed.stats.statements.total;
      aggregated.statements.covered += parsed.stats.statements.covered;
      aggregated.functions.total += parsed.stats.functions.total;
      aggregated.functions.covered += parsed.stats.functions.covered;
      aggregated.branches.total += parsed.stats.branches.total;
      aggregated.branches.covered += parsed.stats.branches.covered;
      aggregated.lines.total += parsed.stats.lines.total;
      aggregated.lines.covered += parsed.stats.lines.covered;
    } catch (err) {
      console.warn(`Warning: Could not parse ${file}: ${err.message}`);
    }
  }

  // Calculate percentages
  const result = {
    statements: {
      ...aggregated.statements,
      percentage:
        aggregated.statements.total > 0
          ? Math.round(
              (aggregated.statements.covered / aggregated.statements.total) *
                100 *
                100,
            ) / 100
          : 0,
    },
    functions: {
      ...aggregated.functions,
      percentage:
        aggregated.functions.total > 0
          ? Math.round(
              (aggregated.functions.covered / aggregated.functions.total) *
                100 *
                100,
            ) / 100
          : 0,
    },
    branches: {
      ...aggregated.branches,
      percentage:
        aggregated.branches.total > 0
          ? Math.round(
              (aggregated.branches.covered / aggregated.branches.total) *
                100 *
                100,
            ) / 100
          : 0,
    },
    lines: {
      ...aggregated.lines,
      percentage:
        aggregated.lines.total > 0
          ? Math.round(
              (aggregated.lines.covered / aggregated.lines.total) * 100 * 100,
            ) / 100
          : 0,
    },
  };

  return { coverageData, aggregated: result };
}

/**
 * Format coverage as text table
 */
function formatAsText(aggregated) {
  const rows = [
    ['Coverage Type', 'Covered', 'Total', 'Percentage', 'Status'],
    [
      '─'.repeat(20),
      '─'.repeat(10),
      '─'.repeat(10),
      '─'.repeat(12),
      '─'.repeat(8),
    ],
  ];

  const thresholds = {
    statements: 80,
    functions: 80,
    branches: 75,
    lines: 80,
  };

  for (const [type, threshold] of Object.entries(thresholds)) {
    const metric = aggregated[type];
    const status = metric.percentage >= threshold ? '✅ PASS' : '⚠️ WARN';
    rows.push([
      type.charAt(0).toUpperCase() + type.slice(1),
      metric.covered.toString(),
      metric.total.toString(),
      `${metric.percentage}%`,
      status,
    ]);
  }

  return rows
    .map((row) => row.map((cell) => cell.padEnd(20)).join(' | '))
    .join('\n');
}

/**
 * Generate HTML report
 */
function generateHtmlReport(aggregated) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E2E Code Coverage Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    .header p {
      opacity: 0.9;
      font-size: 1.1em;
    }
    .content {
      padding: 40px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 30px;
    }
    .metric-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 25px;
      border-radius: 10px;
      text-align: center;
      box-shadow: 0 10px 20px rgba(0,0,0,0.1);
    }
    .metric-card h3 {
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 15px;
      opacity: 0.9;
    }
    .metric-card .percentage {
      font-size: 2.5em;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .metric-card .stats {
      font-size: 0.85em;
      opacity: 0.85;
    }
    .pass { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important; }
    .warn { background: linear-gradient(135deg, #f59e0b 0%, #dc2626 100%) !important; }
    .table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 30px;
    }
    .table th {
      background: #f3f4f6;
      padding: 15px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
    }
    .table td {
      padding: 12px 15px;
      border-bottom: 1px solid #e5e7eb;
    }
    .table tr:hover {
      background: #f9fafb;
    }
    .footer {
      background: #f3f4f6;
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 E2E Code Coverage Report</h1>
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
    <div class="content">
      <div class="metrics-grid">
        <div class="metric-card ${aggregated.statements.percentage >= 80 ? 'pass' : 'warn'}">
          <h3>Statements</h3>
          <div class="percentage">${aggregated.statements.percentage}%</div>
          <div class="stats">${aggregated.statements.covered} / ${aggregated.statements.total}</div>
        </div>
        <div class="metric-card ${aggregated.functions.percentage >= 80 ? 'pass' : 'warn'}">
          <h3>Functions</h3>
          <div class="percentage">${aggregated.functions.percentage}%</div>
          <div class="stats">${aggregated.functions.covered} / ${aggregated.functions.total}</div>
        </div>
        <div class="metric-card ${aggregated.branches.percentage >= 75 ? 'pass' : 'warn'}">
          <h3>Branches</h3>
          <div class="percentage">${aggregated.branches.percentage}%</div>
          <div class="stats">${aggregated.branches.covered} / ${aggregated.branches.total}</div>
        </div>
        <div class="metric-card ${aggregated.lines.percentage >= 80 ? 'pass' : 'warn'}">
          <h3>Lines</h3>
          <div class="percentage">${aggregated.lines.percentage}%</div>
          <div class="stats">${aggregated.lines.covered} / ${aggregated.lines.total}</div>
        </div>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Metric Type</th>
            <th>Covered</th>
            <th>Total</th>
            <th>Percentage</th>
            <th>Threshold</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Statements</td>
            <td>${aggregated.statements.covered}</td>
            <td>${aggregated.statements.total}</td>
            <td>${aggregated.statements.percentage}%</td>
            <td>80%</td>
            <td>${aggregated.statements.percentage >= 80 ? '✅' : '⚠️'}</td>
          </tr>
          <tr>
            <td>Functions</td>
            <td>${aggregated.functions.covered}</td>
            <td>${aggregated.functions.total}</td>
            <td>${aggregated.functions.percentage}%</td>
            <td>80%</td>
            <td>${aggregated.functions.percentage >= 80 ? '✅' : '⚠️'}</td>
          </tr>
          <tr>
            <td>Branches</td>
            <td>${aggregated.branches.covered}</td>
            <td>${aggregated.branches.total}</td>
            <td>${aggregated.branches.percentage}%</td>
            <td>75%</td>
            <td>${aggregated.branches.percentage >= 75 ? '✅' : '⚠️'}</td>
          </tr>
          <tr>
            <td>Lines</td>
            <td>${aggregated.lines.covered}</td>
            <td>${aggregated.lines.total}</td>
            <td>${aggregated.lines.percentage}%</td>
            <td>80%</td>
            <td>${aggregated.lines.percentage >= 80 ? '✅' : '⚠️'}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="footer">
      <p>Coverage thresholds: Statements & Lines 80% | Functions 80% | Branches 75%</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

/**
 * Main execution
 */
function main() {
  console.log('🔍 Analyzing E2E Code Coverage...\n');

  const files = findCoverageFiles();

  if (files.length === 0) {
    console.log(
      '⚠️  No coverage files found. Make sure to run tests with COVERAGE=true',
    );
    process.exit(1);
  }

  console.log(`✅ Found ${files.length} coverage file(s)\n`);

  const { aggregated } = aggregateCoverage(files);

  // Generate report
  let report = '';
  let filename = '';

  if (format === 'json') {
    report = JSON.stringify(aggregated, null, 2);
    filename = 'coverage-report.json';
  } else if (format === 'html') {
    report = generateHtmlReport(aggregated);
    filename = 'coverage-report.html';
  } else {
    report = formatAsText(aggregated);
    filename = 'coverage-report.txt';
  }

  // Save report
  const reportPath = join(outputDir, filename);
  writeFileSync(reportPath, report);

  console.log('═'.repeat(80));
  console.log('                    E2E CODE COVERAGE REPORT');
  console.log('═'.repeat(80));
  console.log('');

  if (format !== 'json') {
    console.log(report);
  }

  console.log('');
  console.log(`📄 Report saved to: ${reportPath}`);
  console.log('');
  console.log('═'.repeat(80));
}

main();
