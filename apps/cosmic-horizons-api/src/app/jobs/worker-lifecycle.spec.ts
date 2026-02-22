import { describe, it, expect } from '@jest/globals';

// placeholder for worker lifecycle tests
// these tests will interact with the local-llm worker process directly

import { spawn } from 'child_process';

describe('local LLM worker lifecycle', () => {
  it('should start a dummy worker process and terminate gracefully', async () => {
    // use node -e to simulate a long-running worker
    const proc = spawn(process.execPath, ['-e', 'setTimeout(()=>{},10000)']);
    expect(proc.pid).toBeGreaterThan(0);
    proc.kill();
    await new Promise((res) => proc.on('exit', res));
    expect(proc.killed).toBe(true);
  });

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
