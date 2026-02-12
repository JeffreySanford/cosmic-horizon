import axios, { AxiosError } from 'axios';

describe('messaging e2e', () => {
  let authToken: string;

  beforeAll(async () => {
    const loginRes = await axios.post('/api/auth/login', {
      email: 'test@cosmic.local',
      password: 'Password123!',
    });
    authToken = loginRes.data.access_token;
  });

  it('GET /api/messaging/sites returns 5 remote sites', async () => {
    const response = await axios.get('/api/messaging/sites', {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.length).toBe(5);
    expect(response.data[0]).toHaveProperty('id');
    expect(response.data[0]).toHaveProperty('name');
    expect(response.data[0]).toHaveProperty('cluster');
  });

  it('GET /api/messaging/radars returns 60 radars', async () => {
    const response = await axios.get('/api/messaging/radars', {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.length).toBe(60);
  });

  it('GET /api/messaging/sites/:id/radars returns 12 site-specific radars', async () => {
    const response = await axios.get('/api/messaging/sites/site-1/radars', {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.data.length).toBe(12);
    expect(response.data[0].siteId).toBe('site-1');
  });

  it('GET /api/messaging/sites returns 401 when unauthorized', async () => {
    try {
      await axios.get('/api/messaging/sites');
      throw new Error('Should have failed');
    } catch (error) {
      const axiosError = error as AxiosError;
      expect(axiosError.response?.status).toBe(401);
    }
  });
});
