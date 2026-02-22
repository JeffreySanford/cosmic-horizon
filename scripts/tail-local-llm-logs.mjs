#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const lines = process.env.OLLAMA_LOG_TAIL_LINES || '120';
const container = process.env.OLLAMA_LOG_CONTAINER || 'cosmic-horizons-ollama';

const result = spawnSync('docker', ['logs', '--tail', lines, container], {
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
