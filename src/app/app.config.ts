import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { Router, withInMemoryScrolling } from '@angular/router';
import { provideFileRouter, requestContextInterceptor, withExtraRoutes } from '@analogjs/router';
import { provideZard } from '@/shared/core/provider/providezard';
import * as Sentry from '@sentry/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideFileRouter(
      withExtraRoutes([
        {
          path: 'anime/:malId',
          outlet: 'details',
          loadComponent: () => import('./shared/anime/anime-side-panel.component'),
        },
      ]),
      withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' })
    ),
    provideHttpClient(
      withInterceptors([requestContextInterceptor])
    ),
    provideClientHydration(withEventReplay()),
    provideZard(),
    // Sentry error handling — captures unhandled Angular errors automatically
    { provide: ErrorHandler, useValue: Sentry.createErrorHandler({ showDialog: false }) },
    // Sentry performance — traces Angular route transitions
    { provide: Sentry.TraceService, deps: [Router] },
    { provide: APP_INITIALIZER, useFactory: () => () => {}, deps: [Sentry.TraceService], multi: true },
  ],
};
