import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * This script runs the cosmic-horizons-api OpenAPI generator and compares the output
 * with the committed documentation/reference/api/openapi.json file.
 */

const projectRoot = resolve(process.cwd());
const committedSpecPath = resolve(
  projectRoot,
  'documentation',
  'reference',
  'api',
  'openapi.json',
);

async function run() {
  console.log('--- API Contract Regression Check ---');

  if (!existsSync(committedSpecPath)) {
    console.error(
      `Error: Committed OpenAPI spec not found at ${committedSpecPath}`,
    );
    process.exit(1);
  }

  // Save the original file content
  const originalSpec = readFileSync(committedSpecPath, 'utf8');

  try {
    console.log('Generating current OpenAPI spec...');
    // We run the nx target which now outputs to the correct location
    execSync('pnpm nx run cosmic-horizons-api:openapi', { stdio: 'inherit' });

    const generatedSpec = readFileSync(committedSpecPath, 'utf8');

    if (originalSpec === generatedSpec) {
      console.log(
        '✅ Success: API contract is consistent with committed spec.',
      );
      process.exit(0);
    } else {
      console.error(
        '❌ Error: API contract has changed. Please update documentation/reference/api/openapi.json',
      );
      console.error(
        'If this change was intentional, commit the updated openapi.json file.',
      );

      // show diff if possible
      try {
        const diff = execSync(`git diff --no-index "${committedSpecPath}" -`, {
          input: originalSpec,
          encoding: 'utf8',
        });
        console.log('\nDiff:');
        console.log(diff);
      } catch (e) {
        // git diff returns exit code 1 if files differ
        if (e.stdout) console.log(e.stdout);
      }

      // Restore the original spec so the developer doesn't have local changes if তারা just running the check
      // Wait, actually in CI we want it to fail. In local dev, we might want to keep the change.
      // Let's NOT restore it, but tell the user to check git status.
      process.exit(1);
    }
  } catch (error) {
    console.error('Failed to generate or compare OpenAPI spec:', error.message);
    process.exit(1);
  }
}

run();
