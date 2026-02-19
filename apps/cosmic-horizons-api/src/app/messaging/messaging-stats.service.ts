import { Injectable } from '@nestjs/common';
import type {
  MessagingInfraSnapshot,
  MessagingLiveStats,
  TelemetryPacket,
} from './messaging.types';

const EMPTY_INFRA: MessagingInfraSnapshot = {
  rabbitmq: {
    connected: false,
    latencyMs: null,
    queueDepth: null,
    consumers: null,
  },
  kafka: {
    connected: false,
    latencyMs: null,
    latestOffset: null,
    partitions: null,
  },
  storage: {
    postgres: {
      connected: false,
      latencyMs: null,
    },
    redis: {
      connected: false,
      latencyMs: null,
    },
  },
};

@Injectable()
export class MessagingStatsService {
  private windowStartedAt = Date.now();
  private window = {
    packets: 0,
    nodeToHub: 0,
    hubToHub: 0,
    rabbitPublished: 0,
    kafkaPublished: 0,
    persistentWrites: 0,
  };

  private totals = {
    packets: 0,
    nodeToHub: 0,
    hubToHub: 0,
    rabbitPublished: 0,
    kafkaPublished: 0,
    persistentWrites: 0,
    errors: 0,
  };

  private rates = {
    packetsPerSecond: 0,
    nodeToHubPerSecond: 0,
    hubToHubPerSecond: 0,
    rabbitPublishedPerSecond: 0,
    kafkaPublishedPerSecond: 0,
    persistentWritesPerSecond: 0,
  };

  recordPacket(packet: TelemetryPacket): void {
    this.rollWindowIfNeeded();
    this.window.packets += 1;
    this.totals.packets += 1;

    if (packet.routeType === 'hub_to_hub') {
      this.window.hubToHub += 1;
      this.totals.hubToHub += 1;
      return;
    }

    this.window.nodeToHub += 1;
    this.totals.nodeToHub += 1;
  }

  recordRabbitPublished(): void {
    this.rollWindowIfNeeded();
    this.window.rabbitPublished += 1;
    this.totals.rabbitPublished += 1;
  }

  recordKafkaPublished(): void {
    this.rollWindowIfNeeded();
    this.window.kafkaPublished += 1;
    this.totals.kafkaPublished += 1;
  }

  recordPersistentWrite(): void {
    this.rollWindowIfNeeded();
    this.window.persistentWrites += 1;
    this.totals.persistentWrites += 1;
  }

  recordError(): void {
    this.totals.errors += 1;
  }

  getSnapshot(infra: MessagingInfraSnapshot | null): MessagingLiveStats {
    this.rollWindowIfNeeded();
    return {
      at: new Date().toISOString(),
      packetsPerSecond: this.rates.packetsPerSecond,
      nodeToHubPerSecond: this.rates.nodeToHubPerSecond,
      hubToHubPerSecond: this.rates.hubToHubPerSecond,
      rabbitPublishedPerSecond: this.rates.rabbitPublishedPerSecond,
      kafkaPublishedPerSecond: this.rates.kafkaPublishedPerSecond,
      persistentWritesPerSecond: this.rates.persistentWritesPerSecond,
      totals: { ...this.totals },
      infra: infra ?? EMPTY_INFRA,
    };
  }

  private rollWindowIfNeeded(): void {
    const now = Date.now();
    const elapsedMs = now - this.windowStartedAt;
    if (elapsedMs < 1000) {
      return;
    }

    const seconds = elapsedMs / 1000;
    this.rates.packetsPerSecond = Math.round(this.window.packets / seconds);
    this.rates.nodeToHubPerSecond = Math.round(this.window.nodeToHub / seconds);
    this.rates.hubToHubPerSecond = Math.round(this.window.hubToHub / seconds);
    this.rates.rabbitPublishedPerSecond = Math.round(
      this.window.rabbitPublished / seconds,
    );
    this.rates.kafkaPublishedPerSecond = Math.round(
      this.window.kafkaPublished / seconds,
    );
    this.rates.persistentWritesPerSecond = Math.round(
      this.window.persistentWrites / seconds,
    );

    this.window = {
      packets: 0,
      nodeToHub: 0,
      hubToHub: 0,
      rabbitPublished: 0,
      kafkaPublished: 0,
      persistentWrites: 0,
    };
    this.windowStartedAt = now;
  }
}
