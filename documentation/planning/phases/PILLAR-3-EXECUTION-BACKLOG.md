# Pillar 3 Execution Backlog

**Status date:** 2026-02-11  
**Status:** ACTIVE  
**Related checklist:** `documentation/planning/phases/PILLAR-3-IMPLEMENTATION-CHECKLIST.md`

---

## Purpose

Convert Pillar 3 scope into executable ticket-style work packages with acceptance criteria and delivery order.

---

## Work Packages

### P3-001: Lineage Contract + Persistence Foundation

Status: `in_progress`  
Priority: `P0`

Scope:

- Add shared models for lineage graph.
- Add API route `GET /analysis/:id/lineage`.
- Add persistence schema + migration for lineage data.

Acceptance criteria:

- Contract merged under `libs/shared/models` with strict types.
- Endpoint returns lineage for seeded fixture analysis.
- Unit + e2e coverage added and passing.

Definition of done:

- Lint/tests green.
- No `any`/`unknown` in new lineage codepaths.

---

### P3-002: Reproducibility Manifest Endpoint

Status: `todo`  
Priority: `P0`

Scope:

- Add manifest generator service.
- Implement `GET /analysis/:id/reproducibility-manifest`.
- Add signed/hashable manifest metadata.

Acceptance criteria:

- Identical inputs produce stable manifest hash.
- Required fields are complete for seeded analysis fixtures.
- Signature verification utility test passes.

Definition of done:

- Manifest endpoint e2e tests green.
- Missing required fields return typed failure responses.

---

### P3-003: Replay API + Provenance Linking

Status: `todo`  
Priority: `P1`

Scope:

- Add `POST /analysis/:id/replay`.
- Add replay status route and diff summary model.
- Persist original/replay linkage.

Acceptance criteria:

- Replay creates child analysis tied to original id.
- Replay preserves provenance chain + site affinity defaults.
- Diff summary present for completed replay.

Definition of done:

- Replay e2e path green for local fixture.
- Typed error handling for compatibility failures.

---

### P3-004: Version Compatibility Engine

Status: `todo`  
Priority: `P1`

Scope:

- Add compatibility evaluator and policy table.
- Add `POST /analysis/version-compatibility-check`.
- Integrate check into replay/submit paths.

Acceptance criteria:

- Response reason codes are deterministic and typed.
- Known fixture matrix covers `ok`, `deprecated`, `breaking_change`, `not_found`.

Definition of done:

- False-positive mismatch regression tests pass.
- No untyped compatibility decisions.

---

### P3-005: Post Metadata + JSON-LD Manifest Linkage

Status: `todo`  
Priority: `P2`

Scope:

- Add manifest references to post metadata schema.
- Expose manifest linkage in analysis detail payload.

Acceptance criteria:

- Published post payload includes reproducibility manifest id/hash.
- Serializer/deserializer tests pass for metadata contract.

Definition of done:

- API e2e validates consistent linkage.
- Docs updated for payload contract changes.

---

### P3-006: Reproducibility Metrics + Leaderboard Feed

Status: `todo`  
Priority: `P3`

Scope:

- Add replay/fork event metrics source.
- Add aggregate query shape for "most reproduced" ranking.

Acceptance criteria:

- Aggregates can be queried from API.
- Seeded data demonstrates ranking output.

Definition of done:

- Metrics contract documented and tested.
- Deferred UI implementation explicitly marked if not in MVP.

---

## Sequencing

1. `P3-001`
2. `P3-002`
3. `P3-003`
4. `P3-004`
5. `P3-005`
6. `P3-006`

---

## Current Step 1 Progress

Step 1 target: "Lock Pillar 3 scope into executable tickets."

Completed in this document:

- Work packages created with statuses, priorities, acceptance criteria, and done criteria.
- Initial execution order established.
- `P3-001` marked `in_progress` to start implementation phase.

---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
