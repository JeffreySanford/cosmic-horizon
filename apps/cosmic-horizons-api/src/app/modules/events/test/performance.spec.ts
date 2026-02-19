import { MetricsService } from '../services/metrics.service';

describe('Week 3 Performance and Load Tests', () => {
  let metricsService: MetricsService;

  beforeEach(() => {
    metricsService = new MetricsService();
    jest
      .spyOn(
        (
          metricsService as unknown as {
            logger: { debug: (...args: unknown[]) => void };
          }
        ).logger,
        'debug',
      )
      .mockImplementation(() => undefined);
  });

  it('processes 1000 metrics events within throughput baseline', async () => {
    const start = Date.now();

    for (let i = 0; i < 1000; i++) {
      await metricsService.aggregateJobMetrics(`job-${i}`, {
        event_type: 'job.metrics_recorded',
        cpu_usage_percent: 50,
        memory_usage_mb: 1000,
        execution_time_seconds: 20,
        timestamp: new Date().toISOString(),
      });
    }

    const elapsedMs = Date.now() - start;
    expect(elapsedMs).toBeLessThan(30000);
  });

  it('keeps per-event aggregation latency low under repeated calls', async () => {
    const measurements: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await metricsService.aggregateJobMetrics('job-latency', {
        event_type: 'job.metrics_recorded',
        cpu_usage_percent: 45,
        memory_usage_mb: 900,
        execution_time_seconds: 10,
        timestamp: new Date().toISOString(),
      });
      measurements.push(Date.now() - start);
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    expect(p99).toBeLessThan(500);
  });

  it('keeps memory growth bounded while aggregating 10k events', async () => {
    const before = process.memoryUsage().heapUsed;

    for (let i = 0; i < 10000; i++) {
      await metricsService.aggregateJobMetrics(`job-memory-${i % 100}`, {
        event_type: 'job.metrics_recorded',
        cpu_usage_percent: 55,
        memory_usage_mb: 1500,
        execution_time_seconds: 30,
        timestamp: new Date().toISOString(),
      });
    }

    const after = process.memoryUsage().heapUsed;
    const growthMb = (after - before) / (1024 * 1024);
    expect(growthMb).toBeLessThan(50);
  });

  it('handles 100 concurrent aggregations without failure', async () => {
    const promises: Array<Promise<void>> = [];

    for (let i = 0; i < 100; i++) {
      promises.push(
        metricsService.aggregateJobMetrics(`job-concurrent-${i}`, {
          event_type: 'job.metrics_recorded',
          cpu_usage_percent: 60,
          memory_usage_mb: 2048,
          execution_time_seconds: 60,
          timestamp: new Date().toISOString(),
        }),
      );
    }

    await expect(Promise.all(promises)).resolves.toBeDefined();
  });

  it('retrieves 50 metric summaries quickly after warm-up', async () => {
    for (let i = 0; i < 500; i++) {
      await metricsService.aggregateJobMetrics(`job-summary-${i}`, {
        event_type: 'job.metrics_recorded',
        cpu_usage_percent: 40,
        memory_usage_mb: 700,
        execution_time_seconds: 5,
        timestamp: new Date().toISOString(),
      });
    }

    const start = Date.now();
    for (let i = 0; i < 50; i++) {
      const summary = await metricsService.getJobMetricsSummary(
        `job-summary-${i}`,
      );
      expect(summary).not.toBeNull();
    }
    const elapsedMs = Date.now() - start;

    expect(elapsedMs).toBeLessThan(1000);
  });
});
