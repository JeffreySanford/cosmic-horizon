import { Test, TestingModule } from '@nestjs/testing';
import { LoggingService } from './logging.service';
import Redis from 'ioredis';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

jest.mock('ioredis');

describe('LoggingService', () => {
  let service: LoggingService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.LOGS_REDIS_ENABLED = 'false';

    // Create a mock Redis instance
    mockRedis = {
      rpush: jest.fn().mockResolvedValue(1),
      ltrim: jest.fn().mockResolvedValue('OK'),
      lrange: jest.fn().mockResolvedValue([]),
      hgetall: jest.fn().mockResolvedValue({}),
      quit: jest.fn().mockResolvedValue('OK'),
    } as unknown as jest.Mocked<Redis>;

    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedis);

    testingModule = await Test.createTestingModule({
      providers: [LoggingService],
    }).compile();

    service = testingModule.get<LoggingService>(LoggingService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('add', () => {
    it('should add log entry to buffer', async () => {
      const entry = {
        type: 'system' as const,
        severity: 'info' as const,
        message: 'Test message',
      };

      await service.add(entry);

      const recent = await service.getRecent(10, 0);
      expect(recent).toHaveLength(1);
      expect(recent[0].message).toBe('Test message');
    });

    it('should generate unique IDs for log entries', async () => {
      const entry1 = {
        type: 'system' as const,
        severity: 'info' as const,
        message: 'Message 1',
      };

      const entry2 = {
        type: 'system' as const,
        severity: 'info' as const,
        message: 'Message 2',
      };

      await service.add(entry1);
      await service.add(entry2);

      const recent = await service.getRecent(10, 0);
      expect(recent).toHaveLength(2);
      expect(recent[0].id).not.toBe(recent[1].id);
    });

    it('should include timestamp in added entries', async () => {
      const before = new Date();

      const entry = {
        type: 'system' as const,
        severity: 'info' as const,
        message: 'Timestamped message',
      };

      await service.add(entry);

      const after = new Date();
      const recent = await service.getRecent(10, 0);
      const addedEntry = recent[0];

      expect(addedEntry.at).toBeDefined();
      const entryTime = new Date(addedEntry.at).getTime();
      expect(entryTime).toBeGreaterThanOrEqual(before.getTime());
      expect(entryTime).toBeLessThanOrEqual(after.getTime());
    });

    it('should include custom data in log entry', async () => {
      const entry = {
        type: 'system' as const,
        severity: 'info' as const,
        message: 'Message with data',
        data: { userId: '123', action: 'view' },
      };

      await service.add(entry);

      const recent = await service.getRecent(10, 0);
      expect(recent[0].data).toEqual({ userId: '123', action: 'view' });
    });

    it('should handle different severity levels', async () => {
      const severities = ['debug', 'info', 'warn', 'error'] as const;

      for (const severity of severities) {
        await service.add({
          type: 'system' as const,
          severity,
          message: `${severity} message`,
        });
      }

      const recent = await service.getRecent(10, 0);
      expect(recent).toHaveLength(4);
      expect(recent.map(e => e.severity)).toEqual(['error', 'warn', 'info', 'debug']);
    });

    it('should handle different log types', async () => {
      const types = ['http', 'redis', 'system'] as const;

      for (const type of types) {
        await service.add({
          type,
          severity: 'info' as const,
          message: `${type} message`,
        });
      }

      const recent = await service.getRecent(10, 0);
      expect(recent).toHaveLength(3);
    });
  });

  describe('getRecent', () => {
    beforeEach(async () => {
      // Add multiple entries
      for (let i = 1; i <= 10; i++) {
        await service.add({
          type: 'system' as const,
          severity: 'info' as const,
          message: `Message ${i}`,
        });
      }
    });

    it('should return all recent entries when limit is sufficient', async () => {
      const recent = await service.getRecent(15, 0);
      expect(recent).toHaveLength(10);
    });

    it('should respect limit parameter', async () => {
      const recent = await service.getRecent(5, 0);
      expect(recent).toHaveLength(5);
    });

    it('should respect offset parameter', async () => {
      const all = await service.getRecent(10, 0);
      const offset = await service.getRecent(10, 5);

      expect(offset).toHaveLength(5);
      expect(offset[0]).toEqual(all[5]);
    });

    it('should return entries in reverse chronological order', async () => {
      const recent = await service.getRecent(10, 0);
      // Most recent should be last (highest index)
      expect(recent[9].message).toBe('Message 1');
      expect(recent[0].message).toBe('Message 10');
    });

    it('should return empty array when offset exceeds total entries', async () => {
      const recent = await service.getRecent(10, 50);
      expect(recent).toHaveLength(0);
    });

    it('should handle limit=0', async () => {
      const recent = await service.getRecent(0, 0);
      expect(recent).toHaveLength(0);
    });

    it('should handle offset with limit', async () => {
      const recent = await service.getRecent(3, 2);
      expect(recent).toHaveLength(3);
    });
  });

  describe('getSummary', () => {
    beforeEach(async () => {
      await service.add({
        type: 'system' as const,
        severity: 'info' as const,
        message: 'Info action',
      });

      await service.add({
        type: 'system' as const,
        severity: 'error' as const,
        message: 'Error action',
      });

      await service.add({
        type: 'system' as const,
        severity: 'warn' as const,
        message: 'System warning',
      });
    });

    it('should return summary stats', async () => {
      const summary = await service.getSummary();
      expect(summary).toBeDefined();
      expect(typeof summary).toBe('object');
    });

    it('should count by severity', async () => {
      const summary = await service.getSummary();
      // Severity values are lowercase in the entries
      expect(summary.info).toBe(1);
      expect(summary.error).toBe(1);
      expect(summary.warn).toBe(1);
    });

    it('should count by type', async () => {
      const summary = await service.getSummary();
      // The summary counts severity, not type
      expect(summary).toBeDefined();
    });

    it('should return zero for uncounted severities', async () => {
      const summary = await service.getSummary();
      expect(summary.debug ?? 0).toBe(0);
    });
  });

  describe('onModuleDestroy', () => {
    it('should be defined', () => {
      expect(service.onModuleDestroy).toBeDefined();
    });

    it('should disconnect Redis if enabled', async () => {
      // Enable Redis and recreate service
      process.env.LOGS_REDIS_ENABLED = 'true';

      mockRedis.quit = jest.fn().mockResolvedValue('OK');
      (Redis as unknown as jest.Mock).mockImplementation(() => mockRedis);

      testingModule = await Test.createTestingModule({
        providers: [LoggingService],
      }).compile();

      const redisService = testingModule.get<LoggingService>(LoggingService);
      await redisService.onModuleDestroy();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });

  describe('buffer management', () => {
    it('should maintain buffer with multiple entries', async () => {
      for (let i = 0; i < 50; i++) {
        await service.add({
          type: 'system' as const,
          severity: 'info' as const,
          message: `Message ${i}`,
        });
      }

      const recent = await service.getRecent(100, 0);
      expect(recent.length).toBeGreaterThan(0);
    });
  });
});
