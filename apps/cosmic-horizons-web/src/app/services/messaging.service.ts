import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
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
  private telemetrySubject = new Subject<TelemetryPacket>();
  private statsSubject = new Subject<MessagingLiveStats>();
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

  private connectSocket(): void {
    if (this.socket) {
      return; // Already connected
    }

    const token = this.authSessionService.getToken();
    if (!token) {
      this.logger.warn('messaging', 'Cannot connect: no authentication token');
      return;
    }

    this.socket = io('http://localhost:3000/messaging', {
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
    });

    this.socket.on('connect_error', (error: Error) => {
      this.logger.warn('messaging', 'WebSocket connection error', {
        message: error.message,
      });
    });

    this.socket.on('telemetry_update', (data: TelemetryPacket) => {
      this.telemetrySubject.next(data);
    });

    this.socket.on('stats_update', (stats: MessagingLiveStats) => {
      this.statsSubject.next(stats);
    });
  }

  ensureConnected(): void {
    if (!this.socket && this.authSessionService.isAuthenticated()) {
      this.connectSocket();
    }
  }

  get telemetry$(): Observable<TelemetryPacket> {
    return this.telemetrySubject.asObservable();
  }

  get stats$(): Observable<MessagingLiveStats> {
    return this.statsSubject.asObservable();
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
