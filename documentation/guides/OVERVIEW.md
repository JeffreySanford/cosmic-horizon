# VLASS Sky Portal: Project Overview

## Mission

Build a VLASS-only, public-data-only sky exploration platform that:

- Gives a fast, polished SSR first paint (especially on landing/login) with an "overhead VLASS" background for the user's region
- Provides a full interactive sky viewer with a Day-1 switcher between:
  - **Mode A**: HiPS-native viewer (Aladin Lite integration)
  - **Mode B**: "Native" canvas viewer (good-enough first; bones for accuracy later)
- Adds a community research layer where users can publish Markdown + images + embedded viewer blocks (Notion-style), with revision history, curated tags, and auto-generated snapshot artifacts
- Enforces strict guardrails: no proprietary data, no "mirror-like" behavior, bounded proxy caching, verified users unlock higher quotas, auditable actions with 90-day retention
- Is built to our standards: Angular SSR with Material 3, no standalone components, RxJS hot observables as the async model, WebSockets for audit/ops/jobs streams, TDD-first with tests gating the build

## What Users Can Do

### Anonymous (Public Read-Only)

- See a high-quality landing page immediately (SSR)
- Opt-in location (browser) or enter city/state to personalize "regional overhead" background
- Browse lightly in the viewer (severely rate-limited; shallow zoom; PNG only)
- Read community posts (public)

### Verified User

- Full viewer usage (within quotas)
- Save views
- Publish community posts (Markdown + viewer blocks + images)
- Comment on posts
- Generate snapshots and attach to posts
- Access higher-depth tiles and (optionally) FITS through controlled endpoints and quotas

### Power

- Everything a user can do, plus:
  - Propose new curated tags (governed flow)

### Moderator

- Moderate community: hide/unhide posts, lock/unlock comments, "needs sources" tagging
- Review tag proposals
- Review and action reports

### Admin

- Full ops: manage users/roles, inspect audit logs, manage cache policy thresholds
- Ban/quarantine controls and anti-crawl enforcement knobs
- Upstream health metrics monitoring

## Data Sources

Building around public VLASS products:

- **HiPS browsing layers** (MedianStack default)
- **Quick Look images** (ideal for SSR previews)
- **Optional**: metadata search (TAP) as "advanced discovery," always linking users back to official access tooling for downloads

**Critical**: All endpoint URLs should live only in server env and be emitted to the client via a sanitized public config endpoint.

## Architectural Overview (Nx Monorepo)

### Apps

- **apps/vlass-web** — Angular SSR + Material 3 UI
- **apps/vlass-api** — NestJS Backend-for-Frontend (BFF)
- **apps/vlass-go** — Go microservice (manifest + preview compositor + cache engine)

### Shared Libraries

- **libs/shared/models** — versioned DTOs and contracts (single source of truth)
- **libs/shared/rx-transport** — WebSocket envelope, topics, correlation IDs
- **libs/server/*** — auth/RBAC/audit/rate-limit/proxy/cache/community/ws
- **libs/ui/*** — module-based UI components and feature modules (no standalone)
- **libs/data-access/*** — Angular services emitting hot streams
- **libs/policy/*** — allowlists, limits, redaction rules, anti-crawl heuristics

## Runtime Boundaries (Clean Separations)

- **Angular** never calls upstream sources directly (except Mode A if you explicitly allow direct-to-upstream for HiPS tiles)
- **NestJS** is the policy choke point: auth, rate limits, audit, allowlist enforcement
- **Go** service does performance work: tile manifests, preview compositing, caching, and later improved projection/WCS

## Guardrails and "Don't Get Me in Trouble" Posture

### 1. Proxy is Not a Mirror

Your proxy/cache must behave like a bounded performance cache:

- On-demand only
- Hard size caps
- TTL enforcement
- Concurrency caps
- Anti-crawl detection
- Upstream allowlist only
- Circuit breaker on upstream failures

### 2. Public-Only Data

- Any non-public upstream behavior is rejected by design
- Advanced archive metadata search (if enabled) is metadata-only and links users to official tooling for downloads (not your proxy)

### 3. Location Privacy

- SSR personal background only after user opts in (browser location) or manual entry
- Store coarse location (rounded/geohash low precision) in signed cookie
- Never store raw lat/lon by default
- Audit logs redact location

### 4. Verification Gating

Unverified accounts are throttled and feature-limited:

- Cannot publish/comment
- No FITS access
- Lower zoom / lower rate limits

Verified unlocks normal quotas.

### 5. Community Safety

- No FITS uploads in v1
- Images only (PNG/JPG), size-capped, EXIF stripped
- Reports + moderation queue + audit trail for every action
