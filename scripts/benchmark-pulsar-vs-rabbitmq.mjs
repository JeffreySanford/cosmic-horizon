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
 * - Both docker-compose.events.yml and docker-compose.pulsar.yml running
 * - RabbitMQ: localhost:5672
 * - Pulsar: localhost:6650 (broker protocol)
 */

import amqp from 'amqplib';
import { PulsarClient } from 'pulsar-client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(__dirname, '..', 'test-output', 'benchmark-results');

// Ensure results directory exists
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  messageCount: 10000,
  batchSize: 100,
  warmupMessages: 1000,
  
  rabbitmq: {
    url: 'amqp://guest:guest@localhost:5672',
    exchange: 'job.events.benchmark',
    queue: 'job-events-benchmark',
    routingKey: 'job.submitted.benchmark'
  },
  
  pulsar: {
    serviceUrl: 'pulsar://localhost:6650',
    topic: 'persistent://public/default/job-events-benchmark',
    namespace: 'public/default'
  }
};

// ============================================================================
// Test Payloads (simulating real job events)
// ============================================================================

function generateJobSubmittedEvent(index) {
  return {
    eventId: `evt-${Date.now()}-${index}`,
    eventType: 'job.submitted',
    timestamp: new Date().toISOString(),
    jobId: `job-${Math.floor(index / 10)}-${index}`,
    userId: `user-${Math.floor(Math.random() * 100)}`,
    jobName: `Alpha-Cal-ngVLA-${index}`,
    computeResources: {
      gpuType: 'A100',
      gpuCount: 8,
      cpuCount: 64,
      memoryGb: 256
    },
    metadata: {
      observationId: `obs-${Math.floor(index / 100)}`,
      targetName: 'M87',
      calibrationMode: 'direction-dependent',
      estimatedDuration: 14400,
      priority: Math.floor(Math.random() * 10)
    },
    sourceSystem: 'cosmic-horizons-api'
  };
}

function generateStatusUpdateEvent(index, jobId) {
  return {
    eventId: `evt-${Date.now()}-${index}`,
    eventType: 'job.status.changed',
    timestamp: new Date().toISOString(),
    jobId: jobId,
    previousStatus: 'QUEUED',
    newStatus: 'RUNNING',
    executionNode: `compute-${Math.floor(Math.random() * 10)}`,
    metrics: {
      cpuUsage: Math.random() * 100,
      memoryUsage: Math.random() * 100,
      gpuUtilization: Math.random() * 100,
      networkBandwidth: Math.random() * 100
    },
    sourceSystem: 'cosmic-horizons-api'
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
    phases: {}
  };

  try {
    // Connect
    console.log('Connecting to RabbitMQ...');
    connection = await amqp.connect(CONFIG.rabbitmq.url);
    channel = await connection.createChannel();
    
    // Setup exchange and queue
    await channel.assertExchange(CONFIG.rabbitmq.exchange, 'topic', { durable: true });
    const queueResult = await channel.assertQueue(CONFIG.rabbitmq.queue, { durable: true });
    await channel.bindQueue(CONFIG.rabbitmq.queue, CONFIG.rabbitmq.exchange, CONFIG.rabbitmq.routingKey);
    console.log(`✓ Connected. Queue messages before test: ${queueResult.messageCount}`);

    // Phase 1: Publish throughput test
    console.log('\n[Phase 1] Publishing throughput test...');
    const pubStartMem = process.memoryUsage().heapUsed / 1024 / 1024;
    const pubStart = performance.now();
    
    for (let i = 0; i < CONFIG.messageCount; i++) {
      const event = generateJobSubmittedEvent(i);
      channel.publish(
        CONFIG.rabbitmq.exchange,
        CONFIG.rabbitmq.routingKey,
        Buffer.from(JSON.stringify(event))
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
      messagesPerSecond: (CONFIG.messageCount / (pubDuration / 1000)).toFixed(2),
      memoryUsedMb: (pubEndMem - pubStartMem).toFixed(2),
      avgLatencyMs: (pubDuration / CONFIG.messageCount).toFixed(4)
    };
    
    console.log(`\n  ✓ Published ${CONFIG.messageCount} messages`);
    console.log(`  - Duration: ${pubDuration.toFixed(2)}ms`);
    console.log(`  - Throughput: ${results.phases.publish.messagesPerSecond} msg/s`);
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
            process.stdout.write(`\r  Consumed: ${consumedCount}/${CONFIG.messageCount}`);
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
      messagesPerSecond: (CONFIG.messageCount / (conDuration / 1000)).toFixed(2),
      memoryUsedMb: (conEndMem - conStartMem).toFixed(2),
      avgLatencyMs: (conDuration / CONFIG.messageCount).toFixed(4)
    };

    console.log(`\n  ✓ Consumed ${consumedCount} messages`);
    console.log(`  - Duration: ${conDuration.toFixed(2)}ms`);
    console.log(`  - Throughput: ${results.phases.consume.messagesPerSecond} msg/s`);
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
    phases: {}
  };

  let client, producer, consumer;

  try {
    // Connect
    console.log('Connecting to Pulsar cluster...');
    client = new PulsarClient({
      serviceUrl: CONFIG.pulsar.serviceUrl
    });
    console.log('✓ Connected to Pulsar cluster');

    // Phase 1: Publish throughput test
    console.log('\n[Phase 1] Publishing throughput test...');
    producer = await client.createProducer({
      topic: CONFIG.pulsar.topic,
      batchingEnabled: true,
      batchingMaxPublishDelayMs: 10,
      maxPendingMessages: 1000
    });

    const pubStartMem = process.memoryUsage().heapUsed / 1024 / 1024;
    const pubStart = performance.now();

    for (let i = 0; i < CONFIG.messageCount; i++) {
      const event = generateJobSubmittedEvent(i);
      await producer.send({
        data: Buffer.from(JSON.stringify(event))
      });

      if ((i + 1) % CONFIG.batchSize === 0) {
        process.stdout.write(`\r  Published: ${i + 1}/${CONFIG.messageCount}`);
      }
    }

    const pubDuration = performance.now() - pubStart;
    const pubEndMem = process.memoryUsage().heapUsed / 1024 / 1024;

    results.phases.publish = {
      duration: pubDuration,
      messagesPerSecond: (CONFIG.messageCount / (pubDuration / 1000)).toFixed(2),
      memoryUsedMb: (pubEndMem - pubStartMem).toFixed(2),
      avgLatencyMs: (pubDuration / CONFIG.messageCount).toFixed(4)
    };

    console.log(`\n  ✓ Published ${CONFIG.messageCount} messages`);
    console.log(`  - Duration: ${pubDuration.toFixed(2)}ms`);
    console.log(`  - Throughput: ${results.phases.publish.messagesPerSecond} msg/s`);
    console.log(`  - Memory used: ${results.phases.publish.memoryUsedMb} MB`);

    await producer.flush();
    await producer.close();

    // Phase 2: Consume throughput test
    console.log('\n[Phase 2] Consuming throughput test...');
    consumer = await client.subscribe({
      topic: CONFIG.pulsar.topic,
      subscription: 'benchmark-subscription',
      subscriptionType: 'Exclusive'
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
          process.stdout.write(`\r  Consumed: ${consumedCount}/${CONFIG.messageCount}`);
        }
      }
    }

    const conDuration = performance.now() - conStart;
    const conEndMem = process.memoryUsage().heapUsed / 1024 / 1024;

    results.phases.consume = {
      duration: conDuration,
      messagesPerSecond: (CONFIG.messageCount / (conDuration / 1000)).toFixed(2),
      memoryUsedMb: (conEndMem - conStartMem).toFixed(2),
      avgLatencyMs: (conDuration / CONFIG.messageCount).toFixed(4)
    };

    console.log(`\n  ✓ Consumed ${consumedCount} messages`);
    console.log(`  - Duration: ${conDuration.toFixed(2)}ms`);
    console.log(`  - Throughput: ${results.phases.consume.messagesPerSecond} msg/s`);
    console.log(`  - Memory used: ${results.phases.consume.memoryUsedMb} MB`);

    return results;

  } catch (error) {
    console.error('Pulsar benchmark error:', error.message);
    console.error('Note: Ensure Pulsar is running with: docker compose -f docker-compose.events.yml -f docker-compose.pulsar.yml up');
    return null;
  } finally {
    if (consumer) await consumer.close();
    if (client) await client.close();
  }
}

// ============================================================================
// Results Comparison & Reporting
// ============================================================================

function compareResults(rabbitmqResults, pulsarResults) {
  console.log('\n' + '='.repeat(70));
  console.log('COMPARATIVE ANALYSIS');
  console.log('='.repeat(70));

  if (!rabbitmqResults || !pulsarResults) {
    console.log('⚠ Could not compare results - one or both benchmarks failed');
    return;
  }

  const metrics = ['publish', 'consume'];

  for (const metric of metrics) {
    console.log(`\n[${metric.toUpperCase()}]`);
    const rmq = rabbitmqResults.phases[metric];
    const pulsar = pulsarResults.phases[metric];

    console.log(`\n  RabbitMQ:`);
    console.log(`    Throughput: ${rmq.messagesPerSecond} msg/s`);
    console.log(`    Avg Latency: ${rmq.avgLatencyMs} ms/msg`);
    console.log(`    Memory: ${rmq.memoryUsedMb} MB`);

    console.log(`\n  Pulsar:`);
    console.log(`    Throughput: ${pulsar.messagesPerSecond} msg/s`);
    console.log(`    Avg Latency: ${pulsar.avgLatencyMs} ms/msg`);
    console.log(`    Memory: ${pulsar.memoryUsedMb} MB`);

    const throughputImprovement = ((pulsar.messagesPerSecond - rmq.messagesPerSecond) / rmq.messagesPerSecond * 100).toFixed(2);
    const latencyImprovement = ((rmq.avgLatencyMs - pulsar.avgLatencyMs) / rmq.avgLatencyMs * 100).toFixed(2);
    const memoryImprovement = ((rmq.memoryUsedMb - pulsar.memoryUsedMb) / rmq.memoryUsedMb * 100).toFixed(2);

    console.log(`\n  Performance Delta:`);
    console.log(`    Throughput: ${throughputImprovement > 0 ? '+' : ''}${throughputImprovement}% (Pulsar ${throughputImprovement > 0 ? 'faster' : 'slower'})`);
    console.log(`    Latency: ${latencyImprovement > 0 ? '+' : ''}${latencyImprovement}% (Pulsar ${latencyImprovement > 0 ? 'faster' : 'slower'})`);
    console.log(`    Memory: ${memoryImprovement > 0 ? '+' : ''}${memoryImprovement}% (Pulsar ${memoryImprovement > 0 ? 'efficient' : 'less efficient'})`);
  }
}

function saveResults(rabbitmqResults, pulsarResults) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `benchmark-${timestamp}.json`;
  const filepath = path.join(resultsDir, filename);

  const data = {
    testMetadata: {
      timestamp: new Date().toISOString(),
      messageCount: CONFIG.messageCount,
      batchSize: CONFIG.batchSize
    },
    results: {
      rabbitmq: rabbitmqResults,
      pulsar: pulsarResults
    }
  };

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`\n✓ Results saved to: ${filepath}`);
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('COSMIC HORIZONS: RabbitMQ vs Pulsar Performance Benchmark');
  console.log('='.repeat(70));
  console.log(`Test Configuration:`);
  console.log(`  Messages per test: ${CONFIG.messageCount}`);
  console.log(`  Batch size: ${CONFIG.batchSize}`);
  console.log(`  Payload size: ~1.5 KB (realistic job event)`);

  try {
    const rabbitmqResults = await benchmarkRabbitMQ();
    const pulsarResults = await benchmarkPulsar();

    compareResults(rabbitmqResults, pulsarResults);
    saveResults(rabbitmqResults, pulsarResults);

    console.log('\n' + '='.repeat(70));
    console.log('Benchmark completed successfully!');
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\nFatal error during benchmark:', error);
    process.exit(1);
  }
}

main().catch(console.error);
