import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AnimeEntry } from './anime.models';

@Injectable({ providedIn: 'root' })
export class AnimePanelService {
  private readonly router = inject(Router);
  private readonly knownById = signal<ReadonlyMap<number, AnimeEntry>>(new Map());

  readonly entries = signal<AnimeEntry[]>([]);

  setEntries(list: AnimeEntry[]): void {
    this.entries.set(list);
    if (!list.length) return;
    this.knownById.update((prev) => {
      const next = new Map(prev);
      for (const item of list) {
        next.set(item.malId, item);
      }
      return next;
    });
  }

  getEntry(malId: number): AnimeEntry | null {
    return this.entries().find((item) => item.malId === malId) ?? this.knownById().get(malId) ?? null;
  }

  indexOf(malId: number): number {
    return this.entries().findIndex((item) => item.malId === malId);
  }

  previousEntry(malId: number): AnimeEntry | null {
    const index = this.indexOf(malId);
    const list = this.entries();
    return index > 0 ? (list[index - 1] ?? null) : null;
  }

  nextEntry(malId: number): AnimeEntry | null {
    const index = this.indexOf(malId);
    const list = this.entries();
    return index >= 0 && index < list.length - 1 ? (list[index + 1] ?? null) : null;
  }

  open(anime: AnimeEntry): Promise<boolean> {
    this.knownById.update((prev) => {
      const next = new Map(prev);
      next.set(anime.malId, anime);
      return next;
    });
    return this.openById(anime.malId);
  }

  openById(malId: number): Promise<boolean> {
    return this.router.navigate([{ outlets: { details: ['anime', malId] } }], {
      skipLocationChange: true,
      queryParamsHandling: 'preserve',
    });
  }

  close(): Promise<boolean> {
    return this.router.navigate([{ outlets: { details: null } }], {
      skipLocationChange: true,
      queryParamsHandling: 'preserve',
    });
  }
}
