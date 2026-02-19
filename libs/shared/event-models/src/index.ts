/**
 * @cosmic-horizons/event-models
 *
 * Shared event schemas for RabbitMQ (ephemeral) and Kafka (durable) event streams
 * Used across Phase 3 (Event Infrastructure & Scalability)
 */

// Import all types needed for AllEvents union
import type {
  EventBase,
} from './event-base.js';
import type {
  JobLifecycleEvent,
} from './job-lifecycle.js';
import type {
  NotificationEvent,
} from './notification.js';
import type {
  MetricsEvent,
} from './metrics.js';
import type {
  AuditEvent,
} from './audit.js';

// Base event interface and helpers
export type { EventBase } from './event-base.js';
export {
  createEventBase,
} from './event-base.js';

// UUID utilities and types
export type { UUID } from './uuid.js';
export {
  generateUUID,
  generateEventId,
  generateCorrelationId,
  createUUID,
} from './uuid.js';

// Job lifecycle events
export {
  JobStatus,
  TaccSystem,
} from './job-lifecycle.js';
export type {
  JobSubmittedEvent,
  JobStatusChangedEvent,
  JobCompletedEvent,
  JobFailedEvent,
  JobCancelledEvent,
  JobLifecycleEvent,
} from './job-lifecycle.js';
export {
  isJobSubmittedEvent,
  isJobStatusChangedEvent,
  isJobCompletedEvent,
  isJobFailedEvent,
  isJobCancelledEvent,
} from './job-lifecycle.js';

// Notification events
export {
  NotificationChannel,
} from './notification.js';
export type {
  NotificationSentEvent,
  NotificationReadEvent,
  NotificationDismissedEvent,
  AlertRaisedEvent,
  AlertResolvedEvent,
  NotificationEvent,
} from './notification.js';
export {
  isNotificationSentEvent,
  isNotificationReadEvent,
  isNotificationDismissedEvent,
  isAlertRaisedEvent,
  isAlertResolvedEvent,
} from './notification.js';

// Metrics events
export type {
  JobMetricsRecordedEvent,
  JobPerformanceSummaryEvent,
  SystemHealthCheckEvent,
  ResourceAllocationChangedEvent,
  MetricsEvent,
} from './metrics.js';
export {
  isJobMetricsRecordedEvent,
  isJobPerformanceSummaryEvent,
  isSystemHealthCheckEvent,
  isResourceAllocationChangedEvent,
} from './metrics.js';

// Audit events
export type {
  AuditActionRecordedEvent,
  AuditPolicyChangedEvent,
  AuditDataAccessEvent,
  AuditJobLifecycleEvent,
  AuditComplianceCheckEvent,
  AuditEvent,
} from './audit.js';
export {
  isAuditActionRecordedEvent,
  isAuditPolicyChangedEvent,
  isAuditDataAccessEvent,
  isAuditJobLifecycleEvent,
  isAuditComplianceCheckEvent,
} from './audit.js';

/**
 * Union of all event types
 * Use for generic event handlers and dispatch
 */
export type AllEvents =
  | EventBase
  | JobLifecycleEvent
  | NotificationEvent
  | MetricsEvent
  | AuditEvent;

/**
 * Event type discriminator for pattern matching
 */
export const EVENT_TYPES = {
  JOB_SUBMITTED: 'job.submitted',
  JOB_STATUS_CHANGED: 'job.status.changed',
  JOB_COMPLETED: 'job.completed',
  JOB_FAILED: 'job.failed',
  JOB_CANCELLED: 'job.cancelled',
  NOTIFICATION_SENT: 'notification.sent',
  NOTIFICATION_READ: 'notification.read',
  NOTIFICATION_DISMISSED: 'notification.dismissed',
  ALERT_RAISED: 'alert.raised',
  ALERT_RESOLVED: 'alert.resolved',
  JOB_METRICS_RECORDED: 'job.metrics.recorded',
  JOB_PERFORMANCE_SUMMARY: 'job.performance.summary',
  SYSTEM_HEALTH_CHECK: 'system.health.check',
  RESOURCE_ALLOCATION_CHANGED: 'resource.allocation.changed',
  AUDIT_ACTION_RECORDED: 'audit.action.recorded',
  AUDIT_POLICY_CHANGED: 'audit.policy.changed',
  AUDIT_DATA_ACCESS: 'audit.data.access',
  AUDIT_JOB_LIFECYCLE: 'audit.job.lifecycle',
  AUDIT_COMPLIANCE_CHECK: 'audit.compliance.check',
} as const;

/**
 * RabbitMQ routing key patterns
 */
export const RABBITMQ_ROUTING_KEYS = {
  JOB_EVENTS: 'job.#',
  JOB_STATUS: (jobId: string) => `job.${jobId}.status`,
  JOB_METRICS: (jobId: string) => `job.${jobId}.metrics`,
  NOTIFICATIONS: 'notifications.*',
  ALERTS: 'alerts.#',
  AUDIT: 'audit.#',
} as const;

/**
 * Kafka topic names
 */
export const KAFKA_TOPICS = {
  JOB_LIFECYCLE: 'job-lifecycle',
  JOB_METRICS: 'job-metrics',
  NOTIFICATIONS: 'notifications',
  AUDIT_TRAIL: 'audit-trail',
  SYSTEM_HEALTH: 'system-health',
} as const;

/**
 * Kafka topic configuration
 */
export const KAFKA_TOPIC_CONFIG = {
  [KAFKA_TOPICS.JOB_LIFECYCLE]: {
    partitions: 10,
    replication_factor: 1,
    retention_ms: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  [KAFKA_TOPICS.JOB_METRICS]: {
    partitions: 20,
    replication_factor: 1,
    retention_ms: 30 * 24 * 60 * 60 * 1000, // 30 days
  },
  [KAFKA_TOPICS.NOTIFICATIONS]: {
    partitions: 5,
    replication_factor: 1,
    retention_ms: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  [KAFKA_TOPICS.AUDIT_TRAIL]: {
    partitions: 5,
    replication_factor: 1,
    retention_ms: 90 * 24 * 60 * 60 * 1000, // 90 days
  },
  [KAFKA_TOPICS.SYSTEM_HEALTH]: {
    partitions: 3,
    replication_factor: 1,
    retention_ms: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
} as const;
