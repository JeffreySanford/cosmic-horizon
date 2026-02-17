// Required for Angular fakeAsync() and zone-based testing
import 'zone.js/testing';
// Polyfill for jsdom test environment
// Ensures navigator.platform is defined for Angular Forms
// This MUST run FIRST before any Angular modules are imported

console.log('[TEST SETUP] Initializing polyfills...');

if (typeof navigator !== 'undefined') {
  try {
    // Check if navigator.platform exists and is not empty
    if (!navigator.platform || navigator.platform === '') {
      Object.defineProperty(navigator, 'platform', {
        value: 'Linux',
        writable: true,
        configurable: true,
      });
      console.log('[TEST SETUP] navigator.platform polyfilled successfully');
    }

    if (!navigator.userAgent || navigator.userAgent === '') {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'jsdom',
        writable: true,
        configurable: true,
      });
      console.log('[TEST SETUP] navigator.userAgent polyfilled successfully');
    }
  } catch (e) {
    // Silently ignore if defineProperty fails (in case of strict mode)
    console.warn('[TEST SETUP] Could not set navigator.platform polyfill:', e);
  }
}

// Additional jsdom polyfills if needed
if (typeof window !== 'undefined') {
  // Ensure getComputedStyle works
  if (!window.getComputedStyle) {
    (window as any).getComputedStyle = () => ({
      getPropertyValue: () => '',
    });
  }
}

console.log('[TEST SETUP] Polyfills initialized');
