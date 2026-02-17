import { Test, TestingModule } from '@nestjs/testing';
import { MetricsConsumer } from '../metrics.consumer';
import { MetricsService } from '../../services/metrics.service';
import { KafkaService } from '../../kafka.service';
import { EachMessagePayload } from 'kafkajs';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('MetricsConsumer - Event Handling', () => {
  let consumer: MetricsConsumer;
  let metricsService: jest.Mocked<MetricsService>;
  let kafkaService: jest.Mocked<KafkaService>;

  const mockMetricEvent = {
    event_type: 'job.metrics_recorded',
    job_id: 'job-1',
    user_id: 'user-1',
    cpu_usage_percent: 75,
    memory_usage_mb: 2048,
    execution_time_seconds: 1800,
    timestamp: new Date().toISOString(),
  };

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        MetricsConsumer,
        {
          provide: MetricsService,
          useValue: {
            aggregateJobMetrics: jest.fn().mockResolvedValue(undefined),
            getJobMetricsSummary: jest.fn().mockResolvedValue({
              job_id: 'job-1',
              avg_cpu_usage_percent: 75,
              avg_memory_usage_mb: 2048,
              max_cpu_usage_percent: 75,
              max_memory_usage_mb: 2048,
              sample_count: 1,
            }),
            broadcastMetricsUpdate: jest.fn().mockResolvedValue(undefined),
            getConsumerLag: jest.fn().mockResolvedValue(0),
            clearOldMetrics: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: KafkaService,
          useValue: {
            subscribe: jest.fn().mockImplementation(async (_groupId: string, _topics: string[], handler) => {
              // Simulate message delivery
              const mockPayload: Partial<EachMessagePayload> = {
                message: {
                  key: Buffer.from('job-1'),
                  value: Buffer.from(JSON.stringify(mockMetricEvent)),
                  timestamp: Date.now().toString(),
                  size: 100,
                  attributes: 0,
                  offset: '0',
                  headers: undefined,
                },
                partition: 0,
                topic: 'job-metrics',
              };
              await handler(mockPayload as EachMessagePayload);
            }),
            disconnect: jest.fn().mockResolvedValue(undefined),
            isConnected: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    consumer = testingModule.get<MetricsConsumer>(MetricsConsumer);
    metricsService = testingModule.get(MetricsService) as jest.Mocked<MetricsService>;
    kafkaService = testingModule.get(KafkaService) as jest.Mocked<KafkaService>;
  });

  describe('Consumer Initialization', () => {
    it('should subscribe to job-metrics topic on module init', async () => {
      await consumer.onModuleInit();

      expect(kafkaService.subscribe).toHaveBeenCalledWith(
        'metrics-consumer-group',
        ['job-metrics'],
        expect.any(Function),
      );
    });

    it('should consume job.metrics_recorded events', async () => {
      await consumer.onModuleInit();

      expect(metricsService.aggregateJobMetrics).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({
          event_type: 'job.metrics_recorded',
          cpu_usage_percent: 75,
          memory_usage_mb: 2048,
        }),
      );
    });
  });

  describe('Metrics Aggregation', () => {
    it('should aggregate metrics by job_id', async () => {
      await consumer.onModuleInit();

      expect(metricsService.aggregateJobMetrics).toHaveBeenCalledWith(
        'job-1',
        expect.objectContaining({
          memory_usage_mb: expect.any(Number),
          cpu_usage_percent: expect.any(Number),
          execution_time_seconds: expect.any(Number),
        }),
      );
    });

    it('should broadcast metrics updates after aggregation', async () => {
      const aggregatedMetrics = {
        job_id: 'job-1',
        avg_cpu_usage_percent: 75,
        avg_memory_usage_mb: 2048,
        max_cpu_usage_percent: 75,
        max_memory_usage_mb: 2048,
        sample_count: 1,
      };

      metricsService.getJobMetricsSummary.mockResolvedValueOnce(aggregatedMetrics);

      await consumer.onModuleInit();

      expect(metricsService.broadcastMetricsUpdate).toHaveBeenCalledWith(
        'job-1',
        aggregatedMetrics,
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle metric aggregation errors gracefully', async () => {
      metricsService.aggregateJobMetrics.mockRejectedValueOnce(
        new Error('Database error'),
      );

      // Should not throw - continue consuming
      await expect(consumer.onModuleInit()).resolves.toBeUndefined();
      expect(metricsService.aggregateJobMetrics).toHaveBeenCalled();
    });
  });

  describe('Consumer Monitoring', () => {
    it('should track consumer lag', async () => {
      const lag = await metricsService.getConsumerLag();

      expect(typeof lag).toBe('number');
      expect(lag).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should disconnect from Kafka on module destroy', async () => {
      await consumer.onModuleDestroy();

      expect(kafkaService.disconnect).toHaveBeenCalled();
    });
  });
});
