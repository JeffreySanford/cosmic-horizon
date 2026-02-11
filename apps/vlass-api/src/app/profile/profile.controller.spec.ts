import { Test, TestingModule } from '@nestjs/testing';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { ExecutionContext } from '@nestjs/common';

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
      .useValue({ canActivate: (context: ExecutionContext) => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: (context: ExecutionContext) => true })
      .compile();

    controller = module.get<ProfileController>(ProfileController);
    service = module.get(ProfileService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return profile data', async () => {
    const mockProfile = {
      user: { id: '1', username: 'testuser', display_name: 'Test User' },
      posts: [],
    };
    service.getProfile.mockResolvedValue(mockProfile as any);

    const result = await controller.getProfile('testuser');
    expect(result).toEqual(mockProfile);
    expect(service.getProfile).toHaveBeenCalledWith('testuser');
  });

  it('should update my profile', async () => {
    const updateData = { bio: 'New bio' };
    const mockUser = { id: '1', username: 'testuser', bio: 'New bio' };
    service.updateProfile.mockResolvedValue(mockUser as any);

    const result = await controller.updateMyProfile({ user: { id: '1' } }, updateData);
    expect(result).toEqual(mockUser);
    expect(service.updateProfile).toHaveBeenCalledWith('1', updateData);
  });
});
