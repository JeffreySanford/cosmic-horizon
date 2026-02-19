import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue('test-value'),
    };

    service = new AnalyticsService(mockConfigService as any);
    configService = mockConfigService as any;

    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('trackMetric', () => {
    it('should track a new metric', async () => {
      await service.trackMetric('cpu.usage', 75);

      const summary = await service.getMetricSummary('cpu.usage', 0);
      expect(summary.count).toBe(1);
      expect(summary.avg).toBe(75);
    });

    it('should track multiple values for same metric', async () => {
      await service.trackMetric('cpu.usage', 50);
      await service.trackMetric('cpu.usage', 75);
      await service.trackMetric('cpu.usage', 100);

      const summary = await service.getMetricSummary('cpu.usage', 0);
      expect(summary.count).toBe(3);
      expect(summary.avg).toBe(75);
    });

    it('should include tags with metric', async () => {
      const tags = { host: 'server-1', region: 'us-east' };
      await service.trackMetric('disk.usage', 85, tags);

      const summary = await service.getMetricSummary('disk.usage', 0);
      expect(summary.count).toBe(1);
    });

    it('should track high values without tags', async () => {
      await service.trackMetric('memory.usage', 95);

      const summary = await service.getMetricSummary('memory.usage', 0);
      expect(summary.count).toBe(1);
      expect(summary.avg).toBe(95);
    });

    it('should handle zero values', async () => {
      await service.trackMetric('idle.time', 0);

      const summary = await service.getMetricSummary('idle.time', 0);
      expect(summary.count).toBe(1);
      expect(summary.avg).toBe(0);
    });

    it('should handle negative values', async () => {
      await service.trackMetric('temp.change', -5);

      const summary = await service.getMetricSummary('temp.change', 0);
      expect(summary.count).toBe(1);
      expect(summary.avg).toBe(-5);
    });

    it('should generate alerts for high values', async () => {
      await service.trackMetric('cpu.temp', 2000);

      const metrics = service.getMetrics();
      expect(metrics.alertsCount).toBeGreaterThan(0);
    });

    it('should not generate alerts for low values', async () => {
      await service.trackMetric('cpu.temp', 50);

      const metrics = service.getMetrics();
      const startCount = metrics.alertsCount;

      await service.trackMetric('cpu.temp', 75);
      const endMetrics = service.getMetrics();

      expect(endMetrics.alertsCount).toBe(startCount);
    });
  });

  describe('getMetricSummary', () => {
    it('should return empty summary for unknown metric', async () => {
      const summary = await service.getMetricSummary('unknown.metric', 0);

      expect(summary.avg).toBe(0);
      expect(summary.p99).toBe(0);
      expect(summary.count).toBe(0);
    });

    it('should calculate average correctly', async () => {
      await service.trackMetric('response.time', 100);
      await service.trackMetric('response.time', 200);
      await service.trackMetric('response.time', 300);

      const summary = await service.getMetricSummary('response.time', 0);

      expect(summary.avg).toBe(200);
      expect(summary.count).toBe(3);
    });

    it('should calculate p99 correctly', async () => {
      for (let i = 1; i <= 100; i++) {
        await service.trackMetric('latency', i);
      }

      const summary = await service.getMetricSummary('latency', 0);

      expect(summary.p99).toBeDefined();
      expect(summary.p99).toBeGreaterThan(0);
      expect(summary.count).toBe(100);
    });

    it('should handle single value p99', async () => {
      await service.trackMetric('single.metric', 42);

      const summary = await service.getMetricSummary('single.metric', 0);

      expect(summary.p99).toBe(42);
      expect(summary.avg).toBe(42);
    });

    it('should handle duplicate values in p99 calculation', async () => {
      const values = [10, 10, 10, 20, 30];
      for (const value of values) {
        await service.trackMetric('duplicate.test', value);
      }

      const summary = await service.getMetricSummary('duplicate.test', 0);

      expect(summary.count).toBe(5);
      expect(summary.p99).toBeDefined();
    });

    it('should respect time window parameter', async () => {
      await service.trackMetric('windowed.metric', 50, { period: '1h' });

      const summary = await service.getMetricSummary(
        'windowed.metric',
        3600000,
      );

      expect(summary.count).toBe(1);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics object', async () => {
      const metrics = service.getMetrics();

      expect(metrics).toHaveProperty('metricsCount');
      expect(metrics).toHaveProperty('alertsCount');
      expect(metrics).toHaveProperty('throughput');
    });

    it('should show zero metrics initially', async () => {
      const metrics = service.getMetrics();

      expect(metrics.metricsCount).toBe(0);
      expect(metrics.alertsCount).toBe(0);
    });

    it('should increment metrics count', async () => {
      await service.trackMetric('metric.1', 10);
      let metrics = service.getMetrics();
      expect(metrics.metricsCount).toBe(1);

      await service.trackMetric('metric.2', 20);
      metrics = service.getMetrics();
      expect(metrics.metricsCount).toBe(2);
    });

    it('should track alert count', async () => {
      await service.trackMetric('alert.trigger', 2000);

      const metrics = service.getMetrics();
      expect(metrics.alertsCount).toBeGreaterThan(0);
    });
  });

  describe('Integration Scenarios', () => {
    it('should track multiple metrics independently', async () => {
      await service.trackMetric('cpu', 75);
      await service.trackMetric('memory', 85);
      await service.trackMetric('disk', 45);

      const cpuSummary = await service.getMetricSummary('cpu', 0);
      const memorySummary = await service.getMetricSummary('memory', 0);
      const diskSummary = await service.getMetricSummary('disk', 0);

      expect(cpuSummary.count).toBe(1);
      expect(memorySummary.count).toBe(1);
      expect(diskSummary.count).toBe(1);

      expect(cpuSummary.avg).toBe(75);
      expect(memorySummary.avg).toBe(85);
      expect(diskSummary.avg).toBe(45);
    });

    it('should accumulate metrics over time', async () => {
      const metricName = 'accumulated.metric';

      for (let i = 0; i < 10; i++) {
        await service.trackMetric(metricName, i * 10);
      }

      const summary = await service.getMetricSummary(metricName, 0);

      expect(summary.count).toBe(10);
      expect(summary.avg).toBe(45);
    });

    it('should generate alerts for multiple metrics', async () => {
      await service.trackMetric('high.cpu', 1500);
      await service.trackMetric('high.memory', 2000);
      await service.trackMetric('low.disk', 500);

      const metrics = service.getMetrics();

      expect(metrics.alertsCount).toBeGreaterThanOrEqual(2);
    });

    it('should handle rapid metric submissions', async () => {
      const promises = [];

      for (let i = 0; i < 50; i++) {
        promises.push(
          service.trackMetric('rapid.metric', Math.random() * 1000),
        );
      }

      await Promise.all(promises);

      const summary = await service.getMetricSummary('rapid.metric', 0);
      expect(summary.count).toBe(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large metric values', async () => {
      const largeValue = Number.MAX_SAFE_INTEGER;
      await service.trackMetric('large.value', largeValue);

      const summary = await service.getMetricSummary('large.value', 0);
      expect(summary.avg).toBe(largeValue);
    });

    it('should handle metric names with special characters', async () => {
      const metricName = 'metric-name.with_specials[0]';
      await service.trackMetric(metricName, 42);

      const summary = await service.getMetricSummary(metricName, 0);
      expect(summary.count).toBe(1);
    });

    it('should handle empty tag object', async () => {
      await service.trackMetric('empty.tags', 100, {});

      const summary = await service.getMetricSummary('empty.tags', 0);
      expect(summary.count).toBe(1);
    });

    it('should handle metrics with only timestamp differences', async () => {
      const metricName = 'timestamp.test';

      await service.trackMetric(metricName, 10);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await service.trackMetric(metricName, 10);

      const summary = await service.getMetricSummary(metricName, 0);
      expect(summary.count).toBe(2);
      expect(summary.avg).toBe(10);
    });
  });
});
