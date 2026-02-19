import { BadRequestException, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ViewerService } from './viewer.service';
import { ViewerState } from '../entities/viewer-state.entity';
import { ViewerSnapshot } from '../entities/viewer-snapshot.entity';
import { AuditLogRepository } from '../repositories';
import { LoggingService } from '../logging/logging.service';

jest.mock('ioredis');

describe('ViewerService - Error Scenarios (Branch Coverage)', () => {
  let service: ViewerService;
  let dataSource: jest.Mocked<Pick<DataSource, 'query'>>;
  let viewerStateRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let viewerSnapshotRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let auditLogRepository: jest.Mocked<
    Pick<AuditLogRepository, 'createAuditLog'>
  >;
  let loggingService: jest.Mocked<Pick<LoggingService, 'add'>>;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    viewerStateRepository = {
      findOne: jest.fn(),
      create: jest.fn((payload) => payload as ViewerState),
      save: jest.fn(),
    };

    viewerSnapshotRepository = {
      create: jest.fn((payload) => payload as ViewerSnapshot),
      save: jest.fn(),
    };

    dataSource = {
      query: jest.fn().mockResolvedValue([]),
    };

    auditLogRepository = {
      createAuditLog: jest.fn().mockResolvedValue(undefined),
    };

    loggingService = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    service = new ViewerService(
      dataSource as unknown as DataSource,
      viewerStateRepository as unknown as Repository<ViewerState>,
      viewerSnapshotRepository as unknown as Repository<ViewerSnapshot>,
      auditLogRepository as unknown as AuditLogRepository,
      loggingService as unknown as LoggingService,
    );

    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([70, 73, 84, 83]).buffer,
    } as unknown as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Survey and Provider Fallback', () => {
    it('should handle network errors during cutout download', async () => {
      const fetchMock = jest.spyOn(global, 'fetch');
      fetchMock.mockRejectedValue(new Error('Network unreachable'));

      await expect(
        service.downloadCutout({
          ra: 10,
          dec: 20,
          fov: 2,
          survey: 'VLASS',
        }),
      ).rejects.toThrow();
    });

    it('should fallback to secondary survey when primary unavailable', async () => {
      const fetchMock = jest.spyOn(global, 'fetch');

      // First call fails, second call succeeds
      fetchMock
        .mockRejectedValueOnce(new Error('Primary survey timeout'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: async () => new Uint8Array([70, 73, 84, 83]).buffer,
        } as unknown as Response);

      const result = await service.downloadCutout({
        ra: 10,
        dec: 20,
        fov: 2,
        survey: 'VLASS',
      });

      expect(result).toBeDefined();
      expect(result.buffer).toBeDefined();
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe('HTTP Error Handling', () => {
    it('should handle 404 responses from cutout provider', async () => {
      const fetchMock = jest.spyOn(global, 'fetch');
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as unknown as Response);

      await expect(
        service.downloadCutout({
          ra: 10,
          dec: 20,
          fov: 2,
          survey: 'VLASS',
        }),
      ).rejects.toThrow();
    });

    it('should handle 500 responses from cutout provider', async () => {
      const fetchMock = jest.spyOn(global, 'fetch');
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as unknown as Response);

      await expect(
        service.downloadCutout({
          ra: 10,
          dec: 20,
          fov: 2,
          survey: 'VLASS',
        }),
      ).rejects.toThrow();
    });

    it('should handle timeout errors from fetch', async () => {
      const fetchMock = jest.spyOn(global, 'fetch');
      fetchMock.mockRejectedValue(new Error('fetch timeout after 30s'));

      await expect(
        service.downloadCutout({
          ra: 10,
          dec: 20,
          fov: 2,
          survey: 'VLASS',
        }),
      ).rejects.toThrow();
    });
  });

  describe('Invalid State Handling', () => {
    it('should reject states with invalid RA coordinate', async () => {
      await expect(
        service.createState({
          ra: 400, // RA must be 0-360
          dec: 20,
          fov: 2,
          survey: 'VLASS',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should reject states with invalid declination coordinate', async () => {
      await expect(
        service.createState({
          ra: 10,
          dec: -100, // dec must be -90 to 90
          fov: 2,
          survey: 'VLASS',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should reject states with invalid field of view', async () => {
      await expect(
        service.createState({
          ra: 10,
          dec: 20,
          fov: 0, // FOV must be > 0
          survey: 'VLASS',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should reject unknown survey types', async () => {
      await expect(
        service.createState({
          ra: 10,
          dec: 20,
          fov: 2,
          survey: 'UNKNOWN_SURVEY',
        }),
      ).rejects.toThrow();
    });
  });

  describe('Cache Misses and Cache Failures', () => {
    it('should handle cache miss for nearby labels', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      const labels = await service.getNearbyLabels(10, 20, 0.5, 10);

      expect(labels).toBeDefined();
      expect(Array.isArray(labels)).toBe(true);
    });

    it('should handle malformed cache data', async () => {
      dataSource.query.mockResolvedValueOnce([
        {
          id: 'label-1',
          name: 'Test Label',
          // Missing required fields
        },
      ]);

      const labels = await service.getNearbyLabels(10, 20, 0.5, 10);
      expect(Array.isArray(labels)).toBe(true);
    });

    it('should handle empty result set gracefully', async () => {
      dataSource.query.mockResolvedValueOnce([]);

      const labels = await service.getNearbyLabels(10, 20, 0.5, 10);

      expect(labels).toEqual([]);
    });
  });

  describe('Snapshot Operations', () => {
    it('should handle snapshot creation failures', async () => {
      viewerStateRepository.findOne.mockResolvedValueOnce({
        id: 'state-1',
        short_id: 'Abc123XY',
        state_json: { ra: 10, dec: 20, fov: 2, survey: 'VLASS' },
        encoded_state: 'encoded_state',
        created_at: new Date(),
        updated_at: new Date(),
      } as ViewerState);

      viewerSnapshotRepository.save.mockRejectedValueOnce(
        new Error('Database constraint violation'),
      );

      const onePixelPngBase64 =
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO1N7nQAAAAASUVORK5CYII=';

      await expect(
        service.createSnapshot({
          image_data_url: `data:image/png;base64,${onePixelPngBase64}`,
        }),
      ).rejects.toThrow();
    });

    it('should handle invalid image data during snapshot creation', async () => {
      await expect(
        service.createSnapshot({
          image_data_url: 'data:image/png;base64,invalid_base64!!!',
        }),
      ).rejects.toThrow();
    });

    it('should handle snapshot with oversized image', async () => {
      // Create a very large base64 string
      const largeData = 'A'.repeat(100 * 1024 * 1024); // 100MB
      const base64Data = Buffer.from(largeData).toString('base64');

      await expect(
        service.createSnapshot({
          image_data_url: `data:image/png;base64,${base64Data}`,
        }),
      ).rejects.toThrow();
    });
  });

  describe('Resolution Fallback', () => {
    it('should fallback to lower resolution when high-res unavailable', async () => {
      const fetchMock = jest.spyOn(global, 'fetch');

      // High-res fails, medium-res succeeds
      fetchMock
        .mockRejectedValueOnce(new Error('High-res timeout'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: async () => new Uint8Array([70, 73, 84, 83]).buffer,
        } as unknown as Response);

      const result = await service.downloadCutout({
        ra: 10,
        dec: 20,
        fov: 2,
        survey: 'VLASS',
      });

      expect(result).toBeDefined();
      expect(result.buffer).toBeDefined();
    });

    it('should handle all resolution attempts failing', async () => {
      const fetchMock = jest.spyOn(global, 'fetch');
      fetchMock.mockRejectedValue(new Error('All resolutions failed'));

      await expect(
        service.downloadCutout({
          ra: 10,
          dec: 20,
          fov: 2,
          survey: 'VLASS',
        }),
      ).rejects.toThrow();
    });
  });

  describe('CDS API Interactions', () => {
    it('should handle CDS API returning malformed data', async () => {
      const fetchMock = jest.spyOn(global, 'fetch');
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => {
          // Invalid FITS data
          return new Uint8Array([0, 1, 2, 3]).buffer;
        },
      } as unknown as Response);

      // Should still return result (validation happens downstream)
      const result = await service.downloadCutout({
        ra: 10,
        dec: 20,
        fov: 2,
        survey: 'VLASS',
      });

      expect(result).toBeDefined();
      expect(result.buffer).toBeDefined();
    });

    it('should handle CDS rate limiting (429)', async () => {
      const fetchMock = jest.spyOn(global, 'fetch');
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          'retry-after': '60',
        },
      } as unknown as Response);

      await expect(
        service.downloadCutout({
          ra: 10,
          dec: 20,
          fov: 2,
          survey: 'VLASS',
        }),
      ).rejects.toThrow();
    });
  });

  describe('Database Errors', () => {
    it('should handle viewer state save failures', async () => {
      viewerStateRepository.findOne.mockResolvedValueOnce(null);
      viewerStateRepository.save.mockRejectedValueOnce(
        new Error('Unique constraint violation'),
      );

      await expect(
        service.createState({
          ra: 10,
          dec: 20,
          fov: 2,
          survey: 'VLASS',
        }),
      ).rejects.toThrow();
    });

    it('should handle audit log creation failures', async () => {
      viewerStateRepository.findOne.mockResolvedValueOnce(null);
      viewerStateRepository.save.mockResolvedValueOnce({
        id: 'state-1',
        short_id: 'Abc123XY',
        state_json: { ra: 10, dec: 20, fov: 2, survey: 'VLASS' },
        encoded_state: 'encoded_state',
        created_at: new Date(),
        updated_at: new Date(),
      } as ViewerState);

      auditLogRepository.createAuditLog.mockRejectedValueOnce(
        new Error('Audit log database full'),
      );

      // Should not thrown, just log the error
      const result = await service.createState({
        ra: 10,
        dec: 20,
        fov: 2,
        survey: 'VLASS',
      });

      expect(result).toBeDefined();
    });

    it('should handle viewer state lookup failures', async () => {
      viewerStateRepository.findOne.mockRejectedValueOnce(
        new Error('Database connection lost'),
      );

      await expect(service.resolveState('Abc123XY')).rejects.toThrow();
    });
  });

  describe('Logging and Telemetry', () => {
    it('should handle logging service failures', async () => {
      loggingService.add.mockRejectedValueOnce(new Error('Cannot write logs'));

      viewerStateRepository.findOne.mockResolvedValueOnce(null);
      viewerStateRepository.save.mockResolvedValueOnce({
        id: 'state-1',
        short_id: 'Abc123XY',
        state_json: { ra: 10, dec: 20, fov: 2, survey: 'VLASS' },
        encoded_state: 'encoded_state',
        created_at: new Date(),
        updated_at: new Date(),
      } as ViewerState);

      // Should not throw, just skip logging
      const result = await service.createState({
        ra: 10,
        dec: 20,
        fov: 2,
        survey: 'VLASS',
      });

      expect(result).toBeDefined();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent cutout requests with fallbacks', async () => {
      const fetchMock = jest.spyOn(global, 'fetch');

      // Both requests get same response
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([70, 73, 84, 83]).buffer,
      } as unknown as Response);

      const results = await Promise.all([
        service.downloadCutout({
          ra: 10,
          dec: 20,
          fov: 2,
          survey: 'VLASS',
        }),
        service.downloadCutout({
          ra: 15,
          dec: 25,
          fov: 3,
          survey: 'VLASS',
        }),
      ]);

      expect(results).toHaveLength(2);
      expect(
        results.every((r) => r !== undefined && r.buffer !== undefined),
      ).toBe(true);
    });
  });
});
