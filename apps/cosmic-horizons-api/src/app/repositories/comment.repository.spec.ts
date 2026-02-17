import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommentRepository } from './comment.repository';
import { Comment } from '../entities/comment.entity';
import { CommentBuilder } from '../testing/test-builders';
import { TypeSafeAssertions } from '../testing/mock-factory';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('CommentRepository', () => {
  let repository: CommentRepository;
  let mockRepository: jest.Mocked<Repository<Comment>>;

  const createMockCommentRepository = () =>
    ({
      find: jest.fn(),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    }) as unknown as jest.Mocked<Repository<Comment>>;

  beforeEach(async () => {
    mockRepository = createMockCommentRepository();

    testingModule = await Test.createTestingModule({
      providers: [
        CommentRepository,
        {
          provide: getRepositoryToken(Comment),
          useValue: mockRepository,
        },
      ],
    }).compile();

    repository = testingModule.get<CommentRepository>(CommentRepository);
  });

  describe('create', () => {
    it('should create a new comment with valid data', async () => {
      const commentData = new CommentBuilder()
        .withContent('Test comment')
        .withPostId('post-1')
        .withUserId('user-1')
        .build();

      const savedComment = new CommentBuilder()
        .withId('comment-1')
        .withContent('Test comment')
        .withPostId('post-1')
        .withUserId('user-1')
        .build();

      mockRepository.create.mockReturnValue(commentData);
      mockRepository.save.mockResolvedValue(savedComment);

      const result = await repository.create(commentData);

      expect(mockRepository.create).toHaveBeenCalledWith(commentData);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result.content).toBe('Test comment');
      expect(result.post_id).toBe('post-1');
    });

    it('should create a reply comment with parent_id', async () => {
      const replyData = new CommentBuilder()
        .withContent('Reply to comment')
        .withPostId('post-1')
        .withUserId('user-1')
        .withParentId('comment-0')
        .build();

      const savedReply = new CommentBuilder()
        .withId('comment-2')
        .withContent('Reply to comment')
        .withPostId('post-1')
        .withUserId('user-1')
        .withParentId('comment-0')
        .build();

      mockRepository.create.mockReturnValue(replyData);
      mockRepository.save.mockResolvedValue(savedReply);

      const result = await repository.create(replyData);

      expect(result.parent_id).toBe('comment-0');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should handle database errors on create', async () => {
      const commentData = new CommentBuilder().build();

      mockRepository.create.mockReturnValue(commentData);
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(repository.create(commentData)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('findById', () => {
    it('should find a comment by id with relations', async () => {
      const comment = new CommentBuilder().withId('comment-1').build();

      mockRepository.findOne.mockResolvedValue(comment);

      const result = await repository.findById('comment-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user', 'parent'],
        }),
      );
      expect(result?.id).toBe('comment-1');
    });

    it('should return null when comment not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('should not return deleted comments', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await repository.findById('deleted-comment');

      expect(mockRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user', 'parent'],
        }),
      );
    });

    it('should include user and parent relations', async () => {
      const comment = new CommentBuilder()
        .withId('comment-1')
        .withUserId('user-1')
        .withParentId('comment-0')
        .build();

      mockRepository.findOne.mockResolvedValue(comment);

      await repository.findById('comment-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user', 'parent'],
        }),
      );
    });
  });

  describe('findByPost', () => {
    it('should find all active comments for a post', async () => {
      const comments = [
        new CommentBuilder().withId('comment-1').withPostId('post-1').build(),
        new CommentBuilder().withId('comment-2').withPostId('post-1').build(),
      ];

      mockRepository.find.mockResolvedValue(comments);

      const result = await repository.findByPost('post-1');

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user'],
          order: { created_at: 'ASC' },
        }),
      );
      expect(result).toHaveLength(2);
      TypeSafeAssertions.assertArrayPropertiesEqual(
        result,
        'post_id',
        'post-1',
      );
    });

    it('should return empty array when post has no comments', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await repository.findByPost('post-no-comments');

      expect(result).toEqual([]);
    });

    it('should order comments by creation date ascending', async () => {
      const comments = [
        new CommentBuilder().withId('comment-1').withPostId('post-1').build(),
        new CommentBuilder().withId('comment-2').withPostId('post-1').build(),
      ];

      mockRepository.find.mockResolvedValue(comments);

      await repository.findByPost('post-1');

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { created_at: 'ASC' },
        }),
      );
    });

    it('should exclude deleted and hidden comments', async () => {
      mockRepository.find.mockResolvedValue([]);

      await repository.findByPost('post-1');

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          relations: ['user'],
        }),
      );
    });
  });

  describe('update', () => {
    it('should update comment content successfully', async () => {
      const updatedComment = new CommentBuilder()
        .withId('comment-1')
        .withContent('Updated content')
        .build();

      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(updatedComment);

      const result = await repository.update('comment-1', 'Updated content');

      expect(mockRepository.update).toHaveBeenCalled();
      expect(result?.content).toBe('Updated content');
    });

    it('should return null when updating non-existent comment', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 0,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.update('nonexistent', 'New content');

      expect(result).toBeNull();
    });

    it('should update the updated_at timestamp', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(new CommentBuilder().build());

      await repository.update('comment-1', 'New content');

      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should not update deleted comments', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 0,
        raw: {},
        generatedMaps: [],
      } as any);

      await repository.update('deleted-comment', 'New content');

      expect(mockRepository.update).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should mark comment as deleted', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);

      const result = await repository.softDelete('comment-1');

      expect(result).toBe(true);
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should return false when comment not found', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 0,
        raw: {},
        generatedMaps: [],
      } as any);

      const result = await repository.softDelete('nonexistent');

      expect(result).toBe(false);
    });

    it('should not re-delete already deleted comments', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 0,
        raw: {},
        generatedMaps: [],
      } as any);

      const result = await repository.softDelete('already-deleted');

      expect(result).toBe(false);
    });
  });

  describe('hide', () => {
    it('should hide a comment', async () => {
      const hiddenComment = new CommentBuilder()
        .withId('comment-1')
        .withContent('Hidden')
        .build();

      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(hiddenComment);

      const result = await repository.hide('comment-1');

      expect(mockRepository.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should hide comment without deleting it', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(new CommentBuilder().build());

      await repository.hide('comment-1');

      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should return null if comment not found', async () => {
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
    it('should unhide a hidden comment', async () => {
      const unHiddenComment = new CommentBuilder().withId('comment-1').build();

      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(unHiddenComment);

      const result = await repository.unhide('comment-1');

      expect(mockRepository.update).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should set hidden_at to null', async () => {
      mockRepository.update.mockResolvedValue({
        affected: 1,
        raw: {},
        generatedMaps: [],
      } as any);
      mockRepository.findOne.mockResolvedValue(new CommentBuilder().build());

      await repository.unhide('comment-1');

      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should return null if comment not found', async () => {
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
});
