import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BrokerComparisonComponent } from './broker-comparison.component';
import { SystemMetricsChartComponent } from './system-metrics-chart.component';
import { BrokerDataService } from './services/broker-data.service';
import { of, throwError } from 'rxjs';
import { Observable } from 'rxjs';
import { BrokerComparisonDTO } from './models/broker-metrics.model';
import { vi } from 'vitest';

describe('BrokerComparisonComponent', () => {
    describe('edge cases for brokerMetrics', () => {
      it('should handle missing brokerMetrics gracefully', () => {
        component.brokerMetrics = null;
        expect(() => component.getDetailedMetricsData()).not.toThrow();
        expect(component.getDetailedMetricsData()).toEqual([]);
      });
      it('should handle malformed brokerMetrics object', () => {
        // @ts-expect-error purposely malformed
        component.brokerMetrics = { bad: 'data' };
        expect(() => component.getDetailedMetricsData()).not.toThrow();
        expect(component.getDetailedMetricsData()).toEqual([]);
      });
    });

    describe('UI status rendering', () => {
      it('should return correct status class for each broker status', () => {
        component.brokerStatuses = { rabbitmq: 'ok', kafka: 'warning', pulsar: 'error' };
        expect(component.getStatusClass('ok')).toBe('status-ok');
        expect(component.getStatusClass('warning')).toBe('status-warning');
        expect(component.getStatusClass('error')).toBe('status-error');
      });
    });

    describe('polling', () => {
      it('should stop polling after ngOnDestroy', async () => {
        vi.useFakeTimers();
        component['startPolling']();
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
        component.ngOnDestroy();
        // Advance time again, should not call getCurrentMetrics again
        serviceMock.getCurrentMetrics.mockClear();
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
        expect(serviceMock.getCurrentMetrics).not.toHaveBeenCalled();
        vi.useRealTimers();
      });
    });

    describe('error messages', () => {
      it('should set error message on loadMetrics failure', () => {
        serviceMock.getCurrentMetrics.mockReturnValueOnce(throwError(() => new Error('API error')));
        component['loadMetrics']();
        expect(component.error).toContain('Failed to load');
      });
      it('should set error message on benchmark failure', () => {
        serviceMock.runBenchmark.mockReturnValueOnce(throwError(() => new Error('Benchmark error')));
        component.runBenchmark();
        expect(component.error).toContain('Benchmark failed');
      });
    });

    describe('runBenchmark button state', () => {
      it('should disable runBenchmark while running', () => {
        component.isBenchmarkRunning = true;
        component.runBenchmark();
        expect(serviceMock.runBenchmark).not.toHaveBeenCalled();
      });
      it('should enable runBenchmark after completion', async () => {
        vi.useFakeTimers();
        // Prevent polling from running timers in this test
        // Mock startPolling to prevent timers; no-op function for lint compliance
        vi.spyOn(component as any, 'startPolling').mockImplementation(function startPollingNoop() {/* intentionally empty for test */});
        // Patch the mock to complete asynchronously using setTimeout
        serviceMock.runBenchmark.mockReturnValueOnce(new Observable((sub: any) => {
          setTimeout(() => { sub.next({}); sub.complete(); }, 1);
        }));
        component.runBenchmark();
        // Should be true immediately after starting
        expect(component.isBenchmarkRunning).toBe(true);
        vi.advanceTimersByTime(300);
        await Promise.resolve();
        expect(component.isBenchmarkRunning).toBe(false);
        vi.useRealTimers();
      });
    });
  let component: BrokerComparisonComponent;
  let fixture: ComponentFixture<BrokerComparisonComponent>;
  let serviceMock: any;

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

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    serviceMock = {
      getCurrentMetrics: vi.fn().mockReturnValue(of(mockBrokerData)),
      getWarmStartMetrics: vi.fn().mockReturnValue(null),
      getSystemMetrics: vi.fn().mockReturnValue(of({
        timestamp: new Date(),
        cpu: { usage: 25 },
        memory: { percentage: 42 },
        disk: { percentage: 18 },
      })),
      getHistoricalMetrics: vi.fn().mockReturnValue(of({ timeRange: {}, samples: [] })),
      runBenchmark: vi.fn().mockReturnValue(of({})),
      getHealth: vi.fn().mockReturnValue(of({})),
    } as any;

    await TestBed.configureTestingModule({
      declarations: [BrokerComparisonComponent, SystemMetricsChartComponent],
      imports: [
        CommonModule,
        HttpClientModule,
        MatTableModule,
        MatButtonModule,
        MatCardModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatToolbarModule,
        MatIconModule,
        MatTooltipModule,
      ],
      providers: [
        { provide: BrokerDataService, useValue: serviceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BrokerComparisonComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fixture.destroy();
  });

  describe('ngOnInit', () => {
    it('should load metrics on initialize', () => {
      fixture.detectChanges();

      expect(serviceMock.getCurrentMetrics).toHaveBeenCalled();
      expect(component.brokerMetrics).toEqual(mockBrokerData);
    });

    it('should start polling on initialize', async () => {
      vi.useFakeTimers();
      fixture.detectChanges();
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
      expect(serviceMock.getCurrentMetrics).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should set loading state', () => {
      expect(component.isLoading).toBe(false);

      fixture.detectChanges();

      expect(component.isLoading).toBe(false);
      expect(component.brokerMetrics).toBeTruthy();
    });

    it('should hydrate warm-start metrics before live fetch', () => {
      serviceMock.getWarmStartMetrics.mockReturnValue(mockBrokerData);

      fixture.detectChanges();

      expect(serviceMock.getWarmStartMetrics).toHaveBeenCalled();
      expect(component.brokerMetrics).toEqual(mockBrokerData);
      expect(component.isLoading).toBe(false);
    });
  });

  describe('loadMetrics', () => {
    it('should update broker metrics', () => {
      component['loadMetrics']();

      expect(component.brokerMetrics).toEqual(mockBrokerData);
    });

    it('should update last refresh timestamp', () => {
      component['loadMetrics']();

      expect(component.lastRefresh).toBeTruthy();
      expect(component.lastRefresh instanceof Date).toBe(true);
    });

    it('should update broker statuses', () => {
      component['loadMetrics']();

      expect(component.brokerStatuses).toBeDefined();
      expect(component.brokerStatuses['rabbitmq']).toBe('ok');
      expect(component.brokerStatuses['kafka']).toBe('ok');
      expect(component.brokerStatuses['pulsar']).toBe('ok');
    });

    it('should handle load errors', () => {
      serviceMock.getCurrentMetrics.mockReturnValueOnce(
        throwError(() => new Error('API error')),
      );

      component['loadMetrics']();

      expect(component.error).toBeTruthy();
      expect(component.error).toContain('Failed to load');
    });
  });

  describe('startPolling', () => {
    it('should refresh metrics at regular intervals', async () => {
      vi.useFakeTimers();
      component['startPolling']();
      // Should not be called immediately
      expect(serviceMock.getCurrentMetrics).not.toHaveBeenCalled();
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
      expect(serviceMock.getCurrentMetrics).toHaveBeenCalled();
      component.ngOnDestroy();
      vi.useRealTimers();
    });

    it('should handle polling errors gracefully', async () => {
      vi.useFakeTimers();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      serviceMock.getCurrentMetrics.mockReturnValue(
        throwError(() => new Error('Poll error')),
      );
      component['startPolling']();
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
      expect(component).toBeTruthy();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('refreshMetrics', () => {
    it('should manually refresh metrics', () => {
      component.refreshMetrics();

      expect(serviceMock.getCurrentMetrics).toHaveBeenCalled();
    });

    it('should clear previous error on refresh', () => {
      component.error = 'Previous error';
      component.refreshMetrics();

      // Error should be cleared
      expect(component.error).toBe(null);
    });
  });

  describe('runBenchmark', () => {
    it('should trigger benchmark and update state', async () => {
      vi.useFakeTimers();
      component.runBenchmark();

      expect(serviceMock.runBenchmark).toHaveBeenCalled();
      expect(component.isBenchmarkRunning).toBe(true);
      vi.advanceTimersByTime(300);
      await Promise.resolve();
      expect(component.isBenchmarkRunning).toBe(false);
      vi.useRealTimers();
    });

    it('should prevent concurrent benchmarks', () => {
      component.isBenchmarkRunning = true;
      component.runBenchmark();

      // Should not call service if already running
      expect(serviceMock.runBenchmark).not.toHaveBeenCalled();
    });

    it('should reload metrics after benchmark', async () => {
      vi.useFakeTimers();
      component.runBenchmark();
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      expect(serviceMock.getCurrentMetrics).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });

  describe('runStressTest', () => {
    it('should trigger stress test with stressTest=true parameter', async () => {
      vi.useFakeTimers();
      component.runStressTest();

      expect(serviceMock.runBenchmark).toHaveBeenCalledWith(true, 5000000, {
        brokers: ['rabbitmq', 'kafka', 'pulsar'],
        payloadKb: 64,
        inflight: 3000,
        trials: 5,
        seed: 42,
        measuredOnly: true,
      });
      expect(component.isBenchmarkRunning).toBe(true);
      vi.advanceTimersByTime(300);
      await Promise.resolve();
      expect(component.isBenchmarkRunning).toBe(false);
      vi.useRealTimers();
    });

    it('should prevent concurrent stress tests', () => {
      component.isBenchmarkRunning = true;
      component.runStressTest();

      expect(serviceMock.runBenchmark).not.toHaveBeenCalled();
    });

    it('should reload metrics after longer delay for stress test', async () => {
      vi.useFakeTimers();
      component.runStressTest();
      vi.advanceTimersByTime(10000);
      await Promise.resolve();
      expect(serviceMock.getCurrentMetrics).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('should handle stress test errors', () => {
      vi.useFakeTimers();
      serviceMock.runBenchmark.mockReturnValueOnce(throwError(() => new Error('Stress test failed')));
      component.runStressTest();
      vi.advanceTimersByTime(300);

      expect(component.error).toContain('Stress test failed');
      expect(component.isBenchmarkRunning).toBe(false);
      vi.useRealTimers();
    });
  });

  describe('formatting methods', () => {
    it('should format throughput correctly', () => {
      const formatted = component.formatThroughput(1500);
      expect(formatted).toContain('1,500');
      expect(formatted).toContain('msg/s');
    });

    it('should format latency correctly', () => {
      const formatted = component.formatLatency(9.5);
      expect(formatted).toBe('9.50 ms');
    });

    it('should format memory correctly', () => {
      const formatted = component.formatMemory(256.7);
      expect(formatted).toBe('256.7 MB');
    });

    it('should handle undefined values', () => {
      expect(component.formatThroughput(undefined)).toBe('N/A');
      expect(component.formatLatency(undefined)).toBe('N/A');
      expect(component.formatMemory(undefined)).toBe('N/A');
    });
  });

  describe('status classes', () => {
    it('should return correct status class', () => {
      expect(component.getStatusClass('ok')).toBe('status-ok');
      expect(component.getStatusClass('warning')).toBe('status-warning');
      expect(component.getStatusClass('error')).toBe('status-error');
    });

    it('should return improvement class for positive values', () => {
      const cls = component.getImprovementClass('+20%');
      expect(cls).toContain('positive');
    });

    it('should return improvement class for negative values', () => {
      const cls = component.getImprovementClass('-10%');
      expect(cls).toContain('negative');
    });

    it('should generate throughput wording for positive and negative deltas', () => {
      expect(component.getThroughputSummaryText('+10.0%')).toContain('faster');
      expect(component.getThroughputSummaryText('-10.0%')).toContain('slower');
    });

    it('should generate latency wording for positive and negative deltas', () => {
      expect(component.getLatencySummaryText('+10.0%')).toContain('higher latency (worse)');
      expect(component.getLatencySummaryText('-10.0%')).toContain('lower latency (better)');
    });
  });

  describe('getDetailedMetricsData', () => {
    it('should build metrics table data', () => {
      component.brokerMetrics = mockBrokerData;
      const data = component.getDetailedMetricsData();

      expect(data.length).toBeGreaterThan(0);
      expect(data[0]).toHaveProperty('metric');
      expect(data[0]).toHaveProperty('rabbitmq');
      expect(data[0]).toHaveProperty('kafka');
      expect(data[0]).toHaveProperty('pulsar');
    });

    it('should return empty array when no metrics', () => {
      component.brokerMetrics = null;
      const data = component.getDetailedMetricsData();

      expect(data).toEqual([]);
    });

    it('should include throughput row', () => {
      component.brokerMetrics = mockBrokerData;
      const data = component.getDetailedMetricsData();
      const throughputRow = data.find((d) => d.metric.includes('Throughput'));

      expect(throughputRow).toBeTruthy();
    });

    it('should include latency row', () => {
      component.brokerMetrics = mockBrokerData;
      const data = component.getDetailedMetricsData();
      const latencyRow = data.find((d) => d.metric.includes('Latency'));

      expect(latencyRow).toBeTruthy();
    });

    it('should append metric quality tags in detail rows', () => {
      component.brokerMetrics = {
        ...mockBrokerData,
        brokers: {
          ...mockBrokerData.brokers,
          rabbitmq: {
            ...mockBrokerData.brokers.rabbitmq,
            dataSource: 'measured',
            metricQuality: { messagesPerSecond: 'measured' },
          },
          pulsar: {
            ...mockBrokerData.brokers.pulsar,
            dataSource: 'fallback',
            metricQuality: { messagesPerSecond: 'fallback' },
          },
        },
      } as any;

      const data = component.getDetailedMetricsData();
      const throughputRow = data.find((d) => d.metric.includes('Throughput'));
      expect(throughputRow?.rabbitmq).toContain('(measured)');
      expect(throughputRow?.pulsar).toContain('(fallback)');
    });
  });

  describe('ngOnDestroy', () => {
    it('should complete destroy subject on destroy', () => {
      const destroySpy = vi.spyOn(
        component['destroy$'],
        'next',
      );

      component.ngOnDestroy();

      expect(destroySpy).toHaveBeenCalled();
    });

    it('should unsubscribe from polling', async () => {
      vi.useFakeTimers();
      component['startPolling']();
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
      component.ngOnDestroy();
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
      expect(component).toBeTruthy();
      vi.useRealTimers();
    });
  });

  describe('broker status updates', () => {
    it('should update status to error when broker disconnected', () => {
      const disconnectedData = {
        ...mockBrokerData,
        brokers: {
          ...mockBrokerData.brokers,
          rabbitmq: { ...mockBrokerData.brokers.rabbitmq, connected: false },
        },
      };

      component.brokerMetrics = disconnectedData;
      component['updateBrokerStatuses']();

      expect(component.brokerStatuses['rabbitmq']).toBe('error');
    });

    it('should handle missing pulsar gracefully', () => {
      const dataNoPulsar = {
        ...mockBrokerData,
        brokers: {
          rabbitmq: mockBrokerData.brokers.rabbitmq,
          kafka: mockBrokerData.brokers.kafka,
        },
      };

      component.brokerMetrics = dataNoPulsar;
      component['updateBrokerStatuses']();

      expect(component.brokerStatuses['pulsar']).toBe('error');
    });

    it('should toggle broker feed state from tile action', () => {
      expect(component.isBrokerFeedEnabled('kafka')).toBe(true);
      component.toggleBrokerFeed('kafka');
      expect(component.isBrokerFeedEnabled('kafka')).toBe(false);
    });
    it('should prevent enabling feed when broker status is error and show snackbar', () => {
      // make kafka unavailable
      component.brokerStatuses = { rabbitmq: 'ok', kafka: 'error', pulsar: 'ok' } as any;
      // ensure feed starts OFF for test
      component.brokerFeedEnabled['kafka'] = false;

      // spy on snackBar
      const snackSpy = vi.spyOn((component as any).snackBar, 'open');

      component.toggleBrokerFeed('kafka');

      expect(component.isBrokerFeedEnabled('kafka')).toBe(false);
      expect(snackSpy).toHaveBeenCalledWith('Broker unavailable — feed is disabled until connectivity is restored', 'OK', { duration: 4000 });
    });

    it('should render disabled tile button when broker status is error', () => {
      // ensure component initialized (ngOnInit may overwrite brokerStatuses)
      // arrange: make broker service return a disconnected RabbitMQ on initial load
      const disconnectedData = {
        ...mockBrokerData,
        brokers: { ...mockBrokerData.brokers, rabbitmq: { ...mockBrokerData.brokers.rabbitmq, connected: false } },
      } as any;
      serviceMock.getCurrentMetrics.mockReturnValueOnce(of(disconnectedData));

      // act
      fixture.detectChanges();

      // assert
      const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.status-item');
      const rabbitBtn = buttons[0];
      expect(rabbitBtn.classList.contains('status-error')).toBe(true);

      // clicking should not enable the feed and should show a snackbar (behavioral check)
      const snackSpy = vi.spyOn((component as any).snackBar, 'open');
      component.toggleBrokerFeed('rabbitmq');
      expect(snackSpy).toHaveBeenCalledWith('Broker unavailable — feed is disabled until connectivity is restored', 'OK', { duration: 4000 });
      expect(component.isBrokerFeedEnabled('rabbitmq')).toBe(false);
    });  });

  describe('last refresh text', () => {
    it('should show "Never" when no refresh yet', () => {
      component.lastRefresh = null;
      expect(component.getLastRefreshText()).toBe('Never');
    });

    it('should show "Just now" for recent refresh', () => {
      component.lastRefresh = new Date();
      expect(component.getLastRefreshText()).toBe('Just now');
    });

    it('should show minutes ago', async () => {
      vi.useFakeTimers();
      component.lastRefresh = new Date(Date.now() - 5 * 60 * 1000);
      vi.advanceTimersByTime(0);
      await Promise.resolve();
      const text = component.getLastRefreshText();
      expect(text).toContain('m ago');
      vi.useRealTimers();
    });
  });

  describe('data quality view state', () => {
    it('should set data quality banner when fallback data is present', () => {
      component.brokerMetrics = {
        ...mockBrokerData,
        dataQuality: {
          hasFallbackData: true,
          measuredBrokers: ['rabbitmq'],
          fallbackBrokers: ['pulsar'],
          summary: 'fallback active',
        },
      } as any;

      component['updateCurrentFindings']();
      expect(component.dataQualityBanner).toContain('fallback/simulated metrics detected');
      expect(component.currentFindings.join(' ')).toContain('dynamic polling every 5s');
    });
  });
});
