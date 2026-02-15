import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Kafka,
  Producer,
  Consumer,
  Admin,
  EachMessagePayload,
  CompressionTypes,
} from 'kafkajs';
import {
  EventBase,
  KAFKA_TOPICS,
  KAFKA_TOPIC_CONFIG,
} from '@cosmic-horizons/event-models';
import { EventReplayService } from './services/event-replay.service';

/**
 * KafkaService
 *
 * Handles Kafka 3-broker cluster connection and durable event publishing.
 * Enables the real-time dashboards (Sprint 6) to replay historical events
 * and maintain audit compliance.
 *
 * Sprint 5.2 Goals:
 * - Connect to 3-broker Kafka cluster with Zookeeper coordination
 * - Initialize admin client for topic creation
 * - Publish events at 1000+ events/second
 * - Topic partitioning by job_id for message ordering
 * - Consumer group management for replay capability
 * - Offset management in PostgreSQL (enable "replay from date")
 *
 * Architecture Decision (see ADR-EVENT-STREAMING.md):
 * - RabbitMQ: Ephemeral events (real-time, no persistence)
 * - Kafka: Durable events (30-90 day retention, searchable, replay-capable)
 */
@Injectable()
export class KafkaService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka | null = null;
  private producer: Producer | null = null;
  private admin: Admin | null = null;
  private consumers: Map<string, Consumer> = new Map();
  private connected = false;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly eventReplayService?: EventReplayService,
  ) {}

  /**
   * Connect to Kafka cluster
   * Required: KAFKA_BROKERS env var (comma-separated: localhost:9092,localhost:9093,localhost:9094)
   */
  async connect(): Promise<void> {
    this.logger.log('Connecting to Kafka cluster...');

    try {
      const brokers = this.configService
        .get('KAFKA_BROKERS', 'localhost:9092,localhost:9093,localhost:9094')
        .split(',')
        .map((b: string) => b.trim());

      this.kafka = new Kafka({
        clientId: 'cosmic-horizons-api',
        brokers,
        connectionTimeout: 5000,
        requestTimeout: 10000,
        retry: {
          retries: 5,
          initialRetryTime: 100,
          maxRetryTime: 1000,
        },
      });

      // Initialize producer with idempotence
      this.producer = this.kafka.producer({
        transactionTimeout: 60000,
        idempotent: true, // Enable idempotent producer (exactly-once semantics)
        maxInFlightRequests: 5,
      });

      await this.producer.connect();
      this.logger.log('Kafka producer connected');

      // Initialize admin client
      this.admin = this.kafka.admin();
      await this.admin.connect();
      this.logger.log('Kafka admin client connected');

      // Create topics if they don't exist
      await this.createTopics();

      this.connected = true;
      this.logger.log('Kafka cluster connection established');
    } catch (error) {
      this.logger.error('Failed to connect to Kafka', error);
      throw error;
    }
  }

  /**
   * Create Kafka topics if they don't exist
   * Topics with different retention policies and replication factors
   */
  private async createTopics(): Promise<void> {
    if (!this.admin) {
      throw new Error('Admin client not initialized');
    }

    try {
      const topics: Array<{
        topic: string;
        numPartitions: number;
        replicationFactor: number;
        configEntries: Array<{ name: string; value: string }>;
      }> = [
        {
          topic: KAFKA_TOPICS.JOB_LIFECYCLE,
          numPartitions: KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.JOB_LIFECYCLE]
            .partitions,
          replicationFactor:
            KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.JOB_LIFECYCLE].replication_factor,
          configEntries: [
            {
              name: 'retention.ms',
              value: `${KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.JOB_LIFECYCLE].retention_ms}`,
            },
            { name: 'compression.type', value: 'snappy' },
            { name: 'cleanup.policy', value: 'delete' },
          ],
        },
        {
          topic: KAFKA_TOPICS.JOB_METRICS,
          numPartitions: KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.JOB_METRICS]
            .partitions,
          replicationFactor:
            KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.JOB_METRICS].replication_factor,
          configEntries: [
            {
              name: 'retention.ms',
              value: `${KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.JOB_METRICS].retention_ms}`,
            },
            { name: 'compression.type', value: 'snappy' },
            { name: 'cleanup.policy', value: 'delete' },
          ],
        },
        {
          topic: KAFKA_TOPICS.NOTIFICATIONS,
          numPartitions: KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.NOTIFICATIONS]
            .partitions,
          replicationFactor:
            KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.NOTIFICATIONS].replication_factor,
          configEntries: [
            {
              name: 'retention.ms',
              value: `${KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.NOTIFICATIONS].retention_ms}`,
            },
            { name: 'compression.type', value: 'lz4' },
            { name: 'cleanup.policy', value: 'delete' },
          ],
        },
        {
          topic: KAFKA_TOPICS.AUDIT_TRAIL,
          numPartitions: KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.AUDIT_TRAIL]
            .partitions,
          replicationFactor:
            KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.AUDIT_TRAIL].replication_factor,
          configEntries: [
            {
              name: 'retention.ms',
              value: `${KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.AUDIT_TRAIL].retention_ms}`,
            },
            { name: 'compression.type', value: 'snappy' },
            { name: 'cleanup.policy', value: 'delete' },
          ],
        },
        {
          topic: KAFKA_TOPICS.SYSTEM_HEALTH,
          numPartitions: KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.SYSTEM_HEALTH]
            .partitions,
          replicationFactor:
            KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.SYSTEM_HEALTH].replication_factor,
          configEntries: [
            {
              name: 'retention.ms',
              value: `${KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.SYSTEM_HEALTH].retention_ms}`,
            },
            { name: 'compression.type', value: 'lz4' },
            { name: 'cleanup.policy', value: 'delete' },
          ],
        },
      ];

      // Get existing topics
      const existingTopics = await this.admin.listTopics();
      const toCreate = topics.filter((t) => !existingTopics.includes(t.topic));

      if (toCreate.length > 0) {
        await this.admin.createTopics({
          topics: toCreate,
          validateOnly: false,
          timeout: 10000,
        });
        this.logger.log(`Created ${toCreate.length} topics`);
      } else {
        this.logger.log('All topics already exist');
      }
    } catch (error) {
      this.logger.warn('Failed to create topics (may already exist)', error);
      // Non-fatal - topics may already exist
    }
  }

  /**
   * Publish a job lifecycle event to Kafka
   * Keyed by job_id to ensure ordering within a job
   * Idempotent producer ensures exactly-once delivery
   */
  async publishJobLifecycleEvent(
    event: EventBase,
    jobId: string
  ): Promise<void> {
    if (!this.connected || !this.producer) {
      throw new Error('Kafka not connected');
    }

    try {
      const result = await this.producer.send({
        topic: KAFKA_TOPICS.JOB_LIFECYCLE,
        messages: [
          {
            key: jobId, // Ensures ordering for this job
            value: JSON.stringify(event),
            headers: {
              'content-type': 'application/json',
              'correlation-id': event.correlation_id,
              timestamp: event.timestamp,
            },
          },
        ],
        timeout: 10000,
        compression: CompressionTypes.GZIP,
      });

      this.logger.debug(
        `Job lifecycle event published: ${event.event_type} (partition: ${result[0].partition}, offset: ${result[0].baseOffset})`
      );
      this.eventReplayService?.recordPublishedEvent({
        topic: KAFKA_TOPICS.JOB_LIFECYCLE,
        partition: result[0].partition,
        offset: result[0].baseOffset,
        key: jobId,
        payload: event as unknown as Record<string, unknown>,
        timestamp: event.timestamp,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish job lifecycle event: ${event.event_type}`,
        error
      );
      throw error;
    }
  }

  /**
   * Publish performance metrics
   * Key: job_id for correlation
   */
  async publishJobMetrics(metrics: Record<string, unknown>, jobId: string): Promise<void> {
    if (!this.connected || !this.producer) {
      throw new Error('Kafka not connected');
    }

    try {
      const result = await this.producer.send({
        topic: KAFKA_TOPICS.JOB_METRICS,
        messages: [
          {
            key: jobId,
            value: JSON.stringify(metrics),
            headers: {
              timestamp: new Date().toISOString(),
              'job-id': jobId,
            },
          },
        ],
        timeout: 10000,
        compression: CompressionTypes.GZIP,
      });

      this.logger.debug(
        `Metrics published for job: ${jobId} (offset: ${result[0].baseOffset})`
      );
      this.eventReplayService?.recordPublishedEvent({
        topic: KAFKA_TOPICS.JOB_METRICS,
        partition: result[0].partition,
        offset: result[0].baseOffset,
        key: jobId,
        payload: metrics,
      });
    } catch (error) {
      this.logger.error(`Failed to publish metrics for job: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * Publish notification event
   */
  async publishNotificationEvent(event: EventBase): Promise<void> {
    if (!this.connected || !this.producer) {
      throw new Error('Kafka not connected');
    }

    try {
      const result = await this.producer.send({
        topic: KAFKA_TOPICS.NOTIFICATIONS,
        messages: [
          {
            key: null, // Broadcast to all consumers
            value: JSON.stringify(event),
            headers: {
              'correlation-id': event.correlation_id,
              timestamp: event.timestamp,
            },
          },
        ],
        timeout: 10000,
        compression: CompressionTypes.LZ4,
      });

      this.logger.debug(
        `Notification published: ${event.event_type} (offset: ${result[0].baseOffset})`
      );
      this.eventReplayService?.recordPublishedEvent({
        topic: KAFKA_TOPICS.NOTIFICATIONS,
        partition: result[0].partition,
        offset: result[0].baseOffset,
        key: null,
        payload: event as unknown as Record<string, unknown>,
        timestamp: event.timestamp,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish notification: ${event.event_type}`,
        error
      );
      throw error;
    }
  }

  /**
   * Publish audit trail event (90-day retention)
   * Used for compliance and operational auditing
   */
  async publishAuditEvent(
    event: EventBase,
    resourceId: string
  ): Promise<void> {
    if (!this.connected || !this.producer) {
      throw new Error('Kafka not connected');
    }

    try {
      const result = await this.producer.send({
        topic: KAFKA_TOPICS.AUDIT_TRAIL,
        messages: [
          {
            key: resourceId,
            value: JSON.stringify(event),
            headers: {
              'correlation-id': event.correlation_id,
              timestamp: event.timestamp,
              'resource-id': resourceId,
            },
          },
        ],
        timeout: 10000,
        compression: CompressionTypes.GZIP,
      });

      this.logger.debug(
        `Audit event published: ${event.event_type} (offset: ${result[0].baseOffset})`
      );
      this.eventReplayService?.recordPublishedEvent({
        topic: KAFKA_TOPICS.AUDIT_TRAIL,
        partition: result[0].partition,
        offset: result[0].baseOffset,
        key: resourceId,
        payload: event as unknown as Record<string, unknown>,
        timestamp: event.timestamp,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish audit event: ${event.event_type}`,
        error
      );
      throw error;
    }
  }

  /**
   * Publish system health event
   */
  async publishSystemHealthEvent(
    event: EventBase,
    componentId: string
  ): Promise<void> {
    if (!this.connected || !this.producer) {
      throw new Error('Kafka not connected');
    }

    try {
      const result = await this.producer.send({
        topic: KAFKA_TOPICS.SYSTEM_HEALTH,
        messages: [
          {
            key: componentId,
            value: JSON.stringify(event),
            headers: {
              timestamp: new Date().toISOString(),
            },
          },
        ],
        timeout: 10000,
        compression: CompressionTypes.LZ4,
      });

      this.logger.debug(`System health event published for: ${componentId}`);
      this.eventReplayService?.recordPublishedEvent({
        topic: KAFKA_TOPICS.SYSTEM_HEALTH,
        partition: result[0].partition,
        offset: result[0].baseOffset,
        key: componentId,
        payload: event as unknown as Record<string, unknown>,
        timestamp: event.timestamp,
      });
    } catch (error) {
      this.logger.error(
        `Failed to publish system health event for ${componentId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Create a consumer group for a service
   */
  async createConsumerGroup(groupId: string): Promise<Consumer> {
    if (!this.kafka) {
      throw new Error('Kafka not initialized');
    }

    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    this.consumers.set(groupId, consumer);
    this.logger.log(`Consumer group created: ${groupId}`);
    return consumer;
  }

  /**
   * Subscribe to a topic with a consumer group
   */
  async subscribe(
    groupId: string,
    topics: string[],
    handler: (message: EachMessagePayload) => Promise<void>
  ): Promise<void> {
    let consumer = this.consumers.get(groupId);
    if (!consumer) {
      consumer = await this.createConsumerGroup(groupId);
    }

    await consumer.subscribe({ topics, fromBeginning: false });
    await consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        await handler(payload);
        this.eventReplayService?.ackConsumerOffset({
          groupId,
          topic: payload.topic,
          partition: payload.partition,
          offset: payload.message.offset,
        });
      },
      partitionsConsumedConcurrently: 3,
    });

    this.logger.log(`Subscribed ${groupId} to topics: ${topics.join(', ')}`);
  }

  /**
   * Get Kafka cluster statistics
   */
  async getStats(): Promise<Record<string, unknown>> {
    if (!this.admin || !this.connected) {
      return { connected: false };
    }

    try {
      const cluster = await this.admin.describeCluster();
      const topics = await this.admin.listTopics();

      let totalPartitions = 0;
      try {
        const topicMetadata = await this.admin.fetchTopicMetadata({
          topics,
        });
        totalPartitions = topicMetadata.topics.reduce(
          (sum, topic) => sum + topic.partitions.length,
          0
        );
      } catch {
        // Fallback if metadata fetch fails
        totalPartitions = 0;
      }

      return {
        connected: this.connected,
        brokers: cluster.brokers.length,
        controller: cluster.controller,
        topics: topics.length,
        topicNames: topics,
        partitions: totalPartitions,
        replicationFactor: 1,
      };
    } catch (error) {
      this.logger.error('Failed to get Kafka stats', error);
      return { connected: false, error: 'Failed to query stats' };
    }
  }

  /**
   * Check if Kafka is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Disconnect from Kafka cluster
   */
  async disconnect(): Promise<void> {
    this.logger.log('Disconnecting from Kafka cluster...');

    try {
      if (this.producer) {
        await this.producer.disconnect();
        this.logger.log('Kafka producer disconnected');
      }

      if (this.admin) {
        await this.admin.disconnect();
        this.logger.log('Kafka admin disconnected');
      }

      for (const [groupId, consumer] of this.consumers) {
        await consumer.disconnect();
        this.logger.log(`Consumer group disconnected: ${groupId}`);
      }

      this.connected = false;
      this.logger.log('Kafka cluster disconnection complete');
    } catch (error) {
      this.logger.error('Failed to disconnect from Kafka', error);
      throw error;
    }
  }

  /**
   * NestJS lifecycle hook
   */
  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }
}
