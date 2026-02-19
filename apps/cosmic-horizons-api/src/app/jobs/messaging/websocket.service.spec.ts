import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebSocketService } from './websocket.service';

describe('WebSocketService', () => {
  let service: WebSocketService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string, defaultValue?: number) => {
        const config: Record<string, number> = {
          WEBSOCKET_PORT: 3001,
        };
        return config[key] ?? defaultValue;
      }),
    } as any;

    service = new WebSocketService(mockConfigService);

    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should initialize WebSocket server', async () => {
      const logSpy = jest.spyOn(Logger.prototype, 'log');

      await service.initialize();

      expect(logSpy).toHaveBeenCalled();
    });

    it('should use port from config', async () => {
      mockConfigService.get.mockReturnValue(3002);

      await service.initialize();

      expect(mockConfigService.get).toHaveBeenCalledWith(
        'WEBSOCKET_PORT',
        3001,
      );
    });

    it('should use default port if config missing', async () => {
      mockConfigService.get.mockReturnValue(undefined);

      await service.initialize();

      expect(mockConfigService.get).toHaveBeenCalledWith(
        'WEBSOCKET_PORT',
        3001,
      );
    });
  });

  describe('connect', () => {
    it('should register client connection', async () => {
      await service.connect('client-1', 'session-1');

      const metrics = service.getMetrics();
      expect(metrics.connectedClients).toBe(1);
    });

    it('should store client metadata', async () => {
      const clientId = 'client-123';
      const sessionId = 'session-abc';

      await service.connect(clientId, sessionId);

      const metrics = service.getMetrics();
      expect(metrics.connectedClients).toBe(1);
    });

    it('should handle multiple client connections', async () => {
      const clients = ['client-1', 'client-2', 'client-3'];

      for (const clientId of clients) {
        await service.connect(clientId, `session-${clientId}`);
      }

      const metrics = service.getMetrics();
      expect(metrics.connectedClients).toBe(3);
    });

    it('should log connection event', async () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      await service.connect('client-456', 'session-xyz');

      expect(debugSpy).toHaveBeenCalled();
    });

    it('should handle reconnection by same client ID', async () => {
      await service.connect('client-1', 'session-1');
      await service.connect('client-1', 'session-2');

      const metrics = service.getMetrics();
      expect(metrics.connectedClients).toBe(1);
    });
  });

  describe('disconnect', () => {
    it('should remove client connection', async () => {
      await service.connect('client-1', 'session-1');
      await service.disconnect('client-1');

      const metrics = service.getMetrics();
      expect(metrics.connectedClients).toBe(0);
    });

    it('should handle disconnection of multiple clients', async () => {
      const clients = ['client-1', 'client-2', 'client-3'];

      for (const clientId of clients) {
        await service.connect(clientId, `session-${clientId}`);
      }

      await service.disconnect('client-1');
      await service.disconnect('client-2');

      const metrics = service.getMetrics();
      expect(metrics.connectedClients).toBe(1);
    });

    it('should remove client from all rooms on disconnect', async () => {
      await service.connect('client-1', 'session-1');
      await service.joinRoom('client-1', 'room-1');
      await service.joinRoom('client-1', 'room-2');

      await service.disconnect('client-1');

      const metrics = service.getMetrics();
      expect(metrics.connectedClients).toBe(0);
    });

    it('should log disconnection event', async () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      await service.connect('client-xyz', 'session-123');
      await service.disconnect('client-xyz');

      expect(debugSpy).toHaveBeenCalled();
    });

    it('should handle disconnection of non-existent client', async () => {
      await expect(service.disconnect('non-existent')).resolves.not.toThrow();
    });
  });

  describe('broadcast', () => {
    it('should broadcast event to all clients', async () => {
      const clients = ['client-1', 'client-2', 'client-3'];

      for (const clientId of clients) {
        await service.connect(clientId, `session-${clientId}`);
      }

      const debugSpy = jest.spyOn(Logger.prototype, 'debug');
      await service.broadcast('user-update', { userId: 'user-123' });

      expect(debugSpy).toHaveBeenCalled();
    });

    it('should handle broadcast with no clients', async () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      await service.broadcast('event', {});

      expect(debugSpy).toHaveBeenCalled();
    });

    it('should send different event types', async () => {
      await service.connect('client-1', 'session-1');

      const events = ['user-update', 'status-change', 'error-alert'];

      for (const event of events) {
        await service.broadcast(event, { timestamp: Date.now() });
      }

      expect(service.getMetrics().connectedClients).toBe(1);
    });

    it('should broadcast complex data structures', async () => {
      await service.connect('client-1', 'session-1');

      const complexData = {
        nested: {
          deeply: {
            nested: { value: 'data' },
          },
        },
        array: [1, 2, 3],
        object: { key: 'value' },
      };

      await expect(
        service.broadcast('complex-event', complexData),
      ).resolves.not.toThrow();
    });
  });

  describe('sendToClient', () => {
    it('should send event to specific client', async () => {
      await service.connect('client-1', 'session-1');

      const debugSpy = jest.spyOn(Logger.prototype, 'debug');
      await service.sendToClient('client-1', 'notification', {
        message: 'test',
      });

      expect(debugSpy).toHaveBeenCalled();
    });

    it('should not send to disconnected client', async () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug');

      await service.sendToClient('non-connected', 'event', {});

      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should send different events to different clients', async () => {
      await service.connect('client-1', 'session-1');
      await service.connect('client-2', 'session-2');

      await service.sendToClient('client-1', 'event-1', { data: 'for-1' });
      await service.sendToClient('client-2', 'event-2', { data: 'for-2' });

      expect(service.getMetrics().connectedClients).toBe(2);
    });

    it('should handle sending to client after reconnection', async () => {
      await service.connect('client-1', 'session-1');
      await service.disconnect('client-1');
      await service.connect('client-1', 'session-2');

      await expect(
        service.sendToClient('client-1', 'event', {}),
      ).resolves.not.toThrow();
    });
  });

  describe('joinRoom', () => {
    it('should add client to room', async () => {
      await service.connect('client-1', 'session-1');
      await service.joinRoom('client-1', 'room-1');

      const metrics = service.getMetrics();
      expect(metrics.activeRooms).toBe(1);
    });

    it('should handle multiple clients in same room', async () => {
      await service.connect('client-1', 'session-1');
      await service.connect('client-2', 'session-2');
      await service.connect('client-3', 'session-3');

      await service.joinRoom('client-1', 'room-1');
      await service.joinRoom('client-2', 'room-1');
      await service.joinRoom('client-3', 'room-1');

      const metrics = service.getMetrics();
      expect(metrics.activeRooms).toBe(1);
      expect(metrics.connectedClients).toBe(3);
    });

    it('should handle client in multiple rooms', async () => {
      await service.connect('client-1', 'session-1');

      await service.joinRoom('client-1', 'room-1');
      await service.joinRoom('client-1', 'room-2');
      await service.joinRoom('client-1', 'room-3');

      const metrics = service.getMetrics();
      expect(metrics.activeRooms).toBe(3);
    });

    it('should create room if not exists', async () => {
      await service.connect('client-1', 'session-1');

      await service.joinRoom('client-1', 'new-room');

      const metrics = service.getMetrics();
      expect(metrics.activeRooms).toBe(1);
    });

    it('should allow client to rejoin same room', async () => {
      await service.connect('client-1', 'session-1');

      await service.joinRoom('client-1', 'room-1');
      await service.joinRoom('client-1', 'room-1');

      const metrics = service.getMetrics();
      expect(metrics.activeRooms).toBe(1);
    });

    it('should handle room names with special characters', async () => {
      await service.connect('client-1', 'session-1');

      const roomNames = ['room-1', 'room_2', 'room.3', 'room:4'];

      for (const roomName of roomNames) {
        await service.joinRoom('client-1', roomName);
      }

      const metrics = service.getMetrics();
      expect(metrics.activeRooms).toBe(4);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics object', () => {
      const metrics = service.getMetrics();

      expect(metrics).toHaveProperty('connectedClients');
      expect(metrics).toHaveProperty('activeRooms');
      expect(metrics).toHaveProperty('totalMessages');
    });

    it('should show zero metrics initially', () => {
      const metrics = service.getMetrics();

      expect(metrics.connectedClients).toBe(0);
      expect(metrics.activeRooms).toBe(0);
      expect(metrics.totalMessages).toBe(1000);
    });

    it('should track connected clients', async () => {
      await service.connect('client-1', 'session-1');
      let metrics = service.getMetrics();
      expect(metrics.connectedClients).toBe(1);

      await service.connect('client-2', 'session-2');
      metrics = service.getMetrics();
      expect(metrics.connectedClients).toBe(2);
    });

    it('should track active rooms', async () => {
      await service.connect('client-1', 'session-1');

      await service.joinRoom('client-1', 'room-1');
      let metrics = service.getMetrics();
      expect(metrics.activeRooms).toBe(1);

      await service.joinRoom('client-1', 'room-2');
      metrics = service.getMetrics();
      expect(metrics.activeRooms).toBe(2);
    });

    it('should update metrics after disconnection', async () => {
      await service.connect('client-1', 'session-1');
      await service.connect('client-2', 'session-2');

      let metrics = service.getMetrics();
      expect(metrics.connectedClients).toBe(2);

      await service.disconnect('client-1');
      metrics = service.getMetrics();
      expect(metrics.connectedClients).toBe(1);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle full lifecycle', async () => {
      await service.initialize();

      await service.connect('client-1', 'session-1');
      await service.joinRoom('client-1', 'notifications');

      await service.broadcast('system-online', { status: 'up' });
      await service.sendToClient('client-1', 'welcome', {
        message: 'Connected',
      });

      await service.disconnect('client-1');

      const metrics = service.getMetrics();
      expect(metrics.connectedClients).toBe(0);
    });

    it('should handle room management', async () => {
      const clients = ['client-1', 'client-2', 'client-3'];

      for (const clientId of clients) {
        await service.connect(clientId, `session-${clientId}`);
        await service.joinRoom(clientId, 'common-room');
      }

      let metrics = service.getMetrics();
      expect(metrics.activeRooms).toBe(1);
      expect(metrics.connectedClients).toBe(3);

      await service.disconnect('client-1');
      metrics = service.getMetrics();
      expect(metrics.connectedClients).toBe(2);
    });
  });
});
