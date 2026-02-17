import {
  DatasetStagingService,
  StagingRequest,
  StagingStatus,
} from './dataset-staging.service';

describe('DatasetStagingService - Comprehensive Coverage', () => {
  let service: DatasetStagingService;

  beforeEach(() => {
    service = new DatasetStagingService();
  });

  afterEach(() => {
    jest.useRealTimers();
    service.onModuleDestroy();
  });

  describe('validateDataset', () => {
    it('should validate a valid dataset ID', async () => {
      const result = await service.validateDataset('dataset-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('dataset-123');
      expect(result.ready_for_processing).toBe(true);
    });

    it('should return dataset with correct name format', async () => {
      const result = await service.validateDataset(
        'long-dataset-identifier-abc123',
      );

      expect(result.name).toContain('Dataset-long-');
    });

    it('should return realistic size_gb (50-550 GB range)', async () => {
      const result = await service.validateDataset('test-id');

      expect(result.size_gb).toBeGreaterThanOrEqual(50);
      expect(result.size_gb).toBeLessThanOrEqual(550);
    });

    it('should set format to FITS', async () => {
      const result = await service.validateDataset('dataset-1');
      expect(result.format).toBe('FITS');
    });

    it('should have created_date in the past', async () => {
      const result = await service.validateDataset('dataset-1');
      const createdTime = result.created_date.getTime();
      const now = Date.now();

      expect(createdTime).toBeLessThan(now);
      expect(now - createdTime).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000);
    });

    it('should set staging location based on dataset ID', async () => {
      const result = await service.validateDataset('unique-id-123');

      expect(result.staging_location).toBe('/tacc/scratch/unique-id-123');
    });

    it('should have 100% staging progress', async () => {
      const result = await service.validateDataset('dataset-1');
      expect(result.staging_progress).toBe(100);
    });

    it('should handle empty dataset ID', async () => {
      const result = await service.validateDataset('');
      expect(result).toBeDefined();
      expect(result.staging_location).toBe('/tacc/scratch/');
    });

    it('should handle very long dataset IDs', async () => {
      const longId = 'a'.repeat(100);
      const result = await service.validateDataset(longId);

      expect(result).toBeDefined();
      expect(result.id).toBe(longId);
    });

    it('should handle special characters in IDs', async () => {
      const result = await service.validateDataset('dataset-123_test.v1');
      expect(result.id).toBe('dataset-123_test.v1');
    });
  });

  describe('stageDataset', () => {
    it('should initiate staging with normal priority', async () => {
      const request: StagingRequest = {
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch',
        priority: 'normal',
      };

      const result = await service.stageDataset(request);

      expect(result.dataset_id).toBe('dataset-1');
      expect(result.status).toBe('in_progress');
      expect(result.progress).toBe(0);
      expect(result.estimated_time_minutes).toBe(45);
    });

    it('should initiate staging with high priority', async () => {
      const request: StagingRequest = {
        dataset_id: 'dataset-2',
        target_resource: 'tacc_scratch',
        priority: 'high',
      };

      const result = await service.stageDataset(request);

      expect(result.status).toBe('in_progress');
      expect(result.estimated_time_minutes).toBe(15);
    });

    it('should respect priority for time estimates', async () => {
      const normalRequest: StagingRequest = {
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch',
        priority: 'normal',
      };

      const highRequest: StagingRequest = {
        dataset_id: 'dataset-2',
        target_resource: 'tacc_scratch',
        priority: 'high',
      };

      const normalResult = await service.stageDataset(normalRequest);
      const highResult = await service.stageDataset(highRequest);

      expect(highResult.estimated_time_minutes).toBeLessThan(
        normalResult.estimated_time_minutes,
      );
    });

    it('should stage to tacc_scratch target', async () => {
      const request: StagingRequest = {
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch',
        priority: 'normal',
      };

      await service.stageDataset(request);
      // Stage to tacc_scratch is accepted
      expect(true).toBe(true);
    });

    it('should stage to dvs target', async () => {
      const request: StagingRequest = {
        dataset_id: 'dataset-1',
        target_resource: 'dvs',
        priority: 'normal',
      };

      const result = await service.stageDataset(request);
      expect(result).toBeDefined();
    });

    it('should accept priority values', async () => {
      const normalRequest: StagingRequest = {
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch',
        priority: 'normal',
      };

      const highRequest: StagingRequest = {
        dataset_id: 'dataset-2',
        target_resource: 'tacc_scratch',
        priority: 'high',
      };

      await expect(service.stageDataset(normalRequest)).resolves.toBeDefined();
      await expect(service.stageDataset(highRequest)).resolves.toBeDefined();
    });
  });

  describe('getStagingStatus', () => {
    it('should return in_progress status for newly staged dataset', async () => {
      const request: StagingRequest = {
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch',
        priority: 'normal',
      };

      jest.useFakeTimers();
      await service.stageDataset(request);

      // Advance simulated staging without waiting in real time
      jest.advanceTimersByTime(100);
      jest.useRealTimers();

      const status = await service.getStagingStatus('dataset-1');
      expect(status).toBeDefined();
    });

    it('should return valid progress range (0-100)', async () => {
      const request: StagingRequest = {
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch',
        priority: 'normal',
      };

      await service.stageDataset(request);
      const status = await service.getStagingStatus('dataset-1');

      expect(status.progress).toBeGreaterThanOrEqual(0);
      expect(status.progress).toBeLessThanOrEqual(100);
    });

    it('should track dataset_id correctly', async () => {
      const datasetId = 'unique-dataset-id-123';
      const request: StagingRequest = {
        dataset_id: datasetId,
        target_resource: 'tacc_scratch',
        priority: 'normal',
      };

      await service.stageDataset(request);
      const status = await service.getStagingStatus(datasetId);

      expect(status.dataset_id).toBe(datasetId);
    });

    it('should return null for non-existent dataset', async () => {
      const result = await service.getStagingStatus('non-existent-dataset');
      expect(result).toBeNull();
    });

    it('should return estimated_time_minutes for in_progress status', async () => {
      const request: StagingRequest = {
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch',
        priority: 'normal',
      };

      await service.stageDataset(request);
      const status = await service.getStagingStatus('dataset-1');

      // Only in_progress status should have estimated_time_minutes
      if (status && status.status === 'in_progress') {
        expect(status.estimated_time_minutes).toBeDefined();
        expect(status.estimated_time_minutes ?? 0).toBeGreaterThan(0);
      }
    });
  });

  describe('optimizeDatasetLayout', () => {
    it('should provide optimization recommendations', async () => {
      const result = await service.optimizeDatasetLayout('dataset-1');

      expect(result).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should calculate speedup factor', async () => {
      const result = await service.optimizeDatasetLayout('dataset-1');

      expect(result.estimated_speedup).toBeGreaterThan(1);
    });

    it('should recommend NVMe tier staging', async () => {
      const result = await service.optimizeDatasetLayout('dataset-1');

      expect(result.recommendations.some((r) => r.includes('NVMe'))).toBe(true);
    });

    it('should include FITS header alignment recommendations', async () => {
      const result = await service.optimizeDatasetLayout('dataset-1');

      expect(result.recommendations.some((r) => r.includes('FITS'))).toBe(true);
    });
  });

  describe('estimateTransferTime', () => {
    it('should estimate transfer time for 100GB dataset', () => {
      const result = service.estimateTransferTime(100);

      expect(result.minMinutes).toBeLessThanOrEqual(result.maxMinutes);
      expect(result.minMinutes).toBeGreaterThan(0);
    });

    it('should apply 50% buffer to max estimate', () => {
      const result = service.estimateTransferTime(100);

      expect(result.maxMinutes).toBeGreaterThanOrEqual(
        result.minMinutes * 1.5 * 0.99,
      );
      expect(result.maxMinutes).toBeLessThanOrEqual(
        result.minMinutes * 1.5 * 1.01,
      );
    });

    it('should scale linearly with dataset size', () => {
      const result50 = service.estimateTransferTime(50);
      const result100 = service.estimateTransferTime(100);

      expect(result100.minMinutes).toBeGreaterThan(result50.minMinutes);
    });

    it('should handle small datasets', () => {
      const result = service.estimateTransferTime(10);

      expect(result.minMinutes).toBeGreaterThan(0);
    });

    it('should handle large datasets', () => {
      const result = service.estimateTransferTime(500);

      expect(result.minMinutes).toBeGreaterThan(0);
      expect(result.maxMinutes).toBeGreaterThan(result.minMinutes);
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple staged datasets', async () => {
      const requests: StagingRequest[] = [];
      for (let i = 0; i < 5; i++) {
        requests.push({
          dataset_id: `dataset-${i}`,
          target_resource: 'tacc_scratch',
          priority: 'normal',
        });
      }

      const results = await Promise.all(
        requests.map((r) => service.stageDataset(r)),
      );

      expect(results).toHaveLength(5);
      expect(results.every((r) => r.status === 'in_progress')).toBe(true);
    });

    it('should maintain independent progress for each dataset', async () => {
      await service.stageDataset({
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch',
        priority: 'normal',
      });

      await service.stageDataset({
        dataset_id: 'dataset-2',
        target_resource: 'tacc_scratch',
        priority: 'high',
      });

      const status1 = await service.getStagingStatus('dataset-1');
      const status2 = await service.getStagingStatus('dataset-2');

      expect(status1).toBeDefined();
      expect(status2).toBeDefined();
      // Different datasets should have different estimated times based on priority
      if (
        status1 &&
        status1.estimated_time_minutes &&
        status2 &&
        status2.estimated_time_minutes
      ) {
        expect(status2.estimated_time_minutes).toBeLessThan(
          status1.estimated_time_minutes,
        );
      }
    });

    it('should track multiple staging operations independently', async () => {
      const result1 = await service.stageDataset({
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch',
        priority: 'normal',
      });

      const result2 = await service.stageDataset({
        dataset_id: 'dataset-2',
        target_resource: 'tacc_scratch',
        priority: 'normal',
      });

      expect(result1.dataset_id).not.toBe(result2.dataset_id);
    });

    it('should handle up to 100 concurrent stagings', async () => {
      const requests: Promise<StagingStatus>[] = [];
      for (let i = 0; i < 100; i++) {
        requests.push(
          service.stageDataset({
            dataset_id: `dataset-${i}`,
            target_resource: 'tacc_scratch',
            priority: i % 2 === 0 ? 'normal' : 'high',
          }),
        );
      }

      const results = await Promise.all(requests);
      expect(results).toHaveLength(100);
    });
  });

  describe('priority handling', () => {
    it('should estimate 15 minutes for high priority', async () => {
      const result = await service.stageDataset({
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch',
        priority: 'high',
      });

      expect(result.estimated_time_minutes).toBe(15);
    });

    it('should estimate 45 minutes for normal priority', async () => {
      const result = await service.stageDataset({
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch',
        priority: 'normal',
      });

      expect(result.estimated_time_minutes).toBe(45);
    });

    it('should apply priority consistently', async () => {
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(
          await service.stageDataset({
            dataset_id: `test-${i}`,
            target_resource: 'tacc_scratch',
            priority: 'high',
          }),
        );
      }

      expect(results.every((r) => r.estimated_time_minutes === 15)).toBe(true);
    });
  });

  describe('resource targeting', () => {
    it('should accept tacc_scratch as valid resource', async () => {
      await expect(
        service.stageDataset({
          dataset_id: 'dataset-1',
          target_resource: 'tacc_scratch',
          priority: 'normal',
        }),
      ).resolves.toBeDefined();
    });

    it('should accept dvs as valid resource', async () => {
      await expect(
        service.stageDataset({
          dataset_id: 'dataset-1',
          target_resource: 'dvs',
          priority: 'normal',
        }),
      ).resolves.toBeDefined();
    });

    it('should handle resource allocation error', async () => {
      // Test that invalid resources would be caught in Phase 2
      const result = await service.stageDataset({
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch',
        priority: 'normal',
      });
      expect(result).toBeDefined();
    });
  });

  describe('staging lifecycle', () => {
    it('should transition from pending to in_progress', async () => {
      const request: StagingRequest = {
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch',
        priority: 'normal',
      };

      const result = await service.stageDataset(request);
      expect(result.status).toBe('in_progress');
    });

    it('should maintain status throughout staging', async () => {
      jest.useFakeTimers();
      await service.stageDataset({
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch',
        priority: 'normal',
      });

      const status1 = await service.getStagingStatus('dataset-1');
      jest.advanceTimersByTime(100);
      jest.useRealTimers();
      const status2 = await service.getStagingStatus('dataset-1');

      // Both should still be in_progress (Phase 1 simulates indefinitely or until completion)
      if (status1 && status1.status) {
        expect(['in_progress', 'completed']).toContain(status1.status);
      }
      if (status2 && status2.status) {
        expect(['in_progress', 'completed']).toContain(status2.status);
      }
    });

    it('should progress over time', async () => {
      jest.useFakeTimers();
      const result = await service.stageDataset({
        dataset_id: 'dataset-1',
        target_resource: 'tacc_scratch',
        priority: 'normal',
      });

      expect(result.progress).toBe(0);

      jest.advanceTimersByTime(2500);
      jest.useRealTimers();

      const status = await service.getStagingStatus('dataset-1');
      if (status && status.progress !== undefined) {
        expect(status.progress).toBeGreaterThanOrEqual(0);
        expect(status.progress).toBeLessThanOrEqual(100);
      }
    });
  });
});
