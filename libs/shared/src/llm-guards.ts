// helper utilities for the local-LLM execution path
import { z } from 'zod';

/**
 * Simple in-memory token bucket rate limiter keyed by dataset id.
 * Rejects calls that exceed 5 submissions per minute.
 */
interface RateBucket {
  tokens: number;
  lastRefill: number;
}

const rateBuckets: Map<string, RateBucket> = new Map();
const MAX_TOKENS = 5;
const REFILL_INTERVAL = 60_000; // 1 minute
// eviction: buckets not touched for 5 minutes will be removed
const BUCKET_TTL = 5 * 60_000;

// periodic cleanup
const rateBucketSweep = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets.entries()) {
    if (now - bucket.lastRefill > BUCKET_TTL) {
      rateBuckets.delete(key);
    }
  }
}, BUCKET_TTL);
if (typeof rateBucketSweep.unref === 'function') {
  rateBucketSweep.unref();
}

interface DatasetPayload {
  dataset_id?: string;
}

export function applyRateLimit(payload: DatasetPayload | undefined): void {
  const key = payload?.dataset_id || 'global';
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket) {
    bucket = { tokens: MAX_TOKENS, lastRefill: now };
    rateBuckets.set(key, bucket);
  }
  // refill proportionally
  const elapsed = now - bucket.lastRefill;
  if (elapsed > 0) {
    const refillTokens = Math.floor(elapsed / REFILL_INTERVAL) * MAX_TOKENS;
    if (refillTokens > 0) {
      bucket.tokens = Math.min(MAX_TOKENS, bucket.tokens + refillTokens);
      bucket.lastRefill = now;
    }
  }
  if (bucket.tokens <= 0) {
    const err = new Error('rate limit exceeded') as Error & {
      code: string;
    };
    err.code = 'RATE_LIMIT';
    throw err;
  }
  bucket.tokens -= 1;
}

// zod schema for LLM output object expected by adapter/UI
const LLMOutputSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']),
  progress: z.number().min(0).max(1),
  output_url: z.string().url().optional(),
  tips: z.array(z.string()).optional(),
});

/**
 * Validate the JSON output coming back from the LLM worker and normalize.
 * Throws if the structure does not match the expected schema.
 */
export type LLMOutput = z.infer<typeof LLMOutputSchema>;

export function validateLLMOutput(output: unknown): LLMOutput {
  return LLMOutputSchema.parse(output);
}

/**
 * Optional in-memory cache for repeat requests.  This can be hooked into
 * the adapter to avoid spinning up the LLM for identical parameter sets.
 */
interface CacheEntry {
  value: unknown;
  created: number;
}
const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60_000; // 5 minutes

// background sweeper
const responseCacheSweep = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of responseCache.entries()) {
    if (now - entry.created > CACHE_TTL) {
      responseCache.delete(key);
    }
  }
}, CACHE_TTL);
if (typeof responseCacheSweep.unref === 'function') {
  responseCacheSweep.unref();
}

export function cacheResponse(key: string, value?: unknown): unknown {
  if (value === undefined) {
    const entry = responseCache.get(key);
    if (!entry) return undefined;
    return entry.value;
  }
  responseCache.set(key, { value, created: Date.now() });
  return value;
}
