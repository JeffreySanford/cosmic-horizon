import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaService } from '../../events/kafka.service';
import { NotificationService } from '../services/notification.service';

interface JobLifecycleEvent {
  event_type: 'job.completed' | 'job.failed' | 'job.cancelled' | string;
  job_id: string;
  user_id: string;
  timestamp?: string;
  result_url?: string;
  execution_time_seconds?: number;
  error_message?: string;
  error_code?: number;
}

/**
 * JobEventsConsumer subscribes to job lifecycle events
 * Filters for terminal events (success/failed/cancelled) and sends notifications
 */
@Injectable()
export class JobEventsConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('JobEventsConsumer');

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly notificationService: NotificationService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafkaService.subscribe(
      'notifications-consumer-group',
      ['job-lifecycle'],
      this.handleJobEvent.bind(this),
    );
    this.logger.log(
      'JobEventsConsumer initialized and subscribed to job-lifecycle',
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.kafkaService.disconnect();
    this.logger.log('JobEventsConsumer disconnected');
  }

  /**
   * Handle incoming job lifecycle event
   */
  private async handleJobEvent(payload: EachMessagePayload): Promise<void> {
    try {
      const event = JSON.parse(
        payload.message.value?.toString() || '{}',
      ) as JobLifecycleEvent;
      this.logger.debug(
        `Received job event: ${event.event_type} for job ${event.job_id}`,
      );

      // Process terminal events only
      if (event.event_type === 'job.completed') {
        await this.handleJobCompletion(event);
      } else if (event.event_type === 'job.failed') {
        await this.handleJobFailure(event);
      } else if (event.event_type === 'job.cancelled') {
        await this.handleJobCancellation(event);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to process job event: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Non-blocking error handling - continue consuming
    }
  }

  /**
   * Handle job completion event
   */
  private async handleJobCompletion(event: JobLifecycleEvent): Promise<void> {
    const { job_id, user_id, result_url, execution_time_seconds } = event;

    await this.notificationService.sendJobCompletionEmail({
      user_id,
      job_id,
      result_url,
      execution_time_seconds,
    });

    await this.notificationService.broadcastViaWebSocket({
      type: 'job_completed',
      job_id,
      user_id,
      timestamp: event.timestamp,
      data: { result_url, execution_time_seconds },
    });

    await this.notificationService.storeInAppNotification({
      user_id,
      job_id,
      type: 'job_completed',
      title: 'Job Completed',
      message: `Your job has been completed. Results available at ${result_url}`,
      read: false,
    });
  }

  /**
   * Handle job failure event
   */
  private async handleJobFailure(event: JobLifecycleEvent): Promise<void> {
    const { job_id, user_id, error_message, error_code } = event;

    await this.notificationService.sendJobFailureNotification({
      user_id,
      job_id,
      error_message,
      error_code,
    });

    await this.notificationService.broadcastViaWebSocket({
      type: 'job_failed',
      job_id,
      user_id,
      timestamp: event.timestamp,
      data: { error_message, error_code },
    });

    await this.notificationService.storeInAppNotification({
      user_id,
      job_id,
      type: 'job_failed',
      title: 'Job Failed',
      message: `Your job failed with error: ${error_message}`,
      read: false,
    });
  }

  /**
   * Handle job cancellation event
   */
  private async handleJobCancellation(event: JobLifecycleEvent): Promise<void> {
    const { job_id, user_id } = event;

    await this.notificationService.broadcastViaWebSocket({
      type: 'job_cancelled',
      job_id,
      user_id,
      timestamp: event.timestamp,
    });

    await this.notificationService.storeInAppNotification({
      user_id,
      job_id,
      type: 'job_cancelled',
      title: 'Job Cancelled',
      message: 'Your job has been cancelled',
      read: false,
    });
  }
}
