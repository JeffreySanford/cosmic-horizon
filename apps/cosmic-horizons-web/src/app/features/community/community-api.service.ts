import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
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

  constructor(private readonly http: HttpClient) {}

  getFeed(): Observable<DiscoveryModel[]> {
    return this.http.get<DiscoveryModel[]>(`${this.apiBase}/api/community/feed`);
  }

  createPost(payload: { title: string; body?: string; author?: string; tags?: string[] }) {
    return this.http.post<DiscoveryModel>(`${this.apiBase}/api/community/posts`, payload);
  }
}
