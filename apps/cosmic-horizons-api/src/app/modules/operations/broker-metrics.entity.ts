import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * BrokerMetrics Entity
 *
 * Stores time-series metrics for event brokers (RabbitMQ, Kafka, Pulsar).
 * Used for historical analytics, performance trending, and Phase 3.5 Pulsar evaluation.
 *
 * Retention Policy: Keep 7 days minimum (can be configured in microservice)
 */
@Entity('broker_metrics', { schema: 'public' })
@Index(['brokerName', 'capturedAt'])
@Index(['capturedAt'])
export class BrokerMetrics {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('text')
  brokerName!: 'rabbitmq' | 'kafka' | 'pulsar';

  /**
   * Throughput: Messages processed per second
   */
  @Column('integer', { nullable: true })
  messagesPerSecond: number | null = null;

  /**
   * Latency percentiles (milliseconds)
   */
  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  p50LatencyMs: number | null = null;

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  p95LatencyMs: number | null = null;

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  p99LatencyMs: number | null = null;

  /**
   * Resource usage
   */
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  memoryUsageMb: number | null = null;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  cpuPercentage: number | null = null;

  /**
   * Connection count (active connections to broker)
   */
  @Column('integer', { nullable: true })
  connectionCount: number | null = null;

  /**
   * Broker health
   */
  @Column('boolean', { default: false })
  isConnected = false;

  @Column('text', { nullable: true })
  uptime: string | null = null;

  /**
   * Broker-specific metrics
   */
  @Column('integer', { nullable: true })
  partitionCount: number | null = null; // Kafka-specific

  @Column('integer', { nullable: true })
  brokerCount: number | null = null; // Kafka-specific

  @Column('jsonb', { nullable: true })
  topicStats: Record<string, unknown> | null = null; // Arbitrary JSON for future expansion

  /**
   * Metadata
   */
  @Column('text', { nullable: true })
  errorMessage: string | null = null; // If collection failed, store error

  @CreateDateColumn({ type: 'timestamptz' })
  capturedAt!: Date;
}

/**
 * BrokerMetricsDTO - API Response
 */
export interface BrokerMetricsDTO {
  connected: boolean;
  messagesPerSecond?: number;
  p50LatencyMs?: number;
  p95LatencyMs?: number;
  p99LatencyMs?: number;
  memoryUsageMb?: number;
  cpuPercentage?: number;
  connectionCount?: number;
  uptime?: string;
  partitionCount?: number;
  brokerCount?: number;
  topicStats?: Record<string, unknown>;
  dataSource?: 'measured' | 'fallback' | 'missing';
  metricQuality?: Partial<Record<
    'messagesPerSecond' | 'p99LatencyMs' | 'memoryUsageMb' | 'cpuPercentage' | 'connectionCount' | 'uptime',
    'measured' | 'fallback' | 'missing'
  >>;
}

/**
 * BrokerComparisonDTO - Aggregated comparison response
 */
export interface BrokerComparisonDTO {
  timestamp: Date;
  brokers: {
    rabbitmq: BrokerMetricsDTO;
    kafka: BrokerMetricsDTO;
    pulsar?: BrokerMetricsDTO;
  };
  comparison: {
    throughputImprovement?: string; // "+36.8%"
    latencyImprovement?: string; // "-27.1%"
    memoryEfficiency?: string; // "-27.9%"
    suppressedReasons?: string[];
  };
  dataQuality?: {
    hasFallbackData: boolean;
    measuredBrokers: Array<'rabbitmq' | 'kafka' | 'pulsar'>;
    fallbackBrokers: Array<'rabbitmq' | 'kafka' | 'pulsar'>;
    summary: string;
  };
}

/**
 * BrokerHistoryDTO - Time-series data for charting
 */
export interface BrokerHistoryDTO {
  timeRange: {
    start: Date;
    end: Date;
  };
  samples: Array<{
    timestamp: Date;
    rabbitmq: Partial<BrokerMetricsDTO>;
    kafka: Partial<BrokerMetricsDTO>;
    pulsar?: Partial<BrokerMetricsDTO>;
  }>;
}
