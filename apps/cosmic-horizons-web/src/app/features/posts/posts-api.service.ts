import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Observable } from 'rxjs';

export type PostStatus = 'draft' | 'published';

export interface PostUserModel {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
}

export interface PostModel {
  id: string;
  user_id: string;
  title: string;
  content: string;
  status: PostStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  hidden_at?: string | null;
  locked_at?: string | null;
  user?: PostUserModel;
}

@Injectable({
  providedIn: 'root',
})
export class PostsApiService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiBaseUrl = 'http://localhost:3000';

  getPublishedPosts(): Observable<PostModel[]> {
    return this.http.get<PostModel[]>(
      `${this.apiBaseUrl}/api/posts/published`,
      {
        headers: this.authHeaders(),
      },
    );
  }

  getPostById(id: string): Observable<PostModel> {
    return this.http.get<PostModel>(
      `${this.apiBaseUrl}/api/posts/${encodeURIComponent(id)}`,
      {
        headers: this.authHeaders(),
      },
    );
  }

  createPost(payload: {
    title: string;
    content: string;
  }): Observable<PostModel> {
    return this.http.post<PostModel>(`${this.apiBaseUrl}/api/posts`, payload, {
      headers: this.authHeaders(),
    });
  }

  updatePost(
    id: string,
    payload: { title?: string; content?: string },
  ): Observable<PostModel> {
    return this.http.put<PostModel>(
      `${this.apiBaseUrl}/api/posts/${encodeURIComponent(id)}`,
      payload,
      {
        headers: this.authHeaders(),
      },
    );
  }

  publishPost(id: string): Observable<PostModel> {
    return this.http.post<PostModel>(
      `${this.apiBaseUrl}/api/posts/${encodeURIComponent(id)}/publish`,
      {},
      {
        headers: this.authHeaders(),
      },
    );
  }

  hidePost(id: string): Observable<PostModel> {
    return this.http.post<PostModel>(
      `${this.apiBaseUrl}/api/posts/${encodeURIComponent(id)}/hide`,
      {},
      {
        headers: this.authHeaders(),
      },
    );
  }

  unhidePost(id: string): Observable<PostModel> {
    return this.http.post<PostModel>(
      `${this.apiBaseUrl}/api/posts/${encodeURIComponent(id)}/unhide`,
      {},
      {
        headers: this.authHeaders(),
      },
    );
  }

  lockPost(id: string): Observable<PostModel> {
    return this.http.post<PostModel>(
      `${this.apiBaseUrl}/api/posts/${encodeURIComponent(id)}/lock`,
      {},
      {
        headers: this.authHeaders(),
      },
    );
  }

  unlockPost(id: string): Observable<PostModel> {
    return this.http.post<PostModel>(
      `${this.apiBaseUrl}/api/posts/${encodeURIComponent(id)}/unlock`,
      {},
      {
        headers: this.authHeaders(),
      },
    );
  }

  private authHeaders(): HttpHeaders {
    if (!isPlatformBrowser(this.platformId)) {
      return new HttpHeaders();
    }

    const token = sessionStorage.getItem('auth_token');
    if (!token) {
      return new HttpHeaders();
    }

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }
}
