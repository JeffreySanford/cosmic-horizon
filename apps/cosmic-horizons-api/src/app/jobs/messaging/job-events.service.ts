import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class JobEventsService {
  private readonly logger = new Logger(JobEventsService.name);

  constructor(
    private readonly eventPublisher: {
      publish(topic: string, payload: Record<string, unknown>): Promise<void>;
    },
    private readonly eventRegistry: {
      validateEvent(eventType: string, payload: Record<string, unknown>): Promise<void>;
    },
  ) {}

  async emitJobSubmittedEvent(job: Record<string, unknown>): Promise<string> {
    const eventId = uuidv4();
    await this.eventRegistry.validateEvent('JOB_SUBMITTED', job);
    await this.eventPublisher.publish('jobs.submitted', { id: eventId, ...job });
    this.logger.debug(`Job submitted event emitted: ${eventId}`);
    return eventId;
  }

  async emitJobStatusChangedEvent(
    jobId: string,
    status: string,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    const eventId = uuidv4();
    await this.eventRegistry.validateEvent('JOB_STATUS_CHANGED', { jobId, status, ...metadata });
    await this.eventPublisher.publish('jobs.status', { id: eventId, jobId, status, ...metadata });
    return eventId;
  }

  async emitJobCompletedEvent(jobId: string, result: Record<string, unknown>): Promise<string> {
    const eventId = uuidv4();
    await this.eventRegistry.validateEvent('JOB_COMPLETED', { jobId, result });
    await this.eventPublisher.publish('jobs.completed', { id: eventId, jobId, result });
    return eventId;
  }

  async emitJobErrorEvent(jobId: string, error: Record<string, unknown>): Promise<string> {
    const eventId = uuidv4();
    await this.eventRegistry.validateEvent('JOB_ERROR', { jobId, error });
    await this.eventPublisher.publish('jobs.error', { id: eventId, jobId, error });
    return eventId;
  }

  async verifyEventOrdering(eventSequence: Array<{ timestamp: Date }>): Promise<boolean> {
    for (let i = 1; i < eventSequence.length; i++) {
      if (eventSequence[i].timestamp < eventSequence[i - 1].timestamp) return false;
    }
    return true;
  }
}
