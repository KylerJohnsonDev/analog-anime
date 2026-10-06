import { initBrowserSentry } from './app/shared/telemetry/browser-sentry';
initBrowserSentry(); // Initialize Sentry before Angular to capture full lifecycle

import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig);
