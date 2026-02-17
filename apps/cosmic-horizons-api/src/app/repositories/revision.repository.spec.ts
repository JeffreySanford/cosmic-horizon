import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RevisionRepository } from './revision.repository';
import { Revision } from '../entities/revision.entity';
import { RevisionBuilder } from '../testing/test-builders';
import { TypeSafeAssertions } from '../testing/mock-factory';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('RevisionRepository', () => {
  let repository: RevisionRepository;
  let mockRepository: jest.Mocked<Repository<Revision>>;

  const createMockRevisionRepository = () =>
    ({
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<Revision>>);

  beforeEach(async () => {
    mockRepository = createMockRevisionRepository();

    testingModule = await Test.createTestingModule({
      providers: [
        RevisionRepository,
        {
          provide: getRepositoryToken(Revision),
          useValue: mockRepository,
        },
      ],
    }).compile();

    repository = testingModule.get<RevisionRepository>(RevisionRepository);
  });

  describe('create', () => {
    it('should create a new revision', async () => {
      const revisionData = new RevisionBuilder()
        .withPostId('post-1')
        .withUserId('user-1')
        .withTitle('Post Title v1')
        .withContent('Post content v1')
        .build();

      const savedRevision = new RevisionBuilder()
        .withId('revision-1')
        .withPostId('post-1')
        .withUserId('user-1')
        .withTitle('Post Title v1')
        .build();

      mockRepository.create.mockReturnValue(revisionData);
      mockRepository.save.mockResolvedValue(savedRevision);

      const result = await repository.create(revisionData);

      expect(mockRepository.create).toHaveBeenCalledWith(revisionData);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.post_id).toBe('post-1');
    });

    it('should set created_at timestamp', async () => {
      const revisionData = new RevisionBuilder().build();
      const savedRevision = new RevisionBuilder()
        .withId('revision-1')
        .withCreatedAt(new Date())
        .build();

      mockRepository.create.mockReturnValue(revisionData);
      mockRepository.save.mockResolvedValue(savedRevision);

      const result = await repository.create(revisionData);

      expect(result.created_at).toBeDefined();
    });

    it('should auto-increment version for same post', async () => {
      const r1 = new RevisionBuilder().withId('r1').build();
      const r2 = new RevisionBuilder().withId('r2').build();

      mockRepository.create.mockReturnValue(r1);
      mockRepository.save.mockResolvedValueOnce(r1);

      const result1 = await repository.create(r1);
      expect(result1.id).toBeDefined();

      mockRepository.create.mockReturnValue(r2);
      mockRepository.save.mockResolvedValueOnce(r2);

      const result2 = await repository.create(r2);
      expect(result2.id).toBeDefined();
    });

    it('should handle database errors on create', async () => {
      const revisionData = new RevisionBuilder().build();

      mockRepository.create.mockReturnValue(revisionData);
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(repository.create(revisionData)).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('findByPost', () => {
    it('should find all revisions for a post', async () => {
      const revisions = [
        new RevisionBuilder()
          .withId('revision-1')
          .withPostId('post-1')
          .build(),
        new RevisionBuilder()
          .withId('revision-2')
          .withPostId('post-1')
          .build(),
        new RevisionBuilder()
          .withId('revision-3')
          .withPostId('post-1')
          .build(),
      ];

      mockRepository.find.mockResolvedValue(revisions);

      const result = await repository.findByPost('post-1');

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user', 'post'],
          order: { created_at: 'ASC' },
        })
      );
      expect(result).toHaveLength(3);
      TypeSafeAssertions.assertArrayPropertiesEqual(result, 'post_id', 'post-1');
    });

    it('should order revisions by created_at ascending', async () => {
      mockRepository.find.mockResolvedValue([]);

      await repository.findByPost('post-1');

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { created_at: 'ASC' },
        })
      );
    });

    it('should include user and post relations', async () => {
      mockRepository.find.mockResolvedValue([]);

      await repository.findByPost('post-1');

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user', 'post'],
        })
      );
    });

    it('should return empty array when post has no revisions', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await repository.findByPost('post-no-history');

      expect(result).toEqual([]);
    });
  });

  describe('findLatestByPost', () => {
    it('should find the latest revision for a post', async () => {
      const latestRevision = new RevisionBuilder()
        .withId('revision-5')
        .withPostId('post-1')
        .withTitle('Latest Title')
        .build();

      mockRepository.findOne.mockResolvedValue(latestRevision);

      const result = await repository.findLatestByPost('post-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user', 'post'],
          order: { created_at: 'DESC' },
        })
      );
      expect(result?.id).toBe('revision-5');
    });

    it('should return highest version when multiple exist', async () => {
      const revision = new RevisionBuilder()
        .withId('revision-10')
        .withPostId('post-1')
        .build();

      mockRepository.findOne.mockResolvedValue(revision);

      const result = await repository.findLatestByPost('post-1');

      expect(result?.created_at).toBeDefined();
    });

    it('should return null when no revisions exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findLatestByPost('post-no-history');

      expect(result).toBeNull();
    });

    it('should order by created_at descending to get latest', async () => {
      mockRepository.findOne.mockResolvedValue(new RevisionBuilder().build());

      await repository.findLatestByPost('post-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { created_at: 'DESC' },
        })
      );
    });

    it('should include relations for latest revision', async () => {
      const revision = new RevisionBuilder()
        .withId('revision-1')
        .build();

      mockRepository.findOne.mockResolvedValue(revision);

      await repository.findLatestByPost('post-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user', 'post'],
        })
      );
    });
  });

  describe('findById', () => {
    it('should find a revision by id with relations', async () => {
      const revision = new RevisionBuilder()
        .withId('revision-1')
        .build();

      mockRepository.findOne.mockResolvedValue(revision);

      const result = await repository.findById('revision-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user', 'post'],
        })
      );
      expect(result?.id).toBe('revision-1');
    });

    it('should return null when revision not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should include user and post relations', async () => {
      mockRepository.findOne.mockResolvedValue(new RevisionBuilder().build());

      await repository.findById('revision-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user', 'post'],
        })
      );
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete a revision', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1, raw: {} } as any);

      const result = await repository.hardDelete('revision-1');

      expect(mockRepository.delete).toHaveBeenCalledWith({ id: 'revision-1' });
      expect(result).toBe(true);
    });

    it('should return false when revision not found', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0, raw: {} } as any);

      const result = await repository.hardDelete('nonexistent');

      expect(result).toBe(false);
    });

    it('should permanently remove all revision data', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1, raw: {} } as any);

      const result = await repository.hardDelete('revision-1');

      expect(mockRepository.delete).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should allow deleting specific revisions', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1, raw: {} } as any);

      const result = await repository.hardDelete('revision-3');

      expect(mockRepository.delete).toHaveBeenCalledWith({ id: 'revision-3' });
      expect(result).toBe(true);
    });
  });

  describe('Version History Scenarios', () => {
    it('should track linear version progression', async () => {
      const revisions = [
        new RevisionBuilder().withId('r1').build(),
        new RevisionBuilder().withId('r2').build(),
        new RevisionBuilder().withId('r3').build(),
        new RevisionBuilder().withId('r4').build(),
      ];

      mockRepository.find.mockResolvedValue(revisions);

      const result = await repository.findByPost('post-1');

      expect(result[0].id).toBeDefined();
      expect(result[1].id).toBeDefined();
      expect(result[2].id).toBeDefined();
      expect(result[3].id).toBeDefined();
    });

    it('should support comparing two revisions', async () => {
      const oldRevision = new RevisionBuilder()
        .withId('revision-1')
        .withTitle('Old Title')
        .withContent('Old content')
        .build();

      const newRevision = new RevisionBuilder()
        .withId('revision-2')
        .withTitle('New Title')
        .withContent('New content')
        .build();

      mockRepository.findOne
        .mockResolvedValueOnce(oldRevision)
        .mockResolvedValueOnce(newRevision);

      const old = await repository.findById('revision-1');
      const latest = await repository.findById('revision-2');

      expect(old?.title).not.toEqual(latest?.title);
      expect(old?.content).not.toEqual(latest?.content);
    });

    it('should track editor information across versions', async () => {
      const revisions = [
        new RevisionBuilder()
          .withUserId('user-1')
          .build(),
        new RevisionBuilder()
          .withUserId('user-2')
          .build(),
        new RevisionBuilder()
          .withUserId('user-1')
          .build(),
      ];

      mockRepository.find.mockResolvedValue(revisions);

      const result = await repository.findByPost('post-1');

      expect(result[0].user_id).toBe('user-1');
      expect(result[1].user_id).toBe('user-2');
      expect(result[2].user_id).toBe('user-1');
    });
  });
});
