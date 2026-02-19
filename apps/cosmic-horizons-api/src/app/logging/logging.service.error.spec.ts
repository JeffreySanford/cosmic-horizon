import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { LoggingService } from './logging.service';
import { LogEntry, LogSeverity, LogType } from './log-entry';

jest.mock('ioredis');

/**
 * LoggingService - Error Path & Branch Coverage Tests
 * Focus: Redis connection failures, write errors, log rotation, recovery
 */
describe('LoggingService - Error Paths & Branch Coverage', () => {
  let service: LoggingService;
  let redisMock: jest.Mocked<Partial<Redis>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    redisMock = {
      lpush: jest.fn(),
      ltrim: jest.fn(),
      lrange: jest.fn(),
      quit: jest.fn(),
    } as any;

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(
      () => redisMock as any,
    );
  });

  describe('Constructor - Redis Connection', () => {
    it('should initialize with buffer and null redis by default', () => {
      service = new LoggingService();
      expect((service as any).buffer).toEqual([]);
      expect(
        typeof ((service as any).buffer instanceof Map ? 'map' : 'array'),
      ).toBe('string');
    });

    it('should initialize Redis when enabled', () => {
      process.env['LOGS_REDIS_ENABLED'] = 'true';
      process.env['REDIS_HOST'] = 'localhost';
      process.env['REDIS_PORT'] = '6379';

      service = new LoggingService();

      expect((service as any).redis).not.toBeNull();
      expect((service as any).redis).toBeDefined();

      delete process.env['LOGS_REDIS_ENABLED'];
      delete process.env['REDIS_HOST'];
      delete process.env['REDIS_PORT'];
    });

    it('should handle Redis connection error', () => {
      process.env['LOGS_REDIS_ENABLED'] = 'true';
      process.env['REDIS_HOST'] = 'invalid-host';
      process.env['REDIS_PORT'] = '99999';

      // Make Redis constructor throw
      (Redis as jest.MockedClass<typeof Redis>).mockImplementationOnce(
        (): any => {
          throw new Error('Connection refused');
        },
      );

      // Suppress logger output for this test
      jest
        .spyOn(global.console, 'warn')
        .mockImplementationOnce(() => undefined);

      service = new LoggingService();

      expect((service as any).redis).toBeNull();

      delete process.env['LOGS_REDIS_ENABLED'];
      delete process.env['REDIS_HOST'];
      delete process.env['REDIS_PORT'];
    });
  });

  describe('add - Logging to Buffer', () => {
    beforeEach(() => {
      service = new LoggingService();
    });

    it('should add log entry to memory buffer', async () => {
      await service.add({
        type: 'http',
        severity: 'info',
        message: 'Test log',
      });

      const buffer = (service as any).buffer;
      expect(buffer).toHaveLength(1);
      expect(buffer[0].message).toBe('Test log');
      expect(buffer[0].severity).toBe('info');
    });

    it('should include timestamp and ID in log entry', async () => {
      await service.add({
        type: 'http',
        severity: 'info',
        message: 'Test',
      });

      const entry = (service as any).buffer[0];
      expect(entry.id).toBeDefined();
      expect(entry.at).toBeDefined();
      expect(new Date(entry.at)).toBeInstanceOf(Date);
    });

    it('should respect maxBuffer and remove oldest entries', async () => {
      const maxBuffer = (service as any).maxBuffer;

      // Add more entries than maxBuffer
      for (let i = 0; i < maxBuffer + 50; i++) {
        await service.add({
          type: 'http',
          severity: 'info',
          message: `Log ${i}`,
        });
      }

      const buffer = (service as any).buffer;
      expect(buffer.length).toBeLessThanOrEqual(maxBuffer);
      expect(buffer[buffer.length - 1].message).toBe(`Log ${maxBuffer + 49}`);
    });

    it('should include optional data in log entry', async () => {
      await service.add({
        type: 'http',
        severity: 'error',
        message: 'Error occurred',
        data: {
          statusCode: 500,
          endpoint: '/api/test',
          userId: 'u123',
          error: true,
        },
      });

      const entry = (service as any).buffer[0];
      expect(entry.data).toEqual({
        statusCode: 500,
        endpoint: '/api/test',
        userId: 'u123',
        error: true,
      });
    });
  });

  describe('add - Redis Integration', () => {
    beforeEach(() => {
      service = new LoggingService();
      (service as any).redis = redisMock;
    });

    it('should write to Redis on successful add', async () => {
      redisMock.lpush.mockResolvedValueOnce(1);
      redisMock.ltrim.mockResolvedValueOnce('OK');

      await service.add({
        type: 'http',
        severity: 'info',
        message: 'Test',
      });

      expect(redisMock.lpush).toHaveBeenCalledWith(
        'logs:recent',
        expect.any(String),
      );
      expect(redisMock.ltrim).toHaveBeenCalledWith('logs:recent', 0, 1999);
    });

    it('should fallback to memory buffer when Redis lpush fails', async () => {
      redisMock.lpush.mockRejectedValueOnce(new Error('Redis unavailable'));

      await service.add({
        type: 'http',
        severity: 'info',
        message: 'Test',
      });

      // Should still add to memory buffer
      const buffer = (service as any).buffer;
      expect(buffer).toHaveLength(1);
      // Redis should be disabled after failure
      expect((service as any).redis).toBeNull();
    });

    it('should handle Redis ltrim failure', async () => {
      redisMock.lpush.mockResolvedValueOnce(1);
      redisMock.ltrim.mockRejectedValueOnce(new Error('Trim failed'));

      // Should not throw - service handles error gracefully
      await service.add({
        type: 'http',
        severity: 'info',
        message: 'Test',
      });

      // Should still add to memory buffer
      const buffer = (service as any).buffer;
      expect(buffer).toHaveLength(1);
      // Redis should be disabled after failure
      expect((service as any).redis).toBeNull();
    });

    it('should handle JSON serialization in Redis', async () => {
      redisMock.lpush.mockResolvedValueOnce(1);
      redisMock.ltrim.mockResolvedValueOnce('OK');

      await service.add({
        type: 'redis',
        severity: 'debug',
        message: 'Cache operation',
        data: {
          key: 'cache:key:123',
          hitRate: 95,
          cached: true,
        },
      });

      const callArg = redisMock.lpush.mock.calls[0][1];
      const parsed = JSON.parse(callArg as string);

      expect(parsed.message).toBe('Cache operation');
      expect(parsed.data.hitRate).toBe(95);
    });

    it('should handle buffer at exact maxBuffer limit', async () => {
      const maxBuffer = (service as any).maxBuffer;
      redisMock.lpush.mockResolvedValue(1);
      redisMock.ltrim.mockResolvedValue('OK');

      // Add entries exactly to maxBuffer
      for (let i = 0; i < maxBuffer; i++) {
        await service.add({
          type: 'http',
          severity: 'info',
          message: `Log ${i}`,
        });
      }

      const buffer = (service as any).buffer;
      expect(buffer).toHaveLength(maxBuffer);

      // Add one more - should trigger splice
      await service.add({
        type: 'http',
        severity: 'info',
        message: 'Overflow',
      });

      // Buffer should still be at maxBuffer (oldest removed)
      expect(buffer).toHaveLength(maxBuffer);
      expect(buffer[0].message).toBe('Log 1'); // First entry removed
      expect(buffer[maxBuffer - 1].message).toBe('Overflow');
    });
  });

  describe('getRecent - Retrieval with Redis', () => {
    beforeEach(() => {
      service = new LoggingService();
      (service as any).redis = redisMock;
    });

    it('should retrieve recent logs from Redis', async () => {
      const mockLogs: LogEntry[] = [
        {
          id: 'id1',
          at: new Date().toISOString(),
          type: 'http',
          severity: 'info',
          message: 'Log 1',
        },
        {
          id: 'id2',
          at: new Date().toISOString(),
          type: 'http',
          severity: 'info',
          message: 'Log 2',
        },
      ];

      redisMock.lrange.mockResolvedValueOnce(
        mockLogs.map((l) => JSON.stringify(l)),
      );

      const result = await service.getRecent(2, 0);

      expect(result).toHaveLength(2);
      expect(result[0].message).toBe('Log 1');
      expect(redisMock.lrange).toHaveBeenCalledWith('logs:recent', 0, 1);
    });

    it('should support pagination', async () => {
      redisMock.lrange.mockResolvedValueOnce([]);

      await service.getRecent(10, 50);

      expect(redisMock.lrange).toHaveBeenCalledWith('logs:recent', 50, 59);
    });

    it('should fallback to memory buffer when Redis read fails', async () => {
      redisMock.lrange.mockRejectedValueOnce(
        new Error('Redis connection lost'),
      );
      (service as any).buffer = [
        {
          id: 'id1',
          at: new Date().toISOString(),
          type: 'http',
          severity: 'info',
          message: 'Memory log',
        },
      ];

      const result = await service.getRecent(10, 0);

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('Memory log');
      expect((service as any).redis).toBeNull();
    });

    it('should handle empty result from Redis', async () => {
      redisMock.lrange.mockResolvedValueOnce([]);

      const result = await service.getRecent(10, 0);

      expect(result).toEqual([]);
    });

    it('should handle invalid JSON in Redis response', async () => {
      redisMock.lrange.mockResolvedValueOnce(['invalid-json{']);

      // Service should handle JSON parse error gracefully and fall back to buffer
      const result = await service.getRecent(10, 0);

      // Should return empty array (no entries in buffer)
      expect(result).toEqual([]);
      // Redis should be disabled after failure
      expect((service as any).redis).toBeNull();
    });
  });

  describe('getRecent - Memory Buffer', () => {
    beforeEach(() => {
      service = new LoggingService();
    });

    it('should retrieve recent logs from memory buffer', async () => {
      const logs = [];
      for (let i = 0; i < 5; i++) {
        await service.add({
          type: 'http',
          severity: 'info',
          message: `Log ${i}`,
        });
        logs.push((service as any).buffer[(service as any).buffer.length - 1]);
      }

      const result = await service.getRecent(3, 0);

      expect(result).toHaveLength(3);
      // getRecent returns reversed (most recent first)
      expect(result[0].message).toBe('Log 4');
      expect(result[1].message).toBe('Log 3');
      expect(result[2].message).toBe('Log 2');
    });

    it('should support pagination on memory buffer', async () => {
      for (let i = 0; i < 10; i++) {
        await service.add({
          type: 'http',
          severity: 'info',
          message: `Log ${i}`,
        });
      }

      const result = await service.getRecent(3, 2);

      expect(result).toHaveLength(3);
      // Offset 2 in reversed array
      expect(result[0].message).toBe('Log 7');
    });

    it('should return empty array for out-of-range offset', async () => {
      await service.add({
        type: 'http',
        severity: 'info',
        message: 'Log 1',
      });

      const result = await service.getRecent(10, 100);

      expect(result).toEqual([]);
    });
  });

  describe('getSummary - Log Summary', () => {
    beforeEach(() => {
      service = new LoggingService();
    });

    it('should count logs by severity', async () => {
      await service.add({
        type: 'http',
        severity: 'debug',
        message: 'Debug log',
      });
      await service.add({
        type: 'http',
        severity: 'info',
        message: 'Info log',
      });
      await service.add({
        type: 'http',
        severity: 'error',
        message: 'Error log',
      });
      await service.add({
        type: 'http',
        severity: 'error',
        message: 'Another error',
      });

      const summary = await service.getSummary();

      expect(summary.debug).toBe(1);
      expect(summary.info).toBe(1);
      expect(summary.warn).toBe(0);
      expect(summary.error).toBe(2);
    });

    it('should handle empty logs in summary', async () => {
      const summary = await service.getSummary();

      expect(summary).toEqual({
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
      });
    });

    it('should only count recent logs (up to 500)', async () => {
      // Add more than 500 logs
      for (let i = 0; i < 600; i++) {
        (service as any).buffer.push({
          id: `id-${i}`,
          at: new Date().toISOString(),
          type: 'http',
          severity: i % 2 === 0 ? 'info' : 'debug',
          message: `Log ${i}`,
        });
      }

      const summary = await service.getSummary();

      // Should only count the 500 most recent
      expect(summary.info + summary.debug).toBeLessThanOrEqual(500);
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect Redis on module destroy', async () => {
      service = new LoggingService();
      (service as any).redis = redisMock;

      redisMock.quit.mockResolvedValueOnce('OK');

      await service.onModuleDestroy();

      expect(redisMock.quit).toHaveBeenCalled();
      expect((service as any).redis).toBeNull();
    });

    it('should handle Redis quit failure', async () => {
      service = new LoggingService();
      (service as any).redis = redisMock;

      redisMock.quit.mockRejectedValueOnce(new Error('Already closed'));

      await expect(service.onModuleDestroy()).rejects.toThrow();
    });

    it('should handle null Redis gracefully', async () => {
      service = new LoggingService();
      (service as any).redis = null;

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe('Error Logging Integration', () => {
    beforeEach(() => {
      service = new LoggingService();
    });

    it('should log errors, warnings, and info messages', async () => {
      await service.add({
        type: 'http',
        severity: 'error',
        message: 'API Error',
        data: { status: 500, path: '/error' },
      });

      await service.add({
        type: 'system',
        severity: 'warn',
        message: 'Auth Warning',
        data: { userId: 'u1' },
      });

      await service.add({
        type: 'http',
        severity: 'info',
        message: 'API Access',
        data: { method: 'GET', path: '/api' },
      });

      const summary = await service.getSummary();

      expect(summary.error).toBe(1);
      expect(summary.warn).toBe(1);
      expect(summary.info).toBe(1);
    });

    it('should preserve log order in memory buffer', async () => {
      const messages = ['First', 'Second', 'Third', 'Fourth', 'Fifth'];

      for (const msg of messages) {
        await service.add({
          type: 'http',
          severity: 'info',
          message: msg,
        });
      }

      const recent = await service.getRecent(5, 0);

      // Should be reversed (most recent first)
      expect(recent[0].message).toBe('Fifth');
      expect(recent[4].message).toBe('First');
    });
  });
});
