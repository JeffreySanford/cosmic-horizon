import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface DiscoveryModel {
  id: string;
  title: string;
  body?: string;
  author?: string;
  tags?: string[];
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class CommunityApiService {
  private readonly apiBase = 'http://localhost:3000';
  private readonly http = inject(HttpClient);

  getFeed(): Observable<DiscoveryModel[]> {
    return this.http.get<DiscoveryModel[]>(
      `${this.apiBase}/api/community/feed`,
    );
  }

  // Admin: get pending (hidden) discoveries
  getPending(): Observable<DiscoveryModel[]> {
    return this.http.get<DiscoveryModel[]>(
      `${this.apiBase}/api/community/posts/pending`,
    );
  }

  createPost(
    payload: { title: string; body?: string; author?: string; tags?: string[] },
    opts?: { forceHidden?: boolean },
  ) {
    const qp = opts?.forceHidden ? '?forceHidden=true' : '';
    return this.http.post<DiscoveryModel>(
      `${this.apiBase}/api/community/posts${qp}`,
      payload,
    );
  }

  approvePost(id: string) {
    return this.http.patch(
      `${this.apiBase}/api/community/posts/${id}/approve`,
      {},
    );
  }

  hidePost(id: string) {
    return this.http.patch(
      `${this.apiBase}/api/community/posts/${id}/hide`,
      {},
    );
  }
}
