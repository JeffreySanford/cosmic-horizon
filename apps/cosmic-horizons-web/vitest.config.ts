import { defineConfig } from 'vitest/config';
import { getVitestConfig } from '@nx/angular/plugins/vitest';
import { resolve } from 'path';

export default defineConfig({
  ...getVitestConfig(),
  test: {
    ...getVitestConfig().test,
    setupFiles: [
      resolve(__dirname, './src/test-setup.ts'),
      resolve(__dirname, '../../jest-setup.ts'),
    ],
  },
});
