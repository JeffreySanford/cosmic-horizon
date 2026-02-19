/**
 * Audit Trail Event Schemas
 * Events for compliance and audit logging
 */

import { EventBase } from './event-base.js';

/**
 * event_type: 'audit.action.recorded'
 * Administrative or system action for compliance
 */
export interface AuditActionRecordedEvent extends EventBase {
  event_type: 'audit.action.recorded';
  payload: {
    audit_id: string;
    action: string; // e.g., 'job.cancelled', 'job.throttled', 'user.provisioned'
    actor_user_id: string;
    actor_role?: string; // e.g., 'admin', 'scientist'
    target_resource_id: string;
    target_resource_type: 'job' | 'user' | 'system' | 'dataset';
    details?: Record<string, unknown>;
    changes?: {
      before: Record<string, unknown>;
      after: Record<string, unknown>;
    };
    timestamp: string; // ISO 8601
    ip_address?: string;
  };
}

/**
 * event_type: 'audit.policy.changed'
 * Fired when system or access policy changes
 */
export interface AuditPolicyChangedEvent extends EventBase {
  event_type: 'audit.policy.changed';
  payload: {
    policy_id: string;
    policy_type: 'rate_limit' | 'resource' | 'access' | 'retention';
    changed_by: string;
    previous_policy: Record<string, unknown>;
    new_policy: Record<string, unknown>;
    reason: string;
    effective_at: string; // ISO 8601
  };
}

/**
 * event_type: 'audit.data.access'
 * Logged whenever user accesses sensitive data
 */
export interface AuditDataAccessEvent extends EventBase {
  event_type: 'audit.data.access';
  payload: {
    access_id: string;
    user_id: string;
    data_type: string; // e.g., 'job_output', 'audit_log', 'user_profile'
    resource_id: string;
    access_type: 'read' | 'write' | 'delete' | 'export';
    status: 'allowed' | 'denied';
    reason_if_denied?: string;
    timestamp: string; // ISO 8601
    ip_address?: string;
  };
}

/**
 * event_type: 'audit.job.lifecycle'
 * Full audit trail for important job events
 */
export interface AuditJobLifecycleEvent extends EventBase {
  event_type: 'audit.job.lifecycle';
  payload: {
    job_id: string;
    lifecycle_event:
      | 'submitted'
      | 'started'
      | 'completed'
      | 'failed'
      | 'cancelled';
    previous_state?: string;
    new_state: string;
    initiated_by: string; // user_id or 'system'
    system_event?: string; // e.g., 'timeout', 'oom_killed'
    affected_data: {
      input_files_count?: number;
      output_files_count?: number;
      total_compute_hours?: number;
    };
    timestamp: string; // ISO 8601
  };
}

/**
 * event_type: 'audit.compliance.check'
 * Periodic compliance validation
 */
export interface AuditComplianceCheckEvent extends EventBase {
  event_type: 'audit.compliance.check';
  payload: {
    check_id: string;
    check_name: string;
    check_type:
      | 'data_retention'
      | 'access_control'
      | 'encryption'
      | 'audit_trail';
    status: 'pass' | 'fail' | 'warning';
    violations?: {
      resource_id: string;
      violation_type: string;
      severity: 'info' | 'warning' | 'critical';
    }[];
    checked_at: string; // ISO 8601
  };
}

/**
 * Union type for all audit events
 */
export type AuditEvent =
  | AuditActionRecordedEvent
  | AuditPolicyChangedEvent
  | AuditDataAccessEvent
  | AuditJobLifecycleEvent
  | AuditComplianceCheckEvent;

/**
 * Type guard helpers
 */
export function isAuditActionRecordedEvent(
  event: EventBase,
): event is AuditActionRecordedEvent {
  return event.event_type === 'audit.action.recorded';
}

export function isAuditPolicyChangedEvent(
  event: EventBase,
): event is AuditPolicyChangedEvent {
  return event.event_type === 'audit.policy.changed';
}

export function isAuditDataAccessEvent(
  event: EventBase,
): event is AuditDataAccessEvent {
  return event.event_type === 'audit.data.access';
}

export function isAuditJobLifecycleEvent(
  event: EventBase,
): event is AuditJobLifecycleEvent {
  return event.event_type === 'audit.job.lifecycle';
}

export function isAuditComplianceCheckEvent(
  event: EventBase,
): event is AuditComplianceCheckEvent {
  return event.event_type === 'audit.compliance.check';
}
