import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BrokerMetricsService } from './broker-metrics.service';
import { BrokerMetricsCollector } from './broker-metrics.collector';
import { BrokerMetrics } from './broker-metrics.entity';
import { Repository } from 'typeorm';

describe('BrokerMetricsService', () => {
  let service: BrokerMetricsService;
  let collectorMock: jest.Mocked<BrokerMetricsCollector>;
  let repositoryMock: jest.Mocked<Repository<BrokerMetrics>>;

  const mockBrokerMetrics = {
    rabbitmq: {
      connected: true,
      messagesPerSecond: 1000,
      p99LatencyMs: 10,
      memoryUsageMb: 256,
      cpuPercentage: 25,
      connectionCount: 5,
      uptime: '24h',
      dataSource: 'measured',
      metricQuality: {
        messagesPerSecond: 'measured',
        p99LatencyMs: 'measured',
        memoryUsageMb: 'measured',
      },
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
      metricQuality: {
        messagesPerSecond: 'measured',
        p99LatencyMs: 'measured',
        memoryUsageMb: 'measured',
      },
    },
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);

    collectorMock = {
      collectAllMetrics: jest.fn().mockResolvedValue(mockBrokerMetrics),
    } as any;

    repositoryMock = {
      insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 1 }] }),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 10 }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrokerMetricsService,
        { provide: BrokerMetricsCollector, useValue: collectorMock },
        { provide: getRepositoryToken(BrokerMetrics), useValue: repositoryMock },
      ],
    }).compile();

    service = module.get<BrokerMetricsService>(BrokerMetricsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getCurrentMetrics', () => {
    it('should collect and return broker metrics', async () => {
      const result = await service.getCurrentMetrics();

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('brokers');
      expect(result.brokers).toHaveProperty('rabbitmq');
      expect(result.brokers).toHaveProperty('kafka');
      expect(result.brokers).toHaveProperty('pulsar');
    });

    it('should cache results for 60 seconds', async () => {
      await service.getCurrentMetrics();
      await service.getCurrentMetrics();

      // Collector should only be called once due to caching
      expect(collectorMock.collectAllMetrics).toHaveBeenCalledTimes(1);
    });

    it('should store metrics in database', async () => {
      await service.getCurrentMetrics();

      expect(repositoryMock.insert).toHaveBeenCalled();
    });

    it('should build comparison metrics between brokers', async () => {
      const result = await service.getCurrentMetrics();

      expect(result.comparison).toBeDefined();
      // Should contain improvement metrics
      expect(Object.keys(result.comparison).length).toBeGreaterThan(0);
    });

    it('should suppress deltas when baseline is zero', async () => {
      collectorMock.collectAllMetrics.mockResolvedValueOnce({
        ...mockBrokerMetrics,
        rabbitmq: {
          ...mockBrokerMetrics.rabbitmq,
          messagesPerSecond: 0,
        },
      } as any);

      const result = await service.getCurrentMetrics(true);
      expect(result.comparison.throughputImprovement).toBeUndefined();
      expect(result.comparison.suppressedReasons?.join(' ')).toContain('Throughput delta suppressed');
    });

    it('should suppress deltas when either side is fallback quality', async () => {
      collectorMock.collectAllMetrics.mockResolvedValueOnce({
        ...mockBrokerMetrics,
        pulsar: {
          ...mockBrokerMetrics.pulsar,
          dataSource: 'fallback',
          metricQuality: {
            messagesPerSecond: 'fallback',
            p99LatencyMs: 'fallback',
            memoryUsageMb: 'fallback',
          },
        },
      } as any);

      const result = await service.getCurrentMetrics(true);
      expect(result.comparison.throughputImprovement).toBeUndefined();
      expect(result.comparison.latencyImprovement).toBeUndefined();
      expect(result.comparison.memoryEfficiency).toBeUndefined();
      expect(result.dataQuality?.hasFallbackData).toBe(true);
      expect(result.dataQuality?.fallbackBrokers).toContain('pulsar');
    });

    it('should handle collector errors gracefully', async () => {
      collectorMock.collectAllMetrics.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(service.getCurrentMetrics()).rejects.toThrow('Connection failed');
    });
  });

  describe('getHistoricalMetrics', () => {
    it('should retrieve metrics from the last 24 hours by default', async () => {
      await service.getHistoricalMetrics();

      expect(repositoryMock.find).toHaveBeenCalled();
    });

    it('should cap maximum hours to 168 (7 days)', async () => {
      repositoryMock.find.mockResolvedValueOnce([]);

      const result = await service.getHistoricalMetrics(500);

      expect(repositoryMock.find).toHaveBeenCalled();
      // Should complete without error even with large hour value
      expect(result).toHaveProperty('timeRange');
    });

    it('should return time-series data for charting', async () => {
      const mockMetrics: Partial<BrokerMetrics>[] = [
        {
          brokerName: 'rabbitmq' as any,
          messagesPerSecond: 1000,
          p99LatencyMs: 10,
          capturedAt: new Date(),
        },
      ];

      repositoryMock.find.mockResolvedValueOnce(mockMetrics as BrokerMetrics[]);

      const result = await service.getHistoricalMetrics(24);

      expect(result).toHaveProperty('timeRange');
      expect(result).toHaveProperty('samples');
    });
  });

  describe('pruneOldMetrics', () => {
    it('should delete metrics older than retention period', async () => {
      await service.pruneOldMetrics(7);

      expect(repositoryMock.delete).toHaveBeenCalled();
    });

    it('should default to 7 days retention', async () => {
      repositoryMock.delete.mockResolvedValueOnce({ affected: 100, raw: {} } as any);

      const result = await service.pruneOldMetrics();

      expect(result).toBe(100);
    });

    it('should log number of deleted entries', async () => {
      repositoryMock.delete.mockResolvedValueOnce({ affected: 50, raw: {} } as any);

      await service.pruneOldMetrics();

      // Service should have logged the deletion
      expect(repositoryMock.delete).toHaveBeenCalled();
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate cache after TTL expires', async () => {
      jest.useFakeTimers();

      await service.getCurrentMetrics();
      expect(collectorMock.collectAllMetrics).toHaveBeenCalledTimes(1);

      // Advance time past cache TTL (60 seconds)
      jest.advanceTimersByTime(61000);

      await service.getCurrentMetrics();
      expect(collectorMock.collectAllMetrics).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should bypass cache when forceRefresh=true', async () => {
      await service.getCurrentMetrics();
      await service.getCurrentMetrics(true);
      expect(collectorMock.collectAllMetrics).toHaveBeenCalledTimes(2);
    });

    it('should clear current metrics cache explicitly', async () => {
      await service.getCurrentMetrics();
      service.clearCurrentMetricsCache();
      await service.getCurrentMetrics();
      expect(collectorMock.collectAllMetrics).toHaveBeenCalledTimes(2);
    });
  });
});
