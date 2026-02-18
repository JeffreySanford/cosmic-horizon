const fs = require('fs');

const coverageFile = 'apps/cosmic-horizons-api/test-output/jest/coverage/coverage-final.json';
const summary = { 
  lines: { total: 0, covered: 0 }, 
  branches: { total: 0, covered: 0 }, 
  functions: { total: 0, covered: 0 }, 
  statements: { total: 0, covered: 0 } 
};

const data = JSON.parse(fs.readFileSync(coverageFile, 'utf-8'));

for (const file in data) {
  const coverage = data[file];
  if (coverage.lines) {
    for (const line in coverage.lines) {
      summary.lines.total++;
      if (coverage.lines[line] > 0) summary.lines.covered++;
    }
  }
  if (coverage.branches) {
    for (const branch in coverage.branches) {
      const branchData = coverage.branches[branch];
      summary.branches.total += branchData.length;
      summary.branches.covered += branchData.filter(b => b > 0).length;
    }
  }
  if (coverage.functions) {
    for (const fn in coverage.functions) {
      summary.functions.total++;
      if (coverage.functions[fn] > 0) summary.functions.covered++;
    }
  }
  if (coverage.statements) {
    for (const stmt in coverage.statements) {
      summary.statements.total++;
      if (coverage.statements[stmt] > 0) summary.statements.covered++;
    }
  }
}

console.log('Coverage Summary:');
console.log('================');
console.log(`Lines:       ${summary.lines.covered}/${summary.lines.total} (${(summary.lines.covered/summary.lines.total*100).toFixed(2)}%)`);
console.log(`Branches:    ${summary.branches.covered}/${summary.branches.total} (${(summary.branches.covered/summary.branches.total*100).toFixed(2)}%)`);
console.log(`Functions:   ${summary.functions.covered}/${summary.functions.total} (${(summary.functions.covered/summary.functions.total*100).toFixed(2)}%)`);
console.log(`Statements:  ${summary.statements.covered}/${summary.statements.total} (${(summary.statements.covered/summary.statements.total*100).toFixed(2)}%)`);
