import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { SystemHealthMonitorService } from './services/system-health-monitor.service';

describe('HealthController', () => {
  let controller: HealthController;
  let monitor: Partial<SystemHealthMonitorService>;

  beforeEach(async () => {
    monitor = {
      getAlerts: jest.fn().mockReturnValue(['foo']),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: SystemHealthMonitorService, useValue: monitor }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns alerts from monitor', () => {
    expect(controller.getAlerts()).toEqual(['foo']);
  });
});
