import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';

/**
 * Root application providers (passed to bootstrapApplication).
 *
 * `withHashLocation()` is the key Electron-specific choice: the packaged app is
 * served over `file://`, which has no server to handle path-based deep links, so
 * routes live in the URL fragment (e.g. index.html#/transactions) and resolve
 * purely client-side. `eventCoalescing` batches DOM events into fewer change-
 * detection passes.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
  ],
};
