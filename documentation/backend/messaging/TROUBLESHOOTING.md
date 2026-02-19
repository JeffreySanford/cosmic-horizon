# Messaging System Troubleshooting Guide

## Common Issues & Solutions

---

## RabbitMQ Issues

### Issue: "Failed to connect to RabbitMQ"

**Error Message**:

```text
MessagingIntegrationService - Failed to connect to RabbitMQ
Error: connect ECONNREFUSED 127.0.0.1:5672
```

**Cause**: RabbitMQ broker not running or unreachable

**Solution**:

```bash
# Check if RabbitMQ container is running
docker-compose ps | grep rabbitmq

# Start RabbitMQ
docker-compose up -d rabbitmq

# Wait for initialization (~15 secs)
sleep 15

# Verify broker is ready
docker-compose exec rabbitmq rabbitmq-diagnostics -q ping
# Output: ok

# Check logs for errors
docker-compose logs rabbitmq | head -50
```

**Advanced Diagnostics**:

```bash
# Check port binding
curl localhost:15672/api/connections \
  -u guest:guest

# Restart broker cleanly
docker-compose restart rabbitmq

# Force recreate (if corrupted state)
docker-compose down rabbitmq
docker volume rm cosmic-horizons_rabbitmq-data  # WARNING: data loss
docker-compose up -d rabbitmq
```

---

### Issue: "Nodes Differ" Erlang Clustering Error

**Error Message**:

```text
{dist_util, send, 3}, Reason: {badrpc, nodedown}
```

**Cause**: Erlang cookies don't match on cluster nodes, or node DNS resolution fails

**Solution (Single Node)**:

```bash
# Reset cluster state
docker-compose exec rabbitmq rabbitmqctl reset
docker-compose exec rabbitmq rabbitmqctl start_app

# Verify status
docker-compose exec rabbitmq rabbitmqctl status
```

**Solution (Multi-Node Cluster)**:

```bash
# Check cookies on all nodes
docker-compose exec rabbitmq-0 cat /var/lib/rabbitmq/.erlang.cookie
docker-compose exec rabbitmq-1 cat /var/lib/rabbitmq/.erlang.cookie
# Cookies must match!

# If mismatch, retrieve from secrets
kubectl get secret rabbitmq-erlang-cookie -o \
  jsonpath='{.data.RABBITMQ_ERLANG_COOKIE}' | base64 -d
```

---

### Issue: Queue Not Auto-Creating

**Error Message**:

```text
rabbitmq.ts:28 - Could not declare queue element_telemetry_queue
```

**Cause**: Queue not declared by client, and `auto_create` disabled on broker

**Solution**:

```typescript
// Ensure durable binding in NestJS
private initializeClients() {
  this.rabbitClient = ClientProxyFactory.create({
    transport: Transport.RMQ,
    options: {
      urls: ['amqp://...'],
      queue: 'element_telemetry_queue',
      queueOptions: {
        durable: false,  // ← Set appropriately
        noAck: false,    // ← Require acknowledgment
      },
    },
  });
}

// Manually create queue via broker
docker-compose exec rabbitmq \
  rabbitmqctl declare_queue -p / -n "element_telemetry_queue"
```

---

### Issue: Memory Alarm / Disk Full

**Error Message**:

```text
ALARM set: [{set,[memory]}]
```

**Cause**: RabbitMQ memory or disk thresholds exceeded

**Solution**:

```bash
# Check usage
docker-compose exec rabbitmq rabbitmqctl status | grep memory

# Clear old messages
docker-compose exec rabbitmq rabbitmqctl purge_queue -p / element_telemetry_queue

# Increase limits in docker-compose.yml
environment:
  RABBITMQ_MEMORY_HIGH_WATERMARK: 0.4  # Default 0.6 (60%)
  RABBITMQ_DISK_FREE_LIMIT: 2GB        # Default 50 MB

# Restart
docker-compose down
docker-compose up -d rabbitmq
```

---

### Issue: Consumers Not Processing

**Symptom**: Queue depth grows, but consumers don't pull messages

**Diagnostic**:

```bash
# Check active consumers
curl http://localhost:15672/api/queues/%2F/element_telemetry_queue \
  -u guest:guest | jq '.consumers'
# Output should be > 0

# List consumer groups
docker-compose exec rabbitmq \
  rabbitmqctl list_consumers
```

**Solution**:

```bash
# Restart consumer client
# (In your application, restart the MessagingIntegrationService)
docker-compose restart cosmic-horizons-api

# Force unconsume (if stuck)
curl -X DELETE \
  http://localhost:15672/api/consumers/%2F/consumer-tag \
  -u guest:guest
```

---

## Kafka Issues

### Issue: "Broker Not Available" / Metadata Error

**Error Message**:

```text
KafkaJSNumberOfRetriesExceeded: Failed to fetch metadata 10 times in a row
```

**Cause**: Kafka broker not ready, Zookeeper not connected, or network issue

**Solution**:

```bash
# Check broker health
docker-compose exec kafka kafka-broker-api-versions.sh \
  --bootstrap-server localhost:9092
# Output: (success indicates broker is responding)

# Check Zookeeper connection
docker-compose exec kafka kafka-topics.sh \
  --bootstrap-server localhost:9092 \
  --list
# Should show topics or empty list

# View broker logs
docker-compose logs kafka | grep -i "error\|warning" | tail -20

# Wait for broker stabilization (Kafka can take 30+ seconds)
docker-compose up -d kafka zookeeper
for i in {1..60}; do
  if docker-compose exec kafka kafka-broker-api-versions.sh \
    --bootstrap-server localhost:9092 >/dev/null 2>&1; then
    echo "Kafka ready after $i seconds"
    break
  fi
  sleep 1
done
```

---

### Issue: Topic Creation Fails

**Error Message**:

```text
Kafka admin client: Topic already exists / Failed to create topic
```

**Solution**:

```bash
# List existing topics
docker-compose exec kafka kafka-topics.sh \
  --list --bootstrap-server localhost:9092

# Delete stale topic (if needed)
docker-compose exec kafka kafka-topics.sh \
  --delete \
  --topic element.raw_data \
  --bootstrap-server localhost:9092

# Recreate fresh
docker-compose exec kafka kafka-topics.sh \
  --create \
  --topic element.raw_data \
  --partitions 1 \
  --replication-factor 1 \
  --bootstrap-server localhost:9092 \
  --config retention.ms=604800000 \
  --config compression.type=snappy
```

---

### Issue: Consumer Lag Growing

**Error Message**: Offsets not advancing, or in logs:

```text
fetchTopicOffsets returned stale metadata
```

**Diagnostic**:

```bash
# Check consumer lag
docker-compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group cosmic-horizons-array-element \
  --describe

# Output:
# GROUP                            TOPIC              PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
# cosmic-horizons-array-element   element.raw_data   0          350000          354000          4000
# ↑ If LAG > 0 and growing, consumer is behind
```

**Solution**:

```bash
# Check if consumer is running
# Restart consumer (application restart)
docker-compose restart cosmic-horizons-api

# Reset offset to latest (danger: data loss)
docker-compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group cosmic-horizons-array-element \
  --reset-offsets \
  --to-latest \
  --execute

# Monitor in real-time
docker-compose logs -f cosmic-horizons-api | grep -i kafka
```

---

### Issue: Partition Rebalancing / Errors

**Error Message**:

```text
[1] Error when syncing group coordinator: GROUP_COORDINATOR_NOT_AVAILABLE
```

**Cause**: Zookeeper unavailable, or broker joining/leaving cluster

**Solution**:

```bash
# Check Zookeeper status
docker-compose exec zookeeper \
  zkServer.sh status
# Output: Mode: leader or Mode: follower

# Restart coordination
docker-compose restart zookeeper
sleep 10
docker-compose restart kafka

# Monitor recovery
docker-compose logs kafka | grep -E "rebalance|coordinator"
```

---

## Infrastructure Monitoring Issues

### Issue: Monitor Service Can't Connect

**Error Message**:

```text
MessagingMonitorService - Kafka monitor failed: connect ECONNREFUSED
```

**Cause**: Monitor service can't reach infrastructure APIs

**Diagnostic**:

```bash
# Test RabbitMQ Management API
curl http://localhost:15672/api/connections \
  -u guest:guest -v

# Test Kafka Admin
docker-compose exec kafka kafka-admin-configs.sh \
  --bootstrap-server localhost:9092 \
  --describe

# Test PostgreSQL
psql -h localhost -p 15432 -U cosmic_horizons_user -d cosmic_horizons \
  -c "SELECT 1"

# Test Redis
redis-cli -h localhost -p 6379 -n 0 ping
```

**Solution**:

```bash
# Verify all services are running
docker-compose ps

# Ensure network connectivity
docker-compose exec cosmic-horizons-api ping rabbitmq
docker-compose exec cosmic-horizons-api ping kafka

# Check firewall/iptables
sudo iptables -L -n | grep 5672  # RabbitMQ
sudo iptables -L -n | grep 9092  # Kafka
```

---

### Issue: High Monitor Latency

**Symptom**: `infra.rabbitmq.latencyMs` or `infra.kafka.latencyMs` > 1000ms

**Cause**: Network congestion, broker overload, or DNS resolution issues

**Solution**:

```bash
# Measure network latency
docker run --rm alpine/fluentd:latest-onbuild \
  ping -c 10 rabbitmq

# Check broker performance
docker-compose exec rabbitmq \
  rabbitmqctl list_queues name messages memory

# Reduce monitoring poll frequency (if acceptable)
# Edit messaging-monitor.service.ts:
// const POLL_INTERVAL_MS = 5000;  // Increase from 2000 to reduce CPU

# Increase resource limits
docker-compose.yml:
  cosmic-horizons-api:
    resources:
      limits:
        cpus: '2'
        memory: 2G
```

---

## Data Loss / Durability Issues

### Issue: Messages Lost After Restart

**Symptom**: Queue depth resets to 0 or offsets rewind

**Cause**: Non-durable queues or topic retention policy

**Solution**:

```bash
# For RabbitMQ: Enable durability
docker-compose exec rabbitmq \
  rabbitmqctl set_policy -p / durability \
  "element_telemetry_queue" \
  '{"durable": true}'

# For Kafka: Check retention policy
docker-compose exec kafka kafka-configs.sh \
  --bootstrap-server localhost:9092 \
  --entity-type topics \
  --entity-name element.raw_data \
  --describe

# Adjust retention if needed
docker-compose exec kafka kafka-configs.sh \
  --bootstrap-server localhost:9092 \
  --entity-type topics \
  --entity-name element.raw_data \
  --alter \
  --add-config retention.ms=604800000  # 7 days
```

---

## Performance & Tuning Issues

### Issue: Low Throughput

**Symptom**: `packetsPerSecond` < 100 when expecting 600+

**Diagnostic**:

```bash
# Check CPU usage
docker stats cosmic-horizons-api --no-stream

# Monitor message flow
docker-compose exec kafka kafka-consumer-perf-test.sh \
  --bootstrap-server localhost:9092 \
  --topic element.raw_data \
  --messages 10000 \
  --threads 1

# Check queue depth
curl http://localhost:15672/api/queues/%2F/element_telemetry_queue \
  -u guest:guest | jq '{messages, consumers, idle_since}'
```

**Solution**:

```bash
# Scale producer threads
# Edit messaging.service.ts:
this.simulationSubscription = interval(50).subscribe(() => {  // Reduce interval
  // Emit elements in parallel
  this.elements.forEach((e, idx) => {
    setTimeout(() => { /* emit */ }, (idx / n) * 50);
  });
});

# Increase broker resources
docker-compose.yml:
  rabbitmq:
    environment:
      RABBITMQ_CHANNEL_MAX: 4096

  kafka:
    environment:
      KAFKA_NUM_NETWORK_THREADS: 16

# Batch emit instead of one-by-one
const batch = this.elements.slice(0, 10);
this.kafkaClient.emit('element.raw_data', batch);
```

---

### Issue: Memory Leak / Growing Memory Usage

**Symptom**: Pod memory steadily increases, eventually OOMKilled

**Diagnostic**:

```bash
# Monitor memory over time
docker stats cosmic-horizons-api --no-stream --interval 5 | \
  awk '{print $7, $5}' | tee memory.log

# Check for subscription leaks in code
grep -r "subscribe(" apps/cosmic-horizons-api/src/app/messaging/ | \
  grep -v "unsubscribe"  # ← Check for missing cleanup

# Heap snapshot
docker-compose exec cosmic-horizons-api \
  node --inspect=0.0.0.0:9229 dist/main.js
# Then connect Chrome DevTools
```

**Solution**:

```typescript
// Ensure all subscriptions are unsubscribed
onModuleDestroy() {
  this.telemetrySubscription?.unsubscribe();   // ← Add if missing
  this.statsSubscription?.unsubscribe();       // ← Add if missing
  this.rfiSubscription?.unsubscribe();         // ← Add if missing
  // No subscriptions should remain!
}

// Use takeUntil pattern for safety
import { takeUntil } from 'rxjs/operators';

private destroy$ = new Subject<void>();

onModuleInit() {
  this.messagingService.telemetry$
    .pipe(takeUntil(this.destroy$))
    .subscribe(/* ... */);
}

onModuleDestroy() {
  this.destroy$.next();
  this.destroy$.complete();
}
```

---

## WebSocket / Real-time Issues

### Issue: Clients Not Receiving Updates

**Symptom**: WebSocket connected but `telemetry_update` not arriving

**Diagnostic**:

```javascript
// Browser console
socket.on('connect', () => console.log('Connected'));
socket.on('telemetry_update', (p) => console.log('Packet:', p));
socket.on('stats_update', (s) => console.log('Stats:', s));
socket.on('disconnect', (r) => console.log('Disconnected:', r));
socket.on_error = (e) => console.error('Error:', e);
```

**Solution**:

```bash
# Check Gateway is running
docker-compose logs cosmic-horizons-api | grep "Messaging.*Gateway"

# Verify WebSocket upgrade
curl -i -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  http://localhost:3000/socket.io/ 2>&1 | head -20

# Check for port conflicts
netstat -tulpn | grep 3000

# Restart API
docker-compose restart cosmic-horizons-api
```

---

### Issue: High WebSocket Memory Usage

**Symptom**: Socket.IO connections consuming excessive memory

**Solution**:

```typescript
// Limits in messaging.gateway.ts
@WebSocketGateway({
  cors: { origin: '*' },
  maxHttpBufferSize: 1e6,        // ← Limit message size
  transports: ['websocket'],      // ← Disable polling fallback
  namespace: 'messaging',
  pingInterval: 25000,            // ← Keep-alive interval
  pingTimeout: 60000,             // ← Timeout before disconnect
})
export class MessagingGateway { ... }

// Cleaner disconnection
handleDisconnect(client: Socket) {
  this.logger.log(`Client disconnected: ${client.id}`);
  // Force cleanup
  client.removeAllListeners();
}
```

---

## Database / Storage Issues

### Issue: PostgreSQL Connection Timeout

**Error Message**:

```text
could not connect to server: Connection timed out
```

**Diagnostic**:

```bash
# Check PostgreSQL service
docker-compose ps | grep postgres

# Test connection directly
docker-compose exec postgres \
  psql -U cosmic_horizons_user -d cosmic_horizons -c "SELECT 1"

# Check logs
docker-compose logs postgres | tail -50
```

**Solution**:

```bash
# Increase timeout
export PGCONNECTTIMEOUT=30
psql -h localhost -p 15432 -U cosmic_horizons_user

# Restart database
docker-compose down postgres
docker volume rm cosmic-horizons_postgres-data  # WARNING: data loss
docker-compose up -d postgres

# Wait for initialization
sleep 30
docker-compose exec postgres psql -U postgres -c "SELECT version();"
```

---

### Issue: Redis Connection Error

**Error Message**:

```text
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution**:

```bash
# Start Redis
docker-compose up -d redis

# Test connection
redis-cli ping
# Output: PONG

# Check persistence
redis-cli info persistence

# Clear if corrupted
docker-compose exec redis redis-cli FLUSHALL
```

---

## Kubernetes-Specific Issues

### Issue: Pod CrashLoopBackOff

**Diagnostic**:

```bash
# Check logs
kubectl logs -f deployment/cosmic-horizons-api --namespace=default

# Check events
kubectl describe pod <pod-name> --namespace=default

# Get exit code
kubectl get pod <pod-name> -o jsonpath='{.status.containerStatuses[0].lastState}'
```

**Solution**:

```bash
# Ensure RabbitMQ is running
kubectl get pods -l app=rabbitmq

# Check connectivity between namespaces
kubectl exec -it <pod-name> -- ping rabbitmq-service.management-plane

# Adjust startup probe
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: api
    startupProbe:
      httpGet:
        path: /api/health
        port: 3000
      failureThreshold: 30    # ← Allow more time
      periodSeconds: 10
```

---

## Useful Monitoring Commands

```bash
# Real-time stats dashboard
watch -n 1 'curl -s http://localhost:3000/api/messaging/stats | jq ".infra"'

# Monitor all messaging topics
docker-compose exec kafka \
  kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --list | xargs -I {} \
  kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group {} \
  --describe

# RabbitMQ queue summary
curl -s http://localhost:15672/api/queues -u guest:guest | \
  jq '.[] | {name, messages, consumers}'

# Element status snapshot
curl -s http://localhost:3000/api/messaging/elements \
  -H "Authorization: Bearer <token>" | \
  jq 'group_by(.status) | map({status: .[0].status, count: length})'
```

---

## Getting Help

1. **Check Logs**:

   ```bash
   docker-compose logs --tail=100 <service>
   ```

2. **Enable Debug Mode**:

   ```bash
   export DEBUG=messaging:*
   docker-compose up cosmic-horizons-api
   ```

3. **Consult Architecture**:
   - [MESSAGING-ARCHITECTURE.md](./MESSAGING-ARCHITECTURE.md)

4. **Open Issues**:
   - GitHub: cosmic-horizons/issues
   - Document symptoms and steps to reproduce

## References

- [MESSAGING-ARCHITECTURE.md](./MESSAGING-ARCHITECTURE.md)
- [KAFKA-SETUP.md](./KAFKA-SETUP.md)
- [RABBITMQ-SETUP.md](./RABBITMQ-SETUP.md)
- [ARRAY-MONITORING-API.md](./ARRAY-MONITORING-API.md)
