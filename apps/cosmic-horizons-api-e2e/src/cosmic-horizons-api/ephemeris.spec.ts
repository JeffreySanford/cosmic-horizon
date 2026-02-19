import axios, { AxiosError } from 'axios';

describe('ephemeris e2e', () => {
  let authToken: string;

  beforeAll(async () => {
    const loginRes = await axios.post('/api/auth/login', {
      email: 'test@cosmic.local',
      password: 'Password123!',
    });
    authToken = loginRes.data.access_token;
  });

  it('GET /api/view/ephem/search returns Mars position', async () => {
    const response = await axios.get('/api/view/ephem/search?target=mars', {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('ra');
    expect(response.data).toHaveProperty('dec');
    expect(response.data.object_type).toBe('planet');
  });

  it('verifies cache hit on subsequent request', async () => {
    // First request to ensure it's in cache
    await axios.get('/api/view/ephem/search?target=jupiter', {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    // Second request should come from cache
    const response = await axios.get('/api/view/ephem/search?target=jupiter', {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    expect(response.data.source).toBe('cache');
  });

  it('GET /api/view/ephem/search returns asteroid position (JPL fallback)', async () => {
    // Note: This relies on external network access in E2E if not mocked in the test runner.
    const response = await axios.get('/api/view/ephem/search?target=eros', {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    expect(response.status).toBe(200);
    expect(['jpl-horizons', 'cache']).toContain(response.data.source);
    expect(response.data.object_type).toBe('asteroid');
  });

  it('GET /api/view/ephem/search returns 404 for nonexistent objects', async () => {
    try {
      await axios.get(
        '/api/view/ephem/search?target=nonexistent-object-xyz-123',
        {
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );
      throw new Error('Should have failed');
    } catch (error) {
      const axiosError = error as AxiosError;
      expect(axiosError.response?.status).toBe(404);
    }
  });

  it('GET /api/view/ephem/search returns 401 when unauthorized', async () => {
    try {
      await axios.get('/api/view/ephem/search?target=mars');
      throw new Error('Should have failed');
    } catch (error) {
      const axiosError = error as AxiosError;
      expect(axiosError.response?.status).toBe(401);
    }
  });
});
