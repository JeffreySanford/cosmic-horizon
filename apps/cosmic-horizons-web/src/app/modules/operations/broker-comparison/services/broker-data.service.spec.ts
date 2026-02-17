import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BrokerDataService } from './broker-data.service';
import { BrokerComparisonDTO } from '../models/broker-metrics.model';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('BrokerDataService', () => {
  let service: BrokerDataService;
  let httpMock: HttpTestingController;
  const warmStartCacheKey = 'broker-comparison:last-metrics';

  const mockBrokerData: BrokerComparisonDTO = {
    timestamp: new Date(),
    brokers: {
      rabbitmq: {
        connected: true,
        messagesPerSecond: 1000,
        p99LatencyMs: 10,
        memoryUsageMb: 256,
        cpuPercentage: 25,
        connectionCount: 5,
        uptime: '24h',
      },
      kafka: {
        connected: true,
        messagesPerSecond: 1500,
        p99LatencyMs: 8,
        memoryUsageMb: 512,
        cpuPercentage: 30,
        connectionCount: 10,
        uptime: '24h',
      },
      pulsar: {
        connected: true,
        messagesPerSecond: 1200,
        p99LatencyMs: 9,
        memoryUsageMb: 384,
        cpuPercentage: 28,
        connectionCount: 8,
        uptime: '24h',
      },
    },
    comparison: {
      throughputImprovement: '+20%',
      latencyImprovement: '-10%',
      memoryEfficiency: '+15%',
    },
  };

  beforeEach(() => {
    localStorage.removeItem(warmStartCacheKey);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [BrokerDataService],
    });

    service = TestBed.inject(BrokerDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(warmStartCacheKey);
  });

  describe('getCurrentMetrics', () => {
    it('should fetch current broker metrics', () => {
      service.getCurrentMetrics().subscribe((data) => {
        expect(data).toEqual(mockBrokerData);
        expect(data.brokers.rabbitmq.connected).toBe(true);
      });

      const req = httpMock.expectOne('/api/internal/brokers/stats');
      expect(req.request.method).toBe('GET');
      req.flush(mockBrokerData);
    });

    it('should use correct API endpoint', () => {
      service.getCurrentMetrics().subscribe(() => {
        expect(true).toBe(true);
      });

      const req = httpMock.expectOne('/api/internal/brokers/stats');
      expect(req.request.url).toContain('/api/internal/brokers/stats');
      req.flush(mockBrokerData);
    });

    it('should include forceRefresh query when requested', () => {
      service.getCurrentMetrics(true).subscribe(() => {
        expect(true).toBe(true);
      });

      const req = httpMock.expectOne((request) =>
        request.url === '/api/internal/brokers/stats' &&
        request.params.get('forceRefresh') === 'true',
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockBrokerData);
    });

    it('should handle API errors', () => {
      let errorOccurred = false;

      service.getCurrentMetrics().subscribe(
        () => {
          expect(false).toBe(true); // Force failure
        },
        (error) => {
          errorOccurred = true;
          expect(error.status).toBe(500);
        },
      );

      const req = httpMock.expectOne('/api/internal/brokers/stats');
      req.flush('Server error', { status: 500, statusText: 'Server Error' });
      expect(errorOccurred).toBe(true);
    });
  });

  describe('getHistoricalMetrics', () => {
    it('should fetch historical metrics with default hours', () => {
      const mockHistory = {
        timeRange: {
          start: new Date(),
          end: new Date(),
        },
        samples: [mockBrokerData],
      };

      service.getHistoricalMetrics().subscribe((data) => {
        expect(data.samples).toBeDefined();
      });

      const req = httpMock.expectOne((request) =>
        request.url.includes('/api/internal/brokers/history') &&
        request.params.get('hours') === '24',
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockHistory);
    });

    it('should accept custom hours parameter', () => {
      const mockHistory = {
        timeRange: { start: new Date(), end: new Date() },
        samples: [],
      };

      service.getHistoricalMetrics(48).subscribe(() => {
        expect(true).toBe(true);
      });

      const req = httpMock.expectOne((request) =>
        request.url.includes('/api/internal/brokers/history') &&
        request.params.get('hours') === '48',
      );
      req.flush(mockHistory);
    });

    it('should include query parameters in request', () => {
      const mockHistory = {
        timeRange: { start: new Date(), end: new Date() },
        samples: [],
      };

      service.getHistoricalMetrics(72).subscribe(() => {
        expect(true).toBe(true);
      });

      const req = httpMock.expectOne((request) => {
        const hours = request.params.get('hours');
        return request.url.includes('/api/internal/brokers/history') && hours === '72';
      });
      const httpParams = req.request.params;
      expect(httpParams.get('hours')).toBe('72');
      req.flush(mockHistory);
    });
  });

  describe('runBenchmark', () => {
    it('should POST to benchmark endpoint', () => {
      const mockResult = {
        status: 'queued',
        jobId: 'bm-123',
        estimatedDurationSeconds: 60,
      };

      service.runBenchmark().subscribe((data) => {
        expect(data.status).toBe('queued');
      });

      const req = httpMock.expectOne('/api/internal/brokers/benchmark');
      expect(req.request.method).toBe('POST');
      req.flush(mockResult);
    });

    it('should send empty body for benchmark request', () => {
      service.runBenchmark().subscribe(() => {
        expect(true).toBe(true);
      });

      const req = httpMock.expectOne('/api/internal/brokers/benchmark');
      expect(req.request.body).toEqual({});
      req.flush({ status: 'queued', jobId: 'bm-123', estimatedDurationSeconds: 60 });
    });

    it('should handle benchmark errors', () => {
      let errorOccurred = false;

      service.runBenchmark().subscribe(
        () => {
          expect(false).toBe(true); // Force failure
        },
        (error) => {
          errorOccurred = true;
          expect(error.status).toBe(409);
        },
      );

      const req = httpMock.expectOne('/api/internal/brokers/benchmark');
      req.flush('Benchmark already running', {
        status: 409,
        statusText: 'Conflict',
      });
      expect(errorOccurred).toBe(true);
    });

    it('should include advanced benchmark options in query params', () => {
      service.runBenchmark(true, 5000000, {
        brokers: ['rabbitmq', 'pulsar'],
        payloadKb: 64,
        inflight: 3000,
        trials: 5,
        seed: 42,
        measuredOnly: true,
      }).subscribe(() => {
        expect(true).toBe(true);
      });

      const req = httpMock.expectOne((request) =>
        request.url === '/api/internal/brokers/benchmark' &&
        request.params.get('stressTest') === 'true' &&
        request.params.get('messageCount') === '5000000' &&
        request.params.get('brokers') === 'rabbitmq,pulsar' &&
        request.params.get('payloadKb') === '64' &&
        request.params.get('inflight') === '3000' &&
        request.params.get('trials') === '5' &&
        request.params.get('seed') === '42' &&
        request.params.get('measuredOnly') === 'true',
      );
      expect(req.request.method).toBe('POST');
      req.flush({ status: 'queued', jobId: 'bm-123', estimatedDurationSeconds: 60 });
    });

    it('should include measuredOnly=false when explicitly disabled', () => {
      service.runBenchmark(false, 10000, {
        brokers: ['rabbitmq', 'pulsar'],
        measuredOnly: false,
      }).subscribe(() => {
        expect(true).toBe(true);
      });

      const req = httpMock.expectOne((request) =>
        request.url === '/api/internal/brokers/benchmark' &&
        request.params.get('measuredOnly') === 'false',
      );
      expect(req.request.method).toBe('POST');
      req.flush({ status: 'queued', jobId: 'bm-456', estimatedDurationSeconds: 20 });
    });
  });

  describe('API_BASE constant', () => {
    it('should use correct base URL', () => {
      service.getCurrentMetrics().subscribe(() => {
        expect(true).toBe(true);
      });

      const req = httpMock.expectOne('/api/internal/brokers/stats');
      expect(req.request.url).toBe('/api/internal/brokers/stats');
      req.flush(mockBrokerData);
    });
  });

  describe('warm start cache', () => {
    it('should cache latest metrics for warm start on successful fetch', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      service.getCurrentMetrics().subscribe(() => {
        const warm = service.getWarmStartMetrics();
        expect(warm).toBeTruthy();
        expect(warm?.brokers.rabbitmq.messagesPerSecond).toBe(1000);
        expect(setItemSpy).toHaveBeenCalled();
      });

      const req = httpMock.expectOne('/api/internal/brokers/stats');
      req.flush(mockBrokerData);
      setItemSpy.mockRestore();
    });

    it('should hydrate warm start metrics from localStorage', () => {
      localStorage.setItem(
        warmStartCacheKey,
        JSON.stringify({
          cachedAt: Date.now(),
          data: {
            ...mockBrokerData,
            timestamp: new Date().toISOString(),
          },
        }),
      );

      const warm = service.getWarmStartMetrics();
      expect(warm).toBeTruthy();
      expect(warm?.timestamp instanceof Date).toBe(true);
      expect(warm?.brokers.kafka.connected).toBe(true);
    });
  });
});
