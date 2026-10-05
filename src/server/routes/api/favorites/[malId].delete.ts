import { and, eq } from 'drizzle-orm';
import { createError, defineEventHandler, getRouterParam, sendNoContent } from 'h3';
import { requireUser } from '../../../auth';
import { useDb } from '../../../db/client';
import { favorites } from '../../../db/schema';
import { withSpan } from '../../../utils/tracing';
import { log } from '../../../utils/logger';
import { favoritesCounter, apiRequestCounter } from '../../../utils/metrics';

export default defineEventHandler(async (event) => {
  apiRequestCounter.add(1, { 'http.route': '/api/favorites/:malId', 'http.method': 'DELETE' });

  const user = await requireUser(event);
  const malId = Number(getRouterParam(event, 'malId'));
  if (!Number.isInteger(malId) || malId <= 0) throw createError({ statusCode: 400, statusMessage: 'Invalid anime id' });

  await withSpan('favorites.remove', async (span) => {
    span.setAttribute('user.id', user.id);
    span.setAttribute('anime.malId', malId);

    // Removing something that isn't saved is a no-op, so repeated clicks are harmless.
    useDb().delete(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.malId, malId))).run();

    favoritesCounter.add(1, { operation: 'remove', 'anime.malId': malId });
    log('info', 'Favorite removed', { 'user.id': user.id, 'anime.malId': malId });
  });

  return sendNoContent(event);
});
