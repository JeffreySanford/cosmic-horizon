import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommentModel, CommentsApiService } from '../comments-api.service';
import { AuthSessionService } from '../../../services/auth-session.service';

@Component({
  selector: 'app-comment-item',
  templateUrl: './comment-item.component.html',
  styleUrls: ['./comment-item.component.scss'],
  standalone: false,
})
export class CommentItemComponent {
  @Input({ required: true }) comment!: CommentModel;
  @Input() depth = 0;
  @Input() canDeleteAny = false;
  @Input() isPostLocked = false;
  @Output() deleted = new EventEmitter<string>();
  @Output() replied = new EventEmitter<void>();

  private readonly commentsApi = inject(CommentsApiService);
  private readonly auth = inject(AuthSessionService);

  showReplyForm = false;
  replyContent = '';
  submittingReply = false;
  error = '';

  get isOwner(): boolean {
    const user = this.auth.getUser();
    return !!user && user.id === this.comment.user_id;
  }

  get canReply(): boolean {
    return (
      this.auth.isAuthenticated() &&
      !this.isPostLocked &&
      !this.comment.deleted_at
    );
  }

  get canReport(): boolean {
    return this.auth.isAuthenticated() && !this.comment.deleted_at;
  }

  get canDelete(): boolean {
    return this.isOwner || this.canDeleteAny;
  }

  toggleReply(): void {
    this.showReplyForm = !this.showReplyForm;
    if (this.showReplyForm) {
      this.replyContent = '';
      this.error = '';
    }
  }

  submitReply(): void {
    if (!this.replyContent.trim() || this.submittingReply) {
      return;
    }

    this.submittingReply = true;
    this.commentsApi
      .createComment({
        post_id: this.comment.post_id,
        content: this.replyContent,
        parent_id: this.comment.id,
      })
      .subscribe({
        next: () => {
          this.submittingReply = false;
          this.showReplyForm = false;
          this.replyContent = '';
          this.replied.emit();
        },
        error: (err) => {
          this.submittingReply = false;
          this.error = err.error?.message || 'Failed to post reply.';
        },
      });
  }

  deleteComment(): void {
    if (!confirm('Delete this comment?') || !this.canDelete) {
      return;
    }

    this.commentsApi.deleteComment(this.comment.id).subscribe({
      next: () => {
        this.deleted.emit(this.comment.id);
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to delete comment.');
      },
    });
  }

  reportComment(): void {
    const reason = prompt('Reason for reporting this comment?');
    if (!reason) return;

    this.commentsApi.reportComment(this.comment.id, { reason }).subscribe({
      next: () => {
        alert('Comment reported. Thank you.');
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to report comment.');
      },
    });
  }

  hideComment(): void {
    if (!this.canDeleteAny) return;

    this.commentsApi.hideComment(this.comment.id).subscribe({
      next: () => {
        this.replied.emit(); // Refresh view
      },
      error: (err) => {
        alert(err.error?.message || 'Failed to hide comment.');
      },
    });
  }

  onChildDeleted(id: string): void {
    this.deleted.emit(id);
  }

  onChildReplied(): void {
    this.replied.emit();
  }
}
