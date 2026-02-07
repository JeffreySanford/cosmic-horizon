import { spawnSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const chromePath = chromium.executablePath();

if (!chromePath) {
  console.error('Unable to resolve Chromium executable path from Playwright.');
  process.exit(1);
}

const result = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['-y', '@lhci/cli', 'autorun', '--config=./lighthouserc.json'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      LHCI_CHROME_PATH: chromePath,
    },
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
