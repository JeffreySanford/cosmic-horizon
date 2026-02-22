import { JobsController } from './jobs.controller';
import type { TaccIntegrationService } from './tacc-integration.service';
import type { JobOrchestratorService } from './services/job-orchestrator.service';
import type { DatasetStagingService } from './services/dataset-staging.service';

describe('Remote compute contract', () => {
  const orchestrator = {
    submitJob: jest.fn(),
    getJobStatus: jest.fn(),
    cancelJob: jest.fn(),
    getOptimizationTips: jest.fn(),
  } as unknown as jest.Mocked<JobOrchestratorService>;

  const taccService = {
    getCapabilities: jest.fn(),
  } as unknown as jest.Mocked<TaccIntegrationService>;

  const datasetStaging = {} as jest.Mocked<DatasetStagingService>;

  const controller = new JobsController(
    taccService,
    orchestrator,
    datasetStaging,
  );

  it('submit contract returns a job id-compatible object', async () => {
    orchestrator.submitJob = jest
      .fn()
      .mockResolvedValue({ id: 'job-1' } as any);

    const result = await controller.submitJob(
      { user: { id: 'user-1' } } as any,
      { agent: 'AlphaCal', dataset_id: 'foo', params: {} } as any,
    );

    expect(result.id).toBeDefined();
  });

  it('status contract returns status payload', async () => {
    orchestrator.getJobStatus = jest
      .fn()
      .mockResolvedValue({
        id: 'job-1',
        status: 'RUNNING',
        progress: 0.4,
      } as any);

    const result = await controller.getJobStatus('job-1');

    expect(result).toEqual(expect.objectContaining({ status: 'RUNNING' }));
  });

  it('cancel contract returns success envelope', async () => {
    orchestrator.cancelJob = jest.fn().mockResolvedValue(true);

    const result = await controller.cancelJob('job-1');

    expect(result).toEqual({ success: true });
  });

  it('optimize contract returns array', async () => {
    orchestrator.getOptimizationTips = jest
      .fn()
      .mockResolvedValue([
        { category: 'runtime', severity: 'info', message: 'Tip' },
      ] as any);

    const result = await controller.getOptimizationTips({
      agent: 'AlphaCal',
      dataset_id: 'foo',
      params: {},
    } as any);

    expect(Array.isArray(result)).toBe(true);
  });

  it('capabilities contract returns object', async () => {
    taccService.getCapabilities = jest
      .fn()
      .mockResolvedValue({ demoMode: true });

    const result = await controller.getCapabilities();

    expect(result).toEqual(expect.objectContaining({ demoMode: true }));
  });
});
