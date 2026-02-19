import { Logger } from '@nestjs/common';

// Ensure generateEventId is a jest.fn() (safe to override in all environments)
jest.mock('@cosmic-horizons/event-models', () => {
  const actual = jest.requireActual('@cosmic-horizons/event-models');
  return {
    ...actual,
    generateEventId: jest.fn(() => 'test-uuid-12345'),
  };
});

import * as EventModels from '@cosmic-horizons/event-models';
import { JobEventsService } from './job-events.service';

describe('JobEventsService', () => {
  let service: JobEventsService;
  let mockEventPublisher: jest.Mocked<any>;
  let mockEventRegistry: jest.Mocked<any>;

  beforeEach(async () => {
    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    mockEventRegistry = {
      validateEvent: jest.fn().mockResolvedValue(undefined),
    };

    service = new JobEventsService(mockEventPublisher, mockEventRegistry);

    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    // Clear mock call history and restore spies so per-test overrides don't leak
    // Use clearAllMocks() here so the module-level jest.mock() implementations
    // (e.g. generateEventId) are preserved across tests.
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('emitJobSubmittedEvent', () => {
    it('should emit a job submitted event', async () => {
      const job = {
        id: 'job-123',
        agent: 'AlphaCal',
        dataset_id: 'dataset-001',
        user_id: 'user-123',
      };

      const eventId = await service.emitJobSubmittedEvent(job);

      expect(eventId).toBe('test-uuid-12345');
      expect(mockEventRegistry.validateEvent).toHaveBeenCalledWith(
        'JOB_SUBMITTED',
        job,
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'jobs.submitted',
        expect.objectContaining(job),
      );
    });

    it('should generate unique event IDs', async () => {
      const job1 = { id: 'job-1', agent: 'AlphaCal' };
      const job2 = { id: 'job-2', agent: 'ImageReconstruction' };

      (EventModels.generateEventId as jest.Mock).mockReturnValueOnce('uuid-1');
      await service.emitJobSubmittedEvent(job1);

      (EventModels.generateEventId as jest.Mock).mockReturnValueOnce('uuid-2');
      const eventId2 = await service.emitJobSubmittedEvent(job2);

      expect(eventId2).toBe('uuid-2');
      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(2);
    });

    it('should validate event before publishing', async () => {
      const job = { id: 'job-456' };

      await service.emitJobSubmittedEvent(job);

      expect(mockEventRegistry.validateEvent).toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalled();
    });

    it('should handle job with complex metadata', async () => {
      const job = {
        id: 'job-789',
        agent: 'AnomalyDetection',
        dataset_id: 'dataset-complex',
        params: { model: 'v2.1', sensitivity: 0.95 },
        resources: { gpu_count: 8, memory_gb: 64 },
      };

      await service.emitJobSubmittedEvent(job);

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'jobs.submitted',
        expect.objectContaining(job),
      );
    });
  });

  describe('emitJobStatusChangedEvent', () => {
    it('should emit job status change event', async () => {
      const eventId = await service.emitJobStatusChangedEvent(
        'job-123',
        'RUNNING',
      );

      expect(eventId).toBe('test-uuid-12345');
      expect(mockEventRegistry.validateEvent).toHaveBeenCalledWith(
        'JOB_STATUS_CHANGED',
        { jobId: 'job-123', status: 'RUNNING' },
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('jobs.status', {
        id: 'test-uuid-12345',
        jobId: 'job-123',
        status: 'RUNNING',
      });
    });

    it('should include metadata in status change event', async () => {
      const metadata = {
        progress: 50,
        estimatedTimeRemaining: 3600,
        resourcesUsed: { cpuPercent: 75, memoryPercent: 60 },
      };

      await service.emitJobStatusChangedEvent('job-456', 'RUNNING', metadata);

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'jobs.status',
        expect.objectContaining(metadata),
      );
    });

    it('should handle different job statuses', async () => {
      const statuses = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'];

      for (const status of statuses) {
        (EventModels.generateEventId as jest.Mock).mockReturnValueOnce(
          `uuid-for-${status}`,
        );
        await service.emitJobStatusChangedEvent('job-id', status);
      }

      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(4);
      expect(mockEventRegistry.validateEvent).toHaveBeenCalledTimes(4);
    });

    it('should handle status changes without metadata', async () => {
      await service.emitJobStatusChangedEvent('job-789', 'COMPLETED');

      expect(mockEventPublisher.publish).toHaveBeenCalledWith('jobs.status', {
        id: 'test-uuid-12345',
        jobId: 'job-789',
        status: 'COMPLETED',
      });
    });
  });

  describe('emitJobCompletedEvent', () => {
    it('should emit job completed event', async () => {
      const result = {
        output_file: 's3://bucket/output.fits',
        executionTime: 3600,
        metrics: { iterations: 100 },
      };

      const eventId = await service.emitJobCompletedEvent('job-123', result);

      expect(eventId).toBe('test-uuid-12345');
      expect(mockEventRegistry.validateEvent).toHaveBeenCalledWith(
        'JOB_COMPLETED',
        { jobId: 'job-123', result },
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'jobs.completed',
        {
          id: 'test-uuid-12345',
          jobId: 'job-123',
          result,
        },
      );
    });

    it('should handle complex result objects', async () => {
      const result = {
        status: 'SUCCESS',
        outputs: {
          image_file: '/path/to/image.fits',
          metadata_file: '/path/to/metadata.json',
        },
        statistics: {
          iterations: 150,
          convergence: 0.98,
          rms: 0.0012,
        },
      };

      await service.emitJobCompletedEvent('job-456', result);

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'jobs.completed',
        expect.objectContaining({ result }),
      );
    });

    it('should handle empty result object', async () => {
      await service.emitJobCompletedEvent('job-789', {});

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'jobs.completed',
        expect.objectContaining({ result: {} }),
      );
    });
  });

  describe('emitJobErrorEvent', () => {
    it('should emit job error event', async () => {
      const error = new Error('GPU memory exhausted');

      const eventId = await service.emitJobErrorEvent('job-123', error);

      expect(eventId).toBe('test-uuid-12345');
      expect(mockEventRegistry.validateEvent).toHaveBeenCalledWith(
        'JOB_ERROR',
        { jobId: 'job-123', error },
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith('jobs.error', {
        id: 'test-uuid-12345',
        jobId: 'job-123',
        error,
      });
    });

    it('should handle error with stack trace', async () => {
      const error = new Error('Dataset not found');
      error.stack = 'Error: Dataset not found\n    at line 42';

      await service.emitJobErrorEvent('job-456', error);

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'jobs.error',
        expect.objectContaining({ error }),
      );
    });

    it('should handle string error messages', async () => {
      await service.emitJobErrorEvent('job-789', 'Timeout after 3600 seconds');

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'jobs.error',
        expect.objectContaining({ error: 'Timeout after 3600 seconds' }),
      );
    });

    it('should handle different error types', async () => {
      const errors = [
        new Error('Syntax error'),
        new TypeError('Type mismatch'),
        new ReferenceError('Variable undefined'),
      ];

      for (const error of errors) {
        await service.emitJobErrorEvent('job-id', error);
      }

      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(3);
    });
  });

  describe('verifyEventOrdering', () => {
    it('should verify events in chronological order', async () => {
      const eventSequence = [
        { id: 'evt-1', timestamp: new Date('2026-02-12T10:00:00Z') },
        { id: 'evt-2', timestamp: new Date('2026-02-12T10:01:00Z') },
        { id: 'evt-3', timestamp: new Date('2026-02-12T10:02:00Z') },
      ];

      const isOrdered = await service.verifyEventOrdering(eventSequence);

      expect(isOrdered).toBe(true);
    });

    it('should detect out-of-order events', async () => {
      const eventSequence = [
        { id: 'evt-1', timestamp: new Date('2026-02-12T10:00:00Z') },
        { id: 'evt-2', timestamp: new Date('2026-02-12T10:02:00Z') },
        { id: 'evt-3', timestamp: new Date('2026-02-12T10:01:00Z') },
      ];

      const isOrdered = await service.verifyEventOrdering(eventSequence);

      expect(isOrdered).toBe(false);
    });

    it('should return true for single event', async () => {
      const eventSequence = [
        { id: 'evt-1', timestamp: new Date('2026-02-12T10:00:00Z') },
      ];

      const isOrdered = await service.verifyEventOrdering(eventSequence);

      expect(isOrdered).toBe(true);
    });

    it('should return true for empty sequence', async () => {
      const isOrdered = await service.verifyEventOrdering([]);

      expect(isOrdered).toBe(true);
    });

    it('should handle events with identical timestamps', async () => {
      const timestamp = new Date('2026-02-12T10:00:00Z');
      const eventSequence = [
        { id: 'evt-1', timestamp },
        { id: 'evt-2', timestamp },
        { id: 'evt-3', timestamp },
      ];

      const isOrdered = await service.verifyEventOrdering(eventSequence);

      expect(isOrdered).toBe(true);
    });

    it('should detect first-then-last ordering violation', async () => {
      const eventSequence = [
        { id: 'evt-3', timestamp: new Date('2026-02-12T10:02:00Z') },
        { id: 'evt-1', timestamp: new Date('2026-02-12T10:00:00Z') },
      ];

      const isOrdered = await service.verifyEventOrdering(eventSequence);

      expect(isOrdered).toBe(false);
    });
  });

  describe('Event Publishing Integration', () => {
    it('should handle multiple event emissions in sequence', async () => {
      const job = { id: 'job-999', agent: 'Orchestrator' };

      (EventModels.generateEventId as jest.Mock).mockReturnValueOnce(
        'evt-submitted',
      );
      await service.emitJobSubmittedEvent(job);

      (EventModels.generateEventId as jest.Mock).mockReturnValueOnce(
        'evt-started',
      );
      await service.emitJobStatusChangedEvent('job-999', 'RUNNING');

      (EventModels.generateEventId as jest.Mock).mockReturnValueOnce(
        'evt-completed',
      );
      await service.emitJobCompletedEvent('job-999', { success: true });

      expect(mockEventPublisher.publish).toHaveBeenCalledTimes(3);
      expect(mockEventRegistry.validateEvent).toHaveBeenCalledTimes(3);
    });

    it('should handle error after job starts', async () => {
      (EventModels.generateEventId as jest.Mock).mockReturnValueOnce(
        'evt-error',
      );
      await service.emitJobErrorEvent('job-999', new Error('Execution failed'));

      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        'jobs.error',
        expect.objectContaining({ jobId: 'job-999' }),
      );
    });
  });

  describe('Logger Usage', () => {
    it('should log debug message when emitting submitted event', async () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      await service.emitJobSubmittedEvent({ id: 'job-123' });

      expect(debugSpy).toHaveBeenCalled();
    });
  });
});
