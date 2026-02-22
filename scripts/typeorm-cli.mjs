#!/usr/bin/env node
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/typeorm-cli.mjs <typeorm-command> [...args]');
  process.exit(1);
}

const dataSourcePath = 'apps/cosmic-horizons-api/data-source.ts';
const env = {
  ...process.env,
  TS_NODE_PROJECT: 'apps/cosmic-horizons-api/tsconfig.app.json',
};

const proc = spawn(
  'pnpm',
  [
    'exec',
    'ts-node',
    '--transpile-only',
    '-r',
    'tsconfig-paths/register',
    'node_modules/typeorm/cli.js',
    ...args,
    '-d',
    dataSourcePath,
  ],
  { stdio: 'inherit', shell: true, env },
);

proc.on('exit', (code) => process.exit(code ?? 1));
