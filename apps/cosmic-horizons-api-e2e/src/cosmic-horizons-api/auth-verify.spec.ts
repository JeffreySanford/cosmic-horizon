import axios from 'axios';

describe('Auth Verification (test and admin)', () => {
  it('Login as testuser (username identifier)', async () => {
    const response = await axios.post('/api/auth/login', {
      email: 'testuser',
      password: 'Password123!',
    });
    expect(response.status).toBe(201);
    expect(response.data.user.username).toBe('testuser');
  });

  it('Login as testuser (email identifier)', async () => {
    const response = await axios.post('/api/auth/login', {
      email: 'test@cosmic.local',
      password: 'Password123!',
    });
    expect(response.status).toBe(201);
    expect(response.data.user.username).toBe('testuser');
  });

  it('Login as adminuser (username identifier)', async () => {
    const response = await axios.post('/api/auth/login', {
      email: 'adminuser',
      password: 'AdminPassword123!',
    });
    expect(response.status).toBe(201);
    expect(response.data.user.role).toBe('admin');
  });

  it('Login as adminuser (email identifier)', async () => {
    const response = await axios.post('/api/auth/login', {
      email: 'admin@cosmic.local',
      password: 'AdminPassword123!',
    });
    expect(response.status).toBe(201);
    expect(response.data.user.role).toBe('admin');
  });
});
