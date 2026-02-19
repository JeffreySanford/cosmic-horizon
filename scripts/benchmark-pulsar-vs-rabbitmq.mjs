#!/usr/bin/env node

/**
 * Performance Benchmark: RabbitMQ vs Pulsar
 *
 * Tests both message brokers with identical workloads:
 * - Job submission events (same schema)
 * - Status update events
 * - Throughput, latency, and memory consumption
 *
 * Usage: node scripts/benchmark-pulsar-vs-rabbitmq.mjs
 *
 * Prerequisites:
 * - docker-compose.events.yml running (includes Pulsar)
 * - RabbitMQ: localhost:5672
 * - Pulsar: localhost:6650 (broker protocol)
 */

import amqp from 'amqplib';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

let cachedPulsarClientCtor = null;
let pulsarClientLoadError = null;

async function getPulsarClientCtor() {
  if (cachedPulsarClientCtor || pulsarClientLoadError) {
    if (cachedPulsarClientCtor) {
      return cachedPulsarClientCtor;
    }
    throw pulsarClientLoadError;
  }

  try {
    const module = await import('pulsar-client');
    const pkg = module.default ?? module;
    cachedPulsarClientCtor = pkg.PulsarClient ?? pkg.Client ?? pkg;
    return cachedPulsarClientCtor;
  } catch (error) {
    pulsarClientLoadError = error;
    throw error;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(
  __dirname,
  '..',
  'test-output',
  'benchmark-results',
);

// Ensure results directory exists
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// ============================================================================
// Configuration
// ============================================================================

// Parse command line arguments
const args = process.argv.slice(2);
const messageCountArg = args
  .find((arg) => arg.startsWith('--messages='))
  ?.split('=')[1];
const stressTestArg = args.find((arg) => arg === '--stress-test');
const payloadKbArg = args
  .find((arg) => arg.startsWith('--payload-kb='))
  ?.split('=')[1];
const inflightArg = args
  .find((arg) => arg.startsWith('--inflight='))
  ?.split('=')[1];
const brokersArg = args
  .find((arg) => arg.startsWith('--brokers='))
  ?.split('=')[1];
const trialsArg = args
  .find((arg) => arg.startsWith('--trials='))
  ?.split('=')[1];
const seedArg = args.find((arg) => arg.startsWith('--seed='))?.split('=')[1];

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const isStressTest = Boolean(stressTestArg);
const payloadKb = toPositiveInt(payloadKbArg, isStressTest ? 64 : 2);
const inflight = toPositiveInt(inflightArg, isStressTest ? 3000 : 250);
const messageCount = toPositiveInt(
  messageCountArg,
  isStressTest ? 50000 : 10000,
);
const trials = toPositiveInt(trialsArg, 1);
const seed = toPositiveInt(seedArg, 42);
const requestedBrokers = (brokersArg ?? 'rabbitmq,pulsar')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter((value) => ['rabbitmq', 'pulsar', 'kafka'].includes(value));

const CONFIG = {
  messageCount,
  batchSize: isStressTest ? 500 : 100,
  warmupMessages: isStressTest ? 5000 : 1000,
  payloadKb,
  payloadBytes: payloadKb * 1024,
  inflight,
  trials,
  seed,
  brokers:
    requestedBrokers.length > 0 ? requestedBrokers : ['rabbitmq', 'pulsar'],

  rabbitmq: {
    url: 'amqp://guest:guest@localhost:5672',
    exchange: 'job.events.benchmark',
    queue: 'job-events-benchmark',
    routingKey: 'job.submitted.benchmark',
  },

  pulsar: {
    serviceUrl: 'pulsar://localhost:6650',
    topic: 'persistent://public/default/job-events-benchmark',
    namespace: 'public/default',
  },
};

function mulberry32(initialSeed) {
  let a = initialSeed >>> 0;
  return function next() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let currentRandom = mulberry32(CONFIG.seed);

function resetRandom(seedValue) {
  currentRandom = mulberry32(seedValue);
}

function randomInt(maxExclusive) {
  return Math.floor(currentRandom() * maxExclusive);
}

function percentile(values, p) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function median(values) {
  return percentile(values, 50);
}

// ============================================================================
// Test Payloads (simulating real job events)
// ============================================================================

function generateJobSubmittedEvent(index) {
  const syntheticPayload = 'X'.repeat(Math.max(0, CONFIG.payloadBytes - 1024));
  const timestampMs = Date.UTC(2026, 0, 1, 0, 0, 0) + index * 10;
  return {
    eventId: `evt-${CONFIG.seed}-${index}`,
    eventType: 'job.submitted',
    timestamp: new Date(timestampMs).toISOString(),
    jobId: `job-${Math.floor(index / 10)}-${index}`,
    userId: `user-${randomInt(100)}`,
    jobName: `Alpha-Cal-ngVLA-${index}`,
    computeResources: {
      gpuType: 'A100',
      gpuCount: 8,
      cpuCount: 64,
      memoryGb: 256,
    },
    metadata: {
      observationId: `obs-${Math.floor(index / 100)}`,
      targetName: 'M87',
      calibrationMode: 'direction-dependent',
      estimatedDuration: 14400,
      priority: randomInt(10),
    },
    syntheticPayload,
    sourceSystem: 'cosmic-horizons-api',
  };
}

// ============================================================================
// RabbitMQ Benchmark
// ============================================================================

async function benchmarkRabbitMQ() {
  console.log('\n' + '='.repeat(70));
  console.log('RABBITMQ BENCHMARK');
  console.log('='.repeat(70));

  let connection, channel;
  const results = {
    broker: 'RabbitMQ',
    testTime: new Date().toISOString(),
    config: CONFIG.rabbitmq,
    phases: {},
  };

  try {
    // Connect
    console.log('Connecting to RabbitMQ...');
    connection = await amqp.connect(CONFIG.rabbitmq.url);
    channel = await connection.createConfirmChannel();

    // Setup exchange and queue
    await channel.assertExchange(CONFIG.rabbitmq.exchange, 'topic', {
      durable: true,
    });
    const queueResult = await channel.assertQueue(CONFIG.rabbitmq.queue, {
      durable: true,
    });
    await channel.bindQueue(
      CONFIG.rabbitmq.queue,
      CONFIG.rabbitmq.exchange,
      CONFIG.rabbitmq.routingKey,
    );
    console.log(
      `✓ Connected. Queue messages before test: ${queueResult.messageCount}`,
    );

    // Phase 1: Publish throughput test
    console.log('\n[Phase 1] Publishing throughput test...');
    const pubStartMem = process.memoryUsage().heapUsed / 1024 / 1024;
    const pubStart = performance.now();

    for (let i = 0; i < CONFIG.messageCount; i++) {
      const event = generateJobSubmittedEvent(i);
      channel.publish(
        CONFIG.rabbitmq.exchange,
        CONFIG.rabbitmq.routingKey,
        Buffer.from(JSON.stringify(event)),
        { persistent: true, contentType: 'application/json' },
      );

      if ((i + 1) % CONFIG.batchSize === 0) {
        process.stdout.write(`\r  Published: ${i + 1}/${CONFIG.messageCount}`);
      }
    }

    await channel.waitForConfirms();
    const pubDuration = performance.now() - pubStart;
    const pubEndMem = process.memoryUsage().heapUsed / 1024 / 1024;

    results.phases.publish = {
      duration: pubDuration,
      messagesPerSecond: (CONFIG.messageCount / (pubDuration / 1000)).toFixed(
        2,
      ),
      memoryUsedMb: (pubEndMem - pubStartMem).toFixed(2),
      avgLatencyMs: (pubDuration / CONFIG.messageCount).toFixed(4),
    };

    console.log(`\n  ✓ Published ${CONFIG.messageCount} messages`);
    console.log(`  - Duration: ${pubDuration.toFixed(2)}ms`);
    console.log(
      `  - Throughput: ${results.phases.publish.messagesPerSecond} msg/s`,
    );
    console.log(`  - Memory used: ${results.phases.publish.memoryUsedMb} MB`);

    // Phase 2: Consume throughput test
    console.log('\n[Phase 2] Consuming throughput test...');
    const conStartMem = process.memoryUsage().heapUsed / 1024 / 1024;
    const conStart = performance.now();
    let consumedCount = 0;

    await new Promise((resolve) => {
      channel.consume(CONFIG.rabbitmq.queue, (msg) => {
        if (msg) {
          channel.ack(msg);
          consumedCount++;

          if (consumedCount % CONFIG.batchSize === 0) {
            process.stdout.write(
              `\r  Consumed: ${consumedCount}/${CONFIG.messageCount}`,
            );
          }

          if (consumedCount >= CONFIG.messageCount) {
            resolve();
          }
        }
      });
    });

    const conDuration = performance.now() - conStart;
    const conEndMem = process.memoryUsage().heapUsed / 1024 / 1024;

    results.phases.consume = {
      duration: conDuration,
      messagesPerSecond: (CONFIG.messageCount / (conDuration / 1000)).toFixed(
        2,
      ),
      memoryUsedMb: (conEndMem - conStartMem).toFixed(2),
      avgLatencyMs: (conDuration / CONFIG.messageCount).toFixed(4),
    };

    console.log(`\n  ✓ Consumed ${consumedCount} messages`);
    console.log(`  - Duration: ${conDuration.toFixed(2)}ms`);
    console.log(
      `  - Throughput: ${results.phases.consume.messagesPerSecond} msg/s`,
    );
    console.log(`  - Memory used: ${results.phases.consume.memoryUsedMb} MB`);

    // Cleanup
    await channel.deleteQueue(CONFIG.rabbitmq.queue);
    await channel.deleteExchange(CONFIG.rabbitmq.exchange);

    return results;
  } catch (error) {
    console.error('RabbitMQ benchmark error:', error.message);
    return null;
  } finally {
    if (channel) await channel.close();
    if (connection) await connection.close();
  }
}

// ============================================================================
// Pulsar Benchmark
// ============================================================================

async function benchmarkPulsar() {
  console.log('\n' + '='.repeat(70));
  console.log('PULSAR BENCHMARK');
  console.log('='.repeat(70));

  const results = {
    broker: 'Pulsar',
    testTime: new Date().toISOString(),
    config: CONFIG.pulsar,
    phases: {},
  };

  let client, producer, consumer;

  try {
    const PulsarClient = await getPulsarClientCtor();

    // Connect
    console.log('Connecting to Pulsar cluster...');
    client = new PulsarClient({
      serviceUrl: CONFIG.pulsar.serviceUrl,
    });
    console.log('✓ Connected to Pulsar cluster');

    // Phase 1: Publish throughput test
    console.log('\n[Phase 1] Publishing throughput test...');
    producer = await client.createProducer({
      topic: CONFIG.pulsar.topic,
      batchingEnabled: true,
      batchingMaxPublishDelayMs: 10,
      maxPendingMessages: 1000,
    });

    const pubStartMem = process.memoryUsage().heapUsed / 1024 / 1024;
    const pubStart = performance.now();

    const pending = [];
    for (let i = 0; i < CONFIG.messageCount; i++) {
      const event = generateJobSubmittedEvent(i);
      pending.push(
        producer.send({
          data: Buffer.from(JSON.stringify(event)),
        }),
      );

      if (pending.length >= CONFIG.inflight) {
        await Promise.all(pending.splice(0, pending.length));
      }

      if ((i + 1) % CONFIG.batchSize === 0) {
        process.stdout.write(`\r  Published: ${i + 1}/${CONFIG.messageCount}`);
      }
    }
    if (pending.length > 0) {
      await Promise.all(pending);
    }

    const pubDuration = performance.now() - pubStart;
    const pubEndMem = process.memoryUsage().heapUsed / 1024 / 1024;

    results.phases.publish = {
      duration: pubDuration,
      messagesPerSecond: (CONFIG.messageCount / (pubDuration / 1000)).toFixed(
        2,
      ),
      memoryUsedMb: (pubEndMem - pubStartMem).toFixed(2),
      avgLatencyMs: (pubDuration / CONFIG.messageCount).toFixed(4),
    };

    console.log(`\n  ✓ Published ${CONFIG.messageCount} messages`);
    console.log(`  - Duration: ${pubDuration.toFixed(2)}ms`);
    console.log(
      `  - Throughput: ${results.phases.publish.messagesPerSecond} msg/s`,
    );
    console.log(`  - Memory used: ${results.phases.publish.memoryUsedMb} MB`);

    await producer.flush();
    await producer.close();

    // Phase 2: Consume throughput test
    console.log('\n[Phase 2] Consuming throughput test...');
    consumer = await client.subscribe({
      topic: CONFIG.pulsar.topic,
      subscription: `benchmark-subscription-${Date.now()}`,
      subscriptionType: 'Exclusive',
      subscriptionInitialPosition: 'Earliest',
    });

    const conStartMem = process.memoryUsage().heapUsed / 1024 / 1024;
    const conStart = performance.now();
    let consumedCount = 0;

    while (consumedCount < CONFIG.messageCount) {
      const msg = await consumer.receive(5000); // 5s timeout
      if (msg) {
        await consumer.acknowledge(msg);
        consumedCount++;

        if (consumedCount % CONFIG.batchSize === 0) {
          process.stdout.write(
            `\r  Consumed: ${consumedCount}/${CONFIG.messageCount}`,
          );
        }
      }
    }

    const conDuration = performance.now() - conStart;
    const conEndMem = process.memoryUsage().heapUsed / 1024 / 1024;

    results.phases.consume = {
      duration: conDuration,
      messagesPerSecond: (CONFIG.messageCount / (conDuration / 1000)).toFixed(
        2,
      ),
      memoryUsedMb: (conEndMem - conStartMem).toFixed(2),
      avgLatencyMs: (conDuration / CONFIG.messageCount).toFixed(4),
    };

    console.log(`\n  ✓ Consumed ${consumedCount} messages`);
    console.log(`  - Duration: ${conDuration.toFixed(2)}ms`);
    console.log(
      `  - Throughput: ${results.phases.consume.messagesPerSecond} msg/s`,
    );
    console.log(`  - Memory used: ${results.phases.consume.memoryUsedMb} MB`);

    return results;
  } catch (error) {
    console.error('Pulsar benchmark error:', error.message);
    console.error(
      'Note: Ensure Pulsar is running with: docker compose -f docker-compose.yml -f docker-compose.events.yml up',
    );
    return null;
  } finally {
    if (consumer) await consumer.close();
    if (client) await client.close();
  }
}

// ============================================================================
// Kafka Benchmark (new)
// ============================================================================
async function benchmarkKafka() {
  console.log('\n' + '='.repeat(70));
  console.log('KAFKA BENCHMARK');
  console.log('='.repeat(70));

  const results = {
    broker: 'Kafka',
    testTime: new Date().toISOString(),
    config: {},
    phases: {},
  };

  let kafkaAdmin = null;
  let producer = null;
  let consumer = null;

  try {
    const { Kafka, CompressionTypes } = await import('kafkajs');
    const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092')
      .split(',')
      .map((b) => b.trim());
    const kafka = new Kafka({
      clientId: 'benchmark-script',
      brokers,
      retry: { retries: 5 },
    });

    kafkaAdmin = kafka.admin();
    await kafkaAdmin.connect();
    const topic = 'job-events-benchmark';

    // Ensure topic exists (idempotent)
    try {
      await kafkaAdmin.createTopics({
        topics: [{ topic, numPartitions: 3, replicationFactor: 1 }],
        waitForLeaders: true,
      });
    } catch (e) {
      // ignore topic already exists or creation issues in dev environments
    }

    // Producer: publish messages
    producer = kafka.producer();
    await producer.connect();

    const pubStartMem = process.memoryUsage().heapUsed / 1024 / 1024;
    const pubStart = performance.now();

    let batch = [];
    for (let i = 0; i < CONFIG.messageCount; i++) {
      const event = generateJobSubmittedEvent(i);
      batch.push({
        key: `evt-${CONFIG.seed}-${i}`,
        value: JSON.stringify(event),
      });

      if (batch.length >= Math.min(CONFIG.batchSize, CONFIG.inflight)) {
        await producer.send({
          topic,
          messages: batch,
          compression: CompressionTypes.GZIP,
        });
        batch = [];
      }

      if ((i + 1) % CONFIG.batchSize === 0) {
        process.stdout.write(`\r  Published: ${i + 1}/${CONFIG.messageCount}`);
      }
    }
    if (batch.length > 0) {
      await producer.send({
        topic,
        messages: batch,
        compression: CompressionTypes.GZIP,
      });
      batch = [];
    }

    const pubDuration = performance.now() - pubStart;
    const pubEndMem = process.memoryUsage().heapUsed / 1024 / 1024;

    results.phases.publish = {
      duration: pubDuration,
      messagesPerSecond: (CONFIG.messageCount / (pubDuration / 1000)).toFixed(
        2,
      ),
      memoryUsedMb: (pubEndMem - pubStartMem).toFixed(2),
      avgLatencyMs: (pubDuration / CONFIG.messageCount).toFixed(4),
    };

    console.log(`\n  ✓ Published ${CONFIG.messageCount} messages`);
    console.log(`  - Duration: ${pubDuration.toFixed(2)}ms`);
    console.log(
      `  - Throughput: ${results.phases.publish.messagesPerSecond} msg/s`,
    );
    console.log(`  - Memory used: ${results.phases.publish.memoryUsedMb} MB`);

    // Consumer: subscribe and consume messages
    consumer = kafka.consumer({ groupId: `benchmark-consumer-${Date.now()}` });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });

    let consumedCount = 0;
    const conStartMem = process.memoryUsage().heapUsed / 1024 / 1024;
    const conStart = performance.now();

    const maxWaitMs = 30000; // safety timeout per test
    let finished = false;

    await consumer.run({
      eachMessage: async () => {
        consumedCount++;
        if (consumedCount % CONFIG.batchSize === 0) {
          process.stdout.write(
            `\r  Consumed: ${consumedCount}/${CONFIG.messageCount}`,
          );
        }
        if (consumedCount >= CONFIG.messageCount && !finished) {
          finished = true;
          // give the loop a tick then disconnect the consumer
          setTimeout(() => {
            consumer.disconnect().catch(() => undefined);
          }, 0);
        }
      },
    });

    // wait until consumption completes or times out
    const startWait = Date.now();
    while (!finished && Date.now() - startWait < maxWaitMs) {
      // small sleep
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 50));
    }

    const conDuration = performance.now() - conStart;
    const conEndMem = process.memoryUsage().heapUsed / 1024 / 1024;

    results.phases.consume = {
      duration: conDuration,
      messagesPerSecond: (CONFIG.messageCount / (conDuration / 1000)).toFixed(
        2,
      ),
      memoryUsedMb: (conEndMem - conStartMem).toFixed(2),
      avgLatencyMs: (conDuration / CONFIG.messageCount).toFixed(4),
    };

    console.log(`\n  ✓ Consumed ${consumedCount} messages`);
    console.log(`  - Duration: ${conDuration.toFixed(2)}ms`);
    console.log(
      `  - Throughput: ${results.phases.consume.messagesPerSecond} msg/s`,
    );
    console.log(`  - Memory used: ${results.phases.consume.memoryUsedMb} MB`);

    return results;
  } catch (error) {
    console.error('Kafka benchmark error:', error?.message ?? String(error));
    return null;
  } finally {
    try {
      if (producer) await producer.disconnect();
    } catch (_) {}
    try {
      if (consumer) await consumer.disconnect();
    } catch (_) {}
    try {
      if (kafkaAdmin) await kafkaAdmin.disconnect();
    } catch (_) {}
  }
}

// ============================================================================
// Results Comparison & Reporting
// ============================================================================

function compareResults(rabbitmqResults, pulsarResults, kafkaResults) {
  console.log('\n' + '='.repeat(70));
  console.log('COMPARATIVE ANALYSIS');
  console.log('='.repeat(70));

  if (!rabbitmqResults) {
    console.log('⚠ Could not compare results - RabbitMQ benchmark missing');
    return;
  }

  const metrics = ['publish', 'consume'];

  for (const metric of metrics) {
    console.log(`\n[${metric.toUpperCase()}]`);

    const rmq = rabbitmqResults?.phases[metric];
    const pulsar = pulsarResults?.phases[metric];
    const kafka = kafkaResults?.phases[metric];

    console.log('\n  RabbitMQ:');
    if (rmq) {
      console.log(`    Throughput: ${rmq.messagesPerSecond} msg/s`);
      console.log(`    Avg Latency: ${rmq.avgLatencyMs} ms/msg`);
      console.log(`    Memory: ${rmq.memoryUsedMb} MB`);
    } else {
      console.log('    <no data>');
    }

    if (pulsar) {
      console.log('\n  Pulsar:');
      console.log(`    Throughput: ${pulsar.messagesPerSecond} msg/s`);
      console.log(`    Avg Latency: ${pulsar.avgLatencyMs} ms/msg`);
      console.log(`    Memory: ${pulsar.memoryUsedMb} MB`);
    }

    if (kafka) {
      console.log('\n  Kafka:');
      console.log(`    Throughput: ${kafka.messagesPerSecond} msg/s`);
      console.log(`    Avg Latency: ${kafka.avgLatencyMs ?? 'N/A'} ms/msg`);
      console.log(`    Memory: ${kafka.memoryUsedMb} MB`);
    }

    // Compute deltas vs RabbitMQ when both sides exist
    if (rmq && pulsar) {
      const throughputImprovement = (
        ((pulsar.messagesPerSecond - rmq.messagesPerSecond) /
          rmq.messagesPerSecond) *
        100
      ).toFixed(2);
      const latencyImprovement = (
        ((rmq.avgLatencyMs - pulsar.avgLatencyMs) / rmq.avgLatencyMs) *
        100
      ).toFixed(2);
      const memoryImprovement = (
        ((rmq.memoryUsedMb - pulsar.memoryUsedMb) / rmq.memoryUsedMb) *
        100
      ).toFixed(2);

      console.log(`\n  Pulsar vs RabbitMQ:`);
      console.log(
        `    Throughput: ${throughputImprovement > 0 ? '+' : ''}${throughputImprovement}%`,
      );
      console.log(
        `    Latency: ${latencyImprovement > 0 ? '+' : ''}${latencyImprovement}%`,
      );
      console.log(
        `    Memory: ${memoryImprovement > 0 ? '+' : ''}${memoryImprovement}%`,
      );
    }

    if (rmq && kafka) {
      const throughputImprovementK = (
        ((kafka.messagesPerSecond - rmq.messagesPerSecond) /
          rmq.messagesPerSecond) *
        100
      ).toFixed(2);
      const memoryImprovementK = (
        ((rmq.memoryUsedMb - kafka.memoryUsedMb) / rmq.memoryUsedMb) *
        100
      ).toFixed(2);

      console.log(`\n  Kafka vs RabbitMQ:`);
      console.log(
        `    Throughput: ${throughputImprovementK > 0 ? '+' : ''}${throughputImprovementK}%`,
      );
      console.log(
        `    Memory: ${memoryImprovementK > 0 ? '+' : ''}${memoryImprovementK}%`,
      );
    }
  }
}

function summarizeTrials(allTrialResults) {
  console.log('\n' + '='.repeat(70));
  console.log('TRIAL SUMMARY (MEDIAN / P95)');
  console.log('='.repeat(70));

  const brokerNames = ['rabbitmq', 'kafka', 'pulsar'];
  for (const brokerName of brokerNames) {
    const trialBrokerResults = allTrialResults
      .map((result) => result[brokerName])
      .filter(Boolean);
    if (trialBrokerResults.length === 0) continue;

    for (const phase of ['publish', 'consume']) {
      const throughputs = trialBrokerResults.map((result) =>
        Number(result.phases[phase].messagesPerSecond),
      );
      const latencies = trialBrokerResults.map((result) =>
        Number(result.phases[phase].avgLatencyMs || 0),
      );

      const throughputMedian = median(throughputs);
      const throughputP95 = percentile(throughputs, 95);
      const latencyMedian = median(latencies);
      const latencyP95 = percentile(latencies, 95);

      console.log(
        `${brokerName.toUpperCase()} ${phase.toUpperCase()} throughput median/p95: ${throughputMedian?.toFixed(2)} / ${throughputP95?.toFixed(2)} msg/s`,
      );
      console.log(
        `${brokerName.toUpperCase()} ${phase.toUpperCase()} latency median/p95: ${latencyMedian?.toFixed(4)} / ${latencyP95?.toFixed(4)} ms/msg`,
      );
    }
  }
}

function saveResults(rabbitmqResults, pulsarResults, kafkaResults) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `benchmark-${timestamp}.json`;
  const filepath = path.join(resultsDir, filename);

  const data = {
    testMetadata: {
      timestamp: new Date().toISOString(),
      messageCount: CONFIG.messageCount,
      batchSize: CONFIG.batchSize,
      payloadKb: CONFIG.payloadKb,
      inflight: CONFIG.inflight,
      trials: CONFIG.trials,
      seed: CONFIG.seed,
      brokers: CONFIG.brokers,
    },
    results: {
      rabbitmq: rabbitmqResults,
      kafka: kafkaResults,
      pulsar: pulsarResults,
    },
  };

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`\n✓ Results saved to: ${filepath}`);
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const testType = isStressTest ? 'STRESS TEST' : 'STANDARD BENCHMARK';

  console.log('\n' + '='.repeat(70));
  console.log(`COSMIC HORIZONS: RabbitMQ vs Pulsar ${testType}`);
  console.log('='.repeat(70));
  console.log(`Test Configuration:`);
  console.log(`  Messages per test: ${CONFIG.messageCount.toLocaleString()}`);
  console.log(`  Batch size: ${CONFIG.batchSize}`);
  console.log(`  Payload size: ~${CONFIG.payloadKb} KB`);
  console.log(
    `  In-flight publish window: ${CONFIG.inflight.toLocaleString()}`,
  );
  console.log(`  Selected brokers: ${CONFIG.brokers.join(', ')}`);
  console.log(`  Trials: ${CONFIG.trials}`);
  console.log(`  Replay seed: ${CONFIG.seed}`);
  console.log(
    `  Test type: ${isStressTest ? 'High Load Stress Test' : 'Standard Performance'}`,
  );

  try {
    const allTrialResults = [];
    let lastRabbitmqResults = null;
    let lastPulsarResults = null;

    for (let trial = 1; trial <= CONFIG.trials; trial++) {
      console.log(`\n--- Trial ${trial}/${CONFIG.trials} ---`);
      resetRandom(CONFIG.seed);
      let rabbitmqResults = null;
      let pulsarResults = null;
      let kafkaResults = null;

      if (CONFIG.brokers.includes('rabbitmq')) {
        rabbitmqResults = await benchmarkRabbitMQ();
      }

      if (CONFIG.brokers.includes('pulsar')) {
        pulsarResults = await benchmarkPulsar();
      }

      if (CONFIG.brokers.includes('kafka')) {
        kafkaResults = await benchmarkKafka();
      }

      allTrialResults.push({
        rabbitmq: rabbitmqResults,
        kafka: kafkaResults,
        pulsar: pulsarResults,
      });

      lastRabbitmqResults = rabbitmqResults;
      lastPulsarResults = pulsarResults;
      var lastKafkaResults = kafkaResults;

      compareResults(rabbitmqResults, pulsarResults, kafkaResults);
    }

    summarizeTrials(allTrialResults);
    saveResults(lastRabbitmqResults, lastPulsarResults, lastKafkaResults);

    console.log('\n' + '='.repeat(70));
    console.log('Benchmark completed successfully!');
    console.log('='.repeat(70));
  } catch (error) {
    console.error('\nFatal error during benchmark:', error);
    process.exit(1);
  }
}

main().catch(console.error);
