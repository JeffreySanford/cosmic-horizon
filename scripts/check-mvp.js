#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

// ensure SCOPE-LOCK exists at the prescribed location and contains key phrase
const scopePath = path.resolve(process.cwd(), 'SCOPE-LOCK.MD');
if (!fs.existsSync(scopePath)) {
  console.error('MVP scope lock file is missing at SCOPE-LOCK.MD');
  process.exit(1);
}

const content = fs.readFileSync(scopePath, 'utf8');
if (!/MVP Scope Lock/i.test(content)) {
  console.error('SCOPE-LOCK.MD does not appear to contain an MVP Scope Lock header');
  process.exit(1);
}

// ensure PRODUCT-CHARTER exists and is required
const charterPath = path.resolve(process.cwd(), 'documentation', 'product', 'PRODUCT-CHARTER.MD');
if (!fs.existsSync(charterPath)) {
  console.error('Product charter missing (required) at documentation/product/PRODUCT-CHARTER.MD');
  process.exit(1);
}

const charterContent = fs.readFileSync(charterPath, 'utf8');
if (!/Product Charter/i.test(charterContent)) {
  console.error('PRODUCT-CHARTER.MD does not appear to contain a Product Charter header');
  process.exit(1);
}

console.log('MVP/scope-lock check passed.');
console.log('Product charter check passed.');
