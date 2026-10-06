import * as Sentry from '@sentry/node';
import { addLogBreadcrumb } from './sentry-helpers';

export interface EdgeResponse<T> {
  data: T;
}

export const ANIME_API = 'https://jikan.lucashdo.com/v1';

/**
 * Fetches data from the jikan-edge anime API with Sentry instrumentation.
 * Records response time as a custom measurement and adds breadcrumbs on
 * success and failure for debugging.
 */
export async function fetchAnimeApi<T>(path: string): Promise<T> {
  const start = performance.now();
  const response = await fetch(`${ANIME_API}${path}`);
  const durationMs = performance.now() - start;

  Sentry.setMeasurement('jikan.response_time', durationMs, 'millisecond');

  if (!response.ok) {
    addLogBreadcrumb('error', 'jikan', `Jikan API ${path} failed: ${response.status}`, {
      url: path,
      status: response.status,
      durationMs,
    });
    throw new Error(`jikan-edge responded with ${response.status}`);
  }

  addLogBreadcrumb('info', 'jikan', `Jikan API ${path} OK`, { durationMs });
  const result = (await response.json()) as EdgeResponse<T>;
  return result.data;
}
