import { Logger } from '@nestjs/common';
import {
  JobOrchestratorService,
  BatchJobRequest,
} from './job-orchestrator.service';
import { Job } from '../entities/job.entity';

describe('JobOrchestratorService - Edge Cases & Error Scenarios (Branch Coverage)', () => {
  let service: JobOrchestratorService;
  let taccService: any;
  let jobRepository: any;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    taccService = {
      submitJob: jest.fn(),
      getJobStatus: jest.fn(),
      cancelJob: jest.fn(),
    };

    jobRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      updateProgress: jest.fn().mockResolvedValue(undefined),
      updateResult: jest.fn().mockResolvedValue(undefined),
      findByUser: jest.fn(),
      search: jest.fn(),
      findByTaccJobId: jest.fn(),
      findByStatus: jest.fn(),
      delete: jest.fn(),
    };

    service = new JobOrchestratorService(taccService, jobRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Submit Single Job', () => {
    it('should handle job submission failure and mark as FAILED', async () => {
      const userId = 'user-1';
      const submission = {
        agent: 'AlphaCal',
        dataset_id: 'dataset-1',
        params: { gpu_count: 2, rfi_strategy: 'medium' as const },
      };

      jobRepository.create.mockResolvedValueOnce({
        id: 'job-1',
        user_id: userId,
        agent: 'AlphaCal',
        status: 'PENDING',
      } as any);

      taccService.submitJob.mockRejectedValueOnce(
        new Error('TACC unavailable'),
      );

      await expect(service.submitJob(userId, submission)).rejects.toThrow(
        'TACC unavailable',
      );

      expect(jobRepository.updateStatus).toHaveBeenCalledWith(
        'job-1',
        'FAILED',
      );
    });

    it('should create job record before TACC submission', async () => {
      const userId = 'user-1';
      const submission = {
        agent: 'AlphaCal',
        dataset_id: 'dataset-1',
        params: { gpu_count: 2, rfi_strategy: 'medium' as const },
      };

      jobRepository.create.mockResolvedValueOnce({
        id: 'job-1',
        user_id: userId,
        status: 'PENDING',
      } as any);

      taccService.submitJob.mockResolvedValueOnce({ jobId: 'tacc-1' });

      jobRepository.findById.mockResolvedValueOnce({
        id: 'job-1',
        tacc_job_id: 'tacc-1',
        status: 'QUEUING',
      } as any);

      const result = await service.submitJob(userId, submission);

      expect(jobRepository.create).toHaveBeenCalled();
      expect(jobRepository.updateStatus).toHaveBeenCalledWith(
        'job-1',
        'QUEUING',
      );
      expect(result.tacc_job_id).toBe('tacc-1');
    });

    it('should handle TACC return null job and still update', async () => {
      const userId = 'user-1';
      const submission = {
        agent: 'AlphaCal',
        dataset_id: 'dataset-1',
        params: { gpu_count: 2 },
      };

      const jobRecord: Job = {
        id: 'job-1',
        user_id: userId,
        status: 'PENDING' as any,
        agent: 'AlphaCal',
        dataset_id: 'dataset-1',
        params: {},
        progress: 0,
        result: undefined,
        tacc_job_id: undefined,
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: undefined,
      };

      jobRepository.create.mockResolvedValueOnce(jobRecord);
      taccService.submitJob.mockResolvedValueOnce({ jobId: 'tacc-1' });
      jobRepository.findById.mockResolvedValueOnce(null);

      const result = await service.submitJob(userId, submission);

      expect(result).toBe(jobRecord);
    });
  });

  describe('Submit Batch Jobs', () => {
    it('should submit batch with default parallelLimit of 3', async () => {
      const userId = 'user-1';
      const batch: BatchJobRequest = {
        jobs: [
          { agent: 'AlphaCal', dataset_id: 'ds-1', params: { gpu_count: 1 } },
          { agent: 'AlphaCal', dataset_id: 'ds-2', params: { gpu_count: 1 } },
          { agent: 'AlphaCal', dataset_id: 'ds-3', params: { gpu_count: 1 } },
          { agent: 'AlphaCal', dataset_id: 'ds-4', params: { gpu_count: 1 } },
        ],
      };

      jobRepository.create.mockResolvedValue({
        id: 'job-x',
        status: 'PENDING',
      } as any);

      taccService.submitJob.mockResolvedValue({ jobId: 'tacc-x' });

      jobRepository.findById.mockResolvedValue({
        id: 'job-x',
        status: 'QUEUING',
        tacc_job_id: 'tacc-x',
      } as any);

      const results = await service.submitBatch(userId, batch);

      // Should submit all 4 jobs (3 + 1)
      expect(results.length).toBe(4);
      expect(jobRepository.create).toHaveBeenCalledTimes(4);
    });

    it('should respect custom parallelLimit', async () => {
      const userId = 'user-1';
      const batch: BatchJobRequest = {
        jobs: [
          { agent: 'AlphaCal', dataset_id: 'ds-1', params: { gpu_count: 1 } },
          { agent: 'AlphaCal', dataset_id: 'ds-2', params: { gpu_count: 1 } },
        ],
        parallelLimit: 1,
      };

      jobRepository.create.mockResolvedValue({
        id: 'job-x',
        status: 'PENDING',
      } as any);

      taccService.submitJob.mockResolvedValue({ jobId: 'tacc-x' });
      jobRepository.findById.mockResolvedValue({
        id: 'job-x',
        status: 'QUEUING',
        tacc_job_id: 'tacc-x',
      } as any);

      const results = await service.submitBatch(userId, batch);

      // Should submit both jobs sequentially
      expect(results.length).toBe(2);
    });

    it('should handle partial batch failure', async () => {
      const userId = 'user-1';
      const batch: BatchJobRequest = {
        jobs: [
          { agent: 'AlphaCal', dataset_id: 'ds-1', params: { gpu_count: 1 } },
          { agent: 'AlphaCal', dataset_id: 'ds-2', params: { gpu_count: 1 } },
        ],
      };

      // First succeeds, second fails
      jobRepository.create
        .mockResolvedValueOnce({ id: 'job-1', status: 'PENDING' } as any)
        .mockResolvedValueOnce({ id: 'job-2', status: 'PENDING' } as any);

      taccService.submitJob
        .mockResolvedValueOnce({ jobId: 'tacc-1' })
        .mockRejectedValueOnce(new Error('TACC failure'));

      jobRepository.findById
        .mockResolvedValueOnce({
          id: 'job-1',
          status: 'QUEUING',
          tacc_job_id: 'tacc-1',
        } as any)
        .mockResolvedValueOnce(null);

      const results = await service.submitBatch(userId, batch);

      // Should return only successful job
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('job-1');
    });

    it('should handle empty batch', async () => {
      const batch: BatchJobRequest = { jobs: [] };

      const results = await service.submitBatch('user-1', batch);

      expect(results).toEqual([]);
      expect(jobRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('Get Job Status', () => {
    it('should return null for non-existent job', async () => {
      jobRepository.findById.mockResolvedValueOnce(null);

      const result = await service.getJobStatus('non-existent');

      expect(result).toBeNull();
    });

    it('should fetch TACC status for queuing jobs', async () => {
      jobRepository.findById
        .mockResolvedValueOnce({
          id: 'job-1',
          tacc_job_id: 'tacc-1',
          status: 'QUEUING',
        } as any)
        .mockResolvedValueOnce({
          id: 'job-1',
          tacc_job_id: 'tacc-1',
          status: 'QUEUING',
          progress: 5,
        } as any);

      taccService.getJobStatus.mockResolvedValueOnce({
        status: 'RUNNING',
        progress: 5,
      } as any);

      const result = await service.getJobStatus('job-1');

      expect(result).toBeDefined();
      expect(taccService.getJobStatus).toHaveBeenCalledWith('tacc-1');
      expect(jobRepository.updateProgress).toHaveBeenCalledWith('job-1', 5);
    });

    it('should update job when TACC reports completion', async () => {
      jobRepository.findById
        .mockResolvedValueOnce({
          id: 'job-1',
          tacc_job_id: 'tacc-1',
          status: 'RUNNING',
        } as any)
        .mockResolvedValueOnce({
          id: 'job-1',
          tacc_job_id: 'tacc-1',
          status: 'COMPLETED',
          progress: 100,
        } as any);

      taccService.getJobStatus.mockResolvedValueOnce({
        status: 'COMPLETED',
        progress: 100,
        output_url: 'https://example.com/result.fits',
      } as any);

      const result = await service.getJobStatus('job-1');
      expect(result?.status).toBe('COMPLETED');

      expect(jobRepository.updateStatus).toHaveBeenCalledWith(
        'job-1',
        'COMPLETED',
        100,
      );
      expect(jobRepository.updateResult).toHaveBeenCalledWith('job-1', {
        output_url: 'https://example.com/result.fits',
      });
    });

    it('should handle TACC failure status', async () => {
      jobRepository.findById
        .mockResolvedValueOnce({
          id: 'job-1',
          tacc_job_id: 'tacc-1',
          status: 'RUNNING',
        } as any)
        .mockResolvedValueOnce({
          id: 'job-1',
          tacc_job_id: 'tacc-1',
          status: 'FAILED',
        } as any);

      taccService.getJobStatus.mockResolvedValueOnce({
        status: 'FAILED',
        progress: 25,
      } as any);

      const result = await service.getJobStatus('job-1');
      expect(result?.status).toBe('FAILED');

      expect(jobRepository.updateStatus).toHaveBeenCalledWith(
        'job-1',
        'FAILED',
        25,
      );
    });

    it('should skip TACC update for completed jobs', async () => {
      jobRepository.findById.mockResolvedValueOnce({
        id: 'job-1',
        tacc_job_id: 'tacc-1',
        status: 'COMPLETED',
      } as any);

      await service.getJobStatus('job-1');

      expect(taccService.getJobStatus).not.toHaveBeenCalled();
    });
  });

  describe('Optimization Tips', () => {
    it('should recommend GPU count when missing', async () => {
      const submission = {
        agent: 'AlphaCal',
        dataset_id: 'ds-1',
        params: { rfi_strategy: 'medium' as const },
      };

      const tips = await service.getOptimizationTips(submission);

      const gpuTip = tips.find((t) => t.category === 'gpu');
      expect(gpuTip).toBeDefined();
      expect(gpuTip?.severity).toBe('warning');
      expect(gpuTip?.suggestedValue).toBe(2);
    });

    it('should warn about excessive GPU count', async () => {
      const submission = {
        agent: 'AlphaCal',
        dataset_id: 'ds-1',
        params: { gpu_count: 8, rfi_strategy: 'medium' as const },
      };

      const tips = await service.getOptimizationTips(submission);

      const costTip = tips.find((t) => t.category === 'cost');
      expect(costTip).toBeDefined();
      expect(costTip?.severity).toBe('info');
    });

    it('should recommend RFI strategy when missing', async () => {
      const submission = {
        agent: 'AlphaCal',
        dataset_id: 'ds-1',
        params: { gpu_count: 2 },
      };

      const tips = await service.getOptimizationTips(submission);

      const rfiTip = tips.find((t) => t.category === 'rfi_strategy');
      expect(rfiTip).toBeDefined();
      expect(rfiTip?.severity).toBe('warning');
      expect(rfiTip?.suggestedValue).toBe('medium');
    });

    it('should warn about high RFI strategy runtime impact', async () => {
      const submission = {
        agent: 'AlphaCal',
        dataset_id: 'ds-1',
        params: { gpu_count: 2, rfi_strategy: 'high' as const },
      };

      const tips = await service.getOptimizationTips(submission);

      const runtimeTip = tips.find(
        (t) => t.category === 'runtime' && t.message.includes('High RFI'),
      );
      expect(runtimeTip).toBeDefined();
      expect(runtimeTip?.severity).toBe('info');
    });

    it('should recommend max runtime when missing', async () => {
      const submission = {
        agent: 'AlphaCal',
        dataset_id: 'ds-1',
        params: { gpu_count: 2, rfi_strategy: 'medium' as const },
      };

      const tips = await service.getOptimizationTips(submission);

      const runtimeTip = tips.find(
        (t) => t.category === 'runtime' && t.suggestedValue,
      );
      expect(runtimeTip).toBeDefined();
      expect(runtimeTip?.suggestedValue).toBe('48h');
    });
  });

  describe('Resource Metrics', () => {
    it('should calculate metrics from user jobs', async () => {
      const userId = 'user-1';
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 3600000);

      jobRepository.findByUser.mockResolvedValueOnce([
        [
          {
            id: 'job-1',
            gpu_count: 4,
            status: 'COMPLETED',
            created_at: twoHoursAgo,
            completed_at: now,
          },
          {
            id: 'job-2',
            gpu_count: 2,
            status: 'RUNNING',
            created_at: new Date(),
          },
        ],
        2,
      ] as any);

      const metrics = await service.getResourceMetrics(userId);

      expect(metrics.totalGpuCount).toBe(6);
      expect(metrics.averageRuntime).toBeCloseTo(7200000); // 2 hours in ms
      expect(metrics.successRate).toBe(50); // 1 of 2 completed
      expect(metrics.estimatedCost).toBeGreaterThan(0);
    });

    it('should handle no completed jobs', async () => {
      jobRepository.findByUser.mockResolvedValueOnce([
        [
          {
            id: 'job-1',
            gpu_count: 2,
            status: 'RUNNING',
            created_at: new Date(),
          },
        ],
        1,
      ] as any);

      const metrics = await service.getResourceMetrics('user-1');

      expect(metrics.averageRuntime).toBe(0);
      expect(metrics.successRate).toBe(0);
      expect(metrics.estimatedCost).toBe(0);
    });

    it('should handle no user jobs', async () => {
      jobRepository.findByUser.mockResolvedValueOnce([[], 0] as any);

      const metrics = await service.getResourceMetrics('user-1');

      expect(metrics.totalGpuCount).toBe(0);
      expect(metrics.successRate).toBe(0);
    });
  });

  describe('Cancel Job', () => {
    it('should return false for non-existent job', async () => {
      jobRepository.findById.mockResolvedValueOnce(null);

      const cancelled = await service.cancelJob('non-existent');

      expect(cancelled).toBe(false);
      expect(taccService.cancelJob).not.toHaveBeenCalled();
    });

    it('should cancel queued job with TACC ID', async () => {
      jobRepository.findById.mockResolvedValueOnce({
        id: 'job-1',
        status: 'QUEUING',
        tacc_job_id: 'tacc-1',
      } as any);

      taccService.cancelJob.mockResolvedValueOnce(undefined);

      const cancelled = await service.cancelJob('job-1');

      expect(cancelled).toBe(true);
      expect(taccService.cancelJob).toHaveBeenCalledWith('tacc-1');
      expect(jobRepository.updateStatus).toHaveBeenCalledWith(
        'job-1',
        'CANCELLED',
      );
    });

    it('should reject cancel of completed job', async () => {
      jobRepository.findById.mockResolvedValueOnce({
        id: 'job-1',
        status: 'COMPLETED',
      } as any);

      const cancelled = await service.cancelJob('job-1');

      expect(cancelled).toBe(false);
      expect(taccService.cancelJob).not.toHaveBeenCalled();
    });

    it('should reject cancel of failed job', async () => {
      jobRepository.findById.mockResolvedValueOnce({
        id: 'job-1',
        status: 'FAILED',
      } as any);

      const cancelled = await service.cancelJob('job-1');

      expect(cancelled).toBe(false);
    });

    it('should reject cancel of already cancelled job', async () => {
      jobRepository.findById.mockResolvedValueOnce({
        id: 'job-1',
        status: 'CANCELLED',
      } as any);

      const cancelled = await service.cancelJob('job-1');

      expect(cancelled).toBe(false);
    });

    it('should cancel running job without TACC ID', async () => {
      jobRepository.findById.mockResolvedValueOnce({
        id: 'job-1',
        status: 'RUNNING',
        tacc_job_id: null,
      } as any);

      const cancelled = await service.cancelJob('job-1');

      expect(cancelled).toBe(true);
      expect(taccService.cancelJob).not.toHaveBeenCalled();
      expect(jobRepository.updateStatus).toHaveBeenCalledWith(
        'job-1',
        'CANCELLED',
      );
    });
  });

  describe('Get Job History', () => {
    it('should retrieve job history with pagination', async () => {
      jobRepository.findByUser.mockResolvedValueOnce([
        [
          { id: 'job-1', status: 'COMPLETED' },
          { id: 'job-2', status: 'RUNNING' },
        ],
        50,
      ] as any);

      const result = await service.getJobHistory('user-1', 25, 0);

      expect(result.jobs).toHaveLength(2);
      expect(result.total).toBe(50);
      expect(jobRepository.findByUser).toHaveBeenCalledWith('user-1', 25, 0);
    });

    it('should use default pagination values', async () => {
      jobRepository.findByUser.mockResolvedValueOnce([[], 0] as any);

      await service.getJobHistory('user-1');

      expect(jobRepository.findByUser).toHaveBeenCalledWith('user-1', 50, 0);
    });
  });

  describe('Search Jobs', () => {
    it('should search jobs with filters', async () => {
      const filters = { agent: 'AlphaCal', status: 'COMPLETED' };

      jobRepository.search.mockResolvedValueOnce([
        [{ id: 'job-1', agent: 'AlphaCal', status: 'COMPLETED' }],
        1,
      ] as any);

      const result = await service.searchJobs('user-1', filters, 50, 0);

      expect(result.jobs).toHaveLength(1);
      expect(result.total).toBe(1);
      // Verify user_id was added to filters
      expect(jobRepository.search).toHaveBeenCalledWith(
        { agent: 'AlphaCal', status: 'COMPLETED', user_id: 'user-1' },
        50,
        0,
      );
    });
  });

  describe('Get Available Resource Pools', () => {
    it('should return static resource pools', async () => {
      const pools = await service.getAvailableResourcePools();

      expect(pools).toHaveLength(2);
      expect(pools[0].name).toBe('GPU-V100');
      expect(pools[1].name).toBe('GPU-A100');
      expect(pools[0].availableGpus).toBeLessThanOrEqual(pools[0].totalGpus);
    });
  });
});
