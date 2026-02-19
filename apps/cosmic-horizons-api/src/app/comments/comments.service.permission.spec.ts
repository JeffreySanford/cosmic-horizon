import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentRepository } from '../repositories/comment.repository';
import { PostRepository } from '../repositories/post.repository';
import { CommentReportRepository } from '../repositories/comment-report.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { PostStatus } from '../entities/post.entity';

describe('CommentsService - Permission & Error Scenarios (Branch Coverage)', () => {
  let service: CommentsService;
  let commentRepository: any;
  let postRepository: any;
  let commentReportRepository: any;
  let auditLogRepository: any;

  beforeEach(() => {
    commentRepository = {
      findById: jest.fn(),
      findByPost: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      hide: jest.fn(),
      unhide: jest.fn(),
    };

    postRepository = {
      findById: jest.fn(),
      findAll: jest.fn(),
      findByUser: jest.fn(),
      findPublished: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      publish: jest.fn(),
      unpublish: jest.fn(),
      softDelete: jest.fn(),
      hide: jest.fn(),
      unhide: jest.fn(),
      hardDelete: jest.fn(),
      search: jest.fn(),
      lock: jest.fn(),
      unlock: jest.fn(),
    };

    commentReportRepository = {
      create: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      findPending: jest.fn(),
      findById: jest.fn(),
      resolve: jest.fn(),
    };

    auditLogRepository = {
      createAuditLog: jest.fn().mockResolvedValue(undefined),
    };

    service = new CommentsService(
      commentRepository as CommentRepository,
      postRepository as PostRepository,
      commentReportRepository as CommentReportRepository,
      auditLogRepository as AuditLogRepository,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Get Comments by Post', () => {
    it('should throw NotFoundException when post does not exist', async () => {
      postRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.getCommentsByPost('non-existent-post'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should return comments for existing post', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      } as any);

      commentRepository.findByPost.mockResolvedValueOnce([
        { id: 'comment-1', content: 'Great post!', user_id: 'user-1' },
      ] as any);

      const comments = await service.getCommentsByPost('post-1');

      expect(comments).toHaveLength(1);
      expect(comments[0].id).toBe('comment-1');
    });

    it('should handle database errors gracefully', async () => {
      postRepository.findById.mockRejectedValueOnce(
        new Error('Database connection failed'),
      );

      await expect(service.getCommentsByPost('post-1')).rejects.toThrow();
    });
  });

  describe('Create Comment - Authorization', () => {
    it('should reject comment creation on unpublished post by non-owner', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.DRAFT,
        user_id: 'owner-user',
      } as any);

      await expect(
        service.createComment('non-owner-user', {
          post_id: 'post-1',
          content: 'Comment text',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should allow comment creation on unpublished post by owner', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.DRAFT,
        user_id: 'owner-user',
      } as any);

      commentRepository.create.mockResolvedValueOnce({
        id: 'comment-1',
        content: 'Comment text',
        user_id: 'owner-user',
        post_id: 'post-1',
      } as any);

      const comment = await service.createComment('owner-user', {
        post_id: 'post-1',
        content: 'Comment text',
      });

      expect(comment.id).toBe('comment-1');
    });

    it('should reject comment on locked posts', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
        locked_at: new Date(),
      } as any);

      await expect(
        service.createComment('user-1', {
          post_id: 'post-1',
          content: 'Comment text',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should reject post not found', async () => {
      postRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.createComment('user-1', {
          post_id: 'non-existent',
          content: 'Comment text',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('Create Comment - Parent Comment Validation', () => {
    it('should reject parent comment on different post', async () => {
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
          parent_id: 'parent-comment',
          content: 'Reply text',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should reject non-existent parent comment', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      } as any);

      commentRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.createComment('user-1', {
          post_id: 'post-1',
          parent_id: 'non-existent-parent',
          content: 'Reply text',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should create reply to valid parent comment', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      } as any);

      commentRepository.findById.mockResolvedValueOnce({
        id: 'parent-comment',
        post_id: 'post-1',
      } as any);

      commentRepository.create.mockResolvedValueOnce({
        id: 'reply-1',
        content: 'Reply text',
        parent_id: 'parent-comment',
        post_id: 'post-1',
      } as any);

      const reply = await service.createComment('user-1', {
        post_id: 'post-1',
        parent_id: 'parent-comment',
        content: 'Reply text',
      });

      expect(reply.id).toBe('reply-1');
      expect(reply.parent_id).toBe('parent-comment');
    });
  });

  describe('Update Comment - Authorization', () => {
    it('should reject update from non-author', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'original-author',
        content: 'Original content',
      } as any);

      await expect(
        service.updateComment('comment-1', 'different-user', {
          content: 'Updated content',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should allow author to update own comment', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'author-user',
        content: 'Original content',
      } as any);

      commentRepository.update.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'author-user',
        content: 'Updated content',
      } as any);

      const updated = await service.updateComment('comment-1', 'author-user', {
        content: 'Updated content',
      });

      expect(updated.content).toBe('Updated content');
    });

    it('should reject update when comment not found', async () => {
      commentRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.updateComment('non-existent', 'user-1', {
          content: 'Content',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should handle update failure when comment no longer exists', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'author-user',
        content: 'Original',
      } as any);

      commentRepository.update.mockResolvedValueOnce(null);

      await expect(
        service.updateComment('comment-1', 'author-user', {
          content: 'New content',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('Delete Comment - Authorization', () => {
    it('should reject delete from unauthorized user', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'author-user',
        post_id: 'post-1',
      } as any);

      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        user_id: 'post-owner',
      } as any);

      await expect(
        service.deleteComment('comment-1', 'unauthorized-user'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should allow comment author to delete own comment', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'author-user',
        post_id: 'post-1',
        content: 'Comment content',
      } as any);

      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        user_id: 'post-owner',
      } as any);

      commentRepository.softDelete.mockResolvedValueOnce(true);

      const deleted = await service.deleteComment('comment-1', 'author-user');

      expect(deleted).toBe(true);
      expect(commentRepository.softDelete).toHaveBeenCalledWith('comment-1');
    });

    it('should allow post owner to delete any comment', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'comment-author',
        post_id: 'post-1',
        content: 'Comment content',
      } as any);

      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        user_id: 'post-owner',
      } as any);

      commentRepository.softDelete.mockResolvedValueOnce(true);

      const deleted = await service.deleteComment('comment-1', 'post-owner');

      expect(deleted).toBe(true);
    });

    it('should reject delete when comment not found', async () => {
      commentRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.deleteComment('non-existent', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should handle soft delete failure', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'author-user',
        post_id: 'post-1',
        content: 'Comment content',
      } as any);

      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        user_id: 'post-owner',
      } as any);

      commentRepository.softDelete.mockResolvedValueOnce(false);

      const deleted = await service.deleteComment('comment-1', 'author-user');

      expect(deleted).toBe(false);
      expect(auditLogRepository.createAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('Report Comment', () => {
    it('should create report for non-existent comment', async () => {
      commentRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.reportComment('non-existent', 'user-1', {
          reason: 'offensive',
          description: 'This is offensive',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should create report for existing comment', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        content: 'Problematic content',
      } as any);

      commentReportRepository.create.mockResolvedValueOnce({
        id: 'report-1',
        comment_id: 'comment-1',
        user_id: 'reporter-user',
        reason: 'offensive',
        description: 'This is offensive',
      } as any);

      const report = await service.reportComment('comment-1', 'reporter-user', {
        reason: 'offensive',
        description: 'This is offensive',
      });

      expect(report.id).toBe('report-1');
      expect(report.reason).toBe('offensive');
    });
  });

  describe('Hide/Unhide Comment', () => {
    it('should reject hide by non-post-owner', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        post_id: 'post-1',
      } as any);

      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        user_id: 'post-owner',
      } as any);

      await expect(
        service.hideComment('comment-1', 'unauthorized-user'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should allow post owner to hide comment', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        post_id: 'post-1',
        hidden_at: null,
      } as any);

      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        user_id: 'post-owner',
      } as any);

      commentRepository.hide.mockResolvedValueOnce({
        id: 'comment-1',
        post_id: 'post-1',
        hidden_at: new Date(),
      } as any);

      const hidden = await service.hideComment('comment-1', 'post-owner');

      expect(hidden?.id).toBe('comment-1');
      expect(hidden?.hidden_at).not.toBeNull();
    });

    it('should reject unhide by non-post-owner', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        post_id: 'post-1',
      } as any);

      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        user_id: 'post-owner',
      } as any);

      await expect(
        service.unhideComment('comment-1', 'unauthorized-user'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('should allow post owner to unhide comment', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        post_id: 'post-1',
        hidden_at: new Date(),
      } as any);

      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        user_id: 'post-owner',
      } as any);

      commentRepository.unhide.mockResolvedValueOnce({
        id: 'comment-1',
        post_id: 'post-1',
        hidden_at: null,
      } as any);

      const unhidden = await service.unhideComment('comment-1', 'post-owner');

      expect(unhidden?.id).toBe('comment-1');
      expect(unhidden?.hidden_at).toBeNull();
    });

    it('should reject hide when comment not found', async () => {
      commentRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.hideComment('non-existent', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should reject unhide when comment not found', async () => {
      commentRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.unhideComment('non-existent', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('should handle post not found when hiding', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        post_id: 'post-1',
      } as any);

      postRepository.findById.mockResolvedValueOnce(null);

      // Since post is not found, it shouldn't allow hiding (no post owner check passes)
      await expect(
        service.hideComment('comment-1', 'any-user'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('Report Management', () => {
    it('should retrieve all reports', async () => {
      commentReportRepository.findAll.mockResolvedValueOnce([
        { id: 'report-1', reason: 'offensive' },
        { id: 'report-2', reason: 'spam' },
      ] as any);

      const reports = await service.getAllReports();

      expect(reports).toHaveLength(2);
      expect(reports[0].reason).toBe('offensive');
    });

    it('should resolve report', async () => {
      const reportResult = {
        id: 'report-1',
        status: 'reviewed',
      };
      commentReportRepository.resolve?.mockResolvedValueOnce(
        reportResult as any,
      );

      const resolved = await service.resolveReport(
        'report-1',
        'moderator-user',
        'reviewed',
      );

      expect(resolved?.id).toBe('report-1');
      expect(resolved?.status).toBe('reviewed');
    });

    it('should handle resolve returning null', async () => {
      commentReportRepository.resolve.mockResolvedValueOnce(null);

      const result = await service.resolveReport(
        'non-existent',
        'moderator-user',
        'dismissed',
      );

      expect(result).toBeNull();
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log on comment creation failure', async () => {
      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        status: PostStatus.PUBLISHED,
      } as any);

      commentRepository.create.mockResolvedValueOnce({
        id: 'comment-1',
        content: 'Test comment',
        user_id: 'user-1',
        post_id: 'post-1',
      } as any);

      await service.createComment('user-1', {
        post_id: 'post-1',
        content: 'Test comment',
      });

      expect(auditLogRepository.createAuditLog).toHaveBeenCalled();
    });

    it('should not log audit when soft delete fails', async () => {
      commentRepository.findById.mockResolvedValueOnce({
        id: 'comment-1',
        user_id: 'author-user',
        post_id: 'post-1',
      } as any);

      postRepository.findById.mockResolvedValueOnce({
        id: 'post-1',
        user_id: 'post-owner',
      } as any);

      commentRepository.softDelete.mockResolvedValueOnce(false);

      await service.deleteComment('comment-1', 'author-user');

      expect(auditLogRepository.createAuditLog).not.toHaveBeenCalled();
    });
  });
});
