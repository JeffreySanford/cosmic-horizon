# Messaging System Architecture

**Overview**: The Cosmic Horizons messaging system provides dual-layer telemetry infrastructure using RabbitMQ (management plane) and Kafka (data plane) to support real-time Array Information monitoring across distributed VLA elements and sites.

## System Overview

The messaging architecture is designed to ingest, broker, and monitor telemetry from distributed array elements across multiple observatory sites. It supports:

- **Real-time telemetry streaming** from 60+ array elements
- **Dual-transport architecture**: RabbitMQ for orchestration signals, Kafka for high-volume visibility data
- **Infrastructure health monitoring** with latency tracking, queue depth, and partition offsets
- **WebSocket live updates** for real-time Array Information monitoring UI
- **Storage layer** integration with PostgreSQL and Redis

```text
┌─────────────────────────────────────────────────────────────────┐
│                       Web Client (UI)                           │
│         Array Information Monitoring Dashboard                  │
└──────────────────┬──────────────────────────────────────────────┘
                   │
        WebSocket (Socket.IO)
                   │
        ┌──────────▼──────────┐
        │   Messaging Gateway │
        │  (Real-time emitter)│
        └──────────┬──────────┘
                   │
     ┌─────────────┼──────────────┐
     │             │              │
  Telemetry    Stats Update   Infrastructure
  Stream       Broadcast       Health Snapshot
     │             │              │
┌────▼─────────────▼──────────────▼─────────────────┐
│        Messaging Integration Service              │
│  ┌──────────────────────────────────────────────┐ │
│  │   Dual-Transport Message Broker             │ │
│  │  • RabbitMQ Client (Management Plane)       │ │
│  │  • Kafka Client (Data Plane)                │ │
│  └──────────────────────────────────────────────┘ │
└────┬──────────────────────────────────────────────┘
     │
     ├────────────────────┬─────────────────────┐
     │                    │                     │
  RabbitMQ             Kafka              Monitoring
     │                    │                     │
┌────▼────────┐    ┌─────▼─────────┐   ┌──────▼──────────┐
│  RabbitMQ   │    │ Kafka Cluster │   │ Monitor Service │
│  Cluster    │    │               │   │ • Kafka Admin   │
│ (3 nodes)   │    │   3-broker    │   │ • RabbitMQ API  │
│   :5672     │    │  + Zookeeper  │   │ • PostgreSQL    │
│  :15672(UI) │    │     :9092     │   │ • Redis         │
└─────────────┘    └───────────────┘   └─────────────────┘
     │                    │                     │
┌────▼────────────────────▼─────────────────────▼──────────┐
│           Storage Layer (Persistent)                     │
│  ┌──────────────────────────────────────────────────┐    │
│  │  PostgreSQL: Audit logs, Telemetry Archive      │    │
│  │  Redis: Live metrics cache, Session state       │    │
│  └──────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘

Legend:
┌─ Management/Orchestration (RabbitMQ)
│
└─ Data Streaming (Kafka)
```

## Architectural Components

### 1. Array Element Telemetry Source

- **60 elements** distributed across 5 observatory sites
- **Simulation-based** for development (production uses NRAO feeds)
- **Telemetry packet** emitted every 100ms per element
- **Packet content**: metrics (vibration, power, RFI), orientation (azimuth/elevation), status

**Source File**: `apps/cosmic-horizons-api/src/app/messaging/messaging.service.ts`

### 2. Messaging Integration Service

**Purpose**: Bridges local telemetry stream to distributed brokers.

**Key Responsibilities**:

- Initialize RabbitMQ and Kafka clients on module startup
- Subscribe to internal telemetry Subject
- Emit to RabbitMQ queue: `element_telemetry_queue`
- Emit to Kafka topic: `element.raw_data`
- Track stats (packets/sec, errors, delivery)

**Transport Specifications**:

| Transport | Queue/Topic             | Durable | Purpose                                          |
| --------- | ----------------------- | ------- | ------------------------------------------------ |
| RabbitMQ  | element_telemetry_queue | No      | Management plane: control signals, orch messages |
| Kafka     | element.raw_data        | Yes     | Data plane: raw visibility + telemetry archive   |

**Source File**: `apps/cosmic-horizons-api/src/app/messaging/messaging-integration.service.ts`

### 3. Messaging Monitor Service

**Purpose**: Continuously polls infrastructure health and exposes snapshot.

**Polling Interval**: 2 seconds

**Monitored Systems**:

- **RabbitMQ**: Queue depth, consumer count, latency (via Management API)
- **Kafka**: Latest offset, partition count, latency (via Admin client)
- **PostgreSQL**: Connectivity, query latency
- **Redis**: Connectivity, get/set latency

**Snapshot Structure**:

```typescript
MessagingInfraSnapshot = {
  rabbitmq: {
    connected: boolean,
    latencyMs: number | null,
    queueDepth: number | null,
    consumers: number | null,
  },
  kafka: {
    connected: boolean,
    latencyMs: number | null,
    latestOffset: number | null,
    partitions: number | null,
  },
  storage: {
    postgres: { connected, latencyMs },
    redis: { connected, latencyMs },
  },
};
```

**Source File**: `apps/cosmic-horizons-api/src/app/messaging/messaging-monitor.service.ts`

### 4. Messaging Stats Service

**Purpose**: Aggregates per-second throughput metrics and infrastructure state.

**Computed Metrics**:

- Packets/second (total, node-to-hub, hub-to-hub)
- RabbitMQ published/sec
- Kafka published/sec
- PSQLwrite/sec
- Error rate

**Exposed as**: `GET /api/messaging/stats` (REST) + `stats_update` (WebSocket)

**Source File**: `apps/cosmic-horizons-api/src/app/messaging/messaging-stats.service.ts`

### 5. Messaging Gateway (WebSocket)

**Purpose**: Real-time event stream to Array Information UI.

**Events Emitted**:

| Event              | Interval                | Payload            |
| ------------------ | ----------------------- | ------------------ |
| `telemetry_update` | On capture (~100ms avg) | TelemetryPacket    |
| `stats_update`     | Every 1 second          | MessagingLiveStats |

**Namespace**: `/messaging`

**Source File**: `apps/cosmic-horizons-api/src/app/messaging/messaging.gateway.ts`

## Data Flow

### Telemetry Emission Path

```test
1. MessagingService (simulation/NRAO feed)
   ↓
2. Subject<TelemetryPacket> (in-process observable)
   ↓
3. MessagingIntegrationService subscribes
   ├─ Emits → RabbitMQ client (element.telemetry)
   ├─ Emits → Kafka client (element.raw_data)
   └─ Increments stats counters
   ↓
4. MessagingStatsService aggregates per-sec metrics
   ↓
5. MessagingGateway broadcasts to WebSocket clients
   └─ Event: telemetry_update + stats_update
   ↓
6. Frontend (Array Information UI) receives in real-time
```

### Monitoring Path

```text
1. MessagingMonitorService polls every 2 seconds
   ├─ RabbitMQ Management API (HTTP GET)
   ├─ Kafka Admin client (TCP)
   ├─ PostgreSQL connection test (TCP)
   └─ Redis PING (TCP)
   ↓
2. Updates internal snapshot state
   ↓
3. MessagingStatsService includes snapshot in `/api/messaging/stats`
   ↓
4. WebSocket clients receive snapshot in stats_update event
```

## Deployment Targets

### Development (Docker Compose)

- **RabbitMQ**: localhost:5672 (AMQP), :15672 (Management UI)
- **Kafka**: localhost:9092 (Broker), Zookeeper on :2181
- **PostgreSQL**: localhost:15432
- **Redis**: localhost:6379

**See**: `docker-compose.yml` at repository root

### Production (TACC/Kubernetes)

- **RabbitMQ**: 3-node HA cluster with Erlang mnesia replication
- **Kafka**: 3+ broker cluster with Zookeeper ensemble
- **PostgreSQL**: Managed database service with automated backups
- **Redis**: Cluster mode with sentinel high-availability

**See**: [KAFKA-SETUP.md](./KAFKA-SETUP.md) and [RABBITMQ-SETUP.md](./RABBITMQ-SETUP.md)

## Configuration

### Environment Variables

```bash
# RabbitMQ (Management Plane)
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672
RABBITMQ_USER=guest
RABBITMQ_PASS=guest

# Kafka (Data Plane)
KAFKA_HOST=localhost
KAFKA_PORT=9092

# Storage Layer
DB_HOST=localhost
DB_PORT=15432
DB_USER=cosmic_horizons_user
DB_PASSWORD=cosmic_horizons_password_dev
DB_NAME=cosmic_horizons

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

**See**: `documentation/reference/ENV-REFERENCE.md`

## Resilience & Failure Modes

### RabbitMQ Unavailable

- Integration service logs error
- Telemetry continues locally
- Kafka delivery continues
- UI still receives via WebSocket

### Kafka Unavailable

- Admin client connection fails gracefully
- Monitor returns `connected: false`
- Telemetry emission continues to RabbitMQ
- UI receives degraded health snapshot

### PostgreSQL Unavailable

- Monitor detects connection failure
- Audit logs queue in memory
- Stats still computed from in-process metrics

### Redis Unavailable

- Cache layer fails gracefully
- Session fallback to database
- Real-time metrics unaffected

## Performance Characteristics

| Metric               | Value            | Notes                                   |
| -------------------- | ---------------- | --------------------------------------- |
| Telemetry Rate       | ~600 packets/sec | 60 elements × 10 Hz                     |
| Message Size         | ~200-500 bytes   | Per TelemetryPacket                     |
| RabbitMQ Throughput  | 5-10k msgs/sec   | Single queue, non-durable               |
| Kafka Throughput     | 50k+ msgs/sec    | Cluster mode, replicated                |
| Monitor Poll Latency | <100ms           | Parallel polling all endpoints          |
| WebSocket Broadcast  | <50ms            | Socket.IO to all connected clients      |
| CPU per Core         | 5-15%            | Idle state (development)                |
| Memory Peak          | ~200MB           | API server + all infrastructure clients |

## References

- [KAFKA-SETUP.md](./KAFKA-SETUP.md) — Kafka cluster deployment
- [RABBITMQ-SETUP.md](./RABBITMQ-SETUP.md) — RabbitMQ cluster deployment
- [ARRAY-MONITORING-API.md](./ARRAY-MONITORING-API.md) — REST + WebSocket endpoints
- [IMPLEMENTATION-GUIDE.md](./IMPLEMENTATION-GUIDE.md) — Adding new telemetry sources
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — Common issues and diagnostics
