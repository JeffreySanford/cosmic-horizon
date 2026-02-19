import { Injectable } from '@angular/core';
import { Observable, of, timer } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import {
  BrokerComparisonDTO,
  BrokerHistoryDTO,
  BenchmarkResult,
} from '../models/broker-metrics.model';

/**
 * Mock Broker Data Service
 *
 * Provides demo broker metrics when the backend is unavailable.
 * Simulates realistic delays and metrics for dashboard development/testing.
 */
@Injectable({
  providedIn: 'root',
})
export class BrokerDataMockService {
  private readonly SIMULATION_DELAY_MS = 300;

  /**
   * Get current broker metrics (mocked)
   * Returns simulated RabbitMQ, Kafka, and Pulsar metrics
   */
  getCurrentMetrics(): Observable<BrokerComparisonDTO> {
    return of(this.generateMetrics()).pipe(delay(this.SIMULATION_DELAY_MS));
  }

  /**
   * Get historical metrics for charting (mocked)
   */
  getHistoricalMetrics(hours = 24): Observable<BrokerHistoryDTO> {
    const samples = Array.from({ length: hours }, (_, i) => ({
      timestamp: new Date(Date.now() - (hours - i) * 3600000),
      rabbitmq: {
        messagesPerSecond: 12000 + Math.random() * 5000,
        p99LatencyMs: 45 + Math.random() * 20,
        memoryUsageMb: 512 + Math.random() * 100,
      },
      kafka: {
        messagesPerSecond: 18000 + Math.random() * 5000,
        p99LatencyMs: 35 + Math.random() * 15,
        memoryUsageMb: 768 + Math.random() * 150,
      },
      pulsar: {
        messagesPerSecond: 25000 + Math.random() * 5000,
        p99LatencyMs: 20 + Math.random() * 10,
        memoryUsageMb: 640 + Math.random() * 120,
      },
    }));

    return of({
      timeRange: {
        start: new Date(Date.now() - hours * 3600000),
        end: new Date(),
      },
      samples,
    }).pipe(delay(this.SIMULATION_DELAY_MS));
  }

  /**
   * Run benchmark test (mocked)
   */
  runBenchmark(): Observable<BenchmarkResult> {
    return timer(5000).pipe(
      map(() => ({
        status: 'completed' as const,
        jobId: 'benchmark-' + Date.now(),
        duration: '5.2s',
        results: this.generateMetrics(),
        reportUrl: '/operations/broker-comparison/report/' + Date.now(),
      })),
    );
  }

  /**
   * Get broker health status (mocked)
   */
  getHealth(): Observable<Record<string, string>> {
    return of({
      rabbitmq: 'healthy',
      kafka: 'healthy',
      pulsar: 'healthy',
      zookeeper: 'healthy',
    }).pipe(delay(this.SIMULATION_DELAY_MS));
  }

  /**
   * Generate realistic mock metrics
   */
  private generateMetrics(): BrokerComparisonDTO {
    const rabbitMps = 12000;
    const kafkaMps = 18000;
    const pulsarMps = 25000;

    return {
      timestamp: new Date(),
      brokers: {
        rabbitmq: {
          connected: true,
          messagesPerSecond: rabbitMps,
          p50LatencyMs: 15,
          p95LatencyMs: 35,
          p99LatencyMs: 55,
          memoryUsageMb: 512,
          cpuPercentage: 28,
          connectionCount: 42,
          uptime: '45 days',
          partitionCount: 0,
          brokerCount: 1,
        },
        kafka: {
          connected: true,
          messagesPerSecond: kafkaMps,
          p50LatencyMs: 12,
          p95LatencyMs: 28,
          p99LatencyMs: 42,
          memoryUsageMb: 768,
          cpuPercentage: 35,
          connectionCount: 58,
          uptime: '62 days',
          partitionCount: 16,
          brokerCount: 3,
        },
        pulsar: {
          connected: true,
          messagesPerSecond: pulsarMps,
          p50LatencyMs: 8,
          p95LatencyMs: 18,
          p99LatencyMs: 28,
          memoryUsageMb: 640,
          cpuPercentage: 22,
          connectionCount: 72,
          uptime: '38 days',
          partitionCount: 32,
          brokerCount: 3,
        },
      },
      comparison: {
        throughputImprovement: '+40.8%',
        latencyImprovement: '-49.1%',
        memoryEfficiency: '-20.3%',
      },
    };
  }
}
