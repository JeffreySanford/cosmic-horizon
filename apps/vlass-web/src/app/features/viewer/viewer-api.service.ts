import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ViewerStateModel {
  ra: number;
  dec: number;
  fov: number;
  survey: string;
  labels?: ViewerLabelModel[];
}

export interface ViewerLabelModel {
  name: string;
  ra: number;
  dec: number;
  created_at: string;
}

export interface ViewerStateResponse {
  id: string;
  short_id: string;
  encoded_state: string;
  state: ViewerStateModel;
  permalink_path: string;
  created_at: string;
}

export interface ViewerSnapshotResponse {
  id: string;
  image_url: string;
  short_id: string | null;
  size_bytes: number;
  created_at: string;
}

export interface NearbyCatalogLabelModel {
  name: string;
  ra: number;
  dec: number;
  object_type: string;
  angular_distance_deg: number;
  confidence: number;
}

export interface CutoutTelemetryFailureModel {
  at: string;
  reason: string;
}

export interface CutoutTelemetryModel {
  requests_total: number;
  success_total: number;
  failure_total: number;
  provider_attempts_total: number;
  provider_failures_total: number;
  cache_hits_total: number;
  resolution_fallback_total: number;
  survey_fallback_total: number;
  consecutive_failures: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_failure_reason: string | null;
  recent_failures: CutoutTelemetryFailureModel[];
}

@Injectable({
  providedIn: 'root',
})
export class ViewerApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = 'http://localhost:3000';

  createState(state: ViewerStateModel): Observable<ViewerStateResponse> {
    return this.http.post<ViewerStateResponse>(`${this.apiBaseUrl}/api/view/state`, { state });
  }

  resolveState(shortId: string): Observable<ViewerStateResponse> {
    return this.http.get<ViewerStateResponse>(`${this.apiBaseUrl}/api/view/${encodeURIComponent(shortId)}`);
  }

  createSnapshot(payload: {
    image_data_url: string;
    short_id?: string;
    state?: ViewerStateModel;
  }): Observable<ViewerSnapshotResponse> {
    return this.http.post<ViewerSnapshotResponse>(`${this.apiBaseUrl}/api/view/snapshot`, payload);
  }

  getNearbyLabels(ra: number, dec: number, radiusDeg: number, limit = 12): Observable<NearbyCatalogLabelModel[]> {
    const params = new URLSearchParams({
      ra: ra.toString(),
      dec: dec.toString(),
      radius: radiusDeg.toString(),
      limit: limit.toString(),
    });

    return this.http.get<NearbyCatalogLabelModel[]>(`${this.apiBaseUrl}/api/view/labels/nearby?${params.toString()}`);
  }

  getCutoutTelemetry(): Observable<CutoutTelemetryModel> {
    return this.http.get<CutoutTelemetryModel>(`${this.apiBaseUrl}/api/view/telemetry`);
  }

  scienceDataUrl(state: ViewerStateModel, label?: string, detail: 'standard' | 'high' | 'max' = 'standard'): string {
    const params = new URLSearchParams({
      ra: state.ra.toString(),
      dec: state.dec.toString(),
      fov: state.fov.toString(),
      survey: state.survey,
    });

    if (label && label.trim().length > 0) {
      params.set('label', label.trim());
    }
    params.set('detail', detail);

    return `${this.apiBaseUrl}/api/view/cutout?${params.toString()}`;
  }

  resolveEphemeris(target: string): Observable<{ ra: number; dec: number }> {
    return this.http.get<{ ra: number; dec: number }>(
      `${this.apiBaseUrl}/api/view/ephem/search?target=${encodeURIComponent(target)}`,
    );
  }
}
