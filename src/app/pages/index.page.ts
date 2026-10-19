import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowDown, lucideArrowRight, lucideCheck, lucideChevronRight, lucideCompass, lucideExternalLink, lucideHeart, lucideSearch, lucideSparkles } from '@ng-icons/lucide';
import { AnimeCardComponent } from '@/shared/anime/anime-card.component';
import { AnimePanelService } from '@/shared/anime/anime-panel.service';
import { AnimeEntry, AnimeRecommendation, animeUrl } from '@/shared/anime/anime.models';
import { ZardBadgeComponent } from '@/shared/components/badge';
import { ZardButtonComponent } from '@/shared/components/button';
import { SiteFooterComponent } from '@/shared/layout/site-footer.component';
import { SiteHeaderComponent } from '@/shared/layout/site-header.component';
import { RouteMeta } from '@analogjs/router';

interface AnimeFeed {
  topAnime: AnimeEntry[];
  recommendations: AnimeRecommendation[];
  errors: { topAnime: boolean; recommendations: boolean };
}

export const routeMeta: RouteMeta = {
  title: 'Anime Index — Find your next favorite',
  meta: [
    { name: 'description', content: 'Explore the highest rated anime and discover community recommendations, all in one place.' },
  ],
};

@Component({
  selector: 'app-home',
  imports: [AnimeCardComponent, NgIcon, SiteFooterComponent, SiteHeaderComponent, ZardBadgeComponent, ZardButtonComponent],
  viewProviders: [provideIcons({ lucideArrowDown, lucideArrowRight, lucideCheck, lucideChevronRight, lucideCompass, lucideExternalLink, lucideHeart, lucideSearch, lucideSparkles })],
  template: `
    <div class="site-shell">
      <app-site-header />

      <main id="top">
        <section class="intro" aria-labelledby="page-title">
          <div class="intro-copy">
            <z-badge zType="secondary" class="eyebrow"><span class="live-dot"></span> YOUR ANIME COMPASS</z-badge>
            <h1 id="page-title">Stories worth<br class="desktop-break"> staying up for<span class="period">.</span></h1>
            <p>A little direction for your next big obsession. Explore the all-time greats, then follow the recommendations fans can’t stop talking about.</p>
            <a class="scroll-cue" href="#top-anime"><span class="scroll-icon"><ng-icon name="lucideArrowDown" /></span> Start exploring</a>
          </div>
          <div class="intro-aside" aria-hidden="true">
            <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
            <div class="orbit-core"><ng-icon name="lucideSparkles" /></div>
            <span class="orbit-note note-top">THERE’S A WHOLE WORLD</span>
            <span class="orbit-note note-bottom">WAITING IN THE NEXT EPISODE</span>
            <span class="orbit-star star-one">✳</span><span class="orbit-star star-two">✳</span>
          </div>
        </section>

        <section class="content-section top-section" id="top-anime" aria-labelledby="top-title">
          <div class="section-heading">
            <div class="section-title-wrap">
              <span class="section-kicker">01 / THE ESSENTIALS</span>
              <h2 id="top-title">The all-time <span>greats</span></h2>
            </div>
            <div class="section-tools">
              <label class="search-field">
                <ng-icon name="lucideSearch" />
                <input type="search" placeholder="Find a title" [value]="query()" (input)="onSearch($event)" aria-label="Search top anime" />
                @if (query()) { <button type="button" class="clear-search" (click)="query.set('')" aria-label="Clear search"><ng-icon name="lucideCheck" /></button> }
              </label>
              <span class="result-count">{{ filteredAnime().length }} titles</span>
            </div>
          </div>

          @if (loading()) {
            <div class="anime-grid" aria-label="Loading top anime" aria-busy="true">
              @for (placeholder of placeholders; track placeholder) {
                <div class="anime-card skeleton-card"><div class="poster skeleton-shimmer"></div><div class="skeleton-line"></div><div class="skeleton-short"></div></div>
              }
            </div>
          } @else if (error() || topAnimeError()) {
            <div class="empty-state"><span class="empty-icon"><ng-icon name="lucideCompass" /></span><h3>The top anime list couldn’t load.</h3><p>{{ error() || 'The top anime feed couldn’t be loaded. Community picks may still be available below.' }}</p><button type="button" z-button zType="outline" (click)="loadFeed()">Try again <ng-icon name="lucideArrowRight" /></button></div>
          } @else if (filteredAnime().length) {
            <div class="anime-grid">
              @for (anime of filteredAnime(); track anime.malId; let i = $index) {
                <app-anime-card [anime]="anime" [rank]="i + 1" [eager]="i < 4" [openInPanel]="true" />
              }
            </div>
          } @else {
            <div class="empty-state search-empty"><span class="empty-icon"><ng-icon name="lucideSearch" /></span><h3>No titles found</h3><p>Try another title or clear your search.</p><button type="button" z-button zType="outline" (click)="query.set('')">Clear search</button></div>
          }
          <div class="section-footnote"><span class="footnote-line"></span><span>Ranked by the anime community</span><span class="footnote-line"></span></div>
        </section>

        <section class="recommendations-section" id="recommendations" aria-labelledby="recommendations-title">
          <div class="recommendations-topline"><span class="section-kicker">02 / WORD OF MOUTH</span><span class="freshness"><span></span> THE COMMUNITY IS TALKING</span></div>
          <div class="recommendations-header">
            <div><h2 id="recommendations-title">One good watch<br>leads to <em>another.</em></h2></div>
            <p>These pairings are straight from fans. Find a favorite, then see what they think you should watch next.</p>
          </div>

          @if (!loading() && recommendations().length) {
            <div class="recommendation-list">
              @for (recommendation of recommendations(); track recommendation.malId + '-' + recommendation.recommendedMalId + '-' + recommendation.username) {
                <article class="recommendation-card">
                  <div class="rec-pair">
                    @for (anime of pairFor(recommendation); track anime.malId; let pairIndex = $index) {
                      <a class="rec-anime" [href]="anime.url" target="_blank" rel="noreferrer">
                        <img [src]="anime.imageUrl ?? ''" [alt]="anime.title + ' poster'" loading="lazy" />
                        <span class="rec-anime-title">{{ anime.title }}</span>
                      </a>
                      @if (pairIndex === 0) { <span class="pair-plus" aria-hidden="true">+</span> }
                    }
                    <span class="rec-arrow" aria-hidden="true"><ng-icon name="lucideArrowRight" /></span>
                  </div>
                  <div class="rec-quote">
                    <span class="quote-mark">“</span>
                    <p>{{ recommendation.content || 'Fans of one found something to love in the other.' }}</p>
                    <div class="rec-byline"><span>Recommended by</span><a [href]="profileUrl(recommendation.username)" target="_blank" rel="noreferrer">{{ recommendation.username }} <ng-icon name="lucideExternalLink" /></a></div>
                  </div>
                </article>
              }
            </div>
          } @else if (loading()) {
            <div class="recommendation-loading"><span></span><span></span><span></span></div>
          } @else if (recommendationsError()) {
            <div class="rec-empty">Community recommendations couldn’t load just now. The top anime list is still available above.</div>
          } @else if (!error()) {
            <div class="rec-empty">No recommendations are available right now. Check back soon.</div>
          }
          <div class="rec-footer"><span><ng-icon name="lucideHeart" /> Made better by fans</span><a href="https://myanimelist.net/recommendations.php?s=anime" target="_blank" rel="noreferrer">More recommendations <ng-icon name="lucideChevronRight" /></a></div>
        </section>
      </main>

      <app-site-footer />
    </div>
  `,
})
export default class HomePage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly panel = inject(AnimePanelService);
  readonly topAnime = signal<AnimeEntry[]>([]);
  readonly recommendations = signal<AnimeRecommendation[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly topAnimeError = signal(false);
  readonly recommendationsError = signal(false);
  readonly query = signal('');
  readonly placeholders = [1, 2, 3, 4, 5, 6, 7, 8];
  readonly filteredAnime = computed(() => {
    const term = this.query().trim().toLocaleLowerCase();
    if (!term) return this.topAnime();
    return this.topAnime().filter((anime) => anime.title.toLocaleLowerCase().includes(term));
  });

  constructor() {
    effect(() => {
      this.panel.setEntries(this.filteredAnime());
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadFeed();
    }
  }

  loadFeed(): void {
    this.loading.set(true);
    this.error.set('');
    this.http.get<AnimeFeed>('/api/anime-feed').subscribe({
      next: (feed) => {
        const topAnime = feed.topAnime ?? [];
        this.topAnime.set(topAnime);
        this.topAnimeError.set(topAnime.length === 0);
        this.recommendations.set(feed.recommendations ?? []);
        this.recommendationsError.set(feed.errors?.recommendations ?? false);
        this.loading.set(false);
      },
      error: () => {
        this.topAnimeError.set(true);
        this.recommendationsError.set(true);
        this.error.set('The top anime feed is temporarily unavailable. Please try again shortly.');
        this.loading.set(false);
      },
    });
  }

  onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  pairFor(recommendation: AnimeRecommendation): { malId: number; title: string; imageUrl: string | null; url: string }[] {
    return [
      { malId: recommendation.malId, title: recommendation.title, imageUrl: recommendation.imageUrl, url: animeUrl(recommendation.malId) },
      { malId: recommendation.recommendedMalId, title: recommendation.recommendedTitle, imageUrl: recommendation.recommendedImageUrl, url: animeUrl(recommendation.recommendedMalId) },
    ];
  }

  profileUrl(username: string): string {
    return `https://myanimelist.net/profile/${encodeURIComponent(username)}`;
  }
}
