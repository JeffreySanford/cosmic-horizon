import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRepository } from './user.repository';
import { User } from '../entities/user.entity';
import { UserBuilder } from '../testing/test-builders';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('UserRepository', () => {
  let repository: UserRepository;
  let mockRepository: jest.Mocked<Repository<User>>;

  const createMockUserRepository = () =>
    ({
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
      query: jest.fn(),
    }) as unknown as jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    mockRepository = createMockUserRepository();

    testingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    repository = testingModule.get<UserRepository>(UserRepository);
  });

  describe('create', () => {
    it('should create a new user', async () => {
      const userData = new UserBuilder().withEmail('test@example.com').build();
      const savedUser = new UserBuilder().withId('user-1').build();

      mockRepository.create.mockReturnValue(userData);
      mockRepository.save.mockResolvedValue(savedUser);

      const result = await repository.create(userData);

      expect(mockRepository.create).toHaveBeenCalledWith(userData);
      expect(result.id).toBeDefined();
    });

    it('should handle duplicate email errors', async () => {
      const userData = new UserBuilder().build();

      mockRepository.create.mockReturnValue(userData);
      mockRepository.save.mockRejectedValue(new Error('Duplicate email'));

      await expect(repository.create(userData)).rejects.toThrow(
        'Duplicate email',
      );
    });
  });

  describe('createWithPassword', () => {
    it('should call query with SQL parameters', async () => {
      const params = {
        username: 'testuser',
        display_name: 'Test User',
        email: 'secure@example.com',
        password: 'plaintext',
      };

      mockRepository.query.mockResolvedValue([{ id: 'user-secure' }]);
      mockRepository.findOneBy.mockResolvedValue(
        new UserBuilder().withId('user-secure').build(),
      );

      const result = await repository.createWithPassword(params);

      expect(mockRepository.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          params.username,
          params.display_name,
          params.email,
          params.password,
        ]),
      );
      expect(result.id).toBe('user-secure');
    });

    it('should throw error if query returns no rows', async () => {
      const params = {
        username: 'testuser',
        display_name: 'Test User',
        email: 'secure@example.com',
        password: 'plaintext',
      };

      mockRepository.query.mockResolvedValue([]);

      await expect(repository.createWithPassword(params)).rejects.toThrow(
        'Failed to create user record',
      );
    });

    it('should fetch user after creation', async () => {
      const params = {
        username: 'testuser',
        display_name: 'Test User',
        email: 'secure@example.com',
        password: 'plaintext',
      };

      const createdUser = new UserBuilder()
        .withId('user-secure')
        .withUsername('testuser')
        .withEmail('secure@example.com')
        .build();

      mockRepository.query.mockResolvedValue([{ id: 'user-secure' }]);
      mockRepository.findOneBy.mockResolvedValue(createdUser);

      const result = await repository.createWithPassword(params);

      expect(mockRepository.findOneBy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'user-secure',
        }),
      );
      expect(result).toEqual(createdUser);
    });
  });

  describe('findById', () => {
    it('should find a user by id', async () => {
      const user = new UserBuilder().withId('user-1').build();

      mockRepository.findOneBy.mockResolvedValue(user);

      const result = await repository.findById('user-1');

      expect(mockRepository.findOneBy).toHaveBeenCalled();
      expect(result?.id).toBe('user-1');
    });

    it('should return null when user not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find a user by email', async () => {
      const user = new UserBuilder()
        .withId('user-1')
        .withEmail('test@example.com')
        .build();

      mockRepository.findOneBy.mockResolvedValue(user);

      const result = await repository.findByEmail('test@example.com');

      expect(mockRepository.findOneBy).toHaveBeenCalled();
      expect(result?.email).toBe('test@example.com');
    });

    it('should return null when email not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      const result = await repository.findByEmail('nonexistent@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should find a user by username', async () => {
      const user = new UserBuilder()
        .withId('user-1')
        .withUsername('testuser')
        .build();

      mockRepository.findOneBy.mockResolvedValue(user);

      const result = await repository.findByUsername('testuser');

      expect(mockRepository.findOneBy).toHaveBeenCalled();
      expect(result?.username).toBe('testuser');
    });

    it('should return null when username not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      const result = await repository.findByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmailAndPassword', () => {
    it('should find a user by email and matching password', async () => {
      const user = new UserBuilder()
        .withId('user-1')
        .withEmail('test@example.com')
        .build();

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(user),
      };

      mockRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      const result = await repository.findByEmailAndPassword(
        'test@example.com',
        'test-password',
      );

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      expect(result?.id).toBe('user-1');
    });

    it('should return null when password does not match', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      mockRepository.createQueryBuilder.mockReturnValue(
        mockQueryBuilder as any,
      );

      const result = await repository.findByEmailAndPassword(
        'test@example.com',
        'wrong-password',
      );

      expect(result).toBeNull();
    });
  });

  describe('findByGithubId', () => {
    it('should find user by github id', async () => {
      const user = new UserBuilder()
        .withId('user-1')
        .withGithubId('gh-123')
        .build();

      mockRepository.findOneBy.mockResolvedValue(user);

      const result = await repository.findByGithubId(123);

      expect(mockRepository.findOneBy).toHaveBeenCalled();
      expect(result?.github_id).toBe('gh-123');
    });

    it('should return null when github id not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      const result = await repository.findByGithubId(999);

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should find all non-deleted users', async () => {
      const users = [
        new UserBuilder().withId('user-1').build(),
        new UserBuilder().withId('user-2').build(),
      ];

      mockRepository.find.mockResolvedValue(users);

      const result = await repository.findAll();

      expect(mockRepository.find).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should return empty array if no users exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const updatedUser = new UserBuilder()
        .withId('user-1')
        .withName('Updated Name')
        .build();

      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOneBy.mockResolvedValue(updatedUser);

      const result = await repository.update('user-1', {
        display_name: 'Updated Name',
      });

      expect(mockRepository.update).toHaveBeenCalled();
      expect(result?.id).toBe('user-1');
    });

    it('should return null if user not found', async () => {
      mockRepository.findOneBy.mockResolvedValue(null);

      const result = await repository.update('nonexistent', {
        display_name: 'Name',
      });

      expect(result).toBeNull();
    });
  });
});
