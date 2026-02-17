import { Test, TestingModule } from '@nestjs/testing';
import { EachMessagePayload } from 'kafkajs';
import { AuditTrailConsumer } from '../audit-trail.consumer';
import {
  ComplianceAuditorService,
  AuditEvent,
} from '../../services/compliance-auditor.service';
import { KafkaService } from '../../../events/kafka.service';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('AuditTrailConsumer', () => {
  let consumer: AuditTrailConsumer;
  let kafkaService: jest.Mocked<KafkaService>;
  let complianceAuditorService: jest.Mocked<ComplianceAuditorService>;

  beforeEach(async () => {
    kafkaService = {
      subscribe: jest.fn(),
      disconnect: jest.fn().mockResolvedValue(undefined),
    } as any;

    complianceAuditorService = {
      storeImmutableEvent: jest.fn().mockResolvedValue(undefined),
      queryAuditTrail: jest.fn().mockResolvedValue([]),
      generateComplianceReport: jest.fn().mockResolvedValue({
        total_events: 0,
        jobs_covered: 0,
        oldest_event: null,
        retention_compliant: true,
      }),
      verifyRetentionPolicy: jest.fn().mockResolvedValue(true),
    } as any;

    testingModule = await Test.createTestingModule({
      providers: [
        AuditTrailConsumer,
        { provide: KafkaService, useValue: kafkaService },
        {
          provide: ComplianceAuditorService,
          useValue: complianceAuditorService,
        },
      ],
    }).compile();

    consumer = testingModule.get<AuditTrailConsumer>(AuditTrailConsumer);
  });

  describe('onModuleInit', () => {
    it('should subscribe to audit-trail topic', async () => {
      await consumer.onModuleInit();

      expect(kafkaService.subscribe).toHaveBeenCalledWith(
        'audit-consumer-group',
        ['audit-trail'],
        expect.any(Function),
      );
    });
  });

  describe('handleAuditEvent - Immutable Storage', () => {
    it('should store immutable audit event', async () => {
      const mockEvent: AuditEvent = {
        event_id: 'event-001',
        job_id: 'job-123',
        user_id: 'user-456',
        event_type: 'job.submitted',
        timestamp: '2026-02-20T10:00:00Z',
        details: {
          observation_id: 'obs-001',
          pipeline: 'calibration',
        },
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

      expect(complianceAuditorService.storeImmutableEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: 'event-001',
          job_id: 'job-123',
          event_type: 'job.submitted',
        }),
      );
    });
  });

  describe('handleAuditEvent - Retention Verification', () => {
    it('should verify retention policy after storing event', async () => {
      const mockEvent: AuditEvent = {
        event_id: 'event-002',
        job_id: 'job-124',
        user_id: 'user-457',
        event_type: 'job.completed',
        timestamp: '2026-02-20T11:00:00Z',
        details: { status: 'success' },
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

      expect(complianceAuditorService.verifyRetentionPolicy).toHaveBeenCalled();
    });
  });

  describe('handleAuditEvent - Multiple Events', () => {
    it('should handle multiple audit events sequentially', async () => {
      const mockEvents: AuditEvent[] = [
        {
          event_id: 'event-003',
          job_id: 'job-125',
          user_id: 'user-458',
          event_type: 'job.submitted',
          timestamp: '2026-02-20T12:00:00Z',
          details: {},
        },
        {
          event_id: 'event-004',
          job_id: 'job-125',
          user_id: 'user-458',
          event_type: 'job.completed',
          timestamp: '2026-02-20T13:00:00Z',
          details: {},
        },
      ];

      let handler: any;
      kafkaService.subscribe.mockImplementation(
        async (_groupId, _topics, h) => {
          handler = h;
        },
      );

      await consumer.onModuleInit();

      for (const event of mockEvents) {
        const mockPayload = {
          message: { value: Buffer.from(JSON.stringify(event)) },
        } as EachMessagePayload;

        await handler(mockPayload);
      }

      expect(
        complianceAuditorService.storeImmutableEvent,
      ).toHaveBeenCalledTimes(2);
    });
  });

  describe('handleAuditEvent - Non-Compliance Alert', () => {
    it('should log warning when retention policy is violated', async () => {
      const mockEvent: AuditEvent = {
        event_id: 'event-005',
        job_id: 'job-126',
        user_id: 'user-459',
        event_type: 'job.failed',
        timestamp: '2026-02-20T14:00:00Z',
        details: { error: 'Failed' },
      };

      complianceAuditorService.verifyRetentionPolicy.mockResolvedValue(false);

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

      const loggerWarnSpy = jest.spyOn(consumer['logger'], 'warn');

      await handler(mockPayload);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('not in compliance'),
      );

      loggerWarnSpy.mockRestore();
    });
  });

  describe('handleAuditEvent - Error Handling', () => {
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

      // Should not call auditor service
      expect(
        complianceAuditorService.storeImmutableEvent,
      ).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect from Kafka', async () => {
      await consumer.onModuleDestroy();

      expect(kafkaService.disconnect).toHaveBeenCalled();
    });
  });
});
