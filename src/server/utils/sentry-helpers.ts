import * as Sentry from '@sentry/node';

/**
 * Wraps an async function in a Sentry span for performance tracing.
 * Automatically records errors and sets span status.
 */
export async function withSpan<T>(
  op: string,
  name: string,
  fn: (span: Sentry.Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  return Sentry.startSpan(
    { op, name, attributes },
    async (span) => {
      try {
        return await fn(span);
      } catch (err) {
        span.setStatus({ code: 2, message: String(err) }); // ERROR
        throw err;
      }
    },
  );
}

/**
 * Adds a breadcrumb to the current Sentry scope.
 * Breadcrumbs are attached to the next error/event that fires.
 */
export function addLogBreadcrumb(
  level: Sentry.SeverityLevel,
  category: string,
  message: string,
  data?: Record<string, unknown>,
) {
  Sentry.addBreadcrumb({
    level,
    category,
    message,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Captures a structured log message in Sentry with optional context data.
 * Use for important events that should appear in Sentry's Issues/Logs view
 * even when no error is thrown.
 */
export function captureLog(
  level: Sentry.SeverityLevel,
  message: string,
  context?: Record<string, unknown>,
) {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('log_data', context);
    }
    Sentry.captureMessage(message, level);
  });
}
