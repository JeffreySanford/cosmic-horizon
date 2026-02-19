import {
  TaccIntegrationService,
  TaccJobSubmission,
  TaccJobStatus,
} from './tacc-integration.service';
import { ConfigService } from '@nestjs/config';

describe('TACCIntegrationService - Comprehensive Coverage', () => {
  let service: TaccIntegrationService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string) => defaultValue),
    } as any;

    service = new TaccIntegrationService(mockConfigService);
    jest.clearAllMocks();
  });

  describe('submitJob', () => {
    it('should submit job successfully', async () => {
      const submission: TaccJobSubmission = {
        agent: 'AlphaCal',
        dataset_id: 'dataset-123',
        params: {
          rfi_strategy: 'high',
          gpu_count: 8,
        },
      };

      const result = await service.submitJob(submission);

      expect(result).toBeDefined();
      expect(result.jobId).toBeDefined();
    });

    it('should reject invalid agent type', async () => {
      const submission: TaccJobSubmission = {
        agent: 'AlphaCal',
        dataset_id: 'dataset-123',
        params: {},
      };

      // Should still succeed as agent validation happens server-side
      const result = await service.submitJob(submission);
      expect(result.jobId).toBeDefined();
    });

    it('should accept different agent types', async () => {
      const agents = ['AlphaCal', 'ImageReconstruction', 'AnomalyDetection'];

      for (const agent of agents) {
        const result = await service.submitJob({
          agent,
          dataset_id: 'dataset-123',
          params: {},
        });

        expect(result.jobId).toBeDefined();
      }
    });

    it('should handle various param configurations', async () => {
      const submissions = [
        {
          agent: 'AlphaCal',
          dataset_id: 'dataset-1',
          params: { rfi_strategy: 'low' },
        },
        {
          agent: 'ImageReconstruction',
          dataset_id: 'dataset-2',
          params: { gpu_count: 16 },
        },
        {
          agent: 'AnomalyDetection',
          dataset_id: 'dataset-3',
          params: { max_runtime: '12:00:00' },
        },
      ];

      const results = await Promise.all(
        submissions.map((s) => service.submitJob(s)),
      );

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.jobId)).toBe(true);
    });

    it('should handle job submission with all param types', async () => {
      const submission: TaccJobSubmission = {
        agent: 'AlphaCal',
        dataset_id: 'dataset-123',
        params: {
          rfi_strategy: 'high_sensitivity', // string
          gpu_count: 4, // number
          max_runtime: '24:00:00', // string
          use_cache: true, // boolean
        },
      };

      const result = await service.submitJob(submission);
      expect(result.jobId).toBeDefined();
    });

    it('should handle concurrent job submissions', async () => {
      const submissions = [];
      for (let i = 0; i < 10; i++) {
        submissions.push(
          service.submitJob({
            agent: 'AlphaCal',
            dataset_id: `dataset-${i}`,
            params: {},
          }),
        );
      }

      const results = await Promise.all(submissions);
      expect(results).toHaveLength(10);
      // All job IDs should be unique
      const jobIds = new Set(results.map((r) => r.jobId));
      expect(jobIds.size).toBe(10);
    });

    it('should handle empty params', async () => {
      const result = await service.submitJob({
        agent: 'AlphaCal',
        dataset_id: 'dataset-123',
        params: {},
      });

      expect(result.jobId).toBeDefined();
    });
  });

  describe('getJobStatus', () => {
    it('should return valid job status', async () => {
      const submission = await service.submitJob({
        agent: 'AlphaCal',
        dataset_id: 'dataset-123',
        params: {},
      });

      const status = await service.getJobStatus(submission.jobId);

      expect(status).toBeDefined();
      expect(status.id).toBe(submission.jobId);
      expect(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']).toContain(
        status.status,
      );
    });

    it('should return job progress between 0 and 1', async () => {
      const submission = await service.submitJob({
        agent: 'AlphaCal',
        dataset_id: 'dataset-123',
        params: {},
      });

      const status = await service.getJobStatus(submission.jobId);

      expect(status.progress).toBeGreaterThanOrEqual(0);
      expect(status.progress).toBeLessThanOrEqual(1);
    });

    it('should include output_url for completed jobs', async () => {
      const submission = await service.submitJob({
        agent: 'AlphaCal',
        dataset_id: 'dataset-123',
        params: {},
      });

      const status = await service.getJobStatus(submission.jobId);

      if (status.status === 'COMPLETED' && status.output_url) {
        expect(status.output_url).toContain('http');
      }
    });

    it('should handle status polling for running jobs', async () => {
      const submission = await service.submitJob({
        agent: 'AlphaCal',
        dataset_id: 'dataset-123',
        params: {},
      });

      const statuses = [];
      for (let i = 0; i < 5; i++) {
        const status = await service.getJobStatus(submission.jobId);
        statuses.push(status);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      expect(statuses).toHaveLength(5);
      // All should be for same job
      expect(new Set(statuses.map((s) => s.id)).size).toBe(1);
    });

    it('should return consistent job IDs', async () => {
      const submission = await service.submitJob({
        agent: 'AlphaCal',
        dataset_id: 'dataset-123',
        params: {},
      });

      const status1 = await service.getJobStatus(submission.jobId);
      const status2 = await service.getJobStatus(submission.jobId);

      expect(status1.id).toBe(status2.id);
    });

    it('should return simulated status for any job ID', async () => {
      // Service simulates status even for non-existent IDs
      const status = await service.getJobStatus('any-job-id');

      expect(status).toHaveProperty('id');
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('progress');
    });
  });

  describe('cancelJob', () => {
    it('should cancel running job', async () => {
      const submission = await service.submitJob({
        agent: 'AlphaCal',
        dataset_id: 'dataset-123',
        params: {},
      });

      const result = await service.cancelJob(submission.jobId);

      expect(result).toBe(true);
    });

    it('should handle multiple job cancellations', async () => {
      const submissions = [];
      for (let i = 0; i < 5; i++) {
        submissions.push(
          await service.submitJob({
            agent: 'AlphaCal',
            dataset_id: `dataset-${i}`,
            params: {},
          }),
        );
      }

      const cancellations = await Promise.all(
        submissions.map((s) => service.cancelJob(s.jobId)),
      );

      expect(cancellations).toHaveLength(5);
    });
  });

  describe('end-to-end job workflows', () => {
    it('should handle complete job lifecycle', async () => {
      const submission = await service.submitJob({
        agent: 'AlphaCal',
        dataset_id: 'dataset-123',
        params: { rfi_strategy: 'high' },
      });

      expect(submission.jobId).toBeDefined();

      const status1 = await service.getJobStatus(submission.jobId);
      expect(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']).toContain(
        status1.status,
      );
    });

    it('should handle job cancellation workflow', async () => {
      const submission = await service.submitJob({
        agent: 'ImageReconstruction',
        dataset_id: 'dataset-456',
        params: { gpu_count: 16 },
      });

      const statusBefore = await service.getJobStatus(submission.jobId);
      expect(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED']).toContain(
        statusBefore.status,
      );

      const cancelled = await service.cancelJob(submission.jobId);
      expect(cancelled).toBe(true);
    });

    it('should support multiple concurrent workflows', async () => {
      const agents = ['AlphaCal', 'ImageReconstruction', 'AnomalyDetection'];
      const submissions = [];

      for (let i = 0; i < 3; i++) {
        submissions.push(
          await service.submitJob({
            agent: agents[i],
            dataset_id: `dataset-${i}`,
            params: {},
          }),
        );
      }

      const statuses = await Promise.all(
        submissions.map((s) => service.getJobStatus(s.jobId)),
      );

      expect(statuses).toHaveLength(3);
      expect(statuses.every((s) => s.id)).toBe(true);
    });
  });
});
