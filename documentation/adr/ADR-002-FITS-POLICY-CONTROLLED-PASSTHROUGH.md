# ADR-002: FITS Access Policy — Controlled Pass-Through

## Date

2026-02-11

## Status

ACCEPTED

## Context

VLASS Portal users need FITS data access. Three models are possible:

### A) Link-Out (No Proxy)

- We don't proxy FITS at all

- User clicks "Download from NRAO"

- We audit the click, not the transfer

- Cost: >$0, Liability: $0, Scope: minimal

### B) Controlled Pass-Through (Proxy + Rate Limit)

- We proxy FITS from NRAO endpoints

- Enforce user quotas + rate limits

- Cache briefly to avoid hammering upstream

- Cost: moderate (egress), Liability: medium (if we misbehave), Scope: moderate

### C) Generate Snapshots as Mini-FITS

- Extract tile subsets, reproject, emit as FITS

- Full control, but massive compute + WCS math

- Scope: v2+

Current design assumes B. But B requires:

- Explicit contractual alignment with NRAO (ToS compliance)

- Proxy discipline (not a mirror, not unlimited bandwidth)

- Per-user quota enforcement

## Decision

**Adopt Model B (Controlled Pass-Through)** with explicit guardrails:

### 1. NRAO Compliance Posture

- Before MVP launch, VLASS team will have **written confirmation** from NRAO that:

  - (a) Proxying public FITS data is permitted under their distribution license

  - (b) We understand upstream bandwidth limits and will respect them

  - (c) We have identified the canonical FITS endpoints (which epochs, which archive structure)

- Store confirmation in `docs/NRAO-COMPLIANCE.md` (git-tracked, not code)

### 2. Access Control

```typescript
// User tier determines FITS quota
type FitsQuota = {
  dailyGBLimit: number;
  maxFileSizeGB: number;
  maxConcurrentDownloads: number;
  cacheIfUnderGB: number; // Only cache small files
};

// Quotas by tier
FITS_QUOTAS = {
  ANON: { dailyGBLimit: 0, maxFileSizeGB: 0, ... },                    // No access
  UNVERIFIED: { dailyGBLimit: 0, maxFileSizeGB: 0, ... },             // No access
  VERIFIED: { dailyGBLimit: 10, maxFileSizeGB: 5, maxConcurrent: 2, ... },
  POWER: { dailyGBLimit: 100, maxFileSizeGB: 50, maxConcurrent: 5, ... },
  ADMIN: { unlimited },
};

```

### 3. Proxy Behavior

```text
User requests FITS
  ↓
[Rate limiter] Check daily quota remaining
  ↓ Allowed
[Upstream resolver] Map (RA, Dec, epoch) → NRAO FITS URL
  ↓
[Cache check] Is this FITS in our 7-day hot cache? (if <1GB)
  ↓ Hit
Return from cache (increment quota)
  ↓ Miss
[Upstream fetch] GET from NRAO with timeout + connection pool

  ↓
[Compress?] If file >100MB and user permit, keep-alive stream (no re-compress)
  ↓
[Cache] Store in hot cache (7-day TTL, size-capped 50GB total)
  ↓
[Audit] Log: actor, FITS URL, bytes, cache hit/miss, timestamp
  ↓
Stream to client, decrement quota

```

### 4. Upstream Allowlist

- Only NRAO endpoints allowed (no arbitrary proxying)

- Allowlist stored in `config/fits-endpoints.json`:

```json
{
  "epochs": {
    "MedianStack": "https://archive.nrao.org/vlass/data/.../{hpx_id}.fits",
    "QA": "https://archive.nrao.org/vlass/qa/.../{hpx_id}.fits"
  },
  "maxConcurrencyPerUpstream": 5,
  "timeoutSeconds": 120,
  "retryCount": 1
}

```

### 5. Cache Persistence

- **Backend:** Redis (ephemeral, fine to lose)

- **Not S3** (no need for durability; we can re-fetch)

- **Size cap:** 50 GB total; LRU eviction

- **TTL:** 7 days

### 6. Circuit Breaker

If NRAO is down or rate-limiting us:

- Fail **gracefully** (return 503 to user, not 500)

- Message: "FITS archive temporarily unavailable; try again in 5 min"

- Emit alert (wakes ops)

- Do **not** auto-retry forever (avoid thundering herd)

## Rationale

**Why B over A?**

- Better UX: no redirect jumps

- Enforces quotas: prevents abuse

- Auditability: every download is logged

**Why B over C?**

- No compute burden on MVP

- No WCS/reprojection complexity

- Lean on NRAO's infrastructure

- Can always upgrade to C later

**Why allowlist-only?**

- Prevents accidental proxying of proprietary data

- Clear scope: VLASS public data only

**Why aggressively small cache (7d, 50GB)?**

- FITS files are large; we don't want to become a mirror

- 7 days captures "I want the same file again" (collaborative analysis)

- 50GB holds maybe 100x ~500MB files—reasonable for a small team

## Consequences

### Positive

- ✅ MVP gets FITS access without building reprojection

- ✅ Users happy (they can download, with quotas)

- ✅ NRAO happy (we're not a mirror, we're adding value via viewer + community)

- ✅ Audit trail for every download (compliance + abuse detection)

### Negative

- ⚠️ Dependent on NRAO's availability SLA

- ⚠️ Bandwidth costs (egress from archival storage)

- ⚠️ Cache invalidation: if NRAO updates a file, we serve stale for up to 7 days

### Mitigation

- **SLA risk:** Cache hit rate target >40% (reduces upstream load)

- **Bandwidth cost:** Monitor and alert on >$500/month; discuss scale plan with ops

- **Stale cache:** Accept it; FITS rarely changes. If critical, implement cache-invalidation webhook from NRAO (v2)

## Related Decisions

- Maps to HIPS-PIPELINE.md (normative spec for FITS policy)

- Informs RATE-LIMITING.md (FITS quota mapping)

- Drives MONITORING-ALERTING.md (upstream health + cache efficiency metrics)

---

**Owner:** Architecture + NRAO Liaison
**Action Items:**

- [ ] Obtain NRAO written compliance confirmation before MVP launch

- [ ] Identify canonical FITS endpoint URLs + epoch naming

- [ ] Implement cache + rate-limit guards

- [ ] Set up cost monitoring (bandwidth alerts)

## **Review Date:** 2026-05-06 (revisit cache hit rate, costs)
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
