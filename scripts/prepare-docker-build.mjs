#!/usr/bin/env node
// ensure required files are present in build contexts
import fs from 'fs';
import path from 'path';

const workspaceRoot = path.resolve(process.cwd());
const apiDir = path.join(workspaceRoot, 'apps', 'cosmic-horizons-api');

// run the `prune` target so dist contains a trimmed package and workspace modules
import { execSync } from 'child_process';
try {
  console.log('Running Nx prune target to prepare dist for Docker');
  execSync('pnpm nx run cosmic-horizons-api:prune', { stdio: 'inherit' });
} catch (err) {
  console.warn('Nx prune failed (continuing):', err.message);
}

// copy lockfile from dist (optional) to make context workable if dockerfile references it
const distLock = path.join(apiDir, 'dist', 'pnpm-lock.yaml');
const lockDest = path.join(apiDir, 'pnpm-lock.yaml');
try {
  if (fs.existsSync(distLock)) {
    fs.copyFileSync(distLock, lockDest);
    console.log('Copied pruned pnpm-lock.yaml into API build context');
  }
} catch (err) {
  console.warn('Failed to copy lockfile from dist:', err.message);
}
