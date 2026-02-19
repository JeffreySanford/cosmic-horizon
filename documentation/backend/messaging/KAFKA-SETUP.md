# Kafka Integration & Setup

## Overview

Kafka serves as the **data plane** for the Cosmic Horizons messaging system, handling high-volume visibility and telemetry data streams from telescope array elements. It provides durability, replication, and partition-based scalability.

## Architecture

### Topic: `element.raw_data`

**Purpose**: Archive of raw visibility data and sensor telemetry at scale.

| Property | Value | Rationale |
|----------|-------|-----------|
| Partitions | 1 (dev), 3+ (prod) | Single partition for ordering; scale horizontally in production |
| Replication Factor | 1 (dev), 3 (prod) | No replication in dev; 3-way in production for HA |
| Log Retention (time) | 7 days | Balance between archive and storage cost (ngVLA: ~240 PB/year) |
| Log Retention (size) | 100 GB | Fallback for dev environments |
| Cleanup Policy | Delete | Move old segments to archive storage (S3/GCS) |
| Compression | Snappy | Trade-off between compression ratio (~50%) and CPU |

### Payload Schema

```typescript
// Emitted by MessagingIntegrationService
interface KafkaPayload {
  sourceId: string;                           // element-{site}-{n}
  targetId: string;                           // site-{n}
  routeType: 'node_to_hub' | 'hub_to_hub';   // Routing classification
  elementId: string;                          // Physical element ID
  siteId: string;                             // Observatory site
  timestamp: string;                          // ISO 8601
  metrics: {
    vibration: number;                        // Accelerometer reading
    powerUsage: number;                       // Watts
    noiseFloor: number;                       // dBm
    rfiLevel: number;                         // dBm (RFI detection)
  };
  data_chunk?: string;                        // Base64-encoded visibility chunk
}
```

## Development Setup (Docker Compose)

### Quick Start

```bash
cd c:/repos/cosmic-horizons
docker-compose up -d kafka zookeeper
# Wait ~15s for broker to stabilize
```

### Enable JMX exporter (optional - local dev)

The local docker compose overlay includes an optional Prometheus JMX exporter that exposes Kafka JMX as Prometheus metrics (useful to surface p99/request latency).

- Start the exporter alongside the broker:

```bash
# docker-compose 'profiles' makes the jmx-exporter opt-in; it won't be started by default
# Start the exporter sidecar (opt-in profile):
docker compose -f docker-compose.yml -f docker-compose.events.yml --profile jmx up -d cosmic-horizons-kafka-jmx-exporter
```

- Prometheus/JMX metrics will be available at: `http://localhost:9404/metrics`
- The collector expects a metric such as `kafka_request_latency_seconds{quantile="0.99"}` (values in seconds) — the exporter config is provided in `docker/kafka-jmx-exporter-config.yml`.

### docker-compose.yml (Kafka Section)

```yaml
version: '3.8'

services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_SYNC_LIMIT: 2
      ZOOKEEPER_INIT_LIMIT: 5
    ports:
      - "2181:2181"
    networks:
      - cosmic

  kafka:
    image: confluentinc/cp-kafka:7.5.0
    depends_on:
      - zookeeper
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_INTERNAL://kafka:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_INTERNAL:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT_INTERNAL
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
      KAFKA_LOG_RETENTION_HOURS: 168
      KAFKA_LOG_RETENTION_BYTES: 107374182400  # 100 GB
      KAFKA_COMPRESSION_TYPE: snappy
    ports:
      - "9092:9092"
    networks:
      - cosmic

  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    depends_on:
      - kafka
    environment:
      KAFKA_CLUSTERS_0_NAME: local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
      KAFKA_CLUSTERS_0_ZOOKEEPER: zookeeper:2181
    ports:
      - "8080:8080"
    networks:
      - cosmic

networks:
  cosmic:
    driver: bridge
```

### Environment Variables

```bash
# .env or docker-compose.yml
KAFKA_HOST=kafka           # Service name (Docker) or IP (external)
KAFKA_PORT=9092            # PLAINTEXT broker port
```

### Verification

**Check Broker Status**:

```bash
docker-compose exec kafka kafka-broker-api-versions.sh --bootstrap-server localhost:9092
```

**Create Topic Manually**:

```bash
docker-compose exec kafka kafka-topics.sh \
  --create \
  --topic element.raw_data \
  --partitions 1 \
  --replication-factor 1 \
  --bootstrap-server localhost:9092
```

**List Topics**:

```bash
docker-compose exec kafka kafka-topics.sh \
  --list \
  --bootstrap-server localhost:9092
```

**Monitor Topic**:

```bash
docker-compose exec kafka kafka-console-consumer.sh \
  --topic element.raw_data \
  --from-beginning \
  --bootstrap-server localhost:9092 \
  --max-messages 10
```

**Kafka UI**: Open <http://localhost:8080>

## Production Setup (Kubernetes/TACC)

### High-Availability Cluster (3 Brokers)

#### Prerequisites

- Kubernetes 1.21+ with PersistentVolume support
- 3 nodes minimum, 4 CPUs + 8 GB RAM per broker
- Network policies allowing inter-broker communication

#### Deployment (Helm)

```bash
# Add Confluent Helm repo
helm repo add confluentinc https://packages.confluent.io/helm
helm repo update

# Install Kafka cluster
helm install kafka confluentinc/cp-kafka \
  --namespace data-plane \
  --values kafka-values.yaml
```

#### kafka-values.yaml

```yaml
# Kafka Broker Configuration
kafka:
  brokers: 3
  
  replicas: 3
  
  # JVM Performance
  heapOptions: "-Xms4g -Xmx4g"
  
  # Broker Configuration
  configurationOverrides:
    "default.replication.factor": "3"
    "min.insync.replicas": "2"
    "log.retention.hours": "168"
    "log.retention.bytes": "1099511627776"  # 1 TB per broker
    "compression.type": "snappy"
    "log.segment.bytes": "1073741824"       # 1 GB segment
    "num.network.threads": "8"
    "num.io.threads": "8"
    "socket.send.buffer.bytes": "102400"
    "socket.receive.buffer.bytes": "102400"
    "socket.request.max.bytes": "104857600" # 100 MB
    
  # Storage
  persistence:
    enabled: true
    size: 500Gi
    storageClassName: "fast-ssd"
    
  # Resource Requests
  resources:
    requests:
      cpu: 4000m
      memory: 8Gi
    limits:
      cpu: 8000m
      memory: 16Gi

# Zookeeper Ensemble
cp-zookeeper:
  servers: 3
  persistence:
    enabled: true
    size: 50Gi
    storageClassName: "fast-ssd"
  resources:
    requests:
      cpu: 1000m
      memory: 2Gi

# Monitoring
prometheus:
  enabled: true
  jmxExporter:
    enabled: true
```

#### Topic Creation Script

```bash
#!/bin/bash
BOOTSTRAP_SERVER="kafka-broker-0.kafka-service.data-plane.svc.cluster.local:9092"

# Wait for broker availability
kubectl -n data-plane exec -it kafka-broker-0 -- \
  kafka-broker-api-versions.sh --bootstrap-server $BOOTSTRAP_SERVER

# Create primary topic
kubectl -n data-plane exec -it kafka-broker-0 -- \
  kafka-topics.sh \
  --create \
  --topic element.raw_data \
  --partitions 3 \
  --replication-factor 3 \
  --config retention.ms=604800000 \
  --config compression.type=snappy \
  --bootstrap-server $BOOTSTRAP_SERVER
```

#### Monitoring & Scaling

**Monitor Partition Leaders**:

```bash
kubectl -n data-plane exec -it kafka-broker-0 -- \
  kafka-topics.sh \
  --describe \
  --topic element.raw_data \
  --bootstrap-server localhost:9092
```

**Scale Up Brokers**:

```bash
kubectl -n data-plane patch kafka kafka-cluster -p '{"spec":{"brokers":4}}' --type merge
```

## NestJS Integration

### Service Initialization

The `MessagingIntegrationService` initializes Kafka client at module startup:

```typescript
// apps/cosmic-horizons-api/src/app/messaging/messaging-integration.service.ts

private initializeClients() {
  const kafkaBrokers = [`${this.configService.get('KAFKA_HOST')}:${this.configService.get('KAFKA_PORT')}`];

  this.kafkaClient = ClientProxyFactory.create({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'cosmic-horizons-array-element',
        brokers: kafkaBrokers,
        retry: {
          initialRetryTime: 1000,
          retries: 10,
        },
      },
      producer: {
        allowAutoTopicCreation: true,
        createPartitioner: Partitioners.LegacyPartitioner,
      },
    },
  });
}

// Emit telemetry to Kafka
this.kafkaClient.emit('element.raw_data', {
  ...packet,
  data_chunk: 'base64_simulated_payload_representing_visibilities'
}).subscribe({
  error: (err: Error) => {
    if (!err.message?.includes('Metadata')) {
      this.statsService.recordError();
      this.logger.error('Kafka emit error', err);
    }
  }
});
```

### Admin Client for Monitoring

```typescript
// apps/cosmic-horizons-api/src/app/messaging/messaging-monitor.service.ts

private async pollKafka(): Promise<MessagingInfraSnapshot['kafka']> {
  const started = Date.now();
  try {
    await this.kafkaAdmin.connect();
    const offsets = await this.kafkaAdmin.fetchTopicOffsets('element.raw_data');
    const latestOffset = offsets.reduce((acc, item) => acc + Number(item.offset), 0);

    return {
      connected: true,
      latencyMs: Date.now() - started,
      latestOffset,  // Total messages in topic
      partitions: offsets.length,
    };
  } catch (error) {
    this.logger.debug(`Kafka monitor failed: ${(error as Error).message}`);
    return { connected: false, latencyMs: null, latestOffset: null, partitions: null };
  } finally {
    await this.kafkaAdmin.disconnect();
  }
}
```

## Troubleshooting

### Issue: "Metadata Error" on Connect

**Cause**: Broker not fully initialized

**Solution**:

```bash
# Wait for broker to stabilize
sleep 10
docker-compose logs kafka | grep -i "started"
```

### Issue: Topic Auto-Creation Fails

**Cause**: `auto.create.topics.enable=false` on broker

**Solution**: Enable in docker-compose or manually create:

```bash
docker-compose exec kafka kafka-topics.sh \
  --create --topic element.raw_data \
  --bootstrap-server localhost:9092
```

### Issue: Consumer Lag Growing

**Cause**: Retention policy too aggressive or consumer down

**Solution**:

```bash
# Check consumer group lag
docker-compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group cosmic-horizons-array-element \
  --describe

# Increase retention
docker-compose exec kafka kafka-configs.sh \
  --bootstrap-server localhost:9092 \
  --alter \
  --entity-type topics \
  --entity-name element.raw_data \
  --add-config retention.ms=1209600000
```

### Issue: Disk Space Growing

**Cause**: Retention settings too high or compaction disabled

**Solution**:

```bash
# Check disk usage
docker-compose exec kafka du -sh /var/lib/kafka/data

# Manually delete old segments
# WARNING: May cause data loss
docker-compose exec kafka rm -f /var/lib/kafka/data/element.raw_data*/00000*
```

## Performance Tuning

| Parameter | Dev Default | Prod Recommended | Purpose |
|-----------|-------------|------------------|---------|
| num.network.threads | 3 | 8-16 | Network I/O threads |
| num.io.threads | 8 | 16-32 | Disk I/O threads |
| socket.send.buffer.bytes | 102400 | 524288 | TCP send buffer |
| socket.receive.buffer.bytes | 102400 | 524288 | TCP receive buffer |
| log.flush.interval.messages | 10000 | 100000 | Batch write size |
| replica.lag.time.max.ms | 10000 | 30000 | Replica failure detection |

## References

- [MESSAGING-ARCHITECTURE.md](./MESSAGING-ARCHITECTURE.md) — System overview
- [ARRAY-MONITORING-API.md](./ARRAY-MONITORING-API.md) — Monitoring endpoints
- [Confluent Kafka Documentation](https://docs.confluent.io/kafka/operations-tools/monitoring/metrics-comparator.html)
- [KafkaJS Client Docs](https://kafka.js.org/)
