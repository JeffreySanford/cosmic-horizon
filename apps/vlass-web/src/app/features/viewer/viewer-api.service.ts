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

@Injectable({
  providedIn: 'root',
})
export class ViewerApiService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = 'http://localhost:3001';

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
}
