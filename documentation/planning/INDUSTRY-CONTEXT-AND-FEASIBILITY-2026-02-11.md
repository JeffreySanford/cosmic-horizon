# Industry Context and Feasibility (2026-02-11)

Status date: 2026-02-11
Owner: Jeffrey Sanford
Purpose: Capture the current external narrative, feasibility assumptions, and positioning for VLASS Portal planning.

---

## Positioning Summary

VLASS Portal is an independent software platform intended to act as a web-native operations and collaboration layer for public radio-astronomy workflows.

It is not an official NRAO/VLA/VLASS system.

Practical positioning:

- "Front-half UX + workflow orchestration" for researchers.
- Compatible with institutional "back-half" compute/AI systems when integrations are available.
- Portfolio-grade engineering that can mature into collaboration infrastructure.

---

## Why This Project Is Plausible

Current repo evidence supports feasibility:

- Nx monorepo with Angular SSR frontend and NestJS API backend.
- Release quality gates and repeatable CI checks in place.
- Three MVP pillars implemented and tested in local gates.
- Shared model contracts across app layers reduce integration drift.

Net: This is not only a concept. It is an operational platform with documented quality controls.

---

## Strategic Value Beyond Existing Viewers

Compared with standalone sky viewers, VLASS Portal adds workflow and collaboration surfaces:

1. Persistent state sharing: permalinks + snapshots.
2. Community notebook publishing with revisions.
3. SSR-first web delivery aimed at fast perceived performance.
4. Integration surface for future AI/job orchestration.

This means "viewer + reproducibility + social workflow," not just visualization.

---

## AI Control Plane Direction (Planning Hypothesis)

The portal can evolve into a control plane by adding:

- Job submission UI to remote compute (queues/schedulers).
- Inference run tracking and auditability.
- Dataset/result lineage across model and data versions.
- Explainability and confidence display layers.

These are roadmap hypotheses and not production commitments until integration partners and interfaces are confirmed.

---

## TACC / CosmicAI / ngVLA Notes

This repository may reference ecosystem trends, but must separate:

- Verified repo facts (implemented behavior, tests, architecture), from
- External claims (institutional plans, data volume figures, timelines).

When external numbers are used for presentations, cite source and date, and mark assumptions clearly.

---

## Communication Guardrails

Required language for decks, docs, and outreach:

- "Independent project using public VLASS-related data/services."
- "Not affiliated with, sponsored by, or operated by VLA/NRAO/VLASS."
- "Open to future technical collaboration/integration."

Do not imply institutional endorsement before written confirmation.

---

## Next Planning Actions

1. Prepare a symposium-ready architecture poster from implemented capabilities.
2. Build an "integration readiness" appendix (API boundaries, auth model, audit model, deployment model).
3. Define a thin job-orchestration spike (submit/status/cancel + run log UI) behind feature flags.
4. Keep affiliation disclaimer visible in README, demo deck, and landing copy.
5. Keep all external trend claims in a source-dated references table.

---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
