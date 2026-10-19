import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

const THEME_STORAGE_KEY = 'anime-index-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly isDark = signal(false);

  constructor() {
    if (!this.isBrowser) return;
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    this.apply(savedTheme ? savedTheme === 'dark' : Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches));
  }

  toggle(): void {
    const nextThemeIsDark = !this.isDark();
    this.apply(nextThemeIsDark);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextThemeIsDark ? 'dark' : 'light');
  }

  private apply(dark: boolean): void {
    this.isDark.set(dark);
    this.document.documentElement.classList.toggle('dark', dark);
  }
}
