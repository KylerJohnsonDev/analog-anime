import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createError, H3Event, getRequestURL } from 'h3';
import { useDb } from './db/client';
import * as schema from './db/schema';
import { log } from './utils/logger';

// Email and password only. Reads BETTER_AUTH_SECRET and BETTER_AUTH_URL from the environment (see .env).
export const auth = betterAuth({
  database: drizzleAdapter(useDb(), { provider: 'sqlite', schema }),
  emailAndPassword: { enabled: true },
});

/** The signed-in user for this request; anyone else gets a 401. */
export async function requireUser(event: H3Event) {
  const session = await auth.api.getSession({ headers: event.headers });
  if (!session) {
    const path = getRequestURL(event).pathname;
    log('warn', 'Unauthenticated request rejected', { 'http.path': path });
    throw createError({ statusCode: 401, statusMessage: 'Sign in to continue' });
  }
  return session.user;
}
