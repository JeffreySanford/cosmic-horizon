import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MessagingService } from './messaging.service';
import { AppLoggerService } from './app-logger.service';
import { AuthSessionService } from './auth-session.service';

describe('MessagingService (frontend)', () => {
  let service: MessagingService;
  let auth: Partial<AuthSessionService>;
  let logger: Partial<AppLoggerService>;
  let createdSockets: any[];
  let fakeSocket: any;

  beforeEach(() => {
    createdSockets = [];

    // stubbed auth service
    auth = {
      isAuthenticated: vi.fn().mockReturnValue(false),
      getToken: vi.fn().mockReturnValue(null),
    };

    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        MessagingService,
        { provide: AuthSessionService, useValue: auth },
        { provide: AppLoggerService, useValue: logger },
      ],
    });

    service = TestBed.inject(MessagingService);

    // prepare a fake socket that we can control
    fakeSocket = {
      on: vi.fn((event: string, cb: (data: any) => void) => {
        // store handlers if needed
        fakeSocket.handlers = fakeSocket.handlers || {};
        fakeSocket.handlers[event] = cb;
      }),
      emit: vi.fn((event: string, payload: any, cb: (resp: any) => void) => {
        // immediately ack for tests
        if (cb) cb({ joined: true, room: 'job:' + payload.jobId });
      }),
      disconnect: vi.fn(),
    };

    // override createSocket to capture parameters and return fake socket
    (service as any).createSocket = (url: string, opts: any) => {
      createdSockets.push({ url, opts });
      return fakeSocket;
    };
  });

  it('should be created', () => {
    expect(service).toBeDefined();
  });

  it('does not connect automatically when not authenticated', () => {
    service.ensureConnected();
    expect(createdSockets.length).toBe(0);
  });

  it('connects when authenticated and token available', () => {
    (auth.isAuthenticated as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (auth.getToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('tok123');
    service.ensureConnected();
    expect(createdSockets.length).toBe(1);
    const { opts } = createdSockets[0];
    expect(opts.auth.token).toBe('tok123');
  });

  it('clears socket on disconnect and will reconnect on next ensureConnected', () => {
    (auth.isAuthenticated as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (auth.getToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('tk');
    service.ensureConnected();
    expect(createdSockets.length).toBe(1);

    // simulate a disconnect event
    const sock: any = (service as any).socket;
    if (sock.handlers['disconnect']) {
      sock.handlers['disconnect']('io');
    }
    expect((service as any).socket).toBeNull();

    service.ensureConnected();
    expect(createdSockets.length).toBe(2);
  });

  it('warns if token missing even when authenticated', () => {
    (auth.isAuthenticated as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (auth.getToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue(null);
    service.ensureConnected();
    expect(logger.warn).toHaveBeenCalledWith(
      'messaging',
      'Cannot connect: no authentication token',
    );
    expect(createdSockets.length).toBe(0);
  });

  it('forwards job_update events through jobUpdate$ observable', async () => {
    (auth.isAuthenticated as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (auth.getToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('x');
    service.ensureConnected();

    const promise = new Promise((resolve) => {
      service.jobUpdate$.subscribe((update) => resolve(update));
    });

    // simulate incoming event from socket after subscription is ready
    fakeSocket.handlers['job_update']({ id: 'foo', status: 'bar' });
    const result: any = await promise;
    expect(result).toEqual({ id: 'foo', status: 'bar' });
  });

  it('creates socket with reconnection enabled and proper auth options', () => {
    (auth.isAuthenticated as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (auth.getToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('mytoken');
    service.ensureConnected();
    expect(createdSockets.length).toBe(1);
    const opts = createdSockets[0].opts;
    expect(opts.reconnection).toBe(true);
    expect(opts.auth.token).toBe('mytoken');
  });


  it('joinJobChannel returns server acknowledgement', async () => {
    (auth.isAuthenticated as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (auth.getToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('x');
    service.ensureConnected();

    const resp = await service.joinJobChannel('job-7');
    expect(resp.joined).toBe(true);
    expect(resp.room).toBe('job:job-7');
    expect(fakeSocket.emit).toHaveBeenCalledWith(
      'join_job_channel',
      { jobId: 'job-7' },
      expect.any(Function),
    );
  });

  it('joinJobChannel rejects when socket not connected', async () => {
    await expect(service.joinJobChannel('x')).rejects.toThrow('socket not connected');
  });

  it('ensureConnected only creates one socket even if called repeatedly', () => {
    (auth.isAuthenticated as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (auth.getToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('t');
    service.ensureConnected();
    service.ensureConnected();
    expect(createdSockets.length).toBe(1);
  });

  it('ensureConnected skips if socket already exists', () => {
    (auth.isAuthenticated as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (auth.getToken as unknown as ReturnType<typeof vi.fn>).mockReturnValue('t');
    service.ensureConnected();
    // simulate socket lost
    (service as any).socket = null;
    service.ensureConnected();
    expect(createdSockets.length).toBe(2);
  });
});
