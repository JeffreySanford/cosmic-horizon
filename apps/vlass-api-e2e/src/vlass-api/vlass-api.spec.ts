import axios, { AxiosError } from 'axios';

describe('vlass-api e2e', () => {
  it('GET /api returns API banner', async () => {
    const response = await axios.get('/api');
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ message: 'VLASS Portal API' });
  });

  describe('auth login', () => {
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
});
