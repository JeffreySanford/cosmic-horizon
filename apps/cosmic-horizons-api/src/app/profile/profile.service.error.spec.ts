import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { UserRepository } from '../repositories/user.repository';
import { PostRepository } from '../repositories/post.repository';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Post, PostStatus } from '../entities/post.entity';
import { User } from '../entities/user.entity';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

/**
 * ProfileService - Error Path & Branch Coverage Tests
 * Focus: validation failures, repository errors, data filtering edge cases
 */
describe('ProfileService - Error Paths & Branch Coverage', () => {
  let service: ProfileService;
  let userRepository: jest.Mocked<UserRepository>;
  let postRepository: jest.Mocked<PostRepository>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockUserRepository = {
      findByUsername: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
    };
    const mockPostRepository = {
      findByUser: jest.fn(),
    };

    testingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: PostRepository, useValue: mockPostRepository },
      ],
    }).compile();

    service = testingModule.get<ProfileService>(ProfileService);
    userRepository = testingModule.get(UserRepository);
    postRepository = testingModule.get(PostRepository);
  });

  describe('getProfile - Error Paths', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      userRepository.findByUsername.mockResolvedValueOnce(null);

      await expect(service.getProfile('nonexistent-user')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getProfile('nonexistent-user')).rejects.toThrow(
        '@nonexistent-user not found',
      );
    });

    it('should handle repository error when fetching user', async () => {
      userRepository.findByUsername.mockRejectedValueOnce(
        new Error('Database connection failed'),
      );

      await expect(service.getProfile('testuser')).rejects.toThrow(
        'Database connection failed',
      );
    });

    it('should handle repository error when fetching user posts', async () => {
      const mockUser: User = {
        id: 'u1',
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        password_hash: 'secret',
        github_id: null,
        avatar_url: null,
        bio: null,
        github_profile_url: null,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.findByUsername.mockResolvedValueOnce(mockUser);
      postRepository.findByUser.mockRejectedValueOnce(
        new Error('Query timeout'),
      );

      await expect(service.getProfile('testuser')).rejects.toThrow(
        'Query timeout',
      );
    });

    it('should return empty posts array when user has no posts', async () => {
      const mockUser: User = {
        id: 'u1',
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        password_hash: 'secret',
        github_id: null,
        avatar_url: null,
        bio: null,
        github_profile_url: null,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.findByUsername.mockResolvedValueOnce(mockUser);
      postRepository.findByUser.mockResolvedValueOnce([]);

      const result = await service.getProfile('testuser');

      expect(result.posts).toEqual([]);
      expect(result.user.username).toBe('testuser');
      expect(result.user).not.toHaveProperty('password_hash');
    });

    it('should filter out draft posts from profile', async () => {
      const mockUser: User = {
        id: 'u1',
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        password_hash: 'secret',
        github_id: null,
        avatar_url: null,
        bio: null,
        github_profile_url: null,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      const mockPosts: Post[] = [
        {
          id: 'p1',
          user_id: 'u1',
          title: 'Published',
          content: 'content',
          status: PostStatus.PUBLISHED,
          hidden_at: null,
          published_at: new Date(),
          description: null,
          locked_at: null,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          user: mockUser,
          revisions: [],
          comments: [],
          snapshots: [],
        },
        {
          id: 'p2',
          user_id: 'u1',
          title: 'Draft',
          content: 'content',
          status: PostStatus.DRAFT,
          hidden_at: null,
          published_at: null,
          description: null,
          locked_at: null,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          user: mockUser,
          revisions: [],
          comments: [],
          snapshots: [],
        },
      ];

      userRepository.findByUsername.mockResolvedValueOnce(mockUser);
      postRepository.findByUser.mockResolvedValueOnce(mockPosts);

      const result = await service.getProfile('testuser');

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].id).toBe('p1');
      expect(result.posts[0].status).toBe(PostStatus.PUBLISHED);
    });

    it('should filter out hidden posts from profile', async () => {
      const mockUser: User = {
        id: 'u1',
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        password_hash: 'secret',
        github_id: null,
        avatar_url: null,
        bio: null,
        github_profile_url: null,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      const mockPosts: Post[] = [
        {
          id: 'p1',
          user_id: 'u1',
          title: 'Visible',
          content: 'content',
          status: PostStatus.PUBLISHED,
          hidden_at: null,
          published_at: new Date(),
          description: null,
          locked_at: null,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          user: mockUser,
          revisions: [],
          comments: [],
          snapshots: [],
        },
        {
          id: 'p2',
          user_id: 'u1',
          title: 'Hidden',
          content: 'content',
          status: PostStatus.PUBLISHED,
          hidden_at: new Date(),
          published_at: new Date(),
          description: null,
          locked_at: null,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          user: mockUser,
          revisions: [],
          comments: [],
          snapshots: [],
        },
      ];

      userRepository.findByUsername.mockResolvedValueOnce(mockUser);
      postRepository.findByUser.mockResolvedValueOnce(mockPosts);

      const result = await service.getProfile('testuser');

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0].id).toBe('p1');
      expect(result.posts[0].hidden_at).toBeNull();
    });

    it('should omit sensitive user data from profile response', async () => {
      const mockUser: User = {
        id: 'u1',
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        password_hash: 'very-secret-hash',
        github_id: 123,
        avatar_url: 'https://example.com/avatar.jpg',
        bio: 'My bio',
        github_profile_url: 'https://github.com/testuser',
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.findByUsername.mockResolvedValueOnce(mockUser);
      postRepository.findByUser.mockResolvedValueOnce([]);

      const result = await service.getProfile('testuser');

      expect(result.user).not.toHaveProperty('password_hash');
      expect(result.user).not.toHaveProperty('github_id');
      expect(result.user).not.toHaveProperty('email');
      expect(result.user.display_name).toBe('Test User');
      expect(result.user.avatar_url).toBe('https://example.com/avatar.jpg');
      expect(result.user.bio).toBe('My bio');
    });
  });

  describe('updateProfile - Validation Errors', () => {
    it('should throw BadRequestException when display_name is empty string', async () => {
      await expect(
        service.updateProfile('u1', { display_name: '' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateProfile('u1', { display_name: '' }),
      ).rejects.toThrow('cannot be empty');
    });

    it('should throw BadRequestException when display_name is only whitespace', async () => {
      await expect(
        service.updateProfile('u1', { display_name: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when user does not exist after update', async () => {
      userRepository.update.mockResolvedValueOnce(null);

      await expect(
        service.updateProfile('u1', { bio: 'New bio' }),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.updateProfile('u1', { bio: 'New bio' }),
      ).rejects.toThrow('User profile was not found');
    });

    it('should handle repository error during update', async () => {
      userRepository.update.mockRejectedValueOnce(
        new Error('Database transaction failed'),
      );

      await expect(
        service.updateProfile('u1', { display_name: 'New Name' }),
      ).rejects.toThrow('Database transaction failed');
    });
  });

  describe('updateProfile - Data Transformation', () => {
    it('should trim display_name before updating', async () => {
      const updatedUser: User = {
        id: 'u1',
        username: 'testuser',
        display_name: 'Trimmed Name',
        email: 'test@example.com',
        password_hash: 'secret',
        github_id: null,
        avatar_url: null,
        bio: null,
        github_profile_url: null,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.update.mockResolvedValueOnce(updatedUser);

      await service.updateProfile('u1', { display_name: '  Trimmed Name  ' });

      expect(userRepository.update).toHaveBeenCalledWith('u1', {
        display_name: 'Trimmed Name',
        bio: null,
        avatar_url: null,
      });
    });

    it('should trim and set bio correctly', async () => {
      const updatedUser: User = {
        id: 'u1',
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        password_hash: 'secret',
        github_id: null,
        avatar_url: null,
        bio: 'Updated bio',
        github_profile_url: null,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.update.mockResolvedValueOnce(updatedUser);

      await service.updateProfile('u1', { bio: '  Updated bio  ' });

      expect(userRepository.update).toHaveBeenCalledWith('u1', {
        display_name: undefined,
        bio: 'Updated bio',
        avatar_url: null,
      });
    });

    it('should set bio to null when empty after trimming', async () => {
      const updatedUser: User = {
        id: 'u1',
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        password_hash: 'secret',
        github_id: null,
        avatar_url: null,
        bio: null,
        github_profile_url: null,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.update.mockResolvedValueOnce(updatedUser);

      await service.updateProfile('u1', { bio: '   ' });

      expect(userRepository.update).toHaveBeenCalledWith('u1', {
        display_name: undefined,
        bio: null,
        avatar_url: null,
      });
    });

    it('should trim and set avatar_url correctly', async () => {
      const updatedUser: User = {
        id: 'u1',
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        password_hash: 'secret',
        github_id: null,
        avatar_url: 'https://example.com/avatar.jpg',
        bio: null,
        github_profile_url: null,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.update.mockResolvedValueOnce(updatedUser);

      await service.updateProfile('u1', {
        avatar_url: '  https://example.com/avatar.jpg  ',
      });

      expect(userRepository.update).toHaveBeenCalledWith('u1', {
        display_name: undefined,
        bio: null,
        avatar_url: 'https://example.com/avatar.jpg',
      });
    });

    it('should set avatar_url to null when empty after trimming', async () => {
      const updatedUser: User = {
        id: 'u1',
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        password_hash: 'secret',
        github_id: null,
        avatar_url: null,
        bio: null,
        github_profile_url: null,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.update.mockResolvedValueOnce(updatedUser);

      await service.updateProfile('u1', { avatar_url: '   ' });

      expect(userRepository.update).toHaveBeenCalledWith('u1', {
        display_name: undefined,
        bio: null,
        avatar_url: null,
      });
    });
  });

  describe('updateProfile - All Fields', () => {
    it('should update all profile fields simultaneously', async () => {
      const updatedUser: User = {
        id: 'u1',
        username: 'testuser',
        display_name: 'New Display Name',
        email: 'test@example.com',
        password_hash: 'secret',
        github_id: null,
        avatar_url: 'https://example.com/new-avatar.jpg',
        bio: 'New bio',
        github_profile_url: null,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.update.mockResolvedValueOnce(updatedUser);

      const result = await service.updateProfile('u1', {
        display_name: 'New Display Name',
        bio: 'New bio',
        avatar_url: 'https://example.com/new-avatar.jpg',
      });

      expect(result.display_name).toBe('New Display Name');
      expect(result.bio).toBe('New bio');
      expect(result.avatar_url).toBe('https://example.com/new-avatar.jpg');
      expect(userRepository.update).toHaveBeenCalledWith('u1', {
        display_name: 'New Display Name',
        bio: 'New bio',
        avatar_url: 'https://example.com/new-avatar.jpg',
      });
    });

    it('should only update provided fields without affecting others', async () => {
      const updatedUser: User = {
        id: 'u1',
        username: 'testuser',
        display_name: 'Updated Name',
        email: 'test@example.com',
        password_hash: 'secret',
        github_id: null,
        avatar_url: null,
        bio: 'Existing bio',
        github_profile_url: null,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.update.mockResolvedValueOnce(updatedUser);

      await service.updateProfile('u1', { display_name: 'Updated Name' });

      expect(userRepository.update).toHaveBeenCalledWith('u1', {
        display_name: 'Updated Name',
        bio: null,
        avatar_url: null,
      });
    });
  });

  describe('updateProfile - Edge Cases', () => {
    it('should accept undefined fields without updating them', async () => {
      const updatedUser: User = {
        id: 'u1',
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        password_hash: 'secret',
        github_id: null,
        avatar_url: null,
        bio: null,
        github_profile_url: null,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.update.mockResolvedValueOnce(updatedUser);

      const result = await service.updateProfile('u1', {});

      expect(result.id).toBe('u1');
      expect(userRepository.update).toHaveBeenCalledWith('u1', {
        display_name: undefined,
        bio: null,
        avatar_url: null,
      });
    });

    it('should handle very long display_name', async () => {
      const longName = 'A'.repeat(500);
      const updatedUser: User = {
        id: 'u1',
        username: 'testuser',
        display_name: longName,
        email: 'test@example.com',
        password_hash: 'secret',
        github_id: null,
        avatar_url: null,
        bio: null,
        github_profile_url: null,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.update.mockResolvedValueOnce(updatedUser);

      const result = await service.updateProfile('u1', {
        display_name: longName,
      });

      expect(result.display_name).toBe(longName);
    });

    it('should handle special characters in bio', async () => {
      const bioWithSpecialChars =
        'Bio with special chars: @#$%^&*()[]{}|;:,.<>?`~';
      const updatedUser: User = {
        id: 'u1',
        username: 'testuser',
        display_name: 'Test User',
        email: 'test@example.com',
        password_hash: 'secret',
        github_id: null,
        avatar_url: null,
        bio: bioWithSpecialChars,
        github_profile_url: null,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      };

      userRepository.update.mockResolvedValueOnce(updatedUser);

      const result = await service.updateProfile('u1', {
        bio: bioWithSpecialChars,
      });

      expect(result.bio).toBe(bioWithSpecialChars);
    });
  });
});
