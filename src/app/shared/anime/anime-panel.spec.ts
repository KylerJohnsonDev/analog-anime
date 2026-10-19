import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { App } from '@/app';
import { AuthService } from '@/shared/auth/auth.service';
import AnimeDetailsPage from '@/pages/anime/[malId].page';
import { AnimeCardComponent } from './anime-card.component';
import { AnimeDetailViewComponent } from './anime-detail-view.component';
import { AnimeDetails, AnimeEntry } from './anime.models';
import { AnimePanelService } from './anime-panel.service';
import AnimeSidePanelComponent from './anime-side-panel.component';

const frieren: AnimeEntry = {
  malId: 52991,
  title: 'Sousou no Frieren',
  imageUrl: 'https://cdn.myanimelist.net/images/anime/1015/138006.jpg',
  score: 9.24,
  episodes: 28,
  type: 'TV',
  url: 'https://myanimelist.net/anime/52991',
};

const bebop: AnimeEntry = {
  malId: 1,
  title: 'Cowboy Bebop',
  imageUrl: 'https://cdn.myanimelist.net/images/anime/4/19644.jpg',
  score: 8.75,
  episodes: 26,
  type: 'TV',
  url: 'https://myanimelist.net/anime/1',
};

const fullmetal: AnimeEntry = {
  malId: 5114,
  title: 'Fullmetal Alchemist: Brotherhood',
  imageUrl: 'https://cdn.myanimelist.net/images/anime/1208/94745.jpg',
  score: 9.1,
  episodes: 64,
  type: 'TV',
  url: 'https://myanimelist.net/anime/5114',
};

const mockDetails: AnimeDetails = {
  anime: {
    ...frieren,
    url: 'https://myanimelist.net/anime/52991',
    titleEnglish: "Frieren: Beyond Journey's End",
    status: 'Finished Airing',
    rating: 'PG-13',
    year: 2023,
    rank: 1,
    duration: '24 min. per ep.',
    studios: ['Madhouse'],
    genres: ['Adventure', 'Drama', 'Fantasy'],
  },
  synopsis: 'An elven mage reflects on her journey.\n\nShe sets out with a new apprentice.',
  news: [
    {
      malId: 101,
      title: 'Season 2 Announced',
      url: 'https://myanimelist.net/news/101',
      imageUrl: null,
      excerpt: 'Frieren continues her journey.',
      date: 'Sep 28, 2024 6:00 PM',
      author: 'mal_news',
    },
  ],
  errors: { synopsis: false, news: false },
};

class StubAuthService {
  readonly user = signal(null);
  readonly status = signal<'signed-out'>('signed-out');
}

@Component({
  standalone: true,
  imports: [AnimeCardComponent],
  template: `<app-anime-card [anime]="anime()" [openInPanel]="openInPanel()" />`,
})
class DummyBrowseHostComponent {
  readonly anime = signal(frieren);
  readonly openInPanel = signal(true);
}

describe('Anime side panel & details page', () => {
  let http: HttpTestingController;
  let router: Router;
  let location: Location;
  let panel: AnimePanelService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, DummyBrowseHostComponent, AnimeSidePanelComponent, AnimeDetailViewComponent, AnimeDetailsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideLocationMocks(),
        { provide: AuthService, useClass: StubAuthService },
        provideRouter([
          { path: 'browse', component: DummyBrowseHostComponent },
          { path: 'anime/:malId', component: AnimeDetailsPage },
          { path: 'anime/:malId', outlet: 'details', component: AnimeSidePanelComponent },
        ]),
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    panel = TestBed.inject(AnimePanelService);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('opens the side panel via auxiliary route with skipLocationChange when app-anime-card is clicked on browse/home', async () => {
    const appFixture = TestBed.createComponent(App);
    panel.setEntries([frieren, bebop, fullmetal]);

    await router.navigateByUrl('/browse?q=frieren');
    appFixture.detectChanges();
    expect(location.path()).toBe('/browse?q=frieren');

    const navDone = firstValueFrom(router.events.pipe(filter((e) => e instanceof NavigationEnd)));
    const cardLink = appFixture.nativeElement.querySelector('.card-link') as HTMLAnchorElement;
    expect(cardLink).toBeTruthy();
    cardLink.click();
    await navDone;
    appFixture.detectChanges();

    // URL stays unchanged due to skipLocationChange, while auxiliary route is active
    expect(location.path()).toBe('/browse?q=frieren');
    expect(router.url).toContain('(details:anime/52991)');

    const req = http.expectOne('/api/anime/52991/details');
    req.flush(mockDetails);
    await appFixture.whenStable();
    appFixture.detectChanges();

    const sidePanel = appFixture.nativeElement.querySelector('app-anime-side-panel') as HTMLElement;
    expect(sidePanel).toBeTruthy();
    expect(sidePanel.textContent).toContain('Sousou no Frieren');
    expect(sidePanel.textContent).toContain('An elven mage reflects on her journey.');
    expect(sidePanel.textContent).toContain('Season 2 Announced');
  });

  it('keeps external MyAnimeList link when openInPanel is false (e.g. on /favorites)', () => {
    const hostFixture = TestBed.createComponent(DummyBrowseHostComponent);
    hostFixture.componentInstance.openInPanel.set(false);
    hostFixture.detectChanges();

    const cardLink = hostFixture.nativeElement.querySelector('.card-link') as HTMLAnchorElement;
    expect(cardLink.getAttribute('href')).toBe('https://myanimelist.net/anime/52991');
    expect(cardLink.getAttribute('target')).toBe('_blank');
  });

  it('navigates between previous and next anime in the side panel and disables buttons at boundaries', async () => {
    const appFixture = TestBed.createComponent(App);
    panel.setEntries([frieren, bebop]);

    await router.navigateByUrl('/browse');
    await panel.open(frieren);
    appFixture.detectChanges();

    http.expectOne('/api/anime/52991/details').flush(mockDetails);
    await appFixture.whenStable();
    appFixture.detectChanges();

    const prevBtn = appFixture.nativeElement.querySelector('button[aria-label="Previous anime"]') as HTMLButtonElement;
    const nextBtn = appFixture.nativeElement.querySelector('button[aria-label="Next anime"]') as HTMLButtonElement;

    // At index 0 (first item): Previous is disabled, Next is enabled
    expect(prevBtn.disabled).toBe(true);
    expect(nextBtn.disabled).toBe(false);

    // Click Next to view Cowboy Bebop (index 1, last item)
    const navDone = firstValueFrom(router.events.pipe(filter((e) => e instanceof NavigationEnd)));
    nextBtn.click();
    await navDone;
    appFixture.detectChanges();

    http.expectOne('/api/anime/1/details').flush({
      ...mockDetails,
      anime: { ...bebop, url: 'https://myanimelist.net/anime/1' },
      synopsis: 'Space bounty hunters.',
    });
    await appFixture.whenStable();
    appFixture.detectChanges();

    expect(prevBtn.disabled).toBe(false);
    expect(nextBtn.disabled).toBe(true);
    expect(appFixture.nativeElement.querySelector('app-anime-side-panel').textContent).toContain('Cowboy Bebop');
  });

  it('copies the shareable /anime/:malId link and displays the toast for 3 seconds on share click', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    const fixture = TestBed.createComponent(AnimeDetailViewComponent);
    fixture.componentRef.setInput('malId', 52991);
    fixture.componentRef.setInput('initialAnime', frieren);
    fixture.detectChanges();

    http.expectOne('/api/anime/52991/details').flush(mockDetails);
    await Promise.resolve();
    fixture.detectChanges();

    const shareBtn = fixture.nativeElement.querySelector('.share-button') as HTMLButtonElement;
    expect(shareBtn).toBeTruthy();

    await fixture.componentInstance.shareAnime();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/anime/52991`);
    expect(fixture.nativeElement.textContent.toLowerCase()).toContain('share link copied to clipboard.');

    // Still visible before 3 seconds
    vi.advanceTimersByTime(2900);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.toLowerCase()).toContain('share link copied to clipboard.');

    // Auto-dismissed after 3 seconds
    vi.advanceTimersByTime(200);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.toLowerCase()).not.toContain('share link copied to clipboard.');
  });

  it('loads all anime details on the standalone /anime/:malId page when opened directly without prior state', async () => {
    const appFixture = TestBed.createComponent(App);

    await router.navigateByUrl('/anime/52991');
    appFixture.detectChanges();

    const req = http.expectOne('/api/anime/52991/details');
    req.flush(mockDetails);
    await appFixture.whenStable();
    appFixture.detectChanges();

    const pageEl = appFixture.nativeElement.querySelector('app-anime-details-page') as HTMLElement;
    expect(pageEl).toBeTruthy();
    expect(pageEl.textContent).toContain('Sousou no Frieren');
    expect(pageEl.textContent).toContain("Frieren: Beyond Journey's End");
    expect(pageEl.textContent).toContain('28 episodes');
    expect(pageEl.textContent).toContain('Madhouse');
    expect(pageEl.textContent).toContain('An elven mage reflects on her journey.');
    expect(pageEl.textContent).toContain('Season 2 Announced');
  });
});


