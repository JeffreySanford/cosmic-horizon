import { Test, TestingModule } from '@nestjs/testing';
import { EachMessagePayload } from 'kafkajs';
import { JobEventsConsumer } from '../job-events.consumer';
import { NotificationService } from '../../services/notification.service';
import { KafkaService } from '../../../events/kafka.service';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('JobEventsConsumer', () => {
  let consumer: JobEventsConsumer;
  let kafkaService: jest.Mocked<KafkaService>;
  let notificationService: jest.Mocked<NotificationService>;

  beforeEach(async () => {
    kafkaService = {
      subscribe: jest.fn(),
      disconnect: jest.fn().mockResolvedValue(undefined),
    } as any;

    notificationService = {
      sendJobCompletionEmail: jest.fn().mockResolvedValue(undefined),
      sendJobFailureNotification: jest.fn().mockResolvedValue(undefined),
      broadcastViaWebSocket: jest.fn().mockResolvedValue(undefined),
      storeInAppNotification: jest.fn().mockResolvedValue(undefined),
    } as any;

    testingModule = await Test.createTestingModule({
      providers: [
        JobEventsConsumer,
        { provide: KafkaService, useValue: kafkaService },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    consumer = testingModule.get<JobEventsConsumer>(JobEventsConsumer);
  });

  describe('onModuleInit', () => {
    it('should subscribe to job-lifecycle topic', async () => {
      await consumer.onModuleInit();

      expect(kafkaService.subscribe).toHaveBeenCalledWith(
        'notifications-consumer-group',
        ['job-lifecycle'],
        expect.any(Function),
      );
    });
  });

  describe('handleJobEvent - Completion', () => {
    it('should send completion email and notifications on job.completed event', async () => {
      const mockEvent = {
        event_type: 'job.completed',
        job_id: 'job-123',
        user_id: 'user-456',
        result_url: 'https://example.com/results/job-123',
        execution_time_seconds: 3600,
        timestamp: '2026-02-20T10:00:00Z',
      };

      let handler: any;
      kafkaService.subscribe.mockImplementation(
        async (_groupId, _topics, h) => {
          handler = h;
        },
      );

      await consumer.onModuleInit();

      const mockPayload = {
        message: { value: Buffer.from(JSON.stringify(mockEvent)) },
      } as EachMessagePayload;

      await handler(mockPayload);

      expect(notificationService.sendJobCompletionEmail).toHaveBeenCalledWith({
        user_id: 'user-456',
        job_id: 'job-123',
        result_url: 'https://example.com/results/job-123',
        execution_time_seconds: 3600,
      });

      expect(notificationService.broadcastViaWebSocket).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'job_completed',
          job_id: 'job-123',
          user_id: 'user-456',
        }),
      );

      expect(notificationService.storeInAppNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'job_completed',
          user_id: 'user-456',
          job_id: 'job-123',
        }),
      );
    });
  });

  describe('handleJobEvent - Failure', () => {
    it('should send failure notification on job.failed event', async () => {
      const mockEvent = {
        event_type: 'job.failed',
        job_id: 'job-123',
        user_id: 'user-456',
        error_message: 'Calibration failed',
        error_code: 500,
        timestamp: '2026-02-20T10:01:00Z',
      };

      let handler: any;
      kafkaService.subscribe.mockImplementation(
        async (_groupId, _topics, h) => {
          handler = h;
        },
      );

      await consumer.onModuleInit();

      const mockPayload = {
        message: { value: Buffer.from(JSON.stringify(mockEvent)) },
      } as EachMessagePayload;

      await handler(mockPayload);

      expect(
        notificationService.sendJobFailureNotification,
      ).toHaveBeenCalledWith({
        user_id: 'user-456',
        job_id: 'job-123',
        error_message: 'Calibration failed',
        error_code: 500,
      });

      expect(notificationService.storeInAppNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'job_failed',
          message: expect.stringContaining('Calibration failed'),
        }),
      );
    });
  });

  describe('handleJobEvent - Cancellation', () => {
    it('should broadcast cancellation notification on job.cancelled event', async () => {
      const mockEvent = {
        event_type: 'job.cancelled',
        job_id: 'job-123',
        user_id: 'user-456',
        timestamp: '2026-02-20T10:02:00Z',
      };

      let handler: any;
      kafkaService.subscribe.mockImplementation(
        async (_groupId, _topics, h) => {
          handler = h;
        },
      );

      await consumer.onModuleInit();

      const mockPayload = {
        message: { value: Buffer.from(JSON.stringify(mockEvent)) },
      } as EachMessagePayload;

      await handler(mockPayload);

      expect(notificationService.broadcastViaWebSocket).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'job_cancelled',
          job_id: 'job-123',
          user_id: 'user-456',
        }),
      );

      expect(notificationService.storeInAppNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'job_cancelled',
          message: 'Your job has been cancelled',
        }),
      );
    });
  });

  describe('handleJobEvent - Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      let handler: any;
      kafkaService.subscribe.mockImplementation(
        async (_groupId, _topics, h) => {
          handler = h;
        },
      );

      await consumer.onModuleInit();

      const mockPayload = {
        message: { value: Buffer.from('invalid json') },
      } as EachMessagePayload;

      // Should not throw
      await expect(handler(mockPayload)).resolves.not.toThrow();

      // Should not call notification services
      expect(notificationService.sendJobCompletionEmail).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from Kafka', async () => {
      await consumer.onModuleDestroy();

      expect(kafkaService.disconnect).toHaveBeenCalled();
    });
  });
});
