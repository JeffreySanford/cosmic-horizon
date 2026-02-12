import { Test, TestingModule } from '@nestjs/testing';
import { LoggingController } from './logging.controller';
import { LoggingService } from './logging.service';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';

describe('LoggingController', () => {
  let controller: LoggingController;
  let loggingService: LoggingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoggingController],
      providers: [
        {
          provide: LoggingService,
          useValue: {
            add: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
    .overrideGuard(AuthenticatedGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<LoggingController>(LoggingController);
    loggingService = module.get<LoggingService>(LoggingService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call loggingService.add when remote log is received', async () => {
    const logDto = {
      type: 'http' as const,
      severity: 'info' as const,
      message: 'Client connected',
      data: { browser: 'Chrome' },
    };

    const result = await controller.addRemoteLog(logDto);

    expect(result.success).toBe(true);
    expect(loggingService.add).toHaveBeenCalledWith(expect.objectContaining({
      type: 'remote',
      message: '[Frontend] Client connected',
      severity: 'info',
    }));
  });
});
