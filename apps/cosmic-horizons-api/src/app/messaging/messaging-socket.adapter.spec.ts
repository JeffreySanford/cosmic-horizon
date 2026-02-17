import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import { MessagingSocketIoAdapter } from './messaging-socket.adapter';

describe('MessagingSocketIoAdapter', () => {
  const originalFrontendUrl = process.env['FRONTEND_URL'];
  const originalHeartbeat = process.env['WEBSOCKET_HEARTBEAT_MS'];
  const originalPingTimeout = process.env['WEBSOCKET_PING_TIMEOUT_MS'];
  const originalMaxBuffer = process.env['WEBSOCKET_MAX_BUFFER_BYTES'];

  function captureOptions(options?: ServerOptions): {
    createServerSpy: jest.SpyInstance;
    merged: ServerOptions;
  } {
    const createServerSpy = jest
      .spyOn(IoAdapter.prototype, 'createIOServer')
      .mockReturnValue({} as ReturnType<IoAdapter['createIOServer']>);

    const adapter = new MessagingSocketIoAdapter({} as never);
    adapter.createIOServer(3000, options);

    const merged = createServerSpy.mock.calls[0]?.[1] as ServerOptions;
    return { createServerSpy, merged };
  }

  beforeEach(() => {
    process.env['FRONTEND_URL'] = 'http://localhost:4200,http://localhost:4300';
    delete process.env['WEBSOCKET_HEARTBEAT_MS'];
    delete process.env['WEBSOCKET_PING_TIMEOUT_MS'];
    delete process.env['WEBSOCKET_MAX_BUFFER_BYTES'];
  });

  afterEach(() => {
    process.env['FRONTEND_URL'] = originalFrontendUrl;
    process.env['WEBSOCKET_HEARTBEAT_MS'] = originalHeartbeat;
    process.env['WEBSOCKET_PING_TIMEOUT_MS'] = originalPingTimeout;
    process.env['WEBSOCKET_MAX_BUFFER_BYTES'] = originalMaxBuffer;
    jest.restoreAllMocks();
  });

  it('applies default websocket options', () => {
    const { merged } = captureOptions();

    expect(merged.transports).toEqual(['websocket', 'polling']);
    expect(merged.pingInterval).toBe(30000);
    expect(merged.pingTimeout).toBe(20000);
    expect(merged.maxHttpBufferSize).toBe(1000000);
    expect(merged.perMessageDeflate).toBe(true);
  });

  it('builds cors allowlist from FRONTEND_URL list', () => {
    const { merged } = captureOptions();

    expect(merged.cors).toEqual({
      origin: ['http://localhost:4200', 'http://localhost:4300'],
      credentials: true,
    });
  });

  it('trims and filters empty origins from FRONTEND_URL', () => {
    process.env['FRONTEND_URL'] =
      '  http://localhost:4200  , ,http://localhost:4400,   ';

    const { merged } = captureOptions();
    expect(merged.cors).toEqual({
      origin: ['http://localhost:4200', 'http://localhost:4400'],
      credentials: true,
    });
  });

  it('falls back to localhost frontend when FRONTEND_URL is missing', () => {
    delete process.env['FRONTEND_URL'];
    const { merged } = captureOptions();

    expect(merged.cors).toEqual({
      origin: ['http://localhost:4200'],
      credentials: true,
    });
  });

  it('uses configured heartbeat interval from environment', () => {
    process.env['WEBSOCKET_HEARTBEAT_MS'] = '45000';
    const { merged } = captureOptions();

    expect(merged.pingInterval).toBe(45000);
  });

  it('uses configured ping timeout from environment', () => {
    process.env['WEBSOCKET_PING_TIMEOUT_MS'] = '25000';
    const { merged } = captureOptions();

    expect(merged.pingTimeout).toBe(25000);
  });

  it('uses configured max buffer size from environment', () => {
    process.env['WEBSOCKET_MAX_BUFFER_BYTES'] = '2000000';
    const { merged } = captureOptions();

    expect(merged.maxHttpBufferSize).toBe(2000000);
  });

  it('falls back to default heartbeat interval when env value is invalid', () => {
    process.env['WEBSOCKET_HEARTBEAT_MS'] = 'not-a-number';
    const { merged } = captureOptions();

    expect(merged.pingInterval).toBe(30000);
  });

  it('falls back to default heartbeat interval when env value is zero', () => {
    process.env['WEBSOCKET_HEARTBEAT_MS'] = '0';
    const { merged } = captureOptions();

    expect(merged.pingInterval).toBe(30000);
  });

  it('falls back to default heartbeat interval when env value is negative', () => {
    process.env['WEBSOCKET_HEARTBEAT_MS'] = '-1';
    const { merged } = captureOptions();

    expect(merged.pingInterval).toBe(30000);
  });

  it('falls back to default ping timeout when env value is invalid', () => {
    process.env['WEBSOCKET_PING_TIMEOUT_MS'] = 'NaN';
    const { merged } = captureOptions();

    expect(merged.pingTimeout).toBe(20000);
  });

  it('falls back to default max buffer when env value is invalid', () => {
    process.env['WEBSOCKET_MAX_BUFFER_BYTES'] = 'NaN';
    const { merged } = captureOptions();

    expect(merged.maxHttpBufferSize).toBe(1000000);
  });

  it('falls back to default max buffer when env value is negative', () => {
    process.env['WEBSOCKET_MAX_BUFFER_BYTES'] = '-100';
    const { merged } = captureOptions();

    expect(merged.maxHttpBufferSize).toBe(1000000);
  });

  it('preserves explicit ping options when provided by caller', () => {
    const { merged } = captureOptions({ pingInterval: 1000, pingTimeout: 5000 });

    expect(merged.pingInterval).toBe(1000);
    expect(merged.pingTimeout).toBe(5000);
  });

  it('allows caller to override transports', () => {
    const { merged } = captureOptions({ transports: ['polling'] });

    expect(merged.transports).toEqual(['polling']);
  });

  it('allows caller to override perMessageDeflate setting', () => {
    const { merged } = captureOptions({ perMessageDeflate: false });

    expect(merged.perMessageDeflate).toBe(false);
  });

  it('allows caller to override cors options', () => {
    const { merged } = captureOptions({
      cors: {
        origin: ['https://example.com'],
        credentials: false,
      },
    });

    expect(merged.cors).toEqual({
      origin: ['https://example.com'],
      credentials: false,
    });
  });

  it('preserves additional caller-provided server options', () => {
    const { merged } = captureOptions({
      serveClient: false,
      allowEIO3: true,
    });

    expect(merged.serveClient).toBe(false);
    expect(merged.allowEIO3).toBe(true);
  });

  it('forwards port and merged options to base IoAdapter', () => {
    const { createServerSpy } = captureOptions();

    expect(createServerSpy).toHaveBeenCalledWith(
      3000,
      expect.objectContaining({
        transports: ['websocket', 'polling'],
      }),
    );
  });
});
