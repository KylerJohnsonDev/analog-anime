import { desc, eq } from 'drizzle-orm';
import { defineEventHandler } from 'h3';
import { requireUser } from '../../auth';
import { useDb } from '../../db/client';
import { favorites } from '../../db/schema';
import { withSpan } from '../../utils/tracing';
import { apiRequestCounter } from '../../utils/metrics';

export default defineEventHandler(async (event) => {
  apiRequestCounter.add(1, { 'http.route': '/api/favorites', 'http.method': 'GET' });

  const user = await requireUser(event);

  return withSpan('favorites.list', async (span) => {
    span.setAttribute('user.id', user.id);

    const results = useDb()
      .select({
        malId: favorites.malId,
        title: favorites.title,
        url: favorites.url,
        imageUrl: favorites.imageUrl,
        score: favorites.score,
        episodes: favorites.episodes,
        type: favorites.type,
        addedAt: favorites.addedAt,
      })
      .from(favorites)
      .where(eq(favorites.userId, user.id))
      .orderBy(desc(favorites.addedAt), desc(favorites.malId))
      .all();

    span.setAttribute('favorites.count', results.length);
    return results;
  });
});
