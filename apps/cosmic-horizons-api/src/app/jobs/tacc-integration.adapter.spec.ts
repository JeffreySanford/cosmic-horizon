import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  DemoTaccAdapter,
  LiveTaccAdapter,
  LocalLlmAdapter,
  CasaTaccAdapter,
  TACC_ADAPTER,
  TaccAdapter,
  TaccIntegrationService,
} from './tacc-integration.service';

// Increase Jest timeout for potentially longer integration-style tests in this file
jest.setTimeout(15000);

// Provide an in-memory mock for ioredis so tests do not attempt real Redis connections
class MockRedis {
  private lists = new Map<string, string[]>();
  private hashes = new Map<string, Record<string, string>>();
  async ping() {
    return 'PONG';
  }
  async llen(key: string) {
    return (this.lists.get(key) || []).length;
  }
  async lpush(key: string, value: string) {
    const arr = this.lists.get(key) || [];
    arr.unshift(value);
    this.lists.set(key, arr);
    return arr.length;
  }
  async brpop(key: string, timeoutSec: number) {
    const end = Date.now() + (timeoutSec || 1) * 1000;
    while (Date.now() <= end) {
      const arr = this.lists.get(key) || [];
      if (arr.length > 0) {
        const val = arr.pop() as string;
        this.lists.set(key, arr);
        return [key, val];
      }
      // small delay
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  }
  async hset(key: string, ...pairs: string[]) {
    const map = this.hashes.get(key) || {};
    for (let i = 0; i < pairs.length; i += 2) {
      map[pairs[i]] = pairs[i + 1];
    }
    this.hashes.set(key, map);
    return Object.keys(map).length;
  }
  async hgetall(key: string) {
    return this.hashes.get(key) || {};
  }
  async flushall() {
    this.lists.clear();
    this.hashes.clear();
    return 'OK';
  }
}

// Mock ioredis before any code that requires it runs
jest.mock('ioredis', () => {
  return jest
    .fn()
    .mockImplementation(
      (...args: unknown[]) => new MockRedis(args[0] as string),
    );
});

interface MockConfig {
  REMOTE_COMPUTE_MODE?: string;
  TACC_LIVE?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
  OLLAMA_TIMEOUT_MS?: number;
  OLLAMA_MAX_RETRIES?: number;
  TACC_TENANT_BASE_URL?: string;
  CASA_QUEUE_LIMIT?: number;
}

describe('Tacc adapter wiring', () => {
  let moduleRef: TestingModule;
  let configValues: MockConfig;

  beforeEach(() => {
    configValues = {
      REMOTE_COMPUTE_MODE: 'demo',
      TACC_LIVE: 'false',
      REDIS_URL: 'redis://fake',
      OLLAMA_BASE_URL: 'http://localhost:11435',
      OLLAMA_MODEL: 'qwen3:8b',
      OLLAMA_TIMEOUT_MS: 1000,
      OLLAMA_MAX_RETRIES: 1,
      TACC_TENANT_BASE_URL: 'https://tacc.tapis.io',
    };
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  async function buildModule(): Promise<TestingModule> {
    return Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: keyof MockConfig, def?: unknown) => {
              return configValues[key] ?? def;
            }),
          },
        },
        DemoTaccAdapter,
        LocalLlmAdapter,
        LiveTaccAdapter,
        {
          provide: TACC_ADAPTER,
          useFactory: (config: ConfigService): TaccAdapter => {
            const mode = (
              config.get<string>('REMOTE_COMPUTE_MODE') ??
              (config.get('TACC_LIVE') === 'true' ? 'live' : 'demo')
            ).toLowerCase();
            if (mode === 'live') {
              return new LiveTaccAdapter(config);
            }
            if (mode === 'local-llm') {
              return new LocalLlmAdapter(config);
            }
            if (mode === 'astronomy' || mode === 'casa') {
              return new CasaTaccAdapter(config);
            }
            return new DemoTaccAdapter(config);
          },
          inject: [ConfigService],
        },
        TaccIntegrationService,
      ],
    }).compile();
  }

  it('uses Demo adapter when mode is demo', async () => {
    configValues.REMOTE_COMPUTE_MODE = 'demo';
    moduleRef = await buildModule();

    const service = moduleRef.get<TaccIntegrationService>(
      TaccIntegrationService,
    );
    const result = await service.submitJob({
      agent: 'AlphaCal',
      dataset_id: 'dataset-1',
      params: {},
    });

    expect(result.jobId).toMatch(/^tacc-/);
    const caps = await service.getCapabilities();
    expect(caps.demoMode).toBe(true);
  });

  it('uses Casa adapter when mode is astronomy', async () => {
    configValues.REMOTE_COMPUTE_MODE = 'astronomy';
    // ensure redis mock is available so constructor can run
    moduleRef = await buildModule();
    const service = moduleRef.get<TaccIntegrationService>(
      TaccIntegrationService,
    );
    const res = await service.submitJob({
      agent: 'AlphaCal',
      dataset_id: 'ds',
      params: {},
    });
    expect(res.jobId).toMatch(/^casa-/);
  });

  it('enforces queue length limit configured via CASA_QUEUE_LIMIT', async () => {
    configValues.REMOTE_COMPUTE_MODE = 'astronomy';
    configValues.CASA_QUEUE_LIMIT = 1 as any;
    moduleRef = await buildModule();
    const service = moduleRef.get<TaccIntegrationService>(
      TaccIntegrationService,
    );
    // direct access to underlying adapter to manipulate redis state
    const adapter = (service as unknown as { resolvedAdapter: CasaTaccAdapter })
      .resolvedAdapter as CasaTaccAdapter;
    // clear any existing keys
    await adapter['redis'].flushall();
    // push a dummy job to hit the limit
    await adapter['redis'].lpush('casa:queue', 'existing-id');

    await expect(
      service.submitJob({ agent: 'AlphaCal', dataset_id: 'ds', params: {} }),
    ).rejects.toMatchObject({ code: 'QUEUE_FULL' });
  });

  it('can run a job end-to-end with simulated CASA worker', async () => {
    configValues.REMOTE_COMPUTE_MODE = 'astronomy';
    configValues.CASA_QUEUE_LIMIT = 5 as any;
    moduleRef = await buildModule();
    const service = moduleRef.get<TaccIntegrationService>(
      TaccIntegrationService,
    );
    const adapter = (service as unknown as { resolvedAdapter: CasaTaccAdapter })
      .resolvedAdapter as CasaTaccAdapter;

    await adapter['redis'].flushall();
    // start worker process with simulation flag
    const { jobId } = await service.submitJob({
      agent: 'AlphaCal',
      dataset_id: 'ds',
      params: {},
    });

    // Simulate worker dequeue + completion in-process to avoid process startup races.
    const dequeued = await adapter['redis'].brpop('casa:queue', 1);
    expect(dequeued?.[1]).toBe(jobId);

    await adapter['redis'].hset(
      `casa:job:${jobId}`,
      'status',
      'COMPLETED',
      'progress',
      '1',
      'output_url',
      `/files/${jobId}.fits`,
    );

    const status = await service.getJobStatus(jobId);
    expect(status.status).toBe('COMPLETED');
  }, 15000);

  it('uses LocalLlm adapter when mode is local-llm', async () => {
    configValues.REMOTE_COMPUTE_MODE = 'local-llm';
    const fetchMock = jest.fn(async (url: string) => {
      if (url.endsWith('/api/generate')) {
        return new Response(
          JSON.stringify({
            response: '{"planSummary":"ok","estimatedMinutes":12}',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      if (url.endsWith('/api/tags')) {
        return new Response(
          JSON.stringify({ models: [{ name: 'qwen3:8b' }] }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 404 });
    });
    (globalThis as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    moduleRef = await buildModule();
    const service = moduleRef.get<TaccIntegrationService>(
      TaccIntegrationService,
    );

    const submission = await service.submitJob({
      agent: 'ImageReconstruction',
      dataset_id: 'dataset-2',
      params: { gpu_count: 2 },
    });
    expect(submission.jobId).toMatch(/^llm-/);

    const status = await service.getJobStatus(submission.jobId);
    expect(['QUEUED', 'RUNNING', 'COMPLETED']).toContain(status.status);

    const caps = await service.getCapabilities();
    expect(caps.localLlmMode).toBe(true);
    expect(caps.modelAvailable).toBe(true);
  });

  it('falls back to live when legacy TACC_LIVE=true and mode unset', async () => {
    configValues.REMOTE_COMPUTE_MODE = undefined;
    configValues.TACC_LIVE = 'true';
    const fetchMock = jest.fn(
      async () =>
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    (globalThis as { fetch: typeof fetch }).fetch =
      fetchMock as unknown as typeof fetch;

    moduleRef = await buildModule();
    const service = moduleRef.get<TaccIntegrationService>(
      TaccIntegrationService,
    );
    const caps = await service.getCapabilities();

    expect(caps).toHaveProperty('baseUrlReachable');
    expect(caps).toHaveProperty('jobsEndpoint');
  });
});
