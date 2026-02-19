import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { PostsApiService, PostModel } from './posts-api.service';

@Component({
  selector: 'app-posts-list',
  templateUrl: './posts-list.component.html',
  styleUrls: ['./posts-list.component.scss'],
  standalone: false,
})
export class PostsListComponent implements OnInit {
  posts: PostModel[] = [];
  loading = false;
  errorMessage = '';
  sortBy: 'recent' | 'author' | 'title' = 'recent';
  onlyMine = false;

  private readonly postsApi = inject(PostsApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.loading = true;
    this.postsApi
      .getPublishedPosts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (posts) => {
          this.posts = posts;
          this.loading = false;
        },
        error: (error: HttpErrorResponse) => {
          this.errorMessage =
            typeof error.error?.message === 'string'
              ? error.error.message
              : 'Failed to load published posts.';
          this.loading = false;
        },
      });
  }

  openPost(post: PostModel): void {
    this.router.navigate(['/posts', post.id]);
  }

  createDraft(): void {
    this.router.navigate(['/posts/new']);
  }

  get visiblePosts(): PostModel[] {
    const mineId = this.currentUserId();
    const filtered =
      this.onlyMine && mineId
        ? this.posts.filter((post) => post.user_id === mineId)
        : this.posts;

    const posts = [...filtered];
    if (this.sortBy === 'author') {
      return posts.sort((a, b) =>
        this.authorName(a).localeCompare(this.authorName(b)),
      );
    }
    if (this.sortBy === 'title') {
      return posts.sort((a, b) => a.title.localeCompare(b.title));
    }

    return posts.sort((a, b) => {
      const aDate = new Date(a.published_at || a.updated_at).getTime();
      const bDate = new Date(b.published_at || b.updated_at).getTime();
      return bDate - aDate;
    });
  }

  authorName(post: PostModel): string {
    return post.user?.display_name || post.user?.username || 'Unknown author';
  }

  excerpt(post: PostModel): string {
    const normalized = post.content.replace(/\s+/g, ' ').trim();
    return normalized.length > 150
      ? `${normalized.slice(0, 150)}...`
      : normalized;
  }

  private currentUserId(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      const raw = sessionStorage.getItem('auth_user');
      if (!raw) {
        return null;
      }
      const user = JSON.parse(raw) as { id?: unknown };
      return typeof user.id === 'string' ? user.id : null;
    } catch {
      return null;
    }
  }
}
