import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';

const MAX_WAIT_MS = 120000;
const SLEEP_MS = 3000;

const sleep = (ms) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const dockerReady = () =>
  spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;

if (dockerReady()) {
  process.exit(0);
}

if (process.platform === 'win32') {
  const desktopExe = join(
    process.env['ProgramFiles'] ?? 'C:\\Program Files',
    'Docker',
    'Docker',
    'Docker Desktop.exe',
  );

  if (existsSync(desktopExe)) {
    try {
      spawn(desktopExe, [], { detached: true, stdio: 'ignore' }).unref();
      console.log(
        'Docker daemon is down. Attempting to start Docker Desktop...',
      );
    } catch {
      // no-op; fall through to wait loop and final error message
    }
  }
}

const start = Date.now();
while (Date.now() - start < MAX_WAIT_MS) {
  sleep(SLEEP_MS);
  if (dockerReady()) {
    console.log('Docker daemon is ready.');
    process.exit(0);
  }
}

console.error(
  'Docker daemon is not running after waiting. Start Docker Desktop and retry.',
);
process.exit(1);
