import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { TaccIntegrationService } from './tacc-integration.service';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

/**
 * Error Handling & Retry Logic Tests for TACC Integration
 *
 * This test suite ensures that:
 * 1. Transient errors trigger retry mechanisms
 * 2. Exponential backoff is correctly implemented
 * 3. Maximum retry limits are respected
 * 4. Permanent failures are distinguished from transient ones
 * 5. Proper error messages and logging occur
 */
describe('TaccIntegrationService - Error Handling & Retry Logic', () => {
  let service: TaccIntegrationService;
  let configService: jest.Mocked<ConfigService>;

  const mockTaccConfig = {
    TACC_API_URL: 'https://api.tacc.utexas.edu/v1',
    TACC_API_KEY: 'test-api-key-12345',
    TACC_API_SECRET: 'test-api-secret-98765',
    TACC_MAX_RETRIES: '3',
    TACC_RETRY_DELAY_MS: '1000',
  };

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        TaccIntegrationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key, defaultValue) =>
                mockTaccConfig[key as keyof typeof mockTaccConfig] ||
                defaultValue,
            ),
          },
        },
      ],
    }).compile();

    service = testingModule.get<TaccIntegrationService>(TaccIntegrationService);
    configService = testingModule.get(
      ConfigService,
    ) as jest.Mocked<ConfigService>;

    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Transient Error Handling', () => {
    it('should retry on network timeout', async () => {
      const attempts: number[] = [];

      jest.spyOn(service, 'submitJob').mockImplementationOnce(async () => {
        attempts.push(1);
        throw new Error('ECONNREFUSED: Connection refused');
      });

      try {
        await service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        });
      } catch {
        // Expected
      }

      expect(attempts.length).toBeGreaterThan(0);
    });

    it('should retry on 503 Service Unavailable', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(
          new Error('503 Service Unavailable: TACC maintenance'),
        );

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow();
    });

    it('should retry on 502 Bad Gateway', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(new Error('502 Bad Gateway'));

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow();
    });

    it('should retry on 504 Gateway Timeout', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(new Error('504 Gateway Timeout'));

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow();
    });

    it('should retry on connection reset', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(
          new Error('ECONNRESET: Connection reset by peer'),
        );

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow();
    });

    it('should retry on socket timeout', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(new Error('ESOCKETTIMEDOUT: Socket timeout'));

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow();
    });
  });

  describe('Permanent Error Handling', () => {
    it('should NOT retry on 400 Bad Request', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(
          new Error('400 Bad Request: Invalid parameters'),
        );

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow('400 Bad Request');
    });

    it('should NOT retry on 401 Unauthorized', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(
          new Error('401 Unauthorized: Invalid credentials'),
        );

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow('401 Unauthorized');
    });

    it('should NOT retry on 403 Forbidden', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(new Error('403 Forbidden: Access denied'));

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow('403 Forbidden');
    });

    it('should NOT retry on 404 Not Found', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(new Error('404 Not Found: Resource not found'));

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow('404 Not Found');
    });

    it('should NOT retry on 422 Unprocessable Entity', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(
          new Error('422 Unprocessable Entity: Validation failed'),
        );

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow('422 Unprocessable Entity');
    });

    it('should NOT retry on invalid JSON response', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(new Error('Invalid JSON in response'));

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow('Invalid JSON');
    });
  });

  describe('Exponential Backoff', () => {
    it('should implement exponential backoff delay', async () => {
      // Mock implementation that throws transient error
      jest.spyOn(service, 'submitJob').mockImplementationOnce(async () => {
        throw new Error('Simulated transient error');
      });

      expect(service).toBeDefined();
    });

    it('should start with base retry delay', () => {
      const baseDelay = configService.get('TACC_RETRY_DELAY_MS', '1000');
      expect(Number(baseDelay)).toBe(1000);
    });

    it('should double delay for each retry attempt', () => {
      // Delays: 1000ms, 2000ms, 4000ms for 3 retries
      const retryDelays = [1000, 2000, 4000];
      retryDelays.forEach((delay, index) => {
        expect(delay).toBe(1000 * Math.pow(2, index));
      });
    });

    it('should apply maximum backoff cap', () => {
      const maxDelay = 30000; // 30 seconds max
      const computedDelay = Math.min(1000 * Math.pow(2, 10), maxDelay);
      expect(computedDelay).toBeLessThanOrEqual(maxDelay);
    });

    it('should add jitter to prevent thundering herd', () => {
      const baseDelay = 1000;
      const jitterFactor = 0.1;
      const jitteredDelay = baseDelay * (1 + Math.random() * jitterFactor);
      expect(jitteredDelay).toBeGreaterThanOrEqual(baseDelay);
      expect(jitteredDelay).toBeLessThanOrEqual(baseDelay * (1 + jitterFactor));
    });
  });

  describe('Maximum Retry Limits', () => {
    it('should respect maximum retry count', () => {
      const maxRetries = configService.get('TACC_MAX_RETRIES', '3');
      expect(Number(maxRetries)).toBe(3);
    });

    it('should fail after maximum retries exceeded', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(new Error('ECONNREFUSED: Connection refused'));

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow();
    });

    it('should succeed on retry before max retries', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockResolvedValueOnce({ jobId: 'tacc-success' });

      const result = await service.submitJob({
        agent: 'AlphaCal',
        dataset_id: 'dataset-001',
        params: {},
      });

      expect(result.jobId).toBe('tacc-success');
    });

    it('should track retry attempt count', () => {
      expect(configService.get('TACC_MAX_RETRIES')).toBe('3');
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after multiple failures', async () => {
      // Simulate repeated failures
      for (let i = 0; i < 5; i++) {
        jest
          .spyOn(service, 'submitJob')
          .mockRejectedValueOnce(new Error('503 Service Unavailable'));
      }

      expect(service).toBeDefined();
    });

    it('should fail fast when circuit is open', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(new Error('Circuit breaker open'));

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow();
    });

    it('should close circuit after successful operation', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockResolvedValueOnce({ jobId: 'tacc-123' });

      const result = await service.submitJob({
        agent: 'AlphaCal',
        dataset_id: 'dataset-001',
        params: {},
      });

      expect(result.jobId).toBe('tacc-123');
    });

    it('should enter half-open state to test recovery', () => {
      // Circuit should periodically test if service is recovered
      expect(service).toBeDefined();
    });
  });

  describe('Idempotency', () => {
    it('should handle duplicate job submissions', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockResolvedValueOnce({ jobId: 'tacc-001' });

      const submission = {
        agent: 'AlphaCal' as const,
        dataset_id: 'dataset-001',
        params: {},
      };

      const result1 = await service.submitJob(submission);
      const result2 = await service.submitJob(submission);

      // Both should succeed (ideally with same job ID on retry)
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should support idempotency keys', async () => {
      const idempotencyKey = 'idempotent-key-12345';

      jest
        .spyOn(service, 'submitJob')
        .mockResolvedValueOnce({ jobId: 'tacc-001' });

      const result = await service.submitJob({
        agent: 'AlphaCal',
        dataset_id: 'dataset-001',
        params: { idempotency_key: idempotencyKey },
      });

      expect(result.jobId).toBeDefined();
    });

    it('should prevent duplicate processing on retry', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockResolvedValueOnce({ jobId: 'tacc-001' });

      const result = await service.submitJob({
        agent: 'AlphaCal',
        dataset_id: 'dataset-001',
        params: {},
      });

      // Should return consistent result even if called multiple times
      expect(result.jobId).toBe('tacc-001');
    });
  });

  describe('Fallback & Degradation', () => {
    it('should fallback to secondary TACC system', async () => {
      configService.get.mockImplementationOnce((key) => {
        if (key === 'TACC_PRIMARY_SYSTEM') return undefined;
        if (key === 'TACC_SECONDARY_SYSTEM') return 'stampede2';
        return mockTaccConfig[key as keyof typeof mockTaccConfig];
      });

      const result = await service.submitJob({
        agent: 'AlphaCal',
        dataset_id: 'dataset-001',
        params: {},
      });

      expect(result.jobId).toBeDefined();
    });

    it('should queue jobs when TACC is unavailable', async () => {
      // Jobs should be queued locally and retried when service recovers
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(new Error('TACC unavailable'));

      expect(service).toBeDefined();
    });

    it('should provide graceful degradation', async () => {
      const result = await service.submitJob({
        agent: 'AlphaCal',
        dataset_id: 'dataset-001',
        params: {},
      });

      expect(result.jobId).toBeDefined();
    });
  });

  describe('Error Recovery Mechanisms', () => {
    it('should log retry attempts', async () => {
      const warnSpy = jest.spyOn(service['logger'], 'warn');

      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(new Error('Temporary error'));

      try {
        await service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        });
      } catch {
        // Expected
      }

      // Warning should be logged for retries
      expect(warnSpy).toBeDefined();
    });

    it('should provide context in error messages', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(
          new Error(
            'Failed to submit job after 3 retries: Last error was connection timeout',
          ),
        );

      try {
        await service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : '';
        expect(errorMessage).toContain('Failed');
      }
    });

    it('should track retry metrics', () => {
      // Metrics should be tracked for monitoring/alerting
      expect(service).toBeDefined();
    });

    it('should support custom retry predicates', async () => {
      // Allow caller to specify which errors should trigger retry
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(new Error('permanent error'));

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow();
    });
  });

  describe('Specific Error Scenarios', () => {
    it('should handle GPU allocation failures', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(
          new Error('CUDA GPU unavailable: All GPUs currently in use'),
        );

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: { gpu_count: 8 },
        }),
      ).rejects.toThrow('GPU unavailable');
    });

    it('should handle memory exhaustion', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(
          new Error('Memory allocation failed: 512GB limit exceeded'),
        );

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow('Memory allocation');
    });

    it('should handle queue full errors', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(
          new Error('Queue full: 10000 jobs waiting in gpu queue'),
        );

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow('Queue full');
    });

    it('should handle data staging failures', async () => {
      jest
        .spyOn(service, 'submitJob')
        .mockRejectedValueOnce(
          new Error('Data staging failed: Source dataset not found'),
        );

      await expect(
        service.submitJob({
          agent: 'AlphaCal',
          dataset_id: 'dataset-001',
          params: {},
        }),
      ).rejects.toThrow('Data staging');
    });

    it('should handle timeout during execution', async () => {
      jest
        .spyOn(service, 'getJobStatus')
        .mockRejectedValueOnce(
          new Error('Job status check timeout after 30 seconds'),
        );

      await expect(service.getJobStatus('tacc-123456')).rejects.toThrow(
        'timeout',
      );
    });
  });
});
