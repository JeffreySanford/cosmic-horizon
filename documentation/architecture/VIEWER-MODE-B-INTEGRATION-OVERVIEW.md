# Viewer Mode B Integration Overview

Status date: 2026-02-10
Status: Planning Only (Not MVP)

## Purpose

Define what Mode B is, when it should be integrated, and what must be true (technical and institutional) before integration starts.

## What Mode B Is

Mode B is the deferred advanced viewer path for expert/science workflows beyond Mode A (Aladin quick-look usage).

Proposed Mode B capabilities:

- FITS/WCS-aware viewing and processing path

- On-demand cutout/manifest workflow

- Heavier compute/orchestration for advanced analysis

- Extended reproducibility metadata for science-grade outputs

## Current State

- MVP remains Mode A only.

- Mode B is explicitly deferred.

- No Go/FITS processing tier is active in production architecture.

References:

- `documentation/architecture/VIEWER-MODE-B.md`

- `documentation/architecture/VIEWER-MODE-B-DEFERRED.md`

- `documentation/architecture/ARCHITECTURE.md`

## Integration Timing (Recommended)

Mode B should be considered only after:

1. Phase 2 is materially complete (inference/orchestration baseline is stable).

2. Operational evidence shows demand for expert-grade workflows that Mode A cannot satisfy.

3. Permission and policy agreements are documented for the intended data/compute path.

Practical target window:

- Earliest planning: post-Phase 2 stabilization.

- Earliest build start: aligned with v2 scope approval.

- Production rollout: gated pilot first, then controlled expansion.

## Feasibility Assessment

### Feasibility: Conditional (Medium)

Mode B is feasible if all gates below are met.

### Gate 1: Product/Scope Feasibility

- Clear user demand from expert users (not assumed).

- Defined success criteria (latency, quality, reproducibility).

- No regression to Mode A user experience.

### Gate 2: Technical Feasibility

- Compute model selected (local GPU vs remote HPC/TACC path).

- FITS/WCS handling validated on representative datasets.

- Cost model validated (storage, egress, compute queue times).

- Reliability targets defined for job execution and retrieval.

### Gate 3: Data/Policy Feasibility

- Data usage policy reviewed for every external data source.

- Access pattern confirmed as compliant (link-out, derived products, caching limits).

- Attribution and provenance handling implemented.

### Gate 4: Operational Feasibility

- Support/monitoring readiness for heavier jobs and user support.

- Quota/abuse controls for expensive processing paths.

- Incident rollback path back to Mode A-only service.

## VLA/NRAO Permission and Coordination

Your assumption is directionally correct: if Mode B introduces workflows beyond public quick-look consumption (for example, advanced derived products, heavier automated pulls, or policy-sensitive redistribution), explicit coordination is likely required.

Working assumption for planning:

- Public VLASS quick-look usage: already in MVP policy.

- Advanced Mode B processing/distribution patterns: treat as "approval required until confirmed otherwise."

Recommended coordination track:

1. Document intended Mode B data flows in a 1-page architecture memo.

2. Request written policy clarification from relevant NRAO/VLA contacts.

3. Confirm constraints on:

   - automated access volume,

   - caching/retention,

   - redistribution of derived artifacts,

   - attribution language,

   - acceptable integration patterns.

4. Convert clarifications into enforceable product policy and technical guardrails.

## Proposed Phased Rollout

1. Discovery/Policy Phase (no code rollout)

2. Internal Prototype (feature-flagged, non-public)

3. Limited Pilot (invited expert users, monitored quotas)

4. Graduated Public Expert Mode (if policy and reliability targets hold)

## Decision Checklist (Go/No-Go)

- [ ] User demand validated

- [ ] v2 scope approved

- [ ] Policy/permission clarification documented

- [ ] Cost/reliability model accepted

- [ ] Guardrails implemented (quotas, auditing, rollback)

- [ ] Pilot success criteria met

## If any item is unresolved, defer Mode B and continue Mode A + phased platform roadmap
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
