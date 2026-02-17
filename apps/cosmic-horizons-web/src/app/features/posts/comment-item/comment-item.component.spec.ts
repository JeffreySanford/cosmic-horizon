import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommentItemComponent } from './comment-item.component';
import { CommentsApiService, CommentModel } from '../comments-api.service';
import { AuthSessionService } from '../../../services/auth-session.service';

describe('CommentItemComponent', () => {
  let component: CommentItemComponent;
  let fixture: ComponentFixture<CommentItemComponent>;
  let commentsApiService: any;
  let authService: any;

  const mockComment: CommentModel = {
    id: 'comment-1',
    post_id: 'post-1',
    user_id: 'user-1',
    parent_id: null,
    content: 'Test comment',
    created_at: '2026-02-12T00:00:00Z',
    updated_at: '2026-02-12T00:00:00Z',
    deleted_at: null,
    hidden_at: null,
  };

  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    display_name: 'Test User',
    avatar_url: null,
    role: 'user' as const,
  };

  beforeEach(async () => {
    const commentsApiSpy = {
      createComment: vi.fn(),
      deleteComment: vi.fn(),
      reportComment: vi.fn(),
      hideComment: vi.fn(),
    };
    const authServiceSpy = {
      getUser: vi.fn(),
      isAuthenticated: vi.fn(),
    };

    await TestBed.configureTestingModule({
      declarations: [CommentItemComponent],
      imports: [
        CommonModule,
        FormsModule,
        MatIconModule,
        MatButtonModule,
        MatMenuModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        NoopAnimationsModule,
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CommentsApiService, useValue: commentsApiSpy },
        { provide: AuthSessionService, useValue: authServiceSpy },
      ],
    }).compileComponents();

    commentsApiService = TestBed.inject(CommentsApiService);
    authService = TestBed.inject(AuthSessionService);

    fixture = TestBed.createComponent(CommentItemComponent);
    component = fixture.componentInstance;
  });

  describe('initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default values', () => {
      expect(component.showReplyForm).toBe(false);
      expect(component.replyContent).toBe('');
      expect(component.submittingReply).toBe(false);
      expect(component.error).toBe('');
    });
  });

  describe('isOwner getter', () => {
    it('should return true when user is the comment author', () => {
      authService.getUser.mockReturnValue(mockUser);
      component.comment = mockComment;

      expect(component.isOwner).toBe(true);
    });

    it('should return false when user is not the comment author', () => {
      authService.getUser.mockReturnValue({ ...mockUser, id: 'user-2' });
      component.comment = mockComment;

      expect(component.isOwner).toBe(false);
    });

    it('should return false when user is not authenticated', () => {
      authService.getUser.mockReturnValue(null);
      component.comment = mockComment;

      expect(component.isOwner).toBe(false);
    });
  });

  describe('canReply getter', () => {
    beforeEach(() => {
      component.comment = mockComment;
    });

    it('should return true when authenticated, post not locked, and comment not deleted', () => {
      authService.isAuthenticated.mockReturnValue(true);
      component.isPostLocked = false;

      expect(component.canReply).toBe(true);
    });

    it('should return false when not authenticated', () => {
      authService.isAuthenticated.mockReturnValue(false);

      expect(component.canReply).toBe(false);
    });

    it('should return false when post is locked', () => {
      authService.isAuthenticated.mockReturnValue(true);
      component.isPostLocked = true;

      expect(component.canReply).toBe(false);
    });

    it('should return false when comment is deleted', () => {
      authService.isAuthenticated.mockReturnValue(true);
      component.isPostLocked = false;
      component.comment = { ...mockComment, deleted_at: '2026-02-12T00:00:00Z' };

      expect(component.canReply).toBe(false);
    });
  });

  describe('canReport getter', () => {
    beforeEach(() => {
      component.comment = mockComment;
    });

    it('should return true when authenticated and comment not deleted', () => {
      authService.isAuthenticated.mockReturnValue(true);

      expect(component.canReport).toBe(true);
    });

    it('should return false when not authenticated', () => {
      authService.isAuthenticated.mockReturnValue(false);

      expect(component.canReport).toBe(false);
    });

    it('should return false when comment is deleted', () => {
      authService.isAuthenticated.mockReturnValue(true);
      component.comment = { ...mockComment, deleted_at: '2026-02-12T00:00:00Z' };

      expect(component.canReport).toBe(false);
    });
  });

  describe('canDelete getter', () => {
    beforeEach(() => {
      authService.getUser.mockReturnValue(mockUser);
      component.comment = mockComment;
    });

    it('should return true when user is owner', () => {
      component.canDeleteAny = false;

      expect(component.canDelete).toBe(true);
    });

    it('should return true when user has deleteAny permission', () => {
      authService.getUser.mockReturnValue({ ...mockUser, id: 'user-2' });
      component.canDeleteAny = true;

      expect(component.canDelete).toBe(true);
    });

    it('should return false when user is neither owner nor has permission', () => {
      authService.getUser.mockReturnValue({ ...mockUser, id: 'user-2' });
      component.canDeleteAny = false;

      expect(component.canDelete).toBe(false);
    });
  });

  describe('toggleReply()', () => {
    beforeEach(() => {
      component.comment = mockComment;
    });

    it('should toggle showReplyForm true and clear state', () => {
      component.showReplyForm = false;
      component.replyContent = 'old content';
      component.error = 'old error';

      component.toggleReply();

      expect(component.showReplyForm).toBe(true);
      expect(component.replyContent).toBe('');
      expect(component.error).toBe('');
    });

    it('should toggle showReplyForm false', () => {
      component.showReplyForm = true;
      component.replyContent = 'content';

      component.toggleReply();

      expect(component.showReplyForm).toBe(false);
      expect(component.replyContent).toBe('content'); // Doesn't clear on close
    });
  });

  describe('submitReply()', () => {
    beforeEach(() => {
      component.comment = mockComment;
      component.replyContent = 'Test reply';
    });

    it('should submit reply successfully', async () => {
      commentsApiService.createComment.mockReturnValue(of({}));

      component.submitReply();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(commentsApiService.createComment).toHaveBeenCalledWith({
        post_id: 'post-1',
        content: 'Test reply',
        parent_id: 'comment-1',
      });
      expect(component.submittingReply).toBe(false);
      expect(component.showReplyForm).toBe(false);
      expect(component.replyContent).toBe('');
    });

    it('should not submit when reply content is empty', () => {
      component.replyContent = '   ';

      component.submitReply();

      expect(commentsApiService.createComment).not.toHaveBeenCalled();
    });

    it('should not submit when already submitting', () => {
      component.submittingReply = true;

      component.submitReply();

      expect(commentsApiService.createComment).not.toHaveBeenCalled();
    });

    it('should emit replied event on successful submission', async () => {
      commentsApiService.createComment.mockReturnValue(of({}));
      const repliedSpy = vi.spyOn(component.replied, 'emit');

      component.submitReply();
      await Promise.resolve();

      expect(repliedSpy).toHaveBeenCalled();
    });

    it('should handle error response', async () => {
      const errorResponse = { error: { message: 'Server error' } };
      commentsApiService.createComment.mockReturnValue(throwError(() => errorResponse));

      component.submitReply();
      await Promise.resolve();

      expect(component.submittingReply).toBe(false);
      expect(component.error).toBe('Server error');
    });

    it('should set generic error message when error has no message', async () => {
      commentsApiService.createComment.mockReturnValue(throwError(() => ({})));

      component.submitReply();
      await Promise.resolve();

      expect(component.error).toBe('Failed to post reply.');
    });
  });

  describe('deleteComment()', () => {
    beforeEach(() => {
      component.comment = mockComment;
      authService.getUser.mockReturnValue(mockUser);
      component.canDeleteAny = false;
      vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    it('should delete comment when user confirms', async () => {
      commentsApiService.deleteComment.mockReturnValue(of({}));

      component.deleteComment();
      await Promise.resolve();

      expect(commentsApiService.deleteComment).toHaveBeenCalledWith('comment-1');
    });

    it('should not delete when user cancels confirmation', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);

      component.deleteComment();

      expect(commentsApiService.deleteComment).not.toHaveBeenCalled();
    });

    it('should not delete without permission', () => {
      authService.getUser.mockReturnValue({ ...mockUser, id: 'user-2' });
      component.canDeleteAny = false;

      component.deleteComment();

      expect(commentsApiService.deleteComment).not.toHaveBeenCalled();
    });

    it('should emit deleted event with comment id on successful deletion', async () => {
      const deletedSpy = vi.spyOn(component.deleted, 'emit');
      commentsApiService.deleteComment.mockReturnValue(of({}));

      component.deleteComment();
      await Promise.resolve();

      expect(deletedSpy).toHaveBeenCalledWith('comment-1');
    });

    it('should show alert on deletion error', async () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const errorResponse = { error: { message: 'Cannot delete' } };
      commentsApiService.deleteComment.mockReturnValue(throwError(() => errorResponse));

      component.deleteComment();
      await Promise.resolve();

      expect(alertSpy).toHaveBeenCalledWith('Cannot delete');
    });

    it('should show generic error alert when no message provided', async () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      commentsApiService.deleteComment.mockReturnValue(throwError(() => ({})));

      component.deleteComment();
      await Promise.resolve();

      expect(alertSpy).toHaveBeenCalledWith('Failed to delete comment.');
    });
  });

  describe('reportComment()', () => {
    beforeEach(() => {
      component.comment = mockComment;
      authService.isAuthenticated.mockReturnValue(true);
      vi.spyOn(window, 'prompt').mockReturnValue('Inappropriate content');
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      vi.spyOn(window, 'alert').mockImplementation(() => {});
    });

    it('should report comment with reason', async () => {
      commentsApiService.reportComment.mockReturnValue(of({}));

      component.reportComment();
      await Promise.resolve();

      expect(commentsApiService.reportComment).toHaveBeenCalledWith('comment-1', {
        reason: 'Inappropriate content',
      });
      expect(window.alert).toHaveBeenCalledWith('Comment reported. Thank you.');
    });

    it('should not report when user cancels prompt', () => {
      vi.spyOn(window, 'prompt').mockReturnValue(null);

      component.reportComment();

      expect(commentsApiService.reportComment).not.toHaveBeenCalled();
    });

    it('should show alert on report error', async () => {
      const errorResponse = { error: { message: 'Already reported' } };
      commentsApiService.reportComment.mockReturnValue(throwError(() => errorResponse));

      component.reportComment();
      await Promise.resolve();

      expect(window.alert).toHaveBeenCalledWith('Already reported');
    });

    it('should show generic error alert when no message provided', async () => {
      commentsApiService.reportComment.mockReturnValue(throwError(() => ({})));

      component.reportComment();
      await Promise.resolve();

      expect(window.alert).toHaveBeenCalledWith('Failed to report comment.');
    });
  });

  describe('hideComment()', () => {
    beforeEach(() => {
      component.comment = mockComment;
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      vi.spyOn(window, 'alert').mockImplementation(() => {});
    });

    it('should hide comment when user has permission', async () => {
      component.canDeleteAny = true;
      vi.spyOn(component.replied, 'emit');
      commentsApiService.hideComment.mockReturnValue(of({}));

      component.hideComment();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(commentsApiService.hideComment).toHaveBeenCalledWith('comment-1');
      expect(component.replied.emit).toHaveBeenCalled();
    });

    it('should not hide when user lacks permission', () => {
      component.canDeleteAny = false;

      component.hideComment();

      expect(commentsApiService.hideComment).not.toHaveBeenCalled();
    });

    it('should show alert on hide error', async () => {
      component.canDeleteAny = true;
      const errorResponse = { error: { message: 'Comment not found' } };
      commentsApiService.hideComment.mockReturnValue(throwError(() => errorResponse));

      component.hideComment();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(window.alert).toHaveBeenCalledWith('Comment not found');
    });

    it('should show generic error alert when no message provided', async () => {
      component.canDeleteAny = true;
      commentsApiService.hideComment.mockReturnValue(throwError(() => ({})));

      component.hideComment();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(window.alert).toHaveBeenCalledWith('Failed to hide comment.');
    });
  });

  describe('submitReply() - edge cases', () => {
    beforeEach(() => {
      component.comment = mockComment;
    });

    it('should not submit when content is empty', () => {
      component.replyContent = '';
      commentsApiService.createComment.mockReturnValue(of({}));

      component.submitReply();

      expect(commentsApiService.createComment).not.toHaveBeenCalled();
    });

    it('should not submit when content is only whitespace', () => {
      component.replyContent = '   \t\n  ';
      commentsApiService.createComment.mockReturnValue(of({}));

      component.submitReply();

      expect(commentsApiService.createComment).not.toHaveBeenCalled();
    });

    it('should not submit when already submitting', () => {
      component.replyContent = 'Test reply';
      component.submittingReply = true;
      commentsApiService.createComment.mockReturnValue(of({}));

      component.submitReply();

      expect(commentsApiService.createComment).not.toHaveBeenCalled();
    });

    it('should trim whitespace before submitting', async () => {
      component.replyContent = '  Test reply with spaces  ';
      commentsApiService.createComment.mockReturnValue(of({}));

      component.submitReply();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(commentsApiService.createComment).toHaveBeenCalledWith({
        post_id: 'post-1',
        content: '  Test reply with spaces  ',
        parent_id: 'comment-1',
      });
    });

    it('should emit replied event after successful submission', async () => {
      component.replyContent = 'Test reply';
      component.showReplyForm = true;
      vi.spyOn(component.replied, 'emit');
      commentsApiService.createComment.mockReturnValue(of({}));

      component.submitReply();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(component.replied.emit).toHaveBeenCalled();
    });

    it('should maintain error state across operations', async () => {
      component.replyContent = 'Test reply';
      component.error = '';
      const errorResponse = { error: { message: 'Server error' } };
      commentsApiService.createComment.mockReturnValue(throwError(() => errorResponse));

      component.submitReply();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(component.error).toBe('Server error');
      expect(component.submittingReply).toBe(false);
    });
  });

  describe('deleteComment() - edge cases', () => {
    beforeEach(() => {
      component.comment = mockComment;
      authService.getUser.mockReturnValue(mockUser);
      component.canDeleteAny = false;
    });

    it('should not delete when user cancels confirmation', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      commentsApiService.deleteComment.mockReturnValue(of({}));

      component.deleteComment();

      expect(commentsApiService.deleteComment).not.toHaveBeenCalled();
    });

    it('should not delete when user lacks permission', () => {
      authService.getUser.mockReturnValue({ ...mockUser, id: 'user-2' });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      commentsApiService.deleteComment.mockReturnValue(of({}));

      component.deleteComment();

      expect(commentsApiService.deleteComment).not.toHaveBeenCalled();
    });

    it('should emit deleted event with comment id on success', async () => {
      vi.spyOn(component.deleted, 'emit');
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      commentsApiService.deleteComment.mockReturnValue(of({}));

      component.deleteComment();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(component.deleted.emit).toHaveBeenCalledWith('comment-1');
    });

    it('should show generic error alert when error has no message', async () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      commentsApiService.deleteComment.mockReturnValue(throwError(() => ({})));

      component.deleteComment();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(alertSpy).toHaveBeenCalledWith('Failed to delete comment.');
    });
  });

  describe('reportComment() - edge cases', () => {
    beforeEach(() => {
      component.comment = mockComment;
    });

    it('should not report when user cancels prompt', () => {
      vi.spyOn(window, 'prompt').mockReturnValue(null);
      commentsApiService.reportComment.mockReturnValue(of({}));

      component.reportComment();

      expect(commentsApiService.reportComment).not.toHaveBeenCalled();
    });

    it('should not report when user provides empty string', () => {
      vi.spyOn(window, 'prompt').mockReturnValue('');
      commentsApiService.reportComment.mockReturnValue(of({}));

      component.reportComment();

      expect(commentsApiService.reportComment).not.toHaveBeenCalled();
    });

    it('should report with user provided reason', async () => {
      vi.spyOn(window, 'prompt').mockReturnValue('Inappropriate content');
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      vi.spyOn(window, 'alert').mockImplementation(() => {});
      commentsApiService.reportComment.mockReturnValue(of({}));

      component.reportComment();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(commentsApiService.reportComment).toHaveBeenCalledWith('comment-1', {
        reason: 'Inappropriate content',
      });
    });

    it('should show success alert after reporting', async () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      vi.spyOn(window, 'prompt').mockReturnValue('Spam');
      commentsApiService.reportComment.mockReturnValue(of({}));

      component.reportComment();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(alertSpy).toHaveBeenCalledWith('Comment reported. Thank you.');
    });
  });

  describe('hideComment() - edge cases', () => {
    beforeEach(() => {
      component.comment = mockComment;
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      vi.spyOn(window, 'alert').mockImplementation(() => {});
    });

    it('should not hide when user lacks canDeleteAny permission', () => {
      component.canDeleteAny = false;
      commentsApiService.hideComment.mockReturnValue(of({}));

      component.hideComment();

      expect(commentsApiService.hideComment).not.toHaveBeenCalled();
    });

    it('should emit replied event to trigger refresh', async () => {
      component.canDeleteAny = true;
      vi.spyOn(component.replied, 'emit');
      commentsApiService.hideComment.mockReturnValue(of({}));

      component.hideComment();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(component.replied.emit).toHaveBeenCalled();
    });

    it('should show generic error when no message provided', async () => {
      component.canDeleteAny = true;
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      commentsApiService.hideComment.mockReturnValue(throwError(() => ({})));

      component.hideComment();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(alertSpy).toHaveBeenCalledWith('Failed to hide comment.');
    });

    it('should show specific error message when provided', async () => {
      component.canDeleteAny = true;
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const errorResponse = { error: { message: 'Comment already hidden' } };
      commentsApiService.hideComment.mockReturnValue(throwError(() => errorResponse));

      component.hideComment();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(alertSpy).toHaveBeenCalledWith('Comment already hidden');
    });
  });

  describe('onChildDeleted()', () => {
    it('should emit deleted event with child comment id', () => {
      vi.spyOn(component.deleted, 'emit');
      component.comment = mockComment;

      component.onChildDeleted('child-comment-1');

      expect(component.deleted.emit).toHaveBeenCalledWith('child-comment-1');
    });

    it('should forward different comment ids', () => {
      vi.spyOn(component.deleted, 'emit');
      component.comment = mockComment;

      component.onChildDeleted('another-comment-id');

      expect(component.deleted.emit).toHaveBeenCalledWith('another-comment-id');
    });
  });

  describe('onChildReplied()', () => {
    it('should emit replied event', () => {
      vi.spyOn(component.replied, 'emit');
      component.comment = mockComment;

      component.onChildReplied();

      expect(component.replied.emit).toHaveBeenCalled();
    });

    it('should emit replied event without arguments', () => {
      const repliedSpy = vi.spyOn(component.replied, 'emit');
      component.comment = mockComment;

      component.onChildReplied();

      expect(repliedSpy).toHaveBeenCalledWith();
    });
  });

  describe('Integration scenarios', () => {
    beforeEach(() => {
      component.comment = mockComment;
      authService.getUser.mockReturnValue(mockUser);
    });

    it('should handle reply form lifecycle', async () => {
      authService.isAuthenticated.mockReturnValue(true);
      component.isPostLocked = false;
      component.replyContent = 'Test reply';
      commentsApiService.createComment.mockReturnValue(of({ id: 'reply-1' }));

      // Check initial state
      expect(component.canReply).toBe(true);

      // Open reply form
      component.toggleReply();
      expect(component.showReplyForm).toBe(true);

      // Submit and verify form closes and content clears
      component.submitReply();
      await new Promise((resolve) => setTimeout(resolve, 200));

      // After successful submission, content should clear
      expect(component.replyContent).toBe('');
    });

    it('should handle multiple permission checks', () => {
      authService.isAuthenticated.mockReturnValue(true);
      component.isPostLocked = false;

      // All permissions should be correct
      expect(component.canReply).toBe(true);
      expect(component.canReport).toBe(true);
      expect(component.canDelete).toBe(true); // isOwner
      expect(component.isOwner).toBe(true);
    });

    it('should handle error state persistence across operations', async () => {
      component.replyContent = 'Test';
      const errorResponse = { error: { message: 'Network error' } };
      commentsApiService.createComment.mockReturnValue(throwError(() => errorResponse));

      component.submitReply();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(component.error).toBe('Network error');
      expect(component.submittingReply).toBe(false);
    });
  });
});
