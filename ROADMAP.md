# Project Roadmap

**Cosmic Horizons Collaboration Platform**  
**Status**: MVP Enhanced (Feb 2026) → Phase 2 Planning  
**Last Updated**: 2026-02-13  

## Vision

Enable the astronomy community to discover, annotate, and publish observations through a fast, accessible collaboration platform built on public VLASS data.

**Canonical Reference**: [SCOPE-LOCK.md](../SCOPE-LOCK.md) + [PRODUCT-CHARTER.md](documentation/product/PRODUCT-CHARTER.md)

---

## Timeline Overview

```text
2025 Q4          2026 Q1          2026 Q2-Q3       2026 Q4+
MVP Release  →  MVP Hardening  →  Phase 2 Pillar  →  Phase 3
(Feb 2026)      & Phase 2        Infrastructure    (v2.0)
                Prep               Rollout
```

---

## Phase 1: MVP Release ✅ COMPLETE

**Status**: Released Feb 2026  
**Scope**: Three core pillars

### Pillar 1: SSR Web Experience ✅

- Angular SSR first paint with personalized data preview
- Responsive design optimized for mobile + desktop
- Performance target: <2.5s FCP, <100ms TBT (Lighthouse)

### Pillar 2: Sky Viewer & Datasets ✅

- Aladin.js viewer with VLASS data integration
- Shareable permalink state & snapshot export
- Multi-survey support (VLASS, public Aladin instances)

### Pillar 3: Community Notebooks ✅

- Markdown-based post publishing
- Revision history and branching
- Community moderation (hide/lock)

**MVP Explicitly NOT In Scope**:

- Mode B canvas viewer (v2)
- FITS proxy/mirroring (v2)
- Comments/threading (v1.1)
- ML-assisted analysis (v2)

---

## Phase 2: Platform Hardening (v1.1) - Q1 2026

**Focus**: Reliability, API governance, security visibility

### Sprint 1: Type Safety & Code Quality ✅

- Test builder infrastructure (CommentBuilder, PostBuilder, etc.)
- Mock factory utilities for reusable test data
- Strict TypeScript configuration (zero `any` types)
- **Status**: 1268/1268 tests passing (100%), 82.5% coverage

### Sprint 2: Scientific Integration ✅

#### Ephemeris Backend (Weeks 3-6)

- astronomy-engine integration for position/elevation calculations
- NestJS `/api/view/ephem` endpoint
- Redis caching (24h TTL)
- JPL Horizons fallback for asteroids
- Performance: <500ms p95 latency
- **Status**: Complete with E2E validation

#### Comments & Threading ✅

- Parent-child comment relationships
- Threaded UI with recursive rendering
- Comment reporting and moderation
- Rate limiting & anti-spam
- **Status**: Backend + frontend complete

### Sprint 3: Operational Hardening ✅

- User profile pages & community linking
- Comment moderation dashboard
- Admin audit logging
- TACC integration spike (simulated)
- Login UX enhancement (improved error feedback)
- Ephemeris feature polish and frontend validation
- **Status**: All features complete (Feb 2026)

### Sprint 4: E2E Coverage & Cleanup ✅

- Production-quality e2e test infrastructure
- Code coverage reporting (Playwright + Jest)
- Documentation consolidation
- Linting & quality gate fixes
- **Status**: Complete (Feb 2026)

---

## Phase 2 Extended (v1.2): Remote Compute Gateway - Q2 2026

**Focus**: TACC integration, job orchestration, autonomous agents

### Sprint 1: Integration Foundation ✅

- TACC simulated service scaffold
- Job submission & status monitoring
- Job audit trail (lifecycle tracking)
- Error handling & retry strategies
- **Status**: 159 new tests, 100% passing

### Sprint 2: Real Gateway Connectivity (Q2 2026)

- [ ] TACC Slurm/Tapis API integration
- [ ] Credential management & security hardening
- [ ] Persistent job audit trail in PostgreSQL
- [ ] Performance monitoring & metrics

### Sprint 3: Explainable Results (Q2 2026)

- [ ] Link AI outputs to Aladin snapshots
- [ ] Agent performance dashboards
- [ ] Result provenance tracking

**Strategic Value**: Enables autonomous AI agents (AlphaCal, ImageReconstruction, AnomalyDetection) at ngVLA scale (7.5-8 GB/s data rate)

---

## Phase 3: Event Infrastructure & Scalability - Q2-Q3 2026

**Focus**: Real-time updates, multi-user coordination, scale infrastructure

### Priority 5: Event Streaming Infrastructure

- [ ] RabbitMQ cluster setup (3-node)
- [ ] Kafka integration with Schema Registry
- [ ] NestJS event handlers
- [ ] Dead Letter Queue patterns
- Target: 1000+ events/second, sub-100ms latency

### Priority 6: Real-Time Dashboards

- [ ] WebSocket server for live collaboration
- [ ] Notification service for events
- [ ] Client-side state synchronization
- [ ] Multi-user conflict resolution

### Priority 7: Scale Hardening

- [ ] Database replication & failover
- [ ] Redis cluster for cache
- [ ] API rate limiting & quotas
- [ ] Load testing at scale

---

## Phase 4: v2.0 - NRAO Ecosystem Integration - Q3-Q4 2026

**Focus**: Integration readiness and potential collaboration pathways with NRAO/VLA infrastructure

### Data Sources

- [ ] Direct NRAO data portal integration
- [ ] Proposal/observation metadata linking
- [ ] Data quality flags and curation

### Infrastructure

- [ ] FITS proxy/caching tier (Rust optional)
- [ ] Mode B canvas viewer (GPU-accelerated)
- [ ] Advanced rendering engine

### Compliance

- [ ] NRAO audit trail requirements
- [ ] Publication workflow integration
- [ ] Data retention policies

---

## Explicitly Deferred (v2+)

**Will NOT Be Implemented in Phase 2**:

- Mode B canvas viewer (requires FITS proxy infrastructure)
- Broad FITS mirroring (storage infrastructure)
- Stack replacement away from Angular + NestJS
- Kubernetes orchestration (scale to this later)
- GraphQL API (REST API sufficient for MVP)
- Microservices decomposition (monolith serving well)

**Deferred Pending Assessment**:

- Direct ML/AI pipeline execution (depends on CosmicAI maturity)
- Proprietary compute providers (TACC first, then expand)
- Official NRAO branding/integration (after Symposium 2026)

---

## Key Metrics & Gates

### Release Quality Gates

```bash
# All merges must pass:
pnpm nx run-many --target=test --all      # 1268+ tests
pnpm nx run docs-policy:check              # Doc consistency
pnpm nx run mvp-gates:e2e                  # E2E critical paths
pnpm nx affected --target=lighthouse       # Performance
```

### Coverage Targets

| Metric | Minimum | Current |
|--------|---------|---------|
| Statements | 80% | 82.5% |
| Functions | 80% | 74.8% |
| Branches | 75% | 61.8% |
| Lines | 80% | 82.5% |

### Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| FCP | 2.5s | ✅ |
| TBT | 100ms | ✅ |
| Ephemeris p95 | 500ms | ✅ |
| Events/sec | 1000+ | 📋 Phase 3 |

---

## Documentation Structure

| Document | Scope |
|----------|-------|
| [SCOPE-LOCK.md](SCOPE-LOCK.md) | What's in/out (canonical) |
| [PRODUCT-CHARTER.md](documentation/product/PRODUCT-CHARTER.md) | Product vision & strategy |
| [ARCHITECTURE.md](documentation/architecture/ARCHITECTURE.md) | System design & components |
| [Project Overview](documentation/index/OVERVIEW.md) | Current status & features |
| [Testing Strategy](documentation/quality/TESTING-STRATEGY.md) | Test layers & quality gates |
| [E2E Coverage Guide](documentation/quality/E2E_CODE_COVERAGE_GUIDE.md) | Coverage testing infrastructure |
| [Quick Start](documentation/operations/QUICK-START.md) | Local development setup |

---

## Success Criteria

**Phase 2 Complete** when:

- ✅ All 1268+ tests passing
- ✅ Coverage ≥80% statements, ≥75% branches
- ✅ TACC integration spike complete
- ✅ All production warnings/errors fixed
- ✅ Documentation consolidated & consistent
- ✅ E2E coverage infrastructure operational

**Symposium 2026 Ready** (Charlottesville, April 2026):

- Stable v1.1 in staging
- TACC integration demonstrated
- Peer-reviewed paper submitted
- Community feedback integrated

---

## How to Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, branch strategy, and PR requirements.

**Key Resources**:

- [Testing Guide](documentation/guides/TESTING_GUIDE.md) - Type-safe test infrastructure
- [Development Quick Start](documentation/operations/QUICK-START.md) - Local setup
- [API Routes](documentation/backend/API-ROUTES.md) - Endpoint reference (if exists)

---

## Related Topics

- **Funding**: Supported by NSF-Simons CosmicAI initiative
- **Symposium**: Cosmic Horizons Conference 2026, April 1 abstract deadline
- **Affiliation**: Independent open-source project, not official VLA/NRAO
- **Data**: Public VLASS survey data, public Aladin instances

---

*Last Updated: February 12, 2026*  
*Cosmic Horizon Development - (c) 2026 Jeffrey Sanford. All rights reserved.*  
*Independent portal using public VLASS data; not affiliated with VLA/NRAO.*
