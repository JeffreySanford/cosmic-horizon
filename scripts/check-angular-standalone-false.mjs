import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const root = process.cwd();
const files = [
  ...collectTsFiles(resolve(root, 'apps')),
  ...collectTsFiles(resolve(root, 'libs')),
];
const errors = [];

for (const file of files) {
  const sourceText = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );

  const visit = (node) => {
    if (ts.isClassDeclaration(node)) {
      const decorators = ts.canHaveDecorators(node)
        ? ts.getDecorators(node)
        : undefined;
      if (decorators && decorators.length > 0) {
        for (const decorator of decorators) {
          if (!ts.isCallExpression(decorator.expression)) {
            continue;
          }

          const expr = decorator.expression.expression;
          const decoratorName = ts.isIdentifier(expr)
            ? expr.text
            : ts.isPropertyAccessExpression(expr)
              ? expr.name.text
              : '';

          if (decoratorName !== 'Component' && decoratorName !== 'Directive') {
            continue;
          }

          const config = decorator.expression.arguments[0];
          if (!config || !ts.isObjectLiteralExpression(config)) {
            errors.push(
              `${toRelative(file)}: @${decoratorName} must use an object literal with standalone: false`,
            );
            continue;
          }

          const standaloneProp = config.properties.find(
            (property) =>
              ts.isPropertyAssignment(property) &&
              ts.isIdentifier(property.name) &&
              property.name.text === 'standalone',
          );

          if (!standaloneProp) {
            errors.push(
              `${toRelative(file)}: @${decoratorName} is missing standalone: false`,
            );
            continue;
          }

          if (!ts.isPropertyAssignment(standaloneProp)) {
            errors.push(
              `${toRelative(file)}: @${decoratorName} standalone property must be a literal false`,
            );
            continue;
          }

          if (standaloneProp.initializer.kind !== ts.SyntaxKind.FalseKeyword) {
            errors.push(
              `${toRelative(file)}: @${decoratorName} standalone must be set to false`,
            );
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

if (errors.length > 0) {
  console.error('Angular standalone check failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Angular standalone check passed.');

function toRelative(file) {
  return resolve(file)
    .replace(`${resolve(root)}\\`, '')
    .replaceAll('\\', '/');
}

function collectTsFiles(dir) {
  const results = [];
  if (!exists(dir)) {
    return results;
  }

  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (entry === 'node_modules') {
        continue;
      }
      results.push(...collectTsFiles(fullPath));
      continue;
    }

    if (!entry.endsWith('.ts')) {
      continue;
    }

    if (
      entry.endsWith('.spec.ts') ||
      entry.endsWith('.test.ts') ||
      entry.endsWith('.stories.ts')
    ) {
      continue;
    }

    results.push(fullPath);
  }

  return results;
}

function exists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}
