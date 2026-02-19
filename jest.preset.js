const nxPreset = require('@nx/jest/preset').default;

module.exports = {
  ...nxPreset,
  // Coverage configuration
  collectCoverage: false, // Enable with --coverage flag
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.spec.{js,jsx,ts,tsx}',
    '!src/**/*.test.{js,jsx,ts,tsx}',
    '!src/**/index.{js,jsx,ts,tsx}',
    '!src/**/*.module.{js,jsx,ts,tsx}',
    '!src/**/*.interface.{js,jsx,ts,tsx}',
    '!src/**/*.type.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/polyfills.ts',
  ],
  // Baseline thresholds for 90%+ coverage maintenance
  // Current: ~70% statements, ~50% branches, ~61% functions, ~70% lines
  // Target: Maintain 90%+ across all metrics
  coverageThreshold: {
    global: {
      branches: 90, // Target: 90%+ branch coverage
      functions: 90, // Target: 90%+ function coverage
      lines: 90, // Target: 90%+ line coverage
      statements: 90, // Target: 90%+ statement coverage
    },
  },
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json',
    'json-summary',
  ],
};
