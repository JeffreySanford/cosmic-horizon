import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;
  let mockAppService: any;

  const mockUser: any = {
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    github_id: 123,
    full_name: 'Test User',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  const mockPost: any = {
    id: '1',
    title: 'Test Post',
    content: 'Test content',
    user_id: '1',
    status: 'DRAFT',
    created_at: new Date(),
    updated_at: new Date(),
    published_at: null,
    deleted_at: null,
  };

  beforeEach(async () => {
    mockAppService = {
      getData: () => ({ message: 'VLASS Portal API' }),
      getHealthStatus: () => Promise.resolve({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        environment: 'development',
      }),
      getAllUsers: jest.fn().mockResolvedValue([mockUser]),
      createUser: jest.fn().mockResolvedValue(mockUser),
      getUserById: jest.fn().mockResolvedValue(mockUser),
      updateUser: jest.fn().mockResolvedValue(mockUser),
      deleteUser: jest.fn().mockResolvedValue(true),
      getAllPosts: jest.fn().mockResolvedValue([mockPost]),
      getPublishedPosts: jest.fn().mockResolvedValue([]),
      createPost: jest.fn().mockResolvedValue(mockPost),
      getPostById: jest.fn().mockResolvedValue(mockPost),
      updatePost: jest.fn().mockResolvedValue(mockPost),
      publishPost: jest.fn().mockResolvedValue({ ...mockPost, status: 'PUBLISHED' }),
      unpublishPost: jest.fn().mockResolvedValue(mockPost),
      deletePost: jest.fn().mockResolvedValue(true),
      getPostsByUser: jest.fn().mockResolvedValue([mockPost]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getData', () => {
    it('should return app data', () => {
      const result = controller.getData();

      expect(result).toHaveProperty('message');
      expect(result.message).toBe('VLASS Portal API');
    });
  });

  describe('getHealth', () => {
    it('should return health status from service', async () => {
      const result = await controller.getHealth();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('database');
      expect(result.status).toBe('ok');
    });

    it('should return health status with all required properties', async () => {
      const result = await controller.getHealth();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('database');
      expect(result).toHaveProperty('environment');
    });
  });

  describe('Users Endpoints', () => {
    describe('getAllUsers', () => {
      it('should return all users', async () => {
        const result = await controller.getAllUsers();
        
        expect(result).toEqual([mockUser]);
        expect(mockAppService.getAllUsers).toHaveBeenCalled();
      });
    });

    describe('createUser', () => {
      it('should create a new user', async () => {
        const createUserDto = { username: 'newuser', email: 'new@example.com' };
        const result = await controller.createUser(createUserDto);
        
        expect(result).toEqual(mockUser);
        expect(mockAppService.createUser).toHaveBeenCalledWith(createUserDto);
      });
    });

    describe('getUserById', () => {
      it('should return a user by id', async () => {
        const result = await controller.getUserById('1');
        
        expect(result).toEqual(mockUser);
        expect(mockAppService.getUserById).toHaveBeenCalledWith('1');
      });
    });

    describe('updateUser', () => {
      it('should update a user', async () => {
        const updateUserDto = { full_name: 'Updated User' };
        const result = await controller.updateUser('1', updateUserDto);
        
        expect(result).toEqual(mockUser);
        expect(mockAppService.updateUser).toHaveBeenCalledWith('1', updateUserDto);
      });
    });

    describe('deleteUser', () => {
      it('should delete a user', async () => {
        const result = await controller.deleteUser('1');
        
        expect(result).toBe(true);
        expect(mockAppService.deleteUser).toHaveBeenCalledWith('1');
      });
    });

    describe('getPostsByUser', () => {
      it('should return posts by user', async () => {
        const result = await controller.getPostsByUser('1');
        
        expect(result).toEqual([mockPost]);
        expect(mockAppService.getPostsByUser).toHaveBeenCalledWith('1');
      });
    });
  });

  describe('Posts Endpoints', () => {
    describe('getAllPosts', () => {
      it('should return all posts', async () => {
        const result = await controller.getAllPosts();
        
        expect(result).toEqual([mockPost]);
        expect(mockAppService.getAllPosts).toHaveBeenCalled();
      });
    });

    describe('getPublishedPosts', () => {
      it('should return published posts', async () => {
        const result = await controller.getPublishedPosts();
        
        expect(result).toEqual([]);
        expect(mockAppService.getPublishedPosts).toHaveBeenCalled();
      });
    });

    describe('createPost', () => {
      it('should create a new post', async () => {
        const createPostDto = { title: 'New Post', content: 'Content', user_id: '1' };
        const result = await controller.createPost(createPostDto);
        
        expect(result).toEqual(mockPost);
        expect(mockAppService.createPost).toHaveBeenCalledWith(createPostDto);
      });
    });

    describe('getPostById', () => {
      it('should return a post by id', async () => {
        const result = await controller.getPostById('1');
        
        expect(result).toEqual(mockPost);
        expect(mockAppService.getPostById).toHaveBeenCalledWith('1');
      });
    });

    describe('updatePost', () => {
      it('should update a post', async () => {
        const updatePostDto = { title: 'Updated Title' };
        const result = await controller.updatePost('1', updatePostDto);
        
        expect(result).toEqual(mockPost);
        expect(mockAppService.updatePost).toHaveBeenCalledWith('1', updatePostDto);
      });
    });

    describe('publishPost', () => {
      it('should publish a post', async () => {
        const result = await controller.publishPost('1');
        
        expect(result.status).toBe('PUBLISHED');
        expect(mockAppService.publishPost).toHaveBeenCalledWith('1');
      });
    });

    describe('unpublishPost', () => {
      it('should unpublish a post', async () => {
        const result = await controller.unpublishPost('1');
        
        expect(result).toEqual(mockPost);
        expect(mockAppService.unpublishPost).toHaveBeenCalledWith('1');
      });
    });

    describe('deletePost', () => {
      it('should delete a post', async () => {
        const result = await controller.deletePost('1');
        
        expect(result).toBe(true);
        expect(mockAppService.deletePost).toHaveBeenCalledWith('1');
      });
    });
  });
});
