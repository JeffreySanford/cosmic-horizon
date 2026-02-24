# Event Schema Definitions for Phase 3

**Version**: 1.0  
**Date**: 2026-02-14  
**Status**: DRAFT (For Sprint 5.1 Design Review)

## Overview

This document defines the shared event schema used across RabbitMQ (ephemeral) and Kafka (durable) brokers.

All events inherit from `EventBase` and include common fields for tracking, ordering, and replay.

## Base Event Interface

```typescript
interface EventBase {
  /**
   * Unique event identifier (UUID)
   * Used for idempotency and deduplication
   */
  event_id: string;

  /**
   * Event type discriminator (e.g., 'job.submitted', 'job.status.changed')
   * Used for routing and filtering
   */
  event_type: string;

  /**
   * ISO 8601 timestamp of event creation (server time)
   * Used for ordering and analytics
   */
  timestamp: string;

  /**
   * Correlation ID linking related events
   * Allows tracing job → status changes → notifications
   */
  correlation_id: string;

  /**
   * User ID who triggered the event
   * For audit trail and user-scoped filtering
   */
  user_id: string;

  /**
   * Version of event schema
   * Supports schema evolution (backward compatibility)
   */
  schema_version: number;

  /**
   * Event payload (type-specific)
   * Discriminated union by event_type
   */
  payload: Record<string, unknown>;

  /**
   * Optional: idempotency key for deduplication
   * If provided, broker prevents duplicate processing
   */
  idempotency_key?: string;

  /**
   * Optional: parent event ID (for chained events)
   * e.g., job.submitted → job.queued → job.running
   */
  parent_event_id?: string;

  /**
   * Optional: tags for filtering/grouping
   * e.g., ['high-priority', 'gpu-intensive']
   */
  tags?: string[];
}
```

## Event Types

### 1. Job Lifecycle Events

#### `job.submitted`

When a user submits a new job to TACC.

```typescript
interface JobSubmittedEvent extends EventBase {
  event_type: 'job.submitted';
  payload: {
    job_id: string;
    job_name: string;
    user_id: string;
    tacc_system: 'frontera' | 'stampede3' | 'other';
    resource_request: {
      num_nodes: number;
      cores_per_node: number;
      gpu_count_total: number;
      memory_gb: number;
      wall_time_minutes: number;
    };
    estimated_cost_usd: number;
    priority: 'low' | 'normal' | 'high';
  };
}
```

**Destinations**: RabbitMQ (immediate) + Kafka (audit)  
**TTL**: RabbitMQ 30s, Kafka 30 days

#### `job.status.changed`

When a job transitions state (QUEUED → RUNNING → COMPLETED/FAILED).

```typescript
interface JobStatusChangedEvent extends EventBase {
  event_type: 'job.status.changed';
  payload: {
    job_id: string;
    previous_status:
      | 'QUEUED'
      | 'RUNNING'
      | 'COMPLETED'
      | 'FAILED'
      | 'CANCELLED';
    new_status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    reason?: string; // e.g., 'node allocation', 'timeout'
    transition_time_ms?: number; // How long in previous state
  };
}
```

**Destinations**: RabbitMQ (immediate) + Kafka (audit)  
**Triggers**: WebSocket broadcast to dashboard
**Routing Key**: `job.${job_id}.status`

#### `job.completed`

When a job finishes successfully with results.

```typescript
interface JobCompletedEvent extends EventBase {
  event_type: 'job.completed';
  payload: {
    job_id: string;
    execution_time_ms: number;
    output_location: string; // S3 path or TACC path
    result_size_bytes: number;
    metrics: {
      cpu_utilization_percent: number;
      gpu_utilization_percent: number;
      memory_used_gb: number;
      io_throughput_mbps: number;
    };
  };
}
```

**Destinations**: RabbitMQ (immediate) + Kafka (audit)  
**TTL**: RabbitMQ 5m, Kafka 30 days

#### `job.failed`

When a job fails with error context.

```typescript
interface JobFailedEvent extends EventBase {
  event_type: 'job.failed';
  payload: {
    job_id: string;
    error_code: string; // e.g., 'TACC_TIMEOUT', 'OUT_OF_MEMORY'
    error_message: string;
    stack_trace?: string;
    exit_code?: number;
    retry_count: number;
    max_retries: number;
    next_retry_timestamp?: string; // ISO 8601 for exponential backoff
  };
}
```

**Destinations**: RabbitMQ (immediate) + Kafka (audit)  
**Triggers**: Alert notification, retry logic

### 2. Notification Events

#### `notification.sent`

When a user-facing notification is generated (email, WebSocket, push).

```typescript
interface NotificationSentEvent extends EventBase {
  event_type: 'notification.sent';
  payload: {
    notification_id: string;
    recipient_user_id: string;
    channel: 'email' | 'websocket' | 'push' | 'in-app';
    subject: string;
    message: string;
    related_job_id?: string;
    read_status: 'unread' | 'read';
  };
}
```

**Destinations**: RabbitMQ only (ephemeral)  
**TTL**: 24 hours  
**Routing**: User-scoped WebSocket namespace

### 3. Performance Metrics Events

#### `job.metrics.recorded`

Periodic performance metrics from running jobs.

```typescript
interface JobMetricsRecordedEvent extends EventBase {
  event_type: 'job.metrics.recorded';
  payload: {
    job_id: string;
    sample_timestamp: string; // ISO 8601
    metrics: {
      cpu_utilization_percent: number;
      gpu_utilization_percent: number;
      gpu_memory_used_gb: number;
      system_memory_used_gb: number;
      network_in_mbps: number;
      network_out_mbps: number;
      disk_read_iops: number;
      disk_write_iops: number;
    };
  };
}
```

**Destinations**: Kafka only (for historical analytics)  
**TTL**: 30 days  
**Frequency**: Every 30 seconds per running job

### 4. Audit Trail Events

#### `audit.action.recorded`

Administrative or system action for compliance.

```typescript
interface AuditActionRecordedEvent extends EventBase {
  event_type: 'audit.action.recorded';
  payload: {
    action:
      | 'job.cancelled'
      | 'job.throttled'
      | 'user.provisioned'
      | 'policy.changed';
    actor_user_id: string;
    target_resource_id: string;
    target_resource_type: 'job' | 'user' | 'system';
    details: Record<string, unknown>;
    changes: {
      before: Record<string, unknown>;
      after: Record<string, unknown>;
    };
  };
}
```

**Destinations**: Kafka only (for audit/compliance)  
**TTL**: 90 days  
**Access**: Restricted to admin/compliance roles

## Schema Evolution

### Versioning Strategy

1. **Add new optional fields**: No version bump required
   - Old consumers ignore new fields
   - New consumers set default for missing fields

2. **Remove fields**: Major version bump (e.g., v1 → v2)
   - Old consumers gracefully handle new format
   - New consumers can request legacy format via Kafka offset

3. **Rename/restructure**: Major version bump
   - Coordinate deployment across all services

### Schema Registry (Kafka)

```json
{
  "namespace": "com.cosmic-horizons.events",
  "type": "record",
  "name": "JobSubmittedEvent",
  "version": 1,
  "fields": [
    { "name": "event_id", "type": "string" },
    { "name": "event_type", "type": { "type": "enum", "symbols": ["job.submitted"] } },
    { "name": "timestamp", "type": "string" },
    { "name": "correlation_id", "type": "string" },
    { "name": "user_id", "type": "string" },
    { "name": "schema_version", "type": "int" },
    { "name": "payload", "type": { "type": "record", "fields": [...] } }
  ]
}
```

## Event Ordering Guarantees

### RabbitMQ

- **Single queue**: FIFO ordering within broker
- **Multiple queues**: Ordering per queue (not across queues)
- **Strategy**: Route by `job_id` to ensure all events for a job go to same queue

### Kafka

- **Single partition**: FIFO ordering (batching allowed)
- **Multiple partitions**: Ordering per partition (not across partitions)
- **Key strategy**: Use `job_id` as Kafka key for job-scoped ordering

## Idempotency

Every event includes `idempotency_key` field (optional but recommended):

```typescript
// Event published with idempotency key
const event: JobStatusChangedEvent = {
  event_id: uuid(),
  idempotency_key: `job-${job_id}-status-${new_status}-${timestamp}`,
  // ...
};

// Broker deduplication:
// If idempotency_key already processed, skip (return 409 or no-op)
// If new, process and cache key for 24 hours
```

## Example: Full Job Lifecycle

```text
1. User submits job
   └─ job.submitted
      └─ RabbitMQ + Kafka

2. Job enters queue
   └─ job.status.changed (QUEUED)
      └─ WebSocket: dashboard updates
      └─ notification.sent (email)
      └─ Kafka: audit trail

3. TACC allocates resources
   └─ job.status.changed (RUNNING)
      └─ WebSocket: dashboard updates
      └─ RabbitMQ broadcast

4. Job publishes metrics (every 30s)
   └─ job.metrics.recorded
      └─ Kafka only (historical)
      └─ Dashboard: live heatmap update via WebSocket

5. Job completes
   └─ job.completed
      └─ job.status.changed (COMPLETED)
      └─ WebSocket + email notification
      └─ Kafka: audit + metrics

6. Audit logged
   └─ audit.action.recorded (job.completed)
      └─ Kafka only
```

## Testing Strategy

- **Unit**: Schema validation (TypeScript + Zod/io-ts)
- **Integration**: RabbitMQ publish/subscribe with 45+ tests
- **Integration**: Kafka publish/subscribe with 40+ tests
- **E2E**: Full job lifecycle event chain with 50+ tests
- **Performance**: Latency benchmarks (<100ms P99), throughput (>1000 events/sec)

---

**Document**: Event schema definitions  
**Last Updated**: 2026-02-14  
**Next Review**: Sprint 5.1 design review (2026-02-17)
