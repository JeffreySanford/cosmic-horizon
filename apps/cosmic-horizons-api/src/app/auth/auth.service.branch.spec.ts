import { Test, TestingModule } from '@nestjs/testing';
import { AuthService, JwtPayload } from './auth.service';
import { UserRepository } from '../repositories';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '../entities';
import Strategy from 'passport-github';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('AuthService - Branch Coverage', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let dataSource: jest.Mocked<DataSource>;

  const mockUser: User = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
    github_id: 12345,
    display_name: 'Test User',
    avatar_url: 'https://avatar.example.com',
    role: 'user' as any,
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

  beforeEach(async () => {
    userRepository = {
      findByGitHubId: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findByEmailAndPassword: jest.fn(),
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      createWithPassword: jest.fn(),
    } as any;

    jwtService = {
      sign: jest.fn().mockReturnValue('jwt-token'),
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

  describe('onModuleInit', () => {
    it('should ensure user role column exists', async () => {
      dataSource.query.mockResolvedValue([]);

      await service.onModuleInit();

      expect(dataSource.query).toHaveBeenCalled();
      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('ADD COLUMN IF NOT EXISTS role'),
      );
    });

    it('should ensure refresh token table exists', async () => {
      dataSource.query.mockResolvedValue([]);

      await service.onModuleInit();

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining(
          'CREATE TABLE IF NOT EXISTS auth_refresh_tokens',
        ),
      );
    });

    it('should cleanup expired refresh tokens', async () => {
      dataSource.query.mockResolvedValue([]);

      await service.onModuleInit();

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM auth_refresh_tokens'),
      );
    });
  });

  describe('validateOrCreateUser - new user', () => {
    it('should create new user from GitHub profile', async () => {
      userRepository.findByGitHubId.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce(mockUser);

      const profile: Strategy.Profile = {
        id: '12345',
        username: 'testuser',
        displayName: 'Test User',
        photos: [{ value: 'https://avatar.example.com' }],
        emails: [{ value: 'test@example.com' }],
        provider: 'github',
        profileUrl: 'https://github.com/testuser',
        _raw: '{}',
        _json: {},
      };

      const result = await service.validateOrCreateUser(profile);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'testuser',
          email: 'test@example.com',
          github_id: 12345,
          display_name: 'Test User',
          avatar_url: 'https://avatar.example.com',
        }),
      );
      expect(result).toEqual(mockUser);
    });

    it('should set username when GitHub username is missing', async () => {
      userRepository.findByGitHubId.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce(mockUser);

      const profile: Strategy.Profile = {
        id: '12345',
        username: undefined as any,
        displayName: 'Test User',
        emails: [{ value: 'test@example.com' }],
        provider: 'github',
        profileUrl: 'https://github.com/testuser',
        _raw: '{}',
        _json: {},
      };

      await service.validateOrCreateUser(profile);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'github_12345',
        }),
      );
    });

    it('should set username when GitHub username is empty string', async () => {
      userRepository.findByGitHubId.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce(mockUser);

      const profile: Strategy.Profile = {
        id: '12345',
        username: '   ',
        displayName: 'Test User',
        emails: [{ value: 'test@example.com' }],
        provider: 'github',
        profileUrl: 'https://github.com/testuser',
        _raw: '{}',
        _json: {},
      };

      await service.validateOrCreateUser(profile);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'github_12345',
        }),
      );
    });

    it('should set display_name to username fallback', async () => {
      userRepository.findByGitHubId.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce(mockUser);

      const profile: Strategy.Profile = {
        id: '12345',
        username: 'testuser',
        displayName: undefined as any,
        emails: [{ value: 'test@example.com' }],
        provider: 'github',
        profileUrl: 'https://github.com/testuser',
        _raw: '{}',
        _json: {},
      };

      await service.validateOrCreateUser(profile);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'testuser',
        }),
      );
    });

    it('should set avatar_url to null when not provided', async () => {
      userRepository.findByGitHubId.mockResolvedValueOnce(null);
      userRepository.create.mockResolvedValueOnce(mockUser);

      const profile: Strategy.Profile = {
        id: '12345',
        username: 'testuser',
        displayName: 'Test User',
        emails: [{ value: 'test@example.com' }],
        photos: undefined as any,
        provider: 'github',
        profileUrl: 'https://github.com/testuser',
        _raw: '{}',
        _json: {},
      };

      await service.validateOrCreateUser(profile);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          avatar_url: null,
        }),
      );
    });

    it('should throw BadRequestException on invalid GitHub ID', async () => {
      const profile: Strategy.Profile = {
        id: 'not-a-number',
        displayName: 'Test User',
        emails: [{ value: 'test@example.com' }],
        provider: 'github',
        profileUrl: 'https://github.com/testuser',
        _raw: '{}',
        _json: {},
      };

      await expect(service.validateOrCreateUser(profile)).rejects.toThrow(
        new BadRequestException('GitHub profile id is invalid.'),
      );
    });

    it('should throw BadRequestException on missing email', async () => {
      userRepository.findByGitHubId.mockResolvedValueOnce(null);

      const profile: Strategy.Profile = {
        id: '12345',
        username: 'testuser',
        displayName: 'Test User',
        emails: undefined,
        provider: 'github',
        profileUrl: 'https://github.com/testuser',
        _raw: '{}',
        _json: {},
      };

      await expect(service.validateOrCreateUser(profile)).rejects.toThrow(
        new BadRequestException(
          'GitHub account must have a public email. Please set one at github.com/settings/emails',
        ),
      );
    });

    it('should throw BadRequestException when email array is empty', async () => {
      const profile: Strategy.Profile = {
        id: '12345',
        username: 'testuser',
        displayName: 'Test User',
        emails: [],
        provider: 'github',
        profileUrl: 'https://github.com/testuser',
        _raw: '{}',
        _json: {},
      };

      await expect(service.validateOrCreateUser(profile)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateOrCreateUser - existing user', () => {
    it('should update existing user with latest GitHub profile info', async () => {
      const existingUser = { ...mockUser };
      userRepository.findByGitHubId.mockResolvedValueOnce(existingUser);
      userRepository.save.mockResolvedValueOnce(existingUser);

      const profile: Strategy.Profile = {
        id: '12345',
        username: 'newusername',
        displayName: 'New Display Name',
        photos: [{ value: 'https://new-avatar.example.com' }],
        emails: [{ value: 'newemail@example.com' }],
        provider: 'github',
        profileUrl: 'https://github.com/newusername',
        _raw: '{}',
        _json: {},
      };

      await service.validateOrCreateUser(profile);

      expect(existingUser.username).toBe('newusername');
      expect(existingUser.email).toBe('newemail@example.com');
      expect(existingUser.display_name).toBe('New Display Name');
      expect(existingUser.avatar_url).toBe('https://new-avatar.example.com');
      expect(userRepository.save).toHaveBeenCalledWith(existingUser);
    });

    it('should set updated_at on user update', async () => {
      const existingUser = { ...mockUser };
      const beforeUpdate = new Date();
      userRepository.findByGitHubId.mockResolvedValueOnce(existingUser);
      userRepository.save.mockResolvedValueOnce(existingUser);

      const profile: Strategy.Profile = {
        id: '12345',
        username: 'updated',
        displayName: 'Updated User',
        emails: [{ value: 'test@example.com' }],
        provider: 'github',
        profileUrl: 'https://github.com/updated',
        _raw: '{}',
        _json: {},
      };

      await service.validateOrCreateUser(profile);

      expect(existingUser.updated_at).toBeDefined();
      expect(
        new Date(existingUser.updated_at).getTime(),
      ).toBeGreaterThanOrEqual(beforeUpdate.getTime());
    });
  });

  describe('getCurrentUser', () => {
    it('should return user when userId is provided', async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);

      const result = await service.getCurrentUser('user-123');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-123' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when userId is empty', async () => {
      const result = await service.getCurrentUser('');

      expect(result).toBeNull();
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return null when userId is null/undefined', async () => {
      const result = await service.getCurrentUser(null as any);

      expect(result).toBeNull();
    });

    it('should return null when user not found', async () => {
      userRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.getCurrentUser('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('loginWithCredentials', () => {
    it('should login user with valid credentials', async () => {
      userRepository.findByEmailAndPassword.mockResolvedValueOnce(mockUser);

      const result = await service.loginWithCredentials({
        email: '  TEST@EXAMPLE.COM  ',
        password: 'password123',
      });

      expect(userRepository.findByEmailAndPassword).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
      expect(result).toEqual(mockUser);
    });

    it('should normalize email to lowercase', async () => {
      userRepository.findByEmailAndPassword.mockResolvedValueOnce(mockUser);

      await service.loginWithCredentials({
        email: 'TEST@EXAMPLE.COM',
        password: 'password',
      });

      expect(userRepository.findByEmailAndPassword).toHaveBeenCalledWith(
        'test@example.com',
        expect.anything(),
      );
    });

    it('should throw UnauthorizedException when credentials invalid', async () => {
      userRepository.findByEmailAndPassword.mockResolvedValueOnce(null);

      await expect(
        service.loginWithCredentials({
          email: 'test@example.com',
          password: 'wrong',
        }),
      ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
    });
  });

  describe('registerWithCredentials', () => {
    it('should create user with valid credentials', async () => {
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.findByEmail.mockResolvedValueOnce(null);
      userRepository.createWithPassword.mockResolvedValueOnce(mockUser);

      const result = await service.registerWithCredentials({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        display_name: 'New User',
      });

      expect(userRepository.createWithPassword).toHaveBeenCalledWith({
        username: 'newuser',
        display_name: 'New User',
        email: 'new@example.com',
        password: 'password123',
      });
      expect(result).toEqual(mockUser);
    });

    it('should use username as display_name fallback', async () => {
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.findByEmail.mockResolvedValueOnce(null);
      userRepository.createWithPassword.mockResolvedValueOnce(mockUser);

      await service.registerWithCredentials({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
      });

      expect(userRepository.createWithPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'newuser',
        }),
      );
    });

    it('should trim display_name if provided', async () => {
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.findByEmail.mockResolvedValueOnce(null);
      userRepository.createWithPassword.mockResolvedValueOnce(mockUser);

      await service.registerWithCredentials({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
        display_name: '  Test User  ',
      });

      expect(userRepository.createWithPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'Test User',
        }),
      );
    });

    it('should throw BadRequestException if username < 3 chars', async () => {
      await expect(
        service.registerWithCredentials({
          username: 'ab',
          email: 'new@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(
        new BadRequestException('Username must be at least 3 characters.'),
      );
    });

    it('should throw BadRequestException if password < 8 chars', async () => {
      await expect(
        service.registerWithCredentials({
          username: 'newuser',
          email: 'new@example.com',
          password: 'short',
        }),
      ).rejects.toThrow(
        new BadRequestException('Password must be at least 8 characters.'),
      );
    });

    it('should throw ConflictException if username exists', async () => {
      userRepository.findByUsername.mockResolvedValueOnce(mockUser);

      await expect(
        service.registerWithCredentials({
          username: 'testuser',
          email: 'new@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(new ConflictException('Username is already in use.'));
    });

    it('should throw ConflictException if email exists', async () => {
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.findByEmail.mockResolvedValueOnce(mockUser);

      await expect(
        service.registerWithCredentials({
          username: 'newuser',
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(new ConflictException('Email is already in use.'));
    });

    it('should normalize email to lowercase', async () => {
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.findByEmail.mockResolvedValueOnce(null);
      userRepository.createWithPassword.mockResolvedValueOnce(mockUser);

      await service.registerWithCredentials({
        username: 'newuser',
        email: 'NEW@EXAMPLE.COM',
        password: 'password123',
      });

      expect(userRepository.createWithPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
        }),
      );
    });

    it('should trim username', async () => {
      userRepository.findByUsername.mockResolvedValueOnce(null);
      userRepository.findByEmail.mockResolvedValueOnce(null);
      userRepository.createWithPassword.mockResolvedValueOnce(mockUser);

      await service.registerWithCredentials({
        username: '  testuser  ',
        email: 'test@example.com',
        password: 'password123',
      });

      expect(userRepository.createWithPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'testuser',
        }),
      );
    });
  });

  describe('signToken', () => {
    it('should sign token with user payload', () => {
      const token = service.signToken(mockUser);

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        role: 'user',
      });
      expect(token).toBe('jwt-token');
    });

    it('should include all required payload fields', () => {
      service.signToken(mockUser);

      const callArg = jwtService.sign.mock.calls[0][0] as JwtPayload;
      expect(callArg).toHaveProperty('sub');
      expect(callArg).toHaveProperty('email');
      expect(callArg).toHaveProperty('username');
      expect(callArg).toHaveProperty('role');
    });
  });

  describe('issueAuthTokens', () => {
    it('should create refresh token record and return auth tokens', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      const result = await service.issueAuthTokens(mockUser);

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO auth_refresh_tokens'),
        expect.arrayContaining([
          'user-123',
          expect.any(String), // token hash
          expect.any(String), // expires_at
        ]),
      );
      expect(result).toHaveProperty('access_token', 'jwt-token');
      expect(result).toHaveProperty('refresh_token');
    });

    it('should use signed access token', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      const result = await service.issueAuthTokens(mockUser);

      expect(result.access_token).toBe('jwt-token');
    });
  });

  describe('refreshAuthTokens', () => {
    it('should refresh tokens for valid refresh token', async () => {
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      dataSource.query
        .mockResolvedValueOnce([
          {
            id: 'token-1',
            user_id: 'user-123',
            expires_at: expiresAt,
            revoked_at: null,
          },
        ])
        .mockResolvedValueOnce([]) // INSERT new token
        .mockResolvedValueOnce([]); // UPDATE revoke old token

      userRepository.findOne.mockResolvedValueOnce(mockUser);

      const result = await service.refreshAuthTokens('valid-token');

      expect(result.user).toEqual(mockUser);
      expect(result.tokens).toHaveProperty('access_token');
      expect(result.tokens).toHaveProperty('refresh_token');
    });

    it('should throw UnauthorizedException when refresh token empty', async () => {
      await expect(service.refreshAuthTokens('  ')).rejects.toThrow(
        new UnauthorizedException('Refresh token is required'),
      );
    });

    it('should throw UnauthorizedException when refresh token invalid', async () => {
      dataSource.query.mockResolvedValueOnce([]); // Empty result

      await expect(service.refreshAuthTokens('invalid-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token is invalid'),
      );
    });

    it('should throw UnauthorizedException when refresh token revoked', async () => {
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      dataSource.query.mockResolvedValueOnce([
        {
          id: 'token-1',
          user_id: 'user-123',
          expires_at: expiresAt,
          revoked_at: new Date().toISOString(),
        },
      ]);

      await expect(service.refreshAuthTokens('revoked-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token has been revoked'),
      );
    });

    it('should throw UnauthorizedException when refresh token expired', async () => {
      const expiresAt = new Date(Date.now() - 1000).toISOString(); // Past date
      dataSource.query.mockResolvedValueOnce([
        {
          id: 'token-1',
          user_id: 'user-123',
          expires_at: expiresAt,
          revoked_at: null,
        },
      ]);

      await expect(service.refreshAuthTokens('expired-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token has expired'),
      );
    });

    it('should throw UnauthorizedException when token expiration is invalid date', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          id: 'token-1',
          user_id: 'user-123',
          expires_at: 'invalid-date',
          revoked_at: null,
        },
      ]);

      await expect(service.refreshAuthTokens('bad-date-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token has expired'),
      );
    });

    it('should throw UnauthorizedException when user no longer exists', async () => {
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      dataSource.query
        .mockResolvedValueOnce([
          {
            id: 'token-1',
            user_id: 'deleted-user',
            expires_at: expiresAt,
            revoked_at: null,
          },
        ])
        .mockResolvedValueOnce([]); // User not found

      userRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.refreshAuthTokens('orphan-token')).rejects.toThrow(
        new UnauthorizedException('Refresh token user no longer exists'),
      );
    });

    it('should revoke old refresh token before issuing new one', async () => {
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      dataSource.query
        .mockResolvedValueOnce([
          {
            id: 'token-1',
            user_id: 'user-123',
            expires_at: expiresAt,
            revoked_at: null,
          },
        ])
        .mockResolvedValueOnce([]) // INSERT new token
        .mockResolvedValueOnce([]); // UPDATE revoke old

      userRepository.findOne.mockResolvedValueOnce(mockUser);

      await service.refreshAuthTokens('valid-token');

      // Verify revoke was called with the old token ID
      const calls = dataSource.query.mock.calls;
      expect(calls).toContainEqual([
        expect.stringContaining('UPDATE auth_refresh_tokens'),
        expect.any(Array),
      ]);
    });
  });

  describe('revokeRefreshToken', () => {
    it('should revoke refresh token', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await service.revokeRefreshToken('token-to-revoke');

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE auth_refresh_tokens'),
        expect.arrayContaining([expect.any(String)]),
      );
    });

    it('should handle empty refresh token gracefully', async () => {
      await service.revokeRefreshToken('  ');

      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('should trim refresh token before hashing', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await service.revokeRefreshToken('  token-value  ');

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([expect.any(String)]),
      );
    });
  });

  describe('revokeAllRefreshTokensForUser', () => {
    it('should revoke all tokens for user', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await service.revokeAllRefreshTokensForUser('user-123');

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('revoked_at = CURRENT_TIMESTAMP'),
        ['user-123'],
      );
    });

    it('should only revoke non-revoked tokens', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      await service.revokeAllRefreshTokensForUser('user-123');

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('revoked_at IS NULL'),
        expect.anything(),
      );
    });
  });

  describe('refreshTokenLifetimeMs', () => {
    it('should return correct lifetime for custom REFRESH_TOKEN_EXPIRES_IN_DAYS', () => {
      process.env['REFRESH_TOKEN_EXPIRES_IN_DAYS'] = '14';

      const lifetime = service['refreshTokenLifetimeMs']();

      expect(lifetime).toBe(14 * 24 * 60 * 60 * 1000);
    });

    it('should default to 7 days when env var not set', () => {
      delete process.env['REFRESH_TOKEN_EXPIRES_IN_DAYS'];

      const lifetime = service['refreshTokenLifetimeMs']();

      expect(lifetime).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should default to 7 days when env var is not a number', () => {
      process.env['REFRESH_TOKEN_EXPIRES_IN_DAYS'] = 'invalid';

      const lifetime = service['refreshTokenLifetimeMs']();

      expect(lifetime).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should default to 7 days when env var is negative', () => {
      process.env['REFRESH_TOKEN_EXPIRES_IN_DAYS'] = '-5';

      const lifetime = service['refreshTokenLifetimeMs']();

      expect(lifetime).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should default to 7 days when env var is 0', () => {
      process.env['REFRESH_TOKEN_EXPIRES_IN_DAYS'] = '0';

      const lifetime = service['refreshTokenLifetimeMs']();

      expect(lifetime).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('should handle Infinity gracefully', () => {
      process.env['REFRESH_TOKEN_EXPIRES_IN_DAYS'] = 'Infinity';

      const lifetime = service['refreshTokenLifetimeMs']();

      expect(lifetime).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('Token hashing and validation', () => {
    it('should hash refresh token consistently', () => {
      const token = 'my-refresh-token';
      const hash1 = service['hashRefreshToken'](token);
      const hash2 = service['hashRefreshToken'](token);

      expect(hash1).toBe(hash2);
    });

    it('should generate different tokens each time', () => {
      const token1 = service['generateRefreshToken']();
      const token2 = service['generateRefreshToken']();

      expect(token1).not.toBe(token2);
    });

    it('should generate base64url encoded tokens', () => {
      const token = service['generateRefreshToken']();

      // Base64url should only contain alphanumeric, -, _
      expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
    });
  });
});
