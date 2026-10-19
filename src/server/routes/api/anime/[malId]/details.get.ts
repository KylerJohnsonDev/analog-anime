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

interface JikanAnimeResponse {
  malId: number;
  url?: string;
  title: string;
  titleEnglish?: string | null;
  imageUrl?: string | null;
  score?: number | null;
  episodes?: number | null;
  type?: string | null;
  status?: string | null;
  rating?: string | null;
  year?: number | null;
  rank?: number | null;
  duration?: string | null;
  synopsis?: string | null;
  studios?: { malId: number; name: string }[];
  genres?: { malId: number; name: string }[];
}

const NEWS_COUNT = 3;
const ONE_DAY_IN_SECONDS = 60 * 60 * 24;
const FOUR_HOURS_IN_SECONDS = 60 * 60 * 4;

// Synopses and anime metadata rarely change, so each is fetched at most once a day; news at most every 4 hours.
// As with the home feed, a failed fetch isn't cached, and stale entries are served while fresh ones load.
const getAnimeDetail = defineCachedFunction(
  async (malId: number) => withSpan('http.client', 'jikan.fetchAnimeDetails', async (span) => {
    span.setAttribute('anime.malId', malId);
    const data = await fetchAnimeApi<JikanAnimeResponse>(`/anime/${malId}`);
    const synopsis = data.synopsis ?? null;
    span.setAttribute('anime.hasSynopsis', synopsis !== null);
    return {
      synopsis,
      anime: {
        malId: data.malId ?? malId,
        url: data.url ?? `https://myanimelist.net/anime/${malId}`,
        title: data.title,
        titleEnglish: data.titleEnglish ?? null,
        imageUrl: data.imageUrl ?? null,
        score: data.score ?? null,
        episodes: data.episodes ?? null,
        type: data.type ?? null,
        status: data.status ?? null,
        rating: data.rating ?? null,
        year: data.year ?? null,
        rank: data.rank ?? null,
        duration: data.duration ?? null,
        studios: (data.studios ?? []).map((s) => s.name),
        genres: (data.genres ?? []).map((g) => g.name),
      },
    };
  }),
  { name: 'anime-detail-v2', getKey: (malId: number) => String(malId), maxAge: ONE_DAY_IN_SECONDS },
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

    const [detail, news] = await Promise.allSettled([getAnimeDetail(malId), getNews(malId)]);

    if (detail.status === 'rejected') {
      addLogBreadcrumb('error', 'anime-details', 'Failed to fetch synopsis', { malId, error: String(detail.reason) });
      Sentry.captureException(detail.reason);
    }
    if (news.status === 'rejected') {
      addLogBreadcrumb('error', 'anime-details', 'Failed to fetch news', { malId, error: String(news.reason) });
      Sentry.captureException(news.reason);
    }

    return {
      anime: detail.status === 'fulfilled' ? detail.value.anime : null,
      synopsis: detail.status === 'fulfilled' ? detail.value.synopsis : null,
      news: news.status === 'fulfilled' ? news.value : [],
      errors: {
        synopsis: detail.status === 'rejected',
        news: news.status === 'rejected',
      },
    };
  });
});

