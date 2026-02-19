import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private metrics: Map<
    string,
    Array<{ value: number; tags?: Record<string, string>; timestamp: Date }>
  > = new Map();
  private alerts: Array<{
    metric: string;
    value: number;
    threshold: number;
    timestamp: Date;
  }> = [];

  constructor(private configService: ConfigService) {}

  async trackMetric(
    name: string,
    value: number,
    tags?: Record<string, string>,
  ): Promise<void> {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    const metricValues = this.metrics.get(name);
    if (!metricValues) {
      return;
    }
    metricValues.push({ value, tags, timestamp: new Date() });

    // Check for alerts (thresholds)
    const threshold = 1000; // Placeholder
    if (value > threshold) {
      this.alerts.push({
        metric: name,
        value,
        threshold,
        timestamp: new Date(),
      });
    }
  }

  async getMetricSummary(
    name: string,
    windowMs: number,
  ): Promise<{ avg: number; p99: number; count: number }> {
    void windowMs;
    const data = this.metrics.get(name) || [];
    if (data.length === 0) return { avg: 0, p99: 0, count: 0 };

    const values = data.map((d) => d.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      avg: sum / values.length,
      p99:
        values[Math.floor(values.length * 0.99)] || values[values.length - 1],
      count: values.length,
    };
  }

  getMetrics(): {
    metricsCount: number;
    alertsCount: number;
    throughput: number;
  } {
    return {
      metricsCount: this.metrics.size,
      alertsCount: this.alerts.length,
      throughput: 500, // Placeholder
    };
  }
}
