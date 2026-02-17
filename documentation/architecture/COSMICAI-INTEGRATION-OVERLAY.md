# CosmicAI Integration Overlay for Tri-Broker Operations

**Status**: Integration Blueprint (no direct CosmicAI dependency required)  
**Date**: 2026-02-17  
**Audience**: AI platform, backend, operations, and product teams

## Purpose

Define where CosmicAI-style agent capabilities fit in a RabbitMQ + Kafka + Pulsar architecture when direct CosmicAI platform access is not yet available.

## Operating Assumption

Cosmic Horizons can be prepared as an **AI control plane** now by enforcing stable event contracts and deterministic orchestration points, then docking CosmicAI services later.

## Integration Model

| Layer | Broker Interface | CosmicAI Role |
|---|---|---|
| Control-plane orchestration | RabbitMQ | Trigger/ack loops for agent job starts, retries, and escalation actions |
| Durable scientific event stream | Kafka | Agent inference inputs, model telemetry, reproducible replay/training slices |
| Multi-tenant/federated pipelines | Pulsar | Cross-team agent products, tenant isolation, distributed subscription models |

## Concrete Agent Docking Points

### 1. AlphaCal-like calibration agents

- **Input**: calibration-related lifecycle and quality events (Kafka)
- **Output**: calibration recommendations, confidence, and anomaly markers (Kafka/Pulsar)
- **Operational trigger**: bounded control messages for re-run/rollback (RabbitMQ)

### 2. Image reconstruction agents

- **Input**: dataset readiness + processing state events (Kafka)
- **Output**: reconstruction stage metrics and SRDP metadata (Kafka/Pulsar)
- **Control feedback**: orchestration directives for resource tuning (RabbitMQ)

### 3. Anomaly detection agents

- **Input**: telemetry + science-event windows (Kafka replay or live)
- **Output**: ranked anomaly events, confidence bands, review-required flags (Kafka/Pulsar)
- **Escalation path**: operator notification and queue priority bump (RabbitMQ)

## Minimal Contract Set Required Before Docking

- Canonical event envelope: `event_id`, `correlation_id`, `timestamp`, `source`, `schema_version`, `payload`.
- Idempotent producer keys and consumer dedupe strategy.
- Explicit model telemetry events:
  - inference latency
  - model/version id
  - confidence and uncertainty
  - decision provenance pointer

## Trust and Audit Requirements

- Keep all high-impact AI decisions replayable from Kafka.
- Record explainability artifacts as linked metadata (not only logs).
- Preserve human-in-the-loop override events in audit streams.

## Suggested Rollout (No External Dependency Blocker)

1. **Phase A**: emit placeholder agent events from current services using production schemas.
2. **Phase B**: attach internal/stand-in inference workers to existing topics.
3. **Phase C**: replace stand-ins with CosmicAI endpoints when available, keeping schemas stable.
4. **Phase D**: enforce SLO gates (latency, confidence thresholds, fallback behavior).

## What This Enables Immediately

- Documentation-aligned AI integration points without hard-coupling to external availability.
- Deterministic pipeline behavior under test and replay.
- Faster eventual CosmicAI onboarding with low refactor risk.

## Related Internal Docs

- `documentation/architecture/NGVLA-TRI-BROKER-REFERENCE-ARCHITECTURE.md`
- `documentation/architecture/ADR-EVENT-STREAMING.md`
- `documentation/architecture/BROKER-COMPARISON-STRATEGY.md`
- `documentation/product/PRODUCT-CHARTER.md`

---

_Independent portal using public VLASS data; not affiliated with VLA/NRAO._
