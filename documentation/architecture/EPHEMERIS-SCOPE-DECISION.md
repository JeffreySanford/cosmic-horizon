# Ephemeris Feature Scope Analysis: MVP vs. Scientific

**Date**: 2026-02-10
**Decision Point**: Hardcoded fallback (MVP) vs. Real ephemeris backend (v1.1+)

---

## Your Questions Answered

### Q1: Would a scientific ephemeris fix solve the "nothing shows up for mars" issue
**Answer: ✅ YES**

A proper ephemeris backend would solve it by:

- ✅ Providing real-time, accurate planet coordinates

- ✅ Eliminating dependency on broken APIs

- ✅ Enabling precise location centering

- ✅ Supporting all solar system objects (planets, asteroids, comets)

**Implementation**:

```typescript
// Instead of hardcoded fallback:
{ ra: 142.8, dec: -15.2 }  // ±5-10° inaccuracy

// Scientific solution:
GET /api/ephem/mars?epoch=2026-02-10T14:30:00Z
→ { ra: 142.847, dec: -15.234, accuracy_arcsec: 1.2 }  // ±1 arcsec

```

### Q2: Would that exceed MVP scope
**Answer: ⚠️ DEPENDS on project priorities**

---

## Scope Analysis

### Current Approach: Hardcoded Fallback (MVP ✅)

**Scope**: Fits MVP
**Charter Alignment**: ✅ "Interactive sky explorer"

| Aspect                | MVP Scope | Scientific Scope |
| :-------------------- | :-------- | :--------------- |

| **Goal**              | Exploration | Research platform |

| **Accuracy Required** | ±5-10°    | ±0.01° (arcsec)  |

| **User Base**         | Public    | Scientists       |

| **Data Policy**       | Public    | TBD (v2 phase)   |

**Current MVP Promise**:
> "VLASS Portal Mode A Viewer is a **web-based astronomical sky explorer** powered by Aladin Lite. It provides interactive HiPS-based sky map, pan, zoom, and inspection capabilities."

**Does Mars not showing count as MVP failure?**

- ❌ **NO** if users can manually enter coordinates (workaround exists)

- ✅ **YES** if Mars not showing is perceived as broken functionality

### Scientific Ephemeris (v1.1 / Phase 2)

**Scope**: Exceeds MVP, appropriate for Phase 2
**Charter Alignment**: ✅ "AI-driven scientific platform" (future state)

| Characteristic             | Impact    | Notes                               |
| :------------------------- | :-------- | :---------------------------------- |

| **Accuracy**: ±1 to 0.1°   | Enables research | Scientific credibility              |
| **Real-time updates**      | Complex   | Adds external API dependencies     |

| **Implementation effort**  | Medium    | 1-2 weeks (Astropy backend)         |

| **Maintenance burden**     | Medium    | Ephemeris data updates needed       |

| **User value for MVP**     | Low       | Not required for exploration        |

| **User value for Phase 2** | High      | Enables AI calibration, analysis   |

---

## Decision Framework

### When Hardcoded Fallback is Sufficient (MVP)

✅ **Keep MVP approach if**:

```markdown
- Primary use case is public exploration/education
- Users have workaround (manual RA/Dec input)
- Mars issue is corner case (most queries are M31, etc.)
- No scientific accuracy requirement
- Mars showing ±10° off is acceptable for visual centering
- Phase 2 roadmap explicitly includes ephemeris
```

**Your MVP Charter says**:

- ✅ "Interactive sky explorer" (hardcoded works)

- ❌ NOT "research platform" (scientific inaccuracy problematic)

- ❌ NOT "scientific data archive" (implied high accuracy)

### When Scientific Ephemeris is Necessary (v1.1+)

❌ **Need real ephemeris if**:

```markdown
- Phase 2 includes AI-driven science (likely yes)
- Users doing astrophysics research (future user base)
- Planetary data for calibration (FITS cutouts, etc.)
- Observatory partnerships require accuracy
- Public credibility depends on scientific validity
```

---

## Three Implementation Options

### Option 1: Keep MVP Approach (CURRENT) ✅

**Cost**: $0
**Effort**: Done
**Timeline**: Immediate
**Accuracy**: ±5-10°
**Verdict**: ✅ Acceptable for MVP

```typescript
// What we have now:
const mars = { ra: 142.8, dec: -15.2 };  // Static, approximate

```

**Pros**:

- ✅ No external dependencies

- ✅ Fast (no API calls)

- ✅ Resilient (always works)

- ✅ Scope-appropriate for MVP

**Cons**:

- ❌ User perception: "Mars search doesn't work"

- ❌ Not suitable for any scientific use

- ❌ Requires manual updates as planets orbit

**User Impact**: "Mars is vaguely in the right area; I can adjust manually"

---

### Option 2: Backend Astropy Service (RECOMMENDED for v1.1) ⭐

**Cost**: ~$10K-20K engineering time
**Effort**: 1-2 weeks development
**Timeline**: v1.1 or Phase 2
**Accuracy**: ±0.1° (36 arcsec)
**Verdict**: ⭐ Best for future phases

```typescript
// What we'd implement:
GET /api/ephem/mars?epoch=2026-02-10T14:30:00Z
→ {
    ra: 142.8473,
    dec: -15.2341,
    accuracy_arcsec: 1.2,
    epoch: "2026-02-10T14:30:00Z"
  }

```

**Implementation**:

1. **Backend Service** (NestJS):

   ```typescript
   @Get('/ephem/:object')
   async getEphemeris(
     @Param('object') object: string,
     @Query('epoch') epoch: string,
   ) {
     const result = await this.astropy.compute(object, epoch);
     return { ra: result.ra, dec: result.dec, ... };
   }
   ```

2. **Python Ephemeris** (Astropy):

   ```python
   from astropy.coordinates import EarthLocation, get_body
   from astropy.time import Time

   mars = get_body('mars', Time('2026-02-10T14:30:00Z'))
   return { ra: mars.ra.deg, dec: mars.dec.deg }
   ```

3. **Caching** (Redis):

   - Pre-compute daily positions for major planets

   - Cache for 24 hours

   - 0ms latency for cached requests

**Pros**:

- ✅ Scientifically accurate (±1 arcsec)

- ✅ Real-time (query-based calculation)

- ✅ No external API dependencies

- ✅ Extensible (asteroids, comets, custom objects)

- ✅ Cacheable (pre-compute nightly)

- ✅ NestJS native (no new infrastructure)

- ✅ Supports Phase 2 AI/calibration features

**Cons**:

- ❌ Requires Python runtime addition

- ❌ ~100-300ms computation per request (cacheable)

- ❌ Maintenance burden (ephemeris updates)

**User Impact**: "Mars centers perfectly; high-precision science-ready"

---

### Option 3: External Ephemeris API (JPL Horizons)

**Cost**: $0 (NASA free)
**Effort**: 2-3 days integration
**Timeline**: v1.1
**Accuracy**: ±0.001° (3 arcsec, professional-grade)
**Verdict**: ✅ Good but introduces external dependency

```typescript
// Call JPL Horizons API:
curl "https://ssd-api.jpl.nasa.gov/horizons_file?COMMAND='Mars'&format=json"

```

**Pros**:

- ✅ Authoritative NASA data

- ✅ Professional-grade accuracy

- ✅ No backend changes needed

- ✅ Free, public service

**Cons**:

- ❌ Network dependency (API outages cause failures)

- ❌ Rate limits (could impact heavy usage)

- ❌ Latency (500ms+ per request)

- ❌ External service (not under your control)

**User Impact**: "Usually works, but slow; fails if NASA API is down"

---

## Recommendation by Phase

### Phase 1 / MVP (Now)

**Decision**: ✅ **Keep hardcoded fallback**

**Rationale**:

- Mars search with ±10° offset is acceptable for exploration

- Hardcoded approach is scope-appropriate

- Users have workaround (manual coordinates)

- No scientific accuracy requirement in charter

- Documented limitation on canvas/UI

**Action**:

```typescript
// Current implementation is correct for MVP
getKnownPlanetCoordinates('mars') → { ra: 142.8, dec: -15.2 }

```

### Phase 1.1 / Operational Hardening (2-4 weeks out)

**Decision**: ✅ **Consider quick win if user feedback warrants**

If multiple users report "Mars doesn't work", add a client-side warning:

```typescript
// OPTION: UI warning for fallback coordinates
statusMessage = `Mars (approximate position ±5-10°). For precise coordinates, enter RA/Dec manually.`

```

### Phase 2 / AI Integration Platform (3-6 months out)

**Decision**: ⭐ **Implement Backend Astropy Service**

**Rationale**:

- Phase 2 explicitly includes "AI-driven platform"

- Ephemeris data needed for calibration/analysis

- Scientific accuracy becomes requirement

- Astropy-based approach is proven, standard in astronomy Python

**Implementation**:

- Add Astropy to NestJS (via Python subprocess or microservice)

- Cache planet positions daily

- Extend to support minor planets, comets, custom objects

- Integrate with Phase 2 AI inference service

---

## Cost-Benefit Analysis

### MVP: Does Mars Not Showing Count as "Broken"
**Test**: Ask target users

Questions:

1. **Explorers**: "Can you find interesting sky regions?" → ✅ Yes (M31 works, Mars is edge case)

2. **Scientists**: "Can you search for Jupiter?" → ❌ No (need accuracy for work)

3. **Public Outreach**: "Does Mars show up?" → ⚠️ Confusing (users expect it to work)

**If answer is mostly ✅**: Keep MVP approach
**If answer is mostly ❌**: Escalate to option 2/3

### Phase 2: Does Project Pivot to Science
If Phase 2 includes:

- ❌ AI-driven calibration → Need real ephemeris

- ❌ Scientific data products → Need real ephemeris

- ❌ Observatory partnerships → Need real ephemeris

- ✅ Education/public outreach only → Fallback may be OK

---

## Summary & Recommendation

| Scenario                                          | Decision |
| :----------------------------------------------- | :------- |

| MVP public explorer (current charter)            | ✅ Hardcoded (CURRENT) |
| User feedback: Mars search doesn't work (issue)  | ⚠️ Evaluate phase 2 timeline |
| Phase 2 AI/science features approved             | ⭐ Implement Astropy backend (RECOMMENDED) |
| Need immediate precision for partnerships        | 🔴 Implement JPL Horizons (quick but fragile) |
| No plans for science features                    | ✅ Keep hardcoded MVP approach |

---

## Next Steps

### If You're Staying MVP

1. ✅ Keep hardcoded fallback (already implemented)

2. ✅ Document limitation on landing page / help docs

3. ✅ Add UI hint: "Mars (approximate position, ±10°)"

4. ✅ Recommend manual RA/Dec entry for precision

### If You're Planning v1.1 with Science

1. ⭐ Create GitHub issue: "Ephemeris backend (v1.1)"

2. ⭐ Add to Phase 2 planning: `documentation/planning/phases/PHASE-2-*.md`

3. ⭐ Update roadmap: Move "Ephemeris improvements" from v1.1 to Phase 2 priority

4. ⭐ Spike: Evaluate Astropy integration with NestJS (1 day)

### If Mars Is Urgent

1. 🔴 Add live warning: "Mars search using approximate coordinates. For precise positions, manually enter RA/Dec."

2. 🔴 Decide: Can this wait for Phase 2, or is it blocking MVP launch?

3. 🔴 If blocking: Fast-track to Astropy backend (2-week effort)

---

**Decision Required From**: Product/Technical Leadership

**Questions for Stakeholder**:

1. Is MVP charter "exploration-only" or "science-ready"?

2. When does Phase 2 AI/science integration target begin?

3. Are there early scientific users who need accurate ephemeris?

4. Is the "Mars doesn't work" feedback a blocker or edge case?

---

**Reference Documents**:

- [PRODUCT-CHARTER.md](../product/PRODUCT-CHARTER.md) - MVP scope authority

- [TARGET-RESOLUTION-EPHEMERIS.md](TARGET-RESOLUTION-EPHEMERIS.md) - Technical architecture

- [ROADMAP.md](../planning/roadmap/ROADMAP.md) - v1.1 planning

## - [MARS-RESOLUTION-DEBUGGING.md](MARS-RESOLUTION-DEBUGGING.md) - Troubleshooting guide
---

*VLASS Portal Development - (c) 2026 Jeffrey Sanford. All rights reserved.*
