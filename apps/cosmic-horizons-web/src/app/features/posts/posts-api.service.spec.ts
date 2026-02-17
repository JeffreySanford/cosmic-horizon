import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PostsApiService } from './posts-api.service';
import { firstValueFrom } from 'rxjs';

describe('PostsApiService', () => {
  let service: PostsApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  const configure = (platformId: 'browser' | 'server'): void => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        PostsApiService,
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    });

    service = TestBed.inject(PostsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  };

  it('gets published posts with bearer token in browser mode', async () => {
    configure('browser');
    sessionStorage.setItem('auth_token', 'token-123');

    const p = firstValueFrom(service.getPublishedPosts());

    const req = httpMock.expectOne('http://localhost:3000/api/posts/published');
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-123');
    req.flush([]);

    await p;
  });

  it('gets a post by id and URL-encodes identifier', async () => {
    configure('browser');
    sessionStorage.setItem('auth_token', 'token-123');

    const p = firstValueFrom(service.getPostById('post/id'));

    const req = httpMock.expectOne('http://localhost:3000/api/posts/post%2Fid');
    expect(req.request.method).toBe('GET');
    req.flush({});

    await p;
  });

  it('creates a post via POST', async () => {
    configure('browser');
    sessionStorage.setItem('auth_token', 'token-123');

    const p = firstValueFrom(service.createPost({ title: 'Title', content: 'Body content for post.' }));

    const req = httpMock.expectOne('http://localhost:3000/api/posts');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'Title', content: 'Body content for post.' });
    req.flush({});

    await p;
  });

  it('updates a post via PUT', async () => {
    configure('browser');
    sessionStorage.setItem('auth_token', 'token-123');

    const p = firstValueFrom(service.updatePost('post-1', { title: 'Updated' }));

    const req = httpMock.expectOne('http://localhost:3000/api/posts/post-1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ title: 'Updated' });
    req.flush({});

    await p;
  });

  it('publishes a post via POST to /publish', async () => {
    configure('browser');
    sessionStorage.setItem('auth_token', 'token-123');

    const p = firstValueFrom(service.publishPost('post-1'));

    const req = httpMock.expectOne('http://localhost:3000/api/posts/post-1/publish');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({});

    await p;
  });

  it('omits auth header in server mode', async () => {
    configure('server');
    sessionStorage.setItem('auth_token', 'token-123');

    const p = firstValueFrom(service.getPublishedPosts());

    const req = httpMock.expectOne('http://localhost:3000/api/posts/published');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);

    await p;
  });

  it('hides and locks post through moderation endpoints', async () => {
    configure('browser');
    sessionStorage.setItem('auth_token', 'token-123');

    const pHide = firstValueFrom(service.hidePost('post-1'));
    const pLock = firstValueFrom(service.lockPost('post-1'));

    const hideReq = httpMock.expectOne('http://localhost:3000/api/posts/post-1/hide');
    expect(hideReq.request.method).toBe('POST');
    hideReq.flush({});

    const lockReq = httpMock.expectOne('http://localhost:3000/api/posts/post-1/lock');
    expect(lockReq.request.method).toBe('POST');
    lockReq.flush({});

    await Promise.all([pHide, pLock]);
  });
});
