import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentRepository } from '../repositories/comment.repository';
import { PostRepository } from '../repositories/post.repository';
import { CommentReportRepository } from '../repositories/comment-report.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { PostStatus } from '../entities/post.entity';
import { AuditAction, AuditEntityType } from '../entities/audit-log.entity';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

/**
 * CommentsService - Error Path & Branch Coverage Tests
 * Focus: validation failures, permission checks, repository errors, cascading failures
 */
describe('CommentsService - Error Paths & Branch Coverage', () => {
  let service: CommentsService;
  let commentRepository: jest.Mocked<CommentRepository>;
  let postRepository: jest.Mocked<PostRepository>;
  let commentReportRepository: jest.Mocked<CommentReportRepository>;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;

  beforeEach(async () => {
    jest.clearAllMocks();

    commentRepository = {
      findByPost: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      softDelete: jest.fn(),
      hide: jest.fn(),
      unhide: jest.fn(),
      findByUser: jest.fn(),
      findReports: jest.fn(),
    } as any;

    postRepository = {
      findById: jest.fn(),
      findByUser: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    commentReportRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByComment: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    auditLogRepository = {
      createAuditLog: jest.fn(),
      getAuditLogs: jest.fn(),
    } as any;

    testingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: CommentRepository, useValue: commentRepository },
        { provide: PostRepository, useValue: postRepository },
        { provide: CommentReportRepository, useValue: commentReportRepository },
        { provide: AuditLogRepository, useValue: auditLogRepository },
      ],
    }).compile();

    service = testingModule.get<CommentsService>(CommentsService);
  });

  describe('getCommentsByPost - Error Paths', () => {
    it('should throw NotFoundException when post does not exist', async () => {
      postRepository.findById.mockResolvedValueOnce(null);

      await expect(service.getCommentsByPost('nonexistent-post')).rejects.toThrow(NotFoundException);
      await expect(service.getCommentsByPost('nonexistent-post')).rejects.toThrow('Post with ID nonexistent-post not found');
    });

    it('should return empty array when post exists but has no comments', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      } as any);
      commentRepository.findByPost.mockResolvedValueOnce([]);

      const result = await service.getCommentsByPost('post-1');

      expect(result).toEqual([]);
      expect(commentRepository.findByPost).toHaveBeenCalledWith('post-1');
    });

    it('should handle repository error when fetching post', async () => {
      postRepository.findById.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(service.getCommentsByPost('post-1')).rejects.toThrow('Database connection failed');
    });

    it('should handle repository error when fetching comments', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      } as any);
      commentRepository.findByPost.mockRejectedValueOnce(new Error('Query timeout'));

      await expect(service.getCommentsByPost('post-1')).rejects.toThrow('Query timeout');
    });
  });

  describe('createComment - Validation Errors', () => {
    it('should throw NotFoundException when post does not exist', async () => {
      postRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.createComment('user-1', {
          post_id: 'nonexistent-post',
          content: 'Test comment',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when commenting on unpublished post by other user', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.DRAFT,
        user_id: 'other-user',
      } as any);

      await expect(
        service.createComment('user-1', {
          post_id: 'post-1',
          content: 'Not allowed',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when post is locked', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
        locked_at: new Date(),
      } as any);

      await expect(
        service.createComment('user-1', {
          post_id: 'post-1',
          content: 'Not allowed when locked',
        }),
      ).rejects.toThrow('Post is locked');
    });

    it('should allow owner to comment on their own draft posts', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.DRAFT,
        user_id: 'user-1',
      } as any);
      commentRepository.create.mockResolvedValueOnce({
        id: 'new-comment',
        post_id: 'post-1',
        user_id: 'user-1',
        content: 'My comment',
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce(undefined);

      const result = await service.createComment('user-1', {
        post_id: 'post-1',
        content: 'My comment',
      });

      expect(result.id).toBe('new-comment');
      expect(auditLogRepository.createAuditLog).toHaveBeenCalled();
    });

    it('should throw NotFoundException when parent comment does not exist', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      } as any);
      commentRepository.findById.mockResolvedValueOnce(null); // Parent not found

      await expect(
        service.createComment('user-1', {
          post_id: 'post-1',
          content: 'Reply',
          parent_id: 'nonexistent-parent',
        }),
      ).rejects.toThrow('Parent comment');
    });

    it('should throw ForbiddenException when parent belongs to different post', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      } as any);
      commentRepository.findById.mockResolvedValueOnce({
        id: 'parent-comment',
        post_id: 'different-post',
      } as any);

      await expect(
        service.createComment('user-1', {
          post_id: 'post-1',
          content: 'Reply',
          parent_id: 'parent-comment',
        }),
      ).rejects.toThrow('different post');
    });
  });

  describe('createComment - Audit Logging Failures', () => {
    it('should handle audit log failure gracefully', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      } as any);
      commentRepository.create.mockResolvedValueOnce({
        id: 'comment-1',
        post_id: 'post-1',
        user_id: 'user-1',
        content: 'Test',
      } as any);
      auditLogRepository.createAuditLog.mockRejectedValueOnce(new Error('Audit logging failed'));

      await expect(
        service.createComment('user-1', {
          post_id: 'post-1',
          content: 'Test',
        }),
      ).rejects.toThrow('Audit logging failed');
    });

    it('should handle repository create failure', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      } as any);
      commentRepository.create.mockRejectedValueOnce(new Error('Create failed'));

      await expect(
        service.createComment('user-1', {
          post_id: 'post-1',
          content: 'Test',
        }),
      ).rejects.toThrow('Create failed');
    });
  });

  describe('updateComment - Authorization & Permission Errors', () => {
    it('should throw NotFoundException when comment does not exist', async () => {
      commentRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.updateComment('nonexistent-comment', 'user-1', { content: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not the comment owner', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'other-user',
        post_id: 'post-1',
      } as any);

      await expect(
        service.updateComment('comment-1', 'user-1', { content: 'Updated' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow owner to update their comment', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'user-1',
        post_id: 'post-1',
        content: 'Original',
      } as any);
      commentRepository.update.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'user-1',
        content: 'Updated',
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce(undefined);

      const result = await service.updateComment('comment-1', 'user-1', { content: 'Updated' });

      expect(result.content).toBe('Updated');
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.UPDATE,
          entity_type: AuditEntityType.COMMENT,
        }),
      );
    });

    it('should handle update repository failure', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'user-1',
        post_id: 'post-1',
      } as any);
      commentRepository.update.mockRejectedValueOnce(new Error('Update failed'));

      await expect(
        service.updateComment('comment-1', 'user-1', { content: 'Updated' }),
      ).rejects.toThrow('Update failed');
    });
  });

  describe('deleteComment - Authorization & Permission Errors', () => {
    it('should throw NotFoundException when comment does not exist', async () => {
      commentRepository.findById.mockResolvedValueOnce(null);

      await expect(service.deleteComment('nonexistent-comment', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when user is not the comment or post owner', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'other-user',
        post_id: 'post-1',
      } as any);
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        user_id: 'different-user',
      } as any);

      await expect(service.deleteComment('comment-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should allow comment owner to delete their comment', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'user-1',
        post_id: 'post-1',
      } as any);
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        user_id: 'other-user',
      } as any);
      commentRepository.softDelete.mockResolvedValueOnce(true);
      auditLogRepository.createAuditLog.mockResolvedValueOnce(undefined);

      const result = await service.deleteComment('comment-1', 'user-1');

      expect(result).toBe(true);
      expect(auditLogRepository.createAuditLog).toHaveBeenCalled();
    });

    it('should allow post owner to delete comments on their post', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'other-user',
        post_id: 'post-1',
      } as any);
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        user_id: 'user-1', // Post owner can delete
      } as any);
      commentRepository.softDelete.mockResolvedValueOnce(true);
      auditLogRepository.createAuditLog.mockResolvedValueOnce(undefined);

      const result = await service.deleteComment('comment-1', 'user-1');

      expect(result).toBe(true);
    });

    it('should handle softDelete repository failure', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'user-1',
        post_id: 'post-1',
      } as any);
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        user_id: 'other-user',
      } as any);
      commentRepository.softDelete.mockRejectedValueOnce(new Error('Delete failed'));

      await expect(service.deleteComment('comment-1', 'user-1')).rejects.toThrow('Delete failed');
    });
  });

  describe('reportComment - Validation & Permission Errors', () => {
    it('should throw NotFoundException when comment does not exist', async () => {
      commentRepository.findById.mockResolvedValueOnce(null);

      await expect(service.reportComment('nonexistent', 'user-1', { reason: 'Spam', description: 'Spam' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should create report for any comment', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'other-user',
      } as any);
      commentReportRepository.create.mockResolvedValueOnce({
        id: 'report-1',
        comment_id: 'comment-1',
        user_id: 'user-1',
        status: 'pending',
      } as any);

      const result = await service.reportComment('comment-1', 'user-1', {
        reason: 'Spam',
        description: 'This is spam',
      });

      expect(result.id).toBe('report-1');
      expect(commentReportRepository.create).toHaveBeenCalled();
    });

    it('should handle report creation failure', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'other-user',
      } as any);
      commentReportRepository.create.mockRejectedValueOnce(new Error('Report creation failed'));

      await expect(
        service.reportComment('comment-1', 'user-1', {
          reason: 'Spam',
          description: 'Spam',
        }),
      ).rejects.toThrow('Report creation failed');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent comment creation on same post', async () => {
      const mockPost = {
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      } as any;

      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.create.mockResolvedValueOnce({
        id: 'comment-1',
        post_id: 'post-1',
        user_id: 'user-1',
        content: 'Comment 1',
      } as any);
      commentRepository.create.mockResolvedValueOnce({
        id: 'comment-2',
        post_id: 'post-1',
        user_id: 'user-2',
        content: 'Comment 2',
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValue(undefined);

      const promise1 = service.createComment('user-1', {
        post_id: 'post-1',
        content: 'Comment 1',
      });
      const promise2 = service.createComment('user-2', {
        post_id: 'post-1',
        content: 'Comment 2',
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1.id).toBe('comment-1');
      expect(result2.id).toBe('comment-2');
      expect(postRepository.findById).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent updates to same comment', async () => {
      commentRepository.findById.mockResolvedValue({
        id: 'comment-1',
        user_id: 'user-1',
        post_id: 'post-1',
        content: 'Original',
      } as any);
      commentRepository.update
        .mockResolvedValueOnce({
          id: 'comment-1',
          content: 'Updated 1',
        } as any)
        .mockResolvedValueOnce({
          id: 'comment-1',
          content: 'Updated 2',
        } as any);
      auditLogRepository.createAuditLog.mockResolvedValue(undefined);

      // Note: In real scenario, second update might fail due to version conflict
      const promise1 = service.updateComment('comment-1', 'user-1', { content: 'Updated 1' });
      const promise2 = service.updateComment('comment-1', 'user-1', { content: 'Updated 2' });

      const results = await Promise.all([promise1, promise2]);

      expect(results).toHaveLength(2);
      expect(commentRepository.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases & Boundary Conditions', () => {
    it('should handle empty content in update', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'user-1',
        post_id: 'post-1',
        content: 'Original',
      } as any);
      commentRepository.update.mockResolvedValueOnce({
        id: 'comment-1',
        content: 'Original', // Content unchanged if empty update
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce(undefined);

      const result = await service.updateComment('comment-1', 'user-1', { content: '' });

      expect(result.id).toBe('comment-1');
    });

    it('should handle very long comment content', async () => {
      const longContent = 'x'.repeat(50000);
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      } as any);
      commentRepository.create.mockResolvedValueOnce({
        id: 'comment-1',
        post_id: 'post-1',
        user_id: 'user-1',
        content: longContent,
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce(undefined);

      const result = await service.createComment('user-1', {
        post_id: 'post-1',
        content: longContent,
      });

      expect(result.content.length).toBe(50000);
    });

    it('should handle special characters in content', async () => {
      const specialContent = '😀 <script>alert("xss")</script> SQL: DROP TABLE; \n\r\t';
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      } as any);
      commentRepository.create.mockResolvedValueOnce({
        id: 'comment-1',
        post_id: 'post-1',
        user_id: 'user-1',
        content: specialContent,
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce(undefined);

      const result = await service.createComment('user-1', {
        post_id: 'post-1',
        content: specialContent,
      });

      expect(result.content).toBe(specialContent);
    });

    it('should handle null parent_id in replies', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      } as any);
      commentRepository.create.mockResolvedValueOnce({
        id: 'comment-1',
        post_id: 'post-1',
        user_id: 'user-1',
        content: 'Top-level comment',
        parent_id: undefined,
      } as any);
      auditLogRepository.createAuditLog.mockResolvedValueOnce(undefined);

      const result = await service.createComment('user-1', {
        post_id: 'post-1',
        content: 'Top-level comment',
      });

      expect(result.parent_id).toBeUndefined();
    });
  });

  describe('Repository Failure Recovery', () => {
    it('should handle intermittent post repository failures', async () => {
      // First call fails, retry succeeds
      postRepository.findById
        .mockRejectedValueOnce(new Error('Connection timeout'))
        .mockResolvedValueOnce({
          id: 'post-1',
          status: PostStatus.PUBLISHED,
        } as any);

      // First attempt fails
      await expect(
        service.getCommentsByPost('post-1'),
      ).rejects.toThrow('Connection timeout');

      // Second attempt succeeds
      commentRepository.findByPost.mockResolvedValueOnce([]);
      const result = await service.getCommentsByPost('post-1');
      expect(result).toEqual([]);
    });

    it('should handle consecutive repository failures', async () => {
      postRepository.findById.mockRejectedValue(new Error('Persistent failure'));

      const attempt1 = service.getCommentsByPost('post-1');
      const attempt2 = service.getCommentsByPost('post-1');

      await expect(attempt1).rejects.toThrow('Persistent failure');
      await expect(attempt2).rejects.toThrow('Persistent failure');
      expect(postRepository.findById).toHaveBeenCalledTimes(2);
    });
  });
});
