# Broker Comparison Strategy & View Design

**Status**: Active Execution (Sprint 5.4)  
**Purpose**: Validate broker performance empirically and drive Phase 4 consolidation decision  
**Date**: 2026-02-16

---

## 0. Current Implementation Status (as of 2026-02-16)

- Broker comparison API and UI are operational (`/api/internal/brokers/*`, `/operations/broker-comparison`).
- Startup warmup and warm-start caching are active to reduce first-load delay in the broker view.
- Data-quality signaling is active (measured vs fallback/simulated tagging and bannering).
- Remaining Sprint 5.4 outputs are benchmark-result publication and ADR updates for go/no-go.

---

## 1. Current Architecture: Dual-Broker Strategy

### RabbitMQ Role (Ephemeral Tier)

**What it does**: Real-time, low-latency event delivery

| Characteristic    | Value                                                      |
| ----------------- | ---------------------------------------------------------- |
| **Retention**     | In-memory (0 persistence by default)                       |
| **Latency**       | <10ms P99                                                  |
| **Use Cases**     | Real-time notifications, WebSocket pushes, live dashboards |
| **Routing**       | Direct, fanout, topic-based exchanges                      |
| **Replayability** | No (ephemeral)                                             |
| **Storage Model** | Memory-only                                                |

**Topics Published**:

- `job.events` (fanout) → Real-time job status to all subscribers
- `notifications` (direct) → Per-user notification routing
- `dlx` (dead-letter) → Failed message handling

---

### Kafka Role (Durable Tier - CRITICAL FOR AUDIT)

**What it does**: Long-term event log, compliance, audit trail, replay capability

| Characteristic    | Value                                                        |
| ----------------- | ------------------------------------------------------------ |
| **Retention**     | 30-90 days on disk                                           |
| **Latency**       | 50-100ms P99                                                 |
| **Use Cases**     | Compliance audit, event replay, analytics, disaster recovery |
| **Routing**       | Partition-based (immutable log)                              |
| **Replayability** | Yes (offset-based consumer groups)                           |
| **Storage Model** | Append-only log (SSD disk)                                   |

**Topics Defined** (See [EVENT-STREAMING-TOPOLOGY.md](EVENT-STREAMING-TOPOLOGY.md)):

| Topic           | Partitions | Retention   | Purpose                                                       |
| --------------- | ---------- | ----------- | ------------------------------------------------------------- |
| `job-lifecycle` | 10         | 30 days     | Job state transitions (submitted, running, completed, failed) |
| `job-metrics`   | 20         | 30 days     | Performance metrics (execution time, GPU usage, latency)      |
| `notifications` | 5          | 7 days      | User notifications (sent, read, alerts)                       |
| `audit-trail`   | 5          | **90 days** | Compliance: policy changes, data access, user actions         |
| `system-health` | 3          | 7 days      | Infrastructure metrics, broker health, resource usage         |

**Why Kafka is Critical**:

1. **Audit/Compliance**: 90-day retention on `audit-trail` for regulatory requirements
2. **Event Replay**: Reset offset to reprocess months of historical data
3. **Fan-out**: Consumer groups enable multiple independent processors
4. **Immutability**: Append-only log prevents tampering

---

## 2. Pulsar: The Consolidation Play

Pulsar combines **both** RabbitMQ and Kafka capabilities in a single platform:

| Capability              | RabbitMQ   | Kafka      | Pulsar         | Notes                            |
| ----------------------- | ---------- | ---------- | -------------- | -------------------------------- |
| **Real-time Messaging** | ✅         | ❌         | ✅             | Ephemeral subscriptions          |
| **Durable Log**         | ❌         | ✅         | ✅             | Persistent topics with retention |
| **Geo-replication**     | ❌         | ❌         | ✅             | Multi-region failover            |
| **Tiered Storage**      | ❌         | ❌         | ✅             | SSD + S3 archival                |
| **Throughput**          | ~1K msg/s  | ~10K msg/s | **14K+ msg/s** | Peak performance under load      |
| **P99 Latency**         | ~10ms      | ~50ms      | **~6ms**       | End-to-end latency percentile    |
| **Operations**          | 2 clusters | 1 cluster  | 1 cluster      | Operational simplicity gain      |

### Architecture Shift (Phase 4)

```text
CURRENT (Phase 3):                  FUTURE (Phase 4):
┌─────────────────┐                ┌──────────────────┐
│   RabbitMQ      │  ┌────────┐   │   Pulsar         │
│ (ephemeral)     ├─→│ Events ├─→ │ (unified         │
└─────────────────┘  └────────┘   │  platform)       │
                                   │ - Real-time      │
┌─────────────────┐                │ - Durable log    │
│    Kafka        │                │ - Geo-replicated │
│ (audit trail)   │                └──────────────────┘
└─────────────────┘
       ↓
  Operations Overhead:
  - 2 clusters
  - 2 monitoring UIs
  - 2 troubleshooting runbooks

       Becomes:
  Single Pulsar cluster
  - Unified monitoring
  - One operational model
  - 40-50% less overhead
```

---

## 3. Kafka's Role During Phase 3.5 Evaluation

### Status Quo (Months 1-3)

- **Keep Kafka running** (part of docker-compose.events.yml)
- **Keep audit trail publishing** to Kafka topics
- **Benefits**:
  - No operational disruption
  - Preserve 90-day compliance retention
  - Enable Kafka consumer verification
  - Baseline for Pulsar comparison

### Phase 4 Decision Point (After Benchmarking)

**IF** Pulsar proves reliable AND achieves targets:

- Migrate persistent topics from Kafka → Pulsar
- Migrate consumer groups from Kafka → Pulsar
- Deprecate standalone Kafka (keep in docker-compose for reference)
- Maintain 90-day audit retention on Pulsar

**IF** Pulsar doesn't meet requirements:

- Expand Kafka investment (increase partitions, replication)
- Keep dual-broker strategy indefinitely
- Add Redis Streams as additional tier

---

## 4. Broker Comparison View Design

### Use Case

"Is Pulsar really 30-40% faster? Does it use less memory? Can we trust it for Phase 4?"

### Data Model

```typescript
interface BrokerMetrics {
  // Throughput
  messagesPerSecond: number;
  batchThroughput: number; // 1000-message batches

  // Latency (percentiles)
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;

  // Resource Usage
  memoryUsageMb: number;
  cpuPercentage: number;
  connectionCount: number;

  // Connection Health
  isConnected: boolean;
  uptime: string; // "3h 45m 12s"
  lastHealthCheck: Date;

  // Timestamp
  capturedAt: Date;
}

interface BrokerComparison {
  rabbitmq: BrokerMetrics;
  pulsar: BrokerMetrics;
  kafka?: BrokerMetrics; // Optional for Phase 3

  // Deltas
  throughputImprovement: number; // percentage (+36%)
  latencyImprovement: number;
  memoryEfficiency: number;
}
```

---

## 5. Backend API Design

### Endpoints

#### `/api/internal/brokers/stats`

**GET** - Fetch current metrics from all running brokers

```json
{
  "timestamp": "2026-02-15T14:30:00Z",
  "brokers": {
    "rabbitmq": {
      "connected": true,
      "messagesPerSecond": 1173,
      "p99LatencyMs": 8.5,
      "memoryUsageMb": 156.2,
      "uptime": "3h 45m 12s",
      "connectionCount": 12
    },
    "pulsar": {
      "connected": true,
      "messagesPerSecond": 1604,
      "p99LatencyMs": 6.2,
      "memoryUsageMb": 128.9,
      "uptime": "3h 45m 12s",
      "connectionCount": 8
    },
    "kafka": {
      "connected": true,
      "messagesPerSecond": 8234,
      "p99LatencyMs": 47.3,
      "memoryUsageMb": 412.5,
      "uptime": "4h 12m 30s",
      "partitionCount": 33
    }
  },
  "comparison": {
    "throughputImprovement": "+36.8%",
    "latencyImprovement": "-27.1%",
    "memoryEfficiency": "-27.9%"
  }
}
```

#### `/api/internal/brokers/history?hours=24`

**GET** - Fetch time-series data for charting

```json
{
  "timeRange": {
    "start": "2026-02-14T14:30:00Z",
    "end": "2026-02-15T14:30:00Z"
  },
  "samples": [
    {
      "timestamp": "2026-02-14T14:30:00Z",
      "rabbitmq": { "throughput": 1173, "latency": 8.5, "memory": 156.2 },
      "pulsar": { "throughput": 1604, "latency": 6.2, "memory": 128.9 }
    }
    // ... more samples every 5 minutes
  ]
}
```

#### `/api/internal/brokers/benchmark`

**POST** - Trigger benchmark run (calls `scripts/benchmark-pulsar-vs-rabbitmq.mjs`)

```json
{
  "eventCount": 10000,
  "status": "running"
}
```

Response (when complete):

```json
{
  "status": "completed",
  "duration": "45s",
  "results": {
    "rabbitmq": { ... },
    "pulsar": { ... },
    "comparison": { ... }
  },
  "reportUrl": "/api/internal/brokers/benchmark/report-20260215-143000"
}
```

---

## 6. Frontend Dashboard Component

### Location

`apps/cosmic-horizons-web/src/app/modules/operations/broker-comparison`

### Layout (Angular Material)

```text
┌─────────────────────────────────────────────────────────┐
│ Broker Performance Comparison                    [BENCHMARK] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 📊 THROUGHPUT (messages/sec)                           │
│ [Chart: RabbitMQ vs Pulsar vs Kafka]                  │
│ RabbitMQ: 1,173 msg/s      Pulsar: 1,604 msg/s       │
│                     ↓ Pulsar +36.8% faster             │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ⚡ LATENCY (P99, milliseconds)                          │
│ [Chart: 24-hour trend]                                │
│ RabbitMQ: 8.5ms    Pulsar: 6.2ms  ✅ -27.1%          │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 💾 MEMORY EFFICIENCY (MB)                             │
│ [Gauge: Current usage]                                │
│ RabbitMQ: 156MB    Pulsar: 129MB   ✅ -27.9%         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🔌 BROKER STATUS                                       │
│ ┌──────────┬────────────┬────────┐                    │
│ │ Broker   │ Status     │ Uptime │                    │
│ ├──────────┼────────────┼────────┤                    │
│ │RabbitMQ  │ ✅ Running │ 3h 45m │                    │
│ │Pulsar    │ ✅ Running │ 3h 45m │                    │
│ │Kafka     │ ✅ Running │ 4h 12m │                    │
│ └──────────┴────────────┴────────┘                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Key Components

1. **Throughput Charts** (nivo or chart.js)
   - Real-time line chart (last 24 hours)
   - Side-by-side bar comparison
   - Percentage improvement highlight

2. **Latency Distribution**
   - P50/P95/P99 visualization
   - Histogram showing distribution

3. **Resource Gauges**
   - Memory usage (circular gauges)
   - CPU percentage
   - Connection count

4. **Health Status Table**
   - Broker name, status, uptime
   - Last sample timestamp
   - Action buttons (view logs, restart)

5. **Actions Panel**
   - `[Run Benchmark]` - Trigger comparison test
   - `[Export Report]` - Download JSON/CSV
   - `[View Details]` - Deep dive per broker
   - Time range selector (1h, 6h, 24h, 7d)

---

## 7. Implementation Roadmap

### Sprint 5.4 Phase 1: Metrics Collection

**Week 1 tasks**:

- [ ] Create `BrokerMetricsService` in `libs/shared`
  - RabbitMQ stats collector (HTTP API to port 15672)
  - Pulsar stats collector (REST API to port 8088)
  - Kafka stats collector (optional, via JMX or Kafka CLI)

- [ ] Implement `/api/internal/brokers/stats` endpoint
  - Call metrics collectors
  - Aggregate results
  - Return JSON response

- [ ] Create in-memory cache for metrics (60-second TTL)
  - Prevents overload of broker admin APIs
  - Enables dashboard polling every 5-10 seconds

- [ ] Add metrics storage (PostgreSQL or InfluxDB)
  - Time-series table: `broker_metrics(broker_name, timestamp, throughput, latency, memory, ...)`
  - Retention: 7 days minimum

### Sprint 5.4 Phase 2: Dashboard UI

**Week 2 tasks**:

- [ ] Create `BrokerComparisonComponent` (Angular)
  - Layout with Material cards
  - HTTP call to `/api/internal/brokers/stats`
  - Polling logic (5-second refresh)

- [ ] Add chart visualization (nivo or chart.js)
  - Throughput trend
  - Latency distribution
  - Memory usage

- [ ] Implement benchmark trigger button
  - POST to `/api/internal/brokers/benchmark`
  - Show progress spinner
  - Display results in modal

- [ ] Add routing to navigation
  - Menu item: Operations → Broker Comparison
  - Route: `/operations/broker-comparison`

### Sprint 5.4 Phase 3: Validation & Reporting

**Week 2.5 tasks**:

- [ ] Run full benchmark cycle
  - Execute `scripts/benchmark-pulsar-vs-rabbitmq.mjs` via API
  - Capture baseline metrics

- [ ] Generate comparison report
  - PDF/HTML export with findings
  - Performance deltas
  - Recommendation for Phase 4

- [ ] Document findings in ADR
  - Update [ADR-EVENT-STREAMING.md](ADR-EVENT-STREAMING.md)
  - Add Pulsar consolidation section

---

## 8. Kafka's Timeline

### Current Plan (Phase 3.5)

```text
Now (Feb 2026)
    ↓
    Keep Kafka running
    Publish audit trail to Kafka
    RabbitMQ → real-time
    Kafka → durable log
    ↓
Sprint 5.4: Benchmark Pulsar
    ↓
    IF Pulsar ≥ 30% faster AND reliable:
        ↓
    Phase 4 Planning (March 2026)
        ↓
        Migrate Kafka consumers → Pulsar
        Migrate persistent topics → Pulsar
        Keep audit retention (90 days on new platform)
        ↓
    Phase 4 Execution (April-June 2026)
        ↓
        Deprecate Kafka
        Run Pulsar in production
        Georeplication to TACC
```

### Why Keep Kafka Now?

1. **Zero disruption** - Already running, proven reliable
2. **Baseline comparison** - Compare against known good broker
3. **Rollback option** - If Pulsar issues found, keep Kafka as fallback
4. **Compliance** - Maintain audit trail during evaluation

### Post-Phase-4 Options

1. **Complete replacement** - Remove Kafka entirely, Pulsar handles all
2. **Hybrid approach** - Keep Kafka for cold archive, Pulsar for hot events
3. **Tiered storage** - Pulsar hot tier (SSD), Kafka S3 cold tier

---

## 9. Success Metrics

### Evaluation Criteria

| Metric               | Target        | Threshold   | Phase 4 Decision |
| -------------------- | ------------- | ----------- | ---------------- |
| Throughput           | +30%          | ≥25% faster | Go if met        |
| Latency              | -25%          | ≥15% faster | Go if met        |
| Memory               | -20%          | ≥10% lower  | Nice to have     |
| Reliability          | 99.99%        | ≥99%        | Go if met        |
| Setup Time           | <30min        | <1h         | Go               |
| Operational Overhead | 50% reduction | ≥40%        | Go               |

### Decision Gates

- **Green**: All throughput/latency targets met → Proceed to Phase 4
- **Yellow**: Some targets missed but acceptable → Additional analysis required
- **Red**: Major targets missed → Stay with dual-broker approach, explore alternatives

---

## 10. References & Links

- [ADR-EVENT-STREAMING.md](ADR-EVENT-STREAMING.md) - Current architecture decision
- [EVENT-STREAMING-TOPOLOGY.md](EVENT-STREAMING-TOPOLOGY.md) - Infrastructure setup
- [documentation/pulsar/](../pulsar/) - Pulsar quickstart & setup guides
- [scripts/benchmark-pulsar-vs-rabbitmq.mjs](../../scripts/benchmark-pulsar-vs-rabbitmq.mjs) - Benchmarking harness
- [docker-compose.events.yml](../../docker-compose.events.yml) - RabbitMQ + Kafka + Pulsar

---

**Created**: 2026-02-15  
**Status**: Planning Phase  
**Next Step**: Implement metrics collection API endpoints (Sprint 5.4 Week 1)
