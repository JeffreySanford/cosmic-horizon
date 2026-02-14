import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagingService } from './messaging.service';
import { MessagingMonitorService } from './messaging-monitor.service';
import { MessagingStatsService } from './messaging-stats.service';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { Subscription, interval } from 'rxjs';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'messaging',
})
export class MessagingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('MessagingGateway');
  private telemetrySubscription?: Subscription;
  private statsSubscription?: Subscription;

  constructor(
    private readonly messagingService: MessagingService,
    private readonly monitorService: MessagingMonitorService,
    private readonly statsService: MessagingStatsService,
  ) {}

  afterInit() {
    this.logger.log('Messaging WebSocket Gateway Initialized');

    // Broadcast every transaction to keep the visual flow faithful to real traffic.
    this.telemetrySubscription = this.messagingService.telemetry$.subscribe((packet) => {
      this.server.emit('telemetry_update', packet);
    });

    this.statsSubscription = interval(1000).subscribe(() => {
      this.server.emit(
        'stats_update',
        this.statsService.getSnapshot(this.monitorService.getSnapshot()),
      );
    });
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  onModuleDestroy() {
    this.telemetrySubscription?.unsubscribe();
    this.statsSubscription?.unsubscribe();
  }
}
