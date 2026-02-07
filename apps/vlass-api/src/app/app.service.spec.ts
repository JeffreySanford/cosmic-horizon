import { AppService } from './app.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User, Post, PostStatus } from './entities';
import { UserRepository, PostRepository, AuditLogRepository } from './repositories';
import { CreateUserDto, CreatePostDto, UpdateUserDto } from './dto';

describe('AppService', () => {
  let service: AppService;
  let mockDataSource: Pick<DataSource, 'isInitialized'>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockPostRepository: jest.Mocked<PostRepository>;
  let mockAuditLogRepository: jest.Mocked<AuditLogRepository>;

  const mockUser: User = {
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    github_id: 123,
    display_name: 'Test User',
    avatar_url: null,
    bio: null,
    github_profile_url: null,
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
    deleted_at: null,
  };

  beforeEach(() => {
    mockDataSource = {
      isInitialized: true,
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
      softDelete: jest.fn().mockResolvedValue(true),
      hardDelete: jest.fn(),
    };

    mockAuditLogRepository = {
      createAuditLog: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<AuditLogRepository>;

    // Manually instantiate service to avoid circular dependency in NestJS module system
    service = new AppService(
      mockDataSource as DataSource,
      mockUserRepository,
      mockPostRepository,
      mockAuditLogRepository,
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

    describe('publishPost', () => {
      it('should publish a post', async () => {
        const result = await service.publishPost('1');
        expect(result.status).toBe(PostStatus.PUBLISHED);
        expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalled();
      });

      it('should throw NotFoundException when post not found', async () => {
        mockPostRepository.findById.mockResolvedValue(null);
        await expect(service.publishPost('999')).rejects.toThrow(NotFoundException);
      });
    });

    describe('deletePost', () => {
      it('should soft delete a post', async () => {
        const result = await service.deletePost('1');
        expect(result).toBe(true);
        expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalled();
      });

      it('should throw NotFoundException when post not found', async () => {
        mockPostRepository.findById.mockResolvedValue(null);
        await expect(service.deletePost('999')).rejects.toThrow(NotFoundException);
      });
    });
  });
});
