import { createError, defineEventHandler, getRouterParam } from 'h3';
import { defineCachedFunction } from 'nitropack/runtime';
import { withSpan } from '../../../../utils/tracing';
import { log } from '../../../../utils/logger';
import { jikanLatencyHistogram, apiRequestCounter } from '../../../../utils/metrics';

interface EdgeResponse<T> {
  data: T;
}

interface AnimeNews {
  malId: number;
  title: string;
  url: string;
  imageUrl: string | null;
  excerpt: string;
  date: string;
  author: string;
}

const ANIME_API = 'https://jikan.lucashdo.com/v1';
const NEWS_COUNT = 3;
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
const FOUR_HOURS_IN_SECONDS = 60 * 60 * 4;

async function fetchAnimeApi<T>(path: string): Promise<T> {
  const start = performance.now();
  const response = await fetch(`${ANIME_API}${path}`);
  const durationMs = performance.now() - start;

  jikanLatencyHistogram.record(durationMs, { 'http.url': path });

  if (!response.ok) {
    log('error', `Jikan API request failed: ${response.status}`, { 'http.url': path, 'http.status_code': response.status });
    throw new Error(`jikan-edge responded with ${response.status}`);
  }
  const result = (await response.json()) as EdgeResponse<T>;
  return result.data;
}

// Synopses rarely change, so each is fetched at most once a day; news at most every 4 hours. As with the
// home feed, a failed fetch isn't cached, and stale entries are served while fresh ones load.
const getSynopsis = defineCachedFunction(
  async (malId: number) => withSpan('jikan.fetchAnimeDetails', async (span) => {
    span.setAttribute('anime.malId', malId);
    const synopsis = (await fetchAnimeApi<{ synopsis: string | null }>(`/anime/${malId}`)).synopsis ?? null;
    span.setAttribute('anime.hasSynopsis', synopsis !== null);
    return synopsis;
  }),
  { name: 'anime-synopsis', getKey: (malId: number) => String(malId), maxAge: ONE_DAY_IN_SECONDS },
);

// jikan-edge lists news newest first.
const getNews = defineCachedFunction(
  async (malId: number): Promise<AnimeNews[]> => withSpan('jikan.fetchAnimeNews', async (span) => {
    span.setAttribute('anime.malId', malId);
    const news = (await fetchAnimeApi<AnimeNews[]>(`/anime/${malId}/news`))
      .slice(0, NEWS_COUNT)
      .map(({ malId, title, url, imageUrl, excerpt, date, author }) => ({ malId, title, url, imageUrl, excerpt, date, author }));
    span.setAttribute('anime.newsCount', news.length);
    return news;
  }),
  { name: 'anime-news', getKey: (malId: number) => String(malId), maxAge: FOUR_HOURS_IN_SECONDS },
);

export default defineEventHandler(async (event) => {
  apiRequestCounter.add(1, { 'http.route': '/api/anime/:malId/details' });

  const malId = Number(getRouterParam(event, 'malId'));
  if (!Number.isInteger(malId) || malId <= 0) throw createError({ statusCode: 400, statusMessage: 'Invalid anime id' });

  const [synopsis, news] = await Promise.allSettled([getSynopsis(malId), getNews(malId)]);

  if (synopsis.status === 'rejected') {
    log('error', 'Failed to fetch synopsis from Jikan', { 'anime.malId': malId, error: String(synopsis.reason) });
  }
  if (news.status === 'rejected') {
    log('error', 'Failed to fetch news from Jikan', { 'anime.malId': malId, error: String(news.reason) });
  }

  return {
    synopsis: synopsis.status === 'fulfilled' ? synopsis.value : null,
    news: news.status === 'fulfilled' ? news.value : [],
    errors: {
      synopsis: synopsis.status === 'rejected',
      news: news.status === 'rejected',
    },
  };
});
