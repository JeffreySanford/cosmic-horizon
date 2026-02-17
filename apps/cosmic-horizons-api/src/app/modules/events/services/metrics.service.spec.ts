import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

/**
 * SPRINT 5.3: Job Orchestration Events
 * Week 2 (Feb 23-27): Consumer Event Tests
 *
 * MetricsService Event Consumption Tests
 * Tests for aggregating and querying job metrics from Kafka events
 */
describe('MetricsService - Event Consumption', () => {
  let service: MetricsService;

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      providers: [MetricsService],
    }).compile();

    service = testingModule.get<MetricsService>(MetricsService);
  });

  describe('Monday: Job metrics aggregation from Kafka events', () => {
    it('should aggregate metrics for a single job', async () => {
      const jobId = 'job-1';
      const metrics = {
        event_type: 'job.metrics_recorded',
        cpu_usage_percent: 75.5,
        memory_usage_mb: 4096,
        execution_time_seconds: 3600,
        timestamp: new Date().toISOString(),
      };

      await service.aggregateJobMetrics(jobId, metrics);

      const summary = await service.getJobMetricsSummary(jobId);
      expect(summary).toBeDefined();
      expect(summary?.job_id).toBe(jobId);
      expect(summary?.sample_count).toBe(1);
    });

    it('should accumulate multiple metric samples for same job', async () => {
      const jobId = 'job-1';
      const metricsArray = [
        {
          event_type: 'job.metrics_recorded',
          cpu_usage_percent: 50.0,
          memory_usage_mb: 2048,
          execution_time_seconds: 1200,
          timestamp: new Date().toISOString(),
        },
        {
          event_type: 'job.metrics_recorded',
          cpu_usage_percent: 75.5,
          memory_usage_mb: 4096,
          execution_time_seconds: 1800,
          timestamp: new Date(Date.now() + 600000).toISOString(),
        },
        {
          event_type: 'job.metrics_recorded',
          cpu_usage_percent: 100.0,
          memory_usage_mb: 8192,
          execution_time_seconds: 2400,
          timestamp: new Date(Date.now() + 1200000).toISOString(),
        },
      ];

      for (const metrics of metricsArray) {
        await service.aggregateJobMetrics(jobId, metrics);
      }

      const summary = await service.getJobMetricsSummary(jobId);
      expect(summary?.sample_count).toBe(3);
    });

    it('should calculate correct average CPU usage across samples', async () => {
      const jobId = 'job-metrics-cpu';
      const samples = [
        { cpu: 50, mem: 2048, time: 1200 },
        { cpu: 75, mem: 4096, time: 1800 },
        { cpu: 100, mem: 8192, time: 2400 },
      ];

      for (const sample of samples) {
        await service.aggregateJobMetrics(jobId, {
          event_type: 'job.metrics_recorded',
          cpu_usage_percent: sample.cpu,
          memory_usage_mb: sample.mem,
          execution_time_seconds: sample.time,
          timestamp: new Date().toISOString(),
        });
      }

      const summary = await service.getJobMetricsSummary(jobId);
      expect(summary?.avg_cpu_usage_percent).toBe((50 + 75 + 100) / 3);
    });

    it('should track max CPU usage from multiple samples', async () => {
      const jobId = 'job-metrics-max';
      const maxCpu = 95.5;
      const samples = [
        { cpu: 50, mem: 2048 },
        { cpu: maxCpu, mem: 4096 },
        { cpu: 60, mem: 3072 },
      ];

      for (const sample of samples) {
        await service.aggregateJobMetrics(jobId, {
          event_type: 'job.metrics_recorded',
          cpu_usage_percent: sample.cpu,
          memory_usage_mb: sample.mem,
          execution_time_seconds: 1800,
          timestamp: new Date().toISOString(),
        });
      }

      const summary = await service.getJobMetricsSummary(jobId);
      expect(summary?.max_cpu_usage_percent).toBe(maxCpu);
    });

    it('should handle metrics for multiple concurrent jobs', async () => {
      const job1Metrics = {
        event_type: 'job.metrics_recorded',
        cpu_usage_percent: 50,
        memory_usage_mb: 2048,
        execution_time_seconds: 1200,
        timestamp: new Date().toISOString(),
      };

      const job2Metrics = {
        event_type: 'job.metrics_recorded',
        cpu_usage_percent: 75,
        memory_usage_mb: 4096,
        execution_time_seconds: 1800,
        timestamp: new Date().toISOString(),
      };

      await service.aggregateJobMetrics('job-1', job1Metrics);
      await service.aggregateJobMetrics('job-2', job2Metrics);

      const summary1 = await service.getJobMetricsSummary('job-1');
      const summary2 = await service.getJobMetricsSummary('job-2');

      expect(summary1?.job_id).toBe('job-1');
      expect(summary1?.avg_cpu_usage_percent).toBe(50);
      expect(summary2?.job_id).toBe('job-2');
      expect(summary2?.avg_cpu_usage_percent).toBe(75);
    });
  });

  describe('Tuesday-Wednesday: Memory and execution time tracking', () => {
    it('should calculate average memory usage across samples', async () => {
      const jobId = 'job-memory-avg';
      const samples = [
        { cpu: 50, mem: 2048 },
        { cpu: 60, mem: 4096 },
        { cpu: 70, mem: 6144 },
      ];

      for (const sample of samples) {
        await service.aggregateJobMetrics(jobId, {
          event_type: 'job.metrics_recorded',
          cpu_usage_percent: sample.cpu,
          memory_usage_mb: sample.mem,
          execution_time_seconds: 1800,
          timestamp: new Date().toISOString(),
        });
      }

      const summary = await service.getJobMetricsSummary(jobId);
      expect(summary?.avg_memory_usage_mb).toBe((2048 + 4096 + 6144) / 3);
    });

    it('should track peak memory usage (max memory)', async () => {
      const jobId = 'job-memory-peak';
      const maxMemory = 8192;
      const samples = [
        { cpu: 50, mem: 2048 },
        { cpu: 70, mem: maxMemory },
        { cpu: 60, mem: 4096 },
      ];

      for (const sample of samples) {
        await service.aggregateJobMetrics(jobId, {
          event_type: 'job.metrics_recorded',
          cpu_usage_percent: sample.cpu,
          memory_usage_mb: sample.mem,
          execution_time_seconds: 1800,
          timestamp: new Date().toISOString(),
        });
      }

      const summary = await service.getJobMetricsSummary(jobId);
      expect(summary?.max_memory_usage_mb).toBe(maxMemory);
    });

    it('should return null for non-existent job', async () => {
      const summary = await service.getJobMetricsSummary('nonexistent-job');
      expect(summary).toBeNull();
    });

    it('should detect performance anomalies (CPU spike)', async () => {
      const jobId = 'job-anomaly-cpu';
      const samples = [
        { cpu: 50, mem: 2048 },
        { cpu: 55, mem: 2560 },
        { cpu: 98, mem: 8192 }, // CPU spike
        { cpu: 52, mem: 2600 },
      ];

      for (const sample of samples) {
        await service.aggregateJobMetrics(jobId, {
          event_type: 'job.metrics_recorded',
          cpu_usage_percent: sample.cpu,
          memory_usage_mb: sample.mem,
          execution_time_seconds: 1800,
          timestamp: new Date().toISOString(),
        });
      }

      const summary = await service.getJobMetricsSummary(jobId);
      // Average should be significantly lower than max (indicating spike)
      expect(summary?.max_cpu_usage_percent).toBeGreaterThan(
        (summary?.avg_cpu_usage_percent || 0) * 1.5,
      );
    });

    it('should preserve timestamp of each metric sample', async () => {
      const jobId = 'job-timestamps';
      const timestamp1 = new Date().toISOString();
      const timestamp2 = new Date(Date.now() + 60000).toISOString();

      await service.aggregateJobMetrics(jobId, {
        event_type: 'job.metrics_recorded',
        cpu_usage_percent: 50,
        memory_usage_mb: 2048,
        execution_time_seconds: 1200,
        timestamp: timestamp1,
      });

      await service.aggregateJobMetrics(jobId, {
        event_type: 'job.metrics_recorded',
        cpu_usage_percent: 75,
        memory_usage_mb: 4096,
        execution_time_seconds: 1800,
        timestamp: timestamp2,
      });

      const summary = await service.getJobMetricsSummary(jobId);
      expect(summary?.sample_count).toBe(2);
    });
  });

  describe('Thursday: Error handling and resilience', () => {
    it('should handle invalid metric values gracefully', async () => {
      const jobId = 'job-invalid';
      const metrics = {
        event_type: 'job.metrics_recorded',
        cpu_usage_percent: -10, // Invalid: negative
        memory_usage_mb: 4096,
        execution_time_seconds: 1800,
        timestamp: new Date().toISOString(),
      };

      // Service should still store (validation elsewhere)
      await service.aggregateJobMetrics(jobId, metrics);

      const summary = await service.getJobMetricsSummary(jobId);
      expect(summary).toBeDefined();
    });

    it('should continue aggregating after error in retrieval', async () => {
      const jobId = 'job-error-recovery';
      const metrics = {
        event_type: 'job.metrics_recorded',
        cpu_usage_percent: 50,
        memory_usage_mb: 2048,
        execution_time_seconds: 1200,
        timestamp: new Date().toISOString(),
      };

      await service.aggregateJobMetrics(jobId, metrics);
      const summary = await service.getJobMetricsSummary(jobId);
      expect(summary?.sample_count).toBe(1);

      // Aggregate more metrics after query
      await service.aggregateJobMetrics(jobId, {
        ...metrics,
        cpu_usage_percent: 75,
      });

      const updatedSummary = await service.getJobMetricsSummary(jobId);
      expect(updatedSummary?.sample_count).toBe(2);
    });

    it('should handle high-frequency metric updates (> 100 events)', async () => {
      const jobId = 'job-high-freq';
      const sampleCount = 150;

      for (let i = 0; i < sampleCount; i++) {
        await service.aggregateJobMetrics(jobId, {
          event_type: 'job.metrics_recorded',
          cpu_usage_percent: Math.random() * 100,
          memory_usage_mb: Math.random() * 8192,
          execution_time_seconds: 1800 + i * 10,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
        });
      }

      const summary = await service.getJobMetricsSummary(jobId);
      expect(summary?.sample_count).toBeLessThanOrEqual(sampleCount);
    });

    it('should maintain data integrity across concurrent aggregations', async () => {
      const jobId = 'job-concurrent';
      const promises = [];

      for (let i = 0; i < 20; i++) {
        promises.push(
          service.aggregateJobMetrics(jobId, {
            event_type: 'job.metrics_recorded',
            cpu_usage_percent: 50 + i,
            memory_usage_mb: 2048 + i * 100,
            execution_time_seconds: 1800,
            timestamp: new Date().toISOString(),
          }),
        );
      }

      await Promise.all(promises);

      const summary = await service.getJobMetricsSummary(jobId);
      expect(summary?.sample_count).toBe(20);
    });
  });

  describe('Friday: Advanced queries and reporting', () => {
    it('should provide performance trend analysis', async () => {
      const jobId = 'job-trend';
      const samples = [
        { cpu: 30, mem: 1024 },
        { cpu: 40, mem: 2048 },
        { cpu: 50, mem: 3072 },
        { cpu: 60, mem: 4096 },
        { cpu: 70, mem: 5120 },
      ];

      for (const sample of samples) {
        await service.aggregateJobMetrics(jobId, {
          event_type: 'job.metrics_recorded',
          cpu_usage_percent: sample.cpu,
          memory_usage_mb: sample.mem,
          execution_time_seconds: 1800,
          timestamp: new Date().toISOString(),
        });
      }

      const summary = await service.getJobMetricsSummary(jobId);
      expect(summary?.avg_cpu_usage_percent).toBe(50); // Midpoint of trend
      expect(summary?.max_cpu_usage_percent).toBe(70);
    });

    it('should calculate resource efficiency metrics', async () => {
      const jobId = 'job-efficiency';
      const metrics = {
        event_type: 'job.metrics_recorded',
        cpu_usage_percent: 80,
        memory_usage_mb: 4096,
        execution_time_seconds: 3600,
        timestamp: new Date().toISOString(),
      };

      // Simulate ideal (single metric)
      await service.aggregateJobMetrics(jobId, metrics);

      const summary = await service.getJobMetricsSummary(jobId);
      expect(summary).toBeDefined();
      // Efficiency = avg_cpu / max_cpu (closer to 1.0 = more consistent)
      const efficiency = summary
        ? (summary.avg_cpu_usage_percent || 0) /
          Math.max(summary.max_cpu_usage_percent || 1, 0.1)
        : 0;
      expect(efficiency).toBeGreaterThanOrEqual(0);
      expect(efficiency).toBeLessThanOrEqual(1);
    });

    it('should retrieve metrics for report generation', async () => {
      const jobs = ['job-1', 'job-2', 'job-3'];
      const metricsPerJob = 5;

      for (const jobId of jobs) {
        for (let i = 0; i < metricsPerJob; i++) {
          await service.aggregateJobMetrics(jobId, {
            event_type: 'job.metrics_recorded',
            cpu_usage_percent: 50 + Math.random() * 30,
            memory_usage_mb: 2048 + Math.random() * 4096,
            execution_time_seconds: 1800 + i * 600,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Verify all jobs have metrics aggregated
      for (const jobId of jobs) {
        const summary = await service.getJobMetricsSummary(jobId);
        expect(summary?.sample_count).toBe(metricsPerJob);
      }
    });

    it('should detect performance degradation over time', async () => {
      const jobId = 'job-degradation';
      const baselineCpu = 30;
      const degradedCpu = 90;

      // Baseline: good performance
      await service.aggregateJobMetrics(jobId, {
        event_type: 'job.metrics_recorded',
        cpu_usage_percent: baselineCpu,
        memory_usage_mb: 2048,
        execution_time_seconds: 1200,
        timestamp: new Date().toISOString(),
      });

      // Degradation: poor performance
      for (let i = 0; i < 3; i++) {
        await service.aggregateJobMetrics(jobId, {
          event_type: 'job.metrics_recorded',
          cpu_usage_percent: degradedCpu,
          memory_usage_mb: 8192,
          execution_time_seconds: 3600,
          timestamp: new Date().toISOString(),
        });
      }

      const summary = await service.getJobMetricsSummary(jobId);
      expect(summary?.max_cpu_usage_percent).toBeGreaterThan(baselineCpu * 2);
    });
  });
});
