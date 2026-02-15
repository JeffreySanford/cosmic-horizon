import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BrokerDataService } from './broker-data.service';
import { BrokerComparisonDTO } from '../models/broker-metrics.model';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('BrokerDataService', () => {
  let service: BrokerDataService;
  let httpMock: HttpTestingController;

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
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [BrokerDataService],
    });

    service = TestBed.inject(BrokerDataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
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
  });

  describe('getHealth', () => {
    it('should fetch broker health status', () => {
      const mockHealth = {
        rabbitmq: 'ok',
        kafka: 'ok',
        pulsar: 'ok',
      };

      service.getHealth().subscribe((data) => {
        expect(data).toEqual(mockHealth);
      });

      const req = httpMock.expectOne('/api/internal/brokers/health');
      expect(req.request.method).toBe('GET');
      req.flush(mockHealth);
    });

    it('should return health object with broker statuses', () => {
      const mockHealth = {
        rabbitmq: 'ok',
        kafka: 'unavailable',
        pulsar: 'ok',
      };

      service.getHealth().subscribe((data) => {
        expect(Object.keys(data)).toContain('rabbitmq');
        expect(Object.keys(data)).toContain('kafka');
        expect(Object.keys(data)).toContain('pulsar');
      });

      const req = httpMock.expectOne('/api/internal/brokers/health');
      req.flush(mockHealth);
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
});
