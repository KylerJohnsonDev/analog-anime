import { and, eq } from 'drizzle-orm';
import { createError, defineEventHandler, getRouterParam, sendNoContent } from 'h3';
import { requireUser } from '../../../auth';
import { useDb } from '../../../db/client';
import { favorites } from '../../../db/schema';
import { withSpan, addLogBreadcrumb } from '../../../utils/sentry-helpers';
import * as Sentry from '@sentry/node';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);
  const malId = Number(getRouterParam(event, 'malId'));
  if (!Number.isInteger(malId) || malId <= 0) throw createError({ statusCode: 400, statusMessage: 'Invalid anime id' });

  await withSpan('db', 'favorites.remove', async (span) => {
    Sentry.setUser({ id: user.id });
    span.setAttribute('anime.malId', malId);

    // Removing something that isn't saved is a no-op, so repeated clicks are harmless.
    useDb().delete(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.malId, malId))).run();

    addLogBreadcrumb('info', 'favorites', 'Favorite removed', { userId: user.id, malId });
  });

  return sendNoContent(event);
});
