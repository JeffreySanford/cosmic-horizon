# CosmicHorizons Product Roadmap: Priorities 5-7

**Updated:** February 12, 2026  
**Status:** In Planning  
**Timeline:** Q2-Q3 2026

---

## Executive Summary

After completing Priority 1-4 with a production-ready test infrastructure (865 tests, 100% pass rate), Cosmic Horizons is positioned to tackle distributed systems integration and real-time visualization. This roadmap defines Priorities 5-7, focusing on event-driven architecture, real-time data pipelines, and enterprise-grade monitoring.

### Key Strategic Decisions

- **Event-First Architecture**: Shift from request-response to event-driven (RabbitMQ/Kafka)
- **Streaming Analytics**: Real-time metrics and anomaly detection
- **GPU-Accelerated Visualization**: Leverage existing NVIDIA capabilities
- **Auditability by Design**: Every event is traced, immutable, and queryable
- **Scaled Concurrency**: Support 100+ simultaneous jobs on ngVLA

---

## Priority 5: Event Streaming Infrastructure

**Target Completion:** Q2 2026 (Months 3-4)  
**Effort:** 370 story points  
**Team:** 3-4 engineers  
**Risk Level:** Medium

### Overview

Enable reliable, scalable event processing for job orchestration, result callbacks, and real-time monitoring using industry-standard message brokers.

### Sprint Breakdown

#### Sprint 5.1: RabbitMQ Foundation (3 weeks)

**Objectives:**

- Set up RabbitMQ cluster with 3 nodes
- Define event schema and routing rules
- Implement NestJS RabbitMQ integration
- Create Dead Letter Queue (DLQ) handlers

**Deliverables:**

- Event message broker operational
- 45 tests for RabbitMQ integration
- DLQ replay mechanism
- Monitoring dashboard

**Tests to Create:**

```
rabbitmq-integration.service.spec.ts (35 tests)
├─ Connection management (5 tests)
├─ Message publishing (8 tests)
├─ Consumer groups (7 tests)  
├─ Error handling & retries (10 tests)
└─ Dead letter queue (5 tests)

event-schema.validation.spec.ts (15 tests)
├─ Event validation (8 tests)
├─ Schema versioning (5 tests)
└─ Backward compatibility (2 tests)
```

**Key Components:**

```typescript
// Event Types
interface JobSubmittedEvent {
  event_id: string;
  timestamp: Date;
  job_id: string;
  user_id: string;
  agent: AgentType;
  dataset_id: string;
  params: Record<string, any>;
}

interface JobStatusChangedEvent {
  event_id: string;
  timestamp: Date;
  job_id: string;
  old_status: JobStatus;
  new_status: JobStatus;
  progress?: number;
  metrics?: PerformanceMetrics;
}

interface JobCompletedEvent {
  event_id: string;
  timestamp: Date;
  job_id: string;
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  execution_duration_seconds: number;
  result_data: Record<string, any>;
  error_message?: string;
}

// RabbitMQ Configuration
interface RabbitMQConfig {
  urls: string[];                    // Cluster nodes
  reconnectTime: number;             // ms between reconnects
  heartbeat: number;                 // connection heartbeat
  prefetch: number;                  // messages per consumer
  dlq_enabled: boolean;
  durable_queues: boolean;
  durable_exchanges: boolean;
}
```

#### Sprint 5.2: Kafka Integration (3 weeks)

**Objectives:**

- Set up Kafka cluster (3 brokers, 1 zookeeper)
- Create Kafka topics with retention policies
- Implement NestJS Kafka integration
- Set up Schema Registry for compatibility

**Deliverables:**

- Kafka cluster operational
- 40 tests for Kafka integration
- Schema versioning system
- Consumer group management

**Tests to Create:**

```
kafka-integration.service.spec.ts (30 tests)
├─ Broker connection (5 tests)
├─ Topic management (6 tests)
├─ Consumer groups (8 tests)
├─ Offset tracking (7 tests)
└─ Rebalancing (4 tests)

schema-registry.spec.ts (12 tests)
├─ Schema registration (5 tests)
├─ Compatibility checking (4 tests)
└─ Version evolution (3 tests)
```

#### Sprint 5.3: Job Orchestration Events (2 weeks)

**Objectives:**

- Connect job submission to event publishing
- Implement job status change events
- Create result notification system
- Build event acknowledgment system

**Deliverables:**

- Job submission events flowing through broker
- 50 tests for orchestration events
- Event replay capability
- Status synchronization

**Test Coverage:**

```
job-orchestration-events.spec.ts (50 tests)
├─ Job submission event emission (8 tests)
├─ Status change events (10 tests)
├─ Result callbacks (8 tests)
├─ Error events & DLQ (12 tests)
├─ Event ordering & idempotency (8 tests)
└─ Event replay & recovery (4 tests)
```

**Expected Metrics:**

- Event latency: < 100ms P99
- Throughput: > 1000 events/second
- Broker availability: > 99.99%
- Test coverage: 85%+

---

## Priority 6: Real-Time Visualization & Monitoring

**Target Completion:** Q2-Q3 2026 (Months 4-6)  
**Effort:** 420 story points  
**Team:** 4-5 engineers  
**Risk Level:** Medium-High

### Overview

Deliver enterprise-grade dashboards for real-time job monitoring, performance analytics, and system observability using streaming data from Priority 5 infrastructure.

### Sprint Breakdown

#### Sprint 6.1: WebSocket Infrastructure (3 weeks)

**Objectives:**

- Set up Socket.IO server for real-time connections
- Implement connection pooling and heartbeat
- Create broadcast channels for job updates
- Build reconnection logic

**Deliverables:**

- WebSocket server handling 500+ concurrent connections
- 55 tests for WebSocket infrastructure
- Automatic reconnection on client side
- Connection state management

**Tests to Create:**

```
websocket.server.spec.ts (40 tests)
├─ Client connection (6 tests)
├─ Broadcast channels (8 tests)
├─ Disconnection handling (6 tests)
├─ Message ordering (5 tests)
├─ Error recovery (7 tests)
└─ Load testing (2 tests with 100+ connections)

websocket.client.spec.ts (15 tests)
├─ Connection establishment (3 tests)
├─ Event subscription (4 tests)
├─ Reconnection logic (5 tests)
└─ State synchronization (3 tests)
```

#### Sprint 6.2: Real-Time Dashboards (4 weeks)

**Objectives:**

- Build Angular/React dashboard components
- Implement real-time job status visualization
- Create performance metrics charts
- Build GPU utilization heatmaps

**Deliverables:**

- Production-ready dashboard SPA
- 60 tests for dashboard components
- Real-time update capability
- 60 FPS rendering with 1000+ data points

**Components to Build:**

```
Dashboard Components:
├─ JobsMonitoring
│  ├─ ActiveJobsList (real-time updates)
│  ├─ JobProgressBars
│  ├─ StatusTimeline
│  └─ GPUUtilizationMeters
├─ PerformanceMetrics
│  ├─ ExecutionTimeChart
│  ├─ ThroughputGauge
│  ├─ ErrorRatePanel
│  └─ QueueLengthGraph
└─ SystemHealth
   ├─ ClusterStatusMap
   ├─ ResourceUtilization
   ├─ NetworkLatency
   └─ CacheHitRateMetrics
```

**Dashboard Mockup:**

```
┌─────────────────────────────────────────────────────────────┐
│  Cosmic Horizons Control Plane                           🔄  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Active Jobs: 47    ·  Completed (24h): 312  ·  Failed: 3   │
│                                                               │
│  ┌──────────────────────────┐  ┌──────────────────────────┐  │
│  │ GPU Utilization (4 GPUs) │  │ Job Queue Status         │  │
│  │ ████████░░░░░  87%       │  │ Queued: 12               │  │
│  │ ████████████░░  92%       │  │ Queuing: 14              │  │
│  │ ███████░░░░░░░  71%       │  │ Running: 47              │  │
│  │ ███████░░░░░░░  74%       │  │ Completed: 312           │  │
│  └──────────────────────────┘  └──────────────────────────┘  │
│                                                               │
│  Recent Jobs:                                                 │
│  ┌─────────────────────┬─────────┬──────────┬────────────┐  │
│  │ Job ID              │ Agent   │ Progress │ Time EST   │  │
│  ├─────────────────────┼─────────┼──────────┼────────────┤  │
│  │ job-001             │AlphaCal │ █████░░░ │ 2h 15m     │  │
│  │ job-002             │ImgReco  │ ████████░│ 45m remaining│ │
│  │ job-003             │Anomaly  │ █░░░░░░░ │ 3h 30m     │  │
│  └─────────────────────┴─────────┴──────────┴────────────┘  │
│                                                               │
│  System Health: ✅ Normal  |  Cluster: ✅ 99.97% uptime      │
└─────────────────────────────────────────────────────────────┘
```

#### Sprint 6.3: Performance Analytics (3 weeks)

**Objectives:**

- Implement time-series data collection
- Build analytics queries and aggregations
- Create historical performance charts
- Set up anomaly detection

**Deliverables:**

- Time-series database (InfluxDB/Prometheus)
- 55 tests for analytics pipeline
- Historical data queries
- Anomaly alerts

**Tests to Create:**

```
analytics.pipeline.spec.ts (35 tests)
├─ Metric collection (8 tests)
├─ Data aggregation (10 tests)
├─ Query execution (10 tests)
└─ Export formats (7 tests)

anomaly-detection.spec.ts (20 tests)
├─ Threshold-based detection (7 tests)
├─ ML-based anomalies (8 tests)
└─ Alert generation (5 tests)
```

#### Sprint 6.4: Aladin Integration (2 weeks)

**Objectives:**

- Integrate Aladin sky viewer for visualization
- Display source positions and detections
- Show observation coverage maps
- Create interactive annotations

**Deliverables:**

- Aladin component integrated
- 30 tests for Aladin integration
- Interactive sky map
- Source catalog overlay

---

## Priority 7: Advanced Features & Optimization

**Target Completion:** Q3 2026 (Months 6-8)  
**Effort:** 350 story points  
**Team:** 3-4 engineers  
**Risk Level:** Low-Medium

### Sprint Breakdown

#### Sprint 7.1: Workflow Orchestration (3 weeks)

**Objectives:**

- Build visual workflow builder
- Implement DAG execution engine
- Support chained job submissions
- Create workflow versioning

**Deliverables:**

- Workflow editor UI
- 50 tests for DAG engine
- Workflow scheduling
- Rollback capabilities

#### Sprint 7.2: Advanced Caching (2 weeks)

**Objectives:**

- Implement multi-tier caching (L1: Redis, L2: S3)
- Add cache invalidation strategies
- Build cache warming logic
- Create cache analytics

**Deliverables:**

- Multi-tier cache system
- 40 tests for caching layer
- Cache hit rate improvements
- Performance gains: 40-60% query reduction

#### Sprint 7.3: GPU Optimization (3 weeks)

**Objectives:**

- Profile GPU utilization patterns
- Implement dynamic batch sizing
- Add mixed-precision inference
- Optimize memory allocation

**Deliverables:**

- GPU utilization improved to 95%+
- 35 tests for GPU optimization
- Performance gains: 25-35% throughput increase
- Memory efficiency: 35-45% reduction

#### Sprint 7.4: Scale Testing & Hardening (2 weeks)

**Objectives:**

- Conduct load testing (100+ concurrent jobs)
- Identify performance bottlenecks
- Stress test broker failover
- Validate disaster recovery

**Deliverables:**

- 45 tests for scale scenarios
- Benchmark reports
- Optimization recommendations
- Production readiness sign-off

---

## Resource Allocation

### Team Composition

```
Priority 5 (Event Infrastructure):
├─ Lead Architect: 1 (full-time)
├─ Backend Engineers: 2 (full-time)
└─ DevOps Engineer: 0.5 (part-time)

Priority 6 (Visualization):
├─ Frontend Lead: 1 (full-time)
├─ Frontend Engineers: 2 (full-time)
├─ Full-Stack Engineer: 1 (full-time)
└─ DevOps Engineer: 0.5 (part-time)

Priority 7 (Optimization):
├─ Performance Engineer: 1 (full-time)
├─ GPU Specialist: 1 (full-time)
└─ QA Engineer: 1 (full-time)
```

### Budget & Infrastructure

| Component | Cost | Notes |
|-----------|------|-------|
| RabbitMQ Cluster (3 nodes) | $2,400/mo | AWS EC2 instances |
| Kafka Cluster (3 brokers) | $2,400/mo | AWS EC2 instances |
| Time-Series DB (Prometheus) | $600/mo | Managed service |
| Kubernetes Orchestration | $1,200/mo | EKS cluster |
| Development & Staging | $3,000/mo | Full stack replicas |
| **Total Infrastructure** | **$9,600/mo** | |

---

## Dependencies & Risks

### External Dependencies

- AWS service availability (RabbitMQ, Kafka, S3)
- TACC API stability and rate limits
- Third-party library updates (Socket.IO, Angular, React)
- GPU driver compatibility updates

### Known Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Kafka cluster failover | Medium | High | Multi-AZ deployment, chaos engineering |
| Real-time message loss | Low | Critical | Event deduplication, replay capability |
| WebSocket scaling limits | Medium | High | Load testing, horizontal scaling strategy |
| GPU memory exhaustion | Medium | Medium | Dynamic batch sizing, spill to CPU |
| Message broker lag | Medium | Medium | Consumer group tuning, monitoring |

---

## Success Criteria

### Priority 5 (Event Infrastructure)

- ✅ 95+ event tests covering all scenarios
- ✅ Sub-100ms event latency (P99)
- ✅ 99.99% broker availability
- ✅ Successful failover in < 5 seconds
- ✅ 1000+ events/second throughput

### Priority 6 (Real-Time Visualization)

- ✅ 60 FPS dashboard rendering
- ✅ < 500ms WebSocket updates
- ✅ 500+ concurrent user connections
- ✅ Query response time < 2 seconds
- ✅ 95%+ dashboard component test coverage

### Priority 7 (Advanced Features & Optimization)

- ✅ Support 500+ GPU-hours per month
- ✅ Cache hit rate > 75%
- ✅ GPU utilization > 90%
- ✅ 40%+ performance improvement
- ✅ Successful 1000-job stress test

---

## Alignment with Strategic Goals

### Supporting CosmicAI Initiative

- **AlphaCal Integration**: Event-driven calibration workflows
- **Radio Image Reconstruction**: Streaming pipeline for GPU processing
- **Anomaly Detection**: Real-time anomaly notifications
- **ML Agent Feedback**: Dashboard for agent monitoring & manual intervention

### Enabling Next-Generation Science

- **High-Throughput Processing**: Support ngVLA 7.5-8 GB/s data rate
- **Real-Time Collaboration**: Live job monitoring for team coordination
- **Reproducibility**: Full event history for every analysis
- **Scalability**: Support 100+ concurrent jobs

---

## Timeline Summary

```
Q2 2026 (Apr-May):
├─ Priority 5.1: RabbitMQ Foundation (Weeks 1-3)
├─ Priority 5.2: Kafka Integration (Weeks 4-6)
├─ Priority 5.3: Job Orchestration Events (Weeks 7-8)
├─ Priority 6.1: WebSocket Infrastructure (Weeks 6-8)
└─ Code Review & Testing (Ongoing)

Q2-Q3 2026 (Jun):
├─ Priority 6.2: Real-Time Dashboards (Weeks 9-12)
├─ Priority 6.3: Performance Analytics (Weeks 10-12)
├─ Priority 6.4: Aladin Integration (Weeks 13-14)
└─ Integration Testing & Performance Tuning

Q3 2026 (Jul-Aug):
├─ Priority 7.1: Workflow Orchestration (Weeks 15-17)
├─ Priority 7.2: Advanced Caching (Weeks 15-16)
├─ Priority 7.3: GPU Optimization (Weeks 17-19)
├─ Priority 7.4: Scale Testing & Hardening (Weeks 19-20)
└─ Production Readiness Review
```

---

## Next Steps

1. **Approve Resource Allocation** - Finalize team composition
2. **Procure Infrastructure** - Set up AWS resources and clusters
3. **Define Interface Contracts** - Event schemas and API agreements
4. **Scheduling** - Book planning sessions with stakeholders
5. **Risk Mitigation** - Develop contingency plans for identified risks

---

## Additional Resources

- [Audit Strategy Documentation](./AUDIT-STRATEGY-SITEWIDE.md)
- [Priority 4A Test Coverage Report](../TEST-COVERAGE-PRIORITY-4A-COMPLETE.md)
- [TACC Integration Architecture](./ARCHITECTURE.md)
- [Performance Benchmarking Guidelines](../quality/PERFORMANCE-BENCHMARKS.md)
