import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { Store } from '@ngrx/store';
import * as EphemerisActions from '../store/features/ephemeris/ephemeris.actions';
import { selectEphemerisCalculating } from '../store/features/ephemeris/ephemeris.selectors';
import { AppState } from '../store/app.state';

export interface EphemerisResult {
  ra: number;
  dec: number;
  accuracy_arcsec: number;
  epoch: string;
  source: 'astronomy-engine' | 'jpl-horizons' | 'cache';
  object_type: 'planet' | 'satellite' | 'asteroid';
}

export interface EphemerisCache {
  timestamp: number;
  result: EphemerisResult;
}

@Injectable({
  providedIn: 'root',
})
export class EphemerisService {
  private readonly CACHE_TTL_MS = 86400000; // 24 hours
  private cache = new Map<string, EphemerisCache>();
  private http = inject(HttpClient);
  private readonly store = inject<Store<AppState>>(Store);

  public calculating$ = this.store.select(selectEphemerisCalculating);

  /**
   * Calculate ephemeris position for a celestial object
   */
  calculatePosition(
    objectName: string,
    epoch?: string,
  ): Observable<EphemerisResult | null> {
    const normalizedName = objectName.toLowerCase();
    const epochToUse = epoch || new Date().toISOString();
    const cacheKey = this.getCacheKey(normalizedName, epochToUse);

    // Check local cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      const result = { ...cached, source: 'cache' } as EphemerisResult;
      this.store.dispatch(EphemerisActions.ephemerisCalculateSucceeded({ result }));
      return of(result);
    }

    this.store.dispatch(EphemerisActions.ephemerisCalculateRequested({ objectName: normalizedName, epoch: epochToUse }));

    return this.http
      .post<EphemerisResult>('/api/ephemeris/calculate', {
        object: normalizedName,
        epoch: epochToUse,
      })
      .pipe(
        tap((result) => {
          if (result) {
            this.setCache(cacheKey, result);
            this.store.dispatch(EphemerisActions.ephemerisCalculateSucceeded({ result }));
          }
        }),
        catchError(() => {
          this.store.dispatch(EphemerisActions.ephemerisCalculateFailed({ error: 'Unable to calculate ephemeris position' }));
          return of(null);
        }),
      );
  }

  /**
   * Calculate positions for multiple objects
   */
  calculateMultiplePositions(
    objectNames: string[],
    epoch?: string,
  ): Observable<(EphemerisResult | null)[]> {
    const epochToUse = epoch || new Date().toISOString();

    return this.http
      .post<EphemerisResult[]>('/api/ephemeris/calculate-multiple', {
        objects: objectNames,
        epoch: epochToUse,
      })
      .pipe(
        tap((results) => {
          results.forEach((result, index) => {
            if (result) {
              const cacheKey = this.getCacheKey(objectNames[index], epochToUse);
              this.setCache(cacheKey, result);
            }
          });
        }),
        catchError(() => {
          return of(objectNames.map(() => null));
        }),
      );
  }

  /**
   * Get supported celestial objects
   */
  getSupportedObjects(): Observable<string[]> {
    this.store.dispatch(EphemerisActions.ephemerisSupportedObjectsLoadRequested());
    return this.http
      .get<{ objects: string[] }>('/api/ephemeris/supported-objects')
      .pipe(
        map((response) => {
          this.store.dispatch(EphemerisActions.ephemerisSupportedObjectsLoadSucceeded({ objects: response.objects }));
          return response.objects;
        }),
        catchError(() => {
          this.store.dispatch(EphemerisActions.ephemerisSupportedObjectsLoadFailed({ error: 'Unable to load supported objects' }));
          return of([]);
        }),
      );
  }

  /**
   * Clear the local cache
   */
  clearCache(): void {
    this.cache.clear();
    this.store.dispatch(EphemerisActions.ephemerisCacheCleared());
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; ttl_ms: number } {
    return {
      size: this.cache.size,
      ttl_ms: this.CACHE_TTL_MS,
    };
  }

  private getCacheKey(objectName: string, epoch: string): string {
    const dateOnly = epoch.split('T')[0];
    return `ephem:${objectName}:${dateOnly}`;
  }

  private getFromCache(cacheKey: string): EphemerisResult | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) {
      return null;
    }

    if (Date.now() - cached.timestamp > this.CACHE_TTL_MS) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  private setCache(cacheKey: string, result: EphemerisResult): void {
    this.cache.set(cacheKey, {
      timestamp: Date.now(),
      result,
    });
  }
}
