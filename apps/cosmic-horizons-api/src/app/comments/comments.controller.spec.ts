import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CommentBuilder, CommentReportBuilder } from '../testing/test-builders';
import type { AuthenticatedRequest } from '../types/http.types';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('CommentsController', () => {
  let controller: CommentsController;
  let service: jest.Mocked<CommentsService>;

  const mockComment = new CommentBuilder()
    .withId('comment-1')
    .withContent('Test comment')
    .withUserId('user-1')
    .withPostId('post-1')
    .build();

  const mockReport = new CommentReportBuilder()
    .withId('report-1')
    .withCommentId('comment-1')
    .withUserId('user-2')
    .withReason('Spam')
    .withStatus('pending')
    .build();

  const mockAdminUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    role: 'admin',
  };

  const mockModeratorUser = {
    id: 'mod-1',
    email: 'mod@example.com',
    role: 'moderator',
  };

  const mockRegularUser = {
    id: 'user-1',
    email: 'user@example.com',
    role: 'user',
  };

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        {
          provide: CommentsService,
          useValue: {
            getCommentsByPost: jest.fn(),
            createComment: jest.fn(),
            updateComment: jest.fn(),
            deleteComment: jest.fn(),
            reportComment: jest.fn(),
            hideComment: jest.fn(),
            unhideComment: jest.fn(),
            getAllReports: jest.fn(),
            resolveReport: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = testingModule.get<CommentsController>(CommentsController);
    service = testingModule.get(CommentsService) as jest.Mocked<CommentsService>;
  });

  describe('getComments', () => {
    it('should return comments for a post', async () => {
      const comments = [mockComment];
      service.getCommentsByPost.mockResolvedValue(comments);

      const result = await controller.getComments('post-1');

      expect(result).toEqual(comments);
      expect(service.getCommentsByPost).toHaveBeenCalledWith('post-1');
    });

    it('should handle empty comments list', async () => {
      service.getCommentsByPost.mockResolvedValue([]);

      const result = await controller.getComments('post-1');

      expect(result).toEqual([]);
    });

    it('should propagate service errors', async () => {
      service.getCommentsByPost.mockRejectedValue(new Error('Not found'));

      await expect(controller.getComments('post-1')).rejects.toThrow('Not found');
    });
  });

  describe('createComment', () => {
    it('should create a comment with authenticated user', async () => {
      const dto = {
        post_id: 'post-1',
        content: 'Test comment',
        parent_id: undefined,
      };

      const req = {
        user: mockRegularUser,
      } as AuthenticatedRequest;

      service.createComment.mockResolvedValue(mockComment);

      const result = await controller.createComment(req, dto);

      expect(result).toEqual(mockComment);
      expect(service.createComment).toHaveBeenCalledWith('user-1', dto);
    });

    it('should create a reply comment', async () => {
      const dto = {
        post_id: 'post-1',
        content: 'Reply',
        parent_id: 'comment-1',
      };

      const req = {
        user: mockRegularUser,
      } as AuthenticatedRequest;

      const reply = { ...mockComment, id: 'comment-2', parent_id: 'comment-1' };
      service.createComment.mockResolvedValue(reply);

      const result = await controller.createComment(req, dto);

      expect(result).toEqual(reply);
      expect(service.createComment).toHaveBeenCalledWith('user-1', dto);
    });

    it('should propagate service errors on create', async () => {
      const dto = {
        post_id: 'post-1',
        content: 'Test comment',
        parent_id: undefined,
      };

      const req = {
        user: mockRegularUser,
      } as AuthenticatedRequest;

      service.createComment.mockRejectedValue(new Error('Post not found'));

      await expect(controller.createComment(req, dto)).rejects.toThrow('Post not found');
    });
  });

  describe('updateComment', () => {
    it('should update a comment by owner', async () => {
      const dto = { content: 'Updated content' };

      const req = {
        user: mockRegularUser,
      } as AuthenticatedRequest;

      const updatedComment = { ...mockComment, content: 'Updated content' };
      service.updateComment.mockResolvedValue(updatedComment);

      const result = await controller.updateComment(req, 'comment-1', dto);

      expect(result).toEqual(updatedComment);
      expect(service.updateComment).toHaveBeenCalledWith('comment-1', 'user-1', dto);
    });

    it('should reject update by non-owner', async () => {
      const dto = { content: 'Updated content' };

      const req = {
        user: { id: 'user-2', email: 'user2@example.com', role: 'user' },
      } as AuthenticatedRequest;

      service.updateComment.mockRejectedValue(
        new ForbiddenException('You can only edit your own comments')
      );

      await expect(controller.updateComment(req, 'comment-1', dto)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should propagate service errors on update', async () => {
      const dto = { content: 'Updated content' };

      const req = {
        user: mockRegularUser,
      } as AuthenticatedRequest;

      service.updateComment.mockRejectedValue(new Error('Not found'));

      await expect(controller.updateComment(req, 'comment-1', dto)).rejects.toThrow('Not found');
    });
  });

  describe('deleteComment', () => {
    it('should delete comment by owner', async () => {
      const req = {
        user: mockRegularUser,
      } as AuthenticatedRequest;

      service.deleteComment.mockResolvedValue(true);

      await controller.deleteComment(req, 'comment-1');

      expect(service.deleteComment).toHaveBeenCalledWith('comment-1', 'user-1');
    });

    it('should return NO_CONTENT status', async () => {
      const req = {
        user: mockRegularUser,
      } as AuthenticatedRequest;

      service.deleteComment.mockResolvedValue(true);

      const result = await controller.deleteComment(req, 'comment-1');

      // The controller method should return nothing (NO_CONTENT=204)
      expect(result).toBeUndefined();
    });

    it('should reject delete by non-owner', async () => {
      const req = {
        user: { id: 'user-2', email: 'user2@example.com', role: 'user' },
      } as AuthenticatedRequest;

      service.deleteComment.mockRejectedValue(
        new ForbiddenException('You do not have permission to delete this comment')
      );

      await expect(controller.deleteComment(req, 'comment-1')).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should handle successful deletion', async () => {
      const req = {
        user: mockRegularUser,
      } as AuthenticatedRequest;

      service.deleteComment.mockResolvedValue(true);

      const result = await controller.deleteComment(req, 'comment-1');

      expect(result).toBeUndefined();
    });
  });

  describe('reportComment', () => {
    it('should create a report for a comment', async () => {
      const dto = {
        reason: 'Spam',
        description: 'This is spam',
      };

      const req = {
        user: { id: 'user-2', email: 'user2@example.com', role: 'user' },
      } as AuthenticatedRequest;

      service.reportComment.mockResolvedValue(mockReport);

      const result = await controller.reportComment(req, 'comment-1', dto);

      expect(result).toEqual(mockReport);
      expect(service.reportComment).toHaveBeenCalledWith('comment-1', 'user-2', dto);
    });

    it('should allow users to self-report', async () => {
      const dto = {
        reason: 'Mistake',
        description: 'I made a mistake',
      };

      const req = {
        user: mockRegularUser,
      } as AuthenticatedRequest;

      service.reportComment.mockResolvedValue(mockReport);

      const result = await controller.reportComment(req, 'comment-1', dto);

      expect(result).toEqual(mockReport);
    });

    it('should propagate service errors on report', async () => {
      const dto = {
        reason: 'Spam',
        description: 'This is spam',
      };

      const req = {
        user: { id: 'user-2', email: 'user2@example.com', role: 'user' },
      } as AuthenticatedRequest;

      service.reportComment.mockRejectedValue(new Error('Comment not found'));

      await expect(controller.reportComment(req, 'comment-1', dto)).rejects.toThrow(
        'Comment not found'
      );
    });
  });

  describe('hideComment', () => {
    it('should hide comment by post owner', async () => {
      const req = {
        user: mockRegularUser,
      } as AuthenticatedRequest;

      const hiddenComment = { ...mockComment, hidden: true };
      service.hideComment.mockResolvedValue(hiddenComment);

      const result = await controller.hideComment(req, 'comment-1');

      expect(result).toEqual(hiddenComment);
      expect(service.hideComment).toHaveBeenCalledWith('comment-1', 'user-1');
    });

    it('should reject hide by non-owner', async () => {
      const req = {
        user: { id: 'user-2', email: 'user2@example.com', role: 'user' },
      } as AuthenticatedRequest;

      service.hideComment.mockRejectedValue(
        new ForbiddenException('Only the post owner can hide comments')
      );

      await expect(controller.hideComment(req, 'comment-1')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('unhideComment', () => {
    it('should unhide comment by post owner', async () => {
      const req = {
        user: mockRegularUser,
      } as AuthenticatedRequest;

      const visibleComment = { ...mockComment, hidden: false };
      service.unhideComment.mockResolvedValue(visibleComment);

      const result = await controller.unhideComment(req, 'comment-1');

      expect(result).toEqual(visibleComment);
      expect(service.unhideComment).toHaveBeenCalledWith('comment-1', 'user-1');
    });

    it('should reject unhide by non-owner', async () => {
      const req = {
        user: { id: 'user-2', email: 'user2@example.com', role: 'user' },
      } as AuthenticatedRequest;

      service.unhideComment.mockRejectedValue(
        new ForbiddenException('Only the post owner can unhide comments')
      );

      await expect(controller.unhideComment(req, 'comment-1')).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('getAllReports', () => {
    it('should return all reports for admin', async () => {
      const req = {
        user: mockAdminUser,
      } as AuthenticatedRequest;

      const reports = [mockReport];
      service.getAllReports.mockResolvedValue(reports);

      const result = await controller.getAllReports(req);

      expect(result).toEqual(reports);
      expect(service.getAllReports).toHaveBeenCalled();
    });

    it('should return all reports for moderator', async () => {
      const req = {
        user: mockModeratorUser,
      } as AuthenticatedRequest;

      const reports = [mockReport];
      service.getAllReports.mockResolvedValue(reports);

      const result = await controller.getAllReports(req);

      expect(result).toEqual(reports);
      expect(service.getAllReports).toHaveBeenCalled();
    });

    it('should reject non-admin/moderator access', async () => {
      const req = {
        user: mockRegularUser,
      } as AuthenticatedRequest;

      expect(() => controller.getAllReports(req)).toThrow(
        new ForbiddenException('Admin access required')
      );
    });

    it('should handle empty reports list', async () => {
      const req = {
        user: mockAdminUser,
      } as AuthenticatedRequest;

      service.getAllReports.mockResolvedValue([]);

      const result = await controller.getAllReports(req);

      expect(result).toEqual([]);
    });

    it('should return multiple reports', async () => {
      const req = {
        user: mockAdminUser,
      } as AuthenticatedRequest;

      const reports = [
        mockReport,
        { ...mockReport, id: 'report-2', comment_id: 'comment-2' },
        { ...mockReport, id: 'report-3', comment_id: 'comment-3' },
      ];
      service.getAllReports.mockResolvedValue(reports);

      const result = await controller.getAllReports(req);

      expect(result).toHaveLength(3);
      expect(result).toEqual(reports);
    });
  });

  describe('resolveReport', () => {
    it('should resolve report as reviewed by admin', async () => {
      const req = {
        user: mockAdminUser,
      } as AuthenticatedRequest;

      const resolvedReport = { ...mockReport, status: 'reviewed' };
      service.resolveReport.mockResolvedValue(resolvedReport);

      const result = await controller.resolveReport(req, 'report-1', { status: 'reviewed' });

      expect(result).toEqual(resolvedReport);
      expect(service.resolveReport).toHaveBeenCalledWith('report-1', 'admin-1', 'reviewed');
    });

    it('should resolve report as dismissed by moderator', async () => {
      const req = {
        user: mockModeratorUser,
      } as AuthenticatedRequest;

      const resolvedReport = { ...mockReport, status: 'dismissed' };
      service.resolveReport.mockResolvedValue(resolvedReport);

      const result = await controller.resolveReport(req, 'report-1', { status: 'dismissed' });

      expect(result).toEqual(resolvedReport);
      expect(service.resolveReport).toHaveBeenCalledWith('report-1', 'mod-1', 'dismissed');
    });

    it('should reject non-admin/moderator resolution', async () => {
      const req = {
        user: mockRegularUser,
      } as AuthenticatedRequest;

      expect(() => controller.resolveReport(req, 'report-1', { status: 'reviewed' })).toThrow(
        new ForbiddenException('Admin access required')
      );
    });

    it('should handle resolution with reviewed status', async () => {
      const req = {
        user: mockAdminUser,
      } as AuthenticatedRequest;

      service.resolveReport.mockResolvedValue({ ...mockReport, status: 'reviewed' });

      const result = await controller.resolveReport(req, 'report-1', { status: 'reviewed' });

      if (result) {
        expect(result.status).toBe('reviewed');
      }
    });

    it('should handle resolution with dismissed status', async () => {
      const req = {
        user: mockAdminUser,
      } as AuthenticatedRequest;

      service.resolveReport.mockResolvedValue({ ...mockReport, status: 'dismissed' });

      const result = await controller.resolveReport(req, 'report-1', { status: 'dismissed' });

      if (result) {
        expect(result.status).toBe('dismissed');
      }
    });

    it('should propagate service errors on resolve', async () => {
      const req = {
        user: mockAdminUser,
      } as AuthenticatedRequest;

      service.resolveReport.mockRejectedValue(new Error('Report not found'));

      await expect(controller.resolveReport(req, 'report-1', { status: 'reviewed' })).rejects.toThrow(
        'Report not found'
      );
    });

    it('should track resolver admin user', async () => {
      const req = {
        user: mockAdminUser,
      } as AuthenticatedRequest;

      service.resolveReport.mockResolvedValue({ ...mockReport, status: 'reviewed' });

      await controller.resolveReport(req, 'report-1', { status: 'reviewed' });

      expect(service.resolveReport).toHaveBeenCalledWith('report-1', 'admin-1', 'reviewed');
    });
  });

  describe('parameter validation', () => {
    it('should pass correct post ID to service', async () => {
      service.getCommentsByPost.mockResolvedValue([]);

      await controller.getComments('post-123');

      expect(service.getCommentsByPost).toHaveBeenCalledWith('post-123');
    });

    it('should pass correct comment ID in update', async () => {
      const dto = { content: 'Updated' };
      const req = { user: mockRegularUser } as AuthenticatedRequest;

      service.updateComment.mockResolvedValue(mockComment);

      await controller.updateComment(req, 'comment-456', dto);

      expect(service.updateComment).toHaveBeenCalledWith('comment-456', 'user-1', dto);
    });

    it('should pass correct comment ID in delete', async () => {
      const req = { user: mockRegularUser } as AuthenticatedRequest;

      service.deleteComment.mockResolvedValue(true);

      await controller.deleteComment(req, 'comment-789');

      expect(service.deleteComment).toHaveBeenCalledWith('comment-789', 'user-1');
    });

    it('should pass correct report ID in resolve', async () => {
      const req = { user: mockAdminUser } as AuthenticatedRequest;

      service.resolveReport.mockResolvedValue(mockReport);

      await controller.resolveReport(req, 'report-999', { status: 'reviewed' });

      expect(service.resolveReport).toHaveBeenCalledWith('report-999', 'admin-1', 'reviewed');
    });
  });

  describe('auth context', () => {
    it('should extract user ID from request context', async () => {
      const dto = {
        post_id: 'post-1',
        content: 'Test',
        parent_id: undefined,
      };

      const req = {
        user: { id: 'special-user-id', email: 'special@example.com', role: 'user' },
      } as AuthenticatedRequest;

      service.createComment.mockResolvedValue(mockComment);

      await controller.createComment(req, dto);

      expect(service.createComment).toHaveBeenCalledWith('special-user-id', dto);
    });

    it('should handle different user roles in report resolution', async () => {
      const req = { user: mockAdminUser } as AuthenticatedRequest;

      service.resolveReport.mockResolvedValue(mockReport);

      await controller.resolveReport(req, 'report-1', { status: 'reviewed' });

      // Admin role should pass
      expect(service.resolveReport).toHaveBeenCalled();
    });
  });
});
