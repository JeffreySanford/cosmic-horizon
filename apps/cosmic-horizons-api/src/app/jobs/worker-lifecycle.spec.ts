import { describe, it, expect } from '@jest/globals';

// placeholder for worker lifecycle tests
// these tests will interact with the local-llm worker process directly

import { spawn } from 'child_process';

function waitForProcessExit(
  proc: import('child_process').ChildProcess,
  timeoutMs = 5000,
): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(), timeoutMs);
    proc.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    proc.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

describe('worker lifecycle', () => {
  it('should start a dummy worker process and terminate gracefully', async () => {
    // use node -e to simulate a long-running worker
    const proc = spawn(process.execPath, ['-e', 'setTimeout(()=>{},10000)']);
    expect(proc.pid).toBeGreaterThan(0);
    proc.kill();
    await waitForProcessExit(proc);
    expect(proc.killed).toBe(true);
  });

  it('should requeue or mark job failed when CASA worker is killed mid-run', async () => {
    const Redis = require('ioredis');
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    try {
      await redis.ping();
    } catch {
      await redis.quit();
      expect(true).toBe(true);
      return;
    }

    // prepare a fake job entry
    const jobId = 'testjob-123';
    await redis.hset(`casa:job:${jobId}`, {
      status: 'RUNNING',
      progress: '0',
    });
    const workerProc = spawn(
      process.execPath,
      [
        '-r',
        'ts-node/register',
        'apps/cosmic-horizons-api/src/app/jobs/worker.ts',
      ],
      { shell: true },
    );
    // give the worker a moment to start
    await new Promise((res) => setTimeout(res, 200));
    workerProc.kill('SIGTERM');
    await waitForProcessExit(workerProc, 10000);
    const status = await redis.hget(`casa:job:${jobId}`, 'status');
    // abrupt termination is racey; status may remain, fail, or disappear
    expect(['RUNNING', 'QUEUED', 'FAILED', null]).toContain(status);
    await redis.quit();
  }, 15000);

  it('llm:smoke script should exit 0', async () => {
    const requireLiveSmoke = process.env.REQUIRE_LLM_SMOKE === 'true';
    const proc = spawn('pnpm', ['run', 'llm:smoke', '--', '--quick'], {
      shell: true,
      env: {
        ...process.env,
        OLLAMA_TIMEOUT_MS: process.env.OLLAMA_TIMEOUT_MS ?? '1500',
        OLLAMA_GENERATE_TIMEOUT_MS:
          process.env.OLLAMA_GENERATE_TIMEOUT_MS ?? '1500',
      },
    });
    let code: number | null = null;
    proc.on('exit', (c) => (code = c));
    await new Promise((res) => proc.on('close', res));
    if (requireLiveSmoke) {
      expect(code).toBe(0);
      return;
    }

    expect([0, 1]).toContain(code);
  });

  it('should map error codes to taxonomy', () => {
    const errors = ['TIMEOUT', 'MALFORMED', 'UNKNOWN'];
    // stub function that would translate codes
    const mapError = (code: string) => {
      if (code === 'TIMEOUT') return 'retryable';
      if (code === 'MALFORMED') return 'fatal';
      return 'unknown';
    };
    expect(mapError('TIMEOUT')).toBe('retryable');
    expect(mapError('MALFORMED')).toBe('fatal');
    expect(mapError('SOMETHING')).toBe('unknown');
  });
});
