import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  OnDestroy,
  inject,
  ViewChild,
  NgZone,
  HostListener,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { interval, Subject, takeUntil } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { BrokerDataService, BenchmarkBroker } from './services/broker-data.service';
import { BenchmarkResult, BrokerComparisonDTO, BrokerMetricsDTO, SystemMetrics } from './models/broker-metrics.model';
import { SystemMetricsChartComponent } from './system-metrics-chart.component';

type BrokerKey = 'rabbitmq' | 'kafka' | 'pulsar';
type MetricKey = 'messagesPerSecond' | 'p99LatencyMs' | 'memoryUsageMb' | 'cpuPercentage' | 'connectionCount' | 'uptime';

/**
 * BrokerComparisonComponent
 *
 * Real-time dashboard for comparing broker performance metrics.
 * Displays RabbitMQ vs Pulsar vs Kafka statistics with live updates.
 *
 * Route: /operations/broker-comparison
 * Phase 3.5: Used during Pulsar evaluation benchmarking
 */
@Component({
  selector: 'app-broker-comparison',
  standalone: false,
  templateUrl: './broker-comparison.component.html',
  styleUrls: ['./broker-comparison.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrokerComparisonComponent implements OnInit, OnDestroy {
  private static readonly STRESS_TEST_MESSAGE_COUNT = 5000000;
  private static readonly BENCHMARK_RESET_DELAY_MS = 250;
  private static readonly UI_UPDATE_DELAY_MS = 0;

  brokerMetrics: BrokerComparisonDTO | null = null;
  detailedMetricsData: Array<{
    metric: string;
    rabbitmq: string | undefined;
    pulsar: string | undefined;
    kafka: string | undefined;
    improvement: string | undefined;
  }> = [];
  currentFindings: string[] = [];
  isLoading = false;
  error: string | null = null;
  lastRefresh: Date | null = null;
  lastRefreshLabel = 'Never';
  isBenchmarkRunning = false;
  dataQualityBanner: string | null = null;

  displayedColumns: string[] = ['metric', 'rabbitmq', 'pulsar', 'kafka', 'improvement'];
  brokerStatuses: Record<string, 'ok' | 'warning' | 'error'> = {};
  brokerFeedEnabled: Record<BrokerKey, boolean> = {
    rabbitmq: true,
    kafka: true,
    pulsar: true,
  };

  @ViewChild(SystemMetricsChartComponent) systemMetricsChart!: SystemMetricsChartComponent;

  private destroy$ = new Subject<void>();
  private pollInterval$ = interval(5000); // Refresh every 5 seconds
  private systemMetricsInterval$ = interval(2000); // System metrics every 2 seconds

  private readonly brokerDataService = inject(BrokerDataService);
  private readonly ngZone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly snackBar = inject(MatSnackBar);
  private readonly isTestEnvironment =
    (typeof process !== 'undefined' &&
      typeof process.env !== 'undefined' &&
      process.env['NODE_ENV'] === 'test') ||
    (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent));

  ngOnInit(): void {
    this.hydrateWarmStartMetrics();
    this.loadMetrics();
    this.startPolling();
    this.startSystemMetricsPolling();
  }

  ngOnDestroy(): void {
    this.clearInMemoryDashboardState();
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (typeof document === 'undefined') return;

    if (document.visibilityState === 'hidden') {
      this.clearInMemoryDashboardState();
      return;
    }

    this.refreshMetrics();
  }

  /**
   * Load broker metrics once
   */
  private loadMetrics(forceRefresh = false): void {
    this.setLoading(!this.brokerMetrics);
    this.error = null;
    this.cdr.markForCheck();

    // Keep network callback timing out of Angular's immediate check cycle.
    this.ngZone.runOutsideAngular(() => {
      this.brokerDataService.getCurrentMetrics(forceRefresh).subscribe({
        next: (data: BrokerComparisonDTO) => {
          this.scheduleMetricsStateUpdate(data, true);
        },
        error: (err: unknown) => {
          this.ngZone.run(() => {
            this.error = `Failed to load broker metrics: ${this.getErrorMessage(err)}`;
            this.setLoading(false);
            this.cdr.markForCheck();
          });
        },
      });
    });
  }

  private hydrateWarmStartMetrics(): void {
    const warmStart = this.brokerDataService.getWarmStartMetrics(24 * 60 * 60 * 1000);
    if (!warmStart) {
      return;
    }
    this.scheduleMetricsStateUpdate(warmStart, true);
  }

  /**
   * Set up auto-refresh polling
   */
  private startPolling(): void {
    this.ngZone.runOutsideAngular(() => {
      this.pollInterval$
        .pipe(
          switchMap(() => this.brokerDataService.getCurrentMetrics()),
          takeUntil(this.destroy$),
        )
        .subscribe({
          next: (data: BrokerComparisonDTO) => {
            this.scheduleMetricsStateUpdate(data);
          },
          error: (err: unknown) => {
            console.warn('Polling error:', err);
          },
        });
    });
  }

  private startSystemMetricsPolling(): void {
    // Keep chart-stream updates out of Angular's global CD loop to avoid NG0100
    // on unrelated template bindings (e.g., benchmark button disabled state).
    this.ngZone.runOutsideAngular(() => {
      this.systemMetricsInterval$
        .pipe(
          switchMap(() => this.brokerDataService.getSystemMetrics()),
          takeUntil(this.destroy$),
        )
        .subscribe({
          next: (data: SystemMetrics) => {
            if (this.systemMetricsChart) {
              this.systemMetricsChart.updateData(data);
            }
          },
          error: (err: unknown) => {
            console.warn('System metrics polling error:', err);
          },
        });
    });
  }

  /**
   * Trigger benchmark test
   */
  runBenchmark(): void {
    if (this.isBenchmarkRunning) return;

    this.error = null;
    this.setBenchmarkRunning(true);

    this.brokerDataService.runBenchmark(false, undefined, {
      brokers: this.getSelectedBrokersForRun(),
      payloadKb: 2,
      inflight: 250,
      trials: 3,
      seed: 42,
      measuredOnly: true,
    }).subscribe({
      next: (result: BenchmarkResult) => {
        console.log('Benchmark completed:', result);
        this.clearBenchmarkRunningAsync();
        // Reload metrics after benchmark completes
        setTimeout(() => this.loadMetrics(true), 2000);
      },
      error: (err: unknown) => {
        this.error = `Benchmark failed: ${this.getErrorMessage(err)}`;
        this.clearBenchmarkRunningAsync();
      },
    });
  }

  /**
   * Trigger stress test (high load)
   */
  runStressTest(): void {
    if (this.isBenchmarkRunning) return;

    this.error = null;
    this.setBenchmarkRunning(true);

    this.brokerDataService.runBenchmark(true, BrokerComparisonComponent.STRESS_TEST_MESSAGE_COUNT, {
      brokers: this.getSelectedBrokersForRun(),
      payloadKb: 64,
      inflight: 3000,
      trials: 5,
      seed: 42,
      measuredOnly: true,
    }).subscribe({
      next: (result: BenchmarkResult) => {
        console.log('Stress test completed:', result);
        this.clearBenchmarkRunningAsync();
        // Reload metrics after stress test completes (higher-load test uses longer delay).
        setTimeout(() => this.loadMetrics(true), 10000);
      },
      error: (err: unknown) => {
        this.error = `Stress test failed: ${this.getErrorMessage(err)}`;
        this.clearBenchmarkRunningAsync();
      },
    });
  }

  /**
   * Refresh metrics immediately
   */
  refreshMetrics(): void {
    this.loadMetrics(true);
  }

  toggleBrokerFeed(broker: BrokerKey): void {
    const status = (this.brokerStatuses as Record<string, string>)[broker];

    // Prevent enabling a feed for a broker that is currently unavailable.
    if (status && status !== 'ok') {
      // Ensure feed remains off for unavailable brokers and inform the user.
      this.brokerFeedEnabled[broker] = false;
      this.snackBar.open('Broker unavailable — feed is disabled until connectivity is restored', 'OK', { duration: 4000 });
      return;
    }

    this.brokerFeedEnabled[broker] = !this.brokerFeedEnabled[broker];
    if (!this.brokerFeedEnabled[broker]) {
      this.clearInMemoryDashboardState();
      this.refreshMetrics();
      return;
    }
    this.updateDetailedMetricsData();
    this.updateCurrentFindings();
  }

  isBrokerFeedEnabled(broker: BrokerKey): boolean {
    return this.brokerFeedEnabled[broker];
  }

  /**
   * Update broker status indicators
   */
  private updateBrokerStatuses(): void {
    if (!this.brokerMetrics) return;

    this.brokerStatuses = {
      rabbitmq: this.brokerMetrics.brokers.rabbitmq.connected ? 'ok' : 'error',
      kafka: this.brokerMetrics.brokers.kafka.connected ? 'ok' : 'error',
      pulsar: this.brokerMetrics.brokers.pulsar?.connected ? 'ok' : 'error',
    };
  }

  private updateDetailedMetricsData(): void {
    this.detailedMetricsData = this.getDetailedMetricsData();
  }

  private updateCurrentFindings(): void {
    if (!this.brokerMetrics) {
      this.currentFindings = [];
      this.dataQualityBanner = null;
      return;
    }

    const { throughputImprovement, latencyImprovement, memoryEfficiency } = this.brokerMetrics.comparison;
    const measured = this.brokerMetrics.dataQuality?.measuredBrokers.join(', ').toUpperCase() || 'none';
    const fallback = this.brokerMetrics.dataQuality?.fallbackBrokers.join(', ').toUpperCase() || 'none';
    this.dataQualityBanner = this.brokerMetrics.dataQuality?.hasFallbackData
      ? `Data quality warning: fallback/simulated metrics detected (${fallback}).`
      : null;

    this.currentFindings = [
      `Throughput snapshot: ${this.getThroughputSummaryText(throughputImprovement)}.`,
      `Latency snapshot: ${this.getLatencySummaryText(latencyImprovement)}.`,
      `Resource snapshot: ${this.getMemorySummaryText(memoryEfficiency)}.`,
      `Active feeds: ${this.getActiveFeedsText()}.`,
      `Evaluation mode: dynamic polling every 5s; deltas are computed only when both broker metrics are measured and baseline values are > 0.`,
      `Measured brokers: ${measured}. Fallback/simulated brokers: ${fallback}.`,
      ...(this.brokerMetrics.comparison.suppressedReasons?.length
        ? [`Suppressed comparisons: ${this.brokerMetrics.comparison.suppressedReasons.join(' ')}`]
        : []),
    ];
  }

  private scheduleMetricsStateUpdate(data: BrokerComparisonDTO, setLoadingFalse = false): void {
    // Clone incoming DTO to avoid accidental external mutations during checks.
    const safeData = structuredClone(data);
    this.deferUiStateUpdate(() => {
      this.applyMetricsStateUpdate(safeData, setLoadingFalse);
    }, BrokerComparisonComponent.UI_UPDATE_DELAY_MS, true);
  }

  private applyMetricsStateUpdate(data: BrokerComparisonDTO, setLoadingFalse = false): void {
    this.brokerMetrics = data;
    this.lastRefresh = new Date();
    this.lastRefreshLabel = this.lastRefresh.toLocaleString();
    if (setLoadingFalse) {
      this.setLoading(false);
    }
    this.updateBrokerStatuses();
    this.updateDetailedMetricsData();
    this.updateCurrentFindings();
    if (this.systemMetricsChart) {
      this.systemMetricsChart.updateBrokerData(data);
    }
    this.cdr.markForCheck();
  }

  private clearBenchmarkRunningAsync(): void {
    this.deferUiStateUpdate(() => {
      this.setBenchmarkRunning(false);
    }, BrokerComparisonComponent.BENCHMARK_RESET_DELAY_MS, false);
  }

  private clearInMemoryDashboardState(): void {
    this.detailedMetricsData = [];
    this.currentFindings = [];
    this.dataQualityBanner = null;
    this.lastRefresh = null;
    this.lastRefreshLabel = 'Never';
    if (this.systemMetricsChart) {
      this.systemMetricsChart.clearData();
    }
    this.cdr.markForCheck();
  }

  private setBenchmarkRunning(value: boolean): void {
    this.isBenchmarkRunning = value;
    this.cdr.markForCheck();
  }

  private setLoading(value: boolean): void {
    this.isLoading = value;
    this.cdr.markForCheck();
  }

  private deferUiStateUpdate(action: () => void, delayMs = 0, runSynchronouslyInTests = true): void {
    if (this.isTestEnvironment && runSynchronouslyInTests) {
      action();
      return;
    }

    // Force state mutation outside the current check cycle, then re-enter Angular.
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.ngZone.run(action);
      }, delayMs);
    });
  }

  private getSelectedBrokersForRun(): BenchmarkBroker[] {
    return (Object.entries(this.brokerFeedEnabled) as Array<[BrokerKey, boolean]>)
      .filter(([, enabled]) => enabled)
      .map(([broker]) => broker);
  }

  private getActiveFeedsText(): string {
    const active = (Object.keys(this.brokerFeedEnabled) as BrokerKey[])
      .filter((broker) => this.brokerFeedEnabled[broker])
      .map((broker) => broker.toUpperCase());
    return active.length > 0 ? active.join(', ') : 'none';
  }

  private formatFeedValue(
    broker: BrokerKey,
    value: number | undefined | null,
    formatter: (v: number | undefined | null) => string,
  ): string {
    if (!this.isBrokerFeedEnabled(broker)) return 'Feed Off';
    return formatter(value);
  }

  private formatFeedConnectionValue(broker: BrokerKey, value: number | undefined): string | undefined {
    if (!this.isBrokerFeedEnabled(broker)) return 'Feed Off';
    return value !== undefined ? value.toString() : undefined;
  }

  private getFeedAwareImprovement(value: string | undefined): string | undefined {
    if (!this.isBrokerFeedEnabled('rabbitmq') || !this.isBrokerFeedEnabled('pulsar')) {
      return 'N/A (feed off)';
    }
    return value;
  }

  private parseDelta(value: string | undefined): number | null {
    if (!value) return null;
    const parsed = Number.parseFloat(value.replace('%', ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  getThroughputSummaryText(value: string | undefined): string {
    const delta = this.parseDelta(value);
    if (delta === null) return 'throughput comparison unavailable';
    return `Pulsar ${value} ${delta >= 0 ? 'faster' : 'slower'} than RabbitMQ`;
  }

  getLatencySummaryText(value: string | undefined): string {
    const delta = this.parseDelta(value);
    if (delta === null) return 'latency comparison unavailable';
    return `Pulsar ${value} ${delta >= 0 ? 'higher latency (worse)' : 'lower latency (better)'}`;
  }

  getMemorySummaryText(value: string | undefined): string {
    const delta = this.parseDelta(value);
    if (delta === null) return 'memory comparison unavailable';
    return `Pulsar ${value} memory usage versus RabbitMQ`;
  }

  private getMetricQualityLabel(broker: BrokerKey, metric: MetricKey): 'measured' | 'fallback' | 'missing' {
    const metrics = this.brokerMetrics?.brokers[broker];
    if (!metrics) return 'missing';
    const explicit = metrics.metricQuality?.[metric];
    if (explicit) return explicit;
    const source = metrics.dataSource ?? 'missing';
    const value = metrics[metric as keyof BrokerMetricsDTO];
    if (value === undefined || value === null) return 'missing';
    return source === 'fallback' ? 'fallback' : 'measured';
  }

  private appendQualityTag(value: string, broker: BrokerKey, metric: MetricKey): string {
    if (value === 'Feed Off') return value;
    const quality = this.getMetricQualityLabel(broker, metric);
    return `${value} (${quality})`;
  }

  /**
   * Format throughput for display
   */
  formatThroughput(value: number | undefined | null): string {
    if (value === undefined || value === null) return 'N/A';
    return `${value.toLocaleString()} msg/s`;
  }

  /**
   * Format latency for display
   */
  formatLatency(value: number | undefined | null): string {
    if (value === undefined || value === null) return 'N/A';
    return `${value.toFixed(2)} ms`;
  }

  /**
   * Format memory for display
   */
  formatMemory(value: number | undefined | null): string {
    if (value === undefined || value === null) return 'N/A';
    return `${value.toFixed(1)} MB`;
  }

  /**
   * Get CSS class for status indicator
   */
  getStatusClass(status: 'ok' | 'warning' | 'error'): string {
    return `status-${status}`;
  }

  getBrokerConnectivityLabel(status: 'ok' | 'warning' | 'error' | undefined): string {
    return status === 'ok' ? 'CONNECTED' : 'UNAVAILABLE';
  }

  /**
   * Get CSS class for improvement metric (green for positive, red for negative)
   */
  getImprovementClass(value: string | undefined): string {
    if (!value) return '';
    return value.startsWith('+') ? 'improvement-positive' : 'improvement-negative';
  }

  /**
   * Get time since last refresh
   */
  getLastRefreshText(): string {
    if (!this.lastRefresh) return 'Never';

    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - this.lastRefresh.getTime()) / 1000);

    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;

    return `${Math.floor(diffSeconds / 3600)}h ago`;
  }

  /**
   * Build detailed metrics data for table display
   */
  getDetailedMetricsData(): Array<{
    metric: string;
    rabbitmq: string | undefined;
    pulsar: string | undefined;
    kafka: string | undefined;
    improvement: string | undefined;
  }> {
    if (!this.brokerMetrics ||
        typeof this.brokerMetrics !== 'object' ||
        !this.brokerMetrics.brokers ||
        typeof this.brokerMetrics.brokers !== 'object' ||
        !this.brokerMetrics.comparison ||
        typeof this.brokerMetrics.comparison !== 'object') {
      return [];
    }

    const rmq: BrokerMetricsDTO | undefined = this.brokerMetrics.brokers.rabbitmq;
    const pulsar: BrokerMetricsDTO | undefined = this.brokerMetrics.brokers.pulsar;
    const kafka: BrokerMetricsDTO | undefined = this.brokerMetrics.brokers.kafka;

    return [
      {
        metric: 'Throughput (msg/s)',
        rabbitmq: this.appendQualityTag(
          this.formatFeedValue('rabbitmq', rmq?.messagesPerSecond, this.formatThroughput.bind(this)),
          'rabbitmq',
          'messagesPerSecond',
        ),
        pulsar: this.appendQualityTag(
          this.formatFeedValue('pulsar', pulsar?.messagesPerSecond, this.formatThroughput.bind(this)),
          'pulsar',
          'messagesPerSecond',
        ),
        kafka: this.appendQualityTag(
          this.formatFeedValue('kafka', kafka?.messagesPerSecond, this.formatThroughput.bind(this)),
          'kafka',
          'messagesPerSecond',
        ),
        improvement: this.getFeedAwareImprovement(this.brokerMetrics.comparison.throughputImprovement),
      },
      {
        metric: 'P99 Latency (ms)',
        rabbitmq: this.appendQualityTag(this.formatFeedValue('rabbitmq', rmq?.p99LatencyMs, this.formatLatency.bind(this)), 'rabbitmq', 'p99LatencyMs'),
        pulsar: this.appendQualityTag(this.formatFeedValue('pulsar', pulsar?.p99LatencyMs, this.formatLatency.bind(this)), 'pulsar', 'p99LatencyMs'),
        kafka: this.appendQualityTag(this.formatFeedValue('kafka', kafka?.p99LatencyMs, this.formatLatency.bind(this)), 'kafka', 'p99LatencyMs'),
        improvement: this.getFeedAwareImprovement(this.brokerMetrics.comparison.latencyImprovement),
      },
      {
        metric: 'Memory Usage (MB)',
        rabbitmq: this.appendQualityTag(this.formatFeedValue('rabbitmq', rmq?.memoryUsageMb, this.formatMemory.bind(this)), 'rabbitmq', 'memoryUsageMb'),
        pulsar: this.appendQualityTag(this.formatFeedValue('pulsar', pulsar?.memoryUsageMb, this.formatMemory.bind(this)), 'pulsar', 'memoryUsageMb'),
        kafka: this.appendQualityTag(this.formatFeedValue('kafka', kafka?.memoryUsageMb, this.formatMemory.bind(this)), 'kafka', 'memoryUsageMb'),
        improvement: this.getFeedAwareImprovement(this.brokerMetrics.comparison.memoryEfficiency),
      },
      {
        metric: 'Connections',
        rabbitmq: this.appendQualityTag(this.formatFeedConnectionValue('rabbitmq', rmq?.connectionCount) || 'N/A', 'rabbitmq', 'connectionCount'),
        pulsar: this.appendQualityTag(this.formatFeedConnectionValue('pulsar', pulsar?.connectionCount) || 'N/A', 'pulsar', 'connectionCount'),
        kafka: this.appendQualityTag(this.formatFeedConnectionValue('kafka', kafka?.connectionCount) || 'N/A', 'kafka', 'connectionCount'),
        improvement: undefined,
      },
      {
        metric: 'CPU Usage (%)',
        rabbitmq: this.appendQualityTag(this.isBrokerFeedEnabled('rabbitmq') ? (rmq?.cpuPercentage !== undefined ? rmq.cpuPercentage.toFixed(1) : 'N/A') : 'Feed Off', 'rabbitmq', 'cpuPercentage'),
        pulsar: this.appendQualityTag(this.isBrokerFeedEnabled('pulsar') ? (pulsar?.cpuPercentage !== undefined ? pulsar.cpuPercentage.toFixed(1) : 'N/A') : 'Feed Off', 'pulsar', 'cpuPercentage'),
        kafka: this.appendQualityTag(this.isBrokerFeedEnabled('kafka') ? (kafka?.cpuPercentage !== undefined ? kafka.cpuPercentage.toFixed(1) : 'N/A') : 'Feed Off', 'kafka', 'cpuPercentage'),
        improvement: undefined,
      },
    ];
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const message = (err as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
    }
    return 'Unknown error';
  }
}
