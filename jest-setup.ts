/**
 * Global Jest/Vitest Setup File
 * 
 * This file runs before all tests to set up polyfills and global test configuration.
 * It ensures cross-platform compatibility for test environments.
 * 
 * CRITICAL: This must run before any imports of Angular modules or Forms
 */

// IMMEDIATE polyfill - must be set before any module imports
// Polyfill for jsdom/headless test environment used in GitHub Actions CI
// Angular Forms' _isAndroid() function requires navigator.platform to exist
if (typeof globalThis !== 'undefined' && globalThis.navigator) {
  // Forcefully define navigator.platform with writable descriptor
  try {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'platform');
    // If already defined but empty, also override
    if (!descriptor || !globalThis.navigator.platform || globalThis.navigator.platform === '') {
      Object.defineProperty(globalThis.navigator, 'platform', {
        value: 'Linux x86_64',
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
  } catch (error) {
    // If descriptor fails, try direct assignment
    try {
      (globalThis.navigator as any).platform = 'Linux x86_64';
    } catch (e) {
      console.warn('[WARNING] Could not set navigator.platform:', e);
    }
  }
}

// Also set on window.navigator for compatibility
if (typeof window !== 'undefined' && window.navigator) {
  try {
    if (!window.navigator.platform || window.navigator.platform === '') {
      Object.defineProperty(window.navigator, 'platform', {
        value: 'Linux x86_64',
        writable: true,
        configurable: true,
      });
    }
  } catch (error) {
    try {
      (window.navigator as any).platform = 'Linux x86_64';
    } catch (e) {
      console.warn('[WARNING] Could not set window.navigator.platform:', e);
    }
  }
}

// Ensure getComputedStyle is available
if (typeof window !== 'undefined' && !window.getComputedStyle) {
  (window as any).getComputedStyle = () => ({
    getPropertyValue: () => '',
  });
}
