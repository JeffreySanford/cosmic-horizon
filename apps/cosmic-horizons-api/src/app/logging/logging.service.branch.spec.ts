import { LoggingService } from './logging.service';
import { LogSeverity } from './log-entry';
import Redis from 'ioredis';

jest.mock('ioredis');

describe('LoggingService - Branch Coverage', () => {
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      lpush: jest.fn(),
      ltrim: jest.fn(),
      lrange: jest.fn(),
      quit: jest.fn(),
    };
    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(
      () => mockRedisClient,
    );
  });

  describe('Constructor - Redis disabled', () => {
    it('should not initialize Redis when LOGS_REDIS_ENABLED is false', () => {
      process.env['LOGS_REDIS_ENABLED'] = 'false';
      const svc = new LoggingService();
      expect(svc['redis']).toBeNull();
    });

    it('should not initialize Redis when LOGS_REDIS_ENABLED is undefined', () => {
      delete process.env['LOGS_REDIS_ENABLED'];
      const svc = new LoggingService();
      expect(svc['redis']).toBeNull();
    });

    it('should handle Redis constructor throw by catching error', () => {
      process.env['LOGS_REDIS_ENABLED'] = 'true';
      process.env['REDIS_HOST'] = 'invalid-host';
      (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => {
        throw new Error('Redis connection failed');
      });
      const svc = new LoggingService();
      expect(svc['redis']).toBeNull();
    });
  });

  describe('Constructor - Redis enabled', () => {
    beforeEach(() => {
      process.env['LOGS_REDIS_ENABLED'] = 'true';
      process.env['REDIS_HOST'] = 'localhost';
      process.env['REDIS_PORT'] = '6379';
      delete process.env['REDIS_PASSWORD'];
    });

    it('should initialize Redis when LOGS_REDIS_ENABLED is true', () => {
      const svc = new LoggingService();
      expect(svc['redis']).toBeDefined();
      expect(Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: undefined,
      });
    });

    it('should use REDIS_HOST environment variable', () => {
      process.env['REDIS_HOST'] = 'redis-staging';
      new LoggingService();
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'redis-staging',
        }),
      );
    });

    it('should use REDIS_PORT environment variable', () => {
      process.env['REDIS_PORT'] = '6380';
      new LoggingService();
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 6380,
        }),
      );
    });

    it('should use REDIS_PASSWORD environment variable when set', () => {
      process.env['REDIS_PASSWORD'] = 'secret-password';
      new LoggingService();
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'secret-password',
        }),
      );
    });

    it('should default to 127.0.0.1 when REDIS_HOST not set', () => {
      delete process.env['REDIS_HOST'];
      new LoggingService();
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: '127.0.0.1',
        }),
      );
    });

    it('should default to 6379 when REDIS_PORT not set', () => {
      delete process.env['REDIS_PORT'];
      new LoggingService();
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 6379,
        }),
      );
    });
  });

  describe('add - Redis enabled', () => {
    beforeEach(() => {
      process.env['LOGS_REDIS_ENABLED'] = 'true';
      mockRedisClient.lpush.mockResolvedValue(1);
      mockRedisClient.ltrim.mockResolvedValue('OK');
    });

    it('should add log to buffer and push to Redis', async () => {
      const svc = new LoggingService();
      const entry = {
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Test log',
      };

      await svc.add(entry);

      expect(mockRedisClient.lpush).toHaveBeenCalled();
      expect(mockRedisClient.ltrim).toHaveBeenCalled();
      expect(svc['buffer'].length).toBe(1);
    });

    it('should trim Redis list to redisTrim size', async () => {
      const svc = new LoggingService();
      const entry = {
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Test',
      };

      await svc.add(entry);

      expect(mockRedisClient.ltrim).toHaveBeenCalledWith(
        'logs:recent',
        0,
        1999,
      );
    });

    it('should handle Redis lpush failure and disable Redis', async () => {
      const svc = new LoggingService();
      mockRedisClient.lpush.mockRejectedValueOnce(
        new Error('Redis unavailable'),
      );

      const entry = {
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Test',
      };
      await svc.add(entry);

      // After error, Redis should be disabled
      expect(svc['redis']).toBeNull();
      expect(svc['buffer'].length).toBe(1);
    });

    it('should handle Redis ltrim failure and disable Redis', async () => {
      const svc = new LoggingService();
      mockRedisClient.lpush.mockResolvedValue(1);
      mockRedisClient.ltrim.mockRejectedValueOnce(new Error('ltrim failed'));

      const entry = {
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Test',
      };
      await svc.add(entry);

      expect(svc['redis']).toBeNull();
    });

    it('should not handle Redis error with undefined message', async () => {
      const svc = new LoggingService();
      mockRedisClient.lpush.mockRejectedValueOnce({});

      const entry = {
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Test',
      };
      await svc.add(entry);

      expect(svc['redis']).toBeNull();
    });
  });

  describe('add - Redis disabled', () => {
    beforeEach(() => {
      process.env['LOGS_REDIS_ENABLED'] = 'false';
    });

    it('should only add to buffer when Redis disabled', async () => {
      const svc = new LoggingService();
      const entry = {
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Test',
      };

      await svc.add(entry);

      expect(svc['buffer'].length).toBe(1);
      expect(mockRedisClient.lpush).not.toHaveBeenCalled();
    });

    it('should trim buffer when it exceeds maxBuffer', async () => {
      const svc = new LoggingService();
      Object.defineProperty(svc, 'maxBuffer', { value: 5, configurable: true });

      for (let i = 0; i < 8; i++) {
        await svc.add({
          type: 'http' as const,
          severity: 'info' as LogSeverity,
          message: `Log ${i}`,
        });
      }

      expect(svc['buffer'].length).toBe(5);
    });

    it('should maintain exact buffer size after trim', async () => {
      const svc = new LoggingService();
      Object.defineProperty(svc, 'maxBuffer', { value: 3, configurable: true });

      await svc.add({
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Log 1',
      });
      await svc.add({
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Log 2',
      });
      await svc.add({
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Log 3',
      });
      await svc.add({
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Log 4',
      });

      expect(svc['buffer'].length).toBe(3);
      expect(svc['buffer'][0].message).toBe('Log 2');
      expect(svc['buffer'][2].message).toBe('Log 4');
    });
  });

  describe('getRecent - Redis enabled', () => {
    beforeEach(() => {
      process.env['LOGS_REDIS_ENABLED'] = 'true';
    });

    it('should fetch logs from Redis when available', async () => {
      const svc = new LoggingService();
      const mockLog = {
        id: 'uuid-1',
        at: '2026-02-12T12:00:00Z',
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Test',
      };

      mockRedisClient.lrange.mockResolvedValueOnce([JSON.stringify(mockLog)]);

      const result = await svc.getRecent(10, 0);

      expect(mockRedisClient.lrange).toHaveBeenCalledWith('logs:recent', 0, 9);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('uuid-1');
    });

    it('should calculate Redis lrange correctly with offset', async () => {
      const svc = new LoggingService();
      mockRedisClient.lrange.mockResolvedValueOnce([]);

      await svc.getRecent(50, 100);

      expect(mockRedisClient.lrange).toHaveBeenCalledWith(
        'logs:recent',
        100,
        149,
      );
    });

    it('should disable Redis on lrange failure and return buffer', async () => {
      const svc = new LoggingService();
      mockRedisClient.lrange.mockRejectedValueOnce(new Error('Redis down'));

      await svc.add({
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Buffer log',
      });

      const result = await svc.getRecent(10, 0);

      expect(svc['redis']).toBeNull();
      expect(result).toHaveLength(1);
    });

    it('should handle JSON parse error on Redis response', async () => {
      const svc = new LoggingService();
      mockRedisClient.lrange.mockResolvedValueOnce(['invalid-json{']);

      try {
        await svc.getRecent(10, 0);
      } catch (err) {
        expect(err).toBeInstanceOf(SyntaxError);
      }
    });
  });

  describe('getRecent - Redis disabled', () => {
    beforeEach(() => {
      process.env['LOGS_REDIS_ENABLED'] = 'false';
    });

    it('should return buffer logs in reverse order', async () => {
      const svc = new LoggingService();

      await svc.add({
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Log 1',
      });
      await svc.add({
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Log 2',
      });
      await svc.add({
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Log 3',
      });

      const result = await svc.getRecent(10, 0);

      expect(result).toHaveLength(3);
      expect(result[0].message).toBe('Log 3');
      expect(result[2].message).toBe('Log 1');
    });

    it('should apply offset to buffer', async () => {
      const svc = new LoggingService();

      for (let i = 1; i <= 5; i++) {
        await svc.add({
          type: 'http' as const,
          severity: 'info' as LogSeverity,
          message: `Log ${i}`,
        });
      }

      const result = await svc.getRecent(2, 1);

      expect(result).toHaveLength(2);
      expect(result[0].message).toBe('Log 4');
      expect(result[1].message).toBe('Log 3');
    });

    it('should respect limit parameter', async () => {
      const svc = new LoggingService();

      for (let i = 1; i <= 10; i++) {
        await svc.add({
          type: 'http' as const,
          severity: 'info' as LogSeverity,
          message: `Log ${i}`,
        });
      }

      const result = await svc.getRecent(3, 0);

      expect(result).toHaveLength(3);
    });

    it('should return empty array when offset exceeds buffer size', async () => {
      const svc = new LoggingService();

      await svc.add({
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Log 1',
      });

      const result = await svc.getRecent(10, 100);

      expect(result).toHaveLength(0);
    });
  });

  describe('getSummary', () => {
    beforeEach(() => {
      process.env['LOGS_REDIS_ENABLED'] = 'false';
    });

    it('should count logs by severity', async () => {
      const svc = new LoggingService();

      await svc.add({
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Info 1',
      });
      await svc.add({
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Info 2',
      });
      await svc.add({
        type: 'http' as const,
        severity: 'warn' as LogSeverity,
        message: 'Warn 1',
      });
      await svc.add({
        type: 'http' as const,
        severity: 'error' as LogSeverity,
        message: 'Error 1',
      });
      await svc.add({
        type: 'http' as const,
        severity: 'debug' as LogSeverity,
        message: 'Debug 1',
      });

      const summary = await svc.getSummary();

      expect(summary).toEqual({
        debug: 1,
        info: 2,
        warn: 1,
        error: 1,
      });
    });

    it('should initialize all severity keys to 0', async () => {
      const svc = new LoggingService();

      const summary = await svc.getSummary();

      expect(summary).toHaveProperty('debug');
      expect(summary).toHaveProperty('info');
      expect(summary).toHaveProperty('warn');
      expect(summary).toHaveProperty('error');
      expect(Object.values(summary).every((v) => v === 0)).toBe(true);
    });

    it('should handle empty buffer', async () => {
      const svc = new LoggingService();

      const summary = await svc.getSummary();

      expect(summary.debug).toBe(0);
      expect(summary.info).toBe(0);
    });

    it('should count severities correctly with large dataset', async () => {
      const svc = new LoggingService();

      for (let i = 0; i < 100; i++) {
        const severity = (['info', 'warn', 'error', 'debug'] as LogSeverity[])[
          i % 4
        ];
        await svc.add({ type: 'http' as const, severity, message: `Log ${i}` });
      }

      const summary = await svc.getSummary();

      expect(summary.info).toBe(25);
      expect(summary.warn).toBe(25);
      expect(summary.error).toBe(25);
      expect(summary.debug).toBe(25);
    });

    it('should increment correct severity when key type is undefined', async () => {
      const svc = new LoggingService();

      // Add logs with different severities
      await svc.add({
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Log',
      });

      // Manually add a log with unknown severity to test edge case
      svc['buffer'].push({
        id: 'uuid',
        at: '2026-02-12T12:00:00Z',
        type: 'http' as const,
        severity: 'unknown' as LogSeverity,
        message: 'Unknown',
      });

      const summary = await svc.getSummary();

      expect(summary['unknown']).toBe(1);
    });
  });

  describe('onModuleDestroy', () => {
    beforeEach(() => {
      process.env['LOGS_REDIS_ENABLED'] = 'true';
    });

    it('should quit Redis and set to null', async () => {
      const svc = new LoggingService();
      mockRedisClient.quit.mockResolvedValueOnce('OK');

      await svc.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalled();
      expect(svc['redis']).toBeNull();
    });

    it('should handle quit error gracefully', async () => {
      const svc = new LoggingService();
      mockRedisClient.quit.mockRejectedValueOnce(new Error('Quit failed'));

      await expect(svc.onModuleDestroy()).rejects.toThrow();
    });

    it('should handle null Redis gracefully', async () => {
      const svc = new LoggingService();
      svc['redis'] = null;

      await expect(svc.onModuleDestroy()).resolves.toBeUndefined();
      expect(mockRedisClient.quit).not.toHaveBeenCalled();
    });
  });

  describe('LogEntry creation', () => {
    beforeEach(() => {
      process.env['LOGS_REDIS_ENABLED'] = 'false';
    });

    it('should create log entry with UUID and timestamp', async () => {
      const svc = new LoggingService();
      const before = new Date();

      await svc.add({
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'Test',
        data: { userId: 123 },
      });

      const after = new Date();
      const entry = svc['buffer'][0];

      expect(entry.id).toBeDefined();
      expect(entry.at).toBeDefined();
      expect(new Date(entry.at).getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(new Date(entry.at).getTime()).toBeLessThanOrEqual(after.getTime());
      expect(entry.type).toBe('http');
      expect(entry.severity).toBe('info');
      expect(entry.message).toBe('Test');
      expect(entry.data).toEqual({ userId: 123 });
    });

    it('should handle undefined data', async () => {
      const svc = new LoggingService();

      await svc.add({
        type: 'http' as const,
        severity: 'info' as LogSeverity,
        message: 'No data',
      });

      const entry = svc['buffer'][0];

      expect(entry.data).toBeUndefined();
    });
  });
});
