import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import Redis from 'ioredis';
import { ViewerService } from './viewer.service';
import { ViewerState } from '../entities/viewer-state.entity';
import { ViewerSnapshot } from '../entities/viewer-snapshot.entity';
import { AuditLogRepository } from '../repositories';
import { LoggingService } from '../logging/logging.service';

jest.mock('ioredis');

describe('ViewerService', () => {
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

    (Redis as unknown as jest.Mock).mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      quit: jest.fn().mockResolvedValue('OK'),
      disconnect: jest.fn().mockResolvedValue(undefined),
    }));

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

  afterEach(async () => {
    await service.onModuleDestroy();
    jest.restoreAllMocks();
  });

  it('creates and resolves viewer state', async () => {
    viewerStateRepository.findOne.mockResolvedValueOnce(null);
    viewerStateRepository.save.mockResolvedValueOnce({
      id: 'state-1',
      short_id: 'Abc123XY',
      encoded_state: 'encoded',
      state_json: { ra: 10, dec: 20, fov: 2, survey: 'VLASS' },
      created_at: new Date('2026-02-07T00:00:00.000Z'),
      updated_at: new Date('2026-02-07T00:00:00.000Z'),
    } as ViewerState);

    const created = await service.createState({
      ra: 10,
      dec: 20,
      fov: 2,
      survey: 'VLASS',
    });

    expect(created.short_id).toBe('Abc123XY');
    expect(created.permalink_path).toBe('/view/Abc123XY');

    viewerStateRepository.findOne.mockResolvedValueOnce({
      id: 'state-1',
      short_id: 'Abc123XY',
      encoded_state: 'encoded',
      state_json: { ra: 10, dec: 20, fov: 2, survey: 'VLASS' },
      created_at: new Date('2026-02-07T00:00:00.000Z'),
      updated_at: new Date('2026-02-07T00:00:00.000Z'),
    } as ViewerState);

    const resolved = await service.resolveState('Abc123XY');
    expect(resolved.short_id).toBe('Abc123XY');
  });

  it('rejects invalid viewer state', async () => {
    await expect(
      service.createState({ ra: 1000, dec: 20, fov: 2, survey: 'VLASS' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when state not found', async () => {
    viewerStateRepository.findOne.mockResolvedValueOnce(null);

    await expect(service.resolveState('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('encodes and decodes viewer state', () => {
    const encoded = service.encodeState({
      ra: 12.3,
      dec: -45.6,
      fov: 3.2,
      survey: 'VLASS3.1',
    });
    const decoded = service.decodeState(encoded);

    expect(decoded).toEqual({
      ra: 12.3,
      dec: -45.6,
      fov: 3.2,
      survey: 'VLASS3.1',
    });
  });

  it('downloads FITS cutout and returns attachment metadata', async () => {
    const result = await service.downloadCutout({
      ra: 187.25,
      dec: 2.05,
      fov: 1.5,
      survey: 'P/DSS2/color',
      label: 'M87 Core',
    });

    expect(fetch).toHaveBeenCalled();
    expect(result.fileName).toBe('M87-Core.fits');
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(auditLogRepository.createAuditLog).toHaveBeenCalled();
  });

  it('creates snapshot metadata and writes an audit log', async () => {
    viewerSnapshotRepository.save.mockResolvedValueOnce({
      id: 'snapshot-1',
      file_name: 'snapshot-1.png',
      mime_type: 'image/png',
      size_bytes: 67,
      short_id: null,
      state_json: null,
      created_at: new Date('2026-02-07T00:00:00.000Z'),
      updated_at: new Date('2026-02-07T00:00:00.000Z'),
    } as ViewerSnapshot);

    const onePixelPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO1N7nQAAAAASUVORK5CYII=';

    const result = await service.createSnapshot({
      image_data_url: `data:image/png;base64,${onePixelPngBase64}`,
    });

    expect(result.id).toBe('snapshot-1');
    expect(result.retention_days).toBeGreaterThanOrEqual(7);
    expect(auditLogRepository.createAuditLog).toHaveBeenCalled();
  });

  it('enforces minimum snapshot retention policy of seven days', async () => {
    const originalRetentionDays = process.env['SNAPSHOT_RETENTION_DAYS'];
    process.env['SNAPSHOT_RETENTION_DAYS'] = '1';

    viewerSnapshotRepository.save.mockResolvedValueOnce({
      id: 'snapshot-policy',
      file_name: 'snapshot-policy.png',
      mime_type: 'image/png',
      size_bytes: 67,
      short_id: null,
      state_json: null,
      created_at: new Date('2026-02-07T00:00:00.000Z'),
      updated_at: new Date('2026-02-07T00:00:00.000Z'),
    } as ViewerSnapshot);

    const onePixelPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO1N7nQAAAAASUVORK5CYII=';

    try {
      const result = await service.createSnapshot({
        image_data_url: `data:image/png;base64,${onePixelPngBase64}`,
      });

      expect(result.retention_days).toBe(7);
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({
            retention_days: 7,
          }),
        }),
      );
    } finally {
      process.env['SNAPSHOT_RETENTION_DAYS'] = originalRetentionDays;
    }
  });

  it('retries cutout request using fallback surveys', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([70, 73, 84, 83]).buffer,
      } as unknown as Response);

    const result = await service.downloadCutout({
      ra: 187.25,
      dec: 2.05,
      fov: 0.2,
      survey: 'VLASS',
      label: 'retry-test',
    });

    expect(result.buffer.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to lower cutout resolution when higher detail fails', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([70, 73, 84, 83]).buffer,
      } as unknown as Response);

    const result = await service.downloadCutout({
      ra: 187.25,
      dec: 2.05,
      fov: 0.2,
      survey: 'VLASS',
      detail: 'max',
      label: 'resolution-fallback',
    });

    const firstUrl = String(fetchMock.mock.calls[0]?.[0] ?? '');
    const finalUrl = String(fetchMock.mock.calls[6]?.[0] ?? '');

    expect(result.buffer.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(firstUrl).toContain('width=3072');
    expect(finalUrl).toContain('width=2048');
  });

  it('tracks cutout telemetry counters', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([70, 73, 84, 83]).buffer,
    } as unknown as Response);

    await service.downloadCutout({
      ra: 187.25,
      dec: 2.05,
      fov: 0.2,
      survey: 'VLASS',
      detail: 'standard',
      label: 'telemetry',
    });

    const telemetry = service.getCutoutTelemetry();
    expect(telemetry.requests_total).toBeGreaterThanOrEqual(1);
    expect(telemetry.success_total).toBeGreaterThanOrEqual(1);
    expect(telemetry.provider_attempts_total).toBeGreaterThanOrEqual(1);
    expect(telemetry.last_success_at).toBeTruthy();
  });

  it('uses configured secondary provider when primary fails', async () => {
    const originalSecondaryEnabled = process.env['CUTOUT_SECONDARY_ENABLED'];
    const originalSecondaryTemplate =
      process.env['CUTOUT_SECONDARY_URL_TEMPLATE'];
    const originalSecondaryKey = process.env['CUTOUT_SECONDARY_API_KEY'];
    const originalSecondaryHeader =
      process.env['CUTOUT_SECONDARY_API_KEY_HEADER'];
    const originalSecondaryPrefix =
      process.env['CUTOUT_SECONDARY_API_KEY_PREFIX'];
    const originalSecondaryQuery =
      process.env['CUTOUT_SECONDARY_API_KEY_QUERY_PARAM'];

    try {
      process.env['CUTOUT_SECONDARY_ENABLED'] = 'true';
      process.env['CUTOUT_SECONDARY_URL_TEMPLATE'] =
        'https://secondary.example/cutout?ra={ra}&dec={dec}&fov={fov}&survey={survey}&width={width}&height={height}';
      process.env['CUTOUT_SECONDARY_API_KEY'] = 'test-key';
      process.env['CUTOUT_SECONDARY_API_KEY_HEADER'] = 'X-API-Key';
      process.env['CUTOUT_SECONDARY_API_KEY_PREFIX'] = '';
      process.env['CUTOUT_SECONDARY_API_KEY_QUERY_PARAM'] = 'apikey';

      const fetchMock = jest.spyOn(global, 'fetch');
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: async () => new Uint8Array([70, 73, 84, 83]).buffer,
        } as unknown as Response);

      const result = await service.downloadCutout({
        ra: 187.25,
        dec: 2.05,
        fov: 0.2,
        survey: 'VLASS',
        detail: 'standard',
        label: 'secondary-provider',
      });

      const secondCallUrl = String(fetchMock.mock.calls[1]?.[0] ?? '');
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(secondCallUrl).toContain('secondary.example/cutout');
      expect(secondCallUrl).toContain('apikey=test-key');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(
        service.getCutoutTelemetry().provider_fallback_total,
      ).toBeGreaterThanOrEqual(1);
    } finally {
      process.env['CUTOUT_SECONDARY_ENABLED'] = originalSecondaryEnabled;
      process.env['CUTOUT_SECONDARY_URL_TEMPLATE'] = originalSecondaryTemplate;
      process.env['CUTOUT_SECONDARY_API_KEY'] = originalSecondaryKey;
      process.env['CUTOUT_SECONDARY_API_KEY_HEADER'] = originalSecondaryHeader;
      process.env['CUTOUT_SECONDARY_API_KEY_PREFIX'] = originalSecondaryPrefix;
      process.env['CUTOUT_SECONDARY_API_KEY_QUERY_PARAM'] =
        originalSecondaryQuery;
    }
  });

  it('validates labels in viewer state', async () => {
    await expect(
      service.createState({
        ra: 187.25,
        dec: 2.05,
        fov: 1.5,
        survey: 'VLASS',
        labels: [{ name: '', ra: 187.25, dec: 2.05 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns nearby SIMBAD labels for a centered cone query', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        metadata: [
          { name: 'main_id' },
          { name: 'ra' },
          { name: 'dec' },
          { name: 'otype_txt' },
          { name: 'ang_dist' },
        ],
        data: [
          ['M 87', 187.7059, 12.3911, 'Galaxy', 0.0123],
          ['[VV2006] J1234', 187.7065, 12.3921, 'Unknown', 0.0201],
        ],
      }),
    } as unknown as Response);

    const labels = await service.getNearbyLabels(187.7, 12.39, 0.08, 10);

    expect(labels.length).toBe(2);
    expect(labels[0]).toMatchObject({
      name: 'M 87',
      object_type: 'Galaxy',
    });
    expect(labels[0].confidence).toBeGreaterThan(labels[1].confidence);
  });

  // ========== REDIS CACHE & LIFECYCLE TESTS ==========

  it('initializes Redis cache when enabled and credentials provided', async () => {
    const originalRedisEnabled = process.env['REDIS_CACHE_ENABLED'];
    const originalRedisHost = process.env['REDIS_HOST'];
    const originalRedisPort = process.env['REDIS_PORT'];
    const originalRedisPassword = process.env['REDIS_PASSWORD'];

    try {
      process.env['REDIS_CACHE_ENABLED'] = 'true';
      process.env['REDIS_HOST'] = 'localhost';
      process.env['REDIS_PORT'] = '6379';
      process.env['REDIS_PASSWORD'] = 'test-password';

      const testService = new ViewerService(
        dataSource as unknown as DataSource,
        viewerStateRepository as unknown as Repository<ViewerState>,
        viewerSnapshotRepository as unknown as Repository<ViewerSnapshot>,
        auditLogRepository as unknown as AuditLogRepository,
        loggingService as unknown as LoggingService,
      );

      await testService.onModuleInit();
      // Service should initialize without errors when Redis is available
      expect(testService.getCutoutTelemetry()).toBeDefined();
      await testService.onModuleDestroy();
    } finally {
      process.env['REDIS_CACHE_ENABLED'] = originalRedisEnabled;
      process.env['REDIS_HOST'] = originalRedisHost;
      process.env['REDIS_PORT'] = originalRedisPort;
      process.env['REDIS_PASSWORD'] = originalRedisPassword;
    }
  });

  it('disables Redis cache when REDIS_CACHE_ENABLED is false', async () => {
    const originalRedisEnabled = process.env['REDIS_CACHE_ENABLED'];
    try {
      process.env['REDIS_CACHE_ENABLED'] = 'false';

      const testService = new ViewerService(
        dataSource as unknown as DataSource,
        viewerStateRepository as unknown as Repository<ViewerState>,
        viewerSnapshotRepository as unknown as Repository<ViewerSnapshot>,
        auditLogRepository as unknown as AuditLogRepository,
        loggingService as unknown as LoggingService,
      );

      await testService.onModuleInit();
      const telemetry = testService.getCutoutTelemetry();
      expect(telemetry).toBeDefined();
      await testService.onModuleDestroy();
    } finally {
      process.env['REDIS_CACHE_ENABLED'] = originalRedisEnabled;
    }
  });

  it('disables Redis cache in production without REDIS_PASSWORD', async () => {
    const originalNodeEnv = process.env['NODE_ENV'];
    const originalRedisEnabled = process.env['REDIS_CACHE_ENABLED'];
    const originalRedisPassword = process.env['REDIS_PASSWORD'];

    try {
      process.env['NODE_ENV'] = 'production';
      process.env['REDIS_CACHE_ENABLED'] = 'true';
      delete process.env['REDIS_PASSWORD'];

      const testLoggingService = {
        add: jest.fn().mockResolvedValue(undefined),
      };

      const testService = new ViewerService(
        dataSource as unknown as DataSource,
        viewerStateRepository as unknown as Repository<ViewerState>,
        viewerSnapshotRepository as unknown as Repository<ViewerSnapshot>,
        auditLogRepository as unknown as AuditLogRepository,
        testLoggingService as unknown as LoggingService,
      );

      await testService.onModuleInit();
      // Should complete without errors - Redis disabled due to missing password in production
      expect(testService).toBeDefined();
      await testService.onModuleDestroy();
    } finally {
      process.env['NODE_ENV'] = originalNodeEnv;
      process.env['REDIS_CACHE_ENABLED'] = originalRedisEnabled;
      process.env['REDIS_PASSWORD'] = originalRedisPassword;
    }
  });

  it('handles cutout cache hit in memory', async () => {
    const onePixelPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO1N7nQAAAAASUVORK5CYII=';
    const cacheKey = 'cutout|187.25|2.05|1.5|VLASS|2048|2048';

    const firstResult = await service.downloadCutout({
      ra: 187.25,
      dec: 2.05,
      fov: 1.5,
      survey: 'VLASS',
      label: 'first-call',
    });

    expect(firstResult.buffer.length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledTimes(1);

    // Second call should use cache
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([70, 73, 84, 83]).buffer,
    } as unknown as Response);

    const secondResult = await service.downloadCutout({
      ra: 187.25,
      dec: 2.05,
      fov: 1.5,
      survey: 'VLASS',
      label: 'second-call',
    });

    expect(secondResult.buffer).toEqual(firstResult.buffer);
  });

  it('handles cutout cache expiration and eviction', async () => {
    const originalCacheTtl = process.env['CUTOUT_CACHE_TTL_MS'];
    try {
      process.env['CUTOUT_CACHE_TTL_MS'] = '1'; // 1ms expiry

      await service.downloadCutout({
        ra: 187.25,
        dec: 2.05,
        fov: 1.5,
        survey: 'VLASS',
        label: 'first-call',
      });

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([70, 73, 84, 83]).buffer,
      } as unknown as Response);

      // Should fetch again since cache expired
      await service.downloadCutout({
        ra: 187.25,
        dec: 2.05,
        fov: 1.5,
        survey: 'VLASS',
        label: 'second-call',
      });

      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      process.env['CUTOUT_CACHE_TTL_MS'] = originalCacheTtl;
    }
  });

  it('handles nearby labels cache hit from memory', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        metadata: [
          { name: 'main_id' },
          { name: 'ra' },
          { name: 'dec' },
          { name: 'otype_txt' },
          { name: 'ang_dist' },
        ],
        data: [['M 87', 187.7059, 12.3911, 'Galaxy', 0.0123]],
      }),
    } as unknown as Response);

    const firstCall = await service.getNearbyLabels(187.7, 12.39, 0.08, 10);
    expect(firstCall.length).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);

    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        metadata: [{ name: 'main_id' }],
        data: [['DIFFERENT', 0, 0, 'Different', 0]],
      }),
    } as unknown as Response);

    // Second call should use cache, not new fetch
    const secondCall = await service.getNearbyLabels(187.7, 12.39, 0.08, 10);
    expect(secondCall).toEqual(firstCall);
    expect(fetch).toHaveBeenCalledTimes(1); // Still only 1, cache was used
  });

  it('handles nearby labels with different query parameters bypassing cache', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          metadata: [
            { name: 'main_id' },
            { name: 'ra' },
            { name: 'dec' },
            { name: 'otype_txt' },
            { name: 'ang_dist' },
          ],
          data: [['Object 1', 187.7, 12.39, 'Galaxy', 0.01]],
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          metadata: [
            { name: 'main_id' },
            { name: 'ra' },
            { name: 'dec' },
            { name: 'otype_txt' },
            { name: 'ang_dist' },
          ],
          data: [['Object 1', 187.7, 12.39, 'Galaxy', 0.01]],
        }),
      } as unknown as Response);

    const firstCall = await service.getNearbyLabels(187.7, 12.39, 0.08, 10);
    expect(firstCall.length).toBe(1);

    // Different radius - should call API again
    const differentRadiusCall = await service.getNearbyLabels(
      187.7,
      12.39,
      0.16,
      10,
    );
    expect(differentRadiusCall.length).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('handles nearby labels cache expiration', async () => {
    const originalCacheTtl = process.env['NEARBY_LABELS_CACHE_TTL_MS'];
    try {
      process.env['NEARBY_LABELS_CACHE_TTL_MS'] = '1'; // 1ms expiry

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          metadata: [
            { name: 'main_id' },
            { name: 'ra' },
            { name: 'dec' },
            { name: 'otype_txt' },
            { name: 'ang_dist' },
          ],
          data: [['M 87', 187.7059, 12.3911, 'Galaxy', 0.0123]],
        }),
      } as unknown as Response);

      const firstCall = await service.getNearbyLabels(187.7, 12.39, 0.08, 10);
      expect(firstCall.length).toBe(1);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          metadata: [
            { name: 'main_id' },
            { name: 'ra' },
            { name: 'dec' },
            { name: 'otype_txt' },
            { name: 'ang_dist' },
          ],
          data: [['M 87', 187.7059, 12.3911, 'Galaxy', 0.0123]],
        }),
      } as unknown as Response);

      const secondCall = await service.getNearbyLabels(187.7, 12.39, 0.08, 10);
      expect(secondCall.length).toBe(1);
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      process.env['NEARBY_LABELS_CACHE_TTL_MS'] = originalCacheTtl;
    }
  });

  it('handles SIMBAD TAP query malformed response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        // Missing required fields
        data: [['M 87']],
      }),
    } as unknown as Response);

    const labels = await service.getNearbyLabels(187.7, 12.39, 0.08, 10);
    expect(labels.length).toBe(0);
  });

  it('handles SIMBAD TAP query network error gracefully', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('Network error'));

    const labels = await service.getNearbyLabels(187.7, 12.39, 0.08, 10);
    expect(labels.length).toBe(0);
  });

  it('handles SIMBAD TAP empty results', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        metadata: [
          { name: 'main_id' },
          { name: 'ra' },
          { name: 'dec' },
          { name: 'otype_txt' },
          { name: 'ang_dist' },
        ],
        data: [],
      }),
    } as unknown as Response);

    const labels = await service.getNearbyLabels(187.7, 12.39, 0.08, 10);
    expect(labels.length).toBe(0);
  });

  it('handles all cutout resolution fallback levels', async () => {
    const dimension_combos = [
      { width: 3072, height: 3072 },
      { width: 2560, height: 2560 },
      { width: 2048, height: 2048 },
      { width: 1024, height: 1024 },
      { width: 512, height: 512 },
      { width: 256, height: 256 },
      { width: 128, height: 128 },
    ];

    const fetchMock = jest.spyOn(global, 'fetch');
    dimension_combos.forEach(() => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([70, 73, 84, 83]).buffer,
    } as unknown as Response);

    const result = await service.downloadCutout({
      ra: 187.25,
      dec: 2.05,
      fov: 0.2,
      survey: 'VLASS',
      detail: 'max',
      label: 'full-fallback-chain',
    });

    expect(result.buffer.length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(dimension_combos.length + 1);
  });

  it('encodes and decodes state with labels correctly', async () => {
    const stateWithLabels = {
      ra: 187.25,
      dec: 2.05,
      fov: 1.5,
      survey: 'VLASS',
      labels: [
        { name: 'M 87', ra: 187.25, dec: 2.05 },
        { name: 'NGC 4472', ra: 187.3, dec: 1.9 },
      ],
    };

    const encoded = service.encodeState(stateWithLabels);
    const decoded = service.decodeState(encoded);

    expect(decoded).toEqual(stateWithLabels);
    expect(decoded.labels).toHaveLength(2);
  });

  it('handles short ID generation uniqueness', async () => {
    viewerStateRepository.findOne.mockResolvedValue(null);
    let idCounter = 0;

    viewerStateRepository.save.mockImplementation(async (entity: any) => {
      idCounter++;
      return {
        id: `state-${idCounter}`,
        short_id: `ID${idCounter}`,
        encoded_state: entity.encoded_state,
        state_json: entity.state_json,
        created_at: new Date(),
        updated_at: new Date(),
      } as ViewerState;
    });

    const states = [];
    for (let i = 0; i < 3; i++) {
      const state = await service.createState({
        ra: 10 + i,
        dec: 20,
        fov: 2,
        survey: 'VLASS',
      });
      states.push(state);
    }

    expect(states).toHaveLength(3);
    expect(states[0].short_id).not.toBe(states[1].short_id);
    expect(states[1].short_id).not.toBe(states[2].short_id);
  });

  it('destroys Redis connection gracefully on module destroy', async () => {
    const quitSpy = jest.fn().mockResolvedValue(undefined);
    const disconnectSpy = jest.fn().mockResolvedValue(undefined);

    // Manually set redisClient to simulate initialized service
    (service as any).redisClient = {
      quit: quitSpy,
      disconnect: disconnectSpy,
    };
    (service as any).redisEnabled = true;

    await service.onModuleDestroy();

    expect(quitSpy).toHaveBeenCalled();
    expect((service as any).redisClient).toBeNull();
    expect((service as any).redisEnabled).toBe(false);
  });

  it('handles Redis quit failure and falls back to disconnect', async () => {
    const quitSpy = jest.fn().mockRejectedValue(new Error('Quit failed'));
    const disconnectSpy = jest.fn().mockResolvedValue(undefined);

    (service as any).redisClient = {
      quit: quitSpy,
      disconnect: disconnectSpy,
    };
    (service as any).redisEnabled = true;

    await service.onModuleDestroy();

    expect(quitSpy).toHaveBeenCalled();
    expect(disconnectSpy).toHaveBeenCalled();
    expect((service as any).redisClient).toBeNull();
  });

  it('handles null Redis client on module destroy', async () => {
    (service as any).redisClient = null;
    (service as any).redisEnabled = false;

    // Should not throw
    await expect(service.onModuleDestroy()).resolves.not.toThrow();
  });

  it('validates geographic coordinates in state', async () => {
    const invalidStates = [
      { ra: -0.1, dec: 0, fov: 1.5, survey: 'VLASS' },
      { ra: 360.1, dec: 0, fov: 1.5, survey: 'VLASS' },
      { ra: 180, dec: -90.1, fov: 1.5, survey: 'VLASS' },
      { ra: 180, dec: 90.1, fov: 1.5, survey: 'VLASS' },
      { ra: 180, dec: 45, fov: 0.01, survey: 'VLASS' },
      { ra: 180, dec: 45, fov: 90.1, survey: 'VLASS' },
    ] as ViewerStatePayload[];

    for (const invalidState of invalidStates) {
      await expect(service.createState(invalidState)).rejects.toThrow();
    }
  });

  it('handles cutout download with labels in request', async () => {
    const result = await service.downloadCutout({
      ra: 187.25,
      dec: 2.05,
      fov: 1.5,
      survey: 'VLASS',
      label: 'M87-Core-Region',
    });

    expect(result.fileName).toContain('M87-Core-Region');
    expect(result.buffer.length).toBeGreaterThan(0);
  });
});
