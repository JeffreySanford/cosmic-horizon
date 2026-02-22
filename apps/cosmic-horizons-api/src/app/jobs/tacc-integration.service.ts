import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  applyRateLimit,
  validateLLMOutput,
  cacheResponse,
} from '@cosmic-horizons/shared/llm-guards';

/**
 * Shared types used by all adapters.
 */
export interface TaccJobParams {
  rfi_strategy?: 'low' | 'medium' | 'high' | 'high_sensitivity';
  gpu_count?: number;
  max_runtime?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface TaccJobSubmission {
  agent: 'AlphaCal' | 'ImageReconstruction' | 'AnomalyDetection' | string;
  dataset_id: string;
  params: TaccJobParams;
}

export interface TaccJobStatus {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | string;
  progress: number;
  output_url?: string;
}

/**
 * Internal canonical statuses used by the UI/state machine.
 */
export enum CanonicalJobStatus {
  SUBMITTED = 'SUBMITTED',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  UNKNOWN = 'UNKNOWN',
}

export function normalizeStatus(raw: string): CanonicalJobStatus {
  const s = raw.toUpperCase();
  switch (s) {
    case 'SUBMITTED':
      return CanonicalJobStatus.SUBMITTED;
    case 'QUEUED':
    case 'PENDING':
      return CanonicalJobStatus.QUEUED;
    case 'RUNNING':
      return CanonicalJobStatus.RUNNING;
    case 'COMPLETED':
    case 'FINISHED':
    case 'SUCCEEDED':
      return CanonicalJobStatus.SUCCEEDED;
    case 'FAILED':
      return CanonicalJobStatus.FAILED;
    case 'CANCELED':
    case 'CANCELLED':
      return CanonicalJobStatus.CANCELED;
    default:
      return CanonicalJobStatus.UNKNOWN;
  }
}

/**
 * Abstraction for fetching access tokens or credentials.  Demo provider can be
 * a no-op or return a dummy string; live provider would implement OAuth2 flows.
 */
export interface AuthProvider {
  getAccessToken(): Promise<string>;
}

/**
 * Adapter interface that abstracts the details of communicating with the
 * underlying TACC/CosmicAI backend (demo or live).
 */
export interface TaccAdapter {
  submitJob(submission: TaccJobSubmission): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<TaccJobStatus>;
  cancelJob(jobId: string): Promise<boolean>;
  /**
   * Probe the backend for health/capabilities.  Demo returns static matrix.
   */
  getCapabilities(): Promise<Record<string, boolean>>;
}

export const TACC_ADAPTER = 'TACC_ADAPTER';

/**
 * Demo adapter that implements the simulated logic previously embedded in the
 * original service.  It can be used for offline development and testing.
 */
@Injectable()
export class DemoTaccAdapter implements TaccAdapter {
  private readonly logger = new Logger(DemoTaccAdapter.name);

  constructor(private readonly configService: ConfigService) {
    const taccApiBaseUrl = this.configService.get<string>(
      'TACC_API_URL',
      'https://api.tacc.utexas.edu',
    );
    const taccApiKey = this.configService.get<string>('TACC_API_KEY', '');
    this.logger.debug(
      `Demo adapter initialized with URL: ${taccApiBaseUrl} (Key present: ${!!taccApiKey})`,
    );
  }

  async submitJob(submission: TaccJobSubmission): Promise<{ jobId: string }> {
    this.logger.log(
      `Submitting TACC job for agent ${submission.agent} on dataset ${submission.dataset_id}`,
    );

    // Simulate quota failures only for explicit test/demo inputs to keep
    // automated suites deterministic.
    if (submission.dataset_id.toLowerCase().includes('quota')) {
      const msg = 'Queue is full / quota exceeded';
      this.logger.warn(msg);
      const err = new Error(msg) as Error & { code?: string };
      err.code = 'QUOTA_EXCEEDED';
      throw err;
    }

    try {
      // Simulate variable API call delay
      const delay = 200 + Math.random() * 800;
      await new Promise((resolve) => setTimeout(resolve, delay));

      const simulatedJobId = `tacc-${Math.floor(Math.random() * 1000000)}`;

      this.logger.log(`Successfully submitted job: ${simulatedJobId}`);
      return { jobId: simulatedJobId };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error during job submission';
      this.logger.error(
        `Failed to submit job to demo adapter: ${errorMessage}`,
      );
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<TaccJobStatus> {
    this.logger.log(`Fetching status for demo TACC job: ${jobId}`);

    try {
      await new Promise((resolve) => setTimeout(resolve, 200));

      const statuses: TaccJobStatus['status'][] = [
        'QUEUED',
        'RUNNING',
        'COMPLETED',
      ];
      const randomStatus =
        statuses[Math.floor(Math.random() * statuses.length)];

      const progress =
        randomStatus === 'COMPLETED'
          ? 1.0
          : randomStatus === 'FAILED'
            ? 0.0
            : Math.random();

      return {
        id: jobId,
        status: randomStatus,
        progress,
        output_url:
          randomStatus === 'COMPLETED'
            ? 'https://archive.vla.nrao.edu/results/job-123.fits'
            : undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error during status fetch';
      this.logger.error(
        `Failed to fetch status for demo job ${jobId}: ${errorMessage}`,
      );
      throw error;
    }
  }

  async cancelJob(jobId: string): Promise<boolean> {
    this.logger.log(`Cancelling demo TACC job: ${jobId}`);

    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error during cancellation';
      this.logger.error(`Failed to cancel demo job ${jobId}: ${errorMessage}`);
      throw error;
    }
  }

  async getCapabilities(): Promise<Record<string, boolean>> {
    return {
      demoMode: true,
      baseUrlReachable: true,
      oauth2Present: false,
      jobsEndpoint: true,
    };
  }
}

interface LocalLlmJobRecord {
  id: string;
  createdAtMs: number;
  cancelled: boolean;
  failed: boolean;
  summary?: string;
}

interface OllamaGenerateResponse {
  response?: string;
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string }>;
}

/**
 * Local adapter that routes submissions through Ollama and simulates async
 * lifecycle transitions so the rest of the jobs pipeline behaves like remote
 * compute while running fully offline.
 */
@Injectable()
export class LocalLlmAdapter implements TaccAdapter {
  private readonly logger = new Logger(LocalLlmAdapter.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly jobs = new Map<string, LocalLlmJobRecord>();

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'OLLAMA_BASE_URL',
      'http://localhost:11435',
    );
    this.model = this.configService.get<string>('OLLAMA_MODEL', 'qwen3:8b');
    this.timeoutMs = Number(
      this.configService.get<number>('OLLAMA_TIMEOUT_MS', 30000),
    );
    this.maxRetries = Number(
      this.configService.get<number>('OLLAMA_MAX_RETRIES', 2),
    );

    this.logger.debug(
      `LocalLlmAdapter initialized (${this.baseUrl}, model=${this.model})`,
    );
  }

  async submitJob(submission: TaccJobSubmission): Promise<{ jobId: string }> {
    // guardrail: rate limit submissions
    applyRateLimit(submission);

    // caching: identical submission returns same jobId
    const cacheKey = JSON.stringify(submission);
    const cached = cacheResponse(cacheKey);
    if (cached) {
      this.logger.debug('Local-LLM submit cache hit');
      return cached;
    }

    const jobId = `llm-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const record: LocalLlmJobRecord = {
      id: jobId,
      createdAtMs: Date.now(),
      cancelled: false,
      failed: false,
    };
    this.jobs.set(jobId, record);

    try {
      const prompt = this.buildPrompt(submission);
      const response = await fetchWithRetryAndTimeout(
        `${this.baseUrl}/api/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            stream: false,
            format: 'json',
            prompt,
          }),
        },
        this.maxRetries,
        250,
        this.timeoutMs,
      );

      if (!response.ok) {
        const details = await safeReadText(response);
        throw new Error(
          `Ollama generate failed (${response.status}): ${details || 'no body'}`,
        );
      }

      const payload = (await response.json()) as OllamaGenerateResponse;
      record.summary = payload.response ?? 'local-llm-response';
    } catch (error) {
      record.failed = true;
      this.logger.warn(
        `Local LLM submit failed for ${jobId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }

    const result = { jobId };
    cacheResponse(cacheKey, result);
    return result;
  }

  async getJobStatus(jobId: string): Promise<TaccJobStatus> {
    const record = this.jobs.get(jobId);
    if (!record) {
      return { id: jobId, status: 'FAILED', progress: 0 };
    }

    if (record.cancelled) {
      return { id: jobId, status: 'FAILED', progress: 0 };
    }

    let status: TaccJobStatus;
    if (record.failed) {
      status = { id: jobId, status: 'FAILED', progress: 0 };
    } else {
      const elapsed = Date.now() - record.createdAtMs;
      if (elapsed < 1500) {
        status = { id: jobId, status: 'QUEUED', progress: 0.1 };
      } else if (elapsed < 8000) {
        const progress = Math.min(0.95, 0.1 + ((elapsed - 1500) / 6500) * 0.85);
        status = { id: jobId, status: 'RUNNING', progress };
      } else {
        status = {
          id: jobId,
          status: 'COMPLETED',
          progress: 1,
          output_url: `local-llm://${jobId}`,
        };
      }
    }

    // Validate status shape through the shared LLM guard contract.
    validateLLMOutput({
      jobId,
      status: status.status,
      progress: status.progress,
      output_url: status.output_url,
    });
    return status;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const record = this.jobs.get(jobId);
    if (!record) {
      return false;
    }
    record.cancelled = true;
    return true;
  }

  async getCapabilities(): Promise<Record<string, boolean>> {
    const capabilities: Record<string, boolean> = {
      demoMode: false,
      localLlmMode: true,
      baseUrlReachable: false,
      modelAvailable: false,
      jobsEndpoint: true,
    };

    try {
      const response = await fetchWithRetryAndTimeout(
        `${this.baseUrl}/api/tags`,
        undefined,
        this.maxRetries,
        200,
        this.timeoutMs,
      );
      capabilities.baseUrlReachable = response.ok;
      if (response.ok) {
        const payload = (await response.json()) as OllamaTagsResponse;
        const modelNames = (payload.models ?? [])
          .map((m) => m.name)
          .filter((name): name is string => typeof name === 'string');
        capabilities.modelAvailable = modelNames.includes(this.model);
      }
    } catch {
      // keep default false values
    }

    return capabilities;
  }

  private buildPrompt(submission: TaccJobSubmission): string {
    const payload = JSON.stringify(submission);
    return [
      'You are a remote-compute planner for astronomy jobs.',
      'Return compact JSON with keys: planSummary, riskFlags, estimatedMinutes.',
      `Job: ${payload}`,
    ].join('\n');
  }
}

/**
 * Live adapter stub.  When real credentials and an API are available, implement
 * HTTP calls here (Tapis, SSH/Slurm, etc.).  For now it simply throws errors
 * to make it obvious if accidentally invoked.
 */

/**
 * CASA adapter that enqueues jobs onto a Redis queue and stores state in a
 * hash.  A separate worker container (see documentation) will consume the
 * `casa:queue` list, perform the real CASA run with `docker run --rm …`, and
 * update the job hash with progress/output_url/error.  This keeps the API
 * process lightweight and resilient to restarts.
 */
@Injectable()
export class CasaTaccAdapter implements TaccAdapter {
  private readonly logger = new Logger(CasaTaccAdapter.name);
  private readonly redis: import('ioredis').default;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>(
      'REDIS_URL',
      'redis://localhost:6379',
    );
    const Redis = require('ioredis');
    this.redis = new Redis(url);
    this.logger.debug(`Casa adapter connected to Redis at ${url}`);
  }

  async submitJob(submission: TaccJobSubmission): Promise<{ jobId: string }> {
    // persist job metadata
    const jobId = `casa-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const key = `casa:job:${jobId}`;
    await this.redis.hset(key, {
      status: 'QUEUED',
      createdAt: Date.now().toString(),
      agent: submission.agent,
      dataset_id: submission.dataset_id,
      params: JSON.stringify(submission.params || {}),
    });
    // push to queue for worker to pick up
    await this.redis.lpush('casa:queue', jobId);
    this.logger.log(`Enqueued CASA job ${jobId}`);
    return { jobId };
  }

  async getJobStatus(jobId: string): Promise<TaccJobStatus> {
    const key = `casa:job:${jobId}`;
    const data = await this.redis.hgetall(key);
    if (!data || Object.keys(data).length === 0) {
      return { id: jobId, status: 'FAILED', progress: 0 };
    }
    return {
      id: jobId,
      status: (data.status as TaccJobStatus['status']) || 'UNKNOWN',
      progress: Number(data.progress) || 0,
      output_url: data.output_url,
      // optionally return error field
    };
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const key = `casa:job:${jobId}`;
    await this.redis.hset(key, 'status', 'CANCELED');
    // worker should observe the status change and abort if running
    return true;
  }

  async getCapabilities(): Promise<Record<string, boolean>> {
    // simple liveness probe
    try {
      await this.redis.ping();
      return { queueAvailable: true, redisConnected: true, jobsEndpoint: true };
    } catch {
      return {
        queueAvailable: false,
        redisConnected: false,
        jobsEndpoint: true,
      };
    }
  }
}

@Injectable()
export class LiveTaccAdapter implements TaccAdapter {
  private readonly logger = new Logger(LiveTaccAdapter.name);
  private readonly baseUrl: string;
  private readonly auth: AuthProvider;
  private readonly breaker = new CircuitBreaker();

  constructor(private readonly configService?: ConfigService) {
    const safeConfig =
      this.configService ??
      ({
        get: <T>(_: string, defaultValue?: T) => defaultValue as T,
      } as ConfigService);
    this.baseUrl = safeConfig.get<string>(
      'TACC_TENANT_BASE_URL',
      'https://tacc.tapis.io',
    );
    this.logger.debug('Live adapter initialized (skeleton)');
    this.auth = new LiveAuthProvider(safeConfig);
  }

  async submitJob(submission: TaccJobSubmission): Promise<{ jobId: string }> {
    const { url, headers, body } = await this.buildSubmitRequest(submission);
    this.logger.debug(
      `Live submitJob request ${url} ${body} ${JSON.stringify(headers)}`,
    );
    const raw = await fetchWithRetry(
      url,
      { method: 'POST', headers, body },
      3,
      200,
      this.breaker,
    );
    const json = await raw.json();
    if (json.status) {
      json.status = normalizeStatus(json.status);
    }
    return json as { jobId: string };
  }

  /**
   * Construct URL/headers/body for submit request; pure function useful for tests
   */
  async buildSubmitRequest(submission: TaccJobSubmission): Promise<{
    url: string;
    headers: Record<string, string>;
    body: string;
  }> {
    const url = `${this.baseUrl}/v3/jobs/submit`;
    const headers = await this.buildAuthHeaders();
    const body = JSON.stringify(submission);
    return { url, headers, body };
  }

  async getJobStatus(jobId: string): Promise<TaccJobStatus> {
    const url = `${this.baseUrl}/v3/jobs/${jobId}/status`;
    this.logger.debug(`Live getJobStatus request ${url}`);
    // perform fetch with retry/backoff
    const raw = await fetchWithRetry(url, undefined, 3, 200, this.breaker);
    const json = await raw.json();
    // normalize status field
    if (json.status) {
      json.status = normalizeStatus(json.status);
    }
    return json as TaccJobStatus;
  }

  async cancelJob(jobId: string): Promise<boolean> {
    const url = `${this.baseUrl}/v3/jobs/${jobId}/cancel`;
    this.logger.debug(`Live cancelJob request ${url}`);
    const raw = await fetchWithRetry(
      url,
      { method: 'POST' },
      3,
      200,
      this.breaker,
    );
    const json = await raw.json();
    return json.success ?? true;
  }

  async getCapabilities(): Promise<Record<string, boolean>> {
    // attempt simple probes
    const caps: Record<string, boolean> = {
      baseUrlReachable: false,
      oauth2Present: false,
      jobsEndpoint: false,
    };
    try {
      // hit oauth2
      const oauthResp = await fetchWithRetry(`${this.baseUrl}/v3/oauth2`);
      caps.baseUrlReachable = oauthResp.ok;
      caps.oauth2Present = oauthResp.ok;
    } catch {
      // ignore
    }
    try {
      const jobsResp = await fetchWithRetry(`${this.baseUrl}/v3/jobs`);
      caps.jobsEndpoint = jobsResp.ok;
    } catch (error) {
      void error;
    }
    return caps;
  }

  private async buildAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.auth.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

/**
 * Primary service used by the rest of the application.  Delegates to the
 * configured adapter (demo or live) depending on injection.
 */
@Injectable()
export class TaccIntegrationService implements TaccAdapter {
  private readonly logger = new Logger(TaccIntegrationService.name);
  private readonly resolvedAdapter: TaccAdapter;

  constructor(
    @Optional()
    @Inject(TACC_ADAPTER)
    adapterOrConfig?: TaccAdapter | ConfigService,
    @Optional() configService?: ConfigService,
  ) {
    if (this.isAdapter(adapterOrConfig)) {
      this.resolvedAdapter = adapterOrConfig;
      return;
    }

    // Backward-compatible fallback for legacy tests that instantiate
    // TaccIntegrationService directly with only ConfigService.
    const legacyConfig = this.isConfigService(adapterOrConfig)
      ? adapterOrConfig
      : configService;
    const safeConfig =
      legacyConfig ??
      ({
        get: <T>(_: string, defaultValue?: T) => defaultValue as T,
      } as ConfigService);

    this.resolvedAdapter = new DemoTaccAdapter(safeConfig);
    this.logger.debug(
      'TACC Integration initialized with fallback demo adapter',
    );
  }

  submitJob(submission: TaccJobSubmission): Promise<{ jobId: string }> {
    this.logger.log(`Submitting TACC job for agent ${submission.agent}`);
    return this.resolvedAdapter.submitJob(submission);
  }

  getJobStatus(jobId: string): Promise<TaccJobStatus> {
    this.logger.log(`Fetching status for TACC job ${jobId}`);
    return this.resolvedAdapter.getJobStatus(jobId);
  }

  cancelJob(jobId: string): Promise<boolean> {
    this.logger.log(`Cancelling TACC job ${jobId}`);
    return this.resolvedAdapter.cancelJob(jobId);
  }

  getCapabilities(): Promise<Record<string, boolean>> {
    return this.resolvedAdapter.getCapabilities();
  }

  private isAdapter(value: unknown): value is TaccAdapter {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const candidate = value as Partial<TaccAdapter>;
    return (
      typeof candidate.submitJob === 'function' &&
      typeof candidate.getJobStatus === 'function' &&
      typeof candidate.cancelJob === 'function' &&
      typeof candidate.getCapabilities === 'function'
    );
  }

  private isConfigService(value: unknown): value is ConfigService {
    if (!value || typeof value !== 'object') {
      return false;
    }
    return typeof (value as Partial<ConfigService>).get === 'function';
  }
}

// ---- auxiliary classes and helpers --------------------------------------------------

/**
 * Live auth provider skeleton - would implement OAuth2 flows in the future.
 */
class LiveAuthProvider implements AuthProvider {
  private currentToken: string | null = null;
  private expirySec = 0;

  constructor(private readonly config: ConfigService) {
    this.currentToken = this.config.get<string>('TACC_ACCESS_TOKEN', '');
    this.expirySec = this.config.get<number>('TACC_ACCESS_TOKEN_EXPIRY', 0);
  }
  async getAccessToken(): Promise<string> {
    if (this.currentToken && Date.now() / 1000 < this.expirySec - 60) {
      return this.currentToken;
    }
    // token expired or missing
    const refreshed = await this.refreshToken();
    return refreshed;
  }

  private async refreshToken(): Promise<string> {
    // offline stub: rotate by appending a suffix or using timestamp
    const newToken = `refreshed-${Date.now()}`;
    this.currentToken = newToken;
    // set expiry 5 minutes in future
    this.expirySec = Math.floor(Date.now() / 1000) + 300;
    return newToken;
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

// retry/backoff util
class CircuitBreaker {
  private failures = 0;
  private state: 'CLOSED' | 'OPEN' = 'CLOSED';
  private nextAttempt = 0;
  constructor(
    private readonly threshold = 3,
    private readonly timeoutMs = 60000,
  ) {}
  recordSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  recordFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeoutMs;
    }
  }
  canRequest(): boolean {
    if (this.state === 'OPEN' && Date.now() > this.nextAttempt) {
      this.state = 'CLOSED';
      this.failures = 0;
    }
    return this.state === 'CLOSED';
  }
}

async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retries = 3,
  backoffMs = 200,
  breaker?: CircuitBreaker,
): Promise<Response> {
  if (breaker && !breaker.canRequest()) {
    throw new Error('circuit breaker open');
  }
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) {
        breaker?.recordSuccess();
        return res;
      }
      if (i === retries - 1) {
        breaker?.recordFailure();
        return res;
      }
    } catch (err) {
      breaker?.recordFailure();
      if (i === retries - 1) throw err;
    }
    await new Promise((r) => setTimeout(r, backoffMs * Math.pow(2, i)));
  }
  throw new Error('fetchWithRetry failed');
}

async function fetchWithRetryAndTimeout(
  url: string,
  options: RequestInit | undefined,
  retries: number,
  backoffMs: number,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchWithRetry(
      url,
      {
        ...(options ?? {}),
        signal: controller.signal,
      },
      retries,
      backoffMs,
    );
  } finally {
    clearTimeout(timeout);
  }
}
