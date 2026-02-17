import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller';
import { TaccIntegrationService } from './tacc-integration.service';
import { JobOrchestratorService } from './services/job-orchestrator.service';
import { DatasetStagingService } from './services/dataset-staging.service';
import { AuthenticatedRequest } from '../types/http.types';
import { Job } from './entities/job.entity';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('JobsController', () => {
  let controller: JobsController;
  let orchestrator: jest.Mocked<JobOrchestratorService>;
  let datasetStaging: jest.Mocked<DatasetStagingService>;

  const mockUser = { id: 'user-123', email: 'user@example.com', role: 'user' };
  const mockRequest = { user: mockUser } as unknown as AuthenticatedRequest;

  const mockJob: Job = {
    id: 'job-123',
    user_id: mockUser.id,
    status: 'RUNNING',
    created_at: new Date(),
    updated_at: new Date(),
    tacc_job_id: 'tacc-456',
    dataset_id: 'dataset-789',
    agent: 'ImageReconstruction',
    progress: 50,
    params: {},
  } as unknown as Job;

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        {
          provide: TaccIntegrationService,
          useValue: {
            submitJob: jest.fn(),
            getJobStatus: jest.fn(),
            cancelJob: jest.fn(),
          },
        },
        {
          provide: JobOrchestratorService,
          useValue: {
            submitJob: jest.fn(),
            submitBatch: jest.fn(),
            getJobStatus: jest.fn(),
            cancelJob: jest.fn(),
            getJobHistory: jest.fn(),
            searchJobs: jest.fn(),
            getOptimizationTips: jest.fn(),
            getResourceMetrics: jest.fn(),
            getAvailableResourcePools: jest.fn(),
          },
        },
        {
          provide: DatasetStagingService,
          useValue: {
            stageDataset: jest.fn(),
            getStagingStatus: jest.fn(),
            validateDataset: jest.fn(),
            optimizeDatasetLayout: jest.fn(),
            estimateTransferTime: jest
              .fn()
              .mockImplementation(() =>
                Promise.resolve({ minMinutes: 0, maxMinutes: 0 }),
              ),
          },
        },
      ],
    }).compile();

    controller = testingModule.get<JobsController>(JobsController);
    orchestrator = testingModule.get(
      JobOrchestratorService,
    ) as jest.Mocked<JobOrchestratorService>;
    datasetStaging = testingModule.get(
      DatasetStagingService,
    ) as jest.Mocked<DatasetStagingService>;
  });

  describe('submitJob - POST /jobs/submit', () => {
    it('should submit a single job successfully', async () => {
      const submission = {
        datasetId: 'dataset-789',
        agentType: 'ImageReconstruction',
        parameters: { algorithm: 'clean', iterations: 100 },
      };

      orchestrator.submitJob.mockResolvedValue(mockJob);

      const result = await controller.submitJob(mockRequest, submission as any);

      expect(result).toEqual(mockJob);
      expect(orchestrator.submitJob).toHaveBeenCalledWith(
        mockUser.id,
        submission,
      );
    });

    it('should handle job submission for AlphaCal agent', async () => {
      const submission = {
        datasetId: 'dataset-100',
        agentType: 'AlphaCal',
        parameters: { solveType: 'direction-dependent' },
      };

      const alphaCalJob = { ...mockJob, agent: 'AlphaCal', id: 'job-alpha-1' };
      orchestrator.submitJob.mockResolvedValue(alphaCalJob);

      const result = await controller.submitJob(mockRequest, submission as any);

      expect(result.agent).toBe('AlphaCal');
      expect(orchestrator.submitJob).toHaveBeenCalledWith(
        mockUser.id,
        submission,
      );
    });

    it('should handle job submission with different dataset', async () => {
      const submission = {
        datasetId: 'dataset-custom-456',
        agentType: 'AnomalyDetection',
        parameters: { modelVersion: '2.1' },
      };

      const customJob = {
        ...mockJob,
        agent: 'AnomalyDetection',
        dataset_id: 'dataset-custom-456',
      };
      orchestrator.submitJob.mockResolvedValue(customJob);

      const result = await controller.submitJob(mockRequest, submission as any);

      expect(result.dataset_id).toBe('dataset-custom-456');
    });
  });

  describe('submitBatch - POST /jobs/submit-batch', () => {
    it('should submit multiple jobs in batch', async () => {
      const batch = {
        jobs: [
          { datasetId: 'dataset-1', agentType: 'ImageReconstruction' },
          { datasetId: 'dataset-2', agentType: 'AlphaCal' },
        ],
        maxParallel: 2,
      };

      const jobs = [mockJob, { ...mockJob, id: 'job-124', agent: 'AlphaCal' }];
      orchestrator.submitBatch.mockResolvedValue(jobs);

      const result = await controller.submitBatch(mockRequest, batch as any);

      expect(result).toHaveLength(2);
      expect(orchestrator.submitBatch).toHaveBeenCalledWith(mockUser.id, batch);
    });

    it('should respect controlled parallelism in batch', async () => {
      const batch = {
        jobs: [
          { datasetId: 'dataset-1', agentType: 'ImageReconstruction' },
          { datasetId: 'dataset-2', agentType: 'ImageReconstruction' },
          { datasetId: 'dataset-3', agentType: 'ImageReconstruction' },
        ],
        maxParallel: 1,
      };

      orchestrator.submitBatch.mockResolvedValue([mockJob]);

      await controller.submitBatch(mockRequest, batch as any);

      expect(orchestrator.submitBatch).toHaveBeenCalledWith(mockUser.id, batch);
    });
  });

  describe('getJobStatus - GET /jobs/:id/status', () => {
    it('should retrieve job status', async () => {
      orchestrator.getJobStatus.mockResolvedValue(mockJob);

      const result = await controller.getJobStatus(mockJob.id);

      expect(result).toEqual(mockJob);
      expect(orchestrator.getJobStatus).toHaveBeenCalledWith(mockJob.id);
    });

    it('should handle job not found', async () => {
      orchestrator.getJobStatus.mockResolvedValue(null);

      const result = await controller.getJobStatus('nonexistent-job');

      expect(result).toBeNull();
    });

    it('should return completed job status', async () => {
      const completedJob: Job = {
        ...mockJob,
        status: 'COMPLETED',
        progress: 100,
      } as any;
      orchestrator.getJobStatus.mockResolvedValue(completedJob);

      const result = await controller.getJobStatus(completedJob.id);

      expect(result!.status).toBe('COMPLETED');
      expect(result!.progress).toBe(100);
    });
  });

  describe('cancelJob - DELETE /jobs/:id', () => {
    it('should cancel a job successfully', async () => {
      orchestrator.cancelJob.mockResolvedValue(true);

      const result = await controller.cancelJob(mockJob.id);

      expect(result).toEqual({ success: true });
      expect(orchestrator.cancelJob).toHaveBeenCalledWith(mockJob.id);
    });

    it('should handle failed job cancellation', async () => {
      orchestrator.cancelJob.mockResolvedValue(false);

      const result = await controller.cancelJob('already-completed-job');

      expect(result).toEqual({ success: false });
    });
  });

  describe('getJobHistory - GET /jobs/history/list', () => {
    it('should retrieve job history with defaults', async () => {
      const history = {
        jobs: [mockJob],
        total: 1,
      };
      orchestrator.getJobHistory.mockResolvedValue(history);

      await controller.getJobHistory(mockRequest);

      expect(orchestrator.getJobHistory).toHaveBeenCalledWith(
        mockUser.id,
        50,
        0,
      );
    });

    it('should respect limit and offset parameters', async () => {
      const history = {
        jobs: [mockJob, { ...mockJob, id: 'job-125' }],
        total: 15,
      };
      orchestrator.getJobHistory.mockResolvedValue(history);

      const limit: any = '10';
      const offset: any = '5';
      await controller.getJobHistory(mockRequest, limit, offset);

      expect(orchestrator.getJobHistory).toHaveBeenCalledWith(
        mockUser.id,
        10,
        5,
      );
    });

    it('should return empty history for new user', async () => {
      orchestrator.getJobHistory.mockResolvedValue({ jobs: [], total: 0 });

      await controller.getJobHistory(mockRequest);
    });
  });

  describe('searchJobs - GET /jobs/search', () => {
    it('should search jobs with filters', async () => {
      const filters = { status: 'COMPLETED', agent: 'ImageReconstruction' };
      const results = { jobs: [mockJob], total: 1 };
      orchestrator.searchJobs.mockResolvedValue(results);

      await controller.searchJobs(mockRequest, filters);

      expect(orchestrator.searchJobs).toHaveBeenCalledWith(
        mockUser.id,
        filters,
        50,
        0,
      );
    });

    it('should search jobs by agent type', async () => {
      const filters = { agent: 'AlphaCal' };
      orchestrator.searchJobs.mockResolvedValue({ jobs: [mockJob], total: 1 });

      await controller.searchJobs(mockRequest, filters);

      expect(orchestrator.searchJobs).toHaveBeenCalledWith(
        mockUser.id,
        filters,
        50,
        0,
      );
    });

    it('should handle pagination in search results', async () => {
      const filters = { status: 'RUNNING' };
      orchestrator.searchJobs.mockResolvedValue({ jobs: [mockJob], total: 25 });

      const limit: any = '10';
      const offset: any = '20';
      await controller.searchJobs(mockRequest, filters, limit, offset);

      expect(orchestrator.searchJobs).toHaveBeenCalledWith(
        mockUser.id,
        filters,
        10,
        20,
      );
    });
  });

  describe('getOptimizationTips - POST /jobs/optimize', () => {
    it('should return optimization tips for job configuration', async () => {
      const submission = {
        datasetId: 'dataset-789',
        agentType: 'ImageReconstruction',
        parameters: { algorithm: 'clean' },
      };
      const tips = [
        {
          category: 'runtime' as const,
          severity: 'info' as const,
          message: 'Increase iterations for better quality',
        },
      ];
      orchestrator.getOptimizationTips.mockResolvedValue(tips);

      const result = await controller.getOptimizationTips(submission as any);

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe('runtime');
      expect(orchestrator.getOptimizationTips).toHaveBeenCalledWith(submission);
    });

    it('should provide cost optimization recommendations', async () => {
      const submission = {
        datasetId: 'dataset-789',
        agentType: 'AlphaCal',
        parameters: { gpuCount: 8 },
      };
      const tips = [
        {
          category: 'cost' as const,
          severity: 'warning' as const,
          message: 'Consider using 4 GPUs instead',
        },
      ];
      orchestrator.getOptimizationTips.mockResolvedValue(tips);

      const result = await controller.getOptimizationTips(submission as any);

      expect(result[0].category).toBe('cost');
    });

    it('should handle empty optimization tips', async () => {
      const submission = {
        datasetId: 'dataset-optimal',
        agentType: 'ImageReconstruction',
      };
      orchestrator.getOptimizationTips.mockResolvedValue([]);

      const result = await controller.getOptimizationTips(submission as any);

      expect(result).toHaveLength(0);
    });
  });

  describe('getResourceMetrics - GET /jobs/metrics', () => {
    it('should retrieve resource metrics for user', async () => {
      const metrics = {
        totalGpuCount: 8,
        averageRuntime: 245.5,
        estimatedCost: 1227.5,
        successRate: 0.95,
      };
      orchestrator.getResourceMetrics.mockResolvedValue(metrics);

      const result = await controller.getResourceMetrics(mockRequest);

      expect(result.totalGpuCount).toBe(8);
      expect(result.estimatedCost).toBe(1227.5);
      expect(orchestrator.getResourceMetrics).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return zero metrics for new user', async () => {
      orchestrator.getResourceMetrics.mockResolvedValue({
        totalGpuCount: 0,
        averageRuntime: 0,
        estimatedCost: 0,
        successRate: 0,
      });

      const result = await controller.getResourceMetrics(mockRequest);

      expect(result.totalGpuCount).toBe(0);
    });
  });

  describe('getAvailableResources - GET /jobs/resources/available', () => {
    it('should retrieve available GPU resource pools', async () => {
      const resources = [
        {
          name: 'GPU-V100',
          totalGpus: 16,
          availableGpus: 8,
          queueWaitTime: 12,
        },
        { name: 'GPU-A100', totalGpus: 8, availableGpus: 4, queueWaitTime: 5 },
      ];
      orchestrator.getAvailableResourcePools.mockResolvedValue(resources);

      const result = await controller.getAvailableResources();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('GPU-V100');
    });

    it('should handle resource constraints', async () => {
      const resources = [
        {
          name: 'GPU-A100',
          totalGpus: 8,
          availableGpus: 0,
          queueWaitTime: 120,
        },
      ];
      orchestrator.getAvailableResourcePools.mockResolvedValue(resources);

      const result = await controller.getAvailableResources();

      expect(result[0].availableGpus).toBe(0);
    });
  });

  describe('stageDataset - POST /jobs/dataset/stage', () => {
    it('should stage dataset for processing', async () => {
      const request = {
        datasetId: 'dataset-789',
        source: 'archive',
        destination: 'compute-node',
      };
      const status = {
        dataset_id: 'dataset-789',
        status: 'in_progress' as const,
        progress: 0,
        estimated_time_minutes: 60,
      };
      datasetStaging.stageDataset.mockResolvedValue(status);

      const result = await controller.stageDataset(request as any);

      expect(result.status).toBe('in_progress');
      expect(datasetStaging.stageDataset).toHaveBeenCalledWith(request);
    });

    it('should handle dataset already staged', async () => {
      const request = {
        datasetId: 'dataset-staged',
        source: 'archive',
        destination: 'compute-node',
      };
      const status = {
        dataset_id: 'dataset-staged',
        status: 'completed' as const,
        progress: 100,
      };
      datasetStaging.stageDataset.mockResolvedValue(status);

      const result = await controller.stageDataset(request as any);

      expect(result.status).toBe('completed');
    });
  });

  describe('getStagingStatus - GET /jobs/dataset/:id/staging-status', () => {
    it('should retrieve dataset staging status', async () => {
      const status = {
        dataset_id: 'dataset-789',
        status: 'in_progress' as const,
        progress: 50,
        estimated_time_minutes: 30,
      };
      datasetStaging.getStagingStatus.mockResolvedValue(status);

      const result = await controller.getStagingStatus('dataset-789');

      expect(result!.status).toBe('in_progress');
      expect(datasetStaging.getStagingStatus).toHaveBeenCalledWith(
        'dataset-789',
      );
    });

    it('should handle dataset not found', async () => {
      datasetStaging.getStagingStatus.mockResolvedValue(null);

      const result = await controller.getStagingStatus('nonexistent');

      expect(result).toBeNull();
    });

    it('should return completed staging status', async () => {
      const status = {
        dataset_id: 'dataset-complete',
        status: 'completed' as const,
        progress: 100,
      };
      datasetStaging.getStagingStatus.mockResolvedValue(status);

      const result = await controller.getStagingStatus('dataset-complete');

      expect(result!.status).toBe('completed');
    });
  });

  describe('validateDataset - GET /jobs/dataset/:id/validate', () => {
    it('should validate dataset readiness', async () => {
      const validation = {
        id: 'dataset-789',
        name: 'Dataset-789',
        size_gb: 200,
        format: 'FITS',
        created_date: new Date(),
        ready_for_processing: true,
      };
      datasetStaging.validateDataset.mockResolvedValue(validation);

      const result = await controller.validateDataset('dataset-789');

      expect(result.ready_for_processing).toBe(true);
      expect(datasetStaging.validateDataset).toHaveBeenCalledWith(
        'dataset-789',
      );
    });

    it('should report validation errors', async () => {
      const validation = {
        id: 'dataset-invalid',
        name: 'Dataset-Invalid',
        size_gb: 0,
        format: 'UNKNOWN',
        created_date: new Date(),
        ready_for_processing: false,
      };
      datasetStaging.validateDataset.mockResolvedValue(validation);

      const result = await controller.validateDataset('dataset-invalid');

      expect(result.ready_for_processing).toBe(false);
    });
  });

  describe('optimizeDataset - GET /jobs/dataset/:id/optimize', () => {
    it('should provide dataset optimization recommendations', async () => {
      const optimization = {
        recommendations: ['Data staging to NVMe tier'],
        estimated_speedup: 1.25,
      };
      datasetStaging.optimizeDatasetLayout.mockResolvedValue(optimization);

      const result = await controller.optimizeDataset('dataset-789');

      expect(result.recommendations).toHaveLength(1);
      expect(datasetStaging.optimizeDatasetLayout).toHaveBeenCalledWith(
        'dataset-789',
      );
    });

    it('should suggest data layout improvements', async () => {
      const optimization = {
        recommendations: ['Improve data layout'],
        estimated_speedup: 1.45,
      };
      datasetStaging.optimizeDatasetLayout.mockResolvedValue(optimization);

      const result = await controller.optimizeDataset('dataset-optimize');

      expect(result.estimated_speedup).toBeGreaterThan(1);
    });
  });

  describe('estimateTransferTime - POST /jobs/dataset/estimate-transfer', () => {
    it('should estimate data transfer time', async () => {
      const estimate = {
        minMinutes: 120,
        maxMinutes: 180,
      };
      (datasetStaging.estimateTransferTime as jest.Mock).mockResolvedValue(
        estimate,
      );

      const result = await controller.estimateTransferTime({ size_gb: 1000 });

      expect(result.minMinutes).toBe(120);
      expect(datasetStaging.estimateTransferTime).toHaveBeenCalledWith(1000);
    });

    it('should handle small dataset transfer', async () => {
      const estimate = {
        minMinutes: 1,
        maxMinutes: 2,
      };
      (datasetStaging.estimateTransferTime as jest.Mock).mockResolvedValue(
        estimate,
      );

      const result = await controller.estimateTransferTime({ size_gb: 10 });

      expect(result.minMinutes).toBeLessThan(5);
    });

    it('should recommend parallel transfer for large datasets', async () => {
      const estimate = {
        minMinutes: 60,
        maxMinutes: 90,
      };
      (datasetStaging.estimateTransferTime as jest.Mock).mockResolvedValue(
        estimate,
      );

      const result = await controller.estimateTransferTime({ size_gb: 5000 });

      expect(result.minMinutes).toBeGreaterThan(30);
    });
  });
});
