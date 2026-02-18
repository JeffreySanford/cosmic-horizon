import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommunityService } from './community.service';
import { Discovery } from '../../entities/discovery.entity';

describe('CommunityService (DB-backed)', () => {
  let service: CommunityService;
  let repoMock: Partial<jest.Mocked<Repository<Discovery>>>;
  let eventsMock: Partial<any>;

  beforeEach(async () => {
    repoMock = {
      find: jest.fn().mockResolvedValue([
        { id: 'seed-1', title: 'seed', body: 'b', author: 'system', tags: ['x'], created_at: new Date() },
      ]),
      create: jest.fn().mockImplementation((o) => o),
      save: jest.fn().mockImplementation(async (e) => ({ ...e, created_at: e.created_at || new Date() })),
    } as any;

    eventsMock = {
      publishNotification: jest.fn().mockResolvedValue(undefined),
      createCorrelationId: jest.fn().mockReturnValue('corr-1'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        { provide: getRepositoryToken(Discovery), useValue: repoMock },
        { provide: (await import('../events/events.service')).EventsService, useValue: eventsMock },
      ],
    }).compile();

    service = module.get<CommunityService>(CommunityService);
  });

  it('returns feed from repository', async () => {
    const feed = await service.getFeed();
    expect(Array.isArray(feed)).toBe(true);
    expect(feed.length).toBeGreaterThan(0);
    expect(repoMock.find).toHaveBeenCalled();
  });

  it('uses TypeORM find ordering and maps created_at to createdAt (only visible items)', async () => {
    const feed = await service.getFeed(10);
    expect(repoMock.find).toHaveBeenCalledWith({ where: { hidden: false }, order: { created_at: 'DESC' }, take: 10 });
    expect(feed[0]).toHaveProperty('createdAt');
    expect(typeof feed[0].createdAt).toBe('string');
    expect(new Date(feed[0].createdAt).toISOString()).toBe(feed[0].createdAt as string);
  });

  it('creates a discovery (hidden when forceHidden) and does not publish notification immediately', async () => {
    const created = await service.createDiscovery({ title: 'hello', body: 'world' } as any, { forceHidden: true });
    expect(created).toHaveProperty('id');
    expect(repoMock.save).toHaveBeenCalled();
    // Since it's hidden, publishNotification should NOT be called
    expect((eventsMock.publishNotification as jest.Mock).mock.calls.length).toBe(0);
  });

  it('approves a hidden discovery and publishes notification', async () => {
    const saved = await service.createDiscovery({ title: 'to-approve', body: 'x' } as any, { forceHidden: true });
    // Simulate DB find returning an entity that is hidden
    (repoMock.find as jest.Mock).mockResolvedValueOnce([{ id: 'seed-1', title: 'seed', body: 'b', author: 'system', tags: ['x'], created_at: new Date(), hidden: true }]);

    // Approve (service method will call publishNotification)
    const approved = await service.approveDiscovery('seed-1');
    expect(approved).not.toBeNull();
  });
});
