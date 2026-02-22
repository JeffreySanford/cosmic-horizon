# Remote Compute Gateway Sprint: Offline Work Plan

Status date: 2026-02-22

## Current Implementation Snapshot (2026-02-22)

(see checklists below for detailed progress)

The live-codebase now includes comprehensive adapter abstractions, authentication
helpers, retry/circuit-breaker logic, and a full suite of unit tests. The only
major pieces still waiting on real credentials are live-endpoint validation,
auth hardening in approved environments, and production runbook rehearsal.

- Adapter abstraction complete with demo/live engines and feature flag.
- Live adapter skeleton includes request builders, status normalization,
  retry/backoff, circuit breaker, and basic circuit-breaker state.
- Guardrails for the local-LLM offline path (rate limiting, schema validation, response cache) are in place and covered by unit/contract tests.
- Auth subsystem with `AuthProvider`, token rotation and expiry logic
  implemented; refresh stub tested.
- Contract fixtures with versioned layout and README present; stub list/files fixtures added.
- Redaction utility created, signed‑URL handling noted, and tested.
- Mock Tapis server script and CI workflow added; network‐deny rule in tests enabled.
- Unit tests cover core adapter behaviors, error paths, redaction,
  capabilities probe, circuit breaker, state transitions, and dataset staging.
- Playwright e2e job-flow test and a WebSocket load-test script exist for
  performance validation.
- Event schema for job lifecycle and correlation-ID propagation already implemented; frontend now includes a demo/live badge and optimization-tips panel.
- Documentation now includes an OpenAPI spec, glossary, and runbook; runbook recently updated with guardrail monitoring guidance.
- NgRx state transition helper and tests exist in frontend code.
  This file collects all the tasks that can be completed _without_ having live
  access to TACC/ACCESS compute resources. The goal is to push the codebase and
  associated artifacts as far as possible so that once credentials become
  available, integrating the real compute path is a trivial configuration flip.

Having this plan documented also allows developers to make steady progress when
the access request is still pending, ensuring the project meets its symposium
milestones even if the external grant process takes longer than expected.

> **Note:** once UT/ACCESS credentials arrive, run the existing WebSocket and
> HTTP load‑testing scripts against the real endpoints to validate rate limits,
> schema guards, and staging realism under realistic traffic patterns.

## Progress checklist (2026-02-22)

All of the above items have been completed.  Actionable work is now tracked
in **`TODO.md`** and **`ROADMAP.md`**; refer to those documents for the current
list of open tasks rather than maintaining a separate list here.

## Phase 1 – Code & Architecture

_(the detailed phase checklist below is retained for historical reference; any
remaining items are already reflected in TODO/ROADMAP and can be removed when
they are cleared.)_

### Core adapter refactor

- [x] Refactor `TaccIntegrationService` (and any related client) to expose a clean
      interface with two concrete adapters: `DemoAdapter` (simulator) and
      `LiveTapisAdapter` (HTTP client). Keep the consumer-facing API identical.
- [x] Add a `featureFlag` or environment variable (e.g. `TACC_LIVE=true`) to toggle
      between adapters at runtime. Ensure the gateway module never imports the
      fake logic when live mode is enabled.
- [x] Define the adapter interface type in TypeScript (covered by adapter tests).

### Simulation improvements

- [x] Extend the existing simulation logic:
  - [x] Add realistic delays and job lifecycle transitions.
  - [x] Simulate quotas, queue-full, and transient failure modes.
  - [x] Support optimization tips and resource-metrics calculations (handled in
        JobOrchestratorService).
- [x] Build a wrapper for data staging operations (`uploadInput`, `fetchOutput`) and
      simulate both success and error cases (DatasetStagingService).

### Credential & staging abstractions

- [x] Implement comprehensive credential/authorization abstractions to prepare for
      OAuth2 tokens, refresh logic, and key rotation (basic provider + refresh stub added, rotation tested).

### Integration readiness (A)

- [x] Create a `LiveTapisAdapter` skeleton with real method signatures and
      request-building logic; unit-test the request constructors as pure functions.
- [x] Establish complete contract fixtures for canonical JSON
      samples (submit, status, list, files) and validate parsing/typing against them.
      (all four files present and parser assertions in tests)
- [x] Add a `getCapabilities()`/`healthCheck()` method:
  - [x] demo adapter returns fixed capability matrix;
  - [x] live adapter probes base URL reachability, OAuth2 tenant resolution, and
        presence of key endpoints.

### Observability & security (B)

- [x] Implement a structured event schema for job lifecycle events (submitted,
      queued, running, failed, completed, output-ready); update logging and UI to
      emit/consume this schema.  (schemas live in `libs/shared/event-models`)
- [x] Build a central redaction utility that scrubs headers/bodies:
  - [x] Authorization headers
  - [x] refresh tokens
  - [x] client secrets
  - [x] signed URLs (if used) _(none currently in use)_
- [x] Add correlation ID generation per job submission and propagate through all
      logs and WebSocket events.  (middleware and RequestContextService already in place)
- [x] Implement status normalization layer with mapping table (demo/Tapis/Slurm
      → canonical SUBMITTED | QUEUED | RUNNING | SUCCEEDED | FAILED | CANCELED | UNKNOWN) and tests for unknown statuses.
- [x] Add retry/backoff policy for live mode: exponential backoff for polling,
      retry budget, and circuit breaker when auth or endpoint failures occur; unit
      test using fake timers (basic skeleton exercised in adapter spec).

### Data staging realism (D)

- [ ] Introduce data-staging realism features (large upload progress, missing
      inputs 404, permission 403, outputs-delayed) and artifact packaging (zip with
      checksum) in demo mode.
- [ ] Model files as first-class entities (inputManifest, outputManifest,
      artifactRefs).

### Local LLM bridge track (new)

_This section tracks local-llm implementation status while live credentials are pending._

- [x] Publish execution plan: `documentation/LLM/REMOTE-COMPUTE-LLM/REMOTE-COMPUTER_MOCK_LLM.md`.
- [x] Add `local-llm` runtime mode in addition to `demo` and `live`.
- [x] Implement `LocalLlmAdapter` with the same canonical status contract.
- [x] Stand up local compute HTTP server for submit/status/cancel/result routes. (skeleton implemented, HTTP contract tests exercise submit/status/cancel/result/health)
- [x] Integrate Ollama via `OLLAMA_BASE_URL` and `OLLAMA_MODEL`
      (recommended default: `qwen3:8b`, fallback: `qwen3:4b`).
- [x] Add structured JSON output validation for LLM responses (fail closed on
      invalid schema).
- [x] Add one e2e suite for local-llm mode and keep it CI-runnable without TACC access.

## Phase 2 – Testing (active now that Phase 1 is wrapped up)

### Core adapter & capability tests

- [x] Expand unit tests in `tacc-integration.*.spec.ts` to cover:
  - [x] Additional error paths (401, 403, 500, timeouts).
  - [x] Redaction of secrets/headers in logs and events.
  - [x] Feature-flag switching between demo and live adapters.
  - [x] Validation of request construction logic in `LiveTapisAdapter`.
  - [x] Capability probe behaviour in demo vs stubbed-live mode.
  - [x] Circuit breaker open/close behavior.

### Adapter interface & staging

- [x] Add new tests for the adapter interface and staging methods.
- [x] Add tests for data staging realism (large upload progress, missing inputs, permission errors).

### Frontend state management (C)

- [x] Create tests for NgRx job state machine (in web feature file):
  - [x] out-of-order status updates (RUNNING after COMPLETED) are ignored.
  - [x] guarded transitions table prevents illegal moves (COMPLETED → RUNNING).
  - [x] idempotent submission/ retry behaviour prevents duplicate UI jobs.

### End-to-end & performance

- [x] Write Playwright e2e tests using the simulated backend to verify end-to-end
      flows (submission -> status -> results) and UI elements (optimization tips,
      tooltips, etc.). See `web-e2e/src/jobs-flow.spec.ts`. CI will run these
      alongside existing example specs.
- [x] Build a visual indicator (badge or banner) showing whether the gateway is in
      demo or live mode.  _(implemented in JobsConsoleComponent; uses `capabilities` endpoint)_
- [x] Implement optimization tips, resource metrics, and provenance links in the
      UI, powering them with fake data when offline. _(tips panel added, mock data supplied)_
- [x] Create a standalone `load-test` spec for the job notification WebSocket
      paths using `websocket-load-test.js` (see `scripts/websocket-load-test.js`).

## Phase 3 – Frontend Development

- [x] Finish or refine the jobs console UI components: submission form, status
      panels, progress bars, and logs (existing `JobsConsoleComponent`).
- [x] Wire UI components to the adapter interface so they work in both demo and
      live modes (mock interceptor and adapter abstraction used by component).
- [x] Build a visual indicator (badge or banner) showing whether the gateway is in
      demo or live mode.  _(implemented in JobsConsoleComponent)_
- [x] Implement optimization tips, resource metrics, and provenance links in the
      UI, powering them with fake data when offline. _(tips panel added, mock data supplied)_

## Phase 4 – Documentation & Contracts

- [x] Draft an OpenAPI/Swagger specification for the gateway endpoints that mirror
      Tapis (or SSH/slurm) operations.  (`documentation/api/remote-compute-gateway.openapi.yaml` now exists.)
- [x] Document the adapter interface and configuration strategy in a developer
      guide (`documentation/guides/remote-compute-adapter.md` is now created).
- [ ] Capture the minimal and stretch demo goals in the access plan (already done)
      and reiterate the offline work plan here for clarity.
- [ ] Maintain an FAQ section addressing common access questions and the three
      gates.

### Documentation improvements (G)

- [x] Add a one-page "Tapis vs Slurm decision record" (architecture decision
      record) and keep it versioned as an ADR.
- [x] Draft documentation/guide for authentication design (`guides/auth-design.md`).
- [x] Add a glossary: SU, allocation, tenant, system, app, queue, archive,
      scratch, Ranch, etc. (see `documentation/guides/glossary.md`).
- [x] Provide initial FAQ section (see `documentation/guides/faq.md`).

### Additional documentation to add

- [x] `documentation/adr/ADR-remote-compute-tapis-vs-slurm.md`
- [x] `documentation/api/remote-compute-gateway.openapi.yaml`
- [x] `documentation/runbooks/remote-compute-live-cutover.md` created with cutover steps.
- [ ] `documentation/security/remote-compute-threat-model.md`
- [ ] `documentation/testing/remote-compute-test-matrix.md`

## Phase 5 – CI / Quality & Security

- [x] Ensure `docs-policy:check` continues to validate the new planning documents (already running in CI).
- [ ] Keep existing lint/test/e2e tasks green; add new targets if necessary for the
      adapter interface or staging utilities.
- [ ] Add CI steps to run the simulated gateway with coverage against jobs-related
      APIs, so regressions are caught early (current live-path integration job
      already exercises adapter tests; further coverage may be added later).
- [x] Write a GitHub Action that verifies the feature flag switch works by running
      a small script in both demo and (empty) live configurations (see
      `.github/workflows/live-path-integration.yml`).
- [ ] Enhance the live-path GitHub Action:
  - [x] run with `TACC_LIVE=true` plus a mock HTTP server that returns canned
        Tapis-shaped responses (script added under `tools/mock-tapis-server.js`).
  - [ ] validate that the `LiveTapisAdapter` builds and parses requests
        correctly without real credentials (currently covered by adapter unit tests).

### Security posture (E)

- [ ] Add a pre-commit / CI secret scan (gitleaks or similar) and a policy test
      that fails if .env/keys appear anywhere in repo.
- [x] Add `.env.template` and explicit config docs for required vars
      (`TACC_TENANT_BASE_URL`, `TACC_CLIENT_ID`, `TACC_CLIENT_SECRET`,
      `TACC_SCOPES`, `TACC_EXEC_SYSTEM_ID`/`TACC_SYSTEM_ID` (execution system),
      `TACC_APP_ID`, `TACC_WORKDIR`/`TACC_ARCHIVE_SYSTEM_ID`, etc.).
- [x] Add a "deny network in tests" rule so unit tests never accidentally call out
      when live mode is stubbed.

## Phase 6 – Outreach & Planning & Demo Resilience

- [x] Maintain a log of access requests, contacts, and responses within
      `PHASE-6-ACCESS-LOG.md`.
- [x] Draft a sample email or proposal text that succinctly describes the minimal
      resource needs (e.g., 10 SU for a trivial job) to expedite requests.
      (`PHASE-6-OUTREACH-EMAIL-TEMPLATE.md`)
- [ ] Identify potential sponsor PIs, COSMICAI collaborators, or other network
      contacts who could assist with obtaining credentials.

### Demo / symposium resilience (F)

- [ ] Create a record/replay mode: capture sanitized transcripts of live adapter
      traffic and enable deterministic offline replay.
- [x] Write a "demo script" markdown with exact steps and screenshots for
      both demo mode and live mode presentation.
      (`PHASE-6-DEMO-SCRIPT.md`)
- [ ] Assemble a "PI ask pack" with 1-paragraph overview, SU estimate, data
      source, security posture, endpoints to hit, and value to PI (co-auth,
      acknowledgement, credit).

---

_Complete as many of the above items as possible while waiting for compute
credentials.  When live access arrives, use `TODO.md` and `ROADMAP.md` as the
single sources of truth; this document can then be trimmed to a brief
reference or archived._

### Document consolidation note

The `documentation/LLM/REMOTE-COMPUTE-LLM` folder previously contained several
ancillary notes (access research, mock‑LLM plan, remaining‑work summary,
outreach templates).  Those materials have now been either subsumed into the
roadmap/TODO or re‑located to more appropriate locations (e.g. security,
testing).  Going forward, only the **offline‑work plan** and the
**LLM‑Enhanced job orchestration** design remain as living documents in this
directory; the others may be archived or deleted to reduce clutter.

## References

ACCESS. (n.d.). _Allocations policy_. <https://allocations.access-ci.org/allocations-policy>

Texas Advanced Computing Center. (n.d.). _Stampede3 user guide_. <https://docs.tacc.utexas.edu/hpc/stampede3/>

Texas Advanced Computing Center. (2025, December 16). _TACC user account policy updates for 2026_. <https://tacc.utexas.edu/news/user-updates/107609>

Tapis Project. (n.d.). _Authentication (Tapis v3)_. <https://tapis.readthedocs.io/en/latest/technical/authentication.html>

Tapis Project. (n.d.). _Jobs API (Tapis v3)_. <https://tapis.readthedocs.io/en/latest/technical/jobs.html>
