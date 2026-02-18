import axios from 'axios';

describe('Community Discoveries e2e', () => {
  beforeAll(() => {
    // axios baseURL is configured in global e2e setup
  });

  it('GET /api/community/feed returns seeded rows (development seeds)', async () => {
    const res = await axios.get('/api/community/feed');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    // Expect at least the three seeded rows added by CommunityService migration/seed
    expect(res.data.length).toBeGreaterThanOrEqual(3);

    const titles = res.data.map((r: any) => r.title);
    expect(titles).toEqual(expect.arrayContaining([
      'Welcome to Community Discoveries',
      'Symposium 2026 — abstract deadline',
      'New: Community Feed is live (prototype)',
    ]));
  });

  it('POST /api/community/posts persists new discovery and appears in feed', async () => {
    const nonce = Date.now();
    const payload = {
      title: `e2e-post-${nonce}`,
      body: 'This is an e2e test discovery',
      author: 'e2e-test',
      tags: ['e2e', 'test'],
    };

    const createRes = await axios.post('/api/community/posts', payload);
    expect(createRes.status).toBe(201);
    expect(createRes.data).toMatchObject({ title: payload.title, author: payload.author });

    const feedRes = await axios.get('/api/community/feed');
    const found = (feedRes.data as any[]).some((r) => r.title === payload.title && r.author === payload.author);
    expect(found).toBe(true);
  }, 10000);
});
