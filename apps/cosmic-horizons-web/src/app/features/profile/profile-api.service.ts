import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Observable } from 'rxjs';
import { PostModel, PostUserModel } from '../posts/posts-api.service';

export interface ProfileModel {
  user: PostUserModel & {
    bio?: string;
    avatar_url?: string;
    created_at: string;
  };
  posts: PostModel[];
}

@Injectable({
  providedIn: 'root',
})
export class ProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiBaseUrl = 'http://localhost:3000';

  getProfile(username: string): Observable<ProfileModel> {
    return this.http.get<ProfileModel>(
      `${this.apiBaseUrl}/api/profiles/${encodeURIComponent(username)}`,
    );
  }

  updateProfile(data: {
    display_name?: string;
    bio?: string;
    avatar_url?: string;
  }): Observable<ProfileModel['user']> {
    return this.http.put<ProfileModel['user']>(
      `${this.apiBaseUrl}/api/profiles/me`,
      data,
      {
        headers: this.authHeaders(),
      },
    );
  }

  private authHeaders(): HttpHeaders {
    if (isPlatformBrowser(this.platformId)) {
      const token = sessionStorage.getItem('auth_token');
      if (token) {
        return new HttpHeaders().set('Authorization', `Bearer ${token}`);
      }
    }
    return new HttpHeaders();
  }
}
