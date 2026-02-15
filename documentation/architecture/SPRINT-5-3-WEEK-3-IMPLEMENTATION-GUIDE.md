# Sprint 5.3 Week 3 - Implementation Guide

## Final Phase: E2E Integration & Validation

**Target Completion**: February 27, 2026  
**Status**: Executing (core Week 3 implementation landed on 2026-02-15)  
**Total Tests Target**: 15+ integration tests

---

## Week 3 Overview

Week 3 focuses on end-to-end validation of the entire Kafka event infrastructure. This includes verifying that events published by JobOrchestratorService flow through all 4 consumer services correctly, error scenarios are handled, and system performance meets requirements.

### Architecture

```text
JobOrchestratorService (Publisher)
    ├─→ job-lifecycle topic
    │    └─→ NotificationService→User alerts
    │    └─→ ComplianceAuditor→Audit trail
    │
    ├─→ job-metrics topic
    │    └─→ MetricsService→Performance data
    │
    └─→ audit-trail + system-health topics
         └─→ SystemHealthMonitor→Health status
```

---

## Daily Breakdown

### Day 1 (Monday, Feb 24): E2E Workflow Tests

**Goal**: Verify complete event flow from job submission to all consumers processing

#### Test 1: Complete Job Lifecycle Flow

- Submit job via JobOrchestratorService.submitJob()
- Verify job.submitted published to Kafka
- Verify JobEventsConsumer receives and sends notification
- Verify AuditTrailConsumer stores immutable event
- **Assert**: All 3 consumers processed event within 5 seconds

#### Test 2: Job Completion with Multiple Consumer Processing

- Complete job via JobOrchestratorService.completeJob()
- Verify job.completed event published and partitioned by job_id
- Verify MetricsConsumer processes metrics
- Verify NotificationService sends email notification
- Verify ComplianceAuditor logs completion
- **Assert**: All 4 event handlers executed successfully

#### Test 3: Job Failure Scenario

- Trigger job failure via JobOrchestratorService.failJob()
- Verify all 3 consumers handle job.failed event
- Verify failure alert triggered by SystemHealthMonitor
- **Assert**: Error handling is non-blocking (consumers don't crash)

#### Test 4: Cancellation Flow

- Cancel active job
- Verify JobEventsConsumer notifies user of cancellation
- Verify AuditTrailConsumer records cancellation
- **Assert**: Cancellation event reaches all subscribers

#### Test 5: Partition Key Ordering

- Submit 3 jobs with same job_id pattern
- Verify all events for same job reach same partition
- Verify MetricsConsumer processes in order
- **Assert**: Per-job event ordering maintained

**Commands**:

```bash
# Run E2E tests
pnpm nx test cosmic-horizons-api --testFile="**/e2e-workflow.spec.ts"

# Expected: 5/5 tests passing ✅
```

---

### Day 2 (Tuesday, Feb 25): Error & Recovery Scenarios

**Goal**: Validate system behavior under failure conditions

#### Test 6: Consumer Error Recovery

- Make MetricsService.aggregateJobMetrics throw error
- Verify consumer catches error and logs warning
- Verify consumer continues consuming next message
- **Assert**: Non-blocking error handling works

#### Test 7: Kafka Connection Failure

- Simulate Kafka broker failure
- Verify KafkaService detects disconnect
- Verify all consumers gracefully shutdown
- **Assert**: No orphaned connections

#### Test 8: Malformed Event Handling

- Send corrupted JSON to job-lifecycle topic
- Verify JobEventsConsumer handles gracefully
- Verify notification isn't sent for invalid event
- **Assert**: Data validation prevents downstream errors

#### Test 9: Missing Required Fields

- Publish event missing required fields (e.g., job_id)
- Verify all consumers validate schema
- Verify ComplianceAuditor still stores event (for audit)
- **Assert**: Schema validation is consistent

#### Test 10: Consumer Lag Under Load

- Publish 100 events rapidly to job-metrics topic
- Measure consumer lag
- Verify SystemHealthMonitor detects high lag
- Verify alert triggered when lag > threshold
- **Assert**: Lag detection working, alert fired

**Commands**:

```bash
# Run error scenario tests
pnpm nx test cosmic-horizons-api --testFile="**/error-scenarios.spec.ts"

# Expected: 5/5 tests passing ✅
```

---

### Day 3 (Wednesday, Feb 26): Performance & Load Testing

**Goal**: Validate system can handle high-volume event processing

#### Test 11: Throughput Benchmark

- Publish 1,000 events to job-metrics topic
- Measure MetricsConsumer processing time
- Verify processing completes in < 30 seconds
- **Assert**: Throughput ≥ 33 events/second

#### Test 12: Latency Measurement  

- Publish single event, measure time to consumer processing
- Verify end-to-end latency < 1 second (p99)
- Verify notification sent < 2 seconds after job completion
- **Assert**: Low-latency message delivery

#### Test 13: Memory Stability Under Sustained Load

- Process 10,000 events over 5 minutes
- Monitor memory usage in MetricsService
- Verify clearOldMetrics() keeps memory bounded
- **Assert**: No memory leaks, bounded growth

#### Test 14: Multi-Consumer Parallelism

- Publish 500 events across all 4 topics simultaneously
- Verify all 4 consumers process in parallel
- Verify no blocking between consumer groups
- **Assert**: Independent consumer group processing

#### Test 15: Audit Trail Retention Policy

- Publish 500 audit events
- Verify ComplianceAuditor stores all events immutably
- Force retention check (simulate 91-day event)
- Verify expired events are removed
- Verify compliant events are retained
- **Assert**: Retention policy enforced correctly

**Commands**:

```bash
# Run performance tests
pnpm nx test cosmic-horizons-api --testFile="**/performance.spec.ts" --verbose

# Expected: 5/5 tests passing, latency/throughput metrics logged ✅
```

---

### Day 4 (Thursday, Feb 27): Integration & Compliance

**Goal**: Verify enterprise requirements met

#### Test 16: Audit Trail Immutability

- Verify ComplianceAuditorService generates immutable hash
- Verify hash includes event_id, job_id, timestamp
- Verify hash changes if event modified
- **Assert**: Audit trail cannot be tampered with

#### Test 17: Health Monitoring Workflow

- Trigger error condition (high error rate)
- Verify SystemHealthMonitor detects threshold breach
- Verify alert is triggered
- Verify alert is logged to audit trail
- **Assert**: Health monitoring + audit trail integrated

#### Test 18: Compliance Report Generation

- Generate compliance report from ComplianceAuditorService
- Verify report includes: total_events, jobs_covered, retention_status
- Verify retention_compliant = true
- **Assert**: Compliance reporting works

**Commands**:

```bash
# Run integration tests
pnpm nx test cosmic-horizons-api --testFile="**/integration.spec.ts"

# Expected: 3/3 tests passing ✅
```

---

### Day 5 (Friday, Feb 28): Documentation & Rollout

**Goal**: Document architecture, finalize sprint, plan Phase 3 expansion

#### Day 5 Tasks

1. **Create Architecture Diagram** (ASCIIDoctor/Mermaid)
   - Document full event flow
   - Document consumer groups
   - Document topic partitioning strategy

2. **Write Operations Runbook**
   - Consumer deployment steps
   - Health monitoring dashboard setup
   - Troubleshooting common issues
   - Performance tuning guide

3. **Create Metrics & KPIs Document**
   - Event throughput (events/sec)
   - End-to-end latency (ms)
   - Consumer lag (seconds)
   - Audit trail size (GB)

4. **Sprint Retrospective**
   - What went well? (3-week event infrastructure build)
   - What was challenging?
   - What should we do differently in Phase 3 expansion?

5. **Phase 3 Expansion Planning**
   - Additional consumer services (logging, ML features)
   - Schema registry integration
   - Dead letter queue implementation
   - Distributed tracing

**Commands**:

```bash
# Run full test suite
pnpm nx test cosmic-horizons-api

# Build for production
pnpm nx build cosmic-horizons-api

# Expected: All pre-existing tests + 15+ new tests passing ✅
```

---

## Test File Templates

### E2E Workflow Tests Structure

```typescript
describe('E2E Workflow', () => {
  let app: INestApplication;
  let jobOrchestratorService: JobOrchestratorService;
  let kafkaService: KafkaService;
  let metricCapture: ConsumerMessageCapture;

  beforeAll(async () => {
    // Create app, inject services
    // Start capturing metrics
  });

  it('should complete job lifecycle with all consumers processing', async () => {
    // 1. Submit job
    const job = await jobOrchestratorService.submitJob({...});
    
    // 2. Wait for event propagation
    await new Promise(r => setTimeout(r, 1000));
    
    // 3. Verify all consumers processed
    expect(metricCapture.notificationCount).toBe(1);
    expect(metricCapture.auditCount).toBe(1);
    expect(metricCapture.metricsCount).toBe(1);
  });
});
```

### Error Scenario Tests Structure

```typescript
describe('Error Scenarios', () => {
  it('should handle consumer errors gracefully', async () => {
    // Mock service to throw error
    jest.spyOn(service, 'method').mockRejectedValue(new Error('Test error'));
    
    // Trigger event
    await handler(mockPayload);
    
    // Verify consumer didn't crash
    expect(consumer.isActive).toBe(true);
  });
});
```

### Performance Tests Structure

```typescript
describe('Performance', () => {
  it('should process 1000 events in < 30 seconds', async () => {
    const start = Date.now();
    
    for (let i = 0; i < 1000; i++) {
      await kafkaService.publishEvent({ type: 'metric', job_id: `job-${i}` });
    }
    
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(30000);
  });
});
```

---

## Success Criteria

| Criterion | Target | Week 3 Focus |
|-----------|--------|-------------|
| E2E Tests | 5/5 passing | Event flow validation |
| Error Tests | 5/5 passing | Resilience verification |
| Performance Tests | 5/5 passing | Throughput/latency requirements |
| Integration Tests | 3/3 passing | Enterprise features |
| Build Status | 0 errors | Clean compilation |
| Documentation | Complete | Runbooks + diagrams |
| **Total Tests** | **18+ passing** | Exceeds expectation |

---

## Key Metrics to Track

- **Event Throughput**: Events/second processed
- **Latency (p50/p99)**: Message to consumer processing time
- **Consumer Lag**: Seconds behind Kafka offset
- **Error Rate**: % of events causing consumer errors
- **Memory Usage**: MB per consumer under sustained load
- **Audit Trail Size**: MB of immutable events stored

---

## Rollout Plan (Post-Week 3)

### Stage 1: Internal Staging (Week 4)

- Deploy to staging environment
- Run extended load tests (72 hours)
- Validate with sample data

### Stage 2: Production Canary (Week 5)

- Deploy to 10% of production
- Monitor metrics for 1 week
- Verify zero data loss

### Stage 3: Full Production (Week 6)

- Rolling deployment to 100%
- Maintain 2 rolling replicas (HA)
- Full monitoring + alerting

---

## References

- [Week 1 - Job Event Publishing](SPRINT-5-3-WEEK-1-IMPLEMENTATION-GUIDE.md)
- [Week 2 - Consumer Services](SPRINT-5-3-WEEK-2-IMPLEMENTATION-GUIDE.md)
- [Architecture Overview](SPRINT-5-3-KICKOFF-PLAN.md)
- [Kafka Configuration](../../TODO.md)

---

## Week 3 Checklist

- [x] Day 1: E2E Workflow tests (5 tests) passing
- [x] Day 2: Error Scenario tests (5 tests) passing
- [x] Day 3: Performance tests (5 tests) passing
- [x] Day 4: Integration tests (3 tests) passing
- [ ] Day 5: Documentation complete, retrospective done
- [x] **Final**: 18+ tests passing (targeted Week 3 suite)

---

**Status**: 🟡 EXECUTING WEEK 3

Week 3 will solidify the entire event infrastructure with comprehensive integration and performance testing. By end of week, we'll have a battle-tested, production-ready Kafka event system supporting the ngVLA data firehose.

**Next Steps**:

1. Create detailed test implementation files (e2e-workflow.spec.ts, error-scenarios.spec.ts, performance.spec.ts, integration.spec.ts)
2. Execute daily on schedule
3. Update SPRINT-5-3-PROGRESS.md daily
4. Document any blockers immediately

**Ready to go week 3! 🚀**
