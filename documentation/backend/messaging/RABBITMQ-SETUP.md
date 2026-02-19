# RabbitMQ Integration & Setup

## Overview

RabbitMQ serves as the **management plane** for the Cosmic Horizons messaging system, handling orchestration signals, telemetry routing, and control messages across distributed array sites.

## Architecture

### Queue: `element_telemetry_queue`

**Purpose**: Management-plane routing of telemetry packets for orchestration and state tracking.

| Property    | Value             | Rationale                                |
| ----------- | ----------------- | ---------------------------------------- |
| Message TTL | 30 minutes        | Expiring grace period for slow consumers |
| Queue Type  | Classic           | Standard FIFO for reliability            |
| Durability  | Non-durable (dev) | Faster throughput; data in Kafka anyway  |
| Auto-Delete | false             | Survives consumer restarts               |
| Max Length  | 1,000,000         | Backpressure protection                  |

### Payload Schema

```typescript
// Emitted by MessagingIntegrationService
interface RabbitMQPayload {
  sourceId: string; // element-{site}-{n}
  targetId: string; // site-{n} (hub)
  routeType: 'node_to_hub' | 'hub_to_hub'; // Routing classification
  elementId: string; // Physical element ID
  siteId: string; // Observatory site
  timestamp: string; // ISO 8601
  metrics: {
    vibration: number;
    powerUsage: number;
    noiseFloor: number;
    rfiLevel: number;
  };
}
```

## Development Setup (Docker Compose)

### Quick Start

```bash
cd c:/repos/cosmic-horizons
docker-compose up -d rabbitmq
# Wait ~15s for initialization
```

### docker-compose.yml (RabbitMQ Section)

```yaml
version: '3.8'

services:
  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
      RABBITMQ_DEFAULT_VHOST: /
      RABBITMQ_ERLANG_COOKIE: cosmic-horizons-secret
    ports:
      - '5672:5672' # AMQP port
      - '15672:15672' # Management UI
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq
      - ./rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
    networks:
      - cosmic
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  rabbitmq-data:

networks:
  cosmic:
    driver: bridge
```

### rabbitmq.conf (Configuration)

```ini
# RabbitMQ Configuration File
# Location: ./rabbitmq.conf

# Listeners
listeners.ssl.default = 5671
listeners.tcp.default = 5672

# Memory / Disk Free Alarms
vm_memory_high_watermark.relative = 0.6
vm_memory_high_watermark_paging_ratio = 0.75
disk_free_limit.absolute = 1GB

# Queue Master Location
queue_master_location = random

# Management Plugin
management.load_definitions = /etc/rabbitmq/definitions.json
management.tcp.port = 15672
management.listener.port = 15672

# Clustering
cluster_formation.peer_discovery_backend = rabbit_peer_discovery_classic_config
cluster_formation.classic_config.nodes.1 = rabbit@rabbitmq-0.rabbitmq-service
cluster_formation.classic_config.nodes.2 = rabbit@rabbitmq-1.rabbitmq-service
cluster_formation.classic_config.nodes.3 = rabbit@rabbitmq-2.rabbitmq-service

# Mirroring (for HA)
ha-mode = all
ha-sync-mode = automatic
ha-sync-batch-size = 1
```

### Environment Variables

```bash
# .env or docker-compose.yml
RABBITMQ_HOST=rabbitmq        # Service name (Docker) or IP (external)
RABBITMQ_PORT=5672            # AMQP port
RABBITMQ_MANAGEMENT_PORT=15672 # Management API
RABBITMQ_USER=guest
RABBITMQ_PASS=guest
```

### Verification

**Check Broker Status**:

```bash
docker-compose exec rabbitmq rabbitmq-diagnostics -q status
```

**Access Management UI**: Open <http://localhost:15672> (guest/guest)

**List Queues**:

```bash
docker-compose exec rabbitmq rabbitmqctl list_queues name messages consumers
```

**Create Queue Manually** (if not auto-created):

```bash
docker-compose exec rabbitmq rabbitmqctl add_vhost /
docker-compose exec rabbitmq rabbitmqctl set_permissions -p / guest ".*" ".*" ".*"
```

**Monitor Queue Depth**:

```bash
curl http://localhost:15672/api/queues/%2F/element_telemetry_queue \
  -u guest:guest
```

## Production Setup (Kubernetes/TACC)

### High-Availability Cluster (3 Nodes)

#### Prerequisites

- Kubernetes 1.21+ with PersistentVolume support
- 3+ nodes, 2 CPUs + 4 GB RAM per broker
- StorageClass supporting ReadWriteOnce (e.g., fast-ssd)

#### Deployment (Helm)

```bash
# Add RabbitMQ Helm repo
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

# Install RabbitMQ cluster
helm install rabbitmq bitnami/rabbitmq \
  --namespace management-plane \
  --values rabbitmq-values.yaml
```

#### rabbitmq-values.yaml

```yaml
# RabbitMQ Helm Values
replicaCount: 3

# Authentication
auth:
  username: cosmic
  password: <generate-strong-password>
  erlangCookie: <generate-cookie>

# Persistence
persistence:
  enabled: true
  size: 100Gi
  storageClassName: 'fast-ssd'

# Resource Requests
resources:
  requests:
    cpu: 2000m
    memory: 4Gi
  limits:
    cpu: 4000m
    memory: 8Gi

# Clustering
clustering:
  enabled: true
  addressType: ip

# Management Plugin
managementPlugin:
  enabled: true
  port: 15672

# Monitoring
metrics:
  enabled: true
  serviceMonitor:
    enabled: true
    namespace: monitoring

# Network Policy
networkPolicy:
  enabled: true
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: data-plane
      ports:
        - protocol: TCP
          port: 5672
        - protocol: TCP
          port: 15672
```

#### High-Availability Configuration

```yaml
# Cluster Statefulset Patch
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: rabbitmq
  namespace: management-plane
spec:
  serviceName: rabbitmq # Headless service for DNS-based discovery
  podManagementPolicy: 'Parallel'

  template:
    spec:
      # Affinity: Spread replicas across nodes
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            - labelSelector:
                matchExpressions:
                  - key: app.kubernetes.io/name
                    operator: In
                    values:
                      - rabbitmq
              topologyKey: kubernetes.io/hostname

      containers:
        - name: rabbitmq
          env:
            # Cluster formation
            - name: RABBITMQ_CLUSTER_FORMATION_BACKEND
              value: 'rabbit_peer_discovery_classic_config'
            - name: RABBITMQ_CLUSTER_FORMATION_CLASSIC_CONFIG_NODES
              value: '3'
            # HA Mirroring
            - name: RABBITMQ_QUEUE_MASTER_LOCATOR
              value: 'min-masters'
            # Performance tuning
            - name: RABBITMQ_CHANNEL_MAX
              value: '2048'
            - name: RABBITMQ_HEARTBEAT
              value: '60'
            - name: RABBITMQ_FRAME_MAX
              value: '131072' # 128 KB

          resources:
            requests:
              cpu: 2000m
              memory: 4Gi
            limits:
              cpu: 4000m
              memory: 8Gi
```

#### Queue Definition (Declarative)

```yaml
# rabbitmq-definitions.json
{
  'vhosts': [{ 'name': '/' }],
  'users':
    [
      {
        'name': 'cosmic',
        'password': '<hashed-password>',
        'tags': ['administrator'],
      },
    ],
  'permissions':
    [
      {
        'user': 'cosmic',
        'vhost': '/',
        'configure': '.*',
        'write': '.*',
        'read': '.*',
      },
    ],
  'exchanges': [],
  'queues':
    [
      {
        'name': 'element_telemetry_queue',
        'vhost': '/',
        'durable': true,
        'auto_delete': false,
        'arguments':
          {
            'x-max-length': 1000000,
            'x-message-ttl': 1800000,
            'x-queue-type': 'classic',
          },
      },
    ],
}
```

#### Scaling & Failover

**Scale to 4 Nodes**:

```bash
kubectl -n management-plane patch statefulset rabbitmq -p '{"spec":{"replicas":4}}'
```

**Monitor Cluster Status**:

```bash
kubectl -n management-plane exec rabbitmq-0 -- \
  rabbitmqctl cluster_status
```

**Manually Join Node**:

```bash
# If node crashes and rejoins
kubectl -n management-plane exec rabbitmq-2 -- \
  rabbitmqctl forget_cluster_node rabbit@rabbitmq-1
```

## NestJS Integration

### Service Initialization

The `MessagingIntegrationService` initializes RabbitMQ client at module startup:

```typescript
// apps/cosmic-horizons-api/src/app/messaging/messaging-integration.service.ts

private initializeClients() {
  this.rabbitClient = ClientProxyFactory.create({
    transport: Transport.RMQ,
    options: {
      urls: [`amqp://${this.configService.get('RABBITMQ_USER')}:${this.configService.get('RABBITMQ_PASS')}@${this.configService.get('RABBITMQ_HOST')}:${this.configService.get('RABBITMQ_PORT')}`],
      queue: 'element_telemetry_queue',
      queueOptions: {
        durable: false,  // Non-persistent in dev
      },
    },
  });
}

// Emit telemetry to RabbitMQ
this.rabbitClient.emit('element.telemetry', packet).subscribe({
  error: (err) => {
    this.statsService.recordError();
    this.logger.error('RabbitMQ emit error', err);
  }
});
this.statsService.recordRabbitPublished();
```

### Management API for Monitoring

```typescript
// apps/cosmic-horizons-api/src/app/messaging/messaging-monitor.service.ts

private async pollRabbitMq(): Promise<MessagingInfraSnapshot['rabbitmq']> {
  const host = this.config.get<string>('RABBITMQ_HOST') ?? 'localhost';
  const managementPort = this.config.get<string>('RABBITMQ_MANAGEMENT_PORT') ?? '15672';
  const user = this.config.get<string>('RABBITMQ_USER') ?? 'guest';
  const pass = this.config.get<string>('RABBITMQ_PASS') ?? 'guest';
  const url = `http://${host}:${managementPort}/api/queues/%2F/element_telemetry_queue`;
  const started = Date.now();

  try {
    const auth = Buffer.from(`${user}:${pass}`).toString('base64');
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json() as {
      messages?: number;
      consumers?: number;
    };

    return {
      connected: true,
      latencyMs: Date.now() - started,
      queueDepth: payload.messages ?? 0,
      consumers: payload.consumers ?? 0,
    };
  } catch (error) {
    this.logger.debug(`RabbitMQ monitor failed: ${(error as Error).message}`);
    return {
      connected: false,
      latencyMs: null,
      queueDepth: null,
      consumers: null,
    };
  }
}
```

## Troubleshooting

### Issue: "Nodes Differ" Error on Cluster Join

**Cause**: Erlang cookie mismatch between nodes

**Solution**:

```bash
# Check cookie
docker-compose exec rabbitmq cat /var/lib/rabbitmq/.erlang.cookie

# Reset cluster
docker-compose exec rabbitmq rabbitmqctl reset
docker-compose exec rabbitmq rabbitmqctl start_app
```

### Issue: High Memory Usage

**Cause**: Queue backlog or message accumulation

**Solution**:

```bash
# Purge queue (WARNING: data loss)
docker-compose exec rabbitmq rabbitmqctl purge_queue element_telemetry_queue

# Check queue stats
curl http://localhost:15672/api/queues/%2F/element_telemetry_queue \
  -u guest:guest | jq '.messages'
```

### Issue: Management API Returns 401

**Cause**: Incorrect credentials or missing Management plugin

**Solution**:

```bash
# Enable management plugin
docker-compose exec rabbitmq rabbitmq-plugins enable rabbitmq_management

# Verify credentials
docker-compose exec rabbitmq rabbitmqctl list_users
```

### Issue: Persistent Disk Growth

**Cause**: Messages not being consumed or deleted

**Solution**:

```bash
# Check disk usage
du -sh rabbitmq-data/

# Set message TTL (30 min)
docker-compose exec rabbitmq rabbitmqctl set_policy -p / ttl \
  "element_telemetry_queue" \
  '{"message-ttl":1800000}'

# Set queue length limit
docker-compose exec rabbitmq rabbitmqctl set_policy -p / max-length \
  "element_telemetry_queue" \
  '{"max-length":1000000}'
```

## Performance Tuning

| Parameter                     | Dev Default     | Prod Recommended | Purpose                            |
| ----------------------------- | --------------- | ---------------- | ---------------------------------- |
| channel_max                   | 2048            | 4096+            | Concurrent channels per connection |
| frame_max                     | 131072 (128 KB) | 262144 (256 KB)  | Max frame size for large messages  |
| heartbeat                     | 60s             | 30s              | Connection keep-alive interval     |
| num_acceptors                 | 10              | 32-64            | Network listener threads           |
| background_gc_target_interval | 30s             | 60s              | GC frequency (higher = less CPU)   |
| max-length                    | -               | 1M+              | Queue backpressure limit           |

## References

- [MESSAGING-ARCHITECTURE.md](./MESSAGING-ARCHITECTURE.md) — System overview
- [ARRAY-MONITORING-API.md](./ARRAY-MONITORING-API.md) — Monitoring endpoints
- [RabbitMQ Official Documentation](https://www.rabbitmq.com/documentation.html)
- [RabbitMQ Clustering Guide](https://www.rabbitmq.com/clustering.html)
- [NestJS Microservices - RabbitMQ](https://docs.nestjs.com/microservices/rabbitmq)
