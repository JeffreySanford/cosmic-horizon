#!/usr/bin/env node
const { spawn } = require('child_process');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { retries: 3, delay: 2000 };
  let cmdIndex = args.findIndex(a => a === '--');
  if (cmdIndex === -1) cmdIndex = args.length;
  for (let i = 0; i < cmdIndex; i++) {
    const a = args[i];
    if (a.startsWith('--retries=')) opts.retries = parseInt(a.split('=')[1], 10);
    if (a.startsWith('--delay=')) opts.delay = parseInt(a.split('=')[1], 10);
  }
  opts.cmd = args.slice(cmdIndex + 1);
  if (!opts.cmd || opts.cmd.length === 0) {
    console.error('Usage: node scripts/nx-retry.cjs [--retries=N] [--delay=ms] -- <command...>');
    process.exit(2);
  }
  return opts;
}

async function runOnce(cmd, args) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: true });
    child.on('close', (code) => resolve(code));
  });
}

async function main() {
  const opts = parseArgs();
  const cmd = opts.cmd.join(' ');
  for (let attempt = 1; attempt <= opts.retries; attempt++) {
    if (attempt > 1) console.log(`Retry attempt ${attempt}/${opts.retries} for: ${cmd}`);
    const code = await runOnce(cmd, []);
    if (code === 0) {
      process.exit(0);
    }
    if (attempt < opts.retries) {
      console.log(`Command failed with exit ${code}. Waiting ${opts.delay}ms before retry.`);
      await new Promise(r => setTimeout(r, opts.delay));
    } else {
      console.error(`Command failed after ${opts.retries} attempts.`);
      process.exit(code || 1);
    }
  }
}

main();
