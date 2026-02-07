import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: { loginWithCredentials: jest.Mock; signToken: jest.Mock };

  beforeEach(async () => {
    authService = {
      loginWithCredentials: jest.fn(),
      signToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('login', () => {
    it('should return bearer token and user profile', async () => {
      const user = {
        id: 'user-id',
        username: 'testuser',
        email: 'test@vlass.local',
        display_name: 'Test User',
        created_at: new Date(),
      };
      authService.loginWithCredentials.mockResolvedValue(user);
      authService.signToken.mockReturnValue('jwt-token');

      const result = await controller.login({
        email: 'test@vlass.local',
        password: 'Password123!',
      });

      expect(authService.loginWithCredentials).toHaveBeenCalledWith({
        email: 'test@vlass.local',
        password: 'Password123!',
      });
      expect(result).toEqual({
        access_token: 'jwt-token',
        token_type: 'Bearer',
        user: {
          id: 'user-id',
          username: 'testuser',
          email: 'test@vlass.local',
          display_name: 'Test User',
          created_at: expect.any(Date),
        },
      });
    });

    it('propagates UnauthorizedException for invalid credentials', async () => {
      authService.loginWithCredentials.mockRejectedValue(
        new UnauthorizedException('Invalid email or password')
      );

      await expect(
        controller.login({
          email: 'bad@vlass.local',
          password: 'wrong-password',
        })
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(authService.signToken).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    it('should return authenticated user info', () => {
      const mockRequest = {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@github.com',
          display_name: 'Test User',
          github_id: '12345',
          created_at: new Date(),
        },
      };

      const result = controller.getCurrentUser(mockRequest);

      expect(result).toEqual({
        authenticated: true,
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@github.com',
          display_name: 'Test User',
          github_id: '12345',
          created_at: expect.any(Date),
        },
      });
    });

    it('should return unauthenticated status if no user', () => {
      const mockRequest = { user: null };

      const result = controller.getCurrentUser(mockRequest);

      expect(result).toEqual({ authenticated: false });
    });
  });

  describe('logout', () => {
    it('should logout user and clear session', (done) => {
      const mockRequest = {
        logout: jest.fn().mockImplementation((callback: (err: Error | null) => void) => {
          callback(null);
        }),
      };

      const mockResponse = {
        json: jest.fn().mockImplementation((data) => {
          expect(data).toEqual({ message: 'Logged out successfully' });
          expect(mockRequest.logout).toHaveBeenCalled();
          done();
        }),
      };

      controller.logout(mockRequest, mockResponse);
    });

    it('should throw error if logout fails', (done) => {
      const error = new Error('Logout failed');
      const mockRequest = {
        logout: jest.fn().mockImplementation((callback: (err: Error | null) => void) => {
          callback(error);
        }),
      };

      const mockResponse = {};

      expect(() => {
        controller.logout(mockRequest, mockResponse);
      }).toThrow('Logout failed');
      done();
    });
  });
});
