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
