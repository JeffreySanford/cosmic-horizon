import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';

describe('ProfileController', () => {
  let controller: ProfileController;
  let service: jest.Mocked<ProfileService>;

  beforeEach(async () => {
    const mockService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
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

    controller = module.get<ProfileController>(ProfileController);
    service = module.get(ProfileService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return profile data', async () => {
    const mockProfile: Awaited<ReturnType<ProfileService['getProfile']>> = {
      user: { id: '1', username: 'testuser', display_name: 'Test User' },
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
});
