# OVERVIEW V2

Status date: 2026-02-08

## Objective

Version 2 extends the MVP portal into a credible research collaboration platform while keeping the SSR + viewer + notebook foundation stable.

## V2 Outcomes

1. Reliable scale path for viewer and API under higher read traffic.
2. Contract-driven backend delivery with published OpenAPI artifacts.
3. Production-grade security and supply-chain automation.
4. Review-ready product narrative for technical stakeholders and recruiters.

## Scope Themes

## 1. Viewer and Data Experience

- Introduce Mode B as an explicitly opt-in advanced viewer track.
- Add richer coordinate/object jump presets and session restore polish.
- Keep FITS policy explicit: link-out by default, controlled passthrough only when approved.

## 2. Collaboration Features

- Add comments/replies with moderation controls.
- Expand notebook revision UX (diff readability, audit clarity).
- Improve permalink durability and backward compatibility.

## 3. Platform and API

- Publish OpenAPI on every CI run and attach artifact to builds.
- Add versioned API contract checks before merge.
- Strengthen caching strategy for high-frequency viewer endpoints.

## 4. Security and Operations

- Enforce secret hygiene (`.env*.local` ignored, secret scanning active).
- Run Dependabot + CodeQL continuously.
- Add vulnerability response process (`SECURITY.md`) and ownership (`CODEOWNERS`).

## 5. Performance Proof

- Run Lighthouse mobile CI and persist reports as artifacts.
- Keep SSR and viewer budget checks in E2E gates.
- Track regressions with explicit thresholds instead of informal targets.

## Delivery Plan

1. `v2.0-foundation`
- Security automation baseline (Dependabot, CodeQL, secret scanning).
- OpenAPI generation + artifact publication.
- Documentation refresh (`ENV`, `DEMO`, architecture diagram).

2. `v2.1-collaboration`
- Comments/replies and moderation flows.
- Notebook revision UX pass.
- Additional integration tests around post lifecycle.

3. `v2.2-viewer-advanced`
- Mode B rollout behind feature flag.
- Controlled FITS passthrough evaluation.
- Performance tuning for advanced rendering path.

## Non-Goals

- Reintroducing broad FITS mirroring in V2.
- Replacing Angular/Nest stack.
- Premature microservice split without measured bottlenecks.

## Exit Criteria

- CI badges green for build, lint, unit, and E2E.
- OpenAPI artifact generated on pull requests.
- Lighthouse mobile report published per PR.
- Demo path in `documentation/DEMO.md` reproducible by a new reviewer in under 3 minutes.
