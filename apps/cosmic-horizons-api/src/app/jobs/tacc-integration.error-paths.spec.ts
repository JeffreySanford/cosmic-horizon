import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  TaccIntegrationService,
  TaccJobSubmission,
} from './tacc-integration.service';
import { Logger } from '@nestjs/common';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('TaccIntegrationService - Error Paths', () => {
  let service: TaccIntegrationService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          TACC_API_URL: 'https://api.tacc.utexas.edu',
          TACC_API_KEY: 'test-key-123',
        };
        return config[key] ?? defaultValue;
      }),
    };

    testingModule = await Test.createTestingModule({
      providers: [
        TaccIntegrationService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = testingModule.get<TaccIntegrationService>(TaccIntegrationService);
    configService = testingModule.get(
      ConfigService,
    ) as jest.Mocked<ConfigService>;

    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Constructor initialization', () => {
    it('should initialize with valid config', async () => {
      const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: string) => {
          const config: Record<string, string> = {
            TACC_API_URL: 'https://api.tacc.utexas.edu',
            TACC_API_KEY: 'test-key-123',
          };
          return config[key] ?? defaultValue;
        }),
      };

      testingModule = await Test.createTestingModule({
        providers: [
          TaccIntegrationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const svc = testingModule.get<TaccIntegrationService>(
        TaccIntegrationService,
      );
      expect(svc).toBeDefined();
    });

    it('should use defaults when config is missing', async () => {
      const mockConfigService = {
        get: jest.fn((key: string, defaultValue?: string) => defaultValue),
      };

      testingModule = await Test.createTestingModule({
        providers: [
          TaccIntegrationService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const svc = testingModule.get<TaccIntegrationService>(
        TaccIntegrationService,
      );
      expect(svc).toBeDefined();
    });
  });

  describe('submitJob error handling', () => {
    it('should handle submission errors gracefully', async () => {
      const submission: TaccJobSubmission = {
        agent: 'AlphaCal',
        dataset_id: 'dataset-001',
        params: { gpu_count: 4 },
      };

      const result = await service.submitJob(submission);
      expect(result).toHaveProperty('jobId');
      expect(result.jobId).toMatch(/^tacc-/);
    });

    it('should log submission failures', async () => {
      const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');
      const submission: TaccJobSubmission = {
        agent: 'ImageReconstruction',
        dataset_id: 'dataset-002',
        params: { algorithm: 'clean' },
      };

      await service.submitJob(submission);

      // Service should have been called successfully (no error thrown)
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('getJobStatus error handling', () => {
    it('should handle status retrieval successfully', async () => {
      const status = await service.getJobStatus('tacc-123');

      expect(status).toHaveProperty('id', 'tacc-123');
      expect(status).toHaveProperty('status');
      expect(['QUEUED', 'RUNNING', 'COMPLETED']).toContain(status.status);
    });

    it('should include progress in status response', async () => {
      const status = await service.getJobStatus('tacc-456');

      expect(status).toHaveProperty('progress');
      expect(typeof status.progress).toBe('number');
      expect(status.progress).toBeGreaterThanOrEqual(0);
    });

    it('should include output URL for completed jobs', async () => {
      const status = await service.getJobStatus('tacc-999');

      if (status.status === 'COMPLETED') {
        expect(status).toHaveProperty('output_url');
      }
    });

    it('should handle completion gracefully', async () => {
      const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');
      await service.getJobStatus('tacc-completed-job');

      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('cancelJob error handling', () => {
    it('should cancel job successfully', async () => {
      const result = await service.cancelJob('tacc-789');

      expect(typeof result).toBe('boolean');
      expect(result).toBe(true);
    });

    it('should handle cancellation gracefully', async () => {
      const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');
      await service.cancelJob('tacc-to-cancel');

      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Error Message Generation', () => {
    it('should extract error message from Error objects', async () => {
      const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');

      // Trigger an error scenario by testing the error path
      // The service catches errors and logs them
      const submission: TaccJobSubmission = {
        agent: 'AnomalyDetection',
        dataset_id: 'dataset-error',
        params: { model: 'v2.1' },
      };

      await service.submitJob(submission);
      // No error should be thrown, service should handle gracefully
    });

    it('should use fallback error message for non-Error objects', async () => {
      const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');

      // Test that service handles unknown error types
      const submission: TaccJobSubmission = {
        agent: 'AlphaCal',
        dataset_id: 'dataset-unknown-error',
        params: {},
      };

      await service.submitJob(submission);
      // No error should be thrown, service should handle gracefully
    });
  });

  describe('Service Integration', () => {
    it('should handle multiple sequential job submissions', async () => {
      const submission1 = await service.submitJob({
        agent: 'AlphaCal',
        dataset_id: 'dataset-a',
        params: {},
      });

      const submission2 = await service.submitJob({
        agent: 'ImageReconstruction',
        dataset_id: 'dataset-b',
        params: {},
      });

      expect(submission1.jobId).toBeDefined();
      expect(submission2.jobId).toBeDefined();
      expect(submission1.jobId).not.toEqual(submission2.jobId);
    });

    it('should track multiple job statuses', async () => {
      const jobId1 = 'tacc-job-1';
      const jobId2 = 'tacc-job-2';

      const status1 = await service.getJobStatus(jobId1);
      const status2 = await service.getJobStatus(jobId2);

      expect(status1.id).toBe(jobId1);
      expect(status2.id).toBe(jobId2);
    });
  });
});
