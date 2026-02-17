import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserRepository } from '../repositories/user.repository';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

/**
 * AuthService - Error Path & Branch Coverage Tests
 * Focus: JWT validation, token refresh, authentication errors, validation failures
 */
describe('AuthService - Error Paths & Branch Coverage', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    jest.clearAllMocks();

    userRepository = {
      findByGitHubId: jest.fn(),
      findByEmailAndPassword: jest.fn(),
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      createWithPassword: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    } as any;

    jwtService = {
      sign: jest.fn(),
    } as any;

    dataSource = {
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

  describe('validateOrCreateUser - Error Paths', () => {
    it('should throw BadRequestException when GitHub ID is invalid', async () => {
      const profile = {
        id: 'not-a-number',
        username: 'testuser',
        emails: [{ value: 'test@example.com' }],
      } as any;

      await expect(service.validateOrCreateUser(profile)).rejects.toThrow(BadRequestException);
      await expect(service.validateOrCreateUser(profile)).rejects.toThrow('invalid');
    });

    it('should throw BadRequestException when GitHub account has no email', async () => {
      const profile = {
        id: '12345',
        username: 'testuser',
        emails: [],
      } as any;

      await expect(service.validateOrCreateUser(profile)).rejects.toThrow(BadRequestException);
      await expect(service.validateOrCreateUser(profile)).rejects.toThrow('public email');
    });

    it('should create new user when not found by GitHub ID', async () => {
      const profile = {
        id: '12345',
        username: 'newuser',
        emails: [{ value: 'new@example.com' }],
        displayName: 'New User',
        photos: [{ value: 'https://example.com/avatar.jpg' }],
      } as any;

      const newUser: User = {
        id: 'u-new',
        github_id: 12345,
        username: 'newuser',
        email: 'new@example.com',
        display_name: 'New User',
        avatar_url: 'https://example.com/avatar.jpg',
        role: 'user',
        password_hash: null,
        bio: null,
        github_profile_url: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.findByGitHubId.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce(newUser);

      const result = await service.validateOrCreateUser(profile);

      expect(result.id).toBe('u-new');
      expect(userRepository.create).toHaveBeenCalled();
    });

    it('should update existing user when found by GitHub ID', async () => {
      const existingUser: User = {
        id: 'u-existing',
        github_id: 12345,
        username: 'oldname',
        email: 'old@example.com',
        display_name: 'Old Name',
        avatar_url: null,
        role: 'user',
        password_hash: null,
        bio: null,
        github_profile_url: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      const profile = {
        id: '12345',
        username: 'newname',
        emails: [{ value: 'new@example.com' }],
        displayName: 'New Name',
        photos: [{ value: 'https://example.com/new-avatar.jpg' }],
      } as any;

      userRepository.findByGitHubId.mockResolvedValueOnce(existingUser);
      userRepository.save.mockResolvedValueOnce(existingUser);

      const result = await service.validateOrCreateUser(profile);

      expect(result.id).toBe('u-existing');
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should handle repository error when finding by GitHub ID', async () => {
      const profile = {
        id: '12345',
        username: 'testuser',
        emails: [{ value: 'test@example.com' }],
      } as any;

      userRepository.findByGitHubId.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(service.validateOrCreateUser(profile)).rejects.toThrow('Database connection failed');
    });
  });

  describe('loginWithCredentials - Validation & Error Paths', () => {
    it('should throw UnauthorizedException for invalid email/password', async () => {
      userRepository.findByEmailAndPassword.mockResolvedValueOnce(null);

      await expect(
        service.loginWithCredentials({
          email: 'wrong@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.loginWithCredentials({
          email: 'wrong@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should return user on valid credentials', async () => {
      const validUser: User = {
        id: 'u1',
        github_id: null,
        username: 'testuser',
        email: 'test@example.com',
        display_name: 'Test User',
        avatar_url: null,
        role: 'user',
        password_hash: 'hashed',
        bio: null,
        github_profile_url: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.findByEmailAndPassword.mockResolvedValueOnce(validUser);

      const result = await service.loginWithCredentials({
        email: 'test@example.com',
        password: 'correctpassword',
      });

      expect(result.id).toBe('u1');
      expect(result.email).toBe('test@example.com');
    });

    it('should handle repository error during login', async () => {
      userRepository.findByEmailAndPassword.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        service.loginWithCredentials({
          email: 'test@example.com',
          password: 'password',
        }),
      ).rejects.toThrow('Database error');
    });
  });

  describe('registerWithCredentials - Validation Errors', () => {
    it('should throw BadRequestException when username is too short', async () => {
      await expect(
        service.registerWithCredentials({
          username: 'ab',
          email: 'test@example.com',
          password: 'password123',
          display_name: 'Test',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.registerWithCredentials({
          username: 'ab',
          email: 'test@example.com',
          password: 'password123',
          display_name: 'Test',
        }),
      ).rejects.toThrow('at least 3 characters');
    });

    it('should throw BadRequestException when password is too short', async () => {
      await expect(
        service.registerWithCredentials({
          username: 'validuser',
          email: 'test@example.com',
          password: 'short',
          display_name: 'Test',
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.registerWithCredentials({
          username: 'validuser',
          email: 'test@example.com',
          password: 'short',
          display_name: 'Test',
        }),
      ).rejects.toThrow('at least 8 characters');
    });

    it('should throw ConflictException when username already exists', async () => {
      const existingUser: User = {
        id: 'u-existing',
        github_id: null,
        username: 'existinguser',
        email: 'other@example.com',
        display_name: 'Existing',
        avatar_url: null,
        role: 'user',
        password_hash: 'hashed',
        bio: null,
        github_profile_url: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.findByUsername.mockResolvedValueOnce(existingUser);

      await expect(
        service.registerWithCredentials({
          username: 'existinguser',
          email: 'new@example.com',
          password: 'password123',
          display_name: 'New',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException when email already exists', async () => {
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.findByEmail.mockResolvedValueOnce({
        id: 'u-existing',
        username: 'otheruser',
      } as any);

      await expect(
        service.registerWithCredentials({
          username: 'newuser',
          email: 'existing@example.com',
          password: 'password123',
          display_name: 'New',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user with valid registration data', async () => {
      const newUser: User = {
        id: 'u-new',
        github_id: null,
        username: 'newuser',
        email: 'new@example.com',
        display_name: 'New User',
        avatar_url: null,
        role: 'user',
        password_hash: 'hashed',
        bio: null,
        github_profile_url: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.findByEmail.mockResolvedValueOnce(null);
      userRepository.createWithPassword.mockResolvedValueOnce(newUser);

      const result = await service.registerWithCredentials({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        display_name: 'New User',
      });

      expect(result.id).toBe('u-new');
      expect(userRepository.createWithPassword).toHaveBeenCalled();
    });
  });

  describe('refreshAuthTokens - JWT & Token Validation', () => {
    it('should throw UnauthorizedException when refresh token is empty', async () => {
      await expect(service.refreshAuthTokens('')).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshAuthTokens('   ')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when refresh token is invalid', async () => {
      dataSource.query.mockImplementation(async () => []);

      await expect(service.refreshAuthTokens('invalid-token')).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshAuthTokens('invalid-token')).rejects.toThrow('invalid');
    });

    it('should throw UnauthorizedException when refresh token is revoked', async () => {
      dataSource.query.mockImplementation(async () => [
        {
          id: 'token-1',
          user_id: 'u1',
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          revoked_at: new Date().toISOString(),
        },
      ]);

      await expect(service.refreshAuthTokens('revoked-token')).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshAuthTokens('revoked-token')).rejects.toThrow('revoked');
    });

    it('should throw UnauthorizedException when refresh token has expired', async () => {
      dataSource.query.mockImplementation(async () => [
        {
          id: 'token-1',
          user_id: 'u1',
          expires_at: new Date(Date.now() - 86400000).toISOString(),
          revoked_at: null,
        },
      ]);

      await expect(service.refreshAuthTokens('expired-token')).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshAuthTokens('expired-token')).rejects.toThrow('expired');
    });

    it('should throw UnauthorizedException when token user no longer exists', async () => {
      let callCount = 0;
      dataSource.query.mockImplementation(async () => {
        callCount++;
        if (callCount === 1 || callCount === 2) {
          return [
            {
              id: 'token-1',
              user_id: 'u-deleted',
              expires_at: new Date(Date.now() + 86400000).toISOString(),
              revoked_at: null,
            },
          ];
        }
        return undefined;
      });

      userRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshAuthTokens('valid-but-user-deleted')).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshAuthTokens('valid-but-user-deleted')).rejects.toThrow('no longer exists');
    });

    it('should issue new tokens on valid refresh token', async () => {
      const user: User = {
        id: 'u1',
        github_id: null,
        username: 'testuser',
        email: 'test@example.com',
        display_name: 'Test User',
        avatar_url: null,
        role: 'user',
        password_hash: null,
        bio: null,
        github_profile_url: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      // Setup sequential mocks for each dataSource.query call
      let callCount = 0;
      dataSource.query.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // findRefreshTokenRecord
          return [
            {
              id: 'token-1',
              user_id: 'u1',
              expires_at: new Date(Date.now() + 86400000).toISOString(),
              revoked_at: null,
            },
          ];
        } else if (callCount === 2 || callCount === 3) {
          // revokeRefreshTokenById or issueAuthTokens
          return undefined;
        }
        return undefined;
      });

      userRepository.findOne.mockResolvedValueOnce(user);
      jwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refreshAuthTokens('valid-token');

      expect(result.user.id).toBe('u1');
      expect(result.tokens.access_token).toBe('new-access-token');
    });
  });

  describe('refreshToken & login & register - Wrapper Methods', () => {
    it('should call refreshAuthTokens and return token pair', async () => {
      const user: User = {
        id: 'u1',
        github_id: null,
        username: 'testuser',
        email: 'test@example.com',
        display_name: 'Test User',
        avatar_url: null,
        role: 'user',
        password_hash: null,
        bio: null,
        github_profile_url: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      let callCount = 0;
      dataSource.query.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return [
            {
              id: 'token-1',
              user_id: 'u1',
              expires_at: new Date(Date.now() + 86400000).toISOString(),
              revoked_at: null,
            },
          ];
        }
        return undefined;
      });

      userRepository.findOne.mockResolvedValueOnce(user);
      jwtService.sign.mockReturnValue('new-token');

      const result = await service.refreshToken('valid-token');

      expect(result.access_token).toBe('new-token');
      expect(result.refresh_token).toBeDefined();
    });

    it('should issue tokens on successful login', async () => {
      const user: User = {
        id: 'u1',
        github_id: null,
        username: 'testuser',
        email: 'test@example.com',
        display_name: 'Test User',
        avatar_url: null,
        role: 'user',
        password_hash: 'hashed',
        bio: null,
        github_profile_url: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.findByEmailAndPassword.mockResolvedValueOnce(user);
      jwtService.sign.mockReturnValue('access-token');
      dataSource.query.mockResolvedValueOnce(undefined); // issueAuthTokens insert

      const result = await service.login('test@example.com', 'correctpassword');

      expect(result.access_token).toBe('access-token');
      expect(result.refresh_token).toBeDefined();
    });

    it('should return user and tokens on successful registration', async () => {
      const newUser: User = {
        id: 'u-new',
        github_id: null,
        username: 'newuser',
        email: 'new@example.com',
        display_name: 'New User',
        avatar_url: null,
        role: 'user',
        password_hash: 'hashed',
        bio: null,
        github_profile_url: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.findByEmail.mockResolvedValueOnce(null);
      userRepository.createWithPassword.mockResolvedValueOnce(newUser);
      jwtService.sign.mockReturnValue('access-token');
      dataSource.query.mockResolvedValueOnce(undefined);

      const result = await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        display_name: 'New User',
      });

      expect(result.user.id).toBe('u-new');
      expect(result.access_token).toBe('access-token');
      expect(result.refresh_token).toBeDefined();
    });
  });

  describe('getCurrentUser', () => {
    it('should return null when userId is empty', async () => {
      const result = await service.getCurrentUser('');
      expect(result).toBeNull();
    });

    it('should return user when found', async () => {
      const user: User = {
        id: 'u1',
        github_id: null,
        username: 'testuser',
        email: 'test@example.com',
        display_name: 'Test User',
        avatar_url: null,
        role: 'user',
        password_hash: null,
        bio: null,
        github_profile_url: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.findOne.mockResolvedValueOnce(user);

      const result = await service.getCurrentUser('u1');

      expect(result?.id).toBe('u1');
    });

    it('should return null when user not found', async () => {
      userRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.getCurrentUser('u-nonexistent');

      expect(result).toBeNull();
    });

    it('should handle repository error', async () => {
      userRepository.findOne.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.getCurrentUser('u1')).rejects.toThrow('Database error');
    });
  });

  describe('revokeRefreshToken & revokeAllRefreshTokensForUser', () => {
    it('should handle empty refresh token gracefully', async () => {
      await expect(service.revokeRefreshToken('')).resolves.toBeUndefined();
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('should revoke refresh token', async () => {
      dataSource.query.mockResolvedValueOnce(undefined);

      await service.revokeRefreshToken('valid-token');

      expect(dataSource.query).toHaveBeenCalled();
    });

    it('should revoke all refresh tokens for user', async () => {
      dataSource.query.mockResolvedValueOnce(undefined);

      await service.revokeAllRefreshTokensForUser('u1');

      expect(dataSource.query).toHaveBeenCalled();
    });

    it('should handle revocation error', async () => {
      dataSource.query.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.revokeAllRefreshTokensForUser('u1')).rejects.toThrow('Database error');
    });
  });
});
