import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagingService } from './messaging.service';
import { MessagingMonitorService } from './messaging-monitor.service';
import { MessagingStatsService } from './messaging-stats.service';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Subscription, interval } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { AuthService, JwtPayload } from '../auth/auth.service';
import { getJwtSecret } from '../config/security.config';

function resolveAllowedOrigins(): string[] {
  const raw = process.env['FRONTEND_URL'] || 'http://localhost:4200';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) {
    // Allow clients with no origin header (non-browser/internal tooling).
    return true;
  }
  return resolveAllowedOrigins().includes(origin);
}

function extractToken(client: Socket): string | null {
  const authToken = client.handshake.auth?.['token'];
  if (typeof authToken === 'string' && authToken.trim().length > 0) {
    return authToken.trim();
  }

  const authorization = client.handshake.headers.authorization;
  if (typeof authorization !== 'string') {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match) {
    return null;
  }
  return match[1].trim();
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function jobRoom(jobId: string): string {
  return `job:${jobId}`;
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

type JoinJobChannelPayload = {
  jobId?: string;
};

@WebSocketGateway({
  cors: {
    origin: resolveAllowedOrigins(),
    credentials: true,
  },
  namespace: 'messaging',
})
export class MessagingGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('MessagingGateway');
  private telemetrySubscription?: Subscription;
  private statsSubscription?: Subscription;
  private readonly maxConnectionsPerUser = readPositiveInt(
    process.env['WEBSOCKET_MAX_CONNECTIONS_PER_USER'],
    5,
  );
  private readonly userConnections = new Map<string, Set<string>>();
  private readonly socketToUser = new Map<string, string>();

  constructor(
    private readonly messagingService: MessagingService,
    private readonly monitorService: MessagingMonitorService,
    private readonly statsService: MessagingStatsService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  afterInit() {
    this.logger.log('Messaging WebSocket Gateway Initialized');

    // Broadcast every transaction to keep the visual flow faithful to real traffic.
    this.telemetrySubscription = this.messagingService.telemetry$.subscribe(
      (packet) => {
        this.server.emit('telemetry_update', packet);
      },
    );

    this.statsSubscription = interval(1000).subscribe(() => {
      this.server.emit(
        'stats_update',
        this.statsService.getSnapshot(this.monitorService.getSnapshot()),
      );
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    const origin = client.handshake.headers.origin;
    if (!isAllowedOrigin(origin)) {
      this.logger.warn(
        `Rejected messaging socket ${client.id}: disallowed origin ${origin ?? 'unknown'}`,
      );
      client.disconnect(true);
      return;
    }

    const token = extractToken(client);
    if (!token) {
      this.logger.warn(`Rejected messaging socket ${client.id}: missing token`);
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: getJwtSecret(),
      });
      const user = await this.authService.getCurrentUser(payload.sub);
      if (!user) {
        this.logger.warn(
          `Rejected messaging socket ${client.id}: invalid user`,
        );
        client.disconnect(true);
        return;
      }

      if (!this.registerConnection(user.id, client.id)) {
        this.logger.warn(
          `Rejected messaging socket ${client.id}: user ${user.id} exceeded max connections (${this.maxConnectionsPerUser})`,
        );
        client.disconnect(true);
        return;
      }

      client.data['userId'] = user.id;
      client.data['role'] = user.role;
      await client.join(userRoom(user.id));
      if (user.role === 'admin') {
        await client.join('role:admin');
      }
      this.logger.log(`Client connected: ${client.id} user=${user.id}`);
    } catch (error) {
      this.logger.warn(
        `Rejected messaging socket ${client.id}: token validation failed (${(error as Error).message})`,
      );
      this.unregisterConnection(client.id);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.unregisterConnection(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Join scoped job room so clients only receive job update events they asked for.
   */
  @SubscribeMessage('join_job_channel')
  async joinJobChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinJobChannelPayload,
  ): Promise<{ joined: boolean; room?: string; error?: string }> {
    const jobId = payload?.jobId?.trim();
    if (!jobId) {
      return { joined: false, error: 'jobId is required' };
    }

    const room = jobRoom(jobId);
    await client.join(room);
    this.logger.debug(`Client ${client.id} joined ${room}`);
    return { joined: true, room };
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(userRoom(userId)).emit(event, payload);
  }

  emitJobUpdate(
    jobId: string,
    payload: Record<string, unknown>,
    userId?: string,
  ): void {
    if (userId) {
      this.emitToUser(userId, 'job_update', payload);
    }
    this.server.to(jobRoom(jobId)).emit('job_update', payload);
  }

  onModuleDestroy() {
    this.telemetrySubscription?.unsubscribe();
    this.statsSubscription?.unsubscribe();
  }

  private registerConnection(userId: string, socketId: string): boolean {
    const connections = this.userConnections.get(userId) ?? new Set<string>();
    if (connections.size >= this.maxConnectionsPerUser) {
      return false;
    }

    connections.add(socketId);
    this.userConnections.set(userId, connections);
    this.socketToUser.set(socketId, userId);
    return true;
  }

  private unregisterConnection(socketId: string): void {
    const userId = this.socketToUser.get(socketId);
    if (!userId) {
      return;
    }

    const connections = this.userConnections.get(userId);
    if (!connections) {
      this.socketToUser.delete(socketId);
      return;
    }

    connections.delete(socketId);
    if (connections.size === 0) {
      this.userConnections.delete(userId);
    } else {
      this.userConnections.set(userId, connections);
    }

    this.socketToUser.delete(socketId);
  }
}
