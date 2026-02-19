import { readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const workspaceRoot = process.cwd();
const documentationRoot = resolve(workspaceRoot, 'documentation');
const outputPath = resolve(
  workspaceRoot,
  'documentation/index/DOCS-VIEW-CATALOG.json',
);

const EXCLUDED_DIRS = new Set([
  '.git',
  '.nx',
  'node_modules',
  'archive',
  'coverage',
  'dist',
]);

const EXTRA_FILES = ['README.md', 'ROADMAP.md', 'TODO.md'];

function toTitleCase(value) {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, '-')
    .replace(/\/+/g, '/')
    .replace(/^-+|-+$/g, '')
    .replace(/\//g, '--');
}

function deriveSection(sourcePath) {
  if (!sourcePath.startsWith('documentation/')) {
    return 'Project';
  }
  const pathWithoutPrefix = sourcePath.replace(/^documentation\//, '');
  const firstSegment = pathWithoutPrefix.split('/')[0];
  return toTitleCase(firstSegment);
}

async function collectMarkdownFiles(dirPath, files = []) {
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const absolutePath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name.toLowerCase())) {
        continue;
      }
      await collectMarkdownFiles(absolutePath, files);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(absolutePath);
    }
  }

  return files;
}

async function buildCatalog() {
  const markdownFiles = await collectMarkdownFiles(documentationRoot);

  for (const extraFile of EXTRA_FILES) {
    const absolutePath = resolve(workspaceRoot, extraFile);
    if (existsSync(absolutePath)) {
      markdownFiles.push(absolutePath);
    }
  }

  const catalog = markdownFiles
    .map((absolutePath) => {
      const sourcePath = relative(workspaceRoot, absolutePath).replace(
        /\\/g,
        '/',
      );
      const stem = sourcePath.replace(/\.md$/i, '');
      const fileName =
        sourcePath.split('/').pop()?.replace(/\.md$/i, '') ?? stem;
      const id = slugify(stem);

      return {
        id,
        label: toTitleCase(fileName),
        section: deriveSection(sourcePath),
        sourcePath,
      };
    })
    .sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));

  await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  console.log(
    `Docs catalog built: ${catalog.length} entries -> documentation/index/DOCS-VIEW-CATALOG.json`,
  );
}

buildCatalog().catch((error) => {
  console.error('Failed to build docs catalog:', error);
  process.exit(1);
});
