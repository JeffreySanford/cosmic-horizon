import {
  AfterViewInit,
  Component,
  DestroyRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthSessionService } from '../../services/auth-session.service';
import { PostsApiService, PostModel } from './posts-api.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';

@Component({
  selector: 'app-posts-list',
  templateUrl: './posts-list.component.html',
  styleUrls: ['./posts-list.component.scss'],
  standalone: false,
})
export class PostsListComponent implements OnInit, AfterViewInit {
  posts: PostModel[] = [];
  loading = false;
  errorMessage = '';
  sortBy: 'recent' | 'author' | 'title' = 'recent';
  onlyMine = false;
  filterValue = '';
  displayedColumns: string[] = [
    'title',
    'author',
    'status',
    'updated',
    'published',
  ];
  dataSource = new MatTableDataSource<PostModel>([]);
  pageSize = 10;
  pageSizeOptions = [5, 10, 20];
  private paginator?: MatPaginator;
  private sort?: MatSort;

  @ViewChild(MatPaginator)
  set paginatorRef(value: MatPaginator | undefined) {
    this.paginator = value;
    this.dataSource.paginator = value ?? null;
  }

  @ViewChild(MatSort)
  set sortRef(value: MatSort | undefined) {
    this.sort = value;
    this.dataSource.sort = value ?? null;
  }

  private readonly postsApi = inject(PostsApiService);
  private readonly router = inject(Router);
  private readonly authSession = inject(AuthSessionService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    // Default to personal notebook view for standard users.
    this.onlyMine = !this.canModerate;

    this.loading = true;
    this.postsApi
      .getPublishedPosts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (posts) => {
          this.posts = posts;
          this.applyViewFilters();
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

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator ?? null;
    this.dataSource.sort = this.sort ?? null;
    this.dataSource.sortingDataAccessor = (item, property) => {
      switch (property) {
        case 'author':
          return this.authorName(item).toLowerCase();
        case 'updated':
          return new Date(item.updated_at).getTime();
        case 'published':
          return item.published_at ? new Date(item.published_at).getTime() : 0;
        default:
          return `${item[property as keyof PostModel] ?? ''}`.toLowerCase();
      }
    };
    this.onSortModeChange();
  }

  openPost(post: PostModel): void {
    this.router.navigate(['/posts', post.id]);
  }

  createDraft(): void {
    this.router.navigate(['/posts/new']);
  }

  openModeration(): void {
    this.router.navigate(['/moderation']);
  }

  get canModerate(): boolean {
    const role = this.authSession.getRole();
    return role === 'admin' || role === 'moderator';
  }

  get visiblePosts(): PostModel[] {
    return this.dataSource.data;
  }

  onSortModeChange(): void {
    const sortDirection = this.sortBy === 'recent' ? 'desc' : 'asc';
    const active = this.sortBy === 'recent' ? 'updated' : this.sortBy;
    if (this.sort) {
      this.sort.active = active;
      this.sort.direction = sortDirection;
      this.sort.sortChange.emit({
        active,
        direction: sortDirection,
      });
      return;
    }

    this.dataSource.data = this.sortPosts(this.dataSource.data);
  }

  onToggleOnlyMine(): void {
    this.applyViewFilters();
  }

  applyFilter(value: string): void {
    this.filterValue = value;
    this.applyViewFilters();
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

  private applyViewFilters(): void {
    const mineId = this.currentUserId();
    const byRole =
      this.onlyMine && mineId
        ? this.posts.filter((post) => post.user_id === mineId)
        : this.posts;

    const loweredFilter = this.filterValue.trim().toLowerCase();
    const filtered = loweredFilter
      ? byRole.filter((post) => {
          const haystack = [
            post.title,
            this.authorName(post),
            post.status,
            post.content,
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(loweredFilter);
        })
      : byRole;

    this.dataSource.data = filtered;
    this.onSortModeChange();
    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  private sortPosts(posts: PostModel[]): PostModel[] {
    const sorted = [...posts];

    switch (this.sortBy) {
      case 'author':
        sorted.sort((a, b) =>
          this.authorName(a).localeCompare(this.authorName(b)),
        );
        break;
      case 'title':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'recent':
      default:
        sorted.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        );
        break;
    }

    return sorted;
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
