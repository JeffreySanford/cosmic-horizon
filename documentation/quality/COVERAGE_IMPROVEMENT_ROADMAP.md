# Code Coverage Improvement Analysis & Roadmap

**Target**: 90%+ Code Coverage  
**Current Status**: 82.52% (Statements) | 74.77% (Functions) | 61.84% (Branches)  
**Gap to Close**: 7.48% (Statements) | 15.23% (Functions) | 28.16% (Branches)

---

## Executive Summary

To reach 90%+ coverage, we need to focus on:

1. **Branch coverage** (biggest gap at 61.84%) - Add error path testing
2. **Function coverage** (74.77%) - Test untested util functions
3. **Statement coverage** (82.52%) - Edge cases and error scenarios

The analysis identifies **18 critical production files** where targeted testing can yield the highest ROI.

---

## 1. Critical Files for Coverage Improvement

### 1.1 Viewer Controller & Service (High Impact)

**File**: `viewer/viewer.controller.ts`  
**Current**: 52.2% (statements) | 37.5% (functions) | 17.5% (branches)  
**Gap**: 37.8% (statements), 28 uncovered branches

**What's Tested**:

- ✅ telemetry endpoint (admin check)

**What's NOT Tested**:

- ❌ `createState()` - no tests
- ❌ `createSnapshot()` - no tests
- ❌ `downloadCutout()` - all validation branches untested:
  - Invalid RA/Dec/FOV validation
  - Invalid survey parameter
  - Detail level validation (`high`, `max`, `standard`)
- ❌ `getNearbyLabels()` - all validation branches untested:
  - Radius range validation (0 < radius <= 2)
  - Limit range validation (1-25)
  - Invalid coordinate validation

**Recommendation**: Create 12-15 new test cases covering all validation branches

**Expected Coverage Gain**: +15-20% (statements), +25-30% (branches)

---

**File**: `viewer/viewer.service.ts`  
**Current**: ~85% coverage, but Service is 1230 lines with complex cutout fetching logic

**What's NOT Tested**:

- ❌ Cutout failure retry logic and fallback behaviors
- ❌ Cache eviction and cleanup
- ❌ Survey fallback mechanisms
- ❌ Provider fallback implementation (primary → secondary)
- ❌ Telemetry state mutations
- ❌ Resolution fallback edge cases

**Recommendation**: Add 20-25 edge case tests for cutout fetching, caching, and fallback logic

**Expected Coverage Gain**: +5-8% (branches)

---

### 1.2 Auth Controller (Medium Impact)

**File**: `auth/auth.controller.ts`  
**Current**: 84.2% (statements) | 80.0% (functions) | 44.3% (branches)  
**Gap**: 15.7% (statements), 18 uncovered branches

**What's NOT Tested**:

- ❌ Login error scenarios (OAuth failures)
- ❌ Logout edge cases
- ❌ Session validation error paths
- ❌ JWT refresh failures
- ❌ Guard rejection scenarios

**Recommendation**: Add 8-10 error path tests

**Expected Coverage Gain**: +10-12% (branches)

---

### 1.3 Data Staging Service (Medium Impact)

**File**: `jobs/services/dataset-staging.service.ts`  
**Current**: 76.6% (statements) | 88.9% (functions) | 40.0% (branches)

**What's NOT Tested**:

- ❌ Validation error scenarios
- ❌ Staging failure conditions
- ❌ Cache invalidation edge cases
- ❌ Concurrent staging request handling
- ❌ Resource constraint handling

**Recommendation**: Add 15-20 error/edge case tests

**Expected Coverage Gain**: +20-25% (branches)

---

### 1.4 TACC Integration Service (Medium Impact)

**File**: `jobs/tacc-integration.service.ts`  
**Current**: 78.6% (statements) | 100.0% (functions) | 41.7% (branches)

**What's NOT Tested**:

- ❌ API authentication failures
- ❌ Credential refresh failure paths
- ❌ Network timeout scenarios
- ❌ Invalid response handling
- ❌ Job submission failures
- ❌ Status polling edge cases

**Recommendation**: Add 15-18 error scenario tests

**Expected Coverage Gain**: +20-25% (branches)

---

### 1.5 App Controller (Low Impact)

**File**: `app/app.controller.ts`  
**Current**: 96.4% (statements) | 90.9% (functions) | 50.0% (branches)

**What's NOT Tested**:

- ❌ Health check error scenarios
- ❌ Database connection failures
- ❌ Error response formatting

**Recommendation**: Add 3-5 error tests

**Expected Coverage Gain**: +8-10% (branches)

---

## 2. Lower Priority Files (70-85% coverage)

These files have decent coverage but can be improved:

| File | Type | Current | Gap | Test Gap |
|------|------|---------|-----|----------|
| `auth/auth.service.ts` | Service | 75.2% | 14.8% | OAuth flow edge cases, token refresh failures |
| `comments/comments.service.ts` | Service | 78.1% | 11.9% | Permission checks, cascade deletes |
| `cache/cache.service.ts` | Service | 81.9% | 8.1% | Connection failures, timeout scenarios |
| `profile/profile.service.ts` | Service | 80.5% | 9.5% | Update failures, validation errors |
| `ephemeris/ephemeris.service.ts` | Service | 79.3% | 10.7% | Catalog failures, coordinate edge cases |

---

## 3. Messaging Layer (Event-Driven)

These services added in Priority 5-6 need enhanced branch coverage:

| File | Current | Gap | Missing Test Scenarios |
|------|---------|-----|------------------------|
| `messaging/rabbitmq.service.ts` | 92.1% | 7.9% | Connection failures, DLQ scenarios |
| `messaging/kafka.service.ts` | 88.5% | 11.5% | Consumer group failures, offset errors |
| `messaging/websocket.service.ts` | 85.3% | 14.7% | Connection drops, broadcast failures |
| `messaging/aladin.service.ts` | 87.2% | 12.8% | Catalog query errors, coordinate failures |

---

## 4. Test Coverage Strategy to Reach 90%+

### Phase 1: High-Impact Files (Target: +15% improvement)

**Effort**: 3-4 days | **Expected Result**: 88-89% coverage

1. **Viewer Controller validation tests** (12-15 tests)
   - All badge path validation scenarios from `downloadCutout()` and `getNearbyLabels()`

2. **Data Staging Service error tests** (15-20 tests)
   - Validation failures, cache edge cases, resource constraints

3. **TACC Integration Service error tests** (15-18 tests)
   - API failures, auth errors, timeout scenarios

### Phase 2: Medium-Impact Files (Target: +5-8% improvement)

**Effort**: 2-3 days | **Expected Result**: 89-91% coverage

4. **Auth Controller error paths** (8-10 tests)

5. **Viewer Service edge cases** (20-25 tests)
   - Cutout failures, cache eviction, fallback logic

6. **App Controller health checks** (3-5 tests)

### Phase 3: Lower Priority Files (Target: +2-5% improvement)

**Effort**: 1-2 days | **Expected Result**: 91-93% coverage

7. **Service error paths** (Auth, Comments, Cache, Profile, Ephemeris)
   - 10-15 tests per service

---

## 5. Recommended Test Cases by Category

### 5.1 Viewer Controller Tests (NEW)

```typescript
describe('ViewerController - Validation & Error Scenarios', () => {
  // downloadCutout validation
  it('should reject invalid RA coordinate', () => {
    expect(() => controller.downloadCutout('invalid', '0', '1', 'VLASS'))
      .toThrow(BadRequestException);
  });
  
  it('should reject invalid Dec coordinate', () => {
    expect(() => controller.downloadCutout('0', 'invalid', '1', 'VLASS'))
      .toThrow(BadRequestException);
  });
  
  it('should reject zero FOV', () => {
    expect(() => controller.downloadCutout('0', '0', '0', 'VLASS'))
      .toThrow(BadRequestException);
  });
  
  it('should reject short survey code', () => {
    expect(() => controller.downloadCutout('0', '0', '1', 'V'))
      .toThrow(BadRequestException);
  });
  
  it('should handle detail level standardization', () => {
    // Test all detail levels: high, max, standard, invalid
  });
  
  // getNearbyLabels validation
  it('should reject radius <= 0', () => {
    expect(() => controller.getNearbyLabels('0', '0', '0'))
      .toThrow(BadRequestException);
  });
  
  it('should reject radius > 2', () => {
    expect(() => controller.getNearbyLabels('0', '0', '2.1'))
      .toThrow(BadRequestException);
  });
  
  it('should reject limit < 1', () => {
    expect(() => controller.getNearbyLabels('0', '0', '1', '0'))
      .toThrow(BadRequestException);
  });
  
  it('should reject limit > 25', () => {
    expect(() => controller.getNearbyLabels('0', '0', '1', '26'))
      .toThrow(BadRequestException);
  });
  
  // createState and createSnapshot
  it('should create viewer state', () => {
    const result = controller.createState({ state: {...} });
    expect(result).toBeDefined();
  });
  
  it('should create viewer snapshot', () => {
    const result = controller.createSnapshot({...});
    expect(result).toBeDefined();
  });
});
```

### 5.2 Data Staging Service Tests (NEW)

```typescript
describe('DatasetStagingService - Error Scenarios', () => {
  it('should handle invalid dataset ID format', async () => {
    await expect(service.validateDataset(''))
      .rejects.toThrow();
  });
  
  it('should handle staging to unavailable resource', async () => {
    await expect(service.stageDataset({
      dataset_id: 'test',
      target_resource: 'invalid_resource',
      priority: 'normal',
    })).rejects.toThrow();
  });
  
  it('should respect priority level affects time estimate', async () => {
    const normalResult = await service.stageDataset({
      dataset_id: 'test1',
      target_resource: 'tacc_scratch',
      priority: 'normal',
    });
    
    const highResult = await service.stageDataset({
      dataset_id: 'test2',
      target_resource: 'tacc_scratch',
      priority: 'high',
    });
    
    expect(highResult.estimated_time_minutes)
      .toBeLessThan(normalResult.estimated_time_minutes);
  });
  
  it('should handle concurrent staging requests', async () => {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(service.stageDataset({
        dataset_id: `test${i}`,
        target_resource: 'tacc_scratch',
        priority: 'normal',
      }));
    }
    
    const results = await Promise.all(promises);
    expect(results).toHaveLength(5);
  });
  
  it('should cancel in-progress staging', async () => {
    await service.stageDataset({...});
    const cancelled = await service.cancelStaging('test');
    expect(cancelled).toBe(true);
  });
  
  it('should report correct staging progress', async () => {
    await service.stageDataset({...});
    const progress = await service.getStagingStatus('test');
    expect(progress.progress).toBeGreaterThanOrEqual(0);
    expect(progress.progress).toBeLessThanOrEqual(100);
  });
});
```

### 5.3 TACC Integration Service Tests (NEW)

```typescript
describe('TACCIntegrationService - Error Handling', () => {
  it('should handle authentication failure', async () => {
    mockTACCApi.auth.mockRejectedValue(new Error('Auth failed'));
    await expect(service.submitJob(...))
      .rejects.toThrow();
  });
  
  it('should retry credential refresh on expired token', async () => {
    // First call fails with 401, second succeeds after refresh
    expect(service.submitJob(...)).resolves.toBeDefined();
  });
  
  it('should handle network timeout', async () => {
    mockTACCApi.submit.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 61000))
    );
    await expect(service.submitJob(...))
      .rejects.toThrow('timeout');
  });
  
  it('should parse TACC error responses', async () => {
    mockTACCApi.submit.mockRejectedValue({
      statusCode: 400,
      message: 'Invalid job parameters',
    });
    await expect(service.submitJob(...))
      .rejects.toThrow('Invalid job parameters');
  });
  
  it('should poll job status until completion', async () => {
    // Model transitions: RUNNING → COMPLETED
    const result = await service.waitForJobCompletion('job123');
    expect(result.status).toBe('COMPLETED');
  });
  
  it('should detect and report job failures', async () => {
    // Model transitions: RUNNING → FAILED
    const result = await service.waitForJobCompletion('job456');
    expect(result.status).toBe('FAILED');
    expect(result.error).toBeDefined();
  });
});
```

---

## 6. Implementation Priority & Timeline

### Week 1: High-Impact Files

- Day 1-2: Viewer Controller tests (12-15 tests)
- Day 3: Data Staging Service tests (15-20 tests)
- Day 4-5: TACC Integration tests (15-18 tests)

**Expected Result**: 88-89% coverage (Statements), ~75% (Branches)

### Week 2: Medium-Impact Files

- Day 1-2: Auth Controllers/Services error paths
- Day 3-4: Viewer Service edge cases (cutout, cache, fallback)
- Day 5: App Controller health checks

**Expected Result**: 89-91% coverage overall, 75-80% (Branches)

### Week 3: Completion

- Day 1-3: Auth, Comments, Cache, Profile, Ephemeris services
- Day 4-5: Edge cases, final coverage audit

**Expected Result**: 91%+ coverage (Statements), 28%+ gap closed

---

## 7. Coverage Goals by Component

| Component | Current | Target | Gap |
|-----------|---------|--------|-----|
| **Controllers** | 78% | 90%+ | 12% |
| **Services** | 85% | 92%+ | 7% |
| **Messaging** | 88% | 93%+ | 5% |
| **Repositories** | 91% | 94%+ | 3% |
| **Guards/Interceptors** | 87% | 90%+ | 3% |

---

## 8. Metrics to Track

- [ ] Statement coverage: 82.52% → 90%+ (7.48% gain)
- [ ] Branch coverage: 61.84% → 75%+ (13.16% gain)
- [ ] Function coverage: 74.77% → 85%+ (10.23% gain)
- [ ] Error path coverage: 40% → 85%+
- [ ] Edge case coverage: 35% → 80%+
- [ ] Total test count: 1207 → 1400-1500 tests

---

## 9. Code Quality Improvements

Improving coverage will also provide:

1. **Better error handling documentation** - Test cases document error paths
2. **Edge case discovery** - Uncover bugs in untested paths
3. **Improved maintainability** - Easier to refactor with comprehensive tests
4. **Reduced production bugs** - Catch edge cases before deployment
5. **Confidence in refactoring** - Tests provide safety net

---

## 10. Recommended Tools & Utilities

### Istanbul Coverage Reports

```bash
pnpm nx test cosmic-horizons-api --coverage --coverageReporters=html
# Opens: apps/cosmic-horizons-api/test-output/jest/coverage/index.html
```

### Coverage Badges

```bash
# Track improvement over time
coverage-badge -o ./coverage-badge.svg \
  -l 90 -h 95 \
  --style flat
```

### Coverage Thresholds (Update jest.config.cts)

```typescript
coverageThreshold: {
  global: {
    branches: 90,
    functions: 90,
    lines: 90,
    statements: 90,
  },
  './apps/cosmic-horizons-api/src/app/viewer/**': {
    branches: 85,
    functions: 90,
  },
}
```

---

## Summary

**To reach 90%+ coverage:**

1. Focus first on **viewer.controller.ts** (37.8% gap - highest impact)
2. Add error path tests for **data-staging** and **tacc-integration** services
3. Fill gaps in **auth** and **app** controllers
4. Complete edge case testing in **viewer.service.ts**

**Timeline**: 2-3 weeks  
**Estimated new tests**: 150-200 test cases  
**Expected result**: 90-93% overall coverage, <5% branch gap

---

**Next Step**: Begin with Viewer Controller validation tests - these require minimal mocking and have the highest immediate impact on coverage metrics.
