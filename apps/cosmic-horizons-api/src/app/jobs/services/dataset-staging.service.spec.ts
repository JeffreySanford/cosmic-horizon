import { Test, TestingModule } from '@nestjs/testing';
import { DatasetStagingService } from '../services/dataset-staging.service';

describe('DatasetStagingService', () => {
  let service: DatasetStagingService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [DatasetStagingService],
    }).compile();

    service = moduleRef.get<DatasetStagingService>(DatasetStagingService);
  });

  afterEach(async () => {
    jest.useRealTimers();
    service.onModuleDestroy();
    await moduleRef.close();
  });

  describe('validateDataset', () => {
    it('should validate dataset and return info', async () => {
      const datasetId = 'test-dataset-1';

      const result = await service.validateDataset(datasetId);

      expect(result.id).toBe(datasetId);
      expect(result.format).toBe('FITS');
      expect(result.ready_for_processing).toBe(true);
      expect(result.size_gb).toBeGreaterThan(0);
    });

    it('should return staging location', async () => {
      const result = await service.validateDataset('test-1');

      expect(result.staging_location).toBeDefined();
      expect(result.staging_location).toContain('/tacc/scratch/');
    });

    it('should throw NotFoundException for missing dataset', async () => {
      await expect(service.validateDataset('notfound-123')).rejects.toThrow(
        'Dataset not found',
      );
    });

    it('should throw ForbiddenException for forbidden dataset', async () => {
      await expect(service.validateDataset('forbidden-xyz')).rejects.toThrow(
        'Access denied',
      );
    });
  });

  describe('stageDataset', () => {
    it('should initiate dataset staging', async () => {
      const request = {
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch' as const,
        priority: 'normal' as const,
      };

      const result = await service.stageDataset(request);

      expect(result.dataset_id).toBe('dataset-1');
      expect(result.status).toBe('in_progress');
      expect(result.progress).toBe(0);
    });

    it('should set shorter estimated time for high priority', async () => {
      const request = {
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch' as const,
        priority: 'high' as const,
      };

      const result = await service.stageDataset(request);

      expect(result.estimated_time_minutes).toBeLessThan(30);
    });

    it('should set longer estimated time for normal priority', async () => {
      const request = {
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch' as const,
        priority: 'normal' as const,
      };

      const result = await service.stageDataset(request);

      expect(result.estimated_time_minutes).toBeGreaterThan(30);
    });

    it('should immediately fail staging for error dataset', async () => {
      const request = {
        dataset_id: 'error-123',
        target_resource: 'tacc_scratch' as const,
        priority: 'normal' as const,
      };

      const result = await service.stageDataset(request);
      expect(result.status).toBe('failed');
      expect(result.error_code).toBe('SIMULATED_FAILURE');
    });

    it('should eventually complete and set artifact_url', async () => {
      jest.useFakeTimers();
      const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(1);
      const request = {
        dataset_id: 'dataset-zip',
        target_resource: 'tacc_scratch' as const,
        priority: 'normal' as const,
      };
      const res = await service.stageDataset(request);
      expect(res.status).toBe('in_progress');

      // fast-forward enough time to finish
      jest.advanceTimersByTime(20000);
      const status = await service.getStagingStatus('dataset-zip');
      expect(status?.status).toBe('completed');
      expect(status?.artifact_url).toContain('.zip');
      randomSpy.mockRestore();
      jest.useRealTimers();
    });
  });

  describe('getStagingStatus', () => {
    it('should return staging status for in-progress dataset', async () => {
      const request = {
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch' as const,
        priority: 'normal' as const,
      };

      jest.useFakeTimers();
      await service.stageDataset(request);
      jest.advanceTimersByTime(100);
      const status = await service.getStagingStatus('dataset-1');
      jest.useRealTimers();

      expect(status).not.toBeNull();
      expect(status?.dataset_id).toBe('dataset-1');
      expect(['in_progress', 'completed']).toContain(status?.status);
    });

    it('should return null for non-existent staging', async () => {
      const status = await service.getStagingStatus('nonexistent');

      expect(status).toBeNull();
    });
  });

  describe('estimateTransferTime', () => {
    it('should estimate transfer time for given size', async () => {
      const estimate = service.estimateTransferTime(100); // 100 GB

      expect(estimate.minMinutes).toBeGreaterThan(0);
      expect(estimate.maxMinutes).toBeGreaterThan(estimate.minMinutes);
    });

    it('should scale with dataset size', async () => {
      const estimate1 = service.estimateTransferTime(50);
      const estimate2 = service.estimateTransferTime(100);

      expect(estimate2.minMinutes).toBeGreaterThan(estimate1.minMinutes);
    });

    it('should add buffer to estimate', async () => {
      const estimate = service.estimateTransferTime(100);

      const bufferRatio = estimate.maxMinutes / estimate.minMinutes;
      expect(bufferRatio).toBeCloseTo(1.5, 0.1); // 50% buffer
    });
  });

  describe('optimizeDatasetLayout', () => {
    it('should provide optimization recommendations', async () => {
      const result = await service.optimizeDatasetLayout('dataset-1');

      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should estimate performance speedup', async () => {
      const result = await service.optimizeDatasetLayout('dataset-1');

      expect(result.estimated_speedup).toBeGreaterThan(1.0);
    });
  });
});
