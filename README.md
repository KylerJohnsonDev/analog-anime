# analog-anime

This project was generated with [Analog](https://analogjs.org), the fullstack meta-framework for Angular.

## Setup

Run `npm install` to install the application dependencies.

Sign-in uses [Better Auth](https://www.better-auth.com) with email and password. Create a `.env` file in the project root:

```sh
BETTER_AUTH_SECRET=   # generate one with: openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:5173
```

The dev server reads `.env` automatically; for `npm run preview` or production, set these as real environment variables (with `BETTER_AUTH_URL` set to the public URL).

## Database

Accounts and favorites are stored in SQLite at `data/anime.db` (override with `DATABASE_PATH`), accessed through [Drizzle](https://orm.drizzle.team). Migrations in `drizzle/` are applied automatically when the server first opens the database. After changing `src/server/db/schema.ts`, run `npm run db:generate` to create a new migration.

## Development

Run `npm start` for a dev server. Navigate to `http://localhost:5173/`. The application automatically reloads if you change any of the source files.

## Build

Run `npm run build` to build the client/server project. The client build artifacts are located in the `dist/analog/public` directory. The server for the API build artifacts are located in the `dist/analog/server` directory.

## Running with Docker

There are two ways to run the app in Docker:

- **Docker Compose** runs the app together with a local error tracker, GlitchTip, with no setup beyond one secret. Use this for local development.
- **Docker only** builds and runs just the app container, for when you don't need error tracking or already have a Sentry or GlitchTip project to report to.

### Docker Compose: the app and GlitchTip

`compose.yaml` runs the app alongside [GlitchTip](https://glitchtip.com), an open-source error tracker that accepts events from the Sentry SDKs unchanged, so you can see errors, traces and source-mapped stack traces locally. GlitchTip is much lighter than self-hosted Sentry: the whole stack uses about 400 MB of memory, and each container has a memory limit. Session replay and profiling data aren't supported by GlitchTip and are dropped.

| Service | URL | Memory limit |
|---|---|---|
| `app` | http://localhost:3000 | 512 MB |
| `glitchtip` | http://localhost:8000 | 768 MB |
| `glitchtip-postgres` | (internal) | 384 MB |
| `glitchtip-seed` | Runs once on start, then exits | 384 MB |

Ports are bound to `127.0.0.1`, so nothing is reachable from other machines.

#### First-time setup

1. Copy `.env.example` to `.env` and set `BETTER_AUTH_SECRET`.
2. Start GlitchTip and seed it: `docker compose up -d glitchtip-seed`
3. Build and start the app: `docker compose up -d --build`

There's nothing to configure in GlitchTip. On first start, `glitchtip-seed` (`docker/glitchtip/seed.py`) creates:

- A shared login for http://localhost:8000: **`dev@analog-anime.com`** / **`Pa$$word123`**
- The `analog-anime` organization and project, with a fixed DSN key that `compose.yaml` uses by default
- A fixed auth token (`docker/glitchtip/dev-auth-token`) that the image build uses to upload source maps

These credentials are committed on purpose. They're only for local development: GlitchTip is bound to `127.0.0.1` and holds only local test data. Never reuse them anywhere else.

Step 2 comes first because source maps are uploaded while the app image builds, so GlitchTip has to be running and seeded by then. If you build first anyway, the app still works, but browser stack traces stay minified until you rebuild.

#### Day to day

- `docker compose up -d` starts everything; `docker compose up -d --build app` rebuilds the app after code changes.
- `docker compose logs -f app` follows the server logs.
- `docker compose down` stops everything. Accounts, favorites and GlitchTip data are kept in named volumes; `docker compose down -v` deletes them, and the next start seeds GlitchTip again.

The browser DSN is baked in when the image is built. To report to a different Sentry or GlitchTip project, set `SENTRY_DSN` (and `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_URL` for source maps) in `.env` and rebuild.

### Docker only: just the app

Build the image:

```sh
docker build -t analog-anime .
```

Run it, with a named volume so accounts and favorites survive restarts:

```sh
docker run -d --name analog-anime \
  -p 127.0.0.1:3000:3000 \
  -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  -e BETTER_AUTH_URL=http://localhost:3000 \
  -v analog-anime-data:/data \
  analog-anime
```

Then open http://localhost:3000. A new secret on every `docker run` signs everyone out, so for anything longer-lived, generate one secret and reuse it. Without a DSN, Sentry is switched off and the server logs `SENTRY_DSN not set`.

To report errors to an existing Sentry or GlitchTip project, pass the DSN twice: as a build argument for the browser bundle, and as an environment variable for the server.

```sh
docker build -t analog-anime --build-arg VITE_SENTRY_DSN=<your DSN> .
docker run ... -e SENTRY_DSN=<your DSN> analog-anime
```

The DSN must be reachable from both your browser and the container. A DSN pointing at `localhost` won't work for the server, because `localhost` inside the container is the container itself. That's why the Compose setup rewrites it.

To upload source maps as well, add the project details as build arguments and pass the auth token as a build secret, so it isn't stored in the image:

```sh
SENTRY_AUTH_TOKEN=<your token> docker build -t analog-anime \
  --build-arg VITE_SENTRY_DSN=<your DSN> \
  --build-arg SENTRY_URL=<your Sentry or GlitchTip URL> \
  --build-arg SENTRY_ORG=<org slug> \
  --build-arg SENTRY_PROJECT=<project slug> \
  --secret id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
  .
```

If Sentry or GlitchTip runs on this machine, also pass `--network host`, so the build can reach it at `localhost`.

To stop and remove the container, run `docker rm -f analog-anime`. The `analog-anime-data` volume keeps your data until you run `docker volume rm analog-anime-data`.

## Test

Run `npm run test` to run unit tests with [Vitest](https://vitest.dev).

## Community

- Visit and Star the [GitHub Repo](https://github.com/analogjs/analog)
- Join the [Discord](https://chat.analogjs.org)
- Follow us on [Twitter](https://twitter.com/analogjs)
- Become a [Sponsor](https://github.com/sponsors/brandonroberts)
