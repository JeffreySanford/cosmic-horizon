// Required for Angular fakeAsync() and zone-based testing
import 'zone.js/testing';

function ensureNavigatorStringProperty(
  key: 'platform' | 'userAgent',
  fallback: string,
): void {
  if (typeof navigator === 'undefined') {
    return;
  }

  const current = (navigator as Navigator & Record<string, unknown>)[key];
  if (typeof current === 'string' && current.length > 0) {
    return;
  }

  try {
    Object.defineProperty(navigator, key, {
      value: fallback,
      writable: true,
      configurable: true,
    });
  } catch {
    try {
      (navigator as any)[key] = fallback;
    } catch {
      // Ignore if the environment forbids overriding navigator properties.
    }
  }
}

ensureNavigatorStringProperty('platform', 'Linux');
ensureNavigatorStringProperty('userAgent', 'jsdom');

// Additional jsdom polyfills if needed
if (typeof window !== 'undefined' && !window.getComputedStyle) {
  (window as any).getComputedStyle = () => ({
    getPropertyValue: () => '',
  });
}
