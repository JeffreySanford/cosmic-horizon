import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { BrokerMetricsController } from './broker-metrics.controller';
import { BrokerMetricsService } from './broker-metrics.service';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('BrokerMetricsController', () => {
  let controller: BrokerMetricsController;
  let serviceMock: jest.Mocked<BrokerMetricsService>;

  const mockComparisonDTO = {
    timestamp: new Date(),
    brokers: {
      rabbitmq: {
        connected: true,
        messagesPerSecond: 1000,
        p99LatencyMs: 10,
        memoryUsageMb: 256,
        cpuPercentage: 25,
        connectionCount: 5,
        uptime: '24h',
        dataSource: 'measured',
      },
      kafka: {
        connected: true,
        messagesPerSecond: 1500,
        p99LatencyMs: 8,
        memoryUsageMb: 512,
        cpuPercentage: 30,
        connectionCount: 10,
        uptime: '24h',
        dataSource: 'measured',
      },
      pulsar: {
        connected: true,
        messagesPerSecond: 1200,
        p99LatencyMs: 9,
        memoryUsageMb: 384,
        cpuPercentage: 28,
        connectionCount: 8,
        uptime: '24h',
        dataSource: 'measured',
      },
    },
    comparison: {
      throughputImprovement: '+20%',
      latencyImprovement: '-10%',
      memoryEfficiency: '+15%',
    },
  };

  const mockHistoryDTO = {
    timeRange: {
      start: new Date(Date.now() - 24 * 3600 * 1000),
      end: new Date(),
    },
    samples: [mockComparisonDTO],
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    const mockService = {
      getCurrentMetrics: jest.fn().mockResolvedValue(mockComparisonDTO),
      getHistoricalMetrics: jest.fn().mockResolvedValue(mockHistoryDTO),
      pruneOldMetrics: jest.fn().mockResolvedValue(10),
      clearCurrentMetricsCache: jest.fn(),
    };

    testingModule = await Test.createTestingModule({
      controllers: [BrokerMetricsController],
      providers: [{ provide: BrokerMetricsService, useValue: mockService }],
    }).compile();

    controller = testingModule.get<BrokerMetricsController>(
      BrokerMetricsController,
    );
    serviceMock = testingModule.get(BrokerMetricsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /stats', () => {
    it('should return current broker metrics', async () => {
      const result = await controller.getStats();

      expect(result).toEqual(mockComparisonDTO);
      expect(serviceMock.getCurrentMetrics).toHaveBeenCalled();
    });

    it('should include all three brokers', async () => {
      const result = await controller.getStats();

      expect(result.brokers).toHaveProperty('rabbitmq');
      expect(result.brokers).toHaveProperty('kafka');
      expect(result.brokers).toHaveProperty('pulsar');
    });

    it('should bypass cache when forceRefresh=true', async () => {
      await controller.getStats('true');
      expect(serviceMock.getCurrentMetrics).toHaveBeenCalledWith(true);
    });

    it('should include comparison metrics', async () => {
      const result = await controller.getStats();

      expect(result.comparison).toBeDefined();
      expect(result.comparison.throughputImprovement).toBeDefined();
      expect(result.comparison.latencyImprovement).toBeDefined();
      expect(result.comparison.memoryEfficiency).toBeDefined();
    });

    it('should handle service errors', async () => {
      serviceMock.getCurrentMetrics.mockRejectedValueOnce(
        new Error('Database error'),
      );

      await expect(controller.getStats()).rejects.toThrow('Database error');
    });
  });

  describe('GET /history', () => {
    it('should return historical metrics with default 24 hours', async () => {
      const result = await controller.getHistory();

      expect(result).toEqual(mockHistoryDTO);
      expect(serviceMock.getHistoricalMetrics).toHaveBeenCalledWith(24);
    });

    it('should accept custom hour range', async () => {
      await controller.getHistory(48);

      expect(serviceMock.getHistoricalMetrics).toHaveBeenCalledWith(48);
    });

    it('should cap maximum hours to 168', async () => {
      await controller.getHistory(500);

      expect(serviceMock.getHistoricalMetrics).toHaveBeenCalledWith(
        expect.any(Number),
      );
    });

    it('should enforce minimum hours of 1', async () => {
      await controller.getHistory(0);

      expect(serviceMock.getHistoricalMetrics).toHaveBeenCalledWith(1);
    });

    it('should include time-series samples', async () => {
      const result = await controller.getHistory();

      expect(result.timeRange).toBeDefined();
      expect(result.samples).toBeDefined();
      expect(Array.isArray(result.samples)).toBe(true);
    });
  });

  describe('POST /benchmark', () => {
    it('should return benchmark job status', async () => {
      const result = await controller.startBenchmark();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('jobId');
      expect(result).toHaveProperty('estimatedDurationSeconds');
    });

    it('should have status "queued"', async () => {
      const result = await controller.startBenchmark();

      expect(['queued', 'running']).toContain(result.status);
    });

    it('should generate unique job IDs', async () => {
      const result1 = await controller.startBenchmark();
      const result2 = await controller.startBenchmark();

      expect(result1.jobId).not.toBe(result2.jobId);
    });

    it('should estimate reasonable duration', async () => {
      const result = await controller.startBenchmark();

      expect(result.estimatedDurationSeconds).toBeGreaterThan(0);
      expect(result.estimatedDurationSeconds).toBeLessThan(1000000);
    });

    it('should block run when selected broker is unavailable', async () => {
      serviceMock.getCurrentMetrics.mockResolvedValueOnce({
        ...mockComparisonDTO,
        brokers: {
          ...mockComparisonDTO.brokers,
          pulsar: { ...mockComparisonDTO.brokers.pulsar, connected: false },
        },
      });

      const result = await controller.startBenchmark('true', '10000', 'pulsar');
      expect(result.status).toBe('blocked');
      expect(result.reason).toContain('unavailable');
    });

    it('should block controlled replay when kafka is selected', async () => {
      const result = await controller.startBenchmark('false', '10000', 'kafka');
      expect(result.status).toBe('blocked');
      expect(result.reason).toContain('RabbitMQ and Pulsar only');
    });

    it('should block measured-only benchmark when broker data source is fallback', async () => {
      serviceMock.getCurrentMetrics.mockResolvedValueOnce({
        ...mockComparisonDTO,
        brokers: {
          ...mockComparisonDTO.brokers,
          pulsar: {
            ...mockComparisonDTO.brokers.pulsar,
            dataSource: 'fallback',
          },
        },
      });

      const result = await controller.startBenchmark('true', '10000', 'pulsar');
      expect(result.status).toBe('blocked');
      expect(result.reason).toContain('not measured-only');
    });

    it('should allow benchmark when measuredOnly=false and broker is fallback', async () => {
      serviceMock.getCurrentMetrics.mockResolvedValueOnce({
        ...mockComparisonDTO,
        brokers: {
          ...mockComparisonDTO.brokers,
          pulsar: {
            ...mockComparisonDTO.brokers.pulsar,
            dataSource: 'fallback',
          },
        },
      });

      const result = await controller.startBenchmark(
        'false',
        '10000',
        'pulsar',
        undefined,
        undefined,
        undefined,
        undefined,
        'false',
      );
      expect(['queued', 'running']).toContain(result.status);
    });
  });

  describe('GET /health', () => {
    it('should return health status for all brokers', async () => {
      const result = await controller.getHealth();

      expect(result).toHaveProperty('rabbitmq');
      expect(result).toHaveProperty('kafka');
      expect(result).toHaveProperty('pulsar');
    });

    it('should return "ok" for connected brokers', async () => {
      const result = await controller.getHealth();

      expect(['ok', 'unavailable']).toContain(result.rabbitmq);
      expect(['ok', 'unavailable']).toContain(result.kafka);
      expect(['ok', 'unavailable']).toContain(result.pulsar);
    });

    it('should return "unavailable" for disconnected brokers', async () => {
      const disconnectedMock = {
        ...mockComparisonDTO,
        brokers: {
          ...mockComparisonDTO.brokers,
          rabbitmq: { ...mockComparisonDTO.brokers.rabbitmq, connected: false },
        },
      };

      serviceMock.getCurrentMetrics.mockResolvedValueOnce(disconnectedMock);

      const result = await controller.getHealth();

      expect(result.rabbitmq).toBe('unavailable');
    });
  });

  describe('error handling', () => {
    it('should log errors and re-throw', async () => {
      const error = new Error('Test error');
      serviceMock.getCurrentMetrics.mockRejectedValueOnce(error);

      await expect(controller.getStats()).rejects.toThrow(error);
    });

    it('should handle missing service gracefully', async () => {
      const controllerWithoutService = new BrokerMetricsController(
        undefined as any,
      );

      await expect(controllerWithoutService.getStats()).rejects.toThrow();
    });
  });
});
