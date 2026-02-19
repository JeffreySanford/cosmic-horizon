import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Observable } from 'rxjs';
import { PostUserModel } from './posts-api.service';

export interface CommentModel {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  hidden_at: string | null;
  user?: PostUserModel;
  replies?: CommentModel[];
}

export interface CommentReportModel {
  id: string;
  comment_id: string;
  user_id: string;
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'dismissed';
  created_at: string;
  user?: PostUserModel;
  comment?: CommentModel;
}

@Injectable({
  providedIn: 'root',
})
export class CommentsApiService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiBaseUrl = 'http://localhost:3000';

  getCommentsByPost(postId: string): Observable<CommentModel[]> {
    return this.http.get<CommentModel[]>(
      `${this.apiBaseUrl}/api/comments/post/${encodeURIComponent(postId)}`,
    );
  }

  createComment(payload: {
    post_id: string;
    content: string;
    parent_id?: string;
  }): Observable<CommentModel> {
    return this.http.post<CommentModel>(
      `${this.apiBaseUrl}/api/comments`,
      payload,
      {
        headers: this.authHeaders(),
      },
    );
  }

  updateComment(id: string, content: string): Observable<CommentModel> {
    return this.http.put<CommentModel>(
      `${this.apiBaseUrl}/api/comments/${encodeURIComponent(id)}`,
      { content },
      {
        headers: this.authHeaders(),
      },
    );
  }

  deleteComment(id: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiBaseUrl}/api/comments/${encodeURIComponent(id)}`,
      {
        headers: this.authHeaders(),
      },
    );
  }

  reportComment(
    id: string,
    payload: { reason: string; description?: string },
  ): Observable<CommentReportModel> {
    return this.http.post<CommentReportModel>(
      `${this.apiBaseUrl}/api/comments/${encodeURIComponent(id)}/report`,
      payload,
      {
        headers: this.authHeaders(),
      },
    );
  }

  hideComment(id: string): Observable<CommentModel> {
    return this.http.patch<CommentModel>(
      `${this.apiBaseUrl}/api/comments/${encodeURIComponent(id)}/hide`,
      {},
      {
        headers: this.authHeaders(),
      },
    );
  }

  unhideComment(id: string): Observable<CommentModel> {
    return this.http.patch<CommentModel>(
      `${this.apiBaseUrl}/api/comments/${encodeURIComponent(id)}/unhide`,
      {},
      {
        headers: this.authHeaders(),
      },
    );
  }

  getAllReports(): Observable<CommentReportModel[]> {
    return this.http.get<CommentReportModel[]>(
      `${this.apiBaseUrl}/api/comments/reports/all`,
      {
        headers: this.authHeaders(),
      },
    );
  }

  resolveReport(
    id: string,
    status: 'reviewed' | 'dismissed',
  ): Observable<CommentReportModel> {
    return this.http.patch<CommentReportModel>(
      `${this.apiBaseUrl}/api/comments/reports/${encodeURIComponent(id)}/resolve`,
      { status },
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

    return new HttpHeaders().set('Authorization', `Bearer ${token}`);
  }
}
