import { Test, TestingModule } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { UserRepository } from '../repositories/user.repository';
import { PostRepository } from '../repositories/post.repository';
import { NotFoundException } from '@nestjs/common';
import { PostStatus } from '../entities/post.entity';

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: UserRepository, useValue: mockUserRepository },
        { provide: PostRepository, useValue: mockPostRepository },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
    userRepository = module.get(UserRepository);
    postRepository = module.get(PostRepository);
  });

  it('should return profile and published posts', async () => {
    const mockUser = { id: 'u1', username: 'testuser', password_hash: 'secret' };
    const mockPosts = [
      { id: 'p1', status: PostStatus.PUBLISHED, title: 'P1' },
      { id: 'p2', status: PostStatus.DRAFT, title: 'P2' },
      { id: 'p3', status: PostStatus.PUBLISHED, hidden_at: new Date(), title: 'P3' },
    ];

    userRepository.findByUsername.mockResolvedValue(mockUser as any);
    postRepository.findByUser.mockResolvedValue(mockPosts as any);

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
    userRepository.update.mockResolvedValue({ id: 'u1' } as any);
    await service.updateProfile('u1', { bio: 'hello' });
    expect(userRepository.update).toHaveBeenCalledWith('u1', {
      display_name: undefined,
      bio: 'hello',
      avatar_url: null,
    });
  });
});
