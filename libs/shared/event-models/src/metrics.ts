/**
 * Performance Metrics Event Schemas
 * Events related to job performance and system metrics
 */

import { EventBase } from './event-base.js';

/**
 * event_type: 'job.metrics.recorded'
 * Fired periodically during job execution (every 30s)
 */
export interface JobMetricsRecordedEvent extends EventBase {
  event_type: 'job.metrics.recorded';
  payload: {
    job_id: string;
    sample_timestamp: string; // ISO 8601
    sample_interval_seconds: number;
    metrics: {
      cpu_utilization_percent: number;
      gpu_utilization_percent: number;
      gpu_memory_used_gb: number;
      system_memory_used_gb: number;
      network_in_mbps: number;
      network_out_mbps: number;
      disk_read_iops: number;
      disk_write_iops: number;
      disk_read_throughput_mbps: number;
      disk_write_throughput_mbps: number;
    };
  };
}

/**
 * event_type: 'job.performance.summary'
 * Fired at job completion with aggregated metrics
 */
export interface JobPerformanceSummaryEvent extends EventBase {
  event_type: 'job.performance.summary';
  payload: {
    job_id: string;
    execution_time_ms: number;
    samples_collected: number;
    metrics_aggregate: {
      cpu_utilization_avg_percent: number;
      cpu_utilization_max_percent: number;
      gpu_utilization_avg_percent: number;
      gpu_utilization_max_percent: number;
      gpu_memory_peak_gb: number;
      system_memory_peak_gb: number;
      total_network_in_gb: number;
      total_network_out_gb: number;
      total_disk_read_gb: number;
      total_disk_write_gb: number;
    };
  };
}

/**
 * event_type: 'system.health.check'
 * Fired periodically from monitoring system
 */
export interface SystemHealthCheckEvent extends EventBase {
  event_type: 'system.health.check';
  payload: {
    check_timestamp: string; // ISO 8601
    components: {
      database: 'healthy' | 'degraded' | 'down';
      message_broker: 'healthy' | 'degraded' | 'down';
      cache: 'healthy' | 'degraded' | 'down';
      external_api: 'healthy' | 'degraded' | 'down';
    };
    metrics: {
      active_jobs: number;
      pending_jobs: number;
      failed_jobs_24h: number;
      average_queue_depth: number;
      average_response_time_ms: number;
    };
  };
}

/**
 * event_type: 'resource.allocation.changed'
 * Fired when system allocates/deallocates resources
 */
export interface ResourceAllocationChangedEvent extends EventBase {
  event_type: 'resource.allocation.changed';
  payload: {
    allocation_id: string;
    job_id: string;
    change_type: 'allocated' | 'deallocated' | 'reallocated';
    previous_allocation?: {
      num_nodes: number;
      cores: number;
      gpus: number;
      memory_gb: number;
    };
    new_allocation: {
      num_nodes: number;
      cores: number;
      gpus: number;
      memory_gb: number;
    };
    reason: string;
    timestamp: string; // ISO 8601
  };
}

/**
 * Union type for all metrics events
 */
export type MetricsEvent =
  | JobMetricsRecordedEvent
  | JobPerformanceSummaryEvent
  | SystemHealthCheckEvent
  | ResourceAllocationChangedEvent;

/**
 * Type guard helpers
 */
export function isJobMetricsRecordedEvent(event: EventBase): event is JobMetricsRecordedEvent {
  return event.event_type === 'job.metrics.recorded';
}

export function isJobPerformanceSummaryEvent(
  event: EventBase
): event is JobPerformanceSummaryEvent {
  return event.event_type === 'job.performance.summary';
}

export function isSystemHealthCheckEvent(event: EventBase): event is SystemHealthCheckEvent {
  return event.event_type === 'system.health.check';
}

export function isResourceAllocationChangedEvent(
  event: EventBase
): event is ResourceAllocationChangedEvent {
  return event.event_type === 'resource.allocation.changed';
}
