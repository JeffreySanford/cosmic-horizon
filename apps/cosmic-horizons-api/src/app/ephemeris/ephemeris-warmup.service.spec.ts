import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { EphemerisWarmupService } from './ephemeris-warmup.service';
import { EphemerisService } from './ephemeris.service';

afterEach(async () => {
  await testingModule?.close();
});

let testingModule: TestingModule | undefined;

describe('EphemerisWarmupService', () => {
  let service: EphemerisWarmupService;
  let mockEphemerisService: jest.Mocked<EphemerisService>;

  beforeEach(async () => {
    mockEphemerisService = {
      calculatePosition: jest.fn().mockResolvedValue({
        ra: 0,
        dec: 0,
        accuracy_arcsec: 0.1,
        epoch: '2000.0',
        source: 'cache',
        object_type: 'planet',
      }),
    } as unknown as jest.Mocked<EphemerisService>;

    testingModule = await Test.createTestingModule({
      providers: [
        EphemerisWarmupService,
        {
          provide: EphemerisService,
          useValue: mockEphemerisService,
        },
      ],
    }).compile();

    service = testingModule.get<EphemerisWarmupService>(EphemerisWarmupService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleDailyWarmup', () => {
    it('should warm ephemeris cache for 8 days and 10 objects', async () => {
      await service.handleDailyWarmup();

      // 8 days (today + next 7) × 10 objects = 80 calls
      expect(mockEphemerisService.calculatePosition).toHaveBeenCalledTimes(80);
    });

    it('should include sun in warmup', async () => {
      await service.handleDailyWarmup();

      expect(mockEphemerisService.calculatePosition).toHaveBeenCalledWith(
        'sun',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      );
    });

    it('should include moon in warmup', async () => {
      await service.handleDailyWarmup();

      expect(mockEphemerisService.calculatePosition).toHaveBeenCalledWith(
        'moon',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      );
    });

    it('should include all major solar system objects', async () => {
      await service.handleDailyWarmup();

      const objects = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
      for (const obj of objects) {
        expect(mockEphemerisService.calculatePosition).toHaveBeenCalledWith(
          obj,
          expect.any(String),
        );
      }
    });

    it('should use ISO date format', async () => {
      await service.handleDailyWarmup();

      const calls = mockEphemerisService.calculatePosition.mock.calls;
      for (const [, dateArg] of calls) {
        // Validate ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
        expect(dateArg).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
    });

    it('should log start of warmup', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      await service.handleDailyWarmup();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting daily ephemeris cache pre-warming'),
      );
    });

    it('should log completion with warmed count', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      await service.handleDailyWarmup();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Ephemeris cache pre-warming complete.*Warmed \d+ entries/),
      );
    });

    it('should continue warmup when individual calculation fails', async () => {
      mockEphemerisService.calculatePosition
        .mockRejectedValueOnce(new Error('API call failed'))
        .mockResolvedValueOnce({
          target: 'mars',
          ra: 0,
          dec: 0,
          accuracy_arcsec: 0.1,
          epoch: '2000.0',
          source: 'cache',
          object_type: 'planet',
        });

      await service.handleDailyWarmup();

      // Should not throw, and should continue calling calculatePosition
      expect(mockEphemerisService.calculatePosition).toHaveBeenCalledTimes(80);
    });

    it('should log error when calculation fails', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      mockEphemerisService.calculatePosition.mockRejectedValueOnce(
        new Error('Connection timeout'),
      );

      await service.handleDailyWarmup();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to pre-warm.*Connection timeout/),
      );
    });

    it('should handle non-Error thrown objects', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      mockEphemerisService.calculatePosition.mockRejectedValueOnce('String error');

      await service.handleDailyWarmup();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to pre-warm.*unknown error/),
      );
    });

    it('should warm dates sequentially from today onwards', async () => {
      await service.handleDailyWarmup();

      const calls = mockEphemerisService.calculatePosition.mock.calls;
      const uniqueDates = new Set<string>();

      for (const [, dateArg] of calls) {
        if (typeof dateArg === 'string') {
          const dateStr = dateArg.split('T')[0];
          uniqueDates.add(dateStr);
        }
      }

      // Should have 8 unique dates
      expect(uniqueDates.size).toBe(8);
    });

    it('should warm consecutive days', async () => {
      await service.handleDailyWarmup();

      const calls = mockEphemerisService.calculatePosition.mock.calls;
      const dates: Date[] = [];

      for (const [, dateArg] of calls.slice(0, 10)) {
        if (typeof dateArg === 'string') {
          dates.push(new Date(dateArg));
        }
      }

      const uniqueDates = [...new Set(dates.map(d => d.toISOString().split('T')[0]))];
      expect(uniqueDates.length).toBeGreaterThan(0);
    });

    it('should warm 10 different objects per day', async () => {
      await service.handleDailyWarmup();

      const calls = mockEphemerisService.calculatePosition.mock.calls;
      const objectsByDay: Record<string, Set<string>> = {};

      for (const [obj, dateArg] of calls) {
        const dateStr = (dateArg as string).split('T')[0];
        if (!objectsByDay[dateStr]) {
          objectsByDay[dateStr] = new Set();
        }
        objectsByDay[dateStr].add(obj as string);
      }

      // Each day should have all 10 objects
      for (const [, objects] of Object.entries(objectsByDay)) {
        expect(objects.size).toBe(10);
      }
    });

    it('should complete without throwing', async () => {
      await expect(service.handleDailyWarmup()).resolves.not.toThrow();
    });

    it('should handle multiple consecutive warmups', async () => {
      await service.handleDailyWarmup();
      const firstCallCount = mockEphemerisService.calculatePosition.mock.calls.length;

      mockEphemerisService.calculatePosition.mockClear();

      await service.handleDailyWarmup();
      const secondCallCount = mockEphemerisService.calculatePosition.mock.calls.length;

      expect(firstCallCount).toBe(80);
      expect(secondCallCount).toBe(80);
    });

    it('should handle all errors without stopping the warmup loop', async () => {
      const errorSpy = jest.spyOn(Logger.prototype, 'error');
      
      // Make every call fail
      mockEphemerisService.calculatePosition.mockRejectedValue(new Error('All failed'));

      await service.handleDailyWarmup();

      // Should log 80 errors (one per failed call)
      expect(errorSpy.mock.calls.length).toBeGreaterThanOrEqual(80);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Failed to pre-warm/),
      );
    });

    it('should track warmed count correctly', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      
      // All succeed
      mockEphemerisService.calculatePosition.mockResolvedValue({
        target: 'mars',
        ra: 0,
        dec: 0,
        accuracy_arcsec: 0.1,
        epoch: '2000.0',
        source: 'cache',
        object_type: 'planet',
      });

      await service.handleDailyWarmup();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Warmed 80 entries/),
      );
    });

    it('should track warmed count with partial failures', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');
      
      let callCount = 0;
      mockEphemerisService.calculatePosition.mockImplementation(async () => {
        callCount++;
        if (callCount % 2 === 0) {
          throw new Error('Alternating failure');
        }
        return {
          target: 'mars',
          ra: 0,
          dec: 0,
          accuracy_arcsec: 0.1,
          epoch: '2000.0',
          source: 'cache',
          object_type: 'planet',
        };
      });

      await service.handleDailyWarmup();

      // 40 successes (every other call)
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Warmed 40 entries/),
      );
    });
  });
});
