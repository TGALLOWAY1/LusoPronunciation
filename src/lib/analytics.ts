/**
 * Lightweight event tracking for user flow instrumentation.
 *
 * In development: logs events to the console.
 * In production: extensible — swap the implementation to send
 * to an analytics endpoint when ready.
 */

const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

export function trackEvent(
  event: string,
  properties?: Record<string, string | number | boolean>,
): void {
  if (isDev) {
    console.log(`[Analytics] ${event}`, properties ?? '');
  }
}
