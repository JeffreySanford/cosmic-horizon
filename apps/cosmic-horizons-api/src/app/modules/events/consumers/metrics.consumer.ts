import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { KafkaService } from '../kafka.service';
import { MetricsService } from '../services/metrics.service';
import { EachMessagePayload } from 'kafkajs';

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
    try {
      const event = JSON.parse(payload.message.value?.toString() || '{}');

      this.logger.debug(`Received metric event for job ${event.job_id}`);

      // Aggregate metrics by job_id
      await this.metricsService.aggregateJobMetrics(event.job_id, {
        event_type: event.event_type,
        cpu_usage_percent: event.cpu_usage_percent,
        memory_usage_mb: event.memory_usage_mb,
        execution_time_seconds: event.execution_time_seconds,
        timestamp: event.timestamp,
      });

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
      this.logger.error(`Error processing metric event: ${error}`);
      // Non-blocking - continue consuming
    }
  }
}
