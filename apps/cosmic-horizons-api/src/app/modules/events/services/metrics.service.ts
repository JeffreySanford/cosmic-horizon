import { Injectable, Logger } from '@nestjs/common';

/**
 * MetricsService aggregates job metrics from Kafka events
 * Stores metrics and broadcasts updates to connected clients
 */
@Injectable()
export class MetricsService {
  private readonly logger = new Logger('MetricsService');

  // In-memory metrics storage (would be InfluxDB or similar in production)
  private readonly metricsMap = new Map<
    string,
    {
      jobId: string;
      samples: Array<{
        cpu_usage_percent: number;
        memory_usage_mb: number;
        execution_time_seconds: number;
        timestamp: string;
      }>;
      lastUpdated: Date;
    }
  >();

  /**
   * Aggregate metrics for a job
   * Stores in metrics database/cache
   */
  async aggregateJobMetrics(
    jobId: string,
    metrics: {
      event_type: string;
      cpu_usage_percent: number;
      memory_usage_mb: number;
      execution_time_seconds: number;
      timestamp: string;
    },
  ): Promise<void> {
    try {
      if (!this.metricsMap.has(jobId)) {
        this.metricsMap.set(jobId, {
          jobId,
          samples: [],
          lastUpdated: new Date(),
        });
      }

      const jobMetrics = this.metricsMap.get(jobId)!;
      jobMetrics.samples.push({
        cpu_usage_percent: metrics.cpu_usage_percent,
        memory_usage_mb: metrics.memory_usage_mb,
        execution_time_seconds: metrics.execution_time_seconds,
        timestamp: metrics.timestamp,
      });
      jobMetrics.lastUpdated = new Date();

      this.logger.debug(`Aggregated metrics for job ${jobId} (samples: ${jobMetrics.samples.length})`);
    } catch (error) {
      this.logger.error(`Failed to aggregate metrics for ${jobId}: ${error}`);
      throw error;
    }
  }

  /**
   * Get summary of metrics for a job
   */
  async getJobMetricsSummary(jobId: string): Promise<{
    job_id: string;
    avg_cpu_usage_percent: number;
    avg_memory_usage_mb: number;
    max_cpu_usage_percent: number;
    max_memory_usage_mb: number;
    sample_count: number;
  } | null> {
    const metrics = this.metricsMap.get(jobId);
    if (!metrics || metrics.samples.length === 0) {
      return null;
    }

    const samples = metrics.samples;
    const totalCpu = samples.reduce((sum, s) => sum + s.cpu_usage_percent, 0);
    const totalMemory = samples.reduce((sum, s) => sum + s.memory_usage_mb, 0);
    const maxCpu = Math.max(...samples.map(s => s.cpu_usage_percent));
    const maxMemory = Math.max(...samples.map(s => s.memory_usage_mb));

    return {
      job_id: jobId,
      avg_cpu_usage_percent: totalCpu / samples.length,
      avg_memory_usage_mb: totalMemory / samples.length,
      max_cpu_usage_percent: maxCpu,
      max_memory_usage_mb: maxMemory,
      sample_count: samples.length,
    };
  }

  /**
   * Broadcast metrics update (would use WebSocket in production)
   */
  async broadcastMetricsUpdate(
    jobId: string,
    metrics: {
      job_id: string;
      avg_cpu_usage_percent: number;
      avg_memory_usage_mb: number;
      max_cpu_usage_percent: number;
      max_memory_usage_mb: number;
      sample_count: number;
    } | null,
  ): Promise<void> {
    try {
      if (!metrics) {
        this.logger.warn(`No metrics to broadcast for job ${jobId}`);
        return;
      }

      // In production, this would broadcast via WebSocket to connected dashboard
      this.logger.debug(`Broadcasting metrics update for job ${jobId}:`, metrics);

      // TODO: Implement WebSocket broadcast
      // this.websocketGateway.broadcastMetrics(metrics);
    } catch (error) {
      this.logger.error(`Failed to broadcast metrics for ${jobId}: ${error}`);
      throw error;
    }
  }

  /**
   * Get consumer lag for metrics consumer group
   * Used for monitoring consumer health
   */
  async getConsumerLag(): Promise<number> {
    // In production, would query Kafka broker for consumer group offsets
    // For now, return mock value
    return 0;
  }

  /**
   * Clear old metrics (retention policy)
   */
  async clearOldMetrics(maxAgeMinutes = 1440): Promise<number> {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    let clearedCount = 0;

    const entriesToDelete: string[] = [];
    for (const [jobId, metrics] of this.metricsMap.entries()) {
      if (metrics.lastUpdated < cutoffTime) {
        entriesToDelete.push(jobId);
        clearedCount++;
      }
    }

    entriesToDelete.forEach(jobId => this.metricsMap.delete(jobId));
    this.logger.debug(`Cleared ${clearedCount} old metrics entries`);

    return clearedCount;
  }
}
