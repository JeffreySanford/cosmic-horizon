import { Test, TestingModule } from '@nestjs/testing';
import { EachMessagePayload } from 'kafkajs';
import { MetricsConsumer } from '../consumers/metrics.consumer';
import { JobEventsConsumer } from '../../notifications/consumers/job-events.consumer';
import { MetricsService } from '../services/metrics.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { KafkaService } from '../kafka.service';

describe('Week 3 Error and Recovery Scenarios', () => {
  let moduleRef: TestingModule;
  let metricsConsumer: MetricsConsumer;
  let jobEventsConsumer: JobEventsConsumer;
  let kafkaService: jest.Mocked<KafkaService>;
  let metricsService: jest.Mocked<MetricsService>;
  let notificationService: jest.Mocked<NotificationService>;

  let metricsHandler: (payload: EachMessagePayload) => Promise<void>;
  let jobHandler: (payload: EachMessagePayload) => Promise<void>;

  beforeEach(async () => {
    kafkaService = {
      isConnected: jest.fn().mockReturnValue(true),
      subscribe: jest.fn().mockImplementation(
        async (_groupId: string, topics: string[], handler: (payload: EachMessagePayload) => Promise<void>) => {
          if (topics.includes('job-metrics')) {
            metricsHandler = handler;
          }
          if (topics.includes('job-lifecycle')) {
            jobHandler = handler;
          }
        },
      ),
      disconnect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<KafkaService>;

    metricsService = {
      aggregateJobMetrics: jest.fn().mockResolvedValue(undefined),
      getJobMetricsSummary: jest.fn().mockResolvedValue({
        job_id: 'job-1',
        avg_cpu_usage_percent: 50,
        avg_memory_usage_mb: 1000,
        max_cpu_usage_percent: 50,
        max_memory_usage_mb: 1000,
        sample_count: 1,
      }),
      broadcastMetricsUpdate: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<MetricsService>;

    notificationService = {
      sendJobCompletionEmail: jest.fn().mockResolvedValue(undefined),
      sendJobFailureNotification: jest.fn().mockResolvedValue(undefined),
      broadcastViaWebSocket: jest.fn().mockResolvedValue(undefined),
      storeInAppNotification: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<NotificationService>;

    moduleRef = await Test.createTestingModule({
      providers: [
        MetricsConsumer,
        JobEventsConsumer,
        { provide: KafkaService, useValue: kafkaService },
        { provide: MetricsService, useValue: metricsService },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    metricsConsumer = moduleRef.get(MetricsConsumer);
    jobEventsConsumer = moduleRef.get(JobEventsConsumer);
    await metricsConsumer.onModuleInit();
    await jobEventsConsumer.onModuleInit();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('recovers from metrics aggregation errors and continues consuming', async () => {
    metricsService.aggregateJobMetrics.mockRejectedValueOnce(new Error('aggregation failed'));

    await expect(
      metricsHandler({
        message: {
          value: Buffer.from(
            JSON.stringify({
              event_type: 'job.metrics_recorded',
              job_id: 'job-1',
              cpu_usage_percent: 55,
              memory_usage_mb: 1200,
              execution_time_seconds: 40,
              timestamp: new Date().toISOString(),
            }),
          ),
        },
      } as EachMessagePayload),
    ).resolves.toBeUndefined();

    await expect(
      metricsHandler({
        message: {
          value: Buffer.from(
            JSON.stringify({
              event_type: 'job.metrics_recorded',
              job_id: 'job-1',
              cpu_usage_percent: 65,
              memory_usage_mb: 1300,
              execution_time_seconds: 41,
              timestamp: new Date().toISOString(),
            }),
          ),
        },
      } as EachMessagePayload),
    ).resolves.toBeUndefined();

    expect(metricsService.aggregateJobMetrics).toHaveBeenCalledTimes(2);
  });

  it('handles malformed metric event payload without crashing', async () => {
    await expect(
      metricsHandler({
        message: { value: Buffer.from('{not-json') },
      } as EachMessagePayload),
    ).resolves.toBeUndefined();

    expect(metricsService.aggregateJobMetrics).not.toHaveBeenCalled();
  });

  it('handles malformed job-lifecycle payload without downstream notification calls', async () => {
    await expect(
      jobHandler({
        message: { value: Buffer.from('{bad-json') },
      } as EachMessagePayload),
    ).resolves.toBeUndefined();

    expect(notificationService.sendJobCompletionEmail).not.toHaveBeenCalled();
    expect(notificationService.sendJobFailureNotification).not.toHaveBeenCalled();
  });

  it('handles missing required lifecycle fields without throwing', async () => {
    await expect(
      jobHandler({
        message: {
          value: Buffer.from(JSON.stringify({ event_type: 'job.completed' })),
        },
      } as EachMessagePayload),
    ).resolves.toBeUndefined();

    expect(notificationService.sendJobCompletionEmail).toHaveBeenCalledTimes(1);
  });

  it('continues processing after notification broadcast failure', async () => {
    notificationService.broadcastViaWebSocket.mockRejectedValueOnce(new Error('socket down'));

    await expect(
      jobHandler({
        message: {
          value: Buffer.from(
            JSON.stringify({
              event_type: 'job.failed',
              job_id: 'job-2',
              user_id: 'user-2',
              error_message: 'failed',
              error_code: 500,
              timestamp: new Date().toISOString(),
            }),
          ),
        },
      } as EachMessagePayload),
    ).resolves.toBeUndefined();

    await expect(
      jobHandler({
        message: {
          value: Buffer.from(
            JSON.stringify({
              event_type: 'job.cancelled',
              job_id: 'job-2',
              user_id: 'user-2',
              timestamp: new Date().toISOString(),
            }),
          ),
        },
      } as EachMessagePayload),
    ).resolves.toBeUndefined();

    expect(notificationService.storeInAppNotification).toHaveBeenCalled();
  });
});
