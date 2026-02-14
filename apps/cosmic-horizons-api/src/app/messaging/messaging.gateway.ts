import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { MessagingService } from './messaging.service';
import { Logger } from '@nestjs/common';
import { sampleTime } from 'rxjs';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'messaging',
})
export class MessagingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('MessagingGateway');

  constructor(private readonly messagingService: MessagingService) {}

  afterInit(server: Server) {
    this.logger.log('Messaging WebSocket Gateway Initialized');
    
    // Subscribe to telemetry and broadcast to all connected clients
    // Downsample to 30fps (33ms) to avoid overwhelming the frontend
    this.messagingService.telemetry$.pipe(sampleTime(33)).subscribe((packet) => {
      this.server.emit('telemetry_update', packet);
    });
  }

  handleConnection(client: any, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: any) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }
}
