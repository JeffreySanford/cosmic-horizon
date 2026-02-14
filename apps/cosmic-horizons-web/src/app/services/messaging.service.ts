import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AppLoggerService } from './app-logger.service';

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

@Injectable({
  providedIn: 'root'
})
export class MessagingService {
  private apiUrl = 'http://localhost:3000/api/messaging';
  private socket: Socket;
  private telemetrySubject = new Subject<TelemetryPacket>();
  private readonly http = inject(HttpClient);
  private readonly logger = inject(AppLoggerService);

  constructor() {
    this.logger.info('messaging', 'Initializing MessagingService', { transport: 'websocket' });
    this.socket = io('http://localhost:3000/messaging', {
      path: '/socket.io',
      transports: ['websocket']
    });

    this.socket.on('connect', () => {
      this.logger.info('messaging', 'WebSocket connected to /messaging namespace');
    });

    this.socket.on('disconnect', (reason: string) => {
      this.logger.warn('messaging', 'WebSocket disconnected', { reason });
    });

    this.socket.on('telemetry_update', (data: TelemetryPacket) => {
      this.telemetrySubject.next(data);
    });
  }

  get telemetry$(): Observable<TelemetryPacket> {
    return this.telemetrySubject.asObservable();
  }

  getSites(): Observable<ArraySite[]> {
    return this.http.get<ArraySite[]>(`${this.apiUrl}/sites`);
  }

  getAllElements(): Observable<ArrayElementStatus[]> {
    return this.http.get<ArrayElementStatus[]>(`${this.apiUrl}/elements`);
  }

  getElementsBySite(siteId: string): Observable<ArrayElementStatus[]> {
    return this.http.get<ArrayElementStatus[]>(`${this.apiUrl}/sites/${siteId}/elements`);
  }
}
