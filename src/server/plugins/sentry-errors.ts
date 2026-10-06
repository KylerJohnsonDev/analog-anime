import { isError } from 'h3';
import { defineNitroPlugin } from 'nitropack/runtime';
import * as Sentry from '@sentry/node';

/**
 * Reports every server error that reaches Nitro to Sentry from one place.
 *
 * Nitro's `error` hook sees every error h3 handles, plus failed background refreshes of cached
 * functions. Deliberate 4xx responses (unauthenticated, bad input, not found) aren't bugs, so only
 * 5xx errors and errors without a status code are reported. When a route wraps a failure in its
 * own `createError`, the original error is passed as `cause` and that's what gets reported.
 *
 * Routes that recover from a failure and still respond (like the anime feed returning partial results)
 * never reach this hook, so they call `Sentry.captureException` themselves.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error) => {
    if (isError(error) && error.statusCode < 500) return;

    Sentry.captureException(error.cause ?? error);
  });
});
