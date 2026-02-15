/**
 * Test Infrastructure for Events Module
 * 
 * Provides builders, mocks, and utilities for testing event publishing
 * Supports 45+ integration tests with latency measurement
 */

import {
  EventBase,
  generateEventId,
  generateCorrelationId,
  JobSubmittedEvent,
  JobStatusChangedEvent,
  NotificationSentEvent,
  JobStatus,
  TaccSystem,
  NotificationChannel,
} from '@cosmic-horizons/event-models';

/**
 * EventFactory - Builder pattern for creating test events
 * Fluent API for constructing events with common defaults
 * Type-safe implementations for specific event types
 */
export class EventFactory {
  private event: Partial<EventBase> = {
    event_id: generateEventId(),
    event_type: 'job.submitted',
    timestamp: new Date().toISOString(),
    correlation_id: generateCorrelationId(),
    user_id: 'test-user-123',
    schema_version: 1,
    payload: {},
  };

  /**
   * Create a job submitted event (default)
   * Strongly typed as JobSubmittedEvent
   */
  static jobSubmitted(): EventFactory & { build: () => JobSubmittedEvent } {
    const factory = new EventFactory();
    factory.event.event_type = 'job.submitted';
    factory.event.payload = {
      job_id: 'job-test-001',
      project_id: 'proj-001',
      user_id: 'test-user-123',
      job_name: 'Test Job',
      tacc_system: 'stampede3',
      estimated_runtime_minutes: 60,
      num_nodes: 4,
      created_at: new Date().toISOString(),
    };
    return factory as EventFactory & { build: () => JobSubmittedEvent };
  }

  /**
   * Create a job status changed event
   * Strongly typed as JobStatusChangedEvent
   */
  static jobStatusChanged(): EventFactory & { build: () => JobStatusChangedEvent } {
    const factory = new EventFactory();
    factory.event.event_type = 'job.status.changed';
    factory.event.payload = {
      job_id: 'job-test-001',
      previous_status: 'submitted',
      new_status: 'queued',
      timestamp: new Date().toISOString(),
      reason: 'Job queued for execution',
    };
    return factory as EventFactory & { build: () => JobStatusChangedEvent };
  }

  /**
   * Create a notification sent event
   * Strongly typed as NotificationSentEvent
   */
  static notificationSent(): EventFactory & { build: () => NotificationSentEvent } {
    const factory = new EventFactory();
    factory.event.event_type = 'notification.sent';
    factory.event.payload = {
      notification_id: 'notif-001',
      recipient_user_id: 'test-user-123',
      channel: NotificationChannel.EMAIL,
      subject: 'Job Status Update',
      message: 'Your job is running',
      related_job_id: 'job-test-001',
      data: {},
      read_status: 'unread',
      created_at: new Date().toISOString(),
    };
    return factory as EventFactory & { build: () => NotificationSentEvent };
  }

  /**
   * Set event type
   */
  withEventType(type: string): EventFactory {
    this.event.event_type = type;
    return this;
  }

  /**
   * Set correlation ID (for tracing)
   */
  withCorrelationId(id: string): EventFactory {
    this.event.correlation_id = id;
    return this;
  }

  /**
   * Set user ID
   */
  withUserId(userId: string): EventFactory {
    this.event.user_id = userId;
    return this;
  }

  /**
   * Set payload
   */
  withPayload(payload: Record<string, unknown>): EventFactory {
    this.event.payload = payload;
    return this;
  }

  /**
   * Merge payload (shallow merge with existing)
   */
  mergePayload(payload: Record<string, unknown>): EventFactory {
    this.event.payload = { ...this.event.payload, ...payload };
    return this;
  }

  /**
   * Set job ID in payload
   */
  withJobId(jobId: string): EventFactory {
    this.mergePayload({ job_id: jobId });
    return this;
  }

  /**
   * Set timestamp (for replay scenarios)
   */
  withTimestamp(timestamp: string): EventFactory {
    this.event.timestamp = timestamp;
    return this;
  }

  /**
   * Build the event
   */
  build(): EventBase {
    return this.event as EventBase;
  }
}

/**
 * TypeSafeEventBuilder - Create strongly-typed events with validation
 * Ensures payload structure matches event type requirements
 */
export class TypeSafeEventBuilder {
  /**
   * Create a JobSubmittedEvent with full type safety
   */
  static createJobSubmittedEvent(overrides?: Partial<JobSubmittedEvent>): JobSubmittedEvent {
    const defaults: JobSubmittedEvent = {
      event_id: generateEventId(),
      event_type: 'job.submitted',
      timestamp: new Date().toISOString(),
      correlation_id: generateCorrelationId(),
      user_id: 'test-user-123',
      schema_version: 1,
      payload: {
        job_id: 'job-test-001',
        job_name: 'Test Job',
        tacc_system: TaccSystem.STAMPEDE3,
        resource_request: {
          num_nodes: 4,
          cores_per_node: 64,
          gpu_count_total: 0,
          memory_gb: 256,
          wall_time_minutes: 120,
        },
        estimated_cost_usd: 25.5,
        priority: 'normal',
      },
    };

    if (overrides) {
      return {
        ...defaults,
        ...overrides,
      };
    }

    return defaults;
  }

  /**
   * Create a JobStatusChangedEvent with full type safety
   */
  static createJobStatusChangedEvent(overrides?: Partial<JobStatusChangedEvent>): JobStatusChangedEvent {
    const defaults: JobStatusChangedEvent = {
      event_id: generateEventId(),
      event_type: 'job.status.changed',
      timestamp: new Date().toISOString(),
      correlation_id: generateCorrelationId(),
      user_id: 'test-user-123',
      schema_version: 1,
      payload: {
        job_id: 'job-test-001',
        previous_status: JobStatus.QUEUED,
        new_status: JobStatus.RUNNING,
        reason: 'Resources allocated',
        transition_time_ms: 300000,
      },
    };

    if (overrides) {
      return {
        ...defaults,
        ...overrides,
      };
    }

    return defaults;
  }

  /**
   * Create a NotificationSentEvent with full type safety
   */
  static createNotificationSentEvent(overrides?: Partial<NotificationSentEvent>): NotificationSentEvent {
    const defaults: NotificationSentEvent = {
      event_id: generateEventId(),
      event_type: 'notification.sent',
      timestamp: new Date().toISOString(),
      correlation_id: generateCorrelationId(),
      user_id: 'test-user-123',
      schema_version: 1,
      payload: {
        notification_id: 'notif-001',
        recipient_user_id: 'test-user-123',
        channel: NotificationChannel.EMAIL,
        subject: 'Job Status Update',
        message: 'Your job is running',
        related_job_id: 'job-test-001',
        data: {},
        read_status: 'unread',
        created_at: new Date().toISOString(),
      },
    };

    if (overrides) {
      return {
        ...defaults,
        ...overrides,
      };
    }

    return defaults;
  }

  /**
   * Build a job lifecycle chain: submitted → status changed → notification
   * Returns tuple of [JobSubmittedEvent, JobStatusChangedEvent, NotificationSentEvent]
   */
  static createJobLifecycleChain(jobId: string, userId: string): [JobSubmittedEvent, JobStatusChangedEvent, NotificationSentEvent] {
    const correlationId = generateCorrelationId();

    const submitted = this.createJobSubmittedEvent({
      correlation_id: correlationId,
      user_id: userId,
      payload: {
        job_id: jobId,
        job_name: 'Lifecycle Test Job',
        tacc_system: TaccSystem.STAMPEDE3,
        resource_request: {
          num_nodes: 4,
          cores_per_node: 64,
          gpu_count_total: 0,
          memory_gb: 256,
          wall_time_minutes: 60,
        },
        estimated_cost_usd: 25.5,
        priority: 'normal',
      },
    });

    const statusChanged = this.createJobStatusChangedEvent({
      correlation_id: correlationId,
      user_id: userId,
      payload: {
        job_id: jobId,
        previous_status: JobStatus.QUEUED,
        new_status: JobStatus.RUNNING,
        reason: 'Job moved to queue',
        transition_time_ms: 300000,
      },
    });

    const notification = this.createNotificationSentEvent({
      correlation_id: correlationId,
      user_id: userId,
      payload: {
        notification_id: `notif-${jobId}`,
        recipient_user_id: userId,
        channel: NotificationChannel.EMAIL,
        subject: `Job ${jobId} Status Update`,
        message: 'Your job has been queued for execution',
        related_job_id: jobId,
        data: { job_status: 'queued' },
        read_status: 'unread',
        created_at: new Date().toISOString(),
      },
    });

    return [submitted, statusChanged, notification];
  }
}

/**
 * MockRabbitMQPublisher - In-memory publisher for unit testing
 * Captures published events without requiring a real broker
 */
export class MockRabbitMQPublisher {
  private publishedEvents: Array<{
    event: EventBase;
    exchange: string;
    timestamp: number;
  }> = [];

  private latencies: number[] = [];
  private shouldFail = false;
  private failureMode: 'throw' | 'buffer' = 'throw';

  /**
   * Simulate publishing a job event
   */
  async publishJobEvent(event: EventBase): Promise<void> {
    const startTime = performance.now();

    if (this.shouldFail && this.failureMode === 'throw') {
      throw new Error('Mock publish failed (simulated)');
    }

    this.publishedEvents.push({
      event,
      exchange: 'job.events',
      timestamp: Date.now(),
    });

    const latency = performance.now() - startTime;
    this.latencies.push(latency);
  }

  /**
   * Simulate publishing a notification
   */
  async publishNotification(event: EventBase): Promise<void> {
    const startTime = performance.now();

    if (this.shouldFail && this.failureMode === 'throw') {
      throw new Error('Mock publish failed (simulated)');
    }

    this.publishedEvents.push({
      event,
      exchange: 'notifications',
      timestamp: Date.now(),
    });

    const latency = performance.now() - startTime;
    this.latencies.push(latency);
  }

  /**
   * Get all published events
   */
  getPublishedEvents(): EventBase[] {
    return this.publishedEvents.map((p) => p.event);
  }

  /**
   * Get published events for a specific exchange
   */
  getEventsByExchange(exchange: string): EventBase[] {
    return this.publishedEvents
      .filter((p) => p.exchange === exchange)
      .map((p) => p.event);
  }

  /**
   * Get published events by type
   */
  getEventsByType(eventType: string): EventBase[] {
    return this.publishedEvents
      .filter((p) => p.event.event_type === eventType)
      .map((p) => p.event);
  }

  /**
   * Get event count
   */
  getEventCount(): number {
    return this.publishedEvents.length;
  }

  /**
   * Clear all published events and latencies
   */
  clear(): void {
    this.publishedEvents = [];
    this.latencies = [];
  }

  /**
   * Enable failure mode (for error handling tests)
   */
  setFailureMode(shouldFail: boolean, mode: 'throw' | 'buffer' = 'throw'): void {
    this.shouldFail = shouldFail;
    this.failureMode = mode;
  }

  /**
   * Get latency statistics
   */
  getLatencyStats(): {
    mean: number;
    median: number;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  } {
    if (this.latencies.length === 0) {
      return {
        mean: 0,
        median: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0,
      };
    }

    const sorted = [...this.latencies].sort((a, b) => a - b);
    const length = sorted.length;

    return {
      mean: sorted.reduce((a, b) => a + b, 0) / length,
      median: sorted[Math.floor(length / 2)],
      p50: sorted[Math.floor(length * 0.5)],
      p95: sorted[Math.floor(length * 0.95)],
      p99: sorted[Math.floor(length * 0.99)],
      min: sorted[0],
      max: sorted[length - 1],
    };
  }

  /**
   * Assert event was published
   */
  assertEventPublished(eventType: string): void {
    const found = this.publishedEvents.some((p) => p.event.event_type === eventType);
    if (!found) {
      throw new Error(`Expected event of type "${eventType}" to be published`);
    }
  }

  /**
   * Assert event count
   */
  assertEventCount(expected: number): void {
    if (this.publishedEvents.length !== expected) {
      throw new Error(
        `Expected ${expected} events, but got ${this.publishedEvents.length}`
      );
    }
  }

  /**
   * Assert latency is within bounds
   */
  assertLatencyWithinBounds(maxMs: number, percentile = 0.99): void {
    const stats = this.getLatencyStats();
    const actual =
      percentile === 0.99
        ? stats.p99
        : percentile === 0.95
          ? stats.p95
          : stats.p50;

    if (actual > maxMs) {
      throw new Error(
        `Latency p${Math.floor(percentile * 100)} of ${actual.toFixed(2)}ms exceeds max ${maxMs}ms`
      );
    }
  }
}

/**
 * Latency measurement helper
 * Captures timings for performance validation
 */
export class LatencyMeasurer {
  private measurements: Map<string, number[]> = new Map();

  /**
   * Start measuring a named operation
   */
  start(name: string): () => void {
    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }
      const namedMeasurements = this.measurements.get(name);
      if (namedMeasurements) {
        namedMeasurements.push(duration);
      }
    };
  }

  /**
   * Get statistics for a measurement
   */
  getStats(name: string): {
    count: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  } {
    const values = this.measurements.get(name) || [];

    if (values.length === 0) {
      return { count: 0, mean: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const length = sorted.length;

    return {
      count: length,
      mean: sorted.reduce((a, b) => a + b, 0) / length,
      p50: sorted[Math.floor(length * 0.5)],
      p95: sorted[Math.floor(length * 0.95)],
      p99: sorted[Math.floor(length * 0.99)],
      min: sorted[0],
      max: sorted[length - 1],
    };
  }

  /**
   * Get all measurements
   */
  getAllStats(): Record<
    string,
    {
      count: number;
      mean: number;
      p50: number;
      p95: number;
      p99: number;
      min: number;
      max: number;
    }
  > {
    const result: Record<
      string,
      {
        count: number;
        mean: number;
        p50: number;
        p95: number;
        p99: number;
        min: number;
        max: number;
      }
    > = {};

    for (const [name] of this.measurements) {
      result[name] = this.getStats(name);
    }

    return result;
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear();
  }
}
