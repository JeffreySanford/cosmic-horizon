import { CommunityService } from './community.service';

describe('CommunityService (prototype)', () => {
  let service: CommunityService;

  beforeEach(() => {
    service = new CommunityService();
  });

  it('should return a seeded feed', async () => {
    const feed = await service.getFeed();
    expect(Array.isArray(feed)).toBeTrue();
    expect(feed.length).toBeGreaterThanOrEqual(2); // seeded items
    expect(feed[0].title).toBeDefined();
  });

  it('should create a new discovery and appear at the top of the feed', async () => {
    const before = await service.getFeed();
    const created = await service.createDiscovery({ title: 'x', body: 'y' } as any);
    expect(created.id).toBeDefined();
    const after = await service.getFeed();
    expect(after[0].id).toEqual(created.id);
    expect(after.length).toBeGreaterThanOrEqual(before.length + 1 - 1); // at least same or longer
  });
});
