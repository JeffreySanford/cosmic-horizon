/**
 * Job Lifecycle Event Schemas
 * Events related to job submission, execution, and completion
 */

import { EventBase } from './event-base.js';

export enum JobStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum TaccSystem {
  FRONTERA = 'frontera',
  STAMPEDE3 = 'stampede3',
  LONESTAR6 = 'lonestar6',
  OTHER = 'other',
}

/**
 * event_type: 'job.submitted'
 * Fired when user submits a new job to TACC
 */
export interface JobSubmittedEvent extends EventBase {
  event_type: 'job.submitted';
  payload: {
    job_id: string;
    job_name: string;
    tacc_system: TaccSystem;
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

/**
 * event_type: 'job.status.changed'
 * Fired when job transitions between states
 */
export interface JobStatusChangedEvent extends EventBase {
  event_type: 'job.status.changed';
  payload: {
    job_id: string;
    previous_status: JobStatus;
    new_status: JobStatus;
    reason?: string; // e.g., 'node allocation', 'timeout'
    transition_time_ms?: number; // How long in previous state
  };
}

/**
 * event_type: 'job.completed'
 * Fired when job finishes successfully with results
 */
export interface JobCompletedEvent extends EventBase {
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

/**
 * event_type: 'job.failed'
 * Fired when job fails with error context
 */
export interface JobFailedEvent extends EventBase {
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

/**
 * event_type: 'job.cancelled'
 * Fired when user or system cancels a job
 */
export interface JobCancelledEvent extends EventBase {
  event_type: 'job.cancelled';
  payload: {
    job_id: string;
    cancelled_by: string; // 'user' | 'system' | 'admin'
    reason: string;
    refund_amount_usd?: number;
  };
}

/**
 * Union type for all job lifecycle events
 */
export type JobLifecycleEvent =
  | JobSubmittedEvent
  | JobStatusChangedEvent
  | JobCompletedEvent
  | JobFailedEvent
  | JobCancelledEvent;

/**
 * Type guard helpers
 */
export function isJobSubmittedEvent(event: EventBase): event is JobSubmittedEvent {
  return event.event_type === 'job.submitted';
}

export function isJobStatusChangedEvent(event: EventBase): event is JobStatusChangedEvent {
  return event.event_type === 'job.status.changed';
}

export function isJobCompletedEvent(event: EventBase): event is JobCompletedEvent {
  return event.event_type === 'job.completed';
}

export function isJobFailedEvent(event: EventBase): event is JobFailedEvent {
  return event.event_type === 'job.failed';
}

export function isJobCancelledEvent(event: EventBase): event is JobCancelledEvent {
  return event.event_type === 'job.cancelled';
}
