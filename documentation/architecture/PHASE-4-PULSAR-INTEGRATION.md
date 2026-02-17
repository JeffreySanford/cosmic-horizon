# Phase 4 Pulsar Integration Plan

**Status**: Planning Draft (Week 2 package)  
**Date**: 2026-02-17  
**Scope**: Controlled migration pathway from dual-broker operations to Pulsar-inclusive architecture

## Objective

Define a low-risk Phase 4 plan for Pulsar integration covering:

- namespaces/topics design
- consumer migration sequence
- resource allocation (2-3 sprints)
- risk and failover strategy

## Baseline and Constraints

- Current baseline remains RabbitMQ + Kafka in production roles.
- Pulsar is in evaluation mode; consolidation is conditional on performance/reliability gates.
- Compliance/audit continuity is mandatory throughout migration.

## Target Namespaces and Topics

### Namespaces

- `public/cosmic-ai`
- `public/observatories`
- `public/metrics`

### Initial Topic Mapping

| Current Stream | Target Pulsar Topic | Migration Phase |
|---|---|---|
| `job-lifecycle` (Kafka) | `persistent://public/cosmic-ai/job-status-changed` | Phase 2 |
| `job-metrics` (Kafka) | `persistent://public/metrics/job-performance-metrics` | Phase 2 |
| `notifications` (RabbitMQ/Kafka) | `persistent://public/cosmic-ai/job-completed` (or dedicated notification topic) | Phase 1 |
| `audit-trail` (Kafka) | dedicated `audit-trail` Pulsar topic (to be added) | Phase 3 (last) |
| broker/system metrics | `persistent://public/metrics/broker-metrics` | Phase 1 |

## Migration Plan (2-3 Sprints)

### Sprint P4.1: Shadow Read/Write + Contract Parity

- Enable dual-publish for selected non-critical streams into Pulsar.
- Keep source-of-truth consumption on existing brokers.
- Validate schema parity, ordering assumptions, and replay semantics.
- Exit criteria:
  - no contract drift
  - no data-loss in mirrored streams

### Sprint P4.2: Consumer Cutover for Non-Critical Streams

- Migrate selected consumers (metrics/notifications) to Pulsar.
- Keep rollback switch to Kafka/RabbitMQ consumers.
- Run load and failover drills.
- Exit criteria:
  - SLO parity (latency/error rate)
  - stable rollback behavior

### Sprint P4.3: Critical Stream Decision and Controlled Cutover

- Evaluate audit/lifecycle stream migration based on gates.
- If gates pass, perform staged cutover with canary consumers.
- If gates fail, retain dual-broker baseline and continue optimization.
- Exit criteria:
  - compliance sign-off
  - replay/audit parity demonstrated

## Resource Allocation (2-3 Sprints)

### Team Composition

- 1 Platform Lead (architecture/decision authority)
- 2 Backend Engineers (publisher/consumer migration and contract enforcement)
- 1 SRE/DevOps Engineer (cluster ops, observability, failover drills)
- 1 QA/Performance Engineer (benchmarking and regression gates)

### Effort Estimate

- Sprint P4.1: 2 weeks
- Sprint P4.2: 2 weeks
- Sprint P4.3: 2 weeks (conditional)

## Risk Assessment

### Operational Complexity Risk

- Risk: temporary increase in complexity during dual-write/dual-read period.
- Mitigation: strict ownership per stream, explicit rollback switches, runbook-first rollout.

### Reliability Risk

- Risk: message duplication/loss under connector or consumer failover.
- Mitigation: idempotency keys, dead-letter policies, replay verification checks.

### Compliance Risk

- Risk: audit retention/replay regression during migration.
- Mitigation: keep Kafka audit path until Pulsar parity is proven and approved.

### Performance Risk

- Risk: Pulsar underperforms in current topology/workload profile.
- Mitigation: do not force consolidation; gate promotion by measured SLO outcomes.

## Failover and Rollback Strategy

- Per-stream feature flags for consumer routing.
- Dual-publish remains available until confidence threshold is met.
- On incident:
  - revert consumers to existing broker path
  - retain event continuity via durable baseline topics
  - replay missed windows from source-of-truth stream

## Go/No-Go Decision Inputs

- Latest benchmark artifacts in `test-output/benchmark-results/`
- SLO comparison for migrated consumers
- Incident/rollback drill outcomes
- Compliance/audit parity checklist

## Deliverables

- Updated runbooks for migration and rollback
- Stream-by-stream readiness checklist
- Final consolidation recommendation (go/no-go)

---

_Independent portal using public VLASS data; not affiliated with VLA/NRAO._
