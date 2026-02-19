import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { CacheService } from './cache.service';

jest.mock('ioredis');

describe('CacheService - Error Scenarios (Branch Coverage)', () => {
  let service: CacheService;
  let configService: jest.Mocked<ConfigService>;
  let mockRedisClient: jest.Mocked<Partial<Redis>>;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {
      // No-op for testing
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
      // No-op for testing
    });
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {
      // No-op for testing
    });

    mockRedisClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(
      () => mockRedisClient as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Redis Connection Failures', () => {
    it('should disable Redis and use memory cache when connection fails', async () => {
      configService = {
        get: jest.fn((key, defaultVal) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'true';
          if (key === 'REDIS_HOST') return 'invalid-host';
          if (key === 'REDIS_PORT') return 6379;
          if (key === 'REDIS_CONNECT_TIMEOUT_MS') return 100;
          // Return defaults for TLS/Auth config
          if (key === 'REDIS_TLS_ENABLED') return defaultVal || 'false';
          if (key === 'REDIS_TLS_REJECT_UNAUTHORIZED')
            return defaultVal || 'true';
          if (key === 'REDIS_PASSWORD') return undefined;
          return defaultVal;
        }),
      } as any;

      (mockRedisClient.connect as jest.Mock).mockRejectedValueOnce(
        new Error('Connection refused'),
      );

      service = new CacheService(configService);
      await service.onModuleInit();

      // Should fallback to memory cache
      await service.set('test-key', { data: 'value' }, 3600);
      const result = await service.get('test-key');

      expect(result).toEqual({ data: 'value' });
    });

    it('should handle Redis ping timeout gracefully', async () => {
      configService = {
        get: jest.fn((key, defaultVal) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'true';
          if (key === 'REDIS_HOST') return 'localhost';
          if (key === 'REDIS_PORT') return 6379;
          if (key === 'REDIS_TLS_ENABLED') return defaultVal || 'false';
          if (key === 'REDIS_TLS_REJECT_UNAUTHORIZED')
            return defaultVal || 'true';
          if (key === 'REDIS_PASSWORD') return undefined;
          return defaultVal;
        }),
      } as any;

      (mockRedisClient.ping as jest.Mock).mockRejectedValueOnce(
        new Error('PONG timeout'),
      );

      service = new CacheService(configService);
      await service.onModuleInit();

      // Should fallback to memory cache after ping fails
      await service.set('key1', 'value1');
      const result = await service.get('key1');
      expect(result).toBe('value1');
    });

    it('should fall back to memory cache when Redis is disabled', async () => {
      configService = {
        get: jest.fn((key, defaultVal) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'false';
          return defaultVal;
        }),
      } as any;

      service = new CacheService(configService);
      await service.onModuleInit();

      // Memory cache should work
      await service.set('fallback-key', { test: 'data' }, 3600);
      const result = await service.get('fallback-key');

      expect(result).toEqual({ test: 'data' });
    });

    it('should recover from Redis error and use memory cache', async () => {
      configService = {
        get: jest.fn((key, defaultVal) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'true';
          if (key === 'REDIS_HOST') return 'localhost';
          if (key === 'REDIS_TLS_ENABLED') return defaultVal || 'false';
          if (key === 'REDIS_TLS_REJECT_UNAUTHORIZED')
            return defaultVal || 'true';
          if (key === 'REDIS_PASSWORD') return undefined;
          return defaultVal;
        }),
      } as any;

      (mockRedisClient.get as jest.Mock).mockRejectedValue(
        new Error('Connection lost'),
      );

      service = new CacheService(configService);
      await service.onModuleInit();
      await service.set('key', 'value', 60);

      // Redis.get will fail, but memory cache should work
      const result = await service.get('key');
      expect(result).toBe('value');
    });
  });

  describe('JSON Parsing Errors', () => {
    it('should handle malformed JSON from Redis gracefully', async () => {
      configService = {
        get: jest.fn((key, defaultVal) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'true';
          if (key === 'REDIS_HOST') return 'localhost';
          if (key === 'REDIS_PORT') return 6379;
          if (key === 'REDIS_TLS_ENABLED') return defaultVal || 'false';
          if (key === 'REDIS_TLS_REJECT_UNAUTHORIZED')
            return defaultVal || 'true';
          if (key === 'REDIS_PASSWORD') return undefined;
          return defaultVal;
        }),
      } as any;

      (mockRedisClient.get as jest.Mock).mockResolvedValue('{invalid json}');

      service = new CacheService(configService);
      await service.onModuleInit();

      // Should catch JSON.parse error and return null
      const result = await service.get('bad-key');
      expect(result).toBeNull();
    });

    it('should handle null values from Redis correctly', async () => {
      configService = {
        get: jest.fn((key, defaultVal) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'true';
          if (key === 'REDIS_HOST') return 'localhost';
          if (key === 'REDIS_TLS_ENABLED') return defaultVal || 'false';
          if (key === 'REDIS_TLS_REJECT_UNAUTHORIZED')
            return defaultVal || 'true';
          if (key === 'REDIS_PASSWORD') return undefined;
          return defaultVal;
        }),
      } as any;

      (mockRedisClient.get as jest.Mock).mockResolvedValue(null);

      service = new CacheService(configService);
      await service.onModuleInit();

      const result = await service.get('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('TTL Expiration', () => {
    it('should remove expired entries from memory cache', async () => {
      configService = {
        get: jest.fn((key) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'false';
          return undefined;
        }),
      } as any;

      service = new CacheService(configService);
      await service.onModuleInit();

      // Set with very short TTL (1ms)
      await service.set('short-lived', { data: 'value' }, 0.001);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should return null after expiration
      const result = await service.get('short-lived');
      expect(result).toBeNull();
    });

    it('should handle large TTL values correctly', async () => {
      configService = {
        get: jest.fn((key) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'false';
          return undefined;
        }),
      } as any;

      service = new CacheService(configService);
      await service.onModuleInit();

      // Set with large TTL (1 year)
      await service.set('long-lived', { data: 'stays' }, 365 * 24 * 3600);
      const result = await service.get('long-lived');

      expect(result).toEqual({ data: 'stays' });
    });

    it('should use default TTL when not specified', async () => {
      configService = {
        get: jest.fn((key) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'false';
          return undefined;
        }),
      } as any;

      service = new CacheService(configService);
      await service.onModuleInit();

      // Set without TTL (should default to 3600s)
      await service.set('default-ttl', 'value');
      const result = await service.get('default-ttl');

      expect(result).toBe('value');
    });
  });

  describe('Redis Configuration Edge Cases', () => {
    it('should handle Redis with TLS enabled', async () => {
      configService = {
        get: jest.fn((key, defaultVal) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'true';
          if (key === 'REDIS_HOST') return 'secure.redis.local';
          if (key === 'REDIS_PORT') return 6380;
          if (key === 'REDIS_TLS_ENABLED') return 'true';
          if (key === 'REDIS_TLS_REJECT_UNAUTHORIZED') return 'true';
          if (key === 'REDIS_PASSWORD') return undefined;
          return defaultVal;
        }),
      } as any;

      (mockRedisClient.get as jest.Mock).mockResolvedValue('"cached"');

      service = new CacheService(configService);
      await service.onModuleInit();

      const result = await service.get('tls-key');
      expect(result).toBe('cached');
    });

    it('should handle Redis with custom password', async () => {
      configService = {
        get: jest.fn((key, defaultVal) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'true';
          if (key === 'REDIS_HOST') return 'localhost';
          if (key === 'REDIS_PASSWORD') return '  secret123  '; // With spaces
          if (key === 'REDIS_TLS_ENABLED') return defaultVal || 'false';
          if (key === 'REDIS_TLS_REJECT_UNAUTHORIZED')
            return defaultVal || 'true';
          return defaultVal;
        }),
      } as any;

      service = new CacheService(configService);
      await service.onModuleInit();
      expect(service).toBeDefined();
    });

    it('should handle missing password configuration', async () => {
      configService = {
        get: jest.fn((key, defaultVal) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'true';
          if (key === 'REDIS_HOST') return 'localhost';
          if (key === 'REDIS_PASSWORD') return undefined;
          if (key === 'REDIS_TLS_ENABLED') return defaultVal || 'false';
          if (key === 'REDIS_TLS_REJECT_UNAUTHORIZED')
            return defaultVal || 'true';
          return defaultVal;
        }),
      } as any;

      service = new CacheService(configService);
      await service.onModuleInit();
      expect(service).toBeDefined();
    });
  });

  describe('Memory Cache Edge Cases', () => {
    it('should handle complex nested objects', async () => {
      configService = {
        get: jest.fn((key) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'false';
          return undefined;
        }),
      } as any;

      service = new CacheService(configService);
      await service.onModuleInit();

      const complexObj = {
        users: [
          { id: 1, name: 'Alice', roles: ['admin', 'user'] },
          { id: 2, name: 'Bob', roles: ['user'] },
        ],
        metadata: {
          created: new Date().toISOString(),
          version: '1.0.0',
        },
      };

      await service.set('complex', complexObj, 3600);
      const result = await service.get('complex');

      expect(result).toEqual(complexObj);
    });

    it('should handle large objects without truncation', async () => {
      configService = {
        get: jest.fn((key) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'false';
          return undefined;
        }),
      } as any;

      service = new CacheService(configService);
      await service.onModuleInit();

      // Create 1MB object
      const largeArray = new Array(100000).fill({ data: 'test' });
      const largeObj = { items: largeArray };

      await service.set('large', largeObj, 3600);
      const result = await service.get('large');

      expect((result as any).items).toHaveLength(100000);
    });

    it('should handle boolean and numeric values', async () => {
      configService = {
        get: jest.fn((key) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'false';
          return undefined;
        }),
      } as any;

      service = new CacheService(configService);
      await service.onModuleInit();

      await service.set('bool', true, 3600);
      await service.set('num', 42, 3600);
      await service.set('zero', 0, 3600);

      expect(await service.get('bool')).toBe(true);
      expect(await service.get('num')).toBe(42);
      expect(await service.get('zero')).toBe(0);
    });
  });

  describe('Module Lifecycle', () => {
    it('should handle onModuleDestroy when Redis is enabled', async () => {
      configService = {
        get: jest.fn((key, defaultVal) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'true';
          if (key === 'REDIS_HOST') return 'localhost';
          if (key === 'REDIS_TLS_ENABLED') return defaultVal || 'false';
          if (key === 'REDIS_TLS_REJECT_UNAUTHORIZED')
            return defaultVal || 'true';
          if (key === 'REDIS_PASSWORD') return undefined;
          return defaultVal;
        }),
      } as any;

      service = new CacheService(configService);
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('should handle onModuleDestroy when Redis is disabled', async () => {
      configService = {
        get: jest.fn((key, defaultVal) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'false';
          return defaultVal;
        }),
      } as any;

      service = new CacheService(configService);
      await service.onModuleInit();
      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe('del Operation Edge Cases', () => {
    it('should handle Redis delete operation failure', async () => {
      configService = {
        get: jest.fn((key, defaultVal) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'true';
          if (key === 'REDIS_HOST') return 'localhost';
          if (key === 'REDIS_TLS_ENABLED') return defaultVal || 'false';
          if (key === 'REDIS_TLS_REJECT_UNAUTHORIZED')
            return defaultVal || 'true';
          if (key === 'REDIS_PASSWORD') return undefined;
          return defaultVal;
        }),
      } as any;

      (mockRedisClient.del as jest.Mock).mockRejectedValue(
        new Error('Delete failed'),
      );

      service = new CacheService(configService);
      await service.onModuleInit();

      // Should not throw, just log error
      await expect(service.del('key')).resolves.toBeUndefined();
    });

    it('should delete from memory cache', async () => {
      configService = {
        get: jest.fn((key, defaultVal) => {
          if (key === 'REDIS_CACHE_ENABLED') return 'false';
          return defaultVal;
        }),
      } as any;

      service = new CacheService(configService);
      await service.onModuleInit();

      await service.set('to-delete', 'value', 3600);
      expect(await service.get('to-delete')).toBe('value');

      await service.del('to-delete');
      expect(await service.get('to-delete')).toBeNull();
    });
  });
});
