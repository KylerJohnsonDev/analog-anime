import { createError, defineEventHandler } from 'h3';
import { defineCachedFunction } from 'nitropack/runtime';
import { withSpan } from '../../utils/tracing';
import { log } from '../../utils/logger';
import { jikanLatencyHistogram, apiRequestCounter } from '../../utils/metrics';

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
  async (): Promise<AnimeGenre[]> => withSpan('jikan.fetchGenres', async (span) => {
    const start = performance.now();
    const response = await fetch(`${ANIME_API}/genres/anime?filter=genres`);
    const durationMs = performance.now() - start;

    jikanLatencyHistogram.record(durationMs, { 'http.url': '/genres/anime' });

    if (!response.ok) {
      log('error', `Jikan API request failed: ${response.status}`, { 'http.url': '/genres/anime', 'http.status_code': response.status });
      throw new Error(`jikan-edge responded with ${response.status}`);
    }
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
  apiRequestCounter.add(1, { 'http.route': '/api/genres' });

  try {
    return await getGenres();
  } catch (err) {
    log('error', 'Genres fetch failed, returning 502', { error: String(err) });
    throw createError({ statusCode: 502, statusMessage: 'Genres are temporarily unavailable' });
  }
});
