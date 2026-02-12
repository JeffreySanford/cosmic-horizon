# Coverage Setup & Automated Collection Guide

**Complete reference for collecting, analyzing, and improving code coverage across projects.**

Status: ✅ Implemented 2026-02-12

## Quick Start

```bash
# Generate coverage reports
pnpm run test:coverage

# View API coverage report
open apps/cosmic-horizons-api/test-output/jest/coverage/index.html

# Check specific project coverage
pnpm run test:coverage:api

# Generate JSON report for CI/CD
pnpm run test:coverage:report:json
```

## Current Coverage Status

| Project | Statements | Branches | Functions | Lines | Trend |
|---------|-----------|----------|-----------|-------|-------|
| **cosmic-horizons-api** | 69.23% ✅ | 50.06% ✅ | 61.41% ✅ | 70% ✅ | 📈 |
| **Target (Q2 2026)** | 75% | 60% | 75% | 80% | → |
| **Target (Q4 2026)** | 85% | 75% | 85% | 85% | → |

**Overall**: 1268 unit tests passing ✅

## Configuration

### Global Coverage Thresholds

Configured in `jest.preset.js` with realistic baselines:

```javascript
coverageThreshold: {
  global: {
    branches: 45,      // Min 45% (from 50.06% current)
    functions: 55,     // Min 55% (from 61.41% current)
    lines: 65,         // Min 65% (from 70% current)
    statements: 65,    // Min 65% (from 69.23% current)
  },
}
```

### Project-Specific Thresholds

API project (`jest.config.cts`) has elevated thresholds:

```javascript
coverageThreshold: {
  global: { branches: 45, functions: 55, lines: 65, statements: 65 },
  // Can add per-directory thresholds for critical services
}
```

## Available Commands

### Run Coverage Collection

```bash
# All projects with coverage
pnpm run test:coverage

# Specific project
pnpm run test:coverage:api
pnpm run test:coverage:web

# Generate human-readable report
pnpm run test:coverage:report

# Generate JSON output for tooling
pnpm run test:coverage:report:json

# Check thresholds only (no test execution)
pnpm run test:coverage:thresholds
```

### Nx Integration

```bash
# Run with Nx (respects coverage configuration)
nx run cosmic-horizons-api:test --coverage --watch=false

# Run multiple projects
nx run-many --target=test --all --coverage --watch=false
```

## Coverage Reports & Artifacts

### Locations

```text
apps/cosmic-horizons-api/test-output/jest/coverage/
├── index.html                    # Interactive HTML report
├── coverage-final.json           # Raw coverage data
├── coverage-summary.json         # Summary metrics
└── lcov-report/                  # LCOV format (for tools)
```

### Report Formats

Enabled reporters (in jest configs):

- ✅ `text` - Console output
- ✅ `text-summary` - Summary table
- ✅ `html` - Interactive HTML report
- ✅ `lcov` - Standard coverage format
- ✅ `json` - Machine-readable data
- ✅ `json-summary` - Summary JSON

## Coverage Improvement Roadmap

### Phase 1: Establish Baseline (Q1 2026) ✅

- Set realistic thresholds at current levels
- Implement automated collection
- Document processes

**Metrics**:

- Statements: 69.23%
- Branches: 50.06%
- Functions: 61.41%
- Lines: 70%

### Phase 2: Critical Path Coverage (Q2 2026)

- Target service layer → **75%+**
- Target controllers → **75%+**
- Target DTOs → **100%**

**Goals**: 75% statements, 60% branches

### Phase 3: Deep Coverage (Q3 2026)

- Utility functions → **90%+**
- Guards/middleware → **85%+**
- Integrations → **80%+**

**Goals**: 80% statements, 70% branches

### Phase 4: Excellence (Q4 2026)

- Platform-wide → **85%+**
- Critical services → **95%+**

**Goals**: 85% statements, 75% branches

## Integration with CI/CD

### GitHub Actions

Add to workflows:

```yaml
- name: Generate Coverage
  run: pnpm run test:coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./apps/cosmic-horizons-api/test-output/jest/coverage/coverage-final.json
    flags: api
    fail_ci_if_error: false
```

### Pre-Commit Checks

```bash
# Check coverage doesn't decrease
pnpm run test:coverage:thresholds
```

## Coverage Collection Flow

```text
┌─────────────────────────────────────────┐
│ 1. Run Tests with Coverage              │
│    pnpm run test:coverage               │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│ 2. Jest Collects V8 Coverage Data       │
│    (Statements, Branches, Functions)    │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│ 3. Generate Reports                     │
│    - coverage-final.json                │
│    - coverage-summary.json              │
│    - index.html                         │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│ 4. Check Against Thresholds             │
│    Pass ✅ / Fail ❌                    │
└─────────────────────────────────────────┘
```

## Best Practices

### ✅ Do

- Run coverage before commits
- Track metrics over time
- Focus on critical paths first
- Use reports to identify gaps
- Increase thresholds gradually
- Document skipped code sections

### ❌ Don't

- Skip coverage collection in CI
- Reduce thresholds to pass
- Add low-value tests for coverage only
- Ignore uncovered error paths
- Test internals instead of behavior

## Troubleshooting

### Coverage Not Collected

```bash
# Verify configuration
ls apps/cosmic-horizons-api/jest.config.cts

# Check collectCoverageFrom pattern
cat jest.preset.js | grep -A 10 collectCoverageFrom

# Run with debug output
DEBUG=jest:* pnpm run test:coverage:api
```

### Thresholds Not Met

```bash
# View actual coverage
cat apps/cosmic-horizons-api/test-output/jest/coverage/coverage-final.json | jq '.'

# Open HTML report
open apps/cosmic-horizons-api/test-output/jest/coverage/index.html

# Identify uncovered files
grep -r "\"s\":{}" apps/cosmic-horizons-api/test-output/jest/coverage/
```

### Reports Not Generated

```bash
# Ensure coverage directory exists
mkdir -p apps/cosmic-horizons-api/test-output/jest/coverage

# Check permissions
ls -la apps/cosmic-horizons-api/test-output/jest/coverage/

# Clear and retry
rm -rf apps/cosmic-horizons-api/test-output/jest/coverage/*
pnpm run test:coverage:api
```

## Tools & Integration

### Codecov Integration

Reports can be sent to [Codecov](https://codecov.io):

```bash
# Install codecov CLI
pnpm add -D @codecov/cli

# Upload report
codecov upload-files --files ./apps/cosmic-horizons-api/test-output/jest/coverage/coverage-final.json
```

### SonarQube Integration

Coverage can feed into SonarQube analysis:

```bash
# Configuration in sonar-project.properties
sonar.javascript.lcov.reportPaths=apps/cosmic-horizons-api/test-output/jest/coverage/lcov.info
```

### VS Code Integration

Install Coverage Gutters extension:

```bash
code --install-extension ryanluker.vscode-coverage-gutters
```

Then open any source file and coverage highlights will show.

## Performance Notes

- 🚀 Coverage collection adds ~10-15% to test time
- 💾 Reports consume ~5-10MB disk space per project
- 🔄 Reports cache well - use `--cache` flag in CI

## Related Documentation

- [TESTING-STRATEGY.md](TESTING-STRATEGY.md) - Testing approach
- [E2E_CODE_COVERAGE_GUIDE.md](E2E_CODE_COVERAGE_GUIDE.md) - E2E coverage details
- [NX_COVERAGE_CONFIG.md](NX_COVERAGE_CONFIG.md) - Nx-specific setup

## Support

For coverage configuration questions:

1. Check this guide
2. Review jest.preset.js and project jest configs
3. Consult Jest documentation: <https://jestjs.io/docs/configuration#collectcoveragefrom>
4. Review Nx docs: <https://nx.dev/packages/jest>

---

**Generated**: 2026-02-12
**Status**: Active
**Next Review**: 2026-03-12 (Q2 Phase 2 startup)
