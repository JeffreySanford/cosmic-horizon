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
    expect(Array.isArray(feed)).toBeTrue();
    expect(feed.length).toBeGreaterThan(0);
    expect(repoMock.find).toHaveBeenCalled();
  });

  it('uses TypeORM find ordering and maps created_at to createdAt', async () => {
    const feed = await service.getFeed(10);
    expect(repoMock.find).toHaveBeenCalledWith({ order: { created_at: 'DESC' }, take: 10 });
    expect(feed[0]).toHaveProperty('createdAt');
    expect(typeof feed[0].createdAt).toBe('string');
    expect(new Date(feed[0].createdAt).toISOString()).toBe(feed[0].createdAt as string);
  });

  it('creates a discovery and persists + publishes event', async () => {
    const created = await service.createDiscovery({ title: 'hello', body: 'world' } as any);
    expect(created).toHaveProperty('id');
    expect(repoMock.save).toHaveBeenCalled();
    expect((eventsMock.publishNotification as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
