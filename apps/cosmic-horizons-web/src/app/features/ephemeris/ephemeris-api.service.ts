import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface EphemerisSearchRequest {
  target: string;
  epoch?: string;
  object_name?: string;
}

export interface EphemerisResult {
  target: string;
  epoch: string;
  ra: number;
  dec: number;
  accuracy_arcsec: number;
  source: 'astronomy-engine' | 'jpl-horizons' | 'cache';
  object_type: 'planet' | 'satellite' | 'asteroid';
  sky_preview_url?: string;
  aladin_url?: string;
}

@Injectable({
  providedIn: 'root',
})
export class EphemerisApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = 'http://localhost:3000';

  search(query: EphemerisSearchRequest): Observable<EphemerisResult> {
    const params = new URLSearchParams();
    if (query.target) params.append('target', query.target);
    if (query.object_name) params.append('object_name', query.object_name);
    if (query.epoch) params.append('epoch', query.epoch);

    return this.http.get<EphemerisResult>(
      `${this.apiBaseUrl}/api/view/ephem/search?${params.toString()}`
    );
  }
}
