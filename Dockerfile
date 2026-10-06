# syntax=docker/dockerfile:1

# --- Build: install everything, build the client and the Nitro server ---
FROM node:24-bookworm-slim AS build
WORKDIR /app

# Toolchain for native modules (better-sqlite3, Sentry profiler) in case no prebuilt binary matches.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

# The browser DSN is baked into the client bundle at build time. DSNs aren't secret.
ARG VITE_SENTRY_DSN=""
ARG VITE_APP_VERSION="0.1.0"
# Source map upload settings. Left empty, the upload is skipped and no maps are generated.
ARG SENTRY_URL=""
ARG SENTRY_ORG=""
ARG SENTRY_PROJECT=""
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_APP_VERSION=$VITE_APP_VERSION \
    SENTRY_URL=$SENTRY_URL \
    SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT

# The auth token comes in as a build secret so it never lands in an image layer.
RUN --mount=type=secret,id=sentry_auth_token,required=false \
  SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" npm run build

# instrumentation.ts is loaded with --import, outside the server bundle, so Nitro doesn't include
# all of what it needs (the profiler's native module is left out). Give it its own small install,
# pinned to the versions in the lockfile.
RUN mkdir /instrumentation && cd /instrumentation \
  && echo '{"type":"module","private":true}' > package.json \
  && npm install --omit=dev --no-audit --no-fund \
    "@sentry/node@$(node -p "require('/app/node_modules/@sentry/node/package.json').version")" \
    "@sentry/profiling-node@$(node -p "require('/app/node_modules/@sentry/profiling-node/package.json').version")" \
  && cp /app/src/server/instrumentation.ts .

# --- Runtime: just the built server, its traced dependencies and the migrations ---
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/anime.db

COPY --from=build /app/dist/analog ./
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /instrumentation ./instrumentation

RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000

CMD ["node", "--import", "./instrumentation/instrumentation.ts", "server/index.mjs"]
