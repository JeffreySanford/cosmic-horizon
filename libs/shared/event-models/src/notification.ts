/**
 * Notification Event Schemas
 * Events related to user notifications and alerts
 */

import { EventBase } from './event-base.js';

export enum NotificationChannel {
  EMAIL = 'email',
  WEBSOCKET = 'websocket',
  PUSH = 'push',
  IN_APP = 'in-app',
}

/**
 * event_type: 'notification.sent'
 * Fired when a user-facing notification is generated
 */
export interface NotificationSentEvent extends EventBase {
  event_type: 'notification.sent';
  payload: {
    notification_id: string;
    recipient_user_id: string;
    channel: NotificationChannel;
    subject: string;
    message: string;
    related_job_id?: string;
    data?: Record<string, unknown>; // Additional context
    read_status: 'unread' | 'read';
    created_at: string; // ISO 8601
  };
}

/**
 * event_type: 'notification.read'
 * Fired when user reads a notification
 */
export interface NotificationReadEvent extends EventBase {
  event_type: 'notification.read';
  payload: {
    notification_id: string;
    recipient_user_id: string;
    read_at: string; // ISO 8601
  };
}

/**
 * event_type: 'notification.dismissed'
 * Fired when user dismisses a notification
 */
export interface NotificationDismissedEvent extends EventBase {
  event_type: 'notification.dismissed';
  payload: {
    notification_id: string;
    recipient_user_id: string;
    reason?: string; // 'spam', 'not-relevant', 'manual', etc.
    dismissed_at: string; // ISO 8601
  };
}

/**
 * event_type: 'alert.raised'
 * Fired when system detects anomaly or alert condition
 */
export interface AlertRaisedEvent extends EventBase {
  event_type: 'alert.raised';
  payload: {
    alert_id: string;
    alert_type: string; // e.g., 'job.timeout', 'gpu.over_utilization'
    severity: 'info' | 'warning' | 'critical';
    message: string;
    affected_resource_id: string; // job_id or system id
    metrics?: { [key: string]: number };
  };
}

/**
 * event_type: 'alert.resolved'
 * Fired when alert condition is resolved
 */
export interface AlertResolvedEvent extends EventBase {
  event_type: 'alert.resolved';
  payload: {
    alert_id: string;
    original_alert_type: string;
    resolution_reason: string;
    resolved_at: string; // ISO 8601
  };
}

/**
 * Union type for all notification events
 */
export type NotificationEvent =
  | NotificationSentEvent
  | NotificationReadEvent
  | NotificationDismissedEvent
  | AlertRaisedEvent
  | AlertResolvedEvent;

/**
 * Type guard helpers
 */
export function isNotificationSentEvent(
  event: EventBase,
): event is NotificationSentEvent {
  return event.event_type === 'notification.sent';
}

export function isNotificationReadEvent(
  event: EventBase,
): event is NotificationReadEvent {
  return event.event_type === 'notification.read';
}

export function isNotificationDismissedEvent(
  event: EventBase,
): event is NotificationDismissedEvent {
  return event.event_type === 'notification.dismissed';
}

export function isAlertRaisedEvent(
  event: EventBase,
): event is AlertRaisedEvent {
  return event.event_type === 'alert.raised';
}

export function isAlertResolvedEvent(
  event: EventBase,
): event is AlertResolvedEvent {
  return event.event_type === 'alert.resolved';
}
