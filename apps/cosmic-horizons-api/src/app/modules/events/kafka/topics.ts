/**
 * Kafka Topics Configuration
 *
 * Centralized definition of all Kafka topics used in Cosmic Horizons
 * Partitioning strategies and retention policies for each topic
 */

import {
  KAFKA_TOPICS,
  KAFKA_TOPIC_CONFIG,
} from '@cosmic-horizons/event-models';

type KafkaTopicName = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

/**
 * Topic metadata with descriptions and retention policies
 */
export interface TopicMetadata {
  name: string;
  description: string;
  partitions: number;
  replication: number;
  retention_ms: number;
  compression: 'snappy' | 'gzip' | 'lz4' | 'none';
  cleanup_policy: 'delete' | 'compact';
  min_insync_replicas: number;
}

/**
 * Full topic configuration with metadata
 */
export const KAFKA_TOPICS_METADATA: Record<string, TopicMetadata> = {
  [KAFKA_TOPICS.JOB_LIFECYCLE]: {
    name: KAFKA_TOPICS.JOB_LIFECYCLE,
    description:
      'Job lifecycle events: submitted, status changed, completed, failed, cancelled',
    partitions: KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.JOB_LIFECYCLE].partitions,
    replication:
      KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.JOB_LIFECYCLE].replication_factor,
    retention_ms: KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.JOB_LIFECYCLE].retention_ms,
    compression: 'snappy',
    cleanup_policy: 'delete',
    min_insync_replicas: 2,
  },

  [KAFKA_TOPICS.JOB_METRICS]: {
    name: KAFKA_TOPICS.JOB_METRICS,
    description:
      'Performance metrics: CPU, GPU, memory, I/O, compute time per job',
    partitions: KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.JOB_METRICS].partitions,
    replication:
      KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.JOB_METRICS].replication_factor,
    retention_ms: KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.JOB_METRICS].retention_ms,
    compression: 'snappy',
    cleanup_policy: 'delete',
    min_insync_replicas: 1,
  },

  [KAFKA_TOPICS.NOTIFICATIONS]: {
    name: KAFKA_TOPICS.NOTIFICATIONS,
    description:
      'User notifications and alerts (email, websocket, in-app messages)',
    partitions: KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.NOTIFICATIONS].partitions,
    replication:
      KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.NOTIFICATIONS].replication_factor,
    retention_ms: KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.NOTIFICATIONS].retention_ms,
    compression: 'lz4',
    cleanup_policy: 'delete',
    min_insync_replicas: 1,
  },

  [KAFKA_TOPICS.AUDIT_TRAIL]: {
    name: KAFKA_TOPICS.AUDIT_TRAIL,
    description:
      'Audit trail for compliance and operational auditing (90-day retention for HIPAA/SOC2)',
    partitions: KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.AUDIT_TRAIL].partitions,
    replication:
      KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.AUDIT_TRAIL].replication_factor,
    retention_ms: KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.AUDIT_TRAIL].retention_ms,
    compression: 'snappy',
    cleanup_policy: 'delete',
    min_insync_replicas: 2,
  },

  [KAFKA_TOPICS.SYSTEM_HEALTH]: {
    name: KAFKA_TOPICS.SYSTEM_HEALTH,
    description:
      'System health metrics: broker status, topic lag, consumer group metrics',
    partitions: KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.SYSTEM_HEALTH].partitions,
    replication:
      KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.SYSTEM_HEALTH].replication_factor,
    retention_ms: KAFKA_TOPIC_CONFIG[KAFKA_TOPICS.SYSTEM_HEALTH].retention_ms,
    compression: 'lz4',
    cleanup_policy: 'delete',
    min_insync_replicas: 1,
  },
};

/**
 * Consumer group configurations
 */
export const KAFKA_CONSUMER_GROUPS = {
  EVENT_PROCESSOR: 'cosmic-horizons-event-processor',
  API_BROADCAST: 'cosmic-horizons-api-broadcast',
  METRICS_AGGREGATOR: 'cosmic-horizons-metrics-aggregator',
  AUDIT_ARCHIVER: 'cosmic-horizons-audit-archiver',
  HEALTH_MONITOR: 'cosmic-horizons-health-monitor',
} as const;

/**
 * Get topic metadata by name
 */
export function getTopicMetadata(topicName: string): TopicMetadata | undefined {
  return KAFKA_TOPICS_METADATA[topicName];
}

/**
 * Get all topic names
 */
export function getAllTopicNames(): string[] {
  return Object.values(KAFKA_TOPICS) as KafkaTopicName[];
}

/**
 * Validate if a topic exists
 */
export function isValidTopic(topicName: string): boolean {
  return (Object.values(KAFKA_TOPICS) as KafkaTopicName[]).includes(
    topicName as KafkaTopicName,
  );
}

/**
 * Get retention period in days for a topic
 */
export function getRetentionDays(topicName: string): number {
  const metadata = getTopicMetadata(topicName);
  if (!metadata) {
    return 0;
  }
  return Math.floor(metadata.retention_ms / (24 * 60 * 60 * 1000));
}
