#!/usr/bin/env node
import { spawnSync } from 'child_process';

function checkAndRun() {
  const check = spawnSync('semgrep', ['--version'], { stdio: 'ignore' });
  if (check.error) {
    console.warn('semgrep not found in PATH; skipping semgrep scan.');
    process.exit(0);
  }
  console.log('Running semgrep (this may take a while)...');
  const res = spawnSync('semgrep', ['--config', 'auto', '--quiet', '.'], { stdio: 'inherit' });
  process.exit(res.status || 0);
}

checkAndRun();
