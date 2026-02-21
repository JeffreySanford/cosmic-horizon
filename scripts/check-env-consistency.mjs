import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseEnvExample(path) {
  const content = readFileSync(path, 'utf8');
  const keys = new Set();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      keys.add(trimmed.slice(0, eq));
    }
  }
  return keys;
}

function parseEnvDoc(path) {
  const content = readFileSync(path, 'utf8');
  const keys = new Set();
  // look for markdown table rows starting with | `KEY`
  const rowRegex = /^\|\s*`([^`]+)`/;
  for (const line of content.split(/\r?\n/)) {
    const m = rowRegex.exec(line);
    if (m) {
      keys.add(m[1]);
    }
  }
  return keys;
}

const examplePath = resolve(process.cwd(), '.env.example');
const docPath = resolve(
  process.cwd(),
  'documentation',
  'reference',
  'ENV-REFERENCE.md',
);

const exampleKeys = parseEnvExample(examplePath);
const docKeys = parseEnvDoc(docPath);

const errors = [];

for (const k of exampleKeys) {
  if (!docKeys.has(k)) {
    errors.push(`key ${k} present in .env.example but missing from docs`);
  }
}
for (const k of docKeys) {
  if (!exampleKeys.has(k)) {
    errors.push(`key ${k} documented but missing from .env.example`);
  }
}

if (exampleKeys.has('REDIS_ENABLED')) {
  errors.push('legacy key REDIS_ENABLED should not appear in .env.example');
}

if (errors.length > 0) {
  console.error('Environment documentation consistency check failed:');
  for (const e of errors) console.error('- ' + e);
  process.exit(1);
}

console.log('Environment documentation consistency check passed.');
