# Pillar 3 Implementation Checklist

**Status date:** 2026-02-11  
**Status:** EXECUTION PLANNING  
**Source scope:** `documentation/planning/phases/PHASE-3-COSMICAI-FEDERATION.md` (Pillar 3)

---

## Objective

Map each Pillar 3 scope item to concrete API/model/test tasks with explicit done criteria.

---

## Scope-to-Implementation Map

### A. Extended Experiment Graph

API tasks:

- Add analysis lineage DTO/response contract in `libs/shared/models` for:
  - input source (`sourceType`, `datasetUri`, `datasetVersion`)
  - processing source (`site`, `gpuSpec`, `cpuSpec`, `schedulerJobId`)
  - model source (`repo`, `modelName`, `modelVersion`, `modelRef`)
  - output destination (`site`, `uri`, `bucket`, `retentionPolicy`)
- Add API read endpoint for lineage graph:
  - `GET /analysis/:id/lineage`

Model/data tasks:

- Add persistent schema/entity for lineage nodes + immutable edges.
- Add enum constraints for source/site/repo fields (no free-text drift).
- Add migration with not-null constraints for required provenance fields.

Test tasks:

- Unit: mapping between persistence entity and shared model contract.
- API e2e: `GET /analysis/:id/lineage` returns complete graph for known analysis id.
- Contract: serialization remains strict (no `any`/`unknown` escape hatches).

Done criteria:

- Shared contract published and consumed by API/web without type suppression.
- Every new analysis run stores complete lineage record at creation.
- Endpoint returns deterministic lineage for the same analysis id.

---

### B. Reproducibility Manifest (Scientific Artifact)

API tasks:

- Add manifest generation service (immutable snapshot assembly).
- Implement endpoint from Phase 3 plan:
  - `GET /analysis/:id/reproducibility-manifest`
- Add signature metadata block in response (`signatureAlgorithm`, `signature`, `signedAt`).

Model/data tasks:

- Add `ReproducibilityManifest` shared type in `libs/shared/models`.
- Include required fields:
  - input URIs + versions
  - model refs/version
  - container image hash
  - scheduler job id (when remote)
  - portal release/version
- Persist manifest hash and signed timestamp for audit verification.

Test tasks:

- Unit: manifest hash is stable for identical inputs.
- Unit: any field change yields new hash.
- API e2e: endpoint returns DOI-ready metadata with all required fields populated.
- Security/unit: signature verification utility validates server-issued signature.

Done criteria:

- Manifest endpoint returns immutable, hashable payload.
- Signature fields present and verifiable for all published analyses.
- Missing required provenance fields fail manifest generation with typed errors.

---

### C. Replay Orchestration

API tasks:

- Add replay endpoint:
  - `POST /analysis/:id/replay`
- Add replay-status endpoint:
  - `GET /analysis/:id/replay/:replayId`
- Enforce same-site replay default (`local -> local`, `tacc -> tacc`) with explicit override rules.

Model/data tasks:

- Add `ReplayRequest`, `ReplayResult`, `ReplayDiffSummary` shared models.
- Persist parent-child relationship (`originalAnalysisId`, `replayAnalysisId`).
- Persist structured diff object (metrics deltas + categorical outcome changes).

Test tasks:

- Unit: compatibility resolver for model/version availability and breaking changes.
- API e2e: replay request forks analysis with new dataset and retains provenance.
- API e2e: replay diff summary computed and returned for completed runs.

Done criteria:

- Replay can be executed without manual notebook intervention.
- Replay preserves provenance chain back to original analysis.
- Diff summary is machine-readable and user-display-ready.

---

### D. Versioning at All Layers

API tasks:

- Add compatibility check endpoint:
  - `POST /analysis/version-compatibility-check`
- Add typed compatibility response with reason codes (`ok`, `deprecated`, `breaking_change`, `not_found`).

Model/data tasks:

- Track versions for:
  - dataset
  - model
  - portal release
  - runtime/container
- Add compatibility policy table/rules and effective dates.

Test tasks:

- Unit: policy evaluator returns correct reason codes.
- API e2e: mismatched versions produce deterministic warnings/errors.
- Regression: no false-positive mismatch in known-compatible fixtures.

Done criteria:

- Version checks run before replay/submission paths.
- No untyped compatibility outcomes.
- False "model version mismatch" rate trends to 0 in test fixtures.

---

### E. Integration Points

API/UI tasks:

- Embed manifest reference in post metadata contract (JSON-LD payload field).
- Expose manifest and lineage references in analysis detail response.
- Add analytics source for reproducibility events (fork/replay counters).

Model/data tasks:

- Add schema for post metadata linkage to manifest id/hash.
- Add leaderboard aggregate model for "most reproduced analysis" (or placeholder interface if deferred).

Test tasks:

- Unit: post metadata serializer includes manifest linkage.
- API e2e: analysis + post payload includes consistent manifest references.
- UI/unit: analysis detail page renders manifest/replay metadata without Promise-based fetch chains.

Done criteria:

- Manifest linkage appears anywhere analysis is published/shared.
- Reproducibility metrics are queryable for dashboard/reporting.
- Integration remains within current scope/affiliation guardrails.

---

## Global Quality Gates for Pillar 3 Work

- Lint clean: `pnpm nx run-many --target=lint --all`
- Unit/integration clean: `pnpm nx run-many --target=test --all`
- E2E gates clean: `pnpm nx run mvp-gates:e2e`
- Docs policy clean: `pnpm nx run docs-policy:check`

Coding standard constraints:

- No `any`/`unknown` in new shared contracts and API DTOs.
- No ad-hoc Promise conversion patterns in service/UI flows; keep RxJS-first pipeline usage.
- Keep strict typing and explicit lifecycle management.

---

## Sign-off Definition

Pillar 3 can move from "planning" to "implementation active" when:

1. Extended experiment graph + manifest endpoints are merged with tests.
2. Replay + compatibility checks are merged with tests.
3. Docs and API contracts are synchronized and policy checks pass.

---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
