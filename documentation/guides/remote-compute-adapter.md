# Remote Compute Adapter Guide

This document describes the adapter interface used by the API to abstract
between demo/local/live compute backends.

## Overview

The `TaccIntegrationService` depends on an injected `TaccAdapter` interface.
The concrete implementation is selected at runtime based on configuration
(`TACC_LIVE`, `REMOTE_COMPUTE_MODE`, etc.).

```ts
export interface TaccAdapter {
  submitJob(submission: TaccJobSubmission): Promise<{ jobId: string }>;
  getJobStatus(jobId: string): Promise<CanonicalJobStatus>;
  getCapabilities(): Promise<AdapterCapabilities>;
  // additional helpers for dataset staging, cancellation, etc.
}
```

### Demo Adapter

- Implements deterministic behavior using in-memory simulation.
- Used when `TACC_LIVE=false` (or `REMOTE_COMPUTE_MODE=demo`).
- Suitable for e2e tests and offline demos.

### Live Adapter

- Wraps the Tapis HTTP API.
- Adds retry/backoff, circuit breaker, and OAuth2 token support.
- Selected by `TACC_LIVE=true` and requires real credentials.

### Local-LLM Adapter

- Forwards requests to a local compute-compatible HTTP surface backed by Ollama.
- Shares the same contract so UI and tests remain unchanged.

### CASA / Astronomy Adapter

- Enqueues jobs into a Redis/RabbitMQ/Kafka queue and persists state.
- A separate worker container pulls jobs from the queue, runs CASA in an
  isolated `docker run --rm` container, and updates the record with progress
  or failure.  This decouples the API from heavy compute and supports
  concurrency, retries, and persistent job history.
- Selected by `REMOTE_COMPUTE_MODE=astronomy` (or `casa`).
- Requires a running queue service (the base `docker-compose.yml` already
  includes Redis) and at least one `cosmic-horizons-worker` instance.

### Feature Flagging

The workspace uses a factory provider in `jobs.module.ts`:

```ts
{
  provide: TACC_ADAPTER,
  useFactory: (config: ConfigService) => {
    const mode = (
      config.get<string>('REMOTE_COMPUTE_MODE') ??
      (config.get('TACC_LIVE') === 'true' ? 'live' : 'demo')
    ).toLowerCase();
    if (mode === 'live') return new LiveTaccAdapter(config);
    if (mode === 'local-llm') return new LocalLlmAdapter(config);
    return new DemoTaccAdapter(config);
  },
  inject: [ConfigService],
}
```

Switching between adapters is therefore just a configuration change and
safely exercised by both unit tests and the live-path CI workflow.

> **Architectural note:** the adapter interface defined above is intentionally
> minimal and mirrors mature HPC gateway designs (TACC TAPIS, NASA Pleiades).
> By keeping the contract to `submit/status/result/cancel`, the system cleanly
> separates frontend, API orchestration, adapter logic, and compute backends.
> This abstraction is the core strength of the project and makes the codebase
> backend‑agnostic and extensible.

## Configuration

See `.env.template` for all relevant environment variables including
`REMOTE_COMPUTE_MODE`, `TACC_LIVE` (legacy compatibility), and live credentials.
