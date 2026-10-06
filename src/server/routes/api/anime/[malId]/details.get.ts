import { createError, defineEventHandler, getRouterParam } from 'h3';
import { defineCachedFunction } from 'nitropack/runtime';
import * as Sentry from '@sentry/node';
import { withSpan, addLogBreadcrumb } from '../../../../utils/sentry-helpers';
import { fetchAnimeApi } from '../../../../utils/jikan-client';

interface AnimeNews {
  malId: number;
  title: string;
  url: string;
  imageUrl: string | null;
  excerpt: string;
  date: string;
  author: string;
}

const NEWS_COUNT = 3;
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
const FOUR_HOURS_IN_SECONDS = 60 * 60 * 4;

// Synopses rarely change, so each is fetched at most once a day; news at most every 4 hours. As with the
// home feed, a failed fetch isn't cached, and stale entries are served while fresh ones load.
const getSynopsis = defineCachedFunction(
  async (malId: number) => withSpan('http.client', 'jikan.fetchAnimeDetails', async (span) => {
    span.setAttribute('anime.malId', malId);
    const synopsis = (await fetchAnimeApi<{ synopsis: string | null }>(`/anime/${malId}`)).synopsis ?? null;
    span.setAttribute('anime.hasSynopsis', synopsis !== null);
    return synopsis;
  }),
  { name: 'anime-synopsis', getKey: (malId: number) => String(malId), maxAge: ONE_DAY_IN_SECONDS },
);

// jikan-edge lists news newest first.
const getNews = defineCachedFunction(
  async (malId: number): Promise<AnimeNews[]> => withSpan('http.client', 'jikan.fetchAnimeNews', async (span) => {
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
  return Sentry.startSpan({ op: 'http.handler', name: 'GET /api/anime/:malId/details' }, async () => {
    const malId = Number(getRouterParam(event, 'malId'));
    if (!Number.isInteger(malId) || malId <= 0) throw createError({ statusCode: 400, statusMessage: 'Invalid anime id' });

    const [synopsis, news] = await Promise.allSettled([getSynopsis(malId), getNews(malId)]);

    if (synopsis.status === 'rejected') {
      addLogBreadcrumb('error', 'anime-details', 'Failed to fetch synopsis', { malId, error: String(synopsis.reason) });
      Sentry.captureException(synopsis.reason);
    }
    if (news.status === 'rejected') {
      addLogBreadcrumb('error', 'anime-details', 'Failed to fetch news', { malId, error: String(news.reason) });
      Sentry.captureException(news.reason);
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
});
