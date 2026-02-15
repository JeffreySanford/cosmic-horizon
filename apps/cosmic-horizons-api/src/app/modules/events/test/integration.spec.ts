import {
  ComplianceAuditorService,
  AuditEvent,
} from '../../audit/services/compliance-auditor.service';
import { SystemHealthMonitorService } from '../../health/services/system-health-monitor.service';

describe('Week 3 Integration and Compliance', () => {
  let complianceAuditorService: ComplianceAuditorService;
  let systemHealthMonitorService: SystemHealthMonitorService;

  beforeEach(() => {
    complianceAuditorService = new ComplianceAuditorService();
    systemHealthMonitorService = new SystemHealthMonitorService();
  });

  it('stores immutable audit hashes and changes hash for changed event content', async () => {
    const eventA: AuditEvent = {
      event_id: 'audit-1',
      job_id: 'job-1',
      user_id: 'user-1',
      event_type: 'job.submitted',
      timestamp: '2026-02-27T10:00:00Z',
      details: { stage: 'submitted' },
    };

    const eventB: AuditEvent = {
      event_id: 'audit-2',
      job_id: 'job-1',
      user_id: 'user-1',
      event_type: 'job.completed',
      timestamp: '2026-02-27T10:05:00Z',
      details: { stage: 'completed' },
    };

    await complianceAuditorService.storeImmutableEvent(eventA);
    await complianceAuditorService.storeImmutableEvent(eventB);

    const events = complianceAuditorService.getAllEvents();
    expect(events[0].immutable_hash).toBeDefined();
    expect(events[1].immutable_hash).toBeDefined();
    expect(events[0].immutable_hash).not.toEqual(events[1].immutable_hash);
  });

  it('transitions health status from healthy to unhealthy when thresholds are exceeded', async () => {
    await systemHealthMonitorService.processHealthEvent({
      job_id: 'job-healthy',
      timestamp: new Date().toISOString(),
      error_rate: 2,
      consumer_lag: 3000,
      available_memory_mb: 3000,
      cpu_usage_percent: 45,
    });

    const healthy = await systemHealthMonitorService.getHealthStatus();
    expect(healthy.overall_healthy).toBe(true);

    await systemHealthMonitorService.processHealthEvent({
      job_id: 'job-unhealthy',
      timestamp: new Date().toISOString(),
      error_rate: 8,
      consumer_lag: 12000,
      available_memory_mb: 800,
      cpu_usage_percent: 85,
    });

    const unhealthy = await systemHealthMonitorService.getHealthStatus();
    expect(unhealthy.overall_healthy).toBe(false);
    expect(unhealthy.error_rate_threshold_exceeded).toBe(true);
    expect(unhealthy.consumer_lag_threshold_exceeded).toBe(true);
    expect(unhealthy.alerts.length).toBeGreaterThan(0);
  });

  it('generates a compliance report with covered jobs and retention compliance', async () => {
    for (let i = 0; i < 10; i++) {
      await complianceAuditorService.storeImmutableEvent({
        event_id: `audit-${i}`,
        job_id: `job-${i}`,
        user_id: 'user-1',
        event_type: 'job.completed',
        timestamp: new Date().toISOString(),
        details: { index: i },
      });
    }

    const report = await complianceAuditorService.generateComplianceReport();
    expect(report.total_events).toBe(10);
    expect(report.jobs_covered).toBe(10);
    expect(report.retention_compliant).toBe(true);
  });
});
