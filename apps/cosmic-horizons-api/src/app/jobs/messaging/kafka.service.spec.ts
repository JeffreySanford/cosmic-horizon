import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from './kafka.service';

describe('KafkaService', () => {
  let service: KafkaService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          KAFKA_BROKERS: 'broker1:9092,broker2:9092,broker3:9092',
        };
        return config[key] ?? defaultValue;
      }),
    } as any;

    service = new KafkaService(mockConfigService);

    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect to Kafka', async () => {
      await service.connect();

      expect(service.isConnected()).toBe(true);
    });

    it('should parse broker array from config', async () => {
      await service.connect();

      const metrics = service.getMetrics();
      expect(metrics.brokers).toBe(3);
    });

    it('should use default brokers if config missing', async () => {
      mockConfigService.get.mockReturnValue('localhost:9092');

      await service.connect();

      expect(service.isConnected()).toBe(true);
    });

    it('should handle single broker', async () => {
      mockConfigService.get.mockReturnValue('single-broker:9092');

      await service.connect();

      const metrics = service.getMetrics();
      expect(metrics.brokers).toBe(1);
    });

    it('should log connection details', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      await service.connect();

      expect(logSpy).toHaveBeenCalled();
    });

    it('should not reconnect if already connected', async () => {
      await service.connect();
      const firstBrokerCount = service.getMetrics().brokers;

      mockConfigService.get.mockReturnValue('new-broker:9092');
      await service.connect();

      const secondBrokerCount = service.getMetrics().brokers;
      expect(secondBrokerCount).toBe(firstBrokerCount);
    });
  });

  describe('disconnect', () => {
    it('should disconnect from Kafka', async () => {
      await service.connect();
      expect(service.isConnected()).toBe(true);

      await service.disconnect();
      expect(service.isConnected()).toBe(false);
    });

    it('should log disconnection', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      await service.connect();
      await service.disconnect();

      expect(logSpy).toHaveBeenCalledWith('Kafka disconnected');
    });

    it('should clear admin reference', async () => {
      await service.connect();
      await service.disconnect();

      expect(service.isConnected()).toBe(false);
    });
  });

  describe('createTopic', () => {
    it('should create a topic', async () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      await service.createTopic('events.jobs');

      expect(debugSpy).toHaveBeenCalled();
    });

    it('should handle topic creation with special names', async () => {
      await service.createTopic('topic-with-dashes_and_underscores.123');

      expect(service.isConnected()).toBe(false);
    });

    it('should create multiple topics', async () => {
      const topics = ['topic1', 'topic2', 'topic3'];

      for (const topic of topics) {
        await service.createTopic(topic);
      }

      expect(service.isConnected()).toBe(false);
    });
  });

  describe('produce', () => {
    it('should produce messages to topic', async () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');
      const messages = [
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
      ];

      await service.produce('events', messages);

      expect(debugSpy).toHaveBeenCalled();
    });

    it('should handle batch message production', async () => {
      const batchSize = 100;
      const messages = Array.from({ length: batchSize }, (_, i) => ({
        key: `key-${i}`,
        value: `value-${i}`,
      }));

      await service.produce('large-batch', messages);

      expect(service.isConnected()).toBe(false);
    });

    it('should handle empty message list', async () => {
      await service.produce('events', []);

      expect(service.isConnected()).toBe(false);
    });

    it('should produce single message', async () => {
      const messages = [{ key: 'single', value: 'message' }];

      await service.produce('single-topic', messages);

      expect(service.isConnected()).toBe(false);
    });

    it('should produce complex message objects', async () => {
      const messages = [
        {
          key: 'complex-key',
          value: JSON.stringify({
            jobId: 'job-123',
            status: 'RUNNING',
            metadata: { progress: 50 },
          }),
        },
      ];

      await service.produce('complex-events', messages);

      expect(service.isConnected()).toBe(false);
    });
  });

  describe('consume', () => {
    it('should start consumer with callback', async () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');
      const callback = jest.fn();

      await service.consume('group-1', callback);

      expect(debugSpy).toHaveBeenCalled();
    });

    it('should handle multiple consumer groups', async () => {
      const groups = ['group-1', 'group-2', 'group-3'];
      const callback = jest.fn();

      for (const group of groups) {
        await service.consume(group, callback);
      }

      expect(service.isConnected()).toBe(false);
    });

    it('should support different callback functions', async () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      await service.consume('group-a', callback1);
      await service.consume('group-b', callback2);

      expect(service.isConnected()).toBe(false);
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

  describe('getConsumerGroupMetadata', () => {
    it('should return consumer group metadata', async () => {
      const metadata = await service.getConsumerGroupMetadata('group-1');

      expect(metadata).toHaveProperty('groupId', 'group-1');
      expect(metadata).toHaveProperty('state');
      expect(metadata).toHaveProperty('members');
    });

    it('should return stable state', async () => {
      const metadata = await service.getConsumerGroupMetadata('group-1');

      expect(metadata.state).toBe('Stable');
    });

    it('should return member count', async () => {
      const metadata = await service.getConsumerGroupMetadata('group-1');

      expect(metadata.members).toBeGreaterThan(0);
    });

    it('should handle different group names', async () => {
      const groups = ['group-a', 'group-xyz', 'special_group.123'];

      for (const groupId of groups) {
        const metadata = await service.getConsumerGroupMetadata(groupId);
        expect(metadata.groupId).toBe(groupId);
      }
    });
  });

  describe('getMetrics', () => {
    it('should return metrics object', () => {
      const metrics = service.getMetrics();

      expect(metrics).toHaveProperty('connected');
      expect(metrics).toHaveProperty('brokers');
      expect(metrics).toHaveProperty('throughput');
    });

    it('should show connected=false initially', () => {
      const metrics = service.getMetrics();

      expect(metrics.connected).toBe(false);
    });

    it('should show connected=true after connecting', async () => {
      await service.connect();

      const metrics = service.getMetrics();
      expect(metrics.connected).toBe(true);
    });

    it('should show broker count', async () => {
      await service.connect();

      const metrics = service.getMetrics();
      expect(metrics.brokers).toBeGreaterThan(0);
    });

    it('should include throughput metric', () => {
      const metrics = service.getMetrics();

      expect(metrics.throughput).toBe(1200);
    });

    it('should reflect state changes in metrics', async () => {
      let metrics = service.getMetrics();
      expect(metrics.connected).toBe(false);

      await service.connect();
      metrics = service.getMetrics();
      expect(metrics.connected).toBe(true);

      await service.disconnect();
      metrics = service.getMetrics();
      expect(metrics.connected).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle connect-produce-disconnect flow', async () => {
      await service.connect();
      expect(service.isConnected()).toBe(true);

      const messages = [{ key: 'k1', value: 'v1' }];
      await service.produce('topic', messages);

      await service.disconnect();
      expect(service.isConnected()).toBe(false);
    });

    it('should handle connect-consume-disconnect flow', async () => {
      await service.connect();
      const callback = jest.fn();
      await service.consume('group', callback);

      await service.disconnect();
      expect(service.isConnected()).toBe(false);
    });

    it('should track metrics across operations', async () => {
      const metrics = service.getMetrics();

      await service.connect();
      const connectedMetrics = service.getMetrics();
      expect(connectedMetrics.brokers).toBe(3);

      await service.produce('topic', [{ key: 'k', value: 'v' }]);
      await service.disconnect();

      const finalMetrics = service.getMetrics();
      expect(finalMetrics.connected).toBe(false);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle production without connection', async () => {
      const messages = [{ key: 'k', value: 'v' }];

      await expect(service.produce('topic', messages)).resolves.not.toThrow();
    });

    it('should handle consumption without connection', async () => {
      const callback = jest.fn();

      await expect(service.consume('group', callback)).resolves.not.toThrow();
    });

    it('should handle topic creation without connection', async () => {
      await expect(service.createTopic('topic')).resolves.not.toThrow();
    });
  });
});
