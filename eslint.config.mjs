import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/test-output',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
      '@angular-eslint/prefer-standalone': 'off',
    },
  },
  {
    files: ['apps/cosmic-horizons-web/src/app/**/*.ts'],
    ignores: [
      '**/*.spec.ts',
      'apps/cosmic-horizons-web/src/app/features/viewer/hips-tile-prefetch.service.ts',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MethodDefinition[value.async=true]',
          message:
            'Use RxJS Observable pipelines instead of async methods in frontend app code.',
        },
        {
          selector: 'FunctionDeclaration[async=true]',
          message:
            'Use RxJS Observable pipelines instead of async functions in frontend app code.',
        },
        {
          selector: 'FunctionExpression[async=true]',
          message:
            'Use RxJS Observable pipelines instead of async functions in frontend app code.',
        },
        {
          selector: 'ArrowFunctionExpression[async=true]',
          message:
            'Use RxJS Observable pipelines instead of async functions in frontend app code.',
        },
        {
          selector: 'NewExpression[callee.name="Promise"]',
          message:
            'Use RxJS creation operators (for example `defer`, `from`, `of`) instead of `new Promise` in frontend app code.',
        },
      ],
    },
  },
  {
    files: ['apps/cosmic-horizons-web/src/app/**/*.html'],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'off',
    },
  },
  {
    files: ['apps/cosmic-horizons-api/src/app/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'express',
              importNames: ['Request', 'Response'],
              message:
                'Use Nest request/response abstractions in app controllers instead of importing Express request/response types.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Global overrides to align with module-based Angular architecture.
    rules: {
      '@angular-eslint/prefer-standalone': 'off',
      '@angular-eslint/template/prefer-control-flow': 'off',
    },
  },
  {
    files: ['**/*.html'],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/*.spec.js', '**/*.test.js', '**/test-setup.ts', '**/test-setup.js', '**/*.error.spec.ts', '**/*.error-*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
