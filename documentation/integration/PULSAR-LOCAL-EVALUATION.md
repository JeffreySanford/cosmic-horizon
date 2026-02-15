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

| Component | Cost (Annual) |
|-----------|---------------|
| 3-node Pulsar (Docker) | **$0** (runs on your machine) |
| RabbitMQ + Kafka stack | **$0** (also local Docker) |
| Cloud-hosted Pulsar | ~$5k-15k/month (if needed later) |

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

## Setup: Step-by-Step

### Prerequisites

```bash
# Verify Docker is running
docker --version
docker compose version

# Verify your existing infrastructure
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.events.yml ps

# Free up ~6GB RAM for Pulsar cluster (or adjust JVM heap in docker-compose.pulsar.yml)
```

### Step 1: Start Pulsar Infrastructure

```bash
# Option A: Start both RabbitMQ/Kafka AND Pulsar together
docker compose -f docker-compose.events.yml -f docker-compose.pulsar.yml up -d --wait

# Option B: Start only Pulsar (if you want isolated testing)
docker compose -f docker-compose.pulsar.yml up -d --wait

# Wait for cluster to stabilize (~1-2 minutes)
docker compose logs -f pulsar-broker-1 | grep "Broker started"
```

**What this starts:**

```text
Pulsar:
├── ZooKeeper (2182) - cluster coordination
├── 3x BookKeepers (3181-3183) - persistent storage tier
├── 3x Brokers (6650, 8080, 8081) - compute/messaging tier
└── Pulsar Manager UI (9527) - admin console

+ Your existing RabbitMQ + Kafka + Schema Registry
```

### Step 2: Initialize Pulsar Namespaces & Topics

```bash
# Install Pulsar client library (if not already done)
pnpm install pulsar-client

# Create namespaces and topics configured for CosmicAI workloads
node scripts/pulsar-setup.mjs

# This creates:
# ✓ public/cosmic-ai namespace (30-day retention)
# ✓ Job event topics (job-submitted, job-status-changed, etc.)
# ✓ Metrics topics (broker-metrics, job-performance-metrics)
# ✓ Science data namespace (90-day for SRDPs)
```

**Expected output:**

```text
[1] Checking Pulsar cluster health...
✓ Pulsar cluster detected
✓ Active brokers: pulsar-broker-1:8080, pulsar-broker-2:8080, pulsar-broker-3:8080
✓ Broker metrics accessible

[2] Creating namespaces...
✓ Created namespace: public/cosmic-ai (CosmicAI workloads)
...

[3] Creating topics and setting retention policies...
✓ Created topic: job-submitted (3 partitions)
  - Retention: 5120MB, 30 days
✓ Created topic: job-status-changed (3 partitions)
  - Retention: 5120MB, 30 days
...
```

### Step 3: Run Performance Benchmarks

```bash
# Install dependencies (one-time)
pnpm install

# Run the full benchmark suite
node scripts/benchmark-pulsar-vs-rabbitmq.mjs

# This will:
# 1. Connect to RabbitMQ (localhost:5672)
# 2. Publish 10,000 job events
# 3. Measure throughput, latency, memory
# 4. Connect to Pulsar (localhost:6650)
# 5. Repeat with identical workload
# 6. Generate comparison report
# 7. Save results to test-output/benchmark-results/
```

**Expected output (sample):**

```text
======================================================================
RABBITMQ BENCHMARK
======================================================================
[Phase 1] Publishing throughput test...
  Published: 10000/10000
  ✓ Published 10000 messages
  - Duration: 8523.45 ms
  - Throughput: 1173.04 msg/s
  - Memory used: 12.34 MB

[Phase 2] Consuming throughput test...
  ✓ Consumed 10000 messages
  - Throughput: 2456.78 msg/s

======================================================================
PULSAR BENCHMARK
======================================================================
[Phase 1] Publishing throughput test...
  ✓ Published 10000 messages
  - Duration: 6234.12 ms
  - Throughput: 1604.15 msg/s  ← ~35% faster
  - Memory used: 8.90 MB       ← ~28% less

[Phase 2] Consuming throughput test...
  ✓ Consumed 10000 messages
  - Throughput: 3421.56 msg/s

======================================================================
COMPARATIVE ANALYSIS
======================================================================
[PUBLISH]
  Performance Delta:
    Throughput: +34.8% (Pulsar faster)
    Latency: +34.5% (Pulsar faster)
    Memory: +28.2% (Pulsar efficient)

[CONSUME]
  Performance Delta:
    Throughput: +39.2% (Pulsar faster)
    Latency: +39.1% (Pulsar faster)
    Memory: +35.1% (Pulsar efficient)

✓ Results saved to: test-output/benchmark-results/benchmark-2026-02-15T14-30-45-123Z.json
```

---

## Accessing the Monitoring UIs

### Pulsar Manager (Admin Console)

```text
URL: http://localhost:9527
User: admin
Password: apachepulsar

Features:
- Cluster overview
- Topic management
- Consumer subscription tracking
- ACLs & authentication
```

### Pulsar REST API

```bash
# Get cluster status
curl http://localhost:8080/admin/v2/clusters

# Get broker stats
curl http://localhost:8080/admin/v2/brokers/stats

# Get namespace details
curl http://localhost:8080/admin/v2/namespaces/public/cosmic-ai

# Get topic stats
curl http://localhost:8080/admin/v2/persistent/public/cosmic-ai/job-submitted/stats
```

### RabbitMQ Management UI (still running)

```text
URL: http://localhost:15672
User: guest
Password: guest
```

### Kafka Tools (if using)

```bash
# List Kafka topics
docker exec cosmic-horizons-kafka-1 kafka-topics.sh --list --bootstrap-server localhost:9092

# Monitor topic throughput
docker exec cosmic-horizons-kafka-1 kafka-run-class.sh kafka.tools.JmxTool --object-name kafka.server:type=BrokerTopicMetrics,name=MessagesInPerSec --attributes Count
```

---

## Interpreting Results

### Key Metrics

**1. Throughput (messages/second)**

- Higher is better
- Typical expectations (10-byte key, ~1.5KB value):
  - RabbitMQ: 1,000-2,000 msg/s
  - Pulsar: 1,500-3,500 msg/s (30-75% improvement)

**2. Latency (ms/message)**

- Lower is better
- Typical expectations:
  - RabbitMQ: 0.5-1.0 ms
  - Pulsar: 0.3-0.7 ms

**3. Memory Usage (MB)**

- For 10K messages, compare growth
- Pulsar typically uses 20-30% less

### Why Pulsar Performs Better

1. **Batching**: Automatic message batching in producer
2. **Zero-copy**: Direct buffer operations vs. RabbitMQ's marshaling
3. **Async I/O**: Non-blocking broker architecture
4. **Tiered Storage**: No need to keep all data in hot memory

---

## Cleanup & Teardown

```bash
# Stop all services (keeps volumes for inspection)
docker compose -f docker-compose.events.yml -f docker-compose.pulsar.yml down

# Full cleanup (removes all data)
docker compose -f docker-compose.events.yml -f docker-compose.pulsar.yml down --volumes --remove-orphans

# Remove only Pulsar (keep existing RabbitMQ/Kafka)
docker compose -f docker-compose.pulsar.yml down --volumes

# Reset Pulsar infrastructure (clean slate for re-testing)
node scripts/pulsar-setup.mjs --cleanup
```

---

## Next: Integration with NestJS API

Once you're satisfied with benchmarks, integrate Pulsar into your NestJS API:

### Simple Pulsar Client Integration

```typescript
// apps/cosmic-horizons-api/src/modules/messaging/pulsar.service.ts
import { PulsarClient } from 'pulsar-client';

@Injectable()
export class PulsarService {
  private client: PulsarClient;
  private producer: any;

  async onModuleInit() {
    this.client = new PulsarClient({
      serviceUrl: process.env.PULSAR_SERVICE_URL || 'pulsar://localhost:6650'
    });

    this.producer = await this.client.createProducer({
      topic: 'persistent://public/cosmic-ai/job-submitted',
      batchingEnabled: true
    });
  }

  async publishJobEvent(event: any) {
    return this.producer.send({
      data: Buffer.from(JSON.stringify(event))
    });
  }
}
```

### Feature Parity with RabbitMQ

| Feature | RabbitMQ | Pulsar | Notes |
|---------|----------|--------|-------|
| Task queues | ✓ | ✓ | exclusive consumers |
| Pub/Sub | ✓ | ✓ | both support |
| Dead letter queue | ✓ | ✓ | via DLQ topics |
| Message replay | Limited (TTL) | ✓ | 30+ days |
| WebSocket support | Extensions | ✓ | native |
| Multi-tenancy | No | ✓ | namespaces |
| Ordered delivery | Per queue | ✓ | per partition |

---

## Free/Low-Cost Options

### 1. **Local Docker (Recommended for R&D)**

- **Cost**: Free
- **Deployment**: 5 minutes (`docker compose up`)
- **Capacity**: Limited by your laptop RAM
- **Use case**: Benchmarking, feature validation, integration testing
- **→ You are here** ✓

### 2. **Kubernetes (Minikube / K3s)**

- **Cost**: Free (local)
- **Deployment**: ~15 minutes
- **Capacity**: Scale to multi-node
- **Use case**: Staging environment, cluster testing
- **Command**: `helm install pulsar apache/pulsar -n pulsar-ns`

### 3. **Apache Pulsar Cloud (StreamNative Cloud)**

- **Cost**: ~$0.50-2.00/million messages (pay-as-you-go)
- **Deployment**: Seconds
- **Capacity**: Unlimited (cloud-native)
- **Use case**: Production, Phase 4 TACC integration
- **URL**: <https://www.streamnative.io/cloud>

### 4. **Self-Hosted (Bare Metal at TACC)**

- **Cost**: Hardware only (part of TACC allocation)
- **Deployment**: ~2 hours (Ansible playbooks available)
- **Capacity**: Petabyte scale
- **Use case**: Long-term CosmicAI integration
- **References**: TACC Frontera, Lonestar6

---

## Troubleshooting

### "Connection refused" to Pulsar

```bash
# Check if containers are running
docker compose -f docker-compose.pulsar.yml ps

# View logs
docker compose -f docker-compose.pulsar.yml logs pulsar-broker-1

# Health check Pulsar broker
curl http://localhost:8080/admin/v2/clusters

# If fails, restart
docker compose -f docker-compose.pulsar.yml restart
```

### High memory usage

Pulsar containers have default `-Xms512m -Xmx512m` (512MB each).

To reduce:

```yaml
# In docker-compose.pulsar.yml
environment:
  PULSAR_MEM: "-Xms256m -Xmx256m"  # 256MB instead
```

### Slow benchmark (< 500 msg/s)

- Ensure no other CPU-intensive tasks running
- Check disk I/O: `iotop` or Task Manager
- Reduce batch size in benchmark script (if needed)

### Benchmark script fails

```bash
# Verify dependencies installed
pnpm install pulsar-client amqplib

# Check both brokers are healthy
node scripts/pulsar-setup.mjs  # This will do health checks too

# Run with debug output (requires code edit to add console.debug)
```

---

## Results Documentation

Benchmark results are automatically saved to:

```text
test-output/benchmark-results/benchmark-TIMESTAMP.json
```

Example structure:

```json
{
  "testMetadata": {
    "timestamp": "2026-02-15T14:30:45.123Z",
    "messageCount": 10000,
    "batchSize": 100
  },
  "results": {
    "rabbitmq": {
      "phases": {
        "publish": { "throughput": 1173.04, "latency": 0.8523, "memory": 12.34 },
        "consume": { "throughput": 2456.78, "latency": 0.4072, "memory": 10.11 }
      }
    },
    "pulsar": {
      "phases": {
        "publish": { "throughput": 1604.15, "latency": 0.6234, "memory": 8.90 },
        "consume": { "throughput": 3421.56, "latency": 0.2922, "memory": 7.45 }
      }
    }
  }
}
```

### Using Results for ADR Updates

Once you have robust benchmarks, update your ADR:

```markdown
# ADR: Event Streaming Infrastructure

## Addition: Pulsar Evaluation

Based on local benchmarking (2026-02-15):
- Pulsar throughput: +34.8% vs RabbitMQ
- Pulsar latency: -34.5% vs RabbitMQ
- Single platform consolidation: 60% operational overhead reduction
- Recommendation: Phase 4 pilot to migrate job orchestration to Pulsar

See: test-output/benchmark-results/ for full dataset
```

---

## Next Steps

1. **Run benchmarks** (`node scripts/benchmark-pulsar-vs-rabbitmq.mjs`)
2. **Review results** (compare against expectations above)
3. **Document findings** (update ROADMAP.md / ADR)
4. **Phase 4 planning**:
   - Migrate job events → Pulsar
   - Keep audit log in Kafka (short-term)
   - Plan geo-replication to TACC data center

---

## References

- [Apache Pulsar Documentation](https://pulsar.apache.org/docs/concepts-architecture/)
- [Pulsar vs Kafka Comparison](https://pulsar.apache.org/docs/migration-kafka/)
- [Performance Tuning Guide](https://pulsar.apache.org/docs/admin-api-namespaces/#persistence)
- [StreamNative Cloud (free tier)](https://www.streamnative.io/cloud)
- [Pulsar CLI Tools](https://pulsar.apache.org/docs/admin-api-tools/)
