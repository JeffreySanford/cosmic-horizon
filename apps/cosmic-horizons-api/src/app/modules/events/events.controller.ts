import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { EventReplayService } from './services/event-replay.service';
import { getAllTopicNames, isValidTopic } from './kafka/topics';

@Controller('events')
export class EventsController {
  constructor(private readonly eventReplayService: EventReplayService) {}

  @Get('topics')
  getTopics() {
    return {
      count: getAllTopicNames().length,
      topics: getAllTopicNames(),
    };
  }

  @Get('history')
  getEventHistory(
    @Query('topic') topic?: string,
    @Query('sinceTimestamp') sinceTimestamp?: string,
    @Query('fromOffset') fromOffset?: string,
    @Query('limit') limit?: string,
  ) {
    if (!topic || !isValidTopic(topic)) {
      return {
        count: 0,
        topic: topic ?? null,
        events: [],
        message: 'Provide a valid Kafka topic in ?topic=',
      };
    }

    const fromOffsetNumber =
      typeof fromOffset === 'string'
        ? Number.parseInt(fromOffset, 10)
        : undefined;
    const limitNumber =
      typeof limit === 'string' ? Number.parseInt(limit, 10) : undefined;

    const events = this.eventReplayService.getEventHistory({
      topic,
      sinceTimestamp,
      fromOffset:
        typeof fromOffsetNumber === 'number' &&
        Number.isFinite(fromOffsetNumber)
          ? fromOffsetNumber
          : undefined,
      limit:
        typeof limitNumber === 'number' && Number.isFinite(limitNumber)
          ? limitNumber
          : undefined,
    });

    return {
      count: events.length,
      topic,
      events,
    };
  }

  @Get('offsets')
  getConsumerOffsets(@Query('groupId') groupId?: string) {
    const offsets = this.eventReplayService.getConsumerOffsets(groupId);
    return {
      count: offsets.length,
      groupId: groupId ?? null,
      offsets,
    };
  }

  @Post('offsets/ack')
  ackConsumerOffset(
    @Body()
    body: {
      groupId?: string;
      topic?: string;
      partition?: number;
      offset?: number | string;
    },
  ) {
    if (!body.groupId || !body.topic || body.offset === undefined) {
      return {
        ok: false,
        message: 'groupId, topic, and offset are required',
      };
    }

    const record = this.eventReplayService.ackConsumerOffset({
      groupId: body.groupId,
      topic: body.topic,
      partition: body.partition ?? 0,
      offset: body.offset,
    });

    return {
      ok: true,
      record,
    };
  }
}
