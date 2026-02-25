#!/usr/bin/env node
import { spawnSync } from 'child_process';

function checkAndRun() {
  const check = spawnSync('detect-secrets', ['--version'], { stdio: 'ignore' });
  if (check.error) {
    console.warn('detect-secrets not found in PATH; skipping secrets scan.');
    process.exit(0);
  }
  console.log('Running detect-secrets scan (this may be noisy)...');
  // Run a scan and output to stdout; do not fail the entire flow by default.
  const res = spawnSync('detect-secrets', ['scan', '--all-files'], {
    stdio: 'inherit',
  });
  process.exit(res.status || 0);
}

checkAndRun();
