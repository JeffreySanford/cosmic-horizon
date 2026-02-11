# AlphaCal Integration Playbook

**Status date:** 2026-02-11  
**Status:** PLANNING  
**Audience:** Product, engineering, and conference/pitch preparation

---

## Purpose

This document defines how AlphaCal-class AI agents are expected to interact with `vlass-portal` as the operational UI and control-plane layer, without overstating current implementation status.

Use this as the canonical answer for:

- "How does AlphaCal interact with the portal?"
- "What is required before AlphaCal can be treated as production-integrated?"
- "How should we pitch this integration to the CosmicAI steering committee?"

---

## Source-of-Truth Classification

Per `documentation/governance/SOURCE-OF-TRUTH.md`:

- Product scope truth: `documentation/product/PRODUCT-CHARTER.md` and `SCOPE-LOCK.md`
- Strategic context: `AGENTS.md`
- Planning reference: `documentation/planning/phases/PHASE-3-COSMICAI-FEDERATION.md`

This playbook is a planning/operations reference. It does not by itself claim shipped AlphaCal integration.

---

## Interaction Model: AlphaCal <-> VLASS Portal

AlphaCal provides calibration intelligence and compute-side processing. `vlass-portal` provides researcher-facing orchestration, observability, and trust controls.

### 1. Operational UI and Monitoring

- Inference runs appear in web dashboards with run status, model/version metadata, and output artifact links.
- Users monitor queued/running/completed jobs without notebook polling.
- Output summaries are tied to dataset and model versions for reproducibility.

### 2. Job Orchestration

- User action in portal creates a job manifest (dataset URI, model spec, parameters, output target).
- Portal submits work to configured compute backends (local or remote/HPC path in Phase 3).
- Portal tracks lifecycle (`submit`, `status`, `cancel`) and surfaces logs/artifacts in one place.

### 3. Human-in-the-Loop Auditability

- Every run is reviewable in post/revision history.
- Analysts can inspect parameters, outputs, and lineage before accepting results.
- Community notebooks and revisions become the scientific audit trail.

### 4. Explainable Result Sharing

- Portal viewer state (Aladin context, snapshots, permalinks) is shareable without moving raw-scale data.
- Colleagues can reopen identical context for peer review.
- Explainability is operationalized via linked visual state + run metadata + revision notes.

---

## Integration Contract Expectations

For AlphaCal to be treated as "integrated" (beyond planning), these contract surfaces must be stable:

1. Job API contract: `submit`, `status`, `cancel`, standardized error payloads.
2. Artifact contract: predictable locations/URIs for logs, metrics, output products.
3. Model identity contract: explicit model name, semantic version, and immutable build/ref.
4. Lineage contract: dataset/version + parameters + environment captured per run.
5. Access contract: authenticated and authorized execution path for each compute backend.

These map directly to Phase 3 pillars for federation, remote compute, reproducibility, and explainability.

---

## "No Promise/No Overclaim" Rules

When writing docs, abstracts, or outreach:

- Mark shipped behavior as `implemented_fact`.
- Mark externally validated status as `verified_external` with date/source.
- Mark integration direction as `planning_hypothesis`.

Do not publish language that implies current official deployment, endorsement, or institutional ownership.

Reference:

- `documentation/marketing/abstracts/COSMIC-HORIZONS-2026-ABSTRACT-CONTENT-GUIDE.md`
- `documentation/marketing/abstracts/COSMIC-HORIZONS-2026-SUBMISSION-PLAYBOOK.md`

---

## Availability Posture: "Is AlphaCal available now?"

Current repository posture (as of 2026-02-11):

- AlphaCal is a strategic target agent in `AGENTS.md`.
- AlphaCal operational docking is described in Phase 2/3 planning docs.
- No repository evidence currently designates AlphaCal as fully production-integrated in this codebase.

Required response pattern:

- "Integration target is active; production integration status remains planning until external endpoint and contract validation are complete."

External status check (performed 2026-02-11, public sources):

- CosmicAI's published 2025 seed-funding announcement describes AlphaCal as a seed-project research track, not a declared production service endpoint.
- Cosmic Horizons 2026 event materials provide timeline/deadline information but do not state a production AlphaCal release.

Practical conclusion:

- Treat AlphaCal as an active, high-priority research and integration target.
- Do not claim "generally available" or "production deployed" unless a dated official release or endpoint announcement is available.

Public reference links used in this status check:

- `https://www.cosmicai.org/news/cosmicai-awards-more-than-2-3m-in-seed-funding-for-team-based-research`
- `https://www.cosmicai.org/events/cosmic-horizons-conference-2026`

If this status is needed for external communication, run the external claim workflow before publishing:

- `documentation/governance/EXTERNAL-RESEARCH-WORKFLOW.md`

---

## Steering Committee Pitch (Technical Framing)

Use this structure:

1. Problem: compute/model progress outpaces usable researcher operations UX.
2. Proof now: SSR, persistent visualization context, revisioned notebook workflows.
3. Interface thesis: portal is control-plane UX, not a replacement for compute/math engines.
4. Integration ask: define/lock API + lineage + artifact contracts with AlphaCal owners.
5. Governance: explicit independence/non-affiliation language and policy-safe data handling.

Reference pitch docs:

- `documentation/marketing/EXECUTIVE-PITCH-NGVLA-HUMAN-BOTTLENECK-2026-02-11.md`
- `documentation/marketing/abstracts/COSMIC-HORIZONS-2026-SUBMISSION-PLAYBOOK.md`

---

## Cosmic Horizons 2026 Alignment Checklist

Before submitting AlphaCal-related abstract or talk content:

- Include independence/non-affiliation statement.
- Separate implemented capabilities from planned AlphaCal integration.
- Keep external timeline/status claims date-stamped and source-backed.
- Emphasize human-in-the-loop trust and reproducibility controls.
- Avoid "already deployed for CosmicAI" phrasing unless externally verified.

Related:

- `documentation/marketing/abstracts/COSMIC-HORIZONS-2026-ABSTRACT.md`
- `documentation/marketing/abstracts/COSMIC-HORIZONS-2026-ABSTRACT-CONTENT-GUIDE.md`

---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
