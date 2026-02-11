import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { PostsApiService, PostModel } from './posts-api.service';
import { CommentsApiService, CommentModel } from './comments-api.service';
import { renderSafeMarkdownHtml } from './markdown-renderer';

@Component({
  selector: 'app-post-detail',
  templateUrl: './post-detail.component.html',
  styleUrls: ['./post-detail.component.scss'],
  standalone: false, // eslint-disable-line @angular-eslint/prefer-standalone
})
export class PostDetailComponent implements OnInit {
  post: PostModel | null = null;
  comments: CommentModel[] = [];
  loading = false;
  loadingComments = false;
  publishing = false;
  moderating = false;
  statusMessage = '';
  viewMode: 'formatted' | 'raw' = 'formatted';
  canModerate = false;

  newCommentContent = '';
  submittingComment = false;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly postsApi = inject(PostsApiService);
  private readonly commentsApi = inject(CommentsApiService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/posts']);
      return;
    }

    this.loading = true;
    this.postsApi
      .getPostById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (post) => {
          this.post = post;
          this.canModerate = this.computeCanModerate(post.user_id);
          this.loading = false;
          this.loadComments();
        },
        error: (error: HttpErrorResponse) => {
          this.loading = false;
          this.statusMessage = typeof error.error?.message === 'string' ? error.error.message : 'Post was not found.';
        },
      });
  }

  loadComments(): void {
    if (!this.post) return;
    this.loadingComments = true;
    this.commentsApi
      .getCommentsByPost(this.post.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (comments) => {
          this.comments = this.organizeComments(comments);
          this.loadingComments = false;
        },
        error: () => {
          this.loadingComments = false;
        },
      });
  }

  submitComment(): void {
    if (!this.post || !this.newCommentContent.trim() || this.submittingComment) {
      return;
    }

    this.submittingComment = true;
    this.commentsApi
      .createComment({
        post_id: this.post.id,
        content: this.newCommentContent,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submittingComment = false;
          this.newCommentContent = '';
          this.loadComments();
        },
        error: (err) => {
          this.submittingComment = false;
          this.statusMessage = err.error?.message || 'Failed to post comment.';
        },
      });
  }

  onCommentDeleted(): void {
    this.loadComments();
  }

  onCommentReplied(): void {
    this.loadComments();
  }

  private organizeComments(comments: CommentModel[]): CommentModel[] {
    const commentMap = new Map<string, CommentModel>();
    const roots: CommentModel[] = [];

    // Initialize map
    comments.forEach((c) => {
      commentMap.set(c.id, { ...c, replies: [] });
    });

    // Build tree
    commentMap.forEach((c) => {
      if (c.parent_id) {
        const parent = commentMap.get(c.parent_id);
        if (parent && parent.replies) {
          parent.replies.push(c);
        } else {
          roots.push(c);
        }
      } else {
        roots.push(c);
      }
    });

    return roots;
  }

  publish(): void {
    if (!this.post || this.post.status === 'published' || this.publishing) {
      return;
    }

    this.publishing = true;
    this.postsApi
      .publishPost(this.post.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (post) => {
          this.post = post;
          this.publishing = false;
          this.statusMessage = 'Post published.';
        },
        error: (error: HttpErrorResponse) => {
          this.publishing = false;
          this.statusMessage =
            typeof error.error?.message === 'string' ? error.error.message : 'Failed to publish post.';
        },
      });
  }

  copyShareLink(): void {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }

    const url = window.location.href;
    navigator.clipboard
      .writeText(url)
      .then(() => {
        this.statusMessage = 'Share link copied.';
      })
      .catch(() => {
        this.statusMessage = 'Failed to copy link.';
      });
  }

  toggleHidden(): void {
    if (!this.post || this.moderating || !this.canModerate) {
      return;
    }

    this.moderating = true;
    const action$ = this.post.hidden_at ? this.postsApi.unhidePost(this.post.id) : this.postsApi.hidePost(this.post.id);
    action$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (post) => {
        this.post = post;
        this.moderating = false;
        this.statusMessage = post.hidden_at ? 'Post hidden.' : 'Post unhidden.';
      },
      error: (error: HttpErrorResponse) => {
        this.moderating = false;
        this.statusMessage =
          typeof error.error?.message === 'string' ? error.error.message : 'Moderation action failed.';
      },
    });
  }

  toggleLocked(): void {
    if (!this.post || this.moderating || !this.canModerate) {
      return;
    }

    this.moderating = true;
    const action$ = this.post.locked_at ? this.postsApi.unlockPost(this.post.id) : this.postsApi.lockPost(this.post.id);
    action$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (post) => {
        this.post = post;
        this.moderating = false;
        this.statusMessage = post.locked_at ? 'Post locked.' : 'Post unlocked.';
      },
      error: (error: HttpErrorResponse) => {
        this.moderating = false;
        this.statusMessage =
          typeof error.error?.message === 'string' ? error.error.message : 'Moderation action failed.';
      },
    });
  }

  get formattedContent(): string {
    const content = String(this.post?.content || '');
    return renderSafeMarkdownHtml(content, (rawJson: string) => {
        const encoded = this.tryEncodeViewerBlock(rawJson);
        if (!encoded) {
          return `<div class="preview-viewer-block invalid">Invalid viewer block</div>`;
        }
        return `<div class="preview-viewer-block"><a href="/view?state=${encoded}" target="_blank" rel="noopener noreferrer">Open embedded viewer block</a></div>`;
      });
  }

  private tryEncodeViewerBlock(rawJson: string): string | null {
    try {
      const parsed = JSON.parse(rawJson.trim()) as { ra?: unknown; dec?: unknown; fov?: unknown; survey?: unknown };
      return btoa(
        JSON.stringify({
          ra: Number(parsed.ra),
          dec: Number(parsed.dec),
          fov: Number(parsed.fov),
          survey: String(parsed.survey || 'VLASS'),
        }),
      )
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    } catch {
      return null;
    }
  }

  private computeCanModerate(postOwnerId: string): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    try {
      const raw = sessionStorage.getItem('auth_user');
      if (!raw) {
        return false;
      }
      const user = JSON.parse(raw) as { id?: unknown; role?: unknown };
      const isOwner = typeof user.id === 'string' && user.id === postOwnerId;
      const isModerator = user.role === 'moderator' || user.role === 'admin';
      return isOwner || isModerator;
    } catch {
      return false;
    }
  }
}
