import {
  DemoTaccAdapter,
  LocalLlmAdapter,
  LiveTaccAdapter,
  TaccJobSubmission,
} from './tacc-integration.service';
import { validateLLMOutput } from '@cosmic-horizons/shared/llm-guards';
import { ConfigService } from '@nestjs/config';

type ConfigMap = Record<string, string | number | undefined>;

function makeConfig(overrides: ConfigMap = {}): ConfigService {
  const defaults: ConfigMap = {
    OLLAMA_BASE_URL: 'http://localhost:11435',
    OLLAMA_MODEL: 'qwen3:8b',
    OLLAMA_TIMEOUT_MS: 1000,
    OLLAMA_MAX_RETRIES: 1,
    TACC_TENANT_BASE_URL: 'https://tacc.tapis.io',
    TACC_API_URL: 'https://api.tacc.utexas.edu',
    TACC_API_KEY: '',
  };
  const values = { ...defaults, ...overrides };
  return {
    get: jest.fn((key: string, fallback?: unknown) => {
      const value = values[key];
      return value === undefined ? fallback : value;
    }),
  } as unknown as ConfigService;
}

describe('TaccAdapter modes', () => {
  const dummySubmission: TaccJobSubmission = {
    agent: 'AlphaCal',
    dataset_id: 'test-ds',
    params: {},
  };

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('demo adapter', () => {
    it('should submit and return an id', async () => {
      const adapter = new DemoTaccAdapter(makeConfig());
      const result = await adapter.submitJob(dummySubmission);
      expect(result.jobId).toBeDefined();

      const status = await adapter.getJobStatus(result.jobId);
      expect(['QUEUED', 'RUNNING', 'COMPLETED']).toContain(status.status);
    });
  });

  describe('local-llm adapter', () => {
    it('should submit and return an id', async () => {
      const fetchMock = jest.fn(async (url: string) => {
        if (url.endsWith('/api/generate')) {
          return new Response(JSON.stringify({ response: '{"planSummary":"ok"}' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('{}', { status: 404 });
      });
      (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

      const adapter = new LocalLlmAdapter(makeConfig());
      const result = await adapter.submitJob(dummySubmission);
      expect(result.jobId).toBeDefined();

      const result2 = await adapter.submitJob(dummySubmission);
      expect(result2.jobId).toBe(result.jobId);
    });

    it('should enforce rate limit', async () => {
      const fetchMock = jest.fn(async () =>
        new Response(JSON.stringify({ response: '{"planSummary":"ok"}' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

      const adapter = new LocalLlmAdapter(makeConfig());
      const payload = { ...dummySubmission, dataset_id: 'rl1' };
      for (let i = 0; i < 5; i++) {
        await adapter.submitJob(payload);
      }
      await expect(adapter.submitJob(payload)).rejects.toHaveProperty(
        'code',
        'RATE_LIMIT',
      );
    });

    it('should validate job status schema', () => {
      const bad = { jobId: 'x', status: 'NOTVALID', progress: -1 };
      expect(() => validateLLMOutput(bad)).toThrow();
    });
  });

  describe('live adapter', () => {
    it('should throw when submit request fails', async () => {
      (globalThis as { fetch: typeof fetch }).fetch =
        jest.fn(async () => {
          throw new Error('network down');
        }) as unknown as typeof fetch;

      const adapter = new LiveTaccAdapter(makeConfig());
      await expect(adapter.submitJob(dummySubmission)).rejects.toThrow();
    });

    it('should submit and return job id when backend responds', async () => {
      const fetchMock = jest.fn(async () =>
        new Response(JSON.stringify({ jobId: 'live-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      (globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

      const adapter = new LiveTaccAdapter(makeConfig());
      const res = await adapter.submitJob(dummySubmission);
      expect(res.jobId).toBe('live-1');
      expect(fetchMock).toHaveBeenCalled();
    });
  });
});
