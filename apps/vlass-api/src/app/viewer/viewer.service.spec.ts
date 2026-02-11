import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ViewerService } from './viewer.service';
import { ViewerState } from '../entities/viewer-state.entity';
import { ViewerSnapshot } from '../entities/viewer-snapshot.entity';
import { AuditLogRepository } from '../repositories';
import { LoggingService } from '../logging/logging.service';

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
  let auditLogRepository: jest.Mocked<Pick<AuditLogRepository, 'createAuditLog'>>;
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

    const created = await service.createState({ ra: 10, dec: 20, fov: 2, survey: 'VLASS' });

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
    await expect(service.createState({ ra: 1000, dec: 20, fov: 2, survey: 'VLASS' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws when state not found', async () => {
    viewerStateRepository.findOne.mockResolvedValueOnce(null);

    await expect(service.resolveState('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('encodes and decodes viewer state', () => {
    const encoded = service.encodeState({ ra: 12.3, dec: -45.6, fov: 3.2, survey: 'VLASS3.1' });
    const decoded = service.decodeState(encoded);

    expect(decoded).toEqual({ ra: 12.3, dec: -45.6, fov: 3.2, survey: 'VLASS3.1' });
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
    expect(auditLogRepository.createAuditLog).toHaveBeenCalled();
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
    const originalSecondaryTemplate = process.env['CUTOUT_SECONDARY_URL_TEMPLATE'];
    const originalSecondaryKey = process.env['CUTOUT_SECONDARY_API_KEY'];
    const originalSecondaryHeader = process.env['CUTOUT_SECONDARY_API_KEY_HEADER'];
    const originalSecondaryPrefix = process.env['CUTOUT_SECONDARY_API_KEY_PREFIX'];
    const originalSecondaryQuery = process.env['CUTOUT_SECONDARY_API_KEY_QUERY_PARAM'];

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
      expect(service.getCutoutTelemetry().provider_fallback_total).toBeGreaterThanOrEqual(1);
    } finally {
      process.env['CUTOUT_SECONDARY_ENABLED'] = originalSecondaryEnabled;
      process.env['CUTOUT_SECONDARY_URL_TEMPLATE'] = originalSecondaryTemplate;
      process.env['CUTOUT_SECONDARY_API_KEY'] = originalSecondaryKey;
      process.env['CUTOUT_SECONDARY_API_KEY_HEADER'] = originalSecondaryHeader;
      process.env['CUTOUT_SECONDARY_API_KEY_PREFIX'] = originalSecondaryPrefix;
      process.env['CUTOUT_SECONDARY_API_KEY_QUERY_PARAM'] = originalSecondaryQuery;
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
});
