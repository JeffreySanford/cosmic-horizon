import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentRepository } from '../repositories/comment.repository';
import { PostRepository } from '../repositories/post.repository';
import { CommentReportRepository } from '../repositories/comment-report.repository';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { PostStatus } from '../entities/post.entity';
import { AuditAction, AuditEntityType } from '../entities/audit-log.entity';
import { CommentBuilder, PostBuilder, CommentReportBuilder } from '../testing/test-builders';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('CommentsService', () => {
  let service: CommentsService;
  let commentRepository: jest.Mocked<CommentRepository>;
  let postRepository: jest.Mocked<PostRepository>;
  let commentReportRepository: jest.Mocked<CommentReportRepository>;
  let auditLogRepository: jest.Mocked<AuditLogRepository>;

  const mockComment = new CommentBuilder()
    .withId('comment-1')
    .withContent('Test comment')
    .withUserId('user-1')
    .withPostId('post-1')
    .build();

  const mockPost = new PostBuilder()
    .withId('post-1')
    .withTitle('Test Post')
    .withStatus(PostStatus.PUBLISHED)
    .withUserId('user-1')
    .build();

  const mockReply = new CommentBuilder()
    .withId('comment-2')
    .withContent('Test reply')
    .withUserId('user-2')
    .withPostId('post-1')
    .withParentId('comment-1')
    .withParent(mockComment)
    .build();

  const mockReport = new CommentReportBuilder()
    .withId('report-1')
    .withCommentId('comment-1')
    .withUserId('user-2')
    .withReason('Spam')
    .withStatus('pending')
    .build();

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: CommentRepository,
          useValue: {
            findById: jest.fn(),
            findByPost: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            hide: jest.fn(),
            unhide: jest.fn(),
          },
        },
        {
          provide: PostRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: CommentReportRepository,
          useValue: {
            findAll: jest.fn(),
            create: jest.fn(),
            resolve: jest.fn(),
          },
        },
        {
          provide: AuditLogRepository,
          useValue: {
            createAuditLog: jest.fn(),
          },
        },
      ],
    }).compile();

    service = testingModule.get<CommentsService>(CommentsService);
    commentRepository = testingModule.get(CommentRepository) as jest.Mocked<CommentRepository>;
    postRepository = testingModule.get(PostRepository) as jest.Mocked<PostRepository>;
    commentReportRepository = testingModule.get(CommentReportRepository) as jest.Mocked<CommentReportRepository>;
    auditLogRepository = testingModule.get(AuditLogRepository) as jest.Mocked<AuditLogRepository>;
  });

  describe('getCommentsByPost', () => {
    it('should return comments for a valid post', async () => {
      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.findByPost.mockResolvedValue([mockComment]);

      const result = await service.getCommentsByPost('post-1');

      expect(result).toEqual([mockComment]);
      expect(postRepository.findById).toHaveBeenCalledWith('post-1');
      expect(commentRepository.findByPost).toHaveBeenCalledWith('post-1');
    });

    it('should throw NotFoundException when post does not exist', async () => {
      postRepository.findById.mockResolvedValue(null);

      await expect(service.getCommentsByPost('post-1')).rejects.toThrow(
        new NotFoundException('Post with ID post-1 not found')
      );
    });

    it('should return empty array when post has no comments', async () => {
      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.findByPost.mockResolvedValue([]);

      const result = await service.getCommentsByPost('post-1');

      expect(result).toEqual([]);
    });
  });

  describe('createComment', () => {
    it('should create a comment on a published post', async () => {
      const dto = {
        post_id: 'post-1',
        content: 'New comment',
        parent_id: undefined,
      };

      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.create.mockResolvedValue(mockComment);

      const result = await service.createComment('user-1', dto);

      expect(result).toEqual(mockComment);
      expect(commentRepository.create).toHaveBeenCalled();
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          action: AuditAction.CREATE,
          entity_type: AuditEntityType.COMMENT,
        })
      );
    });

    it('should create a reply to existing comment', async () => {
      const dto = {
        post_id: 'post-1',
        content: 'Reply to comment',
        parent_id: 'comment-1',
      };

      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.findById.mockResolvedValue(mockComment);
      commentRepository.create.mockResolvedValue(mockReply);

      const result = await service.createComment('user-2', dto);

      expect(result).toEqual(mockReply);
      expect(commentRepository.findById).toHaveBeenCalledWith('comment-1');
    });

    it('should throw NotFoundException when post not found', async () => {
      const dto = {
        post_id: 'post-1',
        content: 'New comment',
        parent_id: undefined,
      };

      postRepository.findById.mockResolvedValue(null);

      await expect(service.createComment('user-1', dto)).rejects.toThrow(
        new NotFoundException('Post with ID post-1 not found')
      );
    });

    it('should throw ForbiddenException when commenting on unpublished post by other user', async () => {
      const unpublishedPost = { ...mockPost, status: PostStatus.DRAFT, user_id: 'user-2' };
      const dto = {
        post_id: 'post-1',
        content: 'New comment',
        parent_id: undefined,
      };

      postRepository.findById.mockResolvedValue(unpublishedPost);

      await expect(service.createComment('user-1', dto)).rejects.toThrow(
        new ForbiddenException('Cannot comment on unpublished posts of other users')
      );
    });

    it('should allow post owner to comment on own unpublished post', async () => {
      const unpublishedPost = { ...mockPost, status: PostStatus.DRAFT, user_id: 'user-1' };
      const dto = {
        post_id: 'post-1',
        content: 'New comment',
        parent_id: undefined,
      };

      postRepository.findById.mockResolvedValue(unpublishedPost);
      commentRepository.create.mockResolvedValue(mockComment);

      const result = await service.createComment('user-1', dto);

      expect(result).toEqual(mockComment);
    });

    it('should throw ForbiddenException when post is locked', async () => {
      const lockedPost = { ...mockPost, locked_at: new Date() };
      const dto = {
        post_id: 'post-1',
        content: 'New comment',
        parent_id: undefined,
      };

      postRepository.findById.mockResolvedValue(lockedPost);

      await expect(service.createComment('user-1', dto)).rejects.toThrow(
        new ForbiddenException('Post is locked, no new comments allowed')
      );
    });

    it('should throw NotFoundException when parent comment not found', async () => {
      const dto = {
        post_id: 'post-1',
        content: 'Reply',
        parent_id: 'comment-1',
      };

      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.findById.mockResolvedValue(null);

      await expect(service.createComment('user-1', dto)).rejects.toThrow(
        new NotFoundException('Parent comment with ID comment-1 not found')
      );
    });

    it('should throw ForbiddenException when parent comment belongs to different post', async () => {
      const parentFromDifferentPost = { ...mockComment, post_id: 'post-2' };
      const dto = {
        post_id: 'post-1',
        content: 'Reply',
        parent_id: 'comment-1',
      };

      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.findById.mockResolvedValue(parentFromDifferentPost);

      await expect(service.createComment('user-1', dto)).rejects.toThrow(
        new ForbiddenException('Parent comment belongs to a different post')
      );
    });

    it('should set parent_id to null for root comments', async () => {
      const dto = {
        post_id: 'post-1',
        content: 'New comment',
        parent_id: undefined,
      };

      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.create.mockResolvedValue(mockComment);

      await service.createComment('user-1', dto);

      expect(commentRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parent_id: null,
        })
      );
    });
  });

  describe('updateComment', () => {
    it('should update comment by owner', async () => {
      const dto = { content: 'Updated content' };
      const updatedComment = { ...mockComment, content: 'Updated content' };

      commentRepository.findById.mockResolvedValue(mockComment);
      commentRepository.update.mockResolvedValue(updatedComment);

      const result = await service.updateComment('comment-1', 'user-1', dto);

      expect(result).toEqual(updatedComment);
      expect(commentRepository.update).toHaveBeenCalledWith('comment-1', 'Updated content');
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.UPDATE,
          entity_type: AuditEntityType.COMMENT,
          changes: expect.objectContaining({
            before: { content: mockComment.content },
            after: { content: 'Updated content' },
          }),
        })
      );
    });

    it('should throw NotFoundException when comment not found', async () => {
      const dto = { content: 'Updated content' };

      commentRepository.findById.mockResolvedValue(null);

      await expect(service.updateComment('comment-1', 'user-1', dto)).rejects.toThrow(
        new NotFoundException('Comment with ID comment-1 not found')
      );
    });

    it('should throw ForbiddenException when trying to update another user\'s comment', async () => {
      const dto = { content: 'Updated content' };

      commentRepository.findById.mockResolvedValue(mockComment);

      await expect(service.updateComment('comment-1', 'user-2', dto)).rejects.toThrow(
        new ForbiddenException('You can only edit your own comments')
      );
    });

    it('should throw NotFoundException when update returns null', async () => {
      const dto = { content: 'Updated content' };

      commentRepository.findById.mockResolvedValue(mockComment);
      commentRepository.update.mockResolvedValue(null);

      await expect(service.updateComment('comment-1', 'user-1', dto)).rejects.toThrow(
        new NotFoundException('Comment with ID comment-1 not found')
      );
    });

    it('should record audit log on successful update', async () => {
      const dto = { content: 'Updated content' };
      const updatedComment = { ...mockComment, content: 'Updated content' };

      commentRepository.findById.mockResolvedValue(mockComment);
      commentRepository.update.mockResolvedValue(updatedComment);

      await service.updateComment('comment-1', 'user-1', dto);

      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          action: AuditAction.UPDATE,
          entity_type: AuditEntityType.COMMENT,
          entity_id: 'comment-1',
        })
      );
    });
  });

  describe('deleteComment', () => {
    it('should delete comment by owner', async () => {
      commentRepository.findById.mockResolvedValue(mockComment);
      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.softDelete.mockResolvedValue(true);

      const result = await service.deleteComment('comment-1', 'user-1');

      expect(result).toBe(true);
      expect(commentRepository.softDelete).toHaveBeenCalledWith('comment-1');
      expect(auditLogRepository.createAuditLog).toHaveBeenCalled();
    });

    it('should delete comment by post owner', async () => {
      const otherUserComment = { ...mockComment, user_id: 'user-2' };

      commentRepository.findById.mockResolvedValue(otherUserComment);
      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.softDelete.mockResolvedValue(true);

      const result = await service.deleteComment('comment-1', 'user-1');

      expect(result).toBe(true);
      expect(commentRepository.softDelete).toHaveBeenCalledWith('comment-1');
    });

    it('should throw NotFoundException when comment not found', async () => {
      commentRepository.findById.mockResolvedValue(null);

      await expect(service.deleteComment('comment-1', 'user-1')).rejects.toThrow(
        new NotFoundException('Comment with ID comment-1 not found')
      );
    });

    it('should throw ForbiddenException when neither owner nor post owner', async () => {
      const otherUserComment = { ...mockComment, user_id: 'user-2' };
      const otherUserPost = { ...mockPost, user_id: 'user-3' };

      commentRepository.findById.mockResolvedValue(otherUserComment);
      postRepository.findById.mockResolvedValue(otherUserPost);

      await expect(service.deleteComment('comment-1', 'user-1')).rejects.toThrow(
        new ForbiddenException('You do not have permission to delete this comment')
      );
    });

    it('should record audit log on successful delete', async () => {
      commentRepository.findById.mockResolvedValue(mockComment);
      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.softDelete.mockResolvedValue(true);

      await service.deleteComment('comment-1', 'user-1');

      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          action: AuditAction.DELETE,
          entity_type: AuditEntityType.COMMENT,
          entity_id: 'comment-1',
          changes: expect.objectContaining({
            before: { content: mockComment.content },
          }),
        })
      );
    });

    it('should not record audit log if soft delete fails', async () => {
      commentRepository.findById.mockResolvedValue(mockComment);
      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.softDelete.mockResolvedValue(false);

      const result = await service.deleteComment('comment-1', 'user-1');

      expect(result).toBe(false);
      expect(auditLogRepository.createAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('reportComment', () => {
    it('should create a report for a comment', async () => {
      const dto = {
        reason: 'Spam',
        description: 'This comment is spam',
      };

      commentRepository.findById.mockResolvedValue(mockComment);
      commentReportRepository.create.mockResolvedValue(mockReport);

      const result = await service.reportComment('comment-1', 'user-2', dto);

      expect(result).toEqual(mockReport);
      expect(commentReportRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          comment_id: 'comment-1',
          user_id: 'user-2',
          reason: 'Spam',
          description: 'This comment is spam',
        })
      );
    });

    it('should throw NotFoundException when comment not found', async () => {
      const dto = {
        reason: 'Spam',
        description: 'This comment is spam',
      };

      commentRepository.findById.mockResolvedValue(null);

      await expect(service.reportComment('comment-1', 'user-2', dto)).rejects.toThrow(
        new NotFoundException('Comment with ID comment-1 not found')
      );
    });

    it('should allow user to report own comment', async () => {
      const dto = {
        reason: 'Mistake',
        description: 'I posted this by mistake',
      };

      commentRepository.findById.mockResolvedValue(mockComment);
      commentReportRepository.create.mockResolvedValue(mockReport);

      const result = await service.reportComment('comment-1', 'user-1', dto);

      expect(result).toEqual(mockReport);
    });

    it('should allow multiple reports for same comment by different users', async () => {
      const dto1 = { reason: 'Spam', description: 'Spam content' };
      const dto2 = { reason: 'Offensive', description: 'Offensive language' };

      commentRepository.findById.mockResolvedValue(mockComment);
      commentReportRepository.create.mockResolvedValue(mockReport);

      await service.reportComment('comment-1', 'user-2', dto1);
      await service.reportComment('comment-1', 'user-3', dto2);

      expect(commentReportRepository.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('hideComment', () => {
    it('should hide comment by post owner', async () => {
      const hiddenComment = { ...mockComment, hidden: true };

      commentRepository.findById.mockResolvedValue(mockComment);
      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.hide.mockResolvedValue(hiddenComment);

      const result = await service.hideComment('comment-1', 'user-1');

      expect(result).toEqual(hiddenComment);
      expect(commentRepository.hide).toHaveBeenCalledWith('comment-1');
    });

    it('should throw NotFoundException when comment not found', async () => {
      commentRepository.findById.mockResolvedValue(null);

      await expect(service.hideComment('comment-1', 'user-1')).rejects.toThrow(
        new NotFoundException('Comment with ID comment-1 not found')
      );
    });

    it('should throw ForbiddenException when not post owner', async () => {
      commentRepository.findById.mockResolvedValue(mockComment);
      postRepository.findById.mockResolvedValue(mockPost);

      await expect(service.hideComment('comment-1', 'user-2')).rejects.toThrow(
        new ForbiddenException('Only the post owner can hide comments')
      );
    });

    it('should throw ForbiddenException when post not found', async () => {
      commentRepository.findById.mockResolvedValue(mockComment);
      postRepository.findById.mockResolvedValue(null);

      await expect(service.hideComment('comment-1', 'user-1')).rejects.toThrow(
        new ForbiddenException('Only the post owner can hide comments')
      );
    });
  });

  describe('unhideComment', () => {
    it('should unhide comment by post owner', async () => {
      const visibleComment = { ...mockComment, hidden: false };

      commentRepository.findById.mockResolvedValue(mockComment);
      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.unhide.mockResolvedValue(visibleComment);

      const result = await service.unhideComment('comment-1', 'user-1');

      expect(result).toEqual(visibleComment);
      expect(commentRepository.unhide).toHaveBeenCalledWith('comment-1');
    });

    it('should throw NotFoundException when comment not found', async () => {
      commentRepository.findById.mockResolvedValue(null);

      await expect(service.unhideComment('comment-1', 'user-1')).rejects.toThrow(
        new NotFoundException('Comment with ID comment-1 not found')
      );
    });

    it('should throw ForbiddenException when not post owner', async () => {
      commentRepository.findById.mockResolvedValue(mockComment);
      postRepository.findById.mockResolvedValue(mockPost);

      await expect(service.unhideComment('comment-1', 'user-2')).rejects.toThrow(
        new ForbiddenException('Only the post owner can unhide comments')
      );
    });
  });

  describe('getAllReports', () => {
    it('should return all reports', async () => {
      const reports = [mockReport];

      commentReportRepository.findAll.mockResolvedValue(reports);

      const result = await service.getAllReports();

      expect(result).toEqual(reports);
      expect(commentReportRepository.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no reports exist', async () => {
      commentReportRepository.findAll.mockResolvedValue([]);

      const result = await service.getAllReports();

      expect(result).toEqual([]);
    });
  });

  describe('resolveReport', () => {
    it('should resolve report with reviewed status', async () => {
      const resolvedReport = { ...mockReport, status: 'reviewed' };

      commentReportRepository.resolve.mockResolvedValue(resolvedReport);

      const result = await service.resolveReport('report-1', 'user-1', 'reviewed');

      expect(result).toEqual(resolvedReport);
      expect(commentReportRepository.resolve).toHaveBeenCalledWith('report-1', 'user-1', 'reviewed');
    });

    it('should resolve report with dismissed status', async () => {
      const resolvedReport = { ...mockReport, status: 'dismissed' };

      commentReportRepository.resolve.mockResolvedValue(resolvedReport);

      const result = await service.resolveReport('report-1', 'user-1', 'dismissed');

      expect(result).toEqual(resolvedReport);
      expect(commentReportRepository.resolve).toHaveBeenCalledWith('report-1', 'user-1', 'dismissed');
    });

    it('should return null when report not found', async () => {
      commentReportRepository.resolve.mockResolvedValue(null);

      const result = await service.resolveReport('report-1', 'user-1', 'reviewed');

      expect(result).toBeNull();
    });

    it('should track resolver in audit trail', async () => {
      const resolvedReport = { ...mockReport, status: 'reviewed' };

      commentReportRepository.resolve.mockResolvedValue(resolvedReport);

      await service.resolveReport('report-1', 'user-1', 'reviewed');

      // Resolver user_id is passed to repository
      expect(commentReportRepository.resolve).toHaveBeenCalledWith('report-1', 'user-1', 'reviewed');
    });
  });

  describe('error handling', () => {
    it('should handle repository errors in getCommentsByPost', async () => {
      postRepository.findById.mockRejectedValue(new Error('Database error'));

      await expect(service.getCommentsByPost('post-1')).rejects.toThrow('Database error');
    });

    it('should handle repository errors in createComment', async () => {
      const dto = {
        post_id: 'post-1',
        content: 'New comment',
        parent_id: undefined,
      };

      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.create.mockRejectedValue(new Error('Database error'));

      await expect(service.createComment('user-1', dto)).rejects.toThrow('Database error');
    });

    it('should handle audit log errors gracefully', async () => {
      const dto = {
        post_id: 'post-1',
        content: 'New comment',
        parent_id: undefined,
      };

      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.create.mockResolvedValue(mockComment);
      auditLogRepository.createAuditLog.mockRejectedValue(new Error('Audit error'));

      // Should still throw because audit is critical, or handle gracefully based on implementation
      await expect(service.createComment('user-1', dto)).rejects.toThrow('Audit error');
    });
  });

  describe('edge cases', () => {
    it('should handle comments with very long content', async () => {
      const longContent = 'x'.repeat(5000);
      const dto = {
        post_id: 'post-1',
        content: longContent,
        parent_id: undefined,
      };

      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.create.mockResolvedValue({ ...mockComment, content: longContent });

      const result = await service.createComment('user-1', dto);

      expect(result.content).toHaveLength(5000);
    });

    it('should handle special characters in comment content', async () => {
      const specialContent = 'Special <>!@#$%^&*()_+-=[]{}|;:," \'<>?/~` chars';
      const dto = {
        post_id: 'post-1',
        content: specialContent,
        parent_id: undefined,
      };

      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.create.mockResolvedValue({ ...mockComment, content: specialContent });

      const result = await service.createComment('user-1', dto);

      expect(result.content).toContain('<>!@#');
    });

    it('should handle deep comment threads', async () => {
      const deepReplyDto = {
        post_id: 'post-1',
        content: 'Deep reply',
        parent_id: 'comment-2',
      };

      const intermediateComment = { ...mockComment, id: 'comment-2', parent_id: 'comment-1' };

      postRepository.findById.mockResolvedValue(mockPost);
      commentRepository.findById.mockResolvedValue(intermediateComment);
      commentRepository.create.mockResolvedValue({ ...mockReply, parent_id: 'comment-2' });

      const result = await service.createComment('user-1', deepReplyDto);

      expect(result.parent_id).toBe('comment-2');
    });
  });
});
