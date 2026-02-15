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
  status: 'running' | 'completed' | 'failed';
  jobId: string;
  estimatedDurationSeconds?: number;
  duration?: string;
  results?: BrokerComparisonDTO;
  reportUrl?: string;
  error?: string;
}
