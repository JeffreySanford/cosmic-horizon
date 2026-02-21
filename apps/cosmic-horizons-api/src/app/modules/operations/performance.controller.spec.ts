import { Test, TestingModule } from '@nestjs/testing';
import { PerformanceController } from './performance.controller';

describe('PerformanceController', () => {
  let controller: PerformanceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PerformanceController],
    }).compile();

    controller = module.get<PerformanceController>(PerformanceController);
  });

  it('returns a 10x10 matrix from heatmap', () => {
    const m = controller.getHeatmap();
    expect(m.length).toBe(10);
    expect(m[0].length).toBe(10);
  });

  it('returns a 10x10 matrix from gpu-heatmap', () => {
    const m = controller.getGpuHeatmap();
    expect(m.length).toBe(10);
    expect(m[0].length).toBe(10);
  });
});
