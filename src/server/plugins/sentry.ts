import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

const dsn = process.env['SENTRY_DSN'];

if (dsn) {
  Sentry.init({
    dsn,
    integrations: [nodeProfilingIntegration()],
    tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.2 : 1.0,
    profilesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.2 : 1.0,
    environment: process.env['NODE_ENV'] ?? 'development',
  });
  console.log('[sentry] Server-side Sentry initialized');
} else {
  console.log('[sentry] SENTRY_DSN not set — skipping server-side Sentry');
}
