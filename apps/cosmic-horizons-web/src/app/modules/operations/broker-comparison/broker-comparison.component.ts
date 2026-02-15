import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { interval, Subject, takeUntil } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { BrokerDataService } from './services/broker-data.service';
import { BenchmarkResult, BrokerComparisonDTO } from './models/broker-metrics.model';

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
})
export class BrokerComparisonComponent implements OnInit, OnDestroy {
  brokerMetrics: BrokerComparisonDTO | null = null;
  isLoading = false;
  error: string | null = null;
  lastRefresh: Date | null = null;
  isBenchmarkRunning = false;

  displayedColumns: string[] = ['metric', 'rabbitmq', 'pulsar', 'kafka', 'improvement'];
  brokerStatuses: Record<string, 'ok' | 'warning' | 'error'> = {};

  private destroy$ = new Subject<void>();
  private pollInterval$ = interval(5000); // Refresh every 5 seconds

  private readonly brokerDataService = inject(BrokerDataService);

  ngOnInit(): void {
    this.loadMetrics();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load broker metrics once
   */
  private loadMetrics(): void {
    this.isLoading = true;
    this.error = null;

    this.brokerDataService.getCurrentMetrics().subscribe({
      next: (data: BrokerComparisonDTO) => {
        this.brokerMetrics = data;
        this.lastRefresh = new Date();
        this.isLoading = false;
        this.updateBrokerStatuses();
      },
      error: (err: unknown) => {
        this.error = `Failed to load broker metrics: ${this.getErrorMessage(err)}`;
        this.isLoading = false;
      },
    });
  }

  /**
   * Set up auto-refresh polling
   */
  private startPolling(): void {
    this.pollInterval$
      .pipe(
        switchMap(() => this.brokerDataService.getCurrentMetrics()),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (data: BrokerComparisonDTO) => {
          this.brokerMetrics = data;
          this.lastRefresh = new Date();
          this.updateBrokerStatuses();
        },
        error: (err: unknown) => {
          console.warn('Polling error:', err);
        },
      });
  }

  /**
   * Trigger benchmark test
   */
  runBenchmark(): void {
    if (this.isBenchmarkRunning) return;

    this.isBenchmarkRunning = true;
    this.brokerDataService.runBenchmark().subscribe({
      next: (result: BenchmarkResult) => {
        console.log('Benchmark completed:', result);
        this.isBenchmarkRunning = false;
        // Reload metrics after benchmark completes
        setTimeout(() => this.loadMetrics(), 2000);
      },
      error: (err: unknown) => {
        this.error = `Benchmark failed: ${this.getErrorMessage(err)}`;
        this.isBenchmarkRunning = false;
      },
    });
  }

  /**
   * Refresh metrics immediately
   */
  refreshMetrics(): void {
    this.loadMetrics();
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

  /**
   * Format throughput for display
   */
  formatThroughput(value: number | undefined): string {
    if (value === undefined) return 'N/A';
    return `${value.toLocaleString()} msg/s`;
  }

  /**
   * Format latency for display
   */
  formatLatency(value: number | undefined): string {
    if (value === undefined) return 'N/A';
    return `${value.toFixed(2)} ms`;
  }

  /**
   * Format memory for display
   */
  formatMemory(value: number | undefined): string {
    if (value === undefined) return 'N/A';
    return `${value.toFixed(1)} MB`;
  }

  /**
   * Get CSS class for status indicator
   */
  getStatusClass(status: 'ok' | 'warning' | 'error'): string {
    return `status-${status}`;
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
        rabbitmq: this.formatThroughput(rmq?.messagesPerSecond),
        pulsar: this.formatThroughput(pulsar?.messagesPerSecond),
        kafka: this.formatThroughput(kafka?.messagesPerSecond),
        improvement: this.brokerMetrics.comparison.throughputImprovement,
      },
      {
        metric: 'P99 Latency (ms)',
        rabbitmq: this.formatLatency(rmq?.p99LatencyMs),
        pulsar: this.formatLatency(pulsar?.p99LatencyMs),
        kafka: this.formatLatency(kafka?.p99LatencyMs),
        improvement: this.brokerMetrics.comparison.latencyImprovement,
      },
      {
        metric: 'Memory Usage (MB)',
        rabbitmq: this.formatMemory(rmq?.memoryUsageMb),
        pulsar: this.formatMemory(pulsar?.memoryUsageMb),
        kafka: this.formatMemory(kafka?.memoryUsageMb),
        improvement: this.brokerMetrics.comparison.memoryEfficiency,
      },
      {
        metric: 'Connections',
        rabbitmq: rmq?.connectionCount !== undefined ? rmq.connectionCount.toString() : undefined,
        pulsar: pulsar?.connectionCount !== undefined ? pulsar.connectionCount.toString() : undefined,
        kafka: kafka?.connectionCount !== undefined ? kafka.connectionCount.toString() : undefined,
        improvement: undefined,
      },
      {
        metric: 'CPU Usage (%)',
        rabbitmq: rmq?.cpuPercentage !== undefined ? rmq.cpuPercentage.toFixed(1) : 'N/A',
        pulsar: pulsar?.cpuPercentage !== undefined ? pulsar.cpuPercentage.toFixed(1) : 'N/A',
        kafka: kafka?.cpuPercentage !== undefined ? kafka.cpuPercentage.toFixed(1) : 'N/A',
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
