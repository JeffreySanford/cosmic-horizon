import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, REQUEST } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { SkyPreviewService } from './sky-preview.service';

describe('SkyPreviewService', () => {
  afterEach(() => {
    document.cookie = 'vlass_region=; Max-Age=0; Path=/';
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('encodes coarse geohash (precision 4) from coordinates', () => {
    TestBed.configureTestingModule({
      providers: [
        SkyPreviewService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: REQUEST, useValue: null },
      ],
    });

    const service = TestBed.inject(SkyPreviewService);
    expect(service.toGeohash(40.7128, -74.006, 4)).toBe('dr5r');
  });

  it('uses vlass_region cookie when available', () => {
    document.cookie = 'vlass_region=u09t; Path=/';

    TestBed.configureTestingModule({
      providers: [
        SkyPreviewService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: REQUEST, useValue: null },
      ],
    });

    const service = TestBed.inject(SkyPreviewService);
    const preview = service.getInitialPreview();

    expect(preview.geohash).toBe('u09t');
    expect(preview.personalized).toBe(true);
    expect(preview.imageUrl).toMatch(/^\/previews\/region-\d\.png\?v=\d+$/);
  });

  it('falls back on server request headers when no location cookie exists', () => {
    const req = new Request('http://localhost/landing', {
      headers: {
        'accept-language': 'en-US,en;q=0.9',
      },
    });

    TestBed.configureTestingModule({
      providers: [
        SkyPreviewService,
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: REQUEST, useValue: req },
      ],
    });

    const service = TestBed.inject(SkyPreviewService);
    const preview = service.getInitialPreview();

    expect(preview.geohash).toBe('dr5r');
    expect(preview.personalized).toBe(false);
    expect(preview.source).toBe('default');
  });

  it('stores browser-derived location as coarse geohash cookie', async () => {
    const geolocationMock = {
      getCurrentPosition: (success: (position: GeolocationPosition) => void) => {
        success({
          coords: {
            latitude: 34.0522,
            longitude: -118.2437,
          },
        } as GeolocationPosition);
      },
    };

    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: geolocationMock,
    });

    TestBed.configureTestingModule({
      providers: [
        SkyPreviewService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: REQUEST, useValue: null },
      ],
    });

    const service = TestBed.inject(SkyPreviewService);
    const preview = await firstValueFrom(service.personalizeFromBrowserLocation());

    expect(preview).not.toBeNull();
    expect(preview?.source).toBe('browser');
    expect(preview?.geohash).toHaveLength(4);
    expect(document.cookie).toContain('vlass_region=');
  });
});
