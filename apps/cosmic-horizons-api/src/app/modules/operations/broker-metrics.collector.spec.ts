import { Test, TestingModule } from '@nestjs/testing';
import { BrokerMetricsCollector } from './broker-metrics.collector';
import axios from 'axios';

jest.mock('axios');

describe('BrokerMetricsCollector', () => {
  let service: BrokerMetricsCollector;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env['RABBITMQ_USER'] = 'guest';
    process.env['RABBITMQ_PASS'] = 'guest';
    process.env['PULSAR_ENABLED'] = 'true';

    const module: TestingModule = await Test.createTestingModule({
      providers: [BrokerMetricsCollector],
    }).compile();

    service = module.get<BrokerMetricsCollector>(BrokerMetricsCollector);
  });

  describe('collectAllMetrics', () => {
    it('should collect metrics from all brokers in parallel', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn(),
      } as any);

      const result = await service.collectAllMetrics();

      expect(result).toHaveProperty('rabbitmq');
      expect(result).toHaveProperty('kafka');
      expect(result).toHaveProperty('pulsar');
    });

    it('should mark brokers as disconnected when collection fails', async () => {
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('Connection refused')),
      } as any);

      const result = await service.collectAllMetrics();

      expect(result.rabbitmq.connected).toBe(false);
      expect(result.kafka.connected).toBe(false);
    });

    it('should skip pulsar metrics when PULSAR_ENABLED is false', async () => {
      process.env['PULSAR_ENABLED'] = 'false';

      mockedAxios.create.mockReturnValue({
        get: jest.fn(),
      } as any);

      const testCollector = new BrokerMetricsCollector();
      const result = await testCollector.collectAllMetrics();

      expect(result.pulsar).toBeUndefined();
    });
  });

  describe('constructor', () => {
    it('should initialize axios clients with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalled();
      const calls = mockedAxios.create.mock.calls;

      // Should have 3 calls for RabbitMQ, Pulsar, and Kafka
      expect(calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should use environment credentials for RabbitMQ', () => {
      process.env['RABBITMQ_USER'] = 'admin';
      process.env['RABBITMQ_PASS'] = 'secret123';

      mockedAxios.create.mockClear();

      const testCollector = new BrokerMetricsCollector();

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: {
            username: 'admin',
            password: 'secret123',
          },
        }),
      );
      expect(testCollector).toBeTruthy();
    });

    it('should use default credentials when environment variables not set', () => {
      delete process.env['RABBITMQ_USER'];
      delete process.env['RABBITMQ_PASS'];

      mockedAxios.create.mockClear();

      const testCollector = new BrokerMetricsCollector();

      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: {
            username: 'guest',
            password: 'guest',
          },
        }),
      );
      expect(testCollector).toBeTruthy();
    });
  });
});
