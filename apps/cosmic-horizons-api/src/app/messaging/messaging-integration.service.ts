import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { MessagingService } from './messaging.service';
import { LoggingService } from '../logging/logging.service';
import { Subscription, delay } from 'rxjs';
import { Kafka, Partitioners } from 'kafkajs';

@Injectable()
export class MessagingIntegrationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MessagingIntegrationService.name);
  private rabbitClient: ClientProxy;
  private kafkaClient: any;
  private subscription?: Subscription;

  constructor(
    private readonly configService: ConfigService,
    private readonly messagingService: MessagingService,
    private readonly loggingService: LoggingService,
  ) {
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

  async onModuleInit() {
    try {
      await this.rabbitClient.connect();
      this.logger.log('Connected to RabbitMQ');
      this.loggingService.add({
        type: 'system',
        severity: 'info',
        message: 'MessagingIntegrationService connected to RabbitMQ',
      });
    } catch (err) {
      this.logger.error('Failed to connect to RabbitMQ', err);
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
    }

    // Give Kafka broker more time to settle internal metadata after healthcheck
    await new Promise(resolve => setTimeout(resolve, 10000));

    try {
      await this.kafkaClient.connect();
      this.logger.log('Connected to Kafka');
      this.loggingService.add({
        type: 'system',
        severity: 'info',
        message: 'MessagingIntegrationService connected to Kafka',
      });
    } catch (err) {
      this.logger.error('Failed to connect to Kafka', err);
      this.loggingService.add({
        type: 'system',
        severity: 'error',
        message: `Failed to connect to Kafka: ${(err as Error).message}`,
      });
    }

    // Subscribe to telemetry and push to brokers
    // Use a 20-second delay to ensure topics are created and metadata is stable
    // Also throttle the initial burst to avoid pressure on the metadata cache
    this.subscription = this.messagingService.telemetry$.pipe(
      delay(20000)
    ).subscribe({
      next: (packet) => {
        // Push to RabbitMQ (Management/Telemetry Plane)
        this.rabbitClient.emit('element.telemetry', packet).subscribe({
          error: (err) => this.logger.error('RabbitMQ emit error', err)
        });
        
        // Every packet also goes to Kafka (Data Plane simulation)
        // We use a try-catch or error handler to prevent crashing if metadata is still settling
        try {
          this.kafkaClient.emit('element.raw_data', {
            ...packet,
            data_chunk: 'base64_simulated_payload_representing_visibilities'
          }).subscribe({
            error: (err: Error) => {
              if (err.message?.includes('Metadata')) {
                // Silently ignore metadata settling issues for now to keep logs clean
                return;
              }
              this.logger.error('Kafka emit error', err);
            }
          });
        } catch (err) {
          this.logger.error('Kafka emit synchronous error', err);
        }
      },
      error: (err) => this.logger.error('Telemetry subscription error', err)
    });
  }

  async onModuleDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    await this.rabbitClient.close();
    await this.kafkaClient.close();
  }
}
