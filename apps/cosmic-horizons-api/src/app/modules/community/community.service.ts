import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscoveryEvent } from './discovery.entity';
import { CreateDiscoveryDto } from './dto/create-discovery.dto';
import { Discovery } from '../../entities/discovery.entity';
import { EventsService } from '../events/events.service';
import { AuditLogRepository } from '../../repositories/audit-log.repository';
import { UserRepository } from '../../repositories';
import { AuditAction, AuditEntityType } from '../../entities/audit-log.entity';
import { createEventBase, generateUUID } from '@cosmic-horizons/event-models';

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    @InjectRepository(Discovery)
    private readonly discoveryRepo: Repository<Discovery>,
    private readonly eventsService: EventsService,
    private readonly auditLogRepository: AuditLogRepository,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Service-level authorization check for moderation actions.
   * - If no actorUserId is supplied we *do not* enforce (preserve existing callers).
   * - If actorUserId is supplied, user must exist and be `admin` or `moderator`.
   */
  private async assertCanModerate(actorUserId?: string | null): Promise<void> {
    if (!actorUserId) return; // allow internal/system callers that don't pass a user id

    const actor = await this.userRepository.findById(actorUserId);
    if (!actor) {
      throw new ForbiddenException('Acting user not found');
    }

    if (actor.role !== 'admin' && actor.role !== 'moderator') {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  // NOTE: when DB is available we persist discoveries; fallback to in-memory for tests/dev.
  // Seed persisted examples when running in dev/start:all so the UI has sample data.
  async onModuleInit(): Promise<void> {
    try {
      // Only seed in development to avoid accidental production writes
      if (process.env.NODE_ENV === 'production') return;

      // Ensure the discoveries table (and 'hidden' column) exist so we can seed
      // without relying on TypeORM migrations being executed.
      try {
        await this.discoveryRepo.query(
          `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`,
        );
        await this.discoveryRepo.query(`
          CREATE TABLE IF NOT EXISTS "discoveries" (
            "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            "title" character varying(512) NOT NULL,
            "body" text,
            "author" character varying(128) DEFAULT 'anonymous',
            "tags" jsonb,
            "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        await this.discoveryRepo.query(
          `ALTER TABLE "discoveries" ADD COLUMN IF NOT EXISTS "hidden" boolean NOT NULL DEFAULT false`,
        );
      } catch (ensureErr) {
        this.logger.warn(
          'Could not ensure discoveries table/schema at startup (continuing):',
          ensureErr instanceof Error ? ensureErr.message : ensureErr,
        );
      }

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
    } catch {
      // DB not ready or seeding failed in this environment — silently continue for dev/test
    }
  }

  async getFeed(limit = 25): Promise<DiscoveryEvent[]> {
    try {
      const rows = await this.discoveryRepo.find({
        where: { hidden: false },
        order: { created_at: 'DESC' },
        take: limit,
      });

      return rows.map((r: Discovery) => ({
        id: r.id,
        title: r.title,
        body: r.body ?? undefined,
        author: r.author,
        tags: r.tags ?? undefined,
        createdAt:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : new Date(r.created_at).toISOString(),
      }));
    } catch (err) {
      this.logger.error('CommunityService.getFeed failed', err as Error);
      // fail-safe: return empty feed rather than bubble an unknown server error to the UI
      return [];
    }
  }

  async getPendingFeed(limit = 25): Promise<DiscoveryEvent[]> {
    try {
      const rows = await this.discoveryRepo.find({
        where: { hidden: true },
        order: { created_at: 'DESC' },
        take: limit,
      });

      return rows.map((r: Discovery) => ({
        id: r.id,
        title: r.title,
        body: r.body ?? undefined,
        author: r.author,
        tags: r.tags ?? undefined,
        createdAt:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : new Date(r.created_at).toISOString(),
      }));
    } catch (err) {
      this.logger.error('CommunityService.getPendingFeed failed', err as Error);
      return [];
    }
  }

  async hideDiscovery(
    id: string,
    actorUserId?: string | null,
  ): Promise<boolean> {
    const found = await this.discoveryRepo.findOne({ where: { id } });
    if (!found) return false;

    // Service-level authorization (defense-in-depth). Only enforced when an actor id is supplied.
    await this.assertCanModerate(actorUserId);

    const before = { hidden: found.hidden };
    found.hidden = true;
    const saved = await this.discoveryRepo.save(found);

    // audit trail (best-effort)
    try {
      await this.auditLogRepository.createAuditLog({
        user_id: actorUserId ?? null,
        action: AuditAction.HIDE,
        entity_type: AuditEntityType.POST,
        entity_id: saved.id,
        changes: { before, after: { hidden: saved.hidden } },
      });
    } catch {
      this.logger.warn(
        'Failed to write audit log for hideDiscovery (continuing)',
      );
    }

    return true;
  }

  async createDiscovery(
    dto: CreateDiscoveryDto,
    options?: { forceHidden?: boolean; autoApprove?: boolean },
  ): Promise<DiscoveryEvent> {
    const moderationEnabled =
      process.env.FEATURE_COMMUNITY_MODERATION === 'true';
    const forceHidden = options?.forceHidden === true;
    const autoApprove = options?.autoApprove === true;

    const isHidden = forceHidden || (moderationEnabled && !autoApprove);

    const entity: Discovery = this.discoveryRepo.create({
      id: generateUUID(),
      title: dto.title,
      body: dto.body ?? null,
      author: dto.author ?? 'anonymous',
      tags: dto.tags ?? null,
      created_at: new Date(),
      hidden: isHidden,
    });

    const saved = await this.discoveryRepo.save(entity);

    // publish a notification event only for immediately published discoveries
    if (!saved.hidden) {
      const event = createEventBase(
        'community.discovery.created',
        saved.author || 'anonymous',
        this.eventsService.createCorrelationId(),
        { discovery_id: saved.id, title: saved.title, author: saved.author },
      );

      try {
        await this.eventsService.publishNotification(event);
      } catch {
        this.logger.warn(
          'Failed to publish discovery.created notification (continuing)',
        );
      }
    }

    return {
      id: saved.id,
      title: saved.title,
      body: saved.body ?? undefined,
      author: saved.author,
      tags: saved.tags ?? undefined,
      createdAt:
        saved.created_at instanceof Date
          ? saved.created_at.toISOString()
          : new Date(saved.created_at).toISOString(),
    };
  }

  async approveDiscovery(
    id: string,
    actorUserId?: string | null,
  ): Promise<DiscoveryEvent | null> {
    const found = await this.discoveryRepo.findOne({ where: { id } });
    if (!found) return null;

    // Service-level authorization (defense-in-depth). Only enforced when an actor id is supplied.
    await this.assertCanModerate(actorUserId);

    if (!found.hidden) {
      return {
        id: found.id,
        title: found.title,
        body: found.body ?? undefined,
        author: found.author,
        tags: found.tags ?? undefined,
        createdAt:
          found.created_at instanceof Date
            ? found.created_at.toISOString()
            : new Date(found.created_at).toISOString(),
      };
    }

    const before = { hidden: found.hidden };
    found.hidden = false;
    const saved = await this.discoveryRepo.save(found);

    const event = createEventBase(
      'community.discovery.created',
      saved.author || 'anonymous',
      this.eventsService.createCorrelationId(),
      { discovery_id: saved.id, title: saved.title, author: saved.author },
    );

    try {
      await this.eventsService.publishNotification(event);
    } catch {
      this.logger.warn(
        'Failed to publish discovery.created notification after approve (continuing)',
      );
    }

    // audit trail (best-effort)
    try {
      await this.auditLogRepository.createAuditLog({
        user_id: actorUserId ?? null,
        action: AuditAction.UNHIDE,
        entity_type: AuditEntityType.POST,
        entity_id: saved.id,
        changes: { before, after: { hidden: saved.hidden } },
      });
    } catch {
      this.logger.warn(
        'Failed to write audit log for approveDiscovery (continuing)',
      );
    }

    return {
      id: saved.id,
      title: saved.title,
      body: saved.body ?? undefined,
      author: saved.author,
      tags: saved.tags ?? undefined,
      createdAt:
        saved.created_at instanceof Date
          ? saved.created_at.toISOString()
          : new Date(saved.created_at).toISOString(),
    };
  }
}
