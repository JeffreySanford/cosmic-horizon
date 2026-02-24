#!/usr/bin/env node
import { spawnSync } from 'child_process';

function runCmd(cmd, args) {
  console.log(`Running: ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  return r.status || 0;
}

async function main() {
  // Scans are opt-in by default. Set RUN_TRIVY=1, RUN_SEMGREP=1, RUN_SECRETS=1 to enable.
  const runTrivy = process.env.RUN_TRIVY === '1';
  const runSemgrep = process.env.RUN_SEMGREP === '1';
  const runSecrets = process.env.RUN_SECRETS === '1';

  if (runTrivy) {
    const rc = runCmd('node', ['scripts/trivy-scan.mjs']);
    if (rc !== 0) process.exit(rc);
  } else {
    console.log('Skipping trivy scan (set RUN_TRIVY=1 to enable)');
  }

  if (runSemgrep) {
    const rc = runCmd('node', ['scripts/security-semgrep.mjs']);
    if (rc !== 0) process.exit(rc);
  } else {
    console.log('Skipping semgrep (set RUN_SEMGREP=1 to enable)');
  }

  if (runSecrets) {
    const rc = runCmd('node', ['scripts/security-detect-secrets.mjs']);
    if (rc !== 0) process.exit(rc);
  } else {
    console.log('Skipping detect-secrets (set RUN_SECRETS=1 to enable)');
  }

  console.log('Optional security extras completed.');
  process.exit(0);
}

main();
