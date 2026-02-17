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

describe('ProfileService', () => {
  let service: ProfileService;
  let userRepository: jest.Mocked<UserRepository>;
  let postRepository: jest.Mocked<PostRepository>;

  beforeEach(async () => {
    const mockUserRepository = {
      findByUsername: jest.fn(),
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

  it('should return profile and published posts', async () => {
    const mockUser: User = {
      id: 'u1',
      github_id: null,
      username: 'testuser',
      display_name: 'Test User',
      avatar_url: null,
      email: 'test@example.com',
      role: 'user',
      password_hash: 'secret',
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
    const mockPosts: Post[] = [
      {
        id: 'p1',
        user_id: 'u1',
        title: 'P1',
        description: null,
        content: 'c1',
        status: PostStatus.PUBLISHED,
        published_at: new Date(),
        hidden_at: null,
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
        title: 'P2',
        description: null,
        content: 'c2',
        status: PostStatus.DRAFT,
        published_at: null,
        hidden_at: null,
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
        id: 'p3',
        user_id: 'u1',
        title: 'P3',
        description: null,
        content: 'c3',
        status: PostStatus.PUBLISHED,
        published_at: new Date(),
        hidden_at: new Date(),
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

    userRepository.findByUsername.mockResolvedValue(mockUser);
    postRepository.findByUser.mockResolvedValue(mockPosts);

    const result = await service.getProfile('testuser');

    expect(result.user).not.toHaveProperty('password_hash');
    expect(result.user.username).toBe('testuser');
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0].id).toBe('p1');
  });

  it('should throw NotFoundException if user missing', async () => {
    userRepository.findByUsername.mockResolvedValue(null);
    await expect(service.getProfile('none')).rejects.toThrow(NotFoundException);
  });

  it('should update profile', async () => {
    userRepository.update.mockResolvedValue({
      id: 'u1',
      github_id: null,
      username: 'testuser',
      display_name: 'Test User',
      avatar_url: null,
      email: 'test@example.com',
      role: 'user',
      password_hash: null,
      bio: 'hello',
      github_profile_url: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      posts: [],
      revisions: [],
      comments: [],
      auditLogs: [],
    });
    await service.updateProfile('u1', { bio: 'hello' });
    expect(userRepository.update).toHaveBeenCalledWith('u1', {
      display_name: undefined,
      bio: 'hello',
      avatar_url: null,
    });
  });

  it('should throw BadRequestException for empty display name', async () => {
    await expect(service.updateProfile('u1', { display_name: '' })).rejects.toThrow(
      BadRequestException
    );
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException for whitespace-only display name', async () => {
    await expect(service.updateProfile('u1', { display_name: '   ' })).rejects.toThrow(
      BadRequestException
    );
    expect(userRepository.update).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when updating nonexistent user', async () => {
    userRepository.update.mockResolvedValue(null);
    await expect(service.updateProfile('nonexistent', { bio: 'new bio' })).rejects.toThrow(
      NotFoundException
    );
  });

  it('should clear bio field when updating with empty string', async () => {
    userRepository.update.mockResolvedValue({
      id: 'u1',
      github_id: null,
      username: 'testuser',
      display_name: 'Test User',
      avatar_url: null,
      email: 'test@example.com',
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
    });
    await service.updateProfile('u1', { bio: '' });
    expect(userRepository.update).toHaveBeenCalledWith('u1', {
      display_name: undefined,
      bio: null,
      avatar_url: null,
    });
  });

  it('should update avatar URL', async () => {
    userRepository.update.mockResolvedValue({
      id: 'u1',
      github_id: null,
      username: 'testuser',
      display_name: 'Test User',
      avatar_url: 'https://example.com/avatar.jpg',
      email: 'test@example.com',
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
    });
    await service.updateProfile('u1', { avatar_url: 'https://example.com/avatar.jpg' });
    expect(userRepository.update).toHaveBeenCalledWith('u1', {
      display_name: undefined,
      bio: null,
      avatar_url: 'https://example.com/avatar.jpg',
    });
  });

  it('should clear avatar URL when updating with empty string', async () => {
    userRepository.update.mockResolvedValue({
      id: 'u1',
      github_id: null,
      username: 'testuser',
      display_name: 'Test User',
      avatar_url: null,
      email: 'test@example.com',
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
    });
    await service.updateProfile('u1', { avatar_url: '' });
    expect(userRepository.update).toHaveBeenCalledWith('u1', {
      display_name: undefined,
      bio: null,
      avatar_url: null,
    });
  });

  it('should update display name with trimming', async () => {
    userRepository.update.mockResolvedValue({
      id: 'u1',
      github_id: null,
      username: 'testuser',
      display_name: 'Updated Name',
      avatar_url: null,
      email: 'test@example.com',
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
    });
    await service.updateProfile('u1', { display_name: '  Updated Name  ' });
    expect(userRepository.update).toHaveBeenCalledWith('u1', {
      display_name: 'Updated Name',
      bio: null,
      avatar_url: null,
    });
  });
});
