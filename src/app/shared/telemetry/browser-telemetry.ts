import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { resourceFromAttributes } from '@opentelemetry/resources';

/**
 * Initializes OpenTelemetry browser instrumentation.
 *
 * Call this at the very top of `main.ts` — before Angular bootstraps — so that
 * the document-load span captures the full page lifecycle.
 *
 * Traces are exported via OTLP/HTTP to a collector or observability backend
 * (SigNoz, Grafana Tempo, New Relic, etc.).
 */
export function initBrowserTelemetry() {
  // Skip during SSR — there is no `window` on the server.
  if (typeof window === 'undefined') return;

  const otelEndpoint =
    ((window as unknown as Record<string, unknown>)['__OTEL_BROWSER_ENDPOINT__'] as string | undefined) ??
    'http://localhost:4318';

  const resource = resourceFromAttributes({
    'service.name': 'analog-anime-web',
    'service.version': '0.0.0',
  });

  const provider = new WebTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({
          url: `${otelEndpoint}/v1/traces`,
        }),
      ),
    ],
  });

  provider.register({ contextManager: new ZoneContextManager() });

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new FetchInstrumentation({
        // Propagate W3C traceparent header to same-origin API calls
        // so browser spans link to server spans in the same trace.
        propagateTraceHeaderCorsUrls: [/\/api\//],
      }),
      new UserInteractionInstrumentation(),
    ],
  });

  console.log('[otel] Browser telemetry initialized →', otelEndpoint);
}
