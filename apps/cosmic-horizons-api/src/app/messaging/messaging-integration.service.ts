import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import {
  ClientProxyFactory,
  Transport,
  ClientKafka,
  ClientRMQ,
  // ClientProxy used only for typing the retry helper
  ClientProxy,
} from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { MessagingService } from './messaging.service';
import { LoggingService } from '../logging/logging.service';
import { MessagingStatsService } from './messaging-stats.service';
import { firstValueFrom, Subscription, timeout } from 'rxjs';
import { Kafka, Partitioners } from 'kafkajs';
import { connect } from 'amqplib';

@Injectable()
export class MessagingIntegrationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MessagingIntegrationService.name);
  // use the concrete proxy classes so TypeScript understands the
  // implementation returned by ClientProxyFactory.create().
  private rabbitClient?: ClientRMQ;
  private kafkaClient?: ClientKafka;
  private subscription?: Subscription;
  private rabbitConnected = false;
  private kafkaConnected = false;
  private shuttingDown = false;
  private rabbitUrl = '';
  private rabbitQueue = 'element_telemetry_queue';
  private rabbitExchange = 'element.telemetry.exchange';
  private rabbitRoutingKey = 'element.telemetry';
  private rabbitQueueDurable = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly messagingService: MessagingService,
    private readonly statsService: MessagingStatsService,
    @Optional() private readonly loggingService?: LoggingService,
  ) {
    // Defer client initialization to onModuleInit to avoid early dependency issues
  }

  private initializeClients() {
    const kafkaBrokers = [
      `${this.configService.get('KAFKA_HOST') || 'localhost'}:${this.configService.get('KAFKA_PORT') || '9092'}`,
    ];
    this.rabbitUrl = `amqp://${this.configService.get('RABBITMQ_USER')}:${this.configService.get('RABBITMQ_PASS')}@${this.configService.get('RABBITMQ_HOST')}:${this.configService.get('RABBITMQ_PORT')}`;
    this.rabbitQueue =
      this.configService.get<string>('RABBITMQ_QUEUE_NAME') ??
      'element_telemetry_queue';
    this.rabbitExchange =
      this.configService.get<string>('RABBITMQ_EXCHANGE_NAME') ??
      'element.telemetry.exchange';
    this.rabbitRoutingKey =
      this.configService.get<string>('RABBITMQ_ROUTING_KEY') ??
      'element.telemetry';
    this.rabbitQueueDurable = this.getBooleanConfig(
      'RABBITMQ_QUEUE_DURABLE',
      false,
    );

    // ClientProxyFactory.create returns a platform-specific proxy
    // (ClientRMQ when using Transport.RMQ).  We cast to that type so the
    // property declarations match and we don't encounter type incompatibility
    // errors later.
    this.rabbitClient = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [this.rabbitUrl],
        queue: this.rabbitQueue,
        queueOptions: {
          durable: this.rabbitQueueDurable,
        },
      },
    }) as ClientRMQ;

    this.kafkaClient = ClientProxyFactory.create({
      transport: Transport.KAFKA,
      options: {
        producerOnlyMode: true,
        client: {
          clientId: 'cosmic-horizons-array-element',
          brokers: kafkaBrokers,
          retry: {
            initialRetryTime: 1000,
            retries: 10,
          },
        },
        producer: {
          allowAutoTopicCreation: true,
          createPartitioner: Partitioners.LegacyPartitioner,
        },
      },
    }) as ClientKafka;
  }

  onModuleInit() {
    // Initialize clients (deferred from constructor)
    this.initializeClients();

    // Fire up infrastructure connections asynchronously WITHOUT blocking module init
    // This allows TypeOrmModule and other core modules to finish loading first
    this.initializeInfrastructure().catch((err) => {
      this.logger.error('Failed to initialize infrastructure connections', err);
    });
  }

  private async initializeInfrastructure() {
    // Harden startup: allow more time for Dockerized brokers to become reachable in CI.
    await this.ensureRabbitTopologyWithRetry(12);
    await this.connectRabbitWithRetry(12);
    await this.ensureKafkaTopicsWithRetry();
    await this.connectKafkaWithRetry();

    // Subscribe to telemetry and push to brokers.
    // Publish path uses bounded retry/backoff without startup sleeps.
    this.subscription = this.messagingService.telemetry$.subscribe({
      next: (packet) => {
        void this.publishPacket(packet);
      },
      error: (err) => {
        this.statsService.recordError();
        this.logger.error('Telemetry subscription error', err);
      },
    });
  }

  private async publishPacket(packet: unknown): Promise<void> {
    if (this.shuttingDown) {
      return;
    }

    await Promise.allSettled([
      this.publishRabbit(packet),
      this.publishKafka({
        ...(packet as Record<string, unknown>),
        data_chunk: 'base64_simulated_payload_representing_visibilities',
      }),
    ]);
  }

  private async publishRabbit(packet: unknown): Promise<void> {
    if (!this.rabbitConnected) {
      await this.connectRabbitWithRetry(2);
    }
    if (!this.rabbitClient) {
      this.statsService.recordError();
      this.logger.error('RabbitMQ client is not initialized');
      return;
    }

    try {
      // Cast to a ClientProxy with an empty events map; this satisfies
    // the library's generic constraint while keeping our call-site type
    // errors quiet. eslint is disabled here because the underlying proxy
    // implementation is sound.
    // use a generic with no keys – avoids unsafe Function type warnings
    await this.emitWithRetry(
        this.rabbitClient as ClientProxy<Record<never, never>, string>,
        this.rabbitRoutingKey,
        packet,
        'RabbitMQ',
      );
      this.statsService.recordRabbitPublished();
    } catch (err) {
      this.statsService.recordError();
      this.logger.error('RabbitMQ publish failed after retries', err);
    }
  }

  private async publishKafka(packet: unknown): Promise<void> {
    if (!this.kafkaConnected) {
      await this.connectKafkaWithRetry(2);
    }
    if (!this.kafkaClient) {
      this.statsService.recordError();
      this.logger.error('Kafka client is not initialized');
      return;
    }

    try {
            await this.emitWithRetry(
        this.kafkaClient as ClientProxy<Record<never, never>, string>,
        'element.raw_data',
        packet,
        'Kafka',
      );
      this.statsService.recordKafkaPublished();
    } catch (err) {
      this.statsService.recordError();
      this.logger.error('Kafka publish failed after retries', err);
    }
  }

  private async connectRabbitWithRetry(maxAttempts = 5): Promise<void> {
    if (this.rabbitConnected || !this.rabbitClient) {
      return;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.rabbitClient.connect();
        this.rabbitConnected = true;
        this.logger.log('Connected to RabbitMQ');
        await this.loggingService?.add({
          type: 'system',
          severity: 'info',
          message: 'MessagingIntegrationService connected to RabbitMQ',
        });
        this.statsService.recordPersistentWrite();
        return;
      } catch (err) {
        this.statsService.recordError();
        if (attempt === maxAttempts) {
          // Sanitize URL for logs (don't print credentials)
          try {
            const url = new URL(this.rabbitUrl);
            const hostPort = `${url.hostname}:${url.port || '5672'}`;
            this.logger.error(
              `Failed to connect to RabbitMQ at ${hostPort} after ${maxAttempts} attempts`,
              err,
            );
          } catch (parseErr) {
            // Log parsing error instead of the original error to mark the
            // variable as used and to surface the URL parsing failure if it
            // happens.
            this.logger.error('Failed to parse RabbitMQ URL after retries', parseErr);
          }
          return;
        }
        const waitMs = this.backoffMs(attempt);
        this.logger.warn(
          `RabbitMQ connection attempt ${attempt}/${maxAttempts} failed; retrying in ${waitMs}ms`,
        );
        await this.sleep(waitMs);
      }
    }
  }

  private async ensureRabbitTopologyWithRetry(maxAttempts = 5): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      // amqplib's `connect` actually returns a `ChannelModel` which does not
      // satisfy the `Connection` interface defined in the types; we use the
      // concrete type here and then cast later when necessary.
      let connection: import('amqplib').ChannelModel | undefined;
      let channel: import('amqplib').Channel | undefined;

      try {
        connection = (await connect(this.rabbitUrl)) as import('amqplib').ChannelModel;
        channel = await connection.createChannel();
        if (!channel) {
          // should never happen; defensively bail out
          throw new Error('Failed to create RabbitMQ channel');
        }
        await channel.assertExchange(this.rabbitExchange, 'topic', {
          durable: this.rabbitQueueDurable,
        });
        await channel.assertQueue(this.rabbitQueue, {
          durable: this.rabbitQueueDurable,
        });
        await channel.bindQueue(
          this.rabbitQueue,
          this.rabbitExchange,
          this.rabbitRoutingKey,
        );
        this.logger.log(
          `RabbitMQ topology ensured (${this.rabbitExchange} -> ${this.rabbitQueue} [${this.rabbitRoutingKey}], durable=${this.rabbitQueueDurable})`,
        );
        return;
      } catch (err) {
        this.statsService.recordError();
        if (attempt === maxAttempts) {
          this.logger.error(
            'Failed to ensure RabbitMQ topology after retries',
            err,
          );
          return;
        }
        const waitMs = this.backoffMs(attempt);
        this.logger.warn(
          `RabbitMQ topology attempt ${attempt}/${maxAttempts} failed; retrying in ${waitMs}ms`,
        );
        await this.sleep(waitMs);
      } finally {
        await channel?.close().catch(() => undefined);
        // ChannelModel includes a close method
        await connection?.close().catch(() => undefined);
      }
    }
  }

  private async ensureKafkaTopicsWithRetry(maxAttempts = 5): Promise<void> {
    const kafka = new Kafka({
      clientId: 'cosmic-horizons-admin',
      brokers: [
        `${this.configService.get('KAFKA_HOST') || 'localhost'}:${this.configService.get('KAFKA_PORT') || '9092'}`,
      ],
    });
    const admin = kafka.admin();

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await admin.connect();
        const existingTopics = await admin.listTopics();
        if (existingTopics.includes('element.raw_data')) {
          this.logger.log('Kafka topics ensured (element.raw_data)');
          return;
        }

        await admin.createTopics({
          waitForLeaders: true,
          topics: [
            {
              topic: 'element.raw_data',
              numPartitions: 1,
              replicationFactor: 1,
            },
          ],
        });
        this.logger.log('Kafka topics ensured (element.raw_data)');
        return;
      } catch (err) {
        this.statsService.recordError();
        if (attempt === maxAttempts) {
          this.logger.error('Failed to ensure Kafka topics after retries', err);
          return;
        }
        const waitMs = this.backoffMs(attempt);
        this.logger.warn(
          `Kafka topic ensure attempt ${attempt}/${maxAttempts} failed; retrying in ${waitMs}ms`,
        );
        await this.sleep(waitMs);
      } finally {
        await admin.disconnect().catch(() => undefined);
      }
    }
  }

  private async connectKafkaWithRetry(maxAttempts = 5): Promise<void> {
    if (this.kafkaConnected || !this.kafkaClient) {
      return;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await this.kafkaClient.connect();
        this.kafkaConnected = true;
        this.logger.log('Connected to Kafka');
        await this.loggingService?.add({
          type: 'system',
          severity: 'info',
          message: 'MessagingIntegrationService connected to Kafka',
        });
        this.statsService.recordPersistentWrite();
        return;
      } catch (err) {
        this.statsService.recordError();
        if (attempt === maxAttempts) {
          this.logger.error('Failed to connect to Kafka after retries', err);
          await this.loggingService?.add({
            type: 'system',
            severity: 'error',
            message: `Failed to connect to Kafka: ${(err as Error).message}`,
          });
          this.statsService.recordPersistentWrite();
          return;
        }
        const waitMs = this.backoffMs(attempt);
        this.logger.warn(
          `Kafka connection attempt ${attempt}/${maxAttempts} failed; retrying in ${waitMs}ms`,
        );
        await this.sleep(waitMs);
      }
    }
  }

  private async emitWithRetry(
    client: ClientProxy<Record<never, never>, string>,
    event: string,
    payload: unknown,
    brokerName: 'RabbitMQ' | 'Kafka',
    maxAttempts = 3,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await firstValueFrom(client.emit(event, payload).pipe(timeout(5000)));
        return;
      } catch (err) {
        if (attempt === maxAttempts) {
          throw err;
        }
        const waitMs = this.backoffMs(attempt);
        this.logger.warn(
          `${brokerName} emit attempt ${attempt}/${maxAttempts} failed for ${event}; retrying in ${waitMs}ms`,
        );
        await this.sleep(waitMs);
      }
    }
  }

  private backoffMs(attempt: number): number {
    const base = 250;
    return Math.min(base * 2 ** (attempt - 1), 4000);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getBooleanConfig(key: string, fallback: boolean): boolean {
    const raw = this.configService.get<string>(key);
    if (!raw) {
      return fallback;
    }
    const normalized = raw.trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
  }

  async onModuleDestroy() {
    this.shuttingDown = true;
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    await this.rabbitClient?.close();
    await this.kafkaClient?.close();
  }
}
