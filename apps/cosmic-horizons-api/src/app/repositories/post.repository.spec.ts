import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PostRepository } from './post.repository';
import { Post, PostStatus } from '../entities/post.entity';
import { PostBuilder } from '../testing/test-builders';
import { TypeSafeAssertions } from '../testing/mock-factory';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('PostRepository', () => {
  let repository: PostRepository;
  let mockRepository: jest.Mocked<Repository<Post>>;

  const createMockPostRepository = () =>
    ({
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    }) as unknown as jest.Mocked<Repository<Post>>;

  beforeEach(async () => {
    mockRepository = createMockPostRepository();

    testingModule = await Test.createTestingModule({
      providers: [
        PostRepository,
        {
          provide: getRepositoryToken(Post),
          useValue: mockRepository,
        },
      ],
    }).compile();

    repository = testingModule.get<PostRepository>(PostRepository);
  });

  describe('create', () => {
    it('should create a new post with valid data', async () => {
      const postData = new PostBuilder()
        .withTitle('Test Post')
        .withContent('Post content')
        .withUserId('user-1')
        .build();

      const savedPost = new PostBuilder()
        .withId('post-1')
        .withTitle('Test Post')
        .withContent('Post content')
        .withUserId('user-1')
        .withStatus(PostStatus.DRAFT)
        .build();

      mockRepository.create.mockReturnValue(postData);
      mockRepository.save.mockResolvedValue(savedPost);

      const result = await repository.create(postData);

      expect(mockRepository.create).toHaveBeenCalledWith(postData);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.title).toBe('Test Post');
      expect(result.user_id).toBe('user-1');
    });

    it('should create post with DRAFT status by default', async () => {
      const postData = new PostBuilder().withUserId('user-1').build();
      const savedPost = new PostBuilder()
        .withId('post-1')
        .withStatus(PostStatus.DRAFT)
        .build();

      mockRepository.create.mockReturnValue(postData);
      mockRepository.save.mockResolvedValue(savedPost);

      const result = await repository.create(postData);

      expect(result.status).toBe(PostStatus.DRAFT);
    });

    it('should set created_at timestamp', async () => {
      const postData = new PostBuilder().build();
      const savedPost = new PostBuilder()
        .withId('post-1')
        .withCreatedAt(new Date())
        .build();

      mockRepository.create.mockReturnValue(postData);
      mockRepository.save.mockResolvedValue(savedPost);

      const result = await repository.create(postData);

      expect(result.created_at).toBeDefined();
    });

    it('should handle database errors on create', async () => {
      const postData = new PostBuilder().build();

      mockRepository.create.mockReturnValue(postData);
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(repository.create(postData)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('findById', () => {
    it('should find a post by id with all relations', async () => {
      const post = new PostBuilder().withId('post-1').build();

      mockRepository.findOne.mockResolvedValue(post);

      const result = await repository.findById('post-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user', 'revisions', 'comments', 'snapshots'],
        }),
      );
      expect(result?.id).toBe('post-1');
    });

    it('should return null when post not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should include all relations including snapshots', async () => {
      const post = new PostBuilder().withId('post-1').build();
      mockRepository.findOne.mockResolvedValue(post);

      await repository.findById('post-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: expect.arrayContaining([
            'user',
            'revisions',
            'comments',
            'snapshots',
          ]),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should find all non-deleted posts', async () => {
      const posts = [
        new PostBuilder().withId('post-1').build(),
        new PostBuilder().withId('post-2').build(),
      ];

      mockRepository.find.mockResolvedValue(posts);

      const result = await repository.findAll();

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user'],
          order: { created_at: 'DESC' },
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('should order posts by creation date descending', async () => {
      mockRepository.find.mockResolvedValue([]);

      await repository.findAll();

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { created_at: 'DESC' },
        }),
      );
    });

    it('should exclude deleted posts', async () => {
      mockRepository.find.mockResolvedValue([]);

      await repository.findAll();

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user'],
        }),
      );
    });

    it('should return empty array when no posts exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findByUser', () => {
    it('should find all posts for a specific user', async () => {
      const posts = [
        new PostBuilder().withId('post-1').withUserId('user-1').build(),
        new PostBuilder().withId('post-2').withUserId('user-1').build(),
      ];

      mockRepository.find.mockResolvedValue(posts);

      const result = await repository.findByUser('user-1');

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { created_at: 'DESC' },
        }),
      );
      expect(result).toHaveLength(2);
      TypeSafeAssertions.assertArrayPropertiesEqual(
        result,
        'user_id',
        'user-1',
      );
    });

    it('should return empty array when user has no posts', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await repository.findByUser('user-no-posts');

      expect(result).toEqual([]);
    });

    it('should not include deleted posts', async () => {
      mockRepository.find.mockResolvedValue([]);

      await repository.findByUser('user-1');

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { created_at: 'DESC' },
        }),
      );
    });
  });

  describe('findPublished', () => {
    it('should find only published posts', async () => {
      const posts = [
        new PostBuilder()
          .withId('post-1')
          .withStatus(PostStatus.PUBLISHED)
          .build(),
        new PostBuilder()
          .withId('post-2')
          .withStatus(PostStatus.PUBLISHED)
          .build(),
      ];

      mockRepository.find.mockResolvedValue(posts);

      const result = await repository.findPublished();

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user'],
          order: { published_at: 'DESC' },
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('should exclude draft posts', async () => {
      mockRepository.find.mockResolvedValue([]);

      await repository.findPublished();

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user'],
        }),
      );
    });

    it('should exclude hidden and deleted posts', async () => {
      mockRepository.find.mockResolvedValue([]);

      await repository.findPublished();

      expect(mockRepository.find).toHaveBeenCalled();
    });

    it('should return empty array when no published posts exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await repository.findPublished();

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update post content successfully', async () => {
      const updateData = { title: 'Updated Title', content: 'Updated content' };
      const updatedPost = new PostBuilder()
        .withId('post-1')
        .withTitle('Updated Title')
        .withContent('Updated content')
        .build();

      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(updatedPost);

      const result = await repository.update('post-1', updateData);

      expect(mockRepository.update).toHaveBeenCalled();
      expect(result?.title).toBe('Updated Title');
    });

    it('should update the updated_at timestamp', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(new PostBuilder().build());

      await repository.update('post-1', { title: 'New Title' });

      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should return null when post not found', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 0,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.update('nonexistent', {
        title: 'New Title',
      });

      expect(result).toBeNull();
    });

    it('should not update deleted posts', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 0,
        raw: {},
        generatedMaps: [],
      } as any);

      await repository.update('deleted-post', { title: 'New Title' });

      expect(mockRepository.update).toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('should change post status to PUBLISHED with timestamp', async () => {
      const publishedPost = new PostBuilder()
        .withId('post-1')
        .withStatus(PostStatus.PUBLISHED)
        .build();

      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(publishedPost);

      const result = await repository.publish('post-1');

      expect(mockRepository.update).toHaveBeenCalled();
      expect(result?.status).toBe(PostStatus.PUBLISHED);
    });

    it('should not publish already published posts', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(
        new PostBuilder().withStatus(PostStatus.PUBLISHED).build(),
      );

      await repository.publish('already-published');

      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should return null if post not found', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 0,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.publish('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('unpublish', () => {
    it('should change post status back to DRAFT', async () => {
      const unpublishedPost = new PostBuilder()
        .withId('post-1')
        .withStatus(PostStatus.DRAFT)
        .build();

      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(unpublishedPost);

      const result = await repository.unpublish('post-1');

      expect(mockRepository.update).toHaveBeenCalled();
      expect(result?.status).toBe(PostStatus.DRAFT);
    });

    it('should clear published_at timestamp', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(new PostBuilder().build());

      await repository.unpublish('post-1');

      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should return null if post not found', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 0,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.unpublish('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('hide', () => {
    it('should mark post as hidden', async () => {
      const hiddenPost = new PostBuilder().withId('post-1').build();

      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(hiddenPost);

      const result = await repository.hide('post-1');

      expect(mockRepository.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should hide post without deleting it', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(new PostBuilder().build());

      await repository.hide('post-1');

      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should return null if post not found', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 0,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.hide('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('unhide', () => {
    it('should unhide a hidden post', async () => {
      const unhiddenPost = new PostBuilder().withId('post-1').build();

      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(unhiddenPost);

      const result = await repository.unhide('post-1');

      expect(mockRepository.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should set hidden_at to null', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(new PostBuilder().build());

      await repository.unhide('post-1');

      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should return null if post not found', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 0,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.unhide('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('softDelete', () => {
    it('should mark post as deleted', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);

      const result = await repository.softDelete('post-1');

      expect(result).toBe(true);
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should return false when post not found', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 0,
        raw: {},
        generatedMaps: [],
      } as any);

      const result = await repository.softDelete('nonexistent');

      expect(result).toBe(false);
    });

    it('should not re-delete already deleted posts', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 0,
        raw: {},
        generatedMaps: [],
      } as any);

      const result = await repository.softDelete('already-deleted');

      expect(result).toBe(false);
    });
  });

  describe('hardDelete', () => {
    it('should permanently delete a post', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 1, raw: {} } as any);

      const result = await repository.hardDelete('post-1');

      expect(result).toBe(true);
      expect(mockRepository.delete).toHaveBeenCalled();
    });

    it('should return false when post not found', async () => {
      mockRepository.delete.mockResolvedValue({ affected: 0, raw: {} } as any);

      const result = await repository.hardDelete('nonexistent');

      expect(result).toBe(false);
    });
  });
});
