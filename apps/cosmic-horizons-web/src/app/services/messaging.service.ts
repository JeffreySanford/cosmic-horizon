import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import type { EventBase } from '@cosmic-horizons/event-models';
import { io, Socket, ManagerOptions, SocketOptions } from 'socket.io-client';
import { AppLoggerService } from './app-logger.service';
import { AuthSessionService } from './auth-session.service';

export interface ArrayElementStatus {
  id: string;
  name: string;
  siteId: string;
  status: 'operational' | 'maintenance' | 'offline' | 'calibrating';
  azimuth: number;
  elevation: number;
  temperature: number;
  windSpeed: number;
  dataRateMbps: number;
  strength?: number;
  latency?: number;
  lastUpdate: string;
}

export interface ArraySite {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  cluster: 'Alpha' | 'Bravo' | 'Charlie';
  totalDataRateGbps: number;
  activeElements: number;
}

export interface TelemetryPacket {
  sourceId: string;
  targetId: string;
  routeType: 'node_to_hub' | 'hub_to_hub';
  elementId: string;
  siteId: string;
  timestamp: string;
  metrics: {
    vibration: number;
    powerUsage: number;
    noiseFloor: number;
    rfiLevel: number;
  };
}

export interface MessagingLiveStats {
  at: string;
  packetsPerSecond: number;
  nodeToHubPerSecond: number;
  hubToHubPerSecond: number;
  rabbitPublishedPerSecond: number;
  kafkaPublishedPerSecond: number;
  persistentWritesPerSecond: number;
  totals: {
    packets: number;
    nodeToHub: number;
    hubToHub: number;
    rabbitPublished: number;
    kafkaPublished: number;
    persistentWrites: number;
    errors: number;
  };
  infra: {
    rabbitmq: {
      connected: boolean;
      latencyMs: number | null;
      queueDepth: number | null;
      consumers: number | null;
    };
    kafka: {
      connected: boolean;
      latencyMs: number | null;
      latestOffset: number | null;
      partitions: number | null;
    };
    storage: {
      postgres: {
        connected: boolean;
        latencyMs: number | null;
      };
      redis: {
        connected: boolean;
        latencyMs: number | null;
      };
    };
  };
}

@Injectable({
  providedIn: 'root',
})
export class MessagingService {
  private apiUrl = 'http://localhost:3000/api/messaging';
  private socket: Socket | null = null;

  // subjects for various incoming event types
  private telemetrySubject = new Subject<TelemetryPacket>();
  private statsSubject = new Subject<MessagingLiveStats>();
  private notificationSubject = new Subject<EventBase>();

  /** new observable used by dashboards to receive job update events */
  private jobUpdateSubject = new Subject<Partial<unknown> & { id: string }>();

  private readonly http = inject(HttpClient);
  private readonly logger = inject(AppLoggerService);
  private readonly authSessionService = inject(AuthSessionService);

  constructor() {
    this.logger.info('messaging', 'Initializing MessagingService', {
      transport: 'websocket',
    });

    // Lazy connect: only connect if already authenticated
    if (this.authSessionService.isAuthenticated()) {
      this.connectSocket();
    }
  }

  protected connectSocket(): void {
    if (this.socket) {
      return; // Already connected
    }

    const token = this.authSessionService.getToken();
    if (!token) {
      this.logger.warn('messaging', 'Cannot connect: no authentication token');
      return;
    }

    this.socket = this.createSocket('http://localhost:3000/messaging', {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      timeout: 20000,
      auth: {
        token: token,
      },
    });

    this.socket.on('connect', () => {
      this.logger.info(
        'messaging',
        'WebSocket connected to /messaging namespace',
      );
    });

    this.socket.on('disconnect', (reason: string) => {
      this.logger.warn('messaging', 'WebSocket disconnected', { reason });
      // clear our reference so ensureConnected can recreate later
      this.socket = null;
    });

    this.socket.on('connect_error', (error: Error) => {
      this.logger.warn('messaging', 'WebSocket connection error', {
        message: error.message,
      });
    });

    // Telemetry & stats (existing)
    this.socket.on('telemetry_update', (data: TelemetryPacket) => {
      this.telemetrySubject.next(data);
    });

    this.socket.on('stats_update', (stats: MessagingLiveStats) => {
      this.statsSubject.next(stats);
    });

    // Notifications (toaster-support): generic notification channel from server
    this.socket.on('job_notification', (payload: EventBase) => {
      try {
        this.logger.debug('messaging', 'Received job_notification', {
          event_type: payload.event_type ?? null,
          event_id: payload.event_id ?? null,
          user_id: payload.user_id ?? null,
          correlation_id: payload.correlation_id ?? null,
          timestamp: payload.timestamp ?? null,
        });

        this.notificationSubject.next(payload);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn('messaging', 'Failed to process job_notification', {
          message,
        });
      }
    });

    // job updates path (EventsService → gateway → frontend)
    this.socket.on('job_update', (update: Partial<unknown> & { id: string }) => {
      this.jobUpdateSubject.next(update);
    });
  }

  ensureConnected(): void {
    if (!this.socket && this.authSessionService.isAuthenticated()) {
      this.connectSocket();
    }
  }

  /**
   * Observable consumers can subscribe to for job updates coming from the server.
   */
  get jobUpdate$(): Observable<Partial<unknown> & { id: string }> {
    return this.jobUpdateSubject.asObservable();
  }

  /**
   * Instruct the gateway to join a specific job room so that only relevant
   * updates are sent to this socket. Returns the acknowledgement response
   * from the server.
   */
  joinJobChannel(jobId: string): Promise<{ joined: boolean; room?: string; error?: string }> {
    if (!this.socket) {
      return Promise.reject(new Error('socket not connected'));
    }

    // eslint-disable-next-line no-restricted-syntax -- emission API uses callback
    return new Promise<{ joined: boolean; room?: string; error?: string }>((resolve) => {
      const socket = this.socket!; // previous guard ensures it exists
      socket.emit('join_job_channel', { jobId }, (resp: unknown) => {
        resolve(resp as { joined: boolean; room?: string; error?: string });
      });
    });
  }

  /**
   * Helper method exposed so tests can override or stub socket creation.
   */
  protected createSocket(
    url: string,
    opts?: Partial<ManagerOptions & SocketOptions>,
  ): Socket {
    return io(url, opts);
  }

  get telemetry$(): Observable<TelemetryPacket> {
    return this.telemetrySubject.asObservable();
  }

  get stats$(): Observable<MessagingLiveStats> {
    return this.statsSubject.asObservable();
  }

  /** Notification observable for UI toasts and in-app alerts */
  get notifications$(): Observable<EventBase> {
    return this.notificationSubject.asObservable();
  }

  getSites(): Observable<ArraySite[]> {
    return this.http.get<ArraySite[]>(`${this.apiUrl}/sites`);
  }

  getAllElements(): Observable<ArrayElementStatus[]> {
    return this.http.get<ArrayElementStatus[]>(`${this.apiUrl}/elements`);
  }

  getElementsBySite(siteId: string): Observable<ArrayElementStatus[]> {
    return this.http.get<ArrayElementStatus[]>(
      `${this.apiUrl}/sites/${siteId}/elements`,
    );
  }

  getLiveStats(): Observable<MessagingLiveStats> {
    return this.http.get<MessagingLiveStats>(`${this.apiUrl}/stats`);
  }
}
