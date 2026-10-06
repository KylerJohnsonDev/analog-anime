/// <reference types="vitest" />

import { defineConfig, loadEnv } from 'vite';
import analog from '@analogjs/platform';
import tailwindcss from '@tailwindcss/vite';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const sentryAuthToken = env['SENTRY_AUTH_TOKEN'] || process.env['SENTRY_AUTH_TOKEN'];
  const sentryOrg = env['SENTRY_ORG'] || process.env['SENTRY_ORG'];
  const sentryProject = env['SENTRY_PROJECT'] || process.env['SENTRY_PROJECT'];
  const hasSentryToken = Boolean(sentryAuthToken);

  return {
    build: {
      target: ['es2020'],
      // Emit source maps for Sentry only when auth token is present (uploaded then deleted).
      // Without an auth token, disable source maps to avoid deploying unreferenced .map files.
      sourcemap: hasSentryToken ? 'hidden' : false,
    },
    resolve: {
      mainFields: ['module'],
      tsconfigPaths: true,
    },
    plugins: [
      analog({
        nitro: {
          sourceMap: hasSentryToken,
        },
      }),
      tailwindcss(),
      // Upload source maps to Sentry so browser stack traces are readable.
      // Skipped when SENTRY_AUTH_TOKEN is missing (e.g. local dev builds).
      ...(hasSentryToken
        ? [
            sentryVitePlugin({
              org: sentryOrg,
              project: sentryProject,
              authToken: sentryAuthToken,
              sourcemaps: {
                filesToDeleteAfterUpload: ['./dist/**/*.map'],
              },
            }),
          ]
        : []),
    ],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      include: ['**/*.spec.ts'],
      reporters: ['default'],
    },
  };
});
