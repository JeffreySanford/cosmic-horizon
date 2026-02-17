import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import Redis from 'ioredis';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

jest.mock('ioredis');

describe('CacheService', () => {
  let service: CacheService;
  let configService: jest.Mocked<ConfigService>;
  let mockRedisClient: jest.Mocked<Redis>;

  beforeEach(async () => {
    jest.clearAllMocks();

    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    mockRedisClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      quit: jest.fn().mockResolvedValue('OK' as unknown as any),
      disconnect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Redis>;

    (Redis as unknown as jest.Mock).mockImplementation(() => mockRedisClient);

    testingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = testingModule.get<CacheService>(CacheService);

    // Default config: Redis disabled
    configService.get.mockImplementation(
      (key: string, defaultValue?: unknown) => {
        const config: Record<string, string | number> = {
          REDIS_CACHE_ENABLED: 'false',
          REDIS_HOST: '127.0.0.1',
          REDIS_PORT: 6379,
          REDIS_CONNECT_TIMEOUT_MS: 2000,
        };
        return config[key] ?? defaultValue;
      },
    );
  });

  describe('Memory Cache (When Redis Disabled)', () => {
    beforeEach(async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          const config: Record<string, string | number> = {
            REDIS_CACHE_ENABLED: 'false',
            REDIS_HOST: '127.0.0.1',
            REDIS_PORT: 6379,
            REDIS_CONNECT_TIMEOUT_MS: 2000,
          };
          return config[key] ?? defaultValue;
        },
      );

      await service.onModuleInit();
    });

    it('should store and retrieve value from memory', async () => {
      await service.set('key1', { value: 'data' });
      const result = await service.get('key1');

      expect(result).toEqual({ value: 'data' });
    });

    it('should set default TTL to 1 hour', async () => {
      const now = Date.now();
      jest.useFakeTimers();
      jest.setSystemTime(now);

      await service.set('key1', 'value1');

      // Move time forward by 30 minutes (should still exist)
      jest.setSystemTime(now + 30 * 60 * 1000);
      let result = await service.get('key1');
      expect(result).toEqual('value1');

      // Move time forward to 61 minutes (should be expired)
      jest.setSystemTime(now + 61 * 60 * 1000);
      result = await service.get('key1');
      expect(result).toBeNull();

      jest.useRealTimers();
    });

    it('should respect custom TTL', async () => {
      const now = Date.now();
      jest.useFakeTimers();
      jest.setSystemTime(now);

      await service.set('key1', 'value1', 10); // 10 seconds

      jest.setSystemTime(now + 5 * 1000);
      let result = await service.get('key1');
      expect(result).toEqual('value1');

      jest.setSystemTime(now + 11 * 1000);
      result = await service.get('key1');
      expect(result).toBeNull();

      jest.useRealTimers();
    });

    it('should delete value from memory', async () => {
      await service.set('key1', 'value1');
      expect(await service.get('key1')).toEqual('value1');

      await service.del('key1');
      expect(await service.get('key1')).toBeNull();
    });

    it('should return null for missing key', async () => {
      const result = await service.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should handle complex objects', async () => {
      const complexObj = {
        id: 1,
        name: 'Test',
        nested: { deep: { value: 'data' } },
        array: [1, 2, 3],
      };

      await service.set('complex', complexObj);
      const result = await service.get('complex');

      expect(result).toEqual(complexObj);
    });

    it('should overwrite existing key', async () => {
      await service.set('key1', 'value1');
      expect(await service.get('key1')).toEqual('value1');

      await service.set('key1', 'value2');
      expect(await service.get('key1')).toEqual('value2');
    });
  });

  describe('Redis Cache (When Redis Enabled)', () => {
    beforeEach(async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          const config: Record<string, string | number> = {
            REDIS_CACHE_ENABLED: 'true',
            REDIS_HOST: 'localhost',
            REDIS_PORT: 6379,
            REDIS_CONNECT_TIMEOUT_MS: 2000,
          };
          return config[key] ?? defaultValue;
        },
      );

      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockResolvedValue('PONG');

      await service.onModuleInit();
    });

    it('should connect to Redis on initialization', async () => {
      expect(mockRedisClient.connect).toHaveBeenCalled();
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    it('should store value in Redis with TTL', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      await service.set('key1', 'value1', 3600);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'key1',
        3600,
        '"value1"',
      );
    });

    it('should store value in Redis without TTL', async () => {
      mockRedisClient.set.mockResolvedValue('OK');

      await service.set('key1', 'value1');

      expect(mockRedisClient.set).toHaveBeenCalledWith('key1', '"value1"');
    });

    it('should retrieve value from Redis', async () => {
      mockRedisClient.get.mockResolvedValue('"value1"');

      const result = await service.get('key1');

      expect(result).toEqual('value1');
      expect(mockRedisClient.get).toHaveBeenCalledWith('key1');
    });

    it('should return null for missing key in Redis', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await service.get('nonexistent');

      expect(result).toBeNull();
    });

    it('should delete value from Redis', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await service.del('key1');

      expect(mockRedisClient.del).toHaveBeenCalledWith('key1');
    });

    it('should use memory cache fallback when Redis fails to get', async () => {
      // Set value successfully to memory and Redis
      mockRedisClient.setex.mockResolvedValue('OK');
      await service.set('key1', 'value1', 3600);

      // Now mock Redis failure for get
      mockRedisClient.get.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      // Should still be available from memory despite Redis failure
      const result = await service.get('key1');
      expect(result).toEqual('value1');
    });

    it('should use memory cache fallback when Redis fails to delete', async () => {
      await service.set('key1', 'value1');
      mockRedisClient.del.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      // Should still work from memory
      await service.del('key1');
      const result = await service.get('key1');

      expect(result).toBeNull();
    });

    it('should serialize and deserialize complex objects', async () => {
      const obj = { id: 1, name: 'test', date: '2024-01-01' };
      mockRedisClient.setex.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify(obj));

      await service.set('obj', obj, 3600);
      const result = await service.get<typeof obj>('obj');

      expect(result).toEqual(obj);
    });

    it('should handle JSON arrays', async () => {
      const arr = [1, 2, 3, 4, 5];
      mockRedisClient.setex.mockResolvedValue('OK');
      mockRedisClient.get.mockResolvedValue(JSON.stringify(arr));

      await service.set('arr', arr, 1800);
      const result = await service.get<typeof arr>('arr');

      expect(result).toEqual(arr);
    });

    it('should use custom TTL in Redis', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      await service.set('key1', 'value1', 7200);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'key1',
        7200,
        '"value1"',
      );
    });
  });

  describe('Redis Connection Failures', () => {
    it('should fall back to memory when Redis connection fails', async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          const config: Record<string, string | number> = {
            REDIS_CACHE_ENABLED: 'true',
            REDIS_HOST: 'localhost',
            REDIS_PORT: 6379,
            REDIS_CONNECT_TIMEOUT_MS: 2000,
          };
          return config[key] ?? defaultValue;
        },
      );

      mockRedisClient.connect.mockRejectedValue(
        new Error('Connection refused'),
      );

      await service.onModuleInit();

      // Should still work with memory cache
      await service.set('key1', 'value1');
      const result = await service.get('key1');

      expect(result).toEqual('value1');
    });

    it('should fall back to memory when Redis ping fails', async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          const config: Record<string, string | number> = {
            REDIS_CACHE_ENABLED: 'true',
            REDIS_HOST: 'localhost',
            REDIS_PORT: 6379,
            REDIS_CONNECT_TIMEOUT_MS: 2000,
          };
          return config[key] ?? defaultValue;
        },
      );

      mockRedisClient.connect.mockResolvedValue(undefined);
      mockRedisClient.ping.mockRejectedValue(new Error('Ping timeout'));

      await service.onModuleInit();

      // Should fall back to memory
      await service.set('key1', 'value1');
      const result = await service.get('key1');

      expect(result).toEqual('value1');
    });

    it('should handle Redis TLS configuration', async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          const config: Record<string, string | number | undefined> = {
            REDIS_CACHE_ENABLED: 'true',
            REDIS_HOST: 'localhost',
            REDIS_PORT: 6379,
            REDIS_CONNECT_TIMEOUT_MS: 2000,
            REDIS_TLS_ENABLED: 'true',
            REDIS_TLS_REJECT_UNAUTHORIZED: 'true',
            REDIS_PASSWORD: 'secret-password',
          };
          return config[key] ?? defaultValue;
        },
      );

      await service.onModuleInit();

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          tls: expect.objectContaining({
            rejectUnauthorized: true,
          }),
        }),
      );
    });
  });

  describe('Module Lifecycle', () => {
    it('should disconnect Redis on module destroy', async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          const config: Record<string, string | number> = {
            REDIS_CACHE_ENABLED: 'true',
            REDIS_HOST: 'localhost',
            REDIS_PORT: 6379,
            REDIS_CONNECT_TIMEOUT_MS: 2000,
          };
          return config[key] ?? defaultValue;
        },
      );

      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalled();
    });

    it('should handle destroy when Redis is disabled', async () => {
      await service.onModuleInit();
      await service.onModuleDestroy();

      expect(mockRedisClient.quit).not.toHaveBeenCalled();
    });

    it('should handle destroy gracefully', async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          const config: Record<string, string | number> = {
            REDIS_CACHE_ENABLED: 'true',
            REDIS_HOST: 'localhost',
            REDIS_PORT: 6379,
            REDIS_CONNECT_TIMEOUT_MS: 2000,
          };
          return config[key] ?? defaultValue;
        },
      );

      mockRedisClient.quit.mockResolvedValue('OK' as unknown as any);

      await service.onModuleInit();
      await service.onModuleDestroy();

      // Should successfully call quit
      expect(mockRedisClient.quit).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should read Redis host from config', async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          const config: Record<string, string | number> = {
            REDIS_CACHE_ENABLED: 'true',
            REDIS_HOST: 'redis.example.com',
            REDIS_PORT: 6379,
            REDIS_CONNECT_TIMEOUT_MS: 2000,
          };
          return config[key] ?? defaultValue;
        },
      );

      await service.onModuleInit();

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'redis.example.com',
        }),
      );
    });

    it('should read Redis port from config', async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          const config: Record<string, string | number> = {
            REDIS_CACHE_ENABLED: 'true',
            REDIS_HOST: 'localhost',
            REDIS_PORT: 6380,
            REDIS_CONNECT_TIMEOUT_MS: 2000,
          };
          return config[key] ?? defaultValue;
        },
      );

      await service.onModuleInit();

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          port: 6380,
        }),
      );
    });

    it('should read Redis password from config', async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          const config: Record<string, string | number | undefined> = {
            REDIS_CACHE_ENABLED: 'true',
            REDIS_HOST: 'localhost',
            REDIS_PORT: 6379,
            REDIS_CONNECT_TIMEOUT_MS: 2000,
            REDIS_PASSWORD: 'my-secret-password',
          };
          return config[key] ?? defaultValue;
        },
      );

      await service.onModuleInit();

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'my-secret-password',
        }),
      );
    });

    it('should handle missing Redis password', async () => {
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          const config: Record<string, string | number | undefined> = {
            REDIS_CACHE_ENABLED: 'true',
            REDIS_HOST: 'localhost',
            REDIS_PORT: 6379,
            REDIS_CONNECT_TIMEOUT_MS: 2000,
          };
          return config[key] ?? defaultValue;
        },
      );

      await service.onModuleInit();

      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          password: undefined,
        }),
      );
    });
  });

  describe('Type Safety', () => {
    it('should preserve types for stored objects', async () => {
      interface User {
        id: string;
        name: string;
        email: string;
      }

      const user: User = { id: '1', name: 'John', email: 'john@example.com' };

      await service.set('user', user);
      const result = await service.get<User>('user');

      expect(result?.id).toBe('1');
      expect(result?.name).toBe('John');
      expect(result?.email).toBe('john@example.com');
    });

    it('should handle generic types', async () => {
      interface ApiResponse<T> {
        data: T;
        status: string;
      }

      const response: ApiResponse<string> = { data: 'test', status: 'ok' };

      await service.set('response', response);
      const result = await service.get<ApiResponse<string>>('response');

      expect(result?.data).toBe('test');
      expect(result?.status).toBe('ok');
    });
  });

  describe('Edge Cases', () => {
    it('should handle null values', async () => {
      await service.set('key', null);
      // null will be serialized as "null" string when JSON stringified
      const result = await service.get('key');
      expect(result).toBe(null);
    });

    it('should handle empty objects', async () => {
      await service.set('key', {});
      const result = await service.get('key');
      expect(result).toEqual({});
    });

    it('should handle empty strings', async () => {
      await service.set('key', '');
      const result = await service.get('key');
      expect(result).toBe('');
    });

    it('should handle numeric values', async () => {
      await service.set('number', 12345);
      const result = await service.get('number');
      expect(result).toBe(12345);
    });

    it('should handle boolean values', async () => {
      await service.set('bool', true);
      const result = await service.get('bool');
      expect(result).toBe(true);
    });

    it('should handle zero', async () => {
      await service.set('zero', 0);
      const result = await service.get('zero');
      expect(result).toBe(0);
    });

    it('should handle very large objects', async () => {
      const largeObj: { items: Array<{ id: number; name: string }> } = {
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `item${i}`,
        })),
      };

      await service.set('large', largeObj);
      const result = await service.get<typeof largeObj>('large');

      expect(result?.items).toHaveLength(1000);
      expect(result?.items[0]).toEqual({ id: 0, name: 'item0' });
      expect(result?.items[999]).toEqual({ id: 999, name: 'item999' });
    });

    it('should handle special characters in keys', async () => {
      const specialKey = 'key:with:colons:and::double:colons';
      await service.set(specialKey, 'value');
      const result = await service.get(specialKey);

      expect(result).toBe('value');
    });

    it('should handle special characters in values', async () => {
      const specialValue =
        'value with "quotes" and \\backslashes\\ and unicode: 你好';
      await service.set('key', specialValue);
      const result = await service.get('key');

      expect(result).toBe(specialValue);
    });
  });
});
