import * as Sentry from '@sentry/angular';

/**
 * Initializes Sentry browser SDK for the Angular client.
 *
 * Call this at the very top of `main.ts` — before Angular bootstraps — so that
 * Sentry captures errors and performance data from the earliest moment.
 *
 * Provides: error tracking, performance monitoring (browser tracing),
 * session replay, and release health.
 */
export function initBrowserSentry() {
  // Skip during SSR — Sentry browser SDK requires a DOM environment.
  if (typeof window === 'undefined') return;

  const dsn = import.meta.env['VITE_SENTRY_DSN'] ?? '';

  if (!dsn) {
    console.warn('[sentry] No VITE_SENTRY_DSN found — client observability disabled');
    return;
  }

  const environment = import.meta.env['VITE_SENTRY_ENVIRONMENT'] || import.meta.env.MODE;
  const isProduction = environment === 'production';

  Sentry.init({
    dsn,
    integrations: [
      // Automatic performance tracing for route changes and HTTP requests
      Sentry.browserTracingIntegration(),
      // Session replay — records DOM to replay user sessions on errors. Sentry's defaults mask all
      // text and inputs and block media, so emails and other personal data never leave the browser.
      Sentry.replayIntegration(),
    ],
    // Correlate browser fetch / XHR requests with server traces for APM
    tracePropagationTargets: ['localhost', /^\//],
    // Capture 100% of traces in dev/staging; reduce to 20% in production
    tracesSampleRate: isProduction ? 0.2 : 1.0,
    // Record 10% of all sessions, but 100% of sessions with errors
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment,
    release: import.meta.env['VITE_APP_VERSION'] ?? undefined,
  });
}
