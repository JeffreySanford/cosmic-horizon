import axios from 'axios';
import * as amqp from 'amqplib';

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

  it('publishes a RabbitMQ notification when a discovery is created', async () => {
    const nonce = Date.now();
    const payload = {
      title: `e2e-notif-${nonce}`,
      body: 'Notification test discovery',
      author: 'e2e-test',
      tags: ['e2e', 'notif'],
    };

    // Ensure the notifications queue is empty before the test
    const conn = await amqp.connect('amqp://guest:guest@localhost:5672');
    const ch = await conn.createChannel();
    try {
      await ch.purgeQueue('websocket-broadcast');

      const createRes = await axios.post('/api/community/posts', payload);
      expect(createRes.status).toBe(201);

      // Wait for a message on the websocket-broadcast queue (max 5s)
      const msg: amqp.ConsumeMessage | null = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 5000);
        ch.consume('websocket-broadcast', (m) => {
          if (m) {
            clearTimeout(timer);
            ch.ack(m);
            resolve(m);
          }
        });
      });

      expect(msg).not.toBeNull();
      const body = JSON.parse(msg!.content.toString());
      expect(body.event_type).toBe('community.discovery.created');
      expect(body.payload.title).toBe(payload.title);
    } finally {
      await ch.close();
      await conn.close();
    }
  }, 15000);

  it('supports moderation: hidden posts are not in feed until approved', async () => {
    const nonce = Date.now();
    const payload = {
      title: `e2e-moderation-${nonce}`,
      body: 'Moderation test discovery',
      author: 'e2e-test',
      tags: ['e2e', 'mod'],
    };

    // Create a post and force it to be hidden (dev/test support)
    const createRes = await axios.post('/api/community/posts?forceHidden=true', payload);
    expect(createRes.status).toBe(201);
    const createdId = createRes.data.id;

    const feedRes = await axios.get('/api/community/feed');
    const foundHidden = (feedRes.data as any[]).some((r) => r.id === createdId);
    expect(foundHidden).toBe(false);

    // Approve via API
    const approveRes = await axios.patch(`/api/community/posts/${createdId}/approve`);
    expect(approveRes.status).toBe(200);

    const feedResAfter = await axios.get('/api/community/feed');
    const foundAfter = (feedResAfter.data as any[]).some((r) => r.id === createdId && r.title === payload.title);
    expect(foundAfter).toBe(true);
  }, 15000);
});
