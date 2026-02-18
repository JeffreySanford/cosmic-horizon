import { Test, TestingModule } from '@nestjs/testing';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

describe('CommunityController (prototype)', () => {
  let controller: CommunityController;
  let service: CommunityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityController],
      providers: [CommunityService],
    }).compile();

    controller = module.get<CommunityController>(CommunityController);
    service = module.get<CommunityService>(CommunityService);
  });

  it('returns feed via GET /feed', async () => {
    const feed = await controller.getFeed();
    expect(Array.isArray(feed)).toBeTrue();
    expect(feed.length).toBeGreaterThan(0);
  });

  it('creates a post via POST /posts', async () => {
    const created = await controller.createPost({ title: 'test post', body: 'ok' } as any);
    expect(created).toHaveProperty('id');
    expect(created.title).toEqual('test post');
  });
});
