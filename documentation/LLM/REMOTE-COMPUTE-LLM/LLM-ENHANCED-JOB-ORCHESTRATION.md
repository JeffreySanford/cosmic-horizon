# LLM-Enhanced Remote Compute Plan (Ollama-Backed)

Status date: 2026-02-22
Status: Execution plan for local remote-compute simulation while TACC live access is pending. Environment gating (`REMOTE_COMPUTE_MODE`) and Ollama variables are already declared in `.env.template`.

## Goal

Build a local HTTP remote-compute service that behaves like a real orchestration backend and can be called by Cosmic Horizons through the same adapter pattern used for demo/live gateways.

This gives us:

- Real async job lifecycle behavior (submit -> queue -> run -> complete/fail)
- Real model-backed outputs (not purely synthetic mocks)
- A controlled path to validate API contracts, auditing, and UI behavior before TACC cutover

## Recommended Model (Current)

Primary recommendation: `qwen3:8b`

Why:

- Current Ollama library model family with strong instruction-following quality
- Good local performance/quality tradeoff for structured JSON responses and orchestration reasoning
- Context window and model options support staged prompts for validation, planning, and summarization workflows

Fallbacks:

- `qwen3:4b` for lower VRAM / faster iteration
- `qwen3:14b` for better reasoning quality when hardware permits

## What TACC/UT Remote Compute Actually Covers

From a gateway perspective, TACC workflows typically involve:

- User/account + allocation eligibility (ACCESS project membership)
- Batch scheduling on HPC systems (e.g., Slurm job submission/status)
- Programmatic API route via Tapis v3 (OAuth2 auth, jobs/files/systems APIs)

So our local service should mimic this shape:

- Identity/auth boundary
- Job submit/status/cancel endpoints
- File/input-output staging semantics
- Queue and failure modes

## Target Architecture

```text
Angular/NgRx UI
   -> Cosmic Horizons API (JobsModule, TaccAdapter facade)
      -> LocalLlmAdapter (new)
         -> Local Compute HTTP Server (new)
            -> Queue + Worker(s)
               -> Ollama (default host endpoint: http://localhost:11435)
               -> Artifact Store (local FS/DB)
```

### Adapter modes

- `demo`: existing pure simulation
- `local-llm`: new HTTP-backed local compute mode
- `live`: Tapis/Slurm real integration

Use explicit env gate, for example:

- `REMOTE_COMPUTE_MODE=demo|local-llm|live`

## Local Compute HTTP Contract

Suggested endpoints:

- `POST /jobs/submit`
- `GET /jobs/:id/status`
- `POST /jobs/:id/cancel`
- `GET /jobs/:id/result`
- `GET /capabilities/health`

Suggested payload traits:

- Correlation ID required on submit
- Canonical status enum:
  - `SUBMITTED | QUEUED | RUNNING | SUCCEEDED | FAILED | CANCELED | UNKNOWN`
- Structured error classes:
  - `AUTH_ERROR`, `QUOTA_EXCEEDED`, `VALIDATION_ERROR`, `MODEL_TIMEOUT`,
    `STAGING_ERROR`, `INTERNAL_ERROR`

## What the Local LLM Worker Should Do

### Stage A: Validation

- Validate job params (dataset ID format, resource requests, strategy options)
- Return deterministic JSON decision:
  - `isValid`, `score`, `warnings`, `recommendations`

### Stage B: Plan/Estimate

- Estimate duration/resources with bounded ranges
- Emit explainable rationale string (short)

### Stage C: Result Synthesis

- Produce structured result object for UI:
  - outcome summary
  - anomaly candidates
  - confidence band
  - provenance metadata (model, prompt hash, timing)

## Realistic Performance Expectations

What this can prove well:

- End-to-end orchestration and state correctness
- Retry/backoff/circuit-breaker behavior
- NgRx state-machine robustness under async and out-of-order events
- Audit and provenance UI patterns

What this cannot prove at TACC scale:

- Exascale queue behavior under true HPC contention
- Large distributed GPU pipeline throughput
- Production network/storage topology constraints

## Implementation Plan

## Phase 1: Infrastructure (1-2 days)

- [x] Create `LocalLlmAdapter` in API jobs module
- [x] Add mode gate `REMOTE_COMPUTE_MODE=local-llm` (variable present in `.env.template`)
- [x] Create local HTTP compute server (`tools/local-compute-server/`)
- [x] Add job queue + status persistence (SQLite/Postgres or in-memory + snapshot)
- [x] Add health endpoint and capability matrix

## Phase 2: Ollama Integration (1-2 days)

- [x] Add `OllamaService` wrapper for `/api/chat` with strict JSON output mode
- [x] Implement stage prompts (validation, estimate, synthesis)
- [x] Add model config env vars (already in `.env.template`):
  - `OLLAMA_BASE_URL`
  - `OLLAMA_MODEL` (default `qwen3:8b`)
  - `OLLAMA_TIMEOUT_MS`
  - `OLLAMA_MAX_RETRIES`
- [x] Add fallback behavior when Ollama unavailable

## Phase 3: Reliability and Security (1 day)

- [x] Correlation IDs on all requests/events _(propagated via request context middleware and included in job actions)_
- [x] Redaction for auth headers/tokens/signed URLs _(central redaction util applied to adapter logs/events)_
- [x] Rate limiting and request-size limits _(in-memory token bucket, `applyRateLimit` guard)_
- [x] Retry/backoff for local compute server and Ollama calls _(`fetchWithRetryAndTimeout` helper)_
- [x] Optional response cache for repeated parameter sets _(in-memory cache helper used by adapter)_

## Phase 4: Testing and CI (1-2 days)

- [x] Unit tests for adapter request/response mapping _(see `tacc-integration.adapter.spec.ts`)_
- [x] Worker tests for lifecycle transitions and error classes _(covered by adapter status tests)_
- [x] Contract tests for HTTP server endpoints _(see `jobs.controller.spec.ts`)_
- [x] Web e2e test in `local-llm` mode _(see `jobs-flow-llm.spec.ts`)_
- [x] CI job that boots mock local compute server and runs job-flow suite _(see `.github/workflows/local-llm-ci.yml`)_

## Phase 5: TACC Cutover Readiness (ongoing)

- [x] Keep canonical status schema identical across modes _(validation logic & guards)_
- [x] Keep contracts Tapis-shaped where practical _(mock adapters follow Tapis schema)_
- [x] Run same e2e scenario in `local-llm` and later `live` mode _(local flow spec & existing live e2e)_
- [x] Produce delta report of behavior differences before live demo _(see `MODE-DELTA-REPORT-LOCAL-LLM-VS-LIVE.MD`)_

## Open Decisions

- **Single-model vs dual-model split:** current implementation uses a single Ollama model configured via `OLLAMA_MODEL`. No validator/synthesis separation has been built yet. Given the modest load and successful test coverage, the single‑model approach is sufficient for now; dual‑model can be explored later if validation performance or cost become concerns.
- **Local artifact persistence format:** results are currently returned as plain JSON objects (`output_url` or in‑memory summary); there is no zipped bundle or checksum logic. The adapter could be extended if downstream consumers need package archives, but JSON-only has proven adequate for prototypes.
- **Degree of determinism for demo reproducibility:** only basic caching and seeded Jest tests provide repeatability. Job IDs and prompts are still time‑based/random, so full determinism is not enforced. If deterministic replays are required, additional seeding or prompt‑caching hooks should be added; this remains an enhancement item rather than a blocker.

## Suggested First Cut (Minimum Useful)

1. One worker, one model (`qwen3:8b`), one queue.
2. Implement submit/status/result only.
3. Add deterministic JSON schema validation for model outputs.
4. Wire Jobs UI badge: `Mode: local-llm`.
5. Add one Playwright flow that submits and completes a local LLM job.

## Completed Docker Work (Current)

- [x] Integrated Ollama runtime into `docker-compose.events.yml`.
- [x] Local compute HTTP server skeleton and job queue exist (Phase1 complete).
- [x] Added one-shot warmup service to pull default model (`qwen3:8b`).
- [x] Added persistent Ollama model volume (`cosmic-horizons-ollama-models`).
- [x] Resolved local port contention by defaulting host bind to `11435`.
- [x] Added local LLM env contract in `.env.example` and `.env.template` (includes `REMOTE_COMPUTE_MODE` and Ollama settings).
- [x] Added readiness smoke-check command `pnpm run llm:smoke` (`scripts/check-local-llm-ready.mjs`).
- [x] Added quick smoke mode `pnpm run llm:smoke:quick` for routine checks.
- [x] Added explicit model pull helper `pnpm run llm:pull` (`scripts/pull-local-llm-model.mjs`).
- [x] Added model inventory command `pnpm run llm:models` (`scripts/list-local-llm-models.mjs`).
- [x] Added warmup runner `pnpm run llm:warmup` with completion/exit checks (`scripts/run-local-llm-warmup.mjs`).
- [x] Added consolidated diagnostics command `pnpm run llm:doctor`.
- [x] Added one-command readiness flow `pnpm run llm:ready` (`warmup -> doctor`).
- [x] Added runtime snapshot command `pnpm run llm:status`.
- [x] Added log-tail command `pnpm run llm:logs` (configurable via `OLLAMA_LOG_TAIL_LINES`).

## How To Train/Adapt For Remote Compute Emulation

For this project, prefer staged adaptation over full model retraining.

### 1. Build a behavior dataset (required)

Create fixtures focused on gateway behavior:

- submit payloads and expected accept/reject outcomes
- status-transition traces over time
- failure-class examples (`AUTH_ERROR`, `QUOTA_EXCEEDED`, `MODEL_TIMEOUT`, etc.)
- result payloads with provenance metadata

Version these in repo and use them for prompt evaluation and tests.

### 2. Enforce schema-constrained outputs (required)

Use Ollama structured outputs and validate responses in the API layer (Zod or
JSON Schema). If parsing/validation fails:

- retry once with a repair prompt
- then fail closed and fallback to deterministic rules

Keep orchestration decisions deterministic (for example, `temperature=0`).

### 3. Specialize with Modelfile (recommended)

Create a project-specific model from `qwen3:8b` using `Modelfile`:

- `SYSTEM` prompt defining remote-compute role and constraints
- `PARAMETER` settings for deterministic behavior
- optional `TEMPLATE` tuned to your JSON contract

This gives strong alignment without expensive full retraining.

### 4. Ground with runtime context (recommended)

Inject current operational rules into prompts:

- canonical status/transition table
- queue and resource limits
- allowed error taxonomy
- response schema snippets

This keeps behavior aligned when policies change.

### 5. Optional LoRA fine-tune (only if needed)

If prompt + schema + grounding still miss quality targets, do a LoRA adapter
fine-tune on your behavior dataset and deploy with an adapter-based setup.
Treat this as phase-2 optimization, not day-1 scope.

### Suggested quality gates

- `>=95%` schema-valid JSON in integration tests
- `0` illegal state transitions in state-machine tests
- deterministic outputs for seeded replay scenarios
- high precision on error-class selection

## References (APA)

ACCESS. (n.d.). _Allocations policy_. <https://allocations.access-ci.org/allocations-policy>

Ollama. (n.d.). _API_. <https://ollama.com/api>

Ollama. (n.d.). _Structured outputs_. <https://docs.ollama.com/capabilities/structured-outputs>

Ollama. (n.d.). _Modelfile reference_. <https://docs.ollama.com/modelfile>

Ollama. (n.d.). _Qwen3 model library page_. <https://ollama.com/library/qwen3>

Hugging Face. (n.d.). _PEFT LoRA reference_. <https://huggingface.co/docs/peft/package_reference/lora>

Texas Advanced Computing Center. (n.d.). _Stampede3 user guide_. <https://docs.tacc.utexas.edu/hpc/stampede3/>

Texas Advanced Computing Center. (2025, December 16). _TACC user account policy updates for 2026_. <https://tacc.utexas.edu/news/user-updates/107609>

Tapis Project. (n.d.). _Authentication (Tapis v3)_. <https://tapis.readthedocs.io/en/latest/technical/authentication.html>

Tapis Project. (n.d.). _Jobs API (Tapis v3)_. <https://tapis.readthedocs.io/en/latest/technical/jobs.html>
