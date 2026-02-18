import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscoveryEvent } from './discovery.entity';
import { CreateDiscoveryDto } from './dto/create-discovery.dto';
import { Discovery } from '../../../entities/discovery.entity';
import { EventsService } from '../../events/events.service';
import { createEventBase, generateUUID } from '@cosmic-horizons/event-models';

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    @InjectRepository(Discovery) private readonly discoveryRepo: Repository<Discovery>,
    private readonly eventsService: EventsService,
  ) {}

  // NOTE: when DB is available we persist discoveries; fallback to in-memory for tests/dev.
  // Seed persisted examples if repo is available synchronously (best-effort).
  async onModuleInit(): Promise<void> {
    try {
      // no-op seed when DB not initialized yet; leaving for manual migration/seed later
    } catch (err) {
      this.logger.debug('Skipping DB seed for CommunityDiscoveries (DB not ready)');
    }
  }

  async getFeed(limit = 25): Promise<DiscoveryEvent[]> {
    const rows = await this.discoveryRepo.find({ order: { createdAt: 'DESC' }, take: limit });
    return rows.map((r) => ({ id: r.id, title: r.title, body: r.body ?? undefined, author: r.author, tags: r.tags ?? undefined, createdAt: r.createdAt.toISOString() }));
  }

  async createDiscovery(dto: CreateDiscoveryDto): Promise<DiscoveryEvent> {
    const entity: Discovery = this.discoveryRepo.create({
      id: generateUUID(),
      title: dto.title,
      body: dto.body ?? null,
      author: dto.author ?? 'anonymous',
      tags: dto.tags ?? null,
      createdAt: new Date(),
    });

    const saved = await this.discoveryRepo.save(entity);

    // publish a notification event so UI can show toasts / subscribers can react
    const event = createEventBase(
      'community.discovery.created',
      saved.author || 'anonymous',
      this.eventsService.createCorrelationId(),
      { discovery_id: saved.id, title: saved.title, author: saved.author },
    );

    try {
      await this.eventsService.publishNotification(event);
    } catch (err) {
      this.logger.warn('Failed to publish discovery.created notification (continuing)');
    }

    return {
      id: saved.id,
      title: saved.title,
      body: saved.body ?? undefined,
      author: saved.author,
      tags: saved.tags ?? undefined,
      createdAt: saved.created_at.toISOString(),
    };
  }
}
