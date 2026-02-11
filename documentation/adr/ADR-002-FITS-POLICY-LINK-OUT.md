# ADR-002: FITS Access Policy — Link-Out (MVP)

## Date

2026-02-11

## Status

ACCEPTED

## Context

VLASS Portal users want FITS data access. Three models exist:

### A) Link-Out (No Proxy) - MVP choice

- Portal resolves user request → NRAO endpoint

- User clicks "Open NRAO FITS" (new tab)

- We audit the click, not the byte transfer

- Cost: $0, Liability: minimal, Scope: lean

- Compliance: No redistribution, no cache, no abuse surface

### B) Controlled Pass-Through (v2, Feature-Flagged)

- Portal proxies FITS from NRAO

- Requires NRAO written approval + quota/cache discipline

- Cost: egress fees, Liability: medium, Scope: moderate

- **Prerequisite:** Written NRAO confirmation (deferred to v2)

### C) Generate as Mini-FITS (v2+)

- Extract + reproject on demand

- Full control but compute-heavy

- Scope: not MVP

## Decision

**Adopt Model A (Link-Out)** for MVP to ship fast and risk-free.

Model B is deferred and feature-flagged OFF until NRAO approval is obtained (v2).

---

## MVP FITS Access Flow

### What Users See

```text
[Viewer] → [Download FITS button]
↓
Modal: "Open FITS from NRAO"
↓
Button 1: "Open NRAO Archive" (new tab)
Button 2: "Copy NRAO Link"

```

### Technical Flow

```text
POST /api/v1/fits/resolve
{
  "center": { "raDeg": 187.7, "decDeg": 12.39 },
  "fovDeg": 0.5,
  "epoch": "MedianStack"
}
↓
Response:
{
  "mode": "LINK_OUT",
  "urls": [
    {"label": "NRAO Archive", "url": "https://archive.nrao.org/vlass/..."}
  ],
  "notes": [
    "Opens NRAO in new tab",
    "Availability subject to NRAO"
  ]
}
↓
Client → opens NRAO URL in new tab
Audit log → { action: "FITS_LINK_OUT", target: { ra, dec, epoch }, status: OK }

```

---

## Implementation Rules

### 1. Allowlist Only

Only NRAO endpoints allowed. Stored in config:

```typescript
// config/fits-endpoints.config.ts

export const FITS_ENDPOINTS = {
  MedianStack:
    'https://archive.nrao.org/vlass/data/Public/ql_rms/{hpx_id}.fits',
  QA: 'https://archive.nrao.org/vlass/qa/...',
};

// Validate resolver output against this list (no open proxying)

```

### 2. Rate Limiting (on resolve, not transfer)

Since portal doesn't serve bytes, only limit resolver abuse:

```typescript
FITS_RESOLVE_LIMITS = {
  ANON: '10 calls/min',
  VERIFIED: '50 calls/min',
  POWER: 'unlimited',
};

```

### 3. Audit Logging

What we log:

```typescript
{
  action: "FITS_LINK_OUT",
  actor_id: user?.id || "anonymous",
  target: { ra, dec, epoch },
  resolved_host: "archive.nrao.org",  // Host only (not full URL)
  timestamp: new Date(),
}

```

What we **do NOT** log:

- Full NRAO URLs (avoid internal path leakage)

- Downstream transfer outcome (can't see what users downloaded—they left our portal)

### 4. Error Handling

If resolver fails:

```typescript
return {
  mode: 'LINK_OUT',
  urls: [
    {
      label: 'NRAO Archive (Search)',
      url: 'https://archive.nrao.org/search',
    },
  ],
  notes: [
    'Archive resolver temporarily unavailable. Please search NRAO directly.',
  ],
};

```

---

## Rationale

### Why A (Link-Out) for MVP

- ✅ **Zero compliance requirement** — We're just a UI pointer, not a redistributor

- ✅ **Zero bandwidth cost** — No data flows through our platform

- ✅ **Zero abuse surface** — No cache, no quota system, no proxy logic

- ✅ **Ship fast** — No NRAO approval dependency

- ✅ **Honest product** — "Viewer + community + link to FITS"

### Why NOT B (Passthrough) in MVP

- ❌ Requires NRAO written approval (blocks launch)

- ❌ Adds caching + quota enforcement complexity

- ❌ Bandwidth cost + operational burden

- ❌ Becomes a redistributor (higher liability)

### Why NOT C (Generate)

- WCS math + reprojection is v2+ scope

- Option A is sufficient for MVP (power users can reproject locally if needed)

---

## Consequences

### Positive

- ✅ Ship MVP **without NRAO approval dependency**

- ✅ **Zero hosting cost** for FITS

- ✅ **Cannot become a mirror** (no data stored)

- ✅ **Honest positioning:** "Viewer + community + link to FITS"

### Negative

- ⚠️ Users must open NRAO in new tab (slight UX friction)

- ⚠️ Cannot serve in-app FITS downloads

### Mitigation

- **UX:** Make button prominent and clear ("Opens NRAO in new tab")

- **Future:** If users demand in-app FITS, v2 adds Model B behind feature flag (after NRAO approval)

- **Message:** "FITS data hosted by NRAO; portal provides fast preview + research context"

---

## Related Decisions

- **ADR-004:** Three-tier architecture (no FITS caching in NestJS tier)

- **HIPS-PIPELINE.md:** Viewer preview works stand-alone; FITS is optional exit hatch

- **AUTH-VERIFICATION.md:** Rate limits on resolve endpoint only (not FITS transfer)

---

## Future: v2 (Model B, Feature-Flagged)

If in-app FITS is requested:

1. Create **ADR-002-v2** (Controlled Pass-Through)

2. Obtain **written NRAO confirmation** on:

   - Caching policy (7-day TTL, 50GB cap OK?)

   - Concurrency limits (max connections)

   - Attribution/citation language

   - Canonical FITS endpoints to use

3. Implement:

   - Redis cache layer

   - Per-user quotas (NestJS guard)

   - Circuit breaker for upstream failures

4. Feature flag: `FITS_PROXY_ENABLED=false` (default)

5. Once approved + tested: flip to `true` in production

Until then: **Link-out only** keeps MVP lean and shippable.

---

**Owner:** Product + Arch
**Approval Status:** ✅ Accepted for MVP (Model A)
**Next Gate:** v2 requires NRAO confirmation (Model B)
**Review Date:** 2026-06-06 (user feedback on link-out UX)

---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
