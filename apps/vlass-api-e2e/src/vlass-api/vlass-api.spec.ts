import axios, { AxiosError } from 'axios';

describe('vlass-api e2e', () => {
  it('GET /api returns API banner', async () => {
    const response = await axios.get('/api');
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ message: 'VLASS Portal API' });
  });

  describe('auth login', () => {
    it('POST /api/auth/register creates account and returns token', async () => {
      const nonce = Date.now();
      const response = await axios.post('/api/auth/register', {
        username: `new_user_${nonce}`,
        email: `new_${nonce}@vlass.local`,
        password: 'Password123!',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('access_token');
      expect(response.data.user).toMatchObject({
        username: `new_user_${nonce}`,
        email: `new_${nonce}@vlass.local`,
      });
    });

    it('POST /api/auth/login returns token for seeded user', async () => {
      const response = await axios.post('/api/auth/login', {
        email: 'test@vlass.local',
        password: 'Password123!',
      });

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('access_token');
      expect(response.data.user).toMatchObject({
        username: 'testuser',
        email: 'test@vlass.local',
      });
    });

    it('POST /api/auth/login rejects invalid credentials', async () => {
      try {
        await axios.post('/api/auth/login', {
          email: 'test@vlass.local',
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
          const response = await axios.post(
            '/api/users',
            {
              username: `ratelimit_user_${nonce}_${i}`,
              email: `ratelimit_${nonce}_${i}@vlass.local`,
              display_name: `Rate Limit User ${i}`,
              github_id: nonce + i,
            },
          );
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

      const resolveResponse = await axios.get(`/api/view/${createResponse.data.short_id as string}`);
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
      expect(response.data.image_url).toMatch(/^\/api\/view\/snapshots\/.+\.png$/);
      expect(response.data.size_bytes).toBeGreaterThan(0);
    });
  });
});
