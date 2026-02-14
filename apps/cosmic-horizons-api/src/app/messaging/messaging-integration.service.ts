import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { MessagingService } from './messaging.service';
import { LoggingService } from '../logging/logging.service';
import { MessagingStatsService } from './messaging-stats.service';
import { Subscription, delay } from 'rxjs';
import { Kafka, Partitioners } from 'kafkajs';

@Injectable()
export class MessagingIntegrationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagingIntegrationService.name);
  private rabbitClient?: ClientProxy;
  private kafkaClient?: ClientProxy;
  private subscription?: Subscription;

  constructor(
    private readonly configService: ConfigService,
    private readonly messagingService: MessagingService,
    private readonly statsService: MessagingStatsService,
    @Optional() private readonly loggingService?: LoggingService,
  ) {
    // Defer client initialization to onModuleInit to avoid early dependency issues
  }

  private initializeClients() {
    const kafkaBrokers = [`${this.configService.get('KAFKA_HOST') || 'localhost'}:${this.configService.get('KAFKA_PORT') || '9092'}`];

    this.rabbitClient = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [`amqp://${this.configService.get('RABBITMQ_USER')}:${this.configService.get('RABBITMQ_PASS')}@${this.configService.get('RABBITMQ_HOST')}:${this.configService.get('RABBITMQ_PORT')}`],
        queue: 'element_telemetry_queue',
        queueOptions: {
          durable: false,
        },
      },
    });

    this.kafkaClient = ClientProxyFactory.create({
      transport: Transport.KAFKA,
      options: {
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
    });
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
    try {
      await this.rabbitClient.connect();
      this.logger.log('Connected to RabbitMQ');
      await this.loggingService?.add({
        type: 'system',
        severity: 'info',
        message: 'MessagingIntegrationService connected to RabbitMQ',
      });
      this.statsService.recordPersistentWrite();
    } catch (err) {
      this.logger.error('Failed to connect to RabbitMQ', err);
      this.statsService.recordError();
    }

    // Explicitly create topics using Admin client to prevent metadata race conditions
    try {
      const kafka = new Kafka({
        clientId: 'cosmic-horizons-admin',
        brokers: [`${this.configService.get('KAFKA_HOST') || 'localhost'}:${this.configService.get('KAFKA_PORT') || '9092'}`],
      });
      const admin = kafka.admin();
      await admin.connect();
      await admin.createTopics({
        waitForLeaders: true,
        topics: [
          { 
            topic: 'element.raw_data', 
            numPartitions: 1, 
            replicationFactor: 1 
          }
        ],
      });
      this.logger.log('Kafka topics ensured (element.raw_data)');
      await admin.disconnect();
    } catch (err) {
      this.logger.warn('Could not ensure Kafka topics via Admin client: ' + (err as Error).message);
      this.statsService.recordError();
    }

    // Give Kafka broker more time to settle internal metadata after healthcheck
    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
      await this.kafkaClient.connect();
      this.logger.log('Connected to Kafka');
      await this.loggingService?.add({
        type: 'system',
        severity: 'info',
        message: 'MessagingIntegrationService connected to Kafka',
      });
      this.statsService.recordPersistentWrite();
    } catch (err) {
      this.logger.error('Failed to connect to Kafka', err);
      await this.loggingService?.add({
        type: 'system',
        severity: 'error',
        message: `Failed to connect to Kafka: ${(err as Error).message}`,
      });
      this.statsService.recordPersistentWrite();
      this.statsService.recordError();
    }

    // Subscribe to telemetry and push to brokers
    // Use a 5-second delay to ensure topics are created and metadata is stable
    this.subscription = this.messagingService.telemetry$.pipe(
      delay(5000)
    ).subscribe({
      next: (packet) => {
        // Push to RabbitMQ (Management/Telemetry Plane)
        this.rabbitClient.emit('element.telemetry', packet).subscribe({
          error: (err) => {
            this.statsService.recordError();
            this.logger.error('RabbitMQ emit error', err);
          }
        });
        this.statsService.recordRabbitPublished();
        
        // Every packet also goes to Kafka (Data Plane simulation)
        try {
          this.kafkaClient.emit('element.raw_data', {
            ...packet,
            data_chunk: 'base64_simulated_payload_representing_visibilities'
          }).subscribe({
            error: (err: Error) => {
              if (err.message?.includes('Metadata')) {
                return;
              }
              this.statsService.recordError();
              this.logger.error('Kafka emit error', err);
            }
          });
          this.statsService.recordKafkaPublished();
        } catch (err) {
          this.statsService.recordError();
          this.logger.error('Kafka emit synchronous error', err);
        }
      },
      error: (err) => {
        this.statsService.recordError();
        this.logger.error('Telemetry subscription error', err);
      }
    });
  }

  async onModuleDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    await this.rabbitClient?.close();
    await this.kafkaClient?.close();
  }
}
