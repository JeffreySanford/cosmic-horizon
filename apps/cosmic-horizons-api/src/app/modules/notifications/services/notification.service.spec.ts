import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';
import { MessagingGateway } from '../../../messaging/messaging.gateway';

describe('NotificationService (notifications module)', () => {
  let service: NotificationService;
  let gateway: any;

  beforeEach(async () => {
    gateway = {
      emitToUser: jest.fn(),
      emitJobUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: MessagingGateway, useValue: gateway },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('broadcastViaWebSocket calls gateway methods correctly', async () => {
    const payload = {
      type: 'job_completed',
      job_id: 'job-123',
      user_id: 'user-xyz',
      timestamp: 'time',
      data: { foo: 'bar' },
    };

    await service.broadcastViaWebSocket(payload);

    expect(gateway.emitToUser).toHaveBeenCalledWith(
      'user-xyz',
      'job_notification',
      expect.objectContaining({ type: 'job_completed', job_id: 'job-123' }),
    );
    expect(gateway.emitJobUpdate).toHaveBeenCalledWith(
      'job-123',
      expect.objectContaining({ type: 'job_completed' }),
      'user-xyz',
    );
  });
});
