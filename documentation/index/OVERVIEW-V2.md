# Overview V2

Status date: 2026-02-08
Scope anchor: `documentation/product/PRODUCT-CHARTER.md` + `SCOPE-LOCK.md`

## System Narrative

Cosmic Horizon V2 evolves the MVP into a credible public-domain astronomy collaboration platform: fast SSR entry, interactive sky exploration, and notebook-style community publishing with stronger operational guardrails.

Affiliation boundary:

- This repository is independent public-domain engineering work using public radio astronomy data.

- It is not an official VLA, NRAO, or VLASS product.

## What V2 Must Deliver

1. Scale the web/API path under higher read traffic without regressing MVP behavior.

2. Treat API contracts as release artifacts (OpenAPI generated and validated in CI).

3. Make security posture visible (secrets hygiene, dependency automation, static analysis).

4. Turn performance goals into measurable CI gates (not informal targets).

## Scope In / Out

In scope:

- Collaboration expansion (comments/replies + moderation flows).

- API contract governance and reliability/caching hardening.

- Scientific Ephemeris Backend (astronomy-engine based).

- Remote Compute Gateway (TACC/CosmicAI job orchestration spike).

Out of scope:

- Mode B viewer (deferred to v2).

- Broad FITS mirroring/proxy tier (deferred to v2).

- Stack replacement away from Angular SSR + NestJS.

## Architecture Snapshot

```text
Browser
  -> Angular SSR app (apps/cosmic-horizons-web)
    -> NestJS API (apps/cosmic-horizons-api)
      -> PostgreSQL (primary data)
      -> Redis (cache/rate-limit support)
      -> External astronomy sources (public VLASS/NRAO ecosystem endpoints)

Shared contracts:
  -> libs/shared/models

```

Primary paths:

- Auth + route protection.

- Viewer state encoding/permalink/snapshot/cutout flows.

- Notebook post + revision + moderation flows.

## V2 Pillar Data Flows

### 1) Viewer and Data Experience

Inputs:

- Coordinates, FOV, survey, labels/grid toggles, permalink IDs.

Processing:

- SSR shell render, client hydration, viewer initialization.

- API lookup/cutout/snapshot endpoints with cache-aware behavior.

Outputs:

- Interactive sky view, durable permalink, exportable snapshot/cutout metadata.

Failure modes:

- Upstream data instability, cache misses, provider timeouts.

- Required behavior: graceful fallback messaging and no SSR crash.

### 2) Collaboration

Inputs:

- Markdown notebook content, viewer blocks, comment/reply payloads.

Processing:

- Post/revision validation, moderation policies, audit-safe state transitions.

Outputs:

- Rendered posts, revision history, moderation state visibility.

Failure modes:

- Revision conflicts, moderation race conditions, malformed viewer blocks.

### 3) Platform/API

Inputs:

- OpenAPI generation, CI checks, dependency/security scanner outputs.

Processing:

- Contract artifact publication and diff checks per pull request.

- Security automation and policy checks.

Outputs:

- Build artifacts, contract artifacts, machine-readable quality signals.

Failure modes:

- Contract drift, CI blind spots, unbounded dependency risk.

## Performance Contract

V2 performance is enforced with explicit budgets:

- SSR budget: maintain fast first paint path and avoid SSR blocking by viewer logic.

- Lighthouse mobile CI: publish reports as build artifacts for trend tracking.

- E2E quality gates: keep SSR and viewer critical paths green.

Required CI signals:

1. Build

2. Lint

3. Unit tests

4. E2E

5. Lighthouse mobile report artifact

## Observability & Logging

- End-to-end logging is live-streamed to `/logs` with sortable/filterable Material table and level tiles.

- Back-end emits request/response logs (duration, status, bytes, user metadata, correlation ID), viewer cache events (Redis/memory hits/misses/sets, payload sizes, TTL), and gateway/health events.

- Front-end logs UI actions and HTTP calls with sizes; correlation ID `272762e810cea2de53a2f` ties hops together.

- Admin API: `GET /api/admin/logs` (paged feed) and `GET /api/admin/logs/summary` (tile counts).

- Storage: in-memory buffer by default; optional Redis list for durability. Runtime logs are never committed; see `documentation/operations/LOGGING.md`.

## Security and Compliance Guardrails

- `.env*.local` remains local-only and ignored; `.env.example` is canonical.

- `*.log` files are runtime artifacts and must not be versioned.

- Secret scanning, Dependabot, and CodeQL remain enabled and monitored.

- `SECURITY.md` defines reporting flow; `CODEOWNERS` defines ownership expectations.

## Delivery Plan

### `v2.0-foundation`

- Security automation baseline and CI signal hardening.

- OpenAPI generation + artifact publication + contract diff checks.

- Documentation baseline refresh (`ENV-REFERENCE`, `QUICK-START`, architecture, runbooks).

### `v2.1-collaboration`

- Comments/replies with moderation and audit coverage.

- Revision UX improvements and lifecycle tests.

### `v2.2-scientific-edge`

- Scientific Ephemeris Backend (Astropy) integration.

- Coordinate precision calibration tests.

- Performance tuning and regression checks for celestial targets.

## Risks and Mitigations

1. Upstream availability/rate limits:

- Mitigation: retries, fallbacks, explicit user messaging, cache tuning.

2. SSR performance drift:

- Mitigation: CI budgets + Lighthouse artifacts + targeted perf tests.

3. Security drift in public repo:

- Mitigation: automation (CodeQL/Dependabot/secret scanning) + clear ownership.

4. Documentation drift:

- Mitigation: docs policy checks and source-of-truth linking.

## Doc Map

- Charter and scope: `documentation/product/PRODUCT-CHARTER.md`, `SCOPE-LOCK.md`
- Agent operating and strategic control-plane context: `AGENTS.md`
- Phase 3 CosmicAI federation strategy: `documentation/planning/phases/PHASE-3-COSMICAI-FEDERATION.md`

- Current architecture: `documentation/architecture/ARCHITECTURE.md`

- Tri-broker reference pattern (RabbitMQ + Kafka + Pulsar): `documentation/architecture/NGVLA-TRI-BROKER-REFERENCE-ARCHITECTURE.md`

- CosmicAI integration docking model: `documentation/architecture/COSMICAI-INTEGRATION-OVERLAY.md`

- Environment contract: `documentation/reference/ENV-REFERENCE.md`

- Demo flow: `documentation/operations/QUICK-START.md`

- Roadmap: `documentation/planning/roadmap/ROADMAP.md`

- Active tasks: `TODO.md`

## Exit Criteria

- CI gates green for build, lint, unit, and E2E.

- OpenAPI artifact generated in CI and available for PR review.

- Lighthouse mobile report generated per CI run.

- `documentation/operations/QUICK-START.md` reproducible by a new reviewer in under 3 minutes

---

*Independent portal using public VLASS data; not affiliated with VLA/NRAO.*

*Cosmic Horizon Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
