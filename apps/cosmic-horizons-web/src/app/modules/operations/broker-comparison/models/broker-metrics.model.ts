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
  dataSource?: 'measured' | 'fallback' | 'missing';
  metricQuality?: Partial<
    Record<
      | 'messagesPerSecond'
      | 'p99LatencyMs'
      | 'memoryUsageMb'
      | 'cpuPercentage'
      | 'connectionCount'
      | 'uptime',
      'measured' | 'fallback' | 'missing'
    >
  >;
}

export interface BrokerComparisonDTO {
  timestamp: Date;
  brokers: {
    rabbitmq: BrokerMetricsDTO;
    kafka: BrokerMetricsDTO;
    pulsar?: BrokerMetricsDTO;
  };
  comparison: {
    throughputImprovement?: string;
    latencyImprovement?: string;
    memoryEfficiency?: string;
    suppressedReasons?: string[];
  };
  dataQuality?: {
    hasFallbackData: boolean;
    measuredBrokers: Array<'rabbitmq' | 'kafka' | 'pulsar'>;
    fallbackBrokers: Array<'rabbitmq' | 'kafka' | 'pulsar'>;
    summary: string;
  };
}

export interface BrokerHistorySample {
  timestamp: Date;
  rabbitmq: Partial<BrokerMetricsDTO>;
  kafka: Partial<BrokerMetricsDTO>;
  pulsar?: Partial<BrokerMetricsDTO>;
}

export interface BrokerHistoryDTO {
  timeRange: {
    start: Date;
    end: Date;
  };
  samples: BrokerHistorySample[];
}

export interface BenchmarkResult {
  status: 'running' | 'completed' | 'failed' | 'queued';
  jobId: string;
  estimatedDurationSeconds?: number;
  duration?: string;
  testType?: 'standard' | 'stress';
  results?: BrokerComparisonDTO;
  reportUrl?: string;
  error?: string;
}

export interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number; // percentage
    cores: number;
    loadAverage: number[];
  };
  memory: {
    used: number; // bytes
    total: number; // bytes
    percentage: number;
  };
  disk: {
    readBytesPerSecond: number;
    writeBytesPerSecond: number;
    totalBytes: number;
    usedBytes: number;
    percentage: number;
  };
}
