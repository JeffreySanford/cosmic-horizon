#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const start = Date.now();

const checks = [
  {
    name: 'models',
    command: ['pnpm', 'run', 'llm:models'],
  },
  {
    name: 'smoke:quick',
    command: ['pnpm', 'run', 'llm:smoke:quick'],
  },
  {
    name: 'smoke',
    command: ['pnpm', 'run', 'llm:smoke'],
  },
];

function runCheck({ name, command }) {
  console.log(`\n[llm:doctor] Running ${name}...`);
  const result = spawnSync(command[0], command.slice(1), {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return {
    name,
    ok: result.status === 0,
    code: result.status ?? 1,
  };
}

function printSummary(results) {
  console.log('\n[llm:doctor] Summary');
  for (const result of results) {
    const marker = result.ok ? 'PASS' : 'FAIL';
    console.log(
      `- ${result.name}: ${marker}${result.ok ? '' : ` (exit ${result.code})`}`,
    );
  }
  const elapsed = Date.now() - start;
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error(`[llm:doctor] FAIL in ${elapsed}ms`);
    process.exit(1);
  }
  console.log(`[llm:doctor] PASS in ${elapsed}ms`);
}

const results = checks.map(runCheck);
printSummary(results);
