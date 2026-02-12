# Project Overview

**Cosmic Horizons**: Independent, open-source radio astronomy collaboration portal  
**Status**: MVP Complete (Feb 2026) | Phase 2 Planning  
**Last Updated**: 2026-02-12

## Mission

Ship a focused collaboration layer on public VLASS data, enabling the astronomy community to discover, annotate, and publish observations through community notebooks.

## Affiliation & Philosophy

- **Independent project** using public VLASS data
- **Not affiliated** with VLA, NRAO, or official VLASS program
- **Open source** with public documentation
- **Public domain** astronomy collaboration infrastructure

## MVP Scope (Complete)

**Three Pillars Delivered**:

1. **Pillar 1**: SSR first paint with fast personalized preview (complete)
2. **Pillar 2**: Aladin viewer with shareable permalink state and snapshots (complete)
3. **Pillar 3**: Community notebook posts with revisions (complete)

**MVP Features**:

- Public read-only viewing of VLASS data
- Verified user publishing of observation posts
- Notebook-style documentation
- Site moderation basics (hide/lock posts)

**MVP Explicitly Deferred**:

- Mode B canvas viewer
- FITS proxy/caching (link-out only)
- Comments/replies (v1.1+)
- Rust compute tier (optional)

## Phase 2+ Roadmap (In Planning)

### What Phase 2 Delivers

**1. Platform Reliability**

- Scale web/API under higher read traffic
- API contracts as release artifacts (OpenAPI)
- Security posture transparency (secrets, dependencies, analysis)
- Performance goals as measurable CI gates

**2. Collaboration Expansion**

- Comments/replies with threading
- Advanced moderation flows
- User reputation/trust signals
- Community moderation features

**3. Scientific Integration**

- Astronomy Ephemeris Backend (astronomy-engine based)
- Remote Compute Gateway (TACC/CosmicAI orchestration spike)
- Direct NRAO data source integration

**4. Infrastructure**

- Rust compute tier for GPU-accelerated analysis
- FITS proxy/caching tier
- Mode B viewer canvas

### Phase 2 Out of Scope

- Stack replacement away from Angular SSR + NestJS
- Broad FITS mirroring (infrastructure layer only)
- Machine learning pipelines (CosmicAI integration only)

## Runtime Architecture

```text
Browser
  ↓
Angular SSR App (apps/cosmic-horizons-web)
  ↓
NestJS API (apps/cosmic-horizons-api)
  ↓
Data Layer:
  - PostgreSQL (primary data)
  - Redis (cache, rate-limiting, sessions)
  - VLASS public endpoints (astronomy data)
  
Shared:
  - libs/shared/models (API contracts)
```

## Key Flows

### Authentication

- JWT-based session management
- Verified user identity (email confirmation)
- Admin/moderator roles with privilege separation

### Data Discovery

- Coordinates + field-of-view search
- Survey selection (VLASS, Aladin data)
- Annotation and labeling
- Permalink state encoding

### Publishing

- Create/edit notebook posts
- Revision history and branching
- Publish to community
- Snapshot creation and sharing

### Moderation

- Flag posts for review
- Admin hide/lock capabilities
- Audit logging
- Community guidelines enforcement

## Development Structure

| Component | Role | Status |
|-----------|------|--------|
| cosmic-horizons-web | Angular SSR frontend | Active |
| cosmic-horizons-api | NestJS backend | Active |
| shared/models | Shared TS contracts | Active |
| documentation/ | Architecture & guides | Maintained |

## Quality Gates

**Required CI Gates**:

```bash
# Testing
pnpm nx run-many --target=test --all

# Documentation
pnpm nx run docs-policy:check

# E2E Coverage
pnpm nx run mvp-gates:e2e

# Performance (Lighthouse)
pnpm nx affected --target=lighthouse
```

**Coverage Targets**:

- Statements: 80%+
- Functions: 80%+
- Branches: 75%+
- Lines: 80%+

## See Also

- **Scope Lock**: [SCOPE-LOCK.md](../../SCOPE-LOCK.md)
- **Product Charter**: [PRODUCT-CHARTER.md](../product/PRODUCT-CHARTER.md)
- **Architecture**: [ARCHITECTURE.md](../architecture/ARCHITECTURE.md)
- **Roadmap**: [ROADMAP.md](../planning/roadmap/ROADMAP.md)
- **Quick Start**: [QUICK-START.md](../operations/QUICK-START.md)

---

*Cosmic Horizon Development - (c) 2026 Jeffrey Sanford. All rights reserved.*  
*Independent portal using public VLASS data; not affiliated with VLA/NRAO.*
