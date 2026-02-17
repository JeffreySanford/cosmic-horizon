# ngVLA Tri-Broker Reference Architecture (RabbitMQ + Kafka + Pulsar)

**Status**: Reference Design (non-normative)  
**Date**: 2026-02-17  
**Audience**: Platform architects, operations leads, data systems engineering

## Purpose

Describe a practical way a large scientific agency (ngVLA-scale) could run RabbitMQ, Kafka, and Pulsar together, with clear role boundaries and low overlap.

## Important Scope Note

This document is a proposed architecture pattern. It is not an official ngVLA requirement and does not claim formal adoption.

## Why Use All Three

One broker rarely excels at every requirement in exascale science operations:

- **RabbitMQ**: low-latency control/task routing and operational fanout.
- **Kafka**: durable, replayable, high-throughput event log for audit and analytics.
- **Pulsar**: multi-tenant/hybrid queue+stream workflows and cross-site distribution.

## Role Partitioning

| Broker | Primary Responsibility | Typical Workload Type |
|---|---|---|
| RabbitMQ | Observatory control-plane messaging | Commands, heartbeats, operator actions, urgent alerts |
| Kafka | Durable science-event backbone | Lifecycle events, telemetry, audit trail, replay pipelines |
| Pulsar | Hybrid and federated workflows | Multi-tenant event products, cross-site replication, mixed queue/stream consumers |

## Reference Data Flow

1. **Control-plane** events enter RabbitMQ for fast routing and operator/system reactions.
2. High-value event envelopes are mirrored into Kafka for durability and replay.
3. Selected streams are replicated/bridged into Pulsar namespaces for shared science-team and partner workflows.
4. AI/analytics consumers read from Kafka/Pulsar and publish decisions or recommendations back to RabbitMQ/Kafka as needed.

## Example Domain Mapping (ngVLA-style)

- **RabbitMQ**
  - antenna/subarray control notifications
  - safety/health heartbeats and operational ack queues
  - low-latency workflow triggers
- **Kafka**
  - job lifecycle (`submitted`, `running`, `failed`, `completed`)
  - processing metrics and audit events with retention/replay
  - downstream archival and analytics ingestion
- **Pulsar**
  - commensal observing event buses
  - cross-team namespaces and subscription isolation
  - cross-region/federated data movement patterns

## Platform Control Points

- **Schema governance**: shared event contracts with compatibility checks.
- **Idempotency**: deterministic event keys and consumer dedupe policy.
- **Backpressure**: bounded retry, DLQ policy, and consumer lag SLOs.
- **Observability**: per-broker SLOs for latency, throughput, lag, and error rates.

## Failure and Risk Strategy

- Avoid broker role ambiguity; keep ownership explicit.
- Keep Kafka as compliance baseline during Pulsar evaluation/consolidation phases.
- Use bridge/connector patterns with clear replay boundaries; do not create cyclical event loops.

## Adoption Sequence

1. Stabilize RabbitMQ + Kafka split with clear contract ownership.
2. Introduce Pulsar for bounded hybrid use cases (not full replacement on day one).
3. Measure operational overhead, reliability, and throughput/latency deltas.
4. Decide on long-term dual-broker vs consolidation from measured results.

## Related Internal Docs

- `documentation/architecture/ADR-EVENT-STREAMING.md`
- `documentation/architecture/BROKER-COMPARISON-STRATEGY.md`
- `documentation/architecture/PULSAR-EVALUATION-RESULTS.md`

---

_Independent portal using public VLASS data; not affiliated with VLA/NRAO._
