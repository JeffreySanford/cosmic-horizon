import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UserRepository } from '../repositories';
import { DataSource } from 'typeorm';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

/**
 * AuthService Extended Tests - Wrapper Method Coverage
 * Tests convenience wrapper methods: refreshToken, login, register
 * Validates JWT best practices and token refresh patterns
 */
describe('AuthService - Extended (Wrapper Methods)', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    userRepository = {
      findByEmailAndPassword: jest.fn(),
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      createWithPassword: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findByGitHubId: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
    } as any;

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
      decode: jest.fn(),
    } as any;

    dataSource = {
      isInitialized: true,
      query: jest.fn(),
    } as any;

    testingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UserRepository, useValue: userRepository },
        { provide: JwtService, useValue: jwtService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = testingModule.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('refreshToken - Wrapper Method', () => {
    it('should throw on empty refresh token', async () => {
      await expect(service.refreshToken('')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw on null refresh token', async () => {
      await expect(service.refreshToken(null as any)).rejects.toThrow();
    });

    it('should throw when token hash not found', async () => {
      dataSource.query.mockResolvedValueOnce([]); // No token record found

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when token has been revoked', async () => {
      const now = new Date().toISOString();
      dataSource.query.mockResolvedValueOnce([
        {
          id: 'token-1',
          user_id: 'user-1',
          token_hash: 'somehash',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          revoked_at: now,
          last_used_at: now,
        },
      ]);

      await expect(service.refreshToken('revoked-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when token has expired', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          id: 'token-1',
          user_id: 'user-1',
          expires_at: new Date(Date.now() - 1000).toISOString(), // Past
          revoked_at: null,
        },
      ]);

      await expect(service.refreshToken('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when user no longer exists', async () => {
      dataSource.query
        .mockResolvedValueOnce([
          {
            id: 'token-1',
            user_id: 'user-1',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            revoked_at: null,
          },
        ])
        .mockResolvedValueOnce(null); // User not found

      userRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.refreshToken('valid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should return new token pair on successful refresh', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
      } as any;

      dataSource.query
        .mockResolvedValueOnce([
          {
            id: 'token-1',
            user_id: 'user-1',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            revoked_at: null,
          },
        ]) // Find token
        .mockResolvedValueOnce(undefined) // Revoke old token
        .mockResolvedValueOnce(undefined);// Insert new token

      userRepository.findOne.mockResolvedValueOnce(mockUser);
      jwtService.sign.mockReturnValueOnce('new-access-token');

      const result = await service.refreshToken('valid-token');

      expect(result).toHaveProperty('access_token', 'new-access-token');
      expect(result).toHaveProperty('refresh_token');
      expect(jwtService.sign).toHaveBeenCalled();
    });
  });

  describe('login - Wrapper Method', () => {
    it('should throw UnauthorizedException when credentials invalid', async () => {
      userRepository.findByEmailAndPassword.mockResolvedValueOnce(null);

      await expect(service.login('user@example.com', 'password')).rejects.toThrow(UnauthorizedException);
    });

    it('should return auth tokens on successful login', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
      } as any;

      userRepository.findByEmailAndPassword.mockResolvedValueOnce(mockUser);
      jwtService.sign.mockReturnValueOnce('access-token');
      dataSource.query.mockResolvedValueOnce(undefined);

      const result = await service.login('test@example.com', 'password');

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.access_token).toBe('access-token');
    });

    it('should sign JWT with correct user payload', async () => {
      const mockUser = {
        id: 'unique-id-123',
        username: 'john_doe',
        email: 'john@example.com',
        role: 'admin',
      } as any;

      userRepository.findByEmailAndPassword.mockResolvedValueOnce(mockUser);
      jwtService.sign.mockReturnValueOnce('token');
      dataSource.query.mockResolvedValueOnce(undefined);

      await service.login('john@example.com', 'password');

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'unique-id-123',
          username: 'john_doe',
          role: 'admin',
        }),
      );
    });
  });

  describe('register - Wrapper Method', () => {
    it('should throw ConflictException when username exists', async () => {
      userRepository.findByUsername.mockResolvedValueOnce({
        id: 'existing',
        username: 'taken',
      } as any);

      await expect(
        service.register({
          username: 'taken',
          email: 'new@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when email exists', async () => {
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.findByEmail.mockResolvedValueOnce({
        id: 'existing',
        email: 'taken@example.com',
      } as any);

      await expect(
        service.register({
          username: 'newuser',
          email: 'taken@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for short password', async () => {
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.findByEmail.mockResolvedValueOnce(null);

      await expect(
        service.register({
          username: 'user',
          email: 'test@example.com',
          password: 'short',
        }),
      ).rejects.toThrow();
    });

    it('should throw BadRequestException for short username', async () => {
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.findByEmail.mockResolvedValueOnce(null);

      await expect(
        service.register({
          username: 'ab',
          email: 'test@example.com',
          password: 'validpass123',
        }),
      ).rejects.toThrow();
    });

    it('should return user and tokens on successful registration', async () => {
      const newUser = {
        id: 'new-user-1',
        username: 'newuser',
        email: 'new@example.com',
        role: 'user',
      } as any;

      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.findByEmail.mockResolvedValueOnce(null);
      userRepository.createWithPassword.mockResolvedValueOnce(newUser);
      jwtService.sign.mockReturnValueOnce('new-jwt');
      dataSource.query.mockResolvedValueOnce(undefined);

      const result = await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'validpass123',
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.user.username).toBe('newuser');
      expect(result.access_token).toBe('new-jwt');
    });

    it('should support optional display_name parameter', async () => {
      const newUser = {
        id: 'new-user-1',
        username: 'newuser',
        email: 'new@example.com',
        display_name: 'New User Display',
        role: 'user',
      } as any;

      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.findByEmail.mockResolvedValueOnce(null);
      userRepository.createWithPassword.mockResolvedValueOnce(newUser);
      jwtService.sign.mockReturnValueOnce('jwt');
      dataSource.query.mockResolvedValueOnce(undefined);

      const result = await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'validpass123',
        display_name: 'New User Display',
      });

      expect(result.user.display_name).toBe('New User Display');
    });
  });

  describe('Token Pair Consistency', () => {
    it('login should return both access and refresh tokens', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
      } as any;

      userRepository.findByEmailAndPassword.mockResolvedValueOnce(mockUser);
      jwtService.sign.mockReturnValueOnce('access');
      dataSource.query.mockResolvedValueOnce(undefined);

      const result = await service.login('test@example.com', 'pass');

      expect(result.access_token).toBeTruthy();
      expect(result.refresh_token).toBeTruthy();
      expect(typeof result.access_token).toBe('string');
      expect(typeof result.refresh_token).toBe('string');
      expect(result.access_token).not.toEqual(result.refresh_token);
    });

    it('register should return user and token pair', async () => {
      const newUser = {
        id: 'user-1',
        username: 'test',
        email: 'test@example.com',
        role: 'user',
      } as any;

      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.findByEmail.mockResolvedValueOnce(null);
      userRepository.createWithPassword.mockResolvedValueOnce(newUser);
      jwtService.sign.mockReturnValueOnce('access');
      dataSource.query.mockResolvedValueOnce(undefined);

      const result = await service.register({
        username: 'test',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user).toBeTruthy();
      expect(result.access_token).toBeTruthy();
      expect(result.refresh_token).toBeTruthy();
      expect(result.user.id).toBe('user-1');
    });
  });

  describe('Error Scenarios', () => {
    it('should not expose sensitive password values in error messages', async () => {
      userRepository.findByEmailAndPassword.mockResolvedValueOnce(null);

      try {
        await service.login('user@example.com', 'secretpass123');
        fail('should have thrown');
      } catch (error) {
        // Should not reveal the actual password that was passed
        expect((error as any).message).not.toContain('secretpass123');
        expect((error as any).message).not.toContain('secretpass');
        // Generic message is acceptable
        expect((error as any).message).toBeTruthy();
      }
    });

    it('should handle concurrent login attempts', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com',
        role: 'user',
      } as any;

      userRepository.findByEmailAndPassword.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('token');
      dataSource.query.mockResolvedValue(undefined);

      const promises = [
        service.login('test@example.com', 'pass'),
        service.login('test@example.com', 'pass'),
        service.login('test@example.com', 'pass'),
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result).toHaveProperty('access_token');
        expect(result).toHaveProperty('refresh_token');
      });
    });
  });

  describe('JWT Payload Validation', () => {
    it('should include all required claims in access token payload', async () => {
      const mockUser = {
        id: 'user-id',
        username: 'username',
        email: 'user@example.com',
        role: 'user',
      } as any;

      userRepository.findByEmailAndPassword.mockResolvedValueOnce(mockUser);
      jwtService.sign.mockReturnValueOnce('token');
      dataSource.query.mockResolvedValueOnce(undefined);

      await service.login('user@example.com', 'pass');

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-id',
          username: 'username',
          email: 'user@example.com',
          role: 'user',
        }),
      );
    });

    it('should preserve user role in JWT', async () => {
      const adminUser = {
        id: 'admin-1',
        username: 'adminuser',
        email: 'admin@example.com',
        role: 'admin',
      } as any;

      userRepository.findByEmailAndPassword.mockResolvedValueOnce(adminUser);
      jwtService.sign.mockReturnValueOnce('token');
      dataSource.query.mockResolvedValueOnce(undefined);

      await service.login('admin@example.com', 'pass');

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'admin',
        }),
      );
    });
  });
});
