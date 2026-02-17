# Sprint 5.3 Week 2: Daily Implementation Checklist

📅 **Week**: Feb 24 - Mar 1, 2026  
🎯 **Goal**: 20 consumer tests + 4 consumer services  
📊 **Status**: Ready to start

---

## Monday, Feb 24: MetricsService Consumer (5 tests)

### Pre-Work (08:00)

- [ ] Review SPRINT-5-3-WEEK-2-IMPLEMENTATION-GUIDE.md (MetricsService section)
- [ ] Verify Week 1 code (all 20 publishing tests passing)
- [ ] Check Kafka broker status (docker-compose ps)

### Implementation (09:00-12:00)

- [ ] Create `apps/cosmic-horizons-api/src/app/modules/events/consumers/metrics.consumer.ts`
  - [ ] Import MetricsService and KafkaService
  - [ ] Implement OnModuleInit (subscribe to job-metrics)
  - [ ] Implement OnModuleDestroy (disconnect)
  - [ ] Add handleMetricEvent method
  - [ ] Target: 60 lines
  
- [ ] Modify `apps/cosmic-horizons-api/src/app/modules/events/services/metrics.service.ts`
  - [ ] Add aggregateJobMetrics(jobId, metrics) method
  - [ ] Add broadcastMetricsUpdate(jobId, metrics) method
  - [ ] Add getConsumerLag() method
  - [ ] Target: 30 lines

### Testing (13:00-17:00)

- [ ] Create `apps/cosmic-horizons-api/src/app/modules/events/consumers/test/metrics.consumer.spec.ts`
  - [ ] Copy 5 tests from SPRINT-5-3-WEEK-2-TEST-ADDITIONS.md Part 1
  - [ ] Target: 180 lines, 5 tests

- [ ] Register MetricsConsumer in EventsModule
  - [ ] Add to providers array
  - [ ] Verify imports

- [ ] Run tests: `pnpm nx test cosmic-horizons-api --testFile="**/metrics.consumer.spec.ts"`
  - [ ] Expected: 5/5 passing ✅

### End of Day Checklist

- [ ] MetricsConsumer created (60 lines)
- [ ] MetricsService enhanced (30 lines)
- [ ] 5 tests passing (180 lines)
- [ ] No TypeScript errors
- [ ] Commit: "Add MetricsService consumer (Day 1)"

**Blockers?**

- Consumer lag calculation issue: Check KafkaService stats method
- Module registration error: Verify EventsModule imports

---

## Tuesday, Feb 25: NotificationService Consumer (5 tests)

### Pre-Work (08:00)

- [ ] Verify Monday implementation is committed
- [ ] Review NotificationService section of implementation guide
- [ ] Ensure notification module exists

### Implementation (09:00-12:00)

- [ ] Create `apps/cosmic-horizons-api/src/app/modules/notifications/consumers/job-events.consumer.ts`
  - [ ] Import NotificationService and KafkaService
  - [ ] Implement OnModuleInit (subscribe to job-lifecycle)
  - [ ] Implement OnModuleDestroy
  - [ ] Add isTerminalEvent filter (job.completed, job.failed, job.cancelled)
  - [ ] Add handleTerminalEvent method
  - [ ] Target: 60 lines

- [ ] Modify `apps/cosmic-horizons-api/src/app/modules/notifications/services/notification.service.ts`
  - [ ] Add sendJobCompletionEmail(event) method
  - [ ] Add sendJobFailureNotification(event) method
  - [ ] Add broadcastViaWebSocket(notification) method
  - [ ] Target: 40 lines

### Testing (13:00-17:00)

- [ ] Create `apps/cosmic-horizons-api/src/app/modules/notifications/consumers/test/job-events.consumer.spec.ts`
  - [ ] Copy 5 tests from SPRINT-5-3-WEEK-2-TEST-ADDITIONS.md Part 2
  - [ ] Target: 220 lines, 5 tests

- [ ] Register JobEventsConsumer in NotificationsModule
  - [ ] Add to providers
  - [ ] Verify imports

- [ ] Run tests: `pnpm nx test cosmic-horizons-api --testFile="**/job-events.consumer.spec.ts"`
  - [ ] Expected: 5/5 passing ✅

### End of Day Checklist

- [ ] JobEventsConsumer created (60 lines)
- [ ] NotificationService enhanced (40 lines)
- [ ] 5 tests passing (220 lines)
- [ ] Terminal event filtering working
- [ ] Commit: "Add NotificationService consumer (Day 2)"

**Blockers?**

- WebSocket broadcasting: Check if WebSocket gateway exists
- Email service: Verify notification module has email provider

---

## Wednesday, Feb 26: ComplianceAuditor Consumer (5 tests)

### Pre-Work (08:00)

- [ ] Verify Tuesday implementation is committed
- [ ] Review ComplianceAuditor section of implementation guide
- [ ] Check if audit module needs to be created

### Implementation (09:00-12:00)

- [ ] Create audit module if needed:

  ```bash
  pnpm nx g @nx/nest:module --project=cosmic-horizons-api --name=audit
  ```

- [ ] Create `apps/cosmic-horizons-api/src/app/modules/audit/consumers/audit-trail.consumer.ts`
  - [ ] Import ComplianceAuditorService and KafkaService
  - [ ] Implement OnModuleInit (subscribe to audit-trail)
  - [ ] Implement OnModuleDestroy
  - [ ] Add handler for immutable event storage
  - [ ] Target: 50 lines

- [ ] Create `apps/cosmic-horizons-api/src/app/modules/audit/services/compliance-auditor.service.ts`
  - [ ] Add storeImmutableEvent(event) method
  - [ ] Add queryAuditTrail(filters, limit, offset) method
  - [ ] Add generateComplianceReport() method
  - [ ] Add verifyRetentionPolicy() method
  - [ ] Target: 100 lines

### Testing (13:00-17:00)

- [ ] Create `apps/cosmic-horizons-api/src/app/modules/audit/consumers/test/audit-trail.consumer.spec.ts`
  - [ ] Copy 5 tests from SPRINT-5-3-WEEK-2-TEST-ADDITIONS.md Part 3
  - [ ] Target: 200 lines, 5 tests

- [ ] Register AuditTrailConsumer in AuditModule
  - [ ] Add to providers
  - [ ] Verify imports

- [ ] Run tests: `pnpm nx test cosmic-horizons-api --testFile="**/audit-trail.consumer.spec.ts"`
  - [ ] Expected: 5/5 passing ✅

### End of Day Checklist

- [ ] AuditTrailConsumer created (50 lines)
- [ ] ComplianceAuditorService created (100 lines)
- [ ] 5 tests passing (200 lines)
- [ ] Immutable storage pattern implemented
- [ ] Commit: "Add ComplianceAuditor consumer (Day 3)"

**Blockers?**

- Audit repository: Create if doesn't exist
- 90-day retention: Can be enforced in service logic

---

## Thursday, Feb 27: SystemHealthMonitor Consumer (5 tests)

### Pre-Work (08:00)

- [ ] Verify Wednesday implementation is committed
- [ ] Review SystemHealthMonitor section of implementation guide
- [ ] Check if health module exists

### Implementation (09:00-12:00)

- [ ] Create health module if needed:

  ```bash
  pnpm nx g @nx/nest:module --project=cosmic-horizons-api --name=health
  ```

- [ ] Create `apps/cosmic-horizons-api/src/app/modules/health/consumers/system-health.consumer.ts`
  - [ ] Import SystemHealthMonitorService and KafkaService
  - [ ] Implement OnModuleInit (subscribe to system-health)
  - [ ] Implement OnModuleDestroy
  - [ ] Add handler for health event processing
  - [ ] Target: 50 lines

- [ ] Create `apps/cosmic-horizons-api/src/app/modules/health/services/system-health-monitor.service.ts`
  - [ ] Add processHealthEvent(event) method
  - [ ] Add checkErrorRateThreshold(rate) method
  - [ ] Add checkConsumerLagThreshold(lag) method
  - [ ] Add triggerAlert(alert) method
  - [ ] Add getHealthStatus() method
  - [ ] Target: 80 lines

### Testing (13:00-17:00)

- [ ] Create `apps/cosmic-horizons-api/src/app/modules/health/consumers/test/system-health.consumer.spec.ts`
  - [ ] Copy 5 tests from SPRINT-5-3-WEEK-2-TEST-ADDITIONS.md Part 4
  - [ ] Target: 200 lines, 5 tests

- [ ] Register SystemHealthConsumer in HealthModule
  - [ ] Add to providers
  - [ ] Verify imports

- [ ] Run tests: `pnpm nx test cosmic-horizons-api --testFile="**/system-health.consumer.spec.ts"`
  - [ ] Expected: 5/5 passing ✅

### End of Day Checklist

- [ ] SystemHealthConsumer created (50 lines)
- [ ] SystemHealthMonitorService created (80 lines)
- [ ] 5 tests passing (200 lines)
- [ ] Error rate & lag thresholds working
- [ ] Commit: "Add SystemHealthMonitor consumer (Day 4)"

**Blockers?**

- Alert thresholds: Define defaults (e.g., 5% error rate, 1000ms lag)
- Graceful shutdown: Verify disconnect pattern works

---

## Friday, Feb 28: Verification & Documentation (Day 5)

### Morning: Full Integration Test (09:00-11:00)

- [ ] Run all consumer tests together:

  ```bash
  pnpm nx test cosmic-horizons-api --testNamePattern="Consumer"
  ```

  - [ ] Expected: 20/20 passing ✅
  - [ ] Expected: ~900 lines of test code

- [ ] Run TypeScript compilation:

  ```bash
  pnpm exec tsc --noEmit --skipLibCheck
  ```

  - [ ] Expected: 0 errors ✅

### Mid-Day: Code Review & Documentation (11:00-14:00)

- [ ] Review each consumer implementation
  - [ ] Verify OnModuleInit → subscribe pattern
  - [ ] Verify OnModuleDestroy → disconnect pattern
  - [ ] Verify error handling (non-blocking)
  - [ ] Verify consumer group names are unique

- [ ] Document consumer group assignments:

  ```text
  metrics-consumer-group     → job-metrics topic
  notifications-consumer-group → job-lifecycle topic
  audit-trail-consumer-group  → audit-trail topic
  system-health-consumer-group → system-health topic
  ```

- [ ] Update SPRINT-5-3-PROGRESS.md:
  - [ ] Mark Week 2 complete
  - [ ] Record line counts: services (310 lines) + consumers (210 lines) + tests (800 lines)
  - [ ] Note any blockers for Week 3

### Afternoon: Week 2 Checklist (14:00-17:00)

- [ ] All 4 consumer services created ✅
- [ ] All 4 consumer service tests created ✅
- [ ] All 20 tests passing ✅
- [ ] All imports resolved ✅
- [ ] No TypeScript errors ✅
- [ ] Commit: "Complete Sprint 5.3 Week 2 - 20 consumer tests"
- [ ] Tag: `git tag sprint-5-3-week-2-complete`

### Week 2 Summary

```text
📊 Deliverables:
  - 4 consumer services (210 lines)
  - 4 consumer modules (not counted)
  - 20 comprehensive tests (800 lines)
  - Consumer groups configured
  - Non-blocking error handling
  - Graceful shutdown pattern

✅ Status: Ready for Week 3 integration tests
```

---

## Reference Files

📋 Documentation:

- [Implementation Guide](SPRINT-5-3-WEEK-2-IMPLEMENTATION-GUIDE.md)
- [Test Additions](SPRINT-5-3-WEEK-2-TEST-ADDITIONS.md)
- [Progress Tracking](SPRINT-5-3-PROGRESS.md)

🔧 Code Templates:

```bash
# Create new module
pnpm nx g @nx/nest:module --project=cosmic-horizons-api --name=MODULE_NAME

# Run consumer tests
pnpm nx test cosmic-horizons-api --testFile="**/consumer.spec.ts"

# Check all tests
pnpm nx test cosmic-horizons-api --passWithNoTests
```

---

## Team Coordination

**Daily Standup** (each morning 09:00):

- [ ] Report progress from previous day
- [ ] Share status updates
- [ ] Identify blockers early

**Pre-Commit Ritual**:

```bash
# Before committing each day:
pnpm nx test cosmic-horizons-api
pnpm exec tsc --noEmit --skipLibCheck
```

**End of Week**:

- [ ] All 20 tests passing
- [ ] Code review complete
- [ ] Ready for Week 3 E2E tests
- [ ] Ready for production deployment prep
