#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const timeoutMs = Number(process.env.OLLAMA_WARMUP_TIMEOUT_MS || 600000);
const pollEveryMs = 2000;

function fail(message, details) {
  console.error(`\n[llm:warmup] FAIL: ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

function runDocker(args, opts = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    ...opts,
  });
  if (result.error) {
    fail(`Failed to execute docker ${args.join(' ')}`, result.error.message);
  }
  if (result.status !== 0) {
    fail(
      `docker ${args.join(' ')} exited with ${result.status}`,
      `${result.stdout || ''}\n${result.stderr || ''}`.trim(),
    );
  }
  return result.stdout?.trim() || '';
}

function composeUpWarmup() {
  runDocker([
    'compose',
    '-f',
    'docker-compose.yml',
    '-f',
    'docker-compose.events.yml',
    'up',
    '-d',
    '--no-deps',
    'cosmic-horizons-ollama',
    'cosmic-horizons-ollama-warmup',
  ]);
}

function inspectWarmupState() {
  const stateJson = runDocker([
    'inspect',
    'cosmic-horizons-ollama-warmup',
    '--format',
    '{{json .State}}',
  ]);
  try {
    return JSON.parse(stateJson);
  } catch (err) {
    fail('Unable to parse warmup container state.', String(err));
  }
}

function printWarmupLogsTail() {
  const logs = spawnSync(
    'docker',
    ['logs', '--tail', '60', 'cosmic-horizons-ollama-warmup'],
    {
      encoding: 'utf8',
    },
  );
  if (logs.stdout) console.log(logs.stdout.trim());
  if (logs.stderr) console.error(logs.stderr.trim());
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('[llm:warmup] Starting/restarting warmup service...');
  composeUpWarmup();

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const state = inspectWarmupState();
    const status = String(state?.Status || '').toLowerCase();
    const exitCode = Number(state?.ExitCode ?? -1);

    if (status === 'exited') {
      if (exitCode === 0) {
        console.log('[llm:warmup] PASS: warmup completed successfully.');
        process.exit(0);
      }
      printWarmupLogsTail();
      fail(`Warmup container exited with code ${exitCode}.`);
    }

    if (
      status === 'running' ||
      status === 'created' ||
      status === 'restarting'
    ) {
      process.stdout.write('.');
      await sleep(pollEveryMs);
      continue;
    }

    printWarmupLogsTail();
    fail(`Unexpected warmup container state: ${status || '(unknown)'}`);
  }

  printWarmupLogsTail();
  fail(`Warmup timed out after ${timeoutMs}ms.`);
}

await main();
