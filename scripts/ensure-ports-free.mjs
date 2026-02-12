import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envCandidates = [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '.env'),
];

function readEnvFile() {
  const path = envCandidates.find((candidate) => existsSync(candidate));
  if (!path) {
    return {};
  }

  const map = {};
  const content = readFileSync(path, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    map[key] = value;
  }
  return map;
}

const env = readEnvFile();
const apiPort = Number(env.API_PORT ?? '3000');
const frontendPort = Number(env.FRONTEND_PORT ?? '4200');
const rabbitMqPort = 5672;
const rabbitMqMgmtPort = 15672;
const kafkaPort = 9092;

const PORTS = [apiPort, frontendPort, rabbitMqPort, rabbitMqMgmtPort, kafkaPort].filter((port, index, array) => Number.isFinite(port) && port > 0 && array.indexOf(port) === index);

function killStaleNxWatchersWindows() {
  const res = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      [
        '$procs = Get-CimInstance Win32_Process |',
        'Where-Object {',
        "  $_.Name -eq 'node.exe' -and $_.CommandLine -and (",
        "    $_.CommandLine -match 'cosmic-horizons-api:serve' -or",
        "    $_.CommandLine -match 'cosmic-horizons-web:serve' -or",
        "    $_.CommandLine -match 'nx run cosmic-horizons-api:serve' -or",
        "    $_.CommandLine -match 'nx run cosmic-horizons-web:serve'",
        '  )',
        '};',
        '$procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }',
      ].join(' '),
    ],
    { stdio: 'ignore' },
  );
  return res.status === 0;
}

function getListeningPidsWindows(port) {
  const psRes = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`,
    ],
    { encoding: 'utf8' },
  );

  if (psRes.status === 0) {
    return psRes.stdout
      .split(/\r?\n/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);
  }

  const netstatRes = spawnSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
  if (netstatRes.status !== 0) return [];

  const pids = new Set();
  for (const line of netstatRes.stdout.split(/\r?\n/)) {
    const match = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
    if (!match) continue;
    const linePort = Number(match[1]);
    const pid = Number(match[2]);
    if (linePort === port && Number.isFinite(pid) && pid > 0) {
      pids.add(pid);
    }
  }
  return [...pids];
}

function killPidWindows(pid) {
  const nameResult = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).ProcessName`,
    ],
    { encoding: 'utf8' },
  );
  const processName = (nameResult.stdout ?? '').trim().toLowerCase();
  if (processName === 'com.docker.backend' || processName === 'system') {
    return;
  }

  spawnSync('taskkill', ['/PID', String(pid), '/F'], { stdio: 'ignore' });
}

function getListeningPidsUnix(port) {
  const res = spawnSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], {
    encoding: 'utf8',
  });
  if (res.status !== 0) return [];
  return res.stdout
    .split(/\r?\n/)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function killPidUnix(pid) {
  spawnSync('kill', ['-9', String(pid)], { stdio: 'ignore' });
}

for (const port of PORTS) {
  const pids =
    process.platform === 'win32'
      ? getListeningPidsWindows(port)
      : getListeningPidsUnix(port);

  for (const pid of pids) {
    if (process.platform === 'win32') {
      killPidWindows(pid);
    } else {
      killPidUnix(pid);
    }
  }
}

if (process.platform === 'win32') {
  killStaleNxWatchersWindows();
}

const stillBusy = [];
for (const port of PORTS) {
  const pids =
    process.platform === 'win32'
      ? getListeningPidsWindows(port)
      : getListeningPidsUnix(port);
  if (pids.length > 0) {
    stillBusy.push({ port, pids });
  }
}

if (stillBusy.length > 0) {
  for (const item of stillBusy) {
    console.error(`Port ${item.port} is still in use by PID(s): ${item.pids.join(', ')}`);
  }
  process.exit(1);
}

console.log(`Freed dev ports: ${PORTS.join(', ')}`);
