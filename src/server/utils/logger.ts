import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { trace, context } from '@opentelemetry/api';

const logger = logs.getLogger('analog-anime');

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const severityMap: Record<LogLevel, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

/** Emit a structured log record correlated with the current trace context. */
export function log(level: LogLevel, message: string, attrs: Record<string, unknown> = {}) {
  const activeSpan = trace.getSpan(context.active());
  logger.emit({
    severityNumber: severityMap[level],
    severityText: level.toUpperCase(),
    body: message,
    attributes: {
      ...attrs,
      // Correlate log with the current trace
      ...(activeSpan && {
        'trace.id': activeSpan.spanContext().traceId,
        'span.id': activeSpan.spanContext().spanId,
      }),
    },
  });
}
