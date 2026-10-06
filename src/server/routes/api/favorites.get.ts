import { desc, eq } from 'drizzle-orm';
import { defineEventHandler } from 'h3';
import { requireUser } from '../../auth';
import { useDb } from '../../db/client';
import { favorites } from '../../db/schema';
import { withSpan } from '../../utils/sentry-helpers';
import * as Sentry from '@sentry/node';

export default defineEventHandler(async (event) => {
  const user = await requireUser(event);

  return withSpan('db', 'favorites.list', async (span) => {
    Sentry.setUser({ id: user.id });

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
