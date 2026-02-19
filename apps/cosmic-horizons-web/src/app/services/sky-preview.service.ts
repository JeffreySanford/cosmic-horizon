import { isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, REQUEST } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface SkyPreview {
  geohash: string;
  imageUrl: string;
  personalized: boolean;
  source: 'cookie' | 'default' | 'browser';
  latitude: number | null;
  longitude: number | null;
}

interface GeolocationCoordinatesLike {
  latitude: number;
  longitude: number;
}

const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const GEOHASH_PRECISION = 4;
const LOCATION_COOKIE_NAME = 'cosmic_region';
const PREVIEW_ASSET_VERSION = '20260207';

@Injectable({
  providedIn: 'root',
})
export class SkyPreviewService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly request = inject(REQUEST, { optional: true });
  private readonly http = inject(HttpClient);

  getInitialPreview(): SkyPreview {
    const geohashFromCookie = this.getRegionFromCookie();
    if (geohashFromCookie) {
      return this.buildPreview(geohashFromCookie, 'cookie', null, null);
    }

    return this.buildPreview(this.fallbackRegionSeed(), 'default', null, null);
  }

  personalizeFromBrowserLocation(): Observable<SkyPreview | null> {
    if (!isPlatformBrowser(this.platformId) || !('geolocation' in navigator)) {
      return of(null);
    }

    return this.requestBrowserCoordinates().pipe(
      map((coordinates) => {
        const geohash = this.toGeohash(
          coordinates.latitude,
          coordinates.longitude,
        );
        this.setRegionCookie(geohash);
        return this.buildPreview(
          geohash,
          'browser',
          coordinates.latitude,
          coordinates.longitude,
        );
      }),
    );
  }

  personalizeFromCoordinates(
    latitude: number,
    longitude: number,
  ): Observable<SkyPreview> {
    // First attempt to get SSR-generated preview from backend for faster rendering
    if (isPlatformBrowser(this.platformId)) {
      return this.generateSsrPreviewFromBackend(latitude, longitude).pipe(
        catchError(() => {
          // Fall back to client-side geohashing if backend fails
          return this.generateClientPreview(latitude, longitude);
        }),
      );
    }
    // Server-side: use client preview directly
    return this.generateClientPreview(latitude, longitude);
  }

  private generateSsrPreviewFromBackend(
    latitude: number,
    longitude: number,
  ): Observable<SkyPreview> {
    return this.http
      .post<{ imageUrl: string }>('/api/preview/generate', {
        latitude,
        longitude,
      })
      .pipe(
        map((response) => {
          const geohash = this.toGeohash(latitude, longitude);
          this.setRegionCookie(geohash);
          return {
            geohash,
            imageUrl: response.imageUrl,
            personalized: true,
            source: 'browser',
            latitude,
            longitude,
          };
        }),
      );
  }

  private generateClientPreview(
    latitude: number,
    longitude: number,
  ): Observable<SkyPreview> {
    const geohash = this.toGeohash(latitude, longitude);
    this.setRegionCookie(geohash);
    return of(this.buildPreview(geohash, 'browser', latitude, longitude));
  }

  toGeohash(
    latitude: number,
    longitude: number,
    precision = GEOHASH_PRECISION,
  ): string {
    let latMin = -90;
    let latMax = 90;
    let lonMin = -180;
    let lonMax = 180;

    let geohash = '';
    let bit = 0;
    let ch = 0;
    let isEvenBit = true;

    while (geohash.length < precision) {
      if (isEvenBit) {
        const lonMid = (lonMin + lonMax) / 2;
        if (longitude >= lonMid) {
          ch |= 1 << (4 - bit);
          lonMin = lonMid;
        } else {
          lonMax = lonMid;
        }
      } else {
        const latMid = (latMin + latMax) / 2;
        if (latitude >= latMid) {
          ch |= 1 << (4 - bit);
          latMin = latMid;
        } else {
          latMax = latMid;
        }
      }

      isEvenBit = !isEvenBit;
      if (bit < 4) {
        bit += 1;
      } else {
        geohash += GEOHASH_BASE32[ch];
        bit = 0;
        ch = 0;
      }
    }

    return geohash;
  }

  private buildPreview(
    geohash: string,
    source: SkyPreview['source'],
    latitude: number | null,
    longitude: number | null,
  ): SkyPreview {
    const bucket = this.bucketFromGeohash(geohash);
    const imageUrl =
      source === 'default'
        ? `/previews/region-default.png?v=${PREVIEW_ASSET_VERSION}`
        : `/previews/region-${bucket}.png?v=${PREVIEW_ASSET_VERSION}`;

    return {
      geohash,
      imageUrl,
      personalized: source !== 'default',
      source,
      latitude,
      longitude,
    };
  }

  private bucketFromGeohash(geohash: string): number {
    const checksum = geohash
      .split('')
      .reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 7), 0);
    return checksum % 8;
  }

  private fallbackRegionSeed(): string {
    if (isPlatformBrowser(this.platformId)) {
      const language = (navigator.language || 'en-US').toLowerCase();
      return language.startsWith('en-us') ? 'dr5r' : 'u09t';
    }

    const acceptLanguage =
      this.request?.headers.get('accept-language')?.toLowerCase() || '';
    return acceptLanguage.startsWith('en-us') ? 'dr5r' : 'u09t';
  }

  private getRegionFromCookie(): string | null {
    const cookieValue = isPlatformBrowser(this.platformId)
      ? document.cookie
      : this.request?.headers.get('cookie');

    if (!cookieValue) {
      return null;
    }

    const raw = this.readCookie(cookieValue, LOCATION_COOKIE_NAME);
    if (!raw) {
      return null;
    }

    return /^[0-9bcdefghjkmnpqrstuvwxyz]{4}$/i.test(raw)
      ? raw.toLowerCase()
      : null;
  }

  private readCookie(cookieHeader: string, name: string): string | null {
    const cookiePairs = cookieHeader.split(';');

    for (const pair of cookiePairs) {
      const [rawKey, ...rawValueParts] = pair.trim().split('=');
      if (rawKey === name) {
        return decodeURIComponent(rawValueParts.join('='));
      }
    }

    return null;
  }

  private setRegionCookie(geohash: string): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const maxAgeSeconds = 60 * 60 * 24 * 30;
    document.cookie = `${LOCATION_COOKIE_NAME}=${encodeURIComponent(
      geohash,
    )}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
  }

  private requestBrowserCoordinates(): Observable<GeolocationCoordinatesLike> {
    return new Observable((observer) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          observer.next({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          observer.complete();
        },
        (error) => {
          observer.error(new Error(error.message));
        },
        {
          enableHighAccuracy: false,
          timeout: 6000,
          maximumAge: 15 * 60 * 1000,
        },
      );
    });
  }
}
