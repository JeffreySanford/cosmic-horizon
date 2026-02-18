import { Test, TestingModule } from '@nestjs/testing';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

describe('CommunityController (prototype)', () => {
  let controller: CommunityController;
  let service: CommunityService;

  beforeEach(async () => {
    const mockService = {
      getFeed: jest.fn().mockResolvedValue([{ id: '1', title: 'seed', createdAt: new Date().toISOString() }]),
      createDiscovery: jest.fn().mockImplementation(async (p) => ({ id: '1', title: p.title, createdAt: new Date().toISOString() })),
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

  it('creates a post via POST /posts', async () => {
    const created = await controller.createPost({ title: 'test post', body: 'ok' } as any);
    expect(created).toHaveProperty('id');
    expect(created.title).toEqual('test post');
  });
});
