import { createError, defineEventHandler, readBody, setResponseStatus } from 'h3';
import { requireUser } from '../../auth';
import { useDb } from '../../db/client';
import { favorites, NewFavorite } from '../../db/schema';
import { withSpan } from '../../utils/tracing';
import { log } from '../../utils/logger';
import { favoritesCounter, apiRequestCounter } from '../../utils/metrics';

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function parseFavorite(body: unknown): Omit<NewFavorite, 'userId' | 'addedAt'> | null {
  if (!body || typeof body !== 'object') return null;
  const { malId, title, url, imageUrl = null, score = null, episodes = null, type = null } = body as Record<string, unknown>;

  if (!Number.isInteger(malId) || (malId as number) <= 0) return null;
  if (typeof title !== 'string' || !title.trim()) return null;
  if (url !== undefined && typeof url !== 'string') return null;
  if (!isNullableString(imageUrl) || !isNullableNumber(score) || !isNullableNumber(episodes) || !isNullableString(type)) return null;

  return {
    malId: malId as number,
    title: title.trim(),
    url: url ?? `https://myanimelist.net/anime/${malId}`,
    imageUrl,
    score,
    episodes,
    type,
  };
}

export default defineEventHandler(async (event) => {
  apiRequestCounter.add(1, { 'http.route': '/api/favorites', 'http.method': 'POST' });

  const user = await requireUser(event);
  const favorite = parseFavorite(await readBody(event));
  if (!favorite) {
    log('warn', 'Invalid favorite body received', { 'user.id': user.id });
    throw createError({ statusCode: 400, statusMessage: 'Invalid anime' });
  }

  const saved = await withSpan('favorites.add', async (span) => {
    span.setAttribute('user.id', user.id);
    span.setAttribute('anime.malId', favorite.malId);
    span.setAttribute('anime.title', favorite.title);

    // Saving an existing favorite refreshes its details but keeps its original position in the list.
    const [{ userId: _userId, ...result }] = useDb()
      .insert(favorites)
      .values({ ...favorite, userId: user.id })
      .onConflictDoUpdate({ target: [favorites.userId, favorites.malId], set: favorite })
      .returning()
      .all();

    favoritesCounter.add(1, { operation: 'add', 'anime.malId': favorite.malId });
    log('info', 'Favorite added', { 'user.id': user.id, 'anime.malId': favorite.malId });
    return result;
  });

  setResponseStatus(event, 201);
  return saved;
});
