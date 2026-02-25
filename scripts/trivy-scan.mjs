#!/usr/bin/env node
import fs from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';

function findComposeFiles() {
  const files = [];
  const root = process.cwd();
  const candidates = [path.join(root, 'docker-compose.yml')];
  const dockerDir = path.join(root, 'docker');
  try {
    const entries = fs.readdirSync(dockerDir);
    for (const e of entries) {
      if (e.endsWith('.yml') || e.endsWith('.yaml'))
        files.push(path.join(dockerDir, e));
    }
  } catch (e) {
    // ignore
  }
  return candidates.concat(files).filter((f) => fs.existsSync(f));
}

function extractImages(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const images = new Set();
  const re = /^\s*image:\s*(.+)$/gm;
  let m;
  while ((m = re.exec(txt))) {
    let im = m[1].trim();
    // strip quotes
    if (
      (im.startsWith("'") && im.endsWith("'")) ||
      (im.startsWith('"') && im.endsWith('"'))
    ) {
      im = im.slice(1, -1);
    }
    images.add(im);
  }
  return Array.from(images).filter(Boolean);
}

function runTrivyOnImage(image) {
  const check = spawnSync('trivy', ['--version'], { stdio: 'ignore' });
  if (check.error) {
    console.warn('trivy not found in PATH; skipping trivy scan.');
    return 0;
  }
  console.log(`Scanning image ${image} with trivy...`);
  const args = [
    'image',
    '--no-progress',
    '--severity',
    'HIGH,CRITICAL',
    '--exit-code',
    '1',
    image,
  ];
  const res = spawnSync('trivy', args, { stdio: 'inherit' });
  return res.status || 0;
}

async function main() {
  const files = findComposeFiles();
  const images = new Set();
  for (const f of files) {
    extractImages(f).forEach((i) => images.add(i));
  }
  if (images.size === 0) {
    console.log('No images found in compose files to scan.');
    process.exit(0);
  }
  let failed = false;
  for (const img of images) {
    const code = runTrivyOnImage(img);
    if (code !== 0) failed = true;
  }
  process.exit(failed ? 2 : 0);
}

main();
