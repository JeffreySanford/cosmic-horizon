import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('ProfileController', () => {
  let controller: ProfileController;
  let service: jest.Mocked<ProfileService>;

  beforeEach(async () => {
    const mockService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
    };

    testingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        {
          provide: ProfileService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(AuthenticatedGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = testingModule.get<ProfileController>(ProfileController);
    service = testingModule.get(ProfileService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return profile data', async () => {
    const mockProfile: Awaited<ReturnType<ProfileService['getProfile']>> = {
      user: {
        id: '1',
        username: 'testuser',
        display_name: 'Test User',
        avatar_url: null,
        role: 'user',
        bio: null,
        github_profile_url: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      },
      posts: [],
    };
    service.getProfile.mockResolvedValue(mockProfile);

    const result = await controller.getProfile('testuser');
    expect(result).toEqual(mockProfile);
    expect(service.getProfile).toHaveBeenCalledWith('testuser');
  });

  it('should update my profile', async () => {
    const updateData = { bio: 'New bio' };
    const mockUser: Awaited<ReturnType<ProfileService['updateProfile']>> = {
      id: '1',
      github_id: null,
      username: 'testuser',
      display_name: 'Test User',
      avatar_url: null,
      email: 'test@example.com',
      role: 'user',
      password_hash: null,
      bio: 'New bio',
      github_profile_url: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      posts: [],
      revisions: [],
      comments: [],
      auditLogs: [],
    };
    service.updateProfile.mockResolvedValue(mockUser);

    const result = await controller.updateMyProfile({ user: { id: '1' } }, updateData);
    expect(result).toEqual(mockUser);
    expect(service.updateProfile).toHaveBeenCalledWith('1', updateData);
  });

  it('should update display name', async () => {
    const updateData = { display_name: 'New Display Name' };
    const mockUser: Awaited<ReturnType<ProfileService['updateProfile']>> = {
      id: '1',
      github_id: null,
      username: 'testuser',
      display_name: 'New Display Name',
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
    };
    service.updateProfile.mockResolvedValue(mockUser);

    const result = await controller.updateMyProfile({ user: { id: '1' } }, updateData);
    expect(result.display_name).toBe('New Display Name');
    expect(service.updateProfile).toHaveBeenCalledWith('1', updateData);
  });

  it('should update avatar URL', async () => {
    const updateData = { avatar_url: 'https://example.com/avatar.jpg' };
    const mockUser: Awaited<ReturnType<ProfileService['updateProfile']>> = {
      id: '1',
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
    };
    service.updateProfile.mockResolvedValue(mockUser);

    const result = await controller.updateMyProfile({ user: { id: '1' } }, updateData);
    expect(result.avatar_url).toBe('https://example.com/avatar.jpg');
  });

  it('should update multiple profile fields at once', async () => {
    const updateData = {
      display_name: 'Updated Name',
      bio: 'Updated bio',
      avatar_url: 'https://example.com/new-avatar.jpg',
    };
    const mockUser: Awaited<ReturnType<ProfileService['updateProfile']>> = {
      id: '1',
      github_id: null,
      username: 'testuser',
      display_name: 'Updated Name',
      avatar_url: 'https://example.com/new-avatar.jpg',
      email: 'test@example.com',
      role: 'user',
      password_hash: null,
      bio: 'Updated bio',
      github_profile_url: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      posts: [],
      revisions: [],
      comments: [],
      auditLogs: [],
    };
    service.updateProfile.mockResolvedValue(mockUser);

    const result = await controller.updateMyProfile({ user: { id: '1' } }, updateData);
    expect(result.display_name).toBe('Updated Name');
    expect(result.bio).toBe('Updated bio');
    expect(result.avatar_url).toBe('https://example.com/new-avatar.jpg');
  });

  it('should retrieve profile with posts', async () => {
    const mockProfile: Awaited<ReturnType<ProfileService['getProfile']>> = {
      user: {
        id: '1',
        username: 'prolific-user',
        display_name: 'Prolific User',
        avatar_url: 'https://example.com/avatar.jpg',
        role: 'user',
        bio: 'I like astronomy',
        github_profile_url: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [
          {
            id: 'post-1',
            title: 'Post 1',
            content: 'Content 1',
            user_id: '1',
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
            revisions: [],
            comments: [],
          },
          {
            id: 'post-2',
            title: 'Post 2',
            content: 'Content 2',
            user_id: '1',
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
            revisions: [],
            comments: [],
          },
        ],
        revisions: [],
        comments: [],
        auditLogs: [],
      },
      posts: [],
    };
    service.getProfile.mockResolvedValue(mockProfile);

    const result = await controller.getProfile('prolific-user');
    expect(result.user.posts).toHaveLength(2);
    expect(result.user.posts[0].title).toBe('Post 1');
  });

  it('should retrieve minimal profile', async () => {
    const mockProfile: Awaited<ReturnType<ProfileService['getProfile']>> = {
      user: {
        id: '2',
        username: 'minimal-user',
        display_name: null,
        avatar_url: null,
        role: 'user',
        bio: null,
        github_profile_url: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      },
      posts: [],
    };
    service.getProfile.mockResolvedValue(mockProfile);

    const result = await controller.getProfile('minimal-user');
    expect(result.user.display_name).toBeNull();
    expect(result.user.bio).toBeNull();
    expect(result.user.posts).toHaveLength(0);
  });

  it('should handle admin profiles', async () => {
    const mockProfile: Awaited<ReturnType<ProfileService['getProfile']>> = {
      user: {
        id: 'admin-1',
        username: 'admin',
        display_name: 'Administrator',
        avatar_url: null,
        role: 'admin',
        bio: 'System admin',
        github_profile_url: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        posts: [],
        revisions: [],
        comments: [],
        auditLogs: [],
      },
      posts: [],
    };
    service.getProfile.mockResolvedValue(mockProfile);

    const result = await controller.getProfile('admin');
    expect(result.user.role).toBe('admin');
  });

  it('should clear bio when updating with empty string', async () => {
    const updateData = { bio: '' };
    const mockUser: Awaited<ReturnType<ProfileService['updateProfile']>> = {
      id: '1',
      github_id: null,
      username: 'testuser',
      display_name: 'Test User',
      avatar_url: null,
      email: 'test@example.com',
      role: 'user',
      password_hash: null,
      bio: '',
      github_profile_url: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      posts: [],
      revisions: [],
      comments: [],
      auditLogs: [],
    };
    service.updateProfile.mockResolvedValue(mockUser);

    const result = await controller.updateMyProfile({ user: { id: '1' } }, updateData);
    expect(result.bio).toBe('');
    expect(service.updateProfile).toHaveBeenCalledWith('1', updateData);
  });

  it('should handle profile updates for different user IDs', async () => {
    const updateData = { display_name: 'User 2 Name' };
    const mockUser2: Awaited<ReturnType<ProfileService['updateProfile']>> = {
      id: '2',
      github_id: null,
      username: 'user2',
      display_name: 'User 2 Name',
      avatar_url: null,
      email: 'user2@example.com',
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
    service.updateProfile.mockResolvedValue(mockUser2);

    const result = await controller.updateMyProfile({ user: { id: '2' } }, updateData);
    expect(result.id).toBe('2');
    expect(service.updateProfile).toHaveBeenCalledWith('2', updateData);
  });
});
