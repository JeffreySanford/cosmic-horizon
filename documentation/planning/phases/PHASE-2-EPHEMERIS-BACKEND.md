# Phase 2: Scientific Ephemeris Backend (NestJS + Astronomy-Engine)

**Status**: Ready to Start  
**Start Date**: 2026-02-10  
**Solo Engineer**: Yes (you!)  
**Tech Stack**: TypeScript/NestJS + astronomy-engine (no Python)

---

## Overview

Implement real-time ephemeris calculations using **astronomy-engine** (pure JavaScript library) to replace hardcoded planet coordinates with scientifically-accurate, time-dependent positions. This enables precise celestial mechanics without external API dependencies or additional languages.

**Why NestJS + astronomy-engine?**

- ✅ Pure TypeScript/JavaScript stack (no Python dependency)
- ✅ astronomy-engine proven in production (cosinekitty/astronomy library)
- ✅ Single engineer can implement and maintain
- ✅ ±0.1 arcsecond accuracy (science-grade)
- ✅ NPM package with zero external dependencies
- ✅ No external APIs needed (self-contained)
- ✅ Small bundle size (~1.8 MB unpacked)

**Timeline**: 3-6 weeks

---

## Architecture

### High-Level Design

**Frontend** (no changes):

```http
GET /api/view/ephem/search?object=mars&epoch=2026-02-10T14:30:00Z
```

**NestJS Backend** (vlass-api):

```text
├─ Controller: POST /api/view/ephem/search
├─ Service: EphemerisService (skyfield-js wrapper)
├─ Cache: Redis (24h TTL, pre-warmed daily)
└─ Data: DE440/DE441 ephemeris (bundled)
```

**Response**:

```typescript
{
  ra: 142.847,
  dec: -15.234,
  accuracy_arcsec: 1.2,
  epoch: "2026-02-10T14:30:00Z",
  source: "skyfield",
  object_type: "planet"
}
```

### Component Details

#### 1. Frontend (No Changes)

- Existing label hover works as-is
- Calls `/api/view/ephem/search` instead of hardcoded fallback
- Works with cached results for responsive UX

#### 2. NestJS Backend

**New Endpoint**: `POST /api/view/ephem/search`

TypeScript request:

```typescript
{
  object_name: string;        // 'mars', 'venus', 'apophis'
  epoch?: string;             // ISO8601, default: now
  include_uncertainty?: boolean; // Optional, default: false
}
```

TypeScript response:

```typescript
{
  ra: number;                 // Right Ascension (degrees)
  dec: number;                // Declination (degrees)
  accuracy_arcsec: number;    // Position uncertainty
  epoch: string;              // ISO8601 timestamp
  source: 'astronomy-engine' | 'cache' | 'fallback';
  object_type: 'planet' | 'satellite' | 'asteroid';
}
```

**Features**:

- JWT auth required
- Rate limit: 60 req/min per user
- Timeout: 2 seconds (fails to hardcoded fallback if needed)
- Redis caching: `ephem:{object}:{date}` with 24h TTL

#### 3. Astronomy-Engine Integration

**Core Implementation** (`ephemeris.service.ts`):

TypeScript service wrapper:

```typescript
import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import * as Astronomy from 'astronomy-engine';

@Injectable()
export class EphemerisService {
  constructor(private cache: CacheService) {}

  async calculatePosition(
    object: string,
    epochIso: string = new Date().toISOString()
  ) {
    // Check cache first
    const dateKey = epochIso.split('T')[0];
    const cached = await this.cache.get(`ephem:${object}:${dateKey}`);
    if (cached) return cached;

    // Calculate using astronomy-engine
    const epoch = new Date(epochIso);
    const observer = new Astronomy.Observer(0, 0, 0); // Earth center
    const body = this.getAstronomyObject(object);

    if (!body) throw new Error(`Unknown object: ${object}`);

    const vector = Astronomy.GeoVector(body, epoch, observer);
    const equatorial = Astronomy.EquatorialFromVector(vector);

    const result = {
      ra: equatorial.ra,          // Right ascension in degrees
      dec: equatorial.dec,        // Declination in degrees
      accuracy_arcsec: 0.1,       // Typical accuracy of astronomy-engine
      epoch: epochIso,
      source: 'astronomy-engine',
      object_type: this.classifyObject(object)
    };

    // Cache for 24 hours
    await this.cache.set(
      `ephem:${object}:${dateKey}`,
      result,
      86400
    );

    return result;
  }

  private getAstronomyObject(name: string): Astronomy.Body | null {
    const objectMap: Record<string, Astronomy.Body> = {
      'sun': Astronomy.Body.Sun,
      'moon': Astronomy.Body.Moon,
      'mercury': Astronomy.Body.Mercury,
      'venus': Astronomy.Body.Venus,
      'mars': Astronomy.Body.Mars,
      'jupiter': Astronomy.Body.Jupiter,
      'saturn': Astronomy.Body.Saturn,
      'uranus': Astronomy.Body.Uranus,
      'neptune': Astronomy.Body.Neptune
    };

    return objectMap[name.toLowerCase()] || null;
  }

  private classifyObject(name: string): string {
    const planets = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'sun'];
    if (planets.includes(name.toLowerCase())) {
      return 'planet';
    }
    if (name.toLowerCase() === 'moon') return 'satellite';
    return 'asteroid';
  }
}
```

#### 4. Redis Caching Strategy

**Cache Key Pattern**: `ephem:{object}:{date}`

**Cache TTL**: 24 hours

**Pre-warming**: Daily cron job

TypeScript cron job:

```typescript
// Cron job: runs daily at 00:00 UTC
async precomputeDailyEphemeris() {
  const today = new Date().toISOString().split('T')[0];
  const objects = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon'];

  for (const obj of objects) {
    const result = await this.ephemeris.calculatePosition(obj, `${today}T00:00:00Z`);
    await this.redis.setex(
      `ephem:${obj}:${today}`,
      86400,
      JSON.stringify(result)
    );
  }

  // Also pre-warm next 7 days for better cache hit
  for (let i = 1; i <= 7; i++) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + i);
    const dateStr = futureDate.toISOString().split('T')[0];

    for (const obj of objects) {
      const result = await this.ephemeris.calculatePosition(obj, `${dateStr}T00:00:00Z`);
      await this.redis.setex(
        `ephem:${obj}:${dateStr}`,
        86400,
        JSON.stringify(result)
      );
    }
  }
}
```

---

## Implementation Roadmap

### Sprint 1: Core Ephemeris Engine (Weeks 1-2)

**Goal**: astronomy-engine integrated, calculation working, basic caching operational.

**Technical Decisions**:

- Use `astronomy-engine` npm package (pure JavaScript, no dependencies)
- Cache key: `ephem:{object}:{date}` (24h TTL in Redis)
- Accuracy: ±0.1 arcsecond (science-grade)
- Timeout: 2 seconds (fail to hardcoded fallback if exceeded)

**Daily Effort**: 2-3 hours (can fit around other work)

**Task 1.1**: Add astronomy-engine npm package

- Command: `npm install astronomy-engine`
- Verify bundle size: ~1.8 MB (small, fast lookup)
- Test imports in TypeScript

```typescript
import * as Astronomy from 'astronomy-engine';
const vector = Astronomy.GeoVector(Astronomy.Body.Mars, new Date(), observer);
```

- Expected: No build errors, full TypeScript support

**Task 1.2**: Implement NestJS ephemeris service

- Create: `apps/vlass-api/src/app/modules/ephemeris/ephemeris.service.ts`
- Implement position calculations using `Astronomy.GeoVector()` + `Astronomy.EquatorialFromVector()`
- Add object name resolution (planet/satellite names)
- Write unit tests for Mars, Venus, Jupiter
- Expected: All tests passing, 0 runtime errors

**Task 1.3**: Add Redis caching layer

- Extend service with cache decorator
- Implement cache key: `ephem:{object}:{YYYY-MM-DD}`
- TTL: 86,400 seconds (24 hours)
- Test cache hit on repeated queries
- Expected: 95%+ cache hit on identical requests

**Task 1.4**: Create REST endpoint

- Endpoint: `POST /api/view/ephem/search`
- Auth: JWT guard (existing)
- Rate limit: 60 req/min (existing)
- Request: `{ object_name: string, epoch?: ISO8601 }`
- Response: Valid ephemeris coordinates
- Test with cURL
- Expected: Returns 200 OK with coordinates

### Sprint 2: Caching & Resilience (Weeks 3-4)

**Goal**: Pre-warmed cache, graceful degradation, monitoring.

**Daily Effort**: 1-2 hours (while other work proceeds)

**Task 2.1**: Pre-computation cron job

- Create scheduled job to run daily at 00:00 UTC
- Compute: All planets + Moon for today + next 7 days
- Time budget: Should complete in <10 seconds
- Verify cache keys exist and contain valid data
- Expected: 98%+ cache hit rate during business hours

**Task 2.2**: Error handling & fallback

- If skyfield calculation fails: Return hardcoded fallback
- If Redis unavailable: Calculate on-demand (5s timeout)
- Log warnings for monitoring
- Test Redis failure scenarios
- Expected: No user-facing errors, graceful degradation

**Task 2.3**: Observability & logging

- Add structured logs: `{ object, epoch, duration_ms, source }`
- Metrics: Cache hit rate, calculation time, error count
- Dashboard: Simple view of request volume vs. effectiveness
- Expected: Can diagnose performance issues

### Sprint 3: Accuracy & Testing (Weeks 5-6)

**Goal**: Science validation, edge cases handled, ready for deployment.

**Daily Effort**: 1-2 hours

**Task 3.1**: Accuracy validation

- Test Mars position against JPL Horizons data
- Test Venus position with Stellarium (visual check)
- Validate accuracy spec (±0.1 arcsecond, typical for astronomy-engine)
- Document results in test report
- Expected: Confirms astronomy-engine meets spec

**Task 3.2**: Edge case handling

- Leap seconds (handled by astronomy-engine automatically)
- Retrograde historical dates (valid inputs: 1900-2100)
- High-precision requests (implement per-second accuracy)
- Asteroid numbering (support JPL designations)
- Expected: All edge cases handled without errors

**Task 3.3**: Load testing

- Simulate 100 concurrent requests
- Measure response time, cache hit rate, Redis CPU
- Optimize warming schedule if needed
- Expected: <100ms p95 latency with warm cache

---

## Prerequisites

### Technology Stack

| Component | Tool | Version | Status |
| --- | --- | --- | --- |
| Ephemeris | astronomy-engine | 2.1.19+ | ✅ Available on npm |
| Backend | NestJS | 10.x | ✅ Existing |
| Cache | Redis | 7.x | ✅ Existing |
| Language | TypeScript | 5.x | ✅ Existing |
| Package Manager | pnpm | 8.x | ✅ Existing |

### Dependencies to Add

```json
{
  "dependencies": {
    "astronomy-engine": "^2.1.19"
  }
}
```

### No Infrastructure Changes Required

**Pros of astronomy-engine**:

- ✅ Pure JavaScript (no subprocess needed)
- ✅ Zero external dependencies
- ✅ Single language stack (TypeScript/NestJS only)
- ✅ Active & maintained (by Don Cross / cosinekitty)
- ✅ MIT licensed
- ✅ Small footprint (~1.8 MB)

**No Need For**:

- ❌ Python installation
- ❌ Subprocess management
- ❌ Virtual environments
- ❌ Separate CI/CD pipeline
- ❌ Additional language tooling
- ❌ External ephemeris data files

---

## Success Criteria

### Functional Requirements

- ✅ Endpoint returns accurate planet positions (±0.1 arcsecond)
- ✅ Supports planets: Mercury–Neptune (8 objects)
- ✅ Supports Moon
- ✅ Graceful fallback to hardcoded coordinates on error
- ✅ Rate limiting: 60 req/min per user
- ✅ Caching: ≥90% cache hit rate for popular objects
- ✅ Response time: <500ms p95 (with cache)

### Non-Functional Requirements

- ✅ Auth: Requires valid JWT token
- ✅ Logging: All queries logged with object_name, epoch, source
- ✅ Monitoring: Alert if error rate >5% or latency >1s p95
- ✅ Documentation: API specs + user guide
- ✅ Test Coverage: ≥85% unit + integration tests

### Business Requirements

- ✅ Zero breaking changes to existing API/viewer
- ✅ Viewer label hover still works (silent upgrade)
- ✅ MVP release ships before Phase 2 starts
- ✅ Single language stack (no Python needed)

---

## Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
| --- | --- | --- | --- |
| astronomy-engine calculation slow | High | Low | Pre-compute + cache, 2s timeout + fallback |
| Cache invalidation bugs | High | Low | Comprehensive cache tests, TTL validation |
| Leap second mis-handling | Medium | Low | Test against JPL Horizons data |
| Accuracy degradation over time | Low | Low | Re-validate accuracy every 2 years |
| Redis cache clears | Medium | Low | Pre-compute 7 days, maintain warm cache |

---

## Deployment Checklist

- [ ] skyfield-js npm package installed and tested
- [ ] EphemerisService unit tests passing (Mars, Venus, Jupiter)
- [ ] Redis cache pre-warmed with 7-day forecast
- [ ] NestJS endpoint passes all e2e tests
- [ ] Load test: 100 concurrent requests, <100ms p95
- [ ] Error handling verified (Redis down, invalid input)
- [ ] Monitoring configured for latency + error rate
- [ ] Documentation published in API docs
- [ ] Team (you!) trained on maintenance
- [ ] Rollback plan verified (feature flag disabled)

---

## Testing Strategy

### Unit Tests (Sprint 1)

TypeScript test file:

```typescript
describe('EphemerisService', () => {
  let service: EphemerisService;

  beforeEach(async () => {
    service = new EphemerisService();
  });

  it('should calculate Mars position for known epoch', async () => {
    const result = await service.calculatePosition('mars', '2026-02-10T00:00:00Z');
    expect(result.ra).toBeCloseTo(142.847, 1);  // ±0.1 degrees
    expect(result.dec).toBeCloseTo(-15.234, 1);
    expect(result.source).toBe('skyfield');
  });

  it('should return cached result on second call', async () => {
    const result1 = await service.calculatePosition('mars', '2026-02-10T00:00:00Z');
    const result2 = await service.calculatePosition('mars', '2026-02-10T00:00:00Z');
    expect(result1).toEqual(result2);
  });

  it('should handle invalid object name', async () => {
    expect(async () => {
      await service.calculatePosition('invalidplanet123');
    }).rejects.toThrow();
  });
});
```

### Integration Tests (Sprint 2)

- Test endpoint with real Redis
- Verify cache TTL expiration
- Confirm cron job execution
- Test fallback behavior when cache unavailable

### E2E Tests (Sprint 3)

- Browser-based: Venus search → correct coordinates appear
- API contract validation: Response matches expected schema
- Accuracy verification: Compare to JPL Horizons data

---

## Related Documents

- [EPHEMERIS-SCOPE-DECISION.md](../../architecture/EPHEMERIS-SCOPE-DECISION.md) - Scope analysis
- [TARGET-RESOLUTION-EPHEMERIS.md](../../architecture/TARGET-RESOLUTION-EPHEMERIS.md) - MVP implementation
- [ROADMAP.md](../roadmap/ROADMAP.md) - Timeline context

---

**Next Step**: Create GitHub issues for Sprint 1 tasks and assign to yourself
