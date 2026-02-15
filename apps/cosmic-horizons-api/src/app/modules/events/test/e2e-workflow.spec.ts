import { Test, TestingModule } from '@nestjs/testing';
import { EachMessagePayload } from 'kafkajs';
import { JobOrchestratorService } from '../../../jobs/services/job-orchestrator.service';
import { JobRepository } from '../../../jobs/repositories/job.repository';
import { TaccIntegrationService } from '../../../jobs/tacc-integration.service';
import { EventsService } from '../events.service';
import { KafkaService } from '../kafka.service';
import { MetricsConsumer } from '../consumers/metrics.consumer';
import { MetricsService } from '../services/metrics.service';
import { JobEventsConsumer } from '../../notifications/consumers/job-events.consumer';
import { NotificationService } from '../../notifications/services/notification.service';
import { AuditTrailConsumer } from '../../audit/consumers/audit-trail.consumer';
import { ComplianceAuditorService } from '../../audit/services/compliance-auditor.service';
import { SystemHealthConsumer } from '../../health/consumers/system-health.consumer';
import { SystemHealthMonitorService } from '../../health/services/system-health-monitor.service';

describe('Week 3 E2E Workflow', () => {
  let jobOrchestratorService: JobOrchestratorService;
  let kafkaService: jest.Mocked<KafkaService>;
  let metricsService: jest.Mocked<MetricsService>;
  let notificationService: jest.Mocked<NotificationService>;
  let complianceAuditorService: jest.Mocked<ComplianceAuditorService>;
  let systemHealthMonitorService: jest.Mocked<SystemHealthMonitorService>;

  const handlersByTopic: Record<string, (payload: EachMessagePayload) => Promise<void>> = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobOrchestratorService,
        MetricsConsumer,
        JobEventsConsumer,
        AuditTrailConsumer,
        SystemHealthConsumer,
        {
          provide: JobRepository,
          useValue: {
            create: jest.fn().mockResolvedValue({
              id: 'job-e2e-1',
              user_id: 'user-1',
              agent: 'AlphaCal',
              dataset_id: 'dataset-1',
              status: 'QUEUED',
              progress: 0,
              params: {},
              created_at: new Date(),
              updated_at: new Date(),
            }),
            updateStatus: jest.fn().mockResolvedValue(undefined),
            findById: jest.fn().mockResolvedValue({
              id: 'job-e2e-1',
              tacc_job_id: 'tacc-1',
              status: 'QUEUING',
              created_at: new Date(),
              updated_at: new Date(),
            }),
            updateResult: jest.fn().mockResolvedValue(undefined),
            updateProgress: jest.fn().mockResolvedValue(undefined),
            findByUser: jest.fn().mockResolvedValue([[], 0]),
            search: jest.fn().mockResolvedValue([[], 0]),
          },
        },
        {
          provide: TaccIntegrationService,
          useValue: {
            submitJob: jest.fn().mockResolvedValue({ jobId: 'tacc-1' }),
            getJobStatus: jest.fn().mockResolvedValue({ status: 'RUNNING', progress: 0.5 }),
            cancelJob: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: EventsService,
          useValue: {
            publishJobEvent: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: KafkaService,
          useValue: {
            isConnected: jest.fn().mockReturnValue(true),
            subscribe: jest
              .fn()
              .mockImplementation(
                async (_groupId: string, topics: string[], handler: (payload: EachMessagePayload) => Promise<void>) => {
                  for (const topic of topics) {
                    handlersByTopic[topic] = handler;
                  }
                },
              ),
            publishJobLifecycleEvent: jest.fn().mockResolvedValue(undefined),
            publishJobMetrics: jest.fn().mockResolvedValue(undefined),
            disconnect: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            aggregateJobMetrics: jest.fn().mockResolvedValue(undefined),
            getJobMetricsSummary: jest.fn().mockResolvedValue({
              job_id: 'job-e2e-1',
              avg_cpu_usage_percent: 50,
              avg_memory_usage_mb: 1024,
              max_cpu_usage_percent: 50,
              max_memory_usage_mb: 1024,
              sample_count: 1,
            }),
            broadcastMetricsUpdate: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendJobCompletionEmail: jest.fn().mockResolvedValue(undefined),
            sendJobFailureNotification: jest.fn().mockResolvedValue(undefined),
            broadcastViaWebSocket: jest.fn().mockResolvedValue(undefined),
            storeInAppNotification: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ComplianceAuditorService,
          useValue: {
            storeImmutableEvent: jest.fn().mockResolvedValue(undefined),
            verifyRetentionPolicy: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: SystemHealthMonitorService,
          useValue: {
            processHealthEvent: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    jobOrchestratorService = module.get(JobOrchestratorService);
    kafkaService = module.get(KafkaService);
    metricsService = module.get(MetricsService);
    notificationService = module.get(NotificationService);
    complianceAuditorService = module.get(ComplianceAuditorService);
    systemHealthMonitorService = module.get(SystemHealthMonitorService);

    await module.get(MetricsConsumer).onModuleInit();
    await module.get(JobEventsConsumer).onModuleInit();
    await module.get(AuditTrailConsumer).onModuleInit();
    await module.get(SystemHealthConsumer).onModuleInit();
  });

  it('processes completed workflow across metrics, notification, and audit consumers', async () => {
    await handlersByTopic['job-lifecycle']({
      message: {
        value: Buffer.from(
          JSON.stringify({
            event_type: 'job.completed',
            job_id: 'job-e2e-1',
            user_id: 'user-1',
            result_url: 'https://results/job-e2e-1',
            execution_time_seconds: 3600,
            timestamp: new Date().toISOString(),
          }),
        ),
      },
    } as EachMessagePayload);

    await handlersByTopic['job-metrics']({
      message: {
        value: Buffer.from(
          JSON.stringify({
            event_type: 'job.metrics_recorded',
            job_id: 'job-e2e-1',
            cpu_usage_percent: 72,
            memory_usage_mb: 2048,
            execution_time_seconds: 3600,
            timestamp: new Date().toISOString(),
          }),
        ),
      },
    } as EachMessagePayload);

    await handlersByTopic['audit-trail']({
      message: {
        value: Buffer.from(
          JSON.stringify({
            event_id: 'audit-1',
            event_type: 'job.completed',
            job_id: 'job-e2e-1',
            user_id: 'user-1',
            timestamp: new Date().toISOString(),
            details: { status: 'COMPLETED' },
          }),
        ),
      },
    } as EachMessagePayload);

    expect(notificationService.sendJobCompletionEmail).toHaveBeenCalledTimes(1);
    expect(metricsService.aggregateJobMetrics).toHaveBeenCalledTimes(1);
    expect(complianceAuditorService.storeImmutableEvent).toHaveBeenCalledTimes(1);
  });

  it('processes failure workflow and health signal', async () => {
    await handlersByTopic['job-lifecycle']({
      message: {
        value: Buffer.from(
          JSON.stringify({
            event_type: 'job.failed',
            job_id: 'job-e2e-1',
            user_id: 'user-1',
            error_message: 'calibration failed',
            error_code: 500,
            timestamp: new Date().toISOString(),
          }),
        ),
      },
    } as EachMessagePayload);

    await handlersByTopic['system-health']({
      message: {
        value: Buffer.from(
          JSON.stringify({
            job_id: 'job-e2e-1',
            timestamp: new Date().toISOString(),
            error_rate: 7,
            consumer_lag: 12000,
            available_memory_mb: 1024,
            cpu_usage_percent: 80,
          }),
        ),
      },
    } as EachMessagePayload);

    expect(notificationService.sendJobFailureNotification).toHaveBeenCalledTimes(1);
    expect(systemHealthMonitorService.processHealthEvent).toHaveBeenCalledTimes(1);
  });

  it('handles cancellation event and stores in-app notification', async () => {
    await handlersByTopic['job-lifecycle']({
      message: {
        value: Buffer.from(
          JSON.stringify({
            event_type: 'job.cancelled',
            job_id: 'job-e2e-1',
            user_id: 'user-1',
            timestamp: new Date().toISOString(),
          }),
        ),
      },
    } as EachMessagePayload);

    expect(notificationService.broadcastViaWebSocket).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'job_cancelled', job_id: 'job-e2e-1' }),
    );
    expect(notificationService.storeInAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'job_cancelled', job_id: 'job-e2e-1' }),
    );
  });

  it('uses job_id partition key for ordering when publishing from JobOrchestratorService', async () => {
    await jobOrchestratorService.submitJob('user-1', {
      agent: 'AlphaCal',
      dataset_id: 'dataset-1',
      params: { gpu_count: 2 },
    });

    expect(kafkaService.publishJobLifecycleEvent).toHaveBeenCalled();
    for (const call of kafkaService.publishJobLifecycleEvent.mock.calls) {
      expect(call[1]).toBe('job-e2e-1');
    }
  });

  it('keeps processing valid events after malformed payload in one consumer', async () => {
    await handlersByTopic['job-lifecycle']({
      message: { value: Buffer.from('not-json') },
    } as EachMessagePayload);

    await handlersByTopic['job-lifecycle']({
      message: {
        value: Buffer.from(
          JSON.stringify({
            event_type: 'job.completed',
            job_id: 'job-e2e-1',
            user_id: 'user-1',
            result_url: 'https://results/job-e2e-1',
            execution_time_seconds: 1200,
            timestamp: new Date().toISOString(),
          }),
        ),
      },
    } as EachMessagePayload);

    expect(notificationService.sendJobCompletionEmail).toHaveBeenCalledTimes(1);
  });
});
