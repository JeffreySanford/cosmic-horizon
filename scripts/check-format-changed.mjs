import { execSync, spawnSync } from 'node:child_process';

const PRETTIER_EXTENSIONS = new Set([
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.scss',
  '.css',
]);

function run(command) {
  return execSync(command, { encoding: 'utf8' }).trim();
}

function safeRun(command) {
  try {
    return run(command);
  } catch {
    return '';
  }
}

function collectChangedFiles() {
  const files = new Set();
  const isCi = process.env.CI === 'true';

  if (isCi) {
    const commitFiles = safeRun(
      'git diff-tree --no-commit-id --name-only -r --diff-filter=ACMR HEAD',
    );
    for (const file of commitFiles.split(/\r?\n/)) {
      if (file) {
        files.add(file);
      }
    }
  }

  // Include local/uncommitted changes for developer runs.
  if (!isCi) {
    for (const command of [
      'git diff --name-only --diff-filter=ACMR',
      'git diff --name-only --cached --diff-filter=ACMR',
    ]) {
      const output = safeRun(command);
      for (const file of output.split(/\r?\n/)) {
        if (file) {
          files.add(file);
        }
      }
    }
  }

  return Array.from(files).filter((file) => {
    const lastDot = file.lastIndexOf('.');
    if (lastDot < 0) {
      return false;
    }
    return PRETTIER_EXTENSIONS.has(file.slice(lastDot));
  });
}

const changedFiles = collectChangedFiles();

if (changedFiles.length === 0) {
  console.log(
    'No changed Prettier-managed files found; skipping format check.',
  );
  process.exit(0);
}

console.log(`Checking formatting for ${changedFiles.length} changed files...`);
const result = spawnSync('pnpm', ['prettier', '--check', ...changedFiles], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
