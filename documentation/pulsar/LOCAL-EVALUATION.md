# Pulsar Integration: Local Evaluation & Performance Testing

## Overview

This document describes how to set up Apache Pulsar locally alongside your existing RabbitMQ/Kafka infrastructure for side-by-side performance evaluation. You'll get real-world benchmarks to validate the improvements Pulsar offers.

**Key Facts:**

- Apache Pulsar is **100% open-source**, fully runnable on localhost
- Designed for on-premise deployment (not cloud-only)
- Can replicate the exact behavior of your current dual-broker architecture in a single platform
- Minimal resource requirements for local testing

---

## Why Pulsar Locally?

### Cost Profile (Local Dev)

| Component              | Cost (Annual)                    |
| ---------------------- | -------------------------------- |
| 3-node Pulsar (Docker) | **$0** (runs on your machine)    |
| RabbitMQ + Kafka stack | **$0** (also local Docker)       |
| Cloud-hosted Pulsar    | ~$5k-15k/month (if needed later) |

### Development Workflow

```text
Your Laptop:
├── RabbitMQ (current: testing existing throughput)
├── Kafka (current: testing existing retention)
├── Pulsar (NEW: testing consolidated approach)
└── Benchmark harness (measures all three)
```

This lets you:

1. **Compare apples-to-apples** with identical payloads
2. **Verify no regressions** before Phase 4 integration
3. **Profile resource usage** on your actual hardware
4. **Generate evidence** for architecture ADR updates

---

## References

- **Quickstart Guide**: [QUICKSTART.md](QUICKSTART.md)
- **Full Index & Setup Checklist**: [README.md](README.md)
- **Original Integration Docs**: [../integration/PULSAR-LOCAL-EVALUATION.md](../integration/PULSAR-LOCAL-EVALUATION.md)
- [Apache Pulsar Documentation](https://pulsar.apache.org/docs/concepts-architecture/)
- [Pulsar vs Kafka Comparison](https://pulsar.apache.org/docs/migration-kafka/)
- [StreamNative Cloud (free tier)](https://www.streamnative.io/cloud)
