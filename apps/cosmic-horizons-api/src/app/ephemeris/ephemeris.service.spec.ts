import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { AxiosHeaders, AxiosResponse } from 'axios';
import { EphemerisService } from './ephemeris.service';
import { RequestContextService } from '../context/request-context.service';
import { CacheService } from '../cache/cache.service';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('EphemerisService', () => {
  let service: EphemerisService;
  let cacheService: jest.Mocked<CacheService>;
  let httpService: jest.Mocked<HttpService>;
  let ctxService: jest.Mocked<RequestContextService>;

  beforeEach(async () => {
    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const mockHttpService = {
      get: jest.fn(),
    };
    const mockCtxService = {
      getCorrelationId: jest.fn().mockReturnValue('cid-ephem' as any),
    } as unknown as jest.Mocked<RequestContextService>;

    testingModule = await Test.createTestingModule({
      providers: [
        EphemerisService,
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: RequestContextService,
          useValue: mockCtxService,
        },
      ],
    }).compile();

    service = testingModule.get<EphemerisService>(EphemerisService);
    cacheService = testingModule.get(CacheService);
    httpService = testingModule.get(HttpService);
    ctxService = testingModule.get(RequestContextService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate Mars position correctly (cache miss)', async () => {
    cacheService.get.mockResolvedValue(null);

    // Fixed epoch for reproducible results
    const epoch = '2026-02-11T12:00:00Z';
    const result = await service.calculatePosition('mars', epoch);

    expect(result).toBeDefined();
    expect(result?.object_type).toBe('planet');
    expect(result?.source).toBe('astronomy-engine');
    expect(typeof result?.ra).toBe('number');
    expect(typeof result?.dec).toBe('number');

    // Verify cache was checked and set
    expect(cacheService.get).toHaveBeenCalledWith(`ephem:mars:2026-02-11`);
    expect(cacheService.set).toHaveBeenCalled();
  });

  it('should return cached position if available', async () => {
    const cachedResult = {
      ra: 100,
      dec: 20,
      object_type: 'planet',
      epoch: '2026-02-11T12:00:00Z',
    };
    cacheService.get.mockResolvedValue(cachedResult);

    const result = await service.calculatePosition(
      'mars',
      '2026-02-11T12:00:00Z',
    );

    expect(result).toEqual(
      expect.objectContaining({ ...cachedResult, source: 'cache' }),
    );
    expect(cacheService.get).toHaveBeenCalledWith(`ephem:mars:2026-02-11`);
    // Calculation should not run
    expect(cacheService.set).not.toHaveBeenCalled();
  });

  it('should return null for unknown objects', async () => {
    const response = {
      data: { result: 'No matches found' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: new AxiosHeaders() },
    } as AxiosResponse<{ result: string }>;
    httpService.get.mockReturnValue(of(response));
    const result = await service.calculatePosition('unknown-planet');
    expect(result).toBeNull();
  });

  it('should fallback to JPL Horizons for asteroids', async () => {
    const mockJplResponse = `
*******************************************************************************
$$SOE
2026-Feb-11 00:00      14 28 32.12 -15 28 42.1
$$EOE
*******************************************************************************
    `;
    cacheService.get.mockResolvedValue(null);
    const response = {
      data: { result: mockJplResponse },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: new AxiosHeaders() },
    } as AxiosResponse<{ result: string }>;
    httpService.get.mockReturnValue(of(response));

    const asteroidResult = await service.calculatePosition('asteroid-123');
    expect(asteroidResult).not.toBeNull();

    // outgoing HTTP should carry correlation header
    expect(httpService.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        params: expect.any(Object),
        headers: expect.objectContaining({
          'X-Correlation-Id': 'cid-ephem',
        }),
      }),
    );

    const erosResult = await service.calculatePosition(
      'eros',
      '2026-02-11T12:00:00Z',
    );

    expect(erosResult).toBeDefined();
    expect(erosResult?.source).toBe('jpl-horizons');
    expect(erosResult?.object_type).toBe('asteroid');
    // 14h 28m 32.12s -> 14.47558... hours -> 217.133... degrees
    expect(erosResult?.ra).toBeCloseTo(217.1338, 4);
    expect(erosResult?.dec).toBeCloseTo(-15.47836, 4);
  });

  // ========== ADDITIONAL COVERAGE TESTS ==========

  it('should calculate Moon position correctly', async () => {
    cacheService.get.mockResolvedValue(null);

    const epoch = '2026-02-11T12:00:00Z';
    const result = await service.calculatePosition('moon', epoch);

    expect(result).toBeDefined();
    expect(result?.object_type).toBe('satellite');
    expect(result?.source).toBe('astronomy-engine');
    expect(typeof result?.ra).toBe('number');
    expect(typeof result?.dec).toBe('number');
  });

  it('should calculate Venus position correctly', async () => {
    cacheService.get.mockResolvedValue(null);

    const epoch = '2026-02-11T12:00:00Z';
    const result = await service.calculatePosition('venus', epoch);

    expect(result).toBeDefined();
    expect(result?.object_type).toBe('planet');
    expect(result?.source).toBe('astronomy-engine');
  });

  it('should calculate Mercury position correctly', async () => {
    cacheService.get.mockResolvedValue(null);

    const epoch = '2026-02-11T12:00:00Z';
    const result = await service.calculatePosition('mercury', epoch);

    expect(result).toBeDefined();
    expect(result?.object_type).toBe('planet');
  });

  it('should calculate Jupiter position correctly', async () => {
    cacheService.get.mockResolvedValue(null);

    const epoch = '2026-02-11T12:00:00Z';
    const result = await service.calculatePosition('jupiter', epoch);

    expect(result).toBeDefined();
    expect(result?.object_type).toBe('planet');
  });

  it('should calculate Saturn position correctly', async () => {
    cacheService.get.mockResolvedValue(null);

    const epoch = '2026-02-11T12:00:00Z';
    const result = await service.calculatePosition('saturn', epoch);

    expect(result).toBeDefined();
    expect(result?.object_type).toBe('planet');
  });

  it('should calculate Uranus position correctly', async () => {
    cacheService.get.mockResolvedValue(null);

    const epoch = '2026-02-11T12:00:00Z';
    const result = await service.calculatePosition('uranus', epoch);

    expect(result).toBeDefined();
    expect(result?.object_type).toBe('planet');
  });

  it('should calculate Neptune position correctly', async () => {
    cacheService.get.mockResolvedValue(null);

    const epoch = '2026-02-11T12:00:00Z';
    const result = await service.calculatePosition('neptune', epoch);

    expect(result).toBeDefined();
    expect(result?.object_type).toBe('planet');
  });

  it('should calculate Sun position correctly', async () => {
    cacheService.get.mockResolvedValue(null);

    const epoch = '2026-02-11T12:00:00Z';
    const result = await service.calculatePosition('sun', epoch);

    expect(result).toBeDefined();
    expect(result?.object_type).toBe('planet');
  });

  it('should use default current epoch when not provided', async () => {
    cacheService.get.mockResolvedValue(null);

    const result = await service.calculatePosition('mars');

    expect(result).toBeDefined();
    expect(result?.source).toBe('astronomy-engine');
    expect(result?.epoch).toBeDefined();
  });

  it('should handle multiple cache lookups for different objects', async () => {
    cacheService.get.mockResolvedValue(null);

    const epoch = '2026-02-11T12:00:00Z';

    const result1 = await service.calculatePosition('mars', epoch);
    const result2 = await service.calculatePosition('venus', epoch);
    const result3 = await service.calculatePosition('mercury', epoch);

    expect(cacheService.get).toHaveBeenCalledTimes(3);
    expect(cacheService.set).toHaveBeenCalledTimes(3);
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result3).toBeDefined();
  });

  it('should handle case-insensitive object names', async () => {
    const cachedResult = {
      ra: 100,
      dec: 20,
      object_type: 'planet',
      epoch: '2026-02-11T12:00:00Z',
    };
    cacheService.get.mockResolvedValue(cachedResult);

    // Test with uppercase
    const result = await service.calculatePosition(
      'MARS',
      '2026-02-11T12:00:00Z',
    );

    expect(result).toEqual(
      expect.objectContaining({ ...cachedResult, source: 'cache' }),
    );
    expect(cacheService.get).toHaveBeenCalledWith(`ephem:mars:2026-02-11`);
  });

  it('should correctly parse Earth as null and return null', async () => {
    cacheService.get.mockResolvedValue(null);

    const result = await service.calculatePosition(
      'earth',
      '2026-02-11T12:00:00Z',
    );

    expect(result).toBeNull();
  });

  it('should cache results with correct TTL', async () => {
    cacheService.get.mockResolvedValue(null);

    const epoch = '2026-02-11T12:00:00Z';
    await service.calculatePosition('mars', epoch);

    expect(cacheService.set).toHaveBeenCalledWith(
      `ephem:mars:2026-02-11`,
      expect.objectContaining({
        ra: expect.any(Number),
        dec: expect.any(Number),
        accuracy_arcsec: expect.any(Number),
        epoch: epoch,
        object_type: 'planet',
        source: 'astronomy-engine',
      }),
      86400,
    );
  });

  it('should handle calculation errors gracefully', async () => {
    cacheService.get.mockResolvedValue(null);

    // Mock an invalid epoch that could cause errors
    const result = await service.calculatePosition('mars', 'invalid-date');

    // Should handle error internally and return null or handle gracefully
    expect(result === null || result?.object_type).toBeDefined();
  });

  it('should fetch from cache for same object on same day', async () => {
    const cachedResult = {
      ra: 100,
      dec: 20,
      object_type: 'planet',
      epoch: '2026-02-11T15:00:00Z',
      source: 'astronomy-engine',
      accuracy_arcsec: 0.1,
    };

    // First call cache miss
    cacheService.get.mockResolvedValueOnce(null);
    cacheService.set.mockResolvedValueOnce(undefined);

    const epoch1 = '2026-02-11T12:00:00Z';
    await service.calculatePosition('mars', epoch1);

    // Second call same day - cache key uses only date, not time
    cacheService.get.mockResolvedValueOnce(cachedResult);
    const epoch2 = '2026-02-11T18:00:00Z';
    const result = await service.calculatePosition('mars', epoch2);

    expect(result?.source).toBe('cache');
    expect(cacheService.get).toHaveBeenCalledWith(`ephem:mars:2026-02-11`);
  });
});
