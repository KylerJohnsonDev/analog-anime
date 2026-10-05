import { defineEventHandler } from 'h3';
import { defineCachedFunction } from 'nitropack/runtime';
import { withSpan } from '../../utils/tracing';
import { log } from '../../utils/logger';
import { jikanLatencyHistogram, apiRequestCounter } from '../../utils/metrics';

interface EdgeResponse<T> {
  data: T;
}

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

const ANIME_API = 'https://jikan.lucashdo.com/v1';
// jikan-edge has no `limit`: top lists come back 50 at a time and recommendations 100 at a time.
const TOP_ANIME_COUNT = 12;
const RECOMMENDATION_COUNT = 8;
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
  const result = await response.json() as EdgeResponse<T>;
  return result.data;
}

// Each list hits jikan-edge at most once every 4 hours. A failed fetch throws and isn't cached, so it's
// retried on the next request; once 4 hours have passed the stale list is served while a fresh one loads.
const getTopAnime = defineCachedFunction(
  () => withSpan('jikan.fetchTopAnime', async (span) => {
    span.setAttribute('http.url', '/top/anime');
    const data = await fetchAnimeApi<AnimeEntry[]>('/top/anime');
    span.setAttribute('anime.count', data.length);
    return data;
  }),
  { name: 'anime-feed', getKey: () => 'top-anime', maxAge: FOUR_HOURS_IN_SECONDS },
);

const getRecommendations = defineCachedFunction(
  () => withSpan('jikan.fetchRecommendations', async (span) => {
    span.setAttribute('http.url', '/recommendations/anime');
    const data = await fetchAnimeApi<AnimeRecommendation[]>('/recommendations/anime');
    span.setAttribute('anime.count', data.length);
    return data;
  }),
  { name: 'anime-feed', getKey: () => 'recommendations', maxAge: FOUR_HOURS_IN_SECONDS },
);

export default defineEventHandler(async () => {
  apiRequestCounter.add(1, { 'http.route': '/api/anime-feed' });

  const [topResult, recommendationsResult] = await Promise.allSettled([
    getTopAnime(),
    getRecommendations(),
  ]);

  if (topResult.status === 'rejected') {
    log('error', 'Failed to fetch top anime from Jikan', { error: String(topResult.reason) });
  }
  if (recommendationsResult.status === 'rejected') {
    log('error', 'Failed to fetch recommendations from Jikan', { error: String(recommendationsResult.reason) });
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
