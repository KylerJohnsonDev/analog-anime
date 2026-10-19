// Shapes returned by jikan-edge (https://github.com/LucasHenriqueDiniz/jikan-edge), trimmed to what the app uses.
// List routes return a slimmer entry than `/anime/{id}`: no rank, year, English title or image sizes.

export interface AnimeEntry {
  malId: number;
  url?: string; // missing on `/top/anime`; use `animeUrl()`
  title: string;
  imageUrl: string | null;
  score: number | null;
  episodes: number | null;
  type: string | null;
}

export interface AnimeRecommendation {
  malId: number;
  title: string;
  imageUrl: string | null;
  recommendedMalId: number;
  recommendedTitle: string;
  recommendedImageUrl: string | null;
  content: string;
  username: string;
}

export interface AnimeGenre {
  malId: number;
  name: string;
  count: number;
}

export interface EdgePagination {
  page: number;
  limit: number;
  count: number;
  hasNextPage: boolean;
}

export interface EdgeResponse<T> {
  data: T;
  meta: { stale: boolean; pagination?: EdgePagination };
}

export const ANIME_TYPES = [
  { value: 'tv', label: 'TV' },
  { value: 'movie', label: 'Movie' },
  { value: 'ova', label: 'OVA' },
  { value: 'special', label: 'Special' },
  { value: 'ona', label: 'ONA' },
  { value: 'music', label: 'Music' },
] as const;

export const ANIME_STATUSES = [
  { value: 'airing', label: 'Airing' },
  { value: 'complete', label: 'Finished' },
  { value: 'upcoming', label: 'Upcoming' },
] as const;

// The `rx` (Hentai) rating is intentionally left out.
export const ANIME_RATINGS = [
  { value: 'g', label: 'G – All ages' },
  { value: 'pg', label: 'PG – Children' },
  { value: 'pg13', label: 'PG-13 – Teens 13+' },
  { value: 'r17', label: 'R – 17+' },
  { value: 'r', label: 'R+ – Mild nudity' },
] as const;

export type AnimeType = (typeof ANIME_TYPES)[number]['value'];
export type AnimeStatus = (typeof ANIME_STATUSES)[number]['value'];
export type AnimeRating = (typeof ANIME_RATINGS)[number]['value'];

export interface AnimeSearchFilters {
  q: string;
  genres: number[];
  type: AnimeType | null;
  status: AnimeStatus | null;
  rating: AnimeRating | null;
  page: number;
}

export function animeUrl(malId: number): string {
  return `https://myanimelist.net/anime/${malId}`;
}

/** An anime saved to the favorites database, as returned by `/api/favorites`. */
export interface FavoriteAnime extends AnimeEntry {
  url: string;
  addedAt: string; // ISO timestamp
}

export interface AnimeNews {
  malId: number;
  title: string;
  url: string;
  imageUrl: string | null;
  excerpt: string;
  date: string; // e.g. "Nov 5, 2018 2:27 PM"; the year is left off for this year's news
  author: string;
}

export interface AnimeProfile extends AnimeEntry {
  url: string;
  titleEnglish?: string | null;
  status?: string | null;
  rating?: string | null;
  year?: number | null;
  rank?: number | null;
  duration?: string | null;
  studios?: string[];
  genres?: string[];
}

/** Served by `/api/anime/:malId/details`. Each part fails independently, flagged in `errors`. */
export interface AnimeDetails {
  anime?: AnimeProfile | null;
  synopsis: string | null;
  news: AnimeNews[];
  errors: { synopsis: boolean; news: boolean };
}

