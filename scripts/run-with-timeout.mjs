#!/usr/bin/env node
import { spawn } from 'child_process';

function parseArgs() {
  const argv = process.argv.slice(2);
  let timeout = 120000; // default 2 minutes
  let sepIndex = argv.indexOf('--');
  if (sepIndex === -1) sepIndex = argv.findIndex(a => a.startsWith('--run='));

  for (const arg of argv) {
    if (arg.startsWith('--timeout=')) {
      const v = parseInt(arg.split('=')[1], 10);
      if (!Number.isNaN(v)) timeout = v;
    }
  }

  // command is after the `--` if present, otherwise take remaining args
  const cmdIndex = argv.indexOf('--');
  const cmdParts = cmdIndex === -1 ? argv.filter(a => !a.startsWith('--timeout=')) : argv.slice(cmdIndex + 1);

  if (cmdParts.length === 0) {
    console.error('Usage: node run-with-timeout.mjs --timeout=MS -- <command...>');
    process.exit(2);
  }

  return { timeout, cmd: cmdParts.join(' ') };
}

const { timeout, cmd } = parseArgs();
console.log(`[run-with-timeout] Running command: ${cmd}`);
console.log(`[run-with-timeout] Expected max duration: ${Math.round(timeout/1000)}s`);
const start = Date.now();

const child = spawn(cmd, { shell: true, stdio: 'inherit' });

let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  console.error(`[run-with-timeout] Timed out after ${Math.round(timeout/1000)}s — killing process`);
  try { child.kill('SIGTERM'); } catch (e) { /* ignore */ }
}, timeout);

child.on('exit', (code, signal) => {
  clearTimeout(timer);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  if (timedOut) {
    console.error(`[run-with-timeout] Process killed after timeout (${elapsed}s)`);
    process.exit(124);
  }
  if (signal) {
    console.error(`[run-with-timeout] Process terminated with signal ${signal} after ${elapsed}s`);
    process.exit(1);
  }
  console.log(`[run-with-timeout] Process exited with code ${code} after ${elapsed}s`);
  process.exit(code ?? 0);
});