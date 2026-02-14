import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { MessagingGateway } from './messaging.gateway';
import { MessagingMonitorService } from './messaging-monitor.service';
import { MessagingService } from './messaging.service';
import { MessagingStatsService } from './messaging-stats.service';
import { AuthService } from '../auth/auth.service';

describe('MessagingGateway', () => {
  let gateway: MessagingGateway;
  let jwtService: { verify: jest.Mock };
  let authService: { getCurrentUser: jest.Mock };

  beforeEach(() => {
    jwtService = {
      verify: jest.fn(),
    };
    authService = {
      getCurrentUser: jest.fn(),
    };

    gateway = new MessagingGateway(
      {
        telemetry$: {
          subscribe: jest.fn(() => ({
            unsubscribe: jest.fn(),
          })),
        },
      } as unknown as MessagingService,
      {
        getSnapshot: jest.fn(),
      } as unknown as MessagingMonitorService,
      {
        getSnapshot: jest.fn(),
      } as unknown as MessagingStatsService,
      jwtService as unknown as JwtService,
      authService as unknown as AuthService,
    );

    gateway.server = {
      emit: jest.fn(),
    } as unknown as Server;

    process.env['FRONTEND_URL'] = 'http://localhost:4200';
  });

  it('rejects client when origin is not allowed', async () => {
    const disconnect = jest.fn();
    const client = {
      id: 'socket-1',
      handshake: {
        headers: {
          origin: 'http://evil.local',
        },
        auth: {},
      },
      disconnect,
      data: {},
    } as unknown as Socket;

    await gateway.handleConnection(client);

    expect(disconnect).toHaveBeenCalledWith(true);
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  it('rejects client when auth token is missing', async () => {
    const disconnect = jest.fn();
    const client = {
      id: 'socket-2',
      handshake: {
        headers: {
          origin: 'http://localhost:4200',
        },
        auth: {},
      },
      disconnect,
      data: {},
    } as unknown as Socket;

    await gateway.handleConnection(client);

    expect(disconnect).toHaveBeenCalledWith(true);
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  it('rejects client when token is invalid', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    const disconnect = jest.fn();
    const client = {
      id: 'socket-3',
      handshake: {
        headers: {
          origin: 'http://localhost:4200',
        },
        auth: {
          token: 'bad-token',
        },
      },
      disconnect,
      data: {},
    } as unknown as Socket;

    await gateway.handleConnection(client);

    expect(jwtService.verify).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('accepts client with valid token and known user', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1' });
    authService.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });

    const disconnect = jest.fn();
    const client = {
      id: 'socket-4',
      handshake: {
        headers: {
          origin: 'http://localhost:4200',
        },
        auth: {
          token: 'good-token',
        },
      },
      disconnect,
      data: {},
    } as unknown as Socket;

    await gateway.handleConnection(client);

    expect(jwtService.verify).toHaveBeenCalledWith(
      'good-token',
      expect.objectContaining({ secret: expect.any(String) }),
    );
    expect(authService.getCurrentUser).toHaveBeenCalledWith('user-1');
    expect(disconnect).not.toHaveBeenCalled();
    expect(
      (client as unknown as { data: Record<string, string> }).data['userId'],
    ).toBe('user-1');
  });
});
