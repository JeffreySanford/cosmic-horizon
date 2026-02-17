import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Subject } from 'rxjs';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { MessagingGateway } from './messaging.gateway';
import { MessagingMonitorService } from './messaging-monitor.service';
import { MessagingService } from './messaging.service';
import { MessagingStatsService } from './messaging-stats.service';

type GatewayTestClient = {
  socket: Socket;
  disconnect: jest.Mock;
  join: jest.Mock<Promise<void>, [string]>;
  data: Record<string, unknown>;
};

type ClientOptions = {
  id?: string;
  origin?: string | null;
  authToken?: unknown;
  authorizationHeader?: string;
};

function createClient(options: ClientOptions = {}): GatewayTestClient {
  const headers: Record<string, string> = {};
  const origin = options.origin === undefined ? 'http://localhost:4200' : options.origin;
  if (origin !== null) {
    headers.origin = origin;
  }
  if (typeof options.authorizationHeader === 'string') {
    headers.authorization = options.authorizationHeader;
  }

  const auth: Record<string, unknown> = {};
  if (options.authToken !== undefined) {
    auth.token = options.authToken;
  }

  const disconnect = jest.fn();
  const join = jest.fn().mockResolvedValue(undefined);
  const data: Record<string, unknown> = {};

  return {
    socket: {
      id: options.id ?? `socket-${Math.random().toString(36).slice(2, 8)}`,
      handshake: {
        headers,
        auth,
      },
      disconnect,
      join,
      data,
    } as unknown as Socket,
    disconnect,
    join,
    data,
  };
}

describe('MessagingGateway', () => {
  let gateway: MessagingGateway;
  let telemetrySubject: Subject<Record<string, unknown>>;
  let jwtService: { verify: jest.Mock };
  let authService: { getCurrentUser: jest.Mock };
  let monitorService: { getSnapshot: jest.Mock };
  let statsService: { getSnapshot: jest.Mock };
  let serverEmit: jest.Mock;
  let serverTo: jest.Mock;
  let roomEmit: jest.Mock;
  let loggerLog: jest.Mock;
  let loggerWarn: jest.Mock;
  let loggerDebug: jest.Mock;

  const originalFrontendUrl = process.env['FRONTEND_URL'];
  const originalWebSocketMaxConnections = process.env['WEBSOCKET_MAX_CONNECTIONS_PER_USER'];

  function createGateway(): MessagingGateway {
    telemetrySubject = new Subject<Record<string, unknown>>();
    jwtService = {
      verify: jest.fn(),
    };
    authService = {
      getCurrentUser: jest.fn(),
    };
    monitorService = {
      getSnapshot: jest.fn().mockReturnValue({ monitor: true }),
    };
    statsService = {
      getSnapshot: jest.fn().mockReturnValue({ stats: true }),
    };

    const instance = new MessagingGateway(
      {
        telemetry$: telemetrySubject.asObservable(),
      } as unknown as MessagingService,
      monitorService as unknown as MessagingMonitorService,
      statsService as unknown as MessagingStatsService,
      jwtService as unknown as JwtService,
      authService as unknown as AuthService,
    );

    roomEmit = jest.fn();
    serverTo = jest.fn().mockImplementation((room: string) => ({
      emit: (event: string, payload: unknown) => roomEmit(room, event, payload),
    }));
    serverEmit = jest.fn();
    instance.server = {
      emit: serverEmit,
      to: serverTo,
    } as unknown as Server;

    loggerLog = jest.fn();
    loggerWarn = jest.fn();
    loggerDebug = jest.fn();
    (instance as unknown as { logger: Logger }).logger = {
      log: loggerLog,
      warn: loggerWarn,
      debug: loggerDebug,
    } as unknown as Logger;

    return instance;
  }

  beforeEach(() => {
    process.env['FRONTEND_URL'] = 'http://localhost:4200,http://localhost:4300';
    process.env['WEBSOCKET_MAX_CONNECTIONS_PER_USER'] = '5';
    gateway = createGateway();
  });

  afterEach(() => {
    gateway.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env['FRONTEND_URL'] = originalFrontendUrl;
    process.env['WEBSOCKET_MAX_CONNECTIONS_PER_USER'] = originalWebSocketMaxConnections;
  });

  describe('connection origin and token validation', () => {
    it('rejects client when origin is not allowed', async () => {
      const client = createClient({ origin: 'http://evil.local' });

      await gateway.handleConnection(client.socket);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(jwtService.verify).not.toHaveBeenCalled();
    });

    it('allows connection when origin header is missing', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-allow-originless' });
      authService.getCurrentUser.mockResolvedValue({
        id: 'user-allow-originless',
        role: 'user',
      });

      const client = createClient({ origin: null, authToken: 'originless-token' });
      await gateway.handleConnection(client.socket);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.join).toHaveBeenCalledWith('user:user-allow-originless');
    });

    it('allows connection from a secondary configured origin', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-secondary-origin' });
      authService.getCurrentUser.mockResolvedValue({
        id: 'user-secondary-origin',
        role: 'user',
      });

      const client = createClient({
        origin: 'http://localhost:4300',
        authToken: 'secondary-origin-token',
      });
      await gateway.handleConnection(client.socket);

      expect(client.disconnect).not.toHaveBeenCalled();
      expect(client.join).toHaveBeenCalledWith('user:user-secondary-origin');
    });

    it('rejects client when no token is provided', async () => {
      const client = createClient();
      await gateway.handleConnection(client.socket);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(jwtService.verify).not.toHaveBeenCalled();
    });

    it('rejects client when auth token is empty whitespace', async () => {
      const client = createClient({ authToken: '   ' });
      await gateway.handleConnection(client.socket);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(jwtService.verify).not.toHaveBeenCalled();
    });

    it('rejects client when auth token is not a string', async () => {
      const client = createClient({ authToken: 12345 });
      await gateway.handleConnection(client.socket);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(jwtService.verify).not.toHaveBeenCalled();
    });

    it('accepts bearer token from authorization header', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-header-token' });
      authService.getCurrentUser.mockResolvedValue({
        id: 'user-header-token',
        role: 'user',
      });

      const client = createClient({
        authorizationHeader: 'Bearer header-token',
      });
      await gateway.handleConnection(client.socket);

      expect(jwtService.verify).toHaveBeenCalledWith(
        'header-token',
        expect.objectContaining({ secret: expect.any(String) }),
      );
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('accepts authorization header with lowercase bearer prefix', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-header-lowercase' });
      authService.getCurrentUser.mockResolvedValue({
        id: 'user-header-lowercase',
        role: 'user',
      });

      const client = createClient({
        authorizationHeader: 'bearer lowercase-token',
      });
      await gateway.handleConnection(client.socket);

      expect(jwtService.verify).toHaveBeenCalledWith(
        'lowercase-token',
        expect.objectContaining({ secret: expect.any(String) }),
      );
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('rejects malformed authorization header', async () => {
      const client = createClient({
        authorizationHeader: 'Token malformed',
      });
      await gateway.handleConnection(client.socket);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(jwtService.verify).not.toHaveBeenCalled();
    });

    it('prefers auth token over authorization header token', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-prefer-auth-token' });
      authService.getCurrentUser.mockResolvedValue({
        id: 'user-prefer-auth-token',
        role: 'user',
      });

      const client = createClient({
        authToken: 'auth-priority-token',
        authorizationHeader: 'Bearer header-fallback-token',
      });
      await gateway.handleConnection(client.socket);

      expect(jwtService.verify).toHaveBeenCalledWith(
        'auth-priority-token',
        expect.objectContaining({ secret: expect.any(String) }),
      );
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('rejects client when token verification throws', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      const client = createClient({ authToken: 'bad-token' });
      await gateway.handleConnection(client.socket);

      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('rejects client when verified user does not exist', async () => {
      jwtService.verify.mockReturnValue({ sub: 'missing-user' });
      authService.getCurrentUser.mockResolvedValue(null);

      const client = createClient({ authToken: 'valid-token' });
      await gateway.handleConnection(client.socket);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });

    it('rejects client when user lookup throws', async () => {
      jwtService.verify.mockReturnValue({ sub: 'throws-user' });
      authService.getCurrentUser.mockRejectedValue(new Error('user lookup failed'));

      const client = createClient({ authToken: 'valid-token' });
      await gateway.handleConnection(client.socket);

      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('successful connection behavior', () => {
    it('stores user id and role on socket data', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-1' });
      authService.getCurrentUser.mockResolvedValue({
        id: 'user-1',
        role: 'user',
      });

      const client = createClient({ authToken: 'good-token' });
      await gateway.handleConnection(client.socket);

      expect(client.data['userId']).toBe('user-1');
      expect(client.data['role']).toBe('user');
    });

    it('joins per-user room on successful connection', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-room' });
      authService.getCurrentUser.mockResolvedValue({
        id: 'user-room',
        role: 'user',
      });

      const client = createClient({ authToken: 'good-token' });
      await gateway.handleConnection(client.socket);

      expect(client.join).toHaveBeenCalledWith('user:user-room');
    });

    it('joins admin room for admin users', async () => {
      jwtService.verify.mockReturnValue({ sub: 'admin-1' });
      authService.getCurrentUser.mockResolvedValue({
        id: 'admin-1',
        role: 'admin',
      });

      const client = createClient({ authToken: 'admin-token' });
      await gateway.handleConnection(client.socket);

      expect(client.join).toHaveBeenCalledWith('user:admin-1');
      expect(client.join).toHaveBeenCalledWith('role:admin');
    });

    it('does not join admin room for non-admin users', async () => {
      jwtService.verify.mockReturnValue({ sub: 'user-2' });
      authService.getCurrentUser.mockResolvedValue({
        id: 'user-2',
        role: 'user',
      });

      const client = createClient({ authToken: 'user-token' });
      await gateway.handleConnection(client.socket);

      expect(client.join).toHaveBeenCalledWith('user:user-2');
      expect(client.join).not.toHaveBeenCalledWith('role:admin');
    });
  });

  describe('connection pool behavior', () => {
    it('rejects connection when per-user limit is exceeded', async () => {
      process.env['WEBSOCKET_MAX_CONNECTIONS_PER_USER'] = '1';
      gateway = createGateway();

      jwtService.verify.mockReturnValue({ sub: 'pool-user' });
      authService.getCurrentUser.mockResolvedValue({
        id: 'pool-user',
        role: 'user',
      });

      const firstClient = createClient({ id: 'socket-pool-1', authToken: 'good-token' });
      const secondClient = createClient({ id: 'socket-pool-2', authToken: 'good-token' });

      await gateway.handleConnection(firstClient.socket);
      await gateway.handleConnection(secondClient.socket);

      expect(firstClient.disconnect).not.toHaveBeenCalled();
      expect(secondClient.disconnect).toHaveBeenCalledWith(true);
    });

    it('releases pool slot when client disconnects', async () => {
      process.env['WEBSOCKET_MAX_CONNECTIONS_PER_USER'] = '1';
      gateway = createGateway();

      jwtService.verify.mockReturnValue({ sub: 'pool-disconnect-user' });
      authService.getCurrentUser.mockResolvedValue({
        id: 'pool-disconnect-user',
        role: 'user',
      });

      const firstClient = createClient({
        id: 'socket-disconnect-1',
        authToken: 'good-token',
      });
      const secondClient = createClient({
        id: 'socket-disconnect-2',
        authToken: 'good-token',
      });
      const thirdClient = createClient({
        id: 'socket-disconnect-3',
        authToken: 'good-token',
      });

      await gateway.handleConnection(firstClient.socket);
      await gateway.handleConnection(secondClient.socket);
      expect(secondClient.disconnect).toHaveBeenCalledWith(true);

      gateway.handleDisconnect(firstClient.socket);

      await gateway.handleConnection(thirdClient.socket);
      expect(thirdClient.disconnect).not.toHaveBeenCalled();
    });

    it('uses default pool size when env value is invalid', async () => {
      process.env['WEBSOCKET_MAX_CONNECTIONS_PER_USER'] = 'invalid';
      gateway = createGateway();

      jwtService.verify.mockReturnValue({ sub: 'pool-default-user' });
      authService.getCurrentUser.mockResolvedValue({
        id: 'pool-default-user',
        role: 'user',
      });

      const clients = [
        createClient({ id: 'socket-default-1', authToken: 'good-token' }),
        createClient({ id: 'socket-default-2', authToken: 'good-token' }),
        createClient({ id: 'socket-default-3', authToken: 'good-token' }),
        createClient({ id: 'socket-default-4', authToken: 'good-token' }),
        createClient({ id: 'socket-default-5', authToken: 'good-token' }),
      ];
      const overflow = createClient({ id: 'socket-default-6', authToken: 'good-token' });

      for (const client of clients) {
        await gateway.handleConnection(client.socket);
      }
      await gateway.handleConnection(overflow.socket);

      for (const client of clients) {
        expect(client.disconnect).not.toHaveBeenCalled();
      }
      expect(overflow.disconnect).toHaveBeenCalledWith(true);
    });

    it('cleans pool state when room join throws during connection setup', async () => {
      process.env['WEBSOCKET_MAX_CONNECTIONS_PER_USER'] = '1';
      gateway = createGateway();

      jwtService.verify.mockReturnValue({ sub: 'pool-cleanup-user' });
      authService.getCurrentUser.mockResolvedValue({
        id: 'pool-cleanup-user',
        role: 'user',
      });

      const failingClient = createClient({
        id: 'socket-join-fail',
        authToken: 'good-token',
      });
      failingClient.join.mockRejectedValueOnce(new Error('join failed'));

      const healthyClient = createClient({
        id: 'socket-join-ok',
        authToken: 'good-token',
      });

      await gateway.handleConnection(failingClient.socket);
      await gateway.handleConnection(healthyClient.socket);

      expect(failingClient.disconnect).toHaveBeenCalledWith(true);
      expect(healthyClient.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('join_job_channel handler', () => {
    it('joins requested job room', async () => {
      const client = createClient({ id: 'socket-job-1' });
      const response = await gateway.joinJobChannel(client.socket, { jobId: 'job-123' });

      expect(client.join).toHaveBeenCalledWith('job:job-123');
      expect(response).toEqual({ joined: true, room: 'job:job-123' });
    });

    it('trims job id before joining room', async () => {
      const client = createClient({ id: 'socket-job-2' });
      const response = await gateway.joinJobChannel(client.socket, {
        jobId: '  job-456  ',
      });

      expect(client.join).toHaveBeenCalledWith('job:job-456');
      expect(response).toEqual({ joined: true, room: 'job:job-456' });
    });

    it('returns validation error when payload is undefined', async () => {
      const client = createClient({ id: 'socket-job-3' });
      const response = await gateway.joinJobChannel(client.socket, undefined as never);

      expect(client.join).not.toHaveBeenCalled();
      expect(response).toEqual({ joined: false, error: 'jobId is required' });
    });

    it('returns validation error when payload is empty object', async () => {
      const client = createClient({ id: 'socket-job-4' });
      const response = await gateway.joinJobChannel(client.socket, {});

      expect(client.join).not.toHaveBeenCalled();
      expect(response).toEqual({ joined: false, error: 'jobId is required' });
    });

    it('returns validation error when jobId is only whitespace', async () => {
      const client = createClient({ id: 'socket-job-5' });
      const response = await gateway.joinJobChannel(client.socket, { jobId: '    ' });

      expect(client.join).not.toHaveBeenCalled();
      expect(response).toEqual({ joined: false, error: 'jobId is required' });
    });
  });

  describe('emit helper methods', () => {
    it('emitToUser sends event to user room', () => {
      gateway.emitToUser('user-42', 'job_notification', { ok: true });

      expect(serverTo).toHaveBeenCalledWith('user:user-42');
      expect(roomEmit).toHaveBeenCalledWith('user:user-42', 'job_notification', { ok: true });
    });

    it('emitJobUpdate broadcasts to user and job room when user id is provided', () => {
      gateway.emitJobUpdate('job-77', { status: 'RUNNING' }, 'user-42');

      expect(roomEmit).toHaveBeenCalledWith('user:user-42', 'job_update', { status: 'RUNNING' });
      expect(roomEmit).toHaveBeenCalledWith('job:job-77', 'job_update', { status: 'RUNNING' });
    });

    it('emitJobUpdate broadcasts only to job room when user id is missing', () => {
      gateway.emitJobUpdate('job-88', { status: 'QUEUED' });

      expect(roomEmit).toHaveBeenCalledTimes(1);
      expect(roomEmit).toHaveBeenCalledWith('job:job-88', 'job_update', { status: 'QUEUED' });
    });

    it('emitJobUpdate broadcasts only to job room when user id is empty string', () => {
      gateway.emitJobUpdate('job-89', { status: 'COMPLETE' }, '');

      expect(roomEmit).toHaveBeenCalledTimes(1);
      expect(roomEmit).toHaveBeenCalledWith('job:job-89', 'job_update', { status: 'COMPLETE' });
    });
  });

  describe('gateway lifecycle behavior', () => {
    it('afterInit logs gateway initialization', () => {
      gateway.afterInit();
      expect(loggerLog).toHaveBeenCalledWith('Messaging WebSocket Gateway Initialized');
    });

    it('afterInit forwards telemetry packets to websocket clients', () => {
      gateway.afterInit();
      const packet = { packetId: 'telemetry-1' };
      telemetrySubject.next(packet);

      expect(serverEmit).toHaveBeenCalledWith('telemetry_update', packet);
    });

    it('afterInit emits stats updates every second', () => {
      jest.useFakeTimers();
      gateway.afterInit();

      expect(serverEmit).not.toHaveBeenCalledWith('stats_update', expect.anything());

      jest.advanceTimersByTime(1000);
      expect(serverEmit).toHaveBeenCalledWith('stats_update', { stats: true });
    });

    it('afterInit builds stats payload using monitor snapshot', () => {
      jest.useFakeTimers();
      monitorService.getSnapshot.mockReturnValue({ monitorPayload: 'snapshot' });
      statsService.getSnapshot.mockReturnValue({ statsPayload: 'result' });

      gateway.afterInit();
      jest.advanceTimersByTime(1000);

      expect(monitorService.getSnapshot).toHaveBeenCalled();
      expect(statsService.getSnapshot).toHaveBeenCalledWith({ monitorPayload: 'snapshot' });
      expect(serverEmit).toHaveBeenCalledWith('stats_update', { statsPayload: 'result' });
    });

    it('onModuleDestroy stops telemetry forwarding', () => {
      gateway.afterInit();
      const packetBeforeDestroy = { packetId: 'before-destroy' };
      telemetrySubject.next(packetBeforeDestroy);
      expect(serverEmit).toHaveBeenCalledWith('telemetry_update', packetBeforeDestroy);

      gateway.onModuleDestroy();
      serverEmit.mockClear();

      telemetrySubject.next({ packetId: 'after-destroy' });
      expect(serverEmit).not.toHaveBeenCalled();
    });

    it('onModuleDestroy stops stats interval emissions', () => {
      jest.useFakeTimers();
      gateway.afterInit();

      jest.advanceTimersByTime(1000);
      const callsBeforeDestroy = serverEmit.mock.calls.length;

      gateway.onModuleDestroy();
      jest.advanceTimersByTime(3000);

      expect(serverEmit.mock.calls.length).toBe(callsBeforeDestroy);
    });

    it('handleDisconnect logs disconnect event', () => {
      const client = createClient({ id: 'socket-disconnect-log' });
      gateway.handleDisconnect(client.socket);

      expect(loggerLog).toHaveBeenCalledWith('Client disconnected: socket-disconnect-log');
    });
  });
});
