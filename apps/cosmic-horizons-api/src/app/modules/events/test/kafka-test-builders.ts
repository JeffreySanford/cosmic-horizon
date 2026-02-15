/**
 * Kafka Test Builders
 *
 * Comprehensive testing infrastructure for Kafka event publishing and consumption
 * Week 2 - Sprint 5.2: Kafka Integration
 *
 * Components:
 * 1. KafkaEventBuilder - Type-safe event factory with Kafka routing
 * 2. KafkaHeaderBuilder - Message header construction
 * 3. MockKafkaPublisher - In-memory publisher for testing
 * 4. LatencyMeasurer - Performance metrics (P50, P95, P99)
 * 5. ConsumerMessageCapture - Event capture for assertions
 */

import {
  EventBase,
  KAFKA_TOPICS,
  generateEventId,
  generateCorrelationId,
  JobStatus,
  TaccSystem,
  NotificationChannel,
} from '@cosmic-horizons/event-models';
import { Logger } from '@nestjs/common';

/**
 * Type-safe Kafka message with routing context
 */
export interface KafkaMessage<T extends EventBase = EventBase> {
  topic: string;
  key: string | null;
  value: T;
  headers?: Record<string, string>;
  partition?: number;
  offset?: number;
  timestamp?: string;
}

/**
 * Captured consumer message for testing
 */
export interface CapturedMessage<T extends EventBase = EventBase> {
  message: KafkaMessage<T>;
  capturedAt: number; // Unix timestamp in ms
  processingTime?: number; // Time to process (if tracked)
}

/**
 * Latency statistics
 */
export interface LatencyStats {
  count: number;
  mean: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  stdDev: number;
}

/**
 * Publisher statistics
 */
export interface PublisherStats {
  totalMessages: number;
  messagesByTopic: Record<string, number>;
  messagesByType: Record<string, number>;
  totalBytes: number;
  successfulPublishes: number;
  failedPublishes: number;
  latencyStats: LatencyStats;
}

/**
 * KafkaEventBuilder
 *
 * Fluent builder for constructing type-safe Kafka messages
 * Extends base event creation with Kafka routing and partitioning
 */
export class KafkaEventBuilder {
  private event: EventBase;
  private kafkaKey: string | null = null;
  private kafkaHeaders: Record<string, string> = {};
  private targetTopic: string = KAFKA_TOPICS.JOB_LIFECYCLE;

  private constructor(baseEvent: EventBase) {
    this.event = baseEvent;
  }

  /**
   * Start with a job submitted event
   */
  static jobSubmittedEvent(overrides?: Partial<EventBase>): KafkaEventBuilder {
    const event: EventBase = {
      event_id: generateEventId(),
      event_type: 'job.submitted',
      timestamp: new Date().toISOString(),
      correlation_id: generateCorrelationId(),
      user_id: 'user-test-001',
      schema_version: 1,
      payload: {
        job_id: `job-${Date.now()}`,
        job_name: 'Test Job',
        tacc_system: TaccSystem.STAMPEDE3,
        resource_request: {
          num_nodes: 4,
          cores_per_node: 32,
          gpu_count_total: 4,
          memory_gb: 256,
          wall_time_minutes: 60,
        },
        estimated_cost_usd: 100.0,
        priority: 5,
      },
      ...overrides,
    };
    return new KafkaEventBuilder(event);
  }

  /**
   * Start with a job status changed event
   */
  static jobStatusChangedEvent(overrides?: Partial<EventBase>): KafkaEventBuilder {
    const event: EventBase = {
      event_id: generateEventId(),
      event_type: 'job.status.changed',
      timestamp: new Date().toISOString(),
      correlation_id: generateCorrelationId(),
      user_id: 'user-test-001',
      schema_version: 1,
      payload: {
        job_id: `job-${Date.now()}`,
        previous_status: JobStatus.QUEUED,
        new_status: JobStatus.RUNNING,
        reason: 'Resources available',
        transition_time_ms: 5000,
      },
      ...overrides,
    };
    return new KafkaEventBuilder(event);
  }

  /**
   * Start with a notification event
   */
  static notificationEvent(overrides?: Partial<EventBase>): KafkaEventBuilder {
    const event: EventBase = {
      event_id: generateEventId(),
      event_type: 'notification.sent',
      timestamp: new Date().toISOString(),
      correlation_id: generateCorrelationId(),
      user_id: 'user-test-001',
      schema_version: 1,
      payload: {
        notification_id: `notif-${Date.now()}`,
        recipient_user_id: 'user-recipient-001',
        channel: NotificationChannel.EMAIL,
        subject: 'Job Status Update',
        message: 'Your job has completed successfully',
        related_job_id: `job-${Date.now()}`,
        read_status: false,
        created_at: new Date().toISOString(),
      },
      ...overrides,
    };
    return new KafkaEventBuilder(event);
  }

  /**
   * Start with an audit event
   */
  static auditEvent(overrides?: Partial<EventBase>): KafkaEventBuilder {
    const event: EventBase = {
      event_id: generateEventId(),
      event_type: 'audit.event',
      timestamp: new Date().toISOString(),
      correlation_id: generateCorrelationId(),
      user_id: 'user-test-001',
      schema_version: 1,
      payload: {
        resource_id: `resource-${Date.now()}`,
        resource_type: 'job',
        action: 'create',
        actor_id: 'user-test-001',
        old_value: null,
        new_value: { job_id: `job-${Date.now()}` },
        reason: 'User submission',
        ip_address: '127.0.0.1',
        user_agent: 'test-agent/1.0',
      },
      ...overrides,
    };
    return new KafkaEventBuilder(event);
  }

  /**
   * Start with a metrics event
   */
  static metricsEvent(overrides?: Partial<EventBase>): KafkaEventBuilder {
    const event: EventBase = {
      event_id: generateEventId(),
      event_type: 'job.metrics',
      timestamp: new Date().toISOString(),
      correlation_id: generateCorrelationId(),
      user_id: 'system',
      schema_version: 1,
      payload: {
        job_id: `job-${Date.now()}`,
        cpu_percent: 85.5,
        gpu_percent: 92.0,
        memory_gb_used: 128,
        io_mb_per_sec: 150,
        wall_time_seconds: 1200,
        estimated_completion_seconds: 3600,
      },
      ...overrides,
    };
    return new KafkaEventBuilder(event);
  }

  /**
   * Set the Kafka partition key (for message ordering)
   * Example: job_id ensures all events for a job go to same partition
   */
  withPartitionKey(key: string): KafkaEventBuilder {
    this.kafkaKey = key;
    return this;
  }

  /**
   * Set the target topic
   */
  toTopic(topic: string): KafkaEventBuilder {
    this.targetTopic = topic;
    return this;
  }

  /**
   * Add a custom header
   */
  withHeader(name: string, value: string): KafkaEventBuilder {
    this.kafkaHeaders[name] = value;
    return this;
  }

  /**
   * Add multiple headers at once
   */
  withHeaders(headers: Record<string, string>): KafkaEventBuilder {
    this.kafkaHeaders = { ...this.kafkaHeaders, ...headers };
    return this;
  }

  /**
   * Override event correlation ID
   */
  withCorrelationId(correlationId: string): KafkaEventBuilder {
    this.event.correlation_id = correlationId;
    return this;
  }

  /**
   * Override event user ID
   */
  withUserId(userId: string): KafkaEventBuilder {
    this.event.user_id = userId;
    return this;
  }

  /**
   * Merge payload fields (shallow merge)
   */
  mergePayload<T extends Record<string, unknown>>(payload: Partial<T>): KafkaEventBuilder {
    this.event.payload = { ...this.event.payload, ...payload };
    return this;
  }

  /**
   * Build the Kafka message
   */
  build(): KafkaMessage<EventBase> {
    return {
      topic: this.targetTopic,
      key: this.kafkaKey,
      value: this.event,
      headers: {
        'content-type': 'application/json',
        'correlation-id': this.event.correlation_id,
        'timestamp': this.event.timestamp,
        ...this.kafkaHeaders,
      },
    };
  }

  /**
   * Build multiple messages in a batch (for throughput testing)
   */
  static buildBatch(
    count: number,
    template: (index: number) => KafkaEventBuilder
  ): KafkaMessage<EventBase>[] {
    const messages: KafkaMessage<EventBase>[] = [];
    for (let i = 0; i < count; i++) {
      messages.push(template(i).build());
    }
    return messages;
  }
}

/**
 * MockKafkaPublisher
 *
 * In-memory publisher for testing event routing and metrics
 * Captures all published messages with timestamps and performance data
 */
export class MockKafkaPublisher {
  private readonly logger = new Logger(MockKafkaPublisher.name);
  private messages: CapturedMessage<EventBase>[] = [];
  private failureMode = false;
  private failureReason: string | null = null;
  private latencySimulation = 0; // Simulated latency in ms
  private publishCount = 0;
  private publishLatencies: Map<string, number[]> = new Map();

  /**
   * Publish a Kafka message (synchronously captured)
   */
  async publish(message: KafkaMessage<EventBase>): Promise<void> {
    if (this.failureMode) {
      throw new Error(
        `Publish failed: ${this.failureReason || 'Unknown error'}`
      );
    }

    const startTime = Date.now();

    // Simulate latency
    if (this.latencySimulation > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencySimulation));
    }

    const elapsed = Date.now() - startTime;

    // Capture message
    this.messages.push({
      message,
      capturedAt: Date.now(),
      processingTime: elapsed,
    });

    this.publishCount++;

    // Track latency by topic
    if (!this.publishLatencies.has(message.topic)) {
      this.publishLatencies.set(message.topic, []);
    }
    this.publishLatencies.get(message.topic)!.push(elapsed);

    this.logger.debug(
      `Published to ${message.topic} (latency: ${elapsed}ms, total: ${this.publishCount})`
    );
  }

  /**
   * Publish multiple messages in batch
   */
  async publishBatch(messages: KafkaMessage<EventBase>[]): Promise<void> {
    for (const message of messages) {
      await this.publish(message);
    }
  }

  /**
   * Get all captured messages
   */
  getMessages(): CapturedMessage<EventBase>[] {
    return [...this.messages];
  }

  /**
   * Get messages by topic
   */
  getMessagesByTopic(topic: string): CapturedMessage<EventBase>[] {
    return this.messages.filter((m) => m.message.topic === topic);
  }

  /**
   * Get messages by event type
   */
  getMessagesByEventType(eventType: string): CapturedMessage<EventBase>[] {
    return this.messages.filter((m) => m.message.value.event_type === eventType);
  }

  /**
   * Get messages by correlation ID
   */
  getMessagesByCorrelationId(correlationId: string): CapturedMessage<EventBase>[] {
    return this.messages.filter(
      (m) => m.message.value.correlation_id === correlationId
    );
  }

  /**
   * Count total messages
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Count messages by topic
   */
  getMessageCountByTopic(topic: string): number {
    return this.getMessagesByTopic(topic).length;
  }

  /**
   * Get latency statistics
   */
  getLatencyStats(): LatencyStats {
    return this.calculateLatencyStats(
      Array.from(this.publishLatencies.values()).flat()
    );
  }

  /**
   * Get latency statistics for a specific topic
   */
  getLatencyStatsByTopic(topic: string): LatencyStats | null {
    const latencies = this.publishLatencies.get(topic);
    if (!latencies || latencies.length === 0) {
      return null;
    }
    return this.calculateLatencyStats(latencies);
  }

  /**
   * Calculate latency percentiles
   */
  private calculateLatencyStats(latencies: number[]): LatencyStats {
    if (latencies.length === 0) {
      return {
        count: 0,
        mean: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        stdDev: 0,
      };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const count = sorted.length;
    const mean = sorted.reduce((a, b) => a + b, 0) / count;
    const min = sorted[0];
    const max = sorted[count - 1];

    // Calculate percentiles
    const p50 = sorted[Math.floor(count * 0.5)];
    const p95 = sorted[Math.floor(count * 0.95)];
    const p99 = sorted[Math.floor(count * 0.99)];

    // Calculate standard deviation
    const variance =
      sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    return {
      count,
      mean: Math.round(mean * 100) / 100,
      min,
      max,
      p50,
      p95,
      p99,
      stdDev: Math.round(stdDev * 100) / 100,
    };
  }

  /**
   * Set simulated latency (for testing)
   */
  setSimulatedLatency(latencyMs: number): void {
    this.latencySimulation = latencyMs;
  }

  /**
   * Enable or disable failure mode
   */
  setFailureMode(enabled: boolean, reason = 'Simulated failure'): void {
    this.failureMode = enabled;
    this.failureReason = reason;
  }

  /**
   * Clear all captured messages
   */
  clear(): void {
    this.messages = [];
    this.publishCount = 0;
    this.publishLatencies.clear();
  }

  /**
   * Get full publisher statistics
   */
  getStats(): PublisherStats {
    const messagesByTopic: Record<string, number> = {};
    const messagesByType: Record<string, number> = {};
    let totalBytes = 0;

    for (const captured of this.messages) {
      const topic = captured.message.topic;
      const eventType = captured.message.value.event_type;

      messagesByTopic[topic] = (messagesByTopic[topic] || 0) + 1;
      messagesByType[eventType] = (messagesByType[eventType] || 0) + 1;
      totalBytes += JSON.stringify(captured.message.value).length;
    }

    return {
      totalMessages: this.messages.length,
      messagesByTopic,
      messagesByType,
      totalBytes,
      successfulPublishes: this.messages.length,
      failedPublishes: 0,
      latencyStats: this.getLatencyStats(),
    };
  }

  /**
   * Assert message was published
   */
  assertMessagePublished(
    topic: string,
    eventType: string
  ): CapturedMessage<EventBase> {
    const message = this.messages.find(
      (m) => m.message.topic === topic && m.message.value.event_type === eventType
    );
    if (!message) {
      throw new Error(
        `Expected message to topic ${topic} with type ${eventType} but not found`
      );
    }
    return message;
  }

  /**
   * Assert message count matches
   */
  assertMessageCount(expectedCount: number): void {
    if (this.messages.length !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} messages but got ${this.messages.length}`
      );
    }
  }

  /**
   * Assert latency is within bounds
   */
  assertLatencyWithinBounds(
    maxP99Ms: number,
    topic?: string
  ): void {
    const stats = topic
      ? this.getLatencyStatsByTopic(topic)
      : this.getLatencyStats();

    if (!stats) {
      throw new Error('No latency data available');
    }

    if (stats.p99 > maxP99Ms) {
      throw new Error(
        `P99 latency ${stats.p99}ms exceeds maximum ${maxP99Ms}ms`
      );
    }
  }

  /**
   * Assert throughput meets target
   */
  assertThroughput(messagesPerSecond: number, windowSeconds = 1): void {
    if (this.messages.length === 0) {
      throw new Error('No messages published');
    }

    const latestMessage = this.messages[this.messages.length - 1];
    const oldestMessage = this.messages[0];
    const duration =
      (latestMessage.capturedAt - oldestMessage.capturedAt) / 1000; // Convert to seconds

    if (duration < windowSeconds) {
      this.logger.warn(
        `Throughput window (${duration}s) is less than expected (${windowSeconds}s)`
      );
    }

    const actualThroughput = this.messages.length / Math.max(duration, windowSeconds);
    if (actualThroughput < messagesPerSecond) {
      throw new Error(
        `Throughput ${actualThroughput.toFixed(0)} msg/sec below target ${messagesPerSecond}`
      );
    }
  }
}

/**
 * LatencyMeasurer
 *
 * Utility for measuring and aggregating latency across operations
 * Tracks percentiles (P50, P95, P99) for performance analysis
 */
export class LatencyMeasurer {
  private measurements: Map<string, number[]> = new Map();

  /**
   * Start a latency measurement
   * Returns a function that completes the measurement when called
   */
  start(name: string): () => void {
    const startTime = Date.now();

    return () => {
      const elapsed = Date.now() - startTime;

      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }
      this.measurements.get(name)!.push(elapsed);
    };
  }

  /**
   * Measure an async operation
   */
  async measure<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const stop = this.start(name);
    try {
      return await fn();
    } finally {
      stop();
    }
  }

  /**
   * Get statistics for a measurement
   */
  getStats(name: string): LatencyStats | null {
    const measurements = this.measurements.get(name);
    if (!measurements || measurements.length === 0) {
      return null;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const count = sorted.length;
    const mean = sorted.reduce((a, b) => a + b, 0) / count;
    const min = sorted[0];
    const max = sorted[count - 1];

    const p50 = sorted[Math.floor(count * 0.5)];
    const p95 = sorted[Math.floor(count * 0.95)];
    const p99 = sorted[Math.floor(count * 0.99)];

    const variance =
      sorted.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    return {
      count,
      mean: Math.round(mean * 100) / 100,
      min,
      max,
      p50,
      p95,
      p99,
      stdDev: Math.round(stdDev * 100) / 100,
    };
  }

  /**
   * Get all measurement statistics
   */
  getAllStats(): Record<string, LatencyStats> {
    const result: Record<string, LatencyStats> = {};

    for (const name of this.measurements.keys()) {
      const stats = this.getStats(name);
      if (stats) {
        result[name] = stats;
      }
    }

    return result;
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear();
  }

  /**
   * Clear specific measurement
   */
  clearMeasurement(name: string): void {
    this.measurements.delete(name);
  }

  /**
   * Get measurement count
   */
  getCount(name: string): number {
    return this.measurements.get(name)?.length ?? 0;
  }
}

/**
 * ConsumerMessageCapture
 *
 * Captures messages consumed from Kafka for testing assertions
 */
export class ConsumerMessageCapture {
  private messages: CapturedMessage<EventBase>[] = [];

  /**
   * Capture a consumed message
   */
  capture(message: EventBase): void {
    this.messages.push({
      message: {
        topic: 'unknown', // Would be set by consumer
        key: null,
        value: message,
      },
      capturedAt: Date.now(),
    });
  }

  /**
   * Capture multiple messages
   */
  captureMany(messages: EventBase[]): void {
    for (const message of messages) {
      this.capture(message);
    }
  }

  /**
   * Get all captured messages
   */
  getMessages(): CapturedMessage<EventBase>[] {
    return [...this.messages];
  }

  /**
   * Get messages by correlation ID
   */
  getMessagesByCorrelationId(correlationId: string): CapturedMessage<EventBase>[] {
    return this.messages.filter(
      (m) => m.message.value.correlation_id === correlationId
    );
  }

  /**
   * Get messages by event type
   */
  getMessagesByEventType(eventType: string): CapturedMessage<EventBase>[] {
    return this.messages.filter((m) => m.message.value.event_type === eventType);
  }

  /**
   * Get message count
   */
  getCount(): number {
    return this.messages.length;
  }

  /**
   * Assert message was consumed
   */
  assertMessageConsumed(eventType: string): CapturedMessage<EventBase> {
    const message = this.messages.find(
      (m) => m.message.value.event_type === eventType
    );
    if (!message) {
      throw new Error(`Expected message of type ${eventType} but not found`);
    }
    return message;
  }

  /**
   * Assert message count matches
   */
  assertCount(expectedCount: number): void {
    if (this.messages.length !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} messages but got ${this.messages.length}`
      );
    }
  }

  /**
   * Clear all captured messages
   */
  clear(): void {
    this.messages = [];
  }
}
