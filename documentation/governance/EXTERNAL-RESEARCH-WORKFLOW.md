# External Research Workflow

Status date: 2026-02-11
Scope: Any external trend/industry/institution claim used in VLASS Portal docs, plans, demos, or outreach.

---

## Goal

Keep planning useful and ambitious without mixing unverified external claims with implemented facts.

---

## Classification Rule

Every major statement must be tagged internally as one of:

- `implemented_fact`: Present in code/tests/docs in this repo.
- `verified_external`: Sourced with date + link/reference.
- `planning_hypothesis`: Directional assumption pending validation.

---

## Required Steps Before Merging Narrative Updates

1. Add/update source-dated planning note in `documentation/planning/`.
2. Confirm affiliation disclaimer is preserved in public-facing docs.
3. Ensure roadmap items map to concrete milestones and are labeled as planned/hypothesis where applicable.
4. Run `pnpm nx run docs-policy:check`.

---

## Affiliation Safety Check

Public text must not imply:

- official program ownership,
- sponsorship,
- endorsement,
- partnership already established.

Allowed phrasing:

- independent,
- public-data,
- integration-ready,
- open to collaboration.

---

## Workflow Integration Points

- Product and scope truth: `documentation/product/PRODUCT-CHARTER.md`, `SCOPE-LOCK.md`.
- Forward planning: `documentation/planning/roadmap/ROADMAP.md`.
- External context log: dated file in `documentation/planning/`.
- Execution tracking: `TODO.md`.

---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
