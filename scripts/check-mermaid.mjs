#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
// patch DOMPurify so mermaid's sanitize hooks work in Node
DOMPurify.addHook = DOMPurify.addHook || (() => {});
DOMPurify.sanitize = DOMPurify.sanitize || ((s) => s);


// Recursively collect markdown files
function collectMd(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMd(full, files);
    } else if (entry.isFile() && full.toLowerCase().endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

const root = path.resolve('documentation');
const mdFiles = collectMd(root);
let failed = false;

for (const file of mdFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const regex = /```mermaid([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content))) {
    const diagram = match[1];
    try {
      // parse using mermaid core library
      mermaid.parse(diagram);
    } catch (e) {
      console.error(`Mermaid parse error in ${file}:`);
      // mermaid errors sometimes include str property
      console.error(e.str || e.message || e);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}
console.log('All Mermaid diagrams validated successfully.');
