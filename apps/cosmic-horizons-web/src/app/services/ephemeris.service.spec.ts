import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { EphemerisService, EphemerisResult } from './ephemeris.service';

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

    service.calculatePosition('Mars', epoch).subscribe((result) => {
      expect(result).toEqual(expect.objectContaining(mockEphemerisResult));
      expect(result?.source).not.toBe('cache');
    });

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      object: 'mars',
      epoch: epoch,
    });
    req.flush(mockEphemerisResult);
  });

  it('should use cached result on second request for same object', () => {
    const epoch = '2026-02-11T12:00:00Z';
    let callCount = 0;

    service.calculatePosition('Mars', epoch).subscribe(() => {
      callCount++;
      if (callCount === 1) {
        // Make second request
        service.calculatePosition('Mars', epoch).subscribe((result) => {
          expect(result?.source).toBe('cache');
        });
      }
    });

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    req.flush(mockEphemerisResult);

    // Second request should not generate HTTP call
    httpMock.expectNone('/api/ephemeris/calculate');
  });

  it('should handle different objects separately in cache', () => {
    const epoch = '2026-02-11T12:00:00Z';

    service.calculatePosition('Mars', epoch).subscribe();
    service.calculatePosition('Venus', epoch).subscribe();

    const reqs = httpMock.match('/api/ephemeris/calculate');
    expect(reqs).toHaveLength(2);
    reqs[0].flush(mockEphemerisResult);
    reqs[1].flush({ ...mockEphemerisResult, object_type: 'planet' });
  });

  it('should use current time when epoch not provided', () => {
    service.calculatePosition('Mars').subscribe();

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    expect(req.request.body.epoch).toBeDefined();
    expect(typeof req.request.body.epoch).toBe('string');
    req.flush(mockEphemerisResult);
  });

  it('should handle HTTP errors gracefully', () => {
    service.calculatePosition('Mars', '2026-02-11T12:00:00Z').subscribe((result) => {
      expect(result).toBeNull();
    });

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    req.error(new ErrorEvent('Network error'));
  });

  it('should calculate multiple positions', () => {
    const epoch = '2026-02-11T12:00:00Z';
    const objects = ['Mars', 'Venus', 'Mercury'];

    service.calculateMultiplePositions(objects, epoch).subscribe((results) => {
      expect(results).toHaveLength(3);
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
      expect(results[2]).toBeDefined();
    });

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
  });

  it('should handle partial failures in multiple positions', () => {
    const epoch = '2026-02-11T12:00:00Z';
    const objects = ['Mars', 'Venus'];

    service.calculateMultiplePositions(objects, epoch).subscribe((results) => {
      expect(results).toHaveLength(2);
    });

    const req = httpMock.expectOne('/api/ephemeris/calculate-multiple');
    req.error(new ErrorEvent('Error'));
  });

  it('should get supported objects list', () => {
    const objects = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

    service.getSupportedObjects().subscribe((result) => {
      expect(result).toEqual(objects);
    });

    const req = httpMock.expectOne('/api/ephemeris/supported-objects');
    req.flush({ objects });
  });

  it('should cache positions across different epochs', () => {
    const date = '2026-02-11';
    const epoch1 = `${date}T12:00:00Z`;
    const epoch2 = `${date}T18:00:00Z`;

    service.calculatePosition('Mars', epoch1).subscribe();

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    req.flush(mockEphemerisResult);

    service.calculatePosition('Mars', epoch2).subscribe((result) => {
      // Same day, same cache key
      expect(result?.source).toBe('cache');
    });

    // Second epoch on same day should use cache, no new request
    httpMock.expectNone('/api/ephemeris/calculate');
  });

  it('should cache positions with different dates separately', () => {
    const epoch1 = '2026-02-11T12:00:00Z';
    const epoch2 = '2026-02-12T12:00:00Z';

    service.calculatePosition('Mars', epoch1).subscribe();
    service.calculatePosition('Mars', epoch2).subscribe();

    const reqs = httpMock.match('/api/ephemeris/calculate');
    expect(reqs).toHaveLength(2);
    reqs[0].flush(mockEphemerisResult);
    reqs[1].flush({ ...mockEphemerisResult, epoch: epoch2 });
  });

  it('should provide calculating state', () => {
    const states: boolean[] = [];

    service.calculating$.subscribe((isCalculating) => {
      states.push(isCalculating);
    });

    service.calculatePosition('Mars', '2026-02-11T12:00:00Z').subscribe();

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    req.flush(mockEphemerisResult);

    expect(states).toContain(true);
  });

  it('should clear cache', () => {
    const epoch = '2026-02-11T12:00:00Z';

    service.calculatePosition('Mars', epoch).subscribe();

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    req.flush(mockEphemerisResult);

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

  it('should normalize object names to lowercase', () => {
    const epoch = '2026-02-11T12:00:00Z';

    service.calculatePosition('MARS', epoch).subscribe();

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    expect(req.request.body.object).toBe('mars');
    req.flush(mockEphemerisResult);
  });

  it('should handle cache for satellite objects', () => {
    const epoch = '2026-02-11T12:00:00Z';
    const moonResult: EphemerisResult = {
      ...mockEphemerisResult,
      object_type: 'satellite',
    };

    service.calculatePosition('Moon', epoch).subscribe((result) => {
      expect(result?.object_type).toBe('satellite');
    });

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    req.flush(moonResult);
  });

  it('should handle cache for asteroid objects', () => {
    const epoch = '2026-02-11T12:00:00Z';
    const asteroidResult: EphemerisResult = {
      ...mockEphemerisResult,
      object_type: 'asteroid',
      source: 'jpl-horizons',
    };

    service.calculatePosition('Eros', epoch).subscribe((result) => {
      expect(result?.object_type).toBe('asteroid');
      expect(result?.source).not.toBe('cache');
    });

    const req = httpMock.expectOne('/api/ephemeris/calculate');
    req.flush(asteroidResult);
  });
});
