// CRITICAL: Apply polyfill IMMEDIATELY before Vitest loads any modules
if (typeof globalThis !== 'undefined' && globalThis.navigator) {
  if (!globalThis.navigator.platform || globalThis.navigator.platform === '') {
    try {
      Object.defineProperty(globalThis.navigator, 'platform', {
        value: 'Linux x86_64',
        writable: true,
        configurable: true,
      });
    } catch {
      (globalThis.navigator as { platform?: string }).platform = 'Linux x86_64';
    }
  }
}

import { defineConfig } from 'vitest/config';
import { join } from 'path';

const setupFile = join(__dirname, './src/test-setup.ts');

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [setupFile],
  },
});

