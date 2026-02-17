import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppService } from './app.service';
import { UserRepository, PostRepository, AuditLogRepository, RevisionRepository } from './repositories';
import { Post, PostStatus, User, AuditAction, AuditEntityType } from './entities';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('AppService - Final Coverage Gaps', () => {
  let service: AppService;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockPostRepository: jest.Mocked<PostRepository>;
  let mockAuditLogRepository: jest.Mocked<AuditLogRepository>;
  let mockRevisionRepository: jest.Mocked<RevisionRepository>;

  const mockUser = (overrides?: Partial<User>): User => ({
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as User);

  const mockPost = (overrides?: Partial<Post>): Post => ({
    id: 'post-1',
    title: 'Test Post',
    description: 'Description',
    content: 'Content',
    status: PostStatus.DRAFT,
    user_id: 'user-1',
    hidden_at: null,
    locked_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  } as Post);

  beforeEach(async () => {
    mockDataSource = {
      isInitialized: true,
      query: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<DataSource>;

    mockUserRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByUsername: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<UserRepository>;

    mockPostRepository = {
      findById: jest.fn(),
      findPublished: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      publish: jest.fn(),
      unpublish: jest.fn(),
      hide: jest.fn(),
      unhide: jest.fn(),
      lock: jest.fn(),
      unlock: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<PostRepository>;

    mockAuditLogRepository = {
      createAuditLog: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditLogRepository>;

    mockRevisionRepository = {
      create: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<RevisionRepository>;

    testingModule = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: PostRepository, useValue: mockPostRepository },
        { provide: AuditLogRepository, useValue: mockAuditLogRepository },
        { provide: RevisionRepository, useValue: mockRevisionRepository },
      ],
    }).compile();

    service = testingModule.get<AppService>(AppService);
  });

  describe('Health check error scenarios', () => {
    it('should handle health check with database error', async () => {
      Object.defineProperty(mockDataSource, 'isInitialized', {
        value: false,
        writable: true,
      });

      const result = await service.getHealthStatus();

      expect(result.database).toBe('disconnected');
      expect(result.status).toBe('ok');
    });

    it('should catch exception in health check', async () => {
      const error = new Error('DB Error');
      Object.defineProperty(mockDataSource, 'isInitialized', {
        get: () => {
          throw error;
        },
      });

      const result = await service.getHealthStatus();

      expect(result.status).toBe('error');
      expect(result.database).toBe('error');
    });

    it('should include NODE_ENV in health status', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const result = await service.getHealthStatus();

      expect(result.environment).toBe('production');
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Post update - return null scenarios', () => {
    it('should throw when update returns null', async () => {
      const post = mockPost();
      mockPostRepository.findById.mockResolvedValueOnce(post);
      mockPostRepository.update.mockResolvedValueOnce(null);

      await expect(
        service.updatePost('post-1', 'user-1', { content: 'new' })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Post publish - return null scenarios', () => {
    it('should throw when publish returns null', async () => {
      const post = mockPost({ status: PostStatus.DRAFT });
      mockPostRepository.findById.mockResolvedValueOnce(post);
      mockPostRepository.publish.mockResolvedValueOnce(null);

      await expect(service.publishPost('post-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Post unpublish - return null scenarios', () => {
    it('should throw when unpublish returns null', async () => {
      const post = mockPost({ status: PostStatus.PUBLISHED });
      mockPostRepository.findById.mockResolvedValueOnce(post);
      mockPostRepository.unpublish.mockResolvedValueOnce(null);

      await expect(service.unpublishPost('post-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Post hide operations', () => {
    it('should throw when post not found for hide', async () => {
      mockPostRepository.findById.mockResolvedValueOnce(null);
      mockUserRepository.findById.mockResolvedValueOnce(mockUser({ role: 'moderator' }));

      await expect(service.hidePost('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw when user not found for hide operation', async () => {
      mockPostRepository.findById.mockResolvedValueOnce(mockPost());
      mockUserRepository.findById.mockResolvedValueOnce(null);

      await expect(service.hidePost('post-1', 'nonexistent')).rejects.toThrow(ForbiddenException);
    });

    it('should throw when regular user tries to hide post they do not own', async () => {
      mockPostRepository.findById.mockResolvedValueOnce(mockPost({ user_id: 'user-2' }));
      mockUserRepository.findById.mockResolvedValueOnce(mockUser({ id: 'user-1', role: 'user' }));

      await expect(service.hidePost('post-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Post unhide operations', () => {
    it('should throw when post not found for unhide', async () => {
      mockPostRepository.findById.mockResolvedValueOnce(null);
      mockUserRepository.findById.mockResolvedValueOnce(mockUser({ role: 'moderator' }));

      await expect(service.unhidePost('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw when user not found for unhide operation', async () => {
      mockPostRepository.findById.mockResolvedValueOnce(mockPost({ hidden_at: new Date() }));
      mockUserRepository.findById.mockResolvedValueOnce(null);

      await expect(service.unhidePost('post-1', 'nonexistent')).rejects.toThrow(ForbiddenException);
    });

    it('should throw when regular user tries to unhide post they do not own', async () => {
      mockPostRepository.findById.mockResolvedValueOnce(mockPost({ user_id: 'user-2', hidden_at: new Date() }));
      mockUserRepository.findById.mockResolvedValueOnce(mockUser({ id: 'user-1', role: 'user' }));

      await expect(service.unhidePost('post-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Post lock operations', () => {
    it('should throw when post not found for lock', async () => {
      mockPostRepository.findById.mockResolvedValueOnce(null);
      mockUserRepository.findById.mockResolvedValueOnce(mockUser({ role: 'moderator' }));

      await expect(service.lockPost('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw when user not found for lock operation', async () => {
      mockPostRepository.findById.mockResolvedValueOnce(mockPost());
      mockUserRepository.findById.mockResolvedValueOnce(null);

      await expect(service.lockPost('post-1', 'nonexistent')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Post unlock operations', () => {
    it('should throw when post not found for unlock', async () => {
      mockPostRepository.findById.mockResolvedValueOnce(null);
      mockUserRepository.findById.mockResolvedValueOnce(mockUser({ role: 'moderator' }));

      await expect(service.unlockPost('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw when user not found for unlock operation', async () => {
      mockPostRepository.findById.mockResolvedValueOnce(mockPost({ locked_at: new Date() }));
      mockUserRepository.findById.mockResolvedValueOnce(null);

      await expect(service.unlockPost('post-1', 'nonexistent')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Post delete operations', () => {
    it('should throw when post not found for delete', async () => {
      mockPostRepository.findById.mockResolvedValueOnce(null);

      await expect(service.deletePost('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw when non-owner tries to delete post', async () => {
      mockPostRepository.findById.mockResolvedValueOnce(mockPost({ user_id: 'user-2' }));

      await expect(service.deletePost('post-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Create user edge cases', () => {
    it('should throw when username already exists', async () => {
      mockUserRepository.findByUsername.mockResolvedValueOnce(mockUser({ username: 'taken' }));

      await expect(
        service.createUser({ username: 'taken', email: 'test@example.com' })
      ).rejects.toThrow(BadRequestException);
    });

    it('should create user and audit log when successful', async () => {
      mockUserRepository.findByUsername.mockResolvedValueOnce(null);
      mockUserRepository.create.mockResolvedValueOnce(mockUser());

      const result = await service.createUser({ username: 'newuser', email: 'new@example.com' });

      expect(result.username).toBe('testuser');
      expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.CREATE })
      );
    });
  });

  describe('Get user by ID', () => {
    it('should throw when user not found by ID', async () => {
      mockUserRepository.findById.mockResolvedValueOnce(null);

      await expect(service.getUserById('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return user when found by ID', async () => {
      mockUserRepository.findById.mockResolvedValueOnce(mockUser());

      const result = await service.getUserById('user-1');

      expect(result.id).toBe('user-1');
    });
  });

  describe('Get user by username', () => {
    it('should throw when user not found by username', async () => {
      mockUserRepository.findByUsername.mockResolvedValueOnce(null);

      await expect(service.getUserByUsername('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return user when found by username', async () => {
      mockUserRepository.findByUsername.mockResolvedValueOnce(mockUser());

      const result = await service.getUserByUsername('testuser');

      expect(result.username).toBe('testuser');
    });
  });

  describe('Audit logging', () => {
    it('should log audit when user created successfully', async () => {
      mockUserRepository.findByUsername.mockResolvedValueOnce(null);
      mockUserRepository.create.mockResolvedValueOnce(mockUser());

      await service.createUser({ username: 'newuser', email: 'new@example.com' });

      expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CREATE,
          entity_type: AuditEntityType.USER,
        })
      );
    });
  });
});
