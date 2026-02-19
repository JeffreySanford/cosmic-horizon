import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';
import * as fs from 'fs';
import * as path from 'path';

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

// Coverage configuration
const enableCoverage = process.env['COVERAGE'] === 'true';
const coverageDir = path.join(__dirname, 'coverage', 'browser');

// Ensure coverage directory exists
if (enableCoverage && !fs.existsSync(coverageDir)) {
  fs.mkdirSync(coverageDir, { recursive: true });
}

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * Code Coverage Options:
 * - COVERAGE=true: Enable code coverage collection (V8 for Chromium)
 * - runs separately from regular e2e tests
 * - coverage reports available in coverage/browser/
 */
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: './src' }),
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  fullyParallel: false,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  /* Run your local dev server before starting the tests. Bind to 0.0.0.0 on CI so containerized services can reach it. */
  webServer: {
    // Start both frontend and API so E2E tests have the real backend available.
    command: `pnpm exec nx run-many --target=serve --projects=cosmic-horizons-web,cosmic-horizons-api --parallel=2 --skip-nx-cache --host=${process.env['CI'] ? '0.0.0.0' : 'localhost'}`,
    url: baseURL,
    reuseExistingServer: true,
    cwd: workspaceRoot,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(enableCoverage && {
          viewport: { width: 1280, height: 720 },
        }),
      },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
