# Messaging System Implementation Guide

**Overview**: This guide covers extending the messaging system with new telemetry sources, custom metrics, and integrations with external data feeds.

## Architecture Review

Before extending, understand the core flow:

```text
Telemetry Source (Element/NRAO)
        ↓
MessagingService (Subject stream)
        ↓
MessagingIntegrationService (dual emit)
├─ RabbitMQ (management plane)
└─ Kafka (data plane)
        ↓
MessagingMonitorService (polls health)
        ↓
MessagingStatsService (aggregates metrics)
        ↓
MessagingGateway (WebSocket broadcast)
        ↓
Frontend (Array Information UI)
```

See [MESSAGING-ARCHITECTURE.md](./MESSAGING-ARCHITECTURE.md) for detailed architecture.

## Adding a New Telemetry Source

### Step 1: Define the Data Type

Add to `messaging.types.ts`:

```typescript
// apps/cosmic-horizons-api/src/app/messaging/messaging.types.ts

export interface RFIEventData {
  elementId: string;
  frequency: number; // MHz
  bandwidth: number; // MHz
  peakAmplitude: number; // dBm
  duration: number; // milliseconds
  eventType: 'pulsed' | 'continuous' | 'broadband';
  confidence: number; // 0-1
}
```

### Step 2: Create a Dedicated Service (Optional)

For complex data processing, create a service:

```typescript
// apps/cosmic-horizons-api/src/app/messaging/rfi-detection.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { RFIEventData } from './messaging.types';

@Injectable()
export class RfiDetectionService {
  private readonly logger = new Logger(RfiDetectionService.name);
  private readonly rfiEvents$ = new Subject<RFIEventData>();

  getRfiEvents$() {
    return this.rfiEvents$.asObservable();
  }

  async analyzeSignal(
    elementId: string,
    frequencyData: Float32Array,
  ): Promise<RFIEventData | null> {
    // Simulate RFI detection
    const peak = Math.max(...Array.from(frequencyData));
    if (peak > -70) {
      // Threshold
      const event: RFIEventData = {
        elementId,
        frequency: 1400,
        bandwidth: 320,
        peakAmplitude: peak,
        duration: 50,
        eventType: 'continuous',
        confidence: Math.min(1, (peak + 70) / 20),
      };
      this.rfiEvents$.next(event);
      return event;
    }
    return null;
  }
}
```

### Step 3: Integrate into MessagingService

```typescript
// apps/cosmic-horizons-api/src/app/messaging/messaging.service.ts

import { RfiDetectionService } from './rfi-detection.service';

@Injectable()
export class MessagingService implements OnModuleInit, OnModuleDestroy {
  private readonly telemetrySubject = new Subject<TelemetryPacket>();
  private simulationSubscription?: Subscription;
  private rfiSubscription?: Subscription;

  constructor(
    private readonly loggingService: LoggingService,
    private readonly statsService: MessagingStatsService,
    private readonly rfiService: RfiDetectionService, // NEW
  ) {
    this.initializeElements();
  }

  onModuleInit() {
    this.startSimulation();

    // Subscribe to RFI events and emit as telemetry
    this.rfiSubscription = this.rfiService
      .getRfiEvents$()
      .subscribe((rfiEvent) => {
        const enriched: TelemetryPacket = {
          sourceId: rfiEvent.elementId,
          targetId:
            this.elements.find((e) => e.id === rfiEvent.elementId)?.siteId ||
            'unknown',
          routeType: 'node_to_hub',
          elementId: rfiEvent.elementId,
          siteId:
            this.elements.find((e) => e.id === rfiEvent.elementId)?.siteId ||
            'unknown',
          timestamp: new Date().toISOString(),
          metrics: {
            vibration: 0, // RFI doesn't affect vibration
            powerUsage: 0,
            noiseFloor: rfiEvent.peakAmplitude,
            rfiLevel: rfiEvent.peakAmplitude, // RFI event!
          },
        };
        this.telemetrySubject.next(enriched);
      });
  }

  onModuleDestroy() {
    this.simulationSubscription?.unsubscribe();
    this.rfiSubscription?.unsubscribe(); // NEW
  }
}
```

### Step 4: Register in Module

```typescript
// apps/cosmic-horizons-api/src/app/messaging/messaging.module.ts

import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingIntegrationService } from './messaging-integration.service';
import { MessagingMonitorService } from './messaging-monitor.service';
import { MessagingStatsService } from './messaging-stats.service';
import { MessagingGateway } from './messaging.gateway';
import { MessagingController } from './messaging.controller';
import { RfiDetectionService } from './rfi-detection.service'; // NEW
import { LoggingModule } from '../logging/logging.module';

@Module({
  imports: [LoggingModule],
  providers: [
    MessagingService,
    MessagingIntegrationService,
    MessagingMonitorService,
    MessagingStatsService,
    MessagingGateway,
    RfiDetectionService, // NEW
  ],
  controllers: [MessagingController],
  exports: [MessagingService],
})
export class MessagingModule {}
```

---

## Adding Custom Metrics to Telemetry

### Extend TelemetryPacket

```typescript
// messaging.types.ts

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
    // NEW FIELDS:
    polarizationQuality?: number; // 0-1 (optional)
    phaseError?: number; // degrees (optional)
    tuningFrequency?: number; // MHz (optional)
    windGust?: number; // m/s (optional)
  };
}
```

### Update Telemetry Emission

```typescript
// messaging.service.ts (in startSimulation loop)

const telemetry: TelemetryPacket = {
  sourceId: element.id,
  targetId: element.siteId,
  routeType: 'node_to_hub',
  elementId: element.id,
  siteId: element.siteId,
  timestamp: new Date().toISOString(),
  metrics: {
    vibration: Math.random() * 2,
    powerUsage: 2000 + Math.random() * 1000,
    noiseFloor: -100 + Math.random() * 10,
    rfiLevel: -120 + Math.random() * 20,
    // NEW METRICS:
    polarizationQuality: 0.85 + Math.random() * 0.15,
    phaseError: Math.random() * 10,
    tuningFrequency: 1400 + Math.random() * 20,
    windGust: windSpeed * 1.5,
  },
};
this.telemetrySubject.next(telemetry);
```

### Update Frontend

```typescript
// components/ElementTelemetryPanel.tsx

interface ElementTelemetryPanelProps {
  packet: TelemetryPacket;
}

export function ElementTelemetryPanel({ packet }: ElementTelemetryPanelProps) {
  return (
    <div className="telemetry-panel">
      <h4>Element Metrics: {packet.elementId}</h4>

      <dl>
        <dt>Vibration:</dt>
        <dd>{packet.metrics.vibration?.toFixed(2)} m/s²</dd>

        <dt>Power Usage:</dt>
        <dd>{packet.metrics.powerUsage?.toFixed(0)} W</dd>

        <dt>Noise Floor:</dt>
        <dd>{packet.metrics.noiseFloor?.toFixed(1)} dBm</dd>

        <dt>RFI Level:</dt>
        <dd>{packet.metrics.rfiLevel?.toFixed(1)} dBm</dd>

        {/* NEW METRICS */}
        {packet.metrics.polarizationQuality !== undefined && (
          <>
            <dt>Polarization Quality:</dt>
            <dd>{(packet.metrics.polarizationQuality * 100).toFixed(1)}%</dd>
          </>
        )}

        {packet.metrics.phaseError !== undefined && (
          <>
            <dt>Phase Error:</dt>
            <dd>{packet.metrics.phaseError?.toFixed(2)}°</dd>
          </>
        )}

        {packet.metrics.tuningFrequency !== undefined && (
          <>
            <dt>Tuning Frequency:</dt>
            <dd>{packet.metrics.tuningFrequency?.toFixed(1)} MHz</dd>
          </>
        )}
      </dl>
    </div>
  );
}
```

---

## Integrating External Data Feeds (NRAO Live)

### Create NRAO Feed Service

```typescript
// apps/cosmic-horizons-api/src/app/messaging/nrao-feed.service.ts

import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Subject, Subscription, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import type { TelemetryPacket } from './messaging.types';

@Injectable()
export class NraoFeedService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NraoFeedService.name);
  private readonly telemetry$ = new Subject<TelemetryPacket>();
  private subscription?: Subscription;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const enabled = this.config.get<boolean>('NRAO_FEED_ENABLED');
    if (!enabled) {
      this.logger.warn('NRAO feed disabled');
      return;
    }

    // Poll NRAO API every 5 seconds
    this.subscription = interval(5000).subscribe(() => {
      void this.fetchNraoData();
    });
  }

  onModuleDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  getTelemetry$() {
    return this.telemetry$.asObservable();
  }

  private async fetchNraoData() {
    try {
      const apiUrl = this.config.get<string>('NRAO_API_URL');
      const response = await this.http
        .get(`${apiUrl}/array/status`)
        .toPromise();

      // Transform NRAO response → TelemetryPacket
      const elements = response.data.elements || [];
      elements.forEach((nraoElement: any) => {
        const packet: TelemetryPacket = {
          sourceId: nraoElement.id,
          targetId: nraoElement.siteId,
          routeType: 'node_to_hub',
          elementId: nraoElement.id,
          siteId: nraoElement.siteId,
          timestamp: new Date().toISOString(),
          metrics: {
            vibration: parseFloat(nraoElement.vibration) || 0,
            powerUsage: parseFloat(nraoElement.power) || 0,
            noiseFloor: parseFloat(nraoElement.noiseFloor) || -100,
            rfiLevel: parseFloat(nraoElement.rfiLevel) || -120,
            polarizationQuality: parseFloat(nraoElement.polQuality),
            phaseError: parseFloat(nraoElement.phaseErr),
            tuningFrequency: parseFloat(nraoElement.tuneFreq),
          },
        };
        this.telemetry$.next(packet);
      });
    } catch (error) {
      this.logger.error('Failed to fetch NRAO data', error);
    }
  }
}
```

### Integrate into MessagingService

```typescript
// messaging.service.ts

import { NraoFeedService } from './nrao-feed.service';

@Injectable()
export class MessagingService implements OnModuleInit, OnModuleDestroy {
  private nraoSubscription?: Subscription;

  constructor(private readonly nraoFeedService: NraoFeedService) {}

  onModuleInit() {
    this.startSimulation();

    // Use NRAO feed if available
    const useNraoFeed = this.config.get<boolean>('USE_NRAO_FEED') || false;
    if (useNraoFeed) {
      this.nraoSubscription = this.nraoFeedService
        .getTelemetry$()
        .subscribe((packet) => {
          this.telemetrySubject.next(packet);
        });
    }
  }
}
```

### Environment Configuration

```bash
# .env
NRAO_FEED_ENABLED=false                    # Enable NRAO API polling
USE_NRAO_FEED=false                        # Route NRAO → simulation hybrid
NRAO_API_URL=https://nrao-api.example.com  # NRAO endpoint
NRAO_API_KEY=<secret>                      # Authentication
```

---

## Adding Aggregation & Analytics

### Create Analytics Service

```typescript
// apps/cosmic-horizons-api/src/app/messaging/messaging-analytics.service.ts

import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { TelemetryPacket } from './messaging.types';

export interface SiteMetrics {
  siteId: string;
  elementCount: number;
  avgPowerUsage: number;
  avgNoiseFloor: number;
  rfiDetections: number;
  healthScore: number; // 0-100
}

@Injectable()
export class MessagingAnalyticsService {
  private siteMetrics = new Map<string, SiteMetrics>();

  aggregate(packets: TelemetryPacket[]): SiteMetrics[] {
    // Group by site
    const grouped = new Map<string, TelemetryPacket[]>();
    packets.forEach((p) => {
      if (!grouped.has(p.siteId)) {
        grouped.set(p.siteId, []);
      }
      grouped.get(p.siteId)!.push(p);
    });

    // Compute site-level metrics
    const results: SiteMetrics[] = [];
    grouped.forEach((sitePackets, siteId) => {
      const avgPower =
        sitePackets.reduce((s, p) => s + p.metrics.powerUsage, 0) /
        sitePackets.length;
      const avgNoise =
        sitePackets.reduce((s, p) => s + p.metrics.noiseFloor, 0) /
        sitePackets.length;
      const rfiCount = sitePackets.filter(
        (p) => p.metrics.rfiLevel > -100,
      ).length;

      const healthScore = Math.max(
        0,
        100 - rfiCount * 5 - (avgPower > 3000 ? 10 : 0),
      );

      results.push({
        siteId,
        elementCount: sitePackets.length,
        avgPowerUsage: avgPower,
        avgNoiseFloor: avgNoise,
        rfiDetections: rfiCount,
        healthScore,
      });
    });

    return results;
  }

  // Health alerts
  generateAlerts(metrics: SiteMetrics[]): string[] {
    const alerts: string[] = [];

    metrics.forEach((m) => {
      if (m.avgPowerUsage > 3500) {
        alerts.push(
          `⚠️  ${m.siteId}: High power usage (${m.avgPowerUsage.toFixed(0)} W)`,
        );
      }
      if (m.rfiDetections > 5) {
        alerts.push(
          `🔴 ${m.siteId}: RFI events detected (${m.rfiDetections} events)`,
        );
      }
      if (m.healthScore < 50) {
        alerts.push(
          `❌ ${m.siteId}: Health critical (${m.healthScore.toFixed(0)}%)`,
        );
      }
    });

    return alerts;
  }
}
```

### Expose via API

```typescript
// messaging.controller.ts

@Controller('messaging')
export class MessagingController {
  constructor(private readonly analyticsService: MessagingAnalyticsService) {}

  @Get('sites/health')
  getSiteHealth() {
    const allElements = this.messagingService.getAllElements();
    // Convert elements to telemetry packets for aggregation
    const packets = allElements.map((e) => ({
      // ... convert element → packet
    }));
    return this.analyticsService.aggregate(packets);
  }

  @Get('sites/alerts')
  getAlerts() {
    const health = this.getSiteHealth();
    return this.analyticsService.generateAlerts(health);
  }
}
```

---

## Testing Extensions

### Unit Test Example

```typescript
// messaging-analytics.service.spec.ts

import { Test } from '@nestjs/testing';
import { MessagingAnalyticsService } from './messaging-analytics.service';
import type { TelemetryPacket } from './messaging.types';

describe('MessagingAnalyticsService', () => {
  let service: MessagingAnalyticsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [MessagingAnalyticsService],
    }).compile();

    service = module.get<MessagingAnalyticsService>(MessagingAnalyticsService);
  });

  it('should aggregate telemetry by site', () => {
    const packets: TelemetryPacket[] = [
      {
        elementId: 'el-1',
        siteId: 'site-1',
        metrics: { powerUsage: 2000, noiseFloor: -100, rfiLevel: -120 },
        // ... rest of payload
      },
      {
        elementId: 'el-2',
        siteId: 'site-1',
        metrics: { powerUsage: 2500, noiseFloor: -95, rfiLevel: -110 },
        // ... rest of payload
      },
    ];

    const result = service.aggregate(packets);

    expect(result).toHaveLength(1);
    expect(result[0].siteId).toBe('site-1');
    expect(result[0].elementCount).toBe(2);
    expect(result[0].avgPowerUsage).toBe(2250);
  });

  it('should detect high RFI conditions', () => {
    const packets: TelemetryPacket[] = [
      {
        elementId: 'el-1',
        siteId: 'site-1',
        metrics: { powerUsage: 2000, noiseFloor: -100, rfiLevel: -80 }, // HIGH RFI!
        // ...
      },
    ];

    const health = service.aggregate(packets);
    const alerts = service.generateAlerts(health);

    expect(alerts).toContain(expect.stringContaining('RFI'));
  });
});
```

### Integration Test

```typescript
// messaging.e2e-spec.ts

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MessagingModule } from './messaging.module';
import { io } from 'socket.io-client';

describe('Messaging E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [MessagingModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(3000);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should stream telemetry via WebSocket', (done) => {
    const socket = io('http://localhost:3000/messaging');

    socket.on('telemetry_update', (packet) => {
      expect(packet.elementId).toBeDefined();
      expect(packet.metrics).toBeDefined();
      socket.disconnect();
      done();
    });
  });

  it('should provide stats via REST', async () => {
    const response = await fetch('http://localhost:3000/api/messaging/stats', {
      headers: { Authorization: 'Bearer <token>' },
    });
    const stats = await response.json();

    expect(stats.packetsPerSecond).toBeGreaterThan(0);
    expect(stats.infra).toBeDefined();
  });
});
```

---

## Deployment & DevOps

### Docker Build

```dockerfile
# Dockerfile (api service)
FROM node:18-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

RUN pnpm nx build cosmic-horizons-api

EXPOSE 3000
CMD ["node", "dist/apps/cosmic-horizons-api/main.js"]
```

### Kubernetes Deployment with Messaging

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cosmic-horizons-api
  namespace: default
spec:
  replicas: 2
  selector:
    matchLabels:
      app: cosmic-horizons-api
  template:
    metadata:
      labels:
        app: cosmic-horizons-api
    spec:
      containers:
        - name: api
          image: cosmic-horizons-api:latest
          ports:
            - containerPort: 3000
          env:
            - name: RABBITMQ_HOST
              value: rabbitmq-service
            - name: KAFKA_HOST
              value: kafka-broker-0.kafka-service
            - name: DB_HOST
              value: postgres-service
            - name: REDIS_HOST
              value: redis-service
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/messaging/stats
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 2000m
              memory: 2Gi
```

## References

- [MESSAGING-ARCHITECTURE.md](./MESSAGING-ARCHITECTURE.md)
- [KAFKA-SETUP.md](./KAFKA-SETUP.md)
- [RABBITMQ-SETUP.md](./RABBITMQ-SETUP.md)
- [ARRAY-MONITORING-API.md](./ARRAY-MONITORING-API.md)
- [NestJS Microservices](https://docs.nestjs.com/microservices/overview)
- [RxJS Subject & Observable](https://rxjs.dev/)
