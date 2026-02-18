import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscoveryEvent } from './discovery.entity';
import { CreateDiscoveryDto } from './dto/create-discovery.dto';
import { Discovery } from '../../entities/discovery.entity';
import { EventsService } from '../events/events.service';
import { createEventBase, generateUUID } from '@cosmic-horizons/event-models';

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    @InjectRepository(Discovery) private readonly discoveryRepo: Repository<Discovery>,
    private readonly eventsService: EventsService,
  ) {}

  // NOTE: when DB is available we persist discoveries; fallback to in-memory for tests/dev.
  // Seed persisted examples when running in dev/start:all so the UI has sample data.
  async onModuleInit(): Promise<void> {
    try {
      // Only seed in development to avoid accidental production writes
      if (process.env.NODE_ENV === 'production') return;

      const existing = await this.discoveryRepo.count();
      if (existing > 0) return; // already seeded

      const seeds: Discovery[] = [
        this.discoveryRepo.create({
          id: generateUUID(),
          title: 'Welcome to Community Discoveries',
          body: 'This is a seeded announcement for the Community Discoveries prototype.',
          author: 'system',
          tags: ['prototype', 'welcome'],
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
        }),
        this.discoveryRepo.create({
          id: generateUUID(),
          title: 'Symposium 2026 — abstract deadline',
          body: 'Reminder: Symposium 2026 abstract deadline is April 1, 2026. Submit your abstracts to the planning committee.',
          author: 'announcements',
          tags: ['symposium', 'deadline'],
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
        }),
        this.discoveryRepo.create({
          id: generateUUID(),
          title: 'New: Community Feed is live (prototype)',
          body: 'Try posting short discoveries from the Community page. Entries are persisted in the DB and emit notification events for UI toasts.',
          author: 'system',
          tags: ['feature', 'prototype'],
          created_at: new Date(),
        }),
      ];

      await this.discoveryRepo.save(seeds);
      this.logger.log('Seeded Community Discoveries (development)');
    } catch (err) {
      // DB not ready or seeding failed in this environment — silently continue for dev/test
    }
  }

  async getFeed(limit = 25): Promise<DiscoveryEvent[]> {
    try {
      const rows = await this.discoveryRepo.find({
        order: { created_at: 'DESC' },
        take: limit,
      });

      return rows.map((r: any) => ({
        id: r.id,
        title: r.title,
        body: r.body ?? undefined,
        author: r.author,
        tags: r.tags ?? undefined,
        createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : new Date(r.created_at).toISOString(),
      }));
    } catch (err) {
      this.logger.error('CommunityService.getFeed failed', err as Error);
      // fail-safe: return empty feed rather than bubble an unknown server error to the UI
      return [];
    }
  }

  async createDiscovery(dto: CreateDiscoveryDto): Promise<DiscoveryEvent> {
    const entity: Discovery = this.discoveryRepo.create({
      id: generateUUID(),
      title: dto.title,
      body: dto.body ?? null,
      author: dto.author ?? 'anonymous',
      tags: dto.tags ?? null,
      created_at: new Date(),
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
      createdAt: saved.created_at instanceof Date ? saved.created_at.toISOString() : new Date(saved.created_at).toISOString(),
    };
  }
}
