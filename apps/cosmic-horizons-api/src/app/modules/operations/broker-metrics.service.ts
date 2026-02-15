import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { BrokerMetrics, BrokerMetricsDTO, BrokerComparisonDTO, BrokerHistoryDTO } from './broker-metrics.entity';
import { BrokerMetricsCollector } from './broker-metrics.collector';

/**
 * BrokerMetricsService
 *
 * Manages broker metrics collection, storage, and retrieval.
 * Used for Phase 3.5 Pulsar evaluation and operational monitoring.
 */
@Injectable()
export class BrokerMetricsService {
  private readonly logger = new Logger(BrokerMetricsService.name);
  private metricsCache = new Map<string, { data: BrokerComparisonDTO; expiresAt: Date }>();
  private readonly CACHE_TTL_MS = 60000; // 60 seconds

  constructor(
    @InjectRepository(BrokerMetrics)
    private readonly metricsRepository: Repository<BrokerMetrics>,
    private readonly metricsCollector: BrokerMetricsCollector,
  ) {}

  /**
   * Get current metrics for all brokers
   * Returns cached results if available (60-second cache)
   */
  async getCurrentMetrics(): Promise<BrokerComparisonDTO> {
    const cacheKey = 'current-metrics';
    const cached = this.metricsCache.get(cacheKey);

    if (cached && new Date() < cached.expiresAt) {
      return cached.data as BrokerComparisonDTO;
    }

    try {
      const brokerMetrics = await this.metricsCollector.collectAllMetrics();

      // Store in database for history
      await Promise.allSettled([
        this.storeMetric('rabbitmq', brokerMetrics.rabbitmq),
        this.storeMetric('kafka', brokerMetrics.kafka),
        ...(brokerMetrics.pulsar ? [this.storeMetric('pulsar', brokerMetrics.pulsar)] : []),
      ]);

      const response = this.buildComparison(brokerMetrics);

      // Cache the result
      this.metricsCache.set(cacheKey, {
        data: response,
        expiresAt: new Date(Date.now() + this.CACHE_TTL_MS),
      });

      return response;
    } catch (error) {
      this.logger.error(`Failed to collect metrics: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get historical metrics for charting
   */
  async getHistoricalMetrics(hours = 24): Promise<BrokerHistoryDTO> {
    const startTime = new Date(Date.now() - hours * 3600 * 1000);

    const metrics = await this.metricsRepository.find({
      where: {
        capturedAt: MoreThan(startTime),
      },
      order: {
        capturedAt: 'ASC',
      },
    });

    // Group by timestamp
    const grouped = new Map<string, Record<string, BrokerMetrics>>();

    for (const metric of metrics) {
      const key = metric.capturedAt.getTime().toString();
      if (!grouped.has(key)) {
        grouped.set(key, {});
      }
      const brokerMap = grouped.get(key);
      if (brokerMap) {
        brokerMap[metric.brokerName] = metric;
      }
    }

    // Build samples
    const samples = Array.from(grouped.entries()).map(([, brokerMap]) => ({
      timestamp: (brokerMap.rabbitmq?.capturedAt || brokerMap.kafka?.capturedAt || brokerMap.pulsar?.capturedAt) || new Date(),
      rabbitmq: this.metricToDTO(brokerMap.rabbitmq),
      kafka: this.metricToDTO(brokerMap.kafka),
      pulsar: brokerMap.pulsar ? this.metricToDTO(brokerMap.pulsar) : undefined,
    }));

    return {
      timeRange: {
        start: startTime,
        end: new Date(),
      },
      samples,
    };
  }

  /**
   * Clear old metrics (retention policy)
   * Keep last 7 days by default
   */
  async pruneOldMetrics(daysToKeep = 7): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 3600 * 1000);

    const result = await this.metricsRepository.delete({
      capturedAt: LessThan(cutoffDate),
    });

    this.logger.log(`Pruned ${result.affected || 0} old metrics entries (before ${cutoffDate.toISOString()})`);
    return result.affected || 0;
  }

  /**
   * Helper: Store individual broker metric
   */
  private async storeMetric(
    brokerName: 'rabbitmq' | 'kafka' | 'pulsar',
    metrics: BrokerMetricsDTO,
  ): Promise<void> {
    try {
      await this.metricsRepository.insert({
        brokerName,
        messagesPerSecond: metrics.messagesPerSecond,
        p50LatencyMs: metrics.p50LatencyMs,
        p95LatencyMs: metrics.p95LatencyMs,
        p99LatencyMs: metrics.p99LatencyMs,
        memoryUsageMb: metrics.memoryUsageMb,
        cpuPercentage: metrics.cpuPercentage,
        connectionCount: metrics.connectionCount,
        isConnected: metrics.connected,
        uptime: metrics.uptime,
        partitionCount: metrics.partitionCount,
        brokerCount: metrics.brokerCount,
        capturedAt: new Date(),
      });
    } catch (error) {
      this.logger.warn(`Failed to store ${brokerName} metrics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Helper: Build comparison deltas
   */
  private buildComparison(brokerMetrics: {
    rabbitmq: BrokerMetricsDTO;
    kafka: BrokerMetricsDTO;
    pulsar?: BrokerMetricsDTO;
  }): BrokerComparisonDTO {
    const comparison: BrokerComparisonDTO['comparison'] = {};

    if (brokerMetrics.rabbitmq.connected && brokerMetrics.pulsar?.connected) {
      const rmqThroughput = brokerMetrics.rabbitmq.messagesPerSecond || 1;
      const pulsarThroughput = brokerMetrics.pulsar.messagesPerSecond || 1;
      const throughputDelta = ((pulsarThroughput - rmqThroughput) / rmqThroughput) * 100;
      comparison.throughputImprovement = `${throughputDelta >= 0 ? '+' : ''}${throughputDelta.toFixed(1)}%`;

      const rmqLatency = brokerMetrics.rabbitmq.p99LatencyMs || 1;
      const pulsarLatency = brokerMetrics.pulsar.p99LatencyMs || 1;
      const latencyDelta = ((pulsarLatency - rmqLatency) / rmqLatency) * 100;
      comparison.latencyImprovement = `${latencyDelta >= 0 ? '+' : ''}${latencyDelta.toFixed(1)}%`;

      const rmqMemory = brokerMetrics.rabbitmq.memoryUsageMb || 1;
      const pulsarMemory = brokerMetrics.pulsar.memoryUsageMb || 1;
      const memoryDelta = ((pulsarMemory - rmqMemory) / rmqMemory) * 100;
      comparison.memoryEfficiency = `${memoryDelta >= 0 ? '+' : ''}${memoryDelta.toFixed(1)}%`;
    }

    return {
      timestamp: new Date(),
      brokers: {
        rabbitmq: brokerMetrics.rabbitmq,
        kafka: brokerMetrics.kafka,
        ...(brokerMetrics.pulsar ? { pulsar: brokerMetrics.pulsar } : {}),
      },
      comparison,
    };
  }

  /**
   * Helper: Convert entity to DTO
   */
  private metricToDTO(metric: BrokerMetrics | undefined): Partial<BrokerMetricsDTO> {
    if (!metric) return {};

    return {
      connected: metric.isConnected,
      messagesPerSecond: metric.messagesPerSecond || undefined,
      p50LatencyMs: metric.p50LatencyMs as number | undefined,
      p95LatencyMs: metric.p95LatencyMs as number | undefined,
      p99LatencyMs: metric.p99LatencyMs as number | undefined,
      memoryUsageMb: metric.memoryUsageMb as number | undefined,
      cpuPercentage: metric.cpuPercentage as number | undefined,
      connectionCount: metric.connectionCount || undefined,
      uptime: metric.uptime || undefined,
    };
  }
}
