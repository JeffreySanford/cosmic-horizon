import { Injectable } from '@nestjs/common';

export type EventHistoryQuery = {
  topic: string;
  sinceTimestamp?: string;
  fromOffset?: number;
  limit?: number;
};

export type TrackedEventRecord = {
  topic: string;
  partition: number;
  offset: number;
  key: string | null;
  eventType: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

export type ConsumerOffsetRecord = {
  groupId: string;
  topic: string;
  partition: number;
  offset: number;
  updatedAt: string;
};

@Injectable()
export class EventReplayService {
  private readonly recordsByTopic = new Map<string, TrackedEventRecord[]>();
  private readonly nextOffsetByTopicPartition = new Map<string, number>();
  private readonly consumerOffsets = new Map<string, ConsumerOffsetRecord>();
  private readonly maxRecordsPerTopic = 5000;

  recordPublishedEvent(input: {
    topic: string;
    partition?: number;
    offset?: string | number;
    key?: string | null;
    payload: Record<string, unknown>;
    timestamp?: string;
  }): TrackedEventRecord {
    const partition = input.partition ?? 0;
    const topicPartitionKey = this.topicPartitionKey(input.topic, partition);
    const fallbackOffset =
      this.nextOffsetByTopicPartition.get(topicPartitionKey) ?? 0;
    const parsedOffset =
      typeof input.offset === 'number'
        ? input.offset
        : Number.parseInt(input.offset ?? `${fallbackOffset}`, 10);
    const offset = Number.isFinite(parsedOffset)
      ? parsedOffset
      : fallbackOffset;

    this.nextOffsetByTopicPartition.set(topicPartitionKey, offset + 1);

    const record: TrackedEventRecord = {
      topic: input.topic,
      partition,
      offset,
      key: input.key ?? null,
      eventType:
        typeof input.payload['event_type'] === 'string'
          ? String(input.payload['event_type'])
          : 'unknown',
      timestamp: input.timestamp ?? new Date().toISOString(),
      payload: input.payload,
    };

    const existing = this.recordsByTopic.get(input.topic) ?? [];
    existing.push(record);
    if (existing.length > this.maxRecordsPerTopic) {
      existing.splice(0, existing.length - this.maxRecordsPerTopic);
    }
    this.recordsByTopic.set(input.topic, existing);

    return record;
  }

  ackConsumerOffset(input: {
    groupId: string;
    topic: string;
    partition?: number;
    offset: string | number;
  }): ConsumerOffsetRecord {
    const partition = input.partition ?? 0;
    const parsedOffset =
      typeof input.offset === 'number'
        ? input.offset
        : Number.parseInt(input.offset, 10);
    const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
    const key = `${input.groupId}:${input.topic}:${partition}`;

    const record: ConsumerOffsetRecord = {
      groupId: input.groupId,
      topic: input.topic,
      partition,
      offset,
      updatedAt: new Date().toISOString(),
    };

    this.consumerOffsets.set(key, record);
    return record;
  }

  getConsumerOffsets(groupId?: string): ConsumerOffsetRecord[] {
    const values = Array.from(this.consumerOffsets.values());
    if (!groupId) {
      return values;
    }
    return values.filter((item) => item.groupId === groupId);
  }

  getEventHistory(query: EventHistoryQuery): TrackedEventRecord[] {
    const limit = Math.max(1, Math.min(query.limit ?? 200, 2000));
    const allRecords = this.recordsByTopic.get(query.topic) ?? [];

    let filtered = allRecords;

    if (
      typeof query.fromOffset === 'number' &&
      Number.isFinite(query.fromOffset)
    ) {
      const fromOffset = query.fromOffset;
      filtered = filtered.filter((record) => record.offset >= fromOffset);
    }

    if (query.sinceTimestamp) {
      const fromMillis = Date.parse(query.sinceTimestamp);
      if (!Number.isNaN(fromMillis)) {
        filtered = filtered.filter(
          (record) => Date.parse(record.timestamp) >= fromMillis,
        );
      }
    }

    return filtered.slice(-limit);
  }

  private topicPartitionKey(topic: string, partition: number): string {
    return `${topic}:${partition}`;
  }
}
