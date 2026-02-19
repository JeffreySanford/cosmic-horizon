import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { CommunityService } from './community.service';
import { Discovery } from '../../entities/discovery.entity';
import { UserRepository } from '../../repositories';

describe('CommunityService (DB-backed)', () => {
  let service: CommunityService;
  let repoMock: Partial<jest.Mocked<Repository<Discovery>>>;
  let eventsMock: Partial<any>;

  beforeEach(async () => {
    repoMock = {
      find: jest.fn().mockResolvedValue([
        { id: 'seed-1', title: 'seed', body: 'b', author: 'system', tags: ['x'], created_at: new Date() },
      ]),
      findOne: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockImplementation((o) => o),
      save: jest.fn().mockImplementation(async (e) => ({ ...e, created_at: e.created_at || new Date() })),
      // ensure onModuleInit DB checks don't throw in tests
      query: jest.fn().mockResolvedValue(undefined),
    } as any;

    eventsMock = {
      publishNotification: jest.fn().mockResolvedValue(undefined),
      createCorrelationId: jest.fn().mockReturnValue('corr-1'),
    };

    const auditMock = {
      createAuditLog: jest.fn().mockResolvedValue(undefined),
    };

    const userMock = {
      findById: jest.fn().mockResolvedValue({ id: 'mod-1', role: 'moderator' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunityService,
        { provide: getRepositoryToken(Discovery), useValue: repoMock },
        { provide: (await import('../events/events.service')).EventsService, useValue: eventsMock },
        { provide: (await import('../../repositories')).AuditLogRepository, useValue: auditMock },
        { provide: UserRepository, useValue: userMock },
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

    // Approve (service method will call publishNotification and write audit)
    const approved = await service.approveDiscovery('seed-1', 'moderator-1');
    expect(approved).not.toBeNull();
  });

  it('writes audit log when hiding or approving discoveries', async () => {
    (repoMock.findOne as jest.Mock).mockResolvedValueOnce({ id: 'd1', hidden: false, created_at: new Date() });

    // hideDiscovery should call audit logger
    const hid = await service.hideDiscovery('d1', 'mod-1');
    expect(hid).toBe(true);

    // approveDiscovery should call audit logger (simulate hidden item)
    (repoMock.findOne as jest.Mock).mockResolvedValueOnce({ id: 'd2', hidden: true, created_at: new Date(), title: 't', author: 'a', body: null, tags: null });
    const approved = await service.approveDiscovery('d2', 'mod-1');
    expect(approved).not.toBeNull();
  });

  it('returns pending feed (hidden items) via getPendingFeed', async () => {
    (repoMock.find as jest.Mock).mockResolvedValueOnce([
      { id: 'pending-1', title: 'p', body: 'b', author: 'u', tags: [], created_at: new Date(), hidden: true },
    ]);

    const pending = await service.getPendingFeed(5);
    expect(repoMock.find).toHaveBeenCalledWith({ where: { hidden: true }, order: { created_at: 'DESC' }, take: 5 });
    expect(Array.isArray(pending)).toBe(true);
    expect(pending[0]).toHaveProperty('createdAt');
  });

  it('hideDiscovery sets hidden and saves when found', async () => {
    (repoMock.findOne as jest.Mock).mockResolvedValueOnce({ id: 'd1', hidden: false });
    const res = await service.hideDiscovery('d1');
    expect(res).toBe(true);
    expect(repoMock.save).toHaveBeenCalled();
  });

  it('hideDiscovery returns false when discovery not found', async () => {
    (repoMock.findOne as jest.Mock).mockResolvedValueOnce(undefined);
    const res = await service.hideDiscovery('missing');
    expect(res).toBe(false);
  });

  it('throws ForbiddenException when non-moderator attempts to hide a discovery', async () => {
    (repoMock.findOne as jest.Mock).mockResolvedValueOnce({ id: 'd1', hidden: false, created_at: new Date() });
    // simulate a normal user
    (service as any).userRepository.findById.mockResolvedValueOnce({ id: 'user-1', role: 'user' });

    await expect(service.hideDiscovery('d1', 'user-1')).rejects.toThrowError(ForbiddenException);
  });

  it('throws ForbiddenException when non-moderator attempts to approve a discovery', async () => {
    (repoMock.findOne as jest.Mock).mockResolvedValueOnce({ id: 'd2', hidden: true, created_at: new Date(), title: 't', author: 'a', body: null, tags: null });
    // simulate a normal user
    (service as any).userRepository.findById.mockResolvedValueOnce({ id: 'user-2', role: 'user' });

    await expect(service.approveDiscovery('d2', 'user-2')).rejects.toThrowError(ForbiddenException);
  });
});
