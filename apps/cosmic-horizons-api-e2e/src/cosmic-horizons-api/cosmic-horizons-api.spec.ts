import axios, { AxiosError } from 'axios';
import { Client } from 'pg';

describe('cosmic-horizons-api e2e', () => {
  async function registerUser(
    username: string,
    email: string,
    password = 'Password123!',
  ): Promise<{ access_token: string; user: { id: string } }> {
    const response = await axios.post('/api/auth/register', {
      username,
      email,
      password,
    });
    return response.data as { access_token: string; user: { id: string } };
  }

  async function fetchAuditLog(entityId: string, action: string) {
    const client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 15432),
      user: process.env.DB_USER || 'cosmic_horizons_user',
      password: process.env.DB_PASSWORD || 'cosmic_horizons_password_dev',
      database: process.env.DB_NAME || 'cosmic_horizons',
    });

    await client.connect();
    try {
      const res = await client.query(
        `SELECT id, user_id, action, entity_type, entity_id, changes, created_at
         FROM audit_logs
         WHERE entity_id = $1 AND action = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [entityId, action],
      );
      return res.rows[0] ?? null;
    } finally {
      await client.end();
    }
  }

  it('GET /api returns API banner', async () => {
    const response = await axios.get('/api');
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ message: 'Cosmic Horizon API' });
  });

  describe('auth login', () => {
    it('POST /api/auth/register creates account and returns token', async () => {
      const nonce = Date.now();
      const response = await axios.post('/api/auth/register', {
        username: `new_user_${nonce}`,
        email: `new_${nonce}@cosmic.local`,
        password: 'Password123!',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('access_token');
      expect(response.data.user).toMatchObject({
        username: `new_user_${nonce}`,
        email: `new_${nonce}@cosmic.local`,
      });
    });

    it('POST /api/auth/login returns token for seeded user', async () => {
      const response = await axios.post('/api/auth/login', {
        email: 'test@cosmic.local',
        password: 'Password123!',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('access_token');
      expect(response.data.user).toMatchObject({
        username: 'testuser',
        email: 'test@cosmic.local',
      });
    });

    it('POST /api/auth/login rejects invalid credentials', async () => {
      try {
        await axios.post('/api/auth/login', {
          email: 'test@cosmic.local',
          password: 'wrong-password',
        });
        throw new Error('Expected login request to fail with 401');
      } catch (error) {
        const axiosError = error as AxiosError<{ message?: string }>;
        expect(axiosError.response?.status).toBe(401);
      }
    });
  });

  describe('rate limiting for write endpoints', () => {
    it('returns 429 when the write limit is exceeded on /api/users', async () => {
      const createdUserIds: string[] = [];
      let tooManyRequestsSeen = false;
      const nonce = Date.now();

      for (let i = 0; i < 40; i += 1) {
        try {
          const response = await axios.post('/api/users', {
            username: `ratelimit_user_${nonce}_${i}`,
            email: `ratelimit_${nonce}_${i}@cosmic.local`,
            display_name: `Rate Limit User ${i}`,
            github_id: nonce + i,
          });
          createdUserIds.push(response.data.id as string);
        } catch (error) {
          const axiosError = error as AxiosError;
          if (axiosError.response?.status === 429) {
            tooManyRequestsSeen = true;
            break;
          }
          throw error;
        }
      }

      expect(tooManyRequestsSeen).toBe(true);

      for (const id of createdUserIds) {
        await axios.delete(`/api/users/${id}`);
      }
    });
  });

  describe('viewer permalink and snapshot', () => {
    it('POST /api/view/state creates and GET /api/view/:shortId resolves state', async () => {
      const createResponse = await axios.post('/api/view/state', {
        state: {
          ra: 187.25,
          dec: 2.05,
          fov: 1.5,
          survey: 'VLASS',
        },
      });

      expect(createResponse.status).toBe(201);
      expect(createResponse.data).toHaveProperty('short_id');
      expect(createResponse.data).toHaveProperty('encoded_state');

      const resolveResponse = await axios.get(
        `/api/view/${createResponse.data.short_id as string}`,
      );
      expect(resolveResponse.status).toBe(200);
      expect(resolveResponse.data.state).toMatchObject({
        ra: 187.25,
        dec: 2.05,
        fov: 1.5,
        survey: 'VLASS',
      });
    });

    it('round-trips a non-default survey in permalink state', async () => {
      const createResponse = await axios.post('/api/view/state', {
        state: {
          ra: 12.3456,
          dec: -45.6789,
          fov: 0.75,
          survey: 'P/DSS2/color',
        },
      });

      expect(createResponse.status).toBe(201);
      const shortId = createResponse.data.short_id as string;
      expect(shortId.length).toBeGreaterThan(0);

      const resolveResponse = await axios.get(`/api/view/${shortId}`);
      expect(resolveResponse.status).toBe(200);
      expect(resolveResponse.data.state).toMatchObject({
        ra: 12.3456,
        dec: -45.6789,
        fov: 0.75,
        survey: 'P/DSS2/color',
      });
    });

    it('POST /api/view/snapshot stores snapshot metadata', async () => {
      const onePixelPngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO1N7nQAAAAASUVORK5CYII=';

      const response = await axios.post('/api/view/snapshot', {
        image_data_url: `data:image/png;base64,${onePixelPngBase64}`,
        state: {
          ra: 200.1,
          dec: -20.2,
          fov: 2.5,
          survey: 'VLASS',
        },
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('id');
      expect(response.data.image_url).toMatch(
        /^\/api\/view\/snapshots\/.+\.png$/,
      );
      expect(response.data.size_bytes).toBeGreaterThan(0);
    });

    it('GET /api/view/cutout validates required query params', async () => {
      try {
        await axios.get('/api/view/cutout?ra=10&dec=5&fov=0&survey=VLASS', {
          responseType: 'arraybuffer',
        });
        throw new Error('Expected cutout request to fail with 400');
      } catch (error) {
        const axiosError = error as AxiosError<{ message?: string }>;
        expect(axiosError.response?.status).toBe(400);
      }
    });

    it('GET /api/view/labels/nearby validates radius bounds', async () => {
      try {
        await axios.get('/api/view/labels/nearby?ra=10&dec=5&radius=0');
        throw new Error('Expected nearby labels request to fail with 400');
      } catch (error) {
        const axiosError = error as AxiosError<{ message?: string }>;
        expect(axiosError.response?.status).toBe(400);
      }
    });

    it('GET /api/view/telemetry requires authenticated admin access', async () => {
      try {
        await axios.get('/api/view/telemetry');
        throw new Error('Expected telemetry request to fail with 401');
      } catch (error) {
        const axiosError = error as AxiosError<{ message?: string }>;
        expect(axiosError.response?.status).toBe(401);
      }
    });
  });

  describe('posts authorization and revision flow', () => {
    it('creates, updates, and publishes a post as owner', async () => {
      const nonce = Date.now();
      const owner = await registerUser(
        `post_owner_${nonce}`,
        `post_owner_${nonce}@cosmic.local`,
      );
      const authHeader = { Authorization: `Bearer ${owner.access_token}` };

      const createResponse = await axios.post(
        '/api/posts',
        {
          title: 'Owner Draft',
          content: 'Initial content for owner-managed post.',
        },
        { headers: authHeader },
      );

      expect(createResponse.status).toBe(201);
      expect(createResponse.data).toMatchObject({
        title: 'Owner Draft',
        status: 'draft',
      });

      const postId = createResponse.data.id as string;
      const updateResponse = await axios.put(
        `/api/posts/${postId}`,
        {
          title: 'Owner Draft Updated',
          content: 'Updated content for owner-managed post.',
        },
        { headers: authHeader },
      );
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data).toMatchObject({
        id: postId,
        title: 'Owner Draft Updated',
      });

      const publishResponse = await axios.post(
        `/api/posts/${postId}/publish`,
        {},
        { headers: authHeader },
      );
      expect(publishResponse.status).toBe(201);
      expect(publishResponse.data).toMatchObject({
        id: postId,
        status: 'published',
      });

      const detailResponse = await axios.get(`/api/posts/${postId}`);
      expect(detailResponse.status).toBe(200);
      expect(Array.isArray(detailResponse.data.revisions)).toBe(true);
      expect(detailResponse.data.revisions.length).toBeGreaterThanOrEqual(2);
    });

    it('rejects non-owner post modification with 403', async () => {
      const nonce = Date.now() + 1;
      const owner = await registerUser(
        `post_owner2_${nonce}`,
        `post_owner2_${nonce}@cosmic.local`,
      );
      const otherUser = await registerUser(
        `post_other_${nonce}`,
        `post_other_${nonce}@cosmic.local`,
      );

      const createResponse = await axios.post(
        '/api/posts',
        {
          title: 'Owner Locked Post',
          content: 'Owner-only edit protection target.',
        },
        { headers: { Authorization: `Bearer ${owner.access_token}` } },
      );
      const postId = createResponse.data.id as string;

      try {
        await axios.put(
          `/api/posts/${postId}`,
          {
            title: 'Unauthorized update',
          },
          { headers: { Authorization: `Bearer ${otherUser.access_token}` } },
        );
        throw new Error('Expected non-owner update to fail');
      } catch (error) {
        const axiosError = error as AxiosError<{ message?: string }>;
        expect(axiosError.response?.status).toBe(403);
      }
    });

    it('supports owner moderation actions: hide/unhide and lock/unlock', async () => {
      const nonce = Date.now() + 2;
      const owner = await registerUser(
        `post_owner3_${nonce}`,
        `post_owner3_${nonce}@cosmic.local`,
      );
      const authHeader = { Authorization: `Bearer ${owner.access_token}` };

      const createResponse = await axios.post(
        '/api/posts',
        {
          title: 'Moderation Target',
          content: 'Owner moderation path target.',
        },
        { headers: authHeader },
      );
      const postId = createResponse.data.id as string;

      const hideResponse = await axios.post(
        `/api/posts/${postId}/hide`,
        {},
        { headers: authHeader },
      );
      expect(hideResponse.status).toBe(201);
      expect(hideResponse.data.hidden_at).not.toBeNull();

      const lockResponse = await axios.post(
        `/api/posts/${postId}/lock`,
        {},
        { headers: authHeader },
      );
      expect(lockResponse.status).toBe(201);
      expect(lockResponse.data.locked_at).not.toBeNull();

      const unlockResponse = await axios.post(
        `/api/posts/${postId}/unlock`,
        {},
        { headers: authHeader },
      );
      expect(unlockResponse.status).toBe(201);
      expect(unlockResponse.data.locked_at).toBeNull();

      const unhideResponse = await axios.post(
        `/api/posts/${postId}/unhide`,
        {},
        { headers: authHeader },
      );
      expect(unhideResponse.status).toBe(201);
      expect(unhideResponse.data.hidden_at).toBeNull();
    });

    describe('community moderation (RBAC) - e2e', () => {
      it('PATCH /api/community/posts/:id/approve requires moderator/admin (401/403/200)', async () => {
        const payload = {
          title: `e2e-moderation-approve-${Date.now()}`,
          body: 'E2E approval test',
          author: 'e2e',
        };
        const createRes = await axios.post(
          '/api/community/posts?forceHidden=true',
          payload,
        );
        expect(createRes.status).toBe(201);
        const created = createRes.data;

        // unauthenticated -> 401
        try {
          await axios.patch(`/api/community/posts/${created.id}/approve`);
          throw new Error('Expected unauthenticated approve to fail');
        } catch (err) {
          const axiosErr = err as AxiosError;
          expect(axiosErr.response?.status).toBe(401);
        }

        // authenticated normal user -> 403
        const userLogin = await axios.post('/api/auth/login', {
          email: 'test@cosmic.local',
          password: 'Password123!',
        });
        expect(userLogin.status).toBe(201);
        const userToken = userLogin.data.access_token as string;

        try {
          await axios.patch(
            `/api/community/posts/${created.id}/approve`,
            {},
            { headers: { Authorization: `Bearer ${userToken}` } },
          );
          throw new Error('Expected user approve to fail with 403');
        } catch (err) {
          const axiosErr = err as AxiosError;
          expect(axiosErr.response?.status).toBe(403);
        }

        // admin -> 200
        const adminLogin = await axios.post('/api/auth/login', {
          email: 'admin@cosmic.local',
          password: 'AdminPassword123!',
        });
        expect(adminLogin.status).toBe(201);
        const adminToken = adminLogin.data.access_token as string;

        const approveRes = await axios.patch(
          `/api/community/posts/${created.id}/approve`,
          {},
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );
        expect(approveRes.status).toBe(200);
        expect(approveRes.data).toHaveProperty('ok', true);

        // verify audit log row was written (best-effort e2e assertion)
        const audit = await fetchAuditLog(created.id, 'unhide');
        expect(audit).not.toBeNull();
        expect(audit?.entity_id).toBe(created.id);
        expect(audit?.action).toBe('unhide');
      });

      it('PATCH /api/community/posts/:id/hide requires moderator/admin (401/403/200)', async () => {
        const payload = {
          title: `e2e-moderation-hide-${Date.now()}`,
          body: 'E2E hide test',
          author: 'e2e',
        };
        const createRes = await axios.post('/api/community/posts', payload);
        expect(createRes.status).toBe(201);
        const created = createRes.data;

        // unauthenticated -> 401
        try {
          await axios.patch(`/api/community/posts/${created.id}/hide`);
          throw new Error('Expected unauthenticated hide to fail');
        } catch (err) {
          const axiosErr = err as AxiosError;
          expect(axiosErr.response?.status).toBe(401);
        }

        // authenticated normal user -> 403
        const userLogin = await axios.post('/api/auth/login', {
          email: 'test@cosmic.local',
          password: 'Password123!',
        });
        expect(userLogin.status).toBe(201);
        const userToken = userLogin.data.access_token as string;

        try {
          await axios.patch(
            `/api/community/posts/${created.id}/hide`,
            {},
            { headers: { Authorization: `Bearer ${userToken}` } },
          );
          throw new Error('Expected user hide to fail with 403');
        } catch (err) {
          const axiosErr = err as AxiosError;
          expect(axiosErr.response?.status).toBe(403);
        }

        // admin -> 200
        const adminLogin = await axios.post('/api/auth/login', {
          email: 'admin@cosmic.local',
          password: 'AdminPassword123!',
        });
        expect(adminLogin.status).toBe(201);
        const adminToken = adminLogin.data.access_token as string;

        const hideRes = await axios.patch(
          `/api/community/posts/${created.id}/hide`,
          {},
          { headers: { Authorization: `Bearer ${adminToken}` } },
        );
        expect(hideRes.status).toBe(200);
        expect(hideRes.data).toHaveProperty('ok', true);

        // verify audit log row was written (best-effort e2e assertion)
        const audit = await fetchAuditLog(created.id, 'hide');
        expect(audit).not.toBeNull();
        expect(audit?.entity_id).toBe(created.id);
        expect(audit?.action).toBe('hide');
      });
    });
  });
});
