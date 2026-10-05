import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('analog-anime');

/** Total API requests by route and status. */
export const apiRequestCounter = meter.createCounter('api.requests.total', {
  description: 'Total API requests',
  unit: '1',
});

/** Histogram for upstream Jikan API call durations. */
export const jikanLatencyHistogram = meter.createHistogram('jikan.request.duration', {
  description: 'Jikan API response time',
  unit: 'ms',
});

/** Gauge for active user sessions. */
export const activeSessionsGauge = meter.createUpDownCounter('auth.sessions.active', {
  description: 'Currently active user sessions',
  unit: '1',
});

/** Counter for favorites operations. */
export const favoritesCounter = meter.createCounter('favorites.operations.total', {
  description: 'Favorites add/remove operations',
  unit: '1',
});
