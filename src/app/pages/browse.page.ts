import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, ElementRef, inject, linkedSignal, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Params, Router } from '@angular/router';
import { RouteMeta } from '@analogjs/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideChevronLeft, lucideChevronRight, lucideCompass, lucideSearch, lucideX } from '@ng-icons/lucide';
import { catchError, combineLatest, distinctUntilChanged, map, of, startWith, Subject, switchMap, tap } from 'rxjs';
import { AnimeCardComponent } from '@/shared/anime/anime-card.component';
import { AnimePanelService } from '@/shared/anime/anime-panel.service';
import {
  ANIME_RATINGS,
  ANIME_STATUSES,
  ANIME_TYPES,
  AnimeEntry,
  AnimeGenre,
  AnimeSearchFilters,
  EdgePagination,
} from '@/shared/anime/anime.models';
import { BROWSE_PAGE_SIZE, JikanService } from '@/shared/anime/jikan.service';
import { ZardButtonComponent } from '@/shared/components/button';
import { SiteFooterComponent } from '@/shared/layout/site-footer.component';
import { SiteHeaderComponent } from '@/shared/layout/site-header.component';

export const routeMeta: RouteMeta = {
  title: 'Browse anime — Anime Index',
  meta: [{ name: 'description', content: 'Search and filter the anime catalog by genre, type, status and rating.' }],
};

function pickOption<T extends string>(value: string | null, options: readonly { value: T }[]): T | null {
  return options.find((option) => option.value === value)?.value ?? null;
}

function parseFilters(params: ParamMap): AnimeSearchFilters {
  const page = Number(params.get('page'));
  const genres = (params.get('genres') ?? '')
    .split(',')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0);

  return {
    q: params.get('q')?.trim() ?? '',
    genres: [...new Set(genres)].sort((a, b) => a - b),
    type: pickOption(params.get('type'), ANIME_TYPES),
    status: pickOption(params.get('status'), ANIME_STATUSES),
    rating: pickOption(params.get('rating'), ANIME_RATINGS),
    // jikan-edge refuses pages outside 1–1000 with a 400.
    page: Number.isInteger(page) && page > 0 && page <= 1000 ? page : 1,
  };
}

function toQueryParams(filters: AnimeSearchFilters): Params {
  return {
    q: filters.q || null,
    genres: filters.genres.length ? filters.genres.join(',') : null,
    type: filters.type,
    status: filters.status,
    rating: filters.rating,
    page: filters.page > 1 ? filters.page : null,
  };
}

function sameFilters(a: AnimeSearchFilters, b: AnimeSearchFilters): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function describeError(error: unknown): string {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  if (status === 429) return 'The anime database is getting too many requests. Wait a few seconds and try again.';
  if (status >= 500) return 'The anime database couldn’t reach MyAnimeList just now. Please try again shortly.';
  return 'Something went wrong while searching. Check your connection and try again.';
}

@Component({
  selector: 'app-browse',
  imports: [AnimeCardComponent, NgIcon, SiteFooterComponent, SiteHeaderComponent, ZardButtonComponent],
  viewProviders: [provideIcons({ lucideArrowRight, lucideChevronLeft, lucideChevronRight, lucideCompass, lucideSearch, lucideX })],
  template: `
    <div class="site-shell">
      <app-site-header />

      <main id="top">
        <section class="browse-intro" aria-labelledby="browse-title">
          <span class="section-kicker">THE WHOLE CATALOG</span>
          <h1 id="browse-title">Browse everything<span class="period">.</span></h1>
          <p>Search every series and film, then narrow it down by genre, format, status or rating.</p>
          <form class="browse-search" role="search" (submit)="submitSearch($event)">
            <ng-icon name="lucideSearch" />
            <input type="search" name="q" placeholder="Search by title" [value]="searchDraft()" (input)="onSearchInput($event)" aria-label="Search anime by title" />
            @if (searchDraft()) {
              <button type="button" class="clear-search" (click)="clearSearch()" aria-label="Clear search"><ng-icon name="lucideX" /></button>
            }
            <button type="submit" z-button zSize="lg">Search</button>
          </form>
        </section>

        <section class="browse-filters" aria-label="Filters">
          <div class="filter-row">
            <label class="filter-field">
              <span class="filter-label">Type</span>
              <select (change)="setType($event)">
                <option value="">Any type</option>
                @for (option of types; track option.value) {
                  <option [value]="option.value" [selected]="filters().type === option.value">{{ option.label }}</option>
                }
              </select>
            </label>
            <label class="filter-field">
              <span class="filter-label">Status</span>
              <select (change)="setStatus($event)">
                <option value="">Any status</option>
                @for (option of statuses; track option.value) {
                  <option [value]="option.value" [selected]="filters().status === option.value">{{ option.label }}</option>
                }
              </select>
            </label>
            <label class="filter-field">
              <span class="filter-label">Rating</span>
              <select (change)="setRating($event)">
                <option value="">Any rating</option>
                @for (option of ratings; track option.value) {
                  <option [value]="option.value" [selected]="filters().rating === option.value">{{ option.label }}</option>
                }
              </select>
            </label>
            @if (activeFilterCount()) {
              <button type="button" class="clear-filters" (click)="clearFilters()"><ng-icon name="lucideX" /> Clear filters ({{ activeFilterCount() }})</button>
            }
          </div>

          <div class="genre-filter" role="group" aria-labelledby="genre-label">
            <span id="genre-label" class="filter-label">Genres</span>
            @if (genres().length) {
              <div class="genre-chips">
                @for (genre of genres(); track genre.malId) {
                  <button type="button" class="genre-chip" [class.is-selected]="selectedGenres().has(genre.malId)" [attr.aria-pressed]="selectedGenres().has(genre.malId)" (click)="toggleGenre(genre.malId)">{{ genre.name }}</button>
                }
              </div>
            } @else if (genresError()) {
              <p class="genre-note">Genres couldn’t load. <button type="button" (click)="loadGenres()">Try again</button></p>
            } @else {
              <div class="genre-chips" aria-busy="true" aria-label="Loading genres">
                @for (placeholder of genrePlaceholders; track placeholder) { <span class="genre-chip genre-skeleton skeleton-shimmer"></span> }
              </div>
            }
          </div>
        </section>

        <section class="content-section browse-results" aria-labelledby="results-label" #resultsTop>
          <div class="section-heading">
            <div class="section-title-wrap">
              <span class="section-kicker" id="results-label">RESULTS</span>
              @if (filters().q) {
                <h2>Results for <span>“{{ filters().q }}”</span></h2>
              }
            </div>
            @if (pagination()) {
              <span class="result-count">Page {{ filters().page }}</span>
            }
          </div>

          @if (loading()) {
            <div class="anime-grid browse-grid" aria-label="Loading results" aria-busy="true">
              @for (placeholder of resultPlaceholders; track placeholder) {
                <div class="anime-card skeleton-card"><div class="poster-wrap skeleton-shimmer"></div><div class="skeleton-line"></div><div class="skeleton-short"></div></div>
              }
            </div>
          } @else if (error()) {
            <div class="empty-state"><span class="empty-icon"><ng-icon name="lucideCompass" /></span><h3>Results couldn’t load.</h3><p>{{ error() }}</p><button type="button" z-button zType="outline" (click)="retry()">Try again <ng-icon name="lucideArrowRight" /></button></div>
          } @else if (results().length) {
            <div class="anime-grid browse-grid">
              @for (anime of results(); track anime.malId; let i = $index) {
                <app-anime-card [anime]="anime" [eager]="i < 5" [openInPanel]="true" />
              }
            </div>

            <!-- jikan-edge gives no total count, so paging is Prev/Next only. -->
            @if (filters().page > 1 || pagination()?.hasNextPage) {
              <nav class="pagination" aria-label="Results pages">
                <button type="button" class="page-button page-step" [disabled]="filters().page <= 1" (click)="goToPage(filters().page - 1)" aria-label="Previous page"><ng-icon name="lucideChevronLeft" /><span>Prev</span></button>
                <button type="button" class="page-button page-step" [disabled]="!pagination()?.hasNextPage" (click)="goToPage(filters().page + 1)" aria-label="Next page"><span>Next</span><ng-icon name="lucideChevronRight" /></button>
              </nav>
            }
          } @else {
            <div class="empty-state search-empty">
              <span class="empty-icon"><ng-icon name="lucideSearch" /></span>
              <h3>No anime match these filters</h3>
              <p>Try a different title, or loosen a filter or two.</p>
              <button type="button" z-button zType="outline" (click)="resetAll()">Reset search & filters</button>
            </div>
          }
        </section>
      </main>

      <app-site-footer />
    </div>
  `,
})
export default class BrowsePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly jikan = inject(JikanService);
  private readonly panel = inject(AnimePanelService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly resultsTop = viewChild<ElementRef<HTMLElement>>('resultsTop');
  private readonly retry$ = new Subject<void>();

  readonly types = ANIME_TYPES;
  readonly statuses = ANIME_STATUSES;
  readonly ratings = ANIME_RATINGS;
  readonly genrePlaceholders = Array.from({ length: 14 }, (_, i) => i);
  readonly resultPlaceholders = Array.from({ length: BROWSE_PAGE_SIZE }, (_, i) => i);

  readonly filters = toSignal(this.route.queryParamMap.pipe(map(parseFilters)), { requireSync: true });
  readonly searchDraft = linkedSignal(() => this.filters().q);
  readonly genres = signal<AnimeGenre[]>([]);
  readonly genresError = signal(false);
  readonly results = signal<AnimeEntry[]>([]);
  readonly pagination = signal<EdgePagination | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly selectedGenres = computed(() => new Set(this.filters().genres));
  readonly activeFilterCount = computed(() => {
    const { genres, type, status, rating } = this.filters();
    return genres.length + [type, status, rating].filter(Boolean).length;
  });

  constructor() {
    effect(() => {
      this.panel.setEntries(this.results());
    });

    if (!this.isBrowser) return;
    this.loadGenres();

    combineLatest([
      this.route.queryParamMap.pipe(map(parseFilters), distinctUntilChanged(sameFilters)),
      this.retry$.pipe(startWith(undefined)),
    ])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set('');
        }),
        switchMap(([filters]) =>
          this.jikan.searchAnime(filters).pipe(
            map((response) => ({ response, error: null })),
            catchError((error: unknown) => of({ response: null, error })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(({ response, error }) => {
        this.results.set(response?.data ?? []);
        this.pagination.set(response?.meta.pagination ?? null);
        this.error.set(response ? '' : describeError(error));
        this.loading.set(false);
      });
  }

  loadGenres(): void {
    this.genresError.set(false);
    this.jikan.getGenres().subscribe({
      next: (genres) => this.genres.set(genres),
      error: () => this.genresError.set(true),
    });
  }

  retry(): void {
    this.retry$.next();
  }

  onSearchInput(event: Event): void {
    this.searchDraft.set((event.target as HTMLInputElement).value);
  }

  submitSearch(event: Event): void {
    event.preventDefault();
    this.updateFilters({ q: this.searchDraft().trim() });
  }

  clearSearch(): void {
    this.searchDraft.set('');
    this.updateFilters({ q: '' });
  }

  toggleGenre(id: number): void {
    const genres = this.selectedGenres().has(id)
      ? this.filters().genres.filter((genre) => genre !== id)
      : [...this.filters().genres, id].sort((a, b) => a - b);
    this.updateFilters({ genres });
  }

  setType(event: Event): void {
    this.updateFilters({ type: pickOption((event.target as HTMLSelectElement).value, ANIME_TYPES) });
  }

  setStatus(event: Event): void {
    this.updateFilters({ status: pickOption((event.target as HTMLSelectElement).value, ANIME_STATUSES) });
  }

  setRating(event: Event): void {
    this.updateFilters({ rating: pickOption((event.target as HTMLSelectElement).value, ANIME_RATINGS) });
  }

  clearFilters(): void {
    this.updateFilters({ genres: [], type: null, status: null, rating: null });
  }

  resetAll(): void {
    this.searchDraft.set('');
    this.updateFilters({ q: '', genres: [], type: null, status: null, rating: null });
  }

  async goToPage(page: number): Promise<void> {
    await this.updateFilters({ page });
    this.resultsTop()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /** Any change other than paging starts again from page 1. */
  private updateFilters(patch: Partial<AnimeSearchFilters>): Promise<boolean> {
    const next = { ...this.filters(), page: 1, ...patch };
    // Keep the scroll position so the filters don't jump out from under the pointer.
    return this.router.navigate([], { relativeTo: this.route, queryParams: toQueryParams(next), scroll: 'manual' });
  }
}
