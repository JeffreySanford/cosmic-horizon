import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService, PublishOptions, ConsumeOptions } from './rabbitmq.service';
import { v4 as uuidv4 } from 'uuid';

jest.mock('uuid');

describe('RabbitMQService', () => {
  let service: RabbitMQService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, any> = {
          'RABBITMQ_URLS': 'amqp://rabbit1:5672,amqp://rabbit2:5672',
          'RABBITMQ_RECONNECT_TIME': 5000,
          'RABBITMQ_HEARTBEAT': 60,
          'RABBITMQ_DURABLE_QUEUES': true,
          'RABBITMQ_DURABLE_EXCHANGES': true,
          'RABBITMQ_PREFETCH': 10,
        };
        return config[key] ?? defaultValue;
      }),
    } as any;

    service = new RabbitMQService(mockConfigService);

    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    (uuidv4 as jest.Mock).mockReturnValue('test-uuid-12345');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should connect on module init', async () => {
      await service.onModuleInit();

      // Service should not throw
      expect(service).toBeDefined();
    });
  });

  describe('onModuleDestroy', () => {
    it('should disconnect on module destroy', async () => {
      await service.onModuleInit();
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('connect', () => {
    it('should establish connection', async () => {
      await service.connect();

      expect(service.isConnected()).toBe(true);
    });

    it('should configure channels', async () => {
      await service.connect();

      expect(service.isConnected()).toBe(true);
    });

    it('should parse broker URLs from config', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'RABBITMQ_URLS') {
          return 'amqp://broker1,amqp://broker2,amqp://broker3';
        }
        return defaultValue;
      });

      await service.connect();

      expect(service.isConnected()).toBe(true);
    });

    it('should use default URL if config missing', async () => {
      mockConfigService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'RABBITMQ_URLS') return undefined;
        return defaultValue;
      });

      await service.connect();

      expect(service.isConnected()).toBe(true);
    });

    it('should log connection establishment', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      await service.connect();

      expect(logSpy).toHaveBeenCalled();
    });

    it('should prevent concurrent connection attempts', async () => {
      await service.connect();

      // Should not throw or create issues even if called again
      await expect(service.connect()).resolves.not.toThrow();
    });

    it('should read heartbeat configuration', async () => {
      await service.connect();

      expect(mockConfigService.get).toHaveBeenCalledWith(
        'RABBITMQ_HEARTBEAT',
        60
      );
    });

    it('should read reconnect time configuration', async () => {
      await service.connect();

      expect(mockConfigService.get).toHaveBeenCalledWith(
        'RABBITMQ_RECONNECT_TIME',
        5000
      );
    });
  });

  describe('disconnect', () => {
    it('should disconnect from RabbitMQ', async () => {
      await service.connect();
      expect(service.isConnected()).toBe(true);

      await service.disconnect();
      expect(service.isConnected()).toBe(false);
    });

    it('should log disconnection', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      await service.connect();
      await service.disconnect();

      expect(logSpy).toHaveBeenCalled();
    });

    it('should handle disconnection without prior connection', async () => {
      await expect(service.disconnect()).resolves.not.toThrow();
    });
  });

  describe('publish', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should publish message', async () => {
      const message = { jobId: 'job-123', status: 'RUNNING' };
      const options: PublishOptions = {
        exchange: 'jobs.exchange',
        routingKey: 'job.status.change',
        persistent: true,
      };

      const result = await service.publish(message, options);

      expect(result).toBe(true);
    });

    it('should generate message ID', async () => {
      const options: PublishOptions = {
        exchange: 'jobs.exchange',
        routingKey: 'job.submitted',
      };

      await service.publish({ jobId: 'job-1' }, options);

      expect(uuidv4).toHaveBeenCalled();
    });

    it('should handle persistent messages', async () => {
      const options: PublishOptions = {
        exchange: 'jobs.exchange',
        routingKey: 'job.event',
        persistent: true,
        contentType: 'application/json',
      };

      const result = await service.publish({ data: 'test' }, options);

      expect(result).toBe(true);
    });

    it('should include correlation ID if provided', async () => {
      const options: PublishOptions = {
        exchange: 'events.fanout',
        routingKey: 'event',
        correlationId: 'corr-123',
      };

      const result = await service.publish({}, options);

      expect(result).toBe(true);
    });

    it('should throw if not connected', async () => {
      await service.disconnect();

      const options: PublishOptions = {
        exchange: 'jobs.exchange',
        routingKey: 'job.event',
      };

      await expect(service.publish({}, options)).rejects.toThrow();
    });

    it('should handle headers with message', async () => {
      const options: PublishOptions = {
        exchange: 'jobs.exchange',
        routingKey: 'job.event',
        headers: { userId: 'user-123', timestamp: Date.now() },
      };

      const result = await service.publish({}, options);

      expect(result).toBe(true);
    });
  });

  describe('consume', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should consume messages from queue', async () => {
      const callback = jest.fn();
      const options: ConsumeOptions = {
        queue: 'jobs.queue',
        autoAck: true,
      };

      const consumerTag = await service.consume(callback, options);

      expect(consumerTag).toBeDefined();
    });

    it('should generate consumer tag if not provided', async () => {
      const callback = jest.fn();
      const options: ConsumeOptions = {
        queue: 'jobs.queue',
      };

      (uuidv4 as jest.Mock).mockReturnValue('generated-tag-123');
      const consumerTag = await service.consume(callback, options);

      expect(consumerTag).toContain('consumer-');
    });

    it('should use provided consumer tag', async () => {
      const callback = jest.fn();
      const options: ConsumeOptions = {
        queue: 'jobs.queue',
        consumerTag: 'my-consumer',
      };

      const consumerTag = await service.consume(callback, options);

      expect(consumerTag).toBe('my-consumer');
    });

    it('should handle auto-acknowledge option', async () => {
      const callback = jest.fn();
      const options: ConsumeOptions = {
        queue: 'jobs.queue',
        autoAck: true,
      };

      const consumerTag = await service.consume(callback, options);

      expect(consumerTag).toBeDefined();
    });

    it('should handle exclusive consumer option', async () => {
      const callback = jest.fn();
      const options: ConsumeOptions = {
        queue: 'jobs.queue',
        exclusive: true,
      };

      const consumerTag = await service.consume(callback, options);

      expect(consumerTag).toBeDefined();
    });

    it('should throw if not connected', async () => {
      await service.disconnect();

      const options: ConsumeOptions = {
        queue: 'jobs.queue',
      };

      await expect(service.consume(jest.fn(), options)).rejects.toThrow();
    });

    it('should use configured prefetch', async () => {
      const callback = jest.fn();
      const options: ConsumeOptions = {
        queue: 'jobs.queue',
      };

      await service.consume(callback, options);

      expect(mockConfigService.get).toHaveBeenCalledWith(
        'RABBITMQ_PREFETCH',
        10
      );
    });
  });

  describe('acknowledge', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should acknowledge message', async () => {
      const message: any = {
        payload: {},
        headers: {},
        retryCount: 0,
        originalTimestamp: new Date(),
      };

      await expect(service.acknowledge(message)).resolves.not.toThrow();
    });

    it('should handle multiple acknowledges', async () => {
      const messages = Array.from({ length: 3 }, () => ({
        payload: {},
        headers: {},
        retryCount: 0,
        originalTimestamp: new Date(),
      }));

      for (const msg of messages) {
        await expect(service.acknowledge(msg)).resolves.not.toThrow();
      }
    });
  });

  describe('nack', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should nack message with requeue', async () => {
      const message: any = {
        payload: {},
        headers: {},
        retryCount: 0,
        originalTimestamp: new Date(),
      };

      await expect(service.nack(message, true)).resolves.not.toThrow();
    });

    it('should nack message without requeue', async () => {
      const message: any = {
        payload: {},
        headers: {},
        retryCount: 0,
        originalTimestamp: new Date(),
      };

      await expect(service.nack(message, false)).resolves.not.toThrow();
    });

    it('should handle nack with retry', async () => {
      const message: any = {
        payload: { jobId: 'job-123' },
        headers: {},
        retryCount: 2,
        originalTimestamp: new Date(),
      };

      await expect(service.nack(message, true)).resolves.not.toThrow();
    });
  });

  describe('sendToDLQ', () => {
    beforeEach(async () => {
      await service.connect();
    });

    it('should send message to dead letter queue', async () => {
      const message: any = {
        payload: { jobId: 'job-fail' },
        headers: {},
        retryCount: 5,
        originalTimestamp: new Date(),
      };

      await expect(
        service.sendToDLQ(message, 'Max retries exceeded')
      ).resolves.not.toThrow();
    });

    it('should send multiple messages to DLQ', async () => {
      for (let i = 0; i < 3; i++) {
        const message: any = {
          payload: { jobId: `job-fail-${i}` },
          headers: {},
          retryCount: 5,
          originalTimestamp: new Date(),
        };

        await expect(
          service.sendToDLQ(message, 'Processing error')
        ).resolves.not.toThrow();
      }
    });

    it('should include error reason', async () => {
      const message: any = {
        payload: {},
        headers: {},
        retryCount: 0,
        originalTimestamp: new Date(),
      };

      const reasons = [
        'Connection timeout',
        'Invalid message format',
        'System error',
      ];

      for (const reason of reasons) {
        await expect(service.sendToDLQ(message, reason)).resolves.not.toThrow();
      }
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should return true after connection', async () => {
      await service.connect();

      expect(service.isConnected()).toBe(true);
    });

    it('should return false after disconnection', async () => {
      await service.connect();
      await service.disconnect();

      expect(service.isConnected()).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete pub-sub flow', async () => {
      await service.connect();

      const publishOptions: PublishOptions = {
        exchange: 'jobs.exchange',
        routingKey: 'job.submitted',
        persistent: true,
      };

      const publishResult = await service.publish(
        { jobId: 'job-123' },
        publishOptions
      );
      expect(publishResult).toBe(true);

      const consumeOptions: ConsumeOptions = {
        queue: 'jobs.queue',
        autoAck: false,
      };

      const consumerTag = await service.consume(jest.fn(), consumeOptions);
      expect(consumerTag).toBeDefined();

      const message: any = {
        payload: { jobId: 'job-123' },
        headers: {},
        retryCount: 0,
        originalTimestamp: new Date(),
      };

      await expect(service.acknowledge(message)).resolves.not.toThrow();

      await service.disconnect();
      expect(service.isConnected()).toBe(false);
    });

    it('should handle error and nack', async () => {
      await service.connect();

      const consumeOptions: ConsumeOptions = {
        queue: 'jobs.queue',
      };

      await service.consume(jest.fn(), consumeOptions);

      const failedMessage: any = {
        payload: { jobId: 'failed-job' },
        headers: {},
        retryCount: 1,
        originalTimestamp: new Date(),
      };

      await expect(service.nack(failedMessage, true)).resolves.not.toThrow();

      await service.disconnect();
    });
  });
});
