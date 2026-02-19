import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { interval, Observable, Subject, Subscription } from 'rxjs';
import {
  ArraySite,
  ArrayElementStatus,
  TelemetryPacket,
} from './messaging.types';
import { LoggingService } from '../logging/logging.service';
import { MessagingStatsService } from './messaging-stats.service';

@Injectable()
export class MessagingService implements OnModuleInit, OnModuleDestroy {
  private readonly telemetrySubject = new Subject<TelemetryPacket>();
  private simulationSubscription?: Subscription;

  private sites: ArraySite[] = [
    {
      id: 'site-1',
      name: 'Socorro Hub',
      location: { lat: 34.0664, lng: -106.9056 },
      cluster: 'Alpha',
      totalDataRateGbps: 0,
      activeElements: 0,
    },
    {
      id: 'site-2',
      name: 'Green Bank Relay',
      location: { lat: 38.4331, lng: -79.8181 },
      cluster: 'Alpha',
      totalDataRateGbps: 0,
      activeElements: 0,
    },
    {
      id: 'site-3',
      name: 'Owens Valley Node',
      location: { lat: 37.2339, lng: -118.2831 },
      cluster: 'Bravo',
      totalDataRateGbps: 0,
      activeElements: 0,
    },
    {
      id: 'site-4',
      name: 'Pie Town Relay',
      location: { lat: 34.3015, lng: -108.1132 },
      cluster: 'Charlie',
      totalDataRateGbps: 0,
      activeElements: 0,
    },
    {
      id: 'site-5',
      name: 'Los Alamos Link',
      location: { lat: 35.8811, lng: -106.3031 },
      cluster: 'Charlie',
      totalDataRateGbps: 0,
      activeElements: 0,
    },
  ];

  private readonly centralSiteId = 'site-1'; // Socorro Hub is the central hub

  private elements: ArrayElementStatus[] = [];

  constructor(
    private readonly loggingService: LoggingService,
    private readonly statsService: MessagingStatsService,
  ) {
    this.initializeElements();
  }

  onModuleInit() {
    this.startSimulation();
    void this.loggingService.add({
      type: 'messaging',
      severity: 'info',
      message: 'MessagingService initialized and simulation started',
      data: {
        elementCount: this.elements.length,
        siteCount: this.sites.length,
      },
    });
  }

  onModuleDestroy() {
    if (this.simulationSubscription) {
      this.simulationSubscription.unsubscribe();
    }
  }

  private initializeElements() {
    // Distribute 60 elements across 5 sites (12 per site)
    this.sites.forEach((site) => {
      for (let i = 1; i <= 12; i++) {
        this.elements.push({
          id: `element-${site.id}-${i}`,
          name: `${site.name} Dish-${i}`,
          siteId: site.id,
          status: 'operational',
          azimuth: Math.random() * 360,
          elevation: Math.random() * 90,
          temperature: 20 + Math.random() * 10,
          windSpeed: Math.random() * 15,
          dataRateMbps: 100 + Math.random() * 50,
          lastUpdate: new Date().toISOString(),
        });
      }
    });
  }

  private startSimulation() {
    const statuses: Array<ArrayElementStatus['status']> = [
      'operational',
      'maintenance',
      'offline',
      'calibrating',
    ];

    // Simulate telemetry every 100ms (10Hz)
    this.simulationSubscription = interval(100).subscribe(() => {
      // Emit each element at a staggered time within the 100ms window
      this.elements.forEach((element, index) => {
        const delay = (index / this.elements.length) * 50; // Spread across 50ms
        setTimeout(() => {
          // Infrequent status changes
          if (Math.random() < 0.0001) {
            const oldStatus = element.status;
            element.status =
              statuses[Math.floor(Math.random() * statuses.length)];

            if (oldStatus !== element.status) {
              void this.loggingService.add({
                type: 'messaging',
                severity: element.status === 'offline' ? 'warn' : 'info',
                message: `Array Element ${element.id} changed status from ${oldStatus} to ${element.status}`,
                data: { siteId: element.siteId, status: element.status },
              });
            }
          }

          // Subtle movements
          element.azimuth = (element.azimuth + Math.random() - 0.5) % 360;
          element.elevation = Math.max(
            0,
            Math.min(90, element.elevation + Math.random() - 0.5),
          );
          element.lastUpdate = new Date().toISOString();

          const telemetry: TelemetryPacket = {
            sourceId: element.id,
            targetId: element.siteId,
            routeType: 'node_to_hub',
            elementId: element.id,
            siteId: element.siteId,
            timestamp: element.lastUpdate,
            metrics: {
              vibration: Math.random() * 0.1,
              powerUsage: 500 + Math.random() * 50,
              noiseFloor: -110 + Math.random() * 5,
              rfiLevel: Math.random() * 10,
            },
          };

          this.statsService.recordPacket(telemetry);
          this.telemetrySubject.next(telemetry);
        }, delay);
      });

      this.emitHubTraffic();
    });
  }

  private emitHubTraffic(): void {
    const remoteSites = this.sites.filter(
      (site) => site.id !== this.centralSiteId,
    );

    // Every cycle each remote hub reports to the central hub.
    remoteSites.forEach((site, index) => {
      setTimeout(
        () => {
          const packet = this.createHubPacket(site.id, this.centralSiteId);
          this.statsService.recordPacket(packet);
          this.telemetrySubject.next(packet);
        },
        10 + index * 6,
      );
    });

    // Every cycle central hub dispatches to one random remote hub.
    const randomRemote =
      remoteSites[Math.floor(Math.random() * remoteSites.length)];
    if (randomRemote) {
      setTimeout(() => {
        const packet = this.createHubPacket(
          this.centralSiteId,
          randomRemote.id,
        );
        this.statsService.recordPacket(packet);
        this.telemetrySubject.next(packet);
      }, 45);
    }
  }

  private createHubPacket(
    sourceSiteId: string,
    targetSiteId: string,
  ): TelemetryPacket {
    return {
      sourceId: sourceSiteId,
      targetId: targetSiteId,
      routeType: 'hub_to_hub',
      elementId: `hub-${sourceSiteId}`,
      siteId: targetSiteId,
      timestamp: new Date().toISOString(),
      metrics: {
        vibration: Math.random() * 0.05,
        powerUsage: 1000 + Math.random() * 100,
        noiseFloor: -105 + Math.random() * 5,
        rfiLevel: Math.random() * 5,
      },
    };
  }

  get telemetry$(): Observable<TelemetryPacket> {
    return this.telemetrySubject.asObservable();
  }

  getSites(): ArraySite[] {
    // Update aggregate stats
    return this.sites.map((site) => {
      const siteElements = this.elements.filter((e) => e.siteId === site.id);
      return {
        ...site,
        activeElements: siteElements.filter((e) => e.status === 'operational')
          .length,
        totalDataRateGbps:
          siteElements.reduce((acc, e) => acc + e.dataRateMbps, 0) / 1024,
      };
    });
  }

  getElementsBySite(siteId: string): ArrayElementStatus[] {
    return this.elements.filter((e) => e.siteId === siteId);
  }

  getAllElements(): ArrayElementStatus[] {
    return this.elements;
  }
}
