#!/usr/bin/env node
// simple helper used by Playwright webServer configuration
// starts API first, waits for health, then starts frontend

import { spawn } from 'child_process';
import http from 'http';
import https from 'https';
import { URL } from 'url';

function spawnCommand(cmd, args) {
  const proc = spawn(cmd, args, { shell: true, stdio: 'inherit' });
  proc.on('exit', (code) => {
    if (code !== 0) {
      console.error(`${cmd} ${args.join(' ')} exited with ${code}`);
      process.exit(code ?? 1);
    }
  });
  return proc;
}

function runCommandOnce(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { shell: true, stdio: 'inherit' });
    proc.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`));
    });
  });
}

function waitForUrl(url, timeout = 120000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;

    function attempt() {
      const req = lib.get(u, (res) => {
        const ok =
          res.statusCode && res.statusCode >= 200 && res.statusCode < 300;
        res.resume();
        if (ok) return resolve();
        schedule();
      });
      req.on('error', schedule);
      req.setTimeout(2000, () => {
        req.destroy();
        schedule();
      });
    }

    function schedule() {
      if (Date.now() - start > timeout) {
        reject(new Error(`URL ${url} not healthy after ${timeout}ms`));
      } else {
        setTimeout(attempt, 500);
      }
    }

    attempt();
  });
}

async function main() {
  const apiPort = process.env.API_PORT || '3000';
  const apiBase = process.env.API_BASE_URL || `http://127.0.0.1:${apiPort}`;
  const healthUrl = `${apiBase.replace(/\/$/, '')}/api/health`;

  console.log('running db:migrate before e2e webserver boot');
  await runCommandOnce('pnpm', ['run', 'db:migrate']);

  console.log('starting cosmic-horizons-api serve');
  const api = spawnCommand('pnpm', ['run', 'start:api']);

  try {
    await waitForUrl(healthUrl, 120000);
    console.log('api ready, starting web server');
  } catch (e) {
    console.error('api did not come up in time', e);
    process.exit(1);
  }

  const web = spawnCommand('pnpm', ['run', 'start:web']);

  // keep script running until both children exit
  api.on('exit', () => process.exit(0));
  web.on('exit', () => process.exit(0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
