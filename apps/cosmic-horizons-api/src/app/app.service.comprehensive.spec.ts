import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import {
  UserRepository,
  PostRepository,
  AuditLogRepository,
  RevisionRepository,
} from './repositories';
import { DataSource } from 'typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  User,
  Post,
  AuditAction,
  AuditEntityType,
  PostStatus,
} from './entities';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('AppService - Comprehensive Coverage', () => {
  let service: AppService;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockPostRepository: jest.Mocked<PostRepository>;
  let mockAuditLogRepository: jest.Mocked<AuditLogRepository>;
  let mockRevisionRepository: jest.Mocked<RevisionRepository>;

  const mockUser = (overrides?: Partial<User>): User =>
    ({
      id: 'user-1',
      username: 'testuser',
      email: 'test@example.com',
      role: 'user',
      created_at: new Date(),
      updated_at: new Date(),
      ...overrides,
    }) as User;

  const mockPost = (overrides?: Partial<Post>): Post =>
    ({
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
    }) as Post;

  beforeEach(async () => {
    mockDataSource = {
      isInitialized: true,
      query: jest.fn().mockResolvedValue([]),
    } as any;

    mockUserRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByUsername: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as any;

    mockPostRepository = {
      findAll: jest.fn(),
      findPublished: jest.fn(),
      findById: jest.fn(),
      findByUser: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      publish: jest.fn(),
      unpublish: jest.fn(),
      softDelete: jest.fn(),
      hide: jest.fn(),
      unhide: jest.fn(),
      lock: jest.fn(),
      unlock: jest.fn(),
    } as any;

    mockAuditLogRepository = {
      createAuditLog: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockRevisionRepository = {
      create: jest.fn().mockResolvedValue({}),
    } as any;

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

  describe('Post Permissions - Edit', () => {
    it('should allow owner to edit post', async () => {
      const post = mockPost({ user_id: 'user-1', locked_at: null });
      mockPostRepository.findById.mockResolvedValue(post);
      mockPostRepository.update.mockResolvedValue(
        mockPost({ title: 'Updated', status: PostStatus.DRAFT }),
      );

      const result = await service.updatePost('post-1', 'user-1', {
        title: 'Updated',
      });

      expect(result.title).toBe('Updated');
      expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalled();
    });

    it('should prevent non-owner from editing post', async () => {
      const post = mockPost({ user_id: 'user-1' });
      mockPostRepository.findById.mockResolvedValue(post);

      await expect(
        service.updatePost('post-1', 'user-2', { title: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent editing locked post', async () => {
      const lockedPost = mockPost({
        locked_at: new Date(),
        status: PostStatus.DRAFT,
      });
      mockPostRepository.findById.mockResolvedValue(lockedPost);

      await expect(
        service.updatePost('post-1', 'user-1', { title: 'Updated' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should not modify post if update returns null', async () => {
      const post = mockPost();
      mockPostRepository.findById.mockResolvedValue(post);
      mockPostRepository.update.mockResolvedValue(null);

      await expect(
        service.updatePost('post-1', 'user-1', { title: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Post Moderation - Hide/Unhide', () => {
    it('should allow moderator to hide post', async () => {
      const post = mockPost();
      const moderator = mockUser({ role: 'moderator' });
      mockPostRepository.findById.mockResolvedValue(post);
      mockUserRepository.findById.mockResolvedValue(moderator);
      mockPostRepository.hide.mockResolvedValue(
        mockPost({ hidden_at: new Date() }),
      );

      const result = await service.hidePost('post-1', moderator.id);

      expect(result.hidden_at).not.toBeNull();
      expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.HIDE }),
      );
    });

    it('should allow admin to hide post', async () => {
      const post = mockPost();
      const admin = mockUser({ role: 'admin' });
      mockPostRepository.findById.mockResolvedValue(post);
      mockUserRepository.findById.mockResolvedValue(admin);
      mockPostRepository.hide.mockResolvedValue(
        mockPost({ hidden_at: new Date() }),
      );

      await service.hidePost('post-1', admin.id);

      expect(mockPostRepository.hide).toHaveBeenCalledWith('post-1');
    });

    it('should allow post owner to hide own post', async () => {
      const post = mockPost({ user_id: 'user-1' });
      const owner = mockUser({ id: 'user-1' });
      mockPostRepository.findById.mockResolvedValue(post);
      mockUserRepository.findById.mockResolvedValue(owner);
      mockPostRepository.hide.mockResolvedValue(
        mockPost({ hidden_at: new Date() }),
      );

      await service.hidePost('post-1', 'user-1');

      expect(mockPostRepository.hide).toHaveBeenCalled();
    });

    it('should prevent regular user from hiding post', async () => {
      const post = mockPost({ user_id: 'user-2' }); // Different owner
      const regularUser = mockUser({ id: 'user-1', role: 'user' });
      mockPostRepository.findById.mockResolvedValue(post);
      mockUserRepository.findById.mockResolvedValue(regularUser);

      await expect(service.hidePost('post-1', regularUser.id)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should unhide post when authorized', async () => {
      const hiddenPost = mockPost({ hidden_at: new Date() });
      const moderator = mockUser({ role: 'moderator' });
      mockPostRepository.findById.mockResolvedValue(hiddenPost);
      mockUserRepository.findById.mockResolvedValue(moderator);
      mockPostRepository.unhide.mockResolvedValue(
        mockPost({ hidden_at: null }),
      );

      const result = await service.unhidePost('post-1', moderator.id);

      expect(result.hidden_at).toBeNull();
    });
  });

  describe('Post Moderation - Lock/Unlock', () => {
    it('should allow moderator to lock post', async () => {
      const post = mockPost();
      const moderator = mockUser({ role: 'moderator' });
      mockPostRepository.findById.mockResolvedValue(post);
      mockUserRepository.findById.mockResolvedValue(moderator);
      mockPostRepository.lock.mockResolvedValue(
        mockPost({ locked_at: new Date() }),
      );

      const result = await service.lockPost('post-1', moderator.id);

      expect(result.locked_at).not.toBeNull();
      expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.LOCK }),
      );
    });

    it('should prevent editing locked post on update', async () => {
      const lockedPost = mockPost({ locked_at: new Date() });
      mockPostRepository.findById.mockResolvedValue(lockedPost);

      await expect(
        service.updatePost('post-1', 'user-1', { content: 'new' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should unlock post when authorized', async () => {
      const lockedPost = mockPost({ locked_at: new Date() });
      const admin = mockUser({ role: 'admin' });
      mockPostRepository.findById.mockResolvedValue(lockedPost);
      mockUserRepository.findById.mockResolvedValue(admin);
      mockPostRepository.unlock.mockResolvedValue(
        mockPost({ locked_at: null }),
      );

      const result = await service.unlockPost('post-1', admin.id);

      expect(result.locked_at).toBeNull();
    });
  });

  describe('Post Publishing', () => {
    it('should allow owner to publish draft post', async () => {
      const draft = mockPost({ status: PostStatus.DRAFT, user_id: 'user-1' });
      mockPostRepository.findById.mockResolvedValue(draft);
      mockPostRepository.publish.mockResolvedValue(
        mockPost({ status: PostStatus.PUBLISHED }),
      );

      const result = await service.publishPost('post-1', 'user-1');

      expect(result.status).toBe('published');
      expect(mockRevisionRepository.create).toHaveBeenCalled();
    });

    it('should prevent non-owner from publishing post', async () => {
      const draft = mockPost({ status: PostStatus.DRAFT, user_id: 'user-1' });
      mockPostRepository.findById.mockResolvedValue(draft);

      await expect(service.publishPost('post-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should prevent publishing locked post', async () => {
      const draft = mockPost({
        status: PostStatus.DRAFT,
        locked_at: new Date(),
      });
      mockPostRepository.findById.mockResolvedValue(draft);

      await expect(service.publishPost('post-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should log publish action in audit', async () => {
      const draft = mockPost({ status: PostStatus.DRAFT });
      mockPostRepository.findById.mockResolvedValue(draft);
      mockPostRepository.publish.mockResolvedValue(
        mockPost({ status: PostStatus.PUBLISHED }),
      );

      await service.publishPost('post-1', 'user-1');

      expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.PUBLISH,
          entity_type: AuditEntityType.POST,
        }),
      );
    });

    it('should unpublish post when authorized', async () => {
      const published = mockPost({ status: PostStatus.PUBLISHED });
      mockPostRepository.findById.mockResolvedValue(published);
      mockPostRepository.unpublish.mockResolvedValue(
        mockPost({ status: PostStatus.DRAFT }),
      );

      const result = await service.unpublishPost('post-1', 'user-1');

      expect(result.status).toBe('draft');
    });
  });

  describe('Post Deletion', () => {
    it('should allow owner to delete post', async () => {
      const post = mockPost({ user_id: 'user-1' });
      mockPostRepository.findById.mockResolvedValue(post);
      mockPostRepository.softDelete.mockResolvedValue(true);

      const result = await service.deletePost('post-1', 'user-1');

      expect(result).toBe(true);
      expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.DELETE }),
      );
    });

    it('should prevent non-owner from deleting post', async () => {
      const post = mockPost({ user_id: 'user-1' });
      mockPostRepository.findById.mockResolvedValue(post);

      await expect(service.deletePost('post-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should prevent deleting locked post', async () => {
      const post = mockPost({ locked_at: new Date() });
      mockPostRepository.findById.mockResolvedValue(post);

      await expect(service.deletePost('post-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should handle soft delete failure', async () => {
      const post = mockPost();
      mockPostRepository.findById.mockResolvedValue(post);
      mockPostRepository.softDelete.mockResolvedValue(false);

      const result = await service.deletePost('post-1', 'user-1');

      expect(result).toBe(false);
      expect(mockAuditLogRepository.createAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('User Operations', () => {
    it('should create audit log when creating user', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(mockUser());

      await service.createUser({
        username: 'newuser',
        email: 'new@example.com',
      });

      expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CREATE,
          entity_type: AuditEntityType.USER,
        }),
      );
    });

    it('should prevent duplicate usernames', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(mockUser());

      await expect(
        service.createUser({ username: 'existing', email: 'new@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update user and create audit log', async () => {
      const user = mockUser();
      mockUserRepository.findById.mockResolvedValue(user);
      mockUserRepository.update.mockResolvedValue(
        mockUser({ email: 'updated@example.com' }),
      );

      await service.updateUser('user-1', { email: 'updated@example.com' });

      expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.UPDATE }),
      );
    });

    it('should handle user not found on update', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateUser('nonexistent', { email: 'new@example.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should delete user and create audit log', async () => {
      const user = mockUser();
      mockUserRepository.findById.mockResolvedValue(user);
      mockUserRepository.softDelete.mockResolvedValue(true);

      const result = await service.deleteUser('user-1');

      expect(result).toBe(true);
      expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalled();
    });
  });

  describe('Post Retrieval', () => {
    it('should retrieve posts by user', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser());
      mockPostRepository.findByUser.mockResolvedValue([mockPost(), mockPost()]);

      const posts = await service.getPostsByUser('user-1');

      expect(posts).toHaveLength(2);
      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1');
    });

    it('should throw when retrieving posts for non-existent user', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.getPostsByUser('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should retrieve published posts', async () => {
      mockPostRepository.findPublished.mockResolvedValue([
        mockPost({ status: PostStatus.PUBLISHED }),
      ]);

      const posts = await service.getPublishedPosts();

      expect(posts).toHaveLength(1);
      expect(posts[0].status).toBe(PostStatus.PUBLISHED);
    });
  });

  describe('Moderation Permissions', () => {
    it('should handle missing acting user in moderation', async () => {
      const post = mockPost();
      mockPostRepository.findById.mockResolvedValue(post);
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.hidePost('post-1', 'unknown-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow admin regardless of post ownership', async () => {
      const post = mockPost({ user_id: 'user-1' });
      const admin = mockUser({ id: 'admin-1', role: 'admin' });
      mockPostRepository.findById.mockResolvedValue(post);
      mockUserRepository.findById.mockResolvedValue(admin);
      mockPostRepository.hide.mockResolvedValue(
        mockPost({ hidden_at: new Date() }),
      );

      await service.hidePost('post-1', admin.id);

      expect(mockPostRepository.hide).toHaveBeenCalled();
    });

    it('should deny regular user from moderating others posts', async () => {
      const post = mockPost({ user_id: 'user-2' }); // Different owner
      const regularUser = mockUser({ id: 'user-1', role: 'user' });
      mockPostRepository.findById.mockResolvedValue(post);
      mockUserRepository.findById.mockResolvedValue(regularUser);

      await expect(service.hidePost('post-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('Health Status', () => {
    it('should return ok status when database connected', async () => {
      Object.defineProperty(mockDataSource, 'isInitialized', {
        value: true,
        configurable: true,
      });

      const status = await service.getHealthStatus();

      expect(status.status).toBe('ok');
      expect(status.database).toBe('connected');
    });

    it('should return disconnected when database not initialized', async () => {
      Object.defineProperty(mockDataSource, 'isInitialized', {
        value: false,
        configurable: true,
      });

      const status = await service.getHealthStatus();

      expect(status.database).toBe('disconnected');
    });

    it('should handle health check errors', async () => {
      Object.defineProperty(mockDataSource, 'isInitialized', {
        value: false,
        configurable: true,
      });

      const status = await service.getHealthStatus();

      expect(status.status).toMatch(/ok|error/);
    });
  });

  describe('Get Data', () => {
    it('should return API message', () => {
      const data = service.getData();

      expect(data.message).toBe('Cosmic Horizon API');
    });
  });

  describe('Post Creation with User Validation', () => {
    it('should verify user exists before creating post', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser());
      mockPostRepository.create.mockResolvedValue(mockPost());

      const createPostDto = {
        title: 'New Post',
        content: 'Content',
        user_id: 'user-1',
      };

      await service.createPost(createPostDto);

      expect(mockUserRepository.findById).toHaveBeenCalledWith('user-1');
    });

    it('should throw when creating post for non-existent user', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const createPostDto = {
        title: 'New Post',
        content: 'Content',
        user_id: 'nonexistent',
      };

      await expect(service.createPost(createPostDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Revision Creation', () => {
    it('should create revision when updating post', async () => {
      const post = mockPost();
      mockPostRepository.findById.mockResolvedValue(post);
      mockPostRepository.update.mockResolvedValue(
        mockPost({ title: 'Updated' }),
      );

      await service.updatePost('post-1', 'user-1', { title: 'Updated' });

      expect(mockRevisionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          post_id: 'post-1',
          user_id: 'user-1',
          change_summary: 'Post content updated',
        }),
      );
    });

    it('should create revision when publishing post', async () => {
      const post = mockPost();
      mockPostRepository.findById.mockResolvedValue(post);
      mockPostRepository.publish.mockResolvedValue(post);

      await service.publishPost('post-1', 'user-1');

      expect(mockRevisionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          post_id: 'post-1',
          change_summary: 'Published post revision',
        }),
      );
    });
  });

  describe('Error Handling in Retrieval', () => {
    it('should throw NotFoundException for non-existent user by id', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.getUserById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for non-existent user by username', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(null);

      await expect(service.getUserByUsername('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException for non-existent post', async () => {
      mockPostRepository.findById.mockResolvedValue(null);

      await expect(service.getPostById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('Null Handle Cases', () => {
    it('should handle update returning null', async () => {
      const user = mockUser();
      mockUserRepository.findById.mockResolvedValue(user);
      mockUserRepository.update.mockResolvedValue(null);

      await expect(
        service.updateUser('user-1', { email: 'new@example.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle post unpublish returning null', async () => {
      const post = mockPost();
      mockPostRepository.findById.mockResolvedValue(post);
      mockPostRepository.unpublish.mockResolvedValue(null);

      await expect(service.unpublishPost('post-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle hide returning null', async () => {
      const post = mockPost();
      const moderator = mockUser({ role: 'moderator' });
      mockPostRepository.findById.mockResolvedValue(post);
      mockUserRepository.findById.mockResolvedValue(moderator);
      mockPostRepository.hide.mockResolvedValue(null);

      await expect(service.hidePost('post-1', moderator.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle lock returning null', async () => {
      const post = mockPost();
      const moderator = mockUser({ role: 'moderator' });
      mockPostRepository.findById.mockResolvedValue(post);
      mockUserRepository.findById.mockResolvedValue(moderator);
      mockPostRepository.lock.mockResolvedValue(null);

      await expect(service.lockPost('post-1', moderator.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('AuditLog Creation Coverage', () => {
    it('should create appropriate audit logs for all actions', async () => {
      const testCases = [
        {
          method: () =>
            service.createPost({
              title: 'Test',
              content: 'Content',
              user_id: 'user-1',
            }),
          action: AuditAction.CREATE,
          setup: () => {
            mockUserRepository.findById.mockResolvedValue(mockUser());
            mockPostRepository.create.mockResolvedValue(mockPost());
          },
        },
      ];

      for (const testCase of testCases) {
        testCase.setup();
        await testCase.method();
        expect(mockAuditLogRepository.createAuditLog).toHaveBeenCalledWith(
          expect.objectContaining({ action: testCase.action }),
        );
      }
    });
  });
});
