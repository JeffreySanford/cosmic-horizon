import { Test, TestingModule } from '@nestjs/testing';
import { EachMessagePayload } from 'kafkajs';
import { SystemHealthConsumer } from '../system-health.consumer';
import {
  SystemHealthMonitorService,
  HealthMetric,
} from '../../services/system-health-monitor.service';
import { KafkaService } from '../../../events/kafka.service';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('SystemHealthConsumer', () => {
  let consumer: SystemHealthConsumer;
  let kafkaService: jest.Mocked<KafkaService>;
  let systemHealthMonitorService: jest.Mocked<SystemHealthMonitorService>;

  beforeEach(async () => {
    kafkaService = {
      subscribe: jest.fn(),
      disconnect: jest.fn().mockResolvedValue(undefined),
    } as any;

    systemHealthMonitorService = {
      processHealthEvent: jest.fn().mockResolvedValue(undefined),
      checkErrorRateThreshold: jest.fn().mockResolvedValue(undefined),
      checkConsumerLagThreshold: jest.fn().mockResolvedValue(undefined),
      triggerAlert: jest.fn().mockResolvedValue(undefined),
      getHealthStatus: jest.fn().mockResolvedValue({
        overall_healthy: true,
        error_rate_threshold_exceeded: false,
        consumer_lag_threshold_exceeded: false,
        alerts: [],
        last_check: '2026-02-20T10:00:00Z',
      }),
      clearMetrics: jest.fn(),
      getAllMetrics: jest.fn().mockReturnValue([]),
      getAlerts: jest.fn().mockReturnValue([]),
    } as any;

    testingModule = await Test.createTestingModule({
      providers: [
        SystemHealthConsumer,
        { provide: KafkaService, useValue: kafkaService },
        {
          provide: SystemHealthMonitorService,
          useValue: systemHealthMonitorService,
        },
      ],
    }).compile();

    consumer = testingModule.get<SystemHealthConsumer>(SystemHealthConsumer);
  });

  describe('onModuleInit', () => {
    it('should subscribe to system-health topic', async () => {
      await consumer.onModuleInit();

      expect(kafkaService.subscribe).toHaveBeenCalledWith(
        'health-consumer-group',
        ['system-health'],
        expect.any(Function),
      );
    });
  });

  describe('handleHealthEvent - Process Metric', () => {
    it('should process health metric event', async () => {
      const mockMetric: HealthMetric = {
        job_id: 'job-123',
        timestamp: '2026-02-20T10:00:00Z',
        error_rate: 2,
        consumer_lag: 5000,
        available_memory_mb: 2048,
        cpu_usage_percent: 45,
      };

      let handler: any;
      kafkaService.subscribe.mockImplementation(
        async (_groupId, _topics, h) => {
          handler = h;
        },
      );

      await consumer.onModuleInit();

      const mockPayload = {
        message: { value: Buffer.from(JSON.stringify(mockMetric)) },
      } as EachMessagePayload;

      await handler(mockPayload);

      expect(
        systemHealthMonitorService.processHealthEvent,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          job_id: 'job-123',
          error_rate: 2,
          consumer_lag: 5000,
        }),
      );
    });
  });

  describe('handleHealthEvent - Error Rate Threshold', () => {
    it('should detect high error rate threshold violation', async () => {
      const mockMetric: HealthMetric = {
        job_id: 'job-124',
        timestamp: '2026-02-20T10:01:00Z',
        error_rate: 8, // Exceeds 5% threshold
        consumer_lag: 3000,
        available_memory_mb: 2048,
        cpu_usage_percent: 65,
      };

      let handler: any;
      kafkaService.subscribe.mockImplementation(
        async (_groupId, _topics, h) => {
          handler = h;
        },
      );

      await consumer.onModuleInit();

      const mockPayload = {
        message: { value: Buffer.from(JSON.stringify(mockMetric)) },
      } as EachMessagePayload;

      await handler(mockPayload);

      expect(systemHealthMonitorService.processHealthEvent).toHaveBeenCalled();
    });
  });

  describe('handleHealthEvent - Consumer Lag Threshold', () => {
    it('should detect high consumer lag threshold violation', async () => {
      const mockMetric: HealthMetric = {
        job_id: 'job-125',
        timestamp: '2026-02-20T10:02:00Z',
        error_rate: 2,
        consumer_lag: 15000, // Exceeds 10 second threshold
        available_memory_mb: 2048,
        cpu_usage_percent: 50,
      };

      let handler: any;
      kafkaService.subscribe.mockImplementation(
        async (_groupId, _topics, h) => {
          handler = h;
        },
      );

      await consumer.onModuleInit();

      const mockPayload = {
        message: { value: Buffer.from(JSON.stringify(mockMetric)) },
      } as EachMessagePayload;

      await handler(mockPayload);

      expect(
        systemHealthMonitorService.processHealthEvent,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          consumer_lag: 15000,
        }),
      );
    });
  });

  describe('handleHealthEvent - Multiple Metrics', () => {
    it('should handle multiple health metrics sequentially', async () => {
      const mockMetrics: HealthMetric[] = [
        {
          job_id: 'job-126',
          timestamp: '2026-02-20T10:03:00Z',
          error_rate: 1,
          consumer_lag: 2000,
          available_memory_mb: 2048,
          cpu_usage_percent: 40,
        },
        {
          job_id: 'job-127',
          timestamp: '2026-02-20T10:04:00Z',
          error_rate: 3,
          consumer_lag: 4000,
          available_memory_mb: 1800,
          cpu_usage_percent: 55,
        },
        {
          job_id: 'job-128',
          timestamp: '2026-02-20T10:05:00Z',
          error_rate: 2,
          consumer_lag: 3500,
          available_memory_mb: 2100,
          cpu_usage_percent: 48,
        },
      ];

      let handler: any;
      kafkaService.subscribe.mockImplementation(
        async (_groupId, _topics, h) => {
          handler = h;
        },
      );

      await consumer.onModuleInit();

      for (const metric of mockMetrics) {
        const mockPayload = {
          message: { value: Buffer.from(JSON.stringify(metric)) },
        } as EachMessagePayload;

        await handler(mockPayload);
      }

      expect(
        systemHealthMonitorService.processHealthEvent,
      ).toHaveBeenCalledTimes(3);
    });
  });

  describe('handleHealthEvent - Resource Monitoring', () => {
    it('should track memory and CPU usage in health metrics', async () => {
      const mockMetric: HealthMetric = {
        job_id: 'job-129',
        timestamp: '2026-02-20T10:06:00Z',
        error_rate: 1.5,
        consumer_lag: 2500,
        available_memory_mb: 512, // Low memory
        cpu_usage_percent: 85, // High CPU
      };

      let handler: any;
      kafkaService.subscribe.mockImplementation(
        async (_groupId, _topics, h) => {
          handler = h;
        },
      );

      await consumer.onModuleInit();

      const mockPayload = {
        message: { value: Buffer.from(JSON.stringify(mockMetric)) },
      } as EachMessagePayload;

      await handler(mockPayload);

      expect(
        systemHealthMonitorService.processHealthEvent,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          available_memory_mb: 512,
          cpu_usage_percent: 85,
        }),
      );
    });
  });

  describe('handleHealthEvent - Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      let handler: any;
      kafkaService.subscribe.mockImplementation(
        async (_groupId, _topics, h) => {
          handler = h;
        },
      );

      await consumer.onModuleInit();

      const mockPayload = {
        message: { value: Buffer.from('invalid json') },
      } as EachMessagePayload;

      // Should not throw
      await expect(handler(mockPayload)).resolves.not.toThrow();

      // Should not call health service
      expect(
        systemHealthMonitorService.processHealthEvent,
      ).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from Kafka', async () => {
      await consumer.onModuleDestroy();

      expect(kafkaService.disconnect).toHaveBeenCalled();
    });
  });
});
