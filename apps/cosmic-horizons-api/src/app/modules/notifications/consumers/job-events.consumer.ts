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

// internal shape after normalization (includes event metadata)
type InternalJobEvent = JobPayload & {
  event_type: string;
  timestamp?: string;
  user_id: string;
};

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
      const raw = JSON.parse(payload.message.value?.toString() || '{}') as
        | EventBase
        | Record<string, unknown>;

      // normalize to a simple object with expected fields; support old shape too
      let jobEvent: JobPayload & { event_type: string; timestamp?: string };

      if ((raw as EventBase).payload) {
        const typed = raw as EventBase;
        const payloadData = typed.payload as JobPayload;
        jobEvent = {
          ...payloadData,
          event_type: typed.event_type,
          user_id: typed.user_id,
          timestamp: typed.timestamp,
        };
      } else {
        // legacy shape where fields are already top-level
        jobEvent = raw as JobPayload & {
          event_type: string;
          timestamp?: string;
        };
      }
      const { event_type: eventType, job_id: jobId } = jobEvent;

      this.logger.debug(`Received job event: ${eventType} for job ${jobId}`);

      // Process terminal events only
      if (jobEvent.event_type === 'job.completed') {
        await this.handleJobCompletion(jobEvent);
      } else if (jobEvent.event_type === 'job.failed') {
        await this.handleJobFailure(jobEvent);
      } else if (jobEvent.event_type === 'job.cancelled') {
        await this.handleJobCancellation(jobEvent);
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
  private async handleJobCompletion(event: InternalJobEvent): Promise<void> {
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
  private async handleJobFailure(event: InternalJobEvent): Promise<void> {
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
  private async handleJobCancellation(event: InternalJobEvent): Promise<void> {
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
