/**
 * Global Jest/Vitest Setup File
 * 
 * This file runs before all tests to set up polyfills and global test configuration.
 * It ensures cross-platform compatibility for test environments.
 * 
 * CRITICAL: This must run before any imports of Angular modules or Forms
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// AGGRESSIVE POLYFILL - must be set before any module imports
// Polyfill for jsdom/headless test environment used in GitHub Actions CI
// Angular Forms' _isAndroid() function requires navigator.platform to exist and not be null/undefined
(function setupNavigatorPolyfill() {
  const PLATFORM_VALUE = 'Linux x86_64';

  // Setup globalThis.navigator.platform
  if (typeof globalThis !== 'undefined' && globalThis.navigator) {
    try {
      // Force delete and redefine to ensure it's truly set
      const descriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'platform');
      
      if (!descriptor || descriptor.configurable !== false) {
        // Try to delete and redefine
        try {
          delete (globalThis.navigator as any).platform;
        } catch {
          // Ignore deletion errors, might not be possible
        }
      }

      // Now define it fresh
      Object.defineProperty(globalThis.navigator, 'platform', {
        value: PLATFORM_VALUE,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {
      // Fallback: direct assignment
      try {
        (globalThis.navigator as any).platform = PLATFORM_VALUE;
      } catch (e) {
        console.warn('[WARNING] Could not set globalThis.navigator.platform:', e);
      }
    }
  }

  // Setup window.navigator.platform for legacy support
  if (typeof window !== 'undefined' && window.navigator) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(window.navigator, 'platform');
      
      if (!descriptor || descriptor.configurable !== false) {
        try {
          delete (window.navigator as any).platform;
        } catch {
          // Ignore
        }
      }

      Object.defineProperty(window.navigator, 'platform', {
        value: PLATFORM_VALUE,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {
      try {
        (window.navigator as any).platform = PLATFORM_VALUE;
      } catch (e) {
        console.warn('[WARNING] Could not set window.navigator.platform:', e);
      }
    }
  }
})();

// Ensure getComputedStyle is available
if (typeof window !== 'undefined' && !window.getComputedStyle) {
  (window as any).getComputedStyle = () => ({
    getPropertyValue: () => '',
  });
}
