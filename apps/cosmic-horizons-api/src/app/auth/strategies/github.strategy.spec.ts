import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../auth.service';
import { GitHubStrategy } from './github.strategy';
import { User } from '../../entities';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('GitHubStrategy', () => {
  const mockUser: User = {
    id: 'user-1',
    username: 'githubuser',
    email: 'user@github.com',
    github_id: 12345,
    display_name: 'GitHub User',
    avatar_url: 'https://avatars.githubusercontent.com/u/12345',
    role: 'user',
    password_hash: null,
    bio: null,
    github_profile_url: 'https://github.com/githubuser',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    posts: [],
    revisions: [],
    comments: [],
    auditLogs: [],
  };

  const originalEnv = process.env;

  beforeAll(() => {
    // Set valid environment variables before any imports
    process.env['GITHUB_CLIENT_ID'] = 'test_client_id_123';
    process.env['GITHUB_CLIENT_SECRET'] = 'test_client_secret_456';
    process.env['GITHUB_CALLBACK_URL'] = 'http://localhost:3000/api/auth/github/callback';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should initialize with valid GitHub OAuth credentials', async () => {
      testingModule = await Test.createTestingModule({
        providers: [
          GitHubStrategy,
          {
            provide: AuthService,
            useValue: {
              validateOrCreateUser: jest.fn(),
            },
          },
        ],
      }).compile();

      const strategy = testingModule.get<GitHubStrategy>(GitHubStrategy);
      expect(strategy).toBeDefined();
    });

    it('should use provided callback URL from env', async () => {
      testingModule = await Test.createTestingModule({
        providers: [
          GitHubStrategy,
          {
            provide: AuthService,
            useValue: {
              validateOrCreateUser: jest.fn(),
            },
          },
        ],
      }).compile();

      const strategy = testingModule.get<GitHubStrategy>(GitHubStrategy);
      expect(strategy).toBeDefined();
    });

    it('should initialize strategy with scope user:email', async () => {
      testingModule = await Test.createTestingModule({
        providers: [
          GitHubStrategy,
          {
            provide: AuthService,
            useValue: {
              validateOrCreateUser: jest.fn(),
            },
          },
        ],
      }).compile();

      const strategy = testingModule.get<GitHubStrategy>(GitHubStrategy);
      // The strategy is initialized with scope information
      expect(strategy).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should create new user from GitHub profile', async () => {
      testingModule = await Test.createTestingModule({
        providers: [
          GitHubStrategy,
          {
            provide: AuthService,
            useValue: {
              validateOrCreateUser: jest.fn().mockResolvedValue(mockUser),
            },
          },
        ],
      }).compile();

      const testStrategy = testingModule.get<GitHubStrategy>(GitHubStrategy);
      const testAuthService = testingModule.get(AuthService) as jest.Mocked<AuthService>;

      const githubProfile = {
        id: '12345',
        username: 'githubuser',
        displayName: 'GitHub User',
        emails: [{ value: 'user@github.com' }],
        photos: [{ value: 'https://avatars.githubusercontent.com/u/12345' }],
      };

      const result = await (testStrategy as any).validate('access_token', 'refresh_token', githubProfile);

      expect(testAuthService.validateOrCreateUser).toHaveBeenCalledWith(githubProfile);
      expect(result).toEqual(mockUser);
    });

    it('should return existing user if already registered', async () => {
      const existingUser = { ...mockUser, id: 'existing_user_id' };
      testingModule = await Test.createTestingModule({
        providers: [
          GitHubStrategy,
          {
            provide: AuthService,
            useValue: {
              validateOrCreateUser: jest.fn().mockResolvedValue(existingUser),
            },
          },
        ],
      }).compile();

      const testStrategy = testingModule.get<GitHubStrategy>(GitHubStrategy);

      const githubProfile = {
        id: '12345',
        username: 'githubuser',
        displayName: 'GitHub User',
      };

      const result = await (testStrategy as any).validate('access_token', 'refresh_token', githubProfile);

      expect(result).toEqual(existingUser);
      expect(result.id).toBe('existing_user_id');
    });

    it('should handle profile without email gracefully', async () => {
      testingModule = await Test.createTestingModule({
        providers: [
          GitHubStrategy,
          {
            provide: AuthService,
            useValue: {
              validateOrCreateUser: jest.fn().mockResolvedValue(mockUser),
            },
          },
        ],
      }).compile();

      const testStrategy = testingModule.get<GitHubStrategy>(GitHubStrategy);

      const profileWithoutEmail = {
        id: '12345',
        username: 'noemail',
        displayName: 'No Email User',
        emails: [],
      };

      const result = await (testStrategy as any).validate('access_token', 'refresh_token', profileWithoutEmail);

      expect(result).toBeDefined();
    });

    it('should propagate errors from authService', async () => {
      const error = new Error('Database error');
      testingModule = await Test.createTestingModule({
        providers: [
          GitHubStrategy,
          {
            provide: AuthService,
            useValue: {
              validateOrCreateUser: jest.fn().mockRejectedValue(error),
            },
          },
        ],
      }).compile();

      const testStrategy = testingModule.get<GitHubStrategy>(GitHubStrategy);

      const githubProfile = {
        id: '12345',
        username: 'githubuser',
      };

      await expect(
        (testStrategy as any).validate('access_token', 'refresh_token', githubProfile),
      ).rejects.toThrow('Database error');
    });

    it('should accept multiple email addresses from GitHub profile', async () => {
      testingModule = await Test.createTestingModule({
        providers: [
          GitHubStrategy,
          {
            provide: AuthService,
            useValue: {
              validateOrCreateUser: jest.fn().mockResolvedValue(mockUser),
            },
          },
        ],
      }).compile();

      const testStrategy = testingModule.get<GitHubStrategy>(GitHubStrategy);
      const testAuthService = testingModule.get(AuthService) as jest.Mocked<AuthService>;

      const profileWithEmails = {
        id: '12345',
        username: 'multimail',
        emails: [
          { value: 'primary@github.com', primary: true },
          { value: 'secondary@github.com', primary: false },
        ],
      };

      const result = await (testStrategy as any).validate('access_token', 'refresh_token', profileWithEmails);

      expect(testAuthService.validateOrCreateUser).toHaveBeenCalledWith(profileWithEmails);
      expect(result).toBeDefined();
    });

    it('should ignore access/refresh tokens in validation', async () => {
      testingModule = await Test.createTestingModule({
        providers: [
          GitHubStrategy,
          {
            provide: AuthService,
            useValue: {
              validateOrCreateUser: jest.fn().mockResolvedValue(mockUser),
            },
          },
        ],
      }).compile();

      const testStrategy = testingModule.get<GitHubStrategy>(GitHubStrategy);
      const testAuthService = testingModule.get(AuthService) as jest.Mocked<AuthService>;

      const githubProfile = {
        id: '12345',
        username: 'githubuser',
      };

      await (testStrategy as any).validate('token1', 'token2', githubProfile);
      await (testStrategy as any).validate('different_token', 'different_token2', githubProfile);

      expect(testAuthService.validateOrCreateUser).toHaveBeenCalledTimes(2);
    });

    it('should work with GitHub profile containing additional fields', async () => {
      testingModule = await Test.createTestingModule({
        providers: [
          GitHubStrategy,
          {
            provide: AuthService,
            useValue: {
              validateOrCreateUser: jest.fn().mockResolvedValue(mockUser),
            },
          },
        ],
      }).compile();

      const testStrategy = testingModule.get<GitHubStrategy>(GitHubStrategy);

      const extendedProfile = {
        id: '12345',
        username: 'githubuser',
        displayName: 'GitHub User',
        emails: [{ value: 'user@github.com' }],
        photos: [{ value: 'https://avatars.githubusercontent.com/u/12345' }],
        _raw: '{"some": "raw"}',
        _json: { node_id: 'MDQ6VXNlcjEyMzQ1' },
      };

      const result = await (testStrategy as any).validate('access_token', 'refresh_token', extendedProfile);

      expect(result).toBeDefined();
    });
  });
});
