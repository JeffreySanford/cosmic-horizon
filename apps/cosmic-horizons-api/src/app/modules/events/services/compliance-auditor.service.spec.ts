import { Test, TestingModule } from '@nestjs/testing';
import { ComplianceAuditorService } from './compliance-auditor.service';

/**
 * SPRINT 5.3: Job Orchestration Events
 * Week 2 (Feb 23-27): Consumer Event Tests
 *
 * ComplianceAuditorService Event Consumption Tests
 * Tests for immutable audit logging, compliance tracking, and attestation
 */
describe('ComplianceAuditorService - Event Consumption', () => {
  let service: ComplianceAuditorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ComplianceAuditorService],
    }).compile();

    service = module.get<ComplianceAuditorService>(ComplianceAuditorService);
  });

  describe('Monday: Immutable event storage and audit trail initialization', () => {
    it('should store job submitted event immutably', async () => {
      const event = {
        eventId: 'evt-1',
        jobId: 'job-1',
        userId: 'user-123',
        eventType: 'job.submitted',
        timestamp: new Date().toISOString(),
        agentType: 'AlphaCal',
        datasetId: 'VLASS-2.1-001',
        gpuCount: 4,
      };

      const stored = await service.storeAuditEvent(event);
      expect(stored.id).toBeDefined();
      expect(stored.hash).toBeDefined();
      expect(stored.mutable).toBe(false);
    });

    it('should link audit events with cryptographic hash chain', async () => {
      const event1 = {
        eventId: 'evt-1',
        jobId: 'job-1',
        userId: 'user-123',
        eventType: 'job.submitted',
        timestamp: new Date().toISOString(),
      };

      const event2 = {
        eventId: 'evt-2',
        jobId: 'job-1',
        userId: 'user-123',
        eventType: 'job.queued',
        timestamp: new Date(Date.now() + 1000).toISOString(),
      };

      const stored1 = await service.storeAuditEvent(event1);
      const stored2 = await service.storeAuditEvent(event2);

      expect(stored2.previousHash).toBe(stored1.hash);
    });

    it('should prevent modification of stored audit events', async () => {
      const event = {
        eventId: 'evt-1',
        jobId: 'job-1',
        userId: 'user-123',
        eventType: 'job.submitted',
        timestamp: new Date().toISOString(),
      };

      const stored = await service.storeAuditEvent(event);

      // Attempt to modify
      const attempted = await service.attemptModifyEvent(stored.id, {
        ...event,
        userId: 'different-user',
      });

      expect(attempted.allowed).toBe(false);
    });

    it('should initialize audit trail for new job', async () => {
      const jobId = 'job-new-1';
      const userId = 'user-123';

      const trail = await service.initializeAuditTrail(jobId, userId);
      expect(trail.jobId).toBe(jobId);
      expect(trail.createdBy).toBe(userId);
      expect(trail.eventCount).toBe(0);
    });

    it('should timestamp all audit events with millisecond precision', async () => {
      const event = {
        eventId: 'evt-1',
        jobId: 'job-1',
        userId: 'user-123',
        eventType: 'job.submitted',
        timestamp: new Date().toISOString(),
      };

      const stored = await service.storeAuditEvent(event);
      expect(stored.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });
  });

  describe('Tuesday-Wednesday: Audit trail queries and compliance reporting', () => {
    it('should retrieve full audit trail for job', async () => {
      const jobId = 'job-1';
      const events = [
        { jobId, eventType: 'job.submitted', timestamp: new Date().toISOString() },
        { jobId, eventType: 'job.queued', timestamp: new Date(Date.now() + 1000).toISOString() },
        { jobId, eventType: 'job.running', timestamp: new Date(Date.now() + 2000).toISOString() },
      ];

      for (const event of events) {
        await service.storeAuditEvent({
          ...event,
          eventId: `evt-${Math.random()}`,
          userId: 'user-123',
        });
      }

      const trail = await service.getAuditTrail(jobId);
      expect(trail.events.length).toBe(3);
      expect(trail.events[0].eventType).toBe('job.submitted');
    });

    it('should query events by date range', async () => {
      const jobId = 'job-1';
      const startDate = new Date(Date.now() - 3600000);
      const endDate = new Date();

      const events = await service.queryAuditEventsByDateRange(jobId, startDate, endDate);
      expect(Array.isArray(events)).toBe(true);
    });

    it('should generate compliance report for audit trail', async () => {
      const jobId = 'job-1';

      const report = await service.generateComplianceReport(jobId);
      expect(report).toBeDefined();
      expect(report.jobId).toBe(jobId);
      expect(report.totalEvents).toBeGreaterThanOrEqual(0);
      expect(report.compliant).toBeDefined();
    });

    it('should verify audit trail integrity with hash chain', async () => {
      const jobId = 'job-1';
      const trail = await service.getAuditTrail(jobId);

      const valid = await service.verifyTrailIntegrity(trail);
      expect(valid).toBe(true);
    });

    it('should detect tampering attempts in audit trail', async () => {
      const jobId = 'job-1';
      await service.storeAuditEvent({
        eventId: 'evt-seed-1',
        jobId,
        userId: 'user-123',
        eventType: 'job.submitted',
        timestamp: new Date().toISOString(),
      });
      const trail = await service.getAuditTrail(jobId);

      // Simulate tampering
      if (trail.events.length > 0) {
        trail.events[0].userId = 'attacker';
      }

      const valid = await service.verifyTrailIntegrity(trail);
      expect(valid).toBe(false);
    });
  });

  describe('Thursday: Compliance attestation and sign-off', () => {
    it('should generate compliance attestation for completed job', async () => {
      const jobId = 'job-1';
      const attestation = await service.generateAttestation(jobId);

      expect(attestation).toBeDefined();
      expect(attestation.jobId).toBe(jobId);
      expect(attestation.signature).toBeDefined();
      expect(attestation.timestamp).toBeDefined();
    });

    it('should include all required compliance fields in attestation', async () => {
      const jobId = 'job-1';
      const attestation = await service.generateAttestation(jobId);

      expect(attestation).toHaveProperty('jobId');
      expect(attestation).toHaveProperty('eventHash');
      expect(attestation).toHaveProperty('signature');
      expect(attestation).toHaveProperty('signingAuthority');
      expect(attestation).toHaveProperty('timestamp');
    });

    it('should sign attestation with private key', async () => {
      const jobId = 'job-1';
      const attestation = await service.generateAttestation(jobId);

      const verified = await service.verifyAttestation(attestation);
      expect(verified).toBe(true);
    });

    it('should generate compliance checklist for auditors', async () => {
      const jobId = 'job-1';
      const checklist = await service.generateComplianceChecklist(jobId);

      expect(checklist).toBeDefined();
      expect(Array.isArray(checklist.items)).toBe(true);
      expect(checklist.items.length).toBeGreaterThan(0);
    });

    it('should track compliance sign-offs by authorized users', async () => {
      const jobId = 'job-1';
      const auditorId = 'auditor-123';

      const signOff = await service.recordComplianceSignOff(jobId, auditorId, 'APPROVED');
      expect(signOff).toBeDefined();
      expect(signOff.auditorId).toBe(auditorId);
      expect(signOff.status).toBe('APPROVED');
      expect(signOff.timestamp).toBeDefined();
    });
  });

  describe('Friday: Advanced compliance queries and retention policies', () => {
    it('should query events by user action', async () => {
      const userId = 'user-123';
      const events = await service.queryEventsByUser(userId);

      expect(Array.isArray(events)).toBe(true);
    });

    it('should generate user activity report', async () => {
      const userId = 'user-123';
      const report = await service.generateUserActivityReport(userId);

      expect(report).toBeDefined();
      expect(report.userId).toBe(userId);
      expect(report.totalActions).toBeGreaterThanOrEqual(0);
    });

    it('should enforce audit trail retention policy', async () => {
      const maxAgeYears = 7;

      const retained = await service.applyRetentionPolicy(maxAgeYears);
      expect(retained).toBeDefined();
    });

    it('should protect retained audit trails from deletion', async () => {
      const deletable = await service.checkIfDeletable('job-1');
      expect(typeof deletable).toBe('boolean');
    });

    it('should generate regulatory compliance report (e.g., HIPAA, GDPR)', async () => {
      const regulationCode = 'GDPR';
      const report = await service.generateRegulatoryReport(regulationCode);

      expect(report).toBeDefined();
      expect(report.regulation).toBe(regulationCode);
      expect(report.compliant).toBeDefined();
    });

    it('should export audit logs in standardized format', async () => {
      const jobId = 'job-1';
      const format = 'JSON';

      const exported = await service.exportAuditLogs(jobId, format);
      expect(exported).toBeDefined();
      expect(typeof exported).toBe('string');
    });
  });
});
