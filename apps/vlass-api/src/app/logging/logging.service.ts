import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { LogEntry, LogSeverity, LogType } from './log-entry';

interface LogOptions {
  type: LogType;
  severity: LogSeverity;
  message: string;
  data?: Record<string, string | number | boolean | null>;
}

@Injectable()
export class LoggingService implements OnModuleDestroy {
  private readonly logger = new Logger(LoggingService.name);
  private readonly buffer: LogEntry[] = [];
  private readonly maxBuffer = 1000;
  private redis: Redis | null = null;
  private readonly redisKey = 'logs:recent';
  private readonly redisTrim = 2000;

  constructor() {
    const enabled = (process.env['LOGS_REDIS_ENABLED'] ?? 'false').toLowerCase() === 'true';
    if (!enabled) return;

    const host = process.env['REDIS_HOST'] ?? '127.0.0.1';
    const port = Number(process.env['REDIS_PORT'] ?? 6379);
    const password = process.env['REDIS_PASSWORD'] || undefined;
    try {
      this.redis = new Redis({ host, port, password });
      this.logger.log(`LoggingService connected to Redis at ${host}:${port}.`);
    } catch (err) {
      this.logger.warn(`LoggingService Redis disabled: ${(err as Error)?.message ?? 'unknown'}`);
      this.redis = null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }

  async add(entry: LogOptions): Promise<void> {
    const full: LogEntry = {
      id: randomUUID(),
      at: new Date().toISOString(),
      ...entry,
    };

    this.buffer.push(full);
    if (this.buffer.length > this.maxBuffer) {
      this.buffer.splice(0, this.buffer.length - this.maxBuffer);
    }

    if (this.redis) {
      try {
        await this.redis.lpush(this.redisKey, JSON.stringify(full));
        await this.redis.ltrim(this.redisKey, 0, this.redisTrim - 1);
      } catch (err) {
        this.logger.warn(`Redis log write failed: ${(err as Error)?.message ?? 'unknown'}`);
        this.redis = null;
      }
    }
  }

  async getRecent(limit = 100, offset = 0): Promise<LogEntry[]> {
    if (this.redis) {
      try {
        const start = offset;
        const end = offset + limit - 1;
        const raw = await this.redis.lrange(this.redisKey, start, end);
        return raw.map((item) => JSON.parse(item) as LogEntry);
      } catch (err) {
        this.logger.warn(`Redis log read failed: ${(err as Error)?.message ?? 'unknown'}`);
        this.redis = null;
      }
    }
    return this.buffer.slice().reverse().slice(offset, offset + limit);
  }

  async getSummary(): Promise<Record<string, number>> {
    const counts: Record<string, number> = { debug: 0, info: 0, warn: 0, error: 0 };
    const recent = await this.getRecent(500, 0);
    for (const item of recent) {
      counts[item.severity] = (counts[item.severity] ?? 0) + 1;
    }
    return counts;
  }
}
