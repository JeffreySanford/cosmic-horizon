import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

function resolveAllowedOrigins(): string[] {
  const raw = process.env['FRONTEND_URL'] || 'http://localhost:4200';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

/**
 * Socket.IO adapter with explicit transport and heartbeat tuning for
 * long-lived dashboard connections.
 */
export class MessagingSocketIoAdapter extends IoAdapter {
  constructor(appOrHttpServer: INestApplicationContext) {
    super(appOrHttpServer);
  }

  override createIOServer(port: number, options?: ServerOptions): ReturnType<IoAdapter['createIOServer']> {
    const merged: ServerOptions = {
      cors: {
        origin: resolveAllowedOrigins(),
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingInterval: readPositiveInt(process.env['WEBSOCKET_HEARTBEAT_MS'], 30000),
      pingTimeout: readPositiveInt(process.env['WEBSOCKET_PING_TIMEOUT_MS'], 20000),
      maxHttpBufferSize: readPositiveInt(
        process.env['WEBSOCKET_MAX_BUFFER_BYTES'],
        1_000_000,
      ),
      perMessageDeflate: true,
      ...(options ?? {}),
    };

    return super.createIOServer(port, merged);
  }
}
