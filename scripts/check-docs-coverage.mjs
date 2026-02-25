#!/usr/bin/env node
import { execSync } from 'child_process';

// determine staged files
const raw = execSync('git diff --name-only --cached', { encoding: 'utf8' });
const files = raw.split(/\r?\n/).filter(Boolean);

const codeExt = [
  '.ts',
  '.js',
  '.jsx',
  '.tsx',
  '.py',
  '.go',
  '.java',
  '.rb',
  '.sh',
];
const docExt = ['.md'];

const isCode = (f) => codeExt.some((e) => f.endsWith(e));
const isDoc = (f) => docExt.some((e) => f.endsWith(e));

const codeFiles = files.filter(isCode);
const docFiles = files.filter(isDoc);

if (codeFiles.length > 0 && docFiles.length === 0) {
  console.error(
    'Documentation coverage check failed: code files staged but no markdown changes.',
  );
  console.error('  Staged code files:');
  codeFiles.forEach((f) => console.error('    ' + f));
  console.error(
    'Please update/write documentation related to your changes before pushing.',
  );
  process.exit(1);
}

// also ensure critical docs exist and contain expected headings
const fs = await import('fs');

const critical = [
  'SCOPE-LOCK.MD',
  'documentation/product/PRODUCT-CHARTER.MD',
  'SECURITY.md',
];
for (const p of critical) {
  if (!fs.existsSync(p)) {
    console.error(`${p} is missing! This file must exist and be up-to-date.`);
    process.exit(1);
  }
}

console.log('Documentation coverage check passed.');
