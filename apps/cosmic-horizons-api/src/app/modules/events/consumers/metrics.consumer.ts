import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { KafkaService } from '../kafka.service';
import { MetricsService } from '../services/metrics.service';
import { EachMessagePayload } from 'kafkajs';

interface MetricEvent {
  job_id: string;
  event_type?: string;
  cpu_usage_percent?: number;
  memory_usage_mb?: number;
  execution_time_seconds?: number;
  timestamp?: string | number;
}

/**
 * MetricsConsumer subscribes to job-metrics topic
 * Aggregates metrics by job_id and broadcasts updates
 * Non-blocking: continue consuming even if aggregation fails
 */
@Injectable()
export class MetricsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('MetricsConsumer');
  private maxRetries = 30; // 30 seconds with 1s delays
  private retryInterval = 1000;

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly metricsService: MetricsService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Wait for Kafka to be fully initialized before subscribing
    await this.waitForKafka();
    await this.startConsuming();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.kafkaService.disconnect();
    } catch (error) {
      this.logger.warn(`Error disconnecting from Kafka: ${error}`);
    }
  }

  /**
   * Wait for Kafka connection to be established
   */
  private async waitForKafka(): Promise<void> {
    let attempts = 0;
    while (!this.kafkaService.isConnected() && attempts < this.maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, this.retryInterval));
      attempts++;
    }
    if (!this.kafkaService.isConnected()) {
      this.logger.warn('Kafka not ready after retries, continuing anyway');
    }
  }

  /**
   * Start consuming metrics events from job-metrics topic
   * Consumer group: metrics-consumer-group
   */
  private async startConsuming(): Promise<void> {
    try {
      await this.kafkaService.subscribe(
        'metrics-consumer-group',
        ['job-metrics'],
        async (payload: EachMessagePayload) => {
          await this.handleMetricEvent(payload);
        },
      );
      this.logger.log('Started consuming from job-metrics topic');
    } catch (error) {
      this.logger.warn(`Failed to start consuming metrics: ${error}`);
      // Don't throw - allow app to continue
    }
  }

  /**
   * Handle incoming metric event
   * Parse, aggregate, and broadcast
   */
  private async handleMetricEvent(payload: EachMessagePayload): Promise<void> {
    const raw = payload.message.value?.toString() || '';
    let event: MetricEvent | null = null;
    try {
      event = JSON.parse(raw) as MetricEvent;
    } catch {
      this.logger.warn(
        `Skipping invalid metric event payload: ${raw.slice(0, 200)}`,
      );
      return;
    }

    if (!event.job_id) {
      this.logger.warn(
        `Skipping metric event without job_id: ${raw.slice(0, 200)}`,
      );
      return;
    }

    this.logger.debug(`Received metric event for job ${event.job_id}`);

    try {
      // Aggregate metrics by job_id (coerce optional fields to required types)
      const aggPayload = {
        event_type: event.event_type ?? 'unknown',
        cpu_usage_percent: Number(event.cpu_usage_percent ?? 0),
        memory_usage_mb: Number(event.memory_usage_mb ?? 0),
        execution_time_seconds: Number(event.execution_time_seconds ?? 0),
        timestamp: String(event.timestamp ?? Date.now()),
      };
      await this.metricsService.aggregateJobMetrics(event.job_id, aggPayload);

      // Broadcast metrics update
      try {
        const metrics = await this.metricsService.getJobMetricsSummary(
          event.job_id,
        );
        await this.metricsService.broadcastMetricsUpdate(event.job_id, metrics);
      } catch (broadcastError) {
        this.logger.warn(
          `Failed to broadcast metrics for ${event.job_id}: ${broadcastError}`,
        );
      }

      this.logger.debug(`Processed metric event for job ${event.job_id}`);
    } catch (error) {
      this.logger.warn(
        `Error processing metric event: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      // Non-blocking - continue consuming
    }
  }
}
