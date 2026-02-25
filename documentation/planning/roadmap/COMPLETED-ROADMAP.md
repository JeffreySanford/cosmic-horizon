# Completed Roadmap Items

Status date: 2026-02-22

This document archives roadmap entries that have been fully implemented as of the status date.
Tasks have been removed from `ROADMAP.md` and are preserved here for reference.

## Baseline

- Angular app state migration to NgRx is complete in scoped domains.
- SSR viewer preload resolver is active with TransferState hydration.
- SSR performance telemetry counters are implemented for bootstrap/TransferState hit‑rate tracking.
- Core local quality gates are green (`lint`, `test`, `e2e`).

## Priority 0: Real‑Data Jobs Integration (astronomy mode)

- Phase 1 & Phase 2 preparation tasks completed: dataset staging, CASA profile, adapter stub, metadata extraction, and prompt enrichment.
- Architectural drawings produced (`ideas/jobs-real-data/architecture-diagram.md`).

## Priority 1: Remote Compute Gateway (v1.2)

- Continue polishing data staging realism features in demo mode (upload progress, missing inputs, error codes, artifact packaging). _(demo service now supports these conditions and file manifest modeling)_

## Priority 1A: Local LLM Orchestration Completion (v1.2 offline track)

- Correlation IDs on all LLM job requests/events.
- Header/token/signed-URL redaction in logs.
- Rate limiting and request-size boundaries on local compute endpoints.
- Retry/backoff and bounded timeouts across adapter/server/Ollama calls.
- Optional response cache for repeated parameter sets (in-memory).
- Web e2e coverage in `REMOTE_COMPUTE_MODE=local-llm` and CI shard enablement (build errors corrected, tests now run with local compute server; CI workflow updated to start API service).
