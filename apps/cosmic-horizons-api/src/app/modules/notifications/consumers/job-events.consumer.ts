import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { EachMessagePayload } from 'kafkajs';
import { KafkaService } from '../../events/kafka.service';
import { NotificationService } from '../services/notification.service';
import { EventBase } from '@cosmic-horizons/event-models';

// helper type for the flattened job data we care about
interface JobPayload {
  job_id: string;
  user_id: string;
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
      const raw = JSON.parse(
        payload.message.value?.toString() || '{}',
      ) as EventBase | Record<string, unknown>;

      // normalize to a simple object with expected fields; support old shape too
      const eventType = (raw as EventBase).event_type || (raw as any).event_type;
      const timestamp = (raw as EventBase).timestamp || (raw as any).timestamp;
      const userId = (raw as EventBase).user_id || (raw as any).user_id;
      const payloadData =
        (raw as EventBase).payload ?? (raw as any);
      const jobEvent: JobPayload & { event_type: string; timestamp?: string } = {
        ...(payloadData as any),
        event_type: eventType,
        user_id: userId,
        timestamp,
      } as any;

      this.logger.debug(
        `Received job event: ${jobEvent.event_type} for job ${jobEvent.job_id}`,
      );

      // Process terminal events only
      if (jobEvent.event_type === 'job.completed') {
        await this.handleJobCompletion(jobEvent as any);
      } else if (jobEvent.event_type === 'job.failed') {
        await this.handleJobFailure(jobEvent as any);
      } else if (jobEvent.event_type === 'job.cancelled') {
        await this.handleJobCancellation(jobEvent as any);
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
