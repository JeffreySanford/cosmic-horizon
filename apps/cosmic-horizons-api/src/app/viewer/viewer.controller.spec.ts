import { StreamableFile } from '@nestjs/common';
import { ViewerController } from './viewer.controller';
import { ViewerService } from './viewer.service';

describe('ViewerController', () => {
  let controller: ViewerController;
  let viewerService: jest.Mocked<ViewerService>;

  beforeEach(() => {
    viewerService = {
      createState: jest.fn(),
      resolveState: jest.fn(),
      createSnapshot: jest.fn(),
      downloadCutout: jest.fn(),
      getNearbyLabels: jest.fn(),
      getCutoutTelemetry: jest.fn().mockReturnValue({
        requests_total: 0,
        success_total: 0,
        failure_total: 0,
        provider_attempts_total: 0,
        provider_failures_total: 0,
        cache_hits_total: 0,
        resolution_fallback_total: 0,
        survey_fallback_total: 0,
        provider_fallback_total: 0,
        primary_success_total: 0,
        secondary_success_total: 0,
        consecutive_failures: 0,
        last_success_at: null,
        last_failure_at: null,
        last_failure_reason: null,
        recent_failures: [],
      }),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    } as unknown as jest.Mocked<ViewerService>;

    controller = new ViewerController(viewerService);
  });

  it('creates viewer state with valid payload', async () => {
    const statePayload = {
      state: {
        ra: 187.25,
        dec: 2.05,
        fov: 1.5,
        survey: 'VLASS',
      },
    };

    const mockResponse = {
      id: 'state-1',
      short_id: 'ABC123XY',
      encoded_state: 'encoded',
      state: statePayload.state,
      permalink_path: '/view/ABC123XY',
      created_at: new Date(),
    };

    viewerService.createState.mockResolvedValue(mockResponse as any);

    const result = await controller.createState(statePayload);

    expect(viewerService.createState).toHaveBeenCalledWith(statePayload.state);
    expect(result.short_id).toBe('ABC123XY');
  });

  it('creates snapshot with valid image data', async () => {
    const snapshotPayload = {
      image_data_url:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO1N7nQAAAAASUVORK5CYII=',
    };

    const mockResponse = {
      id: 'snapshot-1',
      file_name: 'snapshot-1.png',
      mime_type: 'image/png',
      size_bytes: 67,
      created_at: new Date(),
      retention_days: 7,
    };

    viewerService.createSnapshot.mockResolvedValue(mockResponse as any);

    const result = await controller.createSnapshot(snapshotPayload);

    expect(viewerService.createSnapshot).toHaveBeenCalledWith(snapshotPayload);
    expect(result.id).toBe('snapshot-1');
  });

  it('downloads cutout with valid query parameters', async () => {
    const mockBuffer = Buffer.from([70, 73, 84, 83]);

    viewerService.downloadCutout.mockResolvedValue({
      buffer: mockBuffer,
      fileName: 'M87-Core.fits',
    });

    const result = await controller.downloadCutout(
      '187.25',
      '2.05',
      '1.5',
      'VLASS',
      'M87-Core',
      'standard',
    );

    expect(viewerService.downloadCutout).toHaveBeenCalledWith({
      ra: 187.25,
      dec: 2.05,
      fov: 1.5,
      survey: 'VLASS',
      label: 'M87-Core',
      detail: 'standard',
    });

    expect(result).toBeInstanceOf(StreamableFile);
  });

  it('sets cache header when response object passed', async () => {
    const mockBuffer = Buffer.from([1, 2, 3]);
    viewerService.downloadCutout.mockResolvedValue({
      buffer: mockBuffer,
      fileName: 'file.fits',
    });

    const fakeRes: any = { setHeader: jest.fn() };
    await controller.downloadCutout(
      '1',
      '2',
      '3',
      'SV',
      undefined,
      'standard',
      fakeRes,
    );
    expect(fakeRes.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=60',
    );
  });

  it('downloads cutout with high detail level', async () => {
    const mockBuffer = Buffer.from([70, 73, 84, 83]);
    viewerService.downloadCutout.mockResolvedValue({
      buffer: mockBuffer,
      fileName: 'cutout.fits',
    });

    await controller.downloadCutout(
      '187.25',
      '2.05',
      '1.5',
      'VLASS',
      undefined,
      'high',
    );

    expect(viewerService.downloadCutout).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: 'high',
      }),
    );
  });

  it('retrieves nearby labels with valid parameters', async () => {
    const mockLabels = [
      {
        name: 'M 87',
        ra: 187.7,
        dec: 12.39,
        object_type: 'Galaxy',
        angular_distance_deg: 0.01,
        confidence: 0.95,
      },
    ];

    viewerService.getNearbyLabels.mockResolvedValue(mockLabels as any);

    const result = await controller.getNearbyLabels(
      '187.7',
      '12.39',
      '0.08',
      '10',
    );

    expect(viewerService.getNearbyLabels).toHaveBeenCalledWith(
      187.7,
      12.39,
      0.08,
      10,
    );
    expect(result).toHaveLength(1);
  });

  it('defaults nearby labels limit to 12', async () => {
    viewerService.getNearbyLabels.mockResolvedValue([]);

    await controller.getNearbyLabels('187.7', '12.39', '0.08');

    expect(viewerService.getNearbyLabels).toHaveBeenCalledWith(
      187.7,
      12.39,
      0.08,
      12,
    );
  });

  it('sets cache header for nearby labels', async () => {
    viewerService.getNearbyLabels.mockResolvedValue([]);
    const fakeRes: any = { setHeader: jest.fn() };
    await controller.getNearbyLabels('1', '2', '0.1', '5', fakeRes);
    expect(fakeRes.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=30',
    );
  });

  it('resolves viewer state by short ID', async () => {
    const mockState = {
      id: 'state-1',
      short_id: 'ABC123XY',
      encoded_state: 'encoded',
      state: { ra: 187.25, dec: 2.05, fov: 1.5, survey: 'VLASS' },
      created_at: new Date(),
    };

    viewerService.resolveState.mockResolvedValue(mockState as any);

    const result = await controller.getState('ABC123XY');

    expect(viewerService.resolveState).toHaveBeenCalledWith('ABC123XY');
    expect(result.short_id).toBe('ABC123XY');
  });

  it('has authentication guard on write endpoints', () => {
    const createStateGuards = Reflect.getMetadata(
      '__guards__',
      controller.createState,
    );
    const createSnapshotGuards = Reflect.getMetadata(
      '__guards__',
      controller.createSnapshot,
    );
    expect(createStateGuards).toBeDefined();
    expect(createSnapshotGuards).toBeDefined();
    const names = (createStateGuards as any[]).map((g) => g.name);
    expect(names).toContain('AuthenticatedGuard');
  });

  it('applies RateLimitGuard to public read endpoints only', () => {
    const cutoutGuards = Reflect.getMetadata(
      '__guards__',
      controller.downloadCutout,
    );
    const nearbyGuards = Reflect.getMetadata(
      '__guards__',
      controller.getNearbyLabels,
    );
    expect(cutoutGuards).toBeDefined();
    expect(nearbyGuards).toBeDefined();
    const cutoutNames = (cutoutGuards as any[]).map((g) => g.name);
    const nearbyNames = (nearbyGuards as any[]).map((g) => g.name);
    expect(cutoutNames).toContain('RateLimitGuard');
    expect(nearbyNames).toContain('RateLimitGuard');
    // ensure auth is not applied to read endpoints
    expect(cutoutNames).not.toContain('AuthenticatedGuard');
    expect(nearbyNames).not.toContain('AuthenticatedGuard');
  });

  it('returns telemetry for admin users', () => {
    const response = controller.getCutoutTelemetry({
      user: {
        role: 'admin',
      },
    } as never);

    expect(viewerService.getCutoutTelemetry).toHaveBeenCalledWith();
    expect(response.requests_total).toBe(0);
  });

  it('rejects telemetry for non-admin users', () => {
    expect(() =>
      controller.getCutoutTelemetry({
        user: {
          role: 'user',
        },
      } as never),
    ).toThrow();
  });

  it('downloads cutout with max detail level', async () => {
    const mockBuffer = Buffer.from([70, 73, 84, 83]);
    viewerService.downloadCutout.mockResolvedValue({
      buffer: mockBuffer,
      fileName: 'cutout-max.fits',
    });

    await controller.downloadCutout(
      '187.25',
      '2.05',
      '1.5',
      'VLASS',
      undefined,
      'max',
    );

    expect(viewerService.downloadCutout).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: 'max',
      }),
    );
  });

  it('defaults cutout detail to standard for unknown values', async () => {
    const mockBuffer = Buffer.from([70, 73, 84, 83]);
    viewerService.downloadCutout.mockResolvedValue({
      buffer: mockBuffer,
      fileName: 'cutout.fits',
    });

    await controller.downloadCutout(
      '187.25',
      '2.05',
      '1.5',
      'VLASS',
      undefined,
      'unknown',
    );

    expect(viewerService.downloadCutout).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: 'standard',
      }),
    );
  });

  it('includes optional label in cutout request', async () => {
    const mockBuffer = Buffer.from([70, 73, 84, 83]);
    viewerService.downloadCutout.mockResolvedValue({
      buffer: mockBuffer,
      fileName: 'M87.fits',
    });

    await controller.downloadCutout(
      '187.25',
      '2.05',
      '1.5',
      'VLASS',
      'M87',
      'standard',
    );

    expect(viewerService.downloadCutout).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'M87',
      }),
    );
  });

  it('handles cutout with different survey options', async () => {
    const mockBuffer = Buffer.from([70, 73, 84, 83]);
    viewerService.downloadCutout.mockResolvedValue({
      buffer: mockBuffer,
      fileName: 'cutout.fits',
    });

    await controller.downloadCutout('200.1', '15.5', '2.0', 'FIRST');

    expect(viewerService.downloadCutout).toHaveBeenCalledWith(
      expect.objectContaining({
        survey: 'FIRST',
        ra: 200.1,
        dec: 15.5,
        fov: 2.0,
      }),
    );
  });

  it('retrieves nearby labels with various radius values', async () => {
    const mockLabels: any[] = [];
    viewerService.getNearbyLabels.mockResolvedValue(mockLabels as any);

    await controller.getNearbyLabels('180.0', '0.0', '1.5', '5');

    expect(viewerService.getNearbyLabels).toHaveBeenCalledWith(
      180.0,
      0.0,
      1.5,
      5,
    );
  });

  it('handles float coordinates in nearby labels', async () => {
    const mockLabels = [
      {
        name: 'Source A',
        ra: 125.678,
        dec: -45.123,
        object_type: 'Quasar',
        angular_distance_deg: 0.005,
        confidence: 0.99,
      },
    ];
    viewerService.getNearbyLabels.mockResolvedValue(mockLabels as any);

    const result = await controller.getNearbyLabels(
      '125.675',
      '-45.125',
      '0.05',
      '1',
    );

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('creates snapshot and receives metadata', async () => {
    const snapshotPayload = {
      image_data_url: 'data:image/png;base64,iVBORw0KGgo=',
    };

    const mockResponse = {
      id: 'snap-xyz',
      file_name: 'viewer-snapshot.png',
      mime_type: 'image/png',
      size_bytes: 1024,
      created_at: new Date(),
      retention_days: 30,
    };

    viewerService.createSnapshot.mockResolvedValue(mockResponse as any);

    const result = await controller.createSnapshot(snapshotPayload);

    expect(result.file_name).toBe('viewer-snapshot.png');
    expect(result.retention_days).toBe(30);
  });

  it('creates state with complex coordinates', async () => {
    const statePayload = {
      state: {
        ra: 359.9999,
        dec: -89.9999,
        fov: 0.01,
        survey: 'VLASS',
      },
    };

    const mockResponse = {
      id: 'state-edge',
      short_id: 'XYZ789AB',
      encoded_state: 'encoded_edge_case',
      state: statePayload.state,
      permalink_path: '/view/XYZ789AB',
      created_at: new Date(),
    };

    viewerService.createState.mockResolvedValue(mockResponse as any);

    const result = await controller.createState(statePayload);

    expect(result.encoded_state).toBe('encoded_edge_case');
  });

  it('returns telemetry with all metrics', () => {
    const fullTelemetry = {
      requests_total: 10000,
      success_total: 9500,
      failure_total: 500,
      provider_attempts_total: 11000,
      provider_failures_total: 1000,
      cache_hits_total: 5000,
      resolution_fallback_total: 200,
      survey_fallback_total: 100,
      provider_fallback_total: 50,
      primary_success_total: 8000,
      secondary_success_total: 1500,
      consecutive_failures: 0,
      last_success_at: new Date(),
      last_failure_at: new Date(),
      last_failure_reason: 'timeout',
      recent_failures: [{ timestamp: new Date(), reason: 'timeout' }],
    };

    viewerService.getCutoutTelemetry.mockReturnValue(fullTelemetry as any);

    const response = controller.getCutoutTelemetry({
      user: { role: 'admin' },
    } as never);

    expect(response.requests_total).toBe(10000);
    expect(response.success_total).toBe(9500);
    expect(response.cache_hits_total).toBe(5000);
  });

  it('handles resolution with different precision levels', async () => {
    const mockLabels = [
      {
        name: 'High Precision',
        ra: 12.3456789,
        dec: 45.6789012,
        object_type: 'Star',
        angular_distance_deg: 0.00001,
        confidence: 0.999,
      },
    ];
    viewerService.getNearbyLabels.mockResolvedValue(mockLabels as any);

    const result = await controller.getNearbyLabels(
      '12.345678',
      '45.678901',
      '0.1',
    );

    expect(result[0].ra).toBeDefined();
    expect(result[0].dec).toBeDefined();
  });

  it('state with minimal FOV', async () => {
    const statePayload = {
      state: {
        ra: 187.25,
        dec: 2.05,
        fov: 0.001,
        survey: 'VLASS',
      },
    };

    const mockResponse = {
      id: 'state-zoom',
      short_id: 'ZM1ZM1ZM',
      encoded_state: 'zoom_state',
      state: statePayload.state,
      permalink_path: '/view/ZM1ZM1ZM',
      created_at: new Date(),
    };

    viewerService.createState.mockResolvedValue(mockResponse as any);

    const result = await controller.createState(statePayload);

    expect(result.state.fov).toBe(0.001);
  });

  it('getState handles non-existent short IDs gracefully', async () => {
    const mockResponse = null;
    viewerService.resolveState.mockResolvedValue(mockResponse as any);

    const result = await controller.getState('UNKNOWN');

    expect(viewerService.resolveState).toHaveBeenCalledWith('UNKNOWN');
    expect(result).toBeNull();
  });
});
