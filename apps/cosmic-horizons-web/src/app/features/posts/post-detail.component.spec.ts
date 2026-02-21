import { NO_ERRORS_SCHEMA } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostsApiService } from './posts-api.service';
import { PostDetailComponent } from './post-detail.component';
import { provideMockStore } from '@ngrx/store/testing';

describe('PostDetailComponent', () => {
  let fixture: ComponentFixture<PostDetailComponent>;
  let component: PostDetailComponent;
  let postsApi: {
    getPostById: ReturnType<typeof vi.fn>;
    publishPost: ReturnType<typeof vi.fn>;
  };
  let router: Router;
  const initialStoreState = {
    auth: {
      accessToken: null,
      refreshToken: null,
      user: null,
      role: 'guest',
      hydrated: true,
      loading: false,
      error: null,
    },
    ui: { mockModeEnabled: true },
    jobs: { ids: [], entities: {}, selectedJobId: null, loading: false, error: null },
    alerts: { alerts: [], loading: false, error: null },
    logs: { entries: [] },
    telemetry: { cpuHistory: [], gpuHistory: [], selectedIndex: 0, loading: false, error: null },
    ephemeris: { calculating: false, lastResult: null, supportedObjects: [], error: null },
    router: null,
  } as const;

  beforeEach(async () => {
    postsApi = {
      getPostById: vi.fn().mockReturnValue(
        of({
          id: 'post-1',
          user_id: 'user-1',
          title: 'Notebook Post',
          content: 'Markdown content',
          status: 'draft',
          published_at: null,
          created_at: '2026-02-07T00:00:00.000Z',
          updated_at: '2026-02-07T00:00:00.000Z',
        }),
      ),
      publishPost: vi.fn().mockReturnValue(
        of({
          id: 'post-1',
          user_id: 'user-1',
          title: 'Notebook Post',
          content: 'Markdown content',
          status: 'published',
          published_at: '2026-02-07T01:00:00.000Z',
          created_at: '2026-02-07T00:00:00.000Z',
          updated_at: '2026-02-07T01:00:00.000Z',
        }),
      ),
    };

    await TestBed.configureTestingModule({
      declarations: [PostDetailComponent],
      imports: [RouterTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: PostsApiService,
          useValue: postsApi,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'post-1' }),
            },
          },
        },
        provideMockStore({ initialState: initialStoreState }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PostDetailComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('loads post by route id', () => {
    expect(postsApi.getPostById).toHaveBeenCalledWith('post-1');
    expect(component.post?.title).toBe('Notebook Post');
  });

  it('publishes draft post', () => {
    component.publish();
    expect(postsApi.publishPost).toHaveBeenCalledWith('post-1');
    expect(component.post?.status).toBe('published');
  });

  it('does not publish when no post is loaded', () => {
    component.post = null;
    component.publish();
    expect(postsApi.publishPost).not.toHaveBeenCalled();
  });

  it('shows API error when loading a post fails', () => {
    postsApi.getPostById.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            error: { message: 'Missing post.' },
            status: 404,
          }),
      ),
    );

    component.ngOnInit();
    expect(component.statusMessage).toBe('Missing post.');
  });

  it('navigates back to feed when id is missing', async () => {
    TestBed.resetTestingModule();
    postsApi = {
      getPostById: vi.fn(),
      publishPost: vi.fn(),
    };
    await TestBed.configureTestingModule({
      declarations: [PostDetailComponent],
      imports: [RouterTestingModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: PostsApiService,
          useValue: postsApi,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({}),
            },
          },
        },
        provideMockStore({ initialState: initialStoreState }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PostDetailComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.ngOnInit();

    expect(navigateSpy).toHaveBeenCalledWith(['/posts']);
    expect(postsApi.getPostById).not.toHaveBeenCalled();
  });
});
