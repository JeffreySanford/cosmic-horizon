import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka } from 'kafkajs';
import Redis from 'ioredis';
import { Pool } from 'pg';
import type { MessagingInfraSnapshot } from './messaging.types';

const POLL_INTERVAL_MS = 2000;

@Injectable()
export class MessagingMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagingMonitorService.name);
  private pollHandle: NodeJS.Timeout | null = null;
  private kafkaAdmin: ReturnType<Kafka['admin']> | null = null;
  private redisClient: Redis | null = null;
  private postgresPool: Pool | null = null;

  private snapshot: MessagingInfraSnapshot = {
    rabbitmq: {
      connected: false,
      latencyMs: null,
      queueDepth: null,
      consumers: null,
    },
    kafka: {
      connected: false,
      latencyMs: null,
      latestOffset: null,
      partitions: null,
    },
    storage: {
      postgres: {
        connected: false,
        latencyMs: null,
      },
      redis: {
        connected: false,
        latencyMs: null,
      },
    },
  };

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.initializeClients();
    void this.poll();
    this.pollHandle = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }

    if (this.kafkaAdmin) {
      try {
        await this.kafkaAdmin.disconnect();
      } catch {
        // ignore shutdown failures
      }
      this.kafkaAdmin = null;
    }

    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        this.redisClient.disconnect();
      }
      this.redisClient = null;
    }

    if (this.postgresPool) {
      try {
        await this.postgresPool.end();
      } catch {
        // ignore shutdown failures
      }
      this.postgresPool = null;
    }
  }

  getSnapshot(): MessagingInfraSnapshot {
    return this.snapshot;
  }

  private initializeClients(): void {
    const kafkaHost = this.config.get<string>('KAFKA_HOST') ?? 'localhost';
    const kafkaPort = this.config.get<string>('KAFKA_PORT') ?? '9092';
    const kafka = new Kafka({
      clientId: 'cosmic-horizons-monitor',
      brokers: [`${kafkaHost}:${kafkaPort}`],
    });
    this.kafkaAdmin = kafka.admin();

    const redisHost = this.config.get<string>('REDIS_HOST') ?? 'localhost';
    const redisPort = Number(this.config.get<string>('REDIS_PORT') ?? '6379');
    const redisPassword = this.config.get<string>('REDIS_PASSWORD') ?? undefined;
    this.redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    const dbHost = this.config.get<string>('DB_HOST') ?? 'localhost';
    const dbPort = Number(this.config.get<string>('DB_PORT') ?? '15432');
    const dbUser = this.config.get<string>('DB_USER') ?? 'cosmic_horizons_user';
    const dbPass = this.config.get<string>('DB_PASSWORD') ?? 'cosmic_horizons_password_dev';
    const dbName = this.config.get<string>('DB_NAME') ?? 'cosmic_horizons';
    this.postgresPool = new Pool({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPass,
      database: dbName,
      max: 2,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 1500,
    });
  }

  private async poll(): Promise<void> {
    const [rabbitmq, kafka, postgres, redis] = await Promise.all([
      this.pollRabbitMq(),
      this.pollKafka(),
      this.pollPostgres(),
      this.pollRedis(),
    ]);

    this.snapshot = {
      rabbitmq,
      kafka,
      storage: {
        postgres,
        redis,
      },
    };
  }

  private async pollRabbitMq(): Promise<MessagingInfraSnapshot['rabbitmq']> {
    const host = this.config.get<string>('RABBITMQ_HOST') ?? 'localhost';
    const managementPort = this.config.get<string>('RABBITMQ_MANAGEMENT_PORT') ?? '15672';
    const user = this.config.get<string>('RABBITMQ_USER') ?? 'guest';
    const pass = this.config.get<string>('RABBITMQ_PASS') ?? 'guest';
    const url = `http://${host}:${managementPort}/api/queues/%2F/element_telemetry_queue`;
    const started = Date.now();

    try {
      const auth = Buffer.from(`${user}:${pass}`).toString('base64');
      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        messages?: number;
        consumers?: number;
      };

      return {
        connected: true,
        latencyMs: Date.now() - started,
        queueDepth: payload.messages ?? 0,
        consumers: payload.consumers ?? 0,
      };
    } catch (error) {
      this.logger.debug(`RabbitMQ monitor failed: ${(error as Error).message}`);
      return {
        connected: false,
        latencyMs: null,
        queueDepth: null,
        consumers: null,
      };
    }
  }

  private async pollKafka(): Promise<MessagingInfraSnapshot['kafka']> {
    if (!this.kafkaAdmin) {
      return {
        connected: false,
        latencyMs: null,
        latestOffset: null,
        partitions: null,
      };
    }

    const started = Date.now();
    try {
      await this.kafkaAdmin.connect();
      const offsets = await this.kafkaAdmin.fetchTopicOffsets('element.raw_data');
      const latestOffset = offsets.reduce((acc, item) => acc + Number(item.offset), 0);

      return {
        connected: true,
        latencyMs: Date.now() - started,
        latestOffset,
        partitions: offsets.length,
      };
    } catch (error) {
      this.logger.debug(`Kafka monitor failed: ${(error as Error).message}`);
      return {
        connected: false,
        latencyMs: null,
        latestOffset: null,
        partitions: null,
      };
    } finally {
      try {
        await this.kafkaAdmin.disconnect();
      } catch {
        // ignored
      }
    }
  }

  private async pollPostgres(): Promise<MessagingInfraSnapshot['storage']['postgres']> {
    if (!this.postgresPool) {
      return {
        connected: false,
        latencyMs: null,
      };
    }

    const started = Date.now();
    try {
      await this.postgresPool.query('SELECT 1');
      return {
        connected: true,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      this.logger.debug(`Postgres monitor failed: ${(error as Error).message}`);
      return {
        connected: false,
        latencyMs: null,
      };
    }
  }

  private async pollRedis(): Promise<MessagingInfraSnapshot['storage']['redis']> {
    if (!this.redisClient) {
      return {
        connected: false,
        latencyMs: null,
      };
    }

    const started = Date.now();
    try {
      if (this.redisClient.status !== 'ready') {
        await this.redisClient.connect();
      }
      await this.redisClient.ping();
      return {
        connected: true,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      this.logger.debug(`Redis monitor failed: ${(error as Error).message}`);
      return {
        connected: false,
        latencyMs: null,
      };
    }
  }
}
