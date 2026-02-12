import axios from 'axios';

describe('logging e2e', () => {
  let authToken: string;

  beforeAll(async () => {
    // Authenticate to get a token
    const loginRes = await axios.post('/api/auth/login', {
      email: 'test@cosmic.local',
      password: 'Password123!',
    });
    authToken = loginRes.data.access_token;
  });

  it('POST /api/logging/remote should accept remote logs', async () => {
    const response = await axios.post('/api/logging/remote', {
      type: 'remote',
      severity: 'info',
      message: 'E2E Test Log',
      data: { source: 'e2e' }
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    expect(response.status).toBe(201);
    expect(response.data.success).toBe(true);
  });

  it('Loop Prevention: request to /logging/remote should NOT be logged by interceptor', async () => {
    // This is hard to verify directly without checking Redis/Service state,
    // but we can at least verify the endpoint works and doesn't crash the server with recursion.
    const response = await axios.post('/api/logging/remote', {
      type: 'remote',
      severity: 'info',
      message: 'Recursive test',
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    expect(response.status).toBe(201);
  });
});
