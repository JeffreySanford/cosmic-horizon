import { Injectable, Logger } from '@nestjs/common';
import { MessagingGateway } from '../../../messaging/messaging.gateway';

interface NotificationPayload {
  type: string;
  job_id: string;
  user_id: string;
  timestamp?: string;
  data?: Record<string, unknown>;
}

interface InAppNotification {
  user_id: string;
  job_id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

type NewInAppNotification = Omit<InAppNotification, 'created_at'>;

/**
 * NotificationService handles job completion and failure notifications
 * Supports multiple channels: email, in-app, WebSocket
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger('NotificationService');

  // In-memory notification storage
  private readonly notificationsMap = new Map<string, InAppNotification[]>();

  constructor(private readonly messagingGateway: MessagingGateway) {}

  /**
   * Send job completion email notification
   */
  async sendJobCompletionEmail(options: {
    user_id: string;
    job_id: string;
    result_url: string;
    execution_time_seconds: number;
  }): Promise<void> {
    try {
      this.logger.log(
        `Sending completion email for job ${options.job_id} to user ${options.user_id}`,
      );
      // In production: call email service (SendGrid, SES, etc.)
      // For now: mock success
    } catch (error) {
      this.logger.error(`Failed to send completion email: ${error}`);
      throw error;
    }
  }

  /**
   * Send job failure notification
   */
  async sendJobFailureNotification(options: {
    user_id: string;
    job_id: string;
    error_message: string;
    error_code: number;
  }): Promise<void> {
    try {
      this.logger.log(
        `Sending failure notification for job ${options.job_id} to user ${options.user_id}`,
      );
      // In production: determine best channel (email, SMS, etc.)
      // For now: mock success
    } catch (error) {
      this.logger.error(`Failed to send failure notification: ${error}`);
      throw error;
    }
  }

  /**
   * Broadcast notification via WebSocket to connected clients
   */
  async broadcastViaWebSocket(notification: NotificationPayload): Promise<void> {
    try {
      this.logger.debug(
        `Broadcasting ${notification.type} notification for job ${notification.job_id}`,
      );
      const payload = {
        type: notification.type,
        job_id: notification.job_id,
        user_id: notification.user_id,
        timestamp: notification.timestamp ?? new Date().toISOString(),
        data: notification.data ?? {},
      };

      this.messagingGateway.emitToUser(
        notification.user_id,
        'job_notification',
        payload,
      );
      this.messagingGateway.emitJobUpdate(notification.job_id, payload, notification.user_id);
    } catch (error) {
      this.logger.error(`Failed to broadcast WebSocket notification: ${error}`);
      throw error;
    }
  }

  /**
   * Store in-app notification in database
   */
  async storeInAppNotification(notification: NewInAppNotification): Promise<void> {
    try {
      if (!this.notificationsMap.has(notification.user_id)) {
        this.notificationsMap.set(notification.user_id, []);
      }

      const userNotifications = this.notificationsMap.get(notification.user_id) ?? [];
      userNotifications.push({
        ...notification,
        created_at: new Date().toISOString(),
      });
      this.notificationsMap.set(notification.user_id, userNotifications);

      this.logger.debug(
        `Stored in-app notification for user ${notification.user_id}`,
      );
    } catch (error) {
      this.logger.error(`Failed to store in-app notification: ${error}`);
      throw error;
    }
  }

  /**
   * Get unread notifications for user
   */
  async getUnreadNotifications(userId: string): Promise<InAppNotification[]> {
    const notifications = this.notificationsMap.get(userId) || [];
    return notifications.filter((n) => !n.read);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(userId: string, jobId: string): Promise<void> {
    const notifications = this.notificationsMap.get(userId) || [];
    const notification = notifications.find((n) => n.job_id === jobId);
    if (notification) {
      notification.read = true;
    }
  }
}
