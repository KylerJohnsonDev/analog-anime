import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowRight, lucideHeart, lucideStar } from '@ng-icons/lucide';
import { AuthService } from '@/shared/auth/auth.service';
import { AnimePanelService } from './anime-panel.service';
import { AnimeEntry, animeUrl } from './anime.models';
import { FavoritesService } from './favorites.service';

// The title link is stretched over the whole card (see `.card-link` in styles.css), which leaves
// room for the favorite button: a button can't live inside a link.
@Component({
  selector: 'app-anime-card',
  imports: [NgIcon],
  viewProviders: [provideIcons({ lucideArrowRight, lucideHeart, lucideStar })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'anime-card',
    '(click)': 'onHostClick($event)',
  },
  template: `
    <div class="poster-wrap">
      <img class="poster" [src]="anime().imageUrl ?? ''" [alt]="anime().title + ' poster'" [loading]="eager() ? 'eager' : 'lazy'" />
      @if (rank()) { <span class="rank-chip">#{{ rank() }}</span> }
      @if (anime().score; as score) { <span class="score-chip"><ng-icon name="lucideStar" /> {{ score.toFixed(2) }}</span> }
      <button
        type="button"
        class="favorite-toggle"
        [class.is-favorite]="isFavorite()"
        [attr.aria-pressed]="isFavorite()"
        [attr.aria-label]="favoriteLabel()"
        [title]="favoriteLabel()"
        [disabled]="!favorites.canToggle(anime().malId)"
        (click)="onFavoriteClick($event)"
      ><ng-icon name="lucideHeart" /></button>
      <span class="poster-link"><ng-icon name="lucideArrowRight" /></span>
    </div>
    <div class="card-caption">
      <div class="anime-meta"><span>{{ anime().type || 'Anime' }}</span></div>
      <h3>
        @if (openInPanel()) {
          <a
            class="card-link"
            [href]="panelHref()"
            [attr.aria-label]="'View details for ' + anime().title"
            (click)="onCardLinkClick($event)"
          >{{ anime().title }}</a>
        } @else {
          <a
            class="card-link"
            [href]="href()"
            target="_blank"
            rel="noreferrer"
            [attr.aria-label]="anime().title + ' on MyAnimeList'"
          >{{ anime().title }}</a>
        }
      </h3>
      <p>{{ anime().episodes ? anime().episodes + ' episodes' : 'Series & films' }}<span class="caption-arrow">{{ openInPanel() ? '→' : '↗' }}</span></p>
    </div>
  `,
})
export class AnimeCardComponent {
  protected readonly favorites = inject(FavoritesService);
  private readonly auth = inject(AuthService);
  private readonly panel = inject(AnimePanelService);

  readonly anime = input.required<AnimeEntry>();
  readonly rank = input<number | null>(null);
  readonly eager = input(false);
  readonly openInPanel = input(false);

  readonly href = computed(() => this.anime().url ?? animeUrl(this.anime().malId));
  readonly panelHref = computed(() => `/anime/${this.anime().malId}`);
  readonly isFavorite = computed(() => this.favorites.isFavorite(this.anime().malId));
  readonly favoriteLabel = computed(() => {
    const title = this.anime().title;
    if (this.auth.status() === 'signed-out') return `Sign in to save ${title} to favorites`;
    return this.isFavorite() ? `Remove ${title} from favorites` : `Save ${title} to favorites`;
  });

  onFavoriteClick(event: MouseEvent): void {
    event.stopPropagation();
    this.favorites.toggle(this.anime());
  }

  onCardLinkClick(event: MouseEvent): void {
    if (!this.openInPanel()) return;
    event.preventDefault();
    event.stopPropagation();
    this.panel.open(this.anime());
  }

  onHostClick(event: MouseEvent): void {
    if (!this.openInPanel()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.favorite-toggle')) return;
    event.preventDefault();
    this.panel.open(this.anime());
  }
}

