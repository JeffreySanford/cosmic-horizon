import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { EphemerisService, EphemerisResult } from './ephemeris.service';
import { firstValueFrom } from 'rxjs';

describe('EphemerisService (Web)', () => {
  let service: EphemerisService;
  let httpMock: HttpTestingController;

  const mockEphemerisResult: EphemerisResult = {
    ra: 100.25,
    dec: 20.5,
    accuracy_arcsec: 0.1,
    epoch: '2026-02-11T12:00:00Z',
    source: 'astronomy-engine',
    object_type: 'planet',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [EphemerisService],
    });

    service = TestBed.inject(EphemerisService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    service.clearCache();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should calculate position for Mars', async () => {
    const epoch = '2026-02-11T12:00:00Z';

    const resultPromise = firstValueFrom(
      service.calculatePosition('Mars', epoch),
    );

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      object: 'mars',
      epoch: epoch,
    });
    req.flush(mockEphemerisResult);

    const result = await resultPromise;
    expect(result).toEqual(expect.objectContaining(mockEphemerisResult));
    expect(result?.source).not.toBe('cache');
  });

  it('should use cached result on second request for same object', async () => {
    const epoch = '2026-02-11T12:00:00Z';

    const first = firstValueFrom(service.calculatePosition('Mars', epoch));
    const req = httpMock.expectOne('/api/ephemeris/calculate');
    req.flush(mockEphemerisResult);
    await first;

    const second = await firstValueFrom(
      service.calculatePosition('Mars', epoch),
    );
    expect(second?.source).toBe('cache');

    // Second request should not generate HTTP call
    httpMock.expectNone('/api/ephemeris/calculate');
  });

  it('should handle different objects separately in cache', async () => {
    const epoch = '2026-02-11T12:00:00Z';

    const p1 = firstValueFrom(service.calculatePosition('Mars', epoch));
    const p2 = firstValueFrom(service.calculatePosition('Venus', epoch));

    const reqs = httpMock.match('/api/ephemeris/calculate');
    expect(reqs).toHaveLength(2);
    reqs[0].flush(mockEphemerisResult);
    reqs[1].flush({ ...mockEphemerisResult, object_type: 'planet' });

    await Promise.all([p1, p2]);
  });

  it('should use current time when epoch not provided', async () => {
    const p = firstValueFrom(service.calculatePosition('Mars'));

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    expect(req.request.body.epoch).toBeDefined();
    expect(typeof req.request.body.epoch).toBe('string');
    req.flush(mockEphemerisResult);

    await p;
  });

  it('should handle HTTP errors gracefully', async () => {
    const p = firstValueFrom(
      service.calculatePosition('Mars', '2026-02-11T12:00:00Z'),
    );

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    req.error(new ErrorEvent('Network error'));

    const result = await p;
    expect(result).toBeNull();
  });

  it('should calculate multiple positions', async () => {
    const epoch = '2026-02-11T12:00:00Z';
    const objects = ['Mars', 'Venus', 'Mercury'];

    const p = firstValueFrom(
      service.calculateMultiplePositions(objects, epoch),
    );

    const req = httpMock.expectOne('/api/ephemeris/calculate-multiple');
    expect(req.request.body).toEqual({
      objects: objects,
      epoch: epoch,
    });
    const multipleResults = [
      mockEphemerisResult,
      { ...mockEphemerisResult, ra: 110 },
      { ...mockEphemerisResult, ra: 120 },
    ];
    req.flush(multipleResults);

    const results = await p;
    expect(results).toHaveLength(3);
    expect(results[0]).toBeDefined();
    expect(results[1]).toBeDefined();
    expect(results[2]).toBeDefined();
  });

  it('should handle partial failures in multiple positions', async () => {
    const epoch = '2026-02-11T12:00:00Z';
    const objects = ['Mars', 'Venus'];

    const p = firstValueFrom(
      service.calculateMultiplePositions(objects, epoch),
    );

    const req = httpMock.expectOne('/api/ephemeris/calculate-multiple');
    req.error(new ErrorEvent('Error'));

    const results = await p;
    expect(results).toHaveLength(2);
  });

  it('should get supported objects list', async () => {
    const objects = [
      'Sun',
      'Moon',
      'Mercury',
      'Venus',
      'Mars',
      'Jupiter',
      'Saturn',
      'Uranus',
      'Neptune',
    ];

    const p = firstValueFrom(service.getSupportedObjects());

    const req = httpMock.expectOne('/api/ephemeris/supported-objects');
    req.flush({ objects });

    const result = await p;
    expect(result).toEqual(objects);
  });

  it('should cache positions across different epochs', async () => {
    const date = '2026-02-11';
    const epoch1 = `${date}T12:00:00Z`;
    const epoch2 = `${date}T18:00:00Z`;

    const p1 = firstValueFrom(service.calculatePosition('Mars', epoch1));
    const req = httpMock.expectOne('/api/ephemeris/calculate');
    req.flush(mockEphemerisResult);
    await p1;

    const result = await firstValueFrom(
      service.calculatePosition('Mars', epoch2),
    );
    // Same day, same cache key
    expect(result?.source).toBe('cache');

    // Second epoch on same day should use cache, no new request
    httpMock.expectNone('/api/ephemeris/calculate');
  });

  it('should cache positions with different dates separately', async () => {
    const epoch1 = '2026-02-11T12:00:00Z';
    const epoch2 = '2026-02-12T12:00:00Z';

    const p1 = firstValueFrom(service.calculatePosition('Mars', epoch1));
    const p2 = firstValueFrom(service.calculatePosition('Mars', epoch2));

    const reqs = httpMock.match('/api/ephemeris/calculate');
    expect(reqs).toHaveLength(2);
    reqs[0].flush(mockEphemerisResult);
    reqs[1].flush({ ...mockEphemerisResult, epoch: epoch2 });

    await Promise.all([p1, p2]);
  });

  it('should provide calculating state', async () => {
    const states: boolean[] = [];

    service.calculating$.subscribe((isCalculating) => {
      states.push(isCalculating);
    });

    const p = firstValueFrom(
      service.calculatePosition('Mars', '2026-02-11T12:00:00Z'),
    );

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    req.flush(mockEphemerisResult);

    await p;
    expect(states).toContain(true);
  });

  it('should clear cache', async () => {
    const epoch = '2026-02-11T12:00:00Z';

    const p = firstValueFrom(service.calculatePosition('Mars', epoch));

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    req.flush(mockEphemerisResult);

    await p;
    const statsBefore = service.getCacheStats();
    expect(statsBefore.size).toBeGreaterThan(0);

    service.clearCache();

    const statsAfter = service.getCacheStats();
    expect(statsAfter.size).toBe(0);
  });

  it('should provide accurate cache statistics', () => {
    const stats = service.getCacheStats();
    expect(stats).toEqual({
      size: 0,
      ttl_ms: 86400000,
    });
  });

  it('should normalize object names to lowercase', async () => {
    const epoch = '2026-02-11T12:00:00Z';

    const p = firstValueFrom(service.calculatePosition('MARS', epoch));

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    expect(req.request.body.object).toBe('mars');
    req.flush(mockEphemerisResult);

    await p;
  });

  it('should handle cache for satellite objects', async () => {
    const epoch = '2026-02-11T12:00:00Z';
    const moonResult: EphemerisResult = {
      ...mockEphemerisResult,
      object_type: 'satellite',
    };

    const p = firstValueFrom(service.calculatePosition('Moon', epoch));

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    req.flush(moonResult);

    const result = await p;
    expect(result?.object_type).toBe('satellite');
  });

  it('should handle cache for asteroid objects', async () => {
    const epoch = '2026-02-11T12:00:00Z';
    const asteroidResult: EphemerisResult = {
      ...mockEphemerisResult,
      object_type: 'asteroid',
      source: 'jpl-horizons',
    };

    const p = firstValueFrom(service.calculatePosition('Eros', epoch));

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    req.flush(asteroidResult);

    const result = await p;
    expect(result?.object_type).toBe('asteroid');
    expect(result?.source).not.toBe('cache');
  });
});
