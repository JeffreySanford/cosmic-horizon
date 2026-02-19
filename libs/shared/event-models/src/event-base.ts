/**
 * Event Base Schema
 * All events inherit from EventBase and add type-specific payload
 */

import { generateEventId } from './uuid.js';

export interface EventBase {
  /**
   * Unique event identifier (UUID v4)
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
   * Supports schema evolution
   */
  schema_version: number;

  /**
   * Event payload (type-specific)
   * Discriminated union by event_type
   */
  payload: Record<string, unknown>;

  /**
   * Optional: idempotency key for deduplication
   * Format: `${event_type}-${unique_identifier}-${timestamp}`
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

/**
 * Helper to create base event with defaults
 */
export function createEventBase(
  event_type: string,
  user_id: string,
  correlation_id: string,
  payload: Record<string, unknown>,
  options?: {
    event_id?: string;
    schema_version?: number;
    idempotency_key?: string;
    parent_event_id?: string;
    tags?: string[];
  },
): EventBase {
  return {
    event_id: options?.event_id || generateEventId(),
    event_type,
    timestamp: new Date().toISOString(),
    correlation_id,
    user_id,
    schema_version: options?.schema_version || 1,
    payload,
    ...(options?.idempotency_key && {
      idempotency_key: options.idempotency_key,
    }),
    ...(options?.parent_event_id && {
      parent_event_id: options.parent_event_id,
    }),
    ...(options?.tags && { tags: options.tags }),
  };
}
