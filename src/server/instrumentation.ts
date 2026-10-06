import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Load .env if present so SENTRY_DSN and config are available when running locally
try {
  process.loadEnvFile?.();
} catch {
  // .env file not found or already loaded; continue
}

const dsn = process.env['SENTRY_DSN'];

if (dsn) {
  // When serving the production build (or when NODE_ENV=production), treat as production
  const isRunningDist = process.argv.some((arg) => arg.includes('dist/'));
  const nodeEnv = process.env['NODE_ENV'] ?? (isRunningDist ? 'production' : 'development');
  if (!process.env['NODE_ENV']) {
    process.env['NODE_ENV'] = nodeEnv;
  }
  const environment = process.env['SENTRY_ENVIRONMENT'] ?? nodeEnv;
  const isProduction = environment === 'production';

  Sentry.init({
    dsn,
    integrations: [
      // Automatic HTTP/fetch request tracing
      Sentry.httpIntegration(),
      // Node.js profiling for flame graphs
      nodeProfilingIntegration(),
    ],
    // Capture 100% of traces in dev/staging; reduce in production
    tracesSampleRate: isProduction ? 0.2 : 1.0,
    profilesSampleRate: isProduction ? 0.2 : 1.0,
    environment,
    release: process.env['APP_VERSION'] ?? '0.0.0',
    // Attach server name for multi-instance deployments
    serverName: process.env['HOSTNAME'] ?? 'analog-anime-server',
  });
} else {
  console.warn('[sentry] SENTRY_DSN not set — server observability disabled');
}
