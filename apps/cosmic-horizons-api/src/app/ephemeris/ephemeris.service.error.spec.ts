import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { EphemerisService, EphemerisResult } from './ephemeris.service';
import { CacheService } from '../cache/cache.service';
import { of, throwError } from 'rxjs';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

/**
 * EphemerisService - Error Path & Branch Coverage Tests
 * Focus: Cache failures, JPL Horizons errors, invalid input handling
 */

// Helper to create mock AxiosResponse
const mockAxiosResponse = (data: any): AxiosResponse => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {} as any,
});

describe('EphemerisService - Error Paths & Branch Coverage', () => {
  let service: EphemerisService;
  let cacheService: jest.Mocked<CacheService>;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        EphemerisService,
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn().mockResolvedValue(undefined),
            del: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = testingModule.get<EphemerisService>(EphemerisService);
    cacheService = testingModule.get(CacheService) as jest.Mocked<CacheService>;
    httpService = testingModule.get(HttpService) as jest.Mocked<HttpService>;

    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculatePosition - Cache Operations', () => {
    it('should return cached result when cache hit occurs', async () => {
      const cached: Omit<EphemerisResult, 'source'> = {
        target: 'mars',
        ra: 100.5,
        dec: 45.2,
        accuracy_arcsec: 0.1,
        epoch: '2026-02-13T00:00:00.000Z',
        object_type: 'planet',
      };

      cacheService.get.mockResolvedValueOnce(cached);

      const result = await service.calculatePosition(
        'sun',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result).toEqual(
        expect.objectContaining({ ...cached, source: 'cache' }),
      );
      expect(cacheService.get).toHaveBeenCalledWith('ephem:sun:2026-02-13');
    });

    it('should calculate and cache result on cache miss', async () => {
      cacheService.get.mockResolvedValueOnce(null);
      cacheService.set.mockResolvedValueOnce(undefined);

      const result = await service.calculatePosition(
        'mars',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result).not.toBeNull();
      expect(result?.source).toBe('astronomy-engine');
      expect(cacheService.get).toHaveBeenCalledWith('ephem:mars:2026-02-13');
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should return null if cache.set fails during calculation', async () => {
      cacheService.get.mockResolvedValueOnce(null);
      cacheService.set.mockRejectedValueOnce(
        new Error('Redis connection lost'),
      );

      const result = await service.calculatePosition(
        'mars',
        '2026-02-13T00:00:00.000Z',
      );

      // Service catches all errors including cache failures and returns null
      expect(result).toBeNull();
    });
  });

  describe('calculatePosition - Invalid Input Handling', () => {
    it('should handle invalid epoch date gracefully', async () => {
      cacheService.get.mockResolvedValueOnce(null);

      const result = await service.calculatePosition('sun', 'invalid-date');

      // Invalid epoch creates Invalid Date, service returns null after calculation attempt
      expect(result).toBeNull();
    });

    it('should handle null epoch with current date', async () => {
      cacheService.get.mockResolvedValueOnce(null);
      cacheService.set.mockResolvedValueOnce(undefined);

      const result = await service.calculatePosition('moon');

      // Should use current date and return valid result
      expect(result).not.toBeNull();
      expect(result?.source).toBe('astronomy-engine');
      expect(result?.object_type).toBe('satellite');
    });

    it('should return null for empty object name', async () => {
      cacheService.get.mockResolvedValueOnce(null);
      httpService.get.mockReturnValueOnce(
        of(mockAxiosResponse({ result: 'No matches found' })),
      );

      const result = await service.calculatePosition(
        '',
        '2026-02-13T00:00:00.000Z',
      );

      // Empty object name should fall back to asteroid and find no matches
      expect(result).toBeNull();
    });

    it('should normalize object names to lowercase', async () => {
      cacheService.get.mockResolvedValueOnce(null);
      cacheService.set.mockResolvedValueOnce(undefined);

      const result = await service.calculatePosition(
        'MARS',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result).not.toBeNull();
      expect(result?.object_type).toBe('planet');
    });
  });

  describe('calculatePosition - Unknown Objects & Fallback', () => {
    it('should handle unknown major body with successful asteroid fallback', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const jplResult = {
        result: `
$$SOE
2026-Feb-13 00:00 14 28 32.12 -15 28 42.1
$$EOE
        `,
      };
      httpService.get.mockReturnValueOnce(of(mockAxiosResponse(jplResult)));

      const result = await service.calculatePosition(
        'Ceres',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result).not.toBeNull();
      expect(result?.source).toBe('jpl-horizons');
      expect(result?.object_type).toBe('asteroid');
      expect(result?.ra).toBeCloseTo(217.133, 2);
    });

    it('should return null for completely unknown object', async () => {
      cacheService.get.mockResolvedValue(null);

      const jplNoMatch = {
        result: 'No matches found for object "XYZ123"',
      };
      httpService.get.mockReturnValueOnce(of(mockAxiosResponse(jplNoMatch)));

      const result = await service.calculatePosition(
        'XYZ123',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result).toBeNull();
    });
  });

  describe('handleAsteroidFallback - HTTP Errors', () => {
    it('should handle HTTP timeout from JPL Horizons', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.get.mockReturnValueOnce(
        throwError(() => new Error('ETIMEDOUT')),
      );

      const result = await service.calculatePosition(
        'Apophis',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result).toBeNull();
    });

    it('should handle HTTP 400 bad request from JPL', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.get.mockReturnValueOnce(
        throwError(() => ({ response: { status: 400 } })),
      );

      const result = await service.calculatePosition(
        'asteroid-999',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result).toBeNull();
    });

    it('should handle HTTP 500 server error from JPL', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.get.mockReturnValueOnce(
        throwError(() => ({ response: { status: 500 } })),
      );

      const result = await service.calculatePosition(
        'asteroid-123',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result).toBeNull();
    });

    it('should handle missing response data', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.get.mockReturnValueOnce(of(mockAxiosResponse(null)));

      const result = await service.calculatePosition(
        'Eros',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result).toBeNull();
    });

    it('should handle empty response result', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.get.mockReturnValueOnce(
        of(mockAxiosResponse({ result: '' })),
      );

      const result = await service.calculatePosition(
        'Amor',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result).toBeNull();
    });
  });

  describe('handleAsteroidFallback - Response Parsing', () => {
    it('should handle JPL response without SOE marker', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.get.mockReturnValueOnce(
        of(mockAxiosResponse({ result: 'some data\nno markers\nhere' })),
      );

      const result = await service.calculatePosition(
        'Ida',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result).toBeNull();
    });

    it('should handle JPL response with only SOE marker but no EOE', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.get.mockReturnValueOnce(
        of(
          mockAxiosResponse({
            result: `
$$SOE
2026-Feb-13 00:00 14 28 32.12 -15 28 42.1
            `,
          }),
        ),
      );

      const result = await service.calculatePosition(
        'Vesta',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result).not.toBeNull();
      expect(result?.source).toBe('jpl-horizons');
    });

    it('should handle JPL response with malformed RA/Dec line', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.get.mockReturnValueOnce(
        of(
          mockAxiosResponse({
            result: `
$$SOE
2026-Feb-13 invalid data here
$$EOE
            `,
          }),
        ),
      );

      const result = await service.calculatePosition(
        'Juno',
        '2026-02-13T00:00:00.000Z',
      );

      // Should handle NaN from parseFloat gracefully
      expect(result).toBeNull();
    });

    it('should parse negative declination correctly', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      httpService.get.mockReturnValueOnce(
        of(
          mockAxiosResponse({
            result: `
$$SOE
2026-Feb-13 00:00 02 45 30.00 -35 15 22.5
$$EOE
            `,
          }),
        ),
      );

      const result = await service.calculatePosition(
        'Pallas',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result).not.toBeNull();
      expect(result?.ra).toBeCloseTo(41.375, 2);
      expect(result?.dec).toBeCloseTo(-35.2563, 2);
    });

    it('should handle multiple data lines (takes first)', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      httpService.get.mockReturnValueOnce(
        of(
          mockAxiosResponse({
            result: `
$$SOE
2026-Feb-13 00:00 14 28 32.12 -15 28 42.1
2026-Feb-14 00:00 14 29 15.45 -15 25 10.2
$$EOE
            `,
          }),
        ),
      );

      const result = await service.calculatePosition(
        'Flora',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result).not.toBeNull();
      // Should use the first data line
      expect(result?.ra).toBeCloseTo(217.133, 2);
    });

    it('should handle whitespace normalization in data', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      httpService.get.mockReturnValueOnce(
        of(
          mockAxiosResponse({
            result: `
$$SOE
2026-Feb-13  00:00   14   28   32.12   -15   28   42.1
$$EOE
            `,
          }),
        ),
      );

      const result = await service.calculatePosition(
        'Hygeia',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result).not.toBeNull();
      expect(result?.ra).toBeCloseTo(217.133, 2);
    });
  });

  describe('objectClassification', () => {
    it('should classify known planets correctly', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const planets = [
        'mercury',
        'venus',
        'mars',
        'jupiter',
        'saturn',
        'uranus',
        'neptune',
        'pluto',
        'sun',
      ];
      for (const planet of planets) {
        const result = await service.calculatePosition(
          planet,
          '2026-02-13T00:00:00.000Z',
        );
        expect(result?.object_type).toBe('planet');
      }
    });

    it('should classify moon as satellite', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const result = await service.calculatePosition(
        'moon',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result?.object_type).toBe('satellite');
    });

    it('should classify unknown objects as asteroids', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      httpService.get.mockReturnValueOnce(
        of(
          mockAxiosResponse({
            result: `
$$SOE
2026-Feb-13 00:00 14 28 32.12 -15 28 42.1
$$EOE
            `,
          }),
        ),
      );

      const result = await service.calculatePosition(
        'UnknownObject',
        '2026-02-13T00:00:00.000Z',
      );

      expect(result?.object_type).toBe('asteroid');
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent cache keys from epochIso', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      // Same day, different times
      await service.calculatePosition('mercury', '2026-02-13T10:30:00.000Z');
      await service.calculatePosition('mercury', '2026-02-13T22:15:00.000Z');

      // Should extract just the date part (2026-02-13)
      const calls = cacheService.get.mock.calls;
      expect(calls[0][0]).toBe('ephem:mercury:2026-02-13');
      expect(calls[1][0]).toBe('ephem:mercury:2026-02-13');
    });

    it('should generate different cache keys for different days', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      await service.calculatePosition('venus', '2026-02-13T00:00:00.000Z');
      await service.calculatePosition('venus', '2026-02-14T00:00:00.000Z');

      const calls = cacheService.get.mock.calls;
      expect(calls[0][0]).toBe('ephem:venus:2026-02-13');
      expect(calls[1][0]).toBe('ephem:venus:2026-02-14');
    });

    it('should normalize object name in cache key', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      await service.calculatePosition('MARS', '2026-02-13T00:00:00.000Z');

      const call = cacheService.get.mock.calls[0];
      expect(call[0]).toBe('ephem:mars:2026-02-13');
    });
  });

  describe('Cache TTL', () => {
    it('should cache results for 86400 seconds (24 hours)', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      await service.calculatePosition('jupiter', '2026-02-13T00:00:00.000Z');

      const setCalls = cacheService.set.mock.calls;
      expect(setCalls.length).toBeGreaterThan(0);
      expect(setCalls[setCalls.length - 1][2]).toBe(86400);
    });

    it('should cache asteroid results for 86400 seconds (24 hours)', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);
      httpService.get.mockReturnValueOnce(
        of(
          mockAxiosResponse({
            result: `
$$SOE
2026-Feb-13 00:00 14 28 32.12 -15 28 42.1
$$EOE
            `,
          }),
        ),
      );

      await service.calculatePosition(
        'asteroid-xyzzy',
        '2026-02-13T00:00:00.000Z',
      );

      const setCalls = cacheService.set.mock.calls;
      expect(setCalls[setCalls.length - 1][2]).toBe(86400);
    });
  });

  describe('Error Recovery & Resilience', () => {
    it('should handle JPL Horizons date boundary edge cases', async () => {
      cacheService.get.mockResolvedValue(null);
      httpService.get.mockReturnValueOnce(
        of(mockAxiosResponse({ result: '$$SOE\n$$EOE' })),
      );

      const result = await service.calculatePosition(
        'asteroid',
        '2026-01-01T00:00:00.000Z',
      );

      // Empty data between markers should return null
      expect(result).toBeNull();
    });

    it('should cache and retrieve same-day calculations', async () => {
      const cached: Omit<EphemerisResult, 'source'> = {
        target: 'mars',
        ra: 142.5,
        dec: -28.3,
        accuracy_arcsec: 0.1,
        epoch: '2026-02-13T00:00:00.000Z',
        object_type: 'planet',
      };

      // First call - miss, calculate and cache
      cacheService.get.mockResolvedValueOnce(null);
      cacheService.set.mockResolvedValueOnce(undefined);

      const result1 = await service.calculatePosition(
        'venus',
        '2026-02-13T00:00:00.000Z',
      );
      expect(result1).not.toBeNull();

      // Second call - hit from cache
      cacheService.get.mockResolvedValueOnce(cached);

      const result2 = await service.calculatePosition(
        'venus',
        '2026-02-13T00:00:00.000Z',
      );
      expect(result2?.source).toBe('cache');
    });

    it('should handle different dates for same object', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const result1 = await service.calculatePosition(
        'mars',
        '2026-02-13T00:00:00.000Z',
      );
      const result2 = await service.calculatePosition(
        'mars',
        '2026-02-14T00:00:00.000Z',
      );

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      // Both should use astronomy-engine (cache misses on different dates)
      expect(cacheService.get).toHaveBeenNthCalledWith(
        1,
        'ephem:mars:2026-02-13',
      );
      expect(cacheService.get).toHaveBeenNthCalledWith(
        2,
        'ephem:mars:2026-02-14',
      );
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle concurrent requests for same object', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const results = await Promise.all([
        service.calculatePosition('uranus', '2026-02-13T00:00:00.000Z'),
        service.calculatePosition('uranus', '2026-02-13T00:00:00.000Z'),
      ]);

      expect(results[0]).not.toBeNull();
      expect(results[1]).not.toBeNull();
      expect(results[0]?.source).toBe('astronomy-engine');
    });

    it('should handle concurrent requests for different objects', async () => {
      cacheService.get.mockResolvedValue(null);
      cacheService.set.mockResolvedValue(undefined);

      const results = await Promise.all([
        service.calculatePosition('mars', '2026-02-13T00:00:00.000Z'),
        service.calculatePosition('venus', '2026-02-13T00:00:00.000Z'),
        service.calculatePosition('mercury', '2026-02-13T00:00:00.000Z'),
      ]);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r !== null)).toBe(true);
    });

    it('should handle concurrent requests with mixed cache hits/misses', async () => {
      const cached: Omit<EphemerisResult, 'source'> = {
        target: 'mars',
        ra: 100.5,
        dec: 45.2,
        accuracy_arcsec: 0.1,
        epoch: '2026-02-13T00:00:00.000Z',
        object_type: 'planet',
      };

      cacheService.get
        .mockResolvedValueOnce(cached) // Cache hit for mars
        .mockResolvedValueOnce(null) // Cache miss for venus
        .mockResolvedValueOnce(cached); // Cache hit for mercury

      cacheService.set.mockResolvedValue(undefined);

      const results = await Promise.all([
        service.calculatePosition('mars', '2026-02-13T00:00:00.000Z'),
        service.calculatePosition('venus', '2026-02-13T00:00:00.000Z'),
        service.calculatePosition('mercury', '2026-02-13T00:00:00.000Z'),
      ]);

      expect(results[0]?.source).toBe('cache');
      expect(results[1]?.source).toBe('astronomy-engine');
      expect(results[2]?.source).toBe('cache');
    });
  });
});
