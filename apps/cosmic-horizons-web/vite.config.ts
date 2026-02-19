import { defineConfig } from 'vite';

// Ensure Angular packages are deduped so the dev server doesn't emit
// duplicate runtime/component defs (prevents NG0912 collisions).
// See: https://vitejs.dev/config/#resolve-dedupe
export default defineConfig({
  resolve: {
    dedupe: [
      '@angular/core',
      '@angular/common',
      '@angular/router',
      '@angular/platform-browser',
      '@angular/animations',
      '@angular/material',
      '@angular/cdk',
      // include CDK subpaths to be safe for deep imports
      '@angular/cdk/overlay',
      '@angular/cdk/scrolling',
    ],
  },
  optimizeDeps: {
    // Pre-bundle core Angular packages so dev server only loads a single runtime
    include: [
      '@angular/core',
      '@angular/common',
      '@angular/router',
      '@angular/platform-browser',
      '@angular/animations',
      '@angular/material',
      '@angular/cdk',
    ],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
