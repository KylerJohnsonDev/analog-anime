import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight, lucideX } from '@ng-icons/lucide';
import { map } from 'rxjs';
import { AnimeDetailViewComponent } from './anime-detail-view.component';
import { AnimePanelService } from './anime-panel.service';

@Component({
  selector: 'app-anime-side-panel',
  imports: [AnimeDetailViewComponent, NgIcon],
  viewProviders: [provideIcons({ lucideChevronLeft, lucideChevronRight, lucideX })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'side-panel-overlay',
    '(click)': 'onBackdropClick($event)',
    '(document:keydown.escape)': 'close()',
  },
  template: `
    <aside
      #panelSheet
      class="side-panel-sheet"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="dialogLabel()"
      tabindex="-1"
    >
      <header class="side-panel-header">
        <nav class="side-panel-nav" aria-label="Browse anime details">
          <button
            type="button"
            class="page-button panel-nav-btn"
            [disabled]="!prevAnime()"
            (click)="goToPrevious()"
            aria-label="Previous anime"
          >
            <ng-icon name="lucideChevronLeft" aria-hidden="true" />
            <span>Previous</span>
          </button>
          @if (currentIndex() >= 0) {
            <span class="panel-nav-count" aria-live="polite">
              {{ currentIndex() + 1 }} / {{ totalCount() }}
            </span>
          }
          <button
            type="button"
            class="page-button panel-nav-btn"
            [disabled]="!nextAnime()"
            (click)="goToNext()"
            aria-label="Next anime"
          >
            <span>Next</span>
            <ng-icon name="lucideChevronRight" aria-hidden="true" />
          </button>
        </nav>

        <button
          type="button"
          class="panel-close-btn"
          (click)="close()"
          aria-label="Close details panel"
          title="Close"
        >
          <ng-icon name="lucideX" aria-hidden="true" />
        </button>
      </header>

      <div #panelBody class="side-panel-body">
        <app-anime-detail-view
          [malId]="malId()"
          [initialAnime]="initialAnime()"
          headingLevel="h2"
        />
      </div>
    </aside>
  `,
})
export default class AnimeSidePanelComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly panel = inject(AnimePanelService);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);

  private readonly panelSheet = viewChild<ElementRef<HTMLElement>>('panelSheet');
  private readonly panelBody = viewChild<ElementRef<HTMLElement>>('panelBody');

  readonly malId = toSignal(
    this.route.paramMap.pipe(map((params) => Number(params.get('malId')) || 0)),
    { requireSync: true },
  );

  readonly initialAnime = computed(() => this.panel.getEntry(this.malId()));
  readonly prevAnime = computed(() => this.panel.previousEntry(this.malId()));
  readonly nextAnime = computed(() => this.panel.nextEntry(this.malId()));
  readonly currentIndex = computed(() => this.panel.indexOf(this.malId()));
  readonly totalCount = computed(() => this.panel.entries().length);
  readonly dialogLabel = computed(() => {
    const title = this.initialAnime()?.title;
    return title ? `${title} details` : 'Anime details';
  });

  constructor() {
    effect(() => {
      // Scroll panel content to top when switching anime with Previous / Next.
      this.malId();
      const bodyEl = this.panelBody()?.nativeElement;
      if (bodyEl && typeof bodyEl.scrollTo === 'function') {
        bodyEl.scrollTo({ top: 0 });
      }
    });

    if (this.isBrowser) {
      afterNextRender(() => {
        const mainEl = this.document.querySelector('main');
        if (mainEl) {
          mainEl.inert = true;
        }
        this.panelSheet()?.nativeElement.focus();

        this.destroyRef.onDestroy(() => {
          if (mainEl) {
            mainEl.inert = false;
          }
        });
      });
    }
  }

  goToPrevious(): void {
    const prev = this.prevAnime();
    if (prev) {
      this.panel.open(prev);
    }
  }

  goToNext(): void {
    const next = this.nextAnime();
    if (next) {
      this.panel.open(next);
    }
  }

  close(): void {
    this.panel.close();
  }

  onBackdropClick(event: MouseEvent): void {
    const sheet = this.panelSheet()?.nativeElement;
    if (sheet && !sheet.contains(event.target as Node)) {
      this.close();
    }
  }
}
