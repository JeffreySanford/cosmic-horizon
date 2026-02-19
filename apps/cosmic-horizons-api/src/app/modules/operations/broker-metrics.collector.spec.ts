import { Test, TestingModule } from '@nestjs/testing';
import { BrokerMetricsCollector } from './broker-metrics.collector';
import axios from 'axios';
import { Kafka } from 'kafkajs';

afterEach(async () => {
  // restore any Kafka.prototype.admin spy used in tests
  try { (Kafka.prototype as any).admin.mockRestore(); } catch (e) { /* ignore */ }
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

jest.mock('axios');

describe('BrokerMetricsCollector', () => {
  let service: BrokerMetricsCollector;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env['RABBITMQ_USER'] = 'guest';
    process.env['RABBITMQ_PASS'] = 'guest';
    process.env['PULSAR_ENABLED'] = 'true';

    // Global kafkajs admin mock to prevent real broker connections in CI
    const adminMock = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
    } as any;
    jest.spyOn(Kafka.prototype as any, 'admin').mockImplementation(() => adminMock);

    testingModule = await Test.createTestingModule({
      providers: [BrokerMetricsCollector],
    }).compile();

    service = testingModule.get<BrokerMetricsCollector>(BrokerMetricsCollector);
  });

  describe('collectAllMetrics', () => {
    it('should collect metrics from all brokers in parallel', async () => {
      mockedAxios.create.mockReturnValue({
        // return a resolved response for any GET so the REST-proxy path is exercised
        get: jest.fn().mockResolvedValue({ data: {} }),
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

      const testCollector = new BrokerMetricsCollector();
      // ensure Kafka path also fails deterministically (don't rely on native path)
      jest
        .spyOn(testCollector as any, 'collectKafkaMetrics')
        .mockRejectedValue(new Error('Connection refused'));

      const result = await testCollector.collectAllMetrics();

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

    it('should compute RabbitMQ messagesPerSecond as a delta/sec between samples', async () => {
      // Fake time so we can assert rate calculation deterministically
      jest.useFakeTimers();
      const t0 = 1_600_000_000_000; // arbitrary timestamp
      jest.setSystemTime(t0);

      // Mock axios client used by collector
      const getMock = jest.fn().mockImplementation((path: string) => {
        if (path === '/api/overview') {
          return Promise.resolve({
            data: {
              queue_totals: { messages_ready: 50, messages_unacked: 50 },
            },
          });
        }
        if (path === '/api/nodes') {
          return Promise.resolve({
            data: [{ memory: { used: 1024 * 1024 * 200 }, uptime: 3600000 }],
          });
        }
        // default for other endpoints
        return Promise.resolve({ data: {} });
      });

      mockedAxios.create.mockReturnValue({ get: getMock } as any);

      const testCollector = new BrokerMetricsCollector();

      // First sample: no previous snapshot -> do not report a rate (messagesPerSecond undefined)
      const first = await (testCollector as any).collectRabbitMQMetrics();
      expect(first.messagesPerSecond).toBeUndefined();

      // Advance time and change queue depth to simulate throughput
      jest.setSystemTime(t0 + 2000); // +2s
      getMock.mockImplementation((path: string) => {
        if (path === '/api/overview') {
          return Promise.resolve({
            data: {
              queue_totals: { messages_ready: 300, messages_unacked: 0 },
            },
          });
        }
        if (path === '/api/nodes') {
          return Promise.resolve({
            data: [{ memory: { used: 1024 * 1024 * 210 }, uptime: 3602000 }],
          });
        }
        return Promise.resolve({ data: {} });
      });

      const second = await (testCollector as any).collectRabbitMQMetrics();
      // delta = 300 - 100 = 200 messages over 2 seconds => ~100 msg/s
      expect(second.messagesPerSecond).toBeGreaterThanOrEqual(99);
      expect(second.messagesPerSecond).toBeLessThanOrEqual(101);

      jest.useRealTimers();
    });

    it('should mark Kafka metrics as fallback when using placeholder stats', async () => {
      const getMock = jest.fn().mockImplementation((path: string) => {
        if (path === '/api/overview') {
          return Promise.resolve({
            data: { queue_totals: { messages_ready: 0, messages_unacked: 0 } },
          });
        }
        if (path === '/api/nodes') {
          return Promise.resolve({
            data: [{ memory: { used: 1024 * 1024 * 100 }, uptime: 3600000 }],
          });
        }
        if (path === '/brokers') {
          return Promise.resolve({ data: { brokers: [{ id: 1 }] } });
        }
        if (path === '/topics') {
          return Promise.resolve({ data: { topics: [] } });
        }
        return Promise.resolve({ data: {} });
      });

      mockedAxios.create.mockReturnValue({ get: getMock } as any);

      const testCollector = new BrokerMetricsCollector();
      const result = await testCollector.collectAllMetrics();

      expect(result.kafka.dataSource).toBe('fallback');
      expect(result.kafka.metricQuality?.messagesPerSecond).toBe('fallback');
    });

    it('should treat zero/insufficient Pulsar /metrics as missing and fall back to simulated metrics', async () => {
      const getMock = jest.fn().mockImplementation((path: string) => {
        if (path === '/admin/v2/brokers') {
          return Promise.resolve({ data: ['localhost:8080'] });
        }
        if (path.startsWith('/admin/v2/brokers/standalone')) {
          return Promise.reject({ message: 'status code 404' });
        }
        if (path === '/metrics') {
          // Provide metrics with zeros and tiny memory so parser should treat as no measured signal
          return Promise.resolve({
            data: 'pulsar_publish_rate 0\nprocess_resident_memory_bytes 512\n',
          });
        }
        if (path === '/api/overview') {
          return Promise.resolve({
            data: { queue_totals: { messages_ready: 0, messages_unacked: 0 } },
          });
        }
        if (path === '/api/nodes') {
          return Promise.resolve({
            data: [{ memory: { used: 1024 * 1024 * 100 }, uptime: 3600000 }],
          });
        }
        return Promise.resolve({ data: {} });
      });

      mockedAxios.create.mockReturnValue({ get: getMock } as any);

      const testCollector = new BrokerMetricsCollector();
      const result = await testCollector.collectAllMetrics();

      expect(result.pulsar?.dataSource).toBe('fallback');
      expect(result.pulsar?.metricQuality?.messagesPerSecond).toBe('fallback');
    });

    it('should parse Pulsar /metrics when Prometheus provides non-zero metrics', async () => {
      const metricsText =
        'pulsar_publish_rate 1234\nprocess_resident_memory_bytes 104857600\n';
      const getMock = jest.fn().mockImplementation((path: string) => {
        if (path === '/admin/v2/brokers') {
          return Promise.resolve({ data: ['localhost:8080'] });
        }
        if (path.startsWith('/admin/v2/brokers/standalone')) {
          return Promise.reject({ message: 'status code 404' });
        }
        if (path === '/metrics') {
          return Promise.resolve({ data: metricsText });
        }
        if (path === '/api/overview') {
          return Promise.resolve({
            data: { queue_totals: { messages_ready: 0, messages_unacked: 0 } },
          });
        }
        if (path === '/api/nodes') {
          return Promise.resolve({
            data: [{ memory: { used: 1024 * 1024 * 100 }, uptime: 3600000 }],
          });
        }
        return Promise.resolve({ data: {} });
      });

      mockedAxios.create.mockReturnValue({ get: getMock } as any);
      const testCollector = new BrokerMetricsCollector();
      const result = await testCollector.collectAllMetrics();

      expect(result.pulsar?.dataSource).toBe('measured');
      expect(result.pulsar?.messagesPerSecond).toBe(1234);
      expect(result.pulsar?.memoryUsageMb).toBeGreaterThan(0);
    });

    it('should compute Kafka messagesPerSecond using native admin offsets when REST proxy is unavailable', async () => {
      jest.useFakeTimers();
      const t0 = 1_700_000_000_000;
      jest.setSystemTime(t0);

      // Force REST proxy path to fail
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('not found')),
      } as any);

      // Stub out the admin topic/offset reads on the collector instance
      const testCollector = new BrokerMetricsCollector();

      // Mock kafkajs admin to prevent CI from attempting real broker connections
      const adminMock = {
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
      } as any;
      jest.spyOn(Kafka.prototype as any, 'admin').mockImplementation(() => adminMock);

      const topicsSpy = jest
        .spyOn(testCollector as any, 'fetchTopicsForNative')
        .mockResolvedValue(['topicA']);
      const offsetsSpy = jest
        .spyOn(testCollector as any, 'fetchTopicOffsetsForNative')
        .mockResolvedValueOnce([{ partition: 0, offset: '100' }])
        .mockResolvedValueOnce([{ partition: 0, offset: '300' }]);

      // First call: snapshot stored, no rate yet
      const first = await (testCollector as any).collectKafkaMetricsNative();
      expect(first.messagesPerSecond).toBeUndefined();

      // Advance time and second sample
      jest.setSystemTime(t0 + 2000);
      const second = await (testCollector as any).collectKafkaMetricsNative();
      expect(second.messagesPerSecond).toBeGreaterThanOrEqual(99);
      expect(second.messagesPerSecond).toBeLessThanOrEqual(101);

      (Kafka.prototype as any).admin.mockRestore();
      topicsSpy.mockRestore();
      offsetsSpy.mockRestore();
      jest.useRealTimers();
    });

    it('should parse Kafka /metrics when Prometheus provides quantile p99', async () => {
      // Provide a KAFKA_METRICS_URL so collector uses axios.get() for Prometheus scrape
      process.env['KAFKA_METRICS_URL'] = 'http://localhost:9404/metrics';
      const metricsText =
        'kafka_request_latency_seconds{quantile="0.99"} 0.0123\n';

      // axios.get should return the metrics text for the configured URL
      (mockedAxios.get as jest.Mock).mockImplementation((url: string) => {
        if (url === process.env['KAFKA_METRICS_URL']) {
          return Promise.resolve({ data: metricsText });
        }
        return Promise.resolve({ data: '' });
      });

      // Force REST proxy path to fail so native path is exercised and collectKafkaMetricsFromPrometheus() is invoked
      mockedAxios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('not found')),
      } as any);

      const testCollector = new BrokerMetricsCollector();

      // Stub native admin topic/offset reads
      const topicsSpy = jest
        .spyOn(testCollector as any, 'fetchTopicsForNative')
        .mockResolvedValue(['topicA']);
      const offsetsSpy = jest
        .spyOn(testCollector as any, 'fetchTopicOffsetsForNative')
        .mockResolvedValueOnce([{ partition: 0, offset: '100' }])
        .mockResolvedValueOnce([{ partition: 0, offset: '200' }]);

      const result = await (testCollector as any).collectKafkaMetricsNative();

      expect(result.p99LatencyMs).toBeGreaterThan(0);
      expect(result.metricQuality?.p99LatencyMs).toBe('measured');

      topicsSpy.mockRestore();
      offsetsSpy.mockRestore();
      delete process.env['KAFKA_METRICS_URL'];
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
