import { createError, defineEventHandler } from 'h3';
import { defineCachedFunction } from 'nitropack/runtime';
import * as Sentry from '@sentry/node';
import { withSpan, addLogBreadcrumb } from '../../utils/sentry-helpers';

interface EdgeResponse<T> {
  data: T;
}

interface AnimeGenre {
  malId: number;
  name: string;
  count: number;
}

const ANIME_API = 'https://jikan.lucashdo.com/v1';
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

// `filter=genres` leaves out the explicit genres (Hentai, Erotica, Ecchi) and themes/demographics.
// Genres rarely change, so the API is hit at most once a day. A failed fetch throws and isn't cached,
// and once a day has passed the stale list is served while a fresh one loads in the background.
const getGenres = defineCachedFunction(
  async (): Promise<AnimeGenre[]> => withSpan('http.client', 'jikan.fetchGenres', async (span) => {
    const start = performance.now();
    const response = await fetch(`${ANIME_API}/genres/anime?filter=genres`);
    const durationMs = performance.now() - start;

    Sentry.setMeasurement('jikan.response_time', durationMs, 'millisecond');

    if (!response.ok) {
      addLogBreadcrumb('error', 'jikan', `Jikan API /genres/anime failed: ${response.status}`, {
        status: response.status, durationMs,
      });
      throw new Error(`jikan-edge responded with ${response.status}`);
    }

    addLogBreadcrumb('info', 'jikan', 'Jikan API /genres/anime OK', { durationMs });
    const result = (await response.json()) as EdgeResponse<AnimeGenre[]>;
    const genres = [...(result.data ?? [])]
      .map(({ malId, name, count }) => ({ malId, name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    span.setAttribute('anime.genreCount', genres.length);
    return genres;
  }),
  { name: 'anime-genres', getKey: () => 'anime', maxAge: ONE_DAY_IN_SECONDS },
);

export default defineEventHandler(async () => {
  return Sentry.startSpan({ op: 'http.handler', name: 'GET /api/genres' }, async () => {
    try {
      return await getGenres();
    } catch (err) {
      addLogBreadcrumb('error', 'genres', 'Genres fetch failed, returning 502', { error: String(err) });
      throw createError({ statusCode: 502, statusMessage: 'Genres are temporarily unavailable', cause: err });
    }
  });
});
