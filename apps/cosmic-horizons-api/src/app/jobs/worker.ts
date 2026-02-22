import Redis from 'ioredis';
import { spawn } from 'child_process';
// fs imports were previously added for potential future script generation but
// are unused at the moment; drop them to silence lint errors.

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const dataDir = process.env.ASTRO_DATA_DIR || '/data';
const redis = new Redis(redisUrl);

async function processJob(jobId: string) {
  const key = `casa:job:${jobId}`;
  await redis.hset(key, 'status', 'RUNNING');
  // for simplicity assume a script is already present at /data/run-image.py
  const scriptPath = `${dataDir}/run-image.py`;

  try {
    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        'docker',
        ['run', '--rm', `-v`, `${dataDir}:${dataDir}`, 'casapy/casa:latest', '--nogui', '-c', scriptPath],
        { stdio: 'inherit' },
      );
      proc.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`CASA exited with code ${code}`));
        }
      });
      proc.on('error', reject);
    });

    // mark completed and write output path
    await redis.hset(
      key,
      'status',
      'COMPLETED',
      'progress',
      '1',
      'output_url',
      `/files/${jobId}.fits`,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await redis.hset(key, 'status', 'FAILED', 'error', message);
  }
}

async function main() {
  console.log('CASA worker starting, connecting to', redisUrl);
  while (true) {
    const res = await redis.brpop('casa:queue', 0);
    if (!res) {
      // brpop returns null on timeout; loop again to avoid crash
      continue;
    }
    const jobId = res[1];
    console.log('pulled job', jobId);
    await processJob(jobId);
  }
}

main().catch((e) => {
  console.error('worker error', e);
  process.exit(1);
});
