import { defineConfig } from 'vitest/config';
import { join } from 'path';

const setupFile = join(__dirname, './src/test-setup.ts');
console.log('[VITEST CONFIG] Using setup file:', setupFile);

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [setupFile],
  },
});

