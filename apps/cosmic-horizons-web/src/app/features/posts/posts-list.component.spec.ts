import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostsApiService } from './posts-api.service';
import { PostsListComponent } from './posts-list.component';
import { AuthSessionService } from '../../services/auth-session.service';

describe('PostsListComponent', () => {
  let fixture: ComponentFixture<PostsListComponent>;
  let component: PostsListComponent;
  let postsApi: { getPublishedPosts: ReturnType<typeof vi.fn> };
  let authSession: { getRole: ReturnType<typeof vi.fn> };
  let router: Router;

  beforeEach(async () => {
    postsApi = {
      getPublishedPosts: vi.fn().mockReturnValue(
        of([
          {
            id: 'post-1',
            user_id: 'user-1',
            title: 'First notebook post',
            content: 'content',
            status: 'published',
            published_at: '2026-02-07T00:00:00.000Z',
            created_at: '2026-02-07T00:00:00.000Z',
            updated_at: '2026-02-07T00:00:00.000Z',
            user: {
              id: 'user-1',
              username: 'astro',
              display_name: 'Astro',
              email: null,
            },
          },
        ]),
      ),
    };
    authSession = {
      getRole: vi.fn(() => 'user'),
    };

    await TestBed.configureTestingModule({
      declarations: [PostsListComponent],
      imports: [RouterTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: PostsApiService,
          useValue: postsApi,
        },
        {
          provide: AuthSessionService,
          useValue: authSession,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PostsListComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('loads published posts and renders titles', () => {
    expect(postsApi.getPublishedPosts).toHaveBeenCalled();
    expect(component.posts.length).toBe(1);
    expect(component.posts[0].title).toBe('First notebook post');
    expect(component.dataSource.data[0].title).toBe('First notebook post');
  });

  it('sets error message when loading fails', () => {
    postsApi.getPublishedPosts.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            error: { message: 'Load failed.' },
            status: 500,
          }),
      ),
    );

    component.ngOnInit();
    expect(component.errorMessage).toBe('Load failed.');
    expect(component.loading).toBe(false);
  });

  it('navigates to post detail on openPost', () => {
    component.openPost({
      id: 'post-1',
      user_id: 'user-1',
      title: 'First notebook post',
      content: 'content',
      status: 'published',
      published_at: '2026-02-07T00:00:00.000Z',
      created_at: '2026-02-07T00:00:00.000Z',
      updated_at: '2026-02-07T00:00:00.000Z',
    });

    expect(router.navigate).toHaveBeenCalledWith(['/posts', 'post-1']);
  });

  it('navigates to editor on createDraft', () => {
    component.createDraft();
    expect(router.navigate).toHaveBeenCalledWith(['/posts/new']);
  });
});
