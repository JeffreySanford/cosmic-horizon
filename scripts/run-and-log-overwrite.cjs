#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function usage() {
  console.error('Usage: node scripts/run-and-log-overwrite.cjs <command...> <outFile>');
  process.exit(2);
}

const argv = process.argv.slice(2);
if (argv.length < 2) usage();

const outFile = argv[argv.length - 1];
const cmd = argv.slice(0, -1).join(' ');

try {
  const outDir = path.dirname(outFile);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  if (fs.existsSync(outFile)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = `${outFile}.full.${stamp}`;
    fs.copyFileSync(outFile, backup);
  }
  const header = `=== pruned test-all.log ===\nThis file was overwritten by run-and-log-overwrite.cjs.\nTimestamp: ${new Date().toISOString()}\n\n`;
  fs.writeFileSync(outFile, header, { encoding: 'utf8' });
} catch (e) {
  console.error('Failed to prepare log file:', e?.message ?? e);
}

const outStream = fs.createWriteStream(outFile, { flags: 'a' });

const proc = spawn(cmd, { shell: true, stdio: ['ignore', 'pipe', 'pipe'] });

proc.stdout.on('data', (d) => {
  process.stdout.write(d);
  outStream.write(d);
});

proc.stderr.on('data', (d) => {
  process.stderr.write(d);
  outStream.write(d);
});

proc.on('close', (code) => {
  outStream.end(() => process.exit(code));
});
