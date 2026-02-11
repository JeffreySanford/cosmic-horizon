import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const authService = {
    getCurrentUser: jest.fn(),
  };

  let strategy: JwtStrategy;

  beforeEach(() => {
    authService.getCurrentUser.mockReset();
    strategy = new JwtStrategy(authService as never);
  });

  it('returns user for valid payload subject', async () => {
    const user = { id: 'user-1', username: 'testuser' };
    authService.getCurrentUser.mockResolvedValue(user);

    const result = await strategy.validate({
      sub: 'user-1',
      email: 'test@vlass.local',
      username: 'testuser',
      role: 'user',
    });

    expect(authService.getCurrentUser).toHaveBeenCalledWith('user-1');
    expect(result).toBe(user);
  });

  it('throws UnauthorizedException when user cannot be loaded', async () => {
    authService.getCurrentUser.mockResolvedValue(null);

    await expect(
      strategy.validate({
        sub: 'missing',
        email: null,
        username: 'missing',
        role: 'user',
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
