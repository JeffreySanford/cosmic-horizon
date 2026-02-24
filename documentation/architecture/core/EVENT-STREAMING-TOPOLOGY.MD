# Event Streaming Topology & Infrastructure

**Version**: 1.0  
**Date**: 2026-02-14  
**Status**: DRAFT (For Sprint 5.1 Implementation)

## Docker Compose Architecture

### Component Overview

```yaml
services:
  # RabbitMQ Cluster (3 nodes for quorum queues)
  rabbitmq-1:
    image: rabbitmq:3.13-management
    environment:
      RABBITMQ_ERLANG_COOKIE: cosmic-horizons-secret
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    ports:
      - '5672:5672' # AMQP port
      - '15672:15672' # Management UI
    volumes:
      - rabbitmq-1-data:/var/lib/rabbitmq
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 30s
      timeout: 10s
      retries: 5

  rabbitmq-2:
    # Same as rabbitmq-1, different hostname
    environment:
      RABBITMQ_NODENAME: rabbit@rabbitmq-2

  rabbitmq-3:
    # Same as rabbitmq-1, different hostname
    environment:
      RABBITMQ_NODENAME: rabbit@rabbitmq-3

  # Kafka Cluster (3 brokers + Zookeeper)
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_SYNC_LIMIT: 2
      ZOOKEEPER_INIT_LIMIT: 5
    ports:
      - '2181:2181'
    volumes:
      - zookeeper-data:/var/lib/zookeeper/data

  kafka-1:
    image: confluentinc/cp-kafka:7.5.0
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka-1:29092,PLAINTEXT_HOST://kafka-1:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'
      KAFKA_LOG_RETENTION_DAYS: 30
    ports:
      - '9092:9092'
    depends_on:
      - zookeeper
    volumes:
      - kafka-1-data:/var/lib/kafka/data
    healthcheck:
      test: kafka-broker-api-versions.sh --bootstrap-server localhost:9092
      interval: 30s
      timeout: 10s
      retries: 5

  kafka-2:
    # Same as kafka-1, KAFKA_BROKER_ID: 2, port 9093

  kafka-3:
    # Same as kafka-1, KAFKA_BROKER_ID: 3, port 9094

  # Confluent Schema Registry
  schema-registry:
    image: confluentinc/cp-schema-registry:7.5.0
    environment:
      SCHEMA_REGISTRY_HOST_NAME: schema-registry
      SCHEMA_REGISTRY_KAFKASTORE_BOOTSTRAP_SERVERS: kafka-1:29092,kafka-2:29092,kafka-3:29092
      SCHEMA_REGISTRY_LISTENERS: http://0.0.0.0:8081
      SCHEMA_REGISTRY_DEBUG: 'false'
    ports:
      - '8081:8081'
    depends_on:
      - kafka-1
      - kafka-2
      - kafka-3
    healthcheck:
      test: curl --fail http://localhost:8081/subjects || exit 1
      interval: 30s
      timeout: 10s
      retries: 5

volumes:
  rabbitmq-1-data:
  rabbitmq-2-data:
  rabbitmq-3-data:
  zookeeper-data:
  kafka-1-data:
  kafka-2-data:
  kafka-3-data:
```

## RabbitMQ Topology

### Exchanges

| Name                | Type   | Durable | Purpose                          |
| ------------------- | ------ | ------- | -------------------------------- |
| `job.events`        | topic  | yes     | Route job lifecycle events       |
| `notifications`     | topic  | yes     | Route notifications to WebSocket |
| `metrics`           | topic  | yes     | Route metrics to listeners       |
| `dlx` (Dead Letter) | direct | yes     | Handle failed messages           |

### Queues

| Name                  | Durable | Max-Length | TTL | Binding Key       |
| --------------------- | ------- | ---------- | --- | ----------------- |
| `job-events-api`      | yes     | 100k       | 30s | `job.#`           |
| `job-events-audit`    | yes     | 100k       | 5m  | `job.#`           |
| `websocket-broadcast` | yes     | 50k        | 30s | `notifications.*` |
| `job-dlq`             | yes     | unlimited  | 24h | -                 |

### Routing Strategy

```text
Job Submission
  │
  └─ job.submitted
      ├─ Routing key: job.submitted
      │  └─ Queue: job-events-api (immediate processing)
      └─ Queue: job-events-audit (durable)
         ├─ Routed to Kafka
         └─ Logged to audit trail

Status Change
  │
  └─ job.status.changed
      ├─ Routing key: job.${job_id}.status
      │  └─ Queue: job-events-api (update dashboard)
      ├─ Queue: websocket-broadcast
      │  └─ NestJS NotificationService broadcasts to UI
      └─ Queue: job-events-audit
         └─ Routed to Kafka for historical queries

Error/Retry
  │
  └─ job.failed
      ├─ If retriable: queue for retry (exponential backoff)
      │  └─ Retry delay: 1s, 2s, 4s, 8s, 16s, 30s (cap)
      └─ If not retriable: send to DLQ
         └─ Human review/manual retry
```

## Kafka Topology

### Topics

| Name            | Partitions | Replication | Retention | Key        |
| --------------- | ---------- | ----------- | --------- | ---------- |
| `job-lifecycle` | 10         | 3           | 30 days   | `job_id`   |
| `job-metrics`   | 20         | 3           | 30 days   | `job_id`   |
| `audit-trail`   | 5          | 3           | 90 days   | `audit_id` |
| `notifications` | 5          | 3           | 7 days    | `user_id`  |

### Partitioning Strategy

**Key: `job_id`** ensures all events for a job go to same partition, guaranteeing order.

```text
Kafka Partition Assignment:
├─ Partition 0: job_id hash % 10
│  └─ All events for jobs 0, 10, 20, 30, ...
├─ Partition 1: job_id hash % 10
│  └─ All events for jobs 1, 11, 21, 31, ...
└─ ... (0-9)

Consumer Groups:
├─ audit-service: Reads all partitions (compliance audit)
├─ analytics-service: Reads all partitions (historical queries)
└─ dashboard-service: Reads specific partitions (live metrics)
```

### Schema Evolution

All topics use Confluent Schema Registry with Avro format:

```json
{
  "namespace": "com.cosmic-horizons.events",
  "type": "record",
  "name": "JobLifecycleEvent",
  "version": 1,
  "fields": [
    { "name": "event_id", "type": "string" },
    { "name": "event_type", "type": "string" },
    { "name": "timestamp", "type": "string" },
    { "name": "payload", "type": "string" }
  ]
}
```

## NestJS Integration Layer

### Module Structure

```text
src/
├── modules/
│   ├── events/
│   │   ├── events.module.ts
│   │   ├── events.service.ts
│   │   ├── rabbitmq.service.ts        // RabbitMQ client
│   │   ├── kafka.service.ts           // Kafka client
│   │   ├── schema/
│   │   │   ├── event.base.ts          // EventBase interface
│   │   │   ├── job-lifecycle.ts       // Job events
│   │   │   ├── notifications.ts       // Notification events
│   │   │   └── metrics.ts             // Metrics events
│   │   ├── handlers/
│   │   │   ├── job-submitted.handler.ts
│   │   │   ├── job-status-changed.handler.ts
│   │   │   └── job-failed.handler.ts
│   │   └── __tests__/
│   │       ├── events.service.spec.ts (25 tests)
│   │       ├── rabbitmq.service.spec.ts (20 tests)
│   │       └── kafka.service.spec.ts (20 tests)
│   └── notifications/
│       ├── notifications.module.ts
│       ├── notifications.service.ts
│       ├── websocket.gateway.ts        // Socket.IO server
│       └── __tests__/
│           └── notifications.service.spec.ts (15 tests)
```

## Performance Targets (Sprint 5)

### RabbitMQ

| Metric                  | Target          | Measurement         |
| ----------------------- | --------------- | ------------------- |
| Message publish latency | <50ms P99       | End-to-end with ack |
| Queue depth             | <1000 msgs      | Under normal load   |
| Broker memory           | <500MB per node | 3-node cluster      |
| Throughput              | 5000 msgs/sec   | Per broker          |
| Availability            | >99.9%          | Quorum queues       |

### Kafka

| Metric                  | Target           | Measurement           |
| ----------------------- | ---------------- | --------------------- |
| Message publish latency | <100ms P99       | Replica ack required  |
| Throughput              | 1000+ events/sec | All 3 topics combined |
| Consumer lag            | <5 seconds       | Real-time dashboard   |
| Broker disk             | <50GB per broker | 30-day retention      |
| Replication factor      | 3                | High availability     |

### Combined System

| Metric                      | Target | Notes                             |
| --------------------------- | ------ | --------------------------------- |
| Job submission to dashboard | <500ms | RabbitMQ path                     |
| Job completion notification | <2s    | Kafka audit + webhook             |
| Metrics dashboard update    | <1s    | Real-time via WebSocket           |
| Event replay from Kafka     | <30s   | Historical query (year retention) |

## Monitoring & Observability

### Metrics to Collect

**RabbitMQ** (via management API):

- Messages published/sec
- Messages consumed/sec
- Queue depth by queue
- Broker disk usage
- Memory per node
- Connection count

**Kafka** (via JMX/Prometheus):

- Records in/out per broker
- Consumer lag per group
- Partition leadership changes
- Replication failure rate
- Fetch latency (P50, P99)

**Application** (NestJS):

- Event publish latency histogram
- Event handler execution time
- Idempotency hit rate
- DLQ message count
- WebSocket connection count

### Alerting

1. **RabbitMQ node down**: Trigger failover/recovery
2. **Kafka broker down**: Monitor rebalancing
3. **DLQ growth**: Indicates systematic failures
4. **Consumer lag >60s**: Dashboard not updating in real-time
5. **Event publish latency >200ms P99**: Broker overload

## Local Development Setup

```bash
# 1. Start all brokers (Docker Compose)
docker-compose -f docker-compose.events.yml up -d

# 2. Wait for health checks
docker-compose -f docker-compose.events.yml ps
# All services should be "Up (healthy)"

# 3. Initialize RabbitMQ topology
pnpm nx run cosmic-horizons-api:rabbitmq-init

# 4. Create Kafka topics
docker exec kafka-1 kafka-topics --bootstrap-server kafka-1:9092 \
  --create --topic job-lifecycle \
  --partitions 10 --replication-factor 3

# 5. Verify connectivity
pnpm nx run cosmic-horizons-api:test --testNamePattern="event.*integration"

# 6. View RabbitMQ UI
# http://localhost:15672 (admin/password)

# 7. View Kafka topics
docker exec kafka-1 kafka-topics --bootstrap-server kafka-1:9092 --list
```

## Sprint 5.1 Deliverables

- [x] Finalized Docker Compose (RabbitMQ 3-node, Kafka 3-broker)
- [ ] NestJS EventsModule scaffolded
- [ ] RabbitMQ healthcheck + connection retry logic
- [ ] Kafka healthcheck with Schema Registry
- [ ] 45+ unit/integration tests passing
- [ ] Latency benchmarks documented (<100ms P99)
- [ ] Topology diagram finalized

---

**Infrastructure**: Event Streaming Topology  
**Last Updated**: 2026-02-14  
**Sprint**: 5.1 (RabbitMQ Foundation)
