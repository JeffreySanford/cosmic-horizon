#!/usr/bin/env node
import net from 'net';
import { spawnSync } from 'child_process';

const KAFKA_HOST = process.env.KAFKA_HOST || '127.0.0.1';
const KAFKA_PORT = Number(process.env.KAFKA_PORT || 9092);
const PULSAR_HOST = process.env.PULSAR_HOST || '127.0.0.1';
const PULSAR_PORT = Number(process.env.PULSAR_PORT || 6650);
const PULSAR_ADMIN = process.env.PULSAR_ADMIN_URL || 'http://127.0.0.1:8080';

function checkTcp(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const onOk = () => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(true);
    };
    const onFail = () => {
      if (done) return;
      done = true;
      try {
        sock.destroy();
      } catch (e) {}
      resolve(false);
    };
    sock.setTimeout(timeoutMs);
    sock.once('connect', onOk);
    sock.once('error', onFail);
    sock.once('timeout', onFail);
    sock.connect(port, host);
  });
}

async function checkKafkaWithKafkajs() {
  try {
    const { Kafka } = await import('kafkajs');
    console.log('kafkajs available — attempting admin metadata request');
    const kafka = new Kafka({
      brokers: [`${KAFKA_HOST}:${KAFKA_PORT}`],
      clientId: 'ch-check-messaging',
    });
    const admin = kafka.admin();
    await admin.connect();
    const topics = await admin.listTopics();
    console.log('Kafka topics:', topics.slice(0, 50));
    await admin.disconnect();
    return true;
  } catch (e) {
    console.warn('kafkajs not available or metadata failed:', e.message || e);
    return false;
  }
}

async function checkPulsarAdmin() {
  try {
    const fetch = (await import('node-fetch')).default;
    const url = `${PULSAR_ADMIN}/admin/v2/clusters`;
    const res = await fetch(url, { timeout: 3000 });
    if (!res.ok) {
      console.warn('Pulsar admin returned', res.status);
      return false;
    }
    const json = await res.json();
    console.log('Pulsar admin clusters:', json);
    return true;
  } catch (e) {
    console.warn('Pulsar admin check failed:', e.message || e);
    return false;
  }
}

const REQUIRED_KAFKA_TOPICS = (process.env.REQUIRED_KAFKA_TOPICS &&
  process.env.REQUIRED_KAFKA_TOPICS.split(',')) || [
  'job-metrics',
  'job-lifecycle',
  'audit-trail',
  'system-health',
];

async function main() {
  console.log(`Checking Kafka TCP ${KAFKA_HOST}:${KAFKA_PORT}...`);
  const kafkaTcp = await checkTcp(KAFKA_HOST, KAFKA_PORT);
  if (!kafkaTcp) {
    console.error('Kafka TCP connect failed');
  } else {
    console.log('Kafka TCP reachable');
  }

  let kafkaDeep = false;
  if (kafkaTcp) {
    kafkaDeep = await checkKafkaWithKafkajs();
  }

  // If kafkajs returned topic list, enforce required topics
  if (kafkaDeep) {
    try {
      const { Kafka } = await import('kafkajs');
      const kafka = new Kafka({
        brokers: [`${KAFKA_HOST}:${KAFKA_PORT}`],
        clientId: 'ch-check-messaging-enforcer',
      });
      const admin = kafka.admin();
      await admin.connect();
      const topics = await admin.listTopics();
      const missing = REQUIRED_KAFKA_TOPICS.filter((t) => !topics.includes(t));
      if (missing.length > 0) {
        console.error('Required Kafka topics are missing:', missing);
        await admin.disconnect();
        process.exit(2);
      }
      await admin.disconnect();
      console.log('All required Kafka topics present.');
    } catch (e) {
      // if something goes wrong here, warn but do not crash (kafkajs check already attempted above)
      console.warn('Unable to enforce required Kafka topics:', e.message || e);
    }
  } else {
    console.warn(
      'Skipping required-topic enforcement because kafkajs metadata check was not successful.',
    );
  }

  console.log(`Checking Pulsar TCP ${PULSAR_HOST}:${PULSAR_PORT}...`);
  const pulsarTcp = await checkTcp(PULSAR_HOST, PULSAR_PORT);
  if (!pulsarTcp) {
    console.error('Pulsar TCP connect failed');
  } else {
    console.log('Pulsar TCP reachable');
  }

  let pulsarAdminOk = false;
  if (pulsarTcp) {
    pulsarAdminOk = await checkPulsarAdmin();
  }

  if (!kafkaTcp && !pulsarTcp) {
    console.error(
      'Neither Kafka nor Pulsar appears reachable — messaging check failed',
    );
    process.exit(1);
  }

  if (kafkaTcp && !kafkaDeep) {
    console.warn(
      'Kafka reachable on TCP but deeper metadata check failed or kafkajs not installed — consider installing kafkajs for richer checks',
    );
  }
  if (pulsarTcp && !pulsarAdminOk) {
    console.warn(
      'Pulsar reachable on TCP but admin REST check failed — check Pulsar admin URL or install node-fetch',
    );
  }

  console.log('Messaging checks completed.');
  process.exit(0);
}

main();
