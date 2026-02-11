import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuditAction, AuditEntityType } from '../entities';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    loginWithCredentials: jest.Mock;
    registerWithCredentials: jest.Mock;
    issueAuthTokens: jest.Mock;
    refreshAuthTokens: jest.Mock;
    revokeRefreshToken: jest.Mock;
    revokeAllRefreshTokensForUser: jest.Mock;
  };
  let auditLogRepository: {
    createAuditLog: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      loginWithCredentials: jest.fn(),
      registerWithCredentials: jest.fn(),
      issueAuthTokens: jest.fn(),
      refreshAuthTokens: jest.fn(),
      revokeRefreshToken: jest.fn().mockResolvedValue(undefined),
      revokeAllRefreshTokensForUser: jest.fn().mockResolvedValue(undefined),
    };
    auditLogRepository = {
      createAuditLog: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: AuditLogRepository,
          useValue: auditLogRepository,
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
        role: 'user',
        created_at: new Date(),
      };
      authService.loginWithCredentials.mockResolvedValue(user);
      authService.issueAuthTokens.mockResolvedValue({
        access_token: 'jwt-token',
        refresh_token: 'refresh-token',
      });

      const result = await controller.login(
        {
          email: 'test@vlass.local',
          password: 'Password123!',
        },
        {
          ip: '127.0.0.1',
          headers: {
            'user-agent': 'jest-test',
          },
        },
      );

      expect(authService.loginWithCredentials).toHaveBeenCalledWith({
        email: 'test@vlass.local',
        password: 'Password123!',
      });
      expect(result).toEqual({
        access_token: 'jwt-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        user: {
          id: 'user-id',
          username: 'testuser',
          email: 'test@vlass.local',
          display_name: 'Test User',
          role: 'user',
          created_at: expect.any(Date),
        },
      });
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LOGIN,
          entity_type: AuditEntityType.USER,
          entity_id: 'user-id',
          user_id: 'user-id',
          ip_address: '127.0.0.1',
          user_agent: 'jest-test',
        }),
      );
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
      expect(authService.issueAuthTokens).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should create account and return bearer token + user profile', async () => {
      const user = {
        id: 'user-id',
        username: 'newuser',
        email: 'new@vlass.local',
        display_name: 'New User',
        role: 'user',
        created_at: new Date(),
      };
      authService.registerWithCredentials.mockResolvedValue(user);
      authService.issueAuthTokens.mockResolvedValue({
        access_token: 'jwt-token',
        refresh_token: 'refresh-token',
      });

      const result = await controller.register(
        {
          username: 'newuser',
          email: 'new@vlass.local',
          password: 'Password123!',
        },
        {
          ip: '127.0.0.1',
          headers: {
            'user-agent': 'jest-test',
          },
        },
      );

      expect(authService.registerWithCredentials).toHaveBeenCalledWith({
        username: 'newuser',
        email: 'new@vlass.local',
        password: 'Password123!',
      });
      expect(result).toEqual({
        access_token: 'jwt-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        user: {
          id: 'user-id',
          username: 'newuser',
          email: 'new@vlass.local',
          display_name: 'New User',
          role: 'user',
          created_at: expect.any(Date),
        },
      });
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LOGIN,
          entity_type: AuditEntityType.USER,
          entity_id: 'user-id',
          user_id: 'user-id',
        }),
      );
    });

    it('propagates conflict when username/email exists', async () => {
      authService.registerWithCredentials.mockRejectedValue(
        new ConflictException('Email is already in use.'),
      );

      await expect(
        controller.register({
          username: 'newuser',
          email: 'new@vlass.local',
          password: 'Password123!',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('refresh', () => {
    it('rotates refresh token and returns new token pair', async () => {
      authService.refreshAuthTokens.mockResolvedValue({
        user: {
          id: 'user-id',
          username: 'testuser',
          email: 'test@vlass.local',
          display_name: 'Test User',
          role: 'user',
          created_at: new Date(),
        },
        tokens: {
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
        },
      });

      const result = await controller.refresh({ refresh_token: 'old-refresh-token' });

      expect(authService.refreshAuthTokens).toHaveBeenCalledWith('old-refresh-token');
      expect(result).toMatchObject({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        token_type: 'Bearer',
      });
    });
  });

  describe('getCurrentUser', () => {
    it('should return authenticated user info', () => {
      const mockRequest = {
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@github.com',
          display_name: 'Test User',
          role: 'admin' as const,
          github_id: 12345,
          created_at: new Date(),
        },
      };

      const result = controller.getCurrentUser(mockRequest);

      expect(result).toEqual({
        authenticated: true,
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@github.com',
          display_name: 'Test User',
          role: 'admin',
          github_id: 12345,
          created_at: expect.any(Date),
        },
      });
    });
  });

  describe('logout', () => {
    it('should logout user and clear session', async () => {
      const mockRequest = {
        user: {
          id: 'user-id',
        },
        ip: '127.0.0.1',
        headers: {
          'user-agent': 'jest-test',
        },
        logout: jest.fn().mockImplementation((callback: (err: Error | null) => void) => {
          callback(null);
        }),
      };

      const mockResponse = {
        json: jest.fn(),
      };

      await controller.logout(mockRequest, mockResponse as never, { refresh_token: 'token-1' });

      expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Logged out successfully' });
      expect(mockRequest.logout).toHaveBeenCalled();
      expect(authService.revokeAllRefreshTokensForUser).toHaveBeenCalledWith('user-id');
      expect(authService.revokeRefreshToken).toHaveBeenCalledWith('token-1');
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LOGOUT,
          entity_type: AuditEntityType.USER,
          entity_id: 'user-id',
          user_id: 'user-id',
        }),
      );
    });

    it('should reject if logout fails', async () => {
      const error = new Error('Logout failed');
      const mockRequest = {
        logout: jest.fn().mockImplementation((callback: (err: Error | null) => void) => {
          callback(error);
        }),
      };

      await expect(controller.logout(mockRequest as never, {} as never)).rejects.toThrow(
        'Logout failed',
      );
    });
  });
});
