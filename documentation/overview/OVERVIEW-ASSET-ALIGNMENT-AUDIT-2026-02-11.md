# Overview Asset Alignment Audit

**Status date:** 2026-02-11  
**Scope audited:**

- `documentation/overview/AI_and_the_Data_Tsunami.mp4`
- `documentation/overview/Architecting_Cosmic_Horizons_for_Sub-Second_Speed.m4a`
- `documentation/overview/Bringing_Enterprise_Rigor_to_Astronomy_Software.m4a`
- `documentation/overview/Steering_the_Twenty_Petabyte_Telescope.m4a`
- `documentation/overview/The_Exascale_Control_Plane.pdf`

**Alignment baselines:**

- `documentation/governance/SOURCE-OF-TRUTH.md`
- `documentation/product/PRODUCT-CHARTER.md`
- `SCOPE-LOCK.md`
- `documentation/product/AFFILIATION.md`
- `documentation/marketing/abstracts/COSMIC-HORIZONS-2026-ABSTRACT-CONTENT-GUIDE.md`

---

## Executive Result

Overall status: **AMBER** (mostly aligned narrative; several claim-governance and one architecture conflict to fix before external-facing use).

High-priority misalignment:

1. `Go microservice` appears in visual roadmap content while `SCOPE-LOCK.md` explicitly removed Go from project scope.
2. Multiple hard numeric ecosystem claims appear without in-asset source/date labels.
3. Some lines imply stronger institutional/production readiness than current governance allows unless explicitly tagged as planning.

---

## Asset-by-Asset Findings

## 1) `AI_and_the_Data_Tsunami.mp4`

Status: **AMBER**

Aligned:

- Human bottleneck framing aligns with planning and marketing docs.
- "Control plane" framing aligns with `AGENTS.md` strategic context.

Needs correction/labeling:

- Numeric claims (for example 240 PB/year, 10,000x compute, 109 TB/4h) need source/date attribution in associated publish metadata.
- Any phrasing that sounds like current operational deployment of AlphaCal should be softened to planning/integration-target language unless externally verified.

Required action:

- Add accompanying claim table (source + date) when publishing this video externally.
- Add non-affiliation line in description/caption.

---

## 2) `Architecting_Cosmic_Horizons_for_Sub-Second_Speed.m4a`

Status: **GREEN**

Aligned:

- Independent/non-affiliated framing appears and matches `documentation/product/AFFILIATION.md`.
- Three-pillar explanation matches product charter and MVP narrative.

Watch item:

- Mentions of future architecture directions should remain explicitly labeled as future/planning.

Required action:

- No content block required; include standard disclaimer in publish notes.

---

## 3) `Bringing_Enterprise_Rigor_to_Astronomy_Software.m4a`

Status: **GREEN-AMBER**

Aligned:

- Strong emphasis on independence, quality gates, and documentation rigor matches governance docs.

Needs correction/labeling:

- Mentions of deferred features (for example Mode B) are acceptable only if clearly framed as not current MVP.

Required action:

- Ensure episode summary says deferred features are roadmap items, not shipped behavior.

---

## 4) `Steering_the_Twenty_Petabyte_Telescope.m4a`

Status: **AMBER**

Aligned:

- Correctly positions conference as strategic milestone and portal as integration layer.

Needs correction/labeling:

- Contains many external factual claims (event logistics, institutional roles, numeric performance context). These should be treated as `verified_external` with date stamps.
- Includes hard timeline references. Keep absolute dates in metadata:
  - Abstract deadline reference: **April 1, 2026**
  - Conference window reference: **July 13-16, 2026**

Required action:

- Add a dated sources list in companion notes before external distribution.

---

## 5) `The_Exascale_Control_Plane.pdf` (15-page slide deck)

Status: **AMBER-RED**

Aligned:

- Overall thesis (portal as front-half operations layer) aligns with planning docs.
- Three-pillar framing is consistent with MVP story.

Conflicts:

1. **Go microservice roadmap callout conflicts with scope lock**
   - Deck references a `Go Microservice` path.
   - `SCOPE-LOCK.md` states Go service was removed from scope.

2. **Hard numeric claims without source/date tags**
   - Storage/throughput/compute values are presented as facts.
   - Governance requires external numerics to be source-dated or softened.

3. **Potential overreach language around AlphaCal/compute readiness**
   - "Docking" and AI loop slides must remain planning/integration-ready phrasing unless official endpoints are confirmed.

Required action:

- Replace `Go Microservice` roadmap wording with one of:
  - `Remote Compute Gateway (Planned)`
  - `Rust Render Sidecar (Deferred)` (if discussing rendering path)
  - `TACC/ACCESS Job Adapter (Planned)`
- Add footer tag on numeric slides: `planning context; values source-dated in references appendix`.
- Add explicit non-affiliation line on title/closing slide or presenter notes.

---

## Required Standard Caption for All External Overview Assets

Use this line verbatim in video descriptions, slide appendix, and talk notes:

`Cosmic Horizon is an independent, public-data-compatible, integration-ready web platform; it is not affiliated with, sponsored by, or operated by VLA/NRAO/VLASS.`

---

## Claim Hygiene Checklist (Release Gate)

Before publishing any of the above assets externally:

- [ ] Non-affiliation statement included.
- [ ] Every hard numeric ecosystem claim has source + date in an appendix/description.
- [ ] Planned integration is labeled as planned (not deployed).
- [ ] Deferred MVP features (Mode B, FITS expansion, remote compute adapters) are labeled deferred/planned.
- [ ] Any architecture references do not contradict `SCOPE-LOCK.md`.

---

## Decision

Internal use: **acceptable now**.  
External conference/submission use: **apply corrections above first**, especially the PDF roadmap architecture wording and source-dating of numeric claims.

---

_Cosmic Horizon Development - (c) 2026 Jeffrey Sanford. All rights reserved._
