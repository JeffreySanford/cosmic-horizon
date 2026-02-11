import { AppService } from './app.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User, Post, PostStatus } from './entities';
import { UserRepository, PostRepository, AuditLogRepository, RevisionRepository } from './repositories';
import { CreateUserDto, CreatePostDto, UpdateUserDto } from './dto';

describe('AppService', () => {
  let service: AppService;
  let mockDataSource: Pick<DataSource, 'isInitialized' | 'query'>;
  let mockUserRepository: Record<string, jest.Mock>;
  let mockPostRepository: Record<string, jest.Mock>;
  let mockAuditLogRepository: Record<string, jest.Mock>;
  let mockRevisionRepository: Record<string, jest.Mock>;

  const mockUser: User = {
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
    github_id: 123,
    display_name: 'Test User',
    avatar_url: null,
    bio: null,
    github_profile_url: null,
    password_hash: null,
    posts: [],
    revisions: [],
    comments: [],
    auditLogs: [],
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  const mockPost: Post = {
    id: '1',
    title: 'Test Post',
    description: null,
    content: 'Test content',
    user_id: '1',
    status: PostStatus.DRAFT,
    user: mockUser,
    revisions: [],
    comments: [],
    snapshots: [],
    created_at: new Date(),
    updated_at: new Date(),
    published_at: null,
    hidden_at: null,
    locked_at: null,
    deleted_at: null,
  };

  beforeEach(() => {
    mockDataSource = {
      isInitialized: true,
      query: jest.fn().mockResolvedValue([]),
    };

    mockUserRepository = {
      findAll: jest.fn().mockResolvedValue([mockUser]),
      findById: jest.fn().mockResolvedValue(mockUser),
      findByUsername: jest.fn().mockResolvedValue(null),
      findByGithubId: jest.fn(),
      findByGitHubId: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockResolvedValue(mockUser),
      save: jest.fn(),
      update: jest.fn().mockResolvedValue(mockUser),
      softDelete: jest.fn().mockResolvedValue(true),
      hardDelete: jest.fn(),
    };

    mockPostRepository = {
      findAll: jest.fn().mockResolvedValue([mockPost]),
      findById: jest.fn().mockResolvedValue(mockPost),
      findPublished: jest.fn().mockResolvedValue([]),
      findByUser: jest.fn().mockResolvedValue([mockPost]),
      create: jest.fn().mockResolvedValue(mockPost),
      update: jest.fn().mockResolvedValue(mockPost),
      publish: jest.fn().mockResolvedValue({ ...mockPost, status: PostStatus.PUBLISHED }),
      unpublish: jest.fn().mockResolvedValue(mockPost),
      hide: jest.fn().mockResolvedValue({ ...mockPost, hidden_at: new Date() }),
      unhide: jest.fn().mockResolvedValue(mockPost),
      lock: jest.fn().mockResolvedValue({ ...mockPost, locked_at: new Date() }),
      unlock: jest.fn().mockResolvedValue(mockPost),
      softDelete: jest.fn().mockResolvedValue(true),
      hardDelete: jest.fn(),
    };

    mockAuditLogRepository = {
      createAuditLog: jest.fn().mockResolvedValue(undefined),
    };

    mockRevisionRepository = {
      create: jest.fn().mockResolvedValue(undefined as never),
      findByPost: jest.fn(),
      findLatestByPost: jest.fn(),
      findById: jest.fn(),
      hardDelete: jest.fn(),
    };

    // Manually instantiate service to avoid circular dependency in NestJS module system
    service = new AppService(
      mockDataSource as DataSource,
      mockUserRepository as unknown as UserRepository,
      mockPostRepository as unknown as PostRepository,
      mockAuditLogRepository as unknown as AuditLogRepository,
      mockRevisionRepository as unknown as RevisionRepository,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealthStatus', () => {
    it('should return ok status when database is initialized', async () => {
      const result = await service.getHealthStatus();

      expect(result.status).toBe('ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('database');
      expect(result).toHaveProperty('environment');
    });

    it('should include all required properties in response', async () => {
      const result = await service.getHealthStatus();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('database');
      expect(result).toHaveProperty('environment');
    });
  });

  describe('User Operations', () => {
    describe('getAllUsers', () => {
      it('should return all users', async () => {
        const result = await service.getAllUsers();
        expect(result).toEqual([mockUser]);
        expect(mockUserRepository.findAll).toHaveBeenCalled();
      });
    });

    describe('getUserById', () => {
      it('should return a user by id', async () => {
        const result = await service.getUserById('1');
        expect(result).toEqual(mockUser);
      });

      it('should throw NotFoundException when user not found', async () => {
        mockUserRepository.findById.mockResolvedValue(null);
        await expect(service.getUserById('999')).rejects.toThrow(NotFoundException);
      });
    });

    describe('createUser', () => {
      it('should create a new user', async () => {
        const createUserDto = { username: 'testuser', email: 'test@example.com' };
        const result = await service.createUser(createUserDto as CreateUserDto);
        expect(result).toEqual(mockUser);
        expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalled();
      });

      it('should throw BadRequestException when username exists', async () => {
        mockUserRepository.findByUsername.mockResolvedValue(mockUser);
        const createUserDto = { username: 'testuser', email: 'test@example.com' };
        await expect(service.createUser(createUserDto as CreateUserDto)).rejects.toThrow(
          BadRequestException,
        );
      });
    });

    describe('updateUser', () => {
      it('should update a user', async () => {
        const updateUserDto = { full_name: 'Updated User' };
        const result = await service.updateUser('1', updateUserDto as UpdateUserDto);
        expect(result).toEqual(mockUser);
      });

      it('should throw NotFoundException when user not found', async () => {
        mockUserRepository.findById.mockResolvedValue(null);
        const updateUserDto = { full_name: 'Updated User' };
        await expect(service.updateUser('999', updateUserDto as UpdateUserDto)).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('deleteUser', () => {
      it('should soft delete a user', async () => {
        const result = await service.deleteUser('1');
        expect(result).toBe(true);
        expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalled();
      });

      it('should throw NotFoundException when user not found', async () => {
        mockUserRepository.findById.mockResolvedValue(null);
        await expect(service.deleteUser('999')).rejects.toThrow(NotFoundException);
      });
    });
  });

  describe('Post Operations', () => {
    describe('getAllPosts', () => {
      it('should return all posts', async () => {
        const result = await service.getAllPosts();
        expect(result).toEqual([mockPost]);
      });
    });

    describe('getPublishedPosts', () => {
      it('should return published posts', async () => {
        const result = await service.getPublishedPosts();
        expect(result).toEqual([]);
      });
    });

    describe('getPostById', () => {
      it('should return a post by id', async () => {
        const result = await service.getPostById('1');
        expect(result).toEqual(mockPost);
      });

      it('should throw NotFoundException when post not found', async () => {
        mockPostRepository.findById.mockResolvedValue(null);
        await expect(service.getPostById('999')).rejects.toThrow(NotFoundException);
      });
    });

    describe('createPost', () => {
      it('should create a new post', async () => {
        const createPostDto = { title: 'Test', content: 'Test content', user_id: '1' };
        const result = await service.createPost(createPostDto as CreatePostDto);
        expect(result).toEqual(mockPost);
        expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalled();
      });
    });

    describe('updatePost', () => {
      it('should update a post and create revision', async () => {
        const result = await service.updatePost('1', '1', { title: 'Updated' });
        expect(result).toEqual(mockPost);
        expect(mockRevisionRepository.create).toHaveBeenCalled();
      });

      it('should throw NotFoundException when update target no longer exists', async () => {
        mockPostRepository.update.mockResolvedValue(null);
        await expect(service.updatePost('1', '1', { title: 'Updated' })).rejects.toThrow(NotFoundException);
      });

      it('should throw ForbiddenException when actor is not post owner', async () => {
        await expect(service.updatePost('1', 'other-user', { title: 'Denied' })).rejects.toThrow(ForbiddenException);
      });
    });

    describe('publishPost', () => {
      it('should publish a post', async () => {
        const result = await service.publishPost('1', '1');
        expect(result.status).toBe(PostStatus.PUBLISHED);
        expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalled();
        expect(mockRevisionRepository.create).toHaveBeenCalled();
      });

      it('should throw NotFoundException when post not found', async () => {
        mockPostRepository.findById.mockResolvedValue(null);
        await expect(service.publishPost('999', '1')).rejects.toThrow(NotFoundException);
      });

      it('should throw ForbiddenException when actor is not post owner', async () => {
        await expect(service.publishPost('1', 'other-user')).rejects.toThrow(ForbiddenException);
      });
    });

    describe('deletePost', () => {
      it('should soft delete a post', async () => {
        const result = await service.deletePost('1', '1');
        expect(result).toBe(true);
        expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalled();
      });

      it('should throw NotFoundException when post not found', async () => {
        mockPostRepository.findById.mockResolvedValue(null);
        await expect(service.deletePost('999', '1')).rejects.toThrow(NotFoundException);
      });

      it('should throw ForbiddenException when actor is not post owner', async () => {
        await expect(service.deletePost('1', 'other-user')).rejects.toThrow(ForbiddenException);
      });
    });

    describe('unpublishPost', () => {
      it('should unpublish a post', async () => {
        const result = await service.unpublishPost('1', '1');
        expect(result).toEqual(mockPost);
        expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalled();
      });

      it('should throw NotFoundException when post not found', async () => {
        mockPostRepository.findById.mockResolvedValue(null);
        await expect(service.unpublishPost('999', '1')).rejects.toThrow(NotFoundException);
      });

      it('should throw ForbiddenException when actor is not post owner', async () => {
        await expect(service.unpublishPost('1', 'other-user')).rejects.toThrow(ForbiddenException);
      });
    });

    describe('moderation', () => {
      it('allows owner to hide and lock post', async () => {
        await expect(service.hidePost('1', '1')).resolves.toBeDefined();
        await expect(service.lockPost('1', '1')).resolves.toBeDefined();
      });
    });
  });
});
