#!/usr/bin/env node

import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import Redis from 'ioredis';

const config = {
  rabbit: {
    host: process.env.RABBITMQ_HOST ?? 'localhost',
    port: Number(process.env.RABBITMQ_MANAGEMENT_PORT ?? 15672),
    user: process.env.RABBITMQ_USER ?? 'guest',
    pass: process.env.RABBITMQ_PASS ?? 'guest',
    queue: process.env.RABBITMQ_QUEUE ?? 'element_telemetry_queue',
  },
  kafka: {
    host: process.env.KAFKA_HOST ?? 'localhost',
    port: Number(process.env.KAFKA_PORT ?? 9092),
    topic: process.env.KAFKA_TOPIC ?? 'element.raw_data',
  },
  postgres: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 15432),
    user: process.env.DB_USER ?? 'cosmic_horizons_user',
    password: process.env.DB_PASSWORD ?? 'cosmic_horizons_password_dev',
    database: process.env.DB_NAME ?? 'cosmic_horizons',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD ?? 'cosmic_horizons_redis_dev',
  },
  intervalMs: Number(process.env.MONITOR_INTERVAL_MS ?? 2000),
};

const kafka = new Kafka({
  clientId: 'cosmic-horizons-monitor-script',
  brokers: [`${config.kafka.host}:${config.kafka.port}`],
});
const kafkaAdmin = kafka.admin();

const postgres = new Pool({
  host: config.postgres.host,
  port: config.postgres.port,
  user: config.postgres.user,
  password: config.postgres.password,
  database: config.postgres.database,
  max: 2,
  idleTimeoutMillis: 1000,
  connectionTimeoutMillis: 1500,
});

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

function nowIso() {
  return new Date().toISOString();
}

async function monitorRabbit() {
  const started = Date.now();
  const path = encodeURIComponent('/').replace('%2F', '%2F');
  const url = `http://${config.rabbit.host}:${config.rabbit.port}/api/queues/${path}/${config.rabbit.queue}`;
  const auth = Buffer.from(`${config.rabbit.user}:${config.rabbit.pass}`).toString('base64');

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const queue = await response.json();
    return {
      connected: true,
      latencyMs: Date.now() - started,
      queueDepth: queue.messages ?? 0,
      consumers: queue.consumers ?? 0,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: null,
      queueDepth: null,
      consumers: null,
      error: error.message,
    };
  }
}

async function monitorKafka() {
  const started = Date.now();
  try {
    await kafkaAdmin.connect();
    const offsets = await kafkaAdmin.fetchTopicOffsets(config.kafka.topic);
    const latestOffset = offsets.reduce((total, item) => total + Number(item.offset), 0);
    return {
      connected: true,
      latencyMs: Date.now() - started,
      latestOffset,
      partitions: offsets.length,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: null,
      latestOffset: null,
      partitions: null,
      error: error.message,
    };
  } finally {
    try {
      await kafkaAdmin.disconnect();
    } catch {
      // no-op
    }
  }
}

async function monitorPostgres() {
  const started = Date.now();
  try {
    await postgres.query('SELECT 1');
    return {
      connected: true,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: null,
      error: error.message,
    };
  }
}

async function monitorRedis() {
  const started = Date.now();
  try {
    if (redis.status !== 'ready') {
      await redis.connect();
    }
    await redis.ping();
    return {
      connected: true,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: null,
      error: error.message,
    };
  }
}

async function runOnce() {
  const [rabbitmq, kafkaResult, postgresResult, redisResult] = await Promise.all([
    monitorRabbit(),
    monitorKafka(),
    monitorPostgres(),
    monitorRedis(),
  ]);

  const snapshot = {
    at: nowIso(),
    rabbitmq,
    kafka: kafkaResult,
    storage: {
      postgres: postgresResult,
      redis: redisResult,
    },
  };

  process.stdout.write(`${JSON.stringify(snapshot)}\n`);
}

let timer;
async function start() {
  await runOnce();
  timer = setInterval(() => {
    void runOnce();
  }, config.intervalMs);
}

async function stop() {
  if (timer) {
    clearInterval(timer);
  }
  try {
    await kafkaAdmin.disconnect();
  } catch {
    // no-op
  }
  try {
    await postgres.end();
  } catch {
    // no-op
  }
  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
  process.exit(0);
}

process.on('SIGINT', () => {
  void stop();
});
process.on('SIGTERM', () => {
  void stop();
});

void start();
