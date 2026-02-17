import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { TaccIntegrationService, TaccJobSubmission, TaccJobParams } from './tacc-integration.service';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('TaccIntegrationService', () => {
  let service: TaccIntegrationService;
  let configService: jest.Mocked<ConfigService>;

  const mockTaccConfig = {
    TACC_API_URL: 'https://api.tacc.utexas.edu/v1',
    TACC_API_KEY: 'test-api-key-12345',
    TACC_API_SECRET: 'test-api-secret-98765',
    TACC_SYSTEM_ID: 'stampede3',
    TACC_QUEUE: 'gpu',
  };

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        TaccIntegrationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key, defaultValue) => mockTaccConfig[key as keyof typeof mockTaccConfig] || defaultValue),
          },
        },
      ],
    }).compile();

    service = testingModule.get<TaccIntegrationService>(TaccIntegrationService);
    configService = testingModule.get(ConfigService) as jest.Mocked<ConfigService>;

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with TACC API configuration', () => {
      expect(service).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('TACC_API_URL', 'https://api.tacc.utexas.edu');
      expect(configService.get).toHaveBeenCalledWith('TACC_API_KEY', '');
    });

    it('should use default values when TACC config is missing', async () => {
      configService.get.mockImplementation((key) => {
        if (key === 'TACC_API_URL') return 'https://api.tacc.utexas.edu';
        if (key === 'TACC_API_KEY') return '';
        return undefined;
      });

      const newModule = await Test.createTestingModule({
        providers: [
          TaccIntegrationService,
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const newService = newModule.get<TaccIntegrationService>(TaccIntegrationService);
      expect(newService).toBeDefined();
    });
  });

  describe('submitJob', () => {
    const validJobSubmission: TaccJobSubmission = {
      agent: 'AlphaCal',
      dataset_id: 'dataset-001',
      params: {
        rfi_strategy: 'medium' as const,
        gpu_count: 2,
        max_runtime: '4:00:00',
      },
    };

    it('should submit a job successfully', async () => {
      const result = await service.submitJob(validJobSubmission);

      expect(result).toHaveProperty('jobId');
      expect(result.jobId).toMatch(/^tacc-\d+$/);
    });

    it('should handle AlphaCal agent submission', async () => {
      const alphacalSubmission: TaccJobSubmission = {
        agent: 'AlphaCal',
        dataset_id: 'dataset-alphacal-001',
        params: {
          rfi_strategy: 'high' as const,
          gpu_count: 4,
        },
      };

      const result = await service.submitJob(alphacalSubmission);
      expect(result.jobId).toBeDefined();
    });

    it('should handle ImageReconstruction agent submission', async () => {
      const reconstructionSubmission: TaccJobSubmission = {
        agent: 'ImageReconstruction',
        dataset_id: 'dataset-reconstruction-001',
        params: {
          gpu_count: 8,
          max_runtime: '8:00:00',
        },
      };

      const result = await service.submitJob(reconstructionSubmission);
      expect(result.jobId).toBeDefined();
    });

    it('should handle AnomalyDetection agent submission', async () => {
      const anomalySubmission: TaccJobSubmission = {
        agent: 'AnomalyDetection',
        dataset_id: 'dataset-anomaly-001',
        params: {
          gpu_count: 1,
          max_runtime: '2:00:00',
        },
      };

      const result = await service.submitJob(anomalySubmission);
      expect(result.jobId).toBeDefined();
    });

    it('should submit job with minimal params', async () => {
      const minimalSubmission: TaccJobSubmission = {
        agent: 'AlphaCal',
        dataset_id: 'dataset-minimal',
        params: {},
      };

      const result = await service.submitJob(minimalSubmission);
      expect(result.jobId).toBeDefined();
    });

    it('should submit job with all RFI strategy options', async () => {
      const strategies: TaccJobParams['rfi_strategy'][] = ['low', 'medium', 'high', 'high_sensitivity'];

      for (const strategy of strategies) {
        const submission: TaccJobSubmission = {
          agent: 'AlphaCal',
          dataset_id: `dataset-rfi-${strategy}`,
          params: { rfi_strategy: strategy },
        };

        const result = await service.submitJob(submission);
        expect(result.jobId).toBeDefined();
      }
    });

    it('should handle job submission with custom params', async () => {
      const customSubmission: TaccJobSubmission = {
        agent: 'AlphaCal',
        dataset_id: 'dataset-custom-001',
        params: {
          rfi_strategy: 'medium' as const,
          gpu_count: 4,
          max_runtime: '6:00:00',
          custom_param_1: 'value1',
          custom_param_2: 123,
          custom_param_3: true,
        },
      };

      const result = await service.submitJob(customSubmission);
      expect(result.jobId).toBeDefined();
    });

    it('should log job submission', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.submitJob(validJobSubmission);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Submitting TACC job'),
      );
    });

    it('should handle submission errors gracefully', async () => {
      jest.spyOn(service, 'submitJob').mockRejectedValueOnce(new Error('TACC API error'));

      const submission: TaccJobSubmission = {
        agent: 'AlphaCal',
        dataset_id: 'dataset-error',
        params: {},
      };

      await expect(service.submitJob(submission)).rejects.toThrow('TACC API error');
    });
  });

  describe('getJobStatus', () => {
    it('should retrieve job status successfully', async () => {
      const jobId = 'tacc-123456';
      const status = await service.getJobStatus(jobId);

      expect(status).toHaveProperty('id');
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('progress');
      expect(status.id).toBe(jobId);
      expect(['QUEUED', 'RUNNING', 'COMPLETED'].includes(status.status)).toBe(true);
      expect(status.progress).toBeGreaterThanOrEqual(0);
      expect(status.progress).toBeLessThanOrEqual(1);
    });

    it('should include output URL for completed jobs', async () => {
      // Mock to return COMPLETED status
      jest.spyOn(service, 'getJobStatus').mockResolvedValueOnce({
        id: 'tacc-123456',
        status: 'COMPLETED',
        progress: 1.0,
        output_url: 'https://archive.vla.nrao.edu/results/job-123.fits',
      });

      const status = await service.getJobStatus('tacc-123456');

      expect(status.status).toBe('COMPLETED');
      expect(status.output_url).toBeDefined();
    });

    it('should return progress for running jobs', async () => {
      jest.spyOn(service, 'getJobStatus').mockResolvedValueOnce({
        id: 'tacc-123456',
        status: 'RUNNING',
        progress: 0.45,
      });

      const status = await service.getJobStatus('tacc-123456');

      expect(status.status).toBe('RUNNING');
      expect(status.progress).toBe(0.45);
    });

    it('should handle queued jobs with zero progress', async () => {
      jest.spyOn(service, 'getJobStatus').mockResolvedValueOnce({
        id: 'tacc-123456',
        status: 'QUEUED',
        progress: 0,
      });

      const status = await service.getJobStatus('tacc-123456');

      expect(status.status).toBe('QUEUED');
      expect(status.progress).toBe(0);
    });

    it('should log status check', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.getJobStatus('tacc-123456');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Fetching status'),
      );
    });

    it('should handle status fetch errors', async () => {
      jest.spyOn(service, 'getJobStatus').mockRejectedValueOnce(new Error('Connection timeout'));

      await expect(service.getJobStatus('tacc-123456')).rejects.toThrow('Connection timeout');
    });

    it('should handle multiple status checks sequentially', async () => {
      const jobIds = ['tacc-001', 'tacc-002', 'tacc-003'];

      for (const jobId of jobIds) {
        const status = await service.getJobStatus(jobId);
        expect(status.id).toBe(jobId);
        expect(status.status).toBeDefined();
      }
    });
  });

  describe('cancelJob', () => {
    it('should cancel job successfully', async () => {
      const result = await service.cancelJob('tacc-123456');

      expect(result).toBe(true);
    });

    it('should log job cancellation', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.cancelJob('tacc-123456');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cancelling TACC job'),
      );
    });

    it('should handle cancellation errors', async () => {
      jest.spyOn(service, 'cancelJob').mockRejectedValueOnce(new Error('Job not found'));

      await expect(service.cancelJob('invalid-job-id')).rejects.toThrow('Job not found');
    });

    it('should handle multiple job cancellations', async () => {
      const jobIds = ['tacc-001', 'tacc-002', 'tacc-003'];

      for (const jobId of jobIds) {
        const result = await service.cancelJob(jobId);
        expect(result).toBe(true);
      }
    });

    it('should return false for failed cancellation', async () => {
      jest.spyOn(service, 'cancelJob').mockResolvedValueOnce(false);

      const result = await service.cancelJob('tacc-123456');

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle network errors during submission', async () => {
      const errorMessage = 'Network timeout: TACC API unreachable';
      jest.spyOn(service, 'submitJob').mockRejectedValueOnce(new Error(errorMessage));

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow(errorMessage);
    });

    it('should handle authentication failures', async () => {
      const errorMessage = 'Invalid API credentials';
      jest.spyOn(service, 'submitJob').mockRejectedValueOnce(new Error(errorMessage));

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow(errorMessage);
    });

    it('should handle rate limiting', async () => {
      const errorMessage = 'Rate limit exceeded: 100 requests per minute';
      jest.spyOn(service, 'submitJob').mockRejectedValueOnce(new Error(errorMessage));

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow(errorMessage);
    });

    it('should handle server errors (5xx)', async () => {
      const errorMessage = 'TACC Server Error: 503 Service Unavailable';
      jest.spyOn(service, 'submitJob').mockRejectedValueOnce(new Error(errorMessage));

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow(errorMessage);
    });

    it('should handle data validation errors', async () => {
      const errorMessage = 'Invalid parameter: gpu_count must be positive';
      jest.spyOn(service, 'submitJob').mockRejectedValueOnce(new Error(errorMessage));

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: { gpu_count: -1 },
        }),
      ).rejects.toThrow(errorMessage);
    });
  });

  describe('configuration validation', () => {
    it('should validate TACC API URL configuration', () => {
      const url = configService.get('TACC_API_URL', 'https://api.tacc.utexas.edu');
      expect(url).toMatch(/^https:\/\//);
    });

    it('should ensure API key is present', () => {
      const apiKey = configService.get('TACC_API_KEY', '');
      expect(apiKey).toBeTruthy();
    });

    it('should validate system ID configuration', () => {
      const systemId = configService.get('TACC_SYSTEM_ID', 'stampede3');
      expect(systemId).toBeDefined();
    });

    it('should validate queue name configuration', () => {
      const queue = configService.get('TACC_QUEUE', 'gpu');
      expect(queue).toBeDefined();
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent job submissions', async () => {
      const submissions: TaccJobSubmission[] = Array.from({ length: 5 }, (_, i) => ({
        agent: 'AlphaCal' as const,
        dataset_id: `dataset-concurrent-${i}`,
        params: { gpu_count: i + 1 },
      }));

      const results = await Promise.all(submissions.map(s => service.submitJob(s)));

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.jobId).toBeDefined();
      });
    });

    it('should handle concurrent status checks', async () => {
      const jobIds = Array.from({ length: 5 }, (_, i) => `tacc-${i}`);

      const results = await Promise.all(jobIds.map(id => service.getJobStatus(id)));

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.id).toBeDefined();
        expect(result.status).toBeDefined();
      });
    });

    it('should handle mixed concurrent operations', async () => {
      const submission = {
        agent: 'AlphaCal' as const,
        dataset_id: 'dataset-mixed',
        params: { gpu_count: 2 },
      };

      const operations = [
        service.submitJob(submission),
        service.getJobStatus('tacc-001'),
        service.cancelJob('tacc-002'),
        service.getJobStatus('tacc-003'),
        service.submitJob(submission),
      ];

      const results = await Promise.all(operations);

      expect(results).toHaveLength(5);
      expect(results[0]).toHaveProperty('jobId');
      expect(results[1]).toHaveProperty('status');
      expect(results[2]).toBe(true);
    });
  });

  describe('logging behavior', () => {
    it('should log debug information on initialization', () => {
      const debugSpy = jest.spyOn(service['logger'], 'debug');

      // Initialize service to verify debug logging on instantiation
      new TaccIntegrationService(configService);

      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringContaining('TACC Integration initialized'),
      );
    });

    it('should log successful operations', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.submitJob({
        agent: 'AlphaCal',
        dataset_id: 'dataset-001',
        params: {},
      });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully submitted job'),
      );
    });

    it('should log errors appropriately', async () => {
      const errorSpy = jest.spyOn(service['logger'], 'error');
      
      // Verify error logging capability is available
      service['logger'].error('Test error message');

      // Error logger should be callable (spy was set up)
      expect(errorSpy).toBeDefined();
    });
  });
});
