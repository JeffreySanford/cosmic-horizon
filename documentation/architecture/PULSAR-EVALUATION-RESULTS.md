# Pulsar Evaluation Results

Date: 2026-02-17  
Environment: Local Docker (`docker-compose.yml` + `docker-compose.events.yml`) on Windows, single-node Pulsar standalone

## Scope Executed

- Brought up broker stack:
  - `docker compose -f docker-compose.yml -f docker-compose.events.yml up -d --wait`
- Provisioned Pulsar namespaces/topics:
  - `node scripts/pulsar-setup.mjs`
- Ran broker benchmark:
  - `node scripts/benchmark-pulsar-vs-rabbitmq.mjs`
- Primary artifact:
  - `test-output/benchmark-results/benchmark-2026-02-17T16-30-44-909Z.json`

## Benchmark Configuration

- Messages: 10,000
- Batch size: 100
- Payload: ~2 KB
- In-flight window: 250
- Trials: 1
- Seed: 42
- Brokers compared: RabbitMQ vs Pulsar

## Measured Results

### Publish

- RabbitMQ: `28,319.88 msg/s`, avg latency `0.0353 ms/msg`, memory delta `+9.74 MB`
- Pulsar: `7,791.04 msg/s`, avg latency `0.1284 ms/msg`, memory delta `+7.52 MB`
- Delta (Pulsar vs RabbitMQ):
  - Throughput: `-72.49%` (slower)
  - Latency: `-263.74%` (slower)
  - Memory delta: `+22.79%` lower allocation delta

### Consume

- RabbitMQ: `34,227.55 msg/s`, avg latency `0.0292 ms/msg`, memory delta `+1.44 MB`
- Pulsar: `27,015.37 msg/s`, avg latency `0.0370 ms/msg`, memory delta `-13.21 MB`
- Delta (Pulsar vs RabbitMQ):
  - Throughput: `-21.07%` (slower)
  - Latency: `-26.71%` (slower)
  - Memory delta: not reliable as a decision signal due to GC/noise and negative process-heap delta

## Assessment Against Target

Expected target for Pulsar evaluation was approximately:
- `+30-40%` throughput improvement
- `+20-30%` memory efficiency improvement

Current local run outcome:
- Throughput target: **not met**
- Latency target: **not met**
- Memory target: **inconclusive** (heap-delta method is noisy for decision-grade comparison)

## Notes and Limitations

- This run is local and single-node Pulsar standalone, not a clustered production-like Pulsar deployment.
- RabbitMQ path and Pulsar path use different client libraries and delivery mechanics; additional normalization is needed for apples-to-apples conclusions.
- The benchmark script was hardened during this run:
  - `scripts/pulsar-setup.mjs`: CommonJS/ESM client import compatibility and tolerant broker-stats check.
  - `scripts/benchmark-pulsar-vs-rabbitmq.mjs`: Pulsar consumer now uses unique subscription name and `Earliest` initial position to avoid timeout on reruns.

## Recommendation

- Keep Kafka/RabbitMQ as baseline for now.
- Do not make consolidation decision from this single local run.
- Next step for decision-quality comparison:
  - run multi-trial (`--trials=5`) benchmark,
  - run stress profile (`--stress-test`),
  - compare on equivalent clustered topology (not Pulsar standalone).
