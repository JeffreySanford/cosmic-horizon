import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { EphemerisService } from './ephemeris.service';
import { CacheService } from '../cache/cache.service';

describe('EphemerisService', () => {
  let service: EphemerisService;
  let cacheService: jest.Mocked<CacheService>;
  let httpService: jest.Mocked<HttpService>;

  beforeEach(async () => {
    const mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const mockHttpService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
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
      ],
    }).compile();

    service = module.get<EphemerisService>(EphemerisService);
    cacheService = module.get(CacheService);
    httpService = module.get(HttpService);
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

    const result = await service.calculatePosition('mars', '2026-02-11T12:00:00Z');

    expect(result).toEqual({ ...cachedResult, source: 'cache' });
    expect(cacheService.get).toHaveBeenCalledWith(`ephem:mars:2026-02-11`);
    // Calculation should not run
    expect(cacheService.set).not.toHaveBeenCalled();
  });

  it('should return null for unknown objects', async () => {
    httpService.get.mockReturnValue(of({ data: { result: 'No matches found' } }) as any);
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
    httpService.get.mockReturnValue(of({ data: { result: mockJplResponse } }) as any);

    const result = await service.calculatePosition('eros', '2026-02-11T12:00:00Z');

    expect(result).toBeDefined();
    expect(result?.source).toBe('jpl-horizons');
    expect(result?.object_type).toBe('asteroid');
    // 14h 28m 32.12s -> 14.47558... hours -> 217.133... degrees
    expect(result?.ra).toBeCloseTo(217.1338, 4);
    expect(result?.dec).toBeCloseTo(-15.47836, 4);
  });
});
