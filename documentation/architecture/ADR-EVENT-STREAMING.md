# ADR: Event Streaming Infrastructure for Phase 3

**Date**: 2026-02-14  
**Status**: ACCEPTED  
**Context**: Phase 3 requires event-driven architecture to support 1000+ events/second at <100ms P99 latency with 500+ concurrent connections.

## Problem

Cosmic Horizons needs to evolve from request-response patterns to event-driven workflows to support:

- Job state transitions (autonomous AI agents at ngVLA scale)
- Real-time dashboards and notifications
- Multi-user coordination without polling
- Audit trail and replay capability
- Failure recovery and idempotency

## Decision

Use a **dual-broker event architecture**:

### Primary Broker: RabbitMQ (3-node cluster)

- **Role**: Low-latency task queues and immediate notifications
- **Topics**: Job state changes, errors, notifications
- **TTL**: 15-30 seconds (ephemeral, not replayed)
- **Guarantees**: At-least-once delivery with acknowledgments
- **Dead Letter Queue**: Explicit error handling for failed messages

### Secondary Broker: Kafka (3-broker cluster + Zookeeper)

- **Role**: Event log with replay capability and long-term retention
- **Topics**: Job lifecycle, performance metrics, audit trails
- **Retention**: 30 days (configurable per topic)
- **Guarantees**: At-least-once with offset management
- **Schema Registry**: Confluent Schema Registry for compatibility

### Transport Layer: NestJS Microservices Pattern

- RabbitMQ ClientModule for task queue transport
- Kafka NestJS integration for event streaming
- Socket.IO for WebSocket real-time updates
- Unified event model (EventBase interface)

## Event Categories

### Category 1: Ephemeral Events (RabbitMQ only)

- Job submission acknowledgments
- Immediate status changes (RUNNING, COMPLETED)
- WebSocket broadcast notifications
- Failure alerts

### Category 2: Durable Events (Kafka + audit trail)

- Job lifecycle (QUEUED → RUNNING → COMPLETED/FAILED)
- Performance metrics (execution_time, resource_usage, gpu_utilization)
- Error context (timestamp, retry_count, stack_trace)
- User actions (triggered by, approved by, timestamp)

### Category 3: Real-Time Dashboards (WebSocket via RabbitMQ broadcast)

- Live job status updates
- GPU utilization heatmaps
- Query response times
- Anomaly alerts

## Topology

```text
┌─────────────────────────────────────────────────────────────┐
│ API Application (NestJS)                                    │
│  ├─ JobsController (entry point)                            │
│  ├─ EventService (publish to both brokers)                  │
│  ├─ NotificationService (broadcast via WebSocket)           │
│  └─ AuditService (read from Kafka for compliance)           │
└─────────────────────────────────────────────────────────────┘
           │                           │
           ▼                           ▼
    ┌─────────────────┐        ┌──────────────────┐
    │  RabbitMQ       │        │  Kafka (+ ZK)    │
    │  3-node cluster │        │  3-broker cluster│
    │                 │        │                  │
    │ Exchanges:      │        │ Topics:          │
    │ • job.events    │        │ • job-lifecycle  │
    │ • notifications │        │ • job-metrics    │
    │ • dlq           │        │ • audit-trail    │
    │                 │        │                  │
    │ Queues:         │        │ Schema Registry: │
    │ • job-tasks     │        │ • Avro schemas   │
    │ • websocket-bc  │        │ • versioning     │
    └─────────────────┘        └──────────────────┘
           │                           │
           └─────────────┬─────────────┘
                         ▼
           ┌─────────────────────────────┐
           │ Real-Time Dashboard (UI)    │
           │ • Socket.IO client          │
           │ • Live job status           │
           │ • GPU heatmaps              │
           │ • Alerts & notifications    │
           └─────────────────────────────┘
           
           ┌─────────────────────────────┐
           │ Audit & Analytics (Kafka)   │
           │ • Event replay              │
           │ • Historical queries        │
           │ • Compliance reporting      │
           └─────────────────────────────┘
```

## Implementation Phases

### Sprint 5.1: RabbitMQ Foundation (3 weeks)

- Docker Compose setup for 3-node cluster
- NestJS RabbitMQ ClientModule integration
- Event schema definition (TypeScript interfaces)
- DLQ handling (retry with exponential backoff)
- 45+ tests (latency, throughput, delivery guarantees)

### Sprint 5.2: Kafka Integration (3 weeks)

- Docker Compose for 3-broker Kafka + Zookeeper
- Confluent Schema Registry setup
- NestJS Kafka integration
- Topic partitioning strategy (job_id as key)
- 40+ tests (retention, offset management, replay)

### Sprint 5.3: Job Event Publishing (2 weeks)

- Job submission triggers RabbitMQ + Kafka publication
- Status changes published to both brokers
- Notification service broadcasts via WebSocket
- Event acknowledgment and idempotency
- 50+ tests (event flow, ordering, replay)

## Trade-offs

| Decision | Rationale | Downside |
|----------|-----------|----------|
| RabbitMQ + Kafka | Ephemeral + durable events | Additional operational complexity |
| 3-node RabbitMQ | Quorum queues + HA | Higher memory/CPU overhead |
| Schema Registry | Contract enforcement | Dependency on external service |
| Offset-based replay | Fault recovery | Storage cost (30-day retention) |
| Socket.IO WebSocket | Real-time UX | Limits horizontal scaling (affinity required) |

## Alternative Considered

1. **Kafka-only**: Would work, but ephemeral events add latency/storage cost
2. **RabbitMQ-only**: Loses audit trail and replay capability for compliance
3. **Redis Streams + Kafka**: Too many brokers to maintain
4. **gRPC event streaming**: Less ecosystem support in Node.js

## Success Criteria (Sprint 5)

- [ ] RabbitMQ 3-node cluster running in Docker Compose
- [ ] Kafka 3-broker cluster + Schema Registry running
- [ ] NestJS EventService publishing to both brokers
- [ ] 45+ RabbitMQ tests passing, latency < 100ms P99
- [ ] 40+ Kafka tests passing, throughput > 1000 events/sec
- [ ] 50+ job event tests, full lifecycle coverage
- [ ] Dead Letter Queue handling with retry strategy
- [ ] Event idempotency validation (no duplicate processing)
- [ ] Audit trail queryable from Kafka offsets
- [ ] WebSocket broadcasting working end-to-end

## Future Considerations

- Multi-region replication (Kafka MirrorMaker)
- Schema evolution (backward/forward compatibility)
- Metrics collection (Prometheus for broker health)
- Cost optimization (autoscaling brokers based on throughput)
- Integration with CosmicAI agent lifecycle events

## Phase 3.5 Addendum (2026-02-17): Pulsar Consolidation Pathway

### Benchmark Findings Summary

- Reference benchmark artifact: `test-output/benchmark-results/benchmark-2026-02-17T16-30-44-909Z.json`
- Findings report: `documentation/architecture/PULSAR-EVALUATION-RESULTS.md`
- Current local standalone result does **not** support immediate consolidation:
  - Publish throughput delta (Pulsar vs RabbitMQ): negative
  - Consume throughput delta (Pulsar vs RabbitMQ): negative
  - Memory delta signal: inconclusive for decision-grade comparison

### Consolidation Decision (Current)

- Keep dual-broker architecture (RabbitMQ + Kafka) as production baseline.
- Continue Pulsar in evaluation mode only until go/no-go gates pass on decision-grade runs.

### Go/No-Go Gates for Phase 4 Promotion

- Throughput gate: Pulsar meets or exceeds target uplift under multi-trial, production-like topology.
- Latency gate: Pulsar P95/P99 latency is not regressed against baseline for critical streams.
- Reliability gate: no unacceptable message loss/duplication across failover and replay drills.
- Operations gate: measurable reduction in operational overhead without compliance regression.

### Migration Guardrails

- No cutover until replay parity and audit retention parity are demonstrated.
- Maintain Kafka audit-trail path until compliance sign-off.
- Use phased migration: non-critical streams first, critical audit and lifecycle streams last.

---

**Author**: Engineering Team  
**Reviewed**: 2026-02-14  
**Approved**: Pending Sprint 5.1 kickoff
