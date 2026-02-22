#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11435';
const model = process.env.OLLAMA_MODEL || 'qwen3:8b';

function docker(args) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    code: result.status ?? 1,
  };
}

function inspectContainer(name) {
  const resp = docker(['inspect', name, '--format', '{{json .State}}']);
  if (!resp.ok) {
    return { exists: false, state: null };
  }
  try {
    return { exists: true, state: JSON.parse(resp.stdout) };
  } catch {
    return { exists: true, state: null };
  }
}

function printContainerStatus(name) {
  const { exists, state } = inspectContainer(name);
  if (!exists) {
    console.log(`- ${name}: not found`);
    return;
  }
  const status = state?.Status || 'unknown';
  const health = state?.Health?.Status || 'n/a';
  const exitCode = state?.ExitCode;
  const detail = status === 'exited' ? ` (exit ${exitCode ?? 'n/a'})` : '';
  console.log(`- ${name}: ${status}${detail}, health=${health}`);
}

function main() {
  console.log('[llm:status] Local LLM runtime status');
  console.log(`- endpoint: ${baseUrl}`);
  console.log(`- expected model: ${model}`);

  printContainerStatus('cosmic-horizons-ollama');
  printContainerStatus('cosmic-horizons-ollama-warmup');

  const ps = docker([
    'ps',
    '--format',
    'table {{.Names}}\t{{.Status}}\t{{.Ports}}',
  ]);
  if (ps.ok) {
    const lines = ps.stdout
      .split('\n')
      .filter((line) => line.includes('cosmic-horizons-ollama'));
    if (lines.length) {
      console.log('\n[llm:status] Running container ports');
      for (const line of lines) {
        console.log(line);
      }
    }
  }
}

main();
