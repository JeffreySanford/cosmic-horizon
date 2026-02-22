# Remote Compute LLM Plan (Docker + Ollama)

Status date: 2026-02-22
Owner: Cosmic Horizons platform

## Objective

Run a local LLM-backed compute path in Docker so the Jobs gateway can execute real asynchronous work before TACC live connectivity is available.

## Scope

- Ollama runs as a dedicated GPU-enabled container.
- A warmup/init step pulls the chosen model at startup.
- Cosmic Horizons API uses `local-llm` mode via adapter (`demo | local-llm | live`).
- Keep contracts compatible with the remote compute gateway lifecycle.

## Model choice

- Primary: `qwen3:8b`
- Fallback: `qwen3:4b` (lower VRAM)
- Stretch: `qwen3:14b` (higher quality, higher memory/latency)

## Why Dockerized Ollama

- Isolates runtime from host dev environment.
- Reproducible startup and model bootstrapping.
- Easier parity across teammates and CI-like local environments.
- Clean resource accounting and restart behavior.

## Runtime assumptions (validated on this machine)

- GPU: RTX 3080 (10 GB VRAM)
- CPU: i9-12900K (16 cores / 24 logical processors)
- RAM: 64 GB class
- Docker GPU runtime available (`--gpus all` works in Linux container)

## Initial rollout phases

1. Infrastructure bootstrap

- Bring up `cosmic-horizons-ollama` container from compose overlay.
- Warm model pull with `qwen3:8b`.
- Verify health endpoint and local connectivity from API container/process.

2. Adapter integration

- Add/enable `REMOTE_COMPUTE_MODE=local-llm`.
- Route job operations through `LocalLlmAdapter`.
- Maintain canonical job statuses and error taxonomy.

3. Hardening

- Add schema validation for model JSON outputs.
- Add retry/backoff/timeouts and redaction.
- Add one e2e flow in local-llm mode.

## Known constraints

- First model pull is large and slow (cold start).
- 10 GB VRAM limits model concurrency and max model size.
- Output determinism requires schema checks and strict prompting.
- Keep port ownership clear (`OLLAMA_PORT`, default `11435`) to avoid conflicts
  with other local projects.

## Usage

Use the unified root compose stack (includes Ollama in events file):

`docker compose -f docker-compose.yml -f docker-compose.events.yml up -d`

Optional model override:

`$env:OLLAMA_MODEL="qwen3:4b"`

## Next artifacts

- `LocalLlmAdapter` implementation
- local compute HTTP server skeleton
- JSON schema pack for validation/estimation/result responses
