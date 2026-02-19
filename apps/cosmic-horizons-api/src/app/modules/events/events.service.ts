import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { generateCorrelationId } from '@cosmic-horizons/event-models';
import { EventBase } from '@cosmic-horizons/event-models';
import { RabbitMQService } from './rabbitmq.service';
import { KafkaService } from './kafka.service';

/**
 * EventsService
 *
 * Central service for publishing events to both RabbitMQ (ephemeral) and Kafka (durable)
 * Handles routing, idempotency, and error handling
 *
 * Usage:
 *   - Inject EventsService
 *   - Call publishJobEvent(event) for job lifecycle events
 *   - Call publishNotification(event) for notifications
 *   - Call publishMetrics(event) for performance metrics
 *   - Call publishAuditEvent(event) for compliance audit
 */
@Injectable()
export class EventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventsService.name);
  private isReady = false;

  constructor(
    private readonly rabbitmqService: RabbitMQService,
    private readonly kafkaService: KafkaService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing EventsService...');
    try {
      await this.rabbitmqService.connect();
      this.logger.log('RabbitMQ connected');

      await this.kafkaService.connect();
      this.logger.log('Kafka connected');

      this.isReady = true;
      this.logger.log('EventsService ready');
    } catch (error) {
      this.logger.error('Failed to initialize EventsService', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Destroying EventsService...');
    try {
      await this.rabbitmqService.disconnect();
      await this.kafkaService.disconnect();
      this.logger.log('EventsService destroyed');
    } catch (error) {
      this.logger.error('Error during EventsService destruction', error);
    }
  }

  /**
   * Check if event infrastructure is ready
   */
  isServiceReady(): boolean {
    return this.isReady;
  }

  /**
   * Publish a job lifecycle event (RabbitMQ + Kafka)
   * Events: job.submitted, job.status.changed, job.completed, job.failed
   *
   * Routing:
   * - RabbitMQ: Immediate processing + WebSocket broadcast
   * - Kafka: Persistent audit trail
   */
  async publishJobEvent(event: EventBase): Promise<void> {
    if (!this.isReady) {
      throw new Error('EventsService not ready');
    }

    this.logger.debug(
      `Publishing job event: ${event.event_type} (${event.event_id})`,
    );

    try {
      // Publish to RabbitMQ for immediate processing
      await this.rabbitmqService.publishJobEvent(event);

      // Publish to Kafka for audit trail
      await this.kafkaService.publishJobLifecycleEvent(
        event,
        this.getPayloadId(event, 'job_id'),
      );

      this.logger.debug(`Job event published: ${event.event_type}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish job event: ${event.event_type}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Publish a notification event (RabbitMQ only)
   * Events: notification.sent, notification.read, alert.raised, etc.
   *
   * Routing:
   * - RabbitMQ: WebSocket broadcast to user
   * - TTL: 24 hours
   */
  async publishNotification(event: EventBase): Promise<void> {
    if (!this.isReady) {
      throw new Error('EventsService not ready');
    }

    this.logger.debug(`Publishing notification: ${event.event_type}`);

    try {
      await this.rabbitmqService.publishNotification(event);
      this.logger.debug(`Notification published: ${event.event_type}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish notification: ${event.event_type}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Publish performance metrics (Kafka only)
   * Events: job.metrics.recorded, job.performance.summary
   *
   * Routing:
   * - Kafka: Historical analytics and dashboard
   * - Retention: 30 days
   */
  async publishMetrics(event: EventBase): Promise<void> {
    if (!this.isReady) {
      throw new Error('EventsService not ready');
    }

    this.logger.debug(`Publishing metrics: ${event.event_type}`);

    try {
      await this.kafkaService.publishJobMetrics(
        event.payload,
        this.getPayloadId(event, 'job_id'),
      );
      this.logger.debug(`Metrics published: ${event.event_type}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish metrics: ${event.event_type}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Publish audit event (Kafka only)
   * Events: audit.action.recorded, audit.policy.changed, audit.data.access
   *
   * Routing:
   * - Kafka: Compliance and audit trail
   * - Retention: 90 days
   */
  async publishAuditEvent(event: EventBase): Promise<void> {
    if (!this.isReady) {
      throw new Error('EventsService not ready');
    }

    this.logger.debug(`Publishing audit event: ${event.event_type}`);

    try {
      await this.kafkaService.publishAuditEvent(
        event,
        this.getPayloadId(event, 'resource_id'),
      );
      this.logger.debug(`Audit event published: ${event.event_type}`);
    } catch (error) {
      this.logger.error(
        `Failed to publish audit event: ${event.event_type}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Create a correlation ID for linking related events
   */
  createCorrelationId(): string {
    return generateCorrelationId();
  }

  /**
   * Get event statistics and health
   */
  async getStats(): Promise<{
    rabbitmq_connected: boolean;
    kafka_connected: boolean;
    rabbitmq_stats?: Record<string, unknown>;
    kafka_stats?: Record<string, unknown>;
  }> {
    return {
      rabbitmq_connected: this.rabbitmqService.isConnected(),
      kafka_connected: this.kafkaService.isConnected(),
      rabbitmq_stats: await this.rabbitmqService.getStats(),
      kafka_stats: await this.kafkaService.getStats(),
    };
  }

  private getPayloadId(event: EventBase, key: string): string {
    const raw = event.payload?.[key];
    if (typeof raw === 'string' && raw.length > 0) {
      return raw;
    }
    return event.event_id;
  }
}
