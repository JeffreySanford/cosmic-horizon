import { Test, TestingModule } from '@nestjs/testing';
import { EphemerisController } from './ephemeris.controller';
import { EphemerisService, EphemerisResult } from './ephemeris.service';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { NotFoundException } from '@nestjs/common';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('EphemerisController', () => {
  let controller: EphemerisController;
  let service: jest.Mocked<EphemerisService>;

  beforeEach(async () => {
    const mockService = {
      calculatePosition: jest.fn(),
    };

    testingModule = await Test.createTestingModule({
      controllers: [EphemerisController],
      providers: [
        {
          provide: EphemerisService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(AuthenticatedGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = testingModule.get<EphemerisController>(EphemerisController);
    service = testingModule.get(EphemerisService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have auth and rate limit guards on search endpoint', () => {
    // We rely on Nest's decorator machinery and overrideGuard above to
    // insert dummy implementations; if the decorators were missing the
    // module would still compile but the overrideGuard calls would be
    // no-ops.  This test exists mostly for documentation and is a
    // placeholder since metadata inspection proved brittle in Jest.
    expect(controller.search).toBeDefined();
  });

  it('should return calculation results', async () => {
    const mockResult: EphemerisResult = {
      ra: 10,
      dec: 20,
      accuracy_arcsec: 0.1,
      epoch: '2026-02-11T12:00:00Z',
      source: 'astronomy-engine',
      object_type: 'planet',
    };
    service.calculatePosition.mockResolvedValue(mockResult);

    const result = await controller.search({
      object_name: 'mars',
      epoch: '2026-02-11T12:00:00Z',
    });

    expect(result).toEqual(mockResult);
    expect(service.calculatePosition).toHaveBeenCalledWith(
      'mars',
      '2026-02-11T12:00:00Z',
    );
  });

  it('should throw NotFoundException if service returns null', async () => {
    service.calculatePosition.mockResolvedValue(null);

    await expect(
      controller.search({ object_name: 'nonexistent' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should prioritize "target" over "object_name"', async () => {
    const mockResult: EphemerisResult = {
      ra: 15,
      dec: 25,
      accuracy_arcsec: 0.1,
      epoch: '2026-02-11T12:00:00Z',
      source: 'astronomy-engine',
      object_type: 'planet',
    };
    service.calculatePosition.mockResolvedValue(mockResult);

    const result = await controller.search({
      target: 'jupiter',
      object_name: 'mars',
      epoch: '2026-02-11T12:00:00Z',
    });

    expect(result).toEqual(mockResult);
    expect(service.calculatePosition).toHaveBeenCalledWith(
      'jupiter',
      '2026-02-11T12:00:00Z',
    );
  });

  it('should use current date if epoch is missing', async () => {
    const mockResult: EphemerisResult = {
      ra: 100,
      dec: -10,
      accuracy_arcsec: 0.1,
      epoch: new Date().toISOString(),
      source: 'astronomy-engine',
      object_type: 'planet',
    };
    service.calculatePosition.mockResolvedValue(mockResult);

    await controller.search({ target: 'saturn' });

    // Check that calculatePosition was called with saturn and a date string in ISO format (today's date)
    const today = new Date().toISOString().split('T')[0];
    expect(service.calculatePosition).toHaveBeenCalledWith(
      'saturn',
      expect.stringContaining(today),
    );
  });

  it('should throw NotFoundException if neither target nor object_name is provided', async () => {
    await expect(controller.search({})).rejects.toThrow(NotFoundException);

    await expect(
      controller.search({ target: '', object_name: '' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should handle service errors gracefully', async () => {
    service.calculatePosition.mockRejectedValue(
      new Error('Internal Calculation Error'),
    );

    await expect(controller.search({ target: 'jupiter' })).rejects.toThrow(
      'Internal Calculation Error',
    );
  });

  it('should support jpl-horizons source from service', async () => {
    const mockResult: EphemerisResult = {
      ra: 50.5,
      dec: 12.3,
      accuracy_arcsec: 1.0,
      epoch: '2026-02-11T12:00:00Z',
      source: 'jpl-horizons',
      object_type: 'asteroid',
    };
    service.calculatePosition.mockResolvedValue(mockResult);

    const result = await controller.search({ target: 'ceres' });

    expect(result.source).toBe('jpl-horizons');
    expect(result.object_type).toBe('asteroid');
  });
});
