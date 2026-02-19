import { Test, TestingModule } from '@nestjs/testing';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

describe('CommunityController (prototype)', () => {
  let controller: CommunityController;
  let service: CommunityService;

  beforeEach(async () => {
    const mockService = {
      getFeed: jest
        .fn()
        .mockResolvedValue([
          { id: '1', title: 'seed', createdAt: new Date().toISOString() },
        ]),
      getPendingFeed: jest
        .fn()
        .mockResolvedValue([
          { id: 'p1', title: 'pending', createdAt: new Date().toISOString() },
        ]),
      createDiscovery: jest
        .fn()
        .mockImplementation(async (p) => ({
          id: '1',
          title: p.title,
          createdAt: new Date().toISOString(),
        })),
      approveDiscovery: jest
        .fn()
        .mockResolvedValue({ id: 'p1', title: 'pending' }),
      hideDiscovery: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityController],
      providers: [{ provide: CommunityService, useValue: mockService }],
    }).compile();

    controller = module.get<CommunityController>(CommunityController);
    service = module.get<CommunityService>(CommunityService);
  });

  it('returns feed via GET /feed', async () => {
    const feed = await controller.getFeed();
    expect(Array.isArray(feed)).toBe(true);
    expect(feed.length).toBeGreaterThan(0);
  });

  it('returns pending via GET /posts/pending', async () => {
    // Provide a mock authenticated request with admin privileges so controller
    // permission check passes.
    const mockReq = { user: { id: 'admin-1', role: 'admin' } } as any;
    const pending = await controller.getPending(mockReq);
    expect(Array.isArray(pending)).toBe(true);
    expect(
      (service.getPendingFeed as jest.Mock).mock.calls.length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('creates a post via POST /posts', async () => {
    const created = await controller.createPost({
      title: 'test post',
      body: 'ok',
    } as any);
    expect(created).toHaveProperty('id');
    expect(created.title).toEqual('test post');
  });

  it('approves a post via PATCH /posts/:id/approve (moderator)', async () => {
    const mockReq = { user: { id: 'mod-1', role: 'moderator' } } as any;
    const res = await controller.approvePost(mockReq, 'p1');
    expect((service.approveDiscovery as jest.Mock).mock.calls.length).toBe(1);
    expect(res).toHaveProperty('ok', true);
  });

  it('rejects approve when user is not moderator/admin', async () => {
    const mockReq = { user: { id: 'user-1', role: 'user' } } as any;
    await expect(controller.approvePost(mockReq, 'p1')).rejects.toThrow();
  });

  it('hides a post via PATCH /posts/:id/hide (admin)', async () => {
    const mockReq = { user: { id: 'admin-1', role: 'admin' } } as any;
    const res = await controller.hidePost(mockReq, 'p1');
    expect((service.hideDiscovery as jest.Mock).mock.calls.length).toBe(1);
    expect(res).toHaveProperty('ok', true);
  });

  it('rejects hide when user is not moderator/admin', async () => {
    const mockReq = { user: { id: 'user-1', role: 'user' } } as any;
    await expect(controller.hidePost(mockReq, 'p1')).rejects.toThrow();
  });
});
