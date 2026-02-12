import { Test, TestingModule } from '@nestjs/testing';
import { LoggingService } from './logging.service';

describe('LoggingService', () => {
  let service: LoggingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingService],
    }).compile();

    service = module.get<LoggingService>(LoggingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should add logs to local buffer', async () => {
    await service.add({
      type: 'test',
      severity: 'info',
      message: 'test message',
    });

    const recent = await service.getRecent();
    expect(recent.length).toBeGreaterThan(0);
    expect(recent[0].message).toBe('test message');
  });

  it('should summarize logs', async () => {
    await service.add({ type: 'test', severity: 'info', message: 'm1' });
    await service.add({ type: 'test', severity: 'error', message: 'm2' });

    const summary = await service.getSummary();
    expect(summary['info']).toBeGreaterThan(0);
    expect(summary['error']).toBeGreaterThan(0);
  });
});
