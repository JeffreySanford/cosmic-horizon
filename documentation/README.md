# Documentation Map

Status date: 2026-02-10

## Entry Points

- Repository overview: `README.md`
- Docs overview (current architecture and status): `documentation/index/OVERVIEW-V2.md`
- Product charter and scope lock: `documentation/product/PRODUCT-CHARTER.md`, `SCOPE-LOCK.md`
- Target resolution & ephemeris architecture: `documentation/architecture/TARGET-RESOLUTION-EPHEMERIS.md`

## Folder Layout

- `documentation/index/` - high-level overview docs
- `documentation/product/` - charter and project identity
- `documentation/architecture/` - runtime architecture, viewer strategy, protocol notes
- `documentation/frontend/` - frontend architecture, controls, styling, error handling
- `documentation/backend/` - API/auth/rbac/rate-limit/cache/backend design
- `documentation/database/` - schema, migrations, TypeORM setup, SQL bootstrap/seed
- `documentation/security/` - hardening, guardrails, audits, privacy/retention
- `documentation/community/` - community moderation and collaboration model
- `documentation/operations/` - environment config, quick start, demo, runtime logging
- `documentation/quality/` - coding standards, testing strategy, test matrix
- `documentation/governance/` - source-of-truth policy and status scorecard
- `documentation/planning/roadmap/` - roadmap timeline
- `documentation/planning/phases/` - Phase 2/3 planning docs
- `documentation/planning/funding/` - funding and cost model
- `documentation/planning/releases/` - release notes
- `documentation/marketing/` - abstracts, outreach letters, and proposal scope docs
- `documentation/reference/` - datasets and OpenAPI artifacts
- `documentation/adr/` - architecture decision records
- `documentation/setup/` - local docker/bootstrap setup

## Architecture & Design

- **START HERE**: `documentation/architecture/EPHEMERIS-SUMMARY.md` - Overview of Mars/Venus/Jupiter search and scope decision
- `documentation/architecture/TARGET-RESOLUTION-EPHEMERIS.md` - Technical planetary search resolver design and v1.1 ephemeris roadmap
- `documentation/architecture/EPHEMERIS-SCOPE-DECISION.md` - Detailed scope analysis: MVP vs. Phase 2 scientific implementation
- `documentation/architecture/MARS-RESOLUTION-DEBUGGING.md` - Troubleshooting guide for planet search issues

## Fast Path

- Start environment: `documentation/operations/QUICK-START.md`
- Configure runtime: `documentation/operations/ENVIRONMENT-CONFIG.md`
- Review architecture (technical): `documentation/architecture/TECHNICAL-ARCHITECTURE.md`
- Review architecture (deep dive): `documentation/architecture/ARCHITECTURE.md`
- Review auth and roles: `documentation/backend/AUTH-VERIFICATION.md`, `documentation/backend/RBAC-ROLES.md`
- Review seeding behavior: `documentation/database/SEEDING-OPERATIONS.md`
- Start conference/proposal materials: `documentation/marketing/README.md`
- Viewer controls & target search: `documentation/frontend/VIEWER-CONTROLS.md` + `documentation/architecture/TARGET-RESOLUTION-EPHEMERIS.md`
