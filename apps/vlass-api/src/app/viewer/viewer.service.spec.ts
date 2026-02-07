import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ViewerService } from './viewer.service';
import { ViewerState } from '../entities/viewer-state.entity';
import { ViewerSnapshot } from '../entities/viewer-snapshot.entity';

describe('ViewerService', () => {
  let service: ViewerService;
  let dataSource: jest.Mocked<Pick<DataSource, 'query'>>;
  let viewerStateRepository: jest.Mocked<Pick<Repository<ViewerState>, 'findOne' | 'create' | 'save'>>;
  let viewerSnapshotRepository: jest.Mocked<Pick<Repository<ViewerSnapshot>, 'create' | 'save'>>;

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

    service = new ViewerService(
      dataSource as unknown as DataSource,
      viewerStateRepository as unknown as Repository<ViewerState>,
      viewerSnapshotRepository as unknown as Repository<ViewerSnapshot>,
    );
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
});
