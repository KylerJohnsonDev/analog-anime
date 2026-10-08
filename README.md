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

## Deploying to Railway

Production runs on [Railway](https://railway.com) as a single always-on Node server, with the SQLite database on a Railway volume. `railway.json` sets the build and start commands. Volumes and variables can't go in that file, so they're set once in the Railway dashboard.

### One-time setup

1. Create a Railway project from this GitHub repo. Railway builds with `npm run build` and starts with `npm run preview`, as set in `railway.json`. Pushes to `main` redeploy automatically.
2. Add a volume to the service, mounted at `/data`. Volumes need Railway's Hobby plan or higher.
3. Under **Settings → Networking**, generate a Railway domain or add your own.
4. Set these variables on the service:

| Variable | Value |
|---|---|
| `DATABASE_PATH` | `/data/anime.db` |
| `BETTER_AUTH_SECRET` | A new secret: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | The public URL from step 3, like `https://analog-anime.up.railway.app` |
| `SENTRY_DSN` | The Sentry project's DSN, for server errors |
| `VITE_SENTRY_DSN` | The same DSN, baked into the browser bundle at build time |
| `SENTRY_ORG` | `kyler-johnson` |
| `SENTRY_PROJECT` | `javascript-angular-7d` |
| `SENTRY_AUTH_TOKEN` | A Sentry organization auth token, for source map uploads |

Railway provides `PORT`, and the server listens on it automatically.

### Sentry only in production

Sentry is switched off wherever there's no DSN, so set the Sentry variables only on Railway's production environment. Local development and any other Railway environments then report nothing. Without `SENTRY_AUTH_TOKEN`, the build also skips generating and uploading source maps.

### Keep it to one instance

SQLite lives on a single volume, so the service must run as one instance. Don't add replicas. Moving to a hosted database would be needed first.

## Test

Run `npm run test` to run unit tests with [Vitest](https://vitest.dev).

## Community

- Visit and Star the [GitHub Repo](https://github.com/analogjs/analog)
- Join the [Discord](https://chat.analogjs.org)
- Follow us on [Twitter](https://twitter.com/analogjs)
- Become a [Sponsor](https://github.com/sponsors/brandonroberts)
