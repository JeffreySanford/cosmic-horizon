import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MessagingMonitorService } from './messaging-monitor.service';

describe('MessagingMonitorService', () => {
  let service: MessagingMonitorService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        MessagingMonitorService,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get<MessagingMonitorService>(MessagingMonitorService);
  });

  afterEach(async () => {
    jest.useRealTimers();
    await moduleRef.close();
  });

  it('clears startup timeout when destroyed (no poll should run)', async () => {
    jest.useFakeTimers();

    // spy on private poll method to detect whether it runs
    const pollSpy = jest
      .spyOn(service as any, 'poll')
      .mockImplementation(() => Promise.resolve());

    service.onModuleInit(); // schedules startup timeout

    // destroy before the startup timeout fires
    await service.onModuleDestroy();

    // run any pending timers - if startup timeout wasn't cleared, poll would be called
    jest.runOnlyPendingTimers();

    expect(pollSpy).not.toHaveBeenCalled();

    pollSpy.mockRestore();
  });
});
