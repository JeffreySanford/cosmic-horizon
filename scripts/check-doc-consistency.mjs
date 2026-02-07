import { readFileSync } from 'node:fs';

const checks = [
  {
    file: 'README.md',
    required: [/Canonical MVP docs/i],
    banned: [/Mode B.*part of MVP/i, /Go microservice.*part of MVP/i],
  },
  {
    file: 'documentation/SOURCE-OF-TRUTH.md',
    required: [/PRODUCT-CHARTER\.md/i, /SCOPE-LOCK\.md/i, /libs\/shared\/models/i],
  },
  {
    file: 'documentation/OVERVIEW.md',
    required: [/Status date:/i],
    banned: [
      /Mode B.*part of MVP/i,
      /Go microservice.*part of MVP/i,
      /comments?.*part of MVP/i,
    ],
  },
  {
    file: 'documentation/ARCHITECTURE.md',
    required: [/Canonical scope/i],
    banned: [/apps\/vlass-go.*part of MVP/i, /Mode B.*part of MVP/i],
  },
  {
    file: 'documentation/QUICK-START.md',
    banned: [/apps\/vlass-go.*run/i, /Mode B.*required/i],
  },
  {
    file: 'documentation/TESTING-STRATEGY.md',
    required: [/Baseline Gate/i],
    banned: [/Nest\s*[<\-]+>\s*Go.*required/i, /Mode B.*golden.*required/i],
  },
  {
    file: 'documentation/API-ROUTES.md',
    required: [/Source of Truth Models/i],
  },
  {
    file: 'documentation/ROADMAP.md',
    banned: [
      /Go microservice.*part of MVP/i,
      /Mode B.*part of MVP/i,
      /comments?.*part of MVP/i,
    ],
  },
  {
    file: 'TODO.md',
    banned: [
      /Go microservice.*part of MVP/i,
      /Mode B.*part of MVP/i,
      /FITS proxy.*part of MVP/i,
    ],
  },
];

const violations = [];

for (const check of checks) {
  const content = readFileSync(check.file, 'utf8');
  for (const pattern of check.required ?? []) {
    if (!pattern.test(content)) {
      violations.push(`${check.file}: missing required pattern ${pattern}`);
    }
  }
  for (const pattern of check.banned ?? []) {
    if (pattern.test(content)) {
      violations.push(`${check.file}: matched forbidden pattern ${pattern}`);
    }
  }
}

if (violations.length > 0) {
  console.error('Documentation consistency check failed:');
  for (const v of violations) console.error(`- ${v}`);
  process.exit(1);
}

console.log('Documentation consistency check passed.');
