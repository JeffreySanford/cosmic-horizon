import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('documentation paths validation', () => {
  /**
   * This test verifies that all documentation files referenced by
   * scripts/check-doc-consistency.mjs exist at their expected paths.
   * 
   * This prevents CI failures caused by documentation reorganization.
   * If documentation is moved, update both this test AND the check script.
   */

  const workspaceRoot = process.cwd();

  const requiredPaths = [
    'README.md',
    'TODO.md',
    'SCOPE-LOCK.md',
    'documentation/index/OVERVIEW.md',
    'documentation/architecture/ARCHITECTURE.md',
    'documentation/quality/TESTING-STRATEGY.md',
    'documentation/planning/roadmap/ROADMAP.md',
  ];

  it('all documentation files exist at expected paths', () => {
    const missingFiles: string[] = [];

    for (const relativePath of requiredPaths) {
      const fullPath = join(workspaceRoot, relativePath);
      
      if (!existsSync(fullPath)) {
        missingFiles.push(`Missing: ${relativePath} (looked in ${fullPath})`);
      }
    }

    if (missingFiles.length > 0) {
      throw new Error(
        `Documentation path validation failed:\n${missingFiles.map(f => `  - ${f}`).join('\n')}\n\n` +
        `If documentation was reorganized:\n` +
        `  1. Update scripts/check-doc-consistency.mjs\n` +
        `  2. Update this test (apps/cosmic-horizons-api-e2e/src/docs-paths.spec.ts)\n` +
        `  3. Ensure both files reference the same paths`,
      );
    }
  });

  it('documentation consistency check script exists and is valid', () => {
    const scriptPath = join(workspaceRoot, 'scripts/check-doc-consistency.mjs');
    
    expect(existsSync(scriptPath)).toBe(true);
    
    // Verify it contains expected file paths (smoke test)
    const scriptContent = readFileSync(scriptPath, 'utf8');
    const expectedPaths = [
      'governance/SOURCE-OF-TRUTH.md',
      'index/OVERVIEW.md',
      'architecture/ARCHITECTURE.md',
      'operations/QUICK-START.md',
      'quality/TESTING-STRATEGY.md',
      'backend/API-ROUTES.md',
      'planning/roadmap/ROADMAP.md',
    ];

    const missingReferences: string[] = [];
    for (const path of expectedPaths) {
      if (!scriptContent.includes(path)) {
        missingReferences.push(path);
      }
    }

    if (missingReferences.length > 0) {
      throw new Error(
        `Documentation consistency check script is missing expected paths:\n` +
        `${missingReferences.map(p => `  - ${p}`).join('\n')}\n\n` +
        `Update scripts/check-doc-consistency.mjs to include these paths.`,
      );
    }
  });
});
