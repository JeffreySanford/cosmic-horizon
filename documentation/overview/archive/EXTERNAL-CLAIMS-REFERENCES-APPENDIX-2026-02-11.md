# External Claims References Appendix

**Status date:** 2026-02-11  
**Applies to:** overview deck/audio/video assets in `documentation/overview/`

---

## Purpose

Track source-dated references for external numeric claims used in overview assets.

Classification tags:

- `verified_external`: source located and dated.
- `planning_hypothesis`: directional planning claim; no stable external source confirmed yet.

---

## Claim Table

| Claim in assets                                                    | Status                | Source(s)                                                                                                                  | Notes for publishing                                                           |
| ------------------------------------------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ngVLA has `244` main antennas + `19` short-baseline antennas       | `verified_external`   | `https://ngvla.nrao.edu/page/faq` (accessed 2026-02-11)                                                                    | Keep exact wording aligned to FAQ naming.                                      |
| Frequency coverage `1.2-116 GHz`                                   | `verified_external`   | `https://ngvla.nrao.edu/page/faq` (accessed 2026-02-11)                                                                    | Keep as capability/plan context, not operational today claim.                  |
| Imaging compute requirement around `60 PFLOPS` (or `50-60 PFLOPS`) | `verified_external`   | `https://ngvla.nrao.edu/page/faq` (accessed 2026-02-11)                                                                    | Use "compute model estimates" wording.                                         |
| Cosmic Horizons 2026 dates `July 13-16, 2026`                      | `verified_external`   | `https://www.cosmicai.org/events/cosmic-horizons-conference-2026` (accessed 2026-02-11)                                    | Keep conference logistics date-stamped.                                        |
| Abstract deadline `April 1, 2026`                                  | `verified_external`   | `documentation/marketing/abstracts/COSMIC-HORIZONS-2026-SUBMISSION-PLAYBOOK.md` + conference channels re-check requirement | Re-verify on official submission page at time of upload.                       |
| ngVLA annual archive/data growth `240 PB/year`                     | `planning_hypothesis` | Strategic context in `AGENTS.md`; no authoritative source confirmed in this audit                                          | Keep as planning estimate; avoid hard-fact phrasing unless externally sourced. |
| Data rate `128 GB/sec`                                             | `planning_hypothesis` | Appears in deck visuals; no authoritative source confirmed in this audit                                                   | Label as scenario estimate or remove from external-facing deck.                |
| Single 4-hour observation `~109 TB`                                | `planning_hypothesis` | Appears in deck/media narration; no authoritative source confirmed in this audit                                           | Keep only with "planning estimate" qualifier.                                  |
| `10,000x` compute increase vs legacy systems                       | `planning_hypothesis` | Appears in deck/media narration; no authoritative source confirmed in this audit                                           | Prefer "orders-of-magnitude increase" unless cited.                            |

---

## Required Usage Rule

If a claim row is `planning_hypothesis`, assets must use softened language:

- `estimated`, `planning context`, `scenario`, or `order-of-magnitude`.

Do not present `planning_hypothesis` rows as settled institutional fact.

---

## Related Governance

- `documentation/governance/SOURCE-OF-TRUTH.md`
- `documentation/governance/EXTERNAL-RESEARCH-WORKFLOW.md`
- `documentation/marketing/abstracts/COSMIC-HORIZONS-2026-ABSTRACT-CONTENT-GUIDE.md`

---

_VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved._
