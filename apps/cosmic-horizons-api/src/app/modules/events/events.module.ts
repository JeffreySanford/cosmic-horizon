import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { RabbitMQService } from './rabbitmq.service';
import { KafkaService } from './kafka.service';
import { MetricsService } from './services/metrics.service';
import { MetricsConsumer } from './consumers/metrics.consumer';
import { EventReplayService } from './services/event-replay.service';

/**
 * EventsModule
 *
 * Provides centralized event streaming infrastructure for Phase 3
 * - RabbitMQ for ephemeral events (low-latency)
 * - Kafka for durable events (audit trail + replay)
 *
 * Sprint 5.1: RabbitMQ Foundation
 * Sprint 5.2: Kafka Integration
 * Sprint 5.3: Job Orchestration Events + Consumer Services
 */
@Module({
  imports: [ConfigModule],
  controllers: [EventsController],
  providers: [
    EventsService,
    RabbitMQService,
    KafkaService,
    MetricsService,
    MetricsConsumer,
    EventReplayService,
  ],
  exports: [EventsService, RabbitMQService, KafkaService, MetricsService, EventReplayService],
})
export class EventsModule {}
