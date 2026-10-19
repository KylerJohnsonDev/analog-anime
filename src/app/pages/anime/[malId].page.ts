import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RouteMeta } from '@analogjs/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideCompass } from '@ng-icons/lucide';
import { map } from 'rxjs';
import { AnimeDetailViewComponent } from '@/shared/anime/anime-detail-view.component';
import { AnimePanelService } from '@/shared/anime/anime-panel.service';
import { ZardButtonComponent } from '@/shared/components/button';
import { SiteFooterComponent } from '@/shared/layout/site-footer.component';
import { SiteHeaderComponent } from '@/shared/layout/site-header.component';

export const routeMeta: RouteMeta = {
  title: 'Anime Details — Anime Index',
  meta: [{ name: 'description', content: 'Explore the story, key features, and latest news for this anime.' }],
};

@Component({
  selector: 'app-anime-details-page',
  imports: [
    AnimeDetailViewComponent,
    NgIcon,
    RouterLink,
    SiteFooterComponent,
    SiteHeaderComponent,
    ZardButtonComponent,
  ],
  viewProviders: [provideIcons({ lucideArrowLeft, lucideCompass })],
  template: `
    <div class="site-shell">
      <app-site-header />

      <main id="top" class="anime-details-page">
        <div class="details-page-nav">
          <a class="details-back-link" routerLink="/browse">
            <ng-icon name="lucideArrowLeft" aria-hidden="true" />
            <span>Browse anime</span>
          </a>
        </div>

        @if (malId() > 0) {
          <article class="favorite-card details-page-card">
            <app-anime-detail-view
              [malId]="malId()"
              [initialAnime]="initialAnime()"
              headingLevel="h1"
            />
          </article>
        } @else {
          <div class="empty-state">
            <span class="empty-icon"><ng-icon name="lucideCompass" /></span>
            <h3>Anime not found</h3>
            <p>The link you followed doesn’t point to a valid anime ID.</p>
            <a z-button zType="outline" routerLink="/browse">Browse catalog</a>
          </div>
        }
      </main>

      <app-site-footer />
    </div>
  `,
})
export default class AnimeDetailsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly panel = inject(AnimePanelService);

  readonly malId = toSignal(
    this.route.paramMap.pipe(
      map((params) => {
        const id = Number(params.get('malId'));
        return Number.isInteger(id) && id > 0 ? id : 0;
      }),
    ),
    { requireSync: true },
  );

  readonly initialAnime = computed(() => this.panel.getEntry(this.malId()));
}
