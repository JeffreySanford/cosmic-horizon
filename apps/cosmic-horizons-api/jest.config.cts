const { readFileSync } = require('fs');

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
  readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8'),
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

module.exports = {
  displayName: 'cosmic-horizons-api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: 'test-output/jest/coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/**/index.ts',
    '!src/**/main.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.type.ts',
    '!src/**/*.d.ts',
  ],
  // Realistic thresholds based on current coverage: ~70% statements, ~50% branches, ~61% functions
  // Plan: Maintain 90%+ coverage across all metrics
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
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
