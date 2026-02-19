import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redisClient: Redis | null = null;
  private redisEnabled = false;
  private memoryCache = new Map<string, { value: string; expires: number }>();

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const enabled =
      this.configService
        .get<string>('REDIS_CACHE_ENABLED', 'false')
        .toLowerCase() === 'true';
    if (!enabled) {
      this.redisEnabled = false;
      return;
    }

    const host = this.configService.get<string>('REDIS_HOST', '127.0.0.1');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password =
      this.configService.get<string>('REDIS_PASSWORD')?.trim() || undefined;
    const connectTimeout = this.configService.get<number>(
      'REDIS_CONNECT_TIMEOUT_MS',
      2000,
    );
    const redisTlsEnabled =
      this.configService
        .get<string>('REDIS_TLS_ENABLED', 'false')
        .toLowerCase() === 'true';
    const redisTlsRejectUnauthorized =
      this.configService
        .get<string>('REDIS_TLS_REJECT_UNAUTHORIZED', 'true')
        .toLowerCase() !== 'false';

    const client = new Redis({
      host,
      port,
      password,
      lazyConnect: true,
      connectTimeout,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      tls: redisTlsEnabled
        ? {
            rejectUnauthorized: redisTlsRejectUnauthorized,
          }
        : undefined,
    });

    try {
      await client.connect();
      await client.ping();
      this.redisClient = client;
      this.redisEnabled = true;
      this.logger.log(`Redis cache enabled at ${host}:${port}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown redis error';
      this.logger.warn(`Redis cache unavailable (${message}).`);
      client.disconnect();
      this.redisClient = null;
      this.redisEnabled = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redisEnabled && this.redisClient) {
      try {
        const val = await this.redisClient.get(key);
        return val ? JSON.parse(val) : null;
      } catch (error) {
        this.logger.error(`Error getting key ${key} from Redis`, error);
        // Fall through to memory cache if Redis fails
      }
    }

    const cached = this.memoryCache.get(key);
    if (cached) {
      if (Date.now() < cached.expires) {
        return JSON.parse(cached.value);
      }
      this.memoryCache.delete(key);
    }
    return null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const val = JSON.stringify(value);
    const ttl = ttlSeconds || 3600; // Default 1h

    // Memory fallback
    this.memoryCache.set(key, {
      value: val,
      expires: Date.now() + ttl * 1000,
    });

    if (this.redisEnabled && this.redisClient) {
      try {
        if (ttlSeconds) {
          await this.redisClient.setex(key, ttlSeconds, val);
        } else {
          await this.redisClient.set(key, val);
        }
      } catch (error) {
        this.logger.error(`Error setting key ${key} in Redis`, error);
      }
    }
  }

  async del(key: string): Promise<void> {
    this.memoryCache.delete(key);
    if (this.redisEnabled && this.redisClient) {
      try {
        await this.redisClient.del(key);
      } catch (error) {
        this.logger.error(`Error deleting key ${key} from Redis`, error);
      }
    }
  }

  /**
   * Delete a key from cache (alias for del)
   */
  async delete(key: string): Promise<void> {
    return this.del(key);
  }

  /**
   * Purge all entries from cache (both Redis and memory)
   */
  async purge(): Promise<void> {
    this.memoryCache.clear();
    if (this.redisEnabled && this.redisClient) {
      try {
        await this.redisClient.flushdb();
        this.logger.log('Cache purged successfully');
      } catch (error) {
        this.logger.error('Error purging Redis cache', error);
      }
    }
  }
}
