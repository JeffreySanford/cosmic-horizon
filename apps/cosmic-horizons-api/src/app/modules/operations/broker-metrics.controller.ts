import { Controller, Get, Post, Query, UseGuards, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { BrokerMetricsService } from './broker-metrics.service';
import { BrokerComparisonDTO, BrokerHistoryDTO } from './broker-metrics.entity';
import { IsInternalRoute } from '../shared/guards/is-internal-route.guard';

/**
 * BrokerMetricsController
 *
 * Endpoints for accessing broker performance metrics and historical data.
 * Internal API (admin only) - routes prefixed with /api/internal/brokers
 *
 * Phase 3.5: Used for Pulsar evaluation dashboard
 */
@Controller('internal/brokers')
@ApiTags('Operations - Broker Metrics')
@UseGuards(IsInternalRoute)
export class BrokerMetricsController {
  private readonly logger = new Logger(BrokerMetricsController.name);

  constructor(private readonly brokerMetricsService: BrokerMetricsService) {}

  /**
   * GET /api/internal/brokers/stats
   *
   * Returns current broker metrics: RabbitMQ, Kafka, Pulsar
   * Results are cached for 60 seconds to prevent overload
   *
   * @example
   * GET /api/internal/brokers/stats
   * {
   *   "timestamp": "2026-02-15T14:30:00Z",
   *   "brokers": {
   *     "rabbitmq": {
   *       "connected": true,
   *       "messagesPerSecond": 1173,
   *       "p99LatencyMs": 8.5,
   *       "memoryUsageMb": 156.2,
   *       "uptime": "3h 45m 12s",
   *       "connectionCount": 12
   *     },
   *     "pulsar": {...},
   *     "kafka": {...}
   *   },
   *   "comparison": {
   *     "throughputImprovement": "+36.8%",
   *     "latencyImprovement": "-27.1%",
   *     "memoryEfficiency": "-27.9%"
   *   }
   * }
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get current broker metrics',
    description: 'Returns real-time statistics for all configured brokers (RabbitMQ, Kafka, Pulsar)',
  })
  @ApiResponse({
    status: 200,
    description: 'Broker metrics retrieved successfully',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to collect broker metrics',
  })
  async getStats(): Promise<BrokerComparisonDTO> {
    try {
      return await this.brokerMetricsService.getCurrentMetrics();
    } catch (error) {
      this.logger.error(`Failed to get broker stats: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * GET /api/internal/brokers/history
   *
   * Returns time-series metrics for historical charting
   * Useful for building performance trend graphs
   *
   * @param hours - Number of hours to retrieve (default: 24)
   *
   * @example
   * GET /api/internal/brokers/history?hours=24
   * {
   *   "timeRange": {
   *     "start": "2026-02-14T14:30:00Z",
   *     "end": "2026-02-15T14:30:00Z"
   *   },
   *   "samples": [
   *     {
   *       "timestamp": "2026-02-14T14:30:00Z",
   *       "rabbitmq": { "throughput": 1173, "latency": 8.5, "memory": 156.2 },
   *       "pulsar": { "throughput": 1604, "latency": 6.2, "memory": 128.9 }
   *     }
   *   ]
   * }
   */
  @Get('history')
  @ApiOperation({
    summary: 'Get historical broker metrics',
    description: 'Returns time-series data for building performance trend charts',
  })
  @ApiQuery({
    name: 'hours',
    description: 'Number of hours of history to retrieve',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Historical metrics retrieved successfully',
  })
  async getHistory(@Query('hours') hours?: number): Promise<BrokerHistoryDTO> {
    try {
      const hoursToQuery = hours !== undefined ? Math.max(1, Math.min(168, hours)) : 24; // Cap at 7 days
      return await this.brokerMetricsService.getHistoricalMetrics(hoursToQuery);
    } catch (error) {
      this.logger.error(`Failed to get broker history: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * POST /api/internal/brokers/benchmark
   *
   * Triggers a benchmark run comparing all brokers with identical workload.
   * Executes async - returns immediately with status.
   *
   * This endpoint calls the `scripts/benchmark-pulsar-vs-rabbitmq.mjs` script
   * and stores results in the database.
   *
   * @example
   * POST /api/internal/brokers/benchmark
   * Response:
   * {
   *   "status": "running",
   *   "jobId": "bm-20260215-143000",
   *   "estimatedDurationSeconds": 45
   * }
   *
   * When complete:
   * {
   *   "status": "completed",
   *   "duration": "45s",
   *   "results": {
   *     "rabbitmq": {...},
   *     "pulsar": {...},
   *     "comparison": {...}
   *   },
   *   "reportUrl": "/api/internal/brokers/benchmark/report-20260215-143000"
   * }
   */
  @Post('benchmark')
  @ApiOperation({
    summary: 'Trigger broker performance benchmark',
    description: 'Runs 10K message comparison test across all brokers (async operation)',
  })
  @ApiResponse({
    status: 200,
    description: 'Benchmark started',
    schema: {
      example: {
        status: 'running',
        jobId: 'bm-20260215-143000',
        estimatedDurationSeconds: 45,
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Another benchmark is already running',
  })
  async startBenchmark(): Promise<{
    status: string;
    jobId: string;
    estimatedDurationSeconds: number;
  }> {
    // This would trigger the Python/Node.js benchmark script
    // For now, return a placeholder

    this.logger.log('Benchmark requested');

    return {
      status: 'queued',
      jobId: `bm-${new Date().toISOString().replace(/[:.]/g, '')}`,
      estimatedDurationSeconds: 60,
    };
  }

  /**
   * GET /api/internal/brokers/health
   *
   * Quick health check of all brokers
   * Returns immediately without storing data
   *
   * @example
   * GET /api/internal/brokers/health
   * {
   *   "rabbitmq": "ok",
   *   "kafka": "ok",
   *   "pulsar": "ok"
   * }
   */
  @Get('health')
  @ApiOperation({
    summary: 'Quick broker health check',
    description: 'Returns immediate health status of all configured brokers',
  })
  @ApiResponse({
    status: 200,
    schema: {
      example: {
        rabbitmq: 'ok',
        kafka: 'ok',
        pulsar: 'ok',
      },
    },
  })
  async getHealth(): Promise<Record<string, string>> {
    const metrics = await this.brokerMetricsService.getCurrentMetrics();

    return {
      rabbitmq: metrics.brokers.rabbitmq.connected ? 'ok' : 'unavailable',
      kafka: metrics.brokers.kafka.connected ? 'ok' : 'unavailable',
      ...(metrics.brokers.pulsar ? { pulsar: metrics.brokers.pulsar.connected ? 'ok' : 'unavailable' } : {}),
    };
  }
}
