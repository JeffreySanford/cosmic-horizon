# Array Information Monitoring API

**Overview**: RESTful and WebSocket endpoints for real-time Array Information monitoring, including element telemetry, site aggregation, and infrastructure health.

## Base URL

```text
http://localhost:3000/api/messaging
```

## Authentication

All endpoints require JWT Bearer token authentication (except WebSocket events which inherit from initial connection).

```text
Authorization: Bearer <jwt-token>
```

## REST Endpoints

### GET /sites

**Purpose**: Retrieve all array observatory sites.

**Authentication**: Required

**Response** (200 OK):

```json
[
  {
    "id": "site-1",
    "name": "Socorro Hub",
    "location": {
      "lat": 34.0664,
      "lng": -106.9056
    },
    "cluster": "Alpha",
    "totalDataRateGbps": 12.5,
    "activeElements": 12
  },
  {
    "id": "site-2",
    "name": "Green Bank Relay",
    "location": {
      "lat": 38.4331,
      "lng": -79.8181
    },
    "cluster": "Alpha",
    "totalDataRateGbps": 5.2,
    "activeElements": 10
  },
  {
    "id": "site-3",
    "name": "Owens Valley Node",
    "location": {
      "lat": 37.2339,
      "lng": -118.2831
    },
    "cluster": "Bravo",
    "totalDataRateGbps": 8.1,
    "activeElements": 12
  },
  {
    "id": "site-4",
    "name": "Pie Town Relay",
    "location": {
      "lat": 34.3015,
      "lng": -108.1132
    },
    "cluster": "Charlie",
    "totalDataRateGbps": 3.7,
    "activeElements": 8
  },
  {
    "id": "site-5",
    "name": "Los Alamos Link",
    "location": {
      "lat": 35.8811,
      "lng": -106.3031
    },
    "cluster": "Charlie",
    "totalDataRateGbps": 4.3,
    "activeElements": 6
  }
]
```

**Example cURL**:

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/messaging/sites
```

---

### GET /elements

**Purpose**: Retrieve all array elements with current status and telemetry.

**Authentication**: Required

**Query Parameters**: None

**Response** (200 OK):

```json
[
  {
    "id": "element-site-1-1",
    "name": "Socorro Hub Dish-1",
    "siteId": "site-1",
    "status": "operational",
    "azimuth": 145.32,
    "elevation": 42.18,
    "temperature": 24.5,
    "windSpeed": 8.3,
    "dataRateMbps": 142.5,
    "lastUpdate": "2026-02-13T14:32:45.123Z"
  },
  {
    "id": "element-site-1-2",
    "name": "Socorro Hub Dish-2",
    "siteId": "site-1",
    "status": "operational",
    "azimuth": 267.89,
    "elevation": 35.45,
    "temperature": 24.2,
    "windSpeed": 7.9,
    "dataRateMbps": 138.7,
    "lastUpdate": "2026-02-13T14:32:45.124Z"
  }
  // ... 58 more elements
]
```

**Response Size**: ~60 elements × 300 bytes ≈ 18 KB

**Example cURL**:

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/messaging/elements | jq '.[] | select(.status != "operational")'
```

---

### GET /sites/:siteId/elements

**Purpose**: Retrieve array elements for a specific site.

**Authentication**: Required

**Path Parameters**:

| Parameter | Type   | Description                          |
| --------- | ------ | ------------------------------------ |
| siteId    | string | Observatory site ID (e.g., "site-1") |

**Response** (200 OK):

```json
[
  {
    "id": "element-site-1-1",
    "name": "Socorro Hub Dish-1",
    "siteId": "site-1",
    "status": "operational",
    "azimuth": 145.32,
    "elevation": 42.18,
    "temperature": 24.5,
    "windSpeed": 8.3,
    "dataRateMbps": 142.5,
    "lastUpdate": "2026-02-13T14:32:45.123Z"
  }
  // ... 11 more elements for this site
]
```

**Error Responses**:

| Code | Error        | Cause                        |
| ---- | ------------ | ---------------------------- |
| 401  | Unauthorized | Missing or invalid JWT token |
| 404  | Not Found    | Invalid siteId               |

**Example cURL**:

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/messaging/sites/site-1/elements
```

---

### GET /stats

**Purpose**: Real-time infrastructure health and throughput metrics.

**Authentication**: Required

**Response** (200 OK):

```json
{
  "at": "2026-02-13T14:32:46.000Z",

  "packetsPerSecond": 598,
  "nodeToHubPerSecond": 598,
  "hubToHubPerSecond": 0,

  "rabbitPublishedPerSecond": 598,
  "kafkaPublishedPerSecond": 598,
  "persistentWritesPerSecond": 42,

  "totals": {
    "packets": 35882000,
    "nodeToHub": 35882000,
    "hubToHub": 0,
    "rabbitPublished": 35882000,
    "kafkaPublished": 35882000,
    "persistentWrites": 2395200,
    "errors": 124
  },

  "infra": {
    "rabbitmq": {
      "connected": true,
      "latencyMs": 28,
      "queueDepth": 1200,
      "consumers": 2
    },
    "kafka": {
      "connected": true,
      "latencyMs": 45,
      "latestOffset": 35882000,
      "partitions": 1
    },
    "storage": {
      "postgres": {
        "connected": true,
        "latencyMs": 12
      },
      "redis": {
        "connected": true,
        "latencyMs": 3
      }
    }
  }
}
```

**Field Descriptions**:

| Field                     | Type    | Unit     | Description                       |
| ------------------------- | ------- | -------- | --------------------------------- |
| at                        | string  | ISO 8601 | Snapshot timestamp                |
| packetsPerSecond          | number  | pps      | Current throughput                |
| nodeToHubPerSecond        | number  | pps      | Element → Site telemetry rate     |
| hubToHubPerSecond         | number  | pps      | Site → Hub routing rate           |
| rabbitPublishedPerSecond  | number  | pps      | Messages published to RabbitMQ    |
| kafkaPublishedPerSecond   | number  | pps      | Messages published to Kafka       |
| persistentWritesPerSecond | number  | pps      | Writes to PostgreSQL              |
| totals.\*                 | number  | count    | Cumulative total since startup    |
| infra.rabbitmq.connected  | boolean | -        | RabbitMQ broker reachable         |
| infra.rabbitmq.latencyMs  | number  | ms       | HTTP round-trip to Management API |
| infra.rabbitmq.queueDepth | number  | count    | Messages in queue (backlog)       |
| infra.rabbitmq.consumers  | number  | count    | Active consumers                  |
| infra.kafka.latestOffset  | number  | count    | Total messages in topic           |
| infra.kafka.partitions    | number  | count    | Partition count                   |

**Polling Interval**: Call every 500ms-1s for smooth UI animations

**Example cURL**:

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/messaging/stats | jq '.infra'
```

---

## WebSocket Endpoints

### Connection

**URL**: `ws://localhost:3000/socket.io`

**Namespace**: `/messaging`

**Handshake**:

```javascript
// Client
const socket = io('http://localhost:3000', {
  path: '/socket.io',
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
});

socket.on('connect', () => {
  console.log('Connected to messaging namespace');
});
```

---

### Event: `telemetry_update`

**Frequency**: ~100ms interval (on each packet capture)

**Payload** (TelemetryPacket):

```json
{
  "sourceId": "element-site-1-5",
  "targetId": "site-1",
  "routeType": "node_to_hub",
  "elementId": "element-site-1-5",
  "siteId": "site-1",
  "timestamp": "2026-02-13T14:32:45.234Z",
  "metrics": {
    "vibration": 0.45,
    "powerUsage": 2450,
    "noiseFloor": -95.3,
    "rfiLevel": -110.2
  }
}
```

**Listener**:

```javascript
socket.on('telemetry_update', (packet) => {
  console.log(`Element ${packet.elementId} metrics:`, packet.metrics);
  // Update UI with real-time data
});
```

**Use Cases**:

- Real-time element motion tracking (azimuth/elevation)
- Live power consumption trends
- RFI event detection
- Vibration anomaly alerts

---

### Event: `stats_update`

**Frequency**: Every 1 second

**Payload** (MessagingLiveStats):

```json
{
  "at": "2026-02-13T14:32:46.000Z",
  "packetsPerSecond": 598,
  "nodeToHubPerSecond": 598,
  "hubToHubPerSecond": 0,
  "rabbitPublishedPerSecond": 598,
  "kafkaPublishedPerSecond": 598,
  "persistentWritesPerSecond": 42,
  "totals": {
    "packets": 35882000,
    "nodeToHub": 35882000,
    "hubToHub": 0,
    "rabbitPublished": 35882000,
    "kafkaPublished": 35882000,
    "persistentWrites": 2395200,
    "errors": 124
  },
  "infra": {
    "rabbitmq": {
      "connected": true,
      "latencyMs": 28,
      "queueDepth": 1200,
      "consumers": 2
    },
    "kafka": {
      "connected": true,
      "latencyMs": 45,
      "latestOffset": 35882000,
      "partitions": 1
    },
    "storage": {
      "postgres": {
        "connected": true,
        "latencyMs": 12
      },
      "redis": {
        "connected": true,
        "latencyMs": 3
      }
    }
  }
}
```

**Listener**:

```javascript
socket.on('stats_update', (stats) => {
  console.log(`Throughput: ${stats.packetsPerSecond} pps`);
  console.log(`RabbitMQ: ${stats.infra.rabbitmq.connected ? 'UP' : 'DOWN'}`);
  console.log(`Kafka: ${stats.infra.kafka.connected ? 'UP' : 'DOWN'}`);
  // Update dashboard gauges, charts, status indicators
});
```

**Use Cases**:

- Throughput dashboard (live gauge)
- Infrastructure status panel
- Performance trending
- Capacity planning

---

### Event: `disconnect`

**Cause**: Client disconnection or server shutdown

**Listener**:

```javascript
socket.on('disconnect', (reason) => {
  console.log(`Disconnected: ${reason}`);
  // Show UI offline indicator
});
```

**Possible Reasons**:

- `io server disconnect` — Server closed connection
- `io client disconnect` — Client called `socket.disconnect()`
- `transport close` — Network interruption
- `transport error` — Network error

---

## Frontend Integration Example

### React Hook (Array Information Monitoring)

```typescript
// hooks/useMessagingStats.ts
import { useEffect, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import type {
  MessagingLiveStats,
  TelemetryPacket,
} from '@cosmic-horizons/shared-models';

export function useMessagingStats() {
  const [stats, setStats] = useState<MessagingLiveStats | null>(null);
  const [latestPacket, setLatestPacket] = useState<TelemetryPacket | null>(
    null,
  );
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket: Socket = io('http://localhost:3000', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Connected to messaging');
      setConnected(true);
    });

    socket.on('stats_update', (snapshot: MessagingLiveStats) => {
      setStats(snapshot);
    });

    socket.on('telemetry_update', (packet: TelemetryPacket) => {
      setLatestPacket(packet);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { stats, latestPacket, connected };
}
```

### Dashboard Component

```typescript
// components/ArrayMonitoringDashboard.tsx
import { useMessagingStats } from '../hooks/useMessagingStats';

export function ArrayMonitoringDashboard() {
  const { stats, latestPacket, connected } = useMessagingStats();

  if (!connected || !stats) {
    return <div>Connecting to messaging system...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Array Information Monitoring</h1>

      {/* Status Indicators */}
      <div className="status-panel">
        <Indicator label="RabbitMQ" connected={stats.infra.rabbitmq.connected} />
        <Indicator label="Kafka" connected={stats.infra.kafka.connected} />
        <Indicator label="PostgreSQL" connected={stats.infra.storage.postgres.connected} />
        <Indicator label="Redis" connected={stats.infra.storage.redis.connected} />
      </div>

      {/* Performance Gauges */}
      <div className="metrics-panel">
        <Gauge
          label="Throughput"
          value={stats.packetsPerSecond}
          unit="pps"
          max={1000}
        />
        <Gauge
          label="RabbitMQ Queue Depth"
          value={stats.infra.rabbitmq.queueDepth}
          unit="msgs"
        />
        <Gauge
          label="Kafka Offsets"
          value={stats.infra.kafka.latestOffset}
          unit="msgs"
        />
      </div>

      {/* Real-time Telemetry */}
      {latestPacket && (
        <div className="telemetry-panel">
          <h3>Latest Packet: {latestPacket.elementId}</h3>
          <dl>
            <dt>Vibration:</dt>
            <dd>{latestPacket.metrics.vibration.toFixed(2)} m/s²</dd>
            <dt>Power Usage:</dt>
            <dd>{latestPacket.metrics.powerUsage} W</dd>
            <dt>Noise Floor:</dt>
            <dd>{latestPacket.metrics.noiseFloor.toFixed(1)} dBm</dd>
            <dt>RFI Level:</dt>
            <dd>{latestPacket.metrics.rfiLevel.toFixed(1)} dBm</dd>
          </dl>
        </div>
      )}
    </div>
  );
}
```

## Error Handling

### REST Errors

```json
// 401 Unauthorized
{
  "statusCode": 401,
  "message": "Unauthorized"
}

// 404 Not Found (invalid site)
{
  "statusCode": 404,
  "message": "Site not found"
}

// 500 Internal Server Error
{
  "statusCode": 500,
  "message": "Failed to retrieve stats"
}
```

### WebSocket Disconnection

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error);
  // Show reconnection UI
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

## Rate Limiting

- **REST endpoints**: 100 requests/minute per IP
- **WebSocket**: No rate limiting (event-driven)
- **Infrastructure polling**: Internal 2-second interval (not user-facing)

## Performance & Scalability

| Scenario      | Throughput | Latency | Notes                       |
| ------------- | ---------- | ------- | --------------------------- |
| Single client | 600 pps    | <50ms   | Development                 |
| 10 clients    | 600 pps    | <100ms  | Dashboard + API consumers   |
| 100 clients   | 600 pps    | <200ms  | Broadcast bottleneck        |
| 1000 clients  | 600 pps    | 500ms+  | Requires Socket.IO clusters |

## References

- [MESSAGING-ARCHITECTURE.md](./MESSAGING-ARCHITECTURE.md) — System design
- [API-ROUTES.md](../API-ROUTES.md) — General API reference
- [Socket.IO Documentation](https://socket.io/docs/)
- [NestJS WebSockets](https://docs.nestjs.com/websockets/gateways)
