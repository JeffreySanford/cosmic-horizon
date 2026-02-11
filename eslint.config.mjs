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
    },
  },
  {
    files: ['apps/vlass-web/src/app/**/*.ts'],
    ignores: [
      '**/*.spec.ts',
      'apps/vlass-web/src/app/features/viewer/hips-tile-prefetch.service.ts',
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
    files: ['apps/vlass-api/src/app/**/*.ts'],
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
    // Override or add rules here
    rules: {},
  },
];
