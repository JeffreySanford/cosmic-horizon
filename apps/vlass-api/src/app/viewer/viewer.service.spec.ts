import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ViewerService } from './viewer.service';
import { ViewerState } from '../entities/viewer-state.entity';
import { ViewerSnapshot } from '../entities/viewer-snapshot.entity';
import { AuditLogRepository } from '../repositories';

describe('ViewerService', () => {
  let service: ViewerService;
  let dataSource: jest.Mocked<Pick<DataSource, 'query'>>;
  let viewerStateRepository: jest.Mocked<Pick<Repository<ViewerState>, 'findOne' | 'create' | 'save'>>;
  let viewerSnapshotRepository: jest.Mocked<Pick<Repository<ViewerSnapshot>, 'create' | 'save'>>;
  let auditLogRepository: jest.Mocked<Pick<AuditLogRepository, 'createAuditLog'>>;

  beforeEach(() => {
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
      createAuditLog: jest.fn().mockResolvedValue(),
    };

    service = new ViewerService(
      dataSource as unknown as DataSource,
      viewerStateRepository as unknown as Repository<ViewerState>,
      viewerSnapshotRepository as unknown as Repository<ViewerSnapshot>,
      auditLogRepository as unknown as AuditLogRepository,
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
});
