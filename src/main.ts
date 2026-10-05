import { initBrowserTelemetry } from './app/shared/telemetry/browser-telemetry';
initBrowserTelemetry(); // Initialize OTel before Angular to capture full page lifecycle

import { bootstrapApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig);
