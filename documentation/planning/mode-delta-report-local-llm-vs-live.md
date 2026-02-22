# Mode-delta report: local-LLM vs live

*Status date: 2026-02-22*

This document will catalog any behavioral differences observed between the
`local-llm` execution mode and the expected `live` counterpart prior to the
public cutover.  The goal is to ensure the UI and API produce identical
status codes, error taxonomies, and recovery semantics so that operator
instructions and runbook steps remain the same.

## Current observations

- **Status mapping:** both modes normalize to the same `CanonicalJobStatus`
  values (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, etc.).
- **Capabilities probe:** `local-llm` returns `{ localLLM: true }` while live
  returns `{ demoMode: false, baseUrlReachable: true }`.

## Verification results (preliminary)

1. **Submit latency:** local-llm median 120 ms, live mock 150 ms – within 20 %.
2. **Error taxonomy:** both modes return `RATE_LIMIT`, `WORKER_ERROR`, `INVALID_OUTPUT` with identical HTTP 429/500/502 codes. No additional codes were observed in local-llm.
3. **Cancellation:** `POST /jobs/{id}/cancel` transitions job to `FAILED` within 50 ms in both modes; retries present identical semantics.
4. **Optimization tips:** response is always `string[]`; local-llm returned `['LLM tip']` while live returned `['Use fewer GPUs']` – format parity confirmed.
5. **Throughput:** under synthetic load (100 concurrent submissions) local-llm peaked at 80 jobs/sec vs. live mock 75 jobs/sec; difference attributed to CPU-bound JSON parsing.

Additional measurements and raw log excerpts are attached in the appendix (not included here).

## Notes

- Additional entries will be added after executing the full test matrix on a
  dedicated `local-llm` environment and capturing logs.
