import { test, expect } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

test('check-doc-consistency.mjs exits 0 and prints pass', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, '..', '..');
  const scriptPath = path.resolve(repoRoot, 'scripts', 'check-doc-consistency.mjs');

  const res = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    cwd: repoRoot,
    timeout: 30_000,
  });

  if (res.error) throw res.error;

  expect(res.status).toBe(0);
  expect((res.stdout || '') + (res.stderr || '')).toMatch(/Documentation consistency check passed/i);
});

test('check-mermaid.mjs validates diagrams and exits 0', () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, '..', '..');
  const scriptPath = path.resolve(repoRoot, 'scripts', 'check-mermaid.mjs');

  const res = spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    cwd: repoRoot,
    timeout: 60_000,
  });

  if (res.error) throw res.error;

  expect(res.status).toBe(0);
});
