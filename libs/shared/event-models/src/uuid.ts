/**
 * Shared UUID Utilities
 *
 * Centralizes UUID generation to avoid scattered dependencies on the uuid package.
 * All services import UUID factories from this module instead of importing uuid directly.
 *
 * Benefits:
 * - Single dependency on uuid package (isolated to event-models)
 * - Consistent UUID generation across all events
 * - Type safety for event_id and correlation_id fields
 * - Easier to mock or replace UUID strategy in tests
 */

import { randomUUID } from 'node:crypto';

/**
 * UUID type (branded string for type safety)
 * Represents a UUID v4 string
 */
export type UUID = string & { readonly __brand: 'UUID' };

/**
 * Generate a new UUID v4
 * @returns UUID v4 string
 */
export function generateUUID(): UUID {
  return randomUUID() as UUID;
}

/**
 * Create a UUID from a string (with validation in future)
 * @param value UUID string to validate
 * @returns UUID if valid, throws error if invalid
 */
export function createUUID(value: string): UUID {
  // TODO: Add UUID validation in future
  // For now, assume input is valid UUID format
  return value as UUID;
}

/**
 * Generate an event ID (alias for generateUUID)
 * @returns UUID for event_id field
 */
export function generateEventId(): UUID {
  return generateUUID();
}

/**
 * Generate a correlation ID (alias for generateUUID)
 * @returns UUID for correlation_id field linking related events
 */
export function generateCorrelationId(): UUID {
  return generateUUID();
}
