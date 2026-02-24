#!/usr/bin/env node
import net from 'net';

const services = [
  { name: 'kafka', host: process.env.KAFKA_HOST || '127.0.0.1', port: Number(process.env.KAFKA_PORT || 9092) },
  { name: 'postgres', host: process.env.DB_HOST || process.env.POSTGRES_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 15432) },
  { name: 'redis', host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT || 6379) },
];

const WAIT_TIMEOUT = Number(process.env.WAIT_TIMEOUT || 120); // seconds
const INTERVAL = Number(process.env.WAIT_INTERVAL || 5); // seconds

function checkTcp(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let settled = false;
    const onSuccess = () => {
      if (settled) return;
      settled = true;
      sock.destroy();
      resolve(true);
    };
    const onFail = () => {
      if (settled) return;
      settled = true;
      try { sock.destroy(); } catch (e) {}
      resolve(false);
    };
    sock.setTimeout(timeoutMs);
    sock.once('connect', onSuccess);
    sock.once('error', onFail);
    sock.once('timeout', onFail);
    sock.connect(port, host);
  });
}

async function waitForService(svc, deadline) {
  process.stdout.write(`Waiting for ${svc.name} at ${svc.host}:${svc.port} `);
  while (Date.now() < deadline) {
    /* eslint-disable no-await-in-loop */
    // try TCP connect
    // eslint-disable-next-line no-await-in-loop
    const ok = await checkTcp(svc.host, svc.port);
    if (ok) {
      console.log('OK');
      return true;
    }
    process.stdout.write('.');
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, INTERVAL * 1000));
  }
  console.error(`\nTimed out waiting for ${svc.name} at ${svc.host}:${svc.port}`);
  return false;
}

async function main() {
  const deadline = Date.now() + WAIT_TIMEOUT * 1000;
  for (const svc of services) {
    const ok = await waitForService(svc, deadline);
    if (!ok) {
      console.error('One or more services failed to become healthy within timeout.');
      process.exit(1);
    }
  }
  console.log('All critical services are reachable.');
  process.exit(0);
}

main();
