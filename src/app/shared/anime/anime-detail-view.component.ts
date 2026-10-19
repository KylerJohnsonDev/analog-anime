import { isPlatformBrowser } from '@angular/common';
import { httpResource } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideArrowUpRight,
  lucideCheck,
  lucideCompass,
  lucideHeart,
  lucideNewspaper,
  lucideRotateCw,
  lucideShare2,
  lucideStar,
  lucideX,
} from '@ng-icons/lucide';
import { AuthService } from '@/shared/auth/auth.service';
import { AnimeDetails, AnimeEntry, AnimeProfile, animeUrl } from './anime.models';
import { newsDate } from './favorite-card.component';
import { FavoritesService } from './favorites.service';

const TOAST_DURATION_MS = 3000;

@Component({
  selector: 'app-anime-detail-view',
  imports: [NgIcon],
  viewProviders: [
    provideIcons({
      lucideArrowUpRight,
      lucideCheck,
      lucideCompass,
      lucideHeart,
      lucideNewspaper,
      lucideRotateCw,
      lucideShare2,
      lucideStar,
      lucideX,
    }),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'anime-detail-view' },
  template: `
    @if (isInitialLoading()) {
      <div class="detail-hero detail-hero-skeleton" aria-label="Loading anime details" aria-busy="true">
        <div class="detail-poster-wrap skeleton-shimmer"></div>
        <div class="detail-summary">
          <span class="section-kicker">THE STORY</span>
          <span class="skeleton-line detail-title-skeleton"></span>
          <span class="skeleton-short"></span>
          <div class="synopsis-loading">
            <span class="skeleton-line"></span>
            <span class="skeleton-line"></span>
            <span class="skeleton-line"></span>
            <span class="skeleton-short"></span>
          </div>
        </div>
      </div>
    } @else if (isFatalError()) {
      <div class="empty-state detail-error-state">
        <span class="empty-icon"><ng-icon name="lucideCompass" /></span>
        <h3>Anime details couldn’t load.</h3>
        <p>We couldn’t reach the anime catalog for this title right now.</p>
        <button type="button" class="page-button" (click)="details.reload()">
          <ng-icon name="lucideRotateCw" aria-hidden="true" /> Try again
        </button>
      </div>
    } @else {
      <div class="detail-hero">
        <div class="detail-poster-col">
          <div class="poster-wrap detail-poster-wrap">
            @if (displayAnime()?.imageUrl) {
              <img
                class="poster"
                [src]="displayAnime()!.imageUrl!"
                [alt]="(displayAnime()?.title || 'Anime') + ' poster'"
                loading="eager"
              />
            } @else {
              <div class="poster skeleton-shimmer"></div>
            }
            @if (profile()?.rank; as rank) {
              <span class="rank-chip">#{{ rank }}</span>
            }
            @if (displayAnime()?.score; as score) {
              <span class="score-chip"><ng-icon name="lucideStar" aria-hidden="true" /> {{ score.toFixed(2) }}</span>
            }
            @if (displayAnime(); as animeEntry) {
              <button
                type="button"
                class="favorite-toggle detail-favorite-toggle"
                [class.is-favorite]="isFavorite()"
                [attr.aria-pressed]="isFavorite()"
                [attr.aria-label]="favoriteLabel()"
                [title]="favoriteLabel()"
                [disabled]="!favorites.canToggle(animeEntry.malId)"
                (click)="favorites.toggle(animeEntry)"
              >
                <ng-icon name="lucideHeart" aria-hidden="true" />
              </button>
            }
          </div>
        </div>

        <section class="favorite-synopsis detail-synopsis" [attr.aria-labelledby]="headingId()">
          <div class="detail-topline">
            <span class="section-kicker">THE STORY</span>
            <div class="detail-actions">
              <button
                type="button"
                class="detail-action-btn share-button"
                (click)="shareAnime()"
                aria-label="Share anime link"
                title="Share anime link"
              >
                <ng-icon [name]="toastVisible() ? 'lucideCheck' : 'lucideShare2'" aria-hidden="true" />
                <span>Share</span>
              </button>
            </div>
          </div>

          @if (headingLevel() === 'h1') {
            <h1 class="detail-title" [id]="headingId()">{{ displayAnime()?.title }}</h1>
          } @else {
            <h2 class="detail-title" [id]="headingId()">{{ displayAnime()?.title }}</h2>
          }

          @if (englishSubtitle(); as subtitle) {
            <p class="detail-subtitle">{{ subtitle }}</p>
          }

          <div class="detail-features" aria-label="Key features">
            @if (displayAnime()?.type; as type) {
              <span class="detail-feature-pill">{{ type }}</span>
            }
            <span class="detail-feature-pill">
              {{ displayAnime()?.episodes ? displayAnime()!.episodes + ' episodes' : 'Series & films' }}
            </span>
            @if (displayAnime()?.score; as score) {
              <span class="detail-feature-pill detail-score-pill">
                <ng-icon name="lucideStar" aria-hidden="true" /> {{ score.toFixed(2) }}
              </span>
            }
            @if (profile()?.status; as status) {
              <span class="detail-feature-pill">{{ status }}</span>
            }
            @if (profile()?.year; as year) {
              <span class="detail-feature-pill">{{ year }}</span>
            }
            @if (profile()?.duration; as duration) {
              <span class="detail-feature-pill">{{ duration }}</span>
            }
            @if (profile()?.rating; as rating) {
              <span class="detail-feature-pill">{{ rating }}</span>
            }
          </div>

          @if (profile()?.genres?.length || profile()?.studios?.length) {
            <div class="detail-Submeta">
              @if (profile()?.studios?.length) {
                <span class="detail-meta-item">
                  <strong>Studio:</strong> {{ profile()!.studios!.join(', ') }}
                </span>
              }
              @if (profile()?.genres?.length) {
                <div class="detail-genres" aria-label="Genres">
                  @for (genre of profile()!.genres!; track genre) {
                    <span class="detail-genre-tag">{{ genre }}</span>
                  }
                </div>
              }
            </div>
          }

          @if (!details.hasValue() && !details.error()) {
            <div class="synopsis-loading" aria-label="Loading synopsis" aria-busy="true">
              <span class="skeleton-line"></span>
              <span class="skeleton-line"></span>
              <span class="skeleton-line"></span>
              <span class="skeleton-short"></span>
            </div>
          } @else if (details.error()) {
            <p class="favorite-status">
              The synopsis and news couldn’t load right now.
              <button type="button" (click)="details.reload()">
                <ng-icon name="lucideRotateCw" aria-hidden="true" /> Try again
              </button>
            </p>
          } @else if (paragraphs().length) {
            <div class="synopsis-text">
              @for (paragraph of paragraphs(); track $index) {
                <p>{{ paragraph }}</p>
              }
            </div>
          } @else if (details.value()?.errors?.synopsis) {
            <p class="favorite-status">
              The synopsis couldn’t load right now.
              <button type="button" (click)="details.reload()">
                <ng-icon name="lucideRotateCw" aria-hidden="true" /> Try again
              </button>
            </p>
          } @else {
            <p class="favorite-status">No synopsis is available for this series yet.</p>
          }

          <a class="favorite-more" [href]="malHref()" target="_blank" rel="noreferrer">
            More on MyAnimeList <ng-icon name="lucideArrowUpRight" aria-hidden="true" />
          </a>
        </section>
      </div>

      <section class="favorite-news detail-news" [attr.aria-labelledby]="headingId() + '-news'">
        <span class="section-kicker" [id]="headingId() + '-news'">LATEST NEWS</span>
        @if (!details.hasValue() && !details.error()) {
          <div class="news-list" aria-label="Loading news" aria-busy="true">
            @for (placeholder of [1, 2, 3]; track placeholder) {
              <div class="news-item news-skeleton">
                <span class="news-thumb skeleton-shimmer"></span>
                <span class="news-skeleton-lines">
                  <span class="skeleton-line"></span>
                  <span class="skeleton-short"></span>
                </span>
              </div>
            }
          </div>
        } @else if (details.error() || details.value()?.errors?.news) {
          <p class="favorite-status">News couldn’t load right now.</p>
        } @else if (details.value()?.news?.length) {
          <ul class="news-list">
            @for (item of details.value()!.news; track item.malId) {
              <li>
                <a class="news-item" [href]="item.url" target="_blank" rel="noreferrer">
                  @if (item.imageUrl) {
                    <img class="news-thumb" [src]="item.imageUrl" alt="" loading="lazy" />
                  } @else {
                    <span class="news-thumb news-thumb-empty"><ng-icon name="lucideNewspaper" aria-hidden="true" /></span>
                  }
                  <span class="news-body">
                    <span class="news-meta">{{ newsDate(item.date) }} · {{ item.author }}</span>
                    <span class="news-title">{{ item.title }}</span>
                    <span class="news-excerpt">{{ item.excerpt }}</span>
                  </span>
                </a>
              </li>
            }
          </ul>
        } @else {
          <p class="favorite-status">No news about this series yet.</p>
        }
      </section>
    }

    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      <div
        #toastPopover
        id="share-toast-popover"
        popover="manual"
        class="share-toast"
        [class.is-open]="toastVisible()"
        role="status"
      >
        @if (toastVisible()) {
          <ng-icon name="lucideCheck" class="toast-icon" aria-hidden="true" />
          <span class="toast-message">{{ toastMessage() }}</span>
          <button
            type="button"
            class="toast-close"
            popovertarget="share-toast-popover"
            popovertargetaction="hide"
            aria-label="Close notification"
            (click)="hideToast()"
          >
            <ng-icon name="lucideX" aria-hidden="true" />
          </button>
        }
      </div>
    </div>
  `,
})
export class AnimeDetailViewComponent {
  protected readonly favorites = inject(FavoritesService);
  private readonly auth = inject(AuthService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private readonly toastPopover = viewChild<ElementRef<HTMLElement>>('toastPopover');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly malId = input.required<number>();
  readonly initialAnime = input<AnimeEntry | null>(null);
  readonly headingLevel = input<'h1' | 'h2'>('h2');

  protected readonly toastVisible = signal(false);
  protected readonly toastMessage = signal('');

  protected readonly details = httpResource<AnimeDetails>(() =>
    this.isBrowser && this.malId() > 0 ? `/api/anime/${this.malId()}/details` : undefined,
  );

  protected readonly profile = computed<AnimeProfile | null>(() => this.details.value()?.anime ?? null);

  protected readonly displayAnime = computed<AnimeEntry | null>(() => {
    const fromApi = this.profile();
    const seed = this.initialAnime();
    if (fromApi) return fromApi;
    if (seed) return seed;
    return null;
  });

  protected readonly isInitialLoading = computed(
    () => !this.displayAnime() && !this.details.hasValue() && !this.details.error(),
  );

  protected readonly isFatalError = computed(
    () => !this.displayAnime() && (Boolean(this.details.error()) || Boolean(this.details.value()?.errors?.synopsis)),
  );

  protected readonly englishSubtitle = computed(() => {
    const title = this.displayAnime()?.title;
    const english = this.profile()?.titleEnglish;
    if (!english || !title || english.toLocaleLowerCase() === title.toLocaleLowerCase()) return null;
    return english;
  });

  protected readonly headingId = computed(() => `anime-detail-${this.malId()}`);
  protected readonly malHref = computed(() => this.displayAnime()?.url ?? animeUrl(this.malId()));
  protected readonly isFavorite = computed(() => this.favorites.isFavorite(this.malId()));
  protected readonly favoriteLabel = computed(() => {
    const title = this.displayAnime()?.title ?? 'this anime';
    if (this.auth.status() === 'signed-out') return `Sign in to save ${title} to favorites`;
    return this.isFavorite() ? `Remove ${title} from favorites` : `Save ${title} to favorites`;
  });

  protected readonly paragraphs = computed(() =>
    (this.details.value()?.synopsis ?? '')
      .split(/\n+/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
  );
  protected readonly newsDate = newsDate;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.toastTimer) clearTimeout(this.toastTimer);
    });
  }

  shareUrl(): string {
    const origin = this.isBrowser && typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/anime/${this.malId()}`;
  }

  async shareAnime(): Promise<void> {
    const url = this.shareUrl();
    try {
      if (this.isBrowser && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // Clipboard API may fail in insecure contexts; still show the toast with the generated link.
    }
    this.showToast('share link copied to clipboard.');
  }

  showToast(message: string): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastMessage.set(message);
    this.toastVisible.set(true);

    const popoverEl = this.toastPopover()?.nativeElement;
    if (popoverEl && 'popover' in HTMLElement.prototype && typeof popoverEl.showPopover === 'function') {
      try {
        popoverEl.showPopover();
      } catch {
        // Ignore if already open
      }
    }

    this.toastTimer = setTimeout(() => {
      this.hideToast();
    }, TOAST_DURATION_MS);
  }

  hideToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    this.toastVisible.set(false);
    this.toastMessage.set('');

    const popoverEl = this.toastPopover()?.nativeElement;
    if (popoverEl && 'popover' in HTMLElement.prototype && typeof popoverEl.hidePopover === 'function') {
      try {
        popoverEl.hidePopover();
      } catch {
        // Ignore if already hidden
      }
    }
  }
}
