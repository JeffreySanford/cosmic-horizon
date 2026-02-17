import { Test, TestingModule } from '@nestjs/testing';
import { UserRepository } from '../../repositories';
import { User } from '../../entities';
import { SessionSerializer } from './session.serializer';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('SessionSerializer', () => {
  let serializer: SessionSerializer;

  const mockUser: User = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@cosmic.local',
    github_id: 67890,
    display_name: 'Test User',
    avatar_url: 'https://avatars.example.com/67890',
    role: 'user',
    password_hash: null,
    bio: null,
    github_profile_url: 'https://github.com/testuser',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
    posts: [],
    revisions: [],
    comments: [],
    auditLogs: [],
  };

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        SessionSerializer,
        {
          provide: UserRepository,
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    serializer = testingModule.get<SessionSerializer>(SessionSerializer);
  });

  describe('serializeUser', () => {
    it('should serialize user to ID string', (done) => {
      serializer.serializeUser(mockUser, (err, id) => {
        expect(err).toBeNull();
        expect(id).toBe('user-1');
        done();
      });
    });

    it('should handle UUID user IDs', (done) => {
      const userWithUUID: User = {
        ...mockUser,
        id: '550e8400-e29b-41d4-a716-446655440000',
      };

      serializer.serializeUser(userWithUUID, (err, id) => {
        expect(err).toBeNull();
        expect(id).toBe('550e8400-e29b-41d4-a716-446655440000');
        done();
      });
    });

    it('should preserve user ID with special characters', (done) => {
      const userWithSpecialId: User = {
        ...mockUser,
        id: 'user-abc_123',
      };

      serializer.serializeUser(userWithSpecialId, (err, id) => {
        expect(err).toBeNull();
        expect(id).toBe('user-abc_123');
        done();
      });
    });

    it('should handle numeric string IDs', (done) => {
      const userWithNumericId: User = {
        ...mockUser,
        id: '12345',
      };

      serializer.serializeUser(userWithNumericId, (err, id) => {
        expect(err).toBeNull();
        expect(id).toBe('12345');
        done();
      });
    });

    it('should always pass null error on successful serialization', (done) => {
      serializer.serializeUser(mockUser, (err, id) => {
        expect(err).toBeNull();
        expect(id).toBeDefined();
        done();
      });
    });
  });

  describe('deserializeUser', () => {
    it('should deserialize user ID back to user object', async () => {
      testingModule = await Test.createTestingModule({
        providers: [
          SessionSerializer,
          {
            provide: UserRepository,
            useValue: {
              findOne: jest.fn().mockResolvedValue(mockUser),
            },
          },
        ],
      }).compile();

      const testSerializer = testingModule.get<SessionSerializer>(SessionSerializer);
      const testUserRepository = testingModule.get(UserRepository) as jest.Mocked<UserRepository>;

      return new Promise<void>((resolve) => {
        testSerializer.deserializeUser('user-1', (err, user) => {
          expect(err).toBeNull();
          expect(user).toEqual(mockUser);
          expect(testUserRepository.findOne).toHaveBeenCalledWith({
            where: { id: 'user-1' },
          });
          resolve();
        });
      });
    });

    it('should return null when user not found', async () => {
      testingModule = await Test.createTestingModule({
        providers: [
          SessionSerializer,
          {
            provide: UserRepository,
            useValue: {
              findOne: jest.fn().mockResolvedValue(null),
            },
          },
        ],
      }).compile();

      const testSerializer = testingModule.get<SessionSerializer>(SessionSerializer);

      return new Promise<void>((resolve) => {
        testSerializer.deserializeUser('nonexistent', (err, user) => {
          expect(err).toBeNull();
          expect(user).toBeNull();
          resolve();
        });
      });
    });

    it('should handle database errors gracefully', async () => {
      const dbError = new Error('Database connection failed');
      testingModule = await Test.createTestingModule({
        providers: [
          SessionSerializer,
          {
            provide: UserRepository,
            useValue: {
              findOne: jest.fn().mockRejectedValue(dbError),
            },
          },
        ],
      }).compile();

      const testSerializer = testingModule.get<SessionSerializer>(SessionSerializer);

      return new Promise<void>((resolve) => {
        testSerializer.deserializeUser('user-1', (err, user) => {
          expect(err).toEqual(dbError);
          expect(user).toBeUndefined();
          resolve();
        });
      });
    });

    it('should query with correct TypeORM format', async () => {
      testingModule = await Test.createTestingModule({
        providers: [
          SessionSerializer,
          {
            provide: UserRepository,
            useValue: {
              findOne: jest.fn().mockResolvedValue(mockUser),
            },
          },
        ],
      }).compile();

      const testSerializer = testingModule.get<SessionSerializer>(SessionSerializer);
      const testUserRepository = testingModule.get(UserRepository) as jest.Mocked<UserRepository>;

      return new Promise<void>((resolve) => {
        testSerializer.deserializeUser('user-1', () => {
          expect(testUserRepository.findOne).toHaveBeenCalledWith({
            where: { id: 'user-1' },
          });
          resolve();
        });
      });
    });

    it('should handle UUID style user IDs', async () => {
      const uuidUser: User = {
        ...mockUser,
        id: '550e8400-e29b-41d4-a716-446655440000',
      };

      testingModule = await Test.createTestingModule({
        providers: [
          SessionSerializer,
          {
            provide: UserRepository,
            useValue: {
              findOne: jest.fn().mockResolvedValue(uuidUser),
            },
          },
        ],
      }).compile();

      const testSerializer = testingModule.get<SessionSerializer>(SessionSerializer);

      return new Promise<void>((resolve) => {
        testSerializer.deserializeUser('550e8400-e29b-41d4-a716-446655440000', (err, user) => {
          expect(err).toBeNull();
          expect(user?.id).toBe('550e8400-e29b-41d4-a716-446655440000');
          resolve();
        });
      });
    });

    it('should handle network timeout errors', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'ETIMEDOUT';

      testingModule = await Test.createTestingModule({
        providers: [
          SessionSerializer,
          {
            provide: UserRepository,
            useValue: {
              findOne: jest.fn().mockRejectedValue(timeoutError),
            },
          },
        ],
      }).compile();

      const testSerializer = testingModule.get<SessionSerializer>(SessionSerializer);

      return new Promise<void>((resolve) => {
        testSerializer.deserializeUser('user-1', (err, user) => {
          expect(err).toBeDefined();
          expect(err?.message).toContain('timeout');
          resolve();
        });
      });
    });

    it('should deserialize complex user objects with all fields', async () => {
      const complexUser: User = {
        id: 'user-complex',
        username: 'complexuser',
        email: 'complex@cosmic.local',
        github_id: 99999,
        display_name: 'Complex User',
        avatar_url: 'https://avatars.example.com/99999',
        role: 'admin',
        password_hash: null,
        bio: 'A complex user',
        github_profile_url: 'https://github.com/complexuser',
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-02-12'),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      testingModule = await Test.createTestingModule({
        providers: [
          SessionSerializer,
          {
            provide: UserRepository,
            useValue: {
              findOne: jest.fn().mockResolvedValue(complexUser),
            },
          },
        ],
      }).compile();

      const testSerializer = testingModule.get<SessionSerializer>(SessionSerializer);

      return new Promise<void>((resolve) => {
        testSerializer.deserializeUser('user-complex', (err, user) => {
          expect(err).toBeNull();
          expect(user).toEqual(complexUser);
          expect(user?.username).toBe('complexuser');
          expect(user?.role).toBe('admin');
          resolve();
        });
      });
    });

    it('should handle soft-deleted users correctly', async () => {
      const softDeletedUser: User = {
        ...mockUser,
        deleted_at: new Date('2025-01-01'),
      };

      testingModule = await Test.createTestingModule({
        providers: [
          SessionSerializer,
          {
            provide: UserRepository,
            useValue: {
              findOne: jest.fn().mockResolvedValue(softDeletedUser),
            },
          },
        ],
      }).compile();

      const testSerializer = testingModule.get<SessionSerializer>(SessionSerializer);

      return new Promise<void>((resolve) => {
        testSerializer.deserializeUser('user-1', (err, user) => {
          expect(err).toBeNull();
          expect(user?.deleted_at).toBeDefined();
          resolve();
        });
      });
    });
  });

  describe('integration behavior', () => {
    it('should round-trip user serialization/deserialization', async () => {
      testingModule = await Test.createTestingModule({
        providers: [
          SessionSerializer,
          {
            provide: UserRepository,
            useValue: {
              findOne: jest.fn().mockResolvedValue(mockUser),
            },
          },
        ],
      }).compile();

      const testSerializer = testingModule.get<SessionSerializer>(SessionSerializer);

      return new Promise<void>((resolve) => {
        // Serialize
        testSerializer.serializeUser(mockUser, (serErr, id) => {
          expect(serErr).toBeNull();
          expect(id).toBe('user-1');

          // Deserialize
          testSerializer.deserializeUser(id as string, (desErr, user) => {
            expect(desErr).toBeNull();
            expect(user).toEqual(mockUser);
            resolve();
          });
        });
      });
    });

    it('should handle concurrent serialization calls', () => {
      const user1: User = { ...mockUser, id: 'user-1' };
      const user2: User = { ...mockUser, id: 'user-2' };

      return new Promise<void>((resolve) => {
        let completed = 0;

        serializer.serializeUser(user1, (err, id) => {
          expect(err).toBeNull();
          expect(id).toBe('user-1');
          completed++;
          if (completed === 2) resolve();
        });

        serializer.serializeUser(user2, (err, id) => {
          expect(err).toBeNull();
          expect(id).toBe('user-2');
          completed++;
          if (completed === 2) resolve();
        });
      });
    });

    it('should be injectable as PassportSerializer', () => {
      expect(serializer).toBeDefined();
      expect(typeof serializer.serializeUser).toBe('function');
      expect(typeof serializer.deserializeUser).toBe('function');
    });
  });
});
