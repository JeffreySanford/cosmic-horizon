import { Controller, Get, Post, Query, UseGuards, Logger } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { BrokerMetricsService } from './broker-metrics.service';
import { BrokerComparisonDTO, BrokerHistoryDTO } from './broker-metrics.entity';
import { IsInternalRoute } from '../shared/guards/is-internal-route.guard';

type BrokerKey = 'rabbitmq' | 'kafka' | 'pulsar';

/**
 * BrokerMetricsController
 *
 * Endpoints for accessing broker performance metrics and historical data.
 * Internal API (authenticated users) - routes prefixed with /api/internal/brokers
 *
 * Phase 3.5: Used for Pulsar evaluation dashboard
 */
@Controller('internal/brokers')
@ApiTags('Operations - Broker Metrics')
@UseGuards(IsInternalRoute)
export class BrokerMetricsController {
  private readonly logger = new Logger(BrokerMetricsController.name);
  private activeBenchmarkJobId: string | null = null;
  private jobSequence = 0;
  private readonly STRESS_DEFAULT_MESSAGES = 5000000;
  private readonly STRESS_DEFAULT_PAYLOAD_KB = 64;
  private readonly STRESS_DEFAULT_INFLIGHT = 3000;
  private readonly STANDARD_DEFAULT_PAYLOAD_KB = 2;
  private readonly STANDARD_DEFAULT_INFLIGHT = 250;

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
  @ApiQuery({
    name: 'forceRefresh',
    description: 'Bypass 60s cache and fetch fresh metrics',
    required: false,
    type: Boolean,
  })
  async getStats(@Query('forceRefresh') forceRefresh?: string): Promise<BrokerComparisonDTO> {
    try {
      return await this.brokerMetricsService.getCurrentMetrics(forceRefresh === 'true');
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
   * Supports both standard and heavy stress modes.
   *
   * Query Parameters:
   * - stressTest: boolean - Run high-load stress test (5M default messages)
   * - messageCount: number - Custom message count (overrides defaults)
   * - payloadKb: number - Per-message payload size in KB
   * - inflight: number - In-flight publish window for memory pressure
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
   *   "estimatedDurationSeconds": 45,
   *   "testType": "standard"
   * }
   *
   * POST /api/internal/brokers/benchmark?stressTest=true
   * Response:
   * {
   *   "status": "running",
   *   "jobId": "bm-20260215-143000-stress",
   *   "estimatedDurationSeconds": 180,
   *   "testType": "stress"
   * }
   */
  @Post('benchmark')
  @ApiOperation({
    summary: 'Trigger broker performance benchmark',
    description: 'Runs message comparison test across all brokers. Supports standard and heavy stress profiles.',
  })
  @ApiQuery({
    name: 'stressTest',
    description: 'Run high-load stress test with heavy defaults (5M messages, 64KB payload, high inflight)',
    required: false,
    type: Boolean,
  })
  @ApiQuery({
    name: 'messageCount',
    description: 'Custom number of messages to send (overrides defaults)',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'payloadKb',
    description: 'Synthetic payload size in kilobytes per event',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'inflight',
    description: 'Maximum in-flight publish operations (higher values increase memory pressure)',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'brokers',
    description: 'Comma-separated broker list (rabbitmq,kafka,pulsar) for per-run execution',
    required: false,
    type: String,
  })
  @ApiQuery({
    name: 'trials',
    description: 'Number of repeated benchmark trials for median/p95 summary',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'seed',
    description: 'Deterministic replay seed for payload/order generation',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'measuredOnly',
    description: 'When true (default), block benchmark runs that rely on fallback/simulated metrics',
    required: false,
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'Benchmark started',
    schema: {
      example: {
        status: 'running',
        jobId: 'bm-20260215-143000',
        estimatedDurationSeconds: 45,
        testType: 'standard',
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Another benchmark is already running',
  })
  async startBenchmark(
    @Query('stressTest') stressTest?: string,
    @Query('messageCount') messageCount?: string,
    @Query('brokers') brokers?: string,
    @Query('payloadKb') payloadKb?: string,
    @Query('inflight') inflight?: string,
    @Query('trials') trials?: string,
    @Query('seed') seed?: string,
    @Query('measuredOnly') measuredOnly?: string,
  ): Promise<{
    status: string;
    jobId: string;
    estimatedDurationSeconds: number;
    testType: string;
    reason?: string;
    selectedBrokers?: string[];
  }> {
    const isStressTest = stressTest === 'true';
    const selectedBrokers = this.parseSelectedBrokers(brokers);
    const customMessageCount = this.parsePositiveInt(messageCount);
    const customPayloadKb = this.parsePositiveInt(payloadKb);
    const customInflight = this.parsePositiveInt(inflight);
    const customTrials = this.parsePositiveInt(trials);
    const customSeed = this.parsePositiveInt(seed);
    const finalMessageCount = this.clamp(customMessageCount || (isStressTest ? this.STRESS_DEFAULT_MESSAGES : 10000), 1000, 20000000);
    const finalPayloadKb = this.clamp(customPayloadKb || (isStressTest ? this.STRESS_DEFAULT_PAYLOAD_KB : this.STANDARD_DEFAULT_PAYLOAD_KB), 1, 256);
    const finalInflight = this.clamp(customInflight || (isStressTest ? this.STRESS_DEFAULT_INFLIGHT : this.STANDARD_DEFAULT_INFLIGHT), 1, 10000);
    const finalTrials = this.clamp(customTrials || 3, 1, 20);
    const finalSeed = customSeed || 42;
    const enforceMeasuredOnly = measuredOnly !== 'false';

    if (this.activeBenchmarkJobId) {
      this.logger.warn(`Benchmark request ignored; job already running: ${this.activeBenchmarkJobId}`);
      return {
        status: 'running',
        jobId: this.activeBenchmarkJobId,
        estimatedDurationSeconds: Math.ceil(finalMessageCount / 1000) * 15,
        testType: isStressTest ? 'stress' : 'standard',
        reason: 'Another benchmark is already running',
        selectedBrokers,
      };
    }

    const health = await this.brokerMetricsService.getCurrentMetrics(true);

    const unavailable = selectedBrokers.filter((broker) => !health.brokers[broker]?.connected);
    if (unavailable.length > 0) {
      this.logger.warn(`Benchmark blocked; unavailable brokers: ${unavailable.join(', ')}`);
      return {
        status: 'blocked',
        jobId: '',
        estimatedDurationSeconds: 0,
        testType: isStressTest ? 'stress' : 'standard',
        reason: `Selected brokers unavailable: ${unavailable.join(', ')}`,
        selectedBrokers,
      };
    }

    if (enforceMeasuredOnly) {
      const notMeasured = selectedBrokers.filter((broker) => {
        const source = health.brokers[broker]?.dataSource ?? 'missing';
        return source !== 'measured';
      });
      if (notMeasured.length > 0) {
        return {
          status: 'blocked',
          jobId: '',
          estimatedDurationSeconds: 0,
          testType: isStressTest ? 'stress' : 'standard',
          reason: `Controlled replay blocked: selected brokers are not measured-only (${notMeasured.join(', ')}).`,
          selectedBrokers,
        };
      }
    }

    const jobId = this.buildJobId(isStressTest);
    this.logger.log(
      `Benchmark requested: ${isStressTest ? 'stress test' : 'standard'} (${finalMessageCount} messages, payload=${finalPayloadKb}KB, inflight=${finalInflight}, trials=${finalTrials}, brokers=${selectedBrokers.join(',')})`,
    );

    if (!this.isTestEnvironment()) {
      this.activeBenchmarkJobId = jobId;
      this.launchBenchmarkScript({
        jobId,
        isStressTest,
        messageCount: finalMessageCount,
        payloadKb: finalPayloadKb,
        inflight: finalInflight,
        selectedBrokers,
        trials: finalTrials,
        seed: finalSeed,
      });
    }

    this.brokerMetricsService.clearCurrentMetricsCache();

    return {
      status: 'queued',
      jobId,
      estimatedDurationSeconds: Math.ceil(finalMessageCount / 1000) * 15, // Rough estimate: 15s per 1K messages
      testType: isStressTest ? 'stress' : 'standard',
      selectedBrokers,
    };
  }

  private launchBenchmarkScript(config: {
    jobId: string;
    isStressTest: boolean;
    messageCount: number;
    payloadKb: number;
    inflight: number;
    selectedBrokers: BrokerKey[];
    trials: number;
    seed: number;
  }): void {
    const benchmarkScriptPath = path.resolve(process.cwd(), 'scripts', 'benchmark-pulsar-vs-rabbitmq.mjs');
    const runLogsDir = path.resolve(process.cwd(), 'test-output', 'benchmark-runs');
    if (!existsSync(runLogsDir)) {
      mkdirSync(runLogsDir, { recursive: true });
    }

    const outputLogPath = path.join(runLogsDir, `${config.jobId}.log`);
    const logStream = createWriteStream(outputLogPath, { flags: 'a' });
    const args = [
      benchmarkScriptPath,
      `--messages=${config.messageCount}`,
      `--payload-kb=${config.payloadKb}`,
      `--inflight=${config.inflight}`,
      `--brokers=${config.selectedBrokers.join(',')}`,
      `--trials=${config.trials}`,
      `--seed=${config.seed}`,
      ...(config.isStressTest ? ['--stress-test'] : []),
    ];

    this.logger.log(`Launching benchmark job ${config.jobId}: node ${args.join(' ')}`);
    const child = spawn('node', args, { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });

    child.stdout?.pipe(logStream);
    child.stderr?.pipe(logStream);

    child.on('error', (error: Error) => {
      this.logger.error(`Benchmark process error (${config.jobId}): ${error.message}`);
      this.activeBenchmarkJobId = null;
      logStream.end();
    });

    child.on('close', (code: number | null) => {
      if (code === 0) {
        this.logger.log(`Benchmark job ${config.jobId} completed successfully`);
      } else {
        this.logger.error(`Benchmark job ${config.jobId} exited with code ${code}`);
      }
      this.activeBenchmarkJobId = null;
      logStream.end();
    });
  }

  private parsePositiveInt(value: string | undefined): number | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private isTestEnvironment(): boolean {
    return process.env['NODE_ENV'] === 'test' || typeof process.env['JEST_WORKER_ID'] !== 'undefined';
  }

  private parseSelectedBrokers(raw: string | undefined): BrokerKey[] {
    if (!raw) {
      return ['rabbitmq', 'pulsar'];
    }
    const parsed = raw
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter((value): value is BrokerKey => value === 'rabbitmq' || value === 'kafka' || value === 'pulsar');
    const deduped = Array.from(new Set(parsed));
    return deduped.length > 0 ? deduped : ['rabbitmq', 'pulsar'];
  }

  private buildJobId(isStressTest: boolean): string {
    this.jobSequence += 1;
    const sequence = this.jobSequence.toString().padStart(4, '0');
    return `bm-${new Date().toISOString().replace(/[:.]/g, '')}-${sequence}${isStressTest ? '-stress' : ''}`;
  }

  /**
   * GET /api/internal/brokers/system-metrics
   *
   * Returns current system resource usage (CPU, Memory, Disk I/O)
   * Used for real-time monitoring dashboard
   *
   * @example
   * GET /api/internal/brokers/system-metrics
   * {
   *   "cpu": 45.2,
   *   "memory": 67.8,
   *   "disk": 23.1
   * }
   */
  @Get('system-metrics')
  @ApiOperation({
    summary: 'Get system resource metrics',
    description: 'Returns current CPU, memory, and disk I/O usage percentages',
  })
  @ApiResponse({
    status: 200,
    description: 'System metrics retrieved successfully',
    schema: {
      example: {
        cpu: 45.2,
        memory: 67.8,
        disk: 23.1,
      },
    },
  })
  async getSystemMetrics(): Promise<{ cpu: number; memory: number; disk: number }> {
    // In a real implementation, this would query system metrics
    // For now, return simulated data
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100,
    };
  }

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
