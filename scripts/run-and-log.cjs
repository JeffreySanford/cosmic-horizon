#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');

function usage() {
  console.error('Usage: node scripts/run-and-log.cjs <command...> <outFile>');
  process.exit(2);
}

const argv = process.argv.slice(2);
if (argv.length < 2) usage();

const outFile = argv[argv.length - 1];
const cmd = argv.slice(0, -1).join(' ');

const outStream = fs.createWriteStream(outFile, { flags: 'a' });

const proc = spawn(cmd, { shell: true });

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
