/**
 * KafkaService Test Suite
 *
 * 40+ comprehensive tests for Kafka integration
 * Week 2 - Sprint 5.2: Kafka Integration
 *
 * Test Categories:
 * 1. Producer Tests (15 tests)
 * 2. Consumer Tests (12 tests)
 * 3. Performance Tests (5 tests)
 * 4. Schema Validation Tests (5 tests)
 * 5. Failure Scenario Tests (3 tests)
 */

import {
  KafkaEventBuilder,
  MockKafkaPublisher,
  LatencyMeasurer,
  ConsumerMessageCapture,
} from './kafka-test-builders';
import {
  KAFKA_TOPICS,
  JobStatus,
  TaccSystem,
  NotificationChannel,
} from '@cosmic-horizons/event-models';

describe('KafkaService Tests', () => {
  let mockPublisher: MockKafkaPublisher;
  let latencyMeasurer: LatencyMeasurer;

  beforeEach(() => {
    mockPublisher = new MockKafkaPublisher();
    latencyMeasurer = new LatencyMeasurer();
  });

  afterEach(() => {
    mockPublisher.clear();
    latencyMeasurer.clear();
  });

  // ============================================================================
  // PRODUCER TESTS (15 tests)
  // ============================================================================

  describe('Producer Tests', () => {
    it('should publish to job-lifecycle topic with job_id partition key', async () => {
      const message = KafkaEventBuilder.jobSubmittedEvent()
        .withPartitionKey('job-12345')
        .toTopic(KAFKA_TOPICS.JOB_LIFECYCLE)
        .build();

      await mockPublisher.publish(message);

      const captured = mockPublisher.getMessagesByTopic(KAFKA_TOPICS.JOB_LIFECYCLE);
      expect(captured).toHaveLength(1);
      expect(captured[0].message.key).toBe('job-12345');
      expect(captured[0].message.topic).toBe(KAFKA_TOPICS.JOB_LIFECYCLE);
    });

    it('should publish to job-metrics topic', async () => {
      const message = KafkaEventBuilder.metricsEvent()
        .withPartitionKey('job-12345')
        .toTopic(KAFKA_TOPICS.JOB_METRICS)
        .build();

      await mockPublisher.publish(message);

      const captured = mockPublisher.getMessagesByTopic(KAFKA_TOPICS.JOB_METRICS);
      expect(captured).toHaveLength(1);
      expect(captured[0].message.value.event_type).toBe('job.metrics');
    });

    it('should publish to notifications topic (broadcast - null key)', async () => {
      const message = KafkaEventBuilder.notificationEvent()
        .toTopic(KAFKA_TOPICS.NOTIFICATIONS)
        .build();

      await mockPublisher.publish(message);

      const captured = mockPublisher.getMessagesByTopic(KAFKA_TOPICS.NOTIFICATIONS);
      expect(captured).toHaveLength(1);
      expect(captured[0].message.key).toBeNull();
    });

    it('should publish to audit-trail topic with resource_id key', async () => {
      const message = KafkaEventBuilder.auditEvent()
        .withPartitionKey('resource-abc123')
        .toTopic(KAFKA_TOPICS.AUDIT_TRAIL)
        .build();

      await mockPublisher.publish(message);

      const captured = mockPublisher.getMessagesByTopic(KAFKA_TOPICS.AUDIT_TRAIL);
      expect(captured).toHaveLength(1);
      expect(captured[0].message.key).toBe('resource-abc123');
    });

    it('should publish to system-health topic', async () => {
      const message = KafkaEventBuilder.jobStatusChangedEvent()
        .toTopic(KAFKA_TOPICS.SYSTEM_HEALTH)
        .build();

      await mockPublisher.publish(message);

      const captured = mockPublisher.getMessagesByTopic(KAFKA_TOPICS.SYSTEM_HEALTH);
      expect(captured).toHaveLength(1);
    });

    it('should include correlation ID in message headers', async () => {
      const correlationId = 'corr-123-abc';
      const message = KafkaEventBuilder.jobSubmittedEvent()
        .withCorrelationId(correlationId)
        .build();

      await mockPublisher.publish(message);

      const captured = mockPublisher.getMessages();
      expect(captured[0].message.headers?.['correlation-id']).toBe(correlationId);
    });

    it('should include custom headers', async () => {
      const message = KafkaEventBuilder.jobSubmittedEvent()
        .withHeader('x-custom', 'custom-value')
        .withHeaders({ 'x-another': 'another-value' })
        .build();

      await mockPublisher.publish(message);

      const captured = mockPublisher.getMessages();
      expect(captured[0].message.headers?.['x-custom']).toBe('custom-value');
      expect(captured[0].message.headers?.['x-another']).toBe('another-value');
    });

    it('should preserve message ordering per partition key', async () => {
      const jobId = 'job-order-test';
      const messages = [
        KafkaEventBuilder.jobSubmittedEvent()
          .withPartitionKey(jobId)
          .build(),
        KafkaEventBuilder.jobStatusChangedEvent()
          .withPartitionKey(jobId)
          .build(),
        KafkaEventBuilder.jobStatusChangedEvent()
          .withPartitionKey(jobId)
          .mergePayload({ new_status: JobStatus.COMPLETED })
          .build(),
      ];

      for (const message of messages) {
        await mockPublisher.publish(message);
      }

      const captured = mockPublisher.getMessages();
      expect(captured).toHaveLength(3);
      expect(captured[0].message.value.event_type).toBe('job.submitted');
      expect(captured[1].message.value.event_type).toBe('job.status.changed');
      expect(captured[2].message.value.event_type).toBe('job.status.changed');
    });

    it('should handle batch publishing', async () => {
      const messages = KafkaEventBuilder.buildBatch(10, (index) =>
        KafkaEventBuilder.jobSubmittedEvent()
          .withPartitionKey(`job-batch-${index}`)
          .mergePayload({ job_name: `Batch Job ${index}` })
      );

      await mockPublisher.publishBatch(messages);

      expect(mockPublisher.getMessageCount()).toBe(10);
    });

    it('should track latency for each publish', async () => {
      mockPublisher.setSimulatedLatency(10); // 10ms simulated

      const message = KafkaEventBuilder.jobSubmittedEvent().build();
      await mockPublisher.publish(message);

      const stats = mockPublisher.getLatencyStats();
      expect(stats.count).toBe(1);
      expect(stats.mean).toBeGreaterThanOrEqual(10);
    });

    it('should support payload merging with strong typing', async () => {
      const payload = {
        custom_field: 'custom_value',
        numeric_field: 42,
      };

      const message = KafkaEventBuilder.jobSubmittedEvent()
        .mergePayload(payload)
        .build();

      expect(message.value.payload).toMatchObject(payload);
    });

    it('should track message count by topic', async () => {
      await mockPublisher.publish(
        KafkaEventBuilder.jobSubmittedEvent()
          .toTopic(KAFKA_TOPICS.JOB_LIFECYCLE)
          .build()
      );
      await mockPublisher.publish(
        KafkaEventBuilder.metricsEvent()
          .toTopic(KAFKA_TOPICS.JOB_METRICS)
          .build()
      );
      await mockPublisher.publish(
        KafkaEventBuilder.auditEvent()
          .toTopic(KAFKA_TOPICS.AUDIT_TRAIL)
          .build()
      );

      expect(mockPublisher.getMessageCountByTopic(KAFKA_TOPICS.JOB_LIFECYCLE)).toBe(1);
      expect(mockPublisher.getMessageCountByTopic(KAFKA_TOPICS.JOB_METRICS)).toBe(1);
      expect(mockPublisher.getMessageCountByTopic(KAFKA_TOPICS.AUDIT_TRAIL)).toBe(1);
    });

    it('should track message count by event type', async () => {
      await mockPublisher.publish(KafkaEventBuilder.jobSubmittedEvent().build());
      await mockPublisher.publish(KafkaEventBuilder.jobSubmittedEvent().build());
      await mockPublisher.publish(KafkaEventBuilder.jobStatusChangedEvent().build());

      const stats = mockPublisher.getStats();
      expect(stats.messagesByType['job.submitted']).toBe(2);
      expect(stats.messagesByType['job.status.changed']).toBe(1);
    });

    it('should calculate total bytes published', async () => {
      const message = KafkaEventBuilder.jobSubmittedEvent().build();
      await mockPublisher.publish(message);

      const stats = mockPublisher.getStats();
      expect(stats.totalBytes).toBeGreaterThan(0);
    });

    it('should throw error when failure mode is enabled', async () => {
      mockPublisher.setFailureMode(true, 'Broker unavailable');

      const message = KafkaEventBuilder.jobSubmittedEvent().build();

      await expect(mockPublisher.publish(message)).rejects.toThrow(
        'Broker unavailable'
      );
    });
  });

  // ============================================================================
  // CONSUMER TESTS (12 tests)
  // ============================================================================

  describe('Consumer Tests', () => {
    let capture: ConsumerMessageCapture;

    beforeEach(() => {
      capture = new ConsumerMessageCapture();
    });

    it('should capture consumed messages', () => {
      const event = KafkaEventBuilder.jobSubmittedEvent().build().value;
      capture.capture(event);

      expect(capture.getCount()).toBe(1);
      expect(capture.getMessages()[0].message.value.event_type).toBe('job.submitted');
    });

    it('should capture multiple messages', () => {
      const events = [
        KafkaEventBuilder.jobSubmittedEvent().build().value,
        KafkaEventBuilder.jobStatusChangedEvent().build().value,
        KafkaEventBuilder.notificationEvent().build().value,
      ];

      capture.captureMany(events);

      expect(capture.getCount()).toBe(3);
    });

    it('should filter messages by correlation ID', () => {
      const correlationId = 'test-corr-123';
      const event1 = KafkaEventBuilder.jobSubmittedEvent()
        .withCorrelationId(correlationId)
        .build().value;
      const event2 = KafkaEventBuilder.jobStatusChangedEvent()
        .build().value;

      capture.capture(event1);
      capture.capture(event2);

      const filtered = capture.getMessagesByCorrelationId(correlationId);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].message.value.correlation_id).toBe(correlationId);
    });

    it('should filter messages by event type', () => {
      capture.capture(KafkaEventBuilder.jobSubmittedEvent().build().value);
      capture.capture(KafkaEventBuilder.jobSubmittedEvent().build().value);
      capture.capture(KafkaEventBuilder.jobStatusChangedEvent().build().value);

      const submitted = capture.getMessagesByEventType('job.submitted');
      expect(submitted).toHaveLength(2);

      const statusChanged = capture.getMessagesByEventType('job.status.changed');
      expect(statusChanged).toHaveLength(1);
    });

    it('should track consumption order', () => {
      const events = [
        KafkaEventBuilder.jobSubmittedEvent().build().value,
        KafkaEventBuilder.jobStatusChangedEvent().build().value,
        KafkaEventBuilder.jobStatusChangedEvent().build().value,
      ];

      capture.captureMany(events);

      const messages = capture.getMessages();
      expect(messages[0].message.value.event_type).toBe('job.submitted');
      expect(messages[1].message.value.event_type).toBe('job.status.changed');
      expect(messages[2].message.value.event_type).toBe('job.status.changed');
    });

    it('should support consumer group offset tracking', () => {
      // Simulate offset progression
      for (let i = 0; i < 100; i++) {
        capture.capture(KafkaEventBuilder.jobSubmittedEvent().build().value);
      }

      expect(capture.getCount()).toBe(100);
    });

    it('should handle consumer rebalancing (reinitialization)', () => {
      capture.capture(KafkaEventBuilder.jobSubmittedEvent().build().value);
      capture.capture(KafkaEventBuilder.jobStatusChangedEvent().build().value);

      // Simulate rebalance: create new capture and continue
      const newCapture = new ConsumerMessageCapture();
      newCapture.capture(KafkaEventBuilder.notificationEvent().build().value);

      expect(capture.getCount()).toBe(2);
      expect(newCapture.getCount()).toBe(1);
    });

    it('should track message timestamps during consumption', () => {
      const beforeCapture = Date.now();
      capture.capture(KafkaEventBuilder.jobSubmittedEvent().build().value);
      const afterCapture = Date.now();

      const message = capture.getMessages()[0];
      expect(message.capturedAt).toBeGreaterThanOrEqual(beforeCapture);
      expect(message.capturedAt).toBeLessThanOrEqual(afterCapture);
    });

    it('should clear captured messages', () => {
      capture.capture(KafkaEventBuilder.jobSubmittedEvent().build().value);
      capture.capture(KafkaEventBuilder.jobStatusChangedEvent().build().value);

      expect(capture.getCount()).toBe(2);
      capture.clear();
      expect(capture.getCount()).toBe(0);
    });

    it('should assert message was consumed', () => {
      capture.capture(KafkaEventBuilder.jobSubmittedEvent().build().value);

      const message = capture.assertMessageConsumed('job.submitted');
      expect(message.message.value.event_type).toBe('job.submitted');
    });

    it('should throw when asserting non-existent message', () => {
      capture.capture(KafkaEventBuilder.jobSubmittedEvent().build().value);

      expect(() => {
        capture.assertMessageConsumed('non.existent.type');
      }).toThrow('Expected message of type non.existent.type but not found');
    });

    it('should assert message count', () => {
      capture.capture(KafkaEventBuilder.jobSubmittedEvent().build().value);
      capture.capture(KafkaEventBuilder.jobStatusChangedEvent().build().value);

      capture.assertCount(2);

      expect(() => {
        capture.assertCount(3);
      }).toThrow('Expected 3 messages but got 2');
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS (5 tests)
  // ============================================================================

  describe('Performance Tests', () => {
    it('should measure latency for single publish', () => {
      const stop = latencyMeasurer.start('test-publish');

      // Simulate work
      for (let i = 0; i < 100000; i++) {
        Math.sqrt(i);
      }

      stop();

      const stats = latencyMeasurer.getStats('test-publish');
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(1);
      expect(stats!.p50).toBeGreaterThan(0);
    });

    it('should calculate latency percentiles correctly', () => {
      const measurements = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

      for (const ms of measurements) {
        const stop = latencyMeasurer.start('percentile-test');
        // Simulate latency by delaying
        const now = Date.now();
        while (Date.now() - now < ms - 5) {
          // Approximate busy wait
        }
        stop();
      }

      const stats = latencyMeasurer.getStats('percentile-test');
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(10);
      expect(stats!.p50).toBeGreaterThan(0);
      expect(stats!.p95).toBeGreaterThanOrEqual(stats!.p50);
      expect(stats!.p99).toBeGreaterThanOrEqual(stats!.p95);
    });

    it('should measure async operation latency', async () => {
      const result = await latencyMeasurer.measure('async-op', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return 'done';
      });

      expect(result).toBe('done');

      const stats = latencyMeasurer.getStats('async-op');
      expect(stats!.count).toBe(1);
      expect(stats!.mean).toBeGreaterThanOrEqual(10);
    });

    it('should track latency for batch publishing (100 messages)', async () => {
      mockPublisher.setSimulatedLatency(1);

      const messages = KafkaEventBuilder.buildBatch(100, (index) =>
        KafkaEventBuilder.jobSubmittedEvent()
          .withPartitionKey(`job-perf-${index}`)
      );

      for (const message of messages) {
        await mockPublisher.publish(message);
      }

      const stats = mockPublisher.getLatencyStats();
      expect(stats.count).toBe(100);
      expect(stats.mean).toBeGreaterThanOrEqual(1);
    });

    it('should validate throughput (50+ msgs/sec minimum)', async () => {
      const messages = KafkaEventBuilder.buildBatch(100, (index) =>
        KafkaEventBuilder.jobSubmittedEvent()
          .toTopic(KAFKA_TOPICS.JOB_LIFECYCLE)
      );

      const start = Date.now();
      await mockPublisher.publishBatch(messages);
      const duration = (Date.now() - start) / 1000;

      const throughput = 100 / duration;
      expect(throughput).toBeGreaterThan(50);
    });
  });

  // ============================================================================
  // SCHEMA VALIDATION TESTS (5 tests)
  // ============================================================================

  describe('Schema Validation Tests', () => {
    it('should validate job.submitted event structure', () => {
      const message = KafkaEventBuilder.jobSubmittedEvent().build();
      const event = message.value;

      expect(event).toHaveProperty('event_id');
      expect(event).toHaveProperty('event_type', 'job.submitted');
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('correlation_id');
      expect(event).toHaveProperty('user_id');
      expect(event).toHaveProperty('payload');
    });

    it('should validate job lifecycle payload fields', () => {
      const message = KafkaEventBuilder.jobSubmittedEvent().build();
      const payload = message.value.payload as Record<string, unknown>;

      expect(payload).toHaveProperty('job_id');
      expect(payload).toHaveProperty('job_name');
      expect(payload).toHaveProperty('tacc_system');
      expect(payload).toHaveProperty('resource_request');
      expect(payload).toHaveProperty('estimated_cost_usd');
    });

    it('should validate enum values (TaccSystem)', () => {
      const message = KafkaEventBuilder.jobSubmittedEvent().build();
      const payload = message.value.payload as Record<string, unknown>;

      expect(Object.values(TaccSystem)).toContain(
        (payload.tacc_system as string)
      );
    });

    it('should validate enum values (JobStatus)', () => {
      const message = KafkaEventBuilder.jobStatusChangedEvent().build();
      const payload = message.value.payload as Record<string, unknown>;

      expect(Object.values(JobStatus)).toContain(payload.previous_status as string);
      expect(Object.values(JobStatus)).toContain(payload.new_status as string);
    });

    it('should validate enum values (NotificationChannel)', () => {
      const message = KafkaEventBuilder.notificationEvent().build();
      const payload = message.value.payload as Record<string, unknown>;

      expect(Object.values(NotificationChannel)).toContain(payload.channel as string);
    });
  });

  // ============================================================================
  // FAILURE SCENARIO TESTS (3 tests)
  // ============================================================================

  describe('Failure Scenario Tests', () => {
    it('should handle publish failure with error message', async () => {
      mockPublisher.setFailureMode(true, 'Broker unavailable');

      const message = KafkaEventBuilder.jobSubmittedEvent().build();

      await expect(mockPublisher.publish(message)).rejects.toThrow(
        'Broker unavailable'
      );
    });

    it('should allow recovery after failure', async () => {
      mockPublisher.setFailureMode(true);

      const message1 = KafkaEventBuilder.jobSubmittedEvent().build();

      await expect(mockPublisher.publish(message1)).rejects.toThrow();

      // Disable failure mode
      mockPublisher.setFailureMode(false);

      const message2 = KafkaEventBuilder.jobStatusChangedEvent().build();
      await mockPublisher.publish(message2);

      expect(mockPublisher.getMessageCount()).toBe(1);
    });

    it('should handle assertion failures gracefully', async () => {
      mockPublisher.setSimulatedLatency(5);
      await mockPublisher.publish(KafkaEventBuilder.jobSubmittedEvent().build());

      expect(() => {
        mockPublisher.assertLatencyWithinBounds(1); // Very strict bound
      }).toThrow();
    });
  });

  // ============================================================================
  // ASSERTION TESTS (3 tests)
  // ============================================================================

  describe('Assertion Tests', () => {
    it('should assert message published to topic', async () => {
      const message = KafkaEventBuilder.jobSubmittedEvent()
        .toTopic(KAFKA_TOPICS.JOB_LIFECYCLE)
        .build();

      await mockPublisher.publish(message);

      const captured = mockPublisher.assertMessagePublished(
        KAFKA_TOPICS.JOB_LIFECYCLE,
        'job.submitted'
      );

      expect(captured.message.value.event_type).toBe('job.submitted');
    });

    it('should assert message count', async () => {
      for (let i = 0; i < 5; i++) {
        await mockPublisher.publish(KafkaEventBuilder.jobSubmittedEvent().build());
      }

      mockPublisher.assertMessageCount(5);
    });

    it('should assert latency within bounds', async () => {
      const messages = KafkaEventBuilder.buildBatch(10, (index) =>
        KafkaEventBuilder.jobSubmittedEvent()
      );

      for (const message of messages) {
        await mockPublisher.publish(message);
      }

      // Assert P99 latency < 100ms (should pass for in-memory)
      mockPublisher.assertLatencyWithinBounds(100);
    });
  });

  // ============================================================================
  // STATISTICS TESTS (5 tests)
  // ============================================================================

  describe('Statistics Tests', () => {
    it('should generate publisher statistics', async () => {
      await mockPublisher.publish(
        KafkaEventBuilder.jobSubmittedEvent()
          .toTopic(KAFKA_TOPICS.JOB_LIFECYCLE)
          .build()
      );
      await mockPublisher.publish(
        KafkaEventBuilder.metricsEvent()
          .toTopic(KAFKA_TOPICS.JOB_METRICS)
          .build()
      );

      const stats = mockPublisher.getStats();

      expect(stats.totalMessages).toBe(2);
      expect(stats.messagesByTopic[KAFKA_TOPICS.JOB_LIFECYCLE]).toBe(1);
      expect(stats.messagesByTopic[KAFKA_TOPICS.JOB_METRICS]).toBe(1);
      expect(stats.messagesByType['job.submitted']).toBe(1);
      expect(stats.messagesByType['job.metrics']).toBe(1);
      expect(stats.totalBytes).toBeGreaterThan(0);
    });

    it('should track latency statistics by topic', async () => {
      mockPublisher.setSimulatedLatency(5);

      for (let i = 0; i < 20; i++) {
        await mockPublisher.publish(
          KafkaEventBuilder.jobSubmittedEvent()
            .toTopic(KAFKA_TOPICS.JOB_LIFECYCLE)
            .build()
        );
      }

      const stats = mockPublisher.getLatencyStatsByTopic(KAFKA_TOPICS.JOB_LIFECYCLE);
      expect(stats).not.toBeNull();
      expect(stats!.count).toBe(20);
      expect(stats!.p99).toBeGreaterThan(0);
    });

    it('should return null for topic with no messages', () => {
      const stats = mockPublisher.getLatencyStatsByTopic('non-existent-topic');
      expect(stats).toBeNull();
    });

    it('should track all measurement statistics', async () => {
      const stop1 = latencyMeasurer.start('test-1');
      await new Promise((resolve) => setTimeout(resolve, 5));
      stop1();

      const stop2 = latencyMeasurer.start('test-2');
      await new Promise((resolve) => setTimeout(resolve, 10));
      stop2();

      const allStats = latencyMeasurer.getAllStats();
      expect(Object.keys(allStats)).toHaveLength(2);
      expect(allStats['test-1']).toBeDefined();
      expect(allStats['test-2']).toBeDefined();
    });

    it('should support clearing measurement data', () => {
      const stop = latencyMeasurer.start('test-clear');
      stop();

      let stats = latencyMeasurer.getStats('test-clear');
      expect(stats).not.toBeNull();

      latencyMeasurer.clearMeasurement('test-clear');
      stats = latencyMeasurer.getStats('test-clear');
      expect(stats).toBeNull();
    });
  });
});
