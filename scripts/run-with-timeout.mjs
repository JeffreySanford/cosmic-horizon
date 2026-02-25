#!/usr/bin/env node
import { spawn } from 'child_process';

function parseArgs() {
  const argv = process.argv.slice(2);
  let timeout = 120000; // default 2 minutes
  let idleMs = 120000; // default idle watchdog 2 minutes

  for (const arg of argv) {
    if (arg.startsWith('--timeout=')) {
      const v = parseInt(arg.split('=')[1], 10);
      if (!Number.isNaN(v)) timeout = v;
    }
    if (arg.startsWith('--idle-ms=')) {
      const v = parseInt(arg.split('=')[1], 10);
      if (!Number.isNaN(v)) idleMs = v;
    }
  }

  const cmdIndex = argv.indexOf('--');
  const cmdParts =
    cmdIndex === -1
      ? argv.filter(
          (a) => !a.startsWith('--timeout=') && !a.startsWith('--idle-ms='),
        )
      : argv.slice(cmdIndex + 1);

  if (cmdParts.length === 0) {
    console.error(
      'Usage: node run-with-timeout.mjs [--timeout=MS] [--idle-ms=MS] -- <command...>',
    );
    process.exit(2);
  }

  return { timeout, idleMs, cmd: cmdParts.join(' ') };
}

const { timeout, idleMs, cmd } = parseArgs();
console.log(`[run-with-timeout] Running command: ${cmd}`);
console.log(
  `[run-with-timeout] Expected max duration: ${Math.round(timeout / 1000)}s; idle watchdog: ${Math.round(idleMs / 1000)}s`,
);
const start = Date.now();

// Spawn the command using the shell so PATH resolution works reliably
// and cross-platform shims like pnpm are found.
const child = spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });

let timedOut = false;
let idleTimedOut = false;
let lastOutput = Date.now();

const resetIdle = () => {
  lastOutput = Date.now();
};

child.stdout.on('data', (chunk) => {
  resetIdle();
  process.stdout.write(chunk);
});
child.stderr.on('data', (chunk) => {
  resetIdle();
  process.stderr.write(chunk);
});

const timer = setTimeout(() => {
  timedOut = true;
  console.error(
    `[run-with-timeout] Timed out after ${Math.round(timeout / 1000)}s — killing process`,
  );
  try {
    child.kill('SIGTERM');
  } catch (e) {
    /* ignore */
  }
}, timeout);

const idleCheck = setInterval(
  () => {
    if (Date.now() - lastOutput > idleMs) {
      idleTimedOut = true;
      console.error(
        `[run-with-timeout] No output for ${Math.round(idleMs / 1000)}s — killing process`,
      );
      try {
        child.kill('SIGTERM');
      } catch (e) {
        /* ignore */
      }
    }
  },
  Math.max(1000, Math.min(5000, Math.floor(idleMs / 4))),
);

child.on('exit', (code, signal) => {
  clearTimeout(timer);
  clearInterval(idleCheck);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  if (idleTimedOut) {
    console.error(
      `[run-with-timeout] Process killed after idle timeout (${elapsed}s)`,
    );
    process.exit(125);
  }
  if (timedOut) {
    console.error(
      `[run-with-timeout] Process killed after timeout (${elapsed}s)`,
    );
    process.exit(124);
  }
  if (signal) {
    console.error(
      `[run-with-timeout] Process terminated with signal ${signal} after ${elapsed}s`,
    );
    process.exit(1);
  }
  console.log(
    `[run-with-timeout] Process exited with code ${code} after ${elapsed}s`,
  );
  process.exit(code ?? 0);
});
