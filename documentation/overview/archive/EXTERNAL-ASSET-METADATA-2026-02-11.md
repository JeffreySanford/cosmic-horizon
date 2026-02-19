# External Asset Metadata Pack

**Status date:** 2026-02-11  
**Purpose:** Apply consistent non-affiliation and claim-reference metadata to all external-facing overview assets.

---

## Standard Non-Affiliation Statement (Required)

`VLASS Portal is an independent, public-data-compatible, integration-ready web platform; it is not affiliated with, sponsored by, or operated by VLA/NRAO/VLASS.`

---

## Per-Asset Description Blocks

### `documentation/overview/The_Exascale_Control_Plane.pdf`

Description:

- Exascale/ngVLA planning narrative for AI-operations UX and control-plane direction.
- Includes MVP implementation evidence plus Phase 3 integration roadmap.

Required footer/description lines:

1. Standard non-affiliation statement.
2. `Numeric ecosystem values are source-dated in documentation/overview/EXTERNAL-CLAIMS-REFERENCES-APPENDIX-2026-02-11.md.`

---

### `documentation/overview/AI_and_the_Data_Tsunami.mp4`

Description:

- High-level explainer for data-scale transition and AI-assisted operational requirements.

Required footer/description lines:

1. Standard non-affiliation statement.
2. `All external numeric claims are tracked in documentation/overview/EXTERNAL-CLAIMS-REFERENCES-APPENDIX-2026-02-11.md.`

---

### `documentation/overview/Steering_the_Twenty_Petabyte_Telescope.m4a`

Description:

- Long-form strategy narration connecting platform capabilities to conference/governance context.

Required footer/description lines:

1. Standard non-affiliation statement.
2. `Conference dates and numeric context should be treated as source-dated planning references per the claims appendix.`

---

### `documentation/overview/Architecting_the_VLASS_Portal_for_Sub-Second_Speed.m4a`

Description:

- Architecture and performance narrative centered on MVP Pillars 1-3.

Required footer/description lines:

1. Standard non-affiliation statement.
2. `Roadmap items are planned integration direction unless explicitly marked implemented.`

---

### `documentation/overview/Bringing_Enterprise_Rigor_to_Astronomy_Software.m4a`

Description:

- Quality/governance narrative for engineering maturity and operational trust.

Required footer/description lines:

1. Standard non-affiliation statement.
2. `Deferred features remain roadmap scope and are not presented as shipped functionality.`

---

## Publish Gate Checklist

- [ ] Non-affiliation statement present.
- [ ] Numeric claims appendix link present.
- [ ] Planned integrations labeled as planned.
- [ ] No architecture language contradicting `SCOPE-LOCK.md`.

---

_VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved._
