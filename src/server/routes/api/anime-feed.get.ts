import { defineEventHandler } from 'h3';
import { defineCachedFunction } from 'nitropack/runtime';
import * as Sentry from '@sentry/node';
import { withSpan, addLogBreadcrumb } from '../../utils/sentry-helpers';
import { fetchAnimeApi, ANIME_API } from '../../utils/jikan-client';

interface AnimeEntry {
  malId: number;
  url?: string;
  title: string;
  imageUrl: string | null;
  score: number | null;
  episodes: number | null;
  type: string | null;
}

interface AnimeRecommendation {
  malId: number;
  title: string;
  imageUrl: string | null;
  recommendedMalId: number;
  recommendedTitle: string;
  recommendedImageUrl: string | null;
  content: string;
  username: string;
}

// jikan-edge has no `limit`: top lists come back 50 at a time and recommendations 100 at a time.
const TOP_ANIME_COUNT = 12;
const RECOMMENDATION_COUNT = 8;
const FOUR_HOURS_IN_SECONDS = 60 * 60 * 4;

// Each list hits jikan-edge at most once every 4 hours. A failed fetch throws and isn't cached, so it's
// retried on the next request; once 4 hours have passed the stale list is served while a fresh one loads.
const getTopAnime = defineCachedFunction(
  () => withSpan('http.client', 'jikan.fetchTopAnime', async (span) => {
    span.setAttribute('http.url', `${ANIME_API}/top/anime`);
    const data = await fetchAnimeApi<AnimeEntry[]>('/top/anime');
    span.setAttribute('anime.count', data.length);
    return data;
  }),
  { name: 'anime-feed', getKey: () => 'top-anime', maxAge: FOUR_HOURS_IN_SECONDS },
);

const getRecommendations = defineCachedFunction(
  () => withSpan('http.client', 'jikan.fetchRecommendations', async (span) => {
    span.setAttribute('http.url', `${ANIME_API}/recommendations/anime`);
    const data = await fetchAnimeApi<AnimeRecommendation[]>('/recommendations/anime');
    span.setAttribute('anime.count', data.length);
    return data;
  }),
  { name: 'anime-feed', getKey: () => 'recommendations', maxAge: FOUR_HOURS_IN_SECONDS },
);

export default defineEventHandler(async () => {
  return Sentry.startSpan({ op: 'http.handler', name: 'GET /api/anime-feed' }, async () => {
    const [topResult, recommendationsResult] = await Promise.allSettled([
      getTopAnime(),
      getRecommendations(),
    ]);

    if (topResult.status === 'rejected') {
      addLogBreadcrumb('error', 'anime-feed', 'Failed to fetch top anime', { error: String(topResult.reason) });
      Sentry.captureException(topResult.reason);
    }
    if (recommendationsResult.status === 'rejected') {
      addLogBreadcrumb('error', 'anime-feed', 'Failed to fetch recommendations', { error: String(recommendationsResult.reason) });
      Sentry.captureException(recommendationsResult.reason);
    }

    return {
      topAnime: topResult.status === 'fulfilled'
        ? topResult.value.slice(0, TOP_ANIME_COUNT).map((anime) => ({ ...anime, url: anime.url ?? `https://myanimelist.net/anime/${anime.malId}` }))
        : [],
      recommendations: recommendationsResult.status === 'fulfilled' ? recommendationsResult.value.slice(0, RECOMMENDATION_COUNT) : [],
      errors: {
        topAnime: topResult.status === 'rejected',
        recommendations: recommendationsResult.status === 'rejected',
      },
    };
  });
});
