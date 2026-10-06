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

`compose.yaml` runs the app alongside [GlitchTip](https://glitchtip.com), an open-source error tracker that accepts events from the Sentry SDKs unchanged, so you can see errors, traces and source-mapped stack traces locally. GlitchTip is much lighter than self-hosted Sentry: the whole stack uses about 400 MB of memory, and each container has a memory limit. Session replay and profiling data aren't supported by GlitchTip and are dropped.

| Service | URL | Memory limit |
|---|---|---|
| `app` | http://localhost:3000 | 512 MB |
| `glitchtip` | http://localhost:8000 | 768 MB |
| `glitchtip-postgres` | (internal) | 384 MB |

Ports are bound to `127.0.0.1`, so nothing is reachable from other machines.

### First-time setup

1. Copy `.env.example` to `.env` and set `BETTER_AUTH_SECRET`.
2. Start GlitchTip on its own: `docker compose up -d glitchtip`
3. Open http://localhost:8000, register an account, then create an organization and a project (platform: Angular).
4. Copy the project's DSN into `.env` as `SENTRY_DSN`. It looks like `http://<key>@localhost:8000/1`.
5. For readable browser stack traces, create an auth token under **Profile → Auth Tokens** with the `project:releases`, `project:read` and `org:read` scopes, and set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` (the organization and project slugs from GlitchTip's URLs). Without a token, the build skips the upload and generates no source maps.
6. Build and start the app: `docker compose up -d --build app`

The browser DSN is baked in when the image is built, so rerun step 6 after changing `SENTRY_DSN`. The build uses the host network so it can upload source maps to GlitchTip on `localhost:8000`, and the auth token is passed as a build secret, so it isn't stored in the image.

### Day to day

- `docker compose up -d` starts everything; `docker compose up -d --build app` rebuilds the app after code changes.
- `docker compose logs -f app` follows the server logs.
- `docker compose down` stops everything. Accounts, favorites and GlitchTip data are kept in named volumes; `docker compose down -v` deletes them.

## Test

Run `npm run test` to run unit tests with [Vitest](https://vitest.dev).

## Community

- Visit and Star the [GitHub Repo](https://github.com/analogjs/analog)
- Join the [Discord](https://chat.analogjs.org)
- Follow us on [Twitter](https://twitter.com/analogjs)
- Become a [Sponsor](https://github.com/sponsors/brandonroberts)
